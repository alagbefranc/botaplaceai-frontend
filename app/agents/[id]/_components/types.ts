import type {
  CustomFunction,
  LiveApiConfig,
  BehaviorConfig,
  SpeechConfig,
  ToolsConfig,
  HooksConfig,
  ProviderConfig,
  MemoryConfig,
  InsightExtractionConfig,
  CustomInsightsConfig,
  GuardrailsConfig,
  ChannelKey,
  AnalysisPlan,
} from "@/lib/domain/agent-builder";

export interface EditableAgent {
  id: string;
  name: string;
  systemPrompt: string;
  voice: string;
  tools: string[];
  channels: ChannelKey[];
  status: "draft" | "active" | "paused";
  greetingMessage: string;
  avatarUrl?: string | null;
  liveApi: LiveApiConfig;
  customFunctions: CustomFunction[];
  behavior: BehaviorConfig;
  speech: SpeechConfig;
  toolsConfig: ToolsConfig;
  hooks: HooksConfig;
  provider: ProviderConfig;
  memory: MemoryConfig;
  insightExtraction: InsightExtractionConfig;
  customInsights?: CustomInsightsConfig;
  guardrails: GuardrailsConfig;
  analysisPlan?: AnalysisPlan;
}

export interface TabProps {
  agent: EditableAgent;
  updateAgentField: <K extends keyof EditableAgent>(key: K, value: EditableAgent[K]) => void;
  updateLiveApi: (patch: Partial<LiveApiConfig>) => void;
  updateBehavior: (patch: Partial<BehaviorConfig>) => void;
  updateSpeech: (patch: Partial<SpeechConfig>) => void;
  updateToolsConfig: (patch: Partial<ToolsConfig>) => void;
  updateHooks: (patch: Partial<HooksConfig>) => void;
  updateProvider: (patch: Partial<ProviderConfig>) => void;
  updateMemory: (patch: Partial<MemoryConfig>) => void;
  updateInsightExtraction: (patch: Partial<InsightExtractionConfig>) => void;
  updateCustomInsights?: (patch: Partial<CustomInsightsConfig>) => void;
  updateGuardrails: (patch: Partial<GuardrailsConfig>) => void;
  updateAnalysisPlan?: (patch: Partial<AnalysisPlan>) => void;
}
