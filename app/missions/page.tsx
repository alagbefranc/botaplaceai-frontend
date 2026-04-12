"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  DatePicker,
  Drawer,
  Form,
  Input,
  message,
  Popconfirm,
  Progress,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType, TableProps } from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { RoutePageShell } from "@/app/_components/route-page-shell";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Agent {
  id: string;
  name: string;
}

interface MissionContact {
  id: string;
  call_status: string;
  call_duration?: number | null;
  ai_summary?: string | null;
  called_at?: string | null;
  contacts?: { id: string; name: string; phone: string } | null;
}

interface Mission {
  id: string;
  name: string;
  objective: string;
  agent_id?: string | null;
  agentName?: string | null;
  status: "draft" | "scheduled" | "running" | "completed" | "failed" | "paused";
  total_contacts: number;
  completed_calls: number;
  successful_calls: number;
  failed_calls: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  result_summary?: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "#8c8c8c", label: "Draft" },
  scheduled: { color: "#1677ff", label: "Scheduled" },
  running: { color: "#17DEBC", label: "Running" },
  completed: { color: "#52c41a", label: "Completed" },
  failed: { color: "#ff4d4f", label: "Failed" },
  paused: { color: "#faad14", label: "Paused" },
};

const callStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "#8c8c8c", label: "Pending" },
  calling: { color: "#17DEBC", label: "Calling" },
  completed: { color: "#52c41a", label: "Completed" },
  failed: { color: "#ff4d4f", label: "Failed" },
  no_answer: { color: "#faad14", label: "No Answer" },
  busy: { color: "#fa541c", label: "Busy" },
};

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"ascend" | "descend">("descend");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [subTableData, setSubTableData] = useState<Record<string, MissionContact[]>>({});

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState<string | null>(null);
  const [pausing, setPausing] = useState<string | null>(null);
  const [form] = Form.useForm();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [useAllContacts, setUseAllContacts] = useState(false);
  const [scheduleImmediate, setScheduleImmediate] = useState(true);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMissions = useCallback(async (opts?: {
    page?: number; pageSize?: number; search?: string; sortField?: string; sortDir?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(opts?.page ?? page),
        pageSize: String(opts?.pageSize ?? pageSize),
        search: opts?.search ?? search,
        sortField: opts?.sortField ?? sortField,
        sortDir: opts?.sortDir ?? sortDir,
      });
      const res = await fetch(`/api/missions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMissions(data.missions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load missions.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortField, sortDir]);

  useEffect(() => { fetchMissions(); }, [fetchMissions]);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((d) => {
      setAgents((d.agents ?? []).map((a: Agent) => ({ id: a.id, name: a.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/contacts?pageSize=1000").then((r) => r.json()).then((d) => {
      setContacts((d.contacts ?? []).map((c: { id: string; name: string; phone: string }) => ({
        id: c.id, name: c.name, phone: c.phone,
      })));
    }).catch(() => {});
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { fetchMissions({ page: 1, search: val }); }, 400);
  };

  const handleTableChange: TableProps<Mission>["onChange"] = (pagination, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const newPage = pagination.current ?? 1;
    const newSize = pagination.pageSize ?? 20;
    const newField = (s.field as string) ?? "created_at";
    const newDir = s.order ?? "descend";
    setPage(newPage); setPageSize(newSize); setSortField(newField); setSortDir(newDir as "ascend" | "descend");
    fetchMissions({ page: newPage, pageSize: newSize, sortField: newField, sortDir: newDir as string });
  };

  const loadSubTable = async (missionId: string) => {
    if (subTableData[missionId]) return;
    try {
      const res = await fetch(`/api/missions/${missionId}`);
      const data = await res.json();
      if (res.ok) {
        setSubTableData((prev) => ({ ...prev, [missionId]: data.contacts ?? [] }));
      }
    } catch { /* ignore */ }
  };

  const handleExpand = (expanded: boolean, record: Mission) => {
    if (expanded) {
      setExpandedKeys((k) => [...k, record.id]);
      loadSubTable(record.id);
    } else {
      setExpandedKeys((k) => k.filter((id) => id !== record.id));
    }
  };

  const openNew = () => {
    setEditingMission(null);
    setUseAllContacts(false);
    setScheduleImmediate(true);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (m: Mission) => {
    setEditingMission(m);
    setScheduleImmediate(!m.scheduled_at);
    form.setFieldsValue({
      name: m.name,
      objective: m.objective,
      agentId: m.agent_id ?? undefined,
      contactIds: [],
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        name: values.name,
        objective: values.objective,
        agentId: values.agentId ?? null,
        contactIds: useAllContacts ? contacts.map((c) => c.id) : (values.contactIds ?? []),
        scheduledAt: scheduleImmediate ? null : (values.scheduledAt ? dayjs(values.scheduledAt).toISOString() : null),
      };
      const url = editingMission ? `/api/missions/${editingMission.id}` : "/api/missions";
      const method = editingMission ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success(editingMission ? "Mission updated." : "Mission created.");
      setDrawerOpen(false);
      fetchMissions();
    } catch (err) {
      if (err instanceof Error && err.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLaunch = async (id: string) => {
    setLaunching(id);
    try {
      const res = await fetch(`/api/missions/${id}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success(`Mission launched — ${data.queued} calls queued.`);
      fetchMissions();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to launch mission.");
    } finally {
      setLaunching(null);
    }
  };

  const handlePause = async (id: string) => {
    setPausing(id);
    try {
      const res = await fetch(`/api/missions/${id}/pause`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success("Mission paused.");
      fetchMissions();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to pause mission.");
    } finally {
      setPausing(null);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/missions/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { message.error(data.error); return; }
    message.success("Mission deleted.");
    fetchMissions();
  };

  const runningCount = missions.filter((m) => m.status === "running").length;

  const subTableColumns: TableColumnsType<MissionContact> = [
    {
      title: "Contact",
      render: (_: unknown, r) => (
        <span>{(r.contacts as { name?: string } | null)?.name ?? "Unknown"}</span>
      ),
      width: 180,
    },
    {
      title: "Phone",
      render: (_: unknown, r) => (
        <span style={{ fontFamily: "monospace", fontSize: 12 }}>
          {(r.contacts as { phone?: string } | null)?.phone ?? "—"}
        </span>
      ),
      width: 150,
    },
    {
      title: "Status",
      dataIndex: "call_status",
      width: 120,
      render: (s: string) => {
        const cfg = callStatusConfig[s] ?? { color: "#8c8c8c", label: s };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    {
      title: "Duration",
      dataIndex: "call_duration",
      width: 100,
      render: (d?: number | null) => d ? `${Math.floor(d / 60)}m ${d % 60}s` : "—",
    },
    {
      title: "AI Summary",
      dataIndex: "ai_summary",
      ellipsis: true,
      render: (s?: string | null) => s ?? <Typography.Text type="secondary">No summary yet</Typography.Text>,
    },
    {
      title: "Called",
      dataIndex: "called_at",
      width: 130,
      render: (v?: string | null) => v ? dayjs(v).fromNow() : "—",
    },
  ];

  const columns: TableColumnsType<Mission> = [
    {
      title: "Mission",
      dataIndex: "name",
      sorter: true,
      width: 220,
      render: (name: string, record) => (
        <div>
          <Button type="link" style={{ padding: 0, fontWeight: 500, color: "inherit" }} onClick={() => router.push(`/missions/${record.id}`)}>
            {name}
          </Button>
          {record.result_summary && (
            <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }} ellipsis>
              {record.result_summary}
            </Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: "Agent",
      dataIndex: "agentName",
      width: 160,
      filterMode: "tree",
      filterSearch: true,
      filters: agents.map((a) => ({ text: a.name, value: a.id })),
      onFilter: (value, record) => record.agent_id === value,
      render: (name?: string | null) => name ? (
        <Space size={6}>
          <Avatar size={20} style={{ background: "#17DEBC", fontSize: 11 }}>
            {name.charAt(0).toUpperCase()}
          </Avatar>
          <span>{name}</span>
        </Space>
      ) : <Typography.Text type="secondary">No agent</Typography.Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 120,
      filterMode: "tree",
      filters: Object.entries(statusConfig).map(([v, c]) => ({ text: c.label, value: v })),
      onFilter: (value, record) => record.status === value,
      render: (s: string) => {
        const cfg = statusConfig[s] ?? { color: "#8c8c8c", label: s };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    {
      title: "Progress",
      width: 180,
      render: (_: unknown, record: Mission) => {
        const pct = record.total_contacts > 0
          ? Math.round((record.completed_calls / record.total_contacts) * 100)
          : 0;
        return (
          <div>
            <Progress
              percent={pct}
              strokeColor="#17DEBC"
              trailColor="#e8e8e8"
              size="small"
              style={{ marginBottom: 2 }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {record.completed_calls}/{record.total_contacts} calls
            </Typography.Text>
          </div>
        );
      },
    },
    {
      title: "Success",
      width: 100,
      render: (_: unknown, record: Mission) => (
        <Space size={4}>
          <Tag color="success" style={{ margin: 0 }}>{record.successful_calls}</Tag>
          <Tag color="error" style={{ margin: 0 }}>{record.failed_calls}</Tag>
        </Space>
      ),
    },
    {
      title: "Scheduled",
      dataIndex: "scheduled_at",
      sorter: true,
      width: 140,
      render: (v?: string | null) => v ? (
        <Tooltip title={dayjs(v).format("MMM D, YYYY h:mm A")}>
          <span>{dayjs(v).fromNow()}</span>
        </Tooltip>
      ) : <Tag>Immediate</Tag>,
    },
    {
      title: "",
      key: "actions",
      fixed: "right" as const,
      width: 160,
      render: (_: unknown, record: Mission) => (
        <Space size={2}>
          <Tooltip title="View detail">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => router.push(`/missions/${record.id}`)} />
          </Tooltip>
          {["draft", "scheduled", "paused"].includes(record.status) && (
            <Tooltip title="Launch">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={launching === record.id}
                onClick={() => handleLaunch(record.id)}
                style={{ color: "#17DEBC" }}
              />
            </Tooltip>
          )}
          {record.status === "running" && (
            <Tooltip title="Pause">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                loading={pausing === record.id}
                onClick={() => handlePause(record.id)}
                style={{ color: "#faad14" }}
              />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm title="Delete this mission?" onConfirm={() => handleDelete(record.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const selectedContactsCount = useAllContacts ? contacts.length : (form.getFieldValue("contactIds") ?? []).length;

  return (
    <RoutePageShell title="Missions" nativeContent>
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#fafafa" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Missions</Typography.Title>
          {runningCount > 0 && (
            <Badge
              count={runningCount}
              style={{ backgroundColor: "#17DEBC", boxShadow: "0 0 0 2px #E6FBF8" }}
            />
          )}
        </div>
        <Space>
          <Input.Search
            placeholder="Search missions..."
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 240 }}
          />
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={() => fetchMissions()} loading={loading} />
          </Tooltip>
          <Button
            type="primary"
            icon={<RocketOutlined />}
            onClick={openNew}
            style={{ background: "#17DEBC", borderColor: "#17DEBC", color: "#fff" }}
          >
            New Mission
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table<Mission>
        rowKey="id"
        columns={columns}
        dataSource={missions}
        loading={loading}
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpand: handleExpand,
          expandedRowRender: (record) => (
            <Table<MissionContact>
              rowKey="id"
              columns={subTableColumns}
              dataSource={subTableData[record.id] ?? []}
              pagination={false}
              size="small"
              style={{ margin: "8px 0" }}
            />
          ),
        }}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} missions`,
          pageSizeOptions: ["10", "20", "50"],
        }}
        scroll={{ x: "max-content" }}
        size="middle"
        style={{ background: "#fff", borderRadius: 12 }}
      />

      {/* New/Edit Drawer */}
      <Drawer
        title={editingMission ? "Edit Mission" : "New Mission"}
        placement="right"
        width={560}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving}
              style={{ background: "#17DEBC", borderColor: "#17DEBC" }}>
              {editingMission ? "Save Changes" : "Create Mission"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Mission Name" rules={[{ required: true, message: "Mission name is required." }]}>
            <Input placeholder="Corporate Catering Quotes" />
          </Form.Item>

          <Form.Item name="agentId" label="AI Agent" rules={[{ required: true, message: "Please select an agent." }]}>
            <Select
              placeholder="Select the agent that will make the calls..."
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
              showSearch
              filterOption={(input, opt) => (opt?.label as string ?? "").toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Form.Item
            name="objective"
            label="Call Objective / Script"
            rules={[{ required: true, message: "Objective is required." }]}
            extra="Describe what the agent should achieve on each call — this becomes the agent's system instruction."
          >
            <Input.TextArea
              rows={5}
              placeholder="Find catering companies in Chicago for a 50-person corporate event. Get a per-person quote, ask about dietary options, and try to negotiate below $65/person..."
            />
          </Form.Item>

          <Form.Item label="Contacts to Call">
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <Switch
                checked={useAllContacts}
                onChange={setUseAllContacts}
                style={useAllContacts ? { background: "#17DEBC" } : {}}
              />
              <Typography.Text>Use all contacts ({contacts.length} total)</Typography.Text>
            </div>
            {!useAllContacts && (
              <Form.Item name="contactIds" noStyle>
                <Select
                  mode="multiple"
                  placeholder="Search and select contacts..."
                  showSearch
                  filterOption={(input, opt) => (opt?.label as string ?? "").toLowerCase().includes(input.toLowerCase())}
                  options={contacts.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.phone})`,
                  }))}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
            {(selectedContactsCount > 0 || useAllContacts) && (
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: "block" }}>
                {useAllContacts ? contacts.length : selectedContactsCount} contact{(useAllContacts ? contacts.length : selectedContactsCount) !== 1 ? "s" : ""} will be called
              </Typography.Text>
            )}
          </Form.Item>

          <Form.Item label="Schedule">
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <Switch
                checked={scheduleImmediate}
                onChange={setScheduleImmediate}
                style={scheduleImmediate ? { background: "#17DEBC" } : {}}
              />
              <Typography.Text>Launch immediately when started</Typography.Text>
            </div>
            {!scheduleImmediate && (
              <Form.Item name="scheduledAt" noStyle>
                <DatePicker showTime style={{ width: "100%" }} placeholder="Pick a date and time" />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Drawer>
    </div>
    </RoutePageShell>
  );
}
