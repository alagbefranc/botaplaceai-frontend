import { NextResponse } from "next/server";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { GoogleGenAI, Type } from "@google/genai";
import type { ConversationInsight, UserProfile, SentimentType } from "@/lib/domain/agent-builder";

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

// Insight extraction schema for Gemini structured output
const insightSchema = {
  type: Type.OBJECT,
  properties: {
    user_profile: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, nullable: true },
        email: { type: Type.STRING, nullable: true },
        phone: { type: Type.STRING, nullable: true },
        company: { type: Type.STRING, nullable: true },
        location: { type: Type.STRING, nullable: true },
        language: { type: Type.STRING, nullable: true },
      },
    },
    primary_intent: { type: Type.STRING, nullable: true },
    topics: { type: Type.ARRAY, items: { type: Type.STRING } },
    sentiment: { 
      type: Type.STRING, 
      enum: ["positive", "neutral", "negative", "mixed"],
      nullable: true 
    },
    satisfaction_score: { type: Type.INTEGER, nullable: true },
    issue_resolved: { type: Type.BOOLEAN, nullable: true },
    action_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          assignee: { type: Type.STRING, nullable: true },
          due_date: { type: Type.STRING, nullable: true },
        },
        required: ["description"],
      },
    },
    summary: { type: Type.STRING },
    key_points: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["topics", "action_items", "summary", "key_points"],
};

interface InsightExtractionResult {
  user_profile?: UserProfile;
  primary_intent?: string;
  topics: string[];
  sentiment?: SentimentType;
  satisfaction_score?: number;
  issue_resolved?: boolean;
  action_items: Array<{ description: string; assignee?: string; due_date?: string }>;
  summary: string;
  key_points: string[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

    // Fetch existing insights
    const { data: insight, error } = await admin
      .from("conversation_insights")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!insight) {
      return NextResponse.json({ insight: null });
    }

    // Transform to camelCase
    const transformed: ConversationInsight = {
      id: insight.id,
      conversationId: insight.conversation_id,
      userProfile: insight.user_profile || {},
      primaryIntent: insight.primary_intent,
      topics: insight.topics || [],
      sentiment: insight.sentiment,
      satisfactionScore: insight.satisfaction_score,
      issueResolved: insight.issue_resolved,
      actionItems: (insight.action_items || []).map((item: Record<string, unknown>) => ({
        description: item.description as string,
        assignee: item.assignee as string | undefined,
        dueDate: item.due_date as string | undefined,
        completed: item.completed as boolean | undefined,
      })),
      summary: insight.summary,
      keyPoints: insight.key_points || [],
      extractedAt: insight.extracted_at,
      extractionModel: insight.extraction_model,
    };

    return NextResponse.json({ insight: transformed });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to fetch insights.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { admin, member } = await getOrgMemberContext();

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
      .select("id, agent_id, channel, external_user_id")
      .eq("id", conversationId)
      .eq("org_id", member.orgId)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Fetch all messages for this conversation
    const { data: messages, error: msgError } = await admin
      .from("messages")
      .select("role, content, tool_calls, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages found in conversation" },
        { status: 400 }
      );
    }

    // Build conversation transcript
    interface MessageRow { role: string; content: string | null }
    const transcript = messages
      .filter((m: MessageRow) => m.content && (m.role === "user" || m.role === "assistant"))
      .map((m: MessageRow) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");

    // Extract insights using Gemini
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

    const extractionPrompt = `Analyze this conversation and extract insights. Be thorough but concise.

CONVERSATION TRANSCRIPT:
${transcript}

Extract the following:
1. User Profile: Any personal information mentioned (name, email, phone, company, location, language)
2. Primary Intent: What was the main goal or purpose of the conversation?
3. Topics: Key topics or subjects discussed
4. Sentiment: Overall emotional tone (positive, neutral, negative, or mixed)
5. Satisfaction Score: 1-5 scale based on how satisfied the user seemed (1=very dissatisfied, 5=very satisfied)
6. Issue Resolved: Was the user's issue or question resolved?
7. Action Items: Any tasks, follow-ups, or commitments mentioned
8. Summary: A brief 2-3 sentence summary of the conversation
9. Key Points: 3-5 main takeaways from the conversation

Only include information that was actually mentioned or clearly implied in the conversation.`;

    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: insightSchema,
      },
    });

    const responseText = result.text;
    if (!responseText) {
      throw new Error("Empty response from Gemini");
    }

    const extracted: InsightExtractionResult = JSON.parse(responseText);

    // Upsert insights into database
    const insightData = {
      conversation_id: conversationId,
      org_id: member.orgId,
      user_profile: extracted.user_profile || {},
      primary_intent: extracted.primary_intent,
      topics: extracted.topics || [],
      sentiment: extracted.sentiment,
      satisfaction_score: extracted.satisfaction_score,
      issue_resolved: extracted.issue_resolved,
      action_items: extracted.action_items || [],
      summary: extracted.summary,
      key_points: extracted.key_points || [],
      extracted_at: new Date().toISOString(),
      extraction_model: "gemini-3-flash-preview",
    };

    const { data: upserted, error: upsertError } = await admin
      .from("conversation_insights")
      .upsert(insightData, { onConflict: "conversation_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[InsightExtraction] Upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Transform to camelCase for response
    const transformed: ConversationInsight = {
      id: upserted.id,
      conversationId: upserted.conversation_id,
      userProfile: upserted.user_profile || {},
      primaryIntent: upserted.primary_intent,
      topics: upserted.topics || [],
      sentiment: upserted.sentiment,
      satisfactionScore: upserted.satisfaction_score,
      issueResolved: upserted.issue_resolved,
      actionItems: (upserted.action_items || []).map((item: Record<string, unknown>) => ({
        description: item.description as string,
        assignee: item.assignee as string | undefined,
        dueDate: item.due_date as string | undefined,
        completed: item.completed as boolean | undefined,
      })),
      summary: upserted.summary,
      keyPoints: upserted.key_points || [],
      extractedAt: upserted.extracted_at,
      extractionModel: upserted.extraction_model,
    };

    return NextResponse.json({ insight: transformed });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[InsightExtraction] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Extraction failed" },
      { status: 500 }
    );
  }
}