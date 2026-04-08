"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Input,
  List,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FilterOutlined,
  MessageOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";
import dayjs, { Dayjs } from "dayjs";
import type { ColumnsType } from "antd/es/table";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

const { RangePicker } = DatePicker;

interface ConversationEvent {
  id: string;
  conversation_id: string;
  event_type: string;
  timestamp: string;
  data: Record<string, unknown>;
  latency_ms?: number;
}

interface Conversation {
  id: string;
  agent_id: string;
  channel: string;
  status: string;
  created_at: string;
  ended_at?: string;
  metadata?: Record<string, unknown>;
  agents?: { name: string };
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface LogsData {
  events: ConversationEvent[];
  conversations: Conversation[];
  messages: Message[];
  stats: {
    totalConversations: number;
    totalEvents: number;
    avgLatencyMs: number;
    eventsByType: Record<string, number>;
  };
}

const EVENT_TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  message: { color: "blue", icon: <MessageOutlined />, label: "Message" },
  tool_call: { color: "purple", icon: <ToolOutlined />, label: "Tool Call" },
  tool_response: { color: "cyan", icon: <CodeOutlined />, label: "Tool Response" },
  error: { color: "red", icon: <CloseCircleOutlined />, label: "Error" },
  latency: { color: "orange", icon: <ClockCircleOutlined />, label: "Latency" },
  connection: { color: "green", icon: <ApiOutlined />, label: "Connection" },
  handoff: { color: "gold", icon: <UserOutlined />, label: "Handoff" },
};

const CHANNEL_ICONS: Record<string, string> = {
  web_chat: "https://api.iconify.design/mdi:chat.svg?color=%234096ff",
  web_voice: "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a",
  phone: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
};

