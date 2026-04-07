"use client";

import {
  AudioOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  VOICE_OPTIONS,
  SUPPORTED_LANGUAGES,
  type CallMode,
  type PronunciationEntry,
  type DenoisingLevel,
  type TranscriberModel,
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

export function SpeechTab({ agent, updateSpeech }: TabProps) {
  const { speech } = agent;

  // Pronunciation management
  const addPronunciation = () => {
    const newEntry: PronunciationEntry = {
      id: crypto.randomUUID(),
      word: "",
      phonetic: "",
      caseSensitive: false,
    };
    updateSpeech({ pronunciation: [...speech.pronunciation, newEntry] });
  };

  const updatePronunciation = (id: string, patch: Partial<PronunciationEntry>) => {
    updateSpeech({
      pronunciation: speech.pronunciation.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    });
  };

  const removePronunciation = (id: string) => {
    updateSpeech({
      pronunciation: speech.pronunciation.filter((p) => p.id !== id),
    });
  };

  const pronunciationColumns: ColumnsType<PronunciationEntry> = [
    {
      title: "Word",
      dataIndex: "word",
      key: "word",
      width: 200,
      render: (_, record) => (
        <Input
          size="small"
          value={record.word}
          onChange={(e) => updatePronunciation(record.id, { word: e.target.value })}
          placeholder="e.g., API"
        />
      ),
    },
    {
      title: "Pronunciation",
      dataIndex: "phonetic",
      key: "phonetic",
      render: (_, record) => (
        <Input
          size="small"
          value={record.phonetic}
          onChange={(e) => updatePronunciation(record.id, { phonetic: e.target.value })}
          placeholder="e.g., A P I or ay-pee-eye"
        />
      ),
    },
    {
      title: "Case Sensitive",
      dataIndex: "caseSensitive",
      key: "caseSensitive",
      width: 120,
      render: (_, record) => (
        <Switch
          size="small"
          checked={record.caseSensitive}
          onChange={(caseSensitive) => updatePronunciation(record.id, { caseSensitive })}
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_, record) => (
        <Popconfirm
          title="Delete this entry?"
          onConfirm={() => removePronunciation(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const callMode = speech.callMode ?? "both";
  const greetings = speech.greetings ?? { inbound: "", outbound: "" };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Call Mode & Greetings */}
      <Card
        title={
          <Space>
            <SoundOutlined />
            <span>Call Mode & Greetings</span>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Configure how this agent handles phone calls and what it says when a call connects.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={8}>
              <FieldLabel
                label="Call Mode"
                help="Inbound: agent answers incoming calls. Outbound: agent makes calls (missions/dialer). Both: handles either direction."
              />
              <Select
                value={callMode}
                onChange={(value) => updateSpeech({ callMode: value as CallMode })}
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "inbound", label: "Inbound Only" },
                  { value: "outbound", label: "Outbound Only" },
                  { value: "both", label: "Both (Inbound & Outbound)" },
                ]}
              />
            </Col>
          </Row>

          {(callMode === "inbound" || callMode === "both") && (
            <div>
              <FieldLabel
                label="Inbound Greeting"
                help="How the agent greets callers who dial in. Leave blank for a default greeting. Example: 'Thank you for calling AjoPro, this is Vivian. How can I help you today?'"
              />
              <Input.TextArea
                value={greetings.inbound}
                onChange={(e) =>
                  updateSpeech({
                    greetings: { ...greetings, inbound: e.target.value },
                  })
                }
                placeholder="e.g., Thank you for calling [Company], this is [Agent]. How can I help you today?"
                rows={2}
                style={{ marginTop: 6 }}
                maxLength={500}
                showCount
              />
            </div>
          )}

          {(callMode === "outbound" || callMode === "both") && (
            <div>
              <FieldLabel
                label="Outbound Greeting"
                help="How the agent opens outbound calls. Leave blank for a default greeting. Example: 'Hi, this is Vivian from AjoPro. I'm calling about your financial goals.'"
              />
              <Input.TextArea
                value={greetings.outbound}
                onChange={(e) =>
                  updateSpeech({
                    greetings: { ...greetings, outbound: e.target.value },
                  })
                }
                placeholder="e.g., Hi, this is [Agent] from [Company]. I'm calling about..."
                rows={2}
                style={{ marginTop: 6 }}
                maxLength={500}
                showCount
              />
            </div>
          )}

          <Alert
            type="info"
            showIcon
            title="The system auto-detects call direction. Custom greetings override the default. If left blank, the agent will use a natural default greeting for that direction."
            style={{ marginTop: 4 }}
          />
        </Space>
      </Card>

      {/* Background Denoising */}
      <Card
        title={
          <Space>
            <AudioOutlined />
            <span>Background Speech Denoising</span>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Reduce background noise from user audio input for cleaner transcription and better understanding.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable denoising" help="Apply noise suppression to incoming audio." />
            </Col>
            <Col span={18}>
              <Switch
                checked={speech.denoising.enabled}
                onChange={(enabled) =>
                  updateSpeech({
                    denoising: { ...speech.denoising, enabled },
                  })
                }
              />
            </Col>
          </Row>

          {speech.denoising.enabled && (
            <Row gutter={12}>
              <Col span={8}>
                <FieldLabel label="Denoising Level" help="Low: subtle noise reduction. Medium: balanced. High: aggressive filtering for noisy environments." />
                <Select
                  value={speech.denoising.level}
                  onChange={(level) =>
                    updateSpeech({
                      denoising: { ...speech.denoising, level: level as DenoisingLevel },
                    })
                  }
                  style={{ width: "100%", marginTop: 6 }}
                  options={[
                    { value: "low", label: "Low (subtle)" },
                    { value: "medium", label: "Medium (balanced)" },
                    { value: "high", label: "High (aggressive)" },
                  ]}
                />
              </Col>
            </Row>
          )}
        </Space>
      </Card>

      {/* Pronunciation Dictionary */}
      <Card
        title={
          <Space>
            <span>Pronunciation Dictionary</span>
            <Tag color="purple">{speech.pronunciation.length}</Tag>
            <Tooltip title="Teach your agent how to pronounce brand names, acronyms, and technical terms correctly.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addPronunciation}>
            Add Entry
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Define custom pronunciations for brand names, acronyms, and technical terms.
          The agent will use the phonetic spelling when speaking these words.
        </Typography.Paragraph>

        <Table
          dataSource={speech.pronunciation}
          columns={pronunciationColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: "No custom pronunciations. Add entries for words that need special pronunciation." }}
        />
      </Card>

      {/* Voice Fallback */}
      <Card
        title={
          <Space>
            <SoundOutlined />
            <span>Voice Fallback</span>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Configure backup voices to use if the primary voice is unavailable or fails.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable fallback" help="Automatically switch to backup voice on failure." />
            </Col>
            <Col span={18}>
              <Switch
                checked={speech.voiceFallback.enabled}
                onChange={(enabled) =>
                  updateSpeech({
                    voiceFallback: { ...speech.voiceFallback, enabled },
                  })
                }
              />
            </Col>
          </Row>

          {speech.voiceFallback.enabled && (
            <div>
              <Typography.Text type="secondary">Fallback Voices (in order)</Typography.Text>
              <Select
                mode="multiple"
                value={speech.voiceFallback.fallbackVoices}
                onChange={(fallbackVoices) =>
                  updateSpeech({
                    voiceFallback: { ...speech.voiceFallback, fallbackVoices },
                  })
                }
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Select fallback voices in order of preference"
                options={VOICE_OPTIONS.filter((v) => v.name !== agent.voice).map((voice) => ({
                  value: voice.name,
                  label: `${voice.name} — ${voice.tone}`,
                }))}
              />
            </div>
          )}
          <Alert
            type="info"
            showIcon
            message="Voice fallback is informational only — the runtime will attempt these voices in order if the primary fails in a future update."
            style={{ marginTop: 12 }}
          />
        </Space>
      </Card>

      {/* Transcriber Configuration */}
      <Card
        title={
          <Space>
            <span>Transcriber Configuration</span>
            <Tooltip title="Configure how user speech is converted to text for processing.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Configure speech-to-text settings for transcribing user audio input.
        </Typography.Paragraph>

        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={8}>
              <FieldLabel label="Transcriber Model" help="The AI model used to convert speech to text. Gemini is recommended for accuracy." />
              <Select
                value={speech.transcriber.model}
                onChange={(model) =>
                  updateSpeech({
                    transcriber: { ...speech.transcriber, model: model as TranscriberModel },
                  })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "gemini", label: "Gemini (Default)" },
                  { value: "whisper", label: "Whisper (Coming Soon)", disabled: true },
                ]}
              />
            </Col>
            <Col span={8}>
              <FieldLabel label="Language Hint" help="Help the transcriber by specifying the expected language, or leave empty for auto-detection." />
              <Select
                allowClear
                value={speech.transcriber.language}
                onChange={(language) =>
                  updateSpeech({
                    transcriber: { ...speech.transcriber, language },
                  })
                }
                style={{ width: "100%", marginTop: 6 }}
                placeholder="Auto-detect"
                options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
              />
            </Col>
          </Row>

          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable fallback" help="Fall back to alternate transcriber on failure." />
            </Col>
            <Col span={18}>
              <Switch
                checked={speech.transcriber.fallbackEnabled}
                onChange={(fallbackEnabled) =>
                  updateSpeech({
                    transcriber: { ...speech.transcriber, fallbackEnabled },
                  })
                }
              />
            </Col>
          </Row>
          <Alert
            type="info"
            showIcon
            message="Transcriber model selection and language hint are used by the Gemini Live voice pipeline. The Whisper option will be available in a future update."
            style={{ marginTop: 12 }}
          />
        </Space>
      </Card>
    </Space>
  );
}
