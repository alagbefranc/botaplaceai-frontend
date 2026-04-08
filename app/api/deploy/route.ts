import { NextResponse } from "next/server";
import {
  buildWidgetEmbedCode,
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_GUARDRAILS_CONFIG,
  DEFAULT_INSIGHT_EXTRACTION_CONFIG,
  DEFAULT_LIVE_API_CONFIG,
  DEFAULT_MEMORY_CONFIG,
  type EscalationConfig,
  type GuardrailsConfig,
  type InsightExtractionConfig,
  type LiveApiConfig,
  type LiveApiEndSensitivity,
  type LiveApiMediaResolution,
  type LiveApiModel,
  type LiveApiStartSensitivity,
  type LiveApiThinkingLevel,
  type LiveApiTurnCoverage,
  type MemoryConfig,
} from "@/lib/domain/agent-builder";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";
import { provisionVoiceLine } from "@/lib/server/voice-line-service";

export const runtime = "nodejs";

interface DeployAgentBody {
  id?: string;
  name?: string;
  systemPrompt?: string;
  voice?: string;
  tools?: string[];
  channels?: string[];
  greetingMessage?: string;
  status?: "draft" | "active" | "paused";
  liveApi?: Partial<LiveApiConfig>;
  memory?: Partial<MemoryConfig>;
  guardrails?: Partial<GuardrailsConfig>;
  escalation?: Partial<EscalationConfig>;
  insightExtraction?: Partial<InsightExtractionConfig>;
}

const liveApiModels: LiveApiModel[] = [
  "gemini-3.1-flash-live-preview",
  "gemini-2.5-flash-native-audio-preview-12-2025",
];

const liveApiThinkingLevels: LiveApiThinkingLevel[] = ["minimal", "low", "medium", "high"];
const liveApiStartSensitivities: LiveApiStartSensitivity[] = [
  "START_SENSITIVITY_LOW",
  "START_SENSITIVITY_HIGH",
];
const liveApiEndSensitivities: LiveApiEndSensitivity[] = ["END_SENSITIVITY_LOW", "END_SENSITIVITY_HIGH"];
const liveApiTurnCoverages: LiveApiTurnCoverage[] = [
  "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
  "TURN_INCLUDES_ONLY_ACTIVITY",
];
const liveApiMediaResolutions: LiveApiMediaResolution[] = [
  "MEDIA_RESOLUTION_LOW",
  "MEDIA_RESOLUTION_MEDIUM",
  "MEDIA_RESOLUTION_HIGH",
];

function sanitizeArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

function pickEnumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && allowed.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

