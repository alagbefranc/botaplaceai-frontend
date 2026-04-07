"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_LIVE_API_CONFIG,
  type ChannelKey,
  type LiveApiConfig,
  type BackgroundNoiseConfig,
  type VoicePersonalityConfig,
  type CustomFunction,
  type VoiceEmotion,
  type BackgroundNoiseType,
} from "@/lib/domain/agent-builder";

export interface KnowledgeFileDraft {
  id: string;
  name: string;
  filePath?: string;
  sizeBytes?: number;
}

export interface AgentBuilderDraft {
  id?: string;
  name: string;
  systemPrompt: string;
  voice: string;
  tools: string[];
  channels: ChannelKey[];
  greetingMessage: string;
  liveApi: LiveApiConfig;
  knowledgeFiles: KnowledgeFileDraft[];
  status: "draft" | "active" | "paused";
  // Voice personality & emotion settings
  voiceEmotion: VoiceEmotion;
  voicePersonality: VoicePersonalityConfig;
  backgroundNoise: BackgroundNoiseConfig;
  // Advanced settings
  maxTokens: number;
  temperature: number;
  responseTimeout: number;
  // Skills configuration
  enabledSkills: string[];
  // Custom functions
  customFunctions: CustomFunction[];
}

interface AgentBuilderState {
  draft: AgentBuilderDraft;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  setName: (name: string) => void;
  setSystemPrompt: (prompt: string) => void;
  setVoice: (voice: string) => void;
  setTools: (tools: string[]) => void;
  toggleTool: (tool: string) => void;
  setChannels: (channels: ChannelKey[]) => void;
  toggleChannel: (channel: ChannelKey) => void;
  setGreetingMessage: (message: string) => void;
  setLiveApiConfig: (config: Partial<LiveApiConfig>) => void;
  // Voice emotion & personality
  setVoiceEmotion: (emotion: VoiceEmotion) => void;
  setVoicePersonality: (config: Partial<VoicePersonalityConfig>) => void;
  setBackgroundNoise: (config: Partial<BackgroundNoiseConfig>) => void;
  // Advanced settings
  setMaxTokens: (tokens: number) => void;
  setTemperature: (temp: number) => void;
  setResponseTimeout: (timeout: number) => void;
  // Skills
  setEnabledSkills: (skills: string[]) => void;
  toggleSkill: (skill: string) => void;
  // Custom functions
  addCustomFunction: (func: CustomFunction) => void;
  updateCustomFunction: (id: string, func: Partial<CustomFunction>) => void;
  removeCustomFunction: (id: string) => void;
  addKnowledgeFile: (file: KnowledgeFileDraft) => void;
  removeKnowledgeFile: (id: string) => void;
  setDraftFromServer: (draft: Partial<AgentBuilderDraft>) => void;
  resetDraft: () => void;
}

export const defaultAgentBuilderDraft: AgentBuilderDraft = {
  name: "",
  systemPrompt: "",
  voice: "Puck",
  tools: ["gmail", "calendar"],
  channels: ["web_chat", "web_voice"],
  greetingMessage: "Hi! I can help you with your order and account questions.",
  liveApi: { ...DEFAULT_LIVE_API_CONFIG },
  knowledgeFiles: [],
  status: "draft",
  // Voice personality defaults
  voiceEmotion: "friendly",
  voicePersonality: {
    emotion: "friendly",
    speakingRate: "normal",
    pitchVariation: "moderate",
    pauseStyle: "natural",
  },
  backgroundNoise: {
    type: "none",
    volume: 20,
  },
  // Advanced settings defaults
  maxTokens: 1024,
  temperature: 0.7,
  responseTimeout: 30000,
  // Skills (all enabled by default)
  enabledSkills: [
    "search_knowledge_base",
    "transfer_to_human",
    "escalate_to_manager",
    "create_ticket",
    "schedule_callback",
    "process_payment",
  ],
  // Custom functions
  customFunctions: [],
};

