"use client";

import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ManOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  SoundOutlined,
  ThunderboltOutlined,
  WomanOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHANNEL_OPTIONS,
  TOOL_OPTIONS,
  VOICE_OPTIONS,
  type ChannelKey,
} from "@/lib/domain/agent-builder";
import type { TabProps } from "./types";
import { getAgentAvatarUrl } from "@/lib/utils/agent-avatar";

interface ComposioIntegration {
  integrationId: string;
  appName: string;
  displayName: string;
  logo: string;
  status: "connected" | "expired" | "pending" | "error" | "not_connected";
  category: string;
}

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <Space size={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Tooltip title={help}>
        <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
      </Tooltip>
    </Space>
  );
}

interface PhoneNumberRecord {
  id: string;
  number: string;
  displayLabel: string | null;
  status: string;
  agentId: string | null;
  agentName: string | null;
}

export function CoreSettingsTab({ agent, updateAgentField }: TabProps) {
  const { message } = AntdApp.useApp();

  // ── Avatar generation ───────────────────────────────────────────────────
  const [generatingAvatar, setGeneratingAvatar] = useState(false);

  const handleGenerateAvatar = async () => {
    setGeneratingAvatar(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/generate-avatar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate avatar");
      updateAgentField("avatarUrl", data.avatar_url);
      message.success("AI avatar generated!");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Avatar generation failed.");
    } finally {
      setGeneratingAvatar(false);
    }
  };

  const handleResetAvatar = async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}/generate-avatar`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset avatar");
      }
      updateAgentField("avatarUrl", null);
      message.success("Avatar reset to default.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Avatar reset failed.");
    }
  };

  // ── Composio integrations ─────────────────────────────────────────────────
  const [integrations, setIntegrations] = useState<ComposioIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/apps", { cache: "no-store" });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.integrations) {
        setIntegrations(payload.integrations);
      }
    } catch {
      // Silent fail - fall back to TOOL_OPTIONS
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  // Build tool options: connected Composio apps + fallback to static TOOL_OPTIONS
  const connectedApps = integrations.filter((i) => i.status === "connected");
  const notConnectedApps = integrations.filter((i) => i.status !== "connected");

  // ── Voice preview ──────────────────────────────────────────────────────────
  const [voicePreviewing, setVoicePreviewing] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceUrlRef = useRef<string | null>(null);
  const voiceRequestRef = useRef(0);

  const stopVoicePreview = () => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.src = "";
      voiceAudioRef.current = null;
    }
    if (voiceUrlRef.current) {
      URL.revokeObjectURL(voiceUrlRef.current);
      voiceUrlRef.current = null;
    }
    setVoicePlaying(false);
  };

  const playVoicePreview = async () => {
    if (voicePlaying) {
      stopVoicePreview();
      return;
    }

    setVoicePreviewing(true);
    const requestId = ++voiceRequestRef.current;

    try {
      const res = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: agent.voice, text: agent.greetingMessage }),
      });

      if (requestId !== voiceRequestRef.current) return;
      if (!res.ok) throw new Error("Failed to generate preview.");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      stopVoicePreview();
      voiceUrlRef.current = url;
      const audio = new Audio(url);
      voiceAudioRef.current = audio;

      audio.onended = () => setVoicePlaying(false);
      audio.onerror = () => {
        message.error("Audio playback failed.");
        stopVoicePreview();
      };

      await audio.play();
      setVoicePlaying(true);
    } catch (err) {
      if (requestId === voiceRequestRef.current) {
        message.error(err instanceof Error ? err.message : "Voice preview failed.");
      }
    } finally {
      if (requestId === voiceRequestRef.current) {
        setVoicePreviewing(false);
      }
    }
  };

  // ── Prompt enhance ─────────────────────────────────────────────────────────
  const handleEnhancePrompt = async () => {
    setEnhancing(true);
    try {
      const res = await fetch("/api/agents/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: agent.systemPrompt,
          agentName: agent.name,
          tools: agent.tools,
        }),
      });
      const data = (await res.json()) as { enhanced?: string; error?: string };
      if (!res.ok || !data.enhanced) {
        throw new Error(data.error ?? "Enhancement failed.");
      }
      updateAgentField("systemPrompt", data.enhanced);
      message.success("Prompt enhanced! Review the changes below.");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to enhance prompt.");
    } finally {
      setEnhancing(false);
    }
  };

  // ── Phone number assignment ────────────────────────────────────────────────
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberRecord[]>([]);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const loadPhoneNumbers = useCallback(async () => {
    const orgId = typeof window !== "undefined" ? localStorage.getItem("orgId") : null;
    if (!orgId) return;
    setPhoneLoading(true);
    try {
      const res = await fetch(`/api/telnyx/phone-numbers?orgId=${orgId}`);
      const data = (await res.json()) as PhoneNumberRecord[] | { error: string };
      if (!Array.isArray(data)) return;
      setPhoneNumbers(data);
    } catch (e) {
      console.error("[CoreSettings] Failed to load phone numbers:", e);
    } finally {
      setPhoneLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agent.channels.includes("phone")) {
      void loadPhoneNumbers();
    }
  }, [agent.channels, loadPhoneNumbers]);

  const assignedNumber = phoneNumbers.find((pn) => pn.agentId === agent.id) ?? null;

  const handleAssignPhone = async (phoneNumberId: string | null) => {
    setAssigning(true);
    try {
      if (phoneNumberId === null) {
        const current = phoneNumbers.find((pn) => pn.agentId === agent.id);
        if (!current) return;
        const res = await fetch(`/api/telnyx/phone-numbers/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: null }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          message.error(err.error ?? "Failed to unassign number.");
          return;
        }
        message.success("Phone number unassigned.");
      } else {
        const res = await fetch(`/api/telnyx/phone-numbers/${phoneNumberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          message.error(err.error ?? "Failed to assign number.");
          return;
        }
        message.success("Phone number assigned to this agent.");
      }
      await loadPhoneNumbers();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Agent Avatar */}
      <Card title="Agent Avatar" size="small">
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <Avatar
              size={80}
              src={getAgentAvatarUrl(agent.id, agent.avatarUrl)}
              style={{
                border: "2px solid #f0f0f0",
                background: "#e8e8e8",
              }}
            />
            {agent.avatarUrl && (
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  background: "#52c41a",
                  borderRadius: "50%",
                  width: 18,
                  height: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircleOutlined style={{ color: "#fff", fontSize: 10 }} />
              </div>
            )}
          </div>
          <div>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
              {agent.avatarUrl ? "Custom AI-generated avatar" : "Auto-generated avatar (DiceBear)"}
            </Typography.Text>
            <Space size={8}>
              <Button
                type={agent.avatarUrl ? "default" : "primary"}
                size="small"
                loading={generatingAvatar}
                onClick={() => void handleGenerateAvatar()}
                icon={<ThunderboltOutlined />}
              >
                {generatingAvatar ? "Generating..." : "Generate AI Avatar"}
              </Button>
              {agent.avatarUrl && (
                <Button
                  size="small"
                  danger
                  onClick={() => void handleResetAvatar()}
                >
                  Reset to Default
                </Button>
              )}
            </Space>
          </div>
        </div>
      </Card>

      <Card title="Basic Information">
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={16}>
              <FieldLabel
                label="Name"
                help="A friendly name to identify this agent in your dashboard and conversations."
              />
              <Input
                value={agent.name}
                onChange={(event) => updateAgentField("name", event.target.value)}
                placeholder="Agent name"
                style={{ marginTop: 6 }}
              />
            </Col>
            <Col span={8}>
              <FieldLabel
                label="Status"
                help="Draft: testing only. Active: live for users. Paused: temporarily disabled."
              />
              <Select
                value={agent.status}
                onChange={(value) => updateAgentField("status", value as "draft" | "active" | "paused")}
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                ]}
              />
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <FieldLabel
                label="Voice"
                help="Choose the speaking style used for voice channels and preview playback."
              />
              <Space.Compact style={{ width: "100%", marginTop: 6 }}>
                <Select
                  value={agent.voice}
                  onChange={(value) => {
                    updateAgentField("voice", value);
                    stopVoicePreview();
                  }}
                  style={{ width: "100%" }}
                  optionLabelProp="label"
                >
                  {VOICE_OPTIONS.map((voice) => (
                    <Select.Option
                      key={voice.name}
                      value={voice.name}
                      label={
                        <Space>
                          <Avatar size={20} src={voice.avatar} />
                          {voice.name}
                        </Space>
                      }
                    >
                      <Space>
                        <Avatar size={32} src={voice.avatar} />
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {voice.name}
                            <Tag
                              color={voice.gender === "female" ? "pink" : voice.gender === "male" ? "blue" : "purple"}
                              style={{ marginLeft: 8, fontSize: 10 }}
                            >
                              {voice.gender === "female" ? <WomanOutlined /> : voice.gender === "male" ? <ManOutlined /> : "N"}
                            </Tag>
                          </div>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {voice.tone} — {voice.description}
                          </Typography.Text>
                        </div>
                      </Space>
                    </Select.Option>
                  ))}
                </Select>
                <Tooltip title={voicePlaying ? "Stop preview" : "Preview voice"}>
                  <Button
                    icon={voicePlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
                    type={voicePlaying ? "primary" : "default"}
                    loading={voicePreviewing && !voicePlaying}
                    onClick={() => void playVoicePreview()}
                  />
                </Tooltip>
              </Space.Compact>
            </Col>
            <Col span={12}>
              <FieldLabel
                label="Greeting Message"
                help="The first message your agent sends when a conversation starts. Keep it friendly and relevant."
              />
              <Input
                value={agent.greetingMessage}
                onChange={(event) => updateAgentField("greetingMessage", event.target.value)}
                style={{ marginTop: 6 }}
              />
            </Col>
          </Row>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FieldLabel
                label="System Prompt"
                help="Instructions that define your agent's personality, knowledge, and behavior. This is the 'brain' of your agent."
              />
              <Tooltip title="Uses AI to restructure your prompt into Google's recommended Persona → Rules → Guidelines → Guardrails format for best Live API performance.">
                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={enhancing}
                  disabled={!agent.systemPrompt.trim() || agent.systemPrompt.trim().length < 10}
                  onClick={() => void handleEnhancePrompt()}
                >
                  Enhance with AI
                </Button>
              </Tooltip>
            </div>
            <Input.TextArea
              rows={8}
              value={agent.systemPrompt}
              onChange={(event) => updateAgentField("systemPrompt", event.target.value)}
              placeholder="Describe what your agent does — then click 'Enhance with AI' to auto-structure it into best-practice format."
              style={{ marginTop: 6 }}
            />
          </div>
        </Space>
      </Card>

      <Card
        title="Capabilities"
        extra={
          <Link href="/apps">
            <Button type="link" size="small" icon={<LinkOutlined />}>
              Manage Apps
            </Button>
          </Link>
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <div>
            <FieldLabel
              label="Tools"
              help="Select connected apps for this agent. Connect more apps from the Apps page."
            />
            <Select
              mode="multiple"
              value={agent.tools}
              onChange={(values) => updateAgentField("tools", values as string[])}
              style={{ width: "100%", marginTop: 6 }}
              optionLabelProp="label"
              loading={integrationsLoading}
              notFoundContent={
                integrationsLoading ? "Loading apps..." : (
                  <Space direction="vertical" size={4} style={{ padding: 8, textAlign: "center" }}>
                    <Typography.Text type="secondary">No apps connected</Typography.Text>
                    <Link href="/apps">
                      <Button type="primary" size="small">Connect Apps</Button>
                    </Link>
                  </Space>
                )
              }
            >
              {/* Connected apps - selectable */}
              {connectedApps.length > 0 && (
                <Select.OptGroup label="Connected Apps">
                  {connectedApps.map((app) => (
                    <Select.Option
                      key={app.appName}
                      value={app.appName}
                      label={
                        <Space>
                          <Avatar size={16} src={app.logo} icon={<ApiOutlined />} />
                          {app.displayName}
                        </Space>
                      }
                    >
                      <Space>
                        <Avatar size={24} src={app.logo} icon={<ApiOutlined />} />
                        <div>
                          <span>{app.displayName}</span>
                          <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>Connected</Tag>
                        </div>
                      </Space>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              )}
              {/* Not connected apps - disabled with hint */}
              {notConnectedApps.length > 0 && (
                <Select.OptGroup label="Available (connect to enable)">
                  {notConnectedApps.slice(0, 10).map((app) => (
                    <Select.Option
                      key={app.appName}
                      value={app.appName}
                      disabled
                      label={app.displayName}
                    >
                      <Space style={{ opacity: 0.5 }}>
                        <Avatar size={24} src={app.logo} icon={<ApiOutlined />} />
                        <div>
                          <span>{app.displayName}</span>
                          <Tag color="default" style={{ marginLeft: 8, fontSize: 10 }}>Not connected</Tag>
                        </div>
                      </Space>
                    </Select.Option>
                  ))}
                  {notConnectedApps.length > 10 && (
                    <Select.Option key="more" value="__more__" disabled>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        +{notConnectedApps.length - 10} more apps available in Apps page
                      </Typography.Text>
                    </Select.Option>
                  )}
                </Select.OptGroup>
              )}
              {/* Fallback to static options if no integrations loaded */}
              {integrations.length === 0 && !integrationsLoading && TOOL_OPTIONS.map((tool) => (
                <Select.Option
                  key={tool.key}
                  value={tool.key}
                  label={
                    <Space>
                      <Avatar size={16} src={tool.icon} />
                      {tool.label}
                    </Space>
                  }
                >
                  <Space>
                    <Avatar size={24} src={tool.icon} />
                    <span>{tool.label}</span>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel
              label="Channels"
              help="Where your agent can interact with users: web chat, voice calls, phone, WhatsApp, etc."
            />
            <Select
              mode="multiple"
              value={agent.channels}
              onChange={(values) => updateAgentField("channels", values as ChannelKey[])}
              style={{ width: "100%", marginTop: 6 }}
              optionLabelProp="label"
            >
              {CHANNEL_OPTIONS.map((channel) => (
                <Select.Option
                  key={channel.key}
                  value={channel.key}
                  disabled={Boolean(channel.comingSoon)}
                  label={
                    <Space>
                      <Avatar size={16} src={channel.icon} />
                      {channel.comingSoon ? `${channel.label} (Coming soon)` : channel.label}
                    </Space>
                  }
                >
                  <Space>
                    <Avatar size={24} src={channel.icon} />
                    <div>
                      <span style={{ opacity: channel.comingSoon ? 0.5 : 1 }}>
                        {channel.label}
                        {channel.comingSoon && <Tag color="default" style={{ marginLeft: 8 }}>Soon</Tag>}
                      </span>
                      <br />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {channel.description}
                      </Typography.Text>
                    </div>
                  </Space>
                </Select.Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      {/* Phone Number Assignment — shown only when phone channel is enabled */}
      {agent.channels.includes("phone") && (
        <Card
          title={
            <Space>
              <PhoneOutlined style={{ color: "#17DEBC" }} />
              <span>Phone Number</span>
            </Space>
          }
          extra={
            assignedNumber ? (
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                loading={assigning}
                onClick={() => void handleAssignPhone(null)}
              >
                Remove
              </Button>
            ) : null
          }
        >
          {assignedNumber ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircleOutlined style={{ color: "#17DEBC", fontSize: 20 }} />
              <div>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {assignedNumber.displayLabel ?? assignedNumber.number}
                </Typography.Text>
                {assignedNumber.displayLabel && (
                  <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                    {assignedNumber.number}
                  </Typography.Text>
                )}
                <Typography.Text
                  style={{ display: "block", fontSize: 11, color: "#17DEBC", marginTop: 2 }}
                >
                  Inbound calls to this number will be answered by this agent
                </Typography.Text>
              </div>
            </div>
          ) : (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <FieldLabel
                label="Assign a phone number"
                help="When someone calls this number, this agent will automatically answer and handle the conversation."
              />
              {phoneNumbers.length === 0 && !phoneLoading ? (
                <div style={{ padding: "12px 0" }}>
                  <Typography.Text type="secondary">
                    No phone numbers provisioned.{" "}
                    <Typography.Link href="/numbers">Go to Numbers page</Typography.Link>
                    {" "}to add one.
                  </Typography.Text>
                </div>
              ) : (
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  placeholder="Select a phone number..."
                  loading={phoneLoading || assigning}
                  disabled={assigning}
                  onChange={(value: string) => void handleAssignPhone(value)}
                  options={phoneNumbers
                    .filter((pn) => !pn.agentId || pn.agentId === agent.id)
                    .map((pn) => ({
                      value: pn.id,
                      label: pn.displayLabel
                        ? `${pn.displayLabel} — ${pn.number}`
                        : pn.number,
                    }))}
                />
              )}
            </Space>
          )}
        </Card>
      )}
    </Space>
  );
}
