"use client";

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  MessageOutlined,
  PhoneOutlined,
  RobotOutlined,
  ToolOutlined,
  TeamOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { ThoughtChain } from "@ant-design/x";
import { Button, Drawer, Flex, Segmented, Tag, Typography, notification } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { AntxPlaygroundChat, type AntxPlaygroundMessage } from "./antx-playground-chat";
import { VoiceCallOrb } from "./voice-call-orb";

type TestMode = "chat" | "call";

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:4000";

interface ToolCall {
  name: string;
  status: "loading" | "success" | "error";
  args?: Record<string, unknown>;
}

/** Render a ThoughtChain component for tool calls */
function ToolCallDisplay({ tools }: { tools: ToolCall[] }) {
  if (tools.length === 0) return null;

  const items = tools.map((tool) => ({
    key: tool.name,
    title: tool.name,
    status: tool.status as "loading" | "success" | "error",
    icon:
      tool.status === "loading" ? (
        <LoadingOutlined spin style={{ color: "#1677ff" }} />
      ) : tool.status === "success" ? (
        <CheckCircleOutlined style={{ color: "#52c41a" }} />
      ) : (
        <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
      ),
    description:
      tool.status === "loading"
        ? "Executing..."
        : tool.status === "success"
          ? "Completed"
          : "Failed",
    extra: tool.args && Object.keys(tool.args).length > 0 && (
      <Tag color="blue" style={{ fontSize: 11 }}>
        {Object.keys(tool.args).length} param{Object.keys(tool.args).length > 1 ? "s" : ""}
      </Tag>
    ),
  }));

  return (
    <div style={{ marginBottom: 8 }}>
      <ThoughtChain
        items={items}
        style={{
          background: "linear-gradient(135deg, #f8f9ff 0%, #f0f5ff 100%)",
          borderRadius: 8,
          padding: "8px 12px",
          border: "1px solid #e6f4ff",
        }}
      />
    </div>
  );
}

interface AgentTestDrawerProps {
  agentId: string | null;
  agentName?: string;
  teamId?: string;
  open: boolean;
  onClose: () => void;
}

