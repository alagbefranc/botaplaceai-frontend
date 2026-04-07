import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey, getGeminiApiKeyEnvNames } from "@/lib/server/gemini-api-key";
import { MODEL_FALLBACK_CHAIN, type ChatModel } from "@/lib/domain/agent-builder";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
type ContentItem = { role: string; parts: ContentPart[] };

// Try models in fallback order for widget chat
async function generateWithFallback(
  genAI: GoogleGenAI,
  conversationHistory: ContentItem[],
  systemPrompt: string
): Promise<{ stream: AsyncGenerator<import("@google/genai").GenerateContentResponse, any, any>; usedModel: string }> {
  const modelsToTry = MODEL_FALLBACK_CHAIN.chat as ChatModel[];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      // If we got here, model works - recreate stream since we consumed first chunk
      const workingStream = await genAI.models.generateContentStream({
        model,
        contents: conversationHistory,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      console.log(`[WidgetChat] Successfully using model: ${model}`);
      return { stream: workingStream, usedModel: model };
    } catch (error) {
      console.warn(`[WidgetChat] Model ${model} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All models in fallback chain failed");
}

export const runtime = "nodejs";

interface ChatRequestBody {
  agentId: string;
  message: string;
  sessionId: string;
  attachments?: Array<{ type: "image"; mimeType: string; data: string }>;
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({
        error: `Missing Gemini key. Set one of: ${getGeminiApiKeyEnvNames().join(", ")}.`,
        hint:
          "Ensure the key is defined in the Next.js app environment (usually .env.local) and restart the dev server after adding it.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { agentId, message, sessionId, attachments } = body;

  if (!agentId || !sessionId || (!message && !attachments?.length)) {
    return new Response(
      JSON.stringify({ error: "agentId, sessionId, and message or attachments are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, system_prompt, voice, tools, org_id, greeting_message, knowledge_base_id")
      .eq("id", agentId)
      .eq("status", "active")
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ error: "Agent not found or inactive" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let conversationId: string;
    let isNewConversation = false;
    const { data: existingConversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("external_user_id", sessionId)
      .eq("agent_id", agentId)
      .single();

    if (existingConversation) {
      conversationId = existingConversation.id;
    } else {
      isNewConversation = true;
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          agent_id: agentId,
          org_id: agent.org_id,
          channel: "web_chat",
          external_user_id: sessionId,
        })
        .select("id")
        .single();

      if (convError || !newConversation) {
        return new Response(
          JSON.stringify({ error: "Failed to create conversation" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      conversationId = newConversation.id;

      // Store greeting message as the first assistant message in a new conversation
      if (agent.greeting_message) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          org_id: agent.org_id,
          role: "assistant",
          content: agent.greeting_message,
        });
      }
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      org_id: agent.org_id,
      role: "user",
      content: message,
    });

    // Fetch conversation history for multi-turn context (last 20 messages)
    const { data: historyRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const conversationHistory: ContentItem[] = (historyRows ?? [])
      .filter((m: { role: string; content: string | null }) => m.content && (m.role === "user" || m.role === "assistant"))
      .map((m: { role: string; content: string | null }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content! }] as ContentPart[],
      }));

    // If the latest user turn has image attachments, inject them into the last history entry
    if (attachments?.length && conversationHistory.length > 0) {
      const lastEntry = conversationHistory[conversationHistory.length - 1];
      if (lastEntry.role === "user") {
        const imageParts: ContentPart[] = attachments
          .filter(a => a.type === "image")
          .map(a => ({ inlineData: { mimeType: a.mimeType, data: a.data } }));
        lastEntry.parts = [...imageParts, ...lastEntry.parts];
      }
    }

    // Build system prompt with knowledge base grounding
    let systemPrompt = agent.system_prompt || `You are ${agent.name}, a helpful AI assistant.`;
    systemPrompt += `\n\nIMPORTANT STYLE RULES:\n- Keep responses SHORT and conversational — 2-3 sentences max unless the user asks for detail.\n- Sound natural and human, not robotic or overly formal.\n- Do NOT use markdown formatting like ** or ## or bullet lists unless the user explicitly asks for a list.\n- Use plain, friendly language.`;

    // Fetch knowledge base content if linked
    if (agent.knowledge_base_id) {
      const { data: kb } = await supabase
        .from("knowledge_bases")
        .select("source_config")
        .eq("id", agent.knowledge_base_id)
        .single();

      if (kb?.source_config?.sample_chunks) {
        const chunks = (kb.source_config.sample_chunks as string[]).slice(0, 6).join("\n\n---\n\n");
        systemPrompt += `\n\n## Reference Knowledge Base\nUse the following extracted content to ground your responses. Prefer this information when answering questions:\n\n${chunks}`;
      }
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send greeting as first SSE event for new conversations
          if (isNewConversation && agent.greeting_message) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ greeting: agent.greeting_message })}\n\n`)
            );
          }

          // Use fallback chain to try multiple models
          const { stream: response, usedModel } = await generateWithFallback(
            genAI,
            conversationHistory,
            systemPrompt
          );
          
          console.log(`[WidgetChat] Streaming with model: ${usedModel}`);

          let fullResponse = "";

          for await (const chunk of response) {
            const text = chunk.text || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            }
          }

          await supabase.from("messages").insert({
            conversation_id: conversationId,
            org_id: agent.org_id,
            role: "assistant",
            content: fullResponse,
          });

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("Streaming error:", errMsg, error);
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({ error: `Generation failed: ${errMsg}` })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Widget chat error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
