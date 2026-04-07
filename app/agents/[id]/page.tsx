"use client";

import {
  ArrowLeftOutlined,
  BookOutlined,
  BulbOutlined,
  CustomerServiceOutlined,
  ExperimentOutlined,
  FundOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SettingOutlined,
  SlidersOutlined,
  MessageOutlined,
  SoundOutlined,
  ToolOutlined,
  ControlOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Button,
  Card,
  Space,
  Spin,
  Tabs,
  Typography,
} from "antd";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LIVE_API_CONFIG,
  DEFAULT_BEHAVIOR_CONFIG,
  DEFAULT_SPEECH_CONFIG,
  DEFAULT_TOOLS_CONFIG,
  DEFAULT_HOOKS_CONFIG,
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_INSIGHT_EXTRACTION_CONFIG,
  DEFAULT_CUSTOM_INSIGHTS_CONFIG,
  DEFAULT_GUARDRAILS_CONFIG,
  DEFAULT_ANALYSIS_PLAN,
  type ChannelKey,
  type CustomFunction,
  type LiveApiConfig,
  type BehaviorConfig,
  type SpeechConfig,
  type ToolsConfig,
  type HooksConfig,
  type ProviderConfig,
  type MemoryConfig,
  type InsightExtractionConfig,
  type CustomInsightsConfig,
  type GuardrailsConfig,
  type AnalysisPlan,
} from "@/lib/domain/agent-builder";
import { RoutePageShell } from "@/app/_components/route-page-shell";
import { AgentTestDrawer } from "@/app/_components/agent-test-drawer";
import {
  CoreSettingsTab,
  BehaviorTab,
  MessagesTab,
  SpeechTab,
  ToolsTab,
  AdvancedTab,
  MemoryTab,
  InsightsTab,
  KnowledgeTab,
  SecurityTab,
  EscalationTab,
  TrainingTab,
  type EditableAgent,
} from "./_components";

interface AgentApiRecord {
  id: string;
  name: string;
  system_prompt: string | null;
  voice: string;
  tools: string[];
  channels: string[];
  status: "draft" | "active" | "paused";
  greeting_message: string | null;
  liveApi?: LiveApiConfig;
  customFunctions?: CustomFunction[];
  behavior?: BehaviorConfig;
  speech?: SpeechConfig;
  toolsConfig?: ToolsConfig;
  hooks?: HooksConfig;
  provider?: ProviderConfig;
  memory?: MemoryConfig;
  insightExtraction?: InsightExtractionConfig;
  customInsights?: CustomInsightsConfig;
  guardrails?: GuardrailsConfig;
  analysisPlan?: AnalysisPlan;
}

interface AgentGetResponse {
  agent?: AgentApiRecord;
  error?: string;
}

const defaultGreetingMessage = "Hi! How can I help you today?";

export default function AgentDetailsPage() {
  return (
    <Suspense>
      <AgentDetailsPageInner />
    </Suspense>
  );
}

