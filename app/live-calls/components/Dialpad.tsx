"use client";

import { Button, Input, Space, message } from "antd";
import { useContext, useCallback, useState, useEffect } from "react";
import { TelnyxRTCContext, useNotification } from "@telnyx/react-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const DIALPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const KEY_LABELS: Record<string, string> = {
  "1": "",
  "2": "ABC",
  "3": "DEF",
  "4": "GHI",
  "5": "JKL",
  "6": "MNO",
  "7": "PQRS",
  "8": "TUV",
  "9": "WXYZ",
  "*": "",
  "0": "+",
  "#": "",
};

interface DialpadProps {
  onCall?: (destination: string) => void;
  isCallActive?: boolean;
  disabled?: boolean;
}

export function Dialpad({ onCall, isCallActive, disabled }: DialpadProps) {
  const client = useContext(TelnyxRTCContext);
  const notification = useNotification();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callerNumber, setCallerNumber] = useState<string | null>(null);

  // Load the org's phone number to use as caller ID
  useEffect(() => {
    const loadCallerNumber = async () => {
      try {
        const orgId = localStorage.getItem("orgId");
        if (!orgId) return;

        const resp = await fetch(`${BACKEND_URL}/phone-numbers?orgId=${orgId}`);
        if (resp.ok) {
          const numbers = await resp.json();
          // Use the first active number as caller ID
          const activeNumber = numbers.find((n: { status: string }) => n.status === "active");
          if (activeNumber?.number) {
            setCallerNumber(activeNumber.number);
            console.log("[Dialpad] Using caller ID:", activeNumber.number);
          }
        }
      } catch (err) {
        console.error("[Dialpad] Failed to load caller number:", err);
      }
    };

    loadCallerNumber();
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    // If call is active, send DTMF tone
    if (isCallActive && notification?.call) {
      try {
        notification.call.dtmf(key);
      } catch (err) {
        console.error("[Dialpad] DTMF error:", err);
      }
    }
    setPhoneNumber((prev) => prev + key);
  }, [isCallActive, notification]);

  const handleBackspace = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPhoneNumber("");
  }, []);

  const handleCall = useCallback(() => {
    if (!phoneNumber.trim()) return;
    
    if (!callerNumber) {
      message.error("No phone number configured. Please add a number in the Numbers page.");
      return;
    }
    
    if (onCall) {
      onCall(phoneNumber);
    } else if (client) {
      // Direct call via Telnyx client with caller ID
      try {
        console.log(`[Dialpad] Calling ${phoneNumber} from ${callerNumber}`);
        client.newCall({
          destinationNumber: phoneNumber,
          callerNumber: callerNumber,
          audio: true,
          video: false,
        });
        message.info(`Calling ${phoneNumber}...`);
      } catch (err) {
        console.error("[Dialpad] Call error:", err);
        message.error("Failed to place call. Check console for details.");
      }
    } else {
      message.error("WebRTC not connected. Click Reconnect.");
    }
  }, [phoneNumber, onCall, client, callerNumber]);

  return (
    <div style={{ padding: 16 }}>
      {/* Caller ID indicator */}
      {callerNumber && (
        <div style={{ 
          textAlign: "center", 
          marginBottom: 12, 
          padding: "6px 12px",
          background: "#f6ffed",
          borderRadius: 6,
          border: "1px solid #b7eb8f",
        }}>
          <span style={{ color: "#52c41a", fontSize: 12 }}>Calling from: {callerNumber}</span>
        </div>
      )}
      {!callerNumber && !disabled && (
        <div style={{ 
          textAlign: "center", 
          marginBottom: 12, 
          padding: "6px 12px",
          background: "#fff2f0",
          borderRadius: 6,
          border: "1px solid #ffccc7",
        }}>
          <span style={{ color: "#ff4d4f", fontSize: 12 }}>No caller ID - add a number first</span>
        </div>
      )}

      {/* Phone Number Input */}
      <Input
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        placeholder="Enter phone number"
        size="large"
        style={{ 
          textAlign: "center", 
          fontSize: 20, 
          fontWeight: 500,
          marginBottom: 16,
          letterSpacing: 1,
        }}
        addonAfter={
          phoneNumber && (
            <Button 
              type="text" 
              size="small" 
              onClick={handleBackspace}
              style={{ padding: "0 4px" }}
            >
              ←
            </Button>
          )
        }
        disabled={disabled}
      />

      {/* Dialpad Grid */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(3, 1fr)", 
          gap: 8,
          marginBottom: 16,
        }}
      >
        {DIALPAD_KEYS.flat().map((key) => (
          <Button
            key={key}
            size="large"
            onClick={() => handleKeyPress(key)}
            disabled={disabled}
            style={{
              height: 56,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0,
              background: "#f5f5f5",
              border: "1px solid #d9d9d9",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 600, color: "#262626", lineHeight: 1 }}>{key}</span>
            {KEY_LABELS[key] && (
              <span style={{ fontSize: 9, color: "#8c8c8c", letterSpacing: 1, marginTop: 2 }}>
                {KEY_LABELS[key]}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Action Buttons */}
      <Space style={{ width: "100%", justifyContent: "center" }}>
        {phoneNumber && (
          <Button onClick={handleClear} disabled={disabled}>
            Clear
          </Button>
        )}
        <Button
          type="primary"
          size="large"
          onClick={handleCall}
          disabled={disabled || !phoneNumber.trim() || isCallActive}
          style={{ minWidth: 120 }}
        >
          {isCallActive ? "In Call" : "Call"}
        </Button>
      </Space>
    </div>
  );
}
