"use client";

import {
  ArrowsAltOutlined,
  AppstoreFilled,
  BarChartOutlined,
  BugOutlined,
  CheckCircleFilled,
  CodeOutlined,
  DeploymentUnitOutlined,
  FileAddOutlined,
  GoogleOutlined,
  HistoryOutlined,
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RadarChartOutlined,
  RobotOutlined,
  RocketOutlined,
  SettingOutlined,
  SwapOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Tiny } from "@ant-design/charts";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tooltip,
  Typography,
} from "antd";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";
import { AntxPlaygroundChat, type AntxPlaygroundMessage } from "./antx-playground-chat";
import {
  ChannelStepCard,
  LiveCapabilitiesStepCard,
  PersonalityStepCard,
  SummaryStepCard,
  ToolStepCard,
  VoiceStepCard,
} from "./builder-inline-steps";
import {
  BuilderThoughtChain,
  CompletedThoughtChain,
  ErrorThoughtChain,
  parseSpecialTokens,
  renderTokenComponent,
  FIELD_DISPLAY_NAMES,
  FIELD_ICONS,
  type FieldUpdate,
  type ToolCallItem,
} from "./builder-token-components";
import { RoutePageShell } from "./route-page-shell";
import { VoiceCallOrb } from "./voice-call-orb";

const pendingProtectedActionStorageKey = "bo-support.pending-protected-action";
const guestAgentDraftStorageKey = "bo-support.guest-agent-draft-count";
const guestAgentDraftLimit = 1;

type AuthMode = "signup" | "login";
type BuilderStage =
  | "idle"
  | "personality"
  | "voice"
  | "tools"
  | "channels"
  | "live_api"
  | "summary"
  | "complete";

interface AuthFormValues {
  email: string;
  password: string;
}

interface DashboardPayload {
  stats: {
    users: number;
    conversations: number;
    messages: number;
    avgDurationMinutes: number;
  };
  setupProgress: {
    agents: boolean;
    knowledge: boolean;
    workflows: boolean;
    objects: boolean;
  };
  channels: {
    whatsapp: boolean;
    voice: boolean;
    sms: boolean;
    teams: boolean;
    slack: boolean;
    email: boolean;
  };
  resume: {
    agentId: string;
    title: string;
    preview: string;
    timestamp: string;
  } | null;
}

interface DeployPayload {
  deployed: boolean;
  agent: {
    id: string;
    name: string;
    channels: string[];
    voice: string;
  } | null;
  embedCode: string;
  voiceLine: {
    number: string | null;
    id: string | null;
  };
}

const defaultDashboardPayload: DashboardPayload = {
  stats: {
    users: 0,
    conversations: 0,
    messages: 0,
    avgDurationMinutes: 0,
  },
  setupProgress: {
    agents: false,
    knowledge: false,
    workflows: false,
    objects: false,
  },
  channels: {
    whatsapp: false,
    voice: false,
    sms: false,
    teams: false,
    slack: false,
    email: false,
  },
  resume: null,
};

function inferAgentName(prompt: string) {
  const calledMatch = prompt.match(/called\s+([a-zA-Z0-9 _-]{2,30})/i);

  if (calledMatch?.[1]) {
    return calledMatch[1].trim();
  }

  return "Support Copilot";
}

