"use client";

import {
  ArrowsAltOutlined,
  AppstoreFilled,
  BarChartOutlined,
  CheckCircleFilled,
  BugOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  FileAddOutlined,
  GoogleOutlined,
  HistoryOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RadarChartOutlined,
  RobotOutlined,
  RocketOutlined,
  SettingOutlined,
  SlackOutlined,
  SwapOutlined,
  TeamOutlined,
  ToolOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { Tiny } from "@ant-design/charts";
import {
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Divider,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Space,
  Typography,
} from "antd";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AntxPlaygroundChat } from "./_components/antx-playground-chat";
import { HomeDashboard } from "./_components/home-dashboard";

type AuthMode = "signup" | "login";
type BuilderRole = "user" | "assistant";

interface BuilderMessage {
  id: string;
  role: BuilderRole;
  content: string;
}

export default HomeDashboard;

interface AuthFormValues {
  email: string;
  password: string;
}

const usageCards = [
  {
    key: "users",
    label: "Users",
    value: 0,
    color: "#3B82F6",
    points: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "conversations",
    label: "Conversations",
    value: 0,
    color: "#F59E0B",
    points: [0, 0, 0, 0, 0, 0, 0],
  },
  {
    key: "messages",
    label: "Messages",
    value: 0,
    color: "#06B6D4",
    points: [0, 0, 0, 0, 0, 0, 0],
  },
];

const channels = [
  {
    key: "whatsapp",
    title: "WhatsApp",
    status: "Not connected",
    icon: <WhatsAppOutlined style={{ color: "#22C55E" }} />,
    action: "Join WhatsApp waitlist",
  },
  {
    key: "voice",
    title: "Voice",
    status: "Not connected",
    icon: <PhoneOutlined style={{ color: "#F97316" }} />,
    action: "Get a Voice Line",
  },
  {
    key: "sms",
    title: "SMS",
    status: "Not connected",
    icon: <MessageOutlined style={{ color: "#FB7185" }} />,
    action: "Join SMS waitlist",
  },
  {
    key: "teams",
    title: "Microsoft Teams",
    status: "Not connected",
    icon: <TeamOutlined style={{ color: "#6366F1" }} />,
    action: "Connect Microsoft Teams",
  },
  {
    key: "slack",
    title: "Slack",
    status: "Not connected",
    icon: <SlackOutlined style={{ color: "#4A154B" }} />,
    action: "Connect Slack",
  },
  {
    key: "email",
    title: "Email",
    status: "Not connected",
    icon: <MailOutlined style={{ color: "#DC2626" }} />,
    action: "Connect Email",
  },
];

const demoAssistantReply =
  "Great! Let's build your support agent. First, what is your product called and what kind of customer issues should this agent handle first?";

const pendingProtectedActionStorageKey = "bo-support.pending-protected-action";
const guestAgentDraftStorageKey = "bo-support.guest-agent-draft-count";
const guestAgentDraftLimit = 1;

const setupProgressBaseItems = [
  { key: "agents", label: "Set up AI Agents" },
  { key: "knowledge", label: "Add Knowledge" },
  { key: "workflows", label: "Create Agentic Workflows" },
  { key: "objects", label: "Setup Business Objects" },
];

const rightRailLinks = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/",
    blackIcon: "Home_1.svg",
    mintIcon: "Home_3.svg",
  },
  {
    key: "agents",
    label: "Agents",
    href: "/agents",
    blackIcon: "Verified_1.svg",
    mintIcon: "Verified_3.svg",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    blackIcon: "Dashboard_1.svg",
    mintIcon: "Dashboard_3.svg",
  },
  {
    key: "conversations",
    label: "Conversations",
    href: "/conversations",
    blackIcon: "Messages-or-Chats_1.svg",
    mintIcon: "Messages-or-Chats_2.svg",
  },
  {
    key: "apps",
    label: "Apps",
    href: "/apps",
    blackIcon: "More_1.svg",
    mintIcon: "More_3.svg",
  },
  {
    key: "voice",
    label: "Voice Lines",
    href: "/phone-numbers",
    blackIcon: "Call_1.svg",
    mintIcon: "Call_3.svg",
  },
  {
    key: "widget",
    label: "Widget",
    href: "/widget",
    blackIcon: "Share_1.svg",
    mintIcon: "Share_3.svg",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    blackIcon: "Settings.svg",
    mintIcon: "Settings_2.svg",
  },
];

