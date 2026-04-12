"use client";

import {
  AuditOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DownloadOutlined,
  ExportOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Input,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { InputRef } from "antd";
// Note: Col, Row, Statistic kept for detail drawer Insights tab
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";
import { InsightsTab } from "./_components/insights-tab";
import { CostTab } from "./_components/cost-tab";
import { CallAnalysisTab } from "./_components/call-analysis-tab";
import { getAgentAvatarUrl } from "@/lib/utils/agent-avatar";

dayjs.extend(relativeTime);
dayjs.extend(duration);

/* ── Types ── */

interface ConversationRecord {
  id: string;
  agent: string;
  agentAvatarUrl?: string | null;
  agentId?: string | null;
  channel: string;
  user: string;
  durationSeconds: number;
  messagesCount: number;
  date: string;
  preview: string;
}

interface MessageRecord {
  id: string;
  role: string;
  content: string | null;
  audio_url?: string | null;
  tool_calls?: { name?: string; args?: Record<string, unknown>; result?: unknown; success?: boolean } | null;
  created_at: string;
}

interface ConversationDetailPayload {
  conversation: {
    id: string;
    agent_id: string;
    channel: string;
    external_user_id: string | null;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    metadata: Record<string, unknown> | null;
    agentName: string;
  };
  messages: MessageRecord[];
}

/* ── Constants ── */

// CDN icons for channels - consistent across the app
const CHANNEL_CDN_ICONS: Record<string, string> = {
  web_chat: "https://api.iconify.design/mdi:chat.svg?color=%234096ff",
  web_voice: "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a",
  phone: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
  whatsapp: "https://api.iconify.design/logos:whatsapp-icon.svg",
  sms: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
  email: "https://api.iconify.design/mdi:email.svg?color=%23f5222d",
  slack: "https://api.iconify.design/logos:slack-icon.svg",
};

const channelColor: Record<string, string> = {
  web_chat: "#4096ff",
  web_voice: "#52c41a",
  phone: "#722ed1",
  whatsapp: "#25D366",
  sms: "#faad14",
  email: "#f5222d",
  slack: "#4A154B",
};

const channelBgColor: Record<string, string> = {
  web_chat: "#e6f4ff",
  web_voice: "#f6ffed",
  phone: "#f9f0ff",
  whatsapp: "#dcf8c6",
  sms: "#fffbe6",
  email: "#fff2f0",
  slack: "#f0e6f6",
};

const channelLabel: Record<string, string> = {
  web_chat: "Web Chat",
  web_voice: "Voice",
  phone: "Phone",
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  slack: "Slack",
};

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ── Channel Badge Component ── */

function ChannelBadge({ channel }: { channel: string }) {
  const icon = CHANNEL_CDN_ICONS[channel];
  const label = channelLabel[channel] ?? channel;
  const textColor = channelColor[channel] ?? "#666";

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon && <img src={icon} alt={label} style={{ width: 14, height: 14 }} />}
      <Typography.Text style={{ fontSize: 13, fontWeight: 500, color: textColor }}>
        {label}
      </Typography.Text>
    </div>
  );
}

/* ── Chat Bubble ── */

function ChatBubble({ msg, agentName }: { msg: MessageRecord; agentName: string }) {
  const isUser = msg.role === "user";
  const isTool = msg.role === "tool";

  // Parse tool call details
  const tc = isTool ? msg.tool_calls : null;
  const toolName = tc?.name ?? (msg.content?.match(/^Calling (\S+)/)?.[1]);
  const isCompleted = msg.content?.includes("completed");
  const isFailed = msg.content?.includes("failed");
  const isExecuting = !isCompleted && !isFailed && msg.content?.startsWith("Calling");

  if (isTool) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginBlock: 12 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            borderRadius: 20,
            background: isFailed ? "#fff2f0" : isCompleted ? "#f6ffed" : "#fff7e6",
            border: `1px solid ${isFailed ? "#ffccc7" : isCompleted ? "#b7eb8f" : "#ffe58f"}`,
            fontSize: 13,
          }}
        >
          {isFailed ? (
            <CloseCircleFilled style={{ color: "#ff4d4f" }} />
          ) : isCompleted ? (
            <CheckCircleFilled style={{ color: "#52c41a" }} />
          ) : isExecuting ? (
            <LoadingOutlined style={{ color: "#fa8c16" }} />
          ) : (
            <ToolOutlined style={{ color: "#fa8c16" }} />
          )}
          <Typography.Text strong style={{ fontSize: 13 }}>
            {toolName ? formatToolName(toolName) : "Tool call"}
          </Typography.Text>
          <Tag
            color={isFailed ? "error" : isCompleted ? "success" : "warning"}
            style={{ margin: 0, fontSize: 11 }}
          >
            {isFailed ? "Failed" : isCompleted ? "Completed" : isExecuting ? "Executing" : "Tool"}
          </Tag>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(msg.created_at).format("h:mm:ss A")}
          </Typography.Text>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "10px 14px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          background: isUser
            ? "linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)"
            : "#f0f2f5",
          color: isUser ? "#fff" : "#1a1a2e",
          fontSize: 14,
          lineHeight: 1.6,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <span style={{ whiteSpace: "pre-wrap" }}>{msg.content ?? ""}</span>
      </div>
      <Typography.Text
        type="secondary"
        style={{ fontSize: 11, marginTop: 4, paddingInline: 4 }}
      >
        {isUser ? "User" : agentName} &middot;{" "}
        {dayjs(msg.created_at).format("MMM D, YYYY, h:mm:ss A")}
      </Typography.Text>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Gmail /i, "Gmail: ")
    .replace(/^Googlecalendar /i, "Calendar: ");
}

