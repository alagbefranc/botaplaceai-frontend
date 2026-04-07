"use client";

import BotaLottieEmpty from "@/app/_components/BotaLottieEmpty";

import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";
import type {
  Eval,
  EvalMessage,
  EvalRun,
  EvalJudgeType,
} from "@/lib/domain/agent-builder";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

const { TextArea } = Input;

interface Agent {
  id: string;
  name: string;
}

// Eval Card Component
function EvalCard({
  evalItem,
  onEdit,
  onDelete,
  onRun,
  onViewRuns,
}: {
  evalItem: Eval;
  onEdit: () => void;
  onDelete: () => void;
  onRun: () => void;
  onViewRuns: () => void;
}) {
  const messageCount = evalItem.messages?.length || 0;
  const hasJudges = evalItem.messages?.some((m) => m.judgePlan) || false;

  return (
    <Card
      hoverable
      size="small"
      style={{ borderRadius: 12, height: "100%" }}
      actions={[
        <Tooltip key="run" title="Run Test">
          <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={onRun}>
            Run
          </Button>
        </Tooltip>,
        <Tooltip key="edit" title="Edit">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit}>
            Edit
          </Button>
        </Tooltip>,
        <Tooltip key="history" title="View Runs">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={onViewRuns}>
            History
          </Button>
        </Tooltip>,
        <Tooltip key="delete" title="Delete">
          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={onDelete} />
        </Tooltip>,
      ]}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space>
          <Tag color="purple">
            <ExperimentOutlined /> Mock Conversation
          </Tag>
        </Space>
        <Typography.Text strong style={{ fontSize: 16 }}>
          {evalItem.name}
        </Typography.Text>
        {evalItem.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {evalItem.description}
          </Typography.Text>
        )}
        <Space size={16}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {messageCount} turn{messageCount !== 1 ? "s" : ""}
          </Typography.Text>
          {hasJudges && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              <ThunderboltOutlined /> Has Validators
            </Tag>
          )}
        </Space>
      </Space>
    </Card>
  );
}

