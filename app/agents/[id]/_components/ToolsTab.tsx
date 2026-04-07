"use client";

import {
  ApiOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  PlusOutlined,
  SwapOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  type CustomFunction,
  type CustomFunctionParameter,
  type ToolRejectionPlan,
} from "@/lib/domain/agent-builder";
import type { TabProps } from "./types";

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

const AGENT_SKILLS = [
  {
    name: "search_knowledge_base",
    label: "Knowledge Base Search",
    description: "Searches your uploaded documents and websites to answer questions with accurate, grounded information.",
    icon: <InfoCircleOutlined />,
    color: "#6C5CE7",
  },
  {
    name: "transfer_to_human",
    label: "Transfer to Human",
    description: "Hands off the conversation to a live human agent when the AI can't resolve the issue.",
    icon: <CustomerServiceOutlined />,
    color: "#e17055",
  },
  {
    name: "end_conversation",
    label: "End Call / Chat",
    description: "Gracefully ends the conversation or hangs up a phone call when the issue is resolved.",
    icon: <PhoneOutlined />,
    color: "#636e72",
  },
  {
    name: "transfer_to_agent",
    label: "Transfer to Another Agent",
    description: "Hands off to a different AI agent in your org with full conversation context.",
    icon: <SwapOutlined />,
    color: "#0984e3",
  },
  {
    name: "call_api_endpoint",
    label: "Call External API",
    description: "Calls any external HTTP API for CRM lookups, order status, inventory checks, or custom integrations.",
    icon: <ApiOutlined />,
    color: "#00b894",
  },
  {
    name: "collect_user_info",
    label: "Collect User Information",
    description: "Stores structured data collected during conversation — name, email, phone, address, or custom fields.",
    icon: <UserOutlined />,
    color: "#fdcb6e",
  },
];