function getShortDuration(seconds: number) {
  if (!seconds || seconds <= 0) {
    return "0m";
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

export function HomeDashboard() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [authForm] = Form.useForm<AuthFormValues>();

  const {
    draft,
    currentStep,
    setCurrentStep,
    setName,
    setSystemPrompt,
    setVoice,
    setTools,
    setChannels,
    toggleChannel,
    setLiveApiConfig,
    setDraftFromServer,
    resetDraft,
  } = useAgentBuilderStore();

  const [input, setInput] = useState("");
  const [builderMessages, setBuilderMessages] = useState<AntxPlaygroundMessage[]>([]);
  const [builderStage, setBuilderStage] = useState<BuilderStage>("idle");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [org, setOrg] = useState<{ id: string; name: string; plan: string } | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [guestAgentDraftCount, setGuestAgentDraftCount] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardPayload>(defaultDashboardPayload);
  const [deploySubmitting, setDeploySubmitting] = useState(false);
  const [deploySuccessOpen, setDeploySuccessOpen] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployPayload | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Playground test agent state
  const [testMessages, setTestMessages] = useState<AntxPlaygroundMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testAgentId, setTestAgentId] = useState<string | null>(null);
  const [testSessionId] = useState(() => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string }[]>([]);
  const [isTestStreaming, setIsTestStreaming] = useState(false);

  const stageRef = useRef<BuilderStage>(builderStage);

  useEffect(() => {
    stageRef.current = builderStage;
  }, [builderStage]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 18) {
      return "Good afternoon";
    }

    return "Good evening";
  }, []);

  const chatStarted = builderMessages.length > 0;
  const guestAgentDraftRemaining = Math.max(0, guestAgentDraftLimit - guestAgentDraftCount);

  const usageConfigs = useMemo(
    () => [
      {
        key: "users",
        label: "Users",
        value: dashboardData.stats.users,
        color: "#3B82F6",
      },
      {
        key: "conversations",
        label: "Conversations",
        value: dashboardData.stats.conversations,
        color: "#F59E0B",
      },
      {
        key: "messages",
        label: "Messages",
        value: dashboardData.stats.messages,
        color: "#06B6D4",
      },
    ].map((card) => {
      const points = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.88, 1].map((index, i) => ({
        index: i,
        value: Math.max(0, card.value) * index + (i % 2 === 0 ? 0 : Math.max(1, card.value * 0.04)),
      }));

      return {
        ...card,
        chart: {
          data: points,
          xField: "index",
          yField: "value",
          autoFit: true,
          height: 64,
          smooth: true,
          axis: false,
          legend: false,
          tooltip: false,
          style: {
            stroke: card.color,
            lineWidth: 2,
            fill: card.color,
            fillOpacity: 0.08,
          },
          point: {
            size: 3,
            shapeField: "circle",
            style: {
              fill: card.color,
              stroke: "#fff",
              lineWidth: 1.5,
            },
          },
        },
      };
    }),
    [dashboardData.stats],
  );

  const DASHBOARD_CHANNEL_ICONS: Record<string, string> = {
    whatsapp: "https://api.iconify.design/logos:whatsapp-icon.svg",
    voice: "https://api.iconify.design/mdi:microphone.svg?color=%23F97316",
    sms: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
    teams: "https://api.iconify.design/logos:microsoft-teams.svg",
    slack: "https://api.iconify.design/logos:slack-icon.svg",
    email: "https://api.iconify.design/mdi:email.svg?color=%23f5222d",
  };

  const channelCards = useMemo(
    () => [
      {
        key: "whatsapp",
        title: "WhatsApp",
        connected: dashboardData.channels.whatsapp,
        action: "Join WhatsApp waitlist",
      },
      {
        key: "voice",
        title: "Voice",
        connected: dashboardData.channels.voice,
        action: "Get a Voice Line",
      },
      {
        key: "sms",
        title: "SMS",
        connected: dashboardData.channels.sms,
        action: "Join SMS waitlist",
      },
      {
        key: "teams",
        title: "Microsoft Teams",
        connected: dashboardData.channels.teams,
        action: "Connect Microsoft Teams",
      },
      {
        key: "slack",
        title: "Slack",
        connected: dashboardData.channels.slack,
        action: "Connect Slack",
      },
      {
        key: "email",
        title: "Email",
        connected: dashboardData.channels.email,
        action: "Connect Email",
      },
    ],
    [dashboardData.channels],
  );

  const setupProgressItems = useMemo(
    () => [
      { key: "agents", label: "Set up AI Agents", done: dashboardData.setupProgress.agents },
      { key: "knowledge", label: "Add Knowledge", done: dashboardData.setupProgress.knowledge },
      { key: "workflows", label: "Create Agentic Workflows", done: dashboardData.setupProgress.workflows },
      { key: "objects", label: "Setup Business Objects", done: dashboardData.setupProgress.objects },
    ],
    [dashboardData.setupProgress],
  );

  const rightRailLinks = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", href: "/", blackIcon: "Home_1.svg", mintIcon: "Home_3.svg" },
      { key: "agents", label: "Agents", href: "/agents", blackIcon: "Verified_1.svg", mintIcon: "Verified_3.svg" },
      { key: "analytics", label: "Analytics", href: "/analytics", blackIcon: "Dashboard_1.svg", mintIcon: "Dashboard_3.svg" },
      { key: "conversations", label: "Conversations", href: "/conversations", blackIcon: "Messages-or-Chats_1.svg", mintIcon: "Messages-or-Chats_2.svg" },
      { key: "apps", label: "Apps", href: "/apps", blackIcon: "More_1.svg", mintIcon: "More_3.svg" },
      { key: "voice", label: "Numbers", href: "/phone-numbers", blackIcon: "Call_1.svg", mintIcon: "Call_3.svg" },
      { key: "contacts", label: "Contacts", href: "/contacts", blackIcon: "Profile_1.svg", mintIcon: "Profile_3.svg" },
      { key: "missions", label: "Missions", href: "/missions", blackIcon: "Send-Point_1.svg", mintIcon: "Send-Point_3.svg" },
      { key: "widget", label: "Widget", href: "/widget", blackIcon: "Share_1.svg", mintIcon: "Share_3.svg" },
      { key: "settings", label: "Settings", href: "/settings", blackIcon: "Settings.svg", mintIcon: "Settings_2.svg" },
    ],
    [],
  );

  const appendMessage = useCallback((role: "user" | "assistant", content: React.ReactNode) => {
    setBuilderMessages((previous) => [
      ...previous,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role,
        content,
      },
    ]);
  }, []);

  /**
   * Shows a loading ThoughtChain → waits → replaces with completed chain + conversation message + step card.
   * This creates the natural "agent is calling tools" animation before revealing content.
   */
  const transitionWithThoughtChain = useCallback(
    (opts: {
      stage: string;
      completedItems: Array<{ key: string; title: string }>;
      message: string;
      card?: React.ReactNode;
      delay?: number;
    }) => {
      const transitionId = `transition-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Phase 1: Show loading ThoughtChain
      setBuilderMessages((prev) => [
        ...prev,
        {
          id: transitionId,
          role: "assistant" as const,
          content: <BuilderThoughtChain stage={opts.stage} />,
          loading: true,
        },
      ]);

      // Phase 2: After delay, replace loading with completed chain + message + card
      setTimeout(() => {
        setBuilderMessages((prev) =>
          prev.map((msg) =>
            msg.id === transitionId
              ? {
                  ...msg,
                  loading: false,
                  content: <CompletedThoughtChain items={opts.completedItems} />,
                }
              : msg
          )
        );

        // Append combined message with card (if provided) in a single bubble
        setBuilderMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: "assistant" as const,
            content: (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span>{opts.message}</span>
                {opts.card}
              </div>
            ),
          },
        ]);
      }, opts.delay ?? 1200);
    },
    []
  );

  const claimGuestDraft = useCallback(() => {
    if (isAuthenticated) {
      return true;
    }

    if (guestAgentDraftCount >= guestAgentDraftLimit) {
      router.push("/auth/signup");
      return false;
    }

    const nextCount = Math.min(guestAgentDraftCount + 1, guestAgentDraftLimit);
    setGuestAgentDraftCount(nextCount);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(guestAgentDraftStorageKey, String(nextCount));
    }

    return true;
  }, [guestAgentDraftCount, isAuthenticated, message]);

  const bootstrapAccount = useCallback(async () => {
    // Prevent duplicate calls
    if (isBootstrapping) {
      return;
    }
    setIsBootstrapping(true);

    try {
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        org?: { id: string; name: string; plan: string };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to initialize your workspace.");
      }

      if (payload?.org) {
        setOrg(payload.org);

        if (typeof window !== "undefined") {
          window.localStorage.setItem("orgId", payload.org.id);
        }
      }
    } finally {
      setIsBootstrapping(false);
    }
  }, [isBootstrapping]);

  const refreshDashboard = useCallback(async () => {
    if (!isAuthenticated) {
      setDashboardData(defaultDashboardPayload);
      return;
    }

    const response = await fetch("/api/dashboard", {
      method: "GET",
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as DashboardPayload | { error?: string } | null;

    if (!response.ok) {
      throw new Error((payload as { error?: string } | null)?.error ?? "Failed to load dashboard.");
    }

    setDashboardData(payload as DashboardPayload);
  }, [isAuthenticated]);

  const deployAgent = useCallback(async () => {
    if (!isAuthenticated) {
      router.push("/auth/signup");
      return;
    }

    setDeploySubmitting(true);

    try {
      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: draft.id,
          name: draft.name,
          systemPrompt: draft.systemPrompt,
          voice: draft.voice,
          tools: draft.tools,
          channels: draft.channels,
          greetingMessage: draft.greetingMessage,
          liveApi: draft.liveApi,
          status: "active",
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (DeployPayload & { error?: string })
        | null;

      if (!response.ok || !payload?.deployed) {
        throw new Error(payload?.error ?? "Failed to deploy agent.");
      }

      if (payload.agent?.id) {
        setDraftFromServer({
          id: payload.agent.id,
          status: "active",
        });
      }

      setDeployResult(payload);
      setDeploySuccessOpen(true);

      stageRef.current = "complete";
      setBuilderStage("complete");
      setCurrentStep(7);

      appendMessage("assistant", (
        <CompletedThoughtChain items={[
          { key: "validate", title: "Agent configuration validated" },
          { key: "deploy", title: "Deployed to production" },
          { key: "ready", title: "Agent is live and ready for testing" },
        ]} />
      ));

      appendMessage(
        "assistant",
        payload.agent?.id ? (
          <Space orientation="vertical" size={8} style={{ width: "100%" }}>
            <Typography.Text>
              Your agent is live. Copy the embed code from the deployment drawer, then test and refine it.
            </Typography.Text>
            <Button type="link" style={{ padding: 0 }} href={`/agents/${payload.agent.id}`}>
              Open agent details
            </Button>
          </Space>
        ) : (
          "Your agent is live. Copy the embed code from the deployment drawer and start testing."
        ),
      );

      void refreshDashboard().catch(() => {/* non-critical background refresh */});
    } catch (error) {
      appendMessage("assistant", (
        <ErrorThoughtChain
          completedSteps={[
            { key: "validate", title: "Agent configuration validated" },
          ]}
          errorStep={{
            key: "deploy",
            title: "Deployment failed",
            description: error instanceof Error ? error.message : "Unknown error",
          }}
        />
      ));
      message.error(error instanceof Error ? error.message : "Failed to deploy agent.");
    } finally {
      setDeploySubmitting(false);
    }
  }, [
    appendMessage,
    draft.channels,
    draft.greetingMessage,
    draft.id,
    draft.name,
    draft.systemPrompt,
    draft.tools,
    draft.voice,
    draft.liveApi,
    isAuthenticated,
    message,
    refreshDashboard,
    setCurrentStep,
    setDraftFromServer,
  ]);

  const goToSummaryStep = useCallback(() => {
    if (stageRef.current !== "live_api") {
      return;
    }

    stageRef.current = "summary";
    setBuilderStage("summary");
    setCurrentStep(6);

    transitionWithThoughtChain({
      stage: "deploying",
      completedItems: [
        { key: "live-set", title: "Live API configured" },
        { key: "validate", title: "Validating full agent configuration" },
        { key: "summary", title: "Preparing deployment summary" },
      ],
      message: "Perfect. Here is the full configuration so you can review everything before saving and deploying.",
      card: (
        <SummaryStepCard
          name={draft.name}
          systemPrompt={draft.systemPrompt}
          voice={draft.voice}
          channels={draft.channels}
          tools={draft.tools}
          liveApi={draft.liveApi}
          knowledgeLabel={draft.knowledgeFiles[0]?.name ?? "No file uploaded yet"}
          onSaveDeploy={() => {
            void deployAgent();
          }}
          deploying={deploySubmitting}
        />
      ),
    });
  }, [
    deployAgent,
    deploySubmitting,
    draft.channels,
    draft.knowledgeFiles,
    draft.liveApi,
    draft.name,
    draft.systemPrompt,
    draft.tools,
    draft.voice,
    setCurrentStep,
    transitionWithThoughtChain,
  ]);

  const goToLiveApiStep = useCallback(() => {
    if (stageRef.current !== "channels") {
      return;
    }

    stageRef.current = "live_api";
    setBuilderStage("live_api");
    setCurrentStep(5);

    transitionWithThoughtChain({
      stage: "channels",
      completedItems: [
        { key: "ch-set", title: `${draft.channels.length} channel${draft.channels.length !== 1 ? "s" : ""} enabled` },
        { key: "live-cfg", title: "Loading live API configuration" },
      ],
      message: "Great. Let us tune the live conversation behavior like model choice, transcriptions, and VAD.",
      card: (
        <LiveCapabilitiesStepCard
          config={draft.liveApi}
          onChange={setLiveApiConfig}
          onContinue={goToSummaryStep}
        />
      ),
    });
  }, [draft.channels.length, draft.liveApi, goToSummaryStep, setCurrentStep, setLiveApiConfig, transitionWithThoughtChain]);

  const goToChannelStep = useCallback(() => {
    if (stageRef.current !== "tools") {
      return;
    }

    stageRef.current = "channels";
    setBuilderStage("channels");
    setCurrentStep(4);

    appendMessage("assistant", (
      <CompletedThoughtChain items={[
        { key: "tools-cfg", title: `${draft.tools.length} tool${draft.tools.length !== 1 ? "s" : ""} configured` },
        { key: "ch-scan", title: "Checking available channels" },
      ]} />
    ));

    appendMessage(
      "assistant",
      "Nice. Now choose where this agent should run so users can actually reach it.",
    );

    appendMessage("assistant", (
      <ChannelStepCard
        selectedChannels={draft.channels}
        onToggle={(channel) => {
          toggleChannel(channel);
        }}
        onContinue={goToLiveApiStep}
      />
    ));
  }, [appendMessage, draft.channels, draft.tools.length, goToLiveApiStep, setCurrentStep, toggleChannel]);

  const goToToolStep = useCallback(() => {
    if (stageRef.current !== "voice") {
      return;
    }

    stageRef.current = "tools";
    setBuilderStage("tools");
    setCurrentStep(3);

    appendMessage("assistant", (
      <CompletedThoughtChain items={[
        { key: "voice-set", title: `Voice selected: ${draft.voice || "Default"}` },
        { key: "tool-scan", title: "Scanning available integrations" },
      ]} />
    ));

    appendMessage(
      "assistant",
      "Great voice choice. What should this agent be able to do? Pick tools and connect apps if needed.",
    );

    appendMessage("assistant", (
      <ToolStepCard
        selectedTools={draft.tools}
        onToolsChange={setTools}
        onConnectApps={() => {
          if (isAuthenticated) {
            void router.push("/apps");
            return;
          }

          router.push("/auth/signup");
        }}
        onContinue={goToChannelStep}
      />
    ));
  }, [appendMessage, draft.tools, draft.voice, goToChannelStep, isAuthenticated, message, router, setCurrentStep, setTools]);

  const goToVoiceStep = useCallback(() => {
    if (stageRef.current !== "personality") {
      return;
    }

    stageRef.current = "voice";
    setBuilderStage("voice");
    setCurrentStep(2);

    appendMessage("assistant", (
      <CompletedThoughtChain items={[
        { key: "personality", title: "Personality configured" },
        { key: "voice-load", title: "Loading voice engine" },
      ]} />
    ));

    appendMessage(
      "assistant",
      "Awesome. Next, pick a voice that matches the personality and audience you want.",
    );

    appendMessage("assistant", (
      <VoiceStepCard
        selectedVoice={draft.voice}
        onSelect={setVoice}
        onContinue={goToToolStep}
      />
    ));
  }, [appendMessage, draft.voice, goToToolStep, setCurrentStep, setVoice]);

  const streamAIResponse = useCallback(
    async (userMessage: string, conversationHistory: Array<{ role: "user" | "assistant"; content: string }>) => {
      setIsStreaming(true);
      const assistantMessageId = `assistant-${Date.now()}`;
      let processedFieldUpdates: FieldUpdate[] = [];
      let agentReady = false;
  
      // Show thinking indicator
      setBuilderMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: <BuilderThoughtChain stage="thinking" />,
          loading: true,
        },
      ]);
  
      try {
        const response = await fetch("/api/builder/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...conversationHistory, { role: "user", content: userMessage }],
            agentConfig: {
              name: draft.name,
              systemPrompt: draft.systemPrompt,
              voice: draft.voice,
              tools: draft.tools,
              channels: draft.channels,
              greeting: draft.greetingMessage,
              liveApi: draft.liveApi,
            },
            currentStep,
          }),
        });
  
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Failed to get AI response (${response.status})`);
        }
  
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response stream");
        }
  
        const decoder = new TextDecoder();
        let fullText = "";
        let pending = "";
  
        // Helper to build tool call items for completed field updates
        const buildToolCallItems = (updates: FieldUpdate[], currentlyProcessing?: FieldUpdate["field"]): ToolCallItem[] => {
          const items: ToolCallItem[] = [];
          for (const update of updates) {
            const isProcessing = currentlyProcessing === update.field;
            items.push({
              key: `set-${update.field}`,
              title: FIELD_DISPLAY_NAMES[update.field],
              icon: FIELD_ICONS[update.field],
              status: isProcessing ? "loading" : "success",
              description: update.value.length > 50 ? update.value.slice(0, 50) + "..." : update.value,
            });
          }
          return items;
        };
  
        const applyPartialText = (nextText: string) => {
          fullText += nextText;
          const parsed = parseSpecialTokens(fullText);
          const { text: cleanText, components, fieldUpdates } = parsed;
  
          // Process new field updates
          for (const update of fieldUpdates) {
            const alreadyProcessed = processedFieldUpdates.some(
              (p) => p.field === update.field && p.value === update.value
            );
            if (!alreadyProcessed) {
              processedFieldUpdates.push(update);
                
              // Apply the field update to the store
              switch (update.field) {
                case "name":
                  setName(update.value);
                  break;
                case "prompt":
                  setSystemPrompt(update.value);
                  break;
                case "voice":
                  setVoice(update.value);
                  break;
                case "tools":
                  setTools(update.value.split(",").map((t) => t.trim()).filter(Boolean));
                  break;
                case "channels": {
                  const channelValues = update.value.split(",").map((c) => c.trim()).filter(Boolean);
                  setChannels(channelValues as ("web_chat" | "web_voice" | "phone" | "whatsapp" | "sms")[]);
                  break;
                }
              }
            }
          }
  
          // Check for agent ready
          if (components.includes("agent_ready")) {
            agentReady = true;
          }
  
          // Build the message content
          const toolCallItems = buildToolCallItems(processedFieldUpdates);
          const hasToolCalls = toolCallItems.length > 0;
          const uiComponents = components
            .filter((c) => c !== "agent_ready")
            .map((type) => renderTokenComponent(type, {
              isGuest: !isAuthenticated,
              onOpenAuthModal: () => {
                router.push("/auth/signup");
              },
              onConnectApps: () => void router.push("/apps"),
            }));
  
          setBuilderMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    loading: false,
                    content: (
                      <Space direction="vertical" size={12} style={{ width: "100%" }}>
                        {hasToolCalls && (
                          <BuilderThoughtChain stage="custom" toolCalls={toolCallItems} />
                        )}
                        {cleanText && <Typography.Text>{cleanText}</Typography.Text>}
                        {uiComponents}
                      </Space>
                    ),
                  }
                : msg
            )
          );
        };
  
        const consumeSseDataLine = (rawLine: string) => {
          const line = rawLine.trim();
  
          if (!line.startsWith("data:")) {
            return;
          }
  
          const data = line.slice(5).trimStart();
  
          if (!data || data === "[DONE]") {
            return;
          }
  
          const parsed = JSON.parse(data) as { text?: string; error?: string };
  
          if (parsed.error) {
            throw new Error(parsed.error);
          }
  
          if (parsed.text) {
            applyPartialText(parsed.text);
          }
        };
  
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            pending += decoder.decode(value, { stream: !done });
            const lines = pending.split("\n");
            pending = lines.pop() ?? "";
  
            for (const line of lines) {
              consumeSseDataLine(line);
            }
          }
  
          if (done) {
            if (pending.trim()) {
              consumeSseDataLine(pending);
            }
            break;
          }
        }
  
        // Auto-advance step based on field updates
        if (processedFieldUpdates.length > 0) {
          const hasName = processedFieldUpdates.some((u) => u.field === "name");
          const hasPrompt = processedFieldUpdates.some((u) => u.field === "prompt");
          const hasVoice = processedFieldUpdates.some((u) => u.field === "voice");
          const hasTools = processedFieldUpdates.some((u) => u.field === "tools");
          const hasChannels = processedFieldUpdates.some((u) => u.field === "channels");
  
          if (hasChannels && currentStep < 6) {
            setCurrentStep(6);
            stageRef.current = "summary";
            setBuilderStage("summary");
          } else if (hasTools && currentStep < 5) {
            setCurrentStep(5);
            stageRef.current = "channels";
            setBuilderStage("channels");
          } else if (hasVoice && currentStep < 4) {
            setCurrentStep(4);
            stageRef.current = "tools";
            setBuilderStage("tools");
          } else if (hasPrompt && currentStep < 3) {
            setCurrentStep(3);
            stageRef.current = "voice";
            setBuilderStage("voice");
          } else if (hasName && currentStep < 2) {
            setCurrentStep(2);
            stageRef.current = "personality";
            setBuilderStage("personality");
          }
        }
  
        // If agent is ready, move to summary step (deployment handled by user)
        if (agentReady) {
          setCurrentStep(7);
          stageRef.current = "summary";
          setBuilderStage("summary");
        }
      } catch (error) {
        const fallbackMessage =
          stageRef.current === "personality"
            ? "I hit a temporary AI issue, but I already drafted your assistant prompt. You can refine it and continue."
            : "I hit a temporary AI issue, but your setup is still active here. Continue with the next step card and I'll keep building with you.";
  
        const errorMessage = error instanceof Error ? error.message : "Something went wrong";
        setBuilderMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  loading: false,
                  content: (
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <ErrorThoughtChain
                        completedSteps={[
                          { key: "parse", title: "Analyzed your request" },
                        ]}
                        errorStep={{
                          key: "respond",
                          title: "AI Response Failed",
                          description: errorMessage,
                        }}
                      />
                      <Typography.Text>{fallbackMessage}</Typography.Text>
                    </Space>
                  ),
                }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [
      currentStep,
      draft.channels,
      draft.greetingMessage,
      draft.liveApi,
      draft.name,
      draft.systemPrompt,
      draft.tools,
      draft.voice,
      isAuthenticated,
      router,
      setChannels,
      setCurrentStep,
      setName,
      setSystemPrompt,
      setTools,
      setVoice,
    ]
  );

  const startBuilder = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();

      if (!trimmed) {
        return;
      }

      if (stageRef.current === "idle" && !claimGuestDraft()) {
        return;
      }

      setInput("");
      appendMessage("user", trimmed);

      // Always use AI streaming for natural conversation
      // The AI will guide through steps: purpose → name → personality → voice → tools → channels
      if (stageRef.current === "idle") {
        stageRef.current = "personality";
        setBuilderStage("personality");
        setCurrentStep(1);
      }

      // Get conversation history as plain text for API
      const conversationHistory = builderMessages
        .filter((msg) => typeof msg.content === "string")
        .map((msg) => ({
          role: msg.role,
          content: msg.content as string,
        }));

      void streamAIResponse(trimmed, conversationHistory);
    },
    [
      appendMessage,
      builderMessages,
      claimGuestDraft,
      draft.name,
      draft.systemPrompt,
      goToVoiceStep,
      setCurrentStep,
      setName,
      setSystemPrompt,
      streamAIResponse,
    ],
  );

  const executePendingAction = useCallback(
    async (actionName: string) => {
      if (actionName === "Save & Deploy Agent") {
        await deployAgent();
        return;
      }

      if (actionName === "Connect selected apps") {
        void router.push("/apps");
        return;
      }

      if (actionName === "Get a Voice Line") {
        void router.push("/phone-numbers");
        return;
      }

      message.success(`${actionName} started.`);
    },
    [deployAgent, message, router],
  );

  const requestProtectedAction = useCallback(
    (actionName: string) => {
      if (!supabase) {
        message.error(
          "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        );
        return;
      }

      if (isAuthenticated) {
        void executePendingAction(actionName);
        return;
      }

      router.push("/auth/signup");
    },
    [executePendingAction, isAuthenticated, message, router, supabase],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedValue = window.localStorage.getItem(guestAgentDraftStorageKey);
    const parsedValue = Number.parseInt(savedValue ?? "0", 10);

    if (!Number.isNaN(parsedValue) && parsedValue > 0) {
      setGuestAgentDraftCount(Math.min(parsedValue, guestAgentDraftLimit));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(guestAgentDraftStorageKey);

    if (guestAgentDraftCount !== 0) {
      setGuestAgentDraftCount(0);
    }
  }, [guestAgentDraftCount, isAuthenticated]);

  useEffect(() => {
    if (!supabase || typeof window === "undefined") {
      return;
    }

    let active = true;

    const hydrateSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        message.error(error.message);
        return;
      }

      const sessionUser = data.session?.user ?? null;
      setIsAuthenticated(Boolean(sessionUser));
      setAuthenticatedEmail(sessionUser?.email ?? null);

      if (sessionUser) {
        try {
          await bootstrapAccount();
          await refreshDashboard();
        } catch (bootstrapError) {
          message.warning(
            bootstrapError instanceof Error ? bootstrapError.message : "Workspace setup failed.",
          );
        }

        const queuedAction = window.sessionStorage.getItem(pendingProtectedActionStorageKey);

        if (queuedAction) {
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
          await executePendingAction(queuedAction);
        }
      } else {
        setOrg(null);
        window.localStorage.removeItem("orgId");
      }
    };

    void hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setIsAuthenticated(Boolean(sessionUser));
      setAuthenticatedEmail(sessionUser?.email ?? null);

      if (sessionUser) {
        void bootstrapAccount().then(() => refreshDashboard()).catch(() => {/* silent – dashboard will retry */});
      } else if (typeof window !== "undefined") {
        setOrg(null);
        window.localStorage.removeItem("orgId");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [bootstrapAccount, executePendingAction, message, refreshDashboard, supabase]);

  const resolveAuthSuccess = useCallback(
    async (mode: AuthMode, email: string | null | undefined) => {
      setIsAuthenticated(true);
      setAuthenticatedEmail(email ?? null);
      setAuthOpen(false);
      authForm.resetFields();

      try {
        await bootstrapAccount();
        await refreshDashboard();
      } catch (error) {
        message.warning(error instanceof Error ? error.message : "Workspace setup failed.");
      }

      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);

        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
        }

        await executePendingAction(action);
        return;
      }

      message.success(
        mode === "signup"
          ? "Account created. You can now save and deploy your agent."
          : "Logged in successfully.",
      );
    },
    [
      authForm,
      bootstrapAccount,
      executePendingAction,
      message,
      pendingAction,
      refreshDashboard,
    ],
  );

  const handleEmailAuth = async (values: AuthFormValues) => {
    if (!supabase) {
      message.error(
        "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setAuthSubmitting(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
          },
        });

        if (error) {
          message.error(error.message);
          return;
        }

        if (data.session) {
          await resolveAuthSuccess("signup", data.user?.email ?? values.email);
          return;
        }

        setAuthOpen(false);
        authForm.resetFields();
        setPendingAction(null);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
        }
        message.success("Check your inbox to confirm your account, then log in.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        message.error(error.message);
        return;
      }

      await resolveAuthSuccess("login", data.user?.email ?? values.email);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!supabase) {
      message.error(
        "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (typeof window !== "undefined" && pendingAction) {
      window.sessionStorage.setItem(pendingProtectedActionStorageKey, pendingAction);
    }

    setAuthSubmitting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });

    if (error) {
      setAuthSubmitting(false);
      message.error(error.message);
    }
  };

  const closeAuthModal = () => {
    setAuthOpen(false);
    setPendingAction(null);
    setAuthSubmitting(false);
    authForm.resetFields();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
    }
  };

  const handleCreateAgent = () => {
    if (!claimGuestDraft()) {
      return;
    }

    resetDraft();
    stageRef.current = "idle";
    setBuilderStage("idle");
    setCurrentStep(0);
    setBuilderMessages([]);
    setInput("Create a new AI agent for handling customer support.");
  };

  const handleResumeBuilder = () => {
    if (dashboardData.resume?.agentId) {
      void router.push(`/agents/${dashboardData.resume.agentId}`);
    } else {
      setPlaygroundOpen(true);
    }
  };

  // Load available agents when playground opens
  useEffect(() => {
    if (!playgroundOpen || !isAuthenticated || !supabase) return;

    const loadAgents = async () => {
      try {
        const orgId = typeof window !== "undefined" ? window.localStorage.getItem("orgId") : null;
        if (!orgId) return;

        const { data, error } = await supabase
          .from("agents")
          .select("id, name")
          .eq("org_id", orgId)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (!error && data) {
          setAvailableAgents(data);
          if (data.length > 0 && !testAgentId) {
            setTestAgentId(data[0].id);
          }
        }
      } catch {
        // Silently ignore
      }
    };

    void loadAgents();
  }, [playgroundOpen, isAuthenticated, supabase, testAgentId]);

  const sendTestMessage = useCallback(async (text: string) => {
    if (!text.trim() || !testAgentId || isTestStreaming) return;

    const userMsg: AntxPlaygroundMessage = {
      id: `test-u-${Date.now()}`,
      role: "user",
      content: text,
    };

    const assistantMsgId = `test-a-${Date.now()}`;
    const assistantMsg: AntxPlaygroundMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      loading: true,
    };

    setTestMessages((prev) => [...prev, userMsg, assistantMsg]);
    setTestInput("");
    setIsTestStreaming(true);

    try {
      const response = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: testAgentId,
          message: text,
          sessionId: testSessionId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to get response from agent");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string; greeting?: string };
            if (parsed.greeting) {
              // Insert greeting as a separate message before the AI response
              const greetingMsg: AntxPlaygroundMessage = {
                id: `test-g-${Date.now()}`,
                role: "assistant",
                content: parsed.greeting,
              };
              setTestMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantMsgId);
                if (idx === -1) return [...prev, greetingMsg];
                const copy = [...prev];
                copy.splice(idx, 0, greetingMsg);
                return copy;
              });
            } else if (parsed.error) {
              fullText += `\n⚠️ ${parsed.error}`;
            } else if (parsed.text) {
              fullText += parsed.text;
            }
          } catch {
            // ignore parse errors
          }
        }

        setTestMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fullText, loading: false } : m,
          ),
        );
      }

      // Final update
      setTestMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: fullText || "No response.", loading: false } : m,
        ),
      );
    } catch (error) {
      const errText = error instanceof Error ? error.message : "Something went wrong.";
      setTestMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, content: `⚠️ ${errText}`, loading: false } : m,
        ),
      );
    } finally {
      setIsTestStreaming(false);
    }
  }, [testAgentId, testSessionId, isTestStreaming]);

  const [builderFullscreen, setBuilderFullscreen] = useState(false);
  const [fullscreenTestMode, setFullscreenTestMode] = useState<"chat" | "call">("chat");
  const [fullscreenTestMessages, setFullscreenTestMessages] = useState<AntxPlaygroundMessage[]>([]);
  const [fullscreenTestInput, setFullscreenTestInput] = useState("");
  const [isFullscreenTestStreaming, setIsFullscreenTestStreaming] = useState(false);
  const [fullscreenTestSessionId] = useState(() => `fs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const sendFullscreenTestMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !draft.id || isFullscreenTestStreaming) return;

      const userMsg: AntxPlaygroundMessage = {
        id: `fst-u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantMsgId = `fst-a-${Date.now()}`;
      const assistantMsg: AntxPlaygroundMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        loading: true,
      };

      setFullscreenTestMessages((prev) => [...prev, userMsg, assistantMsg]);
      setFullscreenTestInput("");
      setIsFullscreenTestStreaming(true);

      try {
        const response = await fetch("/api/widget/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: draft.id, message: text, sessionId: fullscreenTestSessionId }),
        });

        if (!response.ok || !response.body) throw new Error("Failed to get response");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { text?: string; error?: string };
              if (parsed.error) fullText += `\n${parsed.error}`;
              else if (parsed.text) fullText += parsed.text;
            } catch { /* ignore parse errors */ }
          }

          setFullscreenTestMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullText, loading: false } : m)),
          );
        }

        setFullscreenTestMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: fullText || "No response.", loading: false } : m,
          ),
        );
      } catch (error) {
        const errText = error instanceof Error ? error.message : "Something went wrong.";
        setFullscreenTestMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: errText, loading: false } : m)),
        );
      } finally {
        setIsFullscreenTestStreaming(false);
      }
    },
    [draft.id, fullscreenTestSessionId, isFullscreenTestStreaming],
  );

  // ── Builder panel content (injected into RoutePageShell's middle column) ──
  const builderPanelContent = (
    <>
      <div className="builder-panel-inner">
        <div className="builder-panel-shell-head">
          <Button
            type="text"
            shape="circle"
            icon={<ArrowsAltOutlined />}
            aria-label="Expand to fullscreen"
            onClick={() => setBuilderFullscreen(true)}
          />
        </div>

        {!chatStarted ? (
          <div className="builder-empty">
            <Image
              src="/assets/illustrations/bota/workspace-hero.svg"
              alt="Botaplace AI workspace illustration"
              width={240}
              height={107}
              priority
            />
            <Typography.Title level={3} className="builder-title">
              {greeting}, Francis
            </Typography.Title>
            <Typography.Paragraph className="builder-subtitle">
              {isAuthenticated
                ? "Just describe what you need — build agents, run agentic workflows, explore insights, and deploy with confidence."
                : "You are currently in guest mode. You can create one draft agent before signing in."}
            </Typography.Paragraph>
            {!isAuthenticated ? (
              <Typography.Text type="secondary">
                Guest drafts remaining: {guestAgentDraftRemaining} of {guestAgentDraftLimit}
              </Typography.Text>
            ) : null}
          </div>
        ) : null}

        <AntxPlaygroundChat
          messages={builderMessages}
          inputValue={input}
          onInputChange={setInput}
          onSubmit={startBuilder}
          showConversations={false}
          showWelcome={false}
          mode="compact"
          disableSuggestions
          inputPlaceholder={
            currentStep >= 6
              ? "Review your setup and deploy when ready..."
              : "How can I help you today?"
          }
          quickActions={!chatStarted ? (
            <>
              <Button
                shape="round"
                size="small"
                icon={<ToolOutlined />}
                onClick={() => startBuilder("Build an AI support agent")}
              >
                Build
              </Button>
              <Button
                shape="round"
                size="small"
                icon={<BarChartOutlined />}
                onClick={() => startBuilder("Analyze customer support workflows")}
              >
                Analyze
              </Button>
              <Button
                shape="round"
                size="small"
                icon={<BugOutlined />}
                onClick={() => startBuilder("Debug my automation flow")}
              >
                Debug
              </Button>
              <Button
                shape="round"
                size="small"
                icon={<RadarChartOutlined />}
                onClick={() => startBuilder("Monitor channel performance")}
              >
                Monitor
              </Button>
            </>
          ) : undefined}
        />

      </div>
    </>
  );

  // ── Overlays: drawers + auth modal ──
  const overlays = (
    <>
      {/* ── Fullscreen chat expansion (triggered by expand icon) ── */}
      <Drawer
        open={builderFullscreen}
        onClose={() => setBuilderFullscreen(false)}
        placement="bottom"
        height="100dvh"
        title={
          <Flex align="center" gap={12}>
            <RobotOutlined />
            <Typography.Text strong>AI Builder</Typography.Text>
            {draft.name ? (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                / {draft.name}
              </Typography.Text>
            ) : null}
          </Flex>
        }
        className="builder-fullscreen-drawer"
        styles={{
          body: { flex: 1, display: "flex", flexDirection: "row", overflow: "hidden", padding: 0, minHeight: 0 },
          header: { flexShrink: 0, borderBottom: "1px solid var(--platform-border-soft)" },
        }}
      >
        {/* ── Left: Chat area (mirrors pre-expansion layout exactly) ── */}
        <div className="builder-fs-chat">
          {!chatStarted ? (
            <div className="builder-empty">
              <Image
                src="/assets/illustrations/bota/workspace-hero.svg"
                alt="Botaplace AI workspace illustration"
                width={240}
                height={107}
                priority
              />
              <Typography.Title level={3} className="builder-title">
                {greeting}, Francis
              </Typography.Title>
              <Typography.Paragraph className="builder-subtitle">
                {isAuthenticated
                  ? "Just describe what you need — build agents, run agentic workflows, explore insights, and deploy with confidence."
                  : "You are currently in guest mode. You can create one draft agent before signing in."}
              </Typography.Paragraph>
              {!isAuthenticated ? (
                <Typography.Text type="secondary">
                  Guest drafts remaining: {guestAgentDraftRemaining} of {guestAgentDraftLimit}
                </Typography.Text>
              ) : null}
            </div>
          ) : null}

          <AntxPlaygroundChat
            messages={builderMessages}
            inputValue={input}
            onInputChange={setInput}
            onSubmit={startBuilder}
            showConversations={false}
            showWelcome={false}
            mode="compact"
            disableSuggestions
            inputPlaceholder={
              currentStep >= 6
                ? "Review your setup and deploy when ready..."
                : "How can I help you today?"
            }
            quickActions={!chatStarted ? (
              <>
                <Button
                  shape="round"
                  size="small"
                  icon={<ToolOutlined />}
                  onClick={() => startBuilder("Build an AI support agent")}
                >
                  Build
                </Button>
                <Button
                  shape="round"
                  size="small"
                  icon={<BarChartOutlined />}
                  onClick={() => startBuilder("Analyze customer support workflows")}
                >
                  Analyze
                </Button>
                <Button
                  shape="round"
                  size="small"
                  icon={<BugOutlined />}
                  onClick={() => startBuilder("Debug my automation flow")}
                >
                  Debug
                </Button>
                <Button
                  shape="round"
                  size="small"
                  icon={<RadarChartOutlined />}
                  onClick={() => startBuilder("Monitor channel performance")}
                >
                  Monitor
                </Button>
              </>
            ) : undefined}
          />
        </div>

        {/* ── Right: Test agent sidebar (only after agent is deployed) ── */}
        {draft.id && builderStage === "complete" && (
          <div className="builder-fs-sidebar">
            <Flex align="center" gap={8} style={{ padding: "12px 16px", borderBottom: "1px solid var(--platform-border-soft)" }}>
              <RobotOutlined style={{ fontSize: 16 }} />
              <Typography.Text strong style={{ flex: 1, fontSize: 13 }}>
                Test Agent
              </Typography.Text>
              <Segmented
                size="small"
                value={fullscreenTestMode}
                onChange={(val) => setFullscreenTestMode(val as "chat" | "call")}
                options={[
                  { value: "chat", icon: <MessageOutlined />, label: "Chat" },
                  { value: "call", icon: <PhoneOutlined />, label: "Call" },
                ]}
              />
              {fullscreenTestMode === "chat" && fullscreenTestMessages.length > 0 && (
                <Button size="small" onClick={() => setFullscreenTestMessages([])}>
                  Clear
                </Button>
              )}
            </Flex>

            <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {fullscreenTestMode === "chat" ? (
                <AntxPlaygroundChat
                  messages={fullscreenTestMessages}
                  inputValue={fullscreenTestInput}
                  onInputChange={setFullscreenTestInput}
                  onSubmit={(text) => void sendFullscreenTestMessage(text)}
                  loading={isFullscreenTestStreaming}
                  showConversations={false}
                  showWelcome={false}
                  mode="compact"
                  disableSuggestions
                  inputPlaceholder="Test your agent..."
                />
              ) : (
                <VoiceCallOrb agentId={draft.id} agentName={draft.name} />
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer
        title={
          <Flex align="center" gap={10} style={{ width: "100%" }}>
            <Typography.Text strong style={{ whiteSpace: "nowrap" }}>Test Agent</Typography.Text>
            <Select
              size="small"
              value={testAgentId ?? undefined}
              onChange={(val) => {
                setTestAgentId(val);
                setTestMessages([]);
              }}
              placeholder="Select an agent"
              style={{ minWidth: 180, flex: 1 }}
              options={availableAgents.map((a) => ({ value: a.id, label: a.name }))}
              notFoundContent="No active agents"
            />
            <Button
              size="small"
              onClick={() => setTestMessages([])}
              disabled={testMessages.length === 0}
            >
              Clear
            </Button>
          </Flex>
        }
        placement="left"
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
        size="large"
        className="playground-drawer"
      >
        {!testAgentId ? (
          <Flex vertical align="center" justify="center" style={{ height: "100%", textAlign: "center", padding: 24 }}>
            <RobotOutlined style={{ fontSize: 48, color: "var(--platform-text-muted)", marginBottom: 16 }} />
            <Typography.Title level={5} style={{ margin: 0 }}>No agent selected</Typography.Title>
            <Typography.Text type="secondary" style={{ marginTop: 8 }}>
              Deploy an agent first, then select it above to start testing.
            </Typography.Text>
            <Button type="primary" style={{ marginTop: 16 }} onClick={() => { setPlaygroundOpen(false); handleCreateAgent(); }}>
              Create an agent
            </Button>
          </Flex>
        ) : (
          <AntxPlaygroundChat
            messages={testMessages}
            inputValue={testInput}
            onInputChange={setTestInput}
            onSubmit={(text) => void sendTestMessage(text)}
            loading={isTestStreaming}
            showConversations={false}
            showWelcome={false}
            mode="compact"
            disableSuggestions
            inputPlaceholder="Type a message to test your agent..."
            assistantAvatar={
              <Avatar
                size={36}
                src="/assets/avatars/bota-copilot-avatar.png"
                style={{ background: "transparent" }}
              />
            }
            assistantName={availableAgents.find((a) => a.id === testAgentId)?.name || "AI Agent"}
          />
        )}
      </Drawer>

      <Drawer
        title="Your agent is live"
        placement="right"
        open={deploySuccessOpen}
        onClose={() => setDeploySuccessOpen(false)}
        size="large"
      >
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {(deployResult?.agent?.name ?? draft.name) || "Your agent"} is live!
          </Typography.Title>

          <Typography.Text type="secondary">Paste this before {"</body>"} on your website:</Typography.Text>
          <Typography.Paragraph copyable={{ text: deployResult?.embedCode ?? "" }} className="deploy-code-block">
            <pre>{deployResult?.embedCode ?? ""}</pre>
          </Typography.Paragraph>

          <Divider style={{ margin: "4px 0" }} />

          <Typography.Title level={5} style={{ margin: 0 }}>Voice Line</Typography.Title>
          <Typography.Paragraph copyable={{ text: deployResult?.voiceLine.number ?? "" }}>
            {deployResult?.voiceLine.number ?? "Provisioning your voice line..."}
          </Typography.Paragraph>

          <Space wrap>
            <Button onClick={() => { setPlaygroundOpen(true); setDeploySuccessOpen(false); }}>
              Test your agent
            </Button>
            <Button type="primary" onClick={() => { setDeploySuccessOpen(false); }}>
              Go to Dashboard
            </Button>
          </Space>
        </Space>
      </Drawer>

      {/* Auth modal removed — now handled by /auth/signup and /auth/login pages */}
    </>
  );

  return (
    <RoutePageShell
      title="Dashboard"
      builderPanel={builderPanelContent}
      extraOverlays={overlays}
      nativeContent
    >
      {/* ── Dashboard main panel — retains original dashboard-panel CSS ── */}
      <div className="dashboard-panel">
        <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <Typography.Title level={4} className="dashboard-title">
              {greeting}, Francis
            </Typography.Title>
            <Typography.Text type="secondary">
              {isAuthenticated
                ? `Signed in as ${authenticatedEmail ?? "your account"}`
                : "Sign in to save and deploy your agents"}
            </Typography.Text>
          </div>
          {isAuthenticated && (
            <Space wrap size={12}>
              <Button icon={<RobotOutlined />} onClick={handleCreateAgent}>
                Create agent
              </Button>
              <Button
                icon={<FileAddOutlined />}
                onClick={() => void router.push("/knowledge-base")}
              >
                Add content
              </Button>
              <Button
                icon={<DeploymentUnitOutlined />}
                onClick={() => void router.push("/apps")}
              >
                Add workflows
              </Button>
              <Button icon={<RocketOutlined />} onClick={() => void deployAgent()} loading={deploySubmitting}>
                Deploy
              </Button>
            </Space>
          )}
        </header>

        {isAuthenticated ? (
          <>
            <section className="dashboard-section">
              <Typography.Title level={5}>Pick up where you left off</Typography.Title>
              <Card className="resume-card" hoverable onClick={handleResumeBuilder}>
                {dashboardData.resume ? (
                  <>
                    <Typography.Title level={5} className="resume-card-title">
                      {dashboardData.resume.title}
                    </Typography.Title>
                    <Typography.Paragraph className="resume-card-body">
                      {dashboardData.resume.preview}
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">
                      {new Date(dashboardData.resume.timestamp).toLocaleString()}
                    </Typography.Text>
                  </>
                ) : (
                  <>
                    <Typography.Title level={5} className="resume-card-title">
                      Create a new AI agent for handling customer support
                    </Typography.Title>
                    <Typography.Paragraph className="resume-card-body">
                      Start in the builder to define personality, voice, tools, channels, and deploy in one flow.
                    </Typography.Paragraph>
                    <Typography.Text type="secondary">Just now</Typography.Text>
                  </>
                )}
              </Card>
            </section>

            <section className="dashboard-section">
              <Typography.Title level={5}>Setup progress</Typography.Title>
              <Typography.Text type="secondary">
                Complete these essential steps to be production ready.
              </Typography.Text>
              <Card className="resume-card">
                <div className="setup-progress-card">
                  <div className="setup-progress-list" role="list" aria-label="Setup progress">
                    {setupProgressItems.map((item) => (
                      <div className="setup-progress-item" key={item.key} role="listitem">
                        <CheckCircleFilled
                          className={`setup-progress-icon ${item.done ? "setup-progress-icon-done" : ""}`}
                        />
                        <Typography.Text>{item.label}</Typography.Text>
                      </div>
                    ))}
                  </div>

                  <Image
                    src="/assets/illustrations/bota/conversations.svg"
                    alt="Botaplace AI conversations illustration"
                    width={160}
                    height={71}
                  />
                </div>
              </Card>
            </section>

            <section className="dashboard-section">
              <div className="section-header-row">
                <div>
                  <Typography.Title level={5}>Usage trends</Typography.Title>
                  <Typography.Text type="secondary">
                    Data from the last 30 days based on total conversations.
                  </Typography.Text>
                </div>

                <Button type="link" href="/analytics">
                  View full insights
                </Button>
              </div>

              <div className="usage-grid">
                {usageConfigs.map((card) => (
                  <Card key={card.key} className="usage-card">
                    <Typography.Text type="secondary">{card.label}</Typography.Text>
                    <Typography.Title level={2}>{card.value}</Typography.Title>
                    <Tiny.Area {...card.chart} />
                  </Card>
                ))}
              </div>

              <Typography.Text type="secondary">
                Average conversation duration: {getShortDuration(Math.round(dashboardData.stats.avgDurationMinutes * 60))}
              </Typography.Text>
            </section>

            <section className="dashboard-section">
              <Typography.Title level={5}>Connected channels</Typography.Title>
              <Typography.Text type="secondary">
                {channelCards.filter((channel) => channel.connected).length} channels connected
              </Typography.Text>

              <Card className="channels-card">
                <div className="channels-grid">
                  {channelCards.map((channel) => (
                    <button
                      key={channel.key}
                      className="channel-row"
                      onClick={() => {
                        if (channel.key === "voice") {
                          requestProtectedAction("Get a Voice Line");
                          return;
                        }
                        requestProtectedAction(channel.action);
                      }}
                      type="button"
                    >
                      <img
                          src={DASHBOARD_CHANNEL_ICONS[channel.key] ?? ""}
                          alt={channel.title}
                          style={{ width: 24, height: 24, flexShrink: 0 }}
                        />
                      <div className="channel-copy">
                        <Typography.Text strong>{channel.title}</Typography.Text>
                        <Typography.Text type="secondary">
                          {channel.connected ? "Connected" : "Not connected"}
                        </Typography.Text>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <Button type="link" href="/apps" className="configure-channels-link">
                Configure more channels
              </Button>
            </section>
          </>
        ) : (
          <section className="dashboard-section">
            <Card className="resume-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <Image
                src="/assets/illustrations/bota/workspace-hero.svg"
                alt="Botaplace AI welcome illustration"
                width={240}
                height={107}
                style={{ marginBottom: 16 }}
              />
              <Typography.Title level={4}>Welcome to the AI Agent Platform</Typography.Title>
              <Typography.Paragraph type="secondary" style={{ maxWidth: 400, margin: "0 auto 24px" }}>
                Sign in to access your dashboard, create AI agents, view analytics, and deploy across channels.
              </Typography.Paragraph>
              <Space>
                <Button
                  type="primary"
                  size="large"
                  href="/auth/signup"
                >
                  Get Started
                </Button>
                <Button
                  size="large"
                  href="/auth/login"
                >
                  Sign In
                </Button>
              </Space>
            </Card>
          </section>
        )}
        </div>{/* end dashboard-content */}
      </div>{/* end dashboard-panel */}
    </RoutePageShell>
  );
}
