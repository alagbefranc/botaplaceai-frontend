"use client";

import { 
  ArrowsAltOutlined, 
  LogoutOutlined, 
  PlusOutlined, 
  SettingOutlined, 
  UserOutlined,
  AppstoreFilled,
  RobotFilled,
  PhoneFilled,
  BulbFilled,
  ExperimentFilled,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Dropdown, Flex, Space, Tooltip, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AntxPlaygroundChat, type AntxPlaygroundMessage } from "./antx-playground-chat";
import { AgentCopilot } from "./agent-copilot";
import Image from "next/image";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface RoutePageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** When provided, replaces the default builder panel section entirely */
  builderPanel?: ReactNode;
  /** When provided, renders modals/drawers outside the layout */
  extraOverlays?: ReactNode;
  /**
   * When true, children are rendered directly inside route-main WITHOUT
   * the route-main-content wrapper or the auto-generated header.
   * Use for pages (like the dashboard) that manage their own inner layout.
   */
  nativeContent?: boolean;
  /**
   * When true, hides the builder panel (copilot) entirely and expands main content.
   * The layout switches to a 3-column grid without the builder panel.
   */
  hideBuilderPanel?: boolean;
}

const rightRailLinks: Array<{
  key: string;
  label: string;
  href: string;
  blackIcon?: string;
  mintIcon?: string;
  antIcon?: React.ReactNode;
  antIconActive?: React.ReactNode;
}> = [
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
    antIcon: <RobotFilled style={{ fontSize: 20, color: "#1E293B" }} />,
    antIconActive: <RobotFilled style={{ fontSize: 20, color: "#17DEBC" }} />,
  },
  {
    key: "teams",
    label: "Agent Teams",
    href: "/teams",
    blackIcon: "Community_1.svg",
    mintIcon: "Community_3.svg",
  },
  {
    key: "analytics",
    label: "Analytics",
    href: "/analytics",
    blackIcon: "Dashboard_1.svg",
    mintIcon: "Dashboard_3.svg",
  },
  {
    key: "insights",
    label: "AI Insights",
    href: "/insights",
    antIcon: <BulbFilled style={{ fontSize: 20, color: "#1E293B" }} />,
    antIconActive: <BulbFilled style={{ fontSize: 20, color: "#17DEBC" }} />,
  },
  {
    key: "evals",
    label: "Agent Testing",
    href: "/evals",
    antIcon: <ExperimentFilled style={{ fontSize: 20, color: "#1E293B" }} />,
    antIconActive: <ExperimentFilled style={{ fontSize: 20, color: "#17DEBC" }} />,
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
    antIcon: <AppstoreFilled style={{ fontSize: 20, color: "#1E293B" }} />,
    antIconActive: <AppstoreFilled style={{ fontSize: 20, color: "#17DEBC" }} />,
  },
  {
    key: "live-calls",
    label: "Live Calls",
    href: "/live-calls",
    antIcon: <PhoneFilled style={{ fontSize: 20, color: "#1E293B" }} />,
    antIconActive: <PhoneFilled style={{ fontSize: 20, color: "#17DEBC" }} />,
  },
  {
    key: "messages",
    label: "Messages",
    href: "/messages",
    blackIcon: "Mail_1.svg",
    mintIcon: "Mail_3.svg",
  },
  {
    key: "voice",
    label: "Numbers",
    href: "/phone-numbers",
    blackIcon: "Call_1.svg",
    mintIcon: "Call_3.svg",
  },
  {
    key: "knowledge",
    label: "Knowledge Base",
    href: "/knowledge-base",
    blackIcon: "Cards_1.svg",
    mintIcon: "Cards_3.svg",
  },
  {
    key: "contacts",
    label: "Contacts",
    href: "/contacts",
    blackIcon: "Profile_1.svg",
    mintIcon: "Profile_3.svg",
  },
  {
    key: "missions",
    label: "Missions",
    href: "/missions",
    blackIcon: "Send-Point_1.svg",
    mintIcon: "Send-Point_3.svg",
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

const initialPlaygroundMessages: AntxPlaygroundMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    content: "Hello! How can I assist you with your AI support setup today?",
  },
];

const playgroundStorageKey = "bo-support.playground-chat";
const maxPersistedMessages = 60;

interface PersistedPlaygroundMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function isPersistedMessage(value: unknown): value is PersistedPlaygroundMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedPlaygroundMessage>;
  return (
    typeof candidate.id === "string" &&
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.content === "string"
  );
}

