"use client";

import { PauseCircleOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";
import { VOICE_OPTIONS } from "@/lib/domain/agent-builder";

const voicePreviewPrompt =
  "Hello! I am your AI assistant. I can help customers quickly and naturally.";

export function VoicePicker() {
  const { draft, setVoice } = useAgentBuilderStore();
  const [showAll, setShowAll] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  const displayedVoices = showAll ? VOICE_OPTIONS : VOICE_OPTIONS.slice(0, 6);

  const stopPreview = (clearState = true) => {
    requestIdRef.current += 1;

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

  const handlePlayVoice = async (voiceName: string) => {
    if (playingVoice === voiceName) {
      stopPreview();
      return;
    }

    stopPreview();
    setPreviewError(null);
    setLoadingVoice(voiceName);

    const currentRequestId = requestIdRef.current;

    try {
      const response = await fetch("/api/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: voiceName, text: voicePreviewPrompt }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error || "Unable to generate a voice preview right now.",
        );
      }

      if (currentRequestId !== requestIdRef.current) return;

      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Voice preview returned empty audio.");

      const objectUrl = URL.createObjectURL(blob);
      objectUrlRef.current = objectUrl;

      const audio = new Audio(objectUrl);
      audioRef.current = audio;
      setPlayingVoice(voiceName);

      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        if (objectUrlRef.current === objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlRef.current = null;
        }
        setPlayingVoice((prev) => (prev === voiceName ? null : prev));
      };

      await audio.play();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate voice preview.";
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
      setLoadingVoice((prev) => (prev === voiceName ? null : prev));
    }
  };

  return (
    <div className="builder-inline-card">
      <Typography.Text strong style={{ display: "block", marginBottom: 4 }}>
        Pick a voice for your agent
      </Typography.Text>
      <Typography.Text
        type="secondary"
        style={{ display: "block", marginBottom: 12, fontSize: 13 }}
      >
        Tap play to hear each voice before choosing.
      </Typography.Text>

      <div className="voice-grid">
        {displayedVoices.map((voice) => {
          const selected = draft.voice === voice.name;
          const isPlaying = playingVoice === voice.name;
          const isLoading = loadingVoice === voice.name;

          return (
            <button
              key={voice.name}
              type="button"
              className={`voice-card ${selected ? "voice-card-selected" : ""}`}
              onClick={() => setVoice(voice.name)}
            >
              <div className="voice-card-head">
                <Button
                  size="small"
                  type={isPlaying ? "primary" : "default"}
                  icon={
                    isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                  }
                  loading={isLoading}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handlePlayVoice(voice.name);
                  }}
                />
                <Typography.Text strong>{voice.name}</Typography.Text>
              </div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {voice.description}
              </Typography.Text>
            </button>
          );
        })}
      </div>

      {previewError && (
        <Alert
          type="warning"
          showIcon
          message={previewError}
          style={{ marginTop: 8 }}
        />
      )}

      <Button
        type="link"
        size="small"
        onClick={() => setShowAll((prev) => !prev)}
        style={{ marginTop: 8, padding: 0 }}
      >
        {showAll ? "Show fewer voices" : "Show all 30 voices"}
      </Button>
    </div>
  );
}
