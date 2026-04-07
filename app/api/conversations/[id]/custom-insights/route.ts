import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { GoogleGenAI, Type } from "@google/genai";
import type { InsightParameter, CustomInsightResult } from "@/lib/domain/agent-builder";
import { deliverInsightsToGroups } from "@/lib/server/insight-webhook";

export const runtime = "nodejs";

// Get Gemini API key
function getGeminiApiKey(): string | undefined {
  return (
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY
  );
}

// Build Gemini schema from insight parameters
function buildGeminiSchema(parameters: InsightParameter[]) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of parameters) {
    let propSchema: Record<string, unknown> = {};

    switch (param.type) {
      case "boolean":
        propSchema = { type: Type.BOOLEAN };
        break;
      case "number":
        propSchema = { type: Type.NUMBER };
        break;
      case "string":
        if (param.enumValues?.length) {
          propSchema = { type: Type.STRING, enum: param.enumValues };
        } else {
          propSchema = { type: Type.STRING };
        }
        break;
      case "array":
        propSchema = {
          type: Type.ARRAY,
          items: { type: param.itemType === "number" ? Type.NUMBER : Type.STRING },
        };
        break;
    }

    propSchema.nullable = !param.required;
    properties[param.name] = propSchema;

    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: Type.OBJECT,
    properties,
    required: required.length > 0 ? required : undefined,
  };
}

// GET - Fetch custom insight results for a conversation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("custom_insight_results")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("org_id", member.orgId)
      .order("extracted_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: CustomInsightResult[] = (data || []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      definitionId: row.definition_id,
      orgId: row.org_id,
      result: row.result,
      extractedAt: row.extracted_at,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/conversations/[id]/custom-insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Extract custom insights for a conversation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();
    const body = await request.json();

    const { definitionIds } = body;

    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    // Verify conversation belongs to org
    const { data: conversation, error: convError } = await admin
      .from("conversations")
      .select("id, agent_id")
      .eq("id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch insight definitions to extract
    let definitionsQuery = admin
      .from("insight_definitions")
      .select("*")
      .eq("org_id", member.orgId)
      .eq("is_template", false);

    if (definitionIds?.length) {
      definitionsQuery = definitionsQuery.in("id", definitionIds);
    }

    const { data: definitions, error: defError } = await definitionsQuery;

    if (defError || !definitions?.length) {
      return NextResponse.json(
        { error: "No insight definitions found" },
        { status: 400 }
      );
    }

    // Fetch messages
    const { data: messages, error: msgError } = await admin
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError || !messages?.length) {
      return NextResponse.json(
        { error: "No messages found" },
        { status: 400 }
      );
    }

    // Build transcript
    interface MessageRow { role: string; content: string | null }
    const transcript = messages
      .filter((m: MessageRow) => m.content && (m.role === "user" || m.role === "assistant"))
      .map((m: MessageRow) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
    const extractedResults: Array<{ definitionId: string; name: string; result: Record<string, unknown> }> = [];

    // Extract each insight definition
    for (const def of definitions) {
      try {
        let extractedResult: Record<string, unknown>;

        if (def.insight_type === "structured") {
          const schema = def.schema as { parameters: InsightParameter[] };
          if (!schema?.parameters?.length) continue;

          const geminiSchema = buildGeminiSchema(schema.parameters);

          const prompt = `Analyze this conversation and extract the following information. Only include information that is clearly stated or strongly implied.

CONVERSATION:
${transcript}

FIELDS TO EXTRACT:
${schema.parameters.map((p) => `- ${p.name}: ${p.description}${p.required ? " (required)" : ""}`).join("\n")}

Extract the data as JSON.`;

          const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: geminiSchema,
            },
          });

          const text = response.text || "{}";
          extractedResult = JSON.parse(text);
        } else {
          // Unstructured - use the prompt directly
          const prompt = `${def.prompt || "Extract relevant information from this conversation."}

CONVERSATION:
${transcript}`;

          const response = await genAI.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
          });

          extractedResult = { text: response.text || "" };
        }

        // Upsert result
        const { error: upsertError } = await admin
          .from("custom_insight_results")
          .upsert(
            {
              conversation_id: conversationId,
              definition_id: def.id,
              org_id: member.orgId,
              result: extractedResult,
              extracted_at: new Date().toISOString(),
            },
            {
              onConflict: "conversation_id,definition_id",
            }
          );

        if (upsertError) {
          console.error("Failed to save result:", upsertError);
        } else {
          extractedResults.push({
            definitionId: def.id,
            name: def.name,
            result: extractedResult,
          });
        }
      } catch (extractError) {
        console.error(`Failed to extract ${def.name}:`, extractError);
      }
    }

    // Deliver to webhooks
    if (extractedResults.length > 0) {
      try {
        await deliverInsightsToGroups(conversationId, member.orgId, extractedResults);
      } catch (webhookError) {
        console.error("Webhook delivery failed:", webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      extractedCount: extractedResults.length,
      results: extractedResults,
    });
  } catch (err) {
    if (err instanceof ApiRouteError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/conversations/[id]/custom-insights error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
