"use client";

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useEffect, useState } from "react";

dayjs.extend(relativeTime);

interface TuningJob {
  id: string;
  base_model: string;
  tuned_model_id: string | null;
  vertex_job_id: string | null;
  status: "pending" | "running" | "succeeded" | "failed" | "cancelled";
  epochs: number;
  learning_rate: number | null;
  sample_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<TuningJob["status"], { color: string; icon: React.ReactNode; label: string }> = {
  pending:   { color: "default",    icon: <ClockCircleOutlined />, label: "Pending" },
  running:   { color: "processing", icon: <SyncOutlined spin />,   label: "Training…" },
  succeeded: { color: "success",    icon: <CheckCircleOutlined />, label: "Completed" },
  failed:    { color: "error",      icon: <CloseCircleOutlined />, label: "Failed" },
  cancelled: { color: "warning",    icon: <CloseCircleOutlined />, label: "Cancelled" },
};

interface TrainingTabProps {
  agentId: string;
}

export function TrainingTab({ agentId }: TrainingTabProps) {
  const [jobs, setJobs]               = useState<TuningJob[]>([]);
  const [loading, setLoading]         = useState(true);
  const [launching, setLaunching]     = useState(false);
  const [convCount, setConvCount]     = useState<number | null>(null);

  // Launch config - use stable models that support fine-tuning
  const [baseModel, setBaseModel]     = useState("gemini-1.5-flash-002");
  const [epochs, setEpochs]           = useState(3);
  const [learningRate, setLearningRate] = useState(0.0002);

  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents/${agentId}/tuning`);
      const json = await res.json();
      setJobs(json.jobs ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [agentId]);

  // Fetch conversation count for this agent
  const fetchConvCount = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations?agentId=${agentId}&limit=1&countOnly=true`);
      const json = await res.json();
      setConvCount(json.total ?? null);
    } catch { /* silent */ }
  }, [agentId]);

  // Poll active jobs to sync Vertex AI status
  const pollActiveJobs = useCallback(async () => {
    const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "running");
    if (activeJobs.length === 0) return;

    let changed = false;
    for (const job of activeJobs) {
      try {
        const res = await fetch(`/api/agents/${agentId}/tuning`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const json = await res.json();
        if (json.job && json.job.status !== job.status) {
          changed = true;
        }
      } catch { /* silent */ }
    }
    if (changed) void fetchJobs();
  }, [agentId, jobs, fetchJobs]);

  useEffect(() => {
    void fetchJobs();
    void fetchConvCount();
  }, [fetchJobs, fetchConvCount]);

  // Auto-poll every 10s while there are active jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running");
    if (!hasActive) return;
    const interval = setInterval(() => void pollActiveJobs(), 10_000);
    return () => clearInterval(interval);
  }, [jobs, pollActiveJobs]);

  const launchTuning = async () => {
    try {
      setError(null);
      setSuccess(null);
      setLaunching(true);
      const res = await fetch(`/api/agents/${agentId}/tuning`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseModel, epochs, learningRate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to launch tuning");
      setSuccess(`Fine-tuning started — ${json.sampleCount} conversation pairs uploaded`);
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch tuning");
    } finally {
      setLaunching(false);
    }
  };

  const hasActiveJob = jobs.some(j => j.status === "pending" || j.status === "running");
  const latestSucceeded = jobs.find(j => j.status === "succeeded");

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>

      <Alert
        type="warning"
        showIcon
        message="Training jobs are queued and the resulting tuned model is not yet automatically deployed to this agent. Deployment wiring is coming in a future update."
      />

      {/* How it works */}
      <div style={{
        borderRadius: 10,
        border: "1px solid #E2E8F0",
        padding: "16px 20px",
        background: "#fff",
      }}>
        <Space style={{ marginBottom: 14 }} size={8}>
          <Typography.Text strong style={{ fontSize: 13 }}>How fine-tuning works</Typography.Text>
          <Tag color="cyan" style={{ fontSize: 11, lineHeight: "18px" }}>Vertex AI</Tag>
        </Space>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
          {([
            { n: "1", label: "Export", sub: "Your conversations become training pairs" },
            { n: "2", label: "Upload",  sub: "Sent to Google Cloud Storage as JSONL" },
            { n: "3", label: "Train",   sub: "Vertex fine-tunes Gemini on your data" },
            { n: "4", label: "Deploy",  sub: "Tuned model powers this agent" },
          ] as const).map((step, i, arr) => (
            <div key={step.n} style={{ flex: 1, display: "flex", alignItems: "flex-start", gap: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "#17DEBC", color: "#0A0B0A",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {step.n}
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "center", marginTop: 4, paddingRight: 0 }}>
                    <div style={{ height: 1, background: "#E2E8F0", width: "100%" }} />
                  </div>
                )}
              </div>
              <div style={{ paddingLeft: 10, paddingRight: i < arr.length - 1 ? 16 : 0, paddingTop: 1, flex: 1 }}>
                <Typography.Text strong style={{ fontSize: 12, display: "block" }}>{step.label}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: "16px", display: "block", marginTop: 2 }}>
                  {step.sub}
                </Typography.Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <Row gutter={12}>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Conversations available"
              value={convCount ?? "—"}
              valueStyle={{ color: convCount && convCount >= 10 ? "#52c41a" : "#faad14", fontSize: 24 }}
              suffix={convCount !== null && <Typography.Text type="secondary" style={{ fontSize: 12 }}>/ 10 min</Typography.Text>}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Total tuning runs"
              value={jobs.length}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Active tuned model"
              value={latestSucceeded?.tuned_model_id ? "Deployed" : "None"}
              valueStyle={{ color: latestSucceeded?.tuned_model_id ? "#52c41a" : "#8c8c8c", fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Launch configuration */}
      <Card
        style={{ borderRadius: 10 }}
        title={
          <Space>
            <PlayCircleOutlined style={{ color: "#17DEBC" }} />
            <Typography.Text strong>Launch Fine-Tuning</Typography.Text>
          </Space>
        }
        extra={
          convCount !== null && convCount < 10 && (
            <Tag color="orange" icon={<InfoCircleOutlined />}>
              Need {10 - convCount} more conversations
            </Tag>
          )
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          {error  && <Alert type="error"   message={error}   showIcon closable onClose={() => setError(null)} />}
          {success && <Alert type="success" message={success} showIcon closable onClose={() => setSuccess(null)} />}

          {hasActiveJob && (
            <Alert
              type="info"
              showIcon
              icon={<SyncOutlined spin />}
              message="A tuning job is already in progress. Wait for it to complete before starting another."
            />
          )}

          <Row gutter={16}>
            <Col span={8}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space size={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Base model</Typography.Text>
                  <Tooltip title="Stable Gemini models that support fine-tuning on Vertex AI">
                    <InfoCircleOutlined style={{ color: "rgba(0,0,0,.45)", fontSize: 11 }} />
                  </Tooltip>
                </Space>
                <Select
                  value={baseModel}
                  onChange={setBaseModel}
                  style={{ width: "100%" }}
                  options={[
                    { value: "gemini-1.5-flash-002", label: "Gemini 1.5 Flash" },
                    { value: "gemini-1.5-pro-002", label: "Gemini 1.5 Pro" },
                  ]}
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space size={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Epochs</Typography.Text>
                  <Tooltip title="Number of training passes. 2–5 is typical. More epochs = longer training + higher cost.">
                    <InfoCircleOutlined style={{ color: "rgba(0,0,0,.45)", fontSize: 11 }} />
                  </Tooltip>
                </Space>
                <InputNumber
                  value={epochs}
                  onChange={(v) => setEpochs(v ?? 3)}
                  min={1}
                  max={10}
                  style={{ width: "100%" }}
                />
              </Space>
            </Col>
            <Col span={8}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space size={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Learning rate</Typography.Text>
                  <Tooltip title="Controls how fast the model adapts. 0.0002 is a safe default.">
                    <InfoCircleOutlined style={{ color: "rgba(0,0,0,.45)", fontSize: 11 }} />
                  </Tooltip>
                </Space>
                <InputNumber
                  value={learningRate}
                  onChange={(v) => setLearningRate(v ?? 0.0002)}
                  min={0.00001}
                  max={0.01}
                  step={0.0001}
                  style={{ width: "100%" }}
                />
              </Space>
            </Col>
          </Row>

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={launching}
            disabled={hasActiveJob || (convCount !== null && convCount < 10)}
            onClick={() => void launchTuning()}
            style={{ background: "#17DEBC", borderColor: "#17DEBC", color: "#0A0B0A" }}
          >
            Start Fine-Tuning
          </Button>
        </Space>
      </Card>

      {/* Job history */}
      <Card
        style={{ borderRadius: 10 }}
        title={
          <Space>
            <Typography.Text strong>Training History</Typography.Text>
            <Tag>{jobs.length}</Tag>
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={() => void fetchJobs()} loading={loading}>
            Refresh
          </Button>
        }
      >
        {loading && jobs.length === 0 ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : jobs.length === 0 ? (
          <Typography.Text type="secondary">No tuning jobs yet.</Typography.Text>
        ) : (
          <Table
            dataSource={jobs.map(j => ({ ...j, key: j.id }))}
            size="middle"
            pagination={{ pageSize: 5 }}
            columns={[
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                width: 130,
                render: (s: TuningJob["status"]) => {
                  const cfg = STATUS_CONFIG[s] ?? STATUS_CONFIG.pending;
                  return <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag>;
                },
              },
              {
                title: "Base model",
                dataIndex: "base_model",
                key: "base_model",
                render: (m: string) => <Tag color="blue" style={{ fontSize: 11 }}>{m}</Tag>,
              },
              {
                title: "Samples",
                dataIndex: "sample_count",
                key: "sample_count",
                width: 90,
                render: (n: number) => n.toLocaleString(),
              },
              {
                title: "Epochs",
                dataIndex: "epochs",
                key: "epochs",
                width: 70,
              },
              {
                title: "Tuned model",
                dataIndex: "tuned_model_id",
                key: "tuned_model_id",
                render: (id: string | null) =>
                  id
                    ? <Tag color="green" style={{ fontSize: 11 }}>{id}</Tag>
                    : <Typography.Text type="secondary" style={{ fontSize: 12 }}>—</Typography.Text>,
              },
              {
                title: "Started",
                dataIndex: "created_at",
                key: "created_at",
                render: (d: string) => (
                  <Tooltip title={dayjs(d).format("MMM D YYYY, HH:mm")}>
                    <Typography.Text style={{ fontSize: 12 }}>{dayjs(d).fromNow()}</Typography.Text>
                  </Tooltip>
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (record: TuningJob) => (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {record.error_message && (
                    <Alert type="error" message={record.error_message} showIcon />
                  )}
                  <Descriptions size="small" column={3}>
                    <Descriptions.Item label="Learning rate">{record.learning_rate ?? "—"}</Descriptions.Item>
                    <Descriptions.Item label="Job ID">{record.id}</Descriptions.Item>
                    <Descriptions.Item label="Updated">{dayjs(record.updated_at).format("MMM D, HH:mm")}</Descriptions.Item>
                    {record.vertex_job_id && (
                      <Descriptions.Item label="Vertex Job">{record.vertex_job_id.split("/").pop()}</Descriptions.Item>
                    )}
                  </Descriptions>
                </Space>
              ),
              rowExpandable: () => true,
            }}
          />
        )}
      </Card>
    </Space>
  );
}
