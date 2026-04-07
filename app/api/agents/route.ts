import { NextResponse } from "next/server";
import { ensureAgentCache } from "@/lib/vertex-cache";
import {
  DEFAULT_LIVE_API_CONFIG,
  DEFAULT_BEHAVIOR_CONFIG,
  DEFAULT_SPEECH_CONFIG,
  DEFAULT_TOOLS_CONFIG,
  DEFAULT_HOOKS_CONFIG,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_CUSTOM_INSIGHTS_CONFIG,
  DEFAULT_GUARDRAILS_CONFIG,
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_HOLD_MUSIC_CONFIG,
  OUTPUT_GUARDRAIL_TOPICS,
  INPUT_GUARDRAIL_TOPICS,
  type CustomFunction,
  type LiveApiConfig,
  type LiveApiEndSensitivity,
  type LiveApiMediaResolution,
  type LiveApiModel,
  type LiveApiStartSensitivity,
  type LiveApiThinkingLevel,
  type LiveApiTurnCoverage,
  type BehaviorConfig,
  type SpeechConfig,
  type ToolsConfig,
  type HooksConfig,
  type ProviderConfig,
  type ChatModel,
  type AgentVariable,
  type MultilingualConfig,
  type PersonalizationConfig,
  type VoiceFormattingConfig,
  type BackgroundMessage,
  type IdleMessage,
  type DenoisingConfig,
  type PronunciationEntry,
  type VoiceFallbackConfig,
  type TranscriberConfig,
  type VoicemailConfig,
  type EventHook,
  type CustomInsightsConfig,
  type GuardrailsConfig,
  type OutputGuardrailTopic,
  type InputGuardrailTopic,
  type EscalationConfig,
  type EscalationRule,
  type EscalationKeyword,
  type HoldMusicConfig,
  type AnalysisPlan,
  type BackgroundNoiseConfig,
  type AmbientPreset,
  DEFAULT_ANALYSIS_PLAN,
  DEFAULT_BACKGROUND_NOISE_CONFIG,
} from "@/lib/domain/agent-builder";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

interface AgentWriteBody {
  id?: string;
  name?: string;
  systemPrompt?: string;
  voice?: string;
  tools?: string[];
  channels?: string[];
  status?: "draft" | "active" | "paused";
  greetingMessage?: string;
  liveApi?: Partial<LiveApiConfig>;
  customFunctions?: CustomFunction[];
  behavior?: Partial<BehaviorConfig>;
  speech?: Partial<SpeechConfig>;
  toolsConfig?: Partial<ToolsConfig>;
  hooks?: Partial<HooksConfig>;
  provider?: Partial<ProviderConfig>;
  customInsights?: Partial<CustomInsightsConfig>;
  guardrails?: Partial<GuardrailsConfig>;
  analysisPlan?: Partial<AnalysisPlan>;
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

export async function DELETE(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
    }

