"use client";

import {
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  PhoneFilled,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { RoutePageShell } from "../_components/route-page-shell";
import { AgentTestDrawer } from "../_components/agent-test-drawer";
import { getAgentAvatarUrl } from "@/lib/utils/agent-avatar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentRecord {
  id: string;
  name: string;
  model: string;
  channels: string[];
  status: "draft" | "active" | "paused";
  createdAt: string;
  avatarUrl?: string | null;
}

interface AgentsResponse {
  agents: Array<{
    id: string;
    name: string;
    system_prompt: string | null;
    voice: string;
    channels: string[];
    status: "draft" | "active" | "paused";
    created_at: string;
    avatar_url?: string | null;
    provider?: { chatModel?: string };
  }>;
}

interface AgentUpsertResponse {
  agent?: { id: string; name: string };
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function truncateId(id: string, len = 20): string {
  return id.length > len ? `${id.slice(0, len)}...` : id;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AgentRecord[]>([]);
  const [testAgent, setTestAgent] = useState<{ id: string; name: string } | null>(null);

  // Filter state
  const [nameFilter, setNameFilter] = useState("");
  const [idFilter, setIdFilter] = useState("");
  const [nameDropOpen, setNameDropOpen] = useState(false);
  const [idDropOpen, setIdDropOpen] = useState(false);

  // Assign to team modal state
  const [assignAgent, setAssignAgent] = useState<AgentRecord | null>(null);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/agents", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as
        | (AgentsResponse & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load agents.");
      }

      setRows(
        (payload?.agents ?? []).map((agent) => ({
          id: agent.id,
          name: agent.name,
          model: agent.provider?.chatModel ?? "—",
          channels: agent.channels ?? [],
          status: agent.status,
          createdAt: agent.created_at,
          avatarUrl: agent.avatar_url ?? null,
        })),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const upsertAgent = async (payload: {
    id?: string;
    status?: AgentRecord["status"];
    name?: string;
  }) => {
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as AgentUpsertResponse | null;
    if (!response.ok) throw new Error(data?.error ?? "Failed to save agent.");
    return data?.agent ?? null;
  };

  const createAgent = async () => {
    try {
      const created = await upsertAgent({ name: `Agent ${rows.length + 1}`, status: "draft" });
      message.success("Agent draft created.");
      if (created?.id) {
        void router.push(`/agents/${created.id}`);
        return;
      }
      await loadAgents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to create agent.");
    }
  };

  const openAssignModal = async (record: AgentRecord) => {
    setAssignAgent(record);
    setSelectedTeamId(null);
    setTeamsLoading(true);
    try {
      const res = await fetch("/api/teams", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as { teams?: { id: string; name: string }[]; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Failed to load teams.");
      setTeams(payload?.teams ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load teams.");
    } finally {
      setTeamsLoading(false);
    }
  };

  const confirmAssignToTeam = async () => {
    if (!assignAgent || !selectedTeamId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: assignAgent.id, role: "specialist" }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Failed to assign agent.");
      message.success(`${assignAgent.name} added to team.`);
      setAssignAgent(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to assign agent.");
    } finally {
      setAssigning(false);
    }
  };

  const deployAgent = async (record: AgentRecord) => {
    try {
      await upsertAgent({ id: record.id, status: "active" });
      message.success(`${record.name} deployed.`);
      await loadAgents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to deploy agent.");
    }
  };

  const pauseAgent = async (record: AgentRecord) => {
    try {
      await upsertAgent({ id: record.id, status: "paused" });
      message.success(`${record.name} paused.`);
      await loadAgents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to pause agent.");
    }
  };


  const duplicateAgent = async (record: AgentRecord) => {
    try {
      const created = await upsertAgent({ name: `${record.name} (copy)`, status: "draft" });
      message.success("Agent duplicated.");
      if (created?.id) {
        void router.push(`/agents/${created.id}`);
        return;
      }
      await loadAgents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to duplicate agent.");
    }
  };

  const deleteAgent = async (record: AgentRecord) => {
    try {
      const response = await fetch(`/api/agents?id=${record.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Failed to delete agent.");
      message.success("Agent deleted.");
      await loadAgents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to delete agent.");
    }
  };

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const hydrate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const authenticated = Boolean(data.session?.user);
      setIsAuthenticated(authenticated);
      if (authenticated) await loadAgents();
      else setRows([]);
    };

    void hydrate();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const authenticated = Boolean(session?.user);
      setIsAuthenticated(authenticated);
      if (authenticated) void loadAgents();
      else setRows([]);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [loadAgents, supabase]);

  // ── Filtered rows ───────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (nameFilter && !r.name.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (idFilter && !r.id.toLowerCase().includes(idFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, nameFilter, idFilter]);

  // ── Table columns ───────────────────────────────────────────────────────────

  const statusConfig: Record<AgentRecord["status"], { color: "success" | "processing" | "default"; label: string }> = {
    active: { color: "success", label: "Active" },
    draft: { color: "default", label: "Draft" },
    paused: { color: "processing", label: "Paused" },
  };

  const columns: ColumnsType<AgentRecord> = [
    {
      title: "Agent",
      dataIndex: "name",
      key: "name",
      render: (_value, record) => {
        const { color, label } = statusConfig[record.status] ?? { color: "default", label: record.status };
        return (
          <div
            style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
            onClick={() => void router.push(`/agents/${record.id}`)}
          >
            <Badge dot status={color} offset={[-2, 34]}>
              <Avatar
                size={40}
                src={getAgentAvatarUrl(record.id, record.avatarUrl)}
                style={{ background: "#e8e8e8", flexShrink: 0 }}
              />
            </Badge>
            <div style={{ minWidth: 0 }}>
              <Typography.Link
                style={{ fontWeight: 600, fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {record.name}
              </Typography.Link>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {label} · {record.model}
              </Typography.Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (id: string) => (
        <Tooltip title="Click to copy">
          <Typography.Text
            copyable={{ text: id, tooltips: false }}
            style={{ fontSize: 12, color: "#6B7280", fontFamily: "monospace", cursor: "pointer" }}
          >
            {truncateId(id, 16)}
          </Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: "Channels",
      dataIndex: "channels",
      key: "channels",
      width: 180,
      render: (channels: string[]) =>
        channels.length > 0 ? (
          <Space size={4} wrap>
            {channels.map((ch) => {
              const labels: Record<string, string> = {
                web_chat: "Web Chat", web_voice: "Voice", phone: "Phone",
                whatsapp: "WhatsApp", sms: "SMS", email: "Email", slack: "Slack",
              };
              return (
                <Badge key={ch} color="#e6f4ff" count={
                  <Typography.Text style={{ fontSize: 11, color: "#1677ff", padding: "1px 6px" }}>
                    {labels[ch] ?? ch}
                  </Typography.Text>
                } />
              );
            })}
          </Space>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>No channels</Typography.Text>
        ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (value: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(value)}
        </Typography.Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 140,
      render: (_value, record) => (
        <Space size={4} style={{ justifyContent: "flex-end", display: "flex" }}>
          <Tooltip title="Edit">
            <Button
              type="text" size="small"
              icon={<EditOutlined style={{ fontSize: 14, color: "#6B7280" }} />}
              style={{ width: 32, height: 32 }}
              onClick={() => void router.push(`/agents/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Test call">
            <Button
              type="text" size="small"
              icon={<PhoneFilled style={{ fontSize: 14, color: "#6B7280" }} />}
              style={{ width: 32, height: 32 }}
              onClick={() => setTestAgent({ id: record.id, name: record.name })}
            />
          </Tooltip>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: [
                {
                  key: "deploy",
                  icon: <RocketOutlined />,
                  label: record.status === "active" ? "Pause agent" : "Deploy agent",
                  onClick: () => record.status === "active" ? void pauseAgent(record) : void deployAgent(record),
                },
                {
                  key: "channels",
                  icon: <PlusOutlined />,
                  label: "Assign channels",
                  onClick: () => void router.push(`/agents/${record.id}?tab=core`),
                },
                {
                  key: "team",
                  icon: <TeamOutlined />,
                  label: "Assign to team",
                  onClick: () => void openAssignModal(record),
                },
                {
                  key: "duplicate",
                  icon: <CopyOutlined />,
                  label: "Duplicate",
                  onClick: () => void duplicateAgent(record),
                },
                {
                  key: "phone",
                  icon: <PhoneOutlined />,
                  label: "Voice & Phone settings",
                  onClick: () => void router.push(`/agents/${record.id}?tab=speech`),
                },
                { type: "divider" },
                {
                  key: "delete",
                  icon: <DeleteOutlined />,
                  label: "Delete",
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: "Delete this agent?",
                      content: "This action cannot be undone.",
                      okText: "Delete",
                      okButtonProps: { danger: true },
                      onOk: () => void deleteAgent(record),
                    });
                  },
                },
              ],
            }}
          >
            <Button
              type="text" size="small"
              icon={<DownOutlined style={{ fontSize: 12, color: "#6B7280" }} />}
              style={{ width: 32, height: 32 }}
            />
          </Dropdown>
        </Space>
      ),
    },
  ];

