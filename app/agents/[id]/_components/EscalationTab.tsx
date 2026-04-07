"use client";

import {
  AlertOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SoundOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Radio,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import { useRef, useState } from "react";
import {
  DEFAULT_ESCALATION_CONFIG,
  DEFAULT_ESCALATION_KEYWORDS,
  DEFAULT_HOLD_MUSIC_CONFIG,
  HOLD_MUSIC_PRESETS,
  type EscalationConfig,
  type EscalationKeyword,
  type EscalationRule,
  type HoldMusicConfig,
} from "@/lib/domain/agent-builder";
import type { TabProps } from "./types";

const { Text, Title } = Typography;

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <Space size={4}>
      <Text type="secondary">{label}</Text>
      <Tooltip title={help}>
        <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
      </Tooltip>
    </Space>
  );
}

const DEPARTMENT_OPTIONS = [
  { value: "sales", label: "Sales", color: "blue" },
  { value: "support", label: "Support", color: "green" },
  { value: "billing", label: "Billing", color: "orange" },
  { value: "technical", label: "Technical", color: "purple" },
  { value: "management", label: "Management", color: "red" },
];

const PRIORITY_OPTIONS = [
  { value: "normal", label: "Normal", color: "default" },
  { value: "high", label: "High", color: "orange" },
  { value: "urgent", label: "Urgent", color: "red" },
];

const TRIGGER_OPTIONS = [
  { value: "sentiment", label: "Negative Sentiment", icon: <WarningOutlined /> },
  { value: "keyword", label: "Trigger Keywords", icon: <AlertOutlined /> },
  { value: "retry_limit", label: "Resolution Attempts", icon: <CustomerServiceOutlined /> },
  { value: "explicit_request", label: "User Request", icon: <CustomerServiceOutlined /> },
];

