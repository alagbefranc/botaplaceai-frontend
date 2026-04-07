"use client";

import { DeleteOutlined, PhoneOutlined, RobotOutlined } from "@ant-design/icons";
import { Input, Select, message, Segmented } from "antd";
import { useContext, useCallback, useState, useEffect } from "react";
import { TelnyxRTCContext } from "@telnyx/react-client";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

interface Agent {
  id: string;
  name: string;
  voice: string | null;
  status: string;
}

const DIALPAD_KEYS = [
  { key: "1", letters: "" },
  { key: "2", letters: "ABC" },
  { key: "3", letters: "DEF" },
  { key: "4", letters: "GHI" },
  { key: "5", letters: "JKL" },
  { key: "6", letters: "MNO" },
  { key: "7", letters: "PQRS" },
  { key: "8", letters: "TUV" },
  { key: "9", letters: "WXYZ" },
  { key: "*", letters: "" },
  { key: "0", letters: "+" },
  { key: "#", letters: "" },
];

interface PhoneNumber {
  id: string;
  number: string;
  displayLabel?: string;
}

interface PhoneDialpadProps {
  disabled?: boolean;
  onCallStart?: (destination: string, callerId: string) => void;
}

export function PhoneDialpad({ disabled, onCallStart }: PhoneDialpadProps) {
  const client = useContext(TelnyxRTCContext);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callerNumbers, setCallerNumbers] = useState<PhoneNumber[]>([]);
  const [selectedCallerId, setSelectedCallerId] = useState<string>("");
  const [callMode, setCallMode] = useState<string>("direct");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isDialing, setIsDialing] = useState(false);

  // Load org's phone numbers for caller ID selection
  useEffect(() => {
    const loadCallerNumbers = async () => {
      try {
        const orgId = localStorage.getItem("orgId");
        if (!orgId) return;

        const resp = await fetch(`/api/telnyx/phone-numbers?orgId=${orgId}`);
        if (resp.ok) {
          const numbers = await resp.json();
          const activeNumbers = numbers.filter((n: { status: string }) => n.status === "active");
          setCallerNumbers(activeNumbers);
          
          if (activeNumbers.length > 0 && !selectedCallerId) {
            setSelectedCallerId(activeNumbers[0].number);
          }
        }
      } catch (err) {
        console.error("[PhoneDialpad] Failed to load caller numbers:", err);
      }
    };

    loadCallerNumbers();
  }, [selectedCallerId]);

  // Load org's agents for AI call mode
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const orgId = localStorage.getItem("orgId");
        if (!orgId) return;

        const resp = await fetch(`/api/agents?orgId=${orgId}`);
        if (resp.ok) {
          const data = await resp.json();
          const activeAgents = (data.agents ?? data ?? []).filter(
            (a: Agent) => a.status === "active",
          );
          setAgents(activeAgents);
          if (activeAgents.length > 0 && !selectedAgentId) {
            setSelectedAgentId(activeAgents[0].id);
          }
        }
      } catch (err) {
        console.error("[PhoneDialpad] Failed to load agents:", err);
      }
    };

    if (callMode === "ai") loadAgents();
  }, [callMode, selectedAgentId]);

  const handleKeyPress = useCallback((key: string) => {
    setPhoneNumber((prev) => prev + key);
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }, []);

  // AI Agent call — uses backend /telnyx/dial → Gemini Live voice
  const handleAiCall = useCallback(async () => {
    if (!phoneNumber.trim()) {
      message.warning("Please enter a phone number");
      return;
    }
    if (!selectedCallerId) {
      message.error("No caller ID selected.");
      return;
    }
    if (!selectedAgentId) {
      message.error("No AI agent selected.");
      return;
    }

    setIsDialing(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/telnyx/dial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          to: phoneNumber,
          from: selectedCallerId,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || "Dial failed");
      }

      const data = await resp.json();
      const agent = agents.find((a) => a.id === selectedAgentId);
      message.success(
        `AI call started — ${agent?.name ?? "Agent"} (voice: ${agent?.voice ?? "default"}) calling ${phoneNumber}`,
      );
      console.log("[PhoneDialpad] AI call initiated:", data);
      sessionStorage.setItem("current_dialed_number", phoneNumber);
      if (onCallStart) onCallStart(phoneNumber, selectedCallerId);
    } catch (err) {
      console.error("[PhoneDialpad] AI call error:", err);
      message.error(
        err instanceof Error ? err.message : "Failed to place AI call",
      );
    } finally {
      setIsDialing(false);
    }
  }, [phoneNumber, selectedCallerId, selectedAgentId, agents, onCallStart]);

  // Direct WebRTC call — human-to-human
  const handleCall = useCallback(async () => {
    console.log("[PhoneDialpad] handleCall triggered");
    console.log("[PhoneDialpad] Client exists:", !!client);
    console.log("[PhoneDialpad] Client connected:", client?.connected);
    console.log("[PhoneDialpad] Phone number:", phoneNumber);
    console.log("[PhoneDialpad] Caller ID:", selectedCallerId);
    
    if (!phoneNumber.trim()) {
      message.warning("Please enter a phone number");
      return;
    }
    
    if (!selectedCallerId) {
      message.error("No caller ID selected. Please add a number in the Numbers page.");
      return;
    }

    if (onCallStart) {
      onCallStart(phoneNumber, selectedCallerId);
    }
    
    if (!client) {
      console.error("[PhoneDialpad] No TelnyxRTC client available!");
      message.error("Phone not connected. Please wait or refresh.");
      return;
    }
    
    if (!client.connected) {
      console.error("[PhoneDialpad] TelnyxRTC client not connected!");
      message.error("Phone not connected. Please wait for connection.");
      return;
    }
    
    if (client) {
      try {
        console.log(`[PhoneDialpad] Calling ${phoneNumber} from ${selectedCallerId}`);
        
        // Get saved audio input device
        const savedInput = localStorage.getItem("webrtc_audio_input");
        let audioConstraints: MediaTrackConstraints | boolean = true;
        
        if (savedInput) {
          audioConstraints = { deviceId: { exact: savedInput } };
        }
        
        // Request microphone access with specific device
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: audioConstraints,
            video: false 
          });
          console.log("[PhoneDialpad] Got local audio stream:", stream.getAudioTracks());
        } catch (micErr) {
          console.error("[PhoneDialpad] Microphone access failed:", micErr);
          message.error("Microphone access denied");
          return;
        }
        
        console.log("[PhoneDialpad] Creating call with:", {
          destinationNumber: phoneNumber,
          callerNumber: selectedCallerId,
          audioConstraints,
        });
        
        const call = client.newCall({
          destinationNumber: phoneNumber,
          callerNumber: selectedCallerId,
          audio: audioConstraints,
          video: false,
        });
        
        // Store the dialed number in sessionStorage for call history
        sessionStorage.setItem("current_dialed_number", phoneNumber);
        
        console.log("[PhoneDialpad] Call initiated:", call);
        console.log("[PhoneDialpad] Call ID:", call?.id);
        console.log("[PhoneDialpad] Call state:", call?.state);
        
        // Add call state listener
        if (call) {
          const checkState = () => {
            console.log("[PhoneDialpad] Call state update:", call.state);
          };
          // Check state every second for first 10 seconds
          const interval = setInterval(checkState, 1000);
          setTimeout(() => clearInterval(interval), 10000);
        }
      } catch (err) {
        console.error("[PhoneDialpad] Call error:", err);
        message.error("Failed to place call");
      }
    } else {
      message.error("Phone not connected. Please refresh.");
    }
  }, [phoneNumber, selectedCallerId, onCallStart, client]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Call Mode Toggle */}
      <div style={{ padding: "0 16px 8px" }}>
        <Segmented
          value={callMode}
          onChange={(val) => setCallMode(val as string)}
          options={[
            { label: "Direct", value: "direct", icon: <PhoneOutlined /> },
            { label: "AI Agent", value: "ai", icon: <RobotOutlined /> },
          ]}
          block
          size="small"
        />
      </div>

      {/* AI Agent Selector (only in AI mode) */}
      {callMode === "ai" && (
        <div className="caller-id-section">
          <span className="caller-id-label">AI Agent:</span>
          <Select
            value={selectedAgentId || undefined}
            onChange={setSelectedAgentId}
            placeholder="Select agent"
            style={{ width: "100%" }}
            disabled={disabled || agents.length === 0}
            options={agents.map((a) => ({
              value: a.id,
              label: `${a.name}${a.voice ? ` (${a.voice})` : ""}`,
            }))}
          />
        </div>
      )}

      {/* Caller ID Selector */}
      <div className="caller-id-section">
        <span className="caller-id-label">Caller ID:</span>
        <Select
          value={selectedCallerId || undefined}
          onChange={setSelectedCallerId}
          placeholder="Select an option"
          style={{ width: "100%" }}
          disabled={disabled || callerNumbers.length === 0}
          options={callerNumbers.map((n) => ({
            value: n.number,
            label: n.displayLabel ? `${n.number} (${n.displayLabel})` : n.number,
          }))}
        />
      </div>

      {/* Phone Number Input */}
      <div className="phone-input-wrapper">
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Type number"
          className="phone-input"
          disabled={disabled}
          suffix={
            <button
              onClick={() => {}}
              style={{
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 4,
                color: "#8c8c8c",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="5" height="5" rx="1" />
                <rect x="10" y="3" width="5" height="5" rx="1" />
                <rect x="17" y="3" width="5" height="5" rx="1" />
                <rect x="3" y="10" width="5" height="5" rx="1" />
                <rect x="10" y="10" width="5" height="5" rx="1" />
                <rect x="17" y="10" width="5" height="5" rx="1" />
                <rect x="3" y="17" width="5" height="5" rx="1" />
                <rect x="10" y="17" width="5" height="5" rx="1" />
                <rect x="17" y="17" width="5" height="5" rx="1" />
              </svg>
            </button>
          }
        />
      </div>

      {/* Dialpad Grid */}
      <div className="dialpad-grid">
        {DIALPAD_KEYS.map(({ key, letters }) => (
          <button
            key={key}
            className="dialpad-key"
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
          >
            <span className="dialpad-key-number">{key}</span>
            {letters && <span className="dialpad-key-letters">{letters}</span>}
          </button>
        ))}
      </div>

      {/* Call Actions */}
      <div className="call-actions">
        {callMode === "ai" ? (
          <button
            className="call-btn call-btn-primary"
            onClick={handleAiCall}
            disabled={disabled || !phoneNumber.trim() || !selectedAgentId || isDialing}
            style={{ background: isDialing ? "#8c8c8c" : undefined }}
          >
            <RobotOutlined />
            {isDialing ? "Dialing..." : "AI Call"}
          </button>
        ) : (
          <button
            className="call-btn call-btn-primary"
            onClick={handleCall}
            disabled={disabled || !phoneNumber.trim()}
          >
            <PhoneOutlined />
            Call
          </button>
        )}
        {phoneNumber && (
          <button className="backspace-btn" onClick={handleBackspace}>
            <DeleteOutlined />
          </button>
        )}
      </div>

      {/* Extension Info */}
      {selectedCallerId && (
        <div className="extension-info">
          From: {selectedCallerId}
        </div>
      )}
    </div>
  );
}