export function HomeLegacy() {
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [authForm] = Form.useForm<AuthFormValues>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<BuilderMessage[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticatedEmail, setAuthenticatedEmail] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [guestAgentDraftCount, setGuestAgentDraftCount] = useState(0);

  const chatStarted = messages.length > 0;
  const guestAgentDraftRemaining = Math.max(0, guestAgentDraftLimit - guestAgentDraftCount);
  const playgroundMessages =
    messages.length > 0
      ? messages
      : [
          {
            id: "assistant-default",
            role: "assistant" as const,
            content: "Hello! How can I assist you with your AI support setup today?",
          },
        ];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 18) {
      return "Good afternoon";
    }

    return "Good evening";
  }, []);

  const setupProgressItems = useMemo(
    () =>
      setupProgressBaseItems.map((item, index) => ({
        ...item,
        done: index === 0 ? isAuthenticated || guestAgentDraftCount > 0 : false,
      })),
    [guestAgentDraftCount, isAuthenticated],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedValue = window.localStorage.getItem(guestAgentDraftStorageKey);
    const parsedValue = Number.parseInt(savedValue ?? "0", 10);

    if (!Number.isNaN(parsedValue) && parsedValue > 0) {
      setGuestAgentDraftCount(Math.min(parsedValue, guestAgentDraftLimit));
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(guestAgentDraftStorageKey);

    if (guestAgentDraftCount !== 0) {
      setGuestAgentDraftCount(0);
    }
  }, [guestAgentDraftCount, isAuthenticated]);

  const usageConfigs = useMemo(
    () =>
      usageCards.map((card) => ({
        ...card,
        chart: {
          data: card.points.map((value, index) => ({ index, value })),
          xField: "index",
          yField: "value",
          autoFit: true,
          height: 44,
          color: card.color,
          smooth: true,
          axis: false,
          legend: false,
          tooltip: false,
          point: {
            size: 2,
            shapeField: "circle",
            style: {
              fill: card.color,
            },
          },
          lineStyle: {
            lineWidth: 2,
          },
        },
      })),
    [],
  );

  const bootstrapAccount = useCallback(async () => {
    const response = await fetch("/api/auth/bootstrap", {
      method: "POST",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Failed to initialize your workspace.");
    }
  }, []);

  useEffect(() => {
    if (!supabase || typeof window === "undefined") {
      return;
    }

    let active = true;

    const hydrateSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        message.error(error.message);
        return;
      }

      const sessionUser = data.session?.user ?? null;
      setIsAuthenticated(Boolean(sessionUser));
      setAuthenticatedEmail(sessionUser?.email ?? null);

      if (sessionUser) {
        try {
          await bootstrapAccount();
        } catch (error) {
          message.warning(error instanceof Error ? error.message : "Workspace setup failed.");
        }

        const queuedAction = window.sessionStorage.getItem(
          pendingProtectedActionStorageKey,
        );

        if (queuedAction) {
          message.success(`${queuedAction} started.`);
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
        }
      }
    };

    void hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setIsAuthenticated(Boolean(sessionUser));
      setAuthenticatedEmail(sessionUser?.email ?? null);

      if (sessionUser && typeof window !== "undefined") {
        void bootstrapAccount().catch((error) => {
          message.warning(error instanceof Error ? error.message : "Workspace setup failed.");
        });

        const queuedAction = window.sessionStorage.getItem(pendingProtectedActionStorageKey);
        if (queuedAction) {
          message.success(`${queuedAction} started.`);
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
        }
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [bootstrapAccount, message, supabase]);

  const resolveAuthSuccess = (mode: AuthMode, email: string | null | undefined) => {
    setIsAuthenticated(true);
    setAuthenticatedEmail(email ?? null);
    setAuthOpen(false);
    authForm.resetFields();

    void bootstrapAccount().catch((error) => {
      message.warning(error instanceof Error ? error.message : "Workspace setup failed.");
    });

    if (pendingAction) {
      message.success(`${pendingAction} started.`);
      setPendingAction(null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
      }
      return;
    }

    message.success(
      mode === "signup"
        ? "Account created. You can now save and deploy your agent."
        : "Logged in successfully.",
    );
  };

  const sendMessage = (incomingMessage?: string) => {
    const value = (incomingMessage ?? input).trim();

    if (!value) {
      return;
    }

    const userText = value;
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: userText,
      },
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: demoAssistantReply,
      },
    ]);
  };

  const requestProtectedAction = (actionName: string) => {
    if (!supabase) {
      message.error(
        "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (isAuthenticated) {
      message.success(`${actionName} started.`);
      return;
    }

    setPendingAction(actionName);
    setAuthMode("signup");
    setAuthOpen(true);
    message.info("Create an account to continue.");
  };

  const navigateToProtectedRoute = (route: string, actionName: string) => {
    if (isAuthenticated) {
      void router.push(route);
      return;
    }

    requestProtectedAction(actionName);
  };

  const handleCreateAgent = () => {
    if (isAuthenticated) {
      void router.push("/agents");
      return;
    }

    if (guestAgentDraftCount >= guestAgentDraftLimit) {
      requestProtectedAction("Create another agent");
      return;
    }

    const timestamp = Date.now();

    setMessages((previousMessages) => {
      if (previousMessages.length > 0) {
        return previousMessages;
      }

      return [
        {
          id: `guest-user-${timestamp}`,
          role: "user",
          content: "Create a new AI agent for handling customer support.",
        },
        {
          id: `guest-assistant-${timestamp}`,
          role: "assistant",
          content:
            "Guest draft created. Sign in to save this draft and create additional agents.",
        },
      ];
    });

    const nextCount = Math.min(guestAgentDraftCount + 1, guestAgentDraftLimit);
    setGuestAgentDraftCount(nextCount);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(guestAgentDraftStorageKey, String(nextCount));
    }

    message.success("Guest draft created. Sign in to create additional agents.");
  };

  const handleEmailAuth = async (values: AuthFormValues) => {
    if (!supabase) {
      message.error(
        "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setAuthSubmitting(true);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo:
              typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
          },
        });

        if (error) {
          message.error(error.message);
          return;
        }

        if (data.session) {
          resolveAuthSuccess("signup", data.user?.email ?? values.email);
          return;
        }

        setAuthOpen(false);
        authForm.resetFields();
        setPendingAction(null);
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
        }
        message.success("Check your inbox to confirm your account, then log in.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        message.error(error.message);
        return;
      }

      resolveAuthSuccess("login", data.user?.email ?? values.email);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (!supabase) {
      message.error(
        "Supabase auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (typeof window !== "undefined" && pendingAction) {
      window.sessionStorage.setItem(pendingProtectedActionStorageKey, pendingAction);
    }

    setAuthSubmitting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });

    if (error) {
      setAuthSubmitting(false);
      message.error(error.message);
    }
  };

  const closeAuthModal = () => {
    setAuthOpen(false);
    setPendingAction(null);
    setAuthSubmitting(false);
    authForm.resetFields();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(pendingProtectedActionStorageKey);
    }
  };

  return (
    <div className="platform-root">
      <aside className="icon-rail" aria-label="Primary navigation">
        <div className="icon-rail-top">
          <a className="icon-rail-brand" href="/" aria-label="Botaplace AI" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40 }}>
            <img src="/bota-logo.png" alt="Botaplace AI" style={{ width: 32, height: 32, objectFit: "contain" }} />
          </a>
          <Button
            type="text"
            shape="circle"
            icon={<PlusOutlined />}
            onClick={handleCreateAgent}
            aria-label="Create new item"
          />
          <Button
            type="text"
            shape="circle"
            icon={<HistoryOutlined />}
            href="/conversations"
            aria-label="Recent conversations"
          />
        </div>

        <div className="icon-rail-bottom">
          <Button
            type="text"
            shape="circle"
            icon={<img src="/assets/icons/bota/black/Settings.svg" width={20} height={20} alt="" style={{ display: "block", objectFit: "contain" }} />}
            href="/settings"
            aria-label="Settings"
          />
          <Button
            type="text"
            shape="circle"
            icon={<img src="/assets/icons/bota/black/More_1.svg" width={20} height={20} alt="" style={{ display: "block", objectFit: "contain" }} />}
            href="/apps"
            aria-label="Switch organization"
          />
        </div>
      </aside>

      <section className="builder-panel" aria-label="Agent builder panel">
        <div className="builder-panel-shell-head">
          <Button
            type="text"
            shape="circle"
            icon={<ArrowsAltOutlined />}
            aria-label="Open playground drawer"
            onClick={() => {
              setPlaygroundOpen(true);
            }}
          />
        </div>

        {!chatStarted ? (
          <div className="builder-empty">
            <Image
              src="/assets/illustrations/bota/workspace-hero.svg"
              alt="Botaplace AI workspace illustration"
              width={240}
              height={107}
              priority
            />
            <Typography.Title level={3} className="builder-title">
              {greeting}, Francis
            </Typography.Title>
            <Typography.Paragraph className="builder-subtitle">
              {isAuthenticated
                ? "Just describe what you need — build agents, run agentic workflows, explore insights, and deploy with confidence."
                : "You are currently in guest mode. You can create one draft agent before signing in."}
            </Typography.Paragraph>
            {!isAuthenticated ? (
              <Typography.Text type="secondary">
                Guest drafts remaining: {guestAgentDraftRemaining} of {guestAgentDraftLimit}
              </Typography.Text>
            ) : null}
          </div>
        ) : null}

        <AntxPlaygroundChat
          messages={messages}
          inputValue={input}
          onInputChange={setInput}
          onSubmit={sendMessage}
          showConversations={false}
          showWelcome={false}
          mode="compact"
        />

        {!chatStarted ? (
          <Flex justify="center" wrap gap={8} className="builder-shortcuts">
            <Button shape="round" icon={<ToolOutlined />}>
              Build
            </Button>
            <Button shape="round" icon={<BarChartOutlined />}>
              Analyze
            </Button>
            <Button shape="round" icon={<BugOutlined />}>
              Debug
            </Button>
            <Button shape="round" icon={<RadarChartOutlined />}>
              Monitor
            </Button>
          </Flex>
        ) : null}
      </section>

      <main className="dashboard-panel" aria-label="Dashboard content">
        <div className="dashboard-content">
          <header className="dashboard-header">
            <div>
              <Typography.Title level={4} className="dashboard-title">
                {greeting}, Francis
              </Typography.Title>
              <Typography.Text type="secondary">
                {isAuthenticated
                  ? `Signed in as ${authenticatedEmail ?? "your account"}`
                  : "Sign in to save and deploy your agents"}
              </Typography.Text>
            </div>

            <Space wrap size={12}>
              <Button icon={<RobotOutlined />} onClick={handleCreateAgent}>
                Create agent
              </Button>
              <Button
                icon={<FileAddOutlined />}
                onClick={() => navigateToProtectedRoute("/agents", "Add content")}
              >
                Add content
              </Button>
              <Button
                icon={<DeploymentUnitOutlined />}
                onClick={() => navigateToProtectedRoute("/apps", "Add workflows")}
              >
                Add workflows
              </Button>
              <Button
                icon={<RocketOutlined />}
                onClick={() => requestProtectedAction("Deploy")}
              >
                Deploy
              </Button>
            </Space>
          </header>

          <section className="dashboard-section">
            <Typography.Title level={5}>Setup progress</Typography.Title>
            <Typography.Text type="secondary">
              Complete these essential steps to be production ready.
            </Typography.Text>
            <Card className="resume-card">
              <div className="setup-progress-card">
                <div className="setup-progress-list" role="list" aria-label="Setup progress">
                  {setupProgressItems.map((item) => (
                    <div className="setup-progress-item" key={item.key} role="listitem">
                      <CheckCircleFilled
                        className={`setup-progress-icon ${item.done ? "setup-progress-icon-done" : ""}`}
                      />
                      <Typography.Text>{item.label}</Typography.Text>
                    </div>
                  ))}
                </div>

                <Image
                  src="/assets/illustrations/bota/conversations.svg"
                  alt="Botaplace AI conversations illustration"
                  width={160}
                  height={71}
                />
              </div>
            </Card>
          </section>

          <section className="dashboard-section">
            <div className="section-header-row">
              <div>
                <Typography.Title level={5}>Usage trends</Typography.Title>
                <Typography.Text type="secondary">
                  Data from the last 30 days based on total conversations.
                </Typography.Text>
              </div>

              <Button type="link" href="/analytics">
                View full insights
              </Button>
            </div>

            <div className="usage-grid">
              {usageConfigs.map((card) => (
                <Card key={card.key} className="usage-card">
                  <Typography.Text type="secondary">{card.label}</Typography.Text>
                  <Typography.Title level={2}>{card.value}</Typography.Title>
                  <Tiny.Line {...card.chart} />
                </Card>
              ))}
            </div>
          </section>

          <section className="dashboard-section">
            <Typography.Title level={5}>Connected channels</Typography.Title>
            <Typography.Text type="secondary">0 channels connected</Typography.Text>

            <Card className="channels-card">
              <div className="channels-grid">
                {channels.map((channel) => (
                  <button
                    key={channel.key}
                    className="channel-row"
                    onClick={() => requestProtectedAction(channel.action)}
                    type="button"
                  >
                    <Avatar shape="circle" icon={channel.icon} />
                    <div className="channel-copy">
                      <Typography.Text strong>{channel.title}</Typography.Text>
                      <Typography.Text type="secondary">{channel.status}</Typography.Text>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Button type="link" href="/apps" className="configure-channels-link">
              Configure more channels
            </Button>
          </section>
        </div>
      </main>

      <aside className="right-rail" aria-label="Secondary navigation">
        <div className="right-rail-group">
          {rightRailLinks.map((item) => {
            const isActive = item.href === "/";
            return (
              <Button
                key={item.key}
                type="text"
                shape="circle"
                className={`right-rail-link ${isActive ? "right-rail-link-active" : ""}`}
                icon={
                  <img
                    src={`/assets/icons/bota/${isActive ? "mint" : "black"}/${isActive ? item.mintIcon : item.blackIcon}`}
                    width={20}
                    height={20}
                    alt=""
                    style={{ display: "block", objectFit: "contain" }}
                  />
                }
                href={item.href}
                aria-label={item.label}
              />
            );
          })}
        </div>

        <div className="right-rail-bottom">
          <Button
            type="text"
            shape="circle"
            className="right-rail-link"
            icon={<img src="/assets/icons/bota/black/Help-SUpport-FAQ.svg" width={20} height={20} alt="" style={{ display: "block", objectFit: "contain" }} />}
            aria-label="Help"
          />
          <Avatar size={28} className="right-rail-avatar">
            FA
          </Avatar>
        </div>
      </aside>

      <Drawer
        title="Playground"
        placement="left"
        open={playgroundOpen}
        onClose={() => setPlaygroundOpen(false)}
        size={460}
        className="playground-drawer"
      >
        <AntxPlaygroundChat
          messages={playgroundMessages}
          inputValue={input}
          onInputChange={setInput}
          onSubmit={sendMessage}
        />
      </Drawer>

      <Modal
        open={authOpen}
        onCancel={closeAuthModal}
        footer={null}
        width={480}
        centered
      >
        <div className="auth-modal-head">
          <Avatar
            size={48}
            icon={<AppstoreFilled />}
            style={{ backgroundColor: "#6C5CE7" }}
          />
          <Typography.Title level={4} className="auth-modal-title">
            {authMode === "signup" ? "Create your account" : "Log in to continue"}
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="auth-modal-subtitle">
            Sign up to save your work and deploy agents across all channels.
          </Typography.Paragraph>
        </div>

        <Button
          block
          size="large"
          icon={<GoogleOutlined />}
          loading={authSubmitting}
          onClick={handleGoogleAuth}
        >
          Continue with Google
        </Button>

        <Divider>or</Divider>

        <Form
          form={authForm}
          layout="vertical"
          requiredMark={false}
          onFinish={handleEmailAuth}
        >
          <Form.Item
            name="email"
            rules={[{ required: true, message: "Please enter your work email." }]}
          >
            <Input size="large" placeholder="Work email" autoComplete="email" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "Please enter your password." }]}
          >
            <Input.Password
              size="large"
              placeholder="Password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
          </Form.Item>

          <Button block type="primary" size="large" htmlType="submit" loading={authSubmitting}>
            {authMode === "signup" ? "Create account" : "Log in"}
          </Button>
        </Form>

        <div className="auth-mode-toggle">
          <Typography.Text type="secondary">
            {authMode === "signup"
              ? "Already have an account?"
              : "Need an account?"}
          </Typography.Text>
          <Button
            type="link"
            size="small"
            onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}
          >
            {authMode === "signup" ? "Log in" : "Create account"}
          </Button>
        </div>

        <Typography.Paragraph className="auth-terms" type="secondary">
          By signing up, you agree to our Terms of Service and Privacy Policy.
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
