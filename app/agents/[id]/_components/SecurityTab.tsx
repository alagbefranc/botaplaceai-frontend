"use client";

import {
  InfoCircleOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Card,
  Checkbox,
  Col,
  Input,
  Row,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  GUARDRAIL_TOPICS,
  type GuardrailsConfig,
  type OutputGuardrailTopic,
  type InputGuardrailTopic,
} from "@/lib/domain/agent-builder";
import { TabProps } from "./types";

function FieldLabel({ label, help }: { label: string; help: string }) {
  return (
    <Space size={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Tooltip title={help}>
        <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
      </Tooltip>
    </Space>
  );
}

export function SecurityTab({ agent, updateGuardrails }: TabProps) {
  const guardrails = agent.guardrails;
  const outputTopics = GUARDRAIL_TOPICS.filter((t) => t.type === "output");
  const inputTopics = GUARDRAIL_TOPICS.filter((t) => t.type === "input");

  const toggleOutputTopic = (topicId: OutputGuardrailTopic) => {
    const current = guardrails.outputTopics || [];
    if (current.includes(topicId)) {
      updateGuardrails({ outputTopics: current.filter((t) => t !== topicId) });
    } else {
      updateGuardrails({ outputTopics: [...current, topicId] });
    }
  };

  const toggleInputTopic = (topicId: InputGuardrailTopic) => {
    const current = guardrails.inputTopics || [];
    if (current.includes(topicId)) {
      updateGuardrails({ inputTopics: current.filter((t) => t !== topicId) });
    } else {
      updateGuardrails({ inputTopics: [...current, topicId] });
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Main Guardrails Toggle */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>Safety Guardrails</span>
            {guardrails.enabled ? (
              <Tag color="green">Active</Tag>
            ) : (
              <Tag color="default">Disabled</Tag>
            )}
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            title="Real-time Content Moderation"
            description="Guardrails check agent responses and user messages for prohibited topics. When triggered, the content is replaced with a safe placeholder message. Adds ~50ms latency."
          />

          <Space>
            <Switch
              checked={guardrails.enabled}
              onChange={(enabled) => updateGuardrails({ enabled })}
            />
            <Typography.Text strong>
              Enable guardrails for this agent
            </Typography.Text>
          </Space>
        </Space>
      </Card>

      {/* Output Guardrails */}
      <Card
        title={
          <Space>
            <SafetyOutlined style={{ color: "#722ed1" }} />
            <span>Output Guardrails</span>
            <Tag color="purple">
              {guardrails.outputTopics?.length || 0} active
            </Tag>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Control what topics the agent should NOT discuss. If the agent attempts to
          respond with prohibited content, it will be replaced with the placeholder
          message.
        </Typography.Paragraph>

        <Row gutter={[16, 12]}>
          {outputTopics.map((topic) => {
            const isChecked = guardrails.outputTopics?.includes(
              topic.id as OutputGuardrailTopic
            );
            return (
              <Col span={12} key={topic.id}>
                <Card
                  size="small"
                  style={{
                    borderColor: isChecked ? "#722ed1" : undefined,
                    background: isChecked ? "#f9f0ff" : undefined,
                    cursor: guardrails.enabled ? "pointer" : "not-allowed",
                    opacity: guardrails.enabled ? 1 : 0.5,
                  }}
                  onClick={() =>
                    guardrails.enabled &&
                    toggleOutputTopic(topic.id as OutputGuardrailTopic)
                  }
                >
                  <Space>
                    <Checkbox
                      checked={isChecked}
                      disabled={!guardrails.enabled}
                      onChange={() =>
                        toggleOutputTopic(topic.id as OutputGuardrailTopic)
                      }
                    />
                    <div>
                      <Typography.Text strong>{topic.label}</Typography.Text>
                      <br />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {topic.description}
                      </Typography.Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>

        <div style={{ marginTop: 16 }}>
          <FieldLabel
            label="Output Placeholder Message"
            help="Message shown when the agent's response is blocked"
          />
          <Input.TextArea
            rows={2}
            value={guardrails.outputPlaceholder}
            onChange={(e) =>
              updateGuardrails({ outputPlaceholder: e.target.value })
            }
            disabled={!guardrails.enabled}
            placeholder="I'm not able to discuss that topic..."
            style={{ marginTop: 6 }}
          />
        </div>
      </Card>

      {/* Input Guardrails */}
      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: "#fa8c16" }} />
            <span>Input Guardrails</span>
            <Tag color="orange">
              {guardrails.inputTopics?.length || 0} active
            </Tag>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Detect and block manipulative user inputs. When triggered, the agent
          responds with the placeholder instead of processing the request.
        </Typography.Paragraph>

        <Row gutter={[16, 12]}>
          {inputTopics.map((topic) => {
            const isChecked = guardrails.inputTopics?.includes(
              topic.id as InputGuardrailTopic
            );
            return (
              <Col span={12} key={topic.id}>
                <Card
                  size="small"
                  style={{
                    borderColor: isChecked ? "#fa8c16" : undefined,
                    background: isChecked ? "#fff7e6" : undefined,
                    cursor: guardrails.enabled ? "pointer" : "not-allowed",
                    opacity: guardrails.enabled ? 1 : 0.5,
                  }}
                  onClick={() =>
                    guardrails.enabled &&
                    toggleInputTopic(topic.id as InputGuardrailTopic)
                  }
                >
                  <Space>
                    <Checkbox
                      checked={isChecked}
                      disabled={!guardrails.enabled}
                      onChange={() =>
                        toggleInputTopic(topic.id as InputGuardrailTopic)
                      }
                    />
                    <div>
                      <Typography.Text strong>{topic.label}</Typography.Text>
                      <br />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {topic.description}
                      </Typography.Text>
                    </div>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>

        <div style={{ marginTop: 16 }}>
          <FieldLabel
            label="Input Placeholder Message"
            help="Message shown when user input is blocked"
          />
          <Input.TextArea
            rows={2}
            value={guardrails.inputPlaceholder}
            onChange={(e) =>
              updateGuardrails({ inputPlaceholder: e.target.value })
            }
            disabled={!guardrails.enabled}
            placeholder="I notice you might be trying to test my boundaries..."
            style={{ marginTop: 6 }}
          />
        </div>
      </Card>

      {/* How It Works */}
      <Card title="How Guardrails Work" size="small">
        <Space direction="vertical" size={8}>
          <Typography.Text>
            <strong>1. Output Check:</strong> Before the agent speaks, its
            response is checked against enabled output topics.
          </Typography.Text>
          <Typography.Text>
            <strong>2. Input Check:</strong> User messages are checked for
            jailbreak attempts before processing.
          </Typography.Text>
          <Typography.Text>
            <strong>3. Safe Replacement:</strong> Problematic content is
            replaced with placeholder messages — the call continues normally.
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Note: Guardrails add approximately 50ms latency to each interaction.
          </Typography.Text>
        </Space>
      </Card>
    </Space>
  );
}
