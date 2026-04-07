"use client";

import BotaLottieEmpty from "@/app/_components/BotaLottieEmpty";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Flex,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { ConversationInsight, SentimentType } from "@/lib/domain/agent-builder";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

interface InsightsTabProps {
  conversationId: string;
  messagesCount: number;
  durationSeconds: number;
  userMessagesCount: number;
  agentMessagesCount: number;
}

const sentimentConfig: Record<SentimentType, { color: string; icon: React.ReactNode; label: string }> = {
  positive: { color: "green", icon: <SmileOutlined />, label: "Positive" },
  neutral: { color: "blue", icon: <ExclamationCircleOutlined />, label: "Neutral" },
  negative: { color: "red", icon: <CloseCircleOutlined />, label: "Negative" },
  mixed: { color: "orange", icon: <ExclamationCircleOutlined />, label: "Mixed" },
};

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function InsightsTab({
  conversationId,
  messagesCount,
  durationSeconds,
  userMessagesCount,
  agentMessagesCount,
}: InsightsTabProps) {
  const [insight, setInsight] = useState<ConversationInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/conversations/${conversationId}/insights`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch insights");
      setInsight(data.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const extractInsights = useCallback(async () => {
    try {
      setExtracting(true);
      setError(null);
      const res = await fetch(`/api/conversations/${conversationId}/insights`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract insights");
      setInsight(data.insight);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract insights");
    } finally {
      setExtracting(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (loading) {
    return (
      <div style={{ padding: "16px 0" }}>
        <Skeleton active paragraph={{ rows: 4 }} />
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
          icon={<BotaFailureIcon size={16} />}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Basic Stats Card */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }}>
        <Typography.Title level={5} style={{ marginBottom: 12 }}>
          Conversation Summary
        </Typography.Title>
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Statistic title="Messages" value={messagesCount} valueStyle={{ fontSize: 20 }} />
          </Col>
          <Col span={12}>
            <Statistic
              title="Duration"
              value={fmtDuration(durationSeconds)}
              valueStyle={{ fontSize: 20 }}
            />
          </Col>
          <Col span={12}>
            <Statistic title="User Messages" value={userMessagesCount} valueStyle={{ fontSize: 20 }} />
          </Col>
          <Col span={12}>
            <Statistic title="Agent Messages" value={agentMessagesCount} valueStyle={{ fontSize: 20 }} />
          </Col>
        </Row>
      </Card>

      {/* AI Insights Section */}
      {!insight ? (
        <Card size="small" style={{ borderRadius: 10, textAlign: "center" }}>
          <Empty
            image={<BotaLottieEmpty />}
            imageStyle={{ height: 80 }}
            description={
              <Space direction="vertical" size={8}>
                <Typography.Text type="secondary">
                  No insights extracted yet
                </Typography.Text>
                <Button
                  type="primary"
                  icon={<BulbOutlined />}
                  loading={extracting}
                  onClick={extractInsights}
                >
                  Extract Insights with AI
                </Button>
              </Space>
            }
          />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Re-extract Button */}
          <Flex justify="flex-end">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={extracting}
              onClick={extractInsights}
            >
              Re-extract
            </Button>
          </Flex>

          {/* User Profile */}
          {insight.userProfile && Object.values(insight.userProfile).some(Boolean) && (
            <Card
              size="small"
              title={
                <Space>
                  <UserOutlined />
                  <span>User Profile</span>
                </Space>
              }
              style={{ borderRadius: 10 }}
            >
              <Descriptions size="small" column={2}>
                {insight.userProfile.name && (
                  <Descriptions.Item label="Name">{insight.userProfile.name}</Descriptions.Item>
                )}
                {insight.userProfile.email && (
                  <Descriptions.Item label="Email">{insight.userProfile.email}</Descriptions.Item>
                )}
                {insight.userProfile.phone && (
                  <Descriptions.Item label="Phone">{insight.userProfile.phone}</Descriptions.Item>
                )}
                {insight.userProfile.company && (
                  <Descriptions.Item label="Company">{insight.userProfile.company}</Descriptions.Item>
                )}
                {insight.userProfile.location && (
                  <Descriptions.Item label="Location">{insight.userProfile.location}</Descriptions.Item>
                )}
                {insight.userProfile.language && (
                  <Descriptions.Item label="Language">{insight.userProfile.language}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Intent & Topics */}
          <Card size="small" title="Intent & Topics" style={{ borderRadius: 10 }}>
            {insight.primaryIntent && (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Primary Intent
                </Typography.Text>
                <div>
                  <Tag color="purple" style={{ marginTop: 4 }}>
                    {insight.primaryIntent}
                  </Tag>
                </div>
              </div>
            )}
            {insight.topics && insight.topics.length > 0 && (
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Topics Discussed
                </Typography.Text>
                <div style={{ marginTop: 4 }}>
                  {insight.topics.map((topic, i) => (
                    <Tag key={i} style={{ marginBottom: 4 }}>
                      {topic}
                    </Tag>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Sentiment Analysis */}
          <Card size="small" title="Sentiment Analysis" style={{ borderRadius: 10 }}>
            <Row gutter={16}>
              <Col span={8}>
                {insight.sentiment && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Sentiment
                    </Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag
                        icon={sentimentConfig[insight.sentiment]?.icon}
                        color={sentimentConfig[insight.sentiment]?.color}
                      >
                        {sentimentConfig[insight.sentiment]?.label || insight.sentiment}
                      </Tag>
                    </div>
                  </div>
                )}
              </Col>
              <Col span={8}>
                {insight.satisfactionScore && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Satisfaction
                    </Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      <Progress
                        percent={insight.satisfactionScore * 20}
                        size="small"
                        format={() => `${insight.satisfactionScore}/5`}
                        strokeColor={
                          insight.satisfactionScore >= 4
                            ? "#52c41a"
                            : insight.satisfactionScore >= 3
                            ? "#faad14"
                            : "#ff4d4f"
                        }
                      />
                    </div>
                  </div>
                )}
              </Col>
              <Col span={8}>
                {typeof insight.issueResolved === "boolean" && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Issue Resolved
                    </Typography.Text>
                    <div style={{ marginTop: 4 }}>
                      <Tag
                        icon={
                          insight.issueResolved ? (
                            <CheckCircleOutlined />
                          ) : (
                            <CloseCircleOutlined />
                          )
                        }
                        color={insight.issueResolved ? "success" : "error"}
                      >
                        {insight.issueResolved ? "Yes" : "No"}
                      </Tag>
                    </div>
                  </div>
                )}
              </Col>
            </Row>
          </Card>

          {/* Action Items */}
          {insight.actionItems && insight.actionItems.length > 0 && (
            <Card size="small" title="Action Items" style={{ borderRadius: 10 }}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {insight.actionItems.map((item, i) => (
                  <Flex key={i} align="flex-start" gap={8}>
                    <Checkbox checked={item.completed} disabled />
                    <div>
                      <Typography.Text>{item.description}</Typography.Text>
                      {item.assignee && (
                        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          @{item.assignee}
                        </Typography.Text>
                      )}
                      {item.dueDate && (
                        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          Due: {item.dueDate}
                        </Typography.Text>
                      )}
                    </div>
                  </Flex>
                ))}
              </Space>
            </Card>
          )}

          {/* Summary */}
          {insight.summary && (
            <Card size="small" title="AI Summary" style={{ borderRadius: 10 }}>
              <Typography.Paragraph style={{ marginBottom: 12 }}>
                {insight.summary}
              </Typography.Paragraph>
              {insight.keyPoints && insight.keyPoints.length > 0 && (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Key Points
                  </Typography.Text>
                  <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                    {insight.keyPoints.map((point, i) => (
                      <li key={i}>
                        <Typography.Text>{point}</Typography.Text>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* Extraction Metadata */}
          {insight.extractedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Extracted at {new Date(insight.extractedAt).toLocaleString()} using{" "}
              {insight.extractionModel || "AI"}
            </Typography.Text>
          )}
        </Space>
      )}
    </div>
  );
}
