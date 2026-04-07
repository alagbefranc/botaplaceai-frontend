"use client";

import {
  AudioMutedOutlined,
  AudioOutlined,
  ClockCircleOutlined,
  DisconnectOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Button, Card, Flex, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { Audio, useNotification, useCallbacks } from "@telnyx/react-client";
import { RadialVisualizer } from "@/app/_components/radial-visualizer";
import { useTelnyxStatus } from "@/app/_components/telnyx-provider";

const { Text, Title } = Typography;

interface ActiveCallPanelProps {
  onCallEnd?: () => void;
}

type ConnectionStatus = "connecting" | "ready" | "error" | "disconnected";

export function ActiveCallPanel({ onCallEnd }: ActiveCallPanelProps) {
  const notification = useNotification();
  const { isReady, isConnecting, error: telnyxError } = useTelnyxStatus();
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const activeCall = notification?.call;
  const callState = activeCall?.state;
  const isCallActive = callState === "active" || callState === "held";

  // Handle Telnyx client callbacks
  useCallbacks({
    onReady: () => {
      setConnectionStatus("ready");
    },
    onError: (e) => {
      console.error("[ActiveCallPanel] Telnyx error:", e);
      setConnectionStatus("error");
    },
    onSocketError: () => {
      setConnectionStatus("error");
    },
    onSocketClose: () => {
      setConnectionStatus("disconnected");
    },
  });

  // Update connection status based on Telnyx provider state
  useEffect(() => {
    if (isConnecting) {
      setConnectionStatus("connecting");
    } else if (telnyxError) {
      setConnectionStatus("error");
    } else if (isReady) {
      setConnectionStatus("ready");
    }
  }, [isConnecting, telnyxError, isReady]);

  // Call duration timer
  useEffect(() => {
    if (isCallActive) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCallDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isCallActive]);

  // Audio level visualization
  useEffect(() => {
    if (!activeCall?.remoteStream) {
      setAudioLevel(0);
      return;
    }

    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const source = audioContext.createMediaStreamSource(activeCall.remoteStream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      if (audioContextRef.current?.state === "closed") return;
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      requestAnimationFrame(updateLevel);
    };

    requestAnimationFrame(updateLevel);

    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, [activeCall?.remoteStream]);

  const handleMuteToggle = useCallback(() => {
    if (!activeCall) return;
    if (isMuted) {
      activeCall.unmuteAudio();
    } else {
      activeCall.muteAudio();
    }
    setIsMuted(!isMuted);
  }, [activeCall, isMuted]);

  const handleHoldToggle = useCallback(() => {
    if (!activeCall) return;
    if (isOnHold) {
      activeCall.unhold();
    } else {
      activeCall.hold();
    }
    setIsOnHold(!isOnHold);
  }, [activeCall, isOnHold]);

  const handleHangup = useCallback(() => {
    if (activeCall) {
      activeCall.hangup();
    }
    onCallEnd?.();
  }, [activeCall, onCallEnd]);

  // Non-optional handlers for RadialVisualizer
  const handleToggleCall = useCallback(() => {
    if (isCallActive) {
      handleHangup();
    }
  }, [isCallActive, handleHangup]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "ready":
        return "#52c41a";
      case "connecting":
        return "#faad14";
      case "error":
      case "disconnected":
        return "#ff4d4f";
      default:
        return "#d9d9d9";
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case "ready":
        return isCallActive ? "In Call" : "Ready";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Connection Error";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  };

  return (
    <Card 
      title={
        <Flex align="center" gap={8}>
          <PhoneOutlined />
          <span>Active Call</span>
        </Flex>
      }
      extra={
        <Tag color={getStatusColor()} style={{ margin: 0 }}>
          {getStatusText()}
        </Tag>
      }
      styles={{ body: { padding: 16 } }}
    >
      {/* Audio Element for playback */}
      {activeCall?.remoteStream && (
        <Audio stream={activeCall.remoteStream} />
      )}

      {/* Call Visualizer */}
      <Flex vertical align="center" gap={16}>
        <RadialVisualizer
          audioLevel={audioLevel}
          isActive={isCallActive}
          isMuted={isMuted}
          isConnecting={connectionStatus === "connecting"}
          onToggleCall={handleToggleCall}
          onToggleMute={handleMuteToggle}
          size={160}
          barCount={40}
        />

        {/* Call Info */}
        {isCallActive && (
          <Space direction="vertical" align="center" size={4}>
            {activeCall?.remoteCallerName || activeCall?.remoteCallerNumber ? (
              <Title level={5} style={{ margin: 0 }}>
                {activeCall?.remoteCallerName || activeCall?.remoteCallerNumber}
              </Title>
            ) : (
              <Title level={5} style={{ margin: 0 }}>Active Call</Title>
            )}
            
            <Space>
              <ClockCircleOutlined />
              <Text type="secondary">{formatDuration(callDuration)}</Text>
            </Space>

            {callState === "held" && (
              <Tag color="warning">On Hold</Tag>
            )}
          </Space>
        )}

        {/* No Active Call State */}
        {!isCallActive && connectionStatus === "ready" && (
          <Text type="secondary">No active call</Text>
        )}

        {connectionStatus === "error" && (
          <Text type="danger">{telnyxError || "Connection failed"}</Text>
        )}
      </Flex>

      {/* Call Controls */}
      {isCallActive && (
        <Flex justify="center" gap={12} style={{ marginTop: 24 }}>
          <Button
            icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
            onClick={handleMuteToggle}
            type={isMuted ? "primary" : "default"}
            danger={isMuted}
          >
            {isMuted ? "Unmute" : "Mute"}
          </Button>
          
          <Button
            icon={isOnHold ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={handleHoldToggle}
            type={isOnHold ? "primary" : "default"}
          >
            {isOnHold ? "Resume" : "Hold"}
          </Button>
          
          <Button
            icon={<DisconnectOutlined />}
            onClick={handleHangup}
            danger
            type="primary"
          >
            End Call
          </Button>
        </Flex>
      )}
    </Card>
  );
}