    const { error } = await admin
      .from("agents")
      .delete()
      .eq("id", id)
      .eq("org_id", member.orgId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to delete agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

function extractLiveApiFromSettings(settings: unknown): LiveApiConfig {
  if (!isRecord(settings)) {
    return { ...DEFAULT_LIVE_API_CONFIG };
  }

  return normalizeLiveApiConfig(settings.live_api);
}

function extractCustomFunctions(settings: unknown): CustomFunction[] {
  if (!isRecord(settings)) return [];
  const fns = settings.custom_functions;
  if (!Array.isArray(fns)) return [];
  return fns.filter(
    (fn): fn is CustomFunction =>
      isRecord(fn) &&
      typeof fn.id === "string" &&
      typeof fn.name === "string" &&
      typeof fn.description === "string" &&
      Array.isArray(fn.parameters) &&
      isRecord(fn.endpoint) &&
      typeof fn.endpoint.url === "string",
  );
}

function normalizeCustomFunctions(input: unknown): CustomFunction[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (fn): fn is CustomFunction =>
        isRecord(fn) &&
        typeof fn.id === "string" &&
        typeof fn.name === "string" &&
        fn.name.trim().length > 0 &&
        typeof fn.description === "string" &&
        Array.isArray(fn.parameters) &&
        isRecord(fn.endpoint) &&
        typeof fn.endpoint.url === "string",
    )
    .map((fn) => ({
      id: fn.id,
      name: fn.name.trim().replace(/\s+/g, "_").toLowerCase(),
      description: fn.description.trim(),
      parameters: (fn.parameters ?? []).filter(
        (p) => isRecord(p) && typeof p.name === "string" && typeof p.type === "string",
      ),
      endpoint: {
        url: fn.endpoint.url.trim(),
        method: (["GET", "POST", "PUT", "PATCH", "DELETE"] as const).includes(
          fn.endpoint.method as "GET",
        )
          ? fn.endpoint.method
          : "POST",
        headers: isRecord(fn.endpoint.headers) ? (fn.endpoint.headers as Record<string, string>) : undefined,
      },
      enabled: typeof fn.enabled === "boolean" ? fn.enabled : true,
    }));
}

// ============================================================================
// BEHAVIOR CONFIG NORMALIZATION
// ============================================================================

function normalizeAgentVariables(input: unknown): AgentVariable[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((v): v is AgentVariable =>
      isRecord(v) &&
      typeof v.id === "string" &&
      typeof v.name === "string" &&
      v.name.trim().length > 0
    )
    .map((v) => ({
      id: v.id,
      name: v.name.trim().replace(/\s+/g, "_").toLowerCase(),
      type: (["static", "user", "system", "expression"] as const).includes(v.type as "static") ? v.type : "static",
      value: typeof v.value === "string" ? v.value : undefined,
      expression: typeof v.expression === "string" ? v.expression : undefined,
      description: typeof v.description === "string" ? v.description : undefined,
    }));
}

function normalizeMultilingualConfig(input: unknown): MultilingualConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_BEHAVIOR_CONFIG.multilingual.enabled,
    defaultLanguage: typeof source.defaultLanguage === "string" ? source.defaultLanguage : DEFAULT_BEHAVIOR_CONFIG.multilingual.defaultLanguage,
    supportedLanguages: Array.isArray(source.supportedLanguages)
      ? source.supportedLanguages.filter((l): l is string => typeof l === "string")
      : DEFAULT_BEHAVIOR_CONFIG.multilingual.supportedLanguages,
    autoDetect: typeof source.autoDetect === "boolean" ? source.autoDetect : DEFAULT_BEHAVIOR_CONFIG.multilingual.autoDetect,
  };
}

function normalizePersonalizationConfig(input: unknown): PersonalizationConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_BEHAVIOR_CONFIG.personalization.enabled,
    useConversationHistory: typeof source.useConversationHistory === "boolean" ? source.useConversationHistory : DEFAULT_BEHAVIOR_CONFIG.personalization.useConversationHistory,
    maxHistoryTurns: clampInteger(source.maxHistoryTurns, DEFAULT_BEHAVIOR_CONFIG.personalization.maxHistoryTurns, 1, 50),
    userFields: Array.isArray(source.userFields)
      ? source.userFields.filter((f): f is string => typeof f === "string")
      : DEFAULT_BEHAVIOR_CONFIG.personalization.userFields,
  };
}

function normalizeVoiceFormattingConfig(input: unknown): VoiceFormattingConfig {
  const source = isRecord(input) ? input : {};
  return {
    numbers: pickEnumValue(source.numbers, ["digits", "words", "mixed"], DEFAULT_BEHAVIOR_CONFIG.voiceFormatting.numbers),
    dates: pickEnumValue(source.dates, ["spoken", "formal"], DEFAULT_BEHAVIOR_CONFIG.voiceFormatting.dates),
    urls: pickEnumValue(source.urls, ["spell", "skip", "domain_only"], DEFAULT_BEHAVIOR_CONFIG.voiceFormatting.urls),
    currency: pickEnumValue(source.currency, ["full", "short"], DEFAULT_BEHAVIOR_CONFIG.voiceFormatting.currency),
    phoneNumbers: pickEnumValue(source.phoneNumbers, ["grouped", "individual"], DEFAULT_BEHAVIOR_CONFIG.voiceFormatting.phoneNumbers),
  };
}

