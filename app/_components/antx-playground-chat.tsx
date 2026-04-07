"use client";

import {
  MessageOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Actions,
  Bubble,
  CodeHighlighter,
  Conversations,
  Prompts,
  Sender,
  Suggestion,
  Welcome,
} from "@ant-design/x";
import { Avatar, Flex, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

// Typewriter component that reveals text character by character
function TypewriterText({ text, isLoading }: { text: string; isLoading?: boolean }) {
  const [displayedText, setDisplayedText] = useState("");
  const indexRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const prevTextRef = useRef("");

  useEffect(() => {
    // If text changed (new content arrived), continue from where we are
    if (text !== prevTextRef.current) {
      prevTextRef.current = text;
    }

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastTimeRef.current;
      
      // 30ms per character = ~33 chars/second
      if (elapsed >= 30 && indexRef.current < text.length) {
        indexRef.current++;
        setDisplayedText(text.slice(0, indexRef.current));
        lastTimeRef.current = timestamp;
      }

      // Continue animating if there's more to reveal
      if (indexRef.current < text.length) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    // Start animation if not already running and there's text to reveal
    if (!animationRef.current && indexRef.current < text.length) {
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [text]);

  // Reset when text is cleared (new message)
  useEffect(() => {
    if (text === "") {
      indexRef.current = 0;
      setDisplayedText("");
    }
  }, [text]);

  return (
    <span>
      {displayedText}
      {isLoading && indexRef.current >= text.length && (
        <span className="typing-cursor" style={{ 
          display: "inline-block",
          width: 2,
          height: "1em",
          backgroundColor: "#1677ff",
          marginLeft: 2,
          animation: "blink 1s infinite"
        }} />
      )}
    </span>
  );
}
export interface AntxPlaygroundMessage {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
  loading?: boolean;
}

interface AntxPlaygroundChatProps {
  messages: AntxPlaygroundMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: (message: string) => void;
  loading?: boolean;
  showConversations?: boolean;
  showWelcome?: boolean;
  mode?: "full" | "compact";
  inputPlaceholder?: string;
  /** Optional quick-action buttons rendered above the input field */
  quickActions?: React.ReactNode;
  /** When true, disables the command suggestion feature (fixes space key issues) */
  disableSuggestions?: boolean;
  /** Avatar for assistant messages - can be URL string or React node */
  assistantAvatar?: React.ReactNode | string;
  /** Avatar for user messages - can be URL string or React node */
  userAvatar?: React.ReactNode | string;
  /** Assistant name for the bubble header */
  assistantName?: string;
}

const commandSuggestions = [
  { label: "Create escalation workflow", value: "Create escalation workflow" },
  { label: "Draft onboarding prompt", value: "Draft onboarding prompt" },
  { label: "Configure WhatsApp channel", value: "Configure WhatsApp channel" },
];

const promptItems = [
  {
    key: "build-agent",
    icon: "🛠️",
    label: "Build an AI support agent",
    description: "Create a support workflow with escalation rules.",
  },
  {
    key: "connect-channels",
    icon: "🔌",
    label: "Connect channels",
    description: "Set up WhatsApp, voice, and email handoff.",
  },
  {
    key: "improve-prompts",
    icon: "✨",
    label: "Improve prompts",
    description: "Refine assistant tone and fallback responses.",
  },
];


export function AntxPlaygroundChat({
  messages,
  inputValue,
  onInputChange,
  onSubmit,
  loading = false,
  showConversations = true,
  showWelcome = true,
  mode = "full",
  inputPlaceholder = 'Type "/" for commands, or ask anything...',
  quickActions,
  disableSuggestions = false,
  assistantAvatar,
  userAvatar,
  assistantName,
}: AntxPlaygroundChatProps) {
  const [activeConversation, setActiveConversation] = useState<string>("workspace");
  const [isMounted, setIsMounted] = useState(false);
  const compactMode = mode === "compact";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const bubbleItems = useMemo(
    () =>
      messages.map((message) => {
        // For assistant messages, use TypewriterText for animation
        const content = 
          message.role === "assistant" && typeof message.content === "string"
            ? <TypewriterText text={message.content} isLoading={message.loading} key={message.id} />
            : message.content;
        
        return {
          key: message.id,
          role: message.role,
          content,
          // Show loading when assistant has no content yet
          loading: message.role === "assistant" && message.loading && !message.content,
        };
      }),
    [messages],
  );

  const hasMessages = bubbleItems.length > 0;

  const handleSubmit = (message: string) => {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    onSubmit(trimmed);
  };

  const safeContentToString = (content: unknown): string => {
    if (typeof content === "string") return content;
    if (content == null) return "";
    if (typeof content === "object") return "";
    try {
      return String(content);
    } catch {
      return "";
    }
  };

  const renderBubbleContent = (content: unknown) => {
    if (content && typeof content === "object") {
      return content as React.ReactNode;
    }

    const text = safeContentToString(content);
    const codeMatch = text.match(/```(\w+)?\n([\s\S]*?)```/);

    if (codeMatch) {
      return <CodeHighlighter lang={codeMatch[1] ?? "tsx"}>{codeMatch[2]}</CodeHighlighter>;
    }

    // Render simple markdown: bold, italic, inline code, line breaks
    const renderMarkdown = (raw: string) => {
      const parts: React.ReactNode[] = [];
      // Split into lines for list handling
      const lines = raw.split("\n");
      lines.forEach((line, li) => {
        // Numbered list items
        const listMatch = line.match(/^(\d+)\.\s+(.*)/);
        const bulletMatch = line.match(/^[-*]\s+(.*)/);
        let processedLine = listMatch ? listMatch[2] : bulletMatch ? bulletMatch[1] : line;

        // Bold + italic
        processedLine = processedLine
          .replace(/\*\*\*(.+?)\*\*\*/g, "<bi>$1</bi>")
          .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
          .replace(/\*(.+?)\*/g, "<i>$1</i>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");

        const fragments: React.ReactNode[] = [];
        const tagRegex = /<(b|i|bi|code)>(.*?)<\/\1>/g;
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        while ((match = tagRegex.exec(processedLine)) !== null) {
          if (match.index > lastIdx) {
            fragments.push(processedLine.slice(lastIdx, match.index));
          }
          const tag = match[1];
          const inner = match[2];
          if (tag === "b" || tag === "bi") fragments.push(<strong key={`${li}-${match.index}`}>{inner}</strong>);
          else if (tag === "i") fragments.push(<em key={`${li}-${match.index}`}>{inner}</em>);
          else if (tag === "code") fragments.push(<code key={`${li}-${match.index}`} style={{ background: "#f0f0f0", padding: "1px 4px", borderRadius: 3, fontSize: 13 }}>{inner}</code>);
          lastIdx = match.index + match[0].length;
        }
        if (lastIdx < processedLine.length) {
          fragments.push(processedLine.slice(lastIdx));
        }

        if (listMatch) {
          parts.push(<div key={li} style={{ paddingLeft: 8, marginBottom: 2 }}>{listMatch[1]}. {fragments}</div>);
        } else if (bulletMatch) {
          parts.push(<div key={li} style={{ paddingLeft: 8, marginBottom: 2 }}>&bull; {fragments}</div>);
        } else {
          if (li > 0) parts.push(<br key={`br-${li}`} />);
          parts.push(<span key={li}>{fragments}</span>);
        }
      });
      return <>{parts}</>;
    };

    return <div style={{ lineHeight: 1.6 }}>{renderMarkdown(text)}</div>;
  };

  return (
    <Flex vertical className={`antx-playground-chat${compactMode ? " antx-playground-chat-compact" : ""}`}>
      {showConversations && !compactMode ? (
        <Conversations
          items={[
            {
              key: "workspace",
              label: "Workspace chat",
              group: "Today",
              icon: <MessageOutlined />,
            },
          ]}
          activeKey={activeConversation}
          onActiveChange={(key) => setActiveConversation(key)}
          creation={{ label: "New chat" }}
          groupable
        />
      ) : null}

      {!hasMessages && showWelcome ? (
        <Welcome
          icon={<RobotOutlined />}
          title="AI Playground"
          description="Use prompts to start building your agent workflows."
          extra={
            <Prompts
              items={promptItems}
              wrap
              onItemClick={({ data }) => {
                const promptLabel = typeof data.label === "string" ? data.label : "";

                if (promptLabel) {
                  onInputChange(promptLabel);
                }
              }}
            />
          }
        />
      ) : (
        <Bubble.List
          items={bubbleItems}
          autoScroll
          className="antx-bubble-list"
          role={{
            assistant: {
              placement: "start",
              variant: "borderless", // No background box - clean natural look
              typing: { effect: "typing", step: 3, interval: 20 }, // Smooth typewriter
              contentRender: renderBubbleContent,
              avatar: assistantAvatar ? (
                typeof assistantAvatar === "string" ? (
                  <Avatar src={assistantAvatar} size={36} style={{ background: "transparent" }} />
                ) : assistantAvatar
              ) : (
                <Avatar 
                  size={36} 
                  src="/assets/avatars/bota-copilot-avatar.png"
                  style={{ background: "transparent" }}
                />
              ),
              header: assistantName || "AI Assistant",
              footer: (content) => {
                // Only render client-side — Actions generates dynamic CSS-in-JS
                // class names that differ between SSR and client, causing hydration mismatch
                if (!isMounted) return null;
                const text = safeContentToString(content);
                return (
                  <Actions
                    items={[
                      {
                        key: "copy",
                        label: "Copy",
                        actionRender: () => <Actions.Copy text={text} />,
                      },
                      {
                        key: "read",
                        label: "Read",
                        actionRender: () => <Actions.Audio />,
                      },
                    ]}
                  />
                );
              },
            },
            user: {
              placement: "end",
              variant: "filled",
              avatar: userAvatar ? (
                typeof userAvatar === "string" ? (
                  <Avatar src={userAvatar} size={36} />
                ) : userAvatar
              ) : (
                <Avatar 
                  size={36} 
                  icon={<UserOutlined />} 
                  style={{ background: "#1677ff", color: "#fff" }} 
                />
              ),
            },
          }}
        />
      )}

      <div className="antx-sender-wrapper">
        {quickActions ? (
          <div className="antx-quick-actions">{quickActions}</div>
        ) : null}
        {disableSuggestions ? (
          <Sender
            value={inputValue}
            loading={loading}
            allowSpeech={isMounted}
            autoSize={compactMode
              ? { minRows: 1, maxRows: 3 }
              : { minRows: 2, maxRows: 6 }
            }
            placeholder={inputPlaceholder}
            onChange={(nextValue) => onInputChange(nextValue)}
            onSubmit={handleSubmit}
          />
        ) : (
          <Suggestion items={commandSuggestions} onSelect={(value) => onInputChange(value)}>
            {({ onTrigger, onKeyDown }) => (
              <Sender
                value={inputValue}
                loading={loading}
                allowSpeech={isMounted}
                autoSize={compactMode
                  ? { minRows: 1, maxRows: 3 }
                  : { minRows: 2, maxRows: 6 }
                }
                placeholder={inputPlaceholder}
                onKeyDown={(e) => {
                  // Only forward to Suggestion handler when / command is active
                  if (inputValue.startsWith("/")) {
                    onKeyDown(e);
                  }
                }}
                onChange={(nextValue) => {
                  if (nextValue.startsWith("/")) {
                    onTrigger();
                  } else if (!nextValue) {
                    onTrigger(false);
                  }
                  onInputChange(nextValue);
                }}
                onSubmit={handleSubmit}
              />
            )}
          </Suggestion>
        )}
      </div>
    </Flex>
  );
}
