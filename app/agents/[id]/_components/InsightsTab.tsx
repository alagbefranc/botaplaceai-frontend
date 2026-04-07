"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Transfer,
  Typography,
} from "antd";
import {
  AuditOutlined,
  BulbOutlined,
  GroupOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { TabProps } from "./types";
import type { InsightDefinition, InsightGroup } from "@/lib/domain/agent-builder";
import { RUBRIC_OPTIONS, DEFAULT_ANALYSIS_PLAN } from "@/lib/domain/agent-builder";

interface InsightsTabProps extends TabProps {}

export function InsightsTab({
  agent,
  updateInsightExtraction,
  updateCustomInsights,
  updateAnalysisPlan,
}: InsightsTabProps) {
  const [definitions, setDefinitions] = useState<InsightDefinition[]>([]);
  const [groups, setGroups] = useState<InsightGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch custom insight definitions and groups
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [defsRes, groupsRes] = await Promise.all([
        fetch("/api/insights"),
        fetch("/api/insights/groups"),
      ]);

      const [defsData, groupsData] = await Promise.all([
        defsRes.json(),
        groupsRes.json(),
      ]);

      if (!defsRes.ok) throw new Error(defsData.error || "Failed to load insights");
      if (!groupsRes.ok) throw new Error(groupsData.error || "Failed to load groups");

      // Filter out templates - only show org-specific definitions
      setDefinitions((defsData.insights || []).filter((d: InsightDefinition) => !d.isTemplate));
      setGroups(groupsData.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const customInsights = agent.customInsights || {
    enabled: false,
    definitionIds: [],
    groupIds: [],
    autoExtractOnEnd: true,
  };

  const handleToggle = (checked: boolean) => {
    updateCustomInsights?.({ enabled: checked });
  };

  const handleDefinitionsChange = (targetKeys: React.Key[]) => {
    updateCustomInsights?.({ definitionIds: targetKeys as string[] });
  };

  const handleGroupsChange = (groupIds: string[]) => {
    updateCustomInsights?.({ groupIds });
  };

  const handleAutoExtractChange = (checked: boolean) => {
    updateCustomInsights?.({ autoExtractOnEnd: checked });
  };

  // Transfer data
  const transferData = definitions.map((d) => ({
    key: d.id!,
    title: d.name,
    description: d.description,
    insightType: d.insightType,
    paramCount: d.schema?.parameters?.length || 0,
  }));

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* System Insights Card */}
      <Card
        title={
          <Space>
            <BulbOutlined />
            <span>System Insights</span>
            <Tooltip title="Built-in insights extracted from every conversation">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Enable Extraction */}
          <Form.Item
            label={
              <Space>
                <span>Enable AI Insight Extraction</span>
                <Tooltip title="Automatically extract user profile, intent, sentiment, and other data from conversations">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Switch
              checked={agent.insightExtraction.enabled}
              onChange={(checked) => updateInsightExtraction({ enabled: checked })}
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
                  onChange={(checked) => updateInsightExtraction({ autoExtractOnEnd: checked })}
                />
              </Form.Item>

              {/* Extraction Types */}
              <Typography.Text strong>What to Extract:</Typography.Text>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractUserProfile}
                    onChange={(e) => updateInsightExtraction({ extractUserProfile: e.target.checked })}
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
                    onChange={(e) => updateInsightExtraction({ extractIntent: e.target.checked })}
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
                    onChange={(e) => updateInsightExtraction({ extractSentiment: e.target.checked })}
                  >
                    <Space>
                      <span>Sentiment Analysis</span>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={12}>
                  <Checkbox
                    checked={agent.insightExtraction.extractActionItems}
                    onChange={(e) => updateInsightExtraction({ extractActionItems: e.target.checked })}
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

      {/* Custom Insights Card */}
      <Card
        title={
          <Space>
            <RocketOutlined />
            <span>Custom Insights</span>
            <Tag color="blue">Pro</Tag>
            <Tooltip title="Define and extract your own structured insights from conversations">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Enable Custom Insights */}
          <Form.Item
            label={
              <Space>
                <span>Enable Custom Insights</span>
                <Tooltip title="Extract data using your custom insight definitions">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Switch
              checked={customInsights.enabled}
              onChange={handleToggle}
            />
          </Form.Item>

          {customInsights.enabled && (
            <>
              <Divider style={{ margin: "8px 0" }} />

              {/* Auto-extract toggle */}
              <Form.Item
                label={
                  <Space>
                    <span>Auto-Extract on Conversation End</span>
                    <Tooltip title="Automatically run custom insight extraction when conversations end">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
                style={{ marginBottom: 0 }}
              >
                <Switch
                  checked={customInsights.autoExtractOnEnd}
                  onChange={handleAutoExtractChange}
                />
              </Form.Item>

              {/* Select Insight Definitions */}
              <Form.Item
                label={
                  <Space>
                    <span>Insight Definitions to Extract</span>
                    <Tooltip title="Select which custom insights this agent should extract">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 3 }} />
                ) : error ? (
                  <Alert type="error" title={error} showIcon />
                ) : definitions.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <Space direction="vertical" size={8}>
                        <Typography.Text type="secondary">
                          No custom insights defined yet
                        </Typography.Text>
                        <Button type="link" href="/insights" target="_blank">
                          Create Insights
                        </Button>
                      </Space>
                    }
                  />
                ) : (
                  <Transfer
                    dataSource={transferData}
                    targetKeys={customInsights.definitionIds}
                    onChange={handleDefinitionsChange}
                    render={(item) => (
                      <Space>
                        <Tag
                          color={item.insightType === "structured" ? "blue" : "purple"}
                          style={{ margin: 0 }}
                        >
                          {item.insightType === "structured" ? <ThunderboltOutlined /> : "U"}
                        </Tag>
                        <span>{item.title}</span>
                        {item.paramCount > 0 && (
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            ({item.paramCount} params)
                          </Typography.Text>
                        )}
                      </Space>
                    )}
                    titles={["Available", "Selected"]}
                    styles={{ section: { width: 280, height: 200 } }}
                    showSearch
                    filterOption={(input, item) =>
                      item.title.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                )}
              </Form.Item>

              {/* Select Insight Groups */}
              <Form.Item
                label={
                  <Space>
                    <GroupOutlined />
                    <span>Insight Groups</span>
                    <Tooltip title="Select which insight groups to use for webhook delivery">
                      <InfoCircleOutlined style={{ color: "#999" }} />
                    </Tooltip>
                  </Space>
                }
              >
                {loading ? (
                  <Skeleton active paragraph={{ rows: 2 }} />
                ) : groups.length === 0 ? (
                  <Typography.Text type="secondary">
                    No insight groups configured.{" "}
                    <Button type="link" href="/insights" target="_blank" style={{ padding: 0 }}>
                      Create Groups
                    </Button>
                  </Typography.Text>
                ) : (
                  <Checkbox.Group
                    value={customInsights.groupIds}
                    onChange={(values) => handleGroupsChange(values as string[])}
                  >
                    <Space direction="vertical" size={8}>
                      {groups.map((group) => (
                        <Checkbox key={group.id} value={group.id}>
                          <Space>
                            <span>{group.name}</span>
                            {group.webhookEnabled && (
                              <Tag color="green" style={{ margin: 0 }}>
                                Webhook
                              </Tag>
                            )}
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              ({group.insightIds.length} insights)
                            </Typography.Text>
                          </Space>
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                )}
              </Form.Item>
            </>
          )}
        </Space>
      </Card>

      {/* Call Analysis Plan Card */}
      <Card
        title={
          <Space>
            <AuditOutlined />
            <span>Call Analysis Plan</span>
            <Tooltip title="Configure how this agent analyzes and evaluates calls automatically after they end">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            These settings control the automated analysis run after every conversation ends.
            Leave fields blank to use the default prompts.
          </Typography.Text>

          {/* Summary Prompt */}
          <Form.Item
            label={
              <Space>
                <span>Summary Prompt</span>
                <Tooltip title="Custom prompt for generating conversation summaries. Leave blank to use the default.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={3}
              value={agent.analysisPlan?.summaryPrompt ?? ""}
              onChange={(e) => updateAnalysisPlan?.({ summaryPrompt: e.target.value || undefined })}
              placeholder={DEFAULT_ANALYSIS_PLAN.summaryPrompt}
            />
          </Form.Item>

          <Divider style={{ margin: "8px 0" }} />

          {/* Success Evaluation Prompt */}
          <Form.Item
            label={
              <Space>
                <span>Success Evaluation Prompt</span>
                <Tooltip title="Prompt that evaluates whether the call was successful">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={3}
              value={agent.analysisPlan?.successEvaluationPrompt ?? ""}
              onChange={(e) => updateAnalysisPlan?.({ successEvaluationPrompt: e.target.value || undefined })}
              placeholder={DEFAULT_ANALYSIS_PLAN.successEvaluationPrompt}
            />
          </Form.Item>

          {/* Success Evaluation Rubric */}
          <Form.Item
            label={
              <Space>
                <span>Evaluation Rubric</span>
                <Tooltip title="How success should be scored">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Select
              style={{ width: "100%" }}
              value={agent.analysisPlan?.successEvaluationRubric ?? DEFAULT_ANALYSIS_PLAN.successEvaluationRubric}
              onChange={(value) => updateAnalysisPlan?.({ successEvaluationRubric: value })}
              options={RUBRIC_OPTIONS.map((opt) => ({
                value: opt.value,
                label: (
                  <Space>
                    <span>{opt.label}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      — {opt.description}
                    </Typography.Text>
                  </Space>
                ),
              }))}
            />
          </Form.Item>

          <Divider style={{ margin: "8px 0" }} />

          {/* Structured Data Prompt */}
          <Form.Item
            label={
              <Space>
                <span>Structured Data Prompt</span>
                <Tooltip title="Prompt for extracting structured data from the conversation. Requires a JSON schema below.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={3}
              value={agent.analysisPlan?.structuredDataPrompt ?? ""}
              onChange={(e) => updateAnalysisPlan?.({ structuredDataPrompt: e.target.value || undefined })}
              placeholder="e.g. Extract the customer's name, issue type, and resolution from this call."
            />
          </Form.Item>

          {/* Structured Data Schema */}
          <Form.Item
            label={
              <Space>
                <span>Structured Data Schema (JSON)</span>
                <Tooltip title="JSON Schema describing the shape of extracted data. Must be valid JSON.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              rows={5}
              value={
                agent.analysisPlan?.structuredDataSchema
                  ? JSON.stringify(agent.analysisPlan.structuredDataSchema, null, 2)
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value.trim();
                if (!val) {
                  updateAnalysisPlan?.({ structuredDataSchema: undefined });
                  return;
                }
                try {
                  const parsed = JSON.parse(val) as Record<string, unknown>;
                  updateAnalysisPlan?.({ structuredDataSchema: parsed });
                } catch {
                  // ignore invalid JSON while typing
                }
              }}
              placeholder={'{ "customerName": "string", "issueType": "string", "resolved": "boolean" }'}
              style={{ fontFamily: "monospace", fontSize: 12 }}
            />
          </Form.Item>
        </Space>
      </Card>
    </Space>
  );
}
