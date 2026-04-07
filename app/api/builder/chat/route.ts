import { GoogleGenAI } from "@google/genai";
import { NextRequest } from "next/server";
import { getGeminiApiKey, getGeminiApiKeyEnvNames } from "@/lib/server/gemini-api-key";
import { MODEL_FALLBACK_CHAIN, type ChatModel } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AgentConfig {
  name: string;
  systemPrompt: string;
  voice: string;
  tools: string[];
  channels: string[];
  greeting: string;
  liveApi?: Record<string, unknown>;
}

interface BuilderChatRequest {
  messages: ChatMessage[];
  agentConfig: AgentConfig;
  currentStep?: number;
}

// Try models in fallback order
async function generateWithFallback(
  ai: GoogleGenAI,
  geminiMessages: Array<{ role: string; parts: Array<{ text: string }> }>,
  systemPrompt: string,
  temperature: number,
  maxOutputTokens: number
): Promise<{ stream: AsyncGenerator<import("@google/genai").GenerateContentResponse, any, any>; usedModel: string }> {
  const modelsToTry = MODEL_FALLBACK_CHAIN.chat as ChatModel[];
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
      
      // Wait for the stream to be ready
      const stream = await streamPromise;
      
      // Test if the stream works by getting first chunk
      const testIterator = stream[Symbol.asyncIterator]();
      const firstChunk = await Promise.race([
        testIterator.next(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Model timeout")), 5000)
        ),
      ]);
      
      // If we got here, model works - recreate stream since we consumed first chunk
      const workingStream = await ai.models.generateContentStream({
        model,
        contents: geminiMessages,
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens,
        },
      });
      
      console.log(`[BuilderChat] Successfully using model: ${model}`);
      return { stream: workingStream, usedModel: model };
    } catch (error) {
      console.warn(`[BuilderChat] Model ${model} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All models in fallback chain failed");
}

const SYSTEM_PROMPT = `You are an AI agent builder that guides users through creating an AI agent step by step.

You MUST follow this EXACT flow and use SPECIAL TOKENS to update the agent configuration:

## BUILDER STEPS (follow in order):

**Step 1 - PURPOSE**: Ask what the agent should do. When they answer:
- Extract the purpose and output: [SET_PURPOSE:their purpose here]
- Then ask the next question

**Step 2 - NAME**: Ask what to name the agent. Suggest a name based on their purpose. When confirmed:
- Output: [SET_NAME:Agent Name Here]
- Then ask about personality

**Step 3 - PERSONALITY**: Ask about tone (professional, friendly, casual). When they answer:
- Generate a system prompt based on purpose + tone
- Output: [SET_PROMPT:The full system prompt you generated]
- Then output: [VOICE_PICKER] to show voice selection

**Step 4 - VOICE**: After showing voice picker, acknowledge their selection:
- Output: [SET_VOICE:selected_voice_id]
- Then output: [TOOL_PICKER] to show tool selection

**Step 5 - TOOLS**: After tool selection, acknowledge:
- Output: [SET_TOOLS:tool1,tool2,tool3]
- Then output: [CHANNEL_PICKER] to show channel selection

**Step 6 - CHANNELS**: After channel selection:
- Output: [SET_CHANNELS:channel1,channel2]
- Then output: [AGENT_SUMMARY] to show final summary

**Step 7 - COMPLETE**: When user confirms or says deploy:
- Output: [AGENT_READY] to trigger deployment

## RULES:
1. Ask ONE question at a time
2. Be concise and friendly (1-2 sentences max per response)
3. ALWAYS output the appropriate [SET_X:value] token when extracting info
4. The tokens trigger UI updates - don't explain them to the user
5. Keep the conversation moving - don't ask unnecessary follow-ups
6. If user gives multiple pieces of info at once, extract all of them with multiple tokens

## EXAMPLE FLOW:
User: "I want to build a customer support agent"
You: "Got it! [SET_PURPOSE:Customer support agent to help users with inquiries and issues] What would you like to name your agent? I'd suggest something like 'Support Buddy' or 'Help Desk Pro'."

User: "Call it Support Pro"
You: "[SET_NAME:Support Pro] What tone should Support Pro have? Professional and formal, friendly and casual, or somewhere in between?"

User: "Friendly but professional"
You: "[SET_PROMPT:You are Support Pro, a friendly and professional customer support assistant. You help users with their questions and issues in a warm but efficient manner. Always be helpful, clear, and empathetic.] Now let's pick a voice for Support Pro. [VOICE_PICKER]"

Current agent config: {agentConfig}
Current step: {currentStep}`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: `Missing Gemini key. Set one of: ${getGeminiApiKeyEnvNames().join(", ")}.`,
          hint:
            "Ensure the key is defined in the Next.js app environment (usually .env.local) and restart the dev server after adding it.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await request.json()) as BuilderChatRequest;
    const { messages, agentConfig, currentStep = 1 } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPromptWithConfig = SYSTEM_PROMPT
      .replace("{agentConfig}", JSON.stringify(agentConfig, null, 2))
      .replace("{currentStep}", String(currentStep));

    const geminiMessages = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    // Use fallback chain to try multiple models
    const { stream: response, usedModel } = await generateWithFallback(
      ai,
      geminiMessages,
      systemPromptWithConfig,
      0.7,
      1024
    );
    
    console.log(`[BuilderChat] Streaming with model: ${usedModel}`);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Stream error";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to process request";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
