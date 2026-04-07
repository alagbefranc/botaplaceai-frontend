"use client";

import {
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Slider,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import {
  SUPPORTED_LANGUAGES,
  PERSONALIZATION_FIELDS,
  BUILTIN_USER_VARIABLES,
  BUILTIN_SYSTEM_VARIABLES,
  type AgentVariable,
  type VoiceNumberFormat,
  type VoiceDateFormat,
  type VoiceUrlFormat,
  type VoiceCurrencyFormat,
  type VoicePhoneFormat,
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

// ─── Client-side expression evaluator (mirrors server expressionEvaluator.ts) ──

interface PreviewContext {
  user: Record<string, string>;
  channel: string;
  agentName: string;
  conversationId: string;
}

function clientResolve(varName: string, ctx: PreviewContext, allResolved: Record<string, string>): string {
  // String literal
  if ((varName.startsWith("'") && varName.endsWith("'")) || (varName.startsWith('"') && varName.endsWith('"')))
    return varName.slice(1, -1);

  if (allResolved[varName] !== undefined) return allResolved[varName];

  if (varName.startsWith("user.")) {
    const key = varName.slice(5);
    return ctx.user[key] ?? "";
  }
  if (varName === "system.date") return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  if (varName === "system.time") return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (varName === "system.agent_name") return ctx.agentName;
  if (varName === "system.channel") return ctx.channel;
  if (varName === "system.conversation_id") return ctx.conversationId;
  return "";
}

function evalSimple(expr: string, ctx: PreviewContext, allResolved: Record<string, string>): string {
  const t = expr.trim();
  if (t.includes("||")) {
    for (const part of t.split("||").map((p) => p.trim())) {
      const v = clientResolve(part, ctx, allResolved);
      if (v !== "") return v;
    }
    return "";
  }
  return clientResolve(t, ctx, allResolved);
}

function evalTernary(expr: string, ctx: PreviewContext, allResolved: Record<string, string>): string {
  const t = expr.trim();
  const qi = t.indexOf("?");
  if (qi === -1) return evalSimple(t, ctx, allResolved);
  let ci = -1, depth = 0;
  for (let i = qi + 1; i < t.length; i++) {
    if (t[i] === "?") depth++;
    else if (t[i] === ":") { if (depth === 0) { ci = i; break; } depth--; }
  }
  if (ci === -1) return evalSimple(t, ctx, allResolved);
  const cond = evalSimple(t.slice(0, qi), ctx, allResolved);
  const truthy = cond !== "" && cond !== "false" && cond !== "0";
  return evalTernary(truthy ? t.slice(qi + 1, ci) : t.slice(ci + 1), ctx, allResolved);
}

function substituteTemplate(template: string, ctx: PreviewContext, allResolved: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
    try { return evalTernary(expr, ctx, allResolved); }
    catch { return match; }
  });
}

function buildResolvedMap(vars: AgentVariable[], ctx: PreviewContext): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const v of vars) {
    if (!v.name) continue;
    if (v.type === "static") resolved[v.name] = v.value ?? "";
    else if (v.type === "user") resolved[v.name] = ctx.user[(v.value ?? "").replace("user.", "")] ?? "";
    else if (v.type === "system") resolved[v.name] = clientResolve(v.value ?? "", ctx, resolved);
  }
  // Second pass — expressions can reference other variables
  for (const v of vars) {
    if (v.type === "expression" && v.expression) {
      resolved[v.name] = substituteTemplate(v.expression, ctx, resolved);
    }
  }
  return resolved;
}

function validateExpressionLocal(expr: string): string | null {
  if (!expr.trim()) return null;
  const qCount = (expr.match(/\?/g) ?? []).length;
  const cCount = (expr.match(/:/g) ?? []).length;
  if (qCount !== cCount) return "Unbalanced ternary (? and : count mismatch)";
  return null;
}

// ─── Variable Test Panel ──────────────────────────────────────────────────────

