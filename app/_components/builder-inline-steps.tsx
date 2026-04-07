"use client";

import { PauseCircleOutlined, PlayCircleOutlined, ThunderboltOutlined } from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Flex,
  Input,
  InputNumber,
  Row,
  Col,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LIVE_API_CONFIG,
  CHANNEL_OPTIONS,
  TOOL_OPTIONS,
  VOICE_OPTIONS,
  type ChannelKey,
  type LiveApiConfig,
  type LiveApiMediaResolution,
  type LiveApiModel,
  type LiveApiTurnCoverage,
} from "@/lib/domain/agent-builder";

interface PersonalityStepCardProps {
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
}

interface VoiceStepCardProps {
  selectedVoice: string;
  onSelect: (voice: string) => void;
  onContinue: () => void;
}

interface ToolStepCardProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
  onConnectApps: () => void;
  onContinue: () => void;
}

interface ChannelStepCardProps {
  selectedChannels: ChannelKey[];
  onToggle: (channel: ChannelKey) => void;
  onContinue: () => void;
}

interface LiveCapabilitiesStepCardProps {
  config: LiveApiConfig;
  onChange: (config: Partial<LiveApiConfig>) => void;
  onContinue: () => void;
}

interface SummaryStepCardProps {
  name: string;
  systemPrompt: string;
  voice: string;
  channels: string[];
  tools: string[];
  liveApi: LiveApiConfig;
  knowledgeLabel: string;
  onSaveDeploy: () => void;
  deploying?: boolean;
}

const liveModelOptions: Array<{ value: LiveApiModel; label: string; recommended?: boolean }> = [
  { value: "gemini-3.1-flash-live-preview", label: "Gemini 3.1 Flash Live (Recommended)", recommended: true },
  { value: "gemini-2.5-flash-native-audio-preview-12-2025", label: "Gemini 2.5 Flash Live (Legacy)", recommended: false },
];

const turnCoverageOptions: Array<{ value: LiveApiTurnCoverage; label: string }> = [
  {
    value: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
    label: "Audio activity + all video",
  },
  {
    value: "TURN_INCLUDES_ONLY_ACTIVITY",
    label: "Detected activity only",
  },
];

const mediaResolutionOptions: Array<{ value: LiveApiMediaResolution; label: string }> = [
  { value: "MEDIA_RESOLUTION_LOW", label: "Low" },
  { value: "MEDIA_RESOLUTION_MEDIUM", label: "Medium" },
  { value: "MEDIA_RESOLUTION_HIGH", label: "High" },
];

const voicePreviewPrompt = "Hello! I am your AI assistant. I can help customers quickly and naturally.";

export function PersonalityStepCard({ value, onChange, onContinue }: PersonalityStepCardProps) {
  const [promptValue, setPromptValue] = useState(value);
  const [enhancing, setEnhancing] = useState(false);

  const enhancePrompt = useCallback(async () => {
    if (!promptValue.trim() || promptValue.trim().length < 10) return;
    setEnhancing(true);
    try {
      const res = await fetch("/api/agents/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptValue }),
      });
      const data = (await res.json()) as { enhanced?: string; error?: string };
      if (!res.ok || !data.enhanced) {
        throw new Error(data.error ?? "Enhancement failed.");
      }
      setPromptValue(data.enhanced);
      onChange(data.enhanced);
    } catch {
      // Silently fail in builder — the user can still continue
    } finally {
      setEnhancing(false);
    }
  }, [promptValue, onChange]);

  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography.Text strong>Define your assistant personality and prompt</Typography.Text>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            loading={enhancing}
            disabled={!promptValue.trim() || promptValue.trim().length < 10}
            onClick={() => void enhancePrompt()}
          >
            Enhance with AI
          </Button>
        </div>
        <Input.TextArea
          value={promptValue}
          onChange={(event) => {
            const nextValue = event.target.value;
            setPromptValue(nextValue);
            onChange(nextValue);
          }}
          autoSize={{ minRows: 4, maxRows: 12 }}
          placeholder="Describe what your agent does — e.g. 'Friendly support specialist that resolves orders, billing, and account requests.'"
        />
        <Button type="primary" onClick={onContinue} disabled={!promptValue.trim()}>
          Continue
        </Button>
      </Space>
    </Card>
  );
}

