"use client";

import { Flex, Tag, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { RadialVisualizer } from "./radial-visualizer";

interface Transcript {
  role: "user" | "assistant" | "system";
  text: string;
}

interface VoiceCallOrbProps {
  agentId: string;
  agentName?: string;
}

type CallStatus = "idle" | "connecting" | "connected" | "error";

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:4000";

/**
 * Generate a repeating hold tone using the Web Audio API.
 * Plays a soft 440Hz beep (0.5s) every 2 seconds.
 * Returns a cleanup function to stop the tone.
 */
function startHoldTone(ctx: AudioContext): () => void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 440;
  gainNode.gain.value = 0;
  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start();

  const BEEP_DURATION = 0.5;
  const BEEP_INTERVAL = 2.0;
  let nextTime = ctx.currentTime + 0.2;
  let scheduleTimer: ReturnType<typeof setTimeout>;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    while (nextTime < ctx.currentTime + 3.5) {
      gainNode.gain.setValueAtTime(0, nextTime);
      gainNode.gain.linearRampToValueAtTime(0.08, nextTime + 0.05);
      gainNode.gain.setValueAtTime(0.08, nextTime + BEEP_DURATION - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, nextTime + BEEP_DURATION);
      nextTime += BEEP_INTERVAL;
    }
    scheduleTimer = setTimeout(schedule, 1000);
  };
  schedule();

  return () => {
    stopped = true;
    clearTimeout(scheduleTimer);
    try {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      oscillator.stop();
    } catch {
      // ignore
    }
    gainNode.disconnect();
  };
}

