import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ??
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
    ""
  );
}

// ⚠️ DEPRECATED: This handler uses Telnyx basic TTS (male/female only) which
// sounds robotic. AI agent calls now route through the backend server's Gemini
// Live audio streaming path (server/src/routes/telnyx.ts → telnyxBridge.ts)
// which uses the agent's real configured voice (Orus, Puck, Kore, etc.).

/**
 * Maps Gemini voice names → Telnyx basic TTS gender ("male" | "female").
 */
function mapVoiceToTelnyx(agentVoice: string): string {
  const v = agentVoice.toLowerCase();
  const maleVoices = ["orus", "charon", "fenrir", "puck", "achird", "algenib", "rasalgethi", "zubenelgenubi", "sadachbia"];
  if (maleVoices.includes(v) || v.includes("male")) return "male";
  return "female";
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiHandlerBody {
  agentId: string;
  callControlId: string;
  transcript: string;
  history?: ConversationMessage[];
  missionContext?: string;
}

/**
 * POST /api/telnyx/ai-handler
 *
 * Called by the Telnyx webhook on every final transcription event.
 * 1. Fetches agent config (system_prompt, voice, greeting_message) from Supabase
 * 2. Calls Gemini with the full conversation history + new transcript
 * 3. Speaks the AI reply back via Telnyx call-control
 *
 * Body: { agentId, callControlId, transcript, history? }
 * Returns: { response: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AiHandlerBody;
    const { agentId, callControlId, transcript, history = [], missionContext } = body;

    if (!agentId || !callControlId || !transcript) {
      return NextResponse.json(
        { error: "agentId, callControlId, and transcript are required." },
        { status: 400 }
      );
    }

    // 1. Fetch agent config
    const supabase = getSupabaseAdmin();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, system_prompt, voice, greeting_message")
      .eq("id", agentId)
      .maybeSingle();

    if (agentError || !agent) {
      console.error("[AI Handler] Agent not found:", agentId, agentError);
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const basePrompt =
      agent.system_prompt?.trim() ||
      `You are ${agent.name ?? "an AI assistant"}. Be helpful, concise, and friendly.`;
    const systemPrompt = missionContext
      ? `${basePrompt}\n\n${missionContext}\n\nYou are on a phone call — keep responses short (1-3 sentences). Stay focused on the mission objective.`
      : `${basePrompt}\n\nYou are on a phone call — keep responses short (1-3 sentences).`;

    // 2. Build Gemini conversation
    const geminiApiKey = getGeminiApiKey();
    if (!geminiApiKey) {
      console.error("[AI Handler] No Gemini API key configured.");
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }

    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

    // Build the contents array for Gemini
    const contents = [
      // Inject conversation history
      ...history.map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      // Current user message
      {
        role: "user" as const,
        parts: [{ text: transcript }],
      },
    ];

    console.log(
      `[AI Handler] Agent: ${agent.name}, Call: ${callControlId}, Transcript: "${transcript}"`
    );

    const geminiResponse = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 200,
        temperature: 0.7,
      },
    });

    const aiText =
      geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
      "I'm sorry, I didn't catch that. Could you repeat?";

    console.log(`[AI Handler] AI response: "${aiText}"`);

    // 3. Speak the response via Telnyx
    const telnyxVoice = mapVoiceToTelnyx(agent.voice ?? "");
    const speakUrl = `${TELNYX_API_URL}/calls/${callControlId}/actions/speak`;

    const speakRes = await fetch(speakUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TELNYX_API_KEY}`,
      },
      body: JSON.stringify({
        payload: aiText,
        voice: telnyxVoice,
        language: "en-US",
        payload_type: "text",
        service_level: "basic",
      }),
    });

    if (!speakRes.ok) {
      const speakError = await speakRes.json().catch(() => ({}));
      console.error("[AI Handler] Telnyx speak failed:", speakError);
      // Don't fail the response — the AI response was generated successfully
    } else {
      console.log(`[AI Handler] Speaking response on call ${callControlId}`);
    }

    return NextResponse.json({ response: aiText });
  } catch (error) {
    console.error("[AI Handler] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI handler failed." },
      { status: 500 }
    );
  }
}
