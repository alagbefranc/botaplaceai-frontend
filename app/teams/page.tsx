"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Space,
  Typography,
  Badge,
  Tag,
  Popconfirm,
  Empty,
  Spin,
  Row,
  Col,
  Tooltip,
  App as AntdApp,
  Avatar,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserSwitchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ExperimentOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AgentTeam } from "@/lib/domain/agent-teams";
import { AgentTestDrawer } from "@/app/_components/agent-test-drawer";
import { RoutePageShell } from "@/app/_components/route-page-shell";

const { Title, Text, Paragraph } = Typography;

interface TeamWithCount extends AgentTeam {
  memberCount: number;
}

interface TeamsResponse {
  teams: TeamWithCount[];
  error?: string;
}

const statusMap: Record<string, { color: "success" | "warning" | "default"; text: string }> = {
  active: { color: "success", text: "Active" },
  paused: { color: "warning", text: "Paused" },
  draft: { color: "default", text: "Draft" },
};

export default function TeamsPage() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamWithCount[]>([]);
  const [testTeam, setTestTeam] = useState<{ id: string; name: string } | null>(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/teams", { cache: "no-store" });
      const payload = (await response.json()) as TeamsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load teams.");
      }

      setTeams(payload.teams ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, [message]);

  const createTeam = async () => {
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Team ${teams.length + 1}`,
          status: "draft",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create team.");
      }

      message.success("Team created.");

      if (payload.team?.id) {
        router.push(`/teams/${payload.team.id}`);
        return;
      }

      await loadTeams();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to create team.");
    }
  };

  const toggleStatus = async (team: TeamWithCount) => {
    const nextStatus = team.status === "active" ? "paused" : "active";

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: team.id,
          status: nextStatus,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update status.");
      }

      message.success(`Team ${statusMap[nextStatus].text.toLowerCase()}.`);
      await loadTeams();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to update status.");
    }
  };

  const deleteTeam = async (team: TeamWithCount) => {
    try {
      const response = await fetch(`/api/teams?id=${team.id}`, {
        method: "DELETE",
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete team.");
      }

      message.success("Team deleted.");
      await loadTeams();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to delete team.");
    }
  };

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }: { data: { session: unknown } }) => {
      if (session) {
        setIsAuthenticated(true);
        void loadTeams();
      } else {
        router.push("/login");
      }
    });
  }, [supabase, router, loadTeams]);

  if (!isAuthenticated) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <RoutePageShell
      title="Agent Teams"
      subtitle="Create teams of specialized agents that hand off conversations to each other"
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={createTeam}>
          Create Team
        </Button>
      }
      extraOverlays={
        testTeam && (
          <AgentTestDrawer
            open={!!testTeam}
            onClose={() => setTestTeam(null)}
            agentId={teams.find((t) => t.id === testTeam.id)?.entryAgentId ?? ""}
            agentName={testTeam.name}
            teamId={testTeam.id}
          />
        )
      }
    >
      {/* Teams Grid */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Paragraph>No teams yet</Paragraph>
                <Text type="secondary">
                  Teams let you break complex workflows into specialized agents that hand off to each other.
                </Text>
              </div>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={createTeam}>
              Create Your First Team
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {teams.map((team) => (
            <Col key={team.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                hoverable
                onClick={() => router.push(`/teams/${team.id}`)}
                styles={{
                  body: { padding: 16 },
                }}
                actions={[
                  <Tooltip title="Edit" key="edit">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/teams/${team.id}`);
                      }}
                    />
                  </Tooltip>,
                  team.status === "active" ? (
                    <Tooltip title="Test Team" key="test">
                      <Button
                        type="text"
                        icon={<ExperimentOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTestTeam({ id: team.id, name: team.name });
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Tooltip title={team.status === "paused" ? "Activate" : "Activate"} key="toggle">
                      <Button
                        type="text"
                        icon={<PlayCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleStatus(team);
                        }}
                      />
                    </Tooltip>
                  ),
                  <Popconfirm
                    key="delete"
                    title="Delete this team?"
                    description="This will also remove all handoff rules."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      void deleteTeam(team);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Avatar
                      size={40}
                      style={{ backgroundColor: "#17DEBC", flexShrink: 0 }}
                      icon={<TeamOutlined />}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {team.name}
                      </Text>
                      <Badge status={statusMap[team.status].color} text={statusMap[team.status].text} />
                    </div>
                  </div>
                  {team.description && (
                    <Paragraph
                      type="secondary"
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 0, fontSize: 12 }}
                    >
                      {team.description}
                    </Paragraph>
                  )}
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 11 }}>Agents</Text>}
                    value={team.memberCount}
                    prefix={<RobotOutlined />}
                    valueStyle={{ fontSize: 18 }}
                  />
                  {team.entryAgent && (
                    <div style={{ flex: 1 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Entry Agent</Text>
                      <Tag color="blue" style={{ marginTop: 4 }}>
                        <UserSwitchOutlined style={{ marginRight: 4 }} />
                        {team.entryAgent.name}
                      </Tag>
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </RoutePageShell>
  );
}