function AgentDetailsPageInner() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const agentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [agent, setAgent] = useState<EditableAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") ?? "core");

  const loadAgent = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/agents?id=${agentId}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as AgentGetResponse | null;

      if (!response.ok || !payload?.agent) {
        throw new Error(payload?.error ?? "Agent not found.");
      }

      const apiAgent = payload.agent;
      setAgent({
        id: apiAgent.id,
        name: apiAgent.name,
        systemPrompt: apiAgent.system_prompt ?? "",
        voice: apiAgent.voice || "Puck",
        tools: apiAgent.tools ?? [],
        channels: ((apiAgent.channels ?? ["web_chat"]) as ChannelKey[]).filter(Boolean),
        status: apiAgent.status,
        greetingMessage: apiAgent.greeting_message ?? defaultGreetingMessage,
        liveApi: {
          ...DEFAULT_LIVE_API_CONFIG,
          ...(apiAgent.liveApi ?? {}),
        },
        customFunctions: apiAgent.customFunctions ?? [],
        behavior: {
          ...DEFAULT_BEHAVIOR_CONFIG,
          ...(apiAgent.behavior ?? {}),
        },
        speech: {
          ...DEFAULT_SPEECH_CONFIG,
          ...(apiAgent.speech ?? {}),
        },
        toolsConfig: {
          ...DEFAULT_TOOLS_CONFIG,
          ...(apiAgent.toolsConfig ?? {}),
        },
        hooks: {
          ...DEFAULT_HOOKS_CONFIG,
          ...(apiAgent.hooks ?? {}),
        },
        provider: {
          ...DEFAULT_PROVIDER_CONFIG,
          ...(apiAgent.provider ?? {}),
        },
        memory: {
          ...DEFAULT_MEMORY_CONFIG,
          ...(apiAgent.memory ?? {}),
        },
        insightExtraction: {
          ...DEFAULT_INSIGHT_EXTRACTION_CONFIG,
          ...(apiAgent.insightExtraction ?? {}),
        },
        customInsights: {
          ...DEFAULT_CUSTOM_INSIGHTS_CONFIG,
          ...(apiAgent.customInsights ?? {}),
        },
        guardrails: {
          ...DEFAULT_GUARDRAILS_CONFIG,
          ...(apiAgent.guardrails ?? {}),
        },
        analysisPlan: {
          ...DEFAULT_ANALYSIS_PLAN,
          ...(apiAgent.analysisPlan ?? {}),
        },
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load agent details.");
      setAgent(null);
    } finally {
      setLoading(false);
    }
  }, [agentId, message]);

  useEffect(() => {
    void loadAgent();
  }, [loadAgent]);

  const updateAgentField = <K extends keyof EditableAgent>(key: K, value: EditableAgent[K]) => {
    setAgent((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [key]: value,
      };
    });
  };

  const updateLiveApi = (patch: Partial<LiveApiConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        liveApi: { ...previous.liveApi, ...patch },
      };
    });
  };

  const updateBehavior = (patch: Partial<BehaviorConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        behavior: { ...previous.behavior, ...patch },
      };
    });
  };

  const updateSpeech = (patch: Partial<SpeechConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        speech: { ...previous.speech, ...patch },
      };
    });
  };

  const updateToolsConfig = (patch: Partial<ToolsConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        toolsConfig: { ...previous.toolsConfig, ...patch },
      };
    });
  };

  const updateHooks = (patch: Partial<HooksConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        hooks: { ...previous.hooks, ...patch },
      };
    });
  };

  const updateProvider = (patch: Partial<ProviderConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        provider: { ...previous.provider, ...patch },
      };
    });
  };

  const updateMemory = (patch: Partial<MemoryConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        memory: { ...previous.memory, ...patch },
      };
    });
  };

  const updateInsightExtraction = (patch: Partial<InsightExtractionConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        insightExtraction: { ...previous.insightExtraction, ...patch },
      };
    });
  };

  const updateCustomInsights = (patch: Partial<CustomInsightsConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        customInsights: { ...DEFAULT_CUSTOM_INSIGHTS_CONFIG, ...previous.customInsights, ...patch },
      };
    });
  };

  const updateGuardrails = (patch: Partial<GuardrailsConfig>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        guardrails: { ...previous.guardrails, ...patch },
      };
    });
  };

  const updateAnalysisPlan = (patch: Partial<AnalysisPlan>) => {
    setAgent((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        analysisPlan: { ...DEFAULT_ANALYSIS_PLAN, ...previous.analysisPlan, ...patch },
      };
    });
  };

  const saveAgent = async () => {
    if (!agent) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: agent.id,
          name: agent.name,
          systemPrompt: agent.systemPrompt,
          voice: agent.voice,
          tools: agent.tools,
          channels: agent.channels,
          greetingMessage: agent.greetingMessage,
          status: agent.status,
          liveApi: agent.liveApi,
          customFunctions: agent.customFunctions,
          behavior: agent.behavior,
          speech: agent.speech,
          toolsConfig: agent.toolsConfig,
          hooks: agent.hooks,
          provider: agent.provider,
          memory: agent.memory,
          insightExtraction: agent.insightExtraction,
          customInsights: agent.customInsights,
          guardrails: agent.guardrails,
          analysisPlan: agent.analysisPlan,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to save agent.");
      }

      message.success("Agent details saved.");
      await loadAgent();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save agent.");
    } finally {
      setSaving(false);
    }
  };

  const tabProps = agent ? {
    agent,
    updateAgentField,
    updateLiveApi,
    updateBehavior,
    updateSpeech,
    updateToolsConfig,
    updateHooks,
    updateProvider,
    updateMemory,
    updateInsightExtraction,
    updateCustomInsights,
    updateGuardrails,
    updateAnalysisPlan,
  } : null;

  const tabItems = [
    {
      key: "core",
      label: <span><SettingOutlined /> Core Settings</span>,
      children: tabProps && <CoreSettingsTab {...tabProps} />,
    },
    {
      key: "behavior",
      label: <span><SlidersOutlined /> Behavior</span>,
      children: tabProps && <BehaviorTab {...tabProps} />,
    },
    {
      key: "messages",
      label: <span><MessageOutlined /> Messages</span>,
      children: tabProps && <MessagesTab {...tabProps} />,
    },
    {
      key: "speech",
      label: <span><SoundOutlined /> Speech</span>,
      children: tabProps && <SpeechTab {...tabProps} />,
    },
    {
      key: "tools",
      label: <span><ToolOutlined /> Tools</span>,
      children: tabProps && <ToolsTab {...tabProps} />,
    },
    {
      key: "knowledge",
      label: <span><BookOutlined /> Knowledge</span>,
      children: tabProps && <KnowledgeTab {...tabProps} />,
    },
    {
      key: "memory",
      label: <span><CloudSyncOutlined /> Memory</span>,
      children: tabProps && <MemoryTab {...tabProps} />,
    },
    {
      key: "insights",
      label: <span><BulbOutlined /> Insights</span>,
      children: tabProps && <InsightsTab {...tabProps} />,
    },
    {
      key: "security",
      label: <span><SafetyCertificateOutlined /> Security</span>,
      children: tabProps && <SecurityTab {...tabProps} />,
    },
    {
      key: "escalation",
      label: <span><CustomerServiceOutlined /> Escalation</span>,
      children: tabProps && <EscalationTab {...tabProps} />,
    },
    {
      key: "advanced",
      label: <span><ControlOutlined /> Advanced</span>,
      children: tabProps && <AdvancedTab {...tabProps} />,
    },
    {
      key: "training",
      label: <span><FundOutlined /> Training</span>,
      children: agentId ? <TrainingTab agentId={agentId} /> : null,
    },
  ];

  return (
    <RoutePageShell
      title={agent?.name ? `Agent: ${agent.name}` : "Agent Details"}
      subtitle="Review and edit your agent configuration"
      actions={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/agents")}>
            Back to Agents
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            disabled={!agent || agent.status !== "active"}
            onClick={() => setTestDrawerOpen(true)}
          >
            Test Agent
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={() => void saveAgent()} loading={saving}>
            Save Changes
          </Button>
        </Space>
      }
    >
      {loading ? (
        <Card>
          <Space>
            <Spin size="small" />
            <Typography.Text>Loading agent details...</Typography.Text>
          </Space>
        </Card>
      ) : !agent ? (
        <Card>
          <Space orientation="vertical" size={8}>
            <Typography.Text type="secondary">Agent could not be loaded.</Typography.Text>
            <Button onClick={() => void loadAgent()}>Retry</Button>
          </Space>
        </Card>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
          style={{ width: "100%" }}
        />
      )}
      <AgentTestDrawer
        agentId={agent?.status === "active" ? agentId : null}
        agentName={agent?.name}
        open={testDrawerOpen}
        onClose={() => setTestDrawerOpen(false)}
      />
    </RoutePageShell>
  );
}
