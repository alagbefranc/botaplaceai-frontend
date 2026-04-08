"use client";

import {
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  LoadingOutlined,
  MessageOutlined,
  PhoneOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SoundOutlined,
  SwapOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Think, ThoughtChain } from "@ant-design/x";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { VoicePicker, ToolPicker, ChannelPicker, AgentSummary } from "@/components/builder";

// ── ThoughtChain tool-call item ──
export interface ToolCallItem {
  key: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  status: "loading" | "success" | "error" | "abort" | "pending";
  content?: ReactNode;
}

// ── Builder stage → default tool-call items ──
const STAGE_TOOL_CALLS: Record<string, ToolCallItem[]> = {
  thinking: [
    { key: "think", title: "Thinking...", icon: <LoadingOutlined />, status: "loading" },
  ],
  analyzing: [
    { key: "parse", title: "Analyzing your request", icon: <SearchOutlined />, status: "success" },
    { key: "design", title: "Designing agent blueprint", icon: <RobotOutlined />, status: "loading" },
    { key: "prepare", title: "Preparing configuration", icon: <SettingOutlined />, status: "pending" },
  ],
  voice: [
    { key: "voice-cfg", title: "Configuring voice settings", icon: <SoundOutlined />, status: "loading" },
    { key: "voice-load", title: "Loading available voices", icon: <LoadingOutlined />, status: "pending" },
  ],
  tools: [
    { key: "tool-scan", title: "Scanning connected integrations", icon: <ToolOutlined />, status: "loading" },
    { key: "tool-cfg", title: "Preparing tool configuration", icon: <SettingOutlined />, status: "pending" },
  ],
  channels: [
    { key: "ch-scan", title: "Checking available channels", icon: <SwapOutlined />, status: "loading" },
    { key: "ch-cfg", title: "Configuring channel routing", icon: <SettingOutlined />, status: "pending" },
  ],
  deploying: [
    { key: "validate", title: "Validating agent configuration", icon: <SettingOutlined />, status: "success" },
    { key: "deploy", title: "Deploying agent to production", icon: <DeploymentUnitOutlined />, status: "loading" },
  ],
};

// ── BuilderThoughtChain — shows agentic tool-calling UI ──
interface BuilderThoughtChainProps {
  stage: keyof typeof STAGE_TOOL_CALLS | string;
  /** Override or extend the default tool-call items */
  toolCalls?: ToolCallItem[];
}

export function BuilderThoughtChain({ stage, toolCalls }: BuilderThoughtChainProps) {
  const items = useMemo(() => {
    const base = STAGE_TOOL_CALLS[stage] ?? STAGE_TOOL_CALLS.analyzing;
    return toolCalls ?? base;
  }, [stage, toolCalls]);

  return (
    <ThoughtChain
      items={items.map((item) => ({
        key: item.key,
        title: item.title,
        description: item.description,
        icon: item.icon,
        // ThoughtChain accepts: error | success | loading | abort
        // "pending" maps to undefined (renders as default/inactive)
        status: item.status === "pending" ? undefined : item.status,
        collapsible: Boolean(item.content),
        content: item.content,
      }))}
      style={{ width: "100%" }}
    />
  );
}

// ── Completed ThoughtChain — all items show success ──
interface CompletedThoughtChainProps {
  items: Array<{ key: string; title: string; icon?: ReactNode }>;
}

export function CompletedThoughtChain({ items }: CompletedThoughtChainProps) {
  return (
    <ThoughtChain
      items={items.map((item) => ({
        key: item.key,
        title: item.title,
        icon: item.icon ?? <CheckCircleFilled style={{ color: "var(--ant-color-success, #52c41a)" }} />,
        status: "success" as const,
      }))}
      style={{ width: "100%" }}
    />
  );
}

// ── Error ThoughtChain — shows error on the failed step ──
interface ErrorThoughtChainProps {
  completedSteps: Array<{ key: string; title: string; icon?: ReactNode }>;
  errorStep: { key: string; title: string; description?: string };
}

export function ErrorThoughtChain({ completedSteps, errorStep }: ErrorThoughtChainProps) {
  return (
    <ThoughtChain
      items={[
        ...completedSteps.map((step) => ({
          key: step.key,
          title: step.title,
          icon: step.icon ?? <CheckCircleFilled style={{ color: "var(--ant-color-success, #52c41a)" }} />,
          status: "success" as const,
        })),
        {
          key: errorStep.key,
          title: errorStep.title,
          description: errorStep.description,
          icon: <CloseCircleFilled style={{ color: "var(--ant-color-error, #ff4d4f)" }} />,
          status: "error" as const,
        },
      ]}
      style={{ width: "100%" }}
    />
  );
}

// ── AgentWorkingIndicator — uses Think for deep-thinking state ──
// Kept for scenarios where we need a "thinking" animation without tool-call chain
const WORKING_MESSAGES = [
  "I will dispatch a research agent to analyze your request and current setup.",
  "I am mapping your requirements into agent name, prompt, voice, and channel decisions.",
  "I am validating your configuration so deployment is ready for production use.",
];

