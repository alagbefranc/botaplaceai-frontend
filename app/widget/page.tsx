"use client";

import {
  AudioMutedOutlined,
  AudioOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DesktopOutlined,
  LoadingOutlined,
  MobileOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SendOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Bubble } from "@ant-design/x";
import {
  Button,
  Card,
  Col,
  ColorPicker,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tabs,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RoutePageShell } from "../_components/route-page-shell";

// ─── Types ────────────────────────────────────────────────────────────────────

type WidgetMode = "voice" | "chat" | "hybrid";
type WidgetTheme = "light" | "dark";
type WidgetSize = "tiny" | "compact" | "full";
type WidgetRadius = "none" | "small" | "medium" | "large";
type WidgetPosition = "bottom-right" | "bottom-left" | "bottom-center";

interface Agent {
  id: string;
  name: string;
  greeting_message?: string;
  status: string;
}
interface ChatMessage {
  key: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Size / Radius Token Maps ─────────────────────────────────────────────────

const SIZE_MAP: Record<WidgetSize, { button: React.CSSProperties; panel: React.CSSProperties }> = {
  tiny:    { button: { width: "3rem", height: "3rem" }, panel: { width: "18rem", height: "20rem" } },
  compact: { button: { paddingLeft: "1rem", paddingRight: "1rem", height: "3rem" }, panel: { width: "24rem", height: "32rem" } },
  full:    { button: { paddingLeft: "1.5rem", paddingRight: "1.5rem", height: "3.5rem" }, panel: { width: "28rem", height: "40rem" } },
};
const RADIUS_MAP: Record<WidgetRadius, number | string> = { none: 0, small: "0.5rem", medium: "1rem", large: "1.5rem" };
const MSG_RADIUS_MAP: Record<WidgetRadius, number | string> = { none: 0, small: "0.375rem", medium: "0.5rem", large: "0.75rem" };

// ─── Animated Bars (Vapi-style) ───────────────────────────────────────────────

function AnimatedBars({
  size = 28,
  active = false,
  speaking = false,
  connecting = false,
  color = "#14B8A6",
  volumeLevel = 0,
}: {
  size?: number;
  active?: boolean;
  speaking?: boolean;
  connecting?: boolean;
  color?: string;
  volumeLevel?: number;
}) {
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (active || connecting) {
      const loop = () => { setTick(t => t + 1); frameRef.current = requestAnimationFrame(loop); };
      frameRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameRef.current);
    }
  }, [active, connecting]);

  const t = (Date.now() - startRef.current) / 1000;
  const bars = [
    { sensitivity: 0.8, freq: 1.2, base: 0.30 },
    { sensitivity: 1.0, freq: 1.8, base: 0.40 },
    { sensitivity: 1.2, freq: 2.5, base: 0.50 },
    { sensitivity: 1.0, freq: 2.0, base: 0.40 },
    { sensitivity: 0.9, freq: 1.5, base: 0.35 },
  ];

  const spacing = size * 0.18;
  const maxH = size * 0.85;
  const minH = size * 0.22;
  const w = size * 0.12;
  const viewW = spacing * 6;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${viewW} ${size}`} fill="none">
      {bars.map((bar, i) => {
        let h = minH;
        let opacity = 1;
        if (connecting) {
          const spinPhase = (t * 2 * Math.PI) % (2 * Math.PI);
          const barAngle = (i / 5) * 2 * Math.PI;
          const diff = Math.abs(((spinPhase - barAngle + Math.PI) % (2 * Math.PI)) - Math.PI);
          opacity = 0.3 + 0.7 * (1 - diff / Math.PI);
          h = minH + (maxH - minH) * opacity * 0.5;
        } else if (active && speaking) {
          const vol = Math.max(0, Math.min(1, volumeLevel));
          const pattern = Math.sin(t * bar.freq * 2 * Math.PI) * 0.3 + Math.sin(t * bar.freq * 6 * Math.PI) * 0.2;
          const activity = Math.max(0, Math.min(1, bar.base + vol * bar.sensitivity * 0.6 + pattern * vol * 0.4));
          h = minH + (maxH - minH) * (0.5 + activity * 0.8);
          opacity = 0.4 + activity * 0.6;
        } else if (active) {
          h = minH * ([0.5, 0.75, 1.0, 0.75, 0.5][i]);
          opacity = 0.9;
        } else {
          h = minH * ([0.5, 0.75, 1.0, 0.75, 0.5][i]);
          opacity = 0.6;
        }
        const x = spacing * (i + 0.5);
        const y = (size - h) / 2;
        return (
          <rect key={i} x={x - w / 2} y={y} width={w} height={h}
            rx={w / 2} fill={color} opacity={opacity} />
        );
      })}
    </svg>
  );
}

// ─── Widget Preview Components ────────────────────────────────────────────────

function WidgetFAB({
  mode, size, radius, accentColor, ctaButtonColor, ctaButtonTextColor,
  ctaTitle, ctaSubtitle, connecting, active, speaking, volumeLevel, onClick,
}: {
  mode: WidgetMode; size: WidgetSize; radius: WidgetRadius;
  accentColor: string; ctaButtonColor: string; ctaButtonTextColor: string;
  ctaTitle: string; ctaSubtitle?: string; connecting: boolean;
  active: boolean; speaking: boolean; volumeLevel: number; onClick: () => void;
}) {
  const isTiny = size === "tiny";
  const r = RADIUS_MAP[radius];
  const s = SIZE_MAP[size].button;
  return (
    <button onClick={onClick} style={{
      ...s,
      borderRadius: isTiny ? "50%" : r,
      background: active && isTiny ? "#ef4444" : ctaButtonColor,
      border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 10px 25px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.1)",
      transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
    }}>
      <AnimatedBars size={isTiny ? 24 : 28} active={active} speaking={speaking}
        connecting={connecting} color={accentColor} volumeLevel={volumeLevel} />
      {!isTiny && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ color: ctaButtonTextColor, fontSize: 14, fontWeight: 500, lineHeight: 1.2 }}>
            {ctaTitle}
          </span>
          {ctaSubtitle && (
            <span style={{ color: ctaButtonTextColor, fontSize: 12, opacity: 0.8, lineHeight: 1.2 }}>
              {ctaSubtitle}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WidgetPage() {
  const supabase = getSupabaseBrowserClient();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Widget config
  const [mode, setMode] = useState<WidgetMode>("hybrid");
  const [theme, setTheme] = useState<WidgetTheme>("light");
  const [widgetSize, setWidgetSize] = useState<WidgetSize>("full");
  const [borderRadius, setBorderRadius] = useState<WidgetRadius>("medium");
  const [position, setPosition] = useState<WidgetPosition>("bottom-right");
  const [accentColor, setAccentColor] = useState("#7C3AED");
  const [ctaButtonColor, setCtaButtonColor] = useState("#1F2937");
  const [ctaButtonTextColor, setCtaButtonTextColor] = useState("#FFFFFF");
  const [widgetTitle, setWidgetTitle] = useState("Talk with AI");
  const [ctaTitle, setCtaTitle] = useState("Need help?");
  const [ctaSubtitle, setCtaSubtitle] = useState("Chat with our AI assistant");
  const [greeting, setGreeting] = useState("Hi there! How can I help you today?");
  const [chatPlaceholder, setChatPlaceholder] = useState("Type your message...");
  const [voiceShowTranscript, setVoiceShowTranscript] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoOpenDelay, setAutoOpenDelay] = useState(3);

  // Preview state
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [widgetOpen, setWidgetOpen] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState<"voice" | "chat">(mode === "voice" ? "voice" : "chat");
  const [sessionId] = useState(() => `widget-preview-${Date.now()}`);

  // Image attachment for vision
  const [pendingImage, setPendingImage] = useState<{ mimeType: string; data: string; name: string } | null>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      // Strip the "data:<mime>;base64," prefix
      const base64 = dataUrl.split(",")[1];
      setPendingImage({ mimeType: file.type, data: base64, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Avatar
  const DEFAULT_AVATAR = "/assets/avatars/bota-copilot-avatar.png";
  const [agentAvatarUrl, setAgentAvatarUrl] = useState<string>(DEFAULT_AVATAR);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAgentAvatarUrl(url);
  };

  const bg = theme === "dark" ? "#111827" : "#FFFFFF";
  const textPrimary = theme === "dark" ? "#F9FAFB" : "#111827";
  const textSecondary = theme === "dark" ? "#9CA3AF" : "#6B7280";
  const border = theme === "dark" ? "#1F2937" : "#E5E7EB";
  const msgBg = theme === "dark" ? "#1F2937" : "#F3F4F6";
  const panelStyle = SIZE_MAP[widgetSize].panel;
  const r = RADIUS_MAP[borderRadius];
  const msgR = MSG_RADIUS_MAP[borderRadius];

  useEffect(() => {
    const loadAgents = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Try loading agents for the org stored in localStorage
        const orgId = typeof window !== "undefined" ? window.localStorage.getItem("orgId") : null;
        if (orgId) {
          const { data, error } = await supabase.from("agents")
            .select("id, name, greeting_message, status")
            .eq("status", "active").eq("org_id", orgId).order("created_at", { ascending: false });
          if (!error && data && data.length > 0) {
            setAgents(data);
            setSelectedAgentId(data[0].id);
            if (data[0].greeting_message) setGreeting(data[0].greeting_message);
          }
        }
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("agents")
        .select("id, name, greeting_message, status")
        .eq("status", "active").order("created_at", { ascending: false });
      if (!error && data) {
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgentId(data[0].id);
          if (data[0].greeting_message) setGreeting(data[0].greeting_message);
        }
      }
      setLoading(false);
    };
    loadAgents();
  }, [supabase]);

  useEffect(() => {
    if (mode === "voice") setActiveTab("voice");
    else setActiveTab("chat");
  }, [mode]);

  const selectedAgent = useMemo(() => agents.find(a => a.id === selectedAgentId), [agents, selectedAgentId]);

  const handleSendMessage = useCallback(async (text: string) => {
    if ((!text.trim() && !pendingImage) || !selectedAgentId) return;
    const userKey = `user-${Date.now()}`;
    const assistantKey = `assistant-${Date.now()}`;
    const imageForMsg = pendingImage;
    setChatMessages(prev => [...prev, {
      key: userKey, role: "user",
      content: imageForMsg ? `📎 ${imageForMsg.name}${text.trim() ? `\n${text}` : ""}` : text,
    }]);
    setChatInput("");
    setPendingImage(null);
    setIsStreaming(true);
    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgentId,
          message: text || "Please analyze this image.",
          sessionId,
          ...(imageForMsg ? { attachments: [{ type: "image", mimeType: imageForMsg.mimeType, data: imageForMsg.data }] } : {}),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");
      const decoder = new TextDecoder();
      let fullText = "";
      let pending = "";
      setChatMessages(prev => [...prev, { key: assistantKey, role: "assistant", content: "" }]);
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            if (payload && payload !== "[DONE]") {
              try {
                const parsed = JSON.parse(payload) as { text?: string };
                if (parsed.text) {
                  fullText += parsed.text;
                  setChatMessages(prev => prev.map(m => m.key === assistantKey ? { ...m, content: fullText } : m));
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch {
      setChatMessages(prev => [...prev, { key: assistantKey, role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setIsStreaming(false);
    }
  }, [selectedAgentId, sessionId, pendingImage]);

  const handleToggleCall = () => {
    if (callActive) {
      setCallActive(false);
      setConnecting(false);
    } else {
      setConnecting(true);
      setTimeout(() => { setConnecting(false); setCallActive(true); }, 1200);
    }
  };

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    message.success("Copied to clipboard!");
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com";
  const aid = selectedAgentId || "YOUR_AGENT_ID";

  // ── Method 1: Script tag ──────────────────────────────────────────────────
  const embedCode = `<!-- Paste before </body> -->
