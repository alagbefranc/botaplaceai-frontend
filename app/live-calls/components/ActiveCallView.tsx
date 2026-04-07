"use client";

import {
  AudioMutedOutlined,
  AudioOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNotification } from "@telnyx/react-client";

export function ActiveCallView() {
  const notification = useNotification();
  const activeCall = notification?.call;
  const callState = activeCall?.state;
  
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRinging = callState === "ringing" || callState === "trying";
  const isActive = callState === "active";
  
  // Get the remote stream (for debugging)
  const remoteStream = activeCall?.remoteStream;
  
  // Debug logging
  useEffect(() => {
    console.log("[ActiveCallView] ==== Call Debug ====");
    console.log("[ActiveCallView] Call state:", callState);
    console.log("[ActiveCallView] Remote stream:", remoteStream);
    if (remoteStream) {
      console.log("[ActiveCallView] Audio tracks:", remoteStream.getAudioTracks().length);
    }
    // Check if audio element exists and has stream
    const audioEl = document.getElementById("telnyx-remote-audio") as HTMLAudioElement;
    if (audioEl) {
      console.log("[ActiveCallView] Audio element srcObject:", audioEl.srcObject);
      console.log("[ActiveCallView] Audio element paused:", audioEl.paused);
      console.log("[ActiveCallView] Audio element muted:", audioEl.muted);
    }
  }, [callState, remoteStream]);

  // Call duration timer
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!isRinging) {
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, isRinging]);

  const handleMuteToggle = useCallback(() => {
    if (!activeCall) return;
    if (isMuted) {
      activeCall.unmuteAudio();
    } else {
      activeCall.muteAudio();
    }
    setIsMuted(!isMuted);
  }, [activeCall, isMuted]);

  const handleHangup = useCallback(() => {
    if (activeCall) {
      console.log("[ActiveCallView] Hanging up call, state:", activeCall.state);
      try {
        // Try hangup first
        activeCall.hangup();
      } catch (err) {
        console.error("[ActiveCallView] Hangup failed, trying disconnect:", err);
        try {
          // Fall back to disconnect if hangup fails
          (activeCall as unknown as { disconnect?: () => void }).disconnect?.();
        } catch (err2) {
          console.error("[ActiveCallView] Disconnect also failed:", err2);
        }
      }
    }
  }, [activeCall]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get the phone number from various possible call properties
  const getDisplayNumber = () => {
    if (!activeCall) return "Unknown";
    
    // First check sessionStorage for the dialed number (most reliable)
    const storedNumber = sessionStorage.getItem("current_dialed_number");
    if (storedNumber) return storedNumber;
    
    // Log all call properties for debugging
    console.log("[ActiveCallView] Call object:", activeCall);
    console.log("[ActiveCallView] Call options:", activeCall.options);
    
    // Check various property names used by Telnyx SDK
    const callObj = activeCall as unknown as Record<string, unknown>;
    const options = activeCall.options as Record<string, unknown> | undefined;
    
    return (
      options?.destinationNumber ||
      callObj.destinationNumber ||
      callObj.destination ||
      callObj.remoteCallerNumber ||
      callObj.to ||
      callObj.callee ||
      options?.callee ||
      "Unknown"
    ) as string;
  };

  const displayNumber = getDisplayNumber();

  return (
    <div className="calling-state">
      {/* Audio is now handled by TelnyxProvider's remoteElement setup */}
      
      {/* Status */}
      <div className="calling-status">
        {isRinging ? "Calling..." : isActive ? "Connected" : ""}
      </div>

      {/* Avatar with Pulsing Ring */}
      <div className="calling-avatar">
        {isRinging && <div className="calling-avatar-ring" />}
        <div className="calling-avatar-inner">
          <UserOutlined />
        </div>
      </div>

      {/* Phone Number */}
      <div className="calling-number">{displayNumber}</div>

      {/* Duration */}
      {isActive && (
        <div className="calling-duration">
          <ClockCircleOutlined />
          {formatDuration(callDuration)}
          {remoteStream && <span style={{ marginLeft: 8, color: "#52c41a" }}>● Audio</span>}
        </div>
      )}

      {/* Call Controls */}
      <div className="call-controls">
        <button
          className={`call-control-btn ${isMuted ? "active" : ""}`}
          onClick={handleMuteToggle}
        >
          {isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
          <span className="call-control-label">Mute</span>
        </button>
      </div>

      {/* End Call Button */}
      <button className="end-call-btn" onClick={handleHangup}>
        <PhoneOutlined style={{ transform: "rotate(135deg)" }} />
        End call
      </button>
    </div>
  );
}