function normalizeBackgroundMessages(input: unknown): BackgroundMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is BackgroundMessage =>
      isRecord(m) &&
      typeof m.id === "string" &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
    )
    .map((m) => ({
      id: m.id,
      trigger: (["session_start", "after_greeting", "before_handoff", "custom"] as const).includes(m.trigger as "session_start") ? m.trigger : "session_start",
      customEvent: typeof m.customEvent === "string" ? m.customEvent : undefined,
      content: m.content.trim(),
      enabled: typeof m.enabled === "boolean" ? m.enabled : true,
    }));
}

function normalizeIdleMessages(input: unknown): IdleMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is IdleMessage =>
      isRecord(m) &&
      typeof m.id === "string" &&
      typeof m.content === "string" &&
      m.content.trim().length > 0
    )
    .map((m) => ({
      id: m.id,
      delaySeconds: clampInteger(m.delaySeconds, 30, 5, 300),
      content: m.content.trim(),
      maxTimes: clampInteger(m.maxTimes, 3, 1, 10),
      enabled: typeof m.enabled === "boolean" ? m.enabled : true,
    }));
}

function normalizeBehaviorConfig(input: unknown): BehaviorConfig {
  const source = isRecord(input) ? input : {};
  return {
    variables: normalizeAgentVariables(source.variables),
    multilingual: normalizeMultilingualConfig(source.multilingual),
    personalization: normalizePersonalizationConfig(source.personalization),
    voiceFormatting: normalizeVoiceFormattingConfig(source.voiceFormatting),
    flushSyntax: typeof source.flushSyntax === "boolean" ? source.flushSyntax : DEFAULT_BEHAVIOR_CONFIG.flushSyntax,
    backgroundMessages: normalizeBackgroundMessages(source.backgroundMessages),
    idleMessages: normalizeIdleMessages(source.idleMessages),
  };
}

// ============================================================================
// SPEECH CONFIG NORMALIZATION
// ============================================================================

function normalizeDenoisingConfig(input: unknown): DenoisingConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SPEECH_CONFIG.denoising.enabled,
    level: pickEnumValue(source.level, ["low", "medium", "high"], DEFAULT_SPEECH_CONFIG.denoising.level),
  };
}

function normalizePronunciationEntries(input: unknown): PronunciationEntry[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is PronunciationEntry =>
      isRecord(p) &&
      typeof p.word === "string" &&
      p.word.trim().length > 0 &&
      typeof p.phonetic === "string"
    )
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : crypto.randomUUID(),
      word: p.word.trim(),
      phonetic: p.phonetic.trim(),
      caseSensitive: typeof p.caseSensitive === "boolean" ? p.caseSensitive : false,
    }));
}

function normalizeVoiceFallbackConfig(input: unknown): VoiceFallbackConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SPEECH_CONFIG.voiceFallback.enabled,
    fallbackVoices: Array.isArray(source.fallbackVoices)
      ? source.fallbackVoices.filter((v): v is string => typeof v === "string")
      : DEFAULT_SPEECH_CONFIG.voiceFallback.fallbackVoices,
  };
}

function normalizeTranscriberConfig(input: unknown): TranscriberConfig {
  const source = isRecord(input) ? input : {};
  return {
    model: pickEnumValue(source.model, ["gemini", "whisper"], DEFAULT_SPEECH_CONFIG.transcriber.model),
    language: typeof source.language === "string" ? source.language : undefined,
    fallbackEnabled: typeof source.fallbackEnabled === "boolean" ? source.fallbackEnabled : DEFAULT_SPEECH_CONFIG.transcriber.fallbackEnabled,
  };
}

function normalizeCallGreetings(input: unknown): { inbound: string; outbound: string } {
  const source = isRecord(input) ? input : {};
  return {
    inbound: typeof source.inbound === "string" ? source.inbound : "",
    outbound: typeof source.outbound === "string" ? source.outbound : "",
  };
}

function normalizeBackgroundNoiseConfig(input: unknown): BackgroundNoiseConfig {
  if (!isRecord(input)) return DEFAULT_BACKGROUND_NOISE_CONFIG;
  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : false,
    preset: pickEnumValue(input.preset, ["office_busy", "office_calm", "none"], "none") as AmbientPreset,
    volume: typeof input.volume === "number" ? Math.max(0, Math.min(1, input.volume)) : 0.08,
  };
}