export function LiveCapabilitiesStepCard({ config, onChange, onContinue }: LiveCapabilitiesStepCardProps) {
  const isGemini31 = config.model === "gemini-3.1-flash-live-preview";

  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Text strong>Live API Capabilities</Typography.Text>

        <Row gutter={12}>
          <Col span={24}>
            <Typography.Text type="secondary">Model</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={config.model}
              options={liveModelOptions}
              onChange={(value) => {
                const nextModel = value as LiveApiModel;
                onChange({
                  model: nextModel,
                  turnCoverage:
                    nextModel === "gemini-3.1-flash-live-preview"
                      ? "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO"
                      : "TURN_INCLUDES_ONLY_ACTIVITY",
                });
              }}
            />
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Typography.Text type="secondary">Thinking level</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={config.thinkingLevel}
              options={[
                { value: "minimal", label: "Minimal" },
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
              ]}
              onChange={(value) => onChange({ thinkingLevel: value as LiveApiConfig["thinkingLevel"] })}
            />
          </Col>
          <Col span={12}>
            <Typography.Text type="secondary">Thinking budget (2.5)</Typography.Text>
            <InputNumber
              style={{ width: "100%", marginTop: 6 }}
              min={0}
              max={8192}
              step={128}
              value={config.thinkingBudget}
              onChange={(value) => onChange({ thinkingBudget: Number(value ?? DEFAULT_LIVE_API_CONFIG.thinkingBudget) })}
            />
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Typography.Text type="secondary">Turn coverage</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={config.turnCoverage}
              options={turnCoverageOptions}
              onChange={(value) => onChange({ turnCoverage: value as LiveApiTurnCoverage })}
            />
          </Col>
          <Col span={12}>
            <Typography.Text type="secondary">Media resolution</Typography.Text>
            <Select
              style={{ width: "100%", marginTop: 6 }}
              value={config.mediaResolution}
              options={mediaResolutionOptions}
              onChange={(value) => onChange({ mediaResolution: value as LiveApiMediaResolution })}
            />
          </Col>
        </Row>

        <Card size="small" title="Transcription & Thoughts">
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Input audio transcription</Typography.Text>
              <Switch
                checked={config.inputAudioTranscription}
                onChange={(checked) => onChange({ inputAudioTranscription: checked })}
              />
            </Space>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Output audio transcription</Typography.Text>
              <Switch
                checked={config.outputAudioTranscription}
                onChange={(checked) => onChange({ outputAudioTranscription: checked })}
              />
            </Space>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Include thought summaries</Typography.Text>
              <Switch
                checked={config.includeThoughts}
                onChange={(checked) => onChange({ includeThoughts: checked })}
              />
            </Space>
          </Space>
        </Card>

        <Card size="small" title="Voice Activity Detection (VAD)">
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Automatic VAD</Typography.Text>
              <Switch
                checked={config.automaticVad}
                onChange={(checked) => onChange({ automaticVad: checked })}
              />
            </Space>

            {config.automaticVad && (
              <Row gutter={12}>
                <Col span={12}>
                  <Typography.Text type="secondary">Start sensitivity</Typography.Text>
                  <Select
                    style={{ width: "100%", marginTop: 6 }}
                    value={config.vadStartSensitivity}
                    options={[
                      { value: "START_SENSITIVITY_LOW", label: "Low" },
                      { value: "START_SENSITIVITY_HIGH", label: "High" },
                    ]}
                    onChange={(value) => onChange({ vadStartSensitivity: value as LiveApiConfig["vadStartSensitivity"] })}
                  />
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">End sensitivity</Typography.Text>
                  <Select
                    style={{ width: "100%", marginTop: 6 }}
                    value={config.vadEndSensitivity}
                    options={[
                      { value: "END_SENSITIVITY_LOW", label: "Low" },
                      { value: "END_SENSITIVITY_HIGH", label: "High" },
                    ]}
                    onChange={(value) => onChange({ vadEndSensitivity: value as LiveApiConfig["vadEndSensitivity"] })}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 10 }}>
                  <Typography.Text type="secondary">Prefix padding (ms)</Typography.Text>
                  <InputNumber
                    style={{ width: "100%", marginTop: 6 }}
                    min={0}
                    max={3000}
                    value={config.vadPrefixPaddingMs}
                    onChange={(value) => onChange({ vadPrefixPaddingMs: Number(value ?? 0) })}
                  />
                </Col>
                <Col span={12} style={{ marginTop: 10 }}>
                  <Typography.Text type="secondary">Silence duration (ms)</Typography.Text>
                  <InputNumber
                    style={{ width: "100%", marginTop: 6 }}
                    min={50}
                    max={5000}
                    value={config.vadSilenceDurationMs}
                    onChange={(value) => onChange({ vadSilenceDurationMs: Number(value ?? 700) })}
                  />
                </Col>
              </Row>
            )}
          </Space>
        </Card>

        <Card size="small" title="Advanced">
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Initial history in client content</Typography.Text>
              <Switch
                checked={config.initialHistoryInClientContent}
                onChange={(checked) => onChange({ initialHistoryInClientContent: checked })}
              />
            </Space>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Proactive audio (2.5 only)</Typography.Text>
              <Switch
                checked={config.proactiveAudio}
                disabled={isGemini31}
                onChange={(checked) => onChange({ proactiveAudio: checked })}
              />
            </Space>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Text>Affective dialog (2.5 only)</Typography.Text>
              <Switch
                checked={config.enableAffectiveDialog}
                disabled={isGemini31}
                onChange={(checked) => onChange({ enableAffectiveDialog: checked })}
              />
            </Space>
          </Space>
        </Card>

        {isGemini31 && (
          <Alert
            type="info"
            showIcon
            message="Gemini 3.1 Live notes"
            description="Proactive audio and affective dialog are not supported on 3.1 Live preview. Thinking level is applied, while thinking budget is used only for 2.5 compatibility mode."
          />
        )}

        <Button type="primary" onClick={onContinue}>
          Continue
        </Button>
      </Space>
    </Card>
  );
}

