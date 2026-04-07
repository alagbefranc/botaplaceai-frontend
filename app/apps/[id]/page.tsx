"use client";

import {
  ApiOutlined,
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DisconnectOutlined,
  ExclamationCircleFilled,
  LinkOutlined,
  ReloadOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "@/app/_components/route-page-shell";

interface ConnectedAccount {
  id: string;
  status: "ACTIVE" | "INITIATED" | "EXPIRED" | "FAILED" | string;
  toolkit?: { slug: string; name?: string; logo?: string };
  user_id?: string;
  created_at?: string;
  updated_at?: string;
  auth_config?: { id: string; name?: string };
  connection_data?: Record<string, unknown>;
}

const STATUS_CONFIG: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  ACTIVE: {
    color: "success",
    icon: <CheckCircleFilled style={{ color: "#52c41a" }} />,
    label: "Active",
  },
  INITIATED: {
    color: "processing",
    icon: <SyncOutlined spin style={{ color: "#1677ff" }} />,
    label: "Connecting…",
  },
  EXPIRED: {
    color: "warning",
    icon: <ClockCircleOutlined style={{ color: "#faad14" }} />,
    label: "Expired",
  },
  FAILED: {
    color: "error",
    icon: <ExclamationCircleFilled style={{ color: "#ff4d4f" }} />,
    label: "Failed",
  },
};