/* ── Audio Player (simple HTML5) ── */

function AudioPlayer({ messages, recordingUrl }: { messages: MessageRecord[]; recordingUrl?: string | null }) {
  const audioUrl = recordingUrl || messages.find((m) => m.audio_url)?.audio_url;
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const handleSpeedChange = useCallback((val: string | number) => {
    const s = Number(val);
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }, []);

  if (!audioUrl) {
    return (
      <Card
        size="small"
        style={{
          background: "linear-gradient(135deg, #667eea11 0%, #764ba211 100%)",
          border: "1px dashed #d9d9d9",
          textAlign: "center",
        }}
      >
        <Space orientation="vertical" align="center" size={4}>
          <SoundOutlined style={{ fontSize: 24, color: "#999" }} />
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            No audio recording available for this conversation
          </Typography.Text>
        </Space>
      </Card>
    );
  }

  return (
    <Card size="small" style={{ background: "#fafbfc" }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDur(audioRef.current?.duration ?? 0)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <Flex align="center" gap={12}>
        <Button
          type="text"
          shape="circle"
          size="large"
          icon={
            playing ? (
              <PauseCircleOutlined style={{ fontSize: 28, color: "#6C5CE7" }} />
            ) : (
              <PlayCircleOutlined style={{ fontSize: 28, color: "#6C5CE7" }} />
            )
          }
          onClick={togglePlay}
        />

        <div style={{ flex: 1 }}>
          <div
            style={{
              height: 40,
              background: "linear-gradient(135deg, #e8eaf622 0%, #f0f2f5 100%)",
              borderRadius: 8,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: dur > 0 ? `${(currentTime / dur) * 100}%` : "0%",
                background: "linear-gradient(90deg, #6C5CE7 0%, #a29bfe 100%)",
                borderRadius: 8,
                transition: "width 0.3s linear",
                opacity: 0.2,
              }}
            />
            {/* Waveform placeholder bars */}
            <Flex
              align="center"
              justify="center"
              gap={1}
              style={{ height: "100%", padding: "0 8px" }}
            >
              {Array.from({ length: 80 }).map((_, i) => {
                const h = 8 + Math.sin(i * 0.4) * 12 + Math.random() * 8;
                const played = dur > 0 && (i / 80) * dur <= currentTime;
                return (
                  <div
                    key={i}
                    style={{
                      width: 2,
                      height: h,
                      borderRadius: 1,
                      background: played ? "#6C5CE7" : "#c4c4c4",
                      opacity: played ? 0.9 : 0.4,
                      transition: "background 0.2s",
                    }}
                  />
                );
              })}
            </Flex>
          </div>
        </div>

        <Segmented
          size="small"
          value={speed}
          options={[
            { label: "1x", value: 1 },
            { label: "1.5x", value: 1.5 },
            { label: "2x", value: 2 },
          ]}
          onChange={handleSpeedChange}
        />

        <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 90, textAlign: "right" }}>
          {fmtDuration(currentTime)} / {fmtDuration(dur)}
        </Typography.Text>

        {audioUrl && (
          <Tooltip title="Download">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              href={audioUrl}
              target="_blank"
            />
          </Tooltip>
        )}
      </Flex>
    </Card>
  );
}

/* ── Channel Filter Chips ── */

