"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import Lottie from "lottie-react";
import type { LottieRefCurrentProps } from "lottie-react";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const botaOrbData = require("../../public/bota-orb.json");

// ─── BOTA Orb (Lottie branded center animation) ───────────────────────────────

function BotaOrb({
  isActive,
  isConnecting,
  size,
}: {
  isActive: boolean;
  isConnecting: boolean;
  size: number;
}) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // Speed reflects call state — fast when active, slow/pulse when idle
  useEffect(() => {
    if (!lottieRef.current) return;
    if (isActive) {
      lottieRef.current.setSpeed(1.6);
    } else if (isConnecting) {
      lottieRef.current.setSpeed(1.0);
    } else {
      lottieRef.current.setSpeed(0.35);
    }
  }, [isActive, isConnecting]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={botaOrbData}
      loop
      autoplay
      style={{
        width: size,
        height: size,
        pointerEvents: "none",
      }}
    />
  );
}

// ─── Radial Visualizer ────────────────────────────────────────────────────────

interface RadialVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  isMuted: boolean;
  isConnecting: boolean;
  onToggleCall: () => void;
  onToggleMute?: () => void;
  size?: number;
  barCount?: number;
}

export function RadialVisualizer({
  audioLevel,
  isActive,
  isMuted,
  isConnecting,
  onToggleCall,
  onToggleMute,
  size = 280,
  barCount = 50,
}: RadialVisualizerProps) {
  const [bars, setBars] = useState(Array(barCount).fill(10));
  const audioLevelRef = useRef(audioLevel);
  
  // Update ref without triggering re-render
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  // Animate bars based on call state - use interval instead of audioLevel dependency
  useEffect(() => {
    if (!isActive || isMuted) return;
    
    const interval = setInterval(() => {
      const level = audioLevelRef.current;
      setBars(
        Array(barCount).fill(0).map(() => Math.random() * level * 60 + level * 20 + 5)
      );
    }, 50);
    
    return () => clearInterval(interval);
  }, [isActive, isMuted, barCount]);

  // Handle non-active states
  useEffect(() => {
    if (isActive && !isMuted) return; // Handled by interval above
    
    if (isConnecting) {
      // Handled by separate effect below
      return;
    } else if (isMuted) {
      setBars(Array(barCount).fill(8));
    } else {
      setBars(Array(barCount).fill(15));
    }
  }, [isActive, isMuted, isConnecting, barCount]);

  // Pulse effect while connecting
  useEffect(() => {
    if (!isConnecting) return;
    const interval = setInterval(() => {
      setBars(
        Array(barCount).fill(0).map((_, i) => Math.sin(Date.now() / 200 + i / 5) * 15 + 20)
      );
    }, 50);
    return () => clearInterval(interval);
  }, [isConnecting, barCount]);

  // Subtle idle animation
  useEffect(() => {
    if (isActive || isConnecting) return;
    const interval = setInterval(() => {
      setBars(
        Array(barCount).fill(0).map((_, i) => Math.sin(Date.now() / 500 + i / 8) * 5 + 15)
      );
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, isConnecting, barCount]);

  const center = size / 2;
  const innerRadius = size * 0.18;
  const baseRadius = size * 0.32;
  const orbSize = innerRadius * 2.4;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
      }}
    >
      {/* SVG Radial Bars — BOTA teal palette */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {bars.map((height, index) => {
          const angle = (index / bars.length) * 360;
          const radians = (angle * Math.PI) / 180;
          const x1 = center + Math.cos(radians) * innerRadius;
          const y1 = center + Math.sin(radians) * innerRadius;
          const x2 = center + Math.cos(radians) * (baseRadius + height);
          const y2 = center + Math.sin(radians) * (baseRadius + height);

          // BOTA brand colors: mint teal active, muted grey, soft teal idle
          const strokeColor = isActive
            ? isMuted
              ? "#94a3b8"   // slate-400 — muted
              : "#17DEBC"   // BOTA Main Cycle teal
            : isConnecting
              ? "#5EEAD4"   // teal-300 — connecting pulse
              : "#2DD4BF";  // teal-400 — idle

          const strokeOpacity = isActive
            ? isMuted ? 0.5 : 0.9
            : isConnecting ? 0.75 : 0.45;

          return (
            <motion.line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={strokeColor}
              strokeOpacity={strokeOpacity}
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ x2: x1, y2: y1 }}
              animate={{ x2, y2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          );
        })}
      </svg>

      {/* Glow — BOTA teal */}
      <span
        style={{
          position: "absolute",
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: "50%",
          filter: "blur(60px)",
          transition: "all 0.5s",
          backgroundColor: isActive
            ? isMuted
              ? "rgba(148, 163, 184, 0.2)"
              : "rgba(23, 222, 188, 0.28)"
            : isConnecting
              ? "rgba(94, 234, 212, 0.25)"
              : "rgba(23, 222, 188, 0.15)",
        }}
      />

      {/* BOTA Orb center — click to toggle call */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: orbSize,
          height: orbSize,
          borderRadius: "50%",
          cursor: "pointer",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isActive
            ? "0 0 32px rgba(23, 222, 188, 0.35), inset 0 2px 4px rgba(255,255,255,0.1)"
            : "0 0 24px rgba(23, 222, 188, 0.2)",
        }}
        onClick={onToggleCall}
      >
        {/* Lottie animation fills the orb */}
        <BotaOrb isActive={isActive} isConnecting={isConnecting} size={orbSize} />

        {/* Icon overlay — shown over the animation */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {isActive ? (
            <PhoneOff size={22} style={{ color: "#f87171", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.6))" }} />
          ) : isConnecting ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            >
              <Phone size={22} style={{ color: "#17DEBC", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))" }} />
            </motion.div>
          ) : (
            <Phone size={22} style={{ color: "#17DEBC", filter: "drop-shadow(0 0 4px rgba(0,0,0,0.5))" }} />
          )}
        </div>
      </div>

      {/* Mute button (shown when active) */}
      {isActive && onToggleMute && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 20,
            padding: 12,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
            backgroundColor: isMuted ? "#f97316" : "#0F172A",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          }}
        >
          {isMuted ? (
            <MicOff size={20} style={{ color: "white" }} />
          ) : (
            <Mic size={20} style={{ color: "#17DEBC" }} />
          )}
        </motion.button>
      )}
    </div>
  );
}