function normalizeLiveApiConfig(input: unknown): LiveApiConfig {
  const source = isRecord(input) ? input : {};

  return {
    model: pickEnumValue(source.model, liveApiModels, DEFAULT_LIVE_API_CONFIG.model),
    thinkingLevel: pickEnumValue(
      source.thinkingLevel,
      liveApiThinkingLevels,
      DEFAULT_LIVE_API_CONFIG.thinkingLevel,
    ),
    thinkingBudget: clampInteger(source.thinkingBudget, DEFAULT_LIVE_API_CONFIG.thinkingBudget, 0, 8192),
    includeThoughts:
      typeof source.includeThoughts === "boolean"
        ? source.includeThoughts
        : DEFAULT_LIVE_API_CONFIG.includeThoughts,
    inputAudioTranscription:
      typeof source.inputAudioTranscription === "boolean"
        ? source.inputAudioTranscription
        : DEFAULT_LIVE_API_CONFIG.inputAudioTranscription,
    outputAudioTranscription:
      typeof source.outputAudioTranscription === "boolean"
        ? source.outputAudioTranscription
        : DEFAULT_LIVE_API_CONFIG.outputAudioTranscription,
    automaticVad:
      typeof source.automaticVad === "boolean"
        ? source.automaticVad
        : DEFAULT_LIVE_API_CONFIG.automaticVad,
    vadStartSensitivity: pickEnumValue(
      source.vadStartSensitivity,
      liveApiStartSensitivities,
      DEFAULT_LIVE_API_CONFIG.vadStartSensitivity,
    ),
    vadEndSensitivity: pickEnumValue(
      source.vadEndSensitivity,
      liveApiEndSensitivities,
      DEFAULT_LIVE_API_CONFIG.vadEndSensitivity,
    ),
    vadPrefixPaddingMs: clampInteger(
      source.vadPrefixPaddingMs,
      DEFAULT_LIVE_API_CONFIG.vadPrefixPaddingMs,
      0,
      3000,
    ),
    vadSilenceDurationMs: clampInteger(
      source.vadSilenceDurationMs,
      DEFAULT_LIVE_API_CONFIG.vadSilenceDurationMs,
      50,
      5000,
    ),
    turnCoverage: pickEnumValue(
      source.turnCoverage,
      liveApiTurnCoverages,
      DEFAULT_LIVE_API_CONFIG.turnCoverage,
    ),
    mediaResolution: pickEnumValue(
      source.mediaResolution,
      liveApiMediaResolutions,
      DEFAULT_LIVE_API_CONFIG.mediaResolution,
    ),
    initialHistoryInClientContent:
      typeof source.initialHistoryInClientContent === "boolean"
        ? source.initialHistoryInClientContent
        : DEFAULT_LIVE_API_CONFIG.initialHistoryInClientContent,
    proactiveAudio:
      typeof source.proactiveAudio === "boolean"
        ? source.proactiveAudio
        : DEFAULT_LIVE_API_CONFIG.proactiveAudio,
    enableAffectiveDialog:
      typeof source.enableAffectiveDialog === "boolean"
        ? source.enableAffectiveDialog
        : DEFAULT_LIVE_API_CONFIG.enableAffectiveDialog,
  };
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const body = (await request.json().catch(() => null)) as DeployAgentBody | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const channels = sanitizeArray(body.channels, ["web_chat"]);
    const tools = sanitizeArray(body.tools);
    const liveApi = normalizeLiveApiConfig(body.liveApi);
    const memory: MemoryConfig = { ...DEFAULT_MEMORY_CONFIG, ...(isRecord(body.memory) ? body.memory : {}) };
    const guardrails: GuardrailsConfig = { ...DEFAULT_GUARDRAILS_CONFIG, ...(isRecord(body.guardrails) ? body.guardrails : {}) };
    const escalation: EscalationConfig = { ...DEFAULT_ESCALATION_CONFIG, ...(isRecord(body.escalation) ? body.escalation : {}) };
    const insightExtraction: InsightExtractionConfig = { ...DEFAULT_INSIGHT_EXTRACTION_CONFIG, ...(isRecord(body.insightExtraction) ? body.insightExtraction : {}) };

    const payload = {
      name: body.name?.trim() || "Untitled Agent",
      system_prompt: body.systemPrompt?.trim() || null,
      voice: body.voice?.trim() || "Puck",
      tools,
      channels,
      greeting_message: body.greetingMessage?.trim() || "Hi! How can I help you today?",
      status: body.status ?? "active",
      widget_config: {
        color: "#6C5CE7",
        position: "bottom-right",
        auto_open: false,
      },
      settings: {
        deployed_at: new Date().toISOString(),
        live_api: liveApi,
        memory,
        guardrails,
        escalation,
        insightExtraction,
      },
    };

    let deployedAgent:
      | {
          id: string;
          name: string;
          channels: string[];
          voice: string;
          created_at: string;
        }
      | null = null;

    if (body.id?.trim()) {
      const { data, error } = await admin
        .from("agents")
        .update(payload)
        .eq("id", body.id)
        .eq("org_id", member.orgId)
        .select("id, name, channels, voice, created_at")
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!data) {
        // Agent not found — create a fresh one instead
        const { data: inserted, error: insertError } = await admin
          .from("agents")
          .insert({ ...payload, org_id: member.orgId })
          .select("id, name, channels, voice, created_at")
          .maybeSingle();

        if (insertError || !inserted) {
          return NextResponse.json({ error: insertError?.message ?? "Failed to deploy agent." }, { status: 500 });
        }

        deployedAgent = inserted;
      } else {
        deployedAgent = data;
      }
    } else {
      const { data, error } = await admin
        .from("agents")
        .insert({
          ...payload,
          org_id: member.orgId,
        })
        .select("id, name, channels, voice, created_at")
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "Failed to deploy agent." }, { status: 500 });
      }

      deployedAgent = data;
    }

    const requiresPhoneLine = channels.includes("phone") || channels.includes("web_voice");
    let voiceLine: { number: string | null; id: string | null } = { number: null, id: null };

    if (requiresPhoneLine && deployedAgent) {
      const provisioned = await provisionVoiceLine({
        admin,
        orgId: member.orgId,
        agentId: deployedAgent.id,
        countryCode: "US",
        displayLabel: `${deployedAgent.name} voice line`,
      });

      voiceLine = {
        number: provisioned.phoneNumber.telnyx_number,
        id: provisioned.phoneNumber.id,
      };
    }

    const origin = new URL(request.url).origin;
    const embedCode = deployedAgent
      ? buildWidgetEmbedCode(origin, deployedAgent.id)
      : buildWidgetEmbedCode(origin, "agent-id-missing");

    return NextResponse.json(
      {
        deployed: true,
        agent: deployedAgent,
        embedCode,
        voiceLine,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to deploy agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
