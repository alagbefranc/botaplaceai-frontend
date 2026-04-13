export interface CustomFunctionParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
  enum?: string[];
}

export interface CustomFunction {
  id: string;
  name: string;
  description: string;
  parameters: CustomFunctionParameter[];
  endpoint: {
    url: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
  };
  enabled: boolean;
}

export interface VoiceOption {
  name: string;
  tone: string;
  description: string;
  samplePath: string;
  avatar: string;  // Avatar URL for voice persona
  gender: "male" | "female" | "neutral";
}

export interface ToolOption {
  key: string;
  label: string;
  icon: string;  // Brand logo URL
}

// Gemini Live API Models
// Current recommended: gemini-3.1-flash-live-preview
// Fallback for transition period: gemini-2.5-flash-native-audio-preview-12-2025 (deprecated, will be shut down)
export type LiveApiModel =
  | "gemini-3.1-flash-live-preview"  // Current - recommended for all Live API use cases
  | "gemini-2.5-flash-native-audio-preview-12-2025";  // Legacy - being deprecated

// Regular Chat/Non-Live Models (Vertex AI supports multiple providers)
export type ChatModel =
  | "gemini-3-flash-preview"          // Current fast model - Google
  | "gemini-3.1-pro-preview"          // Current pro model - Google
  | "gemini-2.5-flash"                // Legacy - still works
  | "gemini-2.5-pro"                  // Advanced reasoning
  | "claude-3-5-sonnet-v2@20241022"   // Anthropic Claude via Vertex AI
  | "claude-3-5-haiku@20241022"       // Anthropic Claude fast
  | "llama-3.3-70b-instruct-maas"     // Meta Llama via Vertex AI
  | "llama-3.1-405b-instruct-maas";   // Meta Llama large

export type LiveApiThinkingLevel = "minimal" | "low" | "medium" | "high";

export type LiveApiStartSensitivity = "START_SENSITIVITY_LOW" | "START_SENSITIVITY_HIGH";

export type LiveApiEndSensitivity = "END_SENSITIVITY_LOW" | "END_SENSITIVITY_HIGH";

export type LiveApiTurnCoverage =
  | "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"
  | "TURN_INCLUDES_ONLY_ACTIVITY";

export type LiveApiMediaResolution =
  | "MEDIA_RESOLUTION_LOW"
  | "MEDIA_RESOLUTION_MEDIUM"
  | "MEDIA_RESOLUTION_HIGH";

export interface LiveApiConfig {
  model: LiveApiModel;
  thinkingLevel: LiveApiThinkingLevel;
  thinkingBudget: number;
  includeThoughts: boolean;
  inputAudioTranscription: boolean;
  outputAudioTranscription: boolean;
  automaticVad: boolean;
  vadStartSensitivity: LiveApiStartSensitivity;
  vadEndSensitivity: LiveApiEndSensitivity;
  vadPrefixPaddingMs: number;
  vadSilenceDurationMs: number;
  turnCoverage: LiveApiTurnCoverage;
  mediaResolution: LiveApiMediaResolution;
  initialHistoryInClientContent: boolean;
  proactiveAudio: boolean;
  enableAffectiveDialog: boolean;
}

export const DEFAULT_LIVE_API_CONFIG: LiveApiConfig = {
  model: "gemini-3.1-flash-live-preview",
  thinkingLevel: "minimal",
  thinkingBudget: 1024,
  includeThoughts: false,
  inputAudioTranscription: true,
  outputAudioTranscription: true,
  automaticVad: true,
  vadStartSensitivity: "START_SENSITIVITY_LOW",
  vadEndSensitivity: "END_SENSITIVITY_LOW",
  vadPrefixPaddingMs: 20,
  vadSilenceDurationMs: 700,
  turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
  mediaResolution: "MEDIA_RESOLUTION_LOW",
  initialHistoryInClientContent: false,
  // Note: proactiveAudio and enableAffectiveDialog are NOT supported in gemini-3.1-flash-live-preview
  // These are kept for backward compatibility but have no effect with current model
  proactiveAudio: false,
  enableAffectiveDialog: false,
};

// Model fallback chain for resilience
export const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  // Live API fallbacks (Gemini only for voice)
  live: [
    "gemini-3.1-flash-live-preview",
    "gemini-2.5-flash-native-audio-preview-12-2025",
  ],
  // Google chat fallbacks
  google: [
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ],
  // Anthropic fallbacks
  anthropic: [
    "claude-3-5-sonnet-v2@20241022",
    "claude-3-5-haiku@20241022",
  ],
  // Meta fallbacks
  meta: [
    "llama-3.3-70b-instruct-maas",
    "llama-3.1-405b-instruct-maas",
  ],
  // Cross-provider fallback (if one provider fails)
  chat: [
    "gemini-3-flash-preview",
    "claude-3-5-sonnet-v2@20241022",
    "llama-3.3-70b-instruct-maas",
    "gemini-2.5-flash",
  ],
};

// Model metadata for UI display
export const MODEL_METADATA: Record<string, { label: string; description: string; status: "current" | "deprecated" | "preview" }> = {
  "gemini-3.1-flash-live-preview": {
    label: "Gemini 3.1 Flash Live",
    description: "Latest - Low latency, real-time voice (recommended)",
    status: "current",
  },
  "gemini-2.5-flash-native-audio-preview-12-2025": {
    label: "Gemini 2.5 Flash Live (Legacy)",
    description: "Legacy - Being deprecated, migrate to 3.1",
    status: "deprecated",
  },
  "gemini-3-flash-preview": {
    label: "Gemini 3 Flash",
    description: "Fast, cost-effective for chat",
    status: "current",
  },
  "gemini-3.1-pro-preview": {
    label: "Gemini 3.1 Pro",
    description: "Advanced reasoning and complex tasks",
    status: "preview",
  },
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    description: "Legacy model - still functional",
    status: "deprecated",
  },
};

// Background noise options for voice ambiance (legacy types kept for reference)
export type BackgroundNoiseType = "none" | "office" | "cafe" | "typing" | "call_center" | "nature";

// Voice emotion/personality settings
export type VoiceEmotion = "neutral" | "friendly" | "professional" | "empathetic" | "enthusiastic" | "calm" | "authoritative";

export interface VoicePersonalityConfig {
  emotion: VoiceEmotion;
  speakingRate: "slow" | "normal" | "fast";
  pitchVariation: "flat" | "moderate" | "expressive";
  pauseStyle: "minimal" | "natural" | "dramatic";
}

export const VOICE_EMOTION_OPTIONS: Array<{ key: VoiceEmotion; label: string; description: string }> = [
  { key: "neutral", label: "Neutral", description: "Balanced, matter-of-fact tone" },
  { key: "friendly", label: "Friendly", description: "Warm and approachable" },
  { key: "professional", label: "Professional", description: "Business-appropriate and polished" },
  { key: "empathetic", label: "Empathetic", description: "Understanding and caring" },
  { key: "enthusiastic", label: "Enthusiastic", description: "Energetic and positive" },
  { key: "calm", label: "Calm", description: "Relaxed and soothing" },
  { key: "authoritative", label: "Authoritative", description: "Confident and commanding" },
];

