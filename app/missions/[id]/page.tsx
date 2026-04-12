"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Progress,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  App as AntdApp,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldTimeOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import duration from "dayjs/plugin/duration";
import { getAgentAvatarUrl } from "@/lib/utils/agent-avatar";

dayjs.extend(relativeTime);
dayjs.extend(duration);

// ── Types ────────────────────────────────────────────────────────────────────

interface Mission {
  id: string;
  name: string;
  objective: string;
  agent_id?: string | null;
  agentName?: string | null;
  status: string;
  total_contacts: number;
  completed_calls: number;
  successful_calls: number;
  failed_calls: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  result_summary?: string | null;
  result_payload?: Record<string, unknown> | null;
  created_at: string;
}

interface MissionContact {
  id: string;
  call_status: string;
  call_duration?: number | null;
  transcript?: string | null;
  ai_summary?: string | null;
  called_at?: string | null;
  completed_at?: string | null;
  contacts?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    company?: string | null;
  } | null;
}

// ── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  draft: { color: "#8c8c8c", label: "Draft", icon: <EditOutlined /> },
  scheduled: { color: "#1677ff", label: "Scheduled", icon: <CalendarOutlined /> },
  running: { color: "#17DEBC", label: "Running", icon: <ThunderboltOutlined /> },
  completed: { color: "#52c41a", label: "Completed", icon: <CheckCircleOutlined /> },
  failed: { color: "#ff4d4f", label: "Failed", icon: <CloseCircleOutlined /> },
  paused: { color: "#faad14", label: "Paused", icon: <PauseCircleOutlined /> },
};

const CALL_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "#8c8c8c", label: "Pending" },
  calling: { color: "#17DEBC", label: "Calling" },
  completed: { color: "#52c41a", label: "Completed" },
  failed: { color: "#ff4d4f", label: "Failed" },
  no_answer: { color: "#faad14", label: "No Answer" },
  busy: { color: "#fa541c", label: "Busy" },
};

// ── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({
  data,
  size = 140,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>No data</Typography.Text>
      </div>
    );
  }

  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {data
          .filter((d) => d.value > 0)
          .map((d) => {
            const pct = d.value / total;
            const dashArray = `${circumference * pct} ${circumference * (1 - pct)}`;
            const dashOffset = -circumference * offset;
            offset += pct;
            return (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography.Text strong style={{ fontSize: 22, lineHeight: 1 }}>{total}</Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>calls</Typography.Text>
      </div>
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = AntdApp.useApp();
  const [mission, setMission] = useState<Mission | null>(null);
  const [contacts, setContacts] = useState<MissionContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/missions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMission(data.mission);
      setContacts(data.contacts ?? []);
    } catch (err) {
      if (!silent) message.error(err instanceof Error ? err.message : "Failed to load mission.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, message]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // ── Live polling for running missions ────────────────────────────────────

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (mission?.status === "running") {
      pollRef.current = setInterval(() => fetchDetail(true), 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [mission?.status, fetchDetail]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch(`/api/missions/${id}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success(`Launched — ${data.queued} calls queued.`);
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to launch.");
    } finally {
      setLaunching(false);
    }
  };

  const handlePause = async () => {
    setPausing(true);
    try {
      const res = await fetch(`/api/missions/${id}/pause`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success("Mission paused.");
      fetchDetail();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to pause.");
    } finally {
      setPausing(false);
    }
  };

  // ── Computed values ──────────────────────────────────────────────────────

  const progressPct = mission && mission.total_contacts > 0
    ? Math.round((mission.completed_calls / mission.total_contacts) * 100)
    : 0;

  const successRate = mission && mission.completed_calls > 0
    ? Math.round((mission.successful_calls / mission.completed_calls) * 100)
    : 0;

  const avgDuration = contacts.length > 0
    ? Math.round(
        contacts
          .filter((c) => c.call_duration && c.call_duration > 0)
          .reduce((sum, c) => sum + (c.call_duration ?? 0), 0) /
        (contacts.filter((c) => c.call_duration && c.call_duration > 0).length || 1)
      )
    : 0;

  const callBreakdown = Object.entries(
    contacts.reduce((acc, c) => {
      acc[c.call_status] = (acc[c.call_status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([status, count]) => {
    const cfg = CALL_STATUS_CONFIG[status] ?? { color: "#8c8c8c", label: status };
    return { label: cfg.label, value: count, color: cfg.color };
  });

  const statusCfg = STATUS_CONFIG[mission?.status ?? "draft"] ?? { color: "#8c8c8c", label: "Unknown", icon: <ClockCircleOutlined /> };
  const isRunning = mission?.status === "running";

  // ── Table columns ────────────────────────────────────────────────────────

  const columns: TableColumnsType<MissionContact> = [
    {
      title: "Contact",
      width: 220,
      render: (_: unknown, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: "#f0f0f0", color: "#8c8c8c", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong style={{ display: "block", fontSize: 13 }}>
              {r.contacts?.name ?? "Unknown"}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {r.contacts?.phone ?? ""}
            </Typography.Text>
          </div>
        </div>
      ),
    },
    {
      title: "Company",
      width: 140,
      render: (_: unknown, r) => (
        <Typography.Text style={{ fontSize: 13, color: r.contacts?.company ? "#374151" : "#bfbfbf" }}>
          {r.contacts?.company ?? "—"}
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "call_status",
      width: 120,
      filters: Object.entries(CALL_STATUS_CONFIG).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (value, record) => record.call_status === value,
      render: (s: string) => {
        const cfg = CALL_STATUS_CONFIG[s] ?? { color: "#8c8c8c", label: s };
        return <Tag color={cfg.color} style={{ borderRadius: 12 }}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Duration",
      dataIndex: "call_duration",
      width: 90,
      sorter: (a, b) => (a.call_duration ?? 0) - (b.call_duration ?? 0),
      render: (d?: number | null) =>
        d ? (
          <Typography.Text style={{ fontSize: 13 }}>{formatDuration(d)}</Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
        ),
    },
    {
      title: "AI Summary",
      dataIndex: "ai_summary",
      ellipsis: true,
      render: (s?: string | null) =>
        s ? (
          <Typography.Text style={{ fontSize: 13 }}>{s}</Typography.Text>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>No summary</Typography.Text>
        ),
    },
    {
      title: "Called",
      dataIndex: "called_at",
      width: 120,
      sorter: (a, b) => new Date(a.called_at ?? 0).getTime() - new Date(b.called_at ?? 0).getTime(),
      render: (v?: string | null) =>
        v ? (
          <Tooltip title={dayjs(v).format("MMM D, YYYY h:mm A")}>
            <Typography.Text style={{ fontSize: 12, color: "#6B7280" }}>{dayjs(v).fromNow()}</Typography.Text>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>
        ),
    },
  ];

  // ── Loading state ────────────────────────────────────────────────────────

  if (loading && !mission) {
    return (
      <div style={{ padding: "24px 32px", minHeight: "100vh" }}>
        <Skeleton active paragraph={{ rows: 1 }} style={{ maxWidth: 300, marginBottom: 24 }} />
        <Row gutter={24}>
          <Col xs={24} lg={8}><Skeleton active paragraph={{ rows: 8 }} /></Col>
          <Col xs={24} lg={16}><Skeleton active paragraph={{ rows: 12 }} /></Col>
        </Row>
      </div>
    );
  }

  if (!mission) {
    return (
      <div style={{ padding: "80px 32px", textAlign: "center" }}>
        <Result
          status="404"
          title="Mission not found"
          subTitle="This mission doesn't exist or you don't have access."
          extra={
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/missions")}>
              Back to Missions
            </Button>
          }
        />
      </div>
    );
  }

  // ── Timeline items ───────────────────────────────────────────────────────

  const timelineItems = [
    {
      color: "#52c41a",
      children: (
        <div>
          <Typography.Text strong style={{ fontSize: 12 }}>Created</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(mission.created_at).format("MMM D, YYYY h:mm A")}
          </Typography.Text>
        </div>
      ),
    },
    ...(mission.scheduled_at
      ? [{
          color: "#1677ff",
          children: (
            <div>
              <Typography.Text strong style={{ fontSize: 12 }}>Scheduled</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(mission.scheduled_at).format("MMM D, YYYY h:mm A")}
              </Typography.Text>
            </div>
          ),
        }]
      : []),
    ...(mission.started_at
      ? [{
          color: "#17DEBC",
          dot: isRunning ? (
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#17DEBC", boxShadow: "0 0 0 3px rgba(23,222,188,0.3)", animation: "pulse 2s infinite" }} />
          ) : undefined,
          children: (
            <div>
              <Typography.Text strong style={{ fontSize: 12 }}>
                {isRunning ? "Running" : "Started"}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(mission.started_at).format("MMM D, YYYY h:mm A")}
              </Typography.Text>
            </div>
          ),
        }]
      : []),
    ...(mission.completed_at
      ? [{
          color: mission.status === "failed" ? "#ff4d4f" : "#52c41a",
          children: (
            <div>
              <Typography.Text strong style={{ fontSize: 12 }}>
                {mission.status === "failed" ? "Failed" : "Completed"}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(mission.completed_at).format("MMM D, YYYY h:mm A")}
              </Typography.Text>
            </div>
          ),
        }]
      : []),
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "20px 28px", minHeight: "100vh" }}>
      {/* Pulse animation keyframes */}
      {isRunning && (
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }`}</style>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/missions")}
        style={{ paddingLeft: 0, marginBottom: 12, color: "#6B7280" }}
      >
        All Missions
      </Button>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: `${statusCfg.color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: statusCfg.color,
            }}
          >
            <RocketOutlined />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {mission.name}
              </Typography.Title>
              <Tag
                color={statusCfg.color}
                style={{ borderRadius: 12, fontWeight: 500 }}
                icon={isRunning ? (
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#fff", marginRight: 4, animation: "pulse 1.5s infinite" }} />
                ) : undefined}
              >
                {statusCfg.label}
              </Tag>
            </div>
            {mission.agentName && (
              <Space size={6} style={{ marginTop: 2 }}>
                <Avatar
                  size={18}
                  src={getAgentAvatarUrl(mission.agent_id ?? "", null)}
                  style={{ background: "#e8e8e8" }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {mission.agentName}
                </Typography.Text>
              </Space>
            )}
          </div>
        </div>

        <Space size={8}>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={() => fetchDetail()} loading={loading} />
          </Tooltip>
          {["draft", "scheduled", "paused"].includes(mission.status) && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={launching}
              onClick={handleLaunch}
              style={{ background: "#17DEBC", borderColor: "#17DEBC" }}
            >
              Launch Mission
            </Button>
          )}
          {isRunning && (
            <Button icon={<PauseCircleOutlined />} loading={pausing} onClick={handlePause}>
              Pause
            </Button>
          )}
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                { key: "edit", icon: <EditOutlined />, label: "Edit Mission" },
                { type: "divider" },
                { key: "delete", icon: <DeleteOutlined />, label: "Delete Mission", danger: true },
              ],
            }}
          >
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* ── 3-Section Layout ────────────────────────────────────────────────── */}
      <Row gutter={[24, 24]}>
        {/* LEFT SIDEBAR */}
        <Col xs={24} lg={8} xl={7}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {/* Mission Info */}
            <Card size="small" title={<Space><DashboardOutlined /> Mission Info</Space>}>
              <Descriptions
                column={1}
                size="small"
                colon={false}
                labelStyle={{ color: "#8c8c8c", fontSize: 12, fontWeight: 500, width: 80, paddingBottom: 8 }}
                contentStyle={{ fontSize: 13, paddingBottom: 8 }}
              >
                <Descriptions.Item label="Objective">
                  <Typography.Paragraph style={{ margin: 0, fontSize: 13 }} ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
                    {mission.objective}
                  </Typography.Paragraph>
                </Descriptions.Item>
                <Descriptions.Item label="Agent">
                  {mission.agentName ? (
                    <Space size={6}>
                      <Avatar size={20} src={getAgentAvatarUrl(mission.agent_id ?? "", null)} style={{ background: "#e8e8e8" }} />
                      {mission.agentName}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">Unassigned</Typography.Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {dayjs(mission.created_at).format("MMM D, YYYY")}
                </Descriptions.Item>
                {mission.scheduled_at && (
                  <Descriptions.Item label="Scheduled">
                    {dayjs(mission.scheduled_at).format("MMM D h:mm A")}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Call Outcomes Donut */}
            <Card size="small" title={<Space><TrophyOutlined /> Call Outcomes</Space>}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
                <DonutChart data={callBreakdown} size={140} />
                <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "center" }}>
                  {callBreakdown.map((d) => (
                    <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {d.label} ({d.value})
                      </Typography.Text>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Mission Timeline */}
            <Card size="small" title={<Space><FieldTimeOutlined /> Timeline</Space>}>
              <Timeline items={timelineItems} style={{ paddingTop: 8, paddingBottom: 0, marginBottom: -16 }} />
            </Card>

            {/* Result Summary */}
            {mission.result_summary && (
              <Card
                size="small"
                title={<Space><CheckCircleOutlined style={{ color: "#52c41a" }} /> Result Summary</Space>}
                style={{ borderColor: "#b7eb8f", background: "#f6ffed" }}
              >
                <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>
                  {mission.result_summary}
                </Typography.Paragraph>
              </Card>
            )}
          </Space>
        </Col>

        {/* MAIN CONTENT */}
        <Col xs={24} lg={16} xl={17}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {/* Stats Row */}
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Statistic
                    title={<Typography.Text type="secondary" style={{ fontSize: 11 }}>Total Contacts</Typography.Text>}
                    value={mission.total_contacts}
                    prefix={<TeamOutlined style={{ color: "#8c8c8c" }} />}
                    valueStyle={{ fontSize: 24, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Statistic
                    title={<Typography.Text type="secondary" style={{ fontSize: 11 }}>Completed</Typography.Text>}
                    value={mission.completed_calls}
                    suffix={<Typography.Text type="secondary" style={{ fontSize: 14 }}>/ {mission.total_contacts}</Typography.Text>}
                    valueStyle={{ fontSize: 24, fontWeight: 700, color: "#17DEBC" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Statistic
                    title={<Typography.Text type="secondary" style={{ fontSize: 11 }}>Success Rate</Typography.Text>}
                    value={successRate}
                    suffix="%"
                    prefix={<CheckCircleOutlined style={{ color: "#52c41a", fontSize: 14 }} />}
                    valueStyle={{ fontSize: 24, fontWeight: 700, color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Statistic
                    title={<Typography.Text type="secondary" style={{ fontSize: 11 }}>Failed</Typography.Text>}
                    value={mission.failed_calls}
                    prefix={<CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 14 }} />}
                    valueStyle={{ fontSize: 24, fontWeight: 700, color: mission.failed_calls > 0 ? "#ff4d4f" : undefined }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Progress */}
            <Card size="small">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Space size={8}>
                  <ThunderboltOutlined style={{ color: "#17DEBC" }} />
                  <Typography.Text strong style={{ fontSize: 13 }}>Call Progress</Typography.Text>
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {mission.completed_calls} of {mission.total_contacts} calls · {progressPct}%
                </Typography.Text>
              </div>
              <Progress
                percent={progressPct}
                strokeColor={{ from: "#17DEBC", to: "#0DBBA3" }}
                trailColor="#f0f0f0"
                strokeWidth={12}
                style={{ marginBottom: 0 }}
              />
            </Card>

            {/* Performance row */}
            <Row gutter={[12, 12]}>
              <Col xs={12}>
                <Card size="small">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "#f0f5ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ClockCircleOutlined style={{ fontSize: 18, color: "#1677ff" }} />
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                        Avg Call Duration
                      </Typography.Text>
                      <Typography.Text strong style={{ fontSize: 18 }}>
                        {avgDuration > 0 ? formatDuration(avgDuration) : "—"}
                      </Typography.Text>
                    </div>
                  </div>
                </Card>
              </Col>
              <Col xs={12}>
                <Card size="small">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: "#f6ffed",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <PhoneOutlined style={{ fontSize: 18, color: "#52c41a" }} />
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                        Calls Answered
                      </Typography.Text>
                      <Typography.Text strong style={{ fontSize: 18 }}>
                        {contacts.filter((c) => c.call_status === "completed").length}
                        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                          {" "}/ {contacts.length}
                        </Typography.Text>
                      </Typography.Text>
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            {/* Call Log */}
            <Card
              size="small"
              title={
                <Space>
                  <PhoneOutlined />
                  <span>Call Log</span>
                  <Badge count={contacts.length} style={{ backgroundColor: "#e6f4ff", color: "#1677ff" }} />
                </Space>
              }
            >
              <Table<MissionContact>
                rowKey="id"
                columns={columns}
                dataSource={contacts}
                loading={loading}
                size="small"
                expandable={{
                  expandedRowKeys: expandedKeys,
                  onExpand: (expanded, record) => {
                    if (expanded) setExpandedKeys((k) => [...k, record.id]);
                    else setExpandedKeys((k) => k.filter((xid) => xid !== record.id));
                  },
                  expandedRowRender: (record) => (
                    <div style={{ padding: "12px 16px", background: "#fafafa", borderRadius: 8 }}>
                      <Typography.Text strong style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                        Transcript
                      </Typography.Text>
                      {record.transcript ? (
                        <Typography.Paragraph
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            background: "#fff",
                            padding: 12,
                            borderRadius: 6,
                            border: "1px solid #e8e8e8",
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            maxHeight: 300,
                            overflow: "auto",
                          }}
                        >
                          {record.transcript}
                        </Typography.Paragraph>
                      ) : (
                        <Typography.Text type="secondary">No transcript available.</Typography.Text>
                      )}
                    </div>
                  ),
                  rowExpandable: (record) => !!record.transcript,
                }}
                pagination={{ showSizeChanger: true, pageSize: 10, showTotal: (t) => `${t} contacts` }}
                scroll={{ x: 800 }}
              />
            </Card>
          </Space>
        </Col>
      </Row>
    </div>
  );
}
