"use client";

import {
  GoogleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  RobotOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import Image from "next/image";
import type { LiveApiConfig, ChatModel, ProviderConfig } from "@/lib/domain/agent-builder";
import { CHAT_MODEL_METADATA, PROVIDER_LOGOS } from "@/lib/domain/agent-builder";
import type { TabProps } from "./types";

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

const GEMINI_NATIVE_CHAT_MODELS = ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"];

export function AdvancedTab({ agent, updateLiveApi, updateProvider }: TabProps) {
  const { liveApi, provider } = agent;
  const isGemini31 = liveApi.model === "gemini-3.1-flash-live-preview";
  const isPartnerChatModel = !GEMINI_NATIVE_CHAT_MODELS.includes(provider.chatModel);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Runtime warnings */}
      {/* Removed: affective dialog and proactive audio now work on all models */}
      {!provider.enablePartnerModels && isPartnerChatModel && (
        <Alert
          type="info"
          showIcon
          message={`Partner models are disabled — this agent will use Gemini Flash instead of the selected model (${provider.chatModel}).`}
        />
      )}
      {/* Live API Settings */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Live API Settings</span>
          </Space>
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={12}>
              <FieldLabel
                label="Model"
                help="Gemini Live model used for realtime voice/text conversation."
              />
              <Select
                value={liveApi.model}
                onChange={(model) =>
                  updateLiveApi({
                    model: model as LiveApiConfig["model"],
                    turnCoverage:
                      model === "gemini-3.1-flash-live-preview"
                        ? "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"
                        : "TURN_INCLUDES_ONLY_ACTIVITY",
                  })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "gemini-3.1-flash-live-preview", label: "Gemini 3.1 Flash Live (Recommended)" },
                  { value: "gemini-2.5-flash-preview-native-audio-dialog", label: "Gemini 2.5 Flash Native Audio Dialog" },
                  { value: "gemini-2.5-flash-exp-native-audio-thinking-dialog", label: "Gemini 2.5 Flash Thinking + Audio (Experimental)" },
                  {
                    value: "gemini-2.5-flash-native-audio-preview-12-2025",
                    label: "Gemini 2.5 Flash Live (Legacy)",
                  },
                ]}
              />
            </Col>
            <Col span={6}>
              <FieldLabel
                label="Thinking level"
                help="Controls how much reasoning effort the model applies."
              />
              <Select
                value={liveApi.thinkingLevel}
                onChange={(thinkingLevel) =>
                  updateLiveApi({ thinkingLevel: thinkingLevel as LiveApiConfig["thinkingLevel"] })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "minimal", label: "Minimal" },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                ]}
              />
            </Col>
            <Col span={6}>
              <FieldLabel
                label="Thinking budget"
                help="Max thinking tokens budget used in 2.5 compatibility mode."
              />
              <InputNumber
                value={liveApi.thinkingBudget}
                onChange={(value) => updateLiveApi({ thinkingBudget: Number(value ?? 1024) })}
                min={0}
                max={8192}
                step={128}
                style={{ width: "100%", marginTop: 6 }}
              />
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <FieldLabel
                label="Turn coverage"
                help="Controls how the model includes activity context in each turn."
              />
              <Select
                value={liveApi.turnCoverage}
                onChange={(turnCoverage) =>
                  updateLiveApi({ turnCoverage: turnCoverage as LiveApiConfig["turnCoverage"] })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  {
                    value: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
                    label: "Audio activity + all video",
                  },
                  {
                    value: "TURN_INCLUDES_ONLY_ACTIVITY",
                    label: "Detected activity only",
                  },
                ]}
              />
            </Col>
            <Col span={12}>
              <FieldLabel
                label="Media resolution"
                help="Resolution used for media signals sent to the model."
              />
              <Select
                value={liveApi.mediaResolution}
                onChange={(mediaResolution) =>
                  updateLiveApi({ mediaResolution: mediaResolution as LiveApiConfig["mediaResolution"] })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "MEDIA_RESOLUTION_LOW", label: "Low" },
                  { value: "MEDIA_RESOLUTION_MEDIUM", label: "Medium" },
                  { value: "MEDIA_RESOLUTION_HIGH", label: "High" },
                ]}
              />
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
            Audio Transcription
          </Typography.Title>
          <Row gutter={12}>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.inputAudioTranscription}
                  onChange={(inputAudioTranscription) => updateLiveApi({ inputAudioTranscription })}
                />
                <FieldLabel
                  label="Input transcription"
                  help="When enabled, user speech is transcribed into text."
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.outputAudioTranscription}
                  onChange={(outputAudioTranscription) => updateLiveApi({ outputAudioTranscription })}
                />
                <FieldLabel
                  label="Output transcription"
                  help="When enabled, model speech is returned as text transcripts."
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.includeThoughts}
                  onChange={(includeThoughts) => updateLiveApi({ includeThoughts })}
                />
                <FieldLabel
                  label="Include thoughts"
                  help="Adds model thought summaries for debugging."
                />
              </Space>
            </Col>
          </Row>

          <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
            Voice Activity Detection (VAD)
          </Typography.Title>
          <Row gutter={12}>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.automaticVad}
                  onChange={(automaticVad) => updateLiveApi({ automaticVad })}
                />
                <FieldLabel
                  label="Automatic VAD"
                  help="Automatically detect when the user starts/stops speaking."
                />
              </Space>
            </Col>
          </Row>

          {liveApi.automaticVad && (
            <Row gutter={12}>
              <Col span={6}>
                <Typography.Text type="secondary">Start Sensitivity</Typography.Text>
                <Select
                  value={liveApi.vadStartSensitivity}
                  onChange={(vadStartSensitivity) =>
                    updateLiveApi({ vadStartSensitivity: vadStartSensitivity as LiveApiConfig["vadStartSensitivity"] })
                  }
                  style={{ width: "100%", marginTop: 6 }}
                  options={[
                    { value: "START_SENSITIVITY_LOW", label: "Low" },
                    { value: "START_SENSITIVITY_HIGH", label: "High" },
                  ]}
                />
              </Col>
              <Col span={6}>
                <Typography.Text type="secondary">End Sensitivity</Typography.Text>
                <Select
                  value={liveApi.vadEndSensitivity}
                  onChange={(vadEndSensitivity) =>
                    updateLiveApi({ vadEndSensitivity: vadEndSensitivity as LiveApiConfig["vadEndSensitivity"] })
                  }
                  style={{ width: "100%", marginTop: 6 }}
                  options={[
                    { value: "END_SENSITIVITY_LOW", label: "Low" },
                    { value: "END_SENSITIVITY_HIGH", label: "High" },
                  ]}
                />
              </Col>
              <Col span={6}>
                <Typography.Text type="secondary">Prefix Padding (ms)</Typography.Text>
                <InputNumber
                  value={liveApi.vadPrefixPaddingMs}
                  onChange={(value) => updateLiveApi({ vadPrefixPaddingMs: Number(value ?? 20) })}
                  min={0}
                  max={3000}
                  style={{ width: "100%", marginTop: 6 }}
                />
              </Col>
              <Col span={6}>
                <Typography.Text type="secondary">Silence Duration (ms)</Typography.Text>
                <InputNumber
                  value={liveApi.vadSilenceDurationMs}
                  onChange={(value) => updateLiveApi({ vadSilenceDurationMs: Number(value ?? 700) })}
                  min={50}
                  max={5000}
                  style={{ width: "100%", marginTop: 6 }}
                />
              </Col>
            </Row>
          )}

          <Typography.Title level={5} style={{ marginTop: 16, marginBottom: 8 }}>
            Advanced Options
          </Typography.Title>
          <Row gutter={12}>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.proactiveAudio}
                  disabled={isGemini31}
                  onChange={(proactiveAudio) => updateLiveApi({ proactiveAudio })}
                />
                <FieldLabel
                  label="Proactive audio"
                  help="Allows audio-first proactive responses (2.5 only)."
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.enableAffectiveDialog}
                  disabled={isGemini31}
                  onChange={(enableAffectiveDialog) => updateLiveApi({ enableAffectiveDialog })}
                />
                <FieldLabel
                  label="Affective dialog"
                  help="Enables affective conversational cues (2.5 only)."
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Switch
                  checked={liveApi.initialHistoryInClientContent}
                  onChange={(initialHistoryInClientContent) =>
                    updateLiveApi({ initialHistoryInClientContent })
                  }
                />
                <FieldLabel
                  label="Initial history in client"
                  help="Include initial interaction history in client content."
                />
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Provider Keys */}
      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>AI Model Configuration</span>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Select the AI model used for text chat conversations. Voice calls always use Gemini Live API.
          Partner models (Claude, Llama) are available via Vertex AI Model Garden.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={12}>
              <FieldLabel
                label="Chat Model"
                help="Primary AI model for text conversations and function calling."
              />
              <Select
                value={provider.chatModel}
                onChange={(chatModel) =>
                  updateProvider({ chatModel: chatModel as ChatModel })
                }
                style={{ width: "100%", marginTop: 6 }}
                optionLabelProp="label"
              >
                <Select.OptGroup label={
                  <Space>
                    <Avatar size={16} src={PROVIDER_LOGOS.google} />
                    <span>Google Gemini</span>
                  </Space>
                }>
                  {Object.entries(CHAT_MODEL_METADATA)
                    .filter(([, meta]) => meta.provider === "google")
                    .map(([model, meta]) => (
                      <Select.Option key={model} value={model} label={
                        <Space>
                          <Avatar size={18} src={meta.logo} />
                          {meta.label}
                        </Space>
                      }>
                        <Space>
                          <Avatar size={24} src={meta.logo} />
                          <div>
                            <Space size={4}>
                              <span style={{ fontWeight: 500 }}>{meta.label}</span>
                              {meta.status === "current" && <Tag color="green">Recommended</Tag>}
                              {meta.status === "deprecated" && <Tag color="orange">Legacy</Tag>}
                              {meta.status === "preview" && <Tag color="blue">Preview</Tag>}
                            </Space>
                            <br />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {meta.description} • {meta.contextWindow}
                            </Typography.Text>
                          </div>
                        </Space>
                      </Select.Option>
                    ))}
                </Select.OptGroup>
                {provider.enablePartnerModels && (
                  <>
                    <Select.OptGroup label={
                      <Space>
                        <Avatar size={16} src={PROVIDER_LOGOS.anthropic} />
                        <span>Anthropic Claude (via Vertex AI)</span>
                      </Space>
                    }>
                      {Object.entries(CHAT_MODEL_METADATA)
                        .filter(([, meta]) => meta.provider === "anthropic")
                        .map(([model, meta]) => (
                          <Select.Option key={model} value={model} label={
                            <Space>
                              <Avatar size={18} src={meta.logo} />
                              {meta.label}
                            </Space>
                          }>
                            <Space>
                              <Avatar size={24} src={meta.logo} />
                              <div>
                                <Space size={4}>
                                  <span style={{ fontWeight: 500 }}>{meta.label}</span>
                                  <Tag color="purple">{meta.contextWindow}</Tag>
                                </Space>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {meta.description}
                                </Typography.Text>
                              </div>
                            </Space>
                          </Select.Option>
                        ))}
                    </Select.OptGroup>
                    <Select.OptGroup label={
                      <Space>
                        <Avatar size={16} src={PROVIDER_LOGOS.meta} />
                        <span>Meta Llama (via Vertex AI)</span>
                      </Space>
                    }>
                      {Object.entries(CHAT_MODEL_METADATA)
                        .filter(([, meta]) => meta.provider === "meta")
                        .map(([model, meta]) => (
                          <Select.Option key={model} value={model} label={
                            <Space>
                              <Avatar size={18} src={meta.logo} />
                              {meta.label}
                            </Space>
                          }>
                            <Space>
                              <Avatar size={24} src={meta.logo} />
                              <div>
                                <Space size={4}>
                                  <span style={{ fontWeight: 500 }}>{meta.label}</span>
                                  <Tag color="cyan">{meta.contextWindow}</Tag>
                                </Space>
                                <br />
                                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                  {meta.description}
                                </Typography.Text>
                              </div>
                            </Space>
                          </Select.Option>
                        ))}
                    </Select.OptGroup>
                  </>
                )}
              </Select>
            </Col>
            <Col span={12}>
              <FieldLabel
                label="Fallback Model"
                help="Model to use if the primary model fails or is unavailable."
              />
              <Select
                value={provider.fallbackModel}
                onChange={(fallbackModel) =>
                  updateProvider({ fallbackModel: fallbackModel as ChatModel })
                }
                disabled={!provider.fallbackEnabled}
                style={{ width: "100%", marginTop: 6 }}
                optionLabelProp="label"
              >
                {Object.entries(CHAT_MODEL_METADATA)
                  .filter(([model]) => model !== provider.chatModel)
                  .map(([model, meta]) => (
                    <Select.Option 
                      key={model} 
                      value={model} 
                      label={
                        <Space>
                          <Avatar size={18} src={meta.logo} />
                          {meta.label}
                        </Space>
                      }
                    >
                      <Space>
                        <Avatar size={24} src={meta.logo} />
                        <div>
                          <span style={{ fontWeight: 500 }}>{meta.label}</span>
                          <br />
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {meta.provider} • {meta.contextWindow}
                          </Typography.Text>
                        </div>
                      </Space>
                    </Select.Option>
                  ))}
              </Select>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Space>
                <Switch
                  checked={provider.enablePartnerModels}
                  onChange={(enablePartnerModels) => updateProvider({ enablePartnerModels })}
                />
                <FieldLabel
                  label="Enable partner models"
                  help="Access Claude (Anthropic) and Llama (Meta) via Vertex AI Model Garden."
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <Switch
                  checked={provider.fallbackEnabled}
                  onChange={(fallbackEnabled) => updateProvider({ fallbackEnabled })}
                />
                <FieldLabel
                  label="Enable fallback"
                  help="Automatically switch to fallback model on errors."
                />
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Provider Keys */}
      <Card
        title={
          <Space>
            <KeyOutlined />
            <span>API Keys</span>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Configure API keys for providers. Leave empty to use Vertex AI (recommended).
          Partner models (Claude, Llama) automatically use Vertex AI credentials.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Card size="small" title={<Space><GoogleOutlined /> Gemini (Google AI)</Space>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Row align="middle">
                <Col span={6}>
                  <FieldLabel label="Use Vertex AI" help="Use Vertex AI with Application Default Credentials (recommended for production)." />
                </Col>
                <Col span={18}>
                  <Switch
                    checked={provider.gemini.useDefault}
                    onChange={(useDefault) =>
                      updateProvider({
                        gemini: { ...provider.gemini, useDefault },
                      })
                    }
                  />
                </Col>
              </Row>

              {!provider.gemini.useDefault && (
                <div>
                  <Typography.Text type="secondary">Custom API Key</Typography.Text>
                  <Input.Password
                    value={provider.gemini.apiKey ?? ""}
                    onChange={(e) =>
                      updateProvider({
                        gemini: { ...provider.gemini, apiKey: e.target.value },
                      })
                    }
                    placeholder="AIza..."
                    style={{ marginTop: 6 }}
                  />
                </div>
              )}
            </Space>
          </Card>

          {provider.enablePartnerModels && (
            <Card size="small" title="Partner Models (Vertex AI)">
              <Typography.Text type="secondary">
                Claude and Llama models are accessed through Vertex AI Model Garden.
                No additional API keys required — uses your GCP project credentials.
              </Typography.Text>
            </Card>
          )}
        </Space>
      </Card>
    </Space>
  );
}