export type ChannelKey = "web_chat" | "web_voice" | "phone" | "whatsapp" | "sms";

export interface ChannelOption {
  key: ChannelKey;
  label: string;
  description: string;
  comingSoon?: boolean;
  icon: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  // Premium Chirp HD voices with avatars
  { name: "Puck", tone: "Friendly", description: "Conversational, friendly", samplePath: "/assets/audio/voices/puck.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Puck&backgroundColor=b6e3f4", gender: "male" },
  { name: "Charon", tone: "Deep", description: "Deep, authoritative", samplePath: "/assets/audio/voices/charon.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Charon&backgroundColor=c0aede", gender: "male" },
  { name: "Kore", tone: "Neutral", description: "Neutral, professional", samplePath: "/assets/audio/voices/kore.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Kore&backgroundColor=ffd5dc", gender: "female" },
  { name: "Fenrir", tone: "Excitable", description: "Excitable, high-energy", samplePath: "/assets/audio/voices/fenrir.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Fenrir&backgroundColor=d1f4d1", gender: "male" },
  { name: "Aoede", tone: "Melodic", description: "Melodic, expressive", samplePath: "/assets/audio/voices/aoede.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Aoede&backgroundColor=ffdfbf", gender: "female" },
  { name: "Leda", tone: "Gentle", description: "Gentle, calm", samplePath: "/assets/audio/voices/leda.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Leda&backgroundColor=ffd5dc", gender: "female" },
  { name: "Orus", tone: "Rich", description: "Rich, resonant", samplePath: "/assets/audio/voices/orus.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Orus&backgroundColor=c0aede", gender: "male" },
  { name: "Zephyr", tone: "Light", description: "Light, breezy", samplePath: "/assets/audio/voices/zephyr.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Zephyr&backgroundColor=b6e3f4", gender: "neutral" },
  { name: "Achernar", tone: "Clear", description: "Clear, composed", samplePath: "/assets/audio/voices/achernar.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Achernar&backgroundColor=d1f4d1", gender: "male" },
  { name: "Achird", tone: "Measured", description: "Warm, measured", samplePath: "/assets/audio/voices/achird.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Achird&backgroundColor=ffdfbf", gender: "male" },
  { name: "Algenib", tone: "Gravelly", description: "Gravelly, distinctive", samplePath: "/assets/audio/voices/algenib.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Algenib&backgroundColor=ffd5dc", gender: "female" },
  { name: "Algieba", tone: "Smooth", description: "Smooth, confident", samplePath: "/assets/audio/voices/algieba.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Algieba&backgroundColor=c0aede", gender: "female" },
  { name: "Alnilam", tone: "Steady", description: "Steady, trustworthy", samplePath: "/assets/audio/voices/alnilam.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Alnilam&backgroundColor=b6e3f4", gender: "male" },
  { name: "Autonoe", tone: "Lively", description: "Lively, energetic", samplePath: "/assets/audio/voices/autonoe.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Autonoe&backgroundColor=ffd5dc", gender: "female" },
  { name: "Callirrhoe", tone: "Soft", description: "Soft, soothing", samplePath: "/assets/audio/voices/callirrhoe.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Callirrhoe&backgroundColor=ffdfbf", gender: "female" },
  { name: "Despina", tone: "Cheerful", description: "Cheerful, upbeat", samplePath: "/assets/audio/voices/despina.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Despina&backgroundColor=d1f4d1", gender: "female" },
  { name: "Enceladus", tone: "Breathy", description: "Breathy, intimate", samplePath: "/assets/audio/voices/enceladus.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Enceladus&backgroundColor=c0aede", gender: "male" },
  { name: "Erinome", tone: "Elegant", description: "Elegant, refined", samplePath: "/assets/audio/voices/erinome.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Erinome&backgroundColor=ffd5dc", gender: "female" },
  { name: "Gacrux", tone: "Mature", description: "Mature, experienced", samplePath: "/assets/audio/voices/gacrux.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Gacrux&backgroundColor=b6e3f4", gender: "male" },
  { name: "Iapetus", tone: "Thoughtful", description: "Deep, thoughtful", samplePath: "/assets/audio/voices/iapetus.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Iapetus&backgroundColor=c0aede", gender: "male" },
  { name: "Laomedeia", tone: "Poised", description: "Poised, graceful", samplePath: "/assets/audio/voices/laomedeia.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Laomedeia&backgroundColor=ffd5dc", gender: "female" },
  { name: "Pulcherrima", tone: "Forward", description: "Forward, assertive", samplePath: "/assets/audio/voices/pulcherrima.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Pulcherrima&backgroundColor=ffdfbf", gender: "female" },
  { name: "Rasalgethi", tone: "Strong", description: "Strong, commanding", samplePath: "/assets/audio/voices/rasalgethi.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Rasalgethi&backgroundColor=d1f4d1", gender: "male" },
  { name: "Sadachbia", tone: "Open", description: "Friendly, open", samplePath: "/assets/audio/voices/sadachbia.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Sadachbia&backgroundColor=b6e3f4", gender: "male" },
  { name: "Sadaltager", tone: "Knowledgeable", description: "Knowledgeable, authoritative", samplePath: "/assets/audio/voices/sadaltager.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Sadaltager&backgroundColor=c0aede", gender: "male" },
  { name: "Schedar", tone: "Even", description: "Even, steady", samplePath: "/assets/audio/voices/schedar.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Schedar&backgroundColor=ffd5dc", gender: "female" },
  { name: "Sulafat", tone: "Mellow", description: "Mellow, relaxed", samplePath: "/assets/audio/voices/sulafat.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Sulafat&backgroundColor=ffdfbf", gender: "male" },
  { name: "Umbriel", tone: "Mysterious", description: "Mysterious, engaging", samplePath: "/assets/audio/voices/umbriel.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Umbriel&backgroundColor=d1f4d1", gender: "neutral" },
  { name: "Vindemiatrix", tone: "Gentle", description: "Gentle, soft-spoken", samplePath: "/assets/audio/voices/vindemiatrix.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Vindemiatrix&backgroundColor=c0aede", gender: "female" },
  { name: "Zubenelgenubi", tone: "Casual", description: "Casual, laid-back", samplePath: "/assets/audio/voices/zubenelgenubi.mp3", avatar: "https://api.dicebear.com/9.x/personas/svg?seed=Zubenelgenubi&backgroundColor=b6e3f4", gender: "male" },
];