export function AgentTestDrawer({ agentId, agentName, teamId, open, onClose }: AgentTestDrawerProps) {
  const [mode, setMode] = useState<TestMode>("chat");
  const [messages, setMessages] = useState<AntxPlaygroundMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const [currentAgent, setCurrentAgent] = useState<{ id: string; name: string } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const assistantBufferRef = useRef(""); // Full text from server
  const assistantMsgIdRef = useRef<string | null>(null);
  const connectedRef = useRef(false);
  const greetingReceivedRef = useRef(false);

  // Connect WebSocket when drawer opens in chat mode with a valid agentId
  useEffect(() => {
    if (!open || mode !== "chat" || !agentId) return;

    // Don't reconnect if already connected for the same agent
    if (wsRef.current && connectedRef.current) return;

    let cancelled = false;

    const ws = new WebSocket(`${WS_BASE}/ws?type=text_chat&agentId=${agentId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) { ws.close(); return; }
      console.log("[AgentTest] WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          text?: string;
          content?: string;
          error?: string;
          tool?: string;
          args?: Record<string, unknown>;
          status?: string;
          conversationId?: string;
        };

          if (data.type === "connected") {
          connectedRef.current = true;
          greetingReceivedRef.current = false;
          // Set initial agent
          if (!currentAgent && agentName) {
            setCurrentAgent({ id: agentId!, name: agentName });
          }
          // Show greeting if provided (only if no messages yet to avoid duplicates)
          if (data.content) {
            greetingReceivedRef.current = true;
            setMessages((prev) => {
              // Don't add greeting if messages already exist (reconnect scenario)
              if (prev.length > 0) return prev;
              return [
                {
                  id: `greeting-${Date.now()}`,
                  role: "assistant",
                  content: data.content!,
                },
              ];
            });
          }
          return;
        }

        if (data.type === "text") {
          const text = data.text ?? "";

          // Skip the initial greeting text (backend sends it via both 'connected' and 'text')
          if (greetingReceivedRef.current && !assistantMsgIdRef.current) {
            greetingReceivedRef.current = false;
            return;
          }

          // Accumulate text in buffer and update message
          assistantBufferRef.current += text;

          const msgId = assistantMsgIdRef.current;
          if (msgId) {
            const current = assistantBufferRef.current;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, content: current } : m,
              ),
            );
          }
          return;
        }

        // Stream end signal (when server sends empty or final text)
        if (data.type === "end" || data.type === "turn_complete") {
          const msgId = assistantMsgIdRef.current;
          if (msgId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId ? { ...m, loading: false } : m,
              ),
            );
          }
          setIsStreaming(false);
          return;
        }

        // Agent changed event (team handoff)
        if (data.type === "agent_changed") {
          const newAgentName = (data as { agentName?: string }).agentName || "Specialist";
          const newAgentId = (data as { agentId?: string }).agentId || "";
          setCurrentAgent({ id: newAgentId, name: newAgentName });
          
          // Add system message about the handoff
          setMessages((prev) => [
            ...prev,
            {
              id: `handoff-${Date.now()}`,
              role: "assistant",
              content: `_Transferring you to ${newAgentName}..._`,
            },
          ]);
          
          notification.info({
            message: "Agent Changed",
            description: `You're now speaking with ${newAgentName}`,
            placement: "topRight",
            duration: 3,
          });
          return;
        }

        if (data.type === "tool_action") {
          const toolName = (data.tool ?? "unknown").replace(/^custom_/, "");
          const status = data.status ?? "executing";

          if (status === "executing") {
            // Add tool to current calls
            setCurrentToolCalls((prev) => [
              ...prev,
              { name: toolName, status: "loading", args: data.args },
            ]);
          } else {
            // Update tool status
            setCurrentToolCalls((prev) =>
              prev.map((t) =>
                t.name === toolName
                  ? { ...t, status: status === "completed" ? "success" : "error" }
                  : t,
              ),
            );

            // After completion, embed ThoughtChain into the assistant message
            setTimeout(() => {
              setCurrentToolCalls((prev) => {
                if (prev.length > 0) {
                  const msgId = assistantMsgIdRef.current;
                  if (msgId) {
                    const toolsSnapshot = [...prev];
                    setMessages((msgs) =>
                      msgs.map((m) =>
                        m.id === msgId
                          ? {
                              ...m,
                              content: (
                                <>
                                  <ToolCallDisplay tools={toolsSnapshot} />
                                  {typeof m.content === "string" ? m.content : m.content}
                                </>
                              ),
                            }
                          : m,
                      ),
                    );
                  }
                }
                return [];
              });
            }, 500);
          }
          return;
        }

        if (data.type === "error") {
          const msgId = assistantMsgIdRef.current;
          if (msgId) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, content: `⚠️ ${data.error ?? "Unknown error"}`, loading: false }
                  : m,
              ),
            );
          }
          setIsStreaming(false);
          return;
        }

        if (data.type === "pong") return;
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      console.log("[AgentTest] WebSocket disconnected");
      connectedRef.current = false;
      wsRef.current = null;
      setIsStreaming(false);
    };

    ws.onerror = (err) => {
      console.error("[AgentTest] WebSocket error:", err);
    };

    return () => {
      cancelled = true;
      wsRef.current = null;
      connectedRef.current = false;
      // Only close if already open — avoids "closed before established" in React StrictMode
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
      }
    };
  }, [open, mode, agentId]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !agentId || isStreaming) return;

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "⚠️ Not connected to agent. Try closing and reopening the test drawer.",
          },
        ]);
        return;
      }

      const userMsg: AntxPlaygroundMessage = {
        id: `test-u-${Date.now()}`,
        role: "user",
        content: text,
      };

      const assistantMsgId = `test-a-${Date.now()}`;
      assistantMsgIdRef.current = assistantMsgId;
      assistantBufferRef.current = "";

      const assistantMsg: AntxPlaygroundMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        loading: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsStreaming(true);

      // Send message via WebSocket
      ws.send(JSON.stringify({ type: "message", text }));

      // Auto-clear loading state after a timeout (response streaming handles the real update)
      setTimeout(() => {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId && m.loading
              ? { ...m, loading: false, content: m.content || "No response received." }
              : m,
          ),
        );
      }, 30000);
    },
    [agentId, isStreaming],
  );

  return (
    <Drawer
      title={
        <Flex align="center" gap={10} style={{ width: "100%" }}>
          {teamId ? <TeamOutlined /> : <RobotOutlined />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ whiteSpace: "nowrap", display: "block" }}>
              {teamId ? agentName : (currentAgent?.name || agentName || "Agent")}
            </Typography.Text>
            {teamId && currentAgent && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                <SwapOutlined style={{ marginRight: 4 }} />
                {currentAgent.name}
              </Typography.Text>
            )}
          </div>
          <Segmented
            size="small"
            value={mode}
            onChange={(val) => setMode(val as TestMode)}
            options={[
              { value: "chat", icon: <MessageOutlined />, label: "Chat" },
              { value: "call", icon: <PhoneOutlined />, label: "Call" },
            ]}
            style={{ marginLeft: "auto" }}
          />
          {mode === "chat" && (
            <Button
              size="small"
              onClick={() => {
                setMessages([]);
                setCurrentToolCalls([]);
                assistantMsgIdRef.current = null;
                assistantBufferRef.current = "";
                greetingReceivedRef.current = false;
                // Close WS so useEffect reconnects with a fresh session
                if (wsRef.current) {
                  wsRef.current.close();
                  wsRef.current = null;
                  connectedRef.current = false;
                }
              }}
              disabled={messages.length === 0}
            >
              Clear
            </Button>
          )}
        </Flex>
      }
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      className="playground-drawer"
      destroyOnClose={false}
    >
      {!agentId ? (
        <Flex
          vertical
          align="center"
          justify="center"
          style={{ height: "100%", textAlign: "center", padding: 24 }}
        >
          <RobotOutlined
            style={{ fontSize: 48, color: "var(--platform-text-muted)", marginBottom: 16 }}
          />
          <Typography.Title level={5} style={{ margin: 0 }}>
            No agent selected
          </Typography.Title>
          <Typography.Text type="secondary" style={{ marginTop: 8 }}>
            Select an agent to start testing.
          </Typography.Text>
        </Flex>
      ) : mode === "chat" ? (
        <AntxPlaygroundChat
          messages={messages}
          inputValue={input}
          onInputChange={setInput}
          onSubmit={(text) => void sendMessage(text)}
          loading={isStreaming}
          showConversations={false}
          showWelcome={false}
          mode="compact"
          disableSuggestions
          inputPlaceholder="Type a message to test your agent..."
        />
      ) : (
        <VoiceCallOrb agentId={agentId} agentName={agentName} />
      )}
    </Drawer>
  );
}
