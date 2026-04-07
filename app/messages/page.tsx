"use client";

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EllipsisOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  SoundOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Empty,
  Input,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  Divider,
} from "antd";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RoutePageShell } from "@/app/_components/route-page-shell";

interface Handoff {
  id: string;
  status: "pending" | "accepted" | "resolved" | "expired";
  channel: string;
  reason: string | null;
  department: string | null;
  priority: string;
  summary: string | null;
  caller_number: string | null;
  assigned_to: string | null;
  created_at: string;
  accepted_at: string | null;
  resolved_at: string | null;
}

interface HandoffMessage {
  id: string;
  handoff_id: string;
  role: "agent" | "customer" | "system" | "ai_summary";
  content: string;
  sender_id: string | null;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  agent: { label: "You", color: "#17DEBC", icon: <UserOutlined /> },
  customer: { label: "Customer", color: "#52c41a", icon: <UserOutlined /> },
  system: { label: "System", color: "#8c8c8c", icon: <ClockCircleOutlined /> },
  ai_summary: { label: "AI Summary", color: "#6C5CE7", icon: <RobotOutlined /> },
};

const CHANNEL_ICONS: Record<string, string> = {
  web_chat: "/assets/icons/bota/mint/Messages-or-Chats_2.svg",
  phone: "/assets/icons/bota/mint/Call_3.svg",
  web_voice: "/assets/icons/bota/mint/Call_3.svg",
  whatsapp: "/assets/icons/bota/mint/Share_3.svg",
  email: "/assets/icons/bota/mint/Mail_3.svg",
  sms: "/assets/icons/bota/mint/Notification_3.svg",
  slack: "/assets/icons/bota/mint/Community_3.svg",
};

const CHANNEL_LABELS: Record<string, string> = {
  phone: "Phone Call",
  web_voice: "Web Voice",
  web_chat: "Web Chat",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
  slack: "Slack",
};