export const useAgentBuilderStore = create<AgentBuilderState>()(
  persist(
    (set, get) => ({
      draft: defaultAgentBuilderDraft,
      currentStep: 0,
      setCurrentStep: (step) => set({ currentStep: Math.max(0, step) }),
      setName: (name) =>
        set((state) => ({
          draft: {
            ...state.draft,
            name,
          },
        })),
      setSystemPrompt: (systemPrompt) =>
        set((state) => ({
          draft: {
            ...state.draft,
            systemPrompt,
          },
        })),
      setVoice: (voice) =>
        set((state) => ({
          draft: {
            ...state.draft,
            voice,
          },
        })),
      setTools: (tools) =>
        set((state) => ({
          draft: {
            ...state.draft,
            tools,
          },
        })),
      toggleTool: (tool) =>
        set((state) => {
          const exists = state.draft.tools.includes(tool);
          return {
            draft: {
              ...state.draft,
              tools: exists
                ? state.draft.tools.filter((item) => item !== tool)
                : [...state.draft.tools, tool],
            },
          };
        }),
      setChannels: (channels) =>
        set((state) => ({
          draft: {
            ...state.draft,
            channels,
          },
        })),
      toggleChannel: (channel) =>
        set((state) => {
          const exists = state.draft.channels.includes(channel);
          return {
            draft: {
              ...state.draft,
              channels: exists
                ? state.draft.channels.filter((item) => item !== channel)
                : [...state.draft.channels, channel],
            },
          };
        }),
      setGreetingMessage: (greetingMessage) =>
        set((state) => ({
          draft: {
            ...state.draft,
            greetingMessage,
          },
        })),
      setLiveApiConfig: (liveApiConfig) =>
        set((state) => ({
          draft: {
            ...state.draft,
            liveApi: {
              ...state.draft.liveApi,
              ...liveApiConfig,
            },
          },
        })),
      // Voice emotion & personality actions
      setVoiceEmotion: (emotion) =>
        set((state) => ({
          draft: {
            ...state.draft,
            voiceEmotion: emotion,
            voicePersonality: {
              ...state.draft.voicePersonality,
              emotion,
            },
          },
        })),
      setVoicePersonality: (config) =>
        set((state) => ({
          draft: {
            ...state.draft,
            voicePersonality: {
              ...state.draft.voicePersonality,
              ...config,
            },
          },
        })),
      setBackgroundNoise: (config) =>
        set((state) => ({
          draft: {
            ...state.draft,
            backgroundNoise: {
              ...state.draft.backgroundNoise,
              ...config,
            },
          },
        })),
      // Advanced settings actions
      setMaxTokens: (maxTokens) =>
        set((state) => ({
          draft: {
            ...state.draft,
            maxTokens,
          },
        })),
      setTemperature: (temperature) =>
        set((state) => ({
          draft: {
            ...state.draft,
            temperature,
          },
        })),
      setResponseTimeout: (responseTimeout) =>
        set((state) => ({
          draft: {
            ...state.draft,
            responseTimeout,
          },
        })),
      // Skills actions
      setEnabledSkills: (skills) =>
        set((state) => ({
          draft: {
            ...state.draft,
            enabledSkills: skills,
          },
        })),
      toggleSkill: (skill) =>
        set((state) => {
          const exists = state.draft.enabledSkills.includes(skill);
          return {
            draft: {
              ...state.draft,
              enabledSkills: exists
                ? state.draft.enabledSkills.filter((s) => s !== skill)
                : [...state.draft.enabledSkills, skill],
            },
          };
        }),
      // Custom functions actions
      addCustomFunction: (func) =>
        set((state) => ({
          draft: {
            ...state.draft,
            customFunctions: [...state.draft.customFunctions, func],
          },
        })),
      updateCustomFunction: (id, func) =>
        set((state) => ({
          draft: {
            ...state.draft,
            customFunctions: state.draft.customFunctions.map((f) =>
              f.id === id ? { ...f, ...func } : f
            ),
          },
        })),
      removeCustomFunction: (id) =>
        set((state) => ({
          draft: {
            ...state.draft,
            customFunctions: state.draft.customFunctions.filter((f) => f.id !== id),
          },
        })),
      addKnowledgeFile: (file) =>
        set((state) => ({
          draft: {
            ...state.draft,
            knowledgeFiles: [...state.draft.knowledgeFiles, file],
          },
        })),
      removeKnowledgeFile: (id) =>
        set((state) => ({
          draft: {
            ...state.draft,
            knowledgeFiles: state.draft.knowledgeFiles.filter((file) => file.id !== id),
          },
        })),
      setDraftFromServer: (draft) =>
        set((state) => ({
          draft: {
            ...state.draft,
            ...draft,
            tools: draft.tools ?? state.draft.tools,
            channels: (draft.channels as ChannelKey[] | undefined) ?? state.draft.channels,
            liveApi: {
              ...state.draft.liveApi,
              ...(draft.liveApi ?? {}),
            },
            knowledgeFiles: draft.knowledgeFiles ?? state.draft.knowledgeFiles,
            voiceEmotion: draft.voiceEmotion ?? state.draft.voiceEmotion,
            voicePersonality: draft.voicePersonality
              ? { ...state.draft.voicePersonality, ...draft.voicePersonality }
              : state.draft.voicePersonality,
            backgroundNoise: draft.backgroundNoise
              ? { ...state.draft.backgroundNoise, ...draft.backgroundNoise }
              : state.draft.backgroundNoise,
            maxTokens: draft.maxTokens ?? state.draft.maxTokens,
            temperature: draft.temperature ?? state.draft.temperature,
            responseTimeout: draft.responseTimeout ?? state.draft.responseTimeout,
            enabledSkills: draft.enabledSkills ?? state.draft.enabledSkills,
            customFunctions: draft.customFunctions ?? state.draft.customFunctions,
          },
        })),
      resetDraft: () => {
        const current = get().draft;
        set({
          draft: {
            ...defaultAgentBuilderDraft,
            channels: [...defaultAgentBuilderDraft.channels],
            tools: [...defaultAgentBuilderDraft.tools],
            liveApi: { ...DEFAULT_LIVE_API_CONFIG },
            knowledgeFiles: [],
            id: current.id,
            voiceEmotion: defaultAgentBuilderDraft.voiceEmotion,
            voicePersonality: { ...defaultAgentBuilderDraft.voicePersonality },
            backgroundNoise: { ...defaultAgentBuilderDraft.backgroundNoise },
            maxTokens: defaultAgentBuilderDraft.maxTokens,
            temperature: defaultAgentBuilderDraft.temperature,
            responseTimeout: defaultAgentBuilderDraft.responseTimeout,
            enabledSkills: [...defaultAgentBuilderDraft.enabledSkills],
            customFunctions: [],
          },
          currentStep: 0,
        });
      },
    }),
    {
      name: "bo-support.builder-config",
      partialize: (state) => ({
        draft: state.draft,
        currentStep: state.currentStep,
      }),
    },
  ),
);