  // ── Filter pill dropdown content ────────────────────────────────────────────

  const nameDropdown = (
    <div style={{ padding: "10px 12px", background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 200 }}>
      <Typography.Text style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6 }}>Filter by name</Typography.Text>
      <Input
        size="small"
        placeholder="Search name..."
        value={nameFilter}
        onChange={(e) => setNameFilter(e.target.value)}
        allowClear
        autoFocus
        onPressEnter={() => setNameDropOpen(false)}
      />
    </div>
  );

  const idDropdown = (
    <div style={{ padding: "10px 12px", background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 220 }}>
      <Typography.Text style={{ fontSize: 12, color: "#6B7280", display: "block", marginBottom: 6 }}>Filter by ID</Typography.Text>
      <Input
        size="small"
        placeholder="Paste agent ID..."
        value={idFilter}
        onChange={(e) => setIdFilter(e.target.value)}
        allowClear
        autoFocus
        onPressEnter={() => setIdDropOpen(false)}
      />
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <RoutePageShell
      title="AI Assistants"
      subtitle={isAuthenticated ? "" : "Sign in to manage your AI agents"}
      actions={
        <Space size={8}>
          <Button
            icon={<UploadOutlined />}
            style={{
              background: "#111827", color: "#fff", border: "none",
              borderRadius: 20, fontWeight: 500, fontSize: 13,
              height: 36, paddingLeft: 16, paddingRight: 16,
            }}
            disabled={!isAuthenticated}
          >
            Import Assistants
          </Button>
          <Button
            icon={<PlusOutlined />}
            style={{
              background: "#111827", color: "#fff", border: "none",
              borderRadius: 20, fontWeight: 500, fontSize: 13,
              height: 36, paddingLeft: 16, paddingRight: 16,
            }}
            disabled={!isAuthenticated}
            onClick={() => void createAgent()}
          >
            Create New Assistant
          </Button>
        </Space>
      }
    >
      {/* Filter pills row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Dropdown
          open={nameDropOpen}
          onOpenChange={setNameDropOpen}
          dropdownRender={() => nameDropdown}
          trigger={["click"]}
        >
          <Button
            size="small"
            style={{
              borderRadius: 20,
              borderColor: nameFilter ? "#17DEBC" : "#D1D5DB",
              color: nameFilter ? "#059669" : "#374151",
              background: nameFilter ? "#F0FDF4" : "#fff",
              fontWeight: 500, fontSize: 13, height: 32, paddingLeft: 12, paddingRight: 10,
            }}
          >
            <Space size={4}>
              Name {nameFilter ? `· ${nameFilter.slice(0, 10)}` : ""}
              <DownOutlined style={{ fontSize: 9 }} />
            </Space>
          </Button>
        </Dropdown>

        <Dropdown
          open={idDropOpen}
          onOpenChange={setIdDropOpen}
          dropdownRender={() => idDropdown}
          trigger={["click"]}
        >
          <Button
            size="small"
            style={{
              borderRadius: 20,
              borderColor: idFilter ? "#17DEBC" : "#D1D5DB",
              color: idFilter ? "#059669" : "#374151",
              background: idFilter ? "#F0FDF4" : "#fff",
              fontWeight: 500, fontSize: 13, height: 32, paddingLeft: 12, paddingRight: 10,
            }}
          >
            <Space size={4}>
              ID {idFilter ? `· ${idFilter.slice(0, 8)}…` : ""}
              <DownOutlined style={{ fontSize: 9 }} />
            </Space>
          </Button>
        </Dropdown>

        <Button
          size="small"
          style={{
            borderRadius: 20, borderColor: "#D1D5DB", color: "#374151",
            fontWeight: 500, fontSize: 13, height: 32, paddingLeft: 12, paddingRight: 10,
          }}
        >
          <Space size={4}>Tags <DownOutlined style={{ fontSize: 9 }} /></Space>
        </Button>

        <Tooltip title="Refresh">
          <Button
            type="text"
            icon={<ReloadOutlined style={{ fontSize: 14, color: "#6B7280" }} />}
            style={{ width: 32, height: 32, borderRadius: "50%" }}
            onClick={() => {
              setNameFilter("");
              setIdFilter("");
              void loadAgents();
            }}
          />
        </Tooltip>
      </div>

      {/* Table */}
      {rows.length === 0 && !loading ? (
        <div style={{ padding: "60px 0" }}>
          <Empty description="No agents yet">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ borderRadius: 20 }}
              onClick={() => void createAgent()}
              disabled={!isAuthenticated}
            >
              Create your first agent
            </Button>
          </Empty>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          pagination={false}
          rowKey="id"
          size="middle"
          style={{ borderRadius: 0 }}
          styles={{
            // @ts-expect-error — antd internal
            header: { background: "transparent" },
          }}
          onRow={(record) => ({
            style: { cursor: "default" },
            onMouseEnter: (e) => {
              (e.currentTarget as HTMLElement).style.background = "#F9FAFB";
            },
            onMouseLeave: (e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            },
          })}
          components={{
            header: {
              cell: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
                <th
                  {...props}
                  style={{
                    ...((props as { style?: React.CSSProperties }).style),
                    background: "transparent",
                    color: "#6B7280",
                    fontWeight: 500,
                    fontSize: 13,
                    borderBottom: "1px solid #E5E7EB",
                    padding: "12px 16px",
                  }}
                />
              ),
            },
          }}
        />
      )}

      <AgentTestDrawer
        agentId={testAgent?.id ?? null}
        agentName={testAgent?.name}
        open={testAgent !== null}
        onClose={() => setTestAgent(null)}
      />

      <Modal
        title={<Space><TeamOutlined />Assign to Team</Space>}
        open={assignAgent !== null}
        onCancel={() => setAssignAgent(null)}
        onOk={() => void confirmAssignToTeam()}
        okText="Assign"
        okButtonProps={{ disabled: !selectedTeamId, loading: assigning }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%", paddingTop: 8 }}>
          <Typography.Text type="secondary">
            Assign <strong>{assignAgent?.name}</strong> to a team as a specialist agent.
          </Typography.Text>
          <Select
            style={{ width: "100%" }}
            placeholder="Select a team..."
            loading={teamsLoading}
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={(teams).map((t) => ({ value: t.id, label: t.name }))}
            notFoundContent={
              teamsLoading ? "Loading teams..." : (
                <Space direction="vertical" style={{ padding: "8px 0" }}>
                  <Typography.Text type="secondary">No teams yet.</Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0 }}
                    onClick={() => { setAssignAgent(null); void router.push("/teams"); }}
                  >
                    Create a team first
                  </Button>
                </Space>
              )
            }
          />
        </Space>
      </Modal>

      <style>{`
        .ant-table-tbody > tr > td {
          border-bottom: 1px solid #F3F4F6 !important;
          padding: 12px 16px !important;
          transition: background 0.1s;
        }
        .ant-table {
          border: none !important;
        }
        .ant-table-container {
          border: none !important;
          border-radius: 0 !important;
        }
        .ant-table-content table {
          border: none !important;
        }
      `}</style>
    </RoutePageShell>
  );
}