export const TOOL_OPTIONS: ToolOption[] = [
  { key: "gmail", label: "Send emails (Gmail)", icon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico" },
  { key: "google_calendar", label: "Book appointments (Google Calendar)", icon: "https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png" },
  { key: "cal", label: "Book meetings (Cal.com)", icon: "https://cal.com/favicon.ico" },
  { key: "slack", label: "Send Slack messages", icon: "https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png" },
  { key: "stripe", label: "Process payments (Stripe)", icon: "https://stripe.com/favicon.ico" },
  { key: "hubspot", label: "Update CRM (HubSpot)", icon: "https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png" },
  { key: "jira", label: "Create tickets (Jira)", icon: "https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png" },
  { key: "notion", label: "Log to Notion", icon: "https://www.notion.so/images/favicon.ico" },
  { key: "calendly", label: "Schedule via Calendly", icon: "https://assets.calendly.com/assets/favicon-32x32.png" },
  { key: "google_sheets", label: "Look up data (Google Sheets)", icon: "https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico" },
];

export const CHANNEL_OPTIONS: ChannelOption[] = [
  { key: "web_chat", label: "Web Chat", description: "Text chat widget", icon: "https://api.iconify.design/mdi:chat.svg?color=%234096ff" },
  { key: "web_voice", label: "Voice", description: "Mic in web widget", icon: "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a" },
  { key: "phone", label: "Phone", description: "Voice line support", icon: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1" },
  { key: "whatsapp", label: "WhatsApp", description: "Messaging channel", comingSoon: true, icon: "https://api.iconify.design/logos:whatsapp-icon.svg" },
  { key: "sms", label: "SMS", description: "Text messaging", comingSoon: true, icon: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14" },
];

// ============================================================================
// AGENT CONFIGURATION - BEHAVIOR, SPEECH, TOOLS, HOOKS
// ============================================================================

// Variables System
export type AgentVariableType = "static" | "user" | "system" | "expression";

export interface AgentVariable {
  id: string;
  name: string;           // e.g., "customer_name"
  type: AgentVariableType;
  value?: string;         // For static values
  expression?: string;    // For dynamic expressions: "{{user.name || 'Guest'}}"
  description?: string;
}

// Built-in user variables available in expressions
export const BUILTIN_USER_VARIABLES = [
  { key: "user.name", label: "User Name", description: "User's full name if collected" },
  { key: "user.email", label: "User Email", description: "User's email address" },
  { key: "user.phone", label: "User Phone", description: "User's phone number" },
  { key: "user.id", label: "User ID", description: "Unique user identifier" },
  { key: "user.language", label: "User Language", description: "Detected or set language" },
];

// Built-in system variables
export const BUILTIN_SYSTEM_VARIABLES = [
  { key: "system.date", label: "Current Date", description: "Today's date" },
  { key: "system.time", label: "Current Time", description: "Current time" },
  { key: "system.agent_name", label: "Agent Name", description: "Name of this agent" },
  { key: "system.conversation_id", label: "Conversation ID", description: "Current conversation ID" },
  { key: "system.channel", label: "Channel", description: "Current channel (web_chat, voice, phone)" },
];

// Multilingual Configuration
export interface MultilingualConfig {
  enabled: boolean;
  defaultLanguage: string;
  supportedLanguages: string[];
  autoDetect: boolean;
}

// 70+ Languages supported by Gemini Live API (auto-detect and switch)
export const SUPPORTED_LANGUAGES = [
  // Tier 1 - Most Common
  { code: "en", label: "English", tier: 1 },
  { code: "es", label: "Spanish", tier: 1 },
  { code: "fr", label: "French", tier: 1 },
  { code: "de", label: "German", tier: 1 },
  { code: "it", label: "Italian", tier: 1 },
  { code: "pt", label: "Portuguese", tier: 1 },
  { code: "pt-BR", label: "Portuguese (Brazil)", tier: 1 },
  { code: "zh", label: "Chinese (Simplified)", tier: 1 },
  { code: "zh-TW", label: "Chinese (Traditional)", tier: 1 },
  { code: "ja", label: "Japanese", tier: 1 },
  { code: "ko", label: "Korean", tier: 1 },
  { code: "ar", label: "Arabic", tier: 1 },
  { code: "hi", label: "Hindi", tier: 1 },
  { code: "ru", label: "Russian", tier: 1 },
  // Tier 2 - European
  { code: "nl", label: "Dutch", tier: 2 },
  { code: "pl", label: "Polish", tier: 2 },
  { code: "tr", label: "Turkish", tier: 2 },
  { code: "sv", label: "Swedish", tier: 2 },
  { code: "da", label: "Danish", tier: 2 },
  { code: "no", label: "Norwegian", tier: 2 },
  { code: "fi", label: "Finnish", tier: 2 },
  { code: "el", label: "Greek", tier: 2 },
  { code: "cs", label: "Czech", tier: 2 },
  { code: "ro", label: "Romanian", tier: 2 },
  { code: "hu", label: "Hungarian", tier: 2 },
  { code: "uk", label: "Ukrainian", tier: 2 },
  { code: "sk", label: "Slovak", tier: 2 },
  { code: "bg", label: "Bulgarian", tier: 2 },
  { code: "hr", label: "Croatian", tier: 2 },
  { code: "sr", label: "Serbian", tier: 2 },
  { code: "sl", label: "Slovenian", tier: 2 },
  { code: "lt", label: "Lithuanian", tier: 2 },
  { code: "lv", label: "Latvian", tier: 2 },
  { code: "et", label: "Estonian", tier: 2 },
  { code: "ca", label: "Catalan", tier: 2 },
  { code: "eu", label: "Basque", tier: 2 },
  { code: "gl", label: "Galician", tier: 2 },
  // Tier 3 - Asian
  { code: "vi", label: "Vietnamese", tier: 3 },
  { code: "th", label: "Thai", tier: 3 },
  { code: "id", label: "Indonesian", tier: 3 },
  { code: "ms", label: "Malay", tier: 3 },
  { code: "fil", label: "Filipino", tier: 3 },
  { code: "bn", label: "Bengali", tier: 3 },
  { code: "ta", label: "Tamil", tier: 3 },
  { code: "te", label: "Telugu", tier: 3 },
  { code: "mr", label: "Marathi", tier: 3 },
  { code: "gu", label: "Gujarati", tier: 3 },
  { code: "kn", label: "Kannada", tier: 3 },
  { code: "ml", label: "Malayalam", tier: 3 },
  { code: "pa", label: "Punjabi", tier: 3 },
  { code: "ur", label: "Urdu", tier: 3 },
  { code: "ne", label: "Nepali", tier: 3 },
  { code: "si", label: "Sinhala", tier: 3 },
  { code: "my", label: "Burmese", tier: 3 },
  { code: "km", label: "Khmer", tier: 3 },
  { code: "lo", label: "Lao", tier: 3 },
  // Tier 4 - Middle East & Africa
  { code: "he", label: "Hebrew", tier: 4 },
  { code: "fa", label: "Persian", tier: 4 },
  { code: "sw", label: "Swahili", tier: 4 },
  { code: "af", label: "Afrikaans", tier: 4 },
  { code: "zu", label: "Zulu", tier: 4 },
  { code: "am", label: "Amharic", tier: 4 },
  { code: "yo", label: "Yoruba", tier: 4 },
  { code: "ig", label: "Igbo", tier: 4 },
  { code: "ha", label: "Hausa", tier: 4 },
  // Tier 5 - Other
  { code: "is", label: "Icelandic", tier: 5 },
  { code: "ga", label: "Irish", tier: 5 },
  { code: "cy", label: "Welsh", tier: 5 },
  { code: "mt", label: "Maltese", tier: 5 },
  { code: "sq", label: "Albanian", tier: 5 },
  { code: "mk", label: "Macedonian", tier: 5 },
  { code: "bs", label: "Bosnian", tier: 5 },
  { code: "az", label: "Azerbaijani", tier: 5 },
  { code: "ka", label: "Georgian", tier: 5 },
  { code: "hy", label: "Armenian", tier: 5 },
  { code: "kk", label: "Kazakh", tier: 5 },
  { code: "uz", label: "Uzbek", tier: 5 },
  { code: "mn", label: "Mongolian", tier: 5 },
];

// Personalization Configuration
export interface PersonalizationConfig {
  enabled: boolean;
  useConversationHistory: boolean;
  maxHistoryTurns: number;
  userFields: string[];  // Fields to extract: name, email, phone, etc.
}

export const PERSONALIZATION_FIELDS = [
  { key: "name", label: "Name", description: "User's full name" },
  { key: "email", label: "Email", description: "Email address" },
  { key: "phone", label: "Phone", description: "Phone number" },
  { key: "company", label: "Company", description: "Company/organization" },
  { key: "location", label: "Location", description: "City or region" },
  { key: "timezone", label: "Timezone", description: "User's timezone" },
];

// Voice Formatting Configuration
export type VoiceNumberFormat = "digits" | "words" | "mixed";
export type VoiceDateFormat = "spoken" | "formal";
export type VoiceUrlFormat = "spell" | "skip" | "domain_only";
export type VoiceCurrencyFormat = "full" | "short";
export type VoicePhoneFormat = "grouped" | "individual";

export interface VoiceFormattingConfig {
  numbers: VoiceNumberFormat;
  dates: VoiceDateFormat;
  urls: VoiceUrlFormat;
  currency: VoiceCurrencyFormat;
  phoneNumbers: VoicePhoneFormat;
}

// Background Messages (hidden system context)
export type BackgroundMessageTrigger = "session_start" | "after_greeting" | "before_handoff" | "custom";

export interface BackgroundMessage {
  id: string;
  trigger: BackgroundMessageTrigger;
  customEvent?: string;
  content: string;
  enabled: boolean;
}

// Idle Messages (user inactivity)
export interface IdleMessage {
  id: string;
  delaySeconds: number;
  content: string;
  maxTimes: number;
  enabled: boolean;
}

// Event Hooks
export type HookEventType = "session_start" | "session_end" | "tool_success" | "tool_failure" | "handoff" | "error";
export type HookActionType = "message" | "api_call" | "set_variable" | "log";

export interface HookAction {
  id: string;
  type: HookActionType;
  config: Record<string, unknown>;
}

export interface EventHook {
  id: string;
  event: HookEventType;
  actions: HookAction[];
  enabled: boolean;
}

export interface HooksConfig {
  hooks: EventHook[];
}

// Behavior Configuration (combines all behavior settings)
export interface BehaviorConfig {
  variables: AgentVariable[];
  multilingual: MultilingualConfig;
  personalization: PersonalizationConfig;
  voiceFormatting: VoiceFormattingConfig;
  flushSyntax: boolean;
  backgroundMessages: BackgroundMessage[];
  idleMessages: IdleMessage[];
}

// Speech Configuration
export type DenoisingLevel = "low" | "medium" | "high";
export type TranscriberModel = "gemini" | "whisper" | "deepgram";

export interface DenoisingConfig {
  enabled: boolean;
  level: DenoisingLevel;
}

export interface PronunciationEntry {
  id: string;
  word: string;
  phonetic: string;       // IPA or phonetic spelling
  caseSensitive: boolean;
}

export interface VoiceFallbackConfig {
  enabled: boolean;
  fallbackVoices: string[];
}

export interface TranscriberConfig {
  model: TranscriberModel;
  language?: string;
  fallbackEnabled: boolean;
  // Deepgram-specific
  deepgramModel?: string;          // e.g. 'nova-3', 'nova-2'
  keywords?: string[];             // single-word boosting with optional intensifier e.g. 'snuffleupagus:5'
  keyterms?: string[];             // multi-word phrase boosting e.g. 'order number'
  smartFormat?: boolean;           // Deepgram smart formatting
}

export type CallMode = 'inbound' | 'outbound' | 'both';

export interface CallGreetings {
  inbound: string;
  outbound: string;
}

export type AmbientPreset = 'office_busy' | 'office_calm' | 'none';

export interface BackgroundNoiseConfig {
  enabled: boolean;
  preset: AmbientPreset;
  volume: number; // 0.0 – 1.0 (default 0.08 = subtle)
}

export interface SpeechConfig {
  callMode: CallMode;
  greetings: CallGreetings;
  denoising: DenoisingConfig;
  pronunciation: PronunciationEntry[];
  voiceFallback: VoiceFallbackConfig;
  transcriber: TranscriberConfig;
  backgroundNoise: BackgroundNoiseConfig;
}

// Tools Configuration
export type ToolRejectionPlan = "retry" | "fallback" | "escalate" | "ignore";

export interface VoicemailConfig {
  greeting: string;
  maxDurationSeconds: number;
  transcribe: boolean;
}

// ============================================================================
// ESCALATION & HOLD MUSIC CONFIGURATION
// ============================================================================

export type EscalationTrigger = "sentiment" | "keyword" | "retry_limit" | "explicit_request";
export type EscalationPriority = "normal" | "high" | "urgent";
export type EscalationDepartment = "sales" | "support" | "billing" | "technical" | "management";

export interface EscalationKeyword {
  id: string;
  phrase: string;        // e.g., "speak to manager", "this is unacceptable"
  priority: EscalationPriority;
  department?: EscalationDepartment;
}

export interface EscalationRule {
  id: string;
  trigger: EscalationTrigger;
  enabled: boolean;
  config: {
    // For sentiment trigger
    sentimentThreshold?: number;  // -1 to 1, e.g., -0.5 = negative
    // For retry_limit trigger
    maxRetries?: number;
    // For keyword trigger
    keywords?: EscalationKeyword[];
  };
  action: {
    priority: EscalationPriority;
    department: EscalationDepartment;
    message?: string;  // Custom message before transfer
  };
}

export interface EscalationConfig {
  enabled: boolean;
  rules: EscalationRule[];
  defaultDepartment: EscalationDepartment;
  defaultPriority: EscalationPriority;
  confirmBeforeTransfer: boolean;  // Ask user before transferring
  maxWaitTimeSeconds: number;      // Max time to wait for human agent
}

export const DEFAULT_ESCALATION_KEYWORDS: EscalationKeyword[] = [
  { id: "kw1", phrase: "speak to a human", priority: "normal", department: "support" },
  { id: "kw2", phrase: "talk to a manager", priority: "high", department: "management" },
  { id: "kw3", phrase: "this is unacceptable", priority: "high", department: "management" },
  { id: "kw4", phrase: "cancel my account", priority: "urgent", department: "billing" },
  { id: "kw5", phrase: "legal action", priority: "urgent", department: "management" },
  { id: "kw6", phrase: "speak to someone real", priority: "normal", department: "support" },
  { id: "kw7", phrase: "this is ridiculous", priority: "high", department: "support" },
  { id: "kw8", phrase: "file a complaint", priority: "high", department: "support" },
];

export const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
  enabled: true,
  rules: [
    {
      id: "rule_sentiment",
      trigger: "sentiment",
      enabled: true,
      config: { sentimentThreshold: -0.6 },
      action: { priority: "high", department: "support", message: "I sense you're frustrated. Let me connect you with a specialist who can help." },
    },
    {
      id: "rule_keywords",
      trigger: "keyword",
      enabled: true,
      config: { keywords: DEFAULT_ESCALATION_KEYWORDS },
      action: { priority: "normal", department: "support" },
    },
    {
      id: "rule_retries",
      trigger: "retry_limit",
      enabled: true,
      config: { maxRetries: 3 },
      action: { priority: "normal", department: "support", message: "I apologize, I'm having trouble helping with this. Let me transfer you to someone who can assist." },
    },
    {
      id: "rule_explicit",
      trigger: "explicit_request",
      enabled: true,
      config: {},
      action: { priority: "normal", department: "support" },
    },
  ],
  defaultDepartment: "support",
  defaultPriority: "normal",
  confirmBeforeTransfer: true,
  maxWaitTimeSeconds: 120,
};

// Hold Music Configuration
export type HoldMusicType = "preset" | "custom" | "none";

export interface HoldMusicConfig {
  enabled: boolean;
  type: HoldMusicType;
  presetId?: string;              // ID of preset hold music
  customUrl?: string;             // URL to custom hold music file
  volume: number;                 // 0-100
  loopAnnouncement: boolean;      // Play position announcements
  announcementIntervalSeconds: number;
  estimatedWaitMessage: boolean;  // "Your estimated wait time is..."
}

export interface HoldMusicPreset {
  id: string;
  name: string;
  description: string;
  duration: string;
  audioUrl: string;
  category: "classical" | "jazz" | "ambient" | "corporate" | "upbeat";
}

export const HOLD_MUSIC_PRESETS: HoldMusicPreset[] = [
  {
    id: "classical_1",
    name: "Elegant Strings",
    description: "Soothing classical strings",
    duration: "3:24",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3",
    category: "classical",
  },
  {
    id: "jazz_1",
    name: "Smooth Jazz",
    description: "Relaxing jazz saxophone",
    duration: "2:45",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    category: "jazz",
  },
  {
    id: "ambient_1",
    name: "Calm Ambient",
    description: "Peaceful ambient tones",
    duration: "4:12",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8a73467.mp3",
    category: "ambient",
  },
  {
    id: "corporate_1",
    name: "Corporate Professional",
    description: "Modern corporate hold music",
    duration: "2:30",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bcd.mp3",
    category: "corporate",
  },
  {
    id: "upbeat_1",
    name: "Upbeat Positive",
    description: "Energetic, positive vibes",
    duration: "2:15",
    audioUrl: "https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c6.mp3",
    category: "upbeat",
  },
];

export const DEFAULT_HOLD_MUSIC_CONFIG: HoldMusicConfig = {
  enabled: true,
  type: "preset",
  presetId: "corporate_1",
  volume: 60,
  loopAnnouncement: true,
  announcementIntervalSeconds: 30,
  estimatedWaitMessage: true,
};

export interface ToolsConfig {
  rejectionPlan: ToolRejectionPlan;
  maxRetries: number;
  staticAliases: Record<string, string>;
  voicemailEnabled: boolean;
  voicemailConfig?: VoicemailConfig;
  codeToolEnabled: boolean;
  // Escalation to live agents
  escalation: EscalationConfig;
  // Hold music for transfers
  holdMusic: HoldMusicConfig;
}

// Provider Configuration - Multi-model support via Vertex AI
export interface ProviderConfig {
  // Primary chat model for text conversations
  chatModel: ChatModel;
  // Gemini API key (optional, uses Vertex AI ADC by default)
  gemini: { apiKey?: string; useDefault: boolean };
  // Partner models via Vertex AI Model Garden (no separate API keys needed)
  enablePartnerModels: boolean;  // Claude, Llama, etc.
  // Fallback configuration
  fallbackEnabled: boolean;
  fallbackModel?: ChatModel;
}

// Provider logos (real CDN URLs)
export const PROVIDER_LOGOS: Record<string, string> = {
  google: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  anthropic: "https://cdn.worldvectorlogo.com/logos/anthropic-1.svg",
  meta: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Meta-Logo.png",
};

// Chat Model metadata for UI display
export const CHAT_MODEL_METADATA: Record<ChatModel, { 
  label: string; 
  description: string; 
  provider: "google" | "anthropic" | "meta"; 
  status: "current" | "deprecated" | "preview";
  contextWindow: string;
  logo: string;
}> = {
  "gemini-3-flash-preview": {
    label: "Gemini 3 Flash",
    description: "Fast, cost-effective (recommended)",
    provider: "google",
    status: "current",
    contextWindow: "1M tokens",
    logo: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  "gemini-3.1-pro-preview": {
    label: "Gemini 3.1 Pro",
    description: "Advanced reasoning, complex tasks",
    provider: "google",
    status: "preview",
    contextWindow: "1M tokens",
    logo: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  "gemini-2.5-flash": {
    label: "Gemini 2.5 Flash",
    description: "Legacy model",
    provider: "google",
    status: "deprecated",
    contextWindow: "1M tokens",
    logo: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  "gemini-2.5-pro": {
    label: "Gemini 2.5 Pro",
    description: "High quality outputs",
    provider: "google",
    status: "current",
    contextWindow: "1M tokens",
    logo: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg",
  },
  "claude-3-5-sonnet-v2@20241022": {
    label: "Claude 3.5 Sonnet",
    description: "Anthropic's best model via Vertex AI",
    provider: "anthropic",
    status: "current",
    contextWindow: "200K tokens",
    logo: "https://www.anthropic.com/images/icons/apple-touch-icon.png",
  },
  "claude-3-5-haiku@20241022": {
    label: "Claude 3.5 Haiku",
    description: "Fast, affordable Claude",
    provider: "anthropic",
    status: "current",
    contextWindow: "200K tokens",
    logo: "https://www.anthropic.com/images/icons/apple-touch-icon.png",
  },
  "llama-3.3-70b-instruct-maas": {
    label: "Llama 3.3 70B",
    description: "Meta's open model via Vertex AI",
    provider: "meta",
    status: "current",
    contextWindow: "128K tokens",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Meta-Logo.png/240px-Meta-Logo.png",
  },
  "llama-3.1-405b-instruct-maas": {
    label: "Llama 3.1 405B",
    description: "Meta's largest model",
    provider: "meta",
    status: "current",
    contextWindow: "128K tokens",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Meta-Logo.png/240px-Meta-Logo.png",
  },
};

// ============================================================================
// GUARDRAILS CONFIGURATION
// ============================================================================

// Output guardrail topics - what the agent should NOT say
export type OutputGuardrailTopic =
  | "harassment"
  | "self_harm"
  | "sexual_exploitation"
  | "violence"
  | "defense_and_national_security"
  | "illicit_and_harmful_activity"
  | "gambling"
  | "regulated_professional_advice"
  | "child_safety_and_exploitation";

// Input guardrail topics - what users should NOT say
export type InputGuardrailTopic = "platform_integrity_jailbreaking";

// Arrays of valid topics for validation
export const OUTPUT_GUARDRAIL_TOPICS: OutputGuardrailTopic[] = [
  "harassment",
  "self_harm",
  "sexual_exploitation",
  "violence",
  "defense_and_national_security",
  "illicit_and_harmful_activity",
  "gambling",
  "regulated_professional_advice",
  "child_safety_and_exploitation",
];

export const INPUT_GUARDRAIL_TOPICS: InputGuardrailTopic[] = ["platform_integrity_jailbreaking"];

export interface GuardrailTopic {
  id: OutputGuardrailTopic | InputGuardrailTopic;
  label: string;
  description: string;
  type: "input" | "output";
}

export const GUARDRAIL_TOPICS: GuardrailTopic[] = [
  // Output topics
  { id: "harassment", label: "Harassment", description: "Harassing or abusive language", type: "output" },
  { id: "self_harm", label: "Self Harm", description: "Content related to self-harm", type: "output" },
  { id: "sexual_exploitation", label: "Sexual Exploitation", description: "Sexually exploitative content", type: "output" },
  { id: "violence", label: "Violence", description: "Violent content", type: "output" },
  { id: "defense_and_national_security", label: "Defense & Security", description: "Defense and national security topics", type: "output" },
  { id: "illicit_and_harmful_activity", label: "Illicit Activity", description: "Illicit or harmful activities", type: "output" },
  { id: "gambling", label: "Gambling", description: "Gambling-related content", type: "output" },
  { id: "regulated_professional_advice", label: "Professional Advice", description: "Regulated professional advice (legal, medical, financial)", type: "output" },
  { id: "child_safety_and_exploitation", label: "Child Safety", description: "Child safety and exploitation content", type: "output" },
  // Input topics
  { id: "platform_integrity_jailbreaking", label: "Jailbreaking", description: "Attempts to jailbreak or manipulate the agent", type: "input" },
];

export interface GuardrailsConfig {
  enabled: boolean;
  outputTopics: OutputGuardrailTopic[];
  inputTopics: InputGuardrailTopic[];
  outputPlaceholder: string;  // Message when output is blocked
  inputPlaceholder: string;   // Message when input is blocked
}

export const DEFAULT_GUARDRAILS_CONFIG: GuardrailsConfig = {
  enabled: true,
  outputTopics: [
    "harassment",
    "self_harm",
    "sexual_exploitation",
    "violence",
    "child_safety_and_exploitation",
  ],
  inputTopics: ["platform_integrity_jailbreaking"],
  outputPlaceholder: "I'm not able to discuss that topic. Is there something else I can help you with?",
  inputPlaceholder: "I notice you might be trying to test my boundaries. Let's keep our conversation focused on how I can help you.",
};

// ============================================================================
// MEMORY AND INSIGHT CONFIGURATION
// ============================================================================

export type MemoryScope = "all" | "per_user" | "per_group";
export type MemoryIdentifier = "phone" | "email" | "session_id" | "custom";

export interface MemoryConfig {
  enabled: boolean;
  scope: MemoryScope;
  identifierField: MemoryIdentifier;
  customIdentifierPath?: string;
  maxConversations: number;           // e.g., 5
  timeWindowDays: number;             // e.g., 30
  includeInsightTypes: string[];      // ['user_profile', 'intent', 'action_items']
  webhookEnabled: boolean;
  webhookUrl?: string;
  webhookTimeoutMs: number;           // default 1000
}

export interface InsightExtractionConfig {
  enabled: boolean;
  extractUserProfile: boolean;
  extractIntent: boolean;
  extractSentiment: boolean;
  extractActionItems: boolean;
  autoExtractOnEnd: boolean;
}

// ============================================================================
// CALL ANALYSIS PLAN
// ============================================================================

export type SuccessEvaluationRubric =
  | "NumericScale"      // 1-10
  | "DescriptiveScale"  // Excellent / Good / Fair / Poor
  | "PassFail"          // true / false
  | "PercentageScale"   // 0-100%
  | "LikertScale"       // Strongly Agree → Strongly Disagree
  | "AutomaticRubric";  // Auto breakdown by criteria

export const RUBRIC_OPTIONS: { value: SuccessEvaluationRubric; label: string; description: string }[] = [
  { value: "PassFail",         label: "Pass / Fail",         description: "Simple true/false result" },
  { value: "NumericScale",     label: "Numeric Scale (1-10)", description: "Score from 1 to 10" },
  { value: "DescriptiveScale", label: "Descriptive Scale",    description: "Excellent / Good / Fair / Poor" },
  { value: "PercentageScale",  label: "Percentage (0-100%)",  description: "Score as a percentage" },
  { value: "LikertScale",      label: "Likert Scale",         description: "Strongly Agree → Strongly Disagree" },
  { value: "AutomaticRubric",  label: "Automatic Rubric",     description: "Auto-detected criteria breakdown" },
];

export interface AnalysisPlan {
  summaryPrompt?: string;
  structuredDataPrompt?: string;
  structuredDataSchema?: Record<string, unknown>; // JSON Schema object
  successEvaluationPrompt?: string;
  successEvaluationRubric?: SuccessEvaluationRubric;
}

export interface CallAnalysisResult {
  summary?: string;
  structuredData?: Record<string, unknown>;
  successEvaluation?: string | number | boolean | Record<string, unknown>;
  rubric?: SuccessEvaluationRubric;
  analyzedAt?: string;
  model?: string;
}

export const DEFAULT_ANALYSIS_PLAN: AnalysisPlan = {
  summaryPrompt: "",
  structuredDataPrompt: "",
  structuredDataSchema: undefined,
  successEvaluationPrompt: "",
  successEvaluationRubric: "PassFail",
};

// Insight data structure (matches database schema)
export interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  location?: string;
  language?: string;
}

export interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  completed?: boolean;
}

export type SentimentType = "positive" | "neutral" | "negative" | "mixed";

export interface ConversationInsight {
  id?: string;
  conversationId: string;
  userProfile: UserProfile;
  primaryIntent?: string;
  topics: string[];
  sentiment?: SentimentType;
  satisfactionScore?: number;  // 1-5
  issueResolved?: boolean;
  actionItems: ActionItem[];
  summary?: string;
  keyPoints: string[];
  extractedAt?: string;
  extractionModel?: string;
}

// ============================================================================
// CUSTOM INSIGHTS SYSTEM
// ============================================================================

// Parameter types for structured insights
export type InsightParamType = "boolean" | "number" | "string" | "array";

// Individual parameter in an insight schema
export interface InsightParameter {
  name: string;
  type: InsightParamType;
  description: string;
  required?: boolean;
  enumValues?: string[];  // For string type with fixed options
  min?: number;           // For number type
  max?: number;           // For number type
  itemType?: InsightParamType;  // For array type - type of items
}

// Insight definition schema
export interface InsightSchema {
  parameters: InsightParameter[];
}

// Custom insight definition
export interface InsightDefinition {
  id?: string;
  orgId: string;
  name: string;
  description?: string;
  insightType: "structured" | "unstructured";
  schema?: InsightSchema;  // For structured insights
  prompt?: string;         // For unstructured insights
  isTemplate?: boolean;
  templateCategory?: string;  // healthcare, sales, support, ecommerce, hr
  createdAt?: string;
  updatedAt?: string;
}

// Insight group for bundling insights with webhooks
export interface InsightGroup {
  id?: string;
  orgId: string;
  name: string;
  description?: string;
  webhookUrl?: string;
  webhookEnabled: boolean;
  insightIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

// Result of a custom insight extraction
export interface CustomInsightResult {
  id?: string;
  conversationId: string;
  definitionId: string;
  orgId: string;
  result: Record<string, unknown>;
  extractedAt?: string;
}

// Webhook delivery log
export interface InsightWebhookLog {
  id?: string;
  groupId: string;
  conversationId: string;
  orgId: string;
  payload: Record<string, unknown>;
  responseStatus?: number;
  responseBody?: string;
  success: boolean;
  errorMessage?: string;
  deliveredAt?: string;
}

// Template categories
export const INSIGHT_TEMPLATE_CATEGORIES = [
  { key: "healthcare", label: "Healthcare", icon: "MedicineBoxOutlined" },
  { key: "sales", label: "Sales", icon: "RiseOutlined" },
  { key: "support", label: "Support", icon: "CustomerServiceOutlined" },
  { key: "ecommerce", label: "E-commerce", icon: "ShoppingOutlined" },
  { key: "hr", label: "HR & Recruiting", icon: "TeamOutlined" },
] as const;

export type InsightTemplateCategory = typeof INSIGHT_TEMPLATE_CATEGORIES[number]["key"];

// Agent settings extension for custom insights
export interface CustomInsightsConfig {
  enabled: boolean;
  definitionIds: string[];      // Which custom insights to extract
  groupIds: string[];           // Which insight groups to use
  autoExtractOnEnd: boolean;    // Auto-extract when conversation ends
}

export const DEFAULT_CUSTOM_INSIGHTS_CONFIG: CustomInsightsConfig = {
  enabled: false,
  definitionIds: [],
  groupIds: [],
  autoExtractOnEnd: true,
};

// Complete Agent Settings Structure
export interface AgentSettings {
  live_api: LiveApiConfig;
  custom_functions: CustomFunction[];
  behavior: BehaviorConfig;
  speech: SpeechConfig;
  tools: ToolsConfig;
  hooks: HooksConfig;
  provider: ProviderConfig;
  memory: MemoryConfig;
  insightExtraction: InsightExtractionConfig;
  customInsights?: CustomInsightsConfig;
  guardrails: GuardrailsConfig;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_MULTILINGUAL_CONFIG: MultilingualConfig = {
  enabled: false,
  defaultLanguage: "en",
  supportedLanguages: ["en"],
  autoDetect: false,
};

export const DEFAULT_PERSONALIZATION_CONFIG: PersonalizationConfig = {
  enabled: true,
  useConversationHistory: true,
  maxHistoryTurns: 10,
  userFields: [],
};

export const DEFAULT_VOICE_FORMATTING_CONFIG: VoiceFormattingConfig = {
  numbers: "mixed",
  dates: "spoken",
  urls: "domain_only",
  currency: "full",
  phoneNumbers: "grouped",
};

export const DEFAULT_BEHAVIOR_CONFIG: BehaviorConfig = {
  variables: [],
  multilingual: DEFAULT_MULTILINGUAL_CONFIG,
  personalization: DEFAULT_PERSONALIZATION_CONFIG,
  voiceFormatting: DEFAULT_VOICE_FORMATTING_CONFIG,
  flushSyntax: false,
  backgroundMessages: [],
  idleMessages: [],
};

export const DEFAULT_DENOISING_CONFIG: DenoisingConfig = {
  enabled: true,
  level: "medium",
};

export const DEFAULT_VOICE_FALLBACK_CONFIG: VoiceFallbackConfig = {
  enabled: true,
  fallbackVoices: [],
};

export const DEFAULT_TRANSCRIBER_CONFIG: TranscriberConfig = {
  model: "gemini",
  fallbackEnabled: true,
};

export const DEFAULT_BACKGROUND_NOISE_CONFIG: BackgroundNoiseConfig = {
  enabled: false,
  preset: 'none',
  volume: 0.08,
};

export const DEFAULT_SPEECH_CONFIG: SpeechConfig = {
  callMode: 'both',
  greetings: {
    inbound: '',
    outbound: '',
  },
  denoising: DEFAULT_DENOISING_CONFIG,
  pronunciation: [],
  voiceFallback: DEFAULT_VOICE_FALLBACK_CONFIG,
  transcriber: DEFAULT_TRANSCRIBER_CONFIG,
  backgroundNoise: DEFAULT_BACKGROUND_NOISE_CONFIG,
};

export const DEFAULT_VOICEMAIL_CONFIG: VoicemailConfig = {
  greeting: "Please leave a message after the tone.",
  maxDurationSeconds: 120,
  transcribe: true,
};

export const DEFAULT_TOOLS_CONFIG: ToolsConfig = {
  rejectionPlan: "retry",
  maxRetries: 2,
  staticAliases: {},
  voicemailEnabled: false,
  codeToolEnabled: false,
  escalation: DEFAULT_ESCALATION_CONFIG,
  holdMusic: DEFAULT_HOLD_MUSIC_CONFIG,
};

export const DEFAULT_HOOKS_CONFIG: HooksConfig = {
  hooks: [],
};

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  chatModel: "gemini-3-flash-preview",
  gemini: { useDefault: true },
  enablePartnerModels: false,
  fallbackEnabled: true,
  fallbackModel: "gemini-2.5-flash",
};

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: false,
  scope: "per_user",
  identifierField: "session_id",
  maxConversations: 5,
  timeWindowDays: 30,
  includeInsightTypes: ["user_profile", "intent", "action_items"],
  webhookEnabled: false,
  webhookTimeoutMs: 1000,
};

export const DEFAULT_INSIGHT_EXTRACTION_CONFIG: InsightExtractionConfig = {
  enabled: true,
  extractUserProfile: true,
  extractIntent: true,
  extractSentiment: true,
  extractActionItems: true,
  autoExtractOnEnd: true,
};

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  live_api: DEFAULT_LIVE_API_CONFIG,
  custom_functions: [],
  behavior: DEFAULT_BEHAVIOR_CONFIG,
  speech: DEFAULT_SPEECH_CONFIG,
  tools: DEFAULT_TOOLS_CONFIG,
  hooks: DEFAULT_HOOKS_CONFIG,
  provider: DEFAULT_PROVIDER_CONFIG,
  memory: DEFAULT_MEMORY_CONFIG,
  insightExtraction: DEFAULT_INSIGHT_EXTRACTION_CONFIG,
  guardrails: DEFAULT_GUARDRAILS_CONFIG,
};

export function buildWidgetEmbedCode(origin: string, agentId: string) {
  return `<script src="${origin}/widget.js" data-agent-id="${agentId}"></script>`;
}

// ============================================================================
// EVALS - AGENT TESTING FRAMEWORK
// ============================================================================

export type EvalJudgeType = "exact" | "regex" | "ai";

export interface EvalToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface EvalJudgePlan {
  type: EvalJudgeType;
  content?: string; // For exact/regex matching
  toolCalls?: EvalToolCall[]; // For tool call validation
  model?: {
    provider: "openai" | "google" | "anthropic";
    model: string;
    messages: Array<{ role: string; content: string }>;
  }; // For AI judge
}

export interface EvalContinuePlan {
  exitOnFailureEnabled?: boolean;
  contentOverride?: string;
  toolCallsOverride?: EvalToolCall[];
}

export interface EvalMessage {
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  judgePlan?: EvalJudgePlan;
  continuePlan?: EvalContinuePlan;
}

export interface Eval {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  type: "chat.mockConversation";
  messages: EvalMessage[];
  createdAt: string;
  updatedAt: string;
}

export type EvalRunStatus = "queued" | "running" | "ended";

export type EvalRunEndedReason =
  | "mockConversation.done"
  | "assistant-error"
  | "pipeline-error"
  | "timeout"
  | "cancelled";

export interface EvalJudgeResult {
  status: "pass" | "fail";
  failureReason?: string;
}

export interface EvalRunResultMessage {
  role: string;
  content?: string;
  toolCalls?: EvalToolCall[];
  judge?: EvalJudgeResult;
}

export interface EvalRunResult {
  status: "pass" | "fail";
  messages: EvalRunResultMessage[];
}

export interface EvalRun {
  id: string;
  evalId: string;
  agentId?: string;
  status: EvalRunStatus;
  endedReason?: EvalRunEndedReason;
  results?: EvalRunResult[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// VOICE ENGINE CONFIGURATION - MULTI-PROVIDER SUPPORT
// ============================================================================

export type VoiceEngineType = "gemini-live" | "openai-realtime" | "mix";
export type MixSttProvider = "deepgram" | "cartesia" | "whisper";
export type MixLlmProvider = "openai" | "anthropic" | "gemini";
export type MixTtsProvider = "cartesia" | "elevenlabs" | "openai" | "playht";

export interface VoiceEngineConfig {
  engine: VoiceEngineType;
  // OpenAI Realtime specific
  openaiModel?: string;
  openaiVoice?: string;
  openaiInputAudioFormat?: "pcm16" | "g711_ulaw" | "g711_alaw";
  openaiOutputAudioFormat?: "pcm16" | "g711_ulaw" | "g711_alaw";
  openaiVadEnabled?: boolean;
  openaiVadThreshold?: number;
  openaiVadSilenceDurationMs?: number;
  openaiTemperature?: number;
  openaiTurnDetection?: "server_vad" | "semantic_vad";
  // Mix mode specific
  sttProvider?: MixSttProvider;
  llmProvider?: MixLlmProvider;
  llmModel?: string;
  ttsProvider?: MixTtsProvider;
  ttsVoiceId?: string;
  ttsModel?: string;
  ttsSampleRate?: number;
}

export const DEFAULT_VOICE_ENGINE_CONFIG: VoiceEngineConfig = {
  engine: "gemini-live",
};

export const VOICE_ENGINE_OPTIONS: Array<{
  key: VoiceEngineType;
  label: string;
  description: string;
  icon: string;
  providers: string[];
}> = [
  {
    key: "gemini-live",
    label: "Gemini Live",
    description: "Google's native speech-to-speech — lowest latency, built-in VAD, tool calling",
    icon: "https://api.iconify.design/logos:google-gemini.svg",
    providers: ["Google"],
  },
  {
    key: "openai-realtime",
    label: "OpenAI Realtime",
    description: "GPT-4o native voice — speech-to-speech, function calling, server VAD",
    icon: "https://api.iconify.design/simple-icons:openai.svg",
    providers: ["OpenAI"],
  },
  {
    key: "mix",
    label: "Mix Mode",
    description: "Compose STT + LLM + TTS from different providers for maximum flexibility",
    icon: "https://api.iconify.design/mdi:puzzle.svg",
    providers: ["Deepgram", "OpenAI", "Anthropic", "Cartesia", "ElevenLabs"],
  },
];

export const OPENAI_REALTIME_VOICE_OPTIONS = [
  { key: "alloy", label: "Alloy", description: "Balanced, versatile" },
  { key: "ash", label: "Ash", description: "Warm, engaging" },
  { key: "ballad", label: "Ballad", description: "Melodic, expressive" },
  { key: "coral", label: "Coral", description: "Clear, professional" },
  { key: "echo", label: "Echo", description: "Deep, resonant" },
  { key: "fable", label: "Fable", description: "Storytelling, warm" },
  { key: "onyx", label: "Onyx", description: "Strong, authoritative" },
  { key: "nova", label: "Nova", description: "Bright, friendly" },
  { key: "sage", label: "Sage", description: "Wise, calm" },
  { key: "shimmer", label: "Shimmer", description: "Light, airy" },
  { key: "verse", label: "Verse", description: "Poetic, articulate" },
];

export const MIX_STT_OPTIONS: Array<{ key: MixSttProvider; label: string; description: string }> = [
  { key: "deepgram", label: "Deepgram Nova-3", description: "Fast, accurate streaming STT" },
  { key: "whisper", label: "OpenAI Whisper", description: "Multilingual, batch-based" },
  { key: "cartesia", label: "Cartesia Ink", description: "Low-latency STT (batch)" },
];

export const MIX_LLM_OPTIONS: Array<{ key: MixLlmProvider; label: string; description: string }> = [
  { key: "openai", label: "OpenAI GPT-4o", description: "Fast, capable reasoning" },
  { key: "anthropic", label: "Anthropic Claude", description: "Nuanced, careful responses" },
  { key: "gemini", label: "Google Gemini", description: "Multimodal, long context" },
];

export const MIX_TTS_OPTIONS: Array<{ key: MixTtsProvider; label: string; description: string }> = [
  { key: "cartesia", label: "Cartesia Sonic", description: "Ultra-low latency streaming TTS" },
  { key: "elevenlabs", label: "ElevenLabs", description: "Natural, expressive voices" },
  { key: "openai", label: "OpenAI TTS", description: "Simple, reliable" },
  { key: "playht", label: "PlayHT", description: "High-quality voice cloning" },
];

// ============================================================================
// CONVERSATION EVENTS - DETAILED LOGGING
// ============================================================================

export type ConversationEventType =
  | "message"
  | "tool_call"
  | "tool_response"
  | "error"
  | "latency"
  | "connection"
  | "handoff";

export interface ConversationEvent {
  id: string;
  conversationId: string;
  eventType: ConversationEventType;
  timestamp: string;
  data: Record<string, unknown>;
  latencyMs?: number;
}

// ============================================================================
// MONITORING - SYSTEM HEALTH
// ============================================================================

export interface SystemHealthStatus {
  backend: "healthy" | "degraded" | "down";
  websocket: "healthy" | "degraded" | "down";
  telnyx: "healthy" | "degraded" | "down";
  gemini: "healthy" | "degraded" | "down";
  supabase: "healthy" | "degraded" | "down";
}

export interface ActiveSession {
  id: string;
  agentId: string;
  agentName: string;
  channel: ChannelKey;
  startedAt: string;
  durationSeconds: number;
  messageCount: number;
  status: "active" | "idle";
}