function normalizeSpeechConfig(input: unknown): SpeechConfig {
  const source = isRecord(input) ? input : {};
  return {
    callMode: pickEnumValue(source.callMode, ["inbound", "outbound", "both"], "both") as SpeechConfig["callMode"],
    greetings: normalizeCallGreetings(source.greetings),
    denoising: normalizeDenoisingConfig(source.denoising),
    pronunciation: normalizePronunciationEntries(source.pronunciation),
    voiceFallback: normalizeVoiceFallbackConfig(source.voiceFallback),
    transcriber: normalizeTranscriberConfig(source.transcriber),
    backgroundNoise: normalizeBackgroundNoiseConfig(source.backgroundNoise),
  };
}

// ============================================================================
// TOOLS CONFIG NORMALIZATION
// ============================================================================

function normalizeVoicemailConfig(input: unknown): VoicemailConfig | undefined {
  if (!isRecord(input)) return undefined;
  return {
    greeting: typeof input.greeting === "string" ? input.greeting : "Please leave a message after the tone.",
    maxDurationSeconds: clampInteger(input.maxDurationSeconds, 120, 10, 300),
    transcribe: typeof input.transcribe === "boolean" ? input.transcribe : true,
  };
}

function normalizeEscalationKeywords(input: unknown): EscalationKeyword[] {
  if (!Array.isArray(input)) return DEFAULT_ESCALATION_CONFIG.rules.find(r => r.trigger === 'keyword')?.config.keywords || [];
  return input.filter((k): k is EscalationKeyword =>
    isRecord(k) &&
    typeof k.id === "string" &&
    typeof k.phrase === "string"
  );
}

function normalizeEscalationRules(input: unknown): EscalationRule[] {
  if (!Array.isArray(input)) return DEFAULT_ESCALATION_CONFIG.rules;
  return input.filter((r): r is EscalationRule =>
    isRecord(r) &&
    typeof r.id === "string" &&
    typeof r.trigger === "string"
  ).map(r => ({
    ...r,
    config: {
      ...r.config,
      keywords: r.config?.keywords ? normalizeEscalationKeywords(r.config.keywords) : undefined,
    },
  }));
}

function normalizeEscalationConfig(input: unknown): EscalationConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_ESCALATION_CONFIG.enabled,
    rules: normalizeEscalationRules(source.rules),
    defaultDepartment: pickEnumValue(
      source.defaultDepartment,
      ["sales", "support", "billing", "technical", "management"],
      DEFAULT_ESCALATION_CONFIG.defaultDepartment
    ),
    defaultPriority: pickEnumValue(
      source.defaultPriority,
      ["normal", "high", "urgent"],
      DEFAULT_ESCALATION_CONFIG.defaultPriority
    ),
    confirmBeforeTransfer: typeof source.confirmBeforeTransfer === "boolean"
      ? source.confirmBeforeTransfer
      : DEFAULT_ESCALATION_CONFIG.confirmBeforeTransfer,
    maxWaitTimeSeconds: typeof source.maxWaitTimeSeconds === "number"
      ? source.maxWaitTimeSeconds
      : DEFAULT_ESCALATION_CONFIG.maxWaitTimeSeconds,
  };
}

function normalizeHoldMusicConfig(input: unknown): HoldMusicConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_HOLD_MUSIC_CONFIG.enabled,
    type: pickEnumValue(source.type, ["preset", "custom", "none"], DEFAULT_HOLD_MUSIC_CONFIG.type),
    presetId: typeof source.presetId === "string" ? source.presetId : DEFAULT_HOLD_MUSIC_CONFIG.presetId,
    customUrl: typeof source.customUrl === "string" ? source.customUrl : undefined,
    volume: typeof source.volume === "number" ? Math.max(0, Math.min(100, source.volume)) : DEFAULT_HOLD_MUSIC_CONFIG.volume,
    loopAnnouncement: typeof source.loopAnnouncement === "boolean"
      ? source.loopAnnouncement
      : DEFAULT_HOLD_MUSIC_CONFIG.loopAnnouncement,
    announcementIntervalSeconds: typeof source.announcementIntervalSeconds === "number"
      ? source.announcementIntervalSeconds
      : DEFAULT_HOLD_MUSIC_CONFIG.announcementIntervalSeconds,
    estimatedWaitMessage: typeof source.estimatedWaitMessage === "boolean"
      ? source.estimatedWaitMessage
      : DEFAULT_HOLD_MUSIC_CONFIG.estimatedWaitMessage,
  };
}