<script
  src="${origin}/widget.js"
  data-agent-id="${aid}"
  data-api-base="${origin}"
  async>
</script>`;

  // ── Method 2: Custom Element ──────────────────────────────────────────────
  const customElementCode = `<!-- Step 1: Load the widget script once in <head> -->
<script src="${origin}/widget.js" async></script>

<!-- Step 2: Drop the element wherever you want on the page -->
<bota-widget
  agent-id="${aid}"
  api-base="${origin}">
</bota-widget>`;

  // ── Method 3: Programmatic JS ─────────────────────────────────────────────
  const programmaticCode = `<script src="${origin}/widget.js" async></script>
<script>
  // Called after widget.js loads
  window.addEventListener('load', function() {
    BotaWidget.init('${aid}', {
      apiBase: '${origin}',
    });
  });
</script>`;

  // ── Method 4: React component ─────────────────────────────────────────────
  const reactComponentCode = `// BotaWidget.jsx – drop this file in your project
import { useEffect, useRef } from 'react';

export function BotaWidget({ agentId, apiBase = window.location.origin }) {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !agentId) return;
    loaded.current = true;
    const script = document.createElement('script');
    script.src = apiBase + '/widget.js';
    script.setAttribute('data-agent-id', agentId);
    script.setAttribute('data-api-base', apiBase);
    document.body.appendChild(script);
  }, [agentId, apiBase]);
  return null;
}

