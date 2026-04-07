import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import { VOICE_OPTIONS, type LiveApiModel } from "@/lib/domain/agent-builder";
import { getGeminiApiKey, getGeminiApiKeyEnvNames } from "@/lib/server/gemini-api-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PreviewRequestBody {
  voice?: string;
  text?: string;
  model?: LiveApiModel;
}

const previewTextFallback =
  "Hello! I am your AI assistant. I can help customers quickly and naturally.";

const previewModelFallback: LiveApiModel = "gemini-3.1-flash-live-preview";

const supportedPreviewModels: LiveApiModel[] = [
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
];

function createWavHeader(dataLength: number): Buffer {
  const numChannels = 1;
  const sampleRate = 24000;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBody(value: unknown): PreviewRequestBody {
  if (!isRecord(value)) {
    return {};
  }

  return {
    voice: typeof value.voice === "string" ? value.voice : undefined,
    text: typeof value.text === "string" ? value.text : undefined,
    model:
      typeof value.model === "string" && supportedPreviewModels.includes(value.model as LiveApiModel)
        ? (value.model as LiveApiModel)
        : undefined,
  };
}

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return previewTextFallback;
  }

  return trimmed.slice(0, 320);
}

function extractAudioChunks(message: LiveServerMessage): { chunks: string[]; turnComplete: boolean } {
  const chunks: string[] = [];
  const serverContent = (message as { serverContent?: unknown }).serverContent;

  if (!isRecord(serverContent)) {
    return { chunks, turnComplete: false };
  }

  const modelTurn = serverContent.modelTurn;
  if (isRecord(modelTurn) && Array.isArray(modelTurn.parts)) {
    for (const part of modelTurn.parts) {
      if (!isRecord(part) || !isRecord(part.inlineData)) {
        continue;
      }

      const data = part.inlineData.data;
      if (typeof data === "string" && data.length > 0) {
        chunks.push(data);
      }
    }
  }

  const turnComplete = serverContent.turnComplete === true;
  return { chunks, turnComplete };
}

export async function POST(request: Request) {
  try {
    const body = parseBody(await request.json().catch(() => null));
    const voice = body.voice?.trim();

    if (!voice) {
      return Response.json({ error: "voice is required" }, { status: 400 });
    }

    const availableVoices = new Set(VOICE_OPTIONS.map((item) => item.name));
    if (!availableVoices.has(voice)) {
      return Response.json({ error: "Unsupported voice" }, { status: 400 });
    }

    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      return Response.json(
        {
          error: `Missing Gemini API key. Set one of: ${getGeminiApiKeyEnvNames().join(", ")}.`,
          hint:
            "Ensure the key is defined in the Next.js app environment (usually .env.local) and restart the dev server after adding it.",
        },
        { status: 500 }
      );
    }

    const model = body.model ?? previewModelFallback;
    const prompt = normalizeText(body.text);

    const ai = new GoogleGenAI({ apiKey });
    const queue: LiveServerMessage[] = [];
    let sessionError: Error | null = null;

    const session = await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
        systemInstruction:
          "Speak naturally and clearly. Keep the response concise and suitable for a short voice preview.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          queue.push(message);
        },
        onerror: (errorEvent: { error?: Error; message?: string }) => {
          sessionError = errorEvent.error ?? new Error(errorEvent.message || "Voice preview generation failed");
        },
      },
    });

    session.sendRealtimeInput({ text: prompt });

    const audioChunks: string[] = [];
    const timeoutMs = 15000;
    const startedAt = Date.now();
    let turnComplete = false;

    while (!turnComplete && Date.now() - startedAt < timeoutMs) {
      if (sessionError) {
        break;
      }

      const message = queue.shift();
      if (!message) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        continue;
      }

      const extracted = extractAudioChunks(message);
      if (extracted.chunks.length > 0) {
        audioChunks.push(...extracted.chunks);
      }

      if (extracted.turnComplete) {
        turnComplete = true;
      }
    }

    session.close();

    if (sessionError) {
      throw sessionError;
    }

    if (audioChunks.length === 0) {
      return Response.json({ error: "No preview audio was generated" }, { status: 502 });
    }

    const pcmData = Buffer.concat(audioChunks.map((chunk) => Buffer.from(chunk, "base64")));
    const wavData = Buffer.concat([createWavHeader(pcmData.length), pcmData]);

    return new Response(wavData, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate voice preview";
    return Response.json({ error: message }, { status: 500 });
  }
}
