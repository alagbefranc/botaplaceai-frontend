"use client";

import {
  ClockCircleOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Collapse,
  Empty,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Col,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type {
  BackgroundMessage,
  BackgroundMessageTrigger,
  IdleMessage,
  EventHook,
  HookEventType,
  HookAction,
  HookActionType,
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

export function MessagesTab({ agent, updateBehavior, updateHooks }: TabProps) {
  const { behavior, hooks } = agent;

  // Background Messages
  const addBackgroundMessage = () => {
    const newMsg: BackgroundMessage = {
      id: crypto.randomUUID(),
      trigger: "session_start",
      content: "",
      enabled: true,
    };
    updateBehavior({ backgroundMessages: [...behavior.backgroundMessages, newMsg] });
  };

  const updateBackgroundMessage = (id: string, patch: Partial<BackgroundMessage>) => {
    updateBehavior({
      backgroundMessages: behavior.backgroundMessages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    });
  };

  const removeBackgroundMessage = (id: string) => {
    updateBehavior({
      backgroundMessages: behavior.backgroundMessages.filter((m) => m.id !== id),
    });
  };

  // Idle Messages
  const addIdleMessage = () => {
    const newMsg: IdleMessage = {
      id: crypto.randomUUID(),
      delaySeconds: 30,
      content: "",
      maxTimes: 3,
      enabled: true,
    };
    updateBehavior({ idleMessages: [...behavior.idleMessages, newMsg] });
  };

  const updateIdleMessage = (id: string, patch: Partial<IdleMessage>) => {
    updateBehavior({
      idleMessages: behavior.idleMessages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    });
  };

  const removeIdleMessage = (id: string) => {
    updateBehavior({
      idleMessages: behavior.idleMessages.filter((m) => m.id !== id),
    });
  };

  // Event Hooks
  const addEventHook = () => {
    const newHook: EventHook = {
      id: crypto.randomUUID(),
      event: "session_start",
      actions: [],
      enabled: true,
    };
    updateHooks({ hooks: [...hooks.hooks, newHook] });
  };

  const updateEventHook = (id: string, patch: Partial<EventHook>) => {
    updateHooks({
      hooks: hooks.hooks.map((h) =>
        h.id === id ? { ...h, ...patch } : h
      ),
    });
  };

  const removeEventHook = (id: string) => {
    updateHooks({
      hooks: hooks.hooks.filter((h) => h.id !== id),
    });
  };

  const addHookAction = (hookId: string) => {
    const hook = hooks.hooks.find((h) => h.id === hookId);
    if (!hook) return;
    
    const newAction: HookAction = {
      id: crypto.randomUUID(),
      type: "message",
      config: { content: "" },
    };
    updateEventHook(hookId, { actions: [...hook.actions, newAction] });
  };

  const updateHookAction = (hookId: string, actionId: string, patch: Partial<HookAction>) => {
    const hook = hooks.hooks.find((h) => h.id === hookId);
    if (!hook) return;
    
    updateEventHook(hookId, {
      actions: hook.actions.map((a) =>
        a.id === actionId ? { ...a, ...patch } : a
      ),
    });
  };

  const removeHookAction = (hookId: string, actionId: string) => {
    const hook = hooks.hooks.find((h) => h.id === hookId);
    if (!hook) return;
    
    updateEventHook(hookId, {
      actions: hook.actions.filter((a) => a.id !== actionId),
    });
  };

  const triggerOptions: { value: BackgroundMessageTrigger; label: string }[] = [
    { value: "session_start", label: "Session Start" },
    { value: "after_greeting", label: "After Greeting" },
    { value: "before_handoff", label: "Before Handoff" },
    { value: "custom", label: "Custom Event" },
  ];

  const eventOptions: { value: HookEventType; label: string }[] = [
    { value: "session_start", label: "Session Start" },
    { value: "session_end", label: "Session End" },
    { value: "tool_success", label: "Tool Success" },
    { value: "tool_failure", label: "Tool Failure" },
    { value: "handoff", label: "Handoff" },
    { value: "error", label: "Error" },
  ];

  const actionTypeOptions: { value: HookActionType; label: string }[] = [
    { value: "message", label: "Send Message" },
    { value: "api_call", label: "Call API" },
    { value: "set_variable", label: "Set Variable" },
    { value: "log", label: "Log Event" },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Background Messages */}
      <Card
        title={
          <Space>
            <MessageOutlined />
            <span>Background Messages</span>
            <Tag color="purple">{behavior.backgroundMessages.length}</Tag>
            <Tooltip title="Hidden system instructions injected at specific points to guide agent behavior without the user seeing them.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addBackgroundMessage}>
            Add Message
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Background messages are hidden system context injected at specific points during conversation.
          They help guide the agent without being visible to the user.
        </Typography.Paragraph>

        {behavior.backgroundMessages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No background messages configured"
          />
        ) : (
          <Collapse
            accordion
            size="small"
            items={behavior.backgroundMessages.map((msg) => ({
              key: msg.id,
              label: (
                <Space>
                  <Tag color={msg.enabled ? "blue" : "default"}>
                    {triggerOptions.find((t) => t.value === msg.trigger)?.label || msg.trigger}
                  </Tag>
                  <span>{msg.content.substring(0, 50) || "Empty message"}{msg.content.length > 50 ? "..." : ""}</span>
                  {!msg.enabled && <Tag color="default">Disabled</Tag>}
                </Space>
              ),
              extra: (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Switch
                    size="small"
                    checked={msg.enabled}
                    onChange={(enabled) => updateBackgroundMessage(msg.id, { enabled })}
                  />
                  <Popconfirm
                    title="Delete this message?"
                    onConfirm={() => removeBackgroundMessage(msg.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Typography.Text type="secondary">Trigger</Typography.Text>
                      <Select
                        value={msg.trigger}
                        onChange={(trigger) => updateBackgroundMessage(msg.id, { trigger })}
                        style={{ width: "100%", marginTop: 4 }}
                        options={triggerOptions}
                      />
                    </Col>
                    {msg.trigger === "custom" && (
                      <Col span={16}>
                        <Typography.Text type="secondary">Custom Event Name</Typography.Text>
                        <Input
                          value={msg.customEvent}
                          onChange={(e) => updateBackgroundMessage(msg.id, { customEvent: e.target.value })}
                          placeholder="custom_event_name"
                          style={{ marginTop: 4 }}
                        />
                      </Col>
                    )}
                  </Row>
                  <div>
                    <Typography.Text type="secondary">Message Content</Typography.Text>
                    <Input.TextArea
                      rows={3}
                      value={msg.content}
                      onChange={(e) => updateBackgroundMessage(msg.id, { content: e.target.value })}
                      placeholder="System context to inject..."
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      {/* Idle Messages */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>Idle Messages</span>
            <Tag color="purple">{behavior.idleMessages.length}</Tag>
            <Tooltip title="Automatic follow-up messages sent when the user hasn't responded. Great for re-engaging users.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addIdleMessage}>
            Add Idle Message
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Idle messages are sent automatically when the user hasn't responded for a specified time.
          Great for re-engaging users or prompting for more information.
        </Typography.Paragraph>

        {behavior.idleMessages.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No idle messages configured"
          />
        ) : (
          <Collapse
            accordion
            size="small"
            items={behavior.idleMessages.map((msg) => ({
              key: msg.id,
              label: (
                <Space>
                  <Tag color={msg.enabled ? "orange" : "default"}>
                    {msg.delaySeconds}s delay
                  </Tag>
                  <span>{msg.content.substring(0, 50) || "Empty message"}{msg.content.length > 50 ? "..." : ""}</span>
                  {!msg.enabled && <Tag color="default">Disabled</Tag>}
                </Space>
              ),
              extra: (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Switch
                    size="small"
                    checked={msg.enabled}
                    onChange={(enabled) => updateIdleMessage(msg.id, { enabled })}
                  />
                  <Popconfirm
                    title="Delete this message?"
                    onConfirm={() => removeIdleMessage(msg.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={12}>
                    <Col span={8}>
                      <FieldLabel label="Delay" help="Seconds of inactivity before this message is sent." />
                      <InputNumber
                        min={5}
                        max={300}
                        value={msg.delaySeconds}
                        onChange={(value) => updateIdleMessage(msg.id, { delaySeconds: value ?? 30 })}
                        style={{ width: "100%", marginTop: 4 }}
                        addonAfter="sec"
                      />
                    </Col>
                    <Col span={8}>
                      <FieldLabel label="Max times" help="Maximum times this message can be sent in one conversation." />
                      <InputNumber
                        min={1}
                        max={10}
                        value={msg.maxTimes}
                        onChange={(value) => updateIdleMessage(msg.id, { maxTimes: value ?? 3 })}
                        style={{ width: "100%", marginTop: 4 }}
                      />
                    </Col>
                  </Row>
                  <div>
                    <Typography.Text type="secondary">Message Content</Typography.Text>
                    <Input.TextArea
                      rows={2}
                      value={msg.content}
                      onChange={(e) => updateIdleMessage(msg.id, { content: e.target.value })}
                      placeholder="Are you still there? Let me know if you need help..."
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      {/* Event Hooks */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>Event Hooks</span>
            <Tag color="purple">{hooks.hooks.length}</Tag>
            <Tooltip title="Trigger custom actions (API calls, messages, logs) when specific events occur during conversations.">
              <InfoCircleOutlined style={{ color: "rgba(0, 0, 0, 0.45)" }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addEventHook}>
            Add Hook
          </Button>
        }
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Event hooks let you trigger actions when specific events occur during conversation.
          Use them to log events, call APIs, or perform custom logic.
        </Typography.Paragraph>

        {hooks.hooks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No event hooks configured"
          />
        ) : (
          <Collapse
            accordion
            size="small"
            items={hooks.hooks.map((hook) => ({
              key: hook.id,
              label: (
                <Space>
                  <Tag color={hook.enabled ? "green" : "default"}>
                    {eventOptions.find((e) => e.value === hook.event)?.label || hook.event}
                  </Tag>
                  <span>{hook.actions.length} action{hook.actions.length !== 1 ? "s" : ""}</span>
                  {!hook.enabled && <Tag color="default">Disabled</Tag>}
                </Space>
              ),
              extra: (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Switch
                    size="small"
                    checked={hook.enabled}
                    onChange={(enabled) => updateEventHook(hook.id, { enabled })}
                  />
                  <Popconfirm
                    title="Delete this hook?"
                    onConfirm={() => removeEventHook(hook.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
              children: (
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Typography.Text type="secondary">Event</Typography.Text>
                      <Select
                        value={hook.event}
                        onChange={(event) => updateEventHook(hook.id, { event })}
                        style={{ width: "100%", marginTop: 4 }}
                        options={eventOptions}
                      />
                    </Col>
                  </Row>

                  <div>
                    <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }}>
                      <Typography.Text type="secondary">Actions</Typography.Text>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => addHookAction(hook.id)}
                      >
                        Add Action
                      </Button>
                    </Space>

                    {hook.actions.length === 0 ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        No actions defined. Add one to execute when this event triggers.
                      </Typography.Text>
                    ) : (
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        {hook.actions.map((action, idx) => (
                          <Row key={action.id} gutter={8} align="middle">
                            <Col span={6}>
                              <Select
                                size="small"
                                value={action.type}
                                onChange={(type) => updateHookAction(hook.id, action.id, { type })}
                                style={{ width: "100%" }}
                                options={actionTypeOptions}
                              />
                            </Col>
                            <Col span={16}>
                              {action.type === "message" && (
                                <Input
                                  size="small"
                                  value={(action.config as { content?: string }).content ?? ""}
                                  onChange={(e) =>
                                    updateHookAction(hook.id, action.id, {
                                      config: { ...action.config, content: e.target.value },
                                    })
                                  }
                                  placeholder="Message to send..."
                                />
                              )}
                              {action.type === "api_call" && (
                                <Input
                                  size="small"
                                  value={(action.config as { url?: string }).url ?? ""}
                                  onChange={(e) =>
                                    updateHookAction(hook.id, action.id, {
                                      config: { ...action.config, url: e.target.value },
                                    })
                                  }
                                  placeholder="API URL to call..."
                                />
                              )}
                              {action.type === "set_variable" && (
                                <Space.Compact style={{ width: "100%" }}>
                                  <Input
                                    size="small"
                                    value={(action.config as { name?: string }).name ?? ""}
                                    onChange={(e) =>
                                      updateHookAction(hook.id, action.id, {
                                        config: { ...action.config, name: e.target.value },
                                      })
                                    }
                                    placeholder="Variable name"
                                    style={{ width: "40%" }}
                                  />
                                  <Input
                                    size="small"
                                    value={(action.config as { value?: string }).value ?? ""}
                                    onChange={(e) =>
                                      updateHookAction(hook.id, action.id, {
                                        config: { ...action.config, value: e.target.value },
                                      })
                                    }
                                    placeholder="Value"
                                    style={{ width: "60%" }}
                                  />
                                </Space.Compact>
                              )}
                              {action.type === "log" && (
                                <Input
                                  size="small"
                                  value={(action.config as { message?: string }).message ?? ""}
                                  onChange={(e) =>
                                    updateHookAction(hook.id, action.id, {
                                      config: { ...action.config, message: e.target.value },
                                    })
                                  }
                                  placeholder="Log message..."
                                />
                              )}
                            </Col>
                            <Col span={2}>
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeHookAction(hook.id, action.id)}
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
    </Space>
  );
}