// Usage in your app:
// <BotaWidget
//   agentId="${aid}"
//   apiBase="${origin}"
// />`;

  const npmInstallCode = `npm install @bo-support/chat-widget   # coming soon`;
  void npmInstallCode; // reserved for future npm package

  const bubbleItems = useMemo(() =>
    chatMessages.map(m => ({ key: m.key, role: m.role, content: m.content })),
    [chatMessages]);

  // ── Render Preview Panel ───────────────────────────────────────────────────

  const renderVoiceArea = () => {
    if (!callActive) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          {/* Agent avatar with animated ring */}
          <div style={{ position: "relative" }}>
            <img src={agentAvatarUrl} alt="Agent"
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: `3px solid ${accentColor}50` }} />
            <div style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderRadius: "50%", background: "#10B981", border: `2px solid ${bg}` }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 15 }}>
              {selectedAgent?.name || "AI Assistant"}
            </div>
            <div style={{ color: textSecondary, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
              {greeting}
            </div>
          </div>
        </div>
      );
    }
    if (voiceShowTranscript && chatMessages.length > 0) {
      return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          {chatMessages.slice(-6).map(m => (
            <div key={m.key} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", padding: "8px 12px", borderRadius: m.role === "user" ? `${msgR}px 4px ${msgR}px ${msgR}px` : `4px ${msgR}px ${msgR}px ${msgR}px`, background: m.role === "user" ? accentColor : msgBg, color: m.role === "user" ? "#fff" : textPrimary, fontSize: 13 }}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {/* Active call orb — avatar with pulsing ring + bars */}
        <div style={{ position: "relative" }}>
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: `${accentColor}20`, display: "flex", alignItems: "center", justifyContent: "center", animation: "voicePulse 2s ease-in-out infinite" }}>
            <img src={agentAvatarUrl} alt="Agent"
              style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} />
          </div>
          {/* Animated bars badge */}
          <div style={{ position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: "50%", background: accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AnimatedBars size={18} active={true} speaking={true} color="#fff" volumeLevel={0.6} />
          </div>
        </div>
        <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>
          {selectedAgent?.name || "AI Assistant"} is speaking…
        </div>
      </div>
    );
  };

  const renderVoiceControls = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
      {callActive && (
        <button onClick={() => setIsMuted(m => !m)} style={{
          width: 44, height: 44, borderRadius: "50%",
          background: isMuted ? "#EF4444" : msgBg,
          border: `1px solid ${border}`, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {isMuted
            ? <AudioMutedOutlined style={{ fontSize: 18, color: "#fff" }} />
            : <AudioOutlined style={{ fontSize: 18, color: textSecondary }} />
          }
        </button>
      )}
      <button onClick={handleToggleCall} style={{
        padding: "0 28px", height: 48, borderRadius: 24,
        background: callActive ? "#EF4444" : accentColor,
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 8,
        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
      }}>
        {connecting
          ? <LoadingOutlined style={{ fontSize: 18, color: "#fff" }} />
          : <PhoneOutlined style={{ fontSize: 16, color: "#fff", transform: callActive ? "rotate(135deg)" : "none" }} />
        }
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>
          {callActive ? "End Call" : connecting ? "Connecting…" : "Start Call"}
        </span>
      </button>
    </div>
  );

  const renderChatControls = () => (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <input ref={imageFileRef} type="file" accept="image/*" onChange={handleImageAttach} style={{ display: "none" }} />
      <button
        onClick={() => imageFileRef.current?.click()}
        title="Attach image"
        style={{
          width: 36, height: 36, borderRadius: "50%", border: `1px solid ${border}`,
          background: msgBg, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <PaperClipOutlined style={{ fontSize: 15, color: pendingImage ? accentColor : textSecondary }} />
      </button>
      <div style={{ flex: 1, background: msgBg, borderRadius: 24, border: `1px solid ${border}`, padding: "10px 16px" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSendMessage(chatInput)}
          placeholder={pendingImage ? `📎 ${pendingImage.name} — add a message…` : chatPlaceholder}
          disabled={!selectedAgentId || isStreaming}
          style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 14, color: textPrimary }}
        />
      </div>
      <button
        onClick={() => handleSendMessage(chatInput)}
        disabled={(!chatInput.trim() && !pendingImage) || !selectedAgentId || isStreaming}
        style={{
          width: 44, height: 44, borderRadius: "50%", border: "none",
          cursor: (chatInput.trim() || pendingImage) ? "pointer" : "default",
          background: (chatInput.trim() || pendingImage) ? accentColor : msgBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s",
        }}
      >
        <SendOutlined style={{ fontSize: 15, color: (chatInput.trim() || pendingImage) ? "#fff" : textSecondary }} />
      </button>
    </div>
  );

  const renderHybridControls = () => (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      {!callActive && (
        <button
          onClick={() => imageFileRef.current?.click()}
          title="Attach image"
          style={{
            width: 36, height: 36, borderRadius: "50%", border: `1px solid ${border}`,
            background: msgBg, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <PaperClipOutlined style={{ fontSize: 15, color: pendingImage ? accentColor : textSecondary }} />
        </button>
      )}
      <div style={{ flex: 1, background: msgBg, borderRadius: 24, border: `1px solid ${border}`, padding: "10px 16px" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSendMessage(chatInput)}
          placeholder={pendingImage && !callActive ? `📎 ${pendingImage.name} — add a message…` : chatPlaceholder}
          disabled={callActive || !selectedAgentId || isStreaming}
          style={{ width: "100%", border: "none", background: "transparent", outline: "none", fontSize: 14, color: textPrimary }}
        />
      </div>
      {callActive ? (
        <>
          <button onClick={() => setIsMuted(m => !m)} style={{ width: 44, height: 44, borderRadius: "50%", border: `1px solid ${border}`, background: isMuted ? "#EF4444" : msgBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isMuted ? <AudioMutedOutlined style={{ fontSize: 16, color: "#fff" }} /> : <AudioOutlined style={{ fontSize: 16, color: textSecondary }} />}
          </button>
          <button onClick={handleToggleCall} style={{ width: 44, height: 44, borderRadius: "50%", background: "#EF4444", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <PhoneOutlined style={{ fontSize: 16, color: "#fff", transform: "rotate(135deg)" }} />
          </button>
        </>
      ) : (
        <>
          <button onClick={() => handleSendMessage(chatInput)} disabled={!chatInput.trim() || !selectedAgentId || isStreaming} style={{ width: 44, height: 44, borderRadius: "50%", border: "none", background: chatInput.trim() ? accentColor : msgBg, cursor: chatInput.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SendOutlined style={{ fontSize: 15, color: chatInput.trim() ? "#fff" : textSecondary }} />
          </button>
          <button onClick={handleToggleCall} style={{ width: 44, height: 44, borderRadius: "50%", background: accentColor, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${accentColor}50` }}>
            {connecting ? <LoadingOutlined style={{ fontSize: 16, color: "#fff" }} /> : <PhoneOutlined style={{ fontSize: 16, color: "#fff" }} />}
          </button>
        </>
      )}
    </div>
  );

  const renderConversationBody = () => {
    // Voice only mode
    if (mode === "voice") return renderVoiceArea();

    // Hybrid: voice active shows orb
    if (mode === "hybrid" && callActive && !voiceShowTranscript) return renderVoiceArea();

    // Show messages or empty state
    if (chatMessages.length === 0) {
      return (
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <img src={agentAvatarUrl} alt="Agent"
              style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `3px solid ${accentColor}40` }} />
            <div style={{ position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: "50%", background: "#10B981", border: `2px solid ${bg}` }} />
          </div>
          <div>
            <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
              {selectedAgent?.name || "AI Assistant"}
            </div>
            <div style={{ color: textSecondary, fontSize: 13, lineHeight: 1.5 }}>
              {greeting}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Greeting bubble */}
        <div style={{ display: "flex", justifyContent: "flex-start", gap: 8, alignItems: "flex-end" }}>
          <img src={agentAvatarUrl} alt="Agent"
            style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${accentColor}40` }} />
          <div style={{ maxWidth: "78%", padding: "8px 12px", borderRadius: `4px ${msgR}px ${msgR}px ${msgR}px`, background: msgBg, color: textPrimary, fontSize: 13, lineHeight: 1.5 }}>
            {greeting}
          </div>
        </div>
        <Bubble.List
          items={bubbleItems}
          autoScroll
          role={{
            assistant: {
              placement: "start",
              avatar: (
                <img src={agentAvatarUrl} alt="Agent"
                  style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", border: `1px solid ${accentColor}40` }} />
              ),
              styles: {
                content: { background: msgBg, borderRadius: `4px ${msgR}px ${msgR}px ${msgR}px`, padding: "8px 12px", fontSize: 13, lineHeight: 1.5, color: textPrimary },
              },
            },
            user: {
              placement: "end",
              styles: {
                content: { background: accentColor, borderRadius: `${msgR}px 4px ${msgR}px ${msgR}px`, padding: "8px 14px", fontSize: 13, lineHeight: 1.5, color: "#fff" },
                avatar: { display: "none" },
              },
            },
          }}
        />
      </div>
    );
  };

  const renderWidgetOverlay = ({ topOffset, padding, gap = 12, align, isMobileSize = false }: {
    topOffset: number; padding: string; gap?: number; align: React.CSSProperties["alignItems"]; isMobileSize?: boolean;
  }) => {
    /* ── Mobile: full-screen panel + simple circle FAB ─────────────────── */
    if (isMobileSize) {
      return (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {widgetOpen ? (
            /* Full-screen chat panel */
            <div style={{
              position: "absolute", inset: 0,
              pointerEvents: "all",
              background: bg,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Mobile header: back chevron + avatar + title */}
              <div style={{ paddingTop: 44, padding: "44px 14px 10px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10, background: bg, flexShrink: 0 }}>
                <Button type="text" size="small"
                  icon={<CloseOutlined style={{ fontSize: 16, color: textSecondary }} />}
                  style={{ width: 32, height: 32, flexShrink: 0 }}
                  onClick={() => setWidgetOpen(false)} />
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img src={agentAvatarUrl} alt="Agent"
                    style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", display: "block", border: `2px solid ${accentColor}40` }}
                  />
                  <span style={{ position: "absolute", bottom: 1, right: 1, width: 8, height: 8, borderRadius: "50%",
                    background: connecting ? "#F59E0B" : callActive ? "#10B981" : "#9CA3AF", border: `2px solid ${bg}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, lineHeight: 1.2 }}>{widgetTitle}</div>
                  <div style={{ fontSize: 11, color: connecting ? "#F59E0B" : callActive ? "#10B981" : textSecondary }}>
                    {connecting ? "Connecting…" : callActive ? "Call active" : "Online"}
                  </div>
                </div>
                <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 14, color: textSecondary }} />} style={{ width: 32, height: 32 }}
                  onClick={() => { setChatMessages([]); setCallActive(false); setConnecting(false); }} />
              </div>
              {/* Conversation body */}
              <div style={{ flex: 1, overflow: "auto", padding: "16px 14px", background: bg, display: "flex", flexDirection: "column",
                alignItems: (mode === "voice" || (mode === "hybrid" && callActive && !voiceShowTranscript)) ? "center" : "stretch",
                justifyContent: chatMessages.length === 0 ? "center" : "flex-start", gap: 10 }}>
                {renderConversationBody()}
              </div>
              {/* Controls — extra bottom padding clears the iPhone's home indicator */}
              <div style={{ borderTop: `1px solid ${border}`, background: theme === "dark" ? "#0F172A" : "#F9FAFB", flexShrink: 0 }}>
                <div style={{ padding: "10px 12px 6px" }}>
                  {mode === "voice" && renderVoiceControls()}
                  {mode === "chat" && renderChatControls()}
                  {mode === "hybrid" && renderHybridControls()}
                </div>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2px 14px 8px", gap: 5 }}>
                  <span style={{ fontSize: 10, color: textSecondary, opacity: 0.6, letterSpacing: 0.2 }}>Powered by</span>
                  <img src="/assets/badges/bota-badge.png" alt="Bota"
                    style={{ height: 12, opacity: 0.5, filter: theme === "dark" ? "invert(1)" : "none" }} />
                </div>
              </div>
            </div>
          ) : (
            /* Mobile FAB: simple white circle with chat icon */
            <div style={{ position: "absolute", bottom: "1rem", right: "1rem", pointerEvents: "all" }}>
              <button onClick={() => setWidgetOpen(true)} style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "#fff",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 20px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.12)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="#111"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      );
    }

    /* ── Desktop: flex column-reverse with floating panel ──────────────── */
    return (
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, top: topOffset,
        pointerEvents: "none",
        display: "flex", flexDirection: "column-reverse",
        alignItems: align,
        padding,
        gap,
        overflow: "hidden",
      }}>
        <div style={{ pointerEvents: "all", flexShrink: 0 }}>
          <WidgetFAB
            mode={mode} size={widgetSize} radius={borderRadius}
            accentColor={accentColor} ctaButtonColor={ctaButtonColor} ctaButtonTextColor={ctaButtonTextColor}
            ctaTitle={ctaTitle} ctaSubtitle={ctaSubtitle}
            connecting={connecting} active={callActive} speaking={callActive} volumeLevel={0.5}
            onClick={() => setWidgetOpen(o => !o)}
          />
        </div>
        {widgetOpen ? (
          <div style={{
            ...panelStyle,
            flex: "0 1 auto",
            minHeight: 0,
            pointerEvents: "all",
            maxWidth: panelStyle.width,
            background: bg,
            borderRadius: r,
            border: `1px solid ${border}`,
            boxShadow: theme === "dark"
              ? "0 25px 50px -12px rgba(0,0,0,0.6)"
              : "0 25px 50px -12px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "vapiWidgetIn 0.25s cubic-bezier(0,1.2,1,1)",
          }}>
            {/* Header */}
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10, background: bg }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <img src={agentAvatarUrl} alt="Agent"
                  style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", display: "block", border: `2px solid ${accentColor}40` }}
                />
                <span style={{
                  position: "absolute", bottom: 1, right: 1,
                  width: 9, height: 9, borderRadius: "50%",
                  background: connecting ? "#F59E0B" : callActive ? "#10B981" : "#9CA3AF",
                  border: `2px solid ${bg}`,
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary, lineHeight: 1.2 }}>{widgetTitle}</div>
                <div style={{ fontSize: 12, color: connecting ? "#F59E0B" : callActive ? "#10B981" : textSecondary, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: connecting ? "#F59E0B" : callActive ? "#10B981" : "#9CA3AF", display: "inline-block" }} />
                  {connecting ? "Connecting…" : callActive ? "Call active" : "Online"}
                </div>
              </div>
              <Space size={2}>
                <Button type="text" size="small" icon={<ReloadOutlined style={{ fontSize: 13, color: textSecondary }} />} style={{ width: 28, height: 28 }}
                  onClick={() => { setChatMessages([]); setCallActive(false); setConnecting(false); }} />
                <Button type="text" size="small" icon={<CloseOutlined style={{ fontSize: 13, color: textSecondary }} />} style={{ width: 28, height: 28 }}
                  onClick={() => setWidgetOpen(false)} />
              </Space>
            </div>
            {/* Conversation body */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 14px", background: bg, display: "flex", flexDirection: "column",
              alignItems: (mode === "voice" || (mode === "hybrid" && callActive && !voiceShowTranscript)) ? "center" : "stretch",
              justifyContent: chatMessages.length === 0 ? "center" : "flex-start", gap: 10 }}>
              {renderConversationBody()}
            </div>
            {/* Controls */}
            <div style={{ borderTop: `1px solid ${border}`, background: theme === "dark" ? "#0F172A" : "#F9FAFB" }}>
              <div style={{ padding: "12px 14px" }}>
                {mode === "voice" && renderVoiceControls()}
                {mode === "chat" && renderChatControls()}
                {mode === "hybrid" && renderHybridControls()}
              </div>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "6px 14px 10px", gap: 5 }}>
                <span style={{ fontSize: 10, color: textSecondary, opacity: 0.6, letterSpacing: 0.2 }}>Powered by</span>
                <img src="/assets/badges/bota-badge.png" alt="Bota"
                  style={{ height: 16, opacity: theme === "dark" ? 0.7 : 0.5, filter: theme === "dark" ? "invert(1)" : "none" }} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <RoutePageShell
      title="Widget Builder"
      subtitle="Customize and deploy your AI chat widget"
      actions={
        <Button type="primary" icon={<CopyOutlined />} onClick={() => handleCopyCode(embedCode)} disabled={!selectedAgentId}>
          Copy Embed Code
        </Button>
      }
    >
      <Row gutter={24}>
        {/* ── Left: Configuration ────────────────────────────────────── */}
        <Col xs={24} lg={10}>
          {/* Agent selector — always visible */}
          <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: "10px 14px" } }}>
            <Flex align="center" gap={10}>
              <Typography.Text strong style={{ whiteSpace: "nowrap", fontSize: 13, color: "#374151" }}>Agent</Typography.Text>
              <Select
                placeholder="Choose an agent" value={selectedAgentId}
                onChange={id => {
                  setSelectedAgentId(id);
                  const a = agents.find(ag => ag.id === id);
                  if (a?.greeting_message) setGreeting(a.greeting_message);
                  setChatMessages([]);
                }}
                options={agents.map(a => ({ label: a.name, value: a.id }))}
                style={{ flex: 1 }} loading={loading}
                notFoundContent={loading ? "Loading..." : "No active agents"}
              />
            </Flex>
          </Card>

          {/* Tabbed config */}
          <Card size="small" styles={{ body: { padding: 0 } }}>
            <Tabs
              size="small"
              tabBarStyle={{ padding: "0 16px", margin: 0, borderBottom: "1px solid #f0f0f0" }}
              items={[
                {
                  key: "appearance",
                  label: "Appearance",
                  children: (
                    <div style={{ padding: "16px" }}>
                      <Form layout="vertical" size="small">
                        <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Layout</Typography.Text>
                        <Row gutter={12} style={{ marginTop: 8 }}>
                          <Col span={12}>
                            <Form.Item label="Mode" style={{ marginBottom: 10 }}>
                              <Select value={mode} onChange={v => setMode(v as WidgetMode)}
                                options={[
                                  { label: "Voice", value: "voice" },
                                  { label: "Chat", value: "chat" },
                                  { label: "Hybrid (Voice + Chat)", value: "hybrid" },
                                ]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Theme" style={{ marginBottom: 10 }}>
                              <Select value={theme} onChange={v => setTheme(v as WidgetTheme)}
                                options={[{ label: "Light", value: "light" }, { label: "Dark", value: "dark" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Size" style={{ marginBottom: 10 }}>
                              <Select value={widgetSize} onChange={v => setWidgetSize(v as WidgetSize)}
                                options={[{ label: "Tiny (icon only)", value: "tiny" }, { label: "Compact", value: "compact" }, { label: "Full", value: "full" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Border Radius" style={{ marginBottom: 10 }}>
                              <Select value={borderRadius} onChange={v => setBorderRadius(v as WidgetRadius)}
                                options={[{ label: "None", value: "none" }, { label: "Small", value: "small" }, { label: "Medium", value: "medium" }, { label: "Large", value: "large" }]} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="Position" style={{ marginBottom: 16 }}>
                              <Select value={position} onChange={v => setPosition(v as WidgetPosition)}
                                options={[{ label: "Bottom Right", value: "bottom-right" }, { label: "Bottom Left", value: "bottom-left" }, { label: "Bottom Center", value: "bottom-center" }]} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Colors</Typography.Text>
                        <Row gutter={12} style={{ marginTop: 8 }}>
                          <Col span={8}>
                            <Form.Item label="Accent" style={{ marginBottom: 0 }}>
                              <ColorPicker value={accentColor} onChange={c => setAccentColor(c.toHexString())} showText size="small" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item label="CTA Button" style={{ marginBottom: 0 }}>
                              <ColorPicker value={ctaButtonColor} onChange={c => setCtaButtonColor(c.toHexString())} showText size="small" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item label="CTA Text" style={{ marginBottom: 0 }}>
                              <ColorPicker value={ctaButtonTextColor} onChange={c => setCtaButtonTextColor(c.toHexString())} showText size="small" />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Form>
                    </div>
                  ),
                },
                {
                  key: "content",
                  label: "Content",
                  children: (
                    <div style={{ padding: "16px" }}>
                      <Form layout="vertical" size="small">
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item label="Widget Title" style={{ marginBottom: 10 }}>
                              <Input value={widgetTitle} onChange={e => setWidgetTitle(e.target.value)} />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item label="CTA Title" style={{ marginBottom: 10 }}>
                              <Input value={ctaTitle} onChange={e => setCtaTitle(e.target.value)} />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Form.Item label="CTA Subtitle" style={{ marginBottom: 10 }}>
                          <Input value={ctaSubtitle} onChange={e => setCtaSubtitle(e.target.value)} placeholder="Optional subtitle" />
                        </Form.Item>
                        <Form.Item label="Greeting / Empty State" style={{ marginBottom: 10 }}>
                          <Input.TextArea value={greeting} onChange={e => setGreeting(e.target.value)} rows={3} />
                        </Form.Item>
                        <Form.Item label="Chat Input Placeholder" style={{ marginBottom: 0 }}>
                          <Input value={chatPlaceholder} onChange={e => setChatPlaceholder(e.target.value)} />
                        </Form.Item>
                      </Form>
                    </div>
                  ),
                },
                {
                  key: "avatar",
                  label: "Avatar",
                  children: (
                    <div style={{ padding: "16px" }}>
                      <Flex align="center" gap={16}>
                        {/* Live preview */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img src={agentAvatarUrl} alt="Agent avatar"
                            style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: `3px solid ${accentColor}60` }} />
                          {agentAvatarUrl !== DEFAULT_AVATAR && (
                            <button onClick={() => setAgentAvatarUrl(DEFAULT_AVATAR)} title="Reset"
                              style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "#EF4444", border: "2px solid #fff", cursor: "pointer", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              ✕
                            </button>
                          )}
                        </div>
                        {/* Actions */}
                        <div style={{ flex: 1 }}>
                          <Typography.Text style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "#111827" }}>Agent Avatar</Typography.Text>
                          <Typography.Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 12, lineHeight: 1.4 }}>
                            Shown in the widget header, chat bubbles, and call screen.
                          </Typography.Text>
                          <input ref={avatarFileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                          <Space direction="vertical" style={{ width: "100%" }} size={8}>
                            <Button icon={<UploadOutlined />} onClick={() => avatarFileRef.current?.click()} block>
                              Upload Custom Image
                            </Button>
                            <Button icon={<UserOutlined />} onClick={() => setAgentAvatarUrl(DEFAULT_AVATAR)} block disabled={agentAvatarUrl === DEFAULT_AVATAR}>
                              Use Bota Default
                            </Button>
                          </Space>
                        </div>
                      </Flex>
                    </div>
                  ),
                },
                {
                  key: "settings",
                  label: "Settings",
                  children: (
                    <div style={{ padding: "16px" }}>
                      <Form layout="vertical" size="small">
                        {(mode === "voice" || mode === "hybrid") && (
                          <>
                            <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Voice</Typography.Text>
                            <div style={{ marginTop: 10, marginBottom: 16 }}>
                              <Flex align="center" justify="space-between">
                                <div>
                                  <Typography.Text style={{ fontSize: 13 }}>Show transcript during call</Typography.Text>
                                  <div style={{ fontSize: 12, color: "#6B7280" }}>Display live captions in voice mode</div>
                                </div>
                                <Switch checked={voiceShowTranscript} onChange={setVoiceShowTranscript} size="small" />
                              </Flex>
                            </div>
                          </>
                        )}
                        <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.5 }}>Behavior</Typography.Text>
                        <div style={{ marginTop: 10 }}>
                          <Flex align="center" justify="space-between">
                            <div>
                              <Typography.Text style={{ fontSize: 13 }}>Auto-open widget</Typography.Text>
                              <div style={{ fontSize: 12, color: "#6B7280" }}>Automatically expand on page load</div>
                            </div>
                            <Switch checked={autoOpen} onChange={setAutoOpen} size="small" />
                          </Flex>
                          {autoOpen && (
                            <Flex align="center" gap={8} style={{ marginTop: 10, padding: "10px 12px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                              <Typography.Text type="secondary" style={{ fontSize: 13 }}>Delay</Typography.Text>
                              <InputNumber min={1} max={30} value={autoOpenDelay} onChange={v => setAutoOpenDelay(v ?? 3)} size="small" style={{ width: 60 }} />
                              <Typography.Text type="secondary" style={{ fontSize: 13 }}>seconds</Typography.Text>
                            </Flex>
                          )}
                        </div>
                      </Form>
                    </div>
                  ),
                },
                {
                  key: "install",
                  label: "Install",
                  children: (
                    <div style={{ padding: "16px" }}>
                      <Tabs size="small" type="card" items={[
                        {
                          key: "script",
                          label: "Script Tag",
                          children: (
                            <div style={{ paddingTop: 10 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                                Paste once before <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>&lt;/body&gt;</code> — works on any HTML page.
                              </Typography.Text>
                              <div style={{ position: "relative" }}>
                                <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: "12px 40px 12px 12px", borderRadius: 8, fontSize: 11, overflow: "auto", margin: 0, lineHeight: 1.6 }}>{embedCode}</pre>
                                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyCode(embedCode)} disabled={!selectedAgentId} style={{ position: "absolute", top: 4, right: 4, color: "#888" }} />
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: "element",
                          label: "Custom Element",
                          children: (
                            <div style={{ paddingTop: 10 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                                Load the script once in <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>&lt;head&gt;</code>, then drop <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>&lt;bota-widget&gt;</code> anywhere.
                              </Typography.Text>
                              <div style={{ position: "relative" }}>
                                <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: "12px 40px 12px 12px", borderRadius: 8, fontSize: 11, overflow: "auto", margin: 0, lineHeight: 1.6 }}>{customElementCode}</pre>
                                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyCode(customElementCode)} disabled={!selectedAgentId} style={{ position: "absolute", top: 4, right: 4, color: "#888" }} />
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: "js",
                          label: "JavaScript API",
                          children: (
                            <div style={{ paddingTop: 10 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                                Initialize programmatically via <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>BotaWidget.init()</code> — useful for SPAs or conditional loading.
                              </Typography.Text>
                              <div style={{ position: "relative" }}>
                                <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: "12px 40px 12px 12px", borderRadius: 8, fontSize: 11, overflow: "auto", margin: 0, lineHeight: 1.6 }}>{programmaticCode}</pre>
                                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyCode(programmaticCode)} disabled={!selectedAgentId} style={{ position: "absolute", top: 4, right: 4, color: "#888" }} />
                              </div>
                            </div>
                          ),
                        },
                        {
                          key: "react",
                          label: "React",
                          children: (
                            <div style={{ paddingTop: 10 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                                Copy <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>BotaWidget.jsx</code> into your React project — no package install needed.
                              </Typography.Text>
                              <div style={{ position: "relative" }}>
                                <pre style={{ background: "#1e1e1e", color: "#d4d4d4", padding: "12px 40px 12px 12px", borderRadius: 8, fontSize: 11, overflow: "auto", margin: 0, lineHeight: 1.6 }}>{reactComponentCode}</pre>
                                <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopyCode(reactComponentCode)} disabled={!selectedAgentId} style={{ position: "absolute", top: 4, right: 4, color: "#888" }} />
                              </div>
                            </div>
                          ),
                        },
                      ]} />
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          <Button type="primary" block icon={<CheckCircleOutlined />} style={{ marginTop: 12 }}>Save Widget Settings</Button>
        </Col>

        {/* ── Right: Preview ─────────────────────────────────────────── */}
        <Col xs={24} lg={14}>
          <Card
            title="Live Preview"
            size="small"
            extra={
              <Space>
                <Segmented size="small" value={previewDevice} onChange={v => setPreviewDevice(v as "desktop" | "mobile")}
                  options={[{ value: "desktop", icon: <DesktopOutlined /> }, { value: "mobile", icon: <MobileOutlined /> }]}
                />
                <Button size="small" icon={<ReloadOutlined />} onClick={() => { setChatMessages([]); setCallActive(false); setConnecting(false); }}>
                  Reset
                </Button>
              </Space>
            }
            styles={{ body: { padding: 0 } }}
          >
                        {/* Preview frame */}
            {previewDevice === "desktop" ? (
              <div style={{ background: "#f3f4f6", minHeight: 680, borderRadius: "0 0 8px 8px", position: "relative", overflow: "hidden" }}>
                {/* Browser top bar */}
                <div style={{ height: 36, background: "#E5E7EB", display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F56" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFBD2E" }} />
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#27CA40" }} />
                  <div style={{ flex: 1, marginLeft: 12, background: "#fff", height: 20, borderRadius: 4, display: "flex", alignItems: "center", padding: "0 10px" }}>
                    <Typography.Text style={{ fontSize: 11, color: "#666" }}>yourwebsite.com</Typography.Text>
                  </div>
                </div>
                {/* Page skeleton */}
                <div style={{ padding: "16px 20px 0" }}>
                  <div style={{ background: "#D1D5DB", height: 12, width: "40%", borderRadius: 4, marginBottom: 10 }} />
                  <div style={{ background: "#E5E7EB", height: 8, width: "70%", borderRadius: 3, marginBottom: 8 }} />
                  <div style={{ background: "#E5E7EB", height: 8, width: "55%", borderRadius: 3 }} />
                </div>
                {renderWidgetOverlay({
                  topOffset: 36,
                  padding: "0 1.5rem 1.5rem",
                  align: position === "bottom-right" ? "flex-end" : position === "bottom-left" ? "flex-start" : "center",
                })}
              </div>
            ) : (
              /* Mobile: real iPhone 15 Pro mockup */
              <div style={{ background: "#94A3B8", minHeight: 780, borderRadius: "0 0 8px 8px", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 0" }}>
                {/*
                  Phone body in 5000×5000 image: x=[1550,3450] w=1900px, y=[200,4800] h=4600px
                  Scale = 300/1900 = 0.1579 → image display = 789×789px
                  Container = 300 × 726px  |  offset left=-245px top=-32px
                  Screen area (scaled bezels): left:5 right:5 top:8 bottom:3 borderRadius:47
                */}
              <div style={{ width: 300, height: 726, position: "relative", flexShrink: 0, overflow: "hidden", isolation: "isolate" }}>
                  {/* Screen content — sits behind the phone image overlay */}
                  <div style={{
                    position: "absolute",
                    left: 5, right: 5, top: 8, bottom: 3,
                    overflow: "hidden",
                    borderRadius: 47,
                    background: "#fff",
                  }}>
                    {/* Page skeleton visible when widget is closed */}
                    {!widgetOpen && (
                      <div style={{ position: "absolute", inset: 0, padding: "56px 14px 0", background: "#fff" }}>
                        <div style={{ background: "#D1D5DB", height: 10, width: "45%", borderRadius: 3, marginBottom: 8 }} />
                        <div style={{ background: "#E5E7EB", height: 7, width: "70%", borderRadius: 3, marginBottom: 6 }} />
                        <div style={{ background: "#E5E7EB", height: 7, width: "55%", borderRadius: 3 }} />
                      </div>
                    )}
                    {/* Widget overlay: FAB when closed, full-screen panel when open */}
                    {renderWidgetOverlay({
                      topOffset: 0,
                      padding: "0 0.75rem 0.75rem",
                      gap: 8,
                      align: "flex-end",
                      isMobileSize: true,
                    })}
                  </div>
                  {/* iPhone mockup image — mix-blend-mode: multiply makes white transparent,
                      revealing content below while keeping the dark frame visible */}
                  <img
                    src="/assets/mockups/iphone-mockup.jpg"
                    alt="iPhone frame"
                    style={{
                      position: "absolute",
                      width: 789, height: 789,
                      left: -245, top: -32,
                      pointerEvents: "none",
                      mixBlendMode: "multiply",
                      zIndex: 10,
                    }}
                  />
                </div>
              </div>
            )}

            {/* CSS */}
            <style>{`
              @keyframes vapiWidgetIn {
                from { opacity: 0; transform: scale(0.92) translateY(8px); }
                to   { opacity: 1; transform: scale(1) translateY(0); }
              }
              @keyframes voicePulse {
                0%, 100% { box-shadow: 0 0 0 0 ${accentColor}40; }
                50%       { box-shadow: 0 0 0 16px ${accentColor}00; }
              }
            `}</style>
          </Card>
        </Col>
      </Row>
    </RoutePageShell>
  );
}
