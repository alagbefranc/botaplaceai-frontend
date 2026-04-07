"use client";

import {
  HomeOutlined,
  SettingOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SoundOutlined,
  AudioOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  Button,
  Drawer,
  Select,
  Space,
  Switch,
  Typography,
  Divider,
  Slider,
  message,
  Segmented,
} from "antd";
import { TelnyxProvider, useTelnyxStatus } from "@/app/_components/telnyx-provider";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { PhoneDialpad } from "./components/PhoneDialpad";
import { ActiveCallView } from "./components/ActiveCallView";
import { useNotification } from "@telnyx/react-client";
import "./phone-portal.css";

const { Text } = Typography;

interface CallRecord {
  id: string;
  number: string;
  direction: "outbound" | "inbound";
  duration: number;
  timestamp: Date;
  status: "completed" | "missed" | "failed";
}

interface AudioDevice {
  deviceId: string;
  label: string;
}

// Empty state with BOTA branded illustration
function EmptyCallsIllustration() {
  return (
    <div className="calls-content">
      <div className="empty-illustration">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/illustrations/bota/channels.svg"
          alt="Botaplace AI channels illustration"
          width={180}
          height={200}
          style={{ objectFit: "contain" }}
        />
      </div>
      <h3 className="empty-title">Your recent calls will appear here</h3>
    </div>
  );
}

