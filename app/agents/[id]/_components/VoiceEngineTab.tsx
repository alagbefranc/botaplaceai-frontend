"use client";

import {
  InfoCircleOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Col,
  Input,
  InputNumber,
  Row,
  Select,
  Slider,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { VoiceEngineConfig } from "@/lib/domain/agent-builder";
import {
  VOICE_ENGINE_OPTIONS,
  OPENAI_REALTIME_VOICE_OPTIONS,
  MIX_STT_OPTIONS,
  MIX_LLM_OPTIONS,
  MIX_TTS_OPTIONS,
} from "@/lib/domain/agent-builder";
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

export function VoiceEngineTab({ agent, updateVoiceEngine }: TabProps) {
  const ve = agent.voiceEngine;
  const engine = ve.engine;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Engine Selector */}
      <Card
        title={
          <Space>
            <SoundOutlined />
            <span>Voice Engine</span>
            <Tag color="blue">Provider Abstraction</Tag>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Choose how your agent processes voice. Each engine has different
          latency, quality, and flexibility trade-offs.
        </Typography.Paragraph>

        <Row gutter={[16, 16]}>
          {VOICE_ENGINE_OPTIONS.map((opt) => (
            <Col key={opt.key} span={8}>
              <Card
                hoverable
                size="small"
                onClick={() => updateVoiceEngine({ engine: opt.key })}
                style={{
                  border:
                    engine === opt.key
                      ? "2px solid #1677ff"
                      : "1px solid #d9d9d9",
                  cursor: "pointer",
                }}
              >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space>
                    <img
                      src={opt.icon}
                      alt={opt.label}
                      width={20}
                      height={20}
                      style={{ objectFit: "contain" }}
                    />
                    <Typography.Text strong>{opt.label}</Typography.Text>
                  </Space>
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 12 }}
                  >
                    {opt.description}
                  </Typography.Text>
                  <Space size={4} wrap>
                    {opt.providers.map((p) => (
                      <Tag key={p} style={{ fontSize: 10, margin: 0 }}>
                        {p}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Gemini Live — no extra config needed (uses Live API Settings in Advanced) */}
      {engine === "gemini-live" && (
        <Alert
          type="info"
          showIcon
          message="Gemini Live is the default engine"
          description="All Live API settings (model, VAD, thinking, etc.) are configured in the Advanced tab. This engine provides the lowest latency with native speech-to-speech."
        />
      )}

      {/* OpenAI Realtime config */}
      {engine === "openai-realtime" && (
        <Card
          title={
            <Space>
              <ThunderboltOutlined />
              <span>OpenAI Realtime Settings</span>
            </Space>
          }
        >
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Alert
              type="warning"
              showIcon
              message="Requires OPENAI_API_KEY"
              description="Set the OPENAI_API_KEY environment variable on the server to use this engine."
              style={{ marginBottom: 8 }}
            />

            <Row gutter={12}>
              <Col span={12}>
                <FieldLabel
                  label="Model"
                  help="OpenAI Realtime model to use for speech-to-speech."
                />
                <Select
                  value={ve.openaiModel || "gpt-4o-realtime-preview"}
                  onChange={(v) => updateVoiceEngine({ openaiModel: v })}
                  style={{ width: "100%" }}
                  options={[
                    {
                      value: "gpt-4o-realtime-preview",
                      label: "GPT-4o Realtime Preview",
                    },
                    {
                      value: "gpt-4o-mini-realtime-preview",
                      label: "GPT-4o Mini Realtime Preview",
                    },
                  ]}
                />
              </Col>
              <Col span={12}>
                <FieldLabel
                  label="Voice"
                  help="Voice persona for the OpenAI Realtime engine."
                />
                <Select
                  value={ve.openaiVoice || "alloy"}
                  onChange={(v) => updateVoiceEngine({ openaiVoice: v })}
                  style={{ width: "100%" }}
                  options={OPENAI_REALTIME_VOICE_OPTIONS.map((v) => ({
                    value: v.key,
                    label: `${v.label} — ${v.description}`,
                  }))}
                />
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={8}>
                <FieldLabel
                  label="Turn Detection"
                  help="How the model detects when the user stops speaking."
                />
                <Select
                  value={ve.openaiTurnDetection || "server_vad"}
                  onChange={(v) => updateVoiceEngine({ openaiTurnDetection: v })}
                  style={{ width: "100%" }}
                  options={[
                    { value: "server_vad", label: "Server VAD" },
                    { value: "semantic_vad", label: "Semantic VAD" },
                  ]}
                />
              </Col>
              <Col span={8}>
                <FieldLabel
                  label="Temperature"
                  help="Randomness of responses (0 = deterministic, 1 = creative)."
                />
                <Slider
                  min={0}
                  max={1.2}
                  step={0.1}
                  value={ve.openaiTemperature ?? 0.8}
                  onChange={(v) => updateVoiceEngine({ openaiTemperature: v })}
                />
              </Col>
              <Col span={8}>
                <FieldLabel
                  label="VAD Silence (ms)"
                  help="Duration of silence before the model responds."
                />
                <InputNumber
                  value={ve.openaiVadSilenceDurationMs ?? 500}
                  onChange={(v) =>
                    updateVoiceEngine({
                      openaiVadSilenceDurationMs: v ?? 500,
                    })
                  }
                  min={200}
                  max={3000}
                  step={100}
                  style={{ width: "100%" }}
                  addonAfter="ms"
                />
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <FieldLabel
                  label="Input Audio Format"
                  help="Audio encoding for input. PCM16 for browsers, G.711 for telephony."
                />
                <Select
                  value={ve.openaiInputAudioFormat || "pcm16"}
                  onChange={(v) =>
                    updateVoiceEngine({ openaiInputAudioFormat: v })
                  }
                  style={{ width: "100%" }}
                  options={[
                    { value: "pcm16", label: "PCM 16-bit (default)" },
                    { value: "g711_ulaw", label: "G.711 \u03BC-law (telephony)" },
                    { value: "g711_alaw", label: "G.711 A-law" },
                  ]}
                />
              </Col>
              <Col span={12}>
                <FieldLabel
                  label="Output Audio Format"
                  help="Audio encoding for output."
                />
                <Select
                  value={ve.openaiOutputAudioFormat || "pcm16"}
                  onChange={(v) =>
                    updateVoiceEngine({ openaiOutputAudioFormat: v })
                  }
                  style={{ width: "100%" }}
                  options={[
                    { value: "pcm16", label: "PCM 16-bit (default)" },
                    { value: "g711_ulaw", label: "G.711 \u03BC-law (telephony)" },
                    { value: "g711_alaw", label: "G.711 A-law" },
                  ]}
                />
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      {/* Mix Mode config */}
      {engine === "mix" && (
        <Card
          title={
            <Space>
              <SwapOutlined />
              <span>Mix Mode Pipeline</span>
              <Tag color="purple">STT → LLM → TTS</Tag>
            </Space>
          }
        >
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Alert
              type="info"
              showIcon
              message="Mix Mode composes three providers"
              description="Audio from the caller is transcribed (STT), sent to an LLM for response generation, then spoken back (TTS). Higher latency than native engines but maximum flexibility."
              style={{ marginBottom: 8 }}
            />

            {/* STT Provider */}
            <Typography.Text strong>
              1. Speech-to-Text (STT)
            </Typography.Text>
            <Select
              value={ve.sttProvider || "deepgram"}
              onChange={(v) => updateVoiceEngine({ sttProvider: v })}
              style={{ width: "100%" }}
              options={MIX_STT_OPTIONS.map((o) => ({
                value: o.key,
                label: `${o.label} — ${o.description}`,
              }))}
            />

            {/* LLM Provider */}
            <Typography.Text strong>
              2. Language Model (LLM)
            </Typography.Text>
            <Row gutter={12}>
              <Col span={12}>
                <FieldLabel
                  label="Provider"
                  help="Which LLM provider to use for generating responses."
                />
                <Select
                  value={ve.llmProvider || "openai"}
                  onChange={(v) => updateVoiceEngine({ llmProvider: v })}
                  style={{ width: "100%" }}
                  options={MIX_LLM_OPTIONS.map((o) => ({
                    value: o.key,
                    label: `${o.label} — ${o.description}`,
                  }))}
                />
              </Col>
              <Col span={12}>
                <FieldLabel
                  label="Model"
                  help="Specific model name to use."
                />
                <Input
                  value={ve.llmModel || "gpt-4o"}
                  onChange={(e) =>
                    updateVoiceEngine({ llmModel: e.target.value })
                  }
                  placeholder="gpt-4o, claude-sonnet-4-20250514, gemini-2.5-flash"
                />
              </Col>
            </Row>

            {/* TTS Provider */}
            <Typography.Text strong>
              3. Text-to-Speech (TTS)
            </Typography.Text>
            <Row gutter={12}>
              <Col span={8}>
                <FieldLabel
                  label="Provider"
                  help="TTS provider for converting text responses to audio."
                />
                <Select
                  value={ve.ttsProvider || "cartesia"}
                  onChange={(v) => updateVoiceEngine({ ttsProvider: v })}
                  style={{ width: "100%" }}
                  options={MIX_TTS_OPTIONS.map((o) => ({
                    value: o.key,
                    label: `${o.label} — ${o.description}`,
                  }))}
                />
              </Col>
              <Col span={8}>
                <FieldLabel
                  label="Voice ID"
                  help="Provider-specific voice ID. Leave empty for default."
                />
                <Input
                  value={ve.ttsVoiceId || ""}
                  onChange={(e) =>
                    updateVoiceEngine({ ttsVoiceId: e.target.value })
                  }
                  placeholder="Voice ID (provider-specific)"
                />
              </Col>
              <Col span={8}>
                <FieldLabel
                  label="TTS Model"
                  help="TTS model variant, e.g. sonic-2, eleven_turbo_v2_5, tts-1."
                />
                <Input
                  value={ve.ttsModel || ""}
                  onChange={(e) =>
                    updateVoiceEngine({ ttsModel: e.target.value })
                  }
                  placeholder="sonic-2"
                />
              </Col>
            </Row>
          </Space>
        </Card>
      )}
    </Space>
  );
}