// Conversation Detail Drawer
function ConversationDetailDrawer({
  open,
  onClose,
  conversation,
  messages,
}: {
  open: boolean;
  onClose: () => void;
  conversation: Conversation | null;
  messages: Message[];
}) {
  if (!conversation) return null;

  const convMessages = messages.filter((m) => m.conversation_id === conversation.id);
  const duration = conversation.ended_at
    ? Math.round(
        (new Date(conversation.ended_at).getTime() - new Date(conversation.created_at).getTime()) / 1000
      )
    : null;

  return (
    <Drawer
      title="Conversation Details"
      open={open}
      onClose={onClose}
      size="large"
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Summary Card */}
        <Card size="small" style={{ borderRadius: 10 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="Messages"
                value={convMessages.length}
                prefix={<MessageOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Duration"
                value={duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : "Active"}
                prefix={<ClockCircleOutlined />}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Status"
                value={conversation.status}
                prefix={
                  conversation.status === "ended" ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : (
                    <ThunderboltOutlined style={{ color: "#1890ff" }} />
                  )
                }
              />
            </Col>
          </Row>
        </Card>

        {/* Metadata */}
        <Card size="small" title="Details" style={{ borderRadius: 10 }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Typography.Text type="secondary">Agent: </Typography.Text>
              <Typography.Text strong>{conversation.agents?.name || "Unknown"}</Typography.Text>
            </div>
            <div>
              <Typography.Text type="secondary">Channel: </Typography.Text>
              <Tag>{conversation.channel}</Tag>
            </div>
            <div>
              <Typography.Text type="secondary">Started: </Typography.Text>
              <Typography.Text>{new Date(conversation.created_at).toLocaleString()}</Typography.Text>
            </div>
            {conversation.ended_at && (
              <div>
                <Typography.Text type="secondary">Ended: </Typography.Text>
                <Typography.Text>{new Date(conversation.ended_at).toLocaleString()}</Typography.Text>
              </div>
            )}
          </Space>
        </Card>

        {/* Message Timeline */}
        <div>
          <Typography.Title level={5}>Conversation Transcript</Typography.Title>
          {convMessages.length === 0 ? (
            <Empty description="No messages found" />
          ) : (
            <Timeline
              items={convMessages.map((msg) => ({
                color: msg.role === "user" ? "blue" : msg.role === "assistant" ? "green" : "gray",
                children: (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Tag color={msg.role === "user" ? "blue" : msg.role === "assistant" ? "green" : "default"}>
                          {msg.role === "user" ? <UserOutlined /> : <RobotOutlined />}
                          {" "}{msg.role.toUpperCase()}
                        </Tag>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </Typography.Text>
                      </Space>
                      <Typography.Text style={{ whiteSpace: "pre-wrap" }}>
                        {msg.content || "(empty)"}
                      </Typography.Text>
                      {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: "pointer", fontSize: 12, color: "#888" }}>
                            Metadata
                          </summary>
                          <pre style={{ fontSize: 11, background: "#f5f5f5", padding: 8, borderRadius: 4, overflow: "auto" }}>
                            {JSON.stringify(msg.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </Space>
                  </Card>
                ),
              }))}
            />
          )}
        </div>
      </Space>
    </Drawer>
  );
}

export default function LogsPage() {
  const [data, setData] = useState<LogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [eventTypeFilter, setEventTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("conversations");

  // Drawer state
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (dateRange[0]) params.set("startDate", dateRange[0].toISOString());
      if (dateRange[1]) params.set("endDate", dateRange[1].toISOString());
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);

      const res = await fetch(`/api/logs?${params}`);
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Failed to fetch logs");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [dateRange, eventTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  const handleViewConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setDrawerOpen(true);
  };

  // Filter conversations by search
  const filteredConversations = (data?.conversations || []).filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(query) ||
      c.agents?.name?.toLowerCase().includes(query) ||
      c.channel.toLowerCase().includes(query)
    );
  });

  const conversationColumns: ColumnsType<Conversation> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      render: (id: string) => (
        <Typography.Text copyable style={{ fontSize: 12 }}>
          {id.slice(0, 8)}...
        </Typography.Text>
      ),
    },
    {
      title: "Agent",
      key: "agent",
      render: (_, record) => (
        <Space>
          <RobotOutlined />
          {record.agents?.name || "Unknown"}
        </Space>
      ),
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      render: (channel: string) => {
        const icon = CHANNEL_ICONS[channel];
        return (
          <Space>
            {icon && <img src={icon} alt="" style={{ width: 16, height: 16 }} />}
            <span>{channel}</span>
          </Space>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "ended" ? "default" : status === "active" ? "processing" : "warning"}>
          {status}
        </Tag>
      ),
    },
    {
      title: "Messages",
      key: "messages",
      render: (_, record) => {
        const count = data?.messages.filter((m) => m.conversation_id === record.id).length || 0;
        return <Badge count={count} showZero style={{ backgroundColor: "#1890ff" }} />;
      },
    },
    {
      title: "Started",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => dayjs(date).format("MMM D, HH:mm"),
    },
    {
      title: "Duration",
      key: "duration",
      render: (_, record) => {
        if (!record.ended_at) return <Tag color="processing">Active</Tag>;
        const seconds = Math.round(
          (new Date(record.ended_at).getTime() - new Date(record.created_at).getTime()) / 1000
        );
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewConversation(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const eventColumns: ColumnsType<ConversationEvent> = [
    {
      title: "Type",
      dataIndex: "event_type",
      key: "event_type",
      render: (type: string) => {
        const config = EVENT_TYPE_CONFIG[type] || { color: "default", icon: <CodeOutlined />, label: type };
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Conversation",
      dataIndex: "conversation_id",
      key: "conversation_id",
      render: (id: string) => (
        <Typography.Text style={{ fontSize: 12 }}>{id.slice(0, 8)}...</Typography.Text>
      ),
    },
    {
      title: "Timestamp",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (date: string) => dayjs(date).format("MMM D, HH:mm:ss"),
    },
    {
      title: "Latency",
      dataIndex: "latency_ms",
      key: "latency_ms",
      render: (ms: number | undefined) =>
        ms ? (
          <Tag color={ms < 500 ? "green" : ms < 1000 ? "orange" : "red"}>{ms}ms</Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Data",
      dataIndex: "data",
      key: "data",
      render: (data: Record<string, unknown>) => (
        <Tooltip title={<pre style={{ fontSize: 11 }}>{JSON.stringify(data, null, 2)}</pre>}>
          <Button type="link" size="small">
            View
          </Button>
        </Tooltip>
      ),
    },
  ];

  const tabItems = [
    {
      key: "conversations",
      label: (
        <Space>
          <MessageOutlined />
          <span>Conversations</span>
          <Tag>{filteredConversations.length}</Tag>
        </Space>
      ),
      children: (
        <Card style={{ borderRadius: 12 }}>
          <Table
            dataSource={filteredConversations.map((c) => ({ ...c, key: c.id }))}
            columns={conversationColumns}
            pagination={{ pageSize: 15 }}
            loading={loading}
          />
        </Card>
      ),
    },
    {
      key: "events",
      label: (
        <Space>
          <ThunderboltOutlined />
          <span>Events</span>
          <Tag>{data?.events.length || 0}</Tag>
        </Space>
      ),
      children: (
        <Card style={{ borderRadius: 12 }}>
          {data?.events.length === 0 ? (
            <Empty
              description={
                <Space direction="vertical">
                  <Typography.Text type="secondary">No events recorded yet</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Events are logged when conversations occur with tool calls, errors, or latency tracking
                  </Typography.Text>
                </Space>
              }
            />
          ) : (
            <Table
              dataSource={(data?.events || []).map((e) => ({ ...e, key: e.id }))}
              columns={eventColumns}
              pagination={{ pageSize: 20 }}
              loading={loading}
            />
          )}
        </Card>
      ),
    },
  ];

  return (
    <RoutePageShell
      title="Conversation Logs"
      subtitle="Detailed logs and event timeline for all conversations"
      actions={
        <Space>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            format="MMM D, YYYY"
            allowClear={false}
            presets={[
              { label: "Today", value: [dayjs().startOf("day"), dayjs()] },
              { label: "Last 7 Days", value: [dayjs().subtract(7, "day"), dayjs()] },
              { label: "Last 30 Days", value: [dayjs().subtract(30, "day"), dayjs()] },
            ]}
          />
          <Select
            placeholder="Event Type"
            allowClear
            style={{ width: 140 }}
            value={eventTypeFilter}
            onChange={setEventTypeFilter}
            options={Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => ({
              value: key,
              label: (
                <Space>
                  {cfg.icon}
                  {cfg.label}
                </Space>
              ),
            }))}
          />
          <Input
            placeholder="Search..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading} />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Stats Row */}
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10 }}>
              <Statistic
                title="Conversations"
                value={loading ? "-" : data?.stats.totalConversations || 0}
                prefix={<MessageOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10 }}>
              <Statistic
                title="Events Logged"
                value={loading ? "-" : data?.stats.totalEvents || 0}
                prefix={<ThunderboltOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10 }}>
              <Statistic
                title="Avg Latency"
                value={loading ? "-" : `${data?.stats.avgLatencyMs || 0}ms`}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: 10 }}>
              <Statistic
                title="Errors"
                value={loading ? "-" : data?.stats.eventsByType?.error || 0}
                valueStyle={{ color: (data?.stats.eventsByType?.error || 0) > 0 ? "#ff4d4f" : undefined }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {error && (
          <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
        )}

        {/* Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
      </Space>

      {/* Conversation Detail Drawer */}
      <ConversationDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversation={selectedConversation}
        messages={data?.messages || []}
      />
    </RoutePageShell>
  );
}