function normalizeToolsConfig(input: unknown): ToolsConfig {
  const source = isRecord(input) ? input : {};
  return {
    rejectionPlan: pickEnumValue(source.rejectionPlan, ["retry", "fallback", "escalate", "ignore"], DEFAULT_TOOLS_CONFIG.rejectionPlan),
    maxRetries: clampInteger(source.maxRetries, DEFAULT_TOOLS_CONFIG.maxRetries, 0, 5),
    staticAliases: isRecord(source.staticAliases) ? (source.staticAliases as Record<string, string>) : DEFAULT_TOOLS_CONFIG.staticAliases,
    voicemailEnabled: typeof source.voicemailEnabled === "boolean" ? source.voicemailEnabled : DEFAULT_TOOLS_CONFIG.voicemailEnabled,
    voicemailConfig: normalizeVoicemailConfig(source.voicemailConfig),
    codeToolEnabled: typeof source.codeToolEnabled === "boolean" ? source.codeToolEnabled : DEFAULT_TOOLS_CONFIG.codeToolEnabled,
    escalation: normalizeEscalationConfig(source.escalation),
    holdMusic: normalizeHoldMusicConfig(source.holdMusic),
  };
}

// ============================================================================
// HOOKS CONFIG NORMALIZATION
// ============================================================================

function normalizeEventHooks(input: unknown): EventHook[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((h): h is EventHook =>
      isRecord(h) &&
      typeof h.id === "string" &&
      typeof h.event === "string" &&
      Array.isArray(h.actions)
    )
    .map((h) => ({
      id: h.id,
      event: (["session_start", "session_end", "tool_success", "tool_failure", "handoff", "error"] as const).includes(h.event as "session_start") ? h.event : "session_start",
      actions: Array.isArray(h.actions) ? h.actions.filter((a) => isRecord(a) && typeof a.type === "string") : [],
      enabled: typeof h.enabled === "boolean" ? h.enabled : true,
    }));
}

function normalizeHooksConfig(input: unknown): HooksConfig {
  const source = isRecord(input) ? input : {};
  return {
    hooks: normalizeEventHooks(source.hooks),
  };
}

// ============================================================================
// PROVIDER CONFIG NORMALIZATION
// ============================================================================

const CHAT_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-pro-preview",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "claude-3-5-sonnet-v2@20241022",
  "claude-3-5-haiku@20241022",
  "llama-3.3-70b-instruct-maas",
  "llama-3.1-405b-instruct-maas",
] as const;

function normalizeProviderConfig(input: unknown): ProviderConfig {
  const source = isRecord(input) ? input : {};
  const gemini = isRecord(source.gemini) ? source.gemini : {};
  
  const isChatModel = (v: unknown): v is ChatModel => 
    typeof v === "string" && CHAT_MODELS.includes(v as ChatModel);
  
  return {
    chatModel: isChatModel(source.chatModel) ? source.chatModel : DEFAULT_PROVIDER_CONFIG.chatModel,
    gemini: {
      apiKey: typeof gemini.apiKey === "string" && gemini.apiKey.trim() ? gemini.apiKey.trim() : undefined,
      useDefault: typeof gemini.useDefault === "boolean" ? gemini.useDefault : true,
    },
    enablePartnerModels: typeof source.enablePartnerModels === "boolean" 
      ? source.enablePartnerModels 
      : DEFAULT_PROVIDER_CONFIG.enablePartnerModels,
    fallbackEnabled: typeof source.fallbackEnabled === "boolean" 
      ? source.fallbackEnabled 
      : DEFAULT_PROVIDER_CONFIG.fallbackEnabled,
    fallbackModel: isChatModel(source.fallbackModel) ? source.fallbackModel : DEFAULT_PROVIDER_CONFIG.fallbackModel,
  };
}