export function EscalationTab({ agent, updateToolsConfig }: TabProps) {
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get escalation config with defaults
  const escalation: EscalationConfig = agent.toolsConfig.escalation || DEFAULT_ESCALATION_CONFIG;
  const holdMusic: HoldMusicConfig = agent.toolsConfig.holdMusic || DEFAULT_HOLD_MUSIC_CONFIG;

  const updateEscalation = (patch: Partial<EscalationConfig>) => {
    updateToolsConfig({
      escalation: { ...escalation, ...patch },
    });
  };

  const updateHoldMusic = (patch: Partial<HoldMusicConfig>) => {
    updateToolsConfig({
      holdMusic: { ...holdMusic, ...patch },
    });
  };

  const updateRule = (ruleId: string, patch: Partial<EscalationRule>) => {
    const updatedRules = escalation.rules.map((rule) =>
      rule.id === ruleId ? { ...rule, ...patch } : rule
    );
    updateEscalation({ rules: updatedRules });
  };

  const addKeyword = (ruleId: string) => {
    const rule = escalation.rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const newKeyword: EscalationKeyword = {
      id: `kw_${Date.now()}`,
      phrase: "",
      priority: "normal",
      department: "support",
    };

    updateRule(ruleId, {
      config: {
        ...rule.config,
        keywords: [...(rule.config.keywords || []), newKeyword],
      },
    });
  };

  const updateKeyword = (ruleId: string, keywordId: string, patch: Partial<EscalationKeyword>) => {
    const rule = escalation.rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updatedKeywords = (rule.config.keywords || []).map((kw) =>
      kw.id === keywordId ? { ...kw, ...patch } : kw
    );

    updateRule(ruleId, {
      config: { ...rule.config, keywords: updatedKeywords },
    });
  };

  const deleteKeyword = (ruleId: string, keywordId: string) => {
    const rule = escalation.rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updatedKeywords = (rule.config.keywords || []).filter((kw) => kw.id !== keywordId);
    updateRule(ruleId, {
      config: { ...rule.config, keywords: updatedKeywords },
    });
  };

  const resetToDefaults = () => {
    updateEscalation(DEFAULT_ESCALATION_CONFIG);
  };

  const playPreview = (presetId: string) => {
    const preset = HOLD_MUSIC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingPreset === presetId) {
      setPlayingPreset(null);
      return;
    }

    audioRef.current = new Audio(preset.audioUrl);
    audioRef.current.volume = holdMusic.volume / 100;
    audioRef.current.play();
    setPlayingPreset(presetId);

    audioRef.current.onended = () => setPlayingPreset(null);
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Escalation Settings Card */}
      <Card
        title={
          <Space>
            <CustomerServiceOutlined />
            <span>Live Agent Escalation</span>
            {escalation.enabled ? (
              <Tag color="green">Active</Tag>
            ) : (
              <Tag color="default">Disabled</Tag>
            )}
          </Space>
        }
        extra={
          <Button size="small" onClick={resetToDefaults}>
            Reset to Defaults
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            title="Smart Escalation"
            description="Configure when your AI agent should automatically escalate to a live human agent. Escalations are triggered based on sentiment, keywords, retry limits, or explicit user requests."
          />

          {/* Enable Toggle */}
          <Row align="middle">
            <Col span={6}>
              <FieldLabel
                label="Enable Escalation"
                help="Automatically transfer to human agents when conditions are met"
              />
            </Col>
            <Col span={18}>
              <Switch
                checked={escalation.enabled}
                onChange={(enabled) => updateEscalation({ enabled })}
              />
            </Col>
          </Row>

          {escalation.enabled && (
            <>
              <Divider style={{ margin: "12px 0" }} />

              {/* Default Settings */}
              <Row gutter={12}>
                <Col span={8}>
                  <FieldLabel label="Default Department" help="Default department for escalations" />
                  <Select
                    value={escalation.defaultDepartment}
                    onChange={(value) => updateEscalation({ defaultDepartment: value })}
                    style={{ width: "100%", marginTop: 6 }}
                    options={DEPARTMENT_OPTIONS}
                  />
                </Col>
                <Col span={8}>
                  <FieldLabel label="Default Priority" help="Default priority for escalations" />
                  <Select
                    value={escalation.defaultPriority}
                    onChange={(value) => updateEscalation({ defaultPriority: value })}
                    style={{ width: "100%", marginTop: 6 }}
                    options={PRIORITY_OPTIONS}
                  />
                </Col>
                <Col span={8}>
                  <FieldLabel label="Max Wait Time" help="Maximum seconds to wait for human agent" />
                  <InputNumber
                    value={escalation.maxWaitTimeSeconds}
                    onChange={(value) => updateEscalation({ maxWaitTimeSeconds: value || 120 })}
                    style={{ width: "100%", marginTop: 6 }}
                    min={30}
                    max={600}
                    addonAfter="sec"
                  />
                </Col>
              </Row>

              <Row align="middle">
                <Col span={8}>
                  <FieldLabel
                    label="Confirm Before Transfer"
                    help="Ask user for confirmation before transferring"
                  />
                </Col>
                <Col span={16}>
                  <Switch
                    checked={escalation.confirmBeforeTransfer}
                    onChange={(value) => updateEscalation({ confirmBeforeTransfer: value })}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: "12px 0" }} />

              {/* Escalation Rules */}
              <Title level={5} style={{ margin: 0 }}>
                Escalation Triggers
              </Title>

              <Collapse
                items={escalation.rules.map((rule) => ({
                  key: rule.id,
                  label: (
                    <Space>
                      {TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.icon}
                      <span>{TRIGGER_OPTIONS.find((t) => t.value === rule.trigger)?.label}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Switch
                          size="small"
                          checked={rule.enabled}
                          onChange={(enabled) => updateRule(rule.id, { enabled })}
                        />
                      </span>
                      {rule.enabled ? (
                        <Tag color="green" style={{ margin: 0 }}>Active</Tag>
                      ) : (
                        <Tag color="default" style={{ margin: 0 }}>Disabled</Tag>
                      )}
                    </Space>
                  ),
                  children: (
                    <Space direction="vertical" size={12} style={{ width: "100%" }}>
                      {/* Sentiment Trigger Config */}
                      {rule.trigger === "sentiment" && (
                        <Row align="middle" gutter={12}>
                          <Col span={8}>
                            <Text type="secondary">Sentiment Threshold</Text>
                          </Col>
                          <Col span={16}>
                            <Slider
                              min={-1}
                              max={0}
                              step={0.1}
                              value={rule.config.sentimentThreshold || -0.6}
                              onChange={(value) =>
                                updateRule(rule.id, {
                                  config: { ...rule.config, sentimentThreshold: value },
                                })
                              }
                              marks={{
                                [-1]: "Very Negative",
                                [-0.5]: "Negative",
                                [0]: "Neutral",
                              }}
                            />
                          </Col>
                        </Row>
                      )}

                      {/* Retry Limit Config */}
                      {rule.trigger === "retry_limit" && (
                        <Row align="middle" gutter={12}>
                          <Col span={8}>
                            <Text type="secondary">Max Resolution Attempts</Text>
                          </Col>
                          <Col span={16}>
                            <InputNumber
                              min={1}
                              max={10}
                              value={rule.config.maxRetries || 3}
                              onChange={(value) =>
                                updateRule(rule.id, {
                                  config: { ...rule.config, maxRetries: value || 3 },
                                })
                              }
                            />
                            <Text type="secondary" style={{ marginLeft: 8 }}>
                              attempts before escalating
                            </Text>
                          </Col>
                        </Row>
                      )}

                      {/* Keyword Trigger Config */}
                      {rule.trigger === "keyword" && (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <Button
                              type="dashed"
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => addKeyword(rule.id)}
                            >
                              Add Keyword
                            </Button>
                          </div>
                          {(rule.config.keywords?.length || 0) === 0 ? (
                            <Empty
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                              description="No keywords configured"
                            />
                          ) : (
                            <Table
                              size="small"
                              dataSource={rule.config.keywords}
                              rowKey="id"
                              pagination={false}
                              columns={[
                                {
                                  title: "Phrase",
                                  dataIndex: "phrase",
                                  render: (_, kw) => (
                                    <Input
                                      size="small"
                                      value={kw.phrase}
                                      placeholder="e.g., speak to manager"
                                      onChange={(e) =>
                                        updateKeyword(rule.id, kw.id, { phrase: e.target.value })
                                      }
                                    />
                                  ),
                                },
                                {
                                  title: "Priority",
                                  dataIndex: "priority",
                                  width: 120,
                                  render: (_, kw) => (
                                    <Select
                                      size="small"
                                      value={kw.priority}
                                      style={{ width: "100%" }}
                                      onChange={(value) =>
                                        updateKeyword(rule.id, kw.id, { priority: value })
                                      }
                                      options={PRIORITY_OPTIONS}
                                    />
                                  ),
                                },
                                {
                                  title: "Department",
                                  dataIndex: "department",
                                  width: 130,
                                  render: (_, kw) => (
                                    <Select
                                      size="small"
                                      value={kw.department}
                                      style={{ width: "100%" }}
                                      onChange={(value) =>
                                        updateKeyword(rule.id, kw.id, { department: value })
                                      }
                                      options={DEPARTMENT_OPTIONS}
                                    />
                                  ),
                                },
                                {
                                  title: "",
                                  width: 40,
                                  render: (_, kw) => (
                                    <Popconfirm
                                      title="Delete keyword?"
                                      onConfirm={() => deleteKeyword(rule.id, kw.id)}
                                    >
                                      <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                      />
                                    </Popconfirm>
                                  ),
                                },
                              ]}
                            />
                          )}
                        </>
                      )}

                      {/* Custom Message */}
                      <div>
                        <Text type="secondary">Custom Message (optional)</Text>
                        <Input.TextArea
                          value={rule.action.message || ""}
                          onChange={(e) =>
                            updateRule(rule.id, {
                              action: { ...rule.action, message: e.target.value },
                            })
                          }
                          placeholder="Message to say before transferring..."
                          rows={2}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      {/* Action Config */}
                      <Row gutter={12}>
                        <Col span={12}>
                          <Text type="secondary">Escalate to Department</Text>
                          <Select
                            value={rule.action.department}
                            onChange={(value) =>
                              updateRule(rule.id, {
                                action: { ...rule.action, department: value },
                              })
                            }
                            style={{ width: "100%", marginTop: 4 }}
                            options={DEPARTMENT_OPTIONS}
                          />
                        </Col>
                        <Col span={12}>
                          <Text type="secondary">Priority</Text>
                          <Select
                            value={rule.action.priority}
                            onChange={(value) =>
                              updateRule(rule.id, {
                                action: { ...rule.action, priority: value },
                              })
                            }
                            style={{ width: "100%", marginTop: 4 }}
                            options={PRIORITY_OPTIONS}
                          />
                        </Col>
                      </Row>
                    </Space>
                  ),
                }))}
              />
            </>
          )}
        </Space>
      </Card>

      {/* Hold Music Card */}
      <Card
        title={
          <Space>
            <SoundOutlined />
            <span>Hold Music</span>
            {holdMusic.enabled ? (
              <Tag color="green">Active</Tag>
            ) : (
              <Tag color="default">Disabled</Tag>
            )}
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            title="Professional Hold Experience"
            description="Play music while users wait to be connected to a live agent. Choose from preset tracks or upload your own."
          />

          {/* Enable Toggle */}
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable Hold Music" help="Play music during transfers" />
            </Col>
            <Col span={18}>
              <Switch
                checked={holdMusic.enabled}
                onChange={(enabled) => updateHoldMusic({ enabled })}
              />
            </Col>
          </Row>

          {holdMusic.enabled && (
            <>
              <Divider style={{ margin: "12px 0" }} />

              {/* Music Type */}
              <div>
                <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  Music Source
                </Text>
                <Radio.Group
                  value={holdMusic.type}
                  onChange={(e) => updateHoldMusic({ type: e.target.value })}
                >
                  <Radio.Button value="preset">Preset Library</Radio.Button>
                  <Radio.Button value="custom">Custom Upload</Radio.Button>
                  <Radio.Button value="none">Silence</Radio.Button>
                </Radio.Group>
              </div>

              {/* Preset Selection */}
              {holdMusic.type === "preset" && (
                <div>
                  <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                    Select Preset
                  </Text>
                  <Row gutter={[12, 12]}>
                    {HOLD_MUSIC_PRESETS.map((preset) => (
                      <Col key={preset.id} span={8}>
                        <Card
                          size="small"
                          hoverable
                          style={{
                            borderColor:
                              holdMusic.presetId === preset.id ? "#1890ff" : undefined,
                            background:
                              holdMusic.presetId === preset.id ? "#e6f7ff" : undefined,
                          }}
                          onClick={() => updateHoldMusic({ presetId: preset.id })}
                        >
                          <Space>
                            <Button
                              type="text"
                              size="small"
                              icon={
                                playingPreset === preset.id ? (
                                  <PauseCircleOutlined />
                                ) : (
                                  <PlayCircleOutlined />
                                )
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                playPreview(preset.id);
                              }}
                            />
                            <div>
                              <Text strong>{preset.name}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {preset.description} • {preset.duration}
                              </Text>
                            </div>
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {/* Custom Upload */}
              {holdMusic.type === "custom" && (
                <div>
                  <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                    Custom Audio URL
                  </Text>
                  <Input
                    value={holdMusic.customUrl || ""}
                    onChange={(e) => updateHoldMusic({ customUrl: e.target.value })}
                    placeholder="https://example.com/hold-music.mp3"
                    addonBefore={<SoundOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                    Supported formats: MP3, WAV, OGG. Recommended length: 2-5 minutes.
                  </Text>
                </div>
              )}

              <Divider style={{ margin: "12px 0" }} />

              {/* Volume */}
              <Row align="middle" gutter={12}>
                <Col span={4}>
                  <Text type="secondary">Volume</Text>
                </Col>
                <Col span={16}>
                  <Slider
                    min={0}
                    max={100}
                    value={holdMusic.volume}
                    onChange={(value) => updateHoldMusic({ volume: value })}
                  />
                </Col>
                <Col span={4}>
                  <Text>{holdMusic.volume}%</Text>
                </Col>
              </Row>

              {/* Announcements */}
              <Row align="middle">
                <Col span={8}>
                  <FieldLabel
                    label="Position Announcements"
                    help="Announce queue position periodically"
                  />
                </Col>
                <Col span={16}>
                  <Switch
                    checked={holdMusic.loopAnnouncement}
                    onChange={(value) => updateHoldMusic({ loopAnnouncement: value })}
                  />
                </Col>
              </Row>

              {holdMusic.loopAnnouncement && (
                <Row align="middle" gutter={12}>
                  <Col span={8}>
                    <Text type="secondary">Announcement Interval</Text>
                  </Col>
                  <Col span={16}>
                    <InputNumber
                      value={holdMusic.announcementIntervalSeconds}
                      onChange={(value) =>
                        updateHoldMusic({ announcementIntervalSeconds: value || 30 })
                      }
                      min={15}
                      max={120}
                      addonAfter="seconds"
                    />
                  </Col>
                </Row>
              )}

              <Row align="middle">
                <Col span={8}>
                  <FieldLabel
                    label="Estimated Wait Time"
                    help="Announce estimated wait time to callers"
                  />
                </Col>
                <Col span={16}>
                  <Switch
                    checked={holdMusic.estimatedWaitMessage}
                    onChange={(value) => updateHoldMusic({ estimatedWaitMessage: value })}
                  />
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>
    </Space>
  );
}