const CONNECT_CHANNELS = [
  { icon: "/assets/icons/bota/mint/Messages-or-Chats_2.svg", label: "Web Chat" },
  { icon: "/assets/icons/bota/mint/Share_3.svg", label: "WhatsApp" },
  { icon: "/assets/icons/bota/mint/Mail_3.svg", label: "Email" },
  { icon: "/assets/icons/bota/mint/Community_3.svg", label: "Slack" },
  { icon: "/assets/icons/bota/mint/Call_3.svg", label: "Phone" },
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MessagesPageContent() {
  const { message: toast } = AntdApp.useApp();
  const searchParams = useSearchParams();
  const preselectedHandoffId = searchParams.get("handoff");

  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [selectedHandoffId, setSelectedHandoffId] = useState<string | null>(preselectedHandoffId);
  const [messages, setMessages] = useState<HandoffMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHandoffs = useCallback(async () => {
    try {
      const [acceptedRes, pendingRes, resolvedRes] = await Promise.all([
        fetch("/api/handoffs?status=accepted&limit=50"),
        fetch("/api/handoffs?status=pending&limit=20"),
        fetch("/api/handoffs?status=resolved&limit=20"),
      ]);

      const accepted = acceptedRes.ok ? ((await acceptedRes.json()) as { handoffs: Handoff[] }).handoffs : [];
      const pending = pendingRes.ok ? ((await pendingRes.json()) as { handoffs: Handoff[] }).handoffs : [];
      const resolved = resolvedRes.ok ? ((await resolvedRes.json()) as { handoffs: Handoff[] }).handoffs : [];

      setHandoffs([...accepted, ...pending, ...resolved]);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessages = useCallback(async (handoffId: string) => {
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/handoffs/${handoffId}/messages`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = (await response.json()) as { messages: HandoffMessage[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHandoffs();
  }, [fetchHandoffs]);

  useEffect(() => {
    if (selectedHandoffId) {
      fetchMessages(selectedHandoffId);
      const interval = setInterval(() => fetchMessages(selectedHandoffId), 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [selectedHandoffId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedHandoff = useMemo(
    () => handoffs.find((h) => h.id === selectedHandoffId) ?? null,
    [handoffs, selectedHandoffId]
  );

  const filteredHandoffs = useMemo(
    () => filterStatus === "all" ? handoffs : handoffs.filter((h) => h.status === filterStatus),
    [handoffs, filterStatus]
  );

  const sendReply = async () => {
    if (!replyText.trim() || !selectedHandoffId) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/handoffs/${selectedHandoffId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText.trim(), role: "agent" }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to send message");
      }

      setReplyText("");
      await fetchMessages(selectedHandoffId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSendingMessage(false);
    }
  };

  const resolveHandoff = async (handoffId: string) => {
    setResolvingId(handoffId);
    try {
      const response = await fetch("/api/handoffs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: handoffId, action: "resolve" }),
      });

      if (!response.ok) throw new Error("Failed to resolve");
      toast.success("Handoff resolved.");
      await fetchHandoffs();
    } catch {
      toast.error("Failed to resolve handoff.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <RoutePageShell title="Messages" hideBuilderPanel nativeContent>
      <div className="inbox-layout">
        {/* ── Left sidebar: conversation list ── */}
        <aside className="inbox-sidebar">
          {/* Sidebar header */}
          <div className="inbox-sidebar-header">
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "accepted", label: "Active" },
                  { key: "resolved", label: "Resolved" },
                ],
                onClick: ({ key }) => setFilterStatus(key),
                selectedKeys: [filterStatus],
              }}
            >
              <Button type="text" size="small" style={{ fontWeight: 600, fontSize: 13 }}>
                {filterStatus === "all" ? "All" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} <FilterOutlined />
              </Button>
            </Dropdown>

            <Space size={4}>
              <Tooltip title="Filters">
                <Button type="text" size="small" icon={<SearchOutlined />} />
              </Tooltip>
              <Tooltip title="Refresh">
                <Button type="text" size="small" icon={<ReloadOutlined />} onClick={fetchHandoffs} loading={loading} />
              </Tooltip>
              <Tooltip title="New conversation">
                <Button type="text" size="small" icon={<PlusOutlined />} />
              </Tooltip>
            </Space>
          </div>

          {/* Conversation list */}
          <div className="inbox-conversation-list">
            {loading ? (
              <Spin style={{ display: "block", margin: "40px auto" }} />
            ) : filteredHandoffs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  No conversations
                </Typography.Text>
              </div>
            ) : (
              filteredHandoffs.map((h) => {
                const isSelected = h.id === selectedHandoffId;
                const channelIcon = CHANNEL_ICONS[h.channel] ?? CHANNEL_ICONS.web_chat;
                const label = CHANNEL_LABELS[h.channel] ?? h.channel;
                const preview = h.reason || h.summary || "No message preview";
                const isPending = h.status === "pending";

                return (
                  <div
                    key={h.id}
                    className={`inbox-conversation-item${isSelected ? " inbox-conversation-item--active" : ""}`}
                    onClick={() => setSelectedHandoffId(h.id)}
                  >
                    <Avatar
                      size={36}
                      icon={<img src={channelIcon} alt="" width={20} height={20} style={{ objectFit: "contain" }} />}
                      style={{ background: isSelected ? "#E6FBF8" : "#F1F5F9", flexShrink: 0 }}
                    />
                    <div className="inbox-conversation-item-body">
                      <div className="inbox-conversation-item-top">
                        <Typography.Text strong={isPending} ellipsis style={{ fontSize: 13, maxWidth: 140 }}>
                          {h.caller_number || label}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                          {timeAgo(h.created_at)}
                        </Typography.Text>
                      </div>
                      <div className="inbox-conversation-item-bottom">
                        <Typography.Text
                          type="secondary"
                          ellipsis
                          style={{ fontSize: 12, flex: 1, maxWidth: 160 }}
                        >
                          {preview}
                        </Typography.Text>
                        {isPending && (
                          <Badge count={1} size="small" style={{ backgroundColor: "#FF4D4F" }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Channel connect card */}
          <div className="inbox-sidebar-footer">
            <div className="inbox-connect-card">
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {CONNECT_CHANNELS.map((ch) => (
                  <Tooltip key={ch.label} title={ch.label}>
                    <Avatar
                      size={28}
                      icon={<img src={ch.icon} alt={ch.label} width={16} height={16} style={{ objectFit: "contain" }} />}
                      style={{ background: "#F1F5F9", cursor: "pointer" }}
                    />
                  </Tooltip>
                ))}
              </div>
              <Typography.Text strong style={{ fontSize: 12, display: "block" }}>
                Connect messaging channels
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 8, lineHeight: 1.4 }}>
                Manage all your chats in one inbox by integrating with WhatsApp, email, Slack, and more.
              </Typography.Text>
              <Button
                type="primary"
                size="small"
                href="/apps"
                className="auth-submit-btn"
                style={{ height: 28, fontSize: 12, borderRadius: 6 }}
              >
                Get Started
              </Button>
            </div>
          </div>
        </aside>

        {/* ── Main chat area ── */}
        <section className="inbox-chat-area">
          {!selectedHandoff ? (
            <div className="inbox-empty-state">
              <img
                src="/bota-logo.png"
                alt="Botaplace"
                style={{ width: 48, height: 48, objectFit: "contain", marginBottom: 12, opacity: 0.7 }}
              />
              <Typography.Title level={4} style={{ color: "#94A3B8", fontWeight: 500, margin: 0 }}>
                Botaplace
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13, marginTop: 4 }}>
                Select a conversation to start messaging
              </Typography.Text>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="inbox-chat-header">
                <Space size={10}>
                  <Avatar
                    size={32}
                    icon={
                      <img
                        src={CHANNEL_ICONS[selectedHandoff.channel] ?? CHANNEL_ICONS.web_chat}
                        alt=""
                        width={18}
                        height={18}
                        style={{ objectFit: "contain" }}
                      />
                    }
                    style={{ background: "#E6FBF8" }}
                  />
                  <div>
                    <Typography.Text strong style={{ fontSize: 14, display: "block", lineHeight: 1.3 }}>
                      {selectedHandoff.caller_number || (CHANNEL_LABELS[selectedHandoff.channel] ?? selectedHandoff.channel)}
                    </Typography.Text>
                    <Space size={6}>
                      <Tag
                        color={
                          selectedHandoff.status === "accepted"
                            ? "green"
                            : selectedHandoff.status === "pending"
                              ? "orange"
                              : "default"
                        }
                        style={{ fontSize: 10, margin: 0, lineHeight: "18px" }}
                      >
                        {selectedHandoff.status}
                      </Tag>
                      {selectedHandoff.department && (
                        <Tag style={{ fontSize: 10, margin: 0, lineHeight: "18px" }}>
                          {selectedHandoff.department}
                        </Tag>
                      )}
                    </Space>
                  </div>
                </Space>

                <Space size={8}>
                  {selectedHandoff.status === "accepted" && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      loading={resolvingId === selectedHandoff.id}
                      onClick={() => resolveHandoff(selectedHandoff.id)}
                      style={{ borderRadius: 6 }}
                    >
                      Resolve
                    </Button>
                  )}
                  <Button type="text" size="small" icon={<EllipsisOutlined />} />
                </Space>
              </div>

              {/* Messages */}
              <div className="inbox-messages-scroll">
                {/* AI summary card */}
                {selectedHandoff.summary && (
                  <div className="inbox-ai-summary">
                    <Space size={6} style={{ marginBottom: 4 }}>
                      <RobotOutlined style={{ color: "#6C5CE7", fontSize: 12 }} />
                      <Typography.Text style={{ fontSize: 11, color: "#6C5CE7", fontWeight: 600 }}>
                        AI Summary
                      </Typography.Text>
                    </Space>
                    <Typography.Text style={{ fontSize: 12, color: "#475569", display: "block" }}>
                      {selectedHandoff.summary}
                    </Typography.Text>
                  </div>
                )}

                {messagesLoading && messages.length === 0 ? (
                  <Spin style={{ display: "block", margin: "60px auto" }} />
                ) : messages.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No messages yet. Send the first reply."
                    style={{ margin: "60px auto" }}
                  />
                ) : (
                  messages.map((msg) => {
                    const roleConfig = ROLE_CONFIG[msg.role] ?? ROLE_CONFIG.system;
                    const isAgent = msg.role === "agent";
                    return (
                      <div
                        key={msg.id}
                        className={`inbox-msg ${isAgent ? "inbox-msg--agent" : "inbox-msg--other"}`}
                      >
                        <div className={`inbox-msg-bubble ${isAgent ? "inbox-msg-bubble--agent" : msg.role === "ai_summary" ? "inbox-msg-bubble--ai" : "inbox-msg-bubble--other"}`}>
                          <div className="inbox-msg-meta">
                            <span style={{ fontSize: 11, opacity: 0.6 }}>{roleConfig.icon}</span>
                            <Typography.Text style={{ fontSize: 11, color: isAgent ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.4)" }}>
                              {roleConfig.label} · {formatTime(msg.created_at)}
                            </Typography.Text>
                          </div>
                          <div style={{ fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{msg.content}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              {(selectedHandoff.status === "accepted" || selectedHandoff.status === "pending") && (
                <div className="inbox-reply-bar">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onPressEnter={sendReply}
                    placeholder="Type a reply to the customer..."
                    disabled={sendingMessage}
                    variant="borderless"
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <Button
                    type="primary"
                    shape="circle"
                    icon={<SendOutlined />}
                    onClick={sendReply}
                    loading={sendingMessage}
                    disabled={!replyText.trim()}
                    size="small"
                    style={{ flexShrink: 0 }}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Right details panel ── */}
        <aside className="inbox-details">
          {!selectedHandoff ? (
            <div className="inbox-details-empty">
              <InfoCircleOutlined style={{ fontSize: 24, color: "#CBD5E1" }} />
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                Select a conversation to view details
              </Typography.Text>
            </div>
          ) : (
            <>
              <div className="inbox-details-header">
                <Avatar
                  size={44}
                  icon={
                    <img
                      src={CHANNEL_ICONS[selectedHandoff.channel] ?? CHANNEL_ICONS.web_chat}
                      alt=""
                      width={24}
                      height={24}
                      style={{ objectFit: "contain" }}
                    />
                  }
                  style={{ background: "#E6FBF8" }}
                />
                <Typography.Text strong style={{ fontSize: 14, marginTop: 8, display: "block" }}>
                  {selectedHandoff.caller_number || (CHANNEL_LABELS[selectedHandoff.channel] ?? selectedHandoff.channel)}
                </Typography.Text>
                <Tag
                  color={
                    selectedHandoff.status === "accepted"
                      ? "green"
                      : selectedHandoff.status === "pending"
                        ? "orange"
                        : selectedHandoff.status === "resolved"
                          ? "default"
                          : "red"
                  }
                  style={{ marginTop: 6 }}
                >
                  {selectedHandoff.status.charAt(0).toUpperCase() + selectedHandoff.status.slice(1)}
                </Tag>
              </div>

              <Divider style={{ margin: "12px 0" }} />

              <div className="inbox-details-section">
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Request Details
                </Typography.Text>

                <div className="inbox-details-row">
                  <img src={CHANNEL_ICONS[selectedHandoff.channel] ?? CHANNEL_ICONS.web_chat} alt="" width={14} height={14} style={{ objectFit: "contain" }} />
                  <Typography.Text style={{ fontSize: 12 }}>Channel</Typography.Text>
                  <Typography.Text strong style={{ fontSize: 12, marginLeft: "auto" }}>
                    {CHANNEL_LABELS[selectedHandoff.channel] ?? selectedHandoff.channel}
                  </Typography.Text>
                </div>

                <div className="inbox-details-row">
                  <img src="/assets/icons/bota/mint/Great-Progress_3.svg" alt="" width={14} height={14} style={{ objectFit: "contain" }} />
                  <Typography.Text style={{ fontSize: 12 }}>Priority</Typography.Text>
                  <Tag
                    color={selectedHandoff.priority === "urgent" ? "red" : selectedHandoff.priority === "high" ? "orange" : "default"}
                    style={{ fontSize: 11, margin: 0, marginLeft: "auto" }}
                  >
                    {selectedHandoff.priority}
                  </Tag>
                </div>

                {selectedHandoff.department && (
                  <div className="inbox-details-row">
                    <TeamOutlined style={{ fontSize: 14, color: "#17DEBC" }} />
                    <Typography.Text style={{ fontSize: 12 }}>Department</Typography.Text>
                    <Typography.Text strong style={{ fontSize: 12, marginLeft: "auto" }}>
                      {selectedHandoff.department}
                    </Typography.Text>
                  </div>
                )}

                {selectedHandoff.assigned_to && (
                  <div className="inbox-details-row">
                    <UserOutlined style={{ fontSize: 14, color: "#17DEBC" }} />
                    <Typography.Text style={{ fontSize: 12 }}>Assigned To</Typography.Text>
                    <Typography.Text strong style={{ fontSize: 12, marginLeft: "auto" }}>
                      {selectedHandoff.assigned_to}
                    </Typography.Text>
                  </div>
                )}
              </div>

              {selectedHandoff.reason && (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <div className="inbox-details-section">
                    <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Reason for Transfer
                    </Typography.Text>
                    <Typography.Paragraph style={{ fontSize: 12, margin: "6px 0 0", color: "#475569" }}>
                      {selectedHandoff.reason}
                    </Typography.Paragraph>
                  </div>
                </>
              )}

              {selectedHandoff.summary && (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <div className="inbox-details-section">
                    <Space size={4}>
                      <RobotOutlined style={{ fontSize: 12, color: "#6C5CE7" }} />
                      <Typography.Text style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#6C5CE7" }}>
                        AI Summary
                      </Typography.Text>
                    </Space>
                    <Typography.Paragraph style={{ fontSize: 12, margin: "6px 0 0", color: "#475569" }}>
                      {selectedHandoff.summary}
                    </Typography.Paragraph>
                  </div>
                </>
              )}

              <Divider style={{ margin: "12px 0" }} />

              <div className="inbox-details-section">
                <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Timestamps
                </Typography.Text>

                <div className="inbox-details-row">
                  <ClockCircleOutlined style={{ fontSize: 12, color: "#94A3B8" }} />
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>Created</Typography.Text>
                  <Typography.Text style={{ fontSize: 11, marginLeft: "auto" }}>
                    {new Date(selectedHandoff.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </Typography.Text>
                </div>

                {selectedHandoff.accepted_at && (
                  <div className="inbox-details-row">
                    <CheckCircleOutlined style={{ fontSize: 12, color: "#52c41a" }} />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>Accepted</Typography.Text>
                    <Typography.Text style={{ fontSize: 11, marginLeft: "auto" }}>
                      {new Date(selectedHandoff.accepted_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Typography.Text>
                  </div>
                )}

                {selectedHandoff.resolved_at && (
                  <div className="inbox-details-row">
                    <CheckCircleOutlined style={{ fontSize: 12, color: "#17DEBC" }} />
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>Resolved</Typography.Text>
                    <Typography.Text style={{ fontSize: 11, marginLeft: "auto" }}>
                      {new Date(selectedHandoff.resolved_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Typography.Text>
                  </div>
                )}
              </div>

              {selectedHandoff.status === "accepted" && (
                <>
                  <Divider style={{ margin: "12px 0" }} />
                  <Button
                    block
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={resolvingId === selectedHandoff.id}
                    onClick={() => resolveHandoff(selectedHandoff.id)}
                    style={{ borderRadius: 8 }}
                  >
                    Resolve Conversation
                  </Button>
                </>
              )}
            </>
          )}
        </aside>
      </div>
    </RoutePageShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<RoutePageShell title="Messages" hideBuilderPanel nativeContent><Spin size="large" style={{ display: "flex", justifyContent: "center", marginTop: 100 }} /></RoutePageShell>}>
      <MessagesPageContent />
    </Suspense>
  );
}
