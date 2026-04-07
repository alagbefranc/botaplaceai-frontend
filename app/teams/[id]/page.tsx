"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Button,
  Card,
  Space,
  Typography,
  Input,
  Select,
  Form,
  Modal,
  Tag,
  Switch,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  Tooltip,
  App as AntdApp,
  Avatar,
  List,
  Badge,
  InputNumber,
  Collapse,
} from "antd";
import {
  SaveOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  StarOutlined,
  StarFilled,
  RobotOutlined,
  BranchesOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RoutePageShell } from "@/app/_components/route-page-shell";
import type {
  AgentTeam,
  TeamMember,
  HandoffRule,
  ContextVariable,
  TeamSettings,
  RuleCondition,
  COMMON_INTENTS,
  COMMON_SPECIALIZATIONS,
} from "@/lib/domain/agent-teams";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Agent {
  id: string;
  name: string;
  status: string;
  voice?: string;
}

interface TeamData extends AgentTeam {
  members: TeamMember[];
  rules: HandoffRule[];
  contextVariables: ContextVariable[];
}

const INTENTS = [
  { value: "billing_inquiry", label: "Billing Inquiry" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "refund_request", label: "Refund Request" },
  { value: "technical_support", label: "Technical Support" },
  { value: "account_issue", label: "Account Issue" },
  { value: "sales_inquiry", label: "Sales Inquiry" },
  { value: "pricing_question", label: "Pricing Question" },
  { value: "cancellation", label: "Cancellation" },
];

const SPECIALIZATIONS = [
  { value: "billing", label: "Billing" },
  { value: "technical", label: "Technical Support" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "General Support" },
  { value: "onboarding", label: "Onboarding" },
  { value: "retention", label: "Retention" },
];