// ============================================================================
// CUSTOM INSIGHTS CONFIG NORMALIZATION
// ============================================================================

function normalizeCustomInsightsConfig(input: unknown): CustomInsightsConfig {
  const source = isRecord(input) ? input : {};
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_CUSTOM_INSIGHTS_CONFIG.enabled,
    definitionIds: Array.isArray(source.definitionIds)
      ? source.definitionIds.filter((id): id is string => typeof id === "string")
      : DEFAULT_CUSTOM_INSIGHTS_CONFIG.definitionIds,
    groupIds: Array.isArray(source.groupIds)
      ? source.groupIds.filter((id): id is string => typeof id === "string")
      : DEFAULT_CUSTOM_INSIGHTS_CONFIG.groupIds,
    autoExtractOnEnd: typeof source.autoExtractOnEnd === "boolean"
      ? source.autoExtractOnEnd
      : DEFAULT_CUSTOM_INSIGHTS_CONFIG.autoExtractOnEnd,
  };
}

function normalizeGuardrailsConfig(input: unknown): GuardrailsConfig {
  const source = isRecord(input) ? input : {};
  
  // Validate output topics
  const outputTopics = Array.isArray(source.outputTopics)
    ? source.outputTopics.filter((t): t is OutputGuardrailTopic =>
        OUTPUT_GUARDRAIL_TOPICS.includes(t as OutputGuardrailTopic)
      )
    : DEFAULT_GUARDRAILS_CONFIG.outputTopics;
  
  // Validate input topics
  const inputTopics = Array.isArray(source.inputTopics)
    ? source.inputTopics.filter((t): t is InputGuardrailTopic =>
        INPUT_GUARDRAIL_TOPICS.includes(t as InputGuardrailTopic)
      )
    : DEFAULT_GUARDRAILS_CONFIG.inputTopics;
  
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_GUARDRAILS_CONFIG.enabled,
    outputTopics,
    inputTopics,
    outputPlaceholder: typeof source.outputPlaceholder === "string"
      ? source.outputPlaceholder
      : DEFAULT_GUARDRAILS_CONFIG.outputPlaceholder,
    inputPlaceholder: typeof source.inputPlaceholder === "string"
      ? source.inputPlaceholder
      : DEFAULT_GUARDRAILS_CONFIG.inputPlaceholder,
  };
}

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

function extractBehaviorFromSettings(settings: unknown): BehaviorConfig {
  if (!isRecord(settings)) return { ...DEFAULT_BEHAVIOR_CONFIG };
  return normalizeBehaviorConfig(settings.behavior);
}

function extractSpeechFromSettings(settings: unknown): SpeechConfig {
  if (!isRecord(settings)) return { ...DEFAULT_SPEECH_CONFIG };
  return normalizeSpeechConfig(settings.speech);
}

function extractToolsConfigFromSettings(settings: unknown): ToolsConfig {
  if (!isRecord(settings)) return { ...DEFAULT_TOOLS_CONFIG };
  return normalizeToolsConfig(settings.tools);
}

function extractHooksFromSettings(settings: unknown): HooksConfig {
  if (!isRecord(settings)) return { ...DEFAULT_HOOKS_CONFIG };
  return normalizeHooksConfig(settings.hooks);
}

function extractProviderFromSettings(settings: unknown): ProviderConfig {
  if (!isRecord(settings)) return { ...DEFAULT_PROVIDER_CONFIG };
  return normalizeProviderConfig(settings.provider);
}

function extractCustomInsightsFromSettings(settings: unknown): CustomInsightsConfig {
  if (!isRecord(settings)) return { ...DEFAULT_CUSTOM_INSIGHTS_CONFIG };
  return normalizeCustomInsightsConfig(settings.custom_insights);
}

function extractGuardrailsFromSettings(settings: unknown): GuardrailsConfig {
  if (!isRecord(settings)) return { ...DEFAULT_GUARDRAILS_CONFIG };
  return normalizeGuardrailsConfig(settings.guardrails);
}

