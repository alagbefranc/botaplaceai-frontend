"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ApiOutlined,
  BulbOutlined,
  CloudSyncOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import type { TabProps } from "./types";

const INSIGHT_TYPES = [
  { key: "user_profile", label: "User Profile", description: "Name, email, phone, company" },
  { key: "intent", label: "Intent & Topics", description: "Primary intent and discussed topics" },
  { key: "sentiment", label: "Sentiment", description: "Emotional tone and satisfaction" },
  { key: "action_items", label: "Action Items", description: "Tasks and follow-ups" },
  { key: "summary", label: "Summary", description: "AI-generated summary and key points" },
];

const TIME_WINDOWS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];

export function MemoryTab({
  agent,
  updateMemory,
  updateInsightExtraction,
}: TabProps) {
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const testWebhook = async () => {
    if (!agent.memory.webhookUrl) return;
    
    setTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const response = await fetch(`/api/agents/${agent.id}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telnyx_conversation_channel: "test",
          telnyx_agent_target: "test-agent",
          telnyx_end_user_target: "test-user",
          telnyx_end_user_target_verified: false,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setWebhookTestResult({
          success: true,
          message: "Webhook responded successfully",
        });
      } else {
        setWebhookTestResult({
          success: false,
          message: data.error || "Webhook test failed",
        });
      }
    } catch (error) {
      setWebhookTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Request failed",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Memory Settings Card */}
      <Card
        title={
          <Space>
            <CloudSyncOutlined />
            <span>Conversation Memory</span>
            <Tooltip title="Enable your AI to recall information from past conversations with the same user">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Enable Toggle */}
          <Form.Item
            label={
              <Space>
                <span>Enable Memory</span>
                <Tag color="blue">Beta</Tag>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Switch
              checked={agent.memory.enabled}
              onChange={(checked) => updateMemory({ enabled: checked })}
            />
          </Form.Item>

          {agent.memory.enabled && (
            <>
              <Divider style={{ margin: "8px 0" }} />

              {/* Memory Scope */}
              <Form.Item
                label={
                  <Space>
                    <span>Memory Scope</span>
                    <Tooltip title="Which conversations should this agent remember?">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 0 }}
              >
                <Select
                  value={agent.memory.scope}
                  onChange={(value) => updateMemory({ scope: value })}
                  style={{ width: 200 }}
                  options={[
                    { value: "per_user", label: "Per User (recommended)" },
                    { value: "all", label: "All Conversations (any agent)" },
                    { value: "per_group", label: "Per User Group" },
                  ]}
                />
              </Form.Item>

              {/* User Identifier */}
              <Form.Item
                label={
                  <Space>
                    <span>User Identifier</span>
                    <Tooltip title="How to identify returning users across conversations">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 0 }}
              >
                <Select
                  value={agent.memory.identifierField}
                  onChange={(value) => updateMemory({ identifierField: value })}
                  style={{ width: 200 }}
                  options={[
                    { value: "session_id", label: "Session ID" },
                    { value: "phone", label: "Phone Number" },
                    { value: "email", label: "Email Address" },
                    { value: "custom", label: "Custom Field" },
                  ]}
                />
              </Form.Item>

              {agent.memory.identifierField === "custom" && (
                <Form.Item
                  label="Custom Identifier Path"
                  style={{ marginBottom: 0 }}
                >
                  <Input
                    value={agent.memory.customIdentifierPath || ""}
                    onChange={(e) =>
                      updateMemory({ customIdentifierPath: e.target.value })
                    }
                    placeholder="e.g., user_id or metadata.customer_id"
                    style={{ width: 300 }}
                  />
                </Form.Item>
              )}

              <Row gutter={24}>
                {/* Max Conversations */}
                <Col span={12}>
                  <Form.Item
                    label={
                      <Space>
                        <span>Max Conversations to Remember</span>
                        <Tooltip title="How many past conversations to include in memory">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Slider
                      min={1}
                      max={20}
                      value={agent.memory.maxConversations}
                      onChange={(value) => updateMemory({ maxConversations: value })}
                      marks={{
                        1: "1",
                        5: "5",
                        10: "10",
                        20: "20",
                      }}
                    />
                  </Form.Item>
                </Col>

                {/* Time Window */}
                <Col span={12}>
                  <Form.Item
                    label={
                      <Space>
                        <span>Time Window</span>
                        <Tooltip title="Only remember conversations from this period">
                          <InfoCircleOutlined style={{ color: "#999" }} />
                        </Tooltip>
                      </Space>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      value={agent.memory.timeWindowDays}
                      onChange={(value) => updateMemory({ timeWindowDays: value })}
                      style={{ width: "100%" }}
                      options={TIME_WINDOWS}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Insight Types to Include */}
              <Form.Item
                label={
                  <Space>
                    <span>Information to Remember</span>
                    <Tooltip title="Select which types of extracted insights to include in memory">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 0 }}
              >
                <Checkbox.Group
                  value={agent.memory.includeInsightTypes}
                  onChange={(values) =>
                    updateMemory({ includeInsightTypes: values as string[] })
                  }
                >
                  <Space direction="vertical" size={8}>
                    {INSIGHT_TYPES.map((type) => (
                      <Checkbox key={type.key} value={type.key}>
                        <Space>
                          <span>{type.label}</span>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            ({type.description})
                          </Typography.Text>
                        </Space>
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              </Form.Item>
            </>
          )}
        </Space>
      </Card>

      {/* Insight Extraction Card */}
      <Card
        title={
          <Space>
            <BulbOutlined />
            <span>Insight Extraction</span>
            <Tooltip title="Configure how AI extracts insights from conversations">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Enable Extraction */}
          <Form.Item
            label="Enable AI Insight Extraction"
            style={{ marginBottom: 0 }}
          >
            <Switch
              checked={agent.insightExtraction.enabled}
              onChange={(checked) =>
                updateInsightExtraction({ enabled: checked })
              }
            />
          </Form.Item>

          {agent.insightExtraction.enabled && (
            <>
              <Divider style={{ margin: "8px 0" }} />

              {/* Auto Extract on End */}
              <Form.Item
                label={
                  <Space>
                    <span>Auto-Extract on Conversation End</span>
                    <Tooltip title="Automatically extract insights when a conversation ends">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 0 }}
              >
                <Switch
                  checked={agent.insightExtraction.autoExtractOnEnd}
                  onChange={(checked) =>
                    updateInsightExtraction({ autoExtractOnEnd: checked })
                  }
                />
              </Form.Item>

              {/* Extraction Types */}
              <Typography.Text strong>What to Extract:</Typography.Text>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractUserProfile}
                    onChange={(e) =>
                      updateInsightExtraction({ extractUserProfile: e.target.checked })
                    }
                  >
                    <Space>
                      <UserOutlined />
                      <span>User Profile</span>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractIntent}
                    onChange={(e) =>
                      updateInsightExtraction({ extractIntent: e.target.checked })
                    }
                  >
                    <Space>
                      <ThunderboltOutlined />
                      <span>Intent & Topics</span>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractSentiment}
                    onChange={(e) =>
                      updateInsightExtraction({ extractSentiment: e.target.checked })
                    }
                  >
                    <Space>
                      <span>Sentiment Analysis</span>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractActionItems}
                    onChange={(e) =>
                      updateInsightExtraction({ extractActionItems: e.target.checked })
                    }
                  >
                    <Space>
                      <span>Action Items</span>
                    </Space>
                  </Checkbox>
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>

      {/* Webhook Configuration (Advanced) */}
      {agent.memory.enabled && (
        <Collapse
          items={[
            {
              key: "webhook",
              label: (
                <Space>
                  <ApiOutlined />
                  <span>Dynamic Variables Webhook (Advanced)</span>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    title="Webhook Integration"
                    description="Configure a webhook to dynamically inject variables and control memory access at the start of each conversation. This is useful for integrating with external CRM systems."
                    showIcon
                  />

                  <Form.Item
                    label="Enable Webhook"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch
                      checked={agent.memory.webhookEnabled}
                      onChange={(checked) =>
                        updateMemory({ webhookEnabled: checked })
                      }
                    />
                  </Form.Item>

                  {agent.memory.webhookEnabled && (
                    <>
                      <Form.Item
                        label="Webhook URL"
                        style={{ marginBottom: 0 }}
                      >
                        <Input
                          value={agent.memory.webhookUrl || ""}
                          onChange={(e) =>
                            updateMemory({ webhookUrl: e.target.value })
                          }
                          placeholder="https://your-api.com/webhook/memory"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Form.Item
                        label={
                          <Space>
                            <span>Timeout (ms)</span>
                            <Tooltip title="If webhook doesn't respond within this time, conversation proceeds without webhook data">
                              <InfoCircleOutlined style={{ color: "#999" }} />
                            </Tooltip>
                          </Space>
                        }
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          value={agent.memory.webhookTimeoutMs}
                          onChange={(value) =>
                            updateMemory({ webhookTimeoutMs: value || 1000 })
                          }
                          min={100}
                          max={5000}
                          step={100}
                          addonAfter="ms"
                          style={{ width: 150 }}
                        />
                      </Form.Item>

                      <Button
                        type="default"
                        icon={<ThunderboltOutlined />}
                        onClick={testWebhook}
                        loading={testingWebhook}
                        disabled={!agent.memory.webhookUrl}
                      >
                        Test Webhook
                      </Button>

                      {webhookTestResult && (
                        <Alert
                          type={webhookTestResult.success ? "success" : "error"}
                          title={webhookTestResult.message}
                          showIcon
                        />
                      )}

                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Webhook receives a POST with conversation initialization data and should respond with:
                      </Typography.Text>
                      <Typography.Text
                        code
                        copyable
                        style={{ fontSize: 11, display: "block", whiteSpace: "pre-wrap" }}
                      >
{`{
  "dynamic_variables": { "user_name": "..." },
  "memory": {
    "conversation_query": "metadata->user_id=eq.123&limit=5",
    "insight_query": "insight_ids=abc,def"
  }
}`}
                      </Typography.Text>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}
    </Space>
  );
}
