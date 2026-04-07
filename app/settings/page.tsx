"use client";

import {
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
  SaveOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tabs,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TabsProps } from "antd";
import { useEffect, useState, useCallback } from "react";
import { RoutePageShell } from "../_components/route-page-shell";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "editor" | "viewer";
  orgId: string;
  orgName: string;
  createdAt: string;
  lastSignIn: string | null;
}

interface OrgMember {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "editor" | "viewer";
  joinedAt: string;
  lastSignIn: string | null;
}

interface Organization {
  id: string;
  name: string;
  billingEmail: string | null;
  billingMarkupPercentage: number;
}

interface UsageStats {
  conversations: number;
  messages: number;
  users: number;
  avgDurationMinutes: number;
}

// ─── Role colors ─────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  admin: "red",
  editor: "blue",
  viewer: "default",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string, email: string): string {
  const src = name.trim() || email;
  return src.slice(0, 2).toUpperCase();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ profile, onRefresh }: { profile: Profile | null; onRefresh: () => void }) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName);
  }, [profile]);

  const save = async () => {
    if (!displayName.trim()) {
      void message.error("Display name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(j?.error ?? "Failed to save.");
      }
      void message.success("Profile updated.");
      setEditing(false);
      onRefresh();
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <Skeleton active paragraph={{ rows: 6 }} />;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Avatar + name card */}
      <Card>
        <Row align="middle" gutter={24}>
          <Col>
            {profile.avatarUrl ? (
              <Avatar size={72} src={profile.avatarUrl} />
            ) : (
              <Avatar size={72} style={{ background: "#6C5CE7", fontSize: 28 }}>
                {initials(profile.displayName, profile.email)}
              </Avatar>
            )}
          </Col>
          <Col flex={1}>
            <Space direction="vertical" size={2}>
              {editing ? (
                <Space>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{ width: 260 }}
                    placeholder="Your display name"
                    onPressEnter={() => void save()}
                    autoFocus
                  />
                  <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void save()}>
                    Save
                  </Button>
                  <Button onClick={() => { setEditing(false); setDisplayName(profile.displayName); }}>
                    Cancel
                  </Button>
                </Space>
              ) : (
                <Space align="center">
                  <Typography.Title level={4} style={{ margin: 0 }}>
                    {profile.displayName || profile.email.split("@")[0]}
                  </Typography.Title>
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => setEditing(true)}
                  />
                </Space>
              )}
              <Typography.Text type="secondary">{profile.email}</Typography.Text>
              <Tag color={ROLE_COLOR[profile.role]}>{profile.role.toUpperCase()}</Tag>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Account details */}
      <Card title="Account Details">
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="User ID">
            <Typography.Text code copyable style={{ fontSize: 11 }}>
              {profile.id}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
          <Descriptions.Item label="Organization">{profile.orgName}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color={ROLE_COLOR[profile.role]}>{profile.role.toUpperCase()}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Account Created">{formatDate(profile.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="Last Sign In">{formatDate(profile.lastSignIn)}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ onRefresh }: { onRefresh: () => void }) {
  const { message } = App.useApp();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/organization");
      if (res.ok) {
        const j = await res.json() as { organization: Organization };
        setOrg(j.organization);
        setOrgName(j.organization.name);
        setBillingEmail(j.organization.billingEmail ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName.trim(), billingEmail: billingEmail.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(j?.error ?? "Failed to save.");
      }
      void message.success("Organization settings saved.");
      onRefresh();
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;

  return (
    <Card title="Organization Settings" style={{ maxWidth: 640 }}>
      <Form layout="vertical">
        <Form.Item label="Organization Name" required>
          <Input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Your organization name"
          />
        </Form.Item>
        <Form.Item
          label="Organization ID"
          help="Use this ID when calling the platform API"
        >
          <Input
            value={org?.id ?? ""}
            readOnly
            addonAfter={
              <Tooltip title="Copy">
                <CopyOutlined
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    void navigator.clipboard.writeText(org?.id ?? "");
                    void message.success("Copied!");
                  }}
                />
              </Tooltip>
            }
          />
        </Form.Item>
        <Form.Item label="Billing Email" help="Invoice notifications will be sent here">
          <Input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder="billing@yourcompany.com"
          />
        </Form.Item>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={() => void save()}
          disabled={!orgName.trim()}
        >
          Save Changes
        </Button>
      </Form>
    </Card>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ currentUserId, currentRole }: { currentUserId: string; currentRole: string }) {
  const { message } = App.useApp();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/members");
      if (res.ok) {
        const j = await res.json() as { members: OrgMember[] };
        setMembers(j.members);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateRole = async (userId: string, role: "admin" | "editor" | "viewer") => {
    try {
      const res = await fetch("/api/settings/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(j?.error ?? "Failed to update role.");
      }
      void message.success("Role updated.");
      void load();
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Failed to update role.");
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/settings/members?userId=${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(j?.error ?? "Failed to remove member.");
      }
      void message.success("Member removed.");
      void load();
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "Failed to remove member.");
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // Placeholder – a real invite flow would send an email via Supabase auth invite
      await new Promise((r) => setTimeout(r, 800));
      void message.success(`Invite sent to ${inviteEmail}.`);
      setInviteOpen(false);
      setInviteEmail("");
    } finally {
      setInviting(false);
    }
  };

  const isAdmin = currentRole === "admin";

  const columns: ColumnsType<OrgMember> = [
    {
      title: "Member",
      key: "member",
      render: (_, r) => (
        <Space>
          {r.avatarUrl ? (
            <Avatar size={32} src={r.avatarUrl} />
          ) : (
            <Avatar size={32} style={{ background: "#6C5CE7" }}>
              {initials(r.displayName, r.email)}
            </Avatar>
          )}
          <Space direction="vertical" size={0}>
            <Space size={6}>
              <Typography.Text strong>{r.displayName}</Typography.Text>
              {r.id === currentUserId && <Tag color="purple" style={{ fontSize: 10, lineHeight: "18px" }}>You</Tag>}
            </Space>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Typography.Text>
          </Space>
        </Space>
      ),
    },
    {
      title: "Role",
      key: "role",
      width: 160,
      render: (_, r) =>
        isAdmin && r.id !== currentUserId ? (
          <Select
            value={r.role}
            size="small"
            style={{ width: 140 }}
            onChange={(role) => void updateRole(r.id, role)}
            options={[
              { label: "Admin", value: "admin" },
              { label: "Editor", value: "editor" },
              { label: "Viewer", value: "viewer" },
            ]}
          />
        ) : (
          <Tag color={ROLE_COLOR[r.role]}>{r.role.toUpperCase()}</Tag>
        ),
    },
    {
      title: "Joined",
      key: "joined",
      width: 140,
      render: (_, r) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {formatDate(r.joinedAt)}
        </Typography.Text>
      ),
    },
    {
      title: "Last Active",
      key: "lastActive",
      width: 140,
      render: (_, r) => (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {formatDate(r.lastSignIn)}
        </Typography.Text>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: "",
            key: "actions",
            width: 80,
            render: (_: unknown, r: OrgMember) =>
              r.id !== currentUserId ? (
                <Popconfirm
                  title="Remove this member from the organization?"
                  okText="Remove"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void removeMember(r.id)}
                >
                  <Button type="text" size="small" danger>
                    Remove
                  </Button>
                </Popconfirm>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <TeamOutlined />
          <Typography.Text strong>{members.length} member{members.length !== 1 ? "s" : ""}</Typography.Text>
        </Space>
        {isAdmin && (
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => setInviteOpen(true)}>
            Invite Member
          </Button>
        )}
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={members}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: "No team members found." }}
        />
      </Card>

      <Modal
        open={inviteOpen}
        onCancel={() => { setInviteOpen(false); setInviteEmail(""); }}
        title="Invite Team Member"
        footer={null}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="An invitation email will be sent to the address below. They'll be prompted to create an account or log in."
          />
          <Form layout="vertical" onFinish={() => void sendInvite()}>
            <Form.Item
              label="Email Address"
              required
              rules={[{ required: true, type: "email", message: "Enter a valid email." }]}
            >
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                autoFocus
              />
            </Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => { setInviteOpen(false); setInviteEmail(""); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={inviting} icon={<UserAddOutlined />}>
                Send Invite
              </Button>
            </Space>
          </Form>
        </Space>
      </Modal>
    </Space>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((j: { stats?: UsageStats }) => {
        if (j.stats) setStats(j.stats);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Plan */}
      <Card>
        <Row align="middle" justify="space-between">
          <Col>
            <Space direction="vertical" size={4}>
              <Typography.Title level={5} style={{ margin: 0 }}>
                Current Plan
              </Typography.Title>
              <Space>
                <Tag color="blue" style={{ fontSize: 14, padding: "2px 10px" }}>Free</Tag>
                <Typography.Text type="secondary">
                  Basic access · web chat and voice included
                </Typography.Text>
              </Space>
            </Space>
          </Col>
          <Col>
            <Button type="primary">Upgrade Plan</Button>
          </Col>
        </Row>
      </Card>

      {/* Usage this month */}
      <Card
        title="Usage This Month"
        extra={
          loading ? <Spin size="small" /> : (
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => {
                setLoading(true);
                fetch("/api/dashboard")
                  .then((r) => r.json())
                  .then((j: { stats?: UsageStats }) => { if (j.stats) setStats(j.stats); })
                  .catch(() => null)
                  .finally(() => setLoading(false));
              }}
            />
          )
        }
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Row gutter={24}>
            <Col span={6}>
              <Statistic
                title="Conversations"
                value={stats?.conversations ?? 0}
                suffix="/ ∞"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Messages"
                value={stats?.messages ?? 0}
                suffix="/ ∞"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Team Members"
                value={stats?.users ?? 0}
                suffix="/ ∞"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Avg Call Duration"
                value={stats?.avgDurationMinutes ? stats.avgDurationMinutes.toFixed(1) : "0.0"}
                suffix="min"
              />
            </Col>
          </Row>
        )}
      </Card>

      {/* Features included */}
      <Card title="Plan Features">
        <Space direction="vertical" size={8}>
          {[
            "Unlimited agents",
            "Web chat & voice channels",
            "Agent teams & handoffs",
            "Knowledge base (RAG)",
            "AI Insights extraction",
            "Conversation recordings",
          ].map((f) => (
            <Space key={f}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Typography.Text>{f}</Typography.Text>
            </Space>
          ))}
        </Space>
      </Card>
    </Space>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab({ profile }: { profile: Profile | null }) {
  const { message } = App.useApp();
  const [revealed, setRevealed] = useState(false);

  if (!profile) return <Skeleton active paragraph={{ rows: 4 }} />;

  const mockKey = `sk-${profile.id.replace(/-/g, "").slice(0, 12)}...${profile.orgId.replace(/-/g, "").slice(-8)}`;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Keep your API key secret. Never expose it in client-side code or public repositories."
      />

      <Card title={<Space><KeyOutlined /> API Credentials</Space>}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
              Organization ID
            </Typography.Text>
            <Input
              value={profile.orgId}
              readOnly
              addonAfter={
                <Tooltip title="Copy">
                  <CopyOutlined
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      void navigator.clipboard.writeText(profile.orgId);
                      void message.success("Copied!");
                    }}
                  />
                </Tooltip>
              }
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
              Use as the <code>X-Org-Id</code> header when calling the REST API.
            </Typography.Text>
          </div>

          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 6 }}>
              Secret Key
            </Typography.Text>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={revealed ? mockKey : "sk-●●●●●●●●●●●●●●●●●●●●●●●●"}
                readOnly
                style={{ fontFamily: "monospace" }}
              />
              <Button onClick={() => setRevealed((v) => !v)}>
                {revealed ? "Hide" : "Reveal"}
              </Button>
              <Tooltip title="Copy">
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => {
                    void navigator.clipboard.writeText(mockKey);
                    void message.success("Copied!");
                  }}
                />
              </Tooltip>
            </Space.Compact>
          </div>

          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="User ID">
              <Typography.Text code>{profile.id}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Account Email">{profile.email}</Descriptions.Item>
            <Descriptions.Item label="Role">
              <Tag color={ROLE_COLOR[profile.role]}>{profile.role.toUpperCase()}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>
    </Space>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const j = await res.json() as { profile: Profile };
        setProfile(j.profile);
      }
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const tabItems: TabsProps["items"] = [
    {
      key: "profile",
      label: (
        <Space>
          <UserOutlined />
          Profile
        </Space>
      ),
      children: loadingProfile ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <ProfileTab profile={profile} onRefresh={() => void loadProfile()} />
      ),
    },
    {
      key: "general",
      label: "General",
      children: <GeneralTab onRefresh={() => void loadProfile()} />,
    },
    {
      key: "team",
      label: (
        <Space>
          <TeamOutlined />
          Team
        </Space>
      ),
      children: loadingProfile ? (
        <Skeleton active />
      ) : (
        <TeamTab
          currentUserId={profile?.id ?? ""}
          currentRole={profile?.role ?? "viewer"}
        />
      ),
    },
    {
      key: "billing",
      label: "Billing",
      children: <BillingTab />,
    },
    {
      key: "api-keys",
      label: (
        <Space>
          <KeyOutlined />
          API Keys
        </Space>
      ),
      children: <ApiKeysTab profile={profile} />,
    },
  ];

  return (
    <RoutePageShell
      title="Settings"
      subtitle={
        profile
          ? `${profile.orgName} · ${profile.email}`
          : "Organization, team, billing, and API keys"
      }
    >
      {loadingProfile && !profile ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <Tabs defaultActiveKey="profile" items={tabItems} />
      )}
    </RoutePageShell>
  );
}
