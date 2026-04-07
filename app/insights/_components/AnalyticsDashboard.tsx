"use client";

import BotaLottieEmpty from "@/app/_components/BotaLottieEmpty";

import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LineChartOutlined,
  SmileOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { Line, Pie } from "@ant-design/charts";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

const { RangePicker } = DatePicker;

interface AnalyticsData {
  totalExtractions: number;
  extractionsChange: number;
  avgSatisfaction: number;
  satisfactionChange: number;
  issueResolutionRate: number;
  resolutionChange: number;
  topIntents: Array<{ intent: string; count: number }>;
  sentimentDistribution: Array<{ type: string; value: number }>;
  extractionsTrend: Array<{ date: string; count: number }>;
  recentExtractions: Array<{
    id: string;
    conversationId: string;
    insightName: string;
    extractedAt: string;
    sentiment?: string;
    satisfactionScore?: number;
  }>;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/insights/analytics?startDate=${dateRange[0].toISOString()}&endDate=${dateRange[1].toISOString()}`
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load analytics");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleTimeRangeChange = (range: "7d" | "30d" | "90d") => {
    setTimeRange(range);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    setDateRange([dayjs().subtract(days, "day"), dayjs()]);
  };

  const columns: ColumnsType<AnalyticsData["recentExtractions"][0]> = [
    {
      title: "Insight",
      dataIndex: "insightName",
      key: "insightName",
      render: (name: string) => (
        <Typography.Text strong>{name}</Typography.Text>
      ),
    },
    {
      title: "Conversation",
      dataIndex: "conversationId",
      key: "conversationId",
      render: (id: string) => (
        <Typography.Text copyable style={{ fontSize: 12, fontFamily: "monospace" }}>
          {id.slice(0, 8)}...
        </Typography.Text>
      ),
    },
    {
      title: "Sentiment",
      dataIndex: "sentiment",
      key: "sentiment",
      render: (sentiment: string) =>
        sentiment ? (
          <Tag
            color={
              sentiment === "positive"
                ? "green"
                : sentiment === "negative"
                ? "red"
                : sentiment === "mixed"
                ? "orange"
                : "blue"
            }
          >
            {sentiment}
          </Tag>
        ) : (
          "-"
        ),
    },
    {
      title: "Satisfaction",
      dataIndex: "satisfactionScore",
      key: "satisfactionScore",
      render: (score: number) =>
        score ? (
          <Progress
            percent={score * 20}
            size="small"
            format={() => `${score}/5`}
            strokeColor={score >= 4 ? "#52c41a" : score >= 3 ? "#faad14" : "#ff4d4f"}
          />
        ) : (
          "-"
        ),
    },
    {
      title: "Extracted",
      dataIndex: "extractedAt",
      key: "extractedAt",
      render: (date: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(date).fromNow()}
        </Typography.Text>
      ),
    },
  ];

  // Mock data for display when API returns empty
  const mockData: AnalyticsData = {
    totalExtractions: 0,
    extractionsChange: 0,
    avgSatisfaction: 0,
    satisfactionChange: 0,
    issueResolutionRate: 0,
    resolutionChange: 0,
    topIntents: [],
    sentimentDistribution: [
      { type: "Positive", value: 0 },
      { type: "Neutral", value: 0 },
      { type: "Negative", value: 0 },
      { type: "Mixed", value: 0 },
    ],
    extractionsTrend: [],
    recentExtractions: [],
  };

  const displayData = data || mockData;

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Insights Analytics
          </Typography.Title>
          <Typography.Text type="secondary">
            Track extraction performance and conversation intelligence
          </Typography.Text>
        </div>
        <Space>
          <Segmented
            value={timeRange}
            onChange={(val) => handleTimeRangeChange(val as "7d" | "30d" | "90d")}
            options={[
              { value: "7d", label: "7 Days" },
              { value: "30d", label: "30 Days" },
              { value: "90d", label: "90 Days" },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="MMM D, YYYY"
          />
        </Space>
      </div>

      {error ? (
        <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
      ) : (
        <>
          {/* Stats Cards */}
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title="Total Extractions"
                    value={displayData.totalExtractions}
                    prefix={<BulbOutlined />}
                    suffix={
                      displayData.extractionsChange !== 0 && (
                        <span
                          style={{
                            fontSize: 14,
                            color: displayData.extractionsChange > 0 ? "#52c41a" : "#ff4d4f",
                          }}
                        >
                          {displayData.extractionsChange > 0 ? (
                            <ArrowUpOutlined />
                          ) : (
                            <ArrowDownOutlined />
                          )}
                          {Math.abs(displayData.extractionsChange)}%
                        </span>
                      )
                    }
                  />
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title="Avg Satisfaction"
                    value={displayData.avgSatisfaction}
                    precision={1}
                    prefix={<SmileOutlined />}
                    suffix="/ 5"
                  />
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title="Issue Resolution"
                    value={displayData.issueResolutionRate}
                    precision={0}
                    prefix={<CheckCircleOutlined />}
                    suffix="%"
                  />
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 1 }} />
                ) : (
                  <Statistic
                    title="Top Intents"
                    value={displayData.topIntents.length}
                    prefix={<TeamOutlined />}
                    suffix="unique"
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Charts Row */}
          <Row gutter={16}>
            <Col span={16}>
              <Card
                title={
                  <Space>
                    <LineChartOutlined />
                    <span>Extraction Trend</span>
                  </Space>
                }
                size="small"
                style={{ borderRadius: 10 }}
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 6 }} />
                ) : displayData.extractionsTrend.length === 0 ? (
                  <Empty
                    image={<BotaLottieEmpty size={60} />} imageStyle={{ height: 60 }}
                    description="No data yet"
                    style={{ padding: 40 }}
                  />
                ) : (
                  <Line
                    data={displayData.extractionsTrend}
                    xField="date"
                    yField="count"
                    height={250}
                    smooth
                    color="#6C5CE7"
                    point={{ size: 3 }}
                    tooltip={{
                      formatter: (datum: Record<string, unknown>) => ({
                        name: "Extractions",
                        value: (datum as { count: number }).count,
                      }),
                    }}
                  />
                )}
              </Card>
            </Col>
            <Col span={8}>
              <Card
                title={
                  <Space>
                    <SmileOutlined />
                    <span>Sentiment Distribution</span>
                  </Space>
                }
                size="small"
                style={{ borderRadius: 10 }}
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 6 }} />
                ) : displayData.sentimentDistribution.every((s) => s.value === 0) ? (
                  <Empty
                    image={<BotaLottieEmpty size={60} />} imageStyle={{ height: 60 }}
                    description="No data yet"
                    style={{ padding: 40 }}
                  />
                ) : (
                  <Pie
                    data={displayData.sentimentDistribution}
                    angleField="value"
                    colorField="type"
                    radius={0.8}
                    innerRadius={0.5}
                    height={250}
                    label={{
                      type: "inner",
                      offset: "-50%",
                      content: "{value}",
                      style: { textAlign: "center", fontSize: 14 },
                    }}
                    color={["#52c41a", "#1890ff", "#ff4d4f", "#faad14"]}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {/* Top Intents */}
          <Card
            title={
              <Space>
                <BulbOutlined />
                <span>Top Intents</span>
              </Space>
            }
            size="small"
            style={{ borderRadius: 10 }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 2 }} />
            ) : displayData.topIntents.length === 0 ? (
              <Empty
                image={<BotaLottieEmpty size={60} />} imageStyle={{ height: 60 }}
                description="No intents extracted yet"
              />
            ) : (
              <Space wrap>
                {displayData.topIntents.slice(0, 10).map((item) => (
                  <Tag key={item.intent} color="purple">
                    {item.intent} ({item.count})
                  </Tag>
                ))}
              </Space>
            )}
          </Card>

          {/* Recent Extractions */}
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>Recent Extractions</span>
              </Space>
            }
            size="small"
            style={{ borderRadius: 10 }}
          >
            <Table
              columns={columns}
              dataSource={displayData.recentExtractions}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 5 }}
              size="small"
              locale={{
                emptyText: (
                  <Empty
                    image={<BotaLottieEmpty size={60} />} imageStyle={{ height: 60 }}
                    description="No extractions yet"
                  />
                ),
              }}
            />
          </Card>
        </>
      )}
    </Space>
  );
}