export function VoiceStepCard({ selectedVoice, onSelect, onContinue }: VoiceStepCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeVoice, setActiveVoice] = useState(selectedVoice);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const previewRequestRef = useRef(0);

  const visibleVoices = useMemo(() => (showAll ? VOICE_OPTIONS : VOICE_OPTIONS.slice(0, 6)), [showAll]);

  useEffect(() => {
    setActiveVoice(selectedVoice);
  }, [selectedVoice]);

  const stopPreview = (clearState = true) => {
    previewRequestRef.current += 1;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (clearState) {
      setPlayingVoice(null);
      setLoadingVoice(null);
    }
  };

  useEffect(() => {
    return () => {
      stopPreview(false);
    };
  }, []);

  const handlePreview = async (voiceName: string) => {
    if (playingVoice === voiceName) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewError(null);
    setLoadingVoice(voiceName);

    const requestId = previewRequestRef.current;

    try {
      const response = await fetch("/api/voices/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voice: voiceName,
          text: voicePreviewPrompt,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || "Unable to generate a voice preview right now.");
      }

      if (requestId !== previewRequestRef.current) {
        return;
      }

      const previewBlob = await response.blob();
      if (previewBlob.size === 0) {
        throw new Error("Voice preview returned empty audio.");
      }

      const objectUrl = URL.createObjectURL(previewBlob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      setPlayingVoice(voiceName);

      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }

        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }

        setPlayingVoice((previous) => (previous === voiceName ? null : previous));
      };

      await audio.play();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate voice preview.";
      setPreviewError(message);
      setPlayingVoice(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    } finally {
      setLoadingVoice((previous) => (previous === voiceName ? null : previous));
    }
  };

  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        <Typography.Text strong>Pick a voice for your agent</Typography.Text>
        <Typography.Text type="secondary">Tap play to hear each voice before choosing.</Typography.Text>

        <div className="voice-grid">
          {visibleVoices.map((voice) => {
            const selected = activeVoice === voice.name;
            const isPlaying = playingVoice === voice.name;
            const isLoading = loadingVoice === voice.name;

            return (
              <button
                key={voice.name}
                type="button"
                className={`voice-card ${selected ? "voice-card-selected" : ""}`}
                onClick={() => {
                  setActiveVoice(voice.name);
                  onSelect(voice.name);
                }}
              >
                <div className="voice-card-head">
                  <Button
                    size="small"
                    type={isPlaying ? "primary" : "default"}
                    icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    loading={isLoading}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handlePreview(voice.name);
                    }}
                  />
                  <Typography.Text strong>{voice.name}</Typography.Text>
                </div>
                <Typography.Text type="secondary">{voice.description}</Typography.Text>
              </button>
            );
          })}
        </div>

        {previewError && (
          <Alert type="warning" showIcon message={previewError} />
        )}

        <Button type="link" onClick={() => setShowAll((prev) => !prev)}>
          {showAll ? "Show fewer voices" : "Show all 30 voices"}
        </Button>

        <Button type="primary" onClick={onContinue}>
          Continue
        </Button>
      </Space>
    </Card>
  );
}