export function RoutePageShell({
  title,
  subtitle,
  actions,
  children,
  builderPanel,
  extraOverlays,
  nativeContent = false,
  hideBuilderPanel = false,
}: RoutePageShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundMessages, setPlaygroundMessages] = useState(initialPlaygroundMessages);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const playgroundMessagesRef = useRef(playgroundMessages);

  useEffect(() => {
    playgroundMessagesRef.current = playgroundMessages;
  }, [playgroundMessages]);

  // Check auth state to conditionally show sidebars
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(Boolean(data.user));
      setUserEmail(data.user?.email ?? null);
    };
    void check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      setUserEmail(session?.user?.email ?? null);
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem(playgroundStorageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const hydrated = parsed.filter(isPersistedMessage).slice(-maxPersistedMessages);
      if (hydrated.length > 0) {
        setPlaygroundMessages(hydrated);
      }
    } catch {
      // Ignore malformed persisted messages
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persistable = playgroundMessages
      .filter((item) => typeof item.content === "string")
      .map((item) => ({
        id: item.id,
        role: item.role,
        content: item.content as string,
      }))
      .slice(-maxPersistedMessages);

    window.localStorage.setItem(playgroundStorageKey, JSON.stringify(persistable));
  }, [playgroundMessages]);

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

  const submitPlaygroundMessage = async (incomingMessage?: string) => {
    const value = (incomingMessage ?? playgroundInput).trim();

    if (!value) {
      return;
    }

    const timestamp = Date.now();

    const assistantMessageId = `assistant-${timestamp}`;

    setPlaygroundMessages((previous) => [
      ...previous,
      {
        id: `user-${timestamp}`,
        role: "user",
        content: value,
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "Thinking...",
        loading: true,
      },
    ]);

    setPlaygroundInput("");

    const conversationHistory = playgroundMessagesRef.current
      .filter((item) => typeof item.content === "string")
      .map((item) => ({
        role: item.role,
        content: item.content as string,
      }));

    setPlaygroundLoading(true);

    try {
      const response = await fetch("/api/builder/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: "user", content: value }],
          agentConfig: {
            name: "Workspace Agent",
            systemPrompt: "You are a helpful AI assistant for building and operating customer support agents.",
            voice: "Puck",
            tools: [],
            channels: ["web_chat"],
            greeting: "Hi! How can I help you today?",
            liveApi: {},
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Failed to get AI response (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let pending = "";

      const applyPartial = (nextText: string) => {
        fullText += nextText;
        setPlaygroundMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: fullText,
                  loading: false,
                }
              : message
          )
        );
      };

      const consumeSseDataLine = (rawLine: string) => {
        const line = rawLine.trim();

        if (!line.startsWith("data:")) {
          return;
        }

        const data = line.slice(5).trimStart();

        if (!data || data === "[DONE]") {
          return;
        }

        const parsed = JSON.parse(data) as { text?: string; error?: string };

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        if (parsed.text) {
          applyPartial(parsed.text);
        }
      };

      while (true) {
        const { done, value: chunk } = await reader.read();

        if (chunk) {
          pending += decoder.decode(chunk, { stream: !done });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";

          for (const line of lines) {
            consumeSseDataLine(line);
          }
        }

        if (done) {
          if (pending.trim()) {
            consumeSseDataLine(pending);
          }
          break;
        }
      }

      if (!fullText.trim()) {
        setPlaygroundMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  loading: false,
                  content: "I am ready. Tell me what kind of agent you want to build next.",
                }
              : message
          )
        );
      }
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Something went wrong";
      setPlaygroundMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                loading: false,
                content: `I hit a temporary issue, but I can still guide you. Technical detail: ${fallback}`,
              }
            : message
        )
      );
    } finally {
      setPlaygroundLoading(false);
    }
  };

  return (
    <div className={`platform-root ${hideBuilderPanel ? 'platform-root--no-builder' : ''}${!isAuthenticated ? ' platform-root--guest' : ''}`}>
      {isAuthenticated && <aside className="icon-rail" aria-label="Primary navigation">
        <div className="icon-rail-top">
          <a className="icon-rail-brand" href="/" aria-label="Dashboard home" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40 }}>
            <img src="/bota-logo.png" alt="Botaplace AI" style={{ width: 32, height: 32, objectFit: "contain" }} />
          </a>
          <Button
            type="text"
            shape="circle"
            icon={<PlusOutlined />}
            href="/agents"
            aria-label="Agents"
          />
          <Button
            type="text"
            shape="circle"
            icon={<img src="/assets/icons/bota/black/Messages-or-Chats_1.svg" width={20} height={20} alt="" style={{ display: "block", objectFit: "contain" }} />}
            href="/conversations"
            aria-label="Conversations"
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
            aria-label="Connected apps"
          />
        </div>
      </aside>}

      {!hideBuilderPanel && (
        <section className="builder-panel" aria-label="AI Copilot panel">
          {builderPanel ?? (
            <AgentCopilot 
              compact 
              onExpand={() => setPlaygroundOpen(true)}
            />
          )}
        </section>
      )}

      <main className="route-main">
        {nativeContent ? (
          // Dashboard / custom pages: render children directly, no wrapper, no auto-header
          children
        ) : (
          <div className="route-main-content">
            <header className="route-main-header">
              <div>
                <Typography.Title level={3} style={{ marginBottom: 4 }}>
                  {title}
                </Typography.Title>
                {subtitle ? (
                  <Typography.Text type="secondary">{subtitle}</Typography.Text>
                ) : null}
              </div>
              {actions ? <Space wrap>{actions}</Space> : null}
            </header>

            {children}
          </div>
        )}
      </main>

      {isAuthenticated && (
        <aside className="right-rail" aria-label="Secondary navigation">
          <div className="right-rail-group">
            {rightRailLinks.map((item) => {
              const isActive = pathname === item.href;
              // Use Ant Design icon if available, otherwise use SVG
              const iconElement = item.antIcon ? (
                isActive ? item.antIconActive : item.antIcon
              ) : (
                <img
                  src={`/assets/icons/bota/${isActive ? "mint" : "black"}/${isActive ? item.mintIcon : item.blackIcon}`}
                  width={20}
                  height={20}
                  alt=""
                  style={{ display: "block", objectFit: "contain" }}
                />
              );
              return (
                <Tooltip key={item.key} title={item.label} placement="left">
                  <Button
                    type="text"
                    shape="circle"
                    className={`right-rail-link ${isActive ? "right-rail-link-active" : ""}`}
                    icon={iconElement}
                    href={item.href}
                    aria-label={item.label}
                  />
                </Tooltip>
              );
            })}
          </div>

          <div className="right-rail-bottom">
            <Tooltip title="Help" placement="left">
              <Button type="text" shape="circle" className="right-rail-link" icon={<img src="/assets/icons/bota/black/Help-SUpport-FAQ.svg" width={20} height={20} alt="" style={{ display: "block", objectFit: "contain" }} />} aria-label="Help" />
            </Tooltip>
            <Dropdown
              placement="topRight"
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "email",
                    label: userEmail ?? "Account",
                    disabled: true,
                    style: { fontSize: 12, color: "#64748B" },
                  },
                  { type: "divider" },
                  {
                    key: "profile",
                    icon: <UserOutlined />,
                    label: "Profile",
                    onClick: () => router.push("/settings"),
                  },
                  {
                    key: "settings",
                    icon: <SettingOutlined />,
                    label: "Settings",
                    onClick: () => router.push("/settings"),
                  },
                  { type: "divider" },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "Log out",
                    danger: true,
                    onClick: async () => {
                      const sb = getSupabaseBrowserClient();
                      if (sb) {
                        await sb.auth.signOut();
                      }
                      document.cookie = "bo-onboarding-done=; path=/; max-age=0";
                      router.push("/auth/login");
                    },
                  },
                ],
              }}
            >
              <Avatar size={28} className="right-rail-avatar" style={{ cursor: "pointer" }}>
                {userEmail ? userEmail.slice(0, 2).toUpperCase() : "??"}
              </Avatar>
            </Dropdown>
          </div>
        </aside>
      )}

      {/* Default drawer — only shown when no custom builderPanel is injected */}
      {!builderPanel && (
        <Drawer
          title="AI Workspace Copilot"
          placement="left"
          open={playgroundOpen}
          onClose={() => setPlaygroundOpen(false)}
          size="large"
          className="playground-drawer"
        >
          <AgentCopilot />
        </Drawer>
      )}

      {/* Extra overlays (modals, drawers) injected by page — e.g. auth modal */}
      {extraOverlays}
    </div>
  );
}