function VariableTestPanel({
  variables,
  systemPrompt,
  agentName,
}: {
  variables: AgentVariable[];
  systemPrompt: string;
  agentName: string;
}) {
  const { message } = App.useApp();
  const [mockUser, setMockUser] = useState({
    name: "Francis Alagbe",
    email: "francalagbe@gmail.com",
    phone: "+1 555-123-4567",
    id: "user-preview-001",
    language: "en",
  });
  const [mockChannel, setMockChannel] = useState("voice");

  const ctx: PreviewContext = useMemo(() => ({
    user: mockUser,
    channel: mockChannel,
    agentName,
    conversationId: "conv-preview-abc123",
  }), [mockUser, mockChannel, agentName]);

  const resolvedMap = useMemo(() => buildResolvedMap(variables, ctx), [variables, ctx]);

  const resolvedPrompt = useMemo(
    () => substituteTemplate(systemPrompt, ctx, resolvedMap),
    [systemPrompt, ctx, resolvedMap]
  );

  const named = variables.filter((v) => v.name.trim());

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        icon={<ExperimentOutlined />}
        message="Test your variables by entering mock values below. This simulates what the agent would see at runtime."
      />

      {/* Mock inputs */}
      <Card size="small" title={<Space><UserOutlined /> Mock User Data</Space>}>
        <Row gutter={[12, 12]}>
          {([
            { key: "name", label: "user.name", placeholder: "Francis Alagbe" },
            { key: "email", label: "user.email", placeholder: "francalagbe@gmail.com" },
            { key: "phone", label: "user.phone", placeholder: "+1 555-123-4567" },
            { key: "id", label: "user.id", placeholder: "user-preview-001" },
            { key: "language", label: "user.language", placeholder: "en" },
          ] as Array<{ key: keyof typeof mockUser; label: string; placeholder: string }>).map((f) => (
            <Col span={8} key={f.key}>
              <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
                {f.label}
              </Typography.Text>
              <Input
                size="small"
                value={mockUser[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => setMockUser((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </Col>
          ))}
          <Col span={8}>
            <Typography.Text type="secondary" style={{ display: "block", marginBottom: 4, fontSize: 12 }}>
              system.channel
            </Typography.Text>
            <Select
              size="small"
              value={mockChannel}
              onChange={setMockChannel}
              style={{ width: "100%" }}
              options={[
                { value: "voice", label: "Voice" },
                { value: "web_chat", label: "Web Chat" },
                { value: "phone", label: "Phone" },
                { value: "whatsapp", label: "WhatsApp" },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Resolved variable values */}
      {named.length > 0 && (
        <Card size="small" title={<Space><CodeOutlined /> Resolved Variable Values</Space>}>
          <Table
            size="small"
            pagination={false}
            dataSource={named}
            rowKey="id"
            columns={[
              {
                title: "Variable",
                key: "name",
                width: 160,
                render: (_, r) => (
                  <Typography.Text code style={{ fontSize: 12 }}>
                    {`{{${r.name}}}`}
                  </Typography.Text>
                ),
              },
              {
                title: "Type",
                key: "type",
                width: 90,
                render: (_, r) => <Tag style={{ fontSize: 11 }}>{r.type}</Tag>,
              },
              {
                title: "Resolved Value",
                key: "resolved",
                render: (_, r) => {
                  const val = resolvedMap[r.name] ?? "";
                  const validErr = r.type === "expression" ? validateExpressionLocal(r.expression ?? "") : null;
                  return (
                    <Space>
                      {validErr ? (
                        <Tag icon={<WarningOutlined />} color="warning">{validErr}</Tag>
                      ) : val !== "" ? (
                        <Typography.Text style={{ color: "#17DEBC", fontFamily: "monospace", fontSize: 12 }}>
                          {val}
                        </Typography.Text>
                      ) : (
                        <Typography.Text type="secondary" italic style={{ fontSize: 12 }}>empty</Typography.Text>
                      )}
                    </Space>
                  );
                },
              },
            ]}
          />
        </Card>
      )}

      {/* System prompt preview */}
      <Card
        size="small"
        title="System Prompt Preview (with substitutions applied)"
        extra={
          <Button
            size="small"
            icon={<CopyOutlined />}
            type="text"
            onClick={() => {
              void navigator.clipboard.writeText(resolvedPrompt);
              void message.success("Copied!");
            }}
          >
            Copy
          </Button>
        }
      >
        {systemPrompt.trim() ? (
          <Input.TextArea
            value={resolvedPrompt}
            readOnly
            autoSize={{ minRows: 4, maxRows: 16 }}
            style={{ fontFamily: "monospace", fontSize: 12, background: "#f9fafb" }}
          />
        ) : (
          <Typography.Text type="secondary" italic>
            No system prompt set. Go to the Core Settings tab to add one.
          </Typography.Text>
        )}
      </Card>
    </Space>
  );
}

// ─── Main BehaviorTab ─────────────────────────────────────────────────────────

export function BehaviorTab({ agent, updateBehavior }: TabProps) {
  const { behavior, systemPrompt, name: agentName } = agent;

  // Variables management
  const addVariable = () => {
    const newVar: AgentVariable = {
      id: crypto.randomUUID(),
      name: "",
      type: "static",
      value: "",
    };
    updateBehavior({ variables: [...behavior.variables, newVar] });
  };

  const updateVariable = (id: string, patch: Partial<AgentVariable>) => {
    updateBehavior({
      variables: behavior.variables.map((v) =>
        v.id === id ? { ...v, ...patch } : v
      ),
    });
  };

  const removeVariable = (id: string) => {
    updateBehavior({
      variables: behavior.variables.filter((v) => v.id !== id),
    });
  };

  // Detect which variable names appear in the system prompt
  const usedInPrompt = useMemo(() => {
    const used = new Set<string>();
    const matches = systemPrompt.matchAll(/\{\{([a-z0-9_]+)\}\}/gi);
    for (const m of matches) used.add(m[1].toLowerCase());
    return used;
  }, [systemPrompt]);

  const variableColumns: ColumnsType<AgentVariable> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Input
            size="small"
            value={record.name}
            onChange={(e) =>
              updateVariable(record.id, {
                name: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase(),
              })
            }
            placeholder="variable_name"
            status={record.name && usedInPrompt.has(record.name) ? undefined : undefined}
          />
          {record.name && (
            <Space size={4}>
              <Tag
                style={{ fontFamily: "monospace", fontSize: 11, cursor: "pointer", userSelect: "all" }}
                color={usedInPrompt.has(record.name) ? "purple" : "default"}
              >
                {`{{${record.name}}}`}
              </Tag>
              {usedInPrompt.has(record.name) && (
                <Tooltip title="Used in system prompt">
                  <Tag color="success" style={{ fontSize: 10, padding: "0 4px" }}>✓ in prompt</Tag>
                </Tooltip>
              )}
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 130,
      render: (_, record) => (
        <Select
          size="small"
          value={record.type}
          onChange={(type) => updateVariable(record.id, { type, value: "", expression: "" })}
          style={{ width: "100%" }}
          options={[
            { value: "static", label: "Static" },
            { value: "user", label: "User" },
            { value: "system", label: "System" },
            { value: "expression", label: "Expression" },
          ]}
        />
      ),
    },
    {
      title: "Value / Expression",
      dataIndex: "value",
      key: "value",
      render: (_, record) => {
        if (record.type === "expression") {
          const err = validateExpressionLocal(record.expression ?? "");
          return (
            <Space direction="vertical" size={2} style={{ width: "100%" }}>
              <Input
                size="small"
                value={record.expression}
                onChange={(e) => updateVariable(record.id, { expression: e.target.value })}
                placeholder="{{user.name || 'Guest'}}"
                status={err ? "warning" : undefined}
                suffix={err ? <Tooltip title={err}><WarningOutlined style={{ color: "#faad14" }} /></Tooltip> : null}
              />
              {err && <Typography.Text type="warning" style={{ fontSize: 11 }}>{err}</Typography.Text>}
            </Space>
          );
        }
        if (record.type === "static") {
          return (
            <Input
              size="small"
              value={record.value}
              onChange={(e) => updateVariable(record.id, { value: e.target.value })}
              placeholder="Static value"
            />
          );
        }
        return (
          <Select
            size="small"
            value={record.value}
            onChange={(value) => updateVariable(record.id, { value })}
            style={{ width: "100%" }}
            placeholder="Select variable"
            options={
              record.type === "user"
                ? BUILTIN_USER_VARIABLES.map((v) => ({
                    value: v.key,
                    label: (
                      <Space size={4}>
                        <code style={{ fontSize: 11 }}>{v.key}</code>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{v.description}</Typography.Text>
                      </Space>
                    ),
                  }))
                : BUILTIN_SYSTEM_VARIABLES.map((v) => ({
                    value: v.key,
                    label: (
                      <Space size={4}>
                        <code style={{ fontSize: 11 }}>{v.key}</code>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{v.description}</Typography.Text>
                      </Space>
                    ),
                  }))
            }
          />
        );
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      width: 180,
      render: (_, record) => (
        <Input
          size="small"
          value={record.description ?? ""}
          onChange={(e) => updateVariable(record.id, { description: e.target.value })}
          placeholder="Optional note"
        />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 50,
      render: (_, record) => (
        <Popconfirm
          title="Delete this variable?"
          onConfirm={() => removeVariable(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Variables */}
      <Card
        title={
          <Space>
            <span>Variables</span>
            <Tag color="purple">{behavior.variables.length}</Tag>
            {behavior.variables.some((v) => v.name && usedInPrompt.has(v.name)) && (
              <Tooltip title="Some variables are referenced in your system prompt">
                <Tag color="success" style={{ fontSize: 11 }}>✓ wired</Tag>
              </Tooltip>
            )}
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addVariable}>
            Add Variable
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <>
              Use <Typography.Text code>{"{{variable_name}}"}</Typography.Text> in your system prompt to inject values at runtime.{" "}
              Supported types: <strong>Static</strong> (fixed text), <strong>User</strong> (caller/chat data), <strong>System</strong> (date, time, channel),{" "}
              <strong>Expression</strong> (dynamic with <code>||</code> fallbacks and <code>?:</code> conditionals).
            </>
          }
        />

        <Table
          dataSource={behavior.variables}
          columns={variableColumns}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: "No variables defined. Click \"Add Variable\" to get started." }}
        />

        {behavior.variables.length > 0 && (
          <Collapse
            ghost
            style={{ marginTop: 8 }}
            items={[{
              key: "test",
              label: (
                <Space>
                  <ExperimentOutlined style={{ color: "#17DEBC" }} />
                  <Typography.Text strong>Test Variables</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Preview how variables resolve at runtime
                  </Typography.Text>
                </Space>
              ),
              children: (
                <VariableTestPanel
                  variables={behavior.variables}
                  systemPrompt={systemPrompt}
                  agentName={agentName}
                />
              ),
            }]}
          />
        )}
      </Card>

      {/* Multilingual */}
      <Card
        title={
          <Space>
            <GlobalOutlined />
            <span>Multilingual Support</span>
          </Space>
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable multilingual" help="Allow agent to respond in multiple languages." />
            </Col>
            <Col span={18}>
              <Switch
                checked={behavior.multilingual.enabled}
                onChange={(enabled) =>
                  updateBehavior({
                    multilingual: { ...behavior.multilingual, enabled },
                  })
                }
              />
            </Col>
          </Row>

          {behavior.multilingual.enabled && (
            <>
              <Row gutter={12}>
                <Col span={8}>
                  <Typography.Text type="secondary">Default Language</Typography.Text>
                  <Select
                    value={behavior.multilingual.defaultLanguage}
                    onChange={(defaultLanguage) =>
                      updateBehavior({
                        multilingual: { ...behavior.multilingual, defaultLanguage },
                      })
                    }
                    style={{ width: "100%", marginTop: 6 }}
                    options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                  />
                </Col>
                <Col span={16}>
                  <Typography.Text type="secondary">Supported Languages</Typography.Text>
                  <Select
                    mode="multiple"
                    value={behavior.multilingual.supportedLanguages}
                    onChange={(supportedLanguages) =>
                      updateBehavior({
                        multilingual: { ...behavior.multilingual, supportedLanguages },
                      })
                    }
                    style={{ width: "100%", marginTop: 6 }}
                    options={SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                  />
                </Col>
              </Row>

              <Row align="middle">
                <Col span={6}>
                  <FieldLabel label="Auto-detect language" help="Automatically detect user's language from their messages." />
                </Col>
                <Col span={18}>
                  <Switch
                    checked={behavior.multilingual.autoDetect}
                    onChange={(autoDetect) =>
                      updateBehavior({
                        multilingual: { ...behavior.multilingual, autoDetect },
                      })
                    }
                  />
                </Col>
              </Row>
            </>
          )}
        </Space>
      </Card>

      {/* Personalization */}
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>Personalization</span>
          </Space>
        }
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Row align="middle">
            <Col span={6}>
              <FieldLabel label="Enable personalization" help="Use conversation history and user data to personalize responses." />
            </Col>
            <Col span={18}>
              <Switch
                checked={behavior.personalization.enabled}
                onChange={(enabled) =>
                  updateBehavior({
                    personalization: { ...behavior.personalization, enabled },
                  })
                }
              />
            </Col>
          </Row>

          {behavior.personalization.enabled && (
            <>
              <Row align="middle">
                <Col span={6}>
                  <FieldLabel label="Use conversation history" help="Include previous messages in context." />
                </Col>
                <Col span={18}>
                  <Switch
                    checked={behavior.personalization.useConversationHistory}
                    onChange={(useConversationHistory) =>
                      updateBehavior({
                        personalization: { ...behavior.personalization, useConversationHistory },
                      })
                    }
                  />
                </Col>
              </Row>

              <Row align="middle" gutter={12}>
                <Col span={6}>
                  <FieldLabel label="Max history turns" help="Maximum number of previous conversation turns to include." />
                </Col>
                <Col span={18}>
                  <Slider
                    min={1}
                    max={50}
                    value={behavior.personalization.maxHistoryTurns}
                    onChange={(maxHistoryTurns) =>
                      updateBehavior({
                        personalization: { ...behavior.personalization, maxHistoryTurns },
                      })
                    }
                    marks={{ 1: "1", 10: "10", 25: "25", 50: "50" }}
                  />
                </Col>
              </Row>

              <div>
                <Typography.Text type="secondary">User fields to extract</Typography.Text>
                <Select
                  mode="multiple"
                  value={behavior.personalization.userFields}
                  onChange={(userFields) =>
                    updateBehavior({
                      personalization: { ...behavior.personalization, userFields },
                    })
                  }
                  style={{ width: "100%", marginTop: 6 }}
                  options={PERSONALIZATION_FIELDS.map((f) => ({
                    value: f.key,
                    label: f.label,
                  }))}
                />
              </div>
            </>
          )}
        </Space>
      </Card>

      {/* Voice Formatting */}
      <Card
        title={
          <Space>
            <span>Voice Formatting</span>
            <Tooltip title="Control how your agent speaks numbers, dates, and other formatted content in voice conversations.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Control how the agent speaks numbers, dates, URLs, and other formatted content in voice mode.
        </Typography.Paragraph>

        <Row gutter={[12, 12]}>
          <Col span={8}>
            <FieldLabel label="Numbers" help="How numbers are spoken: '123' as 'one-two-three' (digits) or 'one hundred twenty-three' (words)." />
            <Select
              value={behavior.voiceFormatting.numbers}
              onChange={(numbers) =>
                updateBehavior({
                  voiceFormatting: { ...behavior.voiceFormatting, numbers: numbers as VoiceNumberFormat },
                })
              }
              style={{ width: "100%", marginTop: 6 }}
              options={[
                { value: "digits", label: "Digits (1-2-3)" },
                { value: "words", label: "Words (one two three)" },
                { value: "mixed", label: "Mixed (natural)" },
              ]}
            />
          </Col>
          <Col span={8}>
            <FieldLabel label="Dates" help="How dates are read aloud: 'March 31st' (spoken) or '3/31/2024' (formal)." />
            <Select
              value={behavior.voiceFormatting.dates}
              onChange={(dates) =>
                updateBehavior({
                  voiceFormatting: { ...behavior.voiceFormatting, dates: dates as VoiceDateFormat },
                })
              }
              style={{ width: "100%", marginTop: 6 }}
              options={[
                { value: "spoken", label: "Spoken (March 31st)" },
                { value: "formal", label: "Formal (3/31/2024)" },
              ]}
            />
          </Col>
          <Col span={8}>
            <FieldLabel label="URLs" help="How web addresses are handled: read the domain only, spell out, or skip entirely." />
            <Select
              value={behavior.voiceFormatting.urls}
              onChange={(urls) =>
                updateBehavior({
                  voiceFormatting: { ...behavior.voiceFormatting, urls: urls as VoiceUrlFormat },
                })
              }
              style={{ width: "100%", marginTop: 6 }}
              options={[
                { value: "domain_only", label: "Domain only" },
                { value: "spell", label: "Spell out" },
                { value: "skip", label: "Skip URLs" },
              ]}
            />
          </Col>
          <Col span={8}>
            <FieldLabel label="Currency" help="How money amounts are spoken: '$10.50' (full) or 'ten fifty' (short)." />
            <Select
              value={behavior.voiceFormatting.currency}
              onChange={(currency) =>
                updateBehavior({
                  voiceFormatting: { ...behavior.voiceFormatting, currency: currency as VoiceCurrencyFormat },
                })
              }
              style={{ width: "100%", marginTop: 6 }}
              options={[
                { value: "full", label: "Full ($10.50)" },
                { value: "short", label: "Short (ten fifty)" },
              ]}
            />
          </Col>
          <Col span={8}>
            <FieldLabel label="Phone Numbers" help="How phone numbers are spoken: grouped (555-123-4567) or individual digits." />
            <Select
              value={behavior.voiceFormatting.phoneNumbers}
              onChange={(phoneNumbers) =>
                updateBehavior({
                  voiceFormatting: { ...behavior.voiceFormatting, phoneNumbers: phoneNumbers as VoicePhoneFormat },
                })
              }
              style={{ width: "100%", marginTop: 6 }}
              options={[
                { value: "grouped", label: "Grouped (555-123-4567)" },
                { value: "individual", label: "Individual digits" },
              ]}
            />
          </Col>
        </Row>
      </Card>

      {/* Flush Syntax */}
      <Card
        title={
          <Space>
            <span>Advanced Behavior</span>
            <Tooltip title="Fine-tune agent behavior with advanced streaming and response controls.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
      >
        <Row align="middle">
          <Col span={6}>
            <FieldLabel
              label="Flush syntax"
              help="Enable [flush] syntax in prompts to force immediate partial responses during streaming."
            />
          </Col>
          <Col span={18}>
            <Switch
              checked={behavior.flushSyntax}
              onChange={(flushSyntax) => updateBehavior({ flushSyntax })}
            />
          </Col>
        </Row>
      </Card>
    </Space>
  );
}