export function ToolStepCard({ selectedTools, onToolsChange, onConnectApps, onContinue }: ToolStepCardProps) {
  const [tools, setTools] = useState<string[]>(selectedTools);

  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        <Typography.Text strong>What should your agent be able to do?</Typography.Text>

        <Checkbox.Group
          value={tools}
          onChange={(next) => {
            const nextTools = next.map((item) => String(item));
            setTools(nextTools);
            onToolsChange(nextTools);
          }}
          style={{ width: "100%" }}
        >
          <Flex vertical gap={8}>
            {TOOL_OPTIONS.map((tool) => (
              <Checkbox key={tool.key} value={tool.key}>
                {tool.label}
              </Checkbox>
            ))}
          </Flex>
        </Checkbox.Group>

        <Space wrap>
          <Button onClick={onConnectApps}>Connect Selected Apps</Button>
          <Button type="primary" onClick={onContinue}>
            Continue
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

export function ChannelStepCard({ selectedChannels, onToggle, onContinue }: ChannelStepCardProps) {
  const [channels, setChannels] = useState<ChannelKey[]>(selectedChannels);

  const handleToggle = (channel: ChannelKey) => {
    setChannels((previous) => {
      if (previous.includes(channel)) {
        return previous.filter((item) => item !== channel);
      }

      return [...previous, channel];
    });
    onToggle(channel);
  };

  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        <Typography.Text strong>Where should this agent be available?</Typography.Text>

        <div className="channel-select-grid">
          {CHANNEL_OPTIONS.map((channel) => {
            const selected = channels.includes(channel.key);
            return (
              <div key={channel.key} className={`channel-select-card ${selected ? "channel-select-card-on" : ""}`}>
                <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
                  <div>
                    <Typography.Text strong>{channel.label}</Typography.Text>
                    <br />
                    <Typography.Text type="secondary">{channel.description}</Typography.Text>
                  </div>

                  {channel.comingSoon ? (
                    <Badge color="orange" text="Coming soon" />
                  ) : (
                    <Switch checked={selected} onChange={() => handleToggle(channel.key)} />
                  )}
                </Space>
              </div>
            );
          })}
        </div>

        <Button type="primary" onClick={onContinue}>
          Continue
        </Button>
      </Space>
    </Card>
  );
}

export function SummaryStepCard({
  name,
  systemPrompt,
  voice,
  channels,
  tools,
  liveApi,
  knowledgeLabel,
  onSaveDeploy,
  deploying = false,
}: SummaryStepCardProps) {
  return (
    <Card className="builder-inline-card" size="small">
      <Space orientation="vertical" size={10} style={{ width: "100%" }}>
        <Typography.Text strong>Agent Summary</Typography.Text>

        <div className="summary-list">
          <Typography.Text>
            <strong>Name:</strong> {name || "Untitled Agent"}
          </Typography.Text>
          <Typography.Text>
            <strong>Prompt:</strong> {systemPrompt || "Not configured yet"}
          </Typography.Text>
          <Typography.Text>
            <strong>Voice:</strong> {voice}
          </Typography.Text>
          <Typography.Text>
            <strong>Channels:</strong> {channels.length > 0 ? channels.join(", ") : "None selected"}
          </Typography.Text>
          <Typography.Text>
            <strong>Tools:</strong> {tools.length > 0 ? tools.join(", ") : "None selected"}
          </Typography.Text>
          <Typography.Text>
            <strong>Knowledge:</strong> {knowledgeLabel}
          </Typography.Text>
          <Typography.Text>
            <strong>Live Model:</strong> {liveApi.model}
          </Typography.Text>
          <Typography.Text>
            <strong>Thinking:</strong> {liveApi.model === "gemini-3.1-flash-live-preview" ? liveApi.thinkingLevel : `budget ${liveApi.thinkingBudget}`}
          </Typography.Text>
          <Typography.Text>
            <strong>Transcription:</strong> input {liveApi.inputAudioTranscription ? "on" : "off"}, output {liveApi.outputAudioTranscription ? "on" : "off"}
          </Typography.Text>
          <Typography.Text>
            <strong>VAD:</strong> {liveApi.automaticVad ? "automatic" : "manual"}
          </Typography.Text>
        </div>

        <Button type="primary" size="large" block onClick={onSaveDeploy} loading={deploying}>
          Save & Deploy Agent
        </Button>

        {deploying ? (
          <Space align="center">
            <Spin size="small" />
            <Typography.Text type="secondary">
              Creating your agent and preparing deployment artifacts...
            </Typography.Text>
          </Space>
        ) : null}
      </Space>
    </Card>
  );
}