export function AgentWorkingIndicator() {
  const [elapsedSeconds, setElapsedSeconds] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const cycleIndex = useMemo(
    () => Math.floor((elapsedSeconds - 1) / 3) % WORKING_MESSAGES.length,
    [elapsedSeconds]
  );

  return (
    <Think title={`Thought · ${elapsedSeconds}s`} loading blink defaultExpanded>
      {WORKING_MESSAGES[cycleIndex]}
    </Think>
  );
}

// ── Special token parsing ──
export type SpecialTokenType = "voice_picker" | "tool_picker" | "channel_picker" | "agent_summary" | "agent_ready";

// Field update tokens
export interface FieldUpdate {
  field: "purpose" | "name" | "prompt" | "voice" | "tools" | "channels" | "greeting" | "memory" | "guardrails" | "escalation";
  value: string;
}

export interface ParsedMessageContent {
  text: string;
  components: SpecialTokenType[];
  fieldUpdates: FieldUpdate[];
}

const TOKEN_MAP: Record<string, SpecialTokenType> = {
  "[VOICE_PICKER]": "voice_picker",
  "[TOOL_PICKER]": "tool_picker",
  "[CHANNEL_PICKER]": "channel_picker",
  "[AGENT_SUMMARY]": "agent_summary",
  "[AGENT_READY]": "agent_ready",
};

// Regex patterns for field update tokens
const FIELD_UPDATE_PATTERNS: Array<{ pattern: RegExp; field: FieldUpdate["field"] }> = [
  { pattern: /\[SET_PURPOSE:([^\]]+)\]/g, field: "purpose" },
  { pattern: /\[SET_NAME:([^\]]+)\]/g, field: "name" },
  { pattern: /\[SET_PROMPT:([^\]]+)\]/g, field: "prompt" },
  { pattern: /\[SET_VOICE:([^\]]+)\]/g, field: "voice" },
  { pattern: /\[SET_TOOLS:([^\]]+)\]/g, field: "tools" },
  { pattern: /\[SET_CHANNELS:([^\]]+)\]/g, field: "channels" },
  { pattern: /\[SET_GREETING:([^\]]+)\]/g, field: "greeting" },
  { pattern: /\[SET_MEMORY:([^\]]+)\]/g, field: "memory" },
  { pattern: /\[SET_GUARDRAILS:([^\]]+)\]/g, field: "guardrails" },
  { pattern: /\[SET_ESCALATION:([^\]]+)\]/g, field: "escalation" },
];

export function parseSpecialTokens(content: string): ParsedMessageContent {
  const components: SpecialTokenType[] = [];
  const fieldUpdates: FieldUpdate[] = [];
  let text = content;

  // Parse UI component tokens
  for (const [token, type] of Object.entries(TOKEN_MAP)) {
    if (text.includes(token)) {
      components.push(type);
      text = text.replace(token, "").trim();
    }
  }

  // Parse field update tokens
  for (const { pattern, field } of FIELD_UPDATE_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        fieldUpdates.push({ field, value: match[1].trim() });
        text = text.replace(match[0], "").trim();
      }
    }
  }

  return { text, components, fieldUpdates };
}

// ── Field update display names ──
export const FIELD_DISPLAY_NAMES: Record<FieldUpdate["field"], string> = {
  purpose: "Setting purpose",
  name: "Setting agent name",
  prompt: "Generating personality",
  voice: "Configuring voice",
  tools: "Adding tools",
  channels: "Setting up channels",
  greeting: "Setting greeting message",
  memory: "Configuring memory",
  guardrails: "Setting guardrails",
  escalation: "Configuring escalation",
};

export const FIELD_ICONS: Record<FieldUpdate["field"], ReactNode> = {
  purpose: <SearchOutlined />,
  name: <RobotOutlined />,
  prompt: <SettingOutlined />,
  voice: <SoundOutlined />,
  tools: <ToolOutlined />,
  channels: <SwapOutlined />,
  greeting: <MessageOutlined />,
  memory: <DatabaseOutlined />,
  guardrails: <SafetyCertificateOutlined />,
  escalation: <PhoneOutlined />,
};

export interface RenderTokenOptions {
  isGuest?: boolean;
  onOpenAuthModal?: () => void;
  onConnectApps?: () => void;
}

export function renderTokenComponent(type: SpecialTokenType, options: RenderTokenOptions = {}) {
  switch (type) {
    case "voice_picker":
      return <VoicePicker key="voice_picker" />;
    case "tool_picker":
      return <ToolPicker key="tool_picker" onConnectApps={options.onConnectApps} />;
    case "channel_picker":
      return <ChannelPicker key="channel_picker" />;
    case "agent_summary":
      return (
        <AgentSummary
          key="agent_summary"
          isGuest={options.isGuest}
          onOpenAuthModal={options.onOpenAuthModal}
        />
      );
    case "agent_ready":
      // This is handled separately in the parent component
      return null;
    default:
      return null;
  }
}
