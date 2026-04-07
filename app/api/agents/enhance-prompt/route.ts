import { NextResponse } from "next/server";
import { getOrgMemberContext, ApiRouteError } from "@/lib/server/org-member";
import { MODEL_FALLBACK_CHAIN, type ChatModel } from "@/lib/domain/agent-builder";

export const runtime = "nodejs";

// Try models in fallback order for prompt enhancement
async function enhanceWithFallback(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
): Promise<{ text: string; usedModel: string }> {
  const modelsToTry = MODEL_FALLBACK_CHAIN.chat as ChatModel[];
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: userMessage }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[EnhancePrompt] Model ${model} failed:`, errorText);
        throw new Error(`Model ${model} returned ${response.status}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        throw new Error(`Model ${model} returned empty response`);
      }

      console.log(`[EnhancePrompt] Successfully using model: ${model}`);
      return { text, usedModel: model };
    } catch (error) {
      console.warn(`[EnhancePrompt] Model ${model} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError || new Error("All models in fallback chain failed");
}

interface EnhancePromptBody {
  prompt: string;
  agentName?: string;
  tools?: string[];
}

const ENHANCER_SYSTEM_PROMPT = `You are an expert prompt engineer for AI voice and chat agents built on the Gemini Live API.

Your job is to take a raw, unstructured system prompt and restructure it into Google's recommended format for optimal Live API performance. The output must follow this exact structure:

**Persona:**
[Define the agent's name, role, personality, speaking style, and any specific characteristics. If the user mentions an accent or language, include it here. Be specific and vivid.]

**Conversational Rules:**
[Number each rule. Separate one-time steps (like gathering info) from conversational loops (like discussing topics). For each step that involves a tool call, name the tool explicitly and describe when to call it. Keep rules actionable and sequential.]

**General Guidelines:**
[Provide behavioral guidelines: response length, tone, how to handle off-topic requests, progressive disclosure, etc. Keep these concise.]

**Guardrails:**
[Define what the agent must NEVER do, safety boundaries, and how to handle edge cases like frustrated users, sensitive topics, or requests outside scope.]

Rules for enhancement:
1. PRESERVE the user's original intent, domain, and personality completely.
2. EXPAND vague instructions into specific, actionable rules.
3. If the original prompt mentions tools or actions (like sending emails, booking appointments, looking up data), reference them by name in the conversational rules.
4. Add sensible guardrails even if the original prompt doesn't mention them.
5. Keep the persona section vivid but professional.
6. Use the word "unmistakably" when specifying language requirements per Google's guidance.
7. Reference these built-in tools where relevant:
   - search_knowledge_base: for looking up company docs/FAQs
   - transfer_to_human: for escalating to a live agent
   - end_conversation: for ending calls/chats
   - transfer_to_agent: for handing off to another AI agent
   - call_api_endpoint: for external API lookups
   - collect_user_info: for gathering user details (name, email, phone, etc.)
8. Output ONLY the enhanced prompt. No explanations, no preamble, no markdown code blocks.`;

export async function POST(request: Request) {
  try {
    const { member } = await getOrgMemberContext();
    if (!member) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as EnhancePromptBody;
    const { prompt, agentName, tools } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide a prompt with at least 10 characters to enhance." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured." },
        { status: 500 },
      );
    }

    // Build the user message with context
    let userMessage = `Enhance this system prompt:\n\n${prompt.trim()}`;
    if (agentName) {
      userMessage += `\n\nAgent name: ${agentName}`;
    }
    if (tools && tools.length > 0) {
      userMessage += `\n\nEnabled external tools: ${tools.join(", ")}`;
    }

    // Use fallback chain to try multiple models
    const { text: enhancedPrompt, usedModel } = await enhanceWithFallback(
      apiKey,
      ENHANCER_SYSTEM_PROMPT,
      userMessage
    );
    
    console.log(`[EnhancePrompt] Enhanced using model: ${usedModel}`);

    return NextResponse.json({ enhanced: enhancedPrompt });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[EnhancePrompt] Error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