// Eval Builder Drawer
function EvalBuilder({
  open,
  onClose,
  onSave,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Eval>) => void;
  initialData?: Eval;
}) {
  const [form] = Form.useForm();
  const [messages, setMessages] = useState<EvalMessage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          name: initialData.name,
          description: initialData.description,
        });
        setMessages(initialData.messages || []);
      } else {
        form.resetFields();
        setMessages([]);
      }
    }
  }, [open, initialData, form]);

  const addMessage = (role: EvalMessage["role"]) => {
    setMessages([...messages, { role, content: "" }]);
  };

  const updateMessage = (index: number, updates: Partial<EvalMessage>) => {
    const newMessages = [...messages];
    newMessages[index] = { ...newMessages[index], ...updates };
    setMessages(newMessages);
  };

  const removeMessage = (index: number) => {
    setMessages(messages.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSave({
        ...values,
        messages,
        type: "chat.mockConversation",
      });
      onClose();
    } catch (e) {
      console.error("Validation failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={initialData ? "Edit Evaluation" : "Create Evaluation"}
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Name"
          rules={[{ required: true, message: "Name is required" }]}
        >
          <Input placeholder="e.g., Greeting Test" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <TextArea rows={2} placeholder="What does this test validate?" />
        </Form.Item>
      </Form>

      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
        Conversation Turns
      </Typography.Title>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<UserOutlined />} onClick={() => addMessage("user")}>
          Add User Message
        </Button>
        <Button icon={<RobotOutlined />} onClick={() => addMessage("assistant")}>
          Add Assistant (with Judge)
        </Button>
        <Button icon={<CodeOutlined />} onClick={() => addMessage("tool")}>
          Add Tool Response
        </Button>
      </Space>

      {messages.length === 0 ? (
        <Empty description="Add conversation turns to define your test" />
      ) : (
        <Timeline
          items={messages.map((msg, index) => ({
            color: msg.role === "user" ? "blue" : msg.role === "assistant" ? "green" : "gray",
            children: (
              <Card
                size="small"
                style={{ marginBottom: 8 }}
                extra={
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeMessage(index)}
                  />
                }
              >
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Tag color={msg.role === "user" ? "blue" : msg.role === "assistant" ? "green" : "default"}>
                    {msg.role.toUpperCase()}
                  </Tag>

                  <Input.TextArea
                    value={msg.content}
                    onChange={(e) => updateMessage(index, { content: e.target.value })}
                    placeholder={
                      msg.role === "user"
                        ? "User message..."
                        : msg.role === "tool"
                        ? '{"status": "success"}'
                        : "Expected response (optional for AI judge)"
                    }
                    rows={2}
                  />

                  {msg.role === "assistant" && (
                    <Card size="small" style={{ background: "#fafafa" }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Validation (Judge)
                      </Typography.Text>
                      <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 8 }}>
                        <Radio.Group
                          value={msg.judgePlan?.type || "none"}
                          onChange={(e) => {
                            const type = e.target.value;
                            if (type === "none") {
                              updateMessage(index, { judgePlan: undefined });
                            } else {
                              updateMessage(index, {
                                judgePlan: { type, content: msg.judgePlan?.content },
                              });
                            }
                          }}
                        >
                          <Radio.Button value="none">No Validation</Radio.Button>
                          <Radio.Button value="exact">Exact Match</Radio.Button>
                          <Radio.Button value="regex">Regex</Radio.Button>
                          <Radio.Button value="ai">AI Judge</Radio.Button>
                        </Radio.Group>

                        {msg.judgePlan?.type === "exact" && (
                          <Input
                            placeholder="Expected exact response"
                            value={msg.judgePlan.content}
                            onChange={(e) =>
                              updateMessage(index, {
                                judgePlan: { ...msg.judgePlan!, content: e.target.value },
                              })
                            }
                          />
                        )}

                        {msg.judgePlan?.type === "regex" && (
                          <Input
                            placeholder="Regex pattern (e.g., .*hello.*)"
                            value={msg.judgePlan.content}
                            onChange={(e) =>
                              updateMessage(index, {
                                judgePlan: { ...msg.judgePlan!, content: e.target.value },
                              })
                            }
                          />
                        )}

                        {msg.judgePlan?.type === "ai" && (
                          <TextArea
                            rows={3}
                            placeholder="AI judge prompt (use {{messages}} and {{messages[-1]}} for context)"
                            value={msg.judgePlan.model?.messages?.[0]?.content || ""}
                            onChange={(e) =>
                              updateMessage(index, {
                                judgePlan: {
                                  ...msg.judgePlan!,
                                  model: {
                                    provider: "google",
                                    model: "gemini-2.5-flash",
                                    messages: [{ role: "system", content: e.target.value }],
                                  },
                                },
                              })
                            }
                          />
                        )}
                      </Space>
                    </Card>
                  )}
                </Space>
              </Card>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}

// Run Eval Modal
function RunEvalModal({
  open,
  onClose,
  evalItem,
  agents,
  onRun,
}: {
  open: boolean;
  onClose: () => void;
  evalItem: Eval | null;
  agents: Agent[];
  onRun: (evalId: string, agentId: string) => Promise<void>;
}) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    if (!evalItem || !selectedAgent) return;
    setRunning(true);
    try {
      await onRun(evalItem.id, selectedAgent);
      onClose();
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      title="Run Evaluation"
      open={open}
      onCancel={onClose}
      onOk={handleRun}
      okText="Run Test"
      okButtonProps={{ loading: running, disabled: !selectedAgent }}
    >
      {evalItem && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Text type="secondary">Evaluation:</Typography.Text>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {evalItem.name}
            </Typography.Title>
          </div>

          <div>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
              Select Agent to Test:
            </Typography.Text>
            <Select
              style={{ width: "100%" }}
              placeholder="Choose an agent"
              value={selectedAgent}
              onChange={setSelectedAgent}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
        </Space>
      )}
    </Modal>
  );
}

// Run Results Drawer
function RunResultsDrawer({
  open,
  onClose,
  evalRun,
}: {
  open: boolean;
  onClose: () => void;
  evalRun: EvalRun | null;
}) {
  if (!evalRun) return null;

  const result = evalRun.results?.[0];
  const isPassed = result?.status === "pass";

  return (
    <Drawer
      title="Evaluation Results"
      open={open}
      onClose={onClose}
      size="large"
    >
      <Space direction="vertical" size={24} style={{ width: "100%" }}>
        {/* Status Banner */}
        <Card
          style={{
            background: isPassed
              ? "linear-gradient(135deg, #52c41a11 0%, #52c41a05 100%)"
              : "linear-gradient(135deg, #ff4d4f11 0%, #ff4d4f05 100%)",
            border: `1px solid ${isPassed ? "#52c41a33" : "#ff4d4f33"}`,
            borderRadius: 12,
          }}
        >
          <Space>
            {isPassed ? (
              <CheckCircleOutlined style={{ fontSize: 32, color: "#52c41a" }} />
            ) : (
              <CloseCircleOutlined style={{ fontSize: 32, color: "#ff4d4f" }} />
            )}
            <div>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {isPassed ? "All Tests Passed" : "Test Failed"}
              </Typography.Title>
              <Typography.Text type="secondary">
                {evalRun.endedReason || "mockConversation.done"}
              </Typography.Text>
            </div>
          </Space>
        </Card>

        {/* Conversation Transcript */}
        <div>
          <Typography.Title level={5}>Conversation Transcript</Typography.Title>
          <Timeline
            items={
              result?.messages?.map((msg, i) => ({
                color:
                  msg.role === "user"
                    ? "blue"
                    : msg.judge?.status === "fail"
                    ? "red"
                    : msg.judge?.status === "pass"
                    ? "green"
                    : "gray",
                children: (
                  <Card size="small" style={{ marginBottom: 8 }}>
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      <Space>
                        <Tag
                          color={
                            msg.role === "user"
                              ? "blue"
                              : msg.role === "assistant"
                              ? "green"
                              : "default"
                          }
                        >
                          {msg.role.toUpperCase()}
                        </Tag>
                        {msg.judge && (
                          <Tag
                            color={msg.judge.status === "pass" ? "success" : "error"}
                            icon={
                              msg.judge.status === "pass" ? (
                                <CheckCircleOutlined />
                              ) : (
                                <CloseCircleOutlined />
                              )
                            }
                          >
                            {msg.judge.status.toUpperCase()}
                          </Tag>
                        )}
                      </Space>
                      <Typography.Text>{msg.content || "(no content)"}</Typography.Text>
                      {msg.judge?.failureReason && (
                        <Alert
                          type="error"
                          message={msg.judge.failureReason}
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </Space>
                  </Card>
                ),
              })) || []
            }
          />
        </div>
      </Space>
    </Drawer>
  );
}

export default function EvalsPage() {
  const [evals, setEvals] = useState<Eval[]>([]);
  const [evalRuns, setEvalRuns] = useState<EvalRun[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Drawer/Modal states
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<Eval | null>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runningEval, setRunningEval] = useState<Eval | null>(null);
  const [resultsDrawerOpen, setResultsDrawerOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<EvalRun | null>(null);
  const [activeTab, setActiveTab] = useState("evals");

  // Fetch evals
  const fetchEvals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/evals");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load evals");
      setEvals(data.evals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evals");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch eval runs
  const fetchEvalRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/evals/run");
      const data = await res.json();
      if (res.ok) {
        setEvalRuns(data.runs || []);
      }
    } catch (err) {
      console.error("Failed to fetch eval runs:", err);
    }
  }, []);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (res.ok) {
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  }, []);

  useEffect(() => {
    fetchEvals();
    fetchEvalRuns();
    fetchAgents();
  }, [fetchEvals, fetchEvalRuns, fetchAgents]);

  const handleCreateNew = () => {
    setEditingEval(null);
    setBuilderOpen(true);
  };

  const handleEdit = (evalItem: Eval) => {
    setEditingEval(evalItem);
    setBuilderOpen(true);
  };

  const handleDelete = async (evalItem: Eval) => {
    Modal.confirm({
      title: "Delete Evaluation",
      content: `Are you sure you want to delete "${evalItem.name}"?`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await fetch(`/api/evals/${evalItem.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete");
          fetchEvals();
        } catch (err) {
          console.error("Delete failed:", err);
        }
      },
    });
  };

  const handleSave = async (data: Partial<Eval>) => {
    try {
      const method = editingEval?.id ? "PATCH" : "POST";
      const url = editingEval?.id ? `/api/evals/${editingEval.id}` : "/api/evals";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      setBuilderOpen(false);
      fetchEvals();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleRunEval = async (evalId: string, agentId: string) => {
    const res = await fetch("/api/evals/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evalId, agentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to run eval");
    fetchEvalRuns();
    setSelectedRun(data.evalRun);
    setResultsDrawerOpen(true);
  };

  const handleOpenRun = (evalItem: Eval) => {
    setRunningEval(evalItem);
    setRunModalOpen(true);
  };

  const handleViewRuns = (evalItem: Eval) => {
    setActiveTab("runs");
  };

  // Filter evals by search
  const filteredEvals = evals.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const totalRuns = evalRuns.length;
  const passedRuns = evalRuns.filter((r) => r.results?.[0]?.status === "pass").length;
  const failedRuns = evalRuns.filter((r) => r.results?.[0]?.status === "fail").length;

  const runColumns = [
    {
      title: "Evaluation",
      dataIndex: "eval_id",
      key: "eval_id",
      render: (evalId: string) => {
        const evalItem = evals.find((e) => e.id === evalId);
        return evalItem?.name || evalId.slice(0, 8);
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string, record: EvalRun) => {
        const result = record.results?.[0];
        if (status === "ended" && result) {
          return (
            <Tag
              color={result.status === "pass" ? "success" : "error"}
              icon={result.status === "pass" ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            >
              {result.status.toUpperCase()}
            </Tag>
          );
        }
        return <Tag color="processing">{status}</Tag>;
      },
    },
    {
      title: "Agent",
      dataIndex: "agent_id",
      key: "agent_id",
      render: (agentId: string) => {
        const agent = agents.find((a) => a.id === agentId);
        return agent?.name || agentId?.slice(0, 8) || "—";
      },
    },
    {
      title: "Run At",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: EvalRun) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedRun(record);
            setResultsDrawerOpen(true);
          }}
        >
          View Details
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: "evals",
      label: (
        <Space>
          <ExperimentOutlined />
          <span>Evaluations</span>
          <Tag>{filteredEvals.length}</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {/* Stats Row */}
          <Row gutter={16}>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic title="Total Evals" value={evals.length} prefix={<ExperimentOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic title="Total Runs" value={totalRuns} prefix={<PlayCircleOutlined />} />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic
                  title="Passed"
                  value={passedRuns}
                  valueStyle={{ color: "#52c41a" }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic
                  title="Failed"
                  value={failedRuns}
                  valueStyle={{ color: "#ff4d4f" }}
                  prefix={<CloseCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Evals Grid */}
          {loading ? (
            <Row gutter={[16, 16]}>
              {[1, 2, 3, 4].map((i) => (
                <Col key={i} xs={24} sm={12} md={8} lg={6}>
                  <Card style={{ borderRadius: 12 }}>
                    <Skeleton active paragraph={{ rows: 2 }} />
                  </Card>
                </Col>
              ))}
            </Row>
          ) : error ? (
            <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
          ) : filteredEvals.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: "center", padding: 48 }}>
              <Empty
                image={<BotaLottieEmpty />}
                imageStyle={{ height: 80 }}
                description={
                  <Space direction="vertical" size={12}>
                    <Typography.Text type="secondary">No evaluations yet</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Create your first evaluation to start testing your agents
                    </Typography.Text>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
                      Create Your First Evaluation
                    </Button>
                  </Space>
                }
              />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              {filteredEvals.map((evalItem) => (
                <Col key={evalItem.id} xs={24} sm={12} md={8} lg={6}>
                  <EvalCard
                    evalItem={evalItem}
                    onEdit={() => handleEdit(evalItem)}
                    onDelete={() => handleDelete(evalItem)}
                    onRun={() => handleOpenRun(evalItem)}
                    onViewRuns={() => handleViewRuns(evalItem)}
                  />
                </Col>
              ))}
            </Row>
          )}
        </Space>
      ),
    },
    {
      key: "runs",
      label: (
        <Space>
          <PlayCircleOutlined />
          <span>Run History</span>
          <Tag>{evalRuns.length}</Tag>
        </Space>
      ),
      children: (
        <Card style={{ borderRadius: 12 }}>
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<ReloadOutlined />} onClick={fetchEvalRuns}>
              Refresh
            </Button>
          </Space>
          <Table
            dataSource={evalRuns.map((r) => ({ ...r, key: r.id }))}
            columns={runColumns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      ),
    },
  ];

  return (
    <RoutePageShell
      title="Agent Testing"
      subtitle="Create and run evaluations to test your AI agents before deployment"
      actions={
        <Space size={12}>
          <Input
            placeholder="Search evaluations..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
            Create Evaluation
          </Button>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />

      {/* Eval Builder Drawer */}
      <EvalBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={handleSave}
        initialData={editingEval || undefined}
      />

      {/* Run Eval Modal */}
      <RunEvalModal
        open={runModalOpen}
        onClose={() => setRunModalOpen(false)}
        evalItem={runningEval}
        agents={agents}
        onRun={handleRunEval}
      />

      {/* Run Results Drawer */}
      <RunResultsDrawer
        open={resultsDrawerOpen}
        onClose={() => setResultsDrawerOpen(false)}
        evalRun={selectedRun}
      />
    </RoutePageShell>
  );
}
