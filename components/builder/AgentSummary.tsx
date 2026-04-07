"use client";

import { RocketOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, Descriptions, Tag, Typography } from "antd";
import { useState } from "react";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";
import { useDeployStore } from "@/lib/stores/deploy-store";

const VOICE_DESCRIPTIONS: Record<string, string> = {
  Puck: "Friendly",
  Charon: "Deep",
  Kore: "Neutral",
  Fenrir: "Warm",
  Aoede: "Melodic",
  Leda: "Gentle",
  Orus: "Rich",
  Zephyr: "Breezy",
  Achernar: "Clear",
  Achird: "Measured",
  Algenib: "Bright",
  Algieba: "Smooth",
  Alnilam: "Steady",
  Autonoe: "Lively",
  Callirrhoe: "Soft",
  Despina: "Cheerful",
  Enceladus: "Bold",
  Erinome: "Elegant",
  Gacrux: "Grounded",
  Iapetus: "Thoughtful",
  Laomedeia: "Graceful",
  Pulcherrima: "Radiant",
  Rasalgethi: "Commanding",
  Sadachbia: "Open",
  Sadaltager: "Balanced",
  Schedar: "Crisp",
  Sulafat: "Mellow",
  Umbriel: "Mysterious",
  Vindemiatrix: "Polished",
  Zubenelgenubi: "Unique",
};

interface AgentSummaryProps {
  isGuest?: boolean;
  onOpenAuthModal?: () => void;
}

export function AgentSummary({
  isGuest = false,
  onOpenAuthModal,
}: AgentSummaryProps) {
  const { message } = AntdApp.useApp();
  const { draft } = useAgentBuilderStore();
  const { openDeployDrawer } = useDeployStore();
  const [deploying, setDeploying] = useState(false);

  const voiceDescription = VOICE_DESCRIPTIONS[draft.voice] || "";

  const handleSaveAndDeploy = async () => {
    if (isGuest && onOpenAuthModal) {
      onOpenAuthModal();
      return;
    }

    setDeploying(true);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name || "Untitled Agent",
          systemPrompt: draft.systemPrompt,
          voice: draft.voice,
          tools: draft.tools,
          channels: draft.channels,
          greetingMessage: draft.greetingMessage,
          liveApi: draft.liveApi,
          status: "active",
        }),
      });

      const data = (await response.json()) as { agent?: { id: string; name: string }; error?: string };

      if (!response.ok || !data.agent) {
        throw new Error(data.error || "Failed to save agent");
      }

      const widgetCode = `<script src="https://yourplatform.com/widget.js" data-agent-id="${data.agent.id}"></script>`;
      const phoneNumber = "+1 (204) 555-0142";

      openDeployDrawer({
        id: data.agent.id,
        name: data.agent.name,
        voice: draft.voice,
        channels: draft.channels,
        tools: draft.tools,
        widgetCode,
        phoneNumber,
      });

      message.success("Agent deployed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deploy agent";
      message.error(errorMessage);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="builder-inline-card agent-summary-card">
      <Typography.Text strong style={{ fontSize: 16, display: "block", marginBottom: 12 }}>
        ✅ Agent Summary
      </Typography.Text>

      <Descriptions column={1} size="small">
        <Descriptions.Item label="Name">
          {draft.name || <Typography.Text type="secondary">Not set</Typography.Text>}
        </Descriptions.Item>
        <Descriptions.Item label="Voice">
          {draft.voice}
          {voiceDescription && (
            <Typography.Text type="secondary"> ({voiceDescription})</Typography.Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Channels">
          {draft.channels.length > 0 ? (
            draft.channels.map((channel) => (
              <Tag key={channel} color="blue" style={{ marginBottom: 2 }}>
                {channel.replace("_", " ")}
              </Tag>
            ))
          ) : (
            <Typography.Text type="secondary">None selected</Typography.Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Tools">
          {draft.tools.length > 0 ? (
            draft.tools.map((tool) => (
              <Tag key={tool} color="purple" style={{ marginBottom: 2 }}>
                {tool.replace("_", " ")}
              </Tag>
            ))
          ) : (
            <Typography.Text type="secondary">None selected</Typography.Text>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Live model">{draft.liveApi.model}</Descriptions.Item>
      </Descriptions>

      <Button
        type="primary"
        block
        size="large"
        icon={<RocketOutlined />}
        onClick={handleSaveAndDeploy}
        loading={deploying}
        className="agent-summary-deploy-btn"
      >
        Save & Deploy Agent
      </Button>
    </div>
  );
}