const CHANNEL_FILTERS = [
  { key: "all", label: "All Channels" },
  { key: "web_chat", label: "Web Chat" },
  { key: "web_voice", label: "Voice" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "sms", label: "SMS" },
  { key: "email", label: "Email" },
  { key: "slack", label: "Slack" },
];

/* ── Main Page ── */

export default function ConversationsPage() {
  const { message } = AntdApp.useApp();
  const [rows, setRows] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ConversationRecord | null>(null);
  const [detail, setDetail] = useState<ConversationDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const searchRef = useRef<InputRef>(null);

  /* Load list */
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | { conversations?: ConversationRecord[]; error?: string }
        | null;
      if (!res.ok) throw new Error(body?.error ?? "Failed to load conversations.");
      setRows(body?.conversations ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load conversations.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  /* Load detail */
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let active = true;
    const load = async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/conversations?conversationId=${selected.id}`, { cache: "no-store" });
        const body = (await res.json().catch(() => null)) as
          | (ConversationDetailPayload & { error?: string })
          | null;
        if (!res.ok) throw new Error(body?.error ?? "Failed to load transcript.");
        if (active) setDetail(body);
      } catch (err) {
        message.error(err instanceof Error ? err.message : "Failed to load transcript.");
      } finally {
        if (active) setDetailLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [message, selected]);

  /* Filters */
  const channelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      counts[r.channel] = (counts[r.channel] ?? 0) + 1;
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (channelFilter !== "all") {
      result = result.filter((r) => r.channel === channelFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.agent.toLowerCase().includes(q) ||
          r.user.toLowerCase().includes(q) ||
          r.channel.toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, searchQuery, channelFilter]);

  /* Table columns */
  const columns: ColumnsType<ConversationRecord> = useMemo(
    () => [
      {
        title: "Agent",
        dataIndex: "agent",
        key: "agent",
        render: (name: string, record: ConversationRecord) => (
          <Space size={10}>
            <Avatar
              size={36}
              src={getAgentAvatarUrl(record.agentId ?? record.id, record.agentAvatarUrl)}
              style={{ background: "#e8e8e8", flexShrink: 0 }}
            />
            <div>
              <Typography.Text strong style={{ fontSize: 13, display: "block" }}>
                {name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                AI Agent
              </Typography.Text>
            </div>
          </Space>
        ),
      },
      {
        title: "Channel",
        dataIndex: "channel",
        key: "channel",
        width: 120,
        render: (ch: string) => <ChannelBadge channel={ch} />,
        filters: [
          { text: "Web Chat", value: "web_chat" },
          { text: "Voice", value: "web_voice" },
          { text: "Phone", value: "phone" },
          { text: "WhatsApp", value: "whatsapp" },
          { text: "SMS", value: "sms" },
          { text: "Email", value: "email" },
          { text: "Slack", value: "slack" },
        ],
        onFilter: (val, record) => record.channel === String(val),
      },
      {
        title: "User",
        dataIndex: "user",
        key: "user",
        render: (user: string) => (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {user === "anonymous" ? "Anonymous" : user}
          </Typography.Text>
        ),
      },
      {
        title: "Duration",
        dataIndex: "durationSeconds",
        key: "durationSeconds",
        width: 100,
        render: (sec: number) => (
          <Space size={5}>
            <img src="/assets/icons/bota/black/Call_1.svg" alt="" width={13} height={13} style={{ opacity: 0.45, display: "block" }} />
            <Typography.Text style={{ fontSize: 13, fontFamily: "monospace", color: "#6B7280" }}>
              {fmtDuration(sec)}
            </Typography.Text>
          </Space>
        ),
        sorter: (a, b) => a.durationSeconds - b.durationSeconds,
      },
      {
        title: "Messages",
        dataIndex: "messagesCount",
        key: "messagesCount",
        width: 110,
        render: (count: number) => (
          <Space size={5}>
            <img src="/assets/icons/bota/black/Messages-or-Chats_1.svg" alt="" width={13} height={13} style={{ opacity: 0.45, display: "block" }} />
            <Typography.Text style={{ fontSize: 13, color: "#6B7280" }}>
              {count} msgs
            </Typography.Text>
          </Space>
        ),
        sorter: (a, b) => a.messagesCount - b.messagesCount,
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "date",
        width: 140,
        render: (val: string) => (
          <Tooltip title={dayjs(val).format("MMM D, YYYY h:mm A")}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {dayjs(val).fromNow()}
            </Typography.Text>
          </Tooltip>
        ),
        sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
        defaultSortOrder: "descend",
      },
    ],
    [],
  );

  /* Detail drawer tabs */
  const drawerTitle = detail
    ? `Conversation with ${detail.conversation.agentName}`
    : selected
    ? `Conversation with ${selected.agent}`
    : "Conversation";

  const drawerSubtitle = detail
    ? dayjs(detail.conversation.started_at).format("MMM D, YYYY, h:mm:ss A")
    : selected
    ? dayjs(selected.date).format("MMM D, YYYY, h:mm:ss A")
    : "";

  const isVoice =
    selected?.channel === "web_voice" ||
    selected?.channel === "phone";

  return (
    <RoutePageShell
      title="Conversations"
      subtitle="Search and inspect transcripts across all channels"
      actions={
        <Button
          icon={<ExportOutlined />}
          style={{
            background: "#111827", color: "#fff", border: "none",
            borderRadius: 20, fontWeight: 500, fontSize: 13,
            height: 36, paddingLeft: 16, paddingRight: 16,
          }}
        >
          Export Conversations
        </Button>
      }
    >
      {/* Filter row: search + channel pills + refresh */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Search */}
        <Input
          ref={searchRef}
          prefix={<SearchOutlined style={{ color: "#9CA3AF", fontSize: 13 }} />}
          placeholder="Search by agent, user, or channel..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{
            width: 260, borderRadius: 20, height: 32, fontSize: 13,
            borderColor: searchQuery ? "#17DEBC" : undefined,
          }}
        />

        {/* Channel filter pills */}
        {CHANNEL_FILTERS.map((filter) => {
          const isSelected = channelFilter === filter.key;
          const icon = CHANNEL_CDN_ICONS[filter.key];
          const count = filter.key === "all"
            ? Object.values(channelCounts).reduce((a, b) => a + b, 0)
            : channelCounts[filter.key] ?? 0;
          const activeColor = channelColor[filter.key] ?? "#374151";
          const activeBg = channelBgColor[filter.key] ?? "#F0FDF4";

          return (
            <button
              key={filter.key}
              onClick={() => setChannelFilter(filter.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 32, paddingLeft: 12, paddingRight: 12,
                borderRadius: 20,
                border: `1px solid ${isSelected ? activeColor : "#D1D5DB"}`,
                background: isSelected ? activeBg : "#fff",
                cursor: "pointer",
                fontWeight: isSelected ? 600 : 400,
                fontSize: 13,
                color: isSelected ? activeColor : "#374151",
                transition: "all 0.15s",
                outline: "none",
              }}
            >
              {icon && <img src={icon} alt="" style={{ width: 13, height: 13, flexShrink: 0 }} />}
              <span>{filter.label}</span>
              {count > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: isSelected ? activeColor : "#9CA3AF",
                  marginLeft: 1,
                }}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}

        {/* Refresh */}
        <Tooltip title="Refresh">
          <Button
            type="text"
            icon={<ReloadOutlined style={{ fontSize: 14, color: "#6B7280" }} />}
            style={{ width: 32, height: 32, borderRadius: "50%" }}
            onClick={() => void loadConversations()}
          />
        </Tooltip>
      </div>

      {/* Table */}
      {filteredRows.length === 0 && !loading ? (
        <div style={{ padding: "60px 0" }}>
          <Empty
            description={
              channelFilter !== "all"
                ? `No ${channelLabel[channelFilter] ?? channelFilter} conversations`
                : "No conversations yet"
            }
            image="/assets/illustrations/bota/conversations.svg"
            imageStyle={{ height: 80 }}
          />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} conversations`,
          }}
          rowKey="id"
          size="middle"
          style={{ borderRadius: 0 }}
          onRow={(record) => ({
            onClick: () => setSelected(record),
            style: { cursor: "pointer" },
            onMouseEnter: (e) => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; },
            onMouseLeave: (e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; },
          })}
          components={{
            header: {
              cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                <th
                  {...props}
                  style={{
                    ...((props as { style?: React.CSSProperties }).style),
                    background: "transparent",
                    color: "#6B7280",
                    fontWeight: 500,
                    fontSize: 13,
                    borderBottom: "1px solid #E5E7EB",
                    padding: "10px 16px",
                  }}
                />
              ),
            },
          }}
        />
      )}

      <style>{`
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #F3F4F6 !important;
          padding: 12px 16px !important;
          transition: background 0.1s;
        }
        .ant-table {
          border: none !important;
        }
        .ant-table-container {
          border: none !important;
          border-radius: 0 !important;
        }
        .ant-table-content table {
          border: none !important;
        }
      `}</style>

      {/* Detail Drawer */}
      <Drawer
        title={
          <div>
            <Typography.Text strong style={{ fontSize: 16 }}>{drawerTitle}</Typography.Text>
            {drawerSubtitle && (
              <Typography.Text
                type="secondary"
                style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 2 }}
              >
                {drawerSubtitle}
              </Typography.Text>
            )}
          </div>
        }
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        width={680}
        styles={{
          body: { padding: 0 },
        }}
      >
        {selected && (
          <Tabs
            defaultActiveKey="conversation"
            style={{ paddingInline: 24 }}
            items={[
              {
                key: "conversation",
                label: "Conversation",
                children: (
                  <div style={{ paddingBottom: 24 }}>
                    {/* Audio Player */}
                    {isVoice && (
                      <div style={{ marginBottom: 20 }}>
                        <AudioPlayer
                          messages={detail?.messages ?? []}
                          recordingUrl={(detail?.conversation.metadata as Record<string, unknown>)?.recording_url as string | undefined}
                        />
                      </div>
                    )}

                    {/* Export */}
                    <Flex justify="flex-end" style={{ marginBottom: 12 }}>
                      <Button size="small" icon={<ExportOutlined />}>
                        Export to CSV
                      </Button>
                    </Flex>

                    {/* Chat Bubbles */}
                    {detailLoading ? (
                      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                        <Skeleton active paragraph={{ rows: 3 }} />
                        <Skeleton active paragraph={{ rows: 2 }} />
                      </Space>
                    ) : (detail?.messages ?? []).length === 0 ? (
                      <Empty description="No messages in this conversation" />
                    ) : (
                      <div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto", paddingRight: 4 }}>
                        {(detail?.messages ?? []).map((msg) => (
                          <ChatBubble
                            key={msg.id}
                            msg={msg}
                            agentName={detail?.conversation.agentName ?? selected.agent}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "insights",
                label: "Insights",
                children: (
                  <InsightsTab
                    conversationId={selected.id}
                    messagesCount={detail?.messages.length ?? selected.messagesCount}
                    durationSeconds={detail?.conversation.duration_seconds ?? selected.durationSeconds}
                    userMessagesCount={detail?.messages.filter((m) => m.role === "user").length ?? 0}
                    agentMessagesCount={detail?.messages.filter((m) => m.role === "assistant").length ?? 0}
                  />
                ),
              },
              {
                key: "call-analysis",
                label: (
                  <Space size={6}>
                    <AuditOutlined />
                    Call Analysis
                  </Space>
                ),
                children: (
                  <CallAnalysisTab
                    conversationId={selected.id}
                    channel={selected.channel}
                  />
                ),
              },
              {
                key: "cost",
                label: "Cost",
                children: <CostTab conversationId={selected.id} />,
              },
              {
                key: "metadata",
                label: "Metadata",
                children: (
                  <div style={{ padding: "16px 0" }}>
                    <Descriptions column={1} bordered size="small" style={{ borderRadius: 10 }}>
                      <Descriptions.Item label="Conversation ID">
                        <Typography.Text copyable code style={{ fontSize: 12 }}>
                          {selected.id}
                        </Typography.Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Agent">
                        {detail?.conversation.agentName ?? selected.agent}
                      </Descriptions.Item>
                      <Descriptions.Item label="Channel">
                        <ChannelBadge channel={selected.channel} />
                      </Descriptions.Item>
                      <Descriptions.Item label="User">
                        {detail?.conversation.external_user_id ?? selected.user}
                      </Descriptions.Item>
                      <Descriptions.Item label="Started">
                        {detail
                          ? dayjs(detail.conversation.started_at).format("MMM D, YYYY h:mm:ss A")
                          : dayjs(selected.date).format("MMM D, YYYY h:mm:ss A")}
                      </Descriptions.Item>
                      <Descriptions.Item label="Ended">
                        {detail?.conversation.ended_at
                          ? dayjs(detail.conversation.ended_at).format("MMM D, YYYY h:mm:ss A")
                          : "—"}
                      </Descriptions.Item>
                      <Descriptions.Item label="Duration">
                        {fmtDuration(detail?.conversation.duration_seconds ?? selected.durationSeconds)}
                      </Descriptions.Item>
                      {detail?.conversation.metadata && (
                        <Descriptions.Item label="Custom Metadata">
                          <Typography.Text code style={{ fontSize: 11, wordBreak: "break-all" }}>
                            {JSON.stringify(detail.conversation.metadata, null, 2)}
                          </Typography.Text>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </RoutePageShell>
  );
}