export default function TeamEditorPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const params = useParams();
  const teamId = params.id as string;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<TeamData | null>(null);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  
  // Rule editor modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<HandoffRule | null>(null);
  const [ruleForm] = Form.useForm();

  // Variable editor modal
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<ContextVariable | null>(null);
  const [variableForm] = Form.useForm();

  // Load team data
  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/teams?id=${teamId}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load team.");
      }

      setTeam(payload.team);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load team.");
      router.push("/teams");
    } finally {
      setLoading(false);
    }
  }, [teamId, message, router]);

  // Load available agents
  const loadAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/agents", { cache: "no-store" });
      const payload = await response.json();

      if (response.ok && payload.agents) {
        setAvailableAgents(payload.agents);
      }
    } catch (error) {
      console.error("Failed to load agents:", error);
    }
  }, []);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      if (session) {
        void loadTeam();
        void loadAgents();
      } else {
        router.push("/login");
      }
    });
  }, [supabase, loadTeam, loadAgents, router]);

  // Agents not in team
  const agentsNotInTeam = useMemo(() => {
    if (!team) return availableAgents;
    const memberIds = new Set(team.members.map((m) => m.agentId));
    return availableAgents.filter((a) => !memberIds.has(a.id));
  }, [availableAgents, team]);

  // Save team settings
  const saveTeam = async (updates: Partial<TeamData>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, ...updates }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save team.");
      }

      message.success("Team saved.");
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save team.");
    } finally {
      setSaving(false);
    }
  };

  // Add member to team
  const addMember = async (agentId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to add member.");
      }

      message.success("Member added.");
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to add member.");
    }
  };

  // Remove member from team
  const removeMember = async (agentId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members?agentId=${agentId}`, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to remove member.");
      }

      message.success("Member removed.");
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to remove member.");
    }
  };

  // Set entry agent
  const setEntryAgent = async (memberId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, role: "entry" }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to set entry agent.");
      }

      message.success("Entry agent set.");
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to set entry agent.");
    }
  };

  // Update member specialization
  const updateMemberSpecialization = async (memberId: string, specialization: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memberId, specialization }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Failed to update member.");
      }

      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to update member.");
    }
  };

  // Save handoff rule
  const saveRule = async (values: Record<string, unknown>) => {
    try {
      const conditions: RuleCondition[] = [];
      
      if (values.ruleType === "keyword" && values.keywords) {
        const keywords = (values.keywords as string).split(",").map((k) => k.trim()).filter(Boolean);
        keywords.forEach((kw) => {
          conditions.push({ type: "keyword", value: kw, matchType: "contains" });
        });
      } else if (values.ruleType === "intent" && values.intents) {
        (values.intents as string[]).forEach((intent) => {
          conditions.push({ type: "intent", value: intent });
        });
      }

      const ruleData = {
        id: editingRule?.id,
        sourceAgentId: values.sourceAgentId || null,
        targetAgentId: values.targetAgentId,
        ruleType: values.ruleType,
        conditions,
        priority: values.priority || 0,
        enabled: values.enabled !== false,
        contextConfig: {
          includeSummary: values.includeSummary !== false,
          includeHistory: values.includeHistory || false,
          variables: values.variables || [],
        },
      };

      const response = await fetch(`/api/teams/${teamId}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ruleData),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save rule.");
      }

      message.success("Rule saved.");
      setRuleModalOpen(false);
      setEditingRule(null);
      ruleForm.resetFields();
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to save rule.");
    }
  };

  // Delete rule
  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/rules?ruleId=${ruleId}`, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete rule.");
      }

      message.success("Rule deleted.");
      await loadTeam();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to delete rule.");
    }
  };

  // Open rule editor
  const openRuleEditor = (rule?: HandoffRule) => {
    setEditingRule(rule || null);
    
    if (rule) {
      const keywordConditions = rule.conditions.filter((c) => c.type === "keyword");
      const intentConditions = rule.conditions.filter((c) => c.type === "intent");
      
      ruleForm.setFieldsValue({
        sourceAgentId: rule.sourceAgentId,
        targetAgentId: rule.targetAgentId,
        ruleType: rule.ruleType,
        keywords: keywordConditions.map((c) => c.value).join(", "),
        intents: intentConditions.map((c) => c.value),
        priority: rule.priority,
        enabled: rule.enabled,
        includeSummary: rule.contextConfig.includeSummary,
        includeHistory: rule.contextConfig.includeHistory,
        variables: rule.contextConfig.variables,
      });
    } else {
      ruleForm.resetFields();
    }
    
    setRuleModalOpen(true);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!team) {
    return (
      <RoutePageShell title="Team" subtitle="Loading...">
        <Empty description="Team not found" />
      </RoutePageShell>
    );
  }

  return (
    <RoutePageShell
      title={team.name}
      subtitle={team.description || "Configure your agent team"}
      actions={
        <Space>
          <Select
            value={team.status}
            onChange={(status) => saveTeam({ status })}
            style={{ width: 120 }}
            options={[
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
            ]}
          />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => saveTeam({})}>
            Save
          </Button>
        </Space>
      }
      nativeContent
    >
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <Row gutter={24}>
        {/* Left: Team Members */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <RobotOutlined />
                Team Members ({team.members.length})
              </Space>
            }
            extra={
              agentsNotInTeam.length > 0 && (
                <Select
                  placeholder="Add agent..."
                  style={{ width: 150 }}
                  value={undefined}
                  onChange={(agentId) => agentId && addMember(agentId)}
                  options={agentsNotInTeam.map((a) => ({
                    value: a.id,
                    label: a.name,
                  }))}
                />
              )
            }
          >
            {team.members.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No members yet"
              >
                {agentsNotInTeam.length > 0 && (
                  <Text type="secondary">Add agents from the dropdown above</Text>
                )}
              </Empty>
            ) : (
              <List
                dataSource={team.members}
                renderItem={(member) => (
                  <List.Item
                    actions={[
                      member.role !== "entry" && (
                        <Tooltip title="Set as Entry Agent" key="entry">
                          <Button
                            type="text"
                            size="small"
                            icon={<StarOutlined />}
                            onClick={() => setEntryAgent(member.id)}
                          />
                        </Tooltip>
                      ),
                      <Tooltip title="Remove" key="remove">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeMember(member.agentId)}
                        />
                      </Tooltip>,
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Badge
                          count={member.role === "entry" ? <StarFilled style={{ color: "#faad14" }} /> : 0}
                          offset={[-4, 28]}
                        >
                          <Avatar
                            size={40}
                            style={{
                              backgroundColor: member.role === "entry" ? "#17DEBC" : "#1E293B",
                            }}
                            icon={<RobotOutlined />}
                          />
                        </Badge>
                      }
                      title={
                        <Space>
                          <Text strong>{member.agent?.name || "Unknown"}</Text>
                          {member.role === "entry" && (
                            <Tag color="orange">Entry</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Select
                          size="small"
                          placeholder="Specialization"
                          value={member.specialization}
                          onChange={(val) => updateMemberSpecialization(member.id, val)}
                          style={{ width: "100%" }}
                          allowClear
                          options={SPECIALIZATIONS}
                        />
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Center: Handoff Flow */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <BranchesOutlined />
                Handoff Rules ({team.rules.length})
              </Space>
            }
            extra={
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => openRuleEditor()}
                disabled={team.members.length < 2}
              >
                Add Rule
              </Button>
            }
          >
            {team.rules.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  team.members.length < 2
                    ? "Add at least 2 members to create rules"
                    : "No handoff rules yet"
                }
              >
                {team.members.length >= 2 && (
                  <Button type="dashed" onClick={() => openRuleEditor()}>
                    Create First Rule
                  </Button>
                )}
              </Empty>
            ) : (
              <List
                dataSource={team.rules}
                renderItem={(rule) => (
                  <List.Item
                    actions={[
                      <Switch
                        key="toggle"
                        size="small"
                        checked={rule.enabled}
                        onChange={async (enabled) => {
                          await fetch(`/api/teams/${teamId}/rules`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: rule.id, enabled }),
                          });
                          await loadTeam();
                        }}
                      />,
                      <Button
                        key="delete"
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => deleteRule(rule.id)}
                      />,
                    ]}
                    onClick={() => openRuleEditor(rule)}
                    style={{ cursor: "pointer" }}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size={32}
                          style={{ backgroundColor: rule.enabled ? "#52c41a" : "#d9d9d9" }}
                          icon={<ThunderboltOutlined />}
                        />
                      }
                      title={
                        <Space size={4}>
                          <Text>{rule.sourceAgent?.name || "Any"}</Text>
                          <UserSwitchOutlined />
                          <Text strong>{rule.targetAgent?.name}</Text>
                        </Space>
                      }
                      description={
                        <Space size={4} wrap>
                          <Tag color={rule.ruleType === "keyword" ? "blue" : rule.ruleType === "intent" ? "purple" : "default"}>
                            {rule.ruleType}
                          </Tag>
                          {rule.conditions.slice(0, 2).map((c, i) => (
                            <Tag key={i}>{c.value}</Tag>
                          ))}
                          {rule.conditions.length > 2 && (
                            <Tag>+{rule.conditions.length - 2}</Tag>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Right: Settings */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <SettingOutlined />
                Team Settings
              </Space>
            }
          >
            <Form layout="vertical">
              <Form.Item label="Max Handoffs" help="Prevent infinite loops">
                <InputNumber
                  min={1}
                  max={20}
                  value={team.settings?.maxHandoffs ?? 5}
                  onChange={(val) =>
                    saveTeam({
                      settings: { ...team.settings, maxHandoffs: val || 5 },
                    })
                  }
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item label="Generate Summary on Handoff">
                <Switch
                  checked={team.settings?.enableSummary !== false}
                  onChange={(val) =>
                    saveTeam({
                      settings: { ...team.settings, enableSummary: val },
                    })
                  }
                />
              </Form.Item>
              <Form.Item label="Extract Context Variables">
                <Switch
                  checked={team.settings?.enableVariableExtraction !== false}
                  onChange={(val) =>
                    saveTeam({
                      settings: { ...team.settings, enableVariableExtraction: val },
                    })
                  }
                />
              </Form.Item>
            </Form>

            <Divider />

            <Collapse
              ghost
              items={[
                {
                  key: "variables",
                  label: `Context Variables (${team.contextVariables.length})`,
                  children: (
                    <div>
                      {team.contextVariables.length === 0 ? (
                        <Text type="secondary">
                          No variables defined. Variables are extracted during handoffs.
                        </Text>
                      ) : (
                        <List
                          size="small"
                          dataSource={team.contextVariables}
                          renderItem={(v) => (
                            <List.Item>
                              <Text code>{v.name}</Text>
                              {v.required && <Tag color="red">required</Tag>}
                            </List.Item>
                          )}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* Rule Editor Modal */}
      <Modal
        title={editingRule ? "Edit Handoff Rule" : "Create Handoff Rule"}
        open={ruleModalOpen}
        onCancel={() => {
          setRuleModalOpen(false);
          setEditingRule(null);
          ruleForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={ruleForm} layout="vertical" onFinish={saveRule}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sourceAgentId" label="From Agent">
                <Select
                  placeholder="Any agent"
                  allowClear
                  options={[
                    { value: null, label: "Any Agent" },
                    ...team.members.map((m) => ({
                      value: m.agentId,
                      label: m.agent?.name,
                    })),
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetAgentId"
                label="To Agent"
                rules={[{ required: true, message: "Required" }]}
              >
                <Select
                  placeholder="Select target"
                  options={team.members.map((m) => ({
                    value: m.agentId,
                    label: m.agent?.name,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="ruleType"
            label="Rule Type"
            rules={[{ required: true, message: "Required" }]}
          >
            <Select
              options={[
                { value: "keyword", label: "Keyword Match" },
                { value: "intent", label: "Intent Detection" },
                { value: "always", label: "Always Transfer" },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.ruleType !== curr.ruleType}>
            {({ getFieldValue }) => {
              const ruleType = getFieldValue("ruleType");
              
              if (ruleType === "keyword") {
                return (
                  <Form.Item
                    name="keywords"
                    label="Keywords"
                    help="Comma-separated keywords to match"
                  >
                    <Input placeholder="billing, invoice, payment" />
                  </Form.Item>
                );
              }
              
              if (ruleType === "intent") {
                return (
                  <Form.Item name="intents" label="Intents">
                    <Select
                      mode="multiple"
                      placeholder="Select intents"
                      options={INTENTS}
                    />
                  </Form.Item>
                );
              }
              
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="Priority" initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="enabled" label="Enabled" valuePropName="checked" initialValue={true}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Context Transfer</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="includeSummary"
                label="Include Summary"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="includeHistory"
                label="Include History"
                valuePropName="checked"
                initialValue={false}
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button
                onClick={() => {
                  setRuleModalOpen(false);
                  setEditingRule(null);
                  ruleForm.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                {editingRule ? "Update Rule" : "Create Rule"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </RoutePageShell>
  );
}