export function VoiceCallOrb({ agentId, agentName }: VoiceCallOrbProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isOnHold, setIsOnHold] = useState(false);
  const [currentAgentName, setCurrentAgentName] = useState<string | undefined>(agentName);

  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextPlayTimeRef = useRef(0);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const queueProcessingRef = useRef(false);
  const transcriptsEndRef = useRef<HTMLDivElement | null>(null);
  /** Cleanup function returned by startHoldTone / HTML Audio stop */
  const holdMusicCleanupRef = useRef<(() => void) | null>(null);
  /** True while holding for agent transfer — ignore stale PCM from old Gemini session */
  const isHoldingRef = useRef(false);

  // Sync currentAgentName when prop changes (new call)
  useEffect(() => {
    setCurrentAgentName(agentName);
  }, [agentName]);

  const scrollToBottom = useCallback(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [transcripts, scrollToBottom]);

  // Drain the entire audio queue in one synchronous pass (official Gemini SDK pattern)
  const playAudioQueue = useCallback(() => {
    const ctx = playbackCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    queueProcessingRef.current = true;
    const target = gainNodeRef.current || ctx.destination;

    while (audioQueueRef.current.length > 0) {
      const float32 = audioQueueRef.current.shift()!;

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(new Float32Array(float32), 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(target);

      // Schedule gapless: if we've fallen behind, catch up to now
      if (nextPlayTimeRef.current < ctx.currentTime) {
        nextPlayTimeRef.current = ctx.currentTime;
      }

      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += audioBuffer.duration;
    }

    queueProcessingRef.current = false;
  }, []);

  // Convert raw PCM bytes to Float32 using byte-level conversion (official Gemini SDK pattern)
  // The server sends base64-decoded PCM: 16-bit signed little-endian, 24kHz, mono
  const scheduleAudioChunk = useCallback((rawBytes: ArrayBuffer) => {
    const bytes = new Uint8Array(rawBytes);
    const numSamples = bytes.length / 2; // 2 bytes per 16-bit sample
    const float32 = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      // Combine two bytes into one 16-bit signed integer (little-endian)
      let sample = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
      if (sample >= 32768) sample -= 65536;
      float32[i] = sample / 32768;
    }

    audioQueueRef.current.push(float32);

    if (!queueProcessingRef.current) {
      playAudioQueue();
    }
  }, [playAudioQueue]);

  const startCall = useCallback(async () => {
    setError(null);
    setTranscripts([]);
    setActiveTool(null);
    setStatus("connecting");

    try {
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 2. Create separate AudioContexts for mic and playback
      const micCtx = new AudioContext({ sampleRate: 24000 });
      micCtxRef.current = micCtx;

      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackCtxRef.current = playbackCtx;

      // Create gain node on playback context for louder output (3x)
      const gainNode = playbackCtx.createGain();
      gainNode.gain.value = 3.0;
      gainNode.connect(playbackCtx.destination);
      gainNodeRef.current = gainNode;

      // 3. Connect mic to processor on mic context
      const source = micCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Analyser for audio level visualization
      const analyser = micCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const levelData = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (micCtxRef.current?.state === "closed") return;
        analyser.getByteFrequencyData(levelData);
        const avg = levelData.reduce((sum, v) => sum + v, 0) / levelData.length;
        setAudioLevel(avg / 255);
        requestAnimationFrame(updateLevel);
      };
      requestAnimationFrame(updateLevel);

      // Silent output for ScriptProcessor (must be connected to destination to fire)
      const silentGain = micCtx.createGain();
      silentGain.gain.value = 0;
      silentGain.connect(micCtx.destination);

      // 4. Open WebSocket
      const sessionId = `voice-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const wsUrl = `${WS_BASE}/ws?type=voice_chat&agentId=${agentId}&sessionId=${sessionId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        // Start sending mic audio
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(silentGain);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary = raw PCM bytes from Gemini agent
          // Discard stale audio from the old agent while on hold
          if (isHoldingRef.current) return;
          // If hold music was playing (shouldn't be, but safety check), stop it
          if (holdMusicCleanupRef.current) {
            holdMusicCleanupRef.current();
            holdMusicCleanupRef.current = null;
            setIsOnHold(false);
          }
          scheduleAudioChunk(event.data);
        } else {
          // JSON message
          try {
            const msg = JSON.parse(event.data as string) as {
              type: string;
              transcript?: string;
              role?: "user" | "assistant";
              conversationId?: string;
              error?: string;
              tool?: string;
              status?: string;
              musicUrl?: string;
              volume?: number;
              duration?: number;
              agentId?: string;
              agentName?: string;
              greeting?: string;
            };

            switch (msg.type) {
              case "connected":
                setStatus("connected");
                break;
              case "transcript":
                if (msg.transcript && msg.role) {
                  setTranscripts((prev) => {
                    // Merge with last entry if same role (avoids rapid-fire entries)
                    const last = prev[prev.length - 1];
                    if (last && last.role === msg.role) {
                      const updated = [...prev];
                      updated[updated.length - 1] = {
                        ...last,
                        text: last.text + " " + msg.transcript!,
                      };
                      return updated;
                    }
                    return [...prev, { role: msg.role!, text: msg.transcript! }];
                  });
                }
                break;
              case "tool_action":
                setActiveTool(msg.tool || null);
                setTimeout(() => setActiveTool(null), 3000);
                break;
              case "error":
                setError(msg.error || "Voice AI error");
                break;
              case "status":
                // muted/unmuted confirmation
                break;
              case "hold_music": {
                // Stop any prior hold tone immediately
                if (holdMusicCleanupRef.current) {
                  holdMusicCleanupRef.current();
                  holdMusicCleanupRef.current = null;
                }

                // Gate: discard any future PCM from the old agent
                isHoldingRef.current = true;

                // Flush the unscheduled queue but let already-scheduled audio
                // play to completion so Agent 1 finishes speaking cleanly.
                audioQueueRef.current = [];
                setIsOnHold(true);

                // Capture how long until scheduled audio finishes, capped at 8s.
                const _ctx = playbackCtxRef.current;
                const _scheduledEnd = nextPlayTimeRef.current;
                const _drainMs =
                  _ctx && _scheduledEnd > _ctx.currentTime
                    ? Math.min(
                        (_scheduledEnd - _ctx.currentTime) * 1000 + 800,
                        8000,
                      )
                    : 600; // minimum gap before music

                // Capture message values for use inside the timeout closure
                const _musicUrl = msg.musicUrl as string | undefined;
                const _volume = msg.volume as number | undefined;

                setTimeout(() => {
                  // If the hold was cancelled (agent_changed already fired) — bail
                  if (!isHoldingRef.current) return;

                  // Reset the Web Audio timeline for the new agent later
                  nextPlayTimeRef.current = 0;

                  // Try HTML Audio (goes through Next.js CORS proxy), fall back to tone
                  if (_musicUrl && _ctx) {
                    const audio = new Audio(_musicUrl);
                    audio.loop = true;
                    audio.volume = Math.max(0, Math.min(1, (_volume ?? 50) / 100));
                    audio
                      .play()
                      .then(() => {
                        holdMusicCleanupRef.current = () => {
                          audio.pause();
                          audio.src = "";
                        };
                      })
                      .catch(() => {
                        if (_ctx && isHoldingRef.current) {
                          holdMusicCleanupRef.current = startHoldTone(_ctx);
                        }
                      });
                  } else if (_ctx) {
                    holdMusicCleanupRef.current = startHoldTone(_ctx);
                  }
                }, _drainMs);
                break;
              }
              case "stop_hold_music": {
                // Explicit signal from server to stop hold music
                isHoldingRef.current = false;
                if (holdMusicCleanupRef.current) {
                  holdMusicCleanupRef.current();
                  holdMusicCleanupRef.current = null;
                }
                setIsOnHold(false);
                break;
              }
              case "agent_changed": {
                // New agent is ready — exit hold state
                isHoldingRef.current = false;
                // Stop hold music
                if (holdMusicCleanupRef.current) {
                  holdMusicCleanupRef.current();
                  holdMusicCleanupRef.current = null;
                }
                // Restore gain for new agent's audio
                if (gainNodeRef.current && playbackCtxRef.current) {
                  gainNodeRef.current.gain.setValueAtTime(3.0, playbackCtxRef.current.currentTime);
                }
                audioQueueRef.current = [];
                nextPlayTimeRef.current = 0;
                setIsOnHold(false);
                if (msg.agentName) {
                  setCurrentAgentName(msg.agentName);
                  // Insert a visual divider so user sees the agent switch in the transcript
                  setTranscripts((prev) => [
                    ...prev,
                    { role: "system" as const, text: `Now connected to ${msg.agentName}` },
                  ]);
                }
                break;
              }
            }
          } catch {
            // ignore
          }
        }
      };

      ws.onerror = () => {
        setError("Connection error");
        setStatus("error");
      };

      ws.onclose = () => {
        if (status !== "idle") {
          setStatus("idle");
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start call";
      setError(msg);
      setStatus("error");
    }
  }, [agentId, scheduleAudioChunk, status]);

  const endCall = useCallback(() => {
    // Send stop message
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
    wsRef.current?.close();
    wsRef.current = null;

    // Stop any hold music
    if (holdMusicCleanupRef.current) {
      holdMusicCleanupRef.current();
      holdMusicCleanupRef.current = null;
    }
    setIsOnHold(false);

    // Stop mic
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Close audio contexts
    if (micCtxRef.current && micCtxRef.current.state !== "closed") {
      void micCtxRef.current.close();
    }
    micCtxRef.current = null;
    if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
      void playbackCtxRef.current.close();
    }
    playbackCtxRef.current = null;

    nextPlayTimeRef.current = 0;
    audioQueueRef.current = [];
    queueProcessingRef.current = false;

    setStatus("idle");
    setIsMuted(false);
    setAudioLevel(0);
  }, []);

  const toggleMute = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (isMuted) {
      ws.send(JSON.stringify({ type: "unmute" }));
      setIsMuted(false);
    } else {
      ws.send(JSON.stringify({ type: "mute" }));
      setIsMuted(true);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (holdMusicCleanupRef.current) {
        holdMusicCleanupRef.current();
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (micCtxRef.current && micCtxRef.current.state !== "closed") {
        void micCtxRef.current.close();
      }
      if (playbackCtxRef.current && playbackCtxRef.current.state !== "closed") {
        void playbackCtxRef.current.close();
      }
    };
  }, []);

  const isActive = status === "connected";
  const isConnecting = status === "connecting";

  // Handle toggle call - start or end
  const handleToggleCall = useCallback(() => {
    if (isActive || isConnecting) {
      endCall();
    } else {
      void startCall();
    }
  }, [isActive, isConnecting, endCall, startCall]);

  return (
    <Flex vertical align="center" style={{ height: "100%", padding: "16px 0" }} gap={16}>
      {/* Radial Visualizer */}
      <Flex
        vertical
        align="center"
        justify="center"
        style={{ flex: "0 0 auto", marginTop: 12, marginBottom: 4 }}
      >
        <RadialVisualizer
          audioLevel={audioLevel}
          isActive={isActive}
          isMuted={isMuted}
          isConnecting={isConnecting}
          onToggleCall={handleToggleCall}
          onToggleMute={isActive ? toggleMute : undefined}
          size={220}
          barCount={50}
        />

        <Typography.Text
          strong
          style={{ marginTop: 16, fontSize: 16 }}
        >
          {status === "idle"
            ? currentAgentName || "Agent"
            : status === "connecting"
              ? "Connecting..."
              : isOnHold
                ? `Transferring to ${currentAgentName || "next agent"}...`
                : isMuted
                  ? "Muted"
                  : "Listening..."}
        </Typography.Text>

        {activeTool && (
          <Tag color="processing" style={{ marginTop: 8 }}>
            Using: {activeTool}
          </Tag>
        )}

        {isOnHold && (
          <Tag color="warning" style={{ marginTop: 8 }}>
            On Hold • Please wait
          </Tag>
        )}

        {error && (
          <Typography.Text type="danger" style={{ marginTop: 8, fontSize: 12 }}>
            {error}
          </Typography.Text>
        )}
      </Flex>

      {/* Live Transcript */}
      {transcripts.length > 0 && (
        <div
          className="voice-transcripts"
          style={{
            flex: 1,
            overflow: "auto",
            width: "100%",
            marginTop: 16,
            padding: "0 8px",
            minHeight: 0,
          }}
        >
          {transcripts.map((t, i) => {
            // System message = agent-change divider
            if (t.role === "system") {
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    margin: "12px 0",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "var(--ant-color-border, #e0e0e0)" }} />
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 11, whiteSpace: "nowrap", fontStyle: "italic" }}
                  >
                    {t.text}
                  </Typography.Text>
                  <div style={{ flex: 1, height: 1, background: "var(--ant-color-border, #e0e0e0)" }} />
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`voice-transcript voice-transcript--${t.role}`}
              >
                <Typography.Text
                  type={t.role === "user" ? "secondary" : undefined}
                  strong={t.role === "assistant"}
                  style={{ fontSize: 13 }}
                >
                  {t.role === "user" ? "You" : currentAgentName || agentName || "Agent"}:
                </Typography.Text>{" "}
                <Typography.Text style={{ fontSize: 13 }}>{t.text}</Typography.Text>
              </div>
            );
          })}
          <div ref={transcriptsEndRef} />
        </div>
      )}
    </Flex>
  );
}
