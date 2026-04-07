"use client";

import React from "react";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  ReloadOutlined,
  RobotOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  ToolOutlined,
  SmileOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Column, Line } from "@ant-design/charts";
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Empty,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TabsProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";

const { RangePicker } = DatePicker;

// CDN icons for channels - consistent across the app
const CHANNEL_CDN_ICONS: Record<string, string> = {
  web_chat: "https://api.iconify.design/mdi:chat.svg?color=%234096ff",
  web_voice: "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a",
  phone: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
  whatsapp: "https://api.iconify.design/logos:whatsapp-icon.svg",
  sms: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
  email: "https://api.iconify.design/mdi:email.svg?color=%23f5222d",
  slack: "https://api.iconify.design/logos:slack-icon.svg",
  "Web Chat": "https://api.iconify.design/mdi:chat.svg?color=%234096ff",
  "Voice": "https://api.iconify.design/mdi:microphone.svg?color=%2352c41a",
  "Phone": "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
  "WhatsApp": "https://api.iconify.design/logos:whatsapp-icon.svg",
  "SMS": "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
  "Email": "https://api.iconify.design/mdi:email.svg?color=%23f5222d",
  "Slack": "https://api.iconify.design/logos:slack-icon.svg",
};

interface BatchJob {
  id: string;
  job_type: string;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  input_count: number;
  output_count: number | null;
  model: string;
  date_from: string | null;
  date_to: string | null;
  error_message: string | null;
  created_at: string;
}

interface AnalyticsData {
  summary: {
    totalConversations: number;
    allTimeConversations: number;
    conversationsChange: number;
    avgDurationSeconds: number;
    automationRate: number;
    csatScore: number | null;
    uniqueUsers: number;
    totalToolCalls: number;
  };
  byChannel: Array<{ channel: string; conversations: number; color: string }>;
  byAgent: Array<{ agent: string; conversations: number }>;
  dailyTrend: Array<{ date: string; conversations: number }>;
  toolUsage: Array<{
    key: string;
    tool: string;
    timesCalled: number;
    successRate: number;
    avgResponseTime: string;
  }>;
  hourlyDistribution: number[];
  period: { start: string; end: string };
}

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

