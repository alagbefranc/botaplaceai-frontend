"use client";

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Flex,
  Progress,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AuditOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { CallAnalysisResult, SuccessEvaluationRubric } from "@/lib/domain/agent-builder";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface CallAnalysisTabProps {
  conversationId: string;
  channel?: string;
}

/* ── Rubric-specific success evaluation renderer ── */
function SuccessEvaluationDisplay({
  evaluation,
  rubric,
}: {
  evaluation: CallAnalysisResult["successEvaluation"];
  rubric?: SuccessEvaluationRubric;
}) {
  if (evaluation === undefined || evaluation === null) return null;

  if (rubric === "PassFail" || typeof evaluation === "boolean") {
    const passed = evaluation === true || evaluation === "true";
    return (
      <Tag
        icon={passed ? <CheckCircleFilled /> : <CloseCircleFilled />}
        color={passed ? "success" : "error"}
        style={{ fontSize: 14, padding: "4px 12px" }}
      >
        {passed ? "Passed" : "Failed"}
      </Tag>
    );
  }

  if (rubric === "NumericScale" && typeof evaluation === "number") {
    return (
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Typography.Text strong style={{ fontSize: 22, color: "#17DEBC" }}>
          {evaluation} <Typography.Text type="secondary" style={{ fontSize: 14 }}>/10</Typography.Text>
        </Typography.Text>
        <Progress
          percent={evaluation * 10}
          size="small"
          strokeColor={evaluation >= 7 ? "#17DEBC" : evaluation >= 5 ? "#faad14" : "#ff4d4f"}
          showInfo={false}
          style={{ maxWidth: 240 }}
        />
      </Space>
    );
  }

  if (rubric === "PercentageScale" && typeof evaluation === "number") {
    return (
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Typography.Text strong style={{ fontSize: 22, color: "#17DEBC" }}>
          {evaluation}%
        </Typography.Text>
        <Progress
          percent={evaluation}
          size="small"
          strokeColor={evaluation >= 70 ? "#17DEBC" : evaluation >= 50 ? "#faad14" : "#ff4d4f"}
          showInfo={false}
          style={{ maxWidth: 240 }}
        />
      </Space>
    );
  }

  if (rubric === "DescriptiveScale" && typeof evaluation === "string") {
    const colorMap: Record<string, string> = {
      Excellent: "success",
      Good: "processing",
      Fair: "warning",
      Poor: "error",
    };
    return (
      <Tag color={colorMap[evaluation] ?? "default"} style={{ fontSize: 14, padding: "4px 12px" }}>
        {evaluation}
      </Tag>
    );
  }

  if (rubric === "LikertScale" && typeof evaluation === "string") {
    const colorMap: Record<string, string> = {
      "Strongly Agree": "success",
      "Agree": "processing",
      "Neutral": "default",
      "Disagree": "warning",
      "Strongly Disagree": "error",
    };
    return (
      <Tag color={colorMap[evaluation] ?? "default"} style={{ fontSize: 14, padding: "4px 12px" }}>
        {evaluation}
      </Tag>
    );
  }

  if (rubric === "AutomaticRubric" && typeof evaluation === "object" && evaluation !== null) {
    const obj = evaluation as Record<string, unknown>;
    return (
      <Descriptions size="small" column={1} bordered>
        {Object.entries(obj).map(([criterion, score]) => (
          <Descriptions.Item key={criterion} label={criterion}>
            <Typography.Text>{String(score)}</Typography.Text>
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }

  // Fallback: plain text
  return <Typography.Text>{String(evaluation)}</Typography.Text>;
}

/* ── Structured Data renderer ── */
function StructuredDataDisplay({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return <Typography.Text type="secondary">No data extracted.</Typography.Text>;

  // Detect if it's simple key-value or nested
  const isSimple = entries.every(([, v]) => typeof v !== "object" || v === null);

  if (isSimple) {
    return (
      <Descriptions size="small" column={1} bordered>
        {entries.map(([key, val]) => (
          <Descriptions.Item key={key} label={key}>
            {val === null || val === undefined ? (
              <Typography.Text type="secondary">—</Typography.Text>
            ) : (
              <Typography.Text>{String(val)}</Typography.Text>
            )}
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  }

  return (
    <pre
      style={{
        background: "#f5f5f5",
        border: "1px solid #e8e8e8",
        borderRadius: 6,
        padding: "10px 14px",
        fontSize: 12,
        overflowX: "auto",
        margin: 0,
      }}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

/* ── Main component ── */
export function CallAnalysisTab({ conversationId }: CallAnalysisTabProps) {
  const [analysis, setAnalysis] = useState<CallAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/conversations/${conversationId}/analysis`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load analysis.");
      setAnalysis(data.analysis ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis.");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const runAnalysis = useCallback(async () => {
    try {
      setRunning(true);
      setError(null);
      const res = await fetch(`/api/conversations/${conversationId}/analysis`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed.");
      setAnalysis(data.analysis ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setRunning(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 0" }}>
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {!analysis ? (
        /* ── Empty state ── */
        <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
          <Empty
            image="/assets/illustrations/bota/analytics.svg"
            imageStyle={{ height: 80 }}
            description={
              <Space direction="vertical" size={8}>
                <Typography.Text type="secondary">
                  No call analysis yet. Run analysis to get a summary,
                  structured data, and a success evaluation.
                </Typography.Text>
                <Button
                  type="primary"
                  icon={<AuditOutlined />}
                  loading={running}
                  onClick={runAnalysis}
                  style={{ background: "#17DEBC", borderColor: "#17DEBC" }}
                >
                  Run Call Analysis
                </Button>
              </Space>
            }
          />
        </Card>
      ) : (
        /* ── Results ── */
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Re-run button */}
          <Flex justify="flex-end" gap={8}>
            <Tooltip title="Re-run analysis">
              <Button
                size="small"
                icon={<ReloadOutlined />}
                loading={running}
                onClick={runAnalysis}
              >
                Re-analyze
              </Button>
            </Tooltip>
          </Flex>

          {/* Summary Card */}
          {analysis.summary && (
            <Card
              size="small"
              title={
                <Space size={6}>
                  <FileTextOutlined style={{ color: "#17DEBC" }} />
                  <span>Call Summary</span>
                </Space>
              }
              style={{ borderRadius: 10 }}
            >
              <Typography.Paragraph style={{ marginBottom: 0, lineHeight: 1.7 }}>
                {analysis.summary}
              </Typography.Paragraph>
            </Card>
          )}

          {/* Structured Data Card */}
          {analysis.structuredData && Object.keys(analysis.structuredData).length > 0 && (
            <Card
              size="small"
              title={
                <Space size={6}>
                  <DatabaseOutlined style={{ color: "#17DEBC" }} />
                  <span>Structured Data</span>
                </Space>
              }
              style={{ borderRadius: 10 }}
            >
              <StructuredDataDisplay data={analysis.structuredData} />
            </Card>
          )}

          {/* Success Evaluation Card */}
          {analysis.successEvaluation !== undefined && (
            <Card
              size="small"
              title={
                <Space size={6}>
                  <TrophyOutlined style={{ color: "#17DEBC" }} />
                  <span>Success Evaluation</span>
                  {analysis.rubric && (
                    <Tag style={{ marginLeft: 4, fontSize: 11 }}>{analysis.rubric}</Tag>
                  )}
                </Space>
              }
              style={{ borderRadius: 10 }}
            >
              <SuccessEvaluationDisplay
                evaluation={analysis.successEvaluation}
                rubric={analysis.rubric}
              />
            </Card>
          )}

          {/* Footer */}
          {analysis.analyzedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Analyzed {dayjs(analysis.analyzedAt).fromNow()} · Model: {analysis.model ?? "AI"}
            </Typography.Text>
          )}
        </Space>
      )}
    </div>
  );
}
