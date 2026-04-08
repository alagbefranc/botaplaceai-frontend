import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { getGeminiApiKey, getGeminiApiKeyEnvNames } from "@/lib/server/gemini-api-key";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

interface CopilotChatRequest {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context: {
    pageType: string;
    pageDescription: string;
    agentId?: string;
    isAuthenticated: boolean;
  };
  agentConfig?: {
    name: string;
    systemPrompt: string;
    voice: string;
    tools: string[];
    channels: string[];
    greeting: string;
    liveApi?: Record<string, unknown>;
    memoryEnabled?: boolean;
    guardrailsEnabled?: boolean;
    escalationEnabled?: boolean;
  };
}

// Try models in fallback order
async function generateWithFallback(
  ai: GoogleGenAI,
  geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemPrompt: string,
  temperature: number,
  maxOutputTokens: number
): Promise<{ stream: AsyncGenerator<import("@google/genai").GenerateContentResponse, any, any>; usedModel: string }> {
  const modelsToTry = [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
  ];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const streamPromise = ai.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens,
        },
      });
      
      const stream = await streamPromise;
      
      // Test if the stream works
      const testIterator = stream[Symbol.asyncIterator]();
      await Promise.race([
        testIterator.next(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Model timeout")), 5000)
        ),
      ]);
      
      // Recreate stream for actual use
      const workingStream = await ai.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens,
        },
      });
      
      console.log(`[CopilotChat] Using model: ${model}`);
      return { stream: workingStream, usedModel: model };
    } catch (error) {
      console.warn(`[CopilotChat] Model ${model} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All models failed");
}

function buildSystemPrompt(context: CopilotChatRequest["context"], agentConfig?: CopilotChatRequest["agentConfig"]): string {
  let prompt = `You are an AI Workspace Copilot for an Omnichannel AI Agent Platform.

CURRENT CONTEXT:
- Page: ${context.pageType}
- Description: ${context.pageDescription}
- User Status: ${context.isAuthenticated ? "Authenticated" : "Guest"}
${context.agentId ? `- Current Agent ID: ${context.agentId}` : ""}

Your capabilities:
1. Answer questions about the platform and AI agents
2. Help troubleshoot issues
3. Guide users through configuration
4. Explain features and best practices
5. Provide contextual help based on the current page

Guidelines:
- Be concise and helpful
- Reference the current page context when relevant
- If the user is building an agent, guide them step by step
- Use [VOICE_PICKER], [TOOL_PICKER], [CHANNEL_PICKER], [AGENT_SUMMARY] tokens when appropriate for agent building
- For troubleshooting, ask clarifying questions first
- If authenticated, you can reference their data (but don't make up information)
- If guest, remind them of limitations (1 agent max) but don't be pushy about signup

`;

  if (agentConfig) {
    prompt += `\nCURRENT AGENT CONFIGURATION:\n${JSON.stringify(agentConfig, null, 2)}\n`;
  }

  // Page-specific guidance
  switch (context.pageType) {
    case "home":
      prompt += `\nOn the home page, you help users build a COMPLETE, production-ready AI agent step by step.

You MUST use SPECIAL TOKENS to update the agent configuration. Follow these steps IN ORDER:

**Step 1 - PURPOSE**: Ask what the agent should do. When they answer:
- Output: [SET_PURPOSE:their purpose here]

**Step 2 - NAME**: Suggest a name based on their purpose and confirm. When confirmed:
- Output: [SET_NAME:Agent Name Here]

**Step 3 - PERSONALITY**: Ask about tone (professional, friendly, casual, empathetic). When they answer:
- Generate a detailed system prompt (3-5 sentences) based on purpose + tone
- Output: [SET_PROMPT:The full system prompt you generated]
- Then output: [VOICE_PICKER]

**Step 4 - VOICE**: After voice picker, acknowledge their selection:
- Output: [SET_VOICE:selected_voice_id]
- Then output: [TOOL_PICKER]

**Step 5 - TOOLS**: After tool selection:
- Output: [SET_TOOLS:tool1,tool2,tool3]
- Then output: [CHANNEL_PICKER]

**Step 6 - CHANNELS**: After channel selection:
- Output: [SET_CHANNELS:channel1,channel2]
- Then ask about the greeting message

**Step 7 - GREETING**: Ask "What should the agent say when someone starts a conversation?" When they answer:
- Output: [SET_GREETING:the greeting message]
- Then ask about memory

**Step 8 - MEMORY**: Ask "Should this agent remember previous conversations with the same user? (yes/no)" When they answer:
- Output: [SET_MEMORY:true] or [SET_MEMORY:false]
- Then ask about escalation

**Step 9 - ESCALATION**: Ask "Should the agent transfer users to a human agent when they're frustrated or request it? (yes/no)" When they answer:
- Output: [SET_ESCALATION:true] or [SET_ESCALATION:false]
- Then ask about guardrails

**Step 10 - GUARDRAILS**: Ask "Are there any topics this agent must NEVER discuss? (e.g., competitors, politics, medical advice — or say 'none')" When they answer:
- If they mention topics, output: [SET_GUARDRAILS:enabled]
- If they say none, output: [SET_GUARDRAILS:disabled]
- Then output: [AGENT_SUMMARY]

**Step 11 - COMPLETE**: When user confirms the summary or says deploy:
- Output: [AGENT_READY]

RULES:
1. Ask ONE question at a time
2. Be concise — 1-2 sentences max
3. ALWAYS output the [SET_X:value] token immediately when a step is confirmed
4. Keep moving — don't ask unnecessary follow-ups
5. If user skips a step or says "skip" / "default", use sensible defaults and continue`;
      break;
    case "agent-detail":
      prompt += `\nOn the agent detail page, help the user configure any aspect of the agent across all tabs:
- Core Settings: name, system prompt, voice, channels
- Behavior: communication style, language, idle messages
- Messages: greeting message, hold messages
- Speech: transcriber model, background noise, voice personality
- Tools: which tools to enable, custom functions
- Knowledge: manage knowledge base documents
- Memory: enable/disable, conversation window, scope
- Insights: what data to extract from conversations
- Security: guardrails topics to block
- Escalation: when/how to transfer to humans
- Advanced: Gemini Live API model and settings
Suggest specific config changes, explain settings, and guide them to the right tab.`;
      break;
    case "knowledge-base":
      prompt += `\nOn the knowledge base page, help with document management, ingestion troubleshooting, and optimization for better RAG performance.`;
      break;
    case "conversations":
      prompt += `\nOn the conversations page, help analyze transcripts, identify patterns, suggest training improvements, and review escalation reasons.`;
      break;
    case "analytics":
      prompt += `\nOn the analytics page, help interpret metrics, identify trends, and suggest optimizations based on the data.`;
      break;
    case "phone-numbers":
      prompt += `\nOn the phone numbers page, help with voice line provisioning, configuration, and troubleshooting call issues.`;
      break;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `Missing Gemini key. Set one of: ${getGeminiApiKeyEnvNames().join(", ")}.`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as CopilotChatRequest;
    const { messages, context, agentConfig } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // If authenticated and they need data, fetch it
    let contextData: Record<string, unknown> = {};
    if (context.isAuthenticated && context.agentId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: agent } = await supabase
            .from("agents")
            .select("*")
            .eq("id", context.agentId)
            .single();
          if (agent) {
            contextData.agent = agent;
          }
        }
      } catch (error) {
        console.warn("[CopilotChat] Failed to fetch agent data:", error);
      }
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(context, agentConfig) + 
      (Object.keys(contextData).length > 0 ? `\n\nADDITIONAL CONTEXT:\n${JSON.stringify(contextData, null, 2)}` : "");

    const geminiMessages = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const { stream: response } = await generateWithFallback(
      ai,
      geminiMessages,
      systemPrompt,
      0.7,
      2048
    );

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text || "";
            if (text) {
              const data = `data: ${JSON.stringify({ text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          console.error("[CopilotChat] Streaming error:", errMsg);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[CopilotChat] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