export function ToolsTab({ agent, updateAgentField, updateToolsConfig }: TabProps) {
  const { customFunctions, toolsConfig } = agent;

  // Custom Functions
  const addCustomFunction = () => {
    const newFn: CustomFunction = {
      id: crypto.randomUUID(),
      name: "",
      description: "",
      parameters: [],
      endpoint: { url: "", method: "POST" },
      enabled: true,
    };
    updateAgentField("customFunctions", [...customFunctions, newFn]);
  };

  const updateCustomFunction = (fnId: string, patch: Partial<CustomFunction>) => {
    updateAgentField(
      "customFunctions",
      customFunctions.map((fn) => (fn.id === fnId ? { ...fn, ...patch } : fn))
    );
  };

  const removeCustomFunction = (fnId: string) => {
    updateAgentField(
      "customFunctions",
      customFunctions.filter((fn) => fn.id !== fnId)
    );
  };

  const updateCustomFunctionEndpoint = (
    fnId: string,
    patch: Partial<CustomFunction["endpoint"]>
  ) => {
    const fn = customFunctions.find((f) => f.id === fnId);
    if (!fn) return;
    updateCustomFunction(fnId, { endpoint: { ...fn.endpoint, ...patch } });
  };

  const addCustomFunctionParam = (fnId: string) => {
    const fn = customFunctions.find((f) => f.id === fnId);
    if (!fn) return;
    const newParam: CustomFunctionParameter = {
      name: "",
      type: "string",
      description: "",
      required: false,
    };
    updateCustomFunction(fnId, { parameters: [...fn.parameters, newParam] });
  };

  const updateCustomFunctionParam = (
    fnId: string,
    paramIndex: number,
    patch: Partial<CustomFunctionParameter>
  ) => {
    const fn = customFunctions.find((f) => f.id === fnId);
    if (!fn) return;
    const updated = fn.parameters.map((p, i) =>
      i === paramIndex ? { ...p, ...patch } : p
    );
    updateCustomFunction(fnId, { parameters: updated });
  };

  const removeCustomFunctionParam = (fnId: string, paramIndex: number) => {
    const fn = customFunctions.find((f) => f.id === fnId);
    if (!fn) return;
    updateCustomFunction(fnId, {
      parameters: fn.parameters.filter((_, i) => i !== paramIndex),
    });
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: "100%" }}>
      {/* Built-in Agent Skills */}
      <Card
        title={
          <Space>
            <ToolOutlined />
            <span>Agent Skills (Built-in)</span>
            <Tooltip title="Core capabilities that are always available to your agent, enabling essential features like knowledge retrieval and human handoff.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          These core skills are always available to your agent. They enable essential capabilities
          like knowledge retrieval, human handoff, and data collection.
        </Typography.Paragraph>

        <Row gutter={[12, 12]}>
          {AGENT_SKILLS.map((skill) => (
            <Col key={skill.name} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{ height: "100%" }}
              >
                <Space orientation="vertical" size={4}>
                  <Space>
                    <span style={{ color: skill.color }}>{skill.icon}</span>
                    <Typography.Text strong>{skill.label}</Typography.Text>
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {skill.description}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Custom Functions */}
      <Card
        title={
          <Space>
            <CodeOutlined />
            <span>Custom Functions</span>
            <Tag color="purple">{customFunctions.length}</Tag>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addCustomFunction}>
            Add Function
          </Button>
        }
      >
        {customFunctions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Typography.Text type="secondary">
                No custom functions yet. Add one to let your agent call your own API endpoints.
              </Typography.Text>
            }
          />
        ) : (
          <Collapse
            accordion
            size="small"
            items={customFunctions.map((fn) => ({
              key: fn.id,
              label: (
                <Space size={8}>
                  <ApiOutlined style={{ color: "#00b894" }} />
                  <span>{fn.name || "Untitled function"}</span>
                  {!fn.enabled && <Tag color="default">Disabled</Tag>}
                </Space>
              ),
              extra: (
                <Space size={4} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title={fn.enabled ? "Enabled" : "Disabled"}>
                    <Switch
                      size="small"
                      checked={fn.enabled}
                      onChange={(checked) => updateCustomFunction(fn.id, { enabled: checked })}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="Delete this function?"
                    onConfirm={() => removeCustomFunction(fn.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
              children: (
                <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <FieldLabel label="Function name" help="Snake_case identifier used by the AI model." />
                      <Input
                        value={fn.name}
                        onChange={(e) =>
                          updateCustomFunction(fn.id, {
                            name: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
                          })
                        }
                        placeholder="e.g. get_order_status"
                        style={{ marginTop: 4 }}
                      />
                    </Col>
                    <Col span={12}>
                      <FieldLabel label="Description" help="Tell the AI when and why to call this function." />
                      <Input
                        value={fn.description}
                        onChange={(e) => updateCustomFunction(fn.id, { description: e.target.value })}
                        placeholder="e.g. Retrieves the status of a customer order"
                        style={{ marginTop: 4 }}
                      />
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col span={4}>
                      <FieldLabel label="Method" help="HTTP method for the API request." />
                      <Select
                        value={fn.endpoint.method}
                        onChange={(method) =>
                          updateCustomFunctionEndpoint(fn.id, { method })
                        }
                        style={{ width: "100%", marginTop: 4 }}
                        options={[
                          { value: "GET", label: "GET" },
                          { value: "POST", label: "POST" },
                          { value: "PUT", label: "PUT" },
                          { value: "PATCH", label: "PATCH" },
                          { value: "DELETE", label: "DELETE" },
                        ]}
                      />
                    </Col>
                    <Col span={20}>
                      <FieldLabel label="Endpoint URL" help="The full URL your agent will call." />
                      <Input
                        value={fn.endpoint.url}
                        onChange={(e) => updateCustomFunctionEndpoint(fn.id, { url: e.target.value })}
                        placeholder="https://api.example.com/v1/orders"
                        style={{ marginTop: 4 }}
                      />
                    </Col>
                  </Row>

                  <div>
                    <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
                      <FieldLabel label="Parameters" help="Define input parameters the AI should provide." />
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => addCustomFunctionParam(fn.id)}
                      >
                        Add Parameter
                      </Button>
                    </Space>

                    {fn.parameters.length === 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        No parameters defined. The function will be called with no arguments.
                      </Typography.Text>
                    ) : (
                      <Space orientation="vertical" size={6} style={{ width: "100%" }}>
                        {fn.parameters.map((param, pIdx) => (
                          <Row key={pIdx} gutter={8} align="middle">
                            <Col span={5}>
                              <Input
                                size="small"
                                value={param.name}
                                onChange={(e) =>
                                  updateCustomFunctionParam(fn.id, pIdx, {
                                    name: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
                                  })
                                }
                                placeholder="name"
                              />
                            </Col>
                            <Col span={4}>
                              <Select
                                size="small"
                                value={param.type}
                                onChange={(type) => updateCustomFunctionParam(fn.id, pIdx, { type })}
                                style={{ width: "100%" }}
                                options={[
                                  { value: "string", label: "string" },
                                  { value: "number", label: "number" },
                                  { value: "boolean", label: "boolean" },
                                  { value: "object", label: "object" },
                                  { value: "array", label: "array" },
                                ]}
                              />
                            </Col>
                            <Col span={9}>
                              <Input
                                size="small"
                                value={param.description}
                                onChange={(e) =>
                                  updateCustomFunctionParam(fn.id, pIdx, { description: e.target.value })
                                }
                                placeholder="description"
                              />
                            </Col>
                            <Col span={4}>
                              <Space size={4}>
                                <Switch
                                  size="small"
                                  checked={param.required}
                                  onChange={(required) =>
                                    updateCustomFunctionParam(fn.id, pIdx, { required })
                                  }
                                />
                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                  Required
                                </Typography.Text>
                              </Space>
                            </Col>
                            <Col span={2} style={{ textAlign: "right" }}>
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeCustomFunctionParam(fn.id, pIdx)}
                              />
                            </Col>
                          </Row>
                        ))}
                      </Space>
                    )}
                  </div>
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      {/* Tool Settings */}
      <Card
        title={
          <Space>
            <span>Tool Settings</span>
            <Tooltip title="Configure how your agent handles tool failures and advanced tool capabilities.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Row gutter={12}>
            <Col span={8}>
              <FieldLabel label="Rejection Plan" help="What to do when a tool call fails." />
              <Select
                value={toolsConfig.rejectionPlan}
                onChange={(rejectionPlan) =>
                  updateToolsConfig({ rejectionPlan: rejectionPlan as ToolRejectionPlan })
                }
                style={{ width: "100%", marginTop: 6 }}
                options={[
                  { value: "retry", label: "Retry" },
                  { value: "fallback", label: "Use Fallback" },
                  { value: "escalate", label: "Escalate to Human" },
                  { value: "ignore", label: "Ignore & Continue" },
                ]}
              />
            </Col>
            <Col span={4}>
              <FieldLabel label="Max Retries" help="Maximum retry attempts on failure." />
              <InputNumber
                min={0}
                max={5}
                value={toolsConfig.maxRetries}
                onChange={(value) => updateToolsConfig({ maxRetries: value ?? 2 })}
                style={{ width: "100%", marginTop: 6 }}
              />
            </Col>
          </Row>

          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Code Tool" help="Allow agent to execute sandboxed code for calculations." />
            </Col>
            <Col span={18}>
              <Space>
                <Switch
                  checked={toolsConfig.codeToolEnabled}
                  onChange={(codeToolEnabled) => updateToolsConfig({ codeToolEnabled })}
                />
                <Tag color="orange">Beta</Tag>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Voicemail */}
      <Card
        title={
          <Space>
            <span>Voicemail Tool</span>
            <Tooltip title="Let callers leave voice messages when your agent can't resolve their issue immediately.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Enable voicemail capability for phone channel when agent can't handle a request.
        </Typography.Paragraph>

        <Space orientation="vertical" size={14} style={{ width: "100%" }}>
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable Voicemail" help="Allow users to leave voicemail messages." />
            </Col>
            <Col span={18}>
              <Switch
                checked={toolsConfig.voicemailEnabled}
                onChange={(voicemailEnabled) => updateToolsConfig({ voicemailEnabled })}
              />
            </Col>
          </Row>

          {toolsConfig.voicemailEnabled && toolsConfig.voicemailConfig && (
            <>
              <div>
                <FieldLabel label="Voicemail Greeting" help="The message played before the user starts recording their voicemail." />
                <Input.TextArea
                  rows={2}
                  value={toolsConfig.voicemailConfig.greeting}
                  onChange={(e) =>
                    updateToolsConfig({
                      voicemailConfig: {
                        ...toolsConfig.voicemailConfig!,
                        greeting: e.target.value,
                      },
                    })
                  }
                  placeholder="Please leave a message after the tone..."
                  style={{ marginTop: 6 }}
                />
              </div>

              <Row gutter={12}>
                <Col span={8}>
                  <FieldLabel label="Max Duration" help="Maximum recording time for voicemails. Longer messages will be cut off." />
                  <InputNumber
                    min={10}
                    max={300}
                    value={toolsConfig.voicemailConfig.maxDurationSeconds}
                    onChange={(value) =>
                      updateToolsConfig({
                        voicemailConfig: {
                          ...toolsConfig.voicemailConfig!,
                          maxDurationSeconds: value ?? 120,
                        },
                      })
                    }
                    style={{ width: "100%", marginTop: 6 }}
                    addonAfter="sec"
                  />
                </Col>
                <Col span={8}>
                  <Row align="middle" style={{ marginTop: 24 }}>
                    <Space>
                      <Switch
                        checked={toolsConfig.voicemailConfig.transcribe}
                        onChange={(transcribe) =>
                          updateToolsConfig({
                            voicemailConfig: {
                              ...toolsConfig.voicemailConfig!,
                              transcribe,
                            },
                          })
                        }
                      />
                      <FieldLabel label="Transcribe" help="Convert voicemails to text for easier review." />
                    </Space>
                  </Row>
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>
    </Space>
  );
}
