"use client";

import {
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  PhoneOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  WifiOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { ColumnsType } from "antd/es/table";

interface HealthStatus {
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
  error?: string;
}

interface SystemHealth {
  overall: "healthy" | "degraded" | "down";
  services: {
    backend: HealthStatus;
    supabase: HealthStatus;
    gemini: HealthStatus;
    telnyx: HealthStatus;
  };
  timestamp: string;
}

interface ActiveSession {
  id: string;
  agentId: string;
  agentName: string;
  channel: string;
  startedAt: string;
  durationSeconds: number;
  messageCount: number;
  status: "active" | "idle";
}

interface ActiveData {
  activeSessions: ActiveSession[];
  metrics: {
    activeCount: number;
    callsLastHour: number;
    callsPerMinute: number;
    channelDistribution: Record<string, number>;
  };
  timestamp: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
  healthy: { color: "#52c41a", icon: <CheckCircleOutlined />, text: "Healthy" },
  degraded: { color: "#faad14", icon: <ExclamationCircleOutlined />, text: "Degraded" },
  down: { color: "#ff4d4f", icon: <CloseCircleOutlined />, text: "Down" },
};

const CHANNEL_ICONS: Record<string, string> = {
  web_chat: "https://api.iconify.design/mdi:chat.svg?color=%234096ff",
  web_voice: "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a",
  phone: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
};

function ServiceCard({
  name,
  icon,
  status,
}: {
  name: string;
  icon: React.ReactNode;
  status: HealthStatus;
}) {
  const config = STATUS_CONFIG[status.status];

  return (
    <Card
      size="small"
      className={`admin-service-card admin-service-card-${status.status}`}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Space>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <Typography.Text strong>{name}</Typography.Text>
          </Space>
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        </Space>
        {status.latencyMs !== undefined && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Latency: {status.latencyMs}ms
          </Typography.Text>
        )}
        {status.error && (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {status.error}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}

export default function AdminMonitoringPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [activeData, setActiveData] = useState<ActiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/status");
      const data = await res.json();
      if (res.ok) {
        setHealth(data);
      }
    } catch (e) {
      console.error("Failed to fetch health:", e);
    }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/active");
      const data = await res.json();
      if (res.ok) {
        setActiveData(data);
      }
    } catch (e) {
      console.error("Failed to fetch active sessions:", e);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchHealth(), fetchActive()]);
    } finally {
      setLoading(false);
    }
  }, [fetchHealth, fetchActive]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAll]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const sessionColumns: ColumnsType<ActiveSession> = [
    {
      title: "Agent",
      key: "agent",
      render: (_, record) => (
        <Space>
          <RobotOutlined />
          {record.agentName}
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
      title: "Duration",
      dataIndex: "durationSeconds",
      key: "duration",
      render: (seconds: number) => formatDuration(seconds),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Badge
          status={status === "active" ? "processing" : "default"}
          text={status === "active" ? "Active" : "Idle"}
        />
      ),
    },
    {
      title: "Started",
      dataIndex: "startedAt",
      key: "startedAt",
      render: (date: string) => new Date(date).toLocaleTimeString(),
    },
  ];

  const overallConfig = health ? STATUS_CONFIG[health.overall] : STATUS_CONFIG.down;

  return (
    <div>
      <div className="admin-page-header">
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <div>
            <Typography.Title level={3} className="admin-page-title">
              System Monitoring
            </Typography.Title>
            <Typography.Text type="secondary">
              Real-time system health and active session monitoring
            </Typography.Text>
          </div>
          <Space>
            <Button
              type={autoRefresh ? "primary" : "default"}
              icon={<ReloadOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchAll} loading={loading}>
              Refresh Now
            </Button>
          </Space>
        </Space>
      </div>

      {/* Overall Status Banner */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${overallConfig.color}11 0%, ${overallConfig.color}05 100%)`,
          border: `1px solid ${overallConfig.color}33`,
        }}
      >
        <Space size={16} align="center">
          <span style={{ fontSize: 40, color: overallConfig.color }}>{overallConfig.icon}</span>
          <div>
            <Typography.Title level={3} style={{ margin: 0, color: overallConfig.color }}>
              System {overallConfig.text}
            </Typography.Title>
            <Typography.Text type="secondary">
              Last checked: {health ? new Date(health.timestamp).toLocaleTimeString() : "—"}
            </Typography.Text>
          </div>
        </Space>
      </Card>

      {/* Service Health Cards */}
      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        Service Health
      </Typography.Title>
      {loading && !health ? (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <Col key={i} xs={24} sm={12} lg={6}>
              <Card style={{ borderRadius: 12 }}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : health ? (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <ServiceCard
              name="Backend Server"
              icon={<CloudServerOutlined style={{ color: "#1890ff" }} />}
              status={health.services.backend}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ServiceCard
              name="Supabase"
              icon={<DatabaseOutlined style={{ color: "#3ECF8E" }} />}
              status={health.services.supabase}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ServiceCard
              name="Gemini AI"
              icon={<ThunderboltOutlined style={{ color: "#4285F4" }} />}
              status={health.services.gemini}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <ServiceCard
              name="Telnyx Voice"
              icon={<PhoneOutlined style={{ color: "#00C08B" }} />}
              status={health.services.telnyx}
            />
          </Col>
        </Row>
      ) : null}

      {/* Metrics Row */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small" className="admin-stat-card">
            <Statistic
              title="Active Sessions"
              value={activeData?.metrics.activeCount || 0}
              prefix={<WifiOutlined style={{ color: "#52c41a" }} />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="admin-stat-card">
            <Statistic
              title="Calls/Hour"
              value={activeData?.metrics.callsLastHour || 0}
              prefix={<PhoneOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="admin-stat-card">
            <Statistic
              title="Calls/Min"
              value={activeData?.metrics.callsPerMinute || 0}
              precision={1}
              prefix={<DashboardOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="admin-stat-card">
            <Statistic
              title="Backend Latency"
              value={health?.services.backend.latencyMs || 0}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color:
                  (health?.services.backend.latencyMs || 0) < 200
                    ? "#52c41a"
                    : (health?.services.backend.latencyMs || 0) < 500
                    ? "#faad14"
                    : "#ff4d4f",
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Channel Distribution */}
      {activeData?.metrics.channelDistribution &&
        Object.keys(activeData.metrics.channelDistribution).length > 0 && (
          <Card
            size="small"
            title="Channel Distribution (Last Hour)"
            className="admin-card"
          >
            <Row gutter={16}>
              {Object.entries(activeData.metrics.channelDistribution).map(([channel, count]) => {
                const total = Object.values(activeData.metrics.channelDistribution).reduce(
                  (a, b) => a + b,
                  0
                );
                const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                const icon = CHANNEL_ICONS[channel];

                return (
                  <Col key={channel} xs={24} sm={8}>
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        {icon && <img src={icon} alt="" style={{ width: 16, height: 16 }} />}
                        <Typography.Text>{channel}</Typography.Text>
                        <Typography.Text strong>{count}</Typography.Text>
                      </Space>
                      <Progress percent={percent} size="small" showInfo={false} />
                    </Space>
                  </Col>
                );
              })}
            </Row>
          </Card>
        )}

      {/* Active Sessions Table */}
      <Card
        title={
          <Space>
            <WifiOutlined />
            <span>Active Sessions</span>
            <Badge
              count={activeData?.activeSessions.length || 0}
              style={{ backgroundColor: "#52c41a" }}
            />
          </Space>
        }
        className="admin-card"
      >
        {loading && !activeData ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (activeData?.activeSessions.length || 0) === 0 ? (
          <Empty
            description={
              <Space direction="vertical">
                <Typography.Text type="secondary">No active sessions</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Active calls and conversations will appear here in real-time
                </Typography.Text>
              </Space>
            }
          />
        ) : (
          <Table
            dataSource={(activeData?.activeSessions || []).map((s) => ({ ...s, key: s.id }))}
            columns={sessionColumns}
            pagination={false}
            size="small"
            className="admin-sessions-table"
          />
        )}
      </Card>

      {/* Last Updated */}
      <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: "center", display: "block", marginTop: 16 }}>
        Data refreshes automatically every 10 seconds when auto-refresh is enabled
      </Typography.Text>
    </div>
  );
}