export default function AnalyticsPage() {
  const { message } = AntdApp.useApp();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);

  const fetchAnalytics = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [start, end] = dateRange;
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });

      const response = await fetch(`/api/analytics?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, message]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  // ── Batch Prediction state ────────────────────────────────────────────────
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchLaunching, setBatchLaunching] = useState(false);
  const [batchJobType, setBatchJobType] = useState<string>("conversation_analysis");

  const [batchError, setBatchError] = useState<string | null>(null);

  const fetchBatchJobs = useCallback(async () => {
    try {
      setBatchLoading(true);
      setBatchError(null);
      const res = await fetch("/api/batch");
      const json = await res.json();
      if (!res.ok) {
        console.error("[Batch] API error:", json.error);
        setBatchError(json.error || "Failed to load batch jobs");
        setBatchJobs([]);
        return;
      }
      setBatchJobs(json.jobs ?? []);
    } catch (err) {
      console.error("[Batch] Fetch error:", err);
      setBatchError(err instanceof Error ? err.message : "Network error");
      setBatchJobs([]);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBatchJobs(); }, [fetchBatchJobs]);

  const launchBatchJob = async () => {
    try {
      setBatchLaunching(true);
      const [start, end] = dateRange;
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: batchJobType,
          dateFrom: start.toISOString(),
          dateTo: end.toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to launch job");
      message.success(`Batch job launched — ${json.job?.input_count ?? 0} conversations queued`);
      void fetchBatchJobs();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to launch batch job");
    } finally {
      setBatchLaunching(false);
    }
  };

  const handleExport = () => {
    if (!data) return;

    const csvContent = [
      // Header
      ["Metric", "Value"],
      ["Total Conversations", data.summary.totalConversations],
      ["Change vs Previous Period", `${data.summary.conversationsChange}%`],
      ["Avg Duration", formatDuration(data.summary.avgDurationSeconds)],
      ["Automation Rate", `${data.summary.automationRate}%`],
      ["CSAT Score", data.summary.csatScore ?? "N/A"],
      ["Unique Users", data.summary.uniqueUsers],
      ["Tool Calls", data.summary.totalToolCalls],
      [""],
      ["Channel", "Conversations"],
      ...data.byChannel.map((c) => [c.channel, c.conversations]),
      [""],
      ["Agent", "Conversations"],
      ...data.byAgent.map((a) => [a.agent, a.conversations]),
      [""],
      ["Tool", "Calls", "Success Rate", "Avg Response"],
      ...data.toolUsage.map((t) => [t.tool, t.timesCalled, `${t.successRate}%`, t.avgResponseTime]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("Analytics exported successfully");
  };

  const toolColumns: ColumnsType<AnalyticsData["toolUsage"][number]> = [
    {
      title: "Tool Name",
      dataIndex: "tool",
      key: "tool",
      render: (name: string) => (
        <Space>
          <ToolOutlined style={{ color: "#6C5CE7" }} />
          <code style={{ background: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}>{name}</code>
        </Space>
      ),
    },
    {
      title: "Times Called",
      dataIndex: "timesCalled",
      key: "timesCalled",
      sorter: (a, b) => a.timesCalled - b.timesCalled,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: "Success Rate",
      dataIndex: "successRate",
      key: "successRate",
      sorter: (a, b) => a.successRate - b.successRate,
      render: (v: number) => (
        <Tag color={v >= 95 ? "green" : v >= 80 ? "orange" : "red"}>{v}%</Tag>
      ),
    },
    {
      title: "Avg Response Time",
      dataIndex: "avgResponseTime",
      key: "avgResponseTime",
    },
  ];

  const renderStatCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    change?: number,
    suffix?: string
  ) => (
    <Card
      style={{ borderRadius: 12, height: "100%" }}
      styles={{ body: { padding: "20px 24px" } }}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {title}
          </Typography.Text>
          <span style={{ color: "#6C5CE7", fontSize: 20 }}>{icon}</span>
        </Space>
        <Statistic
          value={value}
          suffix={suffix}
          valueStyle={{ fontSize: 28, fontWeight: 600 }}
        />
        {change !== undefined && change !== 0 && (
          <Space size={4}>
            {change > 0 ? (
              <ArrowUpOutlined style={{ color: "#22C55E", fontSize: 12 }} />
            ) : (
              <ArrowDownOutlined style={{ color: "#EF4444", fontSize: 12 }} />
            )}
            <Typography.Text
              style={{ color: change > 0 ? "#22C55E" : "#EF4444", fontSize: 12 }}
            >
              {Math.abs(change)}% vs previous period
            </Typography.Text>
          </Space>
        )}
      </Space>
    </Card>
  );

  const tabItems: TabsProps["items"] = [
    {
      key: "overview",
      label: "Trend Overview",
      children: (
        <Card style={{ borderRadius: 12 }}>
          {data && data.dailyTrend.length > 0 ? (
            <Line
              data={data.dailyTrend}
              xField="date"
              yField="conversations"
              height={320}
              color="#6C5CE7"
              smooth
              point={{ size: 3, shape: "circle" }}
              area={{ style: { fill: "l(270) 0:#6C5CE720 1:#6C5CE7" } }}
              xAxis={{ label: { autoRotate: false } }}
              yAxis={{ title: { text: "Conversations" } }}
              tooltip={{ showMarkers: true }}
              animation={{ appear: { animation: "wave-in" } }}
            />
          ) : (
            <Empty description="No conversation data for this period" />
          )}
        </Card>
      ),
    },
    {
      key: "by-channel",
      label: "By Channel",
      children: (
        <Row gutter={[16, 16]}>
          <Col span={14}>
            <Card style={{ borderRadius: 12 }}>
              {data && data.byChannel.length > 0 ? (
                <Column
                  data={data.byChannel}
                  xField="channel"
                  yField="conversations"
                  color={data.byChannel.map((c) => c.color)}
                  height={320}
                  label={{
                    position: "top",
                    style: { fontWeight: 600 },
                    formatter: (datum: Record<string, unknown>) => {
                      const channel = datum.channel as string;
                      const icon = CHANNEL_CDN_ICONS[channel];
                      return icon ? `${datum.conversations}` : String(datum.conversations);
                    },
                  }}
                  columnStyle={{ radius: [8, 8, 0, 0] }}
                  xAxis={{
                    label: {
                      formatter: (text: string) => text,
                      style: { fontSize: 12 },
                    },
                  }}
                />
              ) : (
                <Empty description="No channel data" />
              )}
            </Card>
          </Col>
          <Col span={10}>
            <Card style={{ borderRadius: 12 }}>
              {data && data.byChannel.length > 0 ? (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 16, display: "block" }}>
                    Channel Distribution
                  </Typography.Text>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {data.byChannel.map((ch) => {
                      const total = data.byChannel.reduce((s, c) => s + c.conversations, 0);
                      const pct = total > 0 ? Math.round((ch.conversations / total) * 100) : 0;
                      const icon = CHANNEL_CDN_ICONS[ch.channel];
                      return (
                        <div key={ch.channel} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {icon && <img src={icon} alt="" style={{ width: 20, height: 20 }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <Typography.Text style={{ fontSize: 13 }}>{ch.channel}</Typography.Text>
                              <Typography.Text strong>{ch.conversations}</Typography.Text>
                            </div>
                            <div
                              style={{
                                height: 6,
                                borderRadius: 3,
                                background: "#f0f0f0",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background: ch.color,
                                  borderRadius: 3,
                                  transition: "width 0.3s",
                                }}
                              />
                            </div>
                          </div>
                          <Typography.Text type="secondary" style={{ fontSize: 12, minWidth: 40, textAlign: "right" }}>
                            {pct}%
                          </Typography.Text>
                        </div>
                      );
                    })}
                  </Space>
                </div>
              ) : (
                <Empty description="No channel data" />
              )}
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "by-agent",
      label: "By Agent",
      children: (
        <Card style={{ borderRadius: 12 }}>
          {data && data.byAgent.length > 0 ? (
            <Column
              data={data.byAgent}
              xField="agent"
              yField="conversations"
              color="#6C5CE7"
              height={320}
              label={{ position: "top", style: { fontWeight: 600 } }}
              columnStyle={{ radius: [8, 8, 0, 0] }}
              xAxis={{ label: { autoRotate: true, autoHide: false } }}
            />
          ) : (
            <Empty description="No agent data available" />
          )}
        </Card>
      ),
    },
    {
      key: "tool-usage",
      label: "Tool Usage",
      children: (
        <Card style={{ borderRadius: 12 }}>
          {data && data.toolUsage.length > 0 ? (
            <Table
              columns={toolColumns}
              dataSource={data.toolUsage}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          ) : (
            <Empty
              description="No tool calls recorded"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Card>
      ),
    },
    {
      key: "batch",
      label: (
        <Space size={4}>
          <ExperimentOutlined />
          Batch Analysis
        </Space>
      ),
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Launch panel */}
          <Card
            style={{ borderRadius: 12, background: "linear-gradient(135deg, #17DEBC11 0%, #17DEBC05 100%)", border: "1px solid #17DEBC33" }}
            title={
              <Space>
                <ExperimentOutlined style={{ color: "#17DEBC" }} />
                <Typography.Text strong>Run Batch Analysis</Typography.Text>
              </Space>
            }
          >
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
              Analyse all conversations in the selected date range using Gemini in batch mode.
              Results are written to your GCS bucket asynchronously — no API timeouts.
            </Typography.Text>
            <Row gutter={12} align="middle">
              <Col flex="1">
                <Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Analysis type</Typography.Text>
                  <Select
                    value={batchJobType}
                    onChange={setBatchJobType}
                    style={{ width: 220 }}
                    options={[
                      { value: "conversation_analysis", label: "Full Conversation Analysis" },
                      { value: "insight_extraction",    label: "Insight Extraction" },
                      { value: "sentiment_analysis",    label: "Sentiment Analysis" },
                    ]}
                  />
                </Space>
              </Col>
              <Col>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={batchLaunching}
                  onClick={() => void launchBatchJob()}
                  style={{ background: "#17DEBC", borderColor: "#17DEBC", color: "#0A0B0A" }}
                >
                  Launch Batch Job
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Jobs list */}
          <Card
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <Typography.Text strong>Batch Jobs</Typography.Text>
                <Tag>{batchJobs.length}</Tag>
              </Space>
            }
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={() => void fetchBatchJobs()} loading={batchLoading}>
                Refresh
              </Button>
            }
          >
            {batchLoading && batchJobs.length === 0 ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : batchError ? (
              <Empty
                description={
                  <Space direction="vertical">
                    <Typography.Text type="danger">{batchError}</Typography.Text>
                    <Button size="small" onClick={() => void fetchBatchJobs()}>Retry</Button>
                  </Space>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : batchJobs.length === 0 ? (
              <Empty
                description="No batch jobs yet — launch one above"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                dataSource={batchJobs.map(j => ({ ...j, key: j.id }))}
                pagination={{ pageSize: 8 }}
                size="middle"
                columns={[
                  {
                    title: "Type",
                    dataIndex: "job_type",
                    key: "job_type",
                    render: (t: string) => (
                      <Tag color="blue" style={{ textTransform: "capitalize" }}>
                        {t.replace(/_/g, " ")}
                      </Tag>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    render: (s: BatchJob["status"]) => {
                      const cfg: Record<BatchJob["status"], { icon: React.ReactNode; color: string }> = {
                        pending:   { icon: <ClockCircleOutlined />, color: "default" },
                        running:   { icon: <SyncOutlined spin />,   color: "processing" },
                        succeeded: { icon: <CheckCircleOutlined />, color: "success" },
                        failed:    { icon: <CloseCircleOutlined />, color: "error" },
                        cancelled: { icon: <CloseCircleOutlined />, color: "warning" },
                      };
                      const { icon, color } = cfg[s] ?? cfg.pending;
                      return <Tag icon={icon} color={color}>{s}</Tag>;
                    },
                  },
                  {
                    title: "Conversations",
                    dataIndex: "input_count",
                    key: "input_count",
                    render: (n: number) => n.toLocaleString(),
                  },
                  {
                    title: "Model",
                    dataIndex: "model",
                    key: "model",
                    render: (m: string) => <Tag color="purple" style={{ fontSize: 11 }}>{m}</Tag>,
                  },
                  {
                    title: "Date Range",
                    key: "range",
                    render: (_: unknown, record: BatchJob) => (
                      <Typography.Text style={{ fontSize: 12 }} type="secondary">
                        {record.date_from ? dayjs(record.date_from).format("MMM D") : "—"}
                        {" → "}
                        {record.date_to   ? dayjs(record.date_to).format("MMM D, YYYY") : "—"}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: "Launched",
                    dataIndex: "created_at",
                    key: "created_at",
                    render: (d: string) => dayjs(d).format("MMM D, HH:mm"),
                  },
                ]}
              />
            )}
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <RoutePageShell
      title="Analytics"
      subtitle="Conversation metrics, tool performance, and channel insights"
      actions={
        <Space>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            format="MMM D, YYYY"
            allowClear={false}
            presets={[
              { label: "All Time", value: [dayjs("2020-01-01"), dayjs()] },
              { label: "Last 7 Days", value: [dayjs().subtract(7, "day"), dayjs()] },
              { label: "Last 30 Days", value: [dayjs().subtract(30, "day"), dayjs()] },
              { label: "Last 90 Days", value: [dayjs().subtract(90, "day"), dayjs()] },
              { label: "This Month", value: [dayjs().startOf("month"), dayjs()] },
              { label: "Last Month", value: [dayjs().subtract(1, "month").startOf("month"), dayjs().subtract(1, "month").endOf("month")] },
            ]}
          />
          <Tooltip title="Refresh data">
            <Button
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => fetchAnalytics(true)}
              disabled={loading}
            />
          </Tooltip>
          <Tooltip title="Export as CSV">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={loading || !data}
            />
          </Tooltip>
        </Space>
      }
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Summary Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            {loading ? (
              <Card style={{ borderRadius: 12 }}><Skeleton active paragraph={{ rows: 2 }} /></Card>
            ) : (
              <>
                {renderStatCard(
                  "Total Conversations",
                  data?.summary.totalConversations ?? 0,
                  <MessageOutlined />,
                  data?.summary.conversationsChange
                )}
                {data && data.summary.totalConversations === 0 && data.summary.allTimeConversations > 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 4 }}>
                    {data.summary.allTimeConversations} all-time — try "All Time" preset
                  </Typography.Text>
                )}
              </>
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {loading ? (
              <Card style={{ borderRadius: 12 }}><Skeleton active paragraph={{ rows: 2 }} /></Card>
            ) : (
              renderStatCard(
                "Avg Duration",
                formatDuration(data?.summary.avgDurationSeconds ?? 0),
                <ClockCircleOutlined />
              )
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {loading ? (
              <Card style={{ borderRadius: 12 }}><Skeleton active paragraph={{ rows: 2 }} /></Card>
            ) : (
              renderStatCard(
                "Automation Rate",
                data?.summary.automationRate ?? 0,
                <ThunderboltOutlined />,
                undefined,
                "%"
              )
            )}
          </Col>
          <Col xs={24} sm={12} lg={6}>
            {loading ? (
              <Card style={{ borderRadius: 12 }}><Skeleton active paragraph={{ rows: 2 }} /></Card>
            ) : data?.summary.csatScore !== null ? (
              renderStatCard(
                "CSAT Score",
                data?.summary.csatScore ?? 0,
                <SmileOutlined />,
                undefined,
                "/ 5.0"
              )
            ) : (
              <Card style={{ borderRadius: 12, height: "100%" }} styles={{ body: { padding: "20px 24px" } }}>
                <Space direction="vertical" size={8}>
                  <Space style={{ justifyContent: "space-between", width: "100%" }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>CSAT Score</Typography.Text>
                    <SmileOutlined style={{ color: "#6C5CE7", fontSize: 20 }} />
                  </Space>
                  <Typography.Text type="secondary">No ratings yet</Typography.Text>
                </Space>
              </Card>
            )}
          </Col>
        </Row>

        {/* Secondary Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<Space><TeamOutlined /> Unique Users</Space>}
                value={loading ? "-" : data?.summary.uniqueUsers ?? 0}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<Space><ToolOutlined /> Tool Calls</Space>}
                value={loading ? "-" : data?.summary.totalToolCalls ?? 0}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title={<Space><RobotOutlined /> Active Agents</Space>}
                value={loading ? "-" : data?.byAgent.length ?? 0}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="Active Channels"
                value={loading ? "-" : data?.byChannel.length ?? 0}
                valueStyle={{ fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Detailed Charts */}
        {loading ? (
          <Card style={{ borderRadius: 12 }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        ) : (
          <Tabs items={tabItems} size="large" />
        )}
      </Space>
    </RoutePageShell>
  );
}
