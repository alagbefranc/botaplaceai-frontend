"use client";

import {
  Alert,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DollarOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import { BotaCriticalAlertIcon } from "@/app/_components/bota-alert-icons";

interface CostBreakdown {
  conversationId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  baseCostCents: number;
  markupPercentage: number;
  markupCents: number;
  totalCostCents: number;
  durationMinutes: number;
  model: string;
  usageLogs: Array<{
    inputTokens: number;
    outputTokens: number;
    costCents: number;
    model: string;
    createdAt: string;
  }>;
  pricing: {
    inputPricePerMillion: number;
    outputPricePerMillion: number;
    isLive: boolean;
    perMinutePrice?: number;
  };
}

interface CostTabProps {
  conversationId: string;
}

function formatCost(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents < 1) return `<$0.01`;
  if (cents < 100) {
    return `$0.${cents.toString().padStart(2, "0")}`;
  }
  const dollars = Math.floor(cents / 100);
  const remainingCents = cents % 100;
  return `$${dollars}.${remainingCents.toString().padStart(2, "0")}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function CostTab({ conversationId }: CostTabProps) {
  const [cost, setCost] = useState<CostBreakdown | null>(null);
  const [formatted, setFormatted] = useState<{
    baseCost: string;
    markup: string;
    totalCost: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCost = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/conversations/${conversationId}/cost`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch cost data");
      setCost(data.cost);
      setFormatted(data.formatted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cost data");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchCost();
  }, [fetchCost]);

  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "16px 0" }}>
        <Alert message="Error" description={error} type="error" showIcon icon={<BotaCriticalAlertIcon size={16} />} />
      </div>
    );
  }

  if (!cost || cost.totalTokens === 0) {
    return (
      <div style={{ padding: "16px 0" }}>
        <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
          <Empty
            image="/assets/illustrations/bota/analytics.svg"
            imageStyle={{ height: 80 }}
            description={
              <Typography.Text type="secondary">
                No usage data recorded for this conversation
              </Typography.Text>
            }
          />
        </Card>
      </div>
    );
  }

  const usageColumns: ColumnsType<CostBreakdown["usageLogs"][0]> = [
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (val: string) => (
        <Typography.Text style={{ fontSize: 12 }}>
          {dayjs(val).format("HH:mm:ss")}
        </Typography.Text>
      ),
    },
    {
      title: "Model",
      dataIndex: "model",
      key: "model",
      render: (model: string) => (
        <Tag color="blue" style={{ fontSize: 11 }}>
          {model}
        </Tag>
      ),
    },
    {
      title: "Input",
      dataIndex: "inputTokens",
      key: "inputTokens",
      width: 80,
      render: (tokens: number) => formatTokens(tokens),
    },
    {
      title: "Output",
      dataIndex: "outputTokens",
      key: "outputTokens",
      width: 80,
      render: (tokens: number) => formatTokens(tokens),
    },
    {
      title: "Cost",
      dataIndex: "costCents",
      key: "costCents",
      width: 80,
      render: (cents: number) => (
        <Typography.Text strong style={{ color: "#52c41a" }}>
          {formatCost(cents)}
        </Typography.Text>
      ),
    },
  ];

  const inputRatio = cost.totalTokens > 0
    ? Math.round((cost.totalInputTokens / cost.totalTokens) * 100)
    : 0;

  return (
    <div style={{ padding: "16px 0" }}>
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {/* Total Cost Card */}
        <Card
          size="small"
          style={{
            borderRadius: 10,
            background: "linear-gradient(135deg, #667eea11 0%, #764ba211 100%)",
          }}
        >
          <Flex justify="space-between" align="center">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Total Cost
              </Typography.Text>
              <Typography.Title level={2} style={{ margin: 0, color: "#52c41a" }}>
                {formatted?.totalCost || formatCost(cost.totalCostCents)}
              </Typography.Title>
            </div>
            <div style={{ textAlign: "right" }}>
              <Tag icon={<ThunderboltOutlined />} color="purple">
                {cost.model}
              </Tag>
              {cost.pricing.isLive && (
                <div style={{ marginTop: 4 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    Live API: ${(cost.pricing.perMinutePrice || 35) / 100}/min
                  </Typography.Text>
                </div>
              )}
            </div>
          </Flex>
        </Card>

        {/* Cost Summary */}
        <Card size="small" title="Cost Summary" style={{ borderRadius: 10 }}>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="API Usage Cost">
              <Typography.Text strong style={{ color: "#52c41a" }}>
                {formatted?.totalCost || formatCost(cost.totalCostCents)}
              </Typography.Text>
            </Descriptions.Item>
            {cost.durationMinutes > 0 && (
              <Descriptions.Item label="Duration">
                <Typography.Text>
                  {cost.durationMinutes.toFixed(2)} minutes
                </Typography.Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Token Usage */}
        <Card size="small" title="Token Usage" style={{ borderRadius: 10 }}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Statistic
                title="Input Tokens"
                value={formatTokens(cost.totalInputTokens)}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Output Tokens"
                value={formatTokens(cost.totalOutputTokens)}
                valueStyle={{ fontSize: 18 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Total Tokens"
                value={formatTokens(cost.totalTokens)}
                valueStyle={{ fontSize: 18, fontWeight: "bold" }}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 16 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Token Distribution
            </Typography.Text>
            <Progress
              percent={100}
              success={{ percent: inputRatio }}
              showInfo={false}
              strokeColor="#1890ff"
              trailColor="#52c41a"
              style={{ marginTop: 4 }}
            />
            <Flex justify="space-between" style={{ marginTop: 4 }}>
              <Typography.Text style={{ fontSize: 11, color: "#1890ff" }}>
                Input: {inputRatio}%
              </Typography.Text>
              <Typography.Text style={{ fontSize: 11, color: "#52c41a" }}>
                Output: {100 - inputRatio}%
              </Typography.Text>
            </Flex>
          </div>
        </Card>

        {/* Pricing Info */}
        {!cost.pricing.isLive && (
          <Card size="small" title="Pricing Reference" style={{ borderRadius: 10 }}>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="Input Price">
                ${(cost.pricing.inputPricePerMillion / 100).toFixed(4)}/1M tokens
              </Descriptions.Item>
              <Descriptions.Item label="Output Price">
                ${(cost.pricing.outputPricePerMillion / 100).toFixed(4)}/1M tokens
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* Usage Log */}
        {cost.usageLogs && cost.usageLogs.length > 0 && (
          <Card size="small" title="Usage Log" style={{ borderRadius: 10 }}>
            <Table
              columns={usageColumns}
              dataSource={cost.usageLogs.map((log, i) => ({ ...log, key: i }))}
              pagination={false}
              size="small"
              scroll={{ y: 200 }}
            />
          </Card>
        )}

        {/* Duration for Live API */}
        {cost.pricing.isLive && cost.durationMinutes > 0 && (
          <Card size="small" style={{ borderRadius: 10 }}>
            <Statistic
              title="Audio Duration"
              value={cost.durationMinutes.toFixed(2)}
              suffix="minutes"
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        )}
      </Space>
    </div>
  );
}
