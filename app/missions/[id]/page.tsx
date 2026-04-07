"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Descriptions,
  message,
  Progress,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useParams, useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

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

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "#8c8c8c", label: "Draft" },
  scheduled: { color: "#1677ff", label: "Scheduled" },
  running: { color: "#17DEBC", label: "Running" },
  completed: { color: "#52c41a", label: "Completed" },
  failed: { color: "#ff4d4f", label: "Failed" },
  paused: { color: "#faad14", label: "Paused" },
};

const callStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "#8c8c8c", label: "Pending" },
  calling: { color: "#17DEBC", label: "Calling" },
  completed: { color: "#52c41a", label: "Completed" },
  failed: { color: "#ff4d4f", label: "Failed" },
  no_answer: { color: "#faad14", label: "No Answer" },
  busy: { color: "#fa541c", label: "Busy" },
};

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mission, setMission] = useState<Mission | null>(null);
  const [contacts, setContacts] = useState<MissionContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/missions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMission(data.mission);
      setContacts(data.contacts ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load mission.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

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

  const progressPct = mission && mission.total_contacts > 0
    ? Math.round((mission.completed_calls / mission.total_contacts) * 100)
    : 0;

  const columns: TableColumnsType<MissionContact> = [
    {
      title: "Contact",
      width: 200,
      render: (_: unknown, r) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>
            {(r.contacts as { name?: string } | null)?.name ?? "Unknown"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {(r.contacts as { phone?: string } | null)?.phone ?? ""}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Company",
      width: 150,
      render: (_: unknown, r) => (
        <span>{(r.contacts as { company?: string | null } | null)?.company ?? <Typography.Text type="secondary">—</Typography.Text>}</span>
      ),
    },
    {
      title: "Call Status",
      dataIndex: "call_status",
      width: 130,
      filterMode: "tree",
      filters: Object.entries(callStatusConfig).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (value, record) => record.call_status === value,
      render: (s: string) => {
        const cfg = callStatusConfig[s] ?? { color: "#8c8c8c", label: s };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    {
      title: "Duration",
      dataIndex: "call_duration",
      width: 100,
      sorter: (a, b) => (a.call_duration ?? 0) - (b.call_duration ?? 0),
      render: (d?: number | null) => d ? `${Math.floor(d / 60)}m ${d % 60}s` : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "AI Summary",
      dataIndex: "ai_summary",
      ellipsis: true,
      render: (s?: string | null) =>
        s ? s : <Typography.Text type="secondary">No summary</Typography.Text>,
    },
    {
      title: "Called",
      dataIndex: "called_at",
      width: 130,
      sorter: (a, b) => new Date(a.called_at ?? 0).getTime() - new Date(b.called_at ?? 0).getTime(),
      render: (v?: string | null) => v ? (
        <Tooltip title={dayjs(v).format("MMM D, YYYY h:mm A")}>
          {dayjs(v).fromNow()}
        </Tooltip>
      ) : <Typography.Text type="secondary">—</Typography.Text>,
    },
  ];

  if (!mission && !loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Typography.Title level={4}>Mission not found</Typography.Title>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/missions")}>Back to Missions</Button>
      </div>
    );
  }

  const statusCfg = statusConfig[mission?.status ?? "draft"] ?? { color: "#8c8c8c", label: "Unknown" };

  return (
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#fafafa" }}>
      {/* Back nav */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/missions")}
        style={{ marginBottom: 16, paddingLeft: 0 }}
      >
        All Missions
      </Button>

      {/* Mission header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {mission?.name ?? "Loading..."}
            </Typography.Title>
            <Badge color={statusCfg.color} text={statusCfg.label} />
          </div>
          {mission?.agentName && (
            <Space>
              <Avatar size={20} style={{ background: "#17DEBC", fontSize: 11 }}>
                {mission.agentName.charAt(0).toUpperCase()}
              </Avatar>
              <Typography.Text type="secondary">{mission.agentName}</Typography.Text>
            </Space>
          )}
        </div>
        <Space>
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={fetchDetail} loading={loading} />
          </Tooltip>
          {mission && ["draft", "scheduled", "paused"].includes(mission.status) && (
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
          {mission?.status === "running" && (
            <Button icon={<PauseCircleOutlined />} loading={pausing} onClick={handlePause}>
              Pause
            </Button>
          )}
        </Space>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card>
          <Statistic title="Total Contacts" value={mission?.total_contacts ?? 0} prefix={<PhoneOutlined />} />
        </Card>
        <Card>
          <Statistic
            title="Completed Calls"
            value={mission?.completed_calls ?? 0}
            suffix={`/ ${mission?.total_contacts ?? 0}`}
            valueStyle={{ color: "#17DEBC" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Successful"
            value={mission?.successful_calls ?? 0}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Failed"
            value={mission?.failed_calls ?? 0}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: "#ff4d4f" }}
          />
        </Card>
      </div>

      {/* Progress bar */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <Typography.Text strong>Call Progress</Typography.Text>
          <Typography.Text type="secondary">{progressPct}%</Typography.Text>
        </div>
        <Progress
          percent={progressPct}
          strokeColor={{ from: "#17DEBC", to: "#0DBBA3" }}
          trailColor="#e8e8e8"
          strokeWidth={10}
        />
      </Card>

      {/* Mission details */}
      <Card style={{ marginBottom: 24 }} title="Mission Details">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Objective" span={2}>
            <Typography.Paragraph style={{ margin: 0 }}>{mission?.objective}</Typography.Paragraph>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {mission ? dayjs(mission.created_at).format("MMM D, YYYY h:mm A") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Started">
            {mission?.started_at ? dayjs(mission.started_at).format("MMM D, YYYY h:mm A") : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Scheduled">
            {mission?.scheduled_at ? dayjs(mission.scheduled_at).format("MMM D, YYYY h:mm A") : "Immediate"}
          </Descriptions.Item>
          <Descriptions.Item label="Completed">
            {mission?.completed_at ? dayjs(mission.completed_at).format("MMM D, YYYY h:mm A") : "—"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Result summary */}
      {mission?.result_summary && (
        <Card
          style={{ marginBottom: 24, borderColor: "#5EEAD4", background: "#f0fdfb" }}
          title={
            <Space>
              <CheckCircleOutlined style={{ color: "#17DEBC" }} />
              <span>Result Summary</span>
            </Space>
          }
        >
          <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {mission.result_summary}
          </Typography.Paragraph>
        </Card>
      )}

      {/* Call log table */}
      <Card title="Call Log" style={{ marginBottom: 24 }}>
        <Table<MissionContact>
          rowKey="id"
          columns={columns}
          dataSource={contacts}
          loading={loading}
          size="middle"
          expandable={{
            expandedRowKeys: expandedKeys,
            onExpand: (expanded, record) => {
              if (expanded) setExpandedKeys((k) => [...k, record.id]);
              else setExpandedKeys((k) => k.filter((id) => id !== record.id));
            },
            expandedRowRender: (record) => (
              <div style={{ padding: "12px 16px", background: "#fafafa", borderRadius: 8 }}>
                <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
                  Transcript
                </Typography.Text>
                {record.transcript ? (
                  <Typography.Paragraph
                    style={{
                      fontFamily: "monospace",
                      fontSize: 12,
                      background: "#fff",
                      padding: "12px",
                      borderRadius: 6,
                      border: "1px solid #e8e8e8",
                      whiteSpace: "pre-wrap",
                      margin: 0,
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
          pagination={{ showSizeChanger: true, showTotal: (t) => `${t} contacts` }}
          scroll={{ x: "max-content" }}
        />
      </Card>

      {/* Stat tags at bottom */}
      {contacts.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(
            contacts.reduce((acc, c) => {
              acc[c.call_status] = (acc[c.call_status] ?? 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([status, count]) => {
            const cfg = callStatusConfig[status] ?? { color: "#8c8c8c", label: status };
            return (
              <Tag key={status} color={cfg.color} style={{ padding: "4px 12px" }}>
                {cfg.label}: {count}
              </Tag>
            );
          })}
        </div>
      )}
    </div>
  );
}