// Map Composio toolkit slugs to friendly names and which agent tool key they map to
const TOOLKIT_META: Record<string, { label: string; tools: string[]; color: string }> = {
  gmail: {
    label: "Gmail",
    tools: ["Send Email (GMAIL_SEND_EMAIL)", "Fetch Emails (GMAIL_FETCH_EMAILS)"],
    color: "#EA4335",
  },
  googlecalendar: {
    label: "Google Calendar",
    tools: [
      "Create Event (GOOGLECALENDAR_CREATE_EVENT)",
      "Find Free Slots (GOOGLECALENDAR_FIND_FREE_SLOTS)",
      "List Events (GOOGLECALENDAR_EVENTS_LIST)",
    ],
    color: "#4285F4",
  },
  googlesheets: {
    label: "Google Sheets",
    tools: ["Lookup Data (SHEETS_LOOKUP)", "Append Row (SHEETS_APPEND_ROW)"],
    color: "#0F9D58",
  },
  slack: { label: "Slack", tools: ["Send Message (SLACK_SEND_MESSAGE)"], color: "#4A154B" },
  hubspot: {
    label: "HubSpot",
    tools: [
      "Create Contact (HUBSPOT_CREATE_CONTACT)",
      "Search Contacts (HUBSPOT_SEARCH_CONTACTS)",
      "Log Activity (HUBSPOT_LOG_ACTIVITY)",
    ],
    color: "#FF7A59",
  },
  jira: {
    label: "Jira",
    tools: ["Create Issue (JIRA_CREATE_ISSUE)", "Search Issues (JIRA_SEARCH_ISSUES)"],
    color: "#0052CC",
  },
  notion: { label: "Notion", tools: ["Create Page (NOTION_CREATE_PAGE)"], color: "#000000" },
  calendly: {
    label: "Calendly",
    tools: ["Get Availability (CALENDLY_GET_AVAILABILITY)", "Create Invite (CALENDLY_CREATE_INVITE)"],
    color: "#006BFF",
  },
  cal: {
    label: "Cal.com",
    tools: ["Get Availability", "Create Booking"],
    color: "#292929",
  },
  stripe: {
    label: "Stripe",
    tools: [
      "Create Charge (STRIPE_CREATE_CHARGE)",
      "Lookup Payment (STRIPE_LOOKUP_PAYMENT)",
      "Create Refund (STRIPE_CREATE_REFUND)",
    ],
    color: "#6772E5",
  },
  microsoft_teams: {
    label: "Microsoft Teams",
    tools: ["Send Message", "Create Meeting"],
    color: "#6264A7",
  },
  freshservice: { label: "Freshservice", tools: ["Create Ticket", "Update Ticket"], color: "#25C16F" },
  freshdesk: { label: "Freshdesk", tools: ["Create Ticket", "Update Ticket"], color: "#25C16F" },
  outlook: {
    label: "Outlook",
    tools: ["Send Email", "Read Emails"],
    color: "#0078D4",
  },
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ConnectedAppDetailPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const accountId = typeof params.id === "string" ? params.id : "";

  const [account, setAccount] = useState<ConnectedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/apps/${accountId}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to load connection details.");
      }
      const data = (await res.json()) as ConnectedAccount;
      setAccount(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load connection.");
    } finally {
      setLoading(false);
    }
  }, [accountId, message]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAccount();
    setRefreshing(false);
    message.success("Refreshed.");
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/apps/${accountId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to disconnect.");
      }
      message.success("App disconnected successfully.");
      router.push("/apps");
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  };

  const slug = account?.toolkit?.slug ?? "";
  const meta = TOOLKIT_META[slug];
  const statusCfg = STATUS_CONFIG[account?.status ?? ""] ?? {
    color: "default",
    icon: null,
    label: account?.status ?? "Unknown",
  };

  return (
    <RoutePageShell
      title={meta?.label ?? slug ?? "Connected App"}
      subtitle="View connection details and enabled tools"
      actions={
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/apps")}>
            Back to Apps
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void handleRefresh()}
            loading={refreshing}
          >
            Refresh
          </Button>
          <Popconfirm
            title="Disconnect this app?"
            description="This will remove the connection. Your AI agents will no longer be able to use this tool."
            onConfirm={() => void handleDisconnect()}
            okText="Disconnect"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
          >
            <Button danger icon={<DisconnectOutlined />} loading={disconnecting}>
              Disconnect
            </Button>
          </Popconfirm>
        </Space>
      }
    >
      {loading ? (
        <Card>
          <Space>
            <Spin size="small" />
            <Typography.Text>Loading connection details…</Typography.Text>
          </Space>
        </Card>
      ) : !account ? (
        <Card>
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">Connection not found.</Typography.Text>
            <Button onClick={() => void loadAccount()}>Retry</Button>
          </Space>
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Status Banner */}
          <Card
            style={{
              background:
                account.status === "ACTIVE"
                  ? "linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)"
                  : account.status === "EXPIRED"
                    ? "linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)"
                    : account.status === "INITIATED"
                      ? "linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)"
                      : "linear-gradient(135deg, #fff1f0 0%, #ffd6d6 100%)",
              border: "none",
            }}
          >
            <Row align="middle" gutter={16}>
              <Col>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: meta?.color ?? "#6C5CE7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {(meta?.label ?? slug).slice(0, 1).toUpperCase()}
                </div>
              </Col>
              <Col flex={1}>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {meta?.label ?? slug}
                </Typography.Title>
                <Space size={8} style={{ marginTop: 4 }}>
                  {statusCfg.icon}
                  <Typography.Text strong style={{ color: account.status === "ACTIVE" ? "#52c41a" : undefined }}>
                    {statusCfg.label}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    ID: {account.id}
                  </Typography.Text>
                </Space>
              </Col>
              <Col>
                <Badge
                  status={statusCfg.color as "success" | "processing" | "warning" | "error" | "default"}
                  text={<Typography.Text strong>{statusCfg.label}</Typography.Text>}
                />
              </Col>
            </Row>
          </Card>

          {/* Details */}
          <Card title="Connection Details">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Connection ID">
                <Typography.Text code copyable style={{ fontSize: 12 }}>
                  {account.id}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusCfg.color as string}>{statusCfg.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="App">
                <Space size={4}>
                  <LinkOutlined />
                  {meta?.label ?? slug}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Toolkit Slug">
                <Typography.Text code>{slug || "—"}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Auth Config ID">
                <Typography.Text code style={{ fontSize: 12 }}>
                  {account.auth_config?.id ?? "—"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Org / User ID">
                <Typography.Text code style={{ fontSize: 12 }}>
                  {account.user_id ?? "—"}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Connected">
                {formatDate(account.created_at)}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {formatDate(account.updated_at)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Enabled Tools */}
          <Card
            title={
              <Space>
                <ApiOutlined />
                <span>Enabled Tools</span>
                <Tag>{meta?.tools.length ?? 0}</Tag>
              </Space>
            }
          >
            {meta?.tools && meta.tools.length > 0 ? (
              <Space direction="vertical" size={0} style={{ width: "100%" }}>
                {meta.tools.map((tool, idx) => (
                  <div
                    key={tool}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom:
                        idx < meta.tools.length - 1 ? "1px solid #f0f0f0" : "none",
                    }}
                  >
                    <Space size={8}>
                      <CheckCircleFilled style={{ color: "#52c41a", fontSize: 14 }} />
                      <Typography.Text style={{ fontSize: 13 }}>{tool}</Typography.Text>
                    </Space>
                    <Tag color="green" style={{ margin: 0 }}>
                      Active
                    </Tag>
                  </div>
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                No tools defined for this app yet.
              </Typography.Text>
            )}
          </Card>

          {/* How it works */}
          <Card title="How This Connection Works">
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Typography.Text>
                When your AI agent needs to use <strong>{meta?.label ?? slug}</strong> during a
                conversation, it will automatically use this connection to execute the action on
                behalf of your organization.
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                To make this available to an agent, go to{" "}
                <Typography.Link href="/agents">Agents</Typography.Link>, open the agent, and
                add <strong>{meta?.label ?? slug}</strong> to its Tools list. The agent will then
                be able to call the tools listed above during voice and chat conversations.
              </Typography.Text>
            </Space>
          </Card>
        </Space>
      )}
    </RoutePageShell>
  );
}
