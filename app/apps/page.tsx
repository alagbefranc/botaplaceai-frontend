"use client";

import {
  ApiOutlined,
  CheckCircleFilled,
  EyeOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App as AntdApp,
  Avatar,
  Badge,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";

interface Integration {
  integrationId: string;
  appName: string;
  displayName: string;
  authScheme: string;
  logo: string;
  status: "connected" | "expired" | "pending" | "error" | "not_connected";
  connectedAccountId: string | null;
  connectionCount: number;
}

export default function AppsPage() {
  const { message } = AntdApp.useApp();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingApp, setConnectingApp] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/apps", { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as
        | { integrations?: Integration[]; error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) return;
        throw new Error(payload?.error ?? "Failed to load integrations.");
      }

      setIntegrations(payload?.integrations ?? []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const connectApp = async (integration: Integration) => {
    if (integration.status === "connected") {
      message.info(`${integration.displayName} is already connected.`);
      return;
    }

    setConnectingApp(integration.appName);

    try {
      const res = await fetch("/api/apps/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: integration.integrationId,
          appName: integration.appName,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | { error?: string; redirectUrl?: string }
        | null;

      if (!res.ok) {
        throw new Error(payload?.error ?? "Failed to start connection.");
      }

      const redirectUrl = payload?.redirectUrl;

      if (redirectUrl) {
        const popup = window.open(
          redirectUrl,
          `Connect ${integration.displayName}`,
          "width=520,height=640,scrollbars=yes",
        );

        const pollInterval = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(pollInterval);
            setConnectingApp(null);

            // Re-fetch statuses
            await loadIntegrations();
            message.success(`${integration.displayName} authorization flow completed. Refreshing status...`);
          }
        }, 500);

        // Timeout after 5 min
        setTimeout(() => {
          clearInterval(pollInterval);
          setConnectingApp(null);
        }, 300_000);

        return;
      }

      // No redirect needed (API key auth etc.)
      await loadIntegrations();
      message.success(`${integration.displayName} connected.`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setConnectingApp(null);
    }
  };

  const filtered = search.trim()
    ? integrations.filter((i) =>
        i.displayName.toLowerCase().includes(search.toLowerCase()) ||
        i.appName.toLowerCase().includes(search.toLowerCase()),
      )
    : integrations;

  const connectedCount = integrations.filter((i) => i.status === "connected").length;
  const expiredCount = integrations.filter((i) => i.status === "expired").length;

  return (
    <RoutePageShell
      title="Connected Apps"
      subtitle="Connect tools and services your AI agents can use in conversations"
    >
      {/* Summary bar */}
      <Card size="small">
        <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
          <Space size={16}>
            <Typography.Text strong>
              {integrations.length} integration{integrations.length !== 1 ? "s" : ""}
            </Typography.Text>
            {connectedCount > 0 && (
              <Tag color="success" icon={<CheckCircleFilled />}>
                {connectedCount} connected
              </Tag>
            )}
            {expiredCount > 0 && (
              <Tag color="warning" icon={<ExclamationCircleFilled />}>
                {expiredCount} expired
              </Tag>
            )}
          </Space>

          <Input
            placeholder="Search integrations..."
            prefix={<SearchOutlined />}
            allowClear
            style={{ maxWidth: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Flex>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="apps-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={search ? "No integrations match your search" : "No integrations found on your Composio account"}
          />
        </Card>
      ) : (
        <div className="apps-grid">
          {filtered.map((integration) => (
            <Card key={integration.integrationId} hoverable>
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                {/* Header */}
                <Flex align="center" gap={10}>
                  <Avatar
                    src={integration.logo}
                    size={36}
                    shape="square"
                    style={{ borderRadius: 8, flexShrink: 0 }}
                    icon={<ApiOutlined />}
                  />
                  <div style={{ minWidth: 0 }}>
                    <Typography.Title level={5} style={{ margin: 0 }} ellipsis>
                      {integration.displayName}
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {integration.authScheme === "API_KEY" ? "API Key" : "OAuth 2.0"}
                    </Typography.Text>
                  </div>
                </Flex>

                {/* Status + Action */}
                <Flex justify="space-between" align="center">
                  {integration.status === "connected" ? (
                    <Tag color="success" icon={<CheckCircleFilled />}>Connected</Tag>
                  ) : integration.status === "expired" ? (
                    <Badge status="warning" text={<Typography.Text type="warning" style={{ fontSize: 13 }}>Expired</Typography.Text>} />
                  ) : integration.status === "pending" ? (
                    <Tag color="processing" icon={<LoadingOutlined />}>Pending</Tag>
                  ) : integration.status === "error" ? (
                    <Badge status="error" text="Error" />
                  ) : (
                    <Badge status="default" text={<Typography.Text type="secondary" style={{ fontSize: 13 }}>Not connected</Typography.Text>} />
                  )}

                  <Space size={6}>
                    {integration.status === "connected" && integration.connectedAccountId && (
                      <Link href={`/apps/${integration.connectedAccountId}`}>
                        <Button size="small" icon={<EyeOutlined />}>
                          Details
                        </Button>
                      </Link>
                    )}
                    <Button
                      type={integration.status === "connected" ? "default" : "primary"}
                      size="small"
                      danger={integration.status === "expired"}
                      loading={connectingApp === integration.appName}
                      onClick={() => void connectApp(integration)}
                    >
                      {integration.status === "connected"
                        ? "Manage"
                        : integration.status === "expired"
                          ? "Reconnect"
                          : "Connect"}
                    </Button>
                  </Space>
                </Flex>
              </Space>
            </Card>
          ))}
        </div>
      )}
    </RoutePageShell>
  );
}