function normalizeAnalysisPlan(raw: unknown): AnalysisPlan {
  if (!isRecord(raw)) return { ...DEFAULT_ANALYSIS_PLAN };
  return {
    ...DEFAULT_ANALYSIS_PLAN,
    ...(typeof raw.summaryPrompt === "string" ? { summaryPrompt: raw.summaryPrompt } : {}),
    ...(typeof raw.structuredDataPrompt === "string" ? { structuredDataPrompt: raw.structuredDataPrompt } : {}),
    ...(raw.structuredDataSchema && isRecord(raw.structuredDataSchema) ? { structuredDataSchema: raw.structuredDataSchema as Record<string, unknown> } : {}),
    ...(typeof raw.successEvaluationPrompt === "string" ? { successEvaluationPrompt: raw.successEvaluationPrompt } : {}),
    ...(typeof raw.successEvaluationRubric === "string" ? { successEvaluationRubric: raw.successEvaluationRubric as AnalysisPlan["successEvaluationRubric"] } : {}),
  };
}

function mapAgentResponse(agent: Record<string, unknown>) {
  return {
    ...agent,
    liveApi: extractLiveApiFromSettings(agent.settings),
    customFunctions: extractCustomFunctions(agent.settings),
    behavior: extractBehaviorFromSettings(agent.settings),
    speech: extractSpeechFromSettings(agent.settings),
    toolsConfig: extractToolsConfigFromSettings(agent.settings),
    hooks: extractHooksFromSettings(agent.settings),
    provider: extractProviderFromSettings(agent.settings),
    customInsights: extractCustomInsightsFromSettings(agent.settings),
    guardrails: extractGuardrailsFromSettings(agent.settings),
    analysisPlan: normalizeAnalysisPlan(agent.analysis_plan),
  };
}

function normalizeAgentBody(body: AgentWriteBody) {
  const liveApi = normalizeLiveApiConfig(body.liveApi);
  const behavior = normalizeBehaviorConfig(body.behavior);
  const speech = normalizeSpeechConfig(body.speech);
  const toolsConfig = normalizeToolsConfig(body.toolsConfig);
  const hooks = normalizeHooksConfig(body.hooks);
  const provider = normalizeProviderConfig(body.provider);
  const customInsights = normalizeCustomInsightsConfig(body.customInsights);
  const guardrails = normalizeGuardrailsConfig(body.guardrails);
  const analysisPlan = normalizeAnalysisPlan(body.analysisPlan);

  return {
    name: body.name?.trim() || "Untitled Agent",
    system_prompt: body.systemPrompt?.trim() || null,
    voice: body.voice?.trim() || "Puck",
    tools: sanitizeArray(body.tools),
    channels: sanitizeArray(body.channels, ["web_chat"]),
    status: body.status ?? "draft",
    greeting_message: body.greetingMessage?.trim() || "Hi! How can I help you today?",
    analysis_plan: analysisPlan,
    settings: {
      live_api: liveApi,
      custom_functions: normalizeCustomFunctions(body.customFunctions),
      behavior,
      speech,
      tools: toolsConfig,
      hooks,
      provider,
      custom_insights: customInsights,
      guardrails,
    },
  };
}

