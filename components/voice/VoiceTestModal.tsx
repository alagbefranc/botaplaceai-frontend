'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Typography, Space, Card } from 'antd';
import { AudioOutlined, CloseOutlined, SoundOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface VoiceTestModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentName?: string;
}

interface Transcript {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function VoiceTestModal({ open, onClose, agentId, agentName }: VoiceTestModalProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const transcriptsEndRef = useRef<HTMLDivElement>(null);

  const SAMPLE_RATE = 24000;
  const WS_URL = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:3001';

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackContextRef.current && playbackContextRef.current.state !== 'closed') {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    workletNodeRef.current = null;
    nextPlayTimeRef.current = 0;
  }, []);

  const playAudioChunk = useCallback((pcmData: ArrayBuffer) => {
    if (!playbackContextRef.current) return;

    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);

    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000;
    }

    const buffer = playbackContextRef.current.createBuffer(1, float32.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);

    const source = playbackContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackContextRef.current.destination);

    const currentTime = playbackContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);

    source.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;

    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setTranscripts([]);
      setCurrentAction(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // Set up audio capture context
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      await audioContextRef.current.audioWorklet.addModule('/audio-worklet-processor.js');

      const source = audioContextRef.current.createMediaStreamSource(stream);
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-send-processor');

      // Set up playback context
      playbackContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });

      // Connect to WebSocket
      const sessionId = `test_${Date.now()}`;
      const wsUrl = `${WS_URL}/ws?type=voice_chat&agentId=${agentId}&sessionId=${sessionId}`;
      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = 'arraybuffer';

      wsRef.current.onopen = () => {
        console.log('[VoiceTest] WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudioChunk(event.data);
        } else {
          try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
          } catch (err) {
            console.error('[VoiceTest] Failed to parse message:', err);
          }
        }
      };

      wsRef.current.onclose = () => {
        console.log('[VoiceTest] WebSocket disconnected');
        setStatus('idle');
      };

      wsRef.current.onerror = (error) => {
        console.error('[VoiceTest] WebSocket error:', error);
        setStatus('error');
      };

      // Send mic audio to WebSocket
      workletNodeRef.current.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN && !isMuted) {
          wsRef.current.send(e.data);
        }
      };

      source.connect(workletNodeRef.current);

    } catch (error) {
      console.error('[VoiceTest] Failed to connect:', error);
      setStatus('error');
      cleanup();
    }
  }, [agentId, cleanup, isMuted, playAudioChunk, WS_URL]);

  const handleMessage = (msg: { type: string; role?: string; transcript?: string; tool?: string; status?: string; conversationId?: string; error?: string }) => {
    switch (msg.type) {
      case 'connected':
        setStatus('connected');
        break;

      case 'transcript':
        if (msg.role && msg.transcript) {
          setTranscripts(prev => [
            ...prev,
            {
              role: msg.role as 'user' | 'assistant',
              text: msg.transcript!,
              timestamp: new Date(),
            },
          ]);
        }
        break;

      case 'tool_action':
        setCurrentAction(msg.tool || null);
        setTimeout(() => setCurrentAction(null), 3000);
        break;

      case 'error':
        console.error('[VoiceTest] Server error:', msg.error);
        setStatus('error');
        break;
    }
  };

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: newMuted ? 'mute' : 'unmute' }));
    }
  };

  // Scroll to bottom when transcripts update
  useEffect(() => {
    transcriptsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus('idle');
      setTranscripts([]);
    }
  }, [open, cleanup]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={4} style={{ marginBottom: 8 }}>
          Test Voice Chat
        </Title>
        <Text type="secondary">
          {agentName ? `Testing ${agentName}` : 'Test your agent with voice'}
        </Text>

        {/* Mic Button with Pulse Animation */}
        <div style={{ margin: '32px 0' }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: status === 'connected' ? '#52c41a' : status === 'connecting' ? '#faad14' : '#1890ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              cursor: status === 'idle' ? 'pointer' : 'default',
              animation: status === 'connected' ? 'pulse 2s infinite' : 'none',
              transition: 'all 0.3s ease',
            }}
            onClick={status === 'idle' ? connect : undefined}
          >
            {status === 'connected' ? (
              <SoundOutlined style={{ fontSize: 48, color: 'white' }} />
            ) : (
              <AudioOutlined style={{ fontSize: 48, color: 'white' }} />
            )}
          </div>

          <style jsx global>{`
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
              50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(82, 196, 26, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
            }
          `}</style>

          <div style={{ marginTop: 16 }}>
            {status === 'idle' && <Text>Click to start voice chat</Text>}
            {status === 'connecting' && <Text type="warning">Connecting...</Text>}
            {status === 'connected' && (
              <Text type="success">{isMuted ? 'Muted' : 'Listening...'}</Text>
            )}
            {status === 'error' && <Text type="danger">Connection error</Text>}
          </div>

          {currentAction && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" italic>
                Taking action: {currentAction}...
              </Text>
            </div>
          )}
        </div>

        {/* Transcripts */}
        <Card
          size="small"
          style={{
            maxHeight: 200,
            overflow: 'auto',
            textAlign: 'left',
            marginBottom: 16,
            background: '#fafafa',
          }}
          styles={{ body: { padding: 12 } }}
        >
          {transcripts.length === 0 ? (
            <Text type="secondary" style={{ fontStyle: 'italic' }}>
              Transcripts will appear here...
            </Text>
          ) : (
            transcripts.map((t, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: t.role === 'user' ? '#e6f7ff' : '#f6ffed',
                }}
              >
                <Text strong style={{ color: t.role === 'user' ? '#1890ff' : '#52c41a' }}>
                  {t.role === 'user' ? 'You' : 'Agent'}:
                </Text>{' '}
                <Text>{t.text}</Text>
              </div>
            ))
          )}
          <div ref={transcriptsEndRef} />
        </Card>

        {/* Controls */}
        <Space>
          {status === 'connected' && (
            <>
              <Button onClick={toggleMute}>
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button danger onClick={disconnect}>
                End Call
              </Button>
            </>
          )}
          {status !== 'connected' && (
            <Button onClick={onClose} icon={<CloseOutlined />}>
              Close
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
}

export default VoiceTestModal;