// Call history list component
function CallHistoryList({ calls }: { calls: CallRecord[] }) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" }) + 
      " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  return (
    <div className="calls-content has-calls">
      {calls.map((call) => (
        <div key={call.id} className="call-history-item">
          <div className="call-history-icon">
            <PhoneOutlined style={{ 
              color: call.status === "completed" ? "#52c41a" : "#ff4d4f",
              transform: call.direction === "outbound" ? "rotate(45deg)" : "rotate(-45deg)"
            }} />
          </div>
          <div className="call-history-info">
            <div className="call-history-number">{call.number}</div>
            <div className="call-history-meta">
              <span>{call.direction === "outbound" ? "Outgoing" : "Incoming"}</span>
              <span> • </span>
              <span>{formatDuration(call.duration)}</span>
            </div>
          </div>
          <div className="call-history-time">
            {formatTime(call.timestamp)}
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveCallsContent() {
  const { isReady, isConnecting, error, refreshToken } = useTelnyxStatus();
  const router = useRouter();
  const notification = useNotification();
  const activeCall = notification?.call;
  const callState = activeCall?.state;
  
  // Debounce call active state to prevent UI flickering
  const [isCallActive, setIsCallActive] = useState(false);
  const callActiveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const shouldBeActive = callState === "active" || callState === "held" || callState === "ringing" || callState === "trying";
    
    if (shouldBeActive) {
      // Immediately show call UI when call starts
      if (callActiveTimeoutRef.current) {
        clearTimeout(callActiveTimeoutRef.current);
        callActiveTimeoutRef.current = null;
      }
      setIsCallActive(true);
    } else if (isCallActive && !shouldBeActive) {
      // Delay hiding call UI to prevent flickering
      callActiveTimeoutRef.current = setTimeout(() => {
        setIsCallActive(false);
      }, 500);
    }
    
    return () => {
      if (callActiveTimeoutRef.current) {
        clearTimeout(callActiveTimeoutRef.current);
      }
    };
  }, [callState, isCallActive]);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [dialpadMode, setDialpadMode] = useState<string>("keypad");
  const [audioInputs, setAudioInputs] = useState<AudioDevice[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>("");
  const [selectedOutput, setSelectedOutput] = useState<string>("");
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [volume, setVolume] = useState(80);
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);
  const callStartTimeRef = useRef<Date | null>(null);
  const lastCallRef = useRef<string | null>(null);

  // Load call history from database
  useEffect(() => {
    const loadCallHistory = async () => {
      try {
        const orgId = localStorage.getItem("orgId");
        if (!orgId) {
          console.log("[CallHistory] No orgId found");
          return;
        }

        const response = await fetch(`/api/calls/history?orgId=${orgId}&limit=50`);
        if (response.ok) {
          const data = await response.json();
          const calls = data.calls.map((c: CallRecord & { timestamp: string }) => ({
            ...c,
            timestamp: new Date(c.timestamp),
          }));
          setCallHistory(calls);
          console.log("[CallHistory] Loaded from database:", calls.length, "calls");
        } else {
          console.error("[CallHistory] API error:", await response.text());
        }
      } catch (e) {
        console.error("[CallHistory] Failed to load:", e);
      }
    };

    loadCallHistory();
  }, []);

  // Track call state changes for history
  useEffect(() => {
    if (!activeCall) return;
    
    // Get the destination number from various possible properties
    // Also check sessionStorage for the dialed number (most reliable source)
    const storedNumber = sessionStorage.getItem("current_dialed_number");
    const callObj = activeCall as unknown as Record<string, unknown>;
    const options = activeCall.options as Record<string, unknown> | undefined;
    
    const rawNumber = 
      storedNumber ||
      options?.destinationNumber ||
      callObj.destinationNumber ||
      callObj.destination ||
      callObj.remoteCallerNumber ||
      callObj.to ||
      "Unknown";
    const callNumber = String(rawNumber);
    
    const callId = activeCall.id || `call-${Date.now()}`;
    
    console.log("[CallHistory] Call state:", callState, "Number:", callNumber, "ID:", callId);
    console.log("[CallHistory] Call object:", activeCall);
    
    // Track call as soon as it starts (trying, ringing, or active)
    if ((callState === "trying" || callState === "ringing" || callState === "active") && !callStartTimeRef.current) {
      callStartTimeRef.current = new Date();
      lastCallRef.current = callId;
    }
    
    // When call ends, add to history
    if ((callState === "destroy" || callState === "hangup") && lastCallRef.current) {
      const duration = callStartTimeRef.current 
        ? Math.floor((Date.now() - callStartTimeRef.current.getTime()) / 1000)
        : 0;
      
      // Determine status based on whether call was answered
      let status: "completed" | "missed" | "failed" = "failed";
      if (duration > 5) {
        status = "completed";
      } else if (callNumber && callNumber !== "Unknown") {
        status = "missed"; // Call was made but not answered
      }
      
      const newRecord: CallRecord = {
        id: lastCallRef.current,
        number: callNumber,
        direction: "outbound",
        duration,
        timestamp: callStartTimeRef.current || new Date(),
        status,
      };
      
      console.log("[CallHistory] Adding to history:", newRecord);
      
      setCallHistory((prev) => {
        const updated = [newRecord, ...prev].slice(0, 50); // Keep last 50 calls
        // Note: Calls are persisted via webhook to database
        return updated;
      });
      
      // Clear the stored dialed number
      sessionStorage.removeItem("current_dialed_number");
      
      callStartTimeRef.current = null;
      lastCallRef.current = null;
    }
  }, [activeCall, callState]);

  // Load audio devices
  const loadAudioDevices = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputs = devices
        .filter(d => d.kind === "audioinput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 8)}` }));
      
      const outputs = devices
        .filter(d => d.kind === "audiooutput")
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 8)}` }));
      
      setAudioInputs(inputs);
      setAudioOutputs(outputs);
      
      if (!selectedInput && inputs.length > 0) setSelectedInput(inputs[0].deviceId);
      if (!selectedOutput && outputs.length > 0) setSelectedOutput(outputs[0].deviceId);
    } catch (err) {
      console.error("[Settings] Failed to load audio devices:", err);
      message.error("Please allow microphone access");
    }
  }, [selectedInput, selectedOutput]);

  useEffect(() => {
    if (settingsOpen) loadAudioDevices();
  }, [settingsOpen, loadAudioDevices]);

  useEffect(() => {
    const savedInput = localStorage.getItem("webrtc_audio_input");
    const savedOutput = localStorage.getItem("webrtc_audio_output");
    const savedAutoAnswer = localStorage.getItem("webrtc_auto_answer");
    const savedVolume = localStorage.getItem("webrtc_volume");
    
    if (savedInput) setSelectedInput(savedInput);
    if (savedOutput) setSelectedOutput(savedOutput);
    if (savedAutoAnswer) setAutoAnswer(savedAutoAnswer === "true");
    if (savedVolume) setVolume(Number(savedVolume));
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("webrtc_audio_input", selectedInput);
    localStorage.setItem("webrtc_audio_output", selectedOutput);
    localStorage.setItem("webrtc_auto_answer", String(autoAnswer));
    localStorage.setItem("webrtc_volume", String(volume));
    message.success("Settings saved");
    setSettingsOpen(false);
  };

  return (
    <div className="phone-portal-root">
      {/* Left Sidebar */}
      <div className="phone-sidebar">
        <button
          className="sidebar-back-btn"
          onClick={() => router.back()}
          title="Back"
        >
          <ArrowLeftOutlined />
        </button>
        <div className="sidebar-header">
          <PhoneOutlined />
          <h3>Phone</h3>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${activeTab === "home" ? "active" : ""}`}
            onClick={() => setActiveTab("home")}
          >
            <HomeOutlined />
            <span>Home</span>
          </button>
          <button
            className="sidebar-nav-item"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingOutlined />
            <span>Settings</span>
          </button>
        </nav>
      </div>

      {/* Center: Recent Calls */}
      <div className="calls-center-panel">
        <div className="calls-header">
          <h2>Recent calls</h2>
          <div className="calls-timestamp">
            <span>Last updated: Today, {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <Button
              type="text"
              icon={<ReloadOutlined spin={isConnecting} />}
              onClick={refreshToken}
              size="small"
            />
          </div>
        </div>
        
        <div className="calls-tabs">
          <button className="calls-tab active">All</button>
        </div>

        {error && (
          <div className="connection-banner">
            <PhoneOutlined />
            <span>{error}</span>
            <Button size="small" onClick={refreshToken}>Retry</Button>
          </div>
        )}

        {callHistory.length > 0 ? (
          <CallHistoryList calls={callHistory} />
        ) : (
          <EmptyCallsIllustration />
        )}

        {/* Voicemail Status */}
        <div className="voicemail-bar">
          <div className="voicemail-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="6" cy="12" r="3" stroke="#8c8c8c" strokeWidth="2" />
              <circle cx="18" cy="12" r="3" stroke="#8c8c8c" strokeWidth="2" />
              <line x1="6" y1="15" x2="18" y2="15" stroke="#8c8c8c" strokeWidth="2" />
            </svg>
          </div>
          <div className="voicemail-text">
            <span className="voicemail-title">You don&apos;t have new voicemails</span>
            <span className="voicemail-subtitle">Go to voicemail to listen to saved voicemails</span>
          </div>
        </div>
      </div>

      {/* Right: Dialpad Panel */}
      <div className="dialpad-panel">
        {isCallActive ? (
          <ActiveCallView />
        ) : (
          <>
            {/* Keypad/Contacts Toggle */}
            <div className="dialpad-toggle-wrapper">
              <Segmented
                value={dialpadMode}
                onChange={(val) => setDialpadMode(val as string)}
                options={[
                  { label: "Keypad", value: "keypad", icon: <PhoneOutlined /> },
                  { label: "Contacts", value: "contacts", icon: <TeamOutlined /> },
                ]}
                block
                className="dialpad-toggle"
              />
            </div>

            {dialpadMode === "keypad" ? (
              <PhoneDialpad disabled={!isReady} />
            ) : (
              <div className="contacts-placeholder">
                <TeamOutlined style={{ fontSize: 48, color: "#d9d9d9" }} />
                <Text type="secondary">Contacts coming soon</Text>
              </div>
            )}
          </>
        )}
      </div>

      {/* Settings Drawer */}
      <Drawer
        title="Phone Settings"
        placement="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={400}
        footer={
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSaveSettings}>Save Settings</Button>
          </Space>
        }
      >
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <AudioOutlined />
              <Text strong>Microphone</Text>
            </Space>
            <Select
              value={selectedInput}
              onChange={setSelectedInput}
              style={{ width: "100%" }}
              placeholder="Select microphone"
              options={audioInputs.map(d => ({ value: d.deviceId, label: d.label }))}
            />
          </div>

          <div>
            <Space style={{ marginBottom: 8 }}>
              <SoundOutlined />
              <Text strong>Speaker</Text>
            </Space>
            <Select
              value={selectedOutput}
              onChange={setSelectedOutput}
              style={{ width: "100%" }}
              placeholder="Select speaker"
              options={audioOutputs.map(d => ({ value: d.deviceId, label: d.label }))}
            />
          </div>

          <div>
            <Space style={{ marginBottom: 8 }}>
              <SoundOutlined />
              <Text strong>Volume</Text>
              <Text type="secondary">{volume}%</Text>
            </Space>
            <Slider value={volume} onChange={setVolume} min={0} max={100} />
          </div>

          <Divider />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text strong>Auto-Answer Calls</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Automatically answer incoming calls
              </Text>
            </div>
            <Switch checked={autoAnswer} onChange={setAutoAnswer} />
          </div>

          <Divider />

          <div style={{ padding: 16, background: "#fafafa", borderRadius: 8 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>Connection Status</Text>
            <Space>
              <div style={{ 
                width: 8, 
                height: 8, 
                borderRadius: "50%", 
                background: isReady ? "#52c41a" : "#ff4d4f" 
              }} />
              <Text type={isReady ? "success" : "danger"}>
                {isReady ? "Connected" : "Disconnected"}
              </Text>
            </Space>
            <br />
            <Button 
              size="small" 
              onClick={() => { refreshToken(); loadAudioDevices(); }}
              loading={isConnecting}
              style={{ marginTop: 8 }}
            >
              Refresh Connection
            </Button>
          </div>
        </Space>
      </Drawer>
    </div>
  );
}

export default function LiveCallsPage() {
  return (
    <TelnyxProvider>
      <LiveCallsContent />
    </TelnyxProvider>
  );
}