export async function GET(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext();
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();

    const selectColumns =
      "id, name, system_prompt, voice, channels, tools, status, greeting_message, settings, analysis_plan, created_at, updated_at";

    if (id) {
      const { data, error } = await admin
        .from("agents")
        .select(selectColumns)
        .eq("org_id", member.orgId)
        .eq("id", id)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: error?.message ?? "Agent not found." }, { status: 404 });
      }

      return NextResponse.json({ agent: mapAgentResponse(data as Record<string, unknown>) });
    }

    const { data, error } = await admin
      .from("agents")
      .select(selectColumns)
      .eq("org_id", member.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ agents: (data ?? []).map((item) => mapAgentResponse(item as Record<string, unknown>)) });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to load agents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { admin, member } = await getOrgMemberContext({
      allowedRoles: ["admin", "editor"],
    });

    const body = (await request.json().catch(() => null)) as AgentWriteBody | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    if (body.id?.trim()) {
      const { data: existing, error: existingError } = await admin
        .from("agents")
        .select("id, name, system_prompt, voice, channels, tools, status, greeting_message, settings, analysis_plan")
        .eq("id", body.id)
        .eq("org_id", member.orgId)
        .single();

      if (existingError || !existing) {
        return NextResponse.json(
          { error: existingError?.message ?? "Agent not found." },
          { status: 404 },
        );
      }

      const existingRecord = existing as Record<string, unknown>;
      const mergedBody: AgentWriteBody = {
        id: body.id,
        name: body.name ?? (typeof existingRecord.name === "string" ? existingRecord.name : undefined),
        systemPrompt:
          body.systemPrompt ??
          (typeof existingRecord.system_prompt === "string" ? existingRecord.system_prompt : undefined),
        voice: body.voice ?? (typeof existingRecord.voice === "string" ? existingRecord.voice : undefined),
        tools: body.tools ?? sanitizeArray(existingRecord.tools),
        channels: body.channels ?? sanitizeArray(existingRecord.channels, ["web_chat"]),
        status: body.status ?? pickEnumValue<"draft" | "active" | "paused">(existingRecord.status, ["draft", "active", "paused"], "draft"),
        greetingMessage:
          body.greetingMessage ??
          (typeof existingRecord.greeting_message === "string" ? existingRecord.greeting_message : undefined),
        liveApi: body.liveApi ?? extractLiveApiFromSettings(existingRecord.settings),
        customFunctions: body.customFunctions ?? extractCustomFunctions(existingRecord.settings),
        behavior: body.behavior ?? extractBehaviorFromSettings(existingRecord.settings),
        speech: body.speech ?? extractSpeechFromSettings(existingRecord.settings),
        toolsConfig: body.toolsConfig ?? extractToolsConfigFromSettings(existingRecord.settings),
        hooks: body.hooks ?? extractHooksFromSettings(existingRecord.settings),
        provider: body.provider ?? extractProviderFromSettings(existingRecord.settings),
        customInsights: body.customInsights ?? extractCustomInsightsFromSettings(existingRecord.settings),
        guardrails: body.guardrails ?? extractGuardrailsFromSettings(existingRecord.settings),
        analysisPlan: body.analysisPlan ?? normalizeAnalysisPlan(existingRecord.analysis_plan),
      };

      const payload = normalizeAgentBody(mergedBody);

      const { data: updated, error: updateError } = await admin
        .from("agents")
        .update(payload)
        .eq("id", body.id)
        .eq("org_id", member.orgId)
        .select(
          "id, name, system_prompt, voice, channels, tools, status, greeting_message, settings, analysis_plan, created_at, updated_at",
        )
        .single();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message ?? "Failed to update agent." },
          { status: 500 },
        );
      }

      // Fire-and-forget: refresh Vertex context cache for this agent
      const updatedRecord = updated as Record<string, unknown>;
      const newPrompt = typeof updatedRecord.system_prompt === "string" ? updatedRecord.system_prompt : "";
      const agentName  = typeof updatedRecord.name === "string" ? updatedRecord.name : "agent";
      const existingCacheId = typeof updatedRecord.vertex_cache_id === "string" ? updatedRecord.vertex_cache_id : null;
      const existingExpiry  = updatedRecord.vertex_cache_expires_at ? new Date(updatedRecord.vertex_cache_expires_at as string) : null;
      void ensureAgentCache(newPrompt, agentName, existingCacheId, existingExpiry).then(async (result) => {
        if (result) {
          await admin.from("agents").update({
            vertex_cache_id: result.cacheId,
            vertex_cache_expires_at: result.expiresAt.toISOString(),
          }).eq("id", body.id!).eq("org_id", member.orgId);
        }
      }).catch(() => { /* non-critical — caching failure never breaks save */ });

      return NextResponse.json({ agent: mapAgentResponse(updated as Record<string, unknown>) });
    }

    const payload = normalizeAgentBody(body);

    const { data: created, error: createError } = await admin
      .from("agents")
      .insert({
        ...payload,
        org_id: member.orgId,
      })
      .select(
        "id, name, system_prompt, voice, channels, tools, status, greeting_message, settings, analysis_plan, created_at, updated_at",
      )
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create agent." },
        { status: 500 },
      );
    }

    return NextResponse.json({ agent: mapAgentResponse(created as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Failed to save agent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
