"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Avatar, Button, Flex, Typography, Image } from "antd";
import { ArrowsAltOutlined } from "@ant-design/icons";
import { AntxPlaygroundChat, type AntxPlaygroundMessage } from "./antx-playground-chat";
import { 
  BuilderThoughtChain, 
  CompletedThoughtChain, 
  parseSpecialTokens,
  renderTokenComponent,
  FIELD_DISPLAY_NAMES,
  FIELD_ICONS,
  type FieldUpdate,
  type ToolCallItem,
} from "./builder-token-components";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// Page context types
type PageContext = 
  | { type: "home"; description: "Agent builder playground" }
  | { type: "agents"; description: "Agent management list"; agentId?: string }
  | { type: "agent-detail"; description: "Individual agent configuration"; agentId: string }
  | { type: "knowledge-base"; description: "Knowledge base and documents" }
  | { type: "conversations"; description: "Conversation history and transcripts" }
  | { type: "analytics"; description: "Analytics and insights dashboard" }
  | { type: "apps"; description: "Connected apps and integrations" }
  | { type: "phone-numbers"; description: "Voice line provisioning" }
  | { type: "live-calls"; description: "Live call monitoring" }
  | { type: "settings"; description: "Platform settings" }
  | { type: "missions"; description: "Outbound mission campaigns" }
  | { type: "mission-detail"; description: "Individual mission details"; missionId: string }
  | { type: "contacts"; description: "Contact management" }
  | { type: "teams"; description: "Agent team management" }
  | { type: "team-detail"; description: "Individual team configuration"; teamId: string }
  | { type: "messages"; description: "Inbox and messaging" }
  | { type: "evals"; description: "Agent testing and evaluation" }
  | { type: "insights"; description: "AI-powered insights" }
  | { type: "widget"; description: "Chat widget configuration" }
  | { type: "unknown"; description: "Unknown page" };

interface AgentCopilotProps {
  /** When true, shows the full builder experience (home page mode) */
  isHomePage?: boolean;
  /** Optional agent ID when editing a specific agent */
  agentId?: string;
  /** Called when user wants to expand to fullscreen */
  onExpand?: () => void;
  /** Compact mode for sidebar */
  compact?: boolean;
}

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: React.ReactNode;
  loading?: boolean;
}

// System prompts based on page context
function getSystemPrompt(context: PageContext, isAuthenticated: boolean): string {
  const basePrompt = `You are an AI Workspace Copilot for an Omnichannel AI Agent Platform. You help users build, manage, and troubleshoot AI agents.

Current page: ${context.type}
Page description: ${context.description}
User status: ${isAuthenticated ? "Authenticated" : "Guest (limited access)"}

You can:
- Answer questions about the platform and its features
- Help troubleshoot agent issues
- Guide users through configuration
- Explain analytics and insights
- Help with knowledge base management
${isAuthenticated ? "- Access and query their data via APIs (when needed)" : ""}

Be helpful, concise, and context-aware. Reference the current page when relevant.`;

  // Page-specific additions
  switch (context.type) {
    case "home":
      return basePrompt + `\n\nOn this page, you help users build AI agents through natural conversation. Guide them through:
1. Understanding their use case
2. Naming and personality
3. Voice selection
4. Tools and integrations
5. Channel deployment
6. Live API configuration

Use [VOICE_PICKER], [TOOL_PICKER], [CHANNEL_PICKER], [AGENT_SUMMARY] tokens when appropriate.`;

    case "agent-detail":
      return basePrompt + `\n\nThe user is editing a specific agent. You can help them:
- Review and improve the system prompt
- Adjust voice settings
- Configure tools and channels
- Optimize Live API settings
- Debug issues
- Suggest improvements
\nAgent ID: ${context.agentId}`;

    case "knowledge-base":
      return basePrompt + `\n\nThe user is managing knowledge bases. You can help them:
- Understand how knowledge base search works
- Suggest document organization
- Troubleshoot ingestion issues
- Explain chunking and retrieval
- Optimize for better answers`;

    case "conversations":
      return basePrompt + `\n\nThe user is reviewing conversation history. You can help them:
- Analyze conversation quality
- Identify common issues
- Suggest prompt improvements
- Review escalation patterns
- Find training opportunities`;

    case "analytics":
      return basePrompt + `\n\nThe user is viewing analytics. You can help them:
- Interpret metrics and trends
- Identify performance issues
- Suggest optimizations
- Understand user behavior
- Track agent effectiveness`;

    case "phone-numbers":
      return basePrompt + `\n\nThe user is managing voice lines. You can help them:
- Understand phone number provisioning
- Configure voice settings
- Set up call routing
- Troubleshoot voice issues`;

    default:
      return basePrompt;
  }
}

// Parse pathname to determine context
function getPageContext(pathname: string, agentId?: string): PageContext {
  if (pathname === "/" || pathname === "") {
    return { type: "home", description: "Agent builder playground" };
  }
  if (pathname === "/agents") {
    return { type: "agents", description: "Agent management list" };
  }
  if (pathname.startsWith("/agents/") && agentId) {
    return { type: "agent-detail", description: "Individual agent configuration", agentId };
  }
  if (pathname.startsWith("/agents/") && !agentId) {
    const id = pathname.split("/")[2];
    if (id) return { type: "agent-detail", description: "Individual agent configuration", agentId: id };
  }
  if (pathname === "/knowledge-base") {
    return { type: "knowledge-base", description: "Knowledge base and documents" };
  }
  if (pathname === "/conversations") {
    return { type: "conversations", description: "Conversation history and transcripts" };
  }
  if (pathname === "/analytics") {
    return { type: "analytics", description: "Analytics and insights dashboard" };
  }
  if (pathname === "/apps") {
    return { type: "apps", description: "Connected apps and integrations" };
  }
  if (pathname === "/phone-numbers") {
    return { type: "phone-numbers", description: "Voice line provisioning" };
  }
  if (pathname === "/live-calls") {
    return { type: "live-calls", description: "Live call monitoring" };
  }
  if (pathname === "/settings") {
    return { type: "settings", description: "Platform settings" };
  }
  if (pathname === "/missions") {
    return { type: "missions", description: "Outbound mission campaigns" };
  }
  if (pathname.startsWith("/missions/")) {
    const id = pathname.split("/")[2];
    if (id) return { type: "mission-detail", description: "Individual mission details", missionId: id };
  }
  if (pathname === "/contacts") {
    return { type: "contacts", description: "Contact management" };
  }
  if (pathname === "/teams") {
    return { type: "teams", description: "Agent team management" };
  }
  if (pathname.startsWith("/teams/")) {
    const id = pathname.split("/")[2];
    if (id) return { type: "team-detail", description: "Individual team configuration", teamId: id };
  }
  if (pathname === "/messages") {
    return { type: "messages", description: "Inbox and messaging" };
  }
  if (pathname === "/evals") {
    return { type: "evals", description: "Agent testing and evaluation" };
  }
  if (pathname === "/insights") {
    return { type: "insights", description: "AI-powered insights" };
  }
  if (pathname === "/widget") {
    return { type: "widget", description: "Chat widget configuration" };
  }
  return { type: "unknown", description: "Unknown page" };
}

export function AgentCopilot({ 
  isHomePage = false, 
  agentId, 
  onExpand,
  compact = false 
}: AgentCopilotProps) {
  const pathname = usePathname();
  const supabase = getSupabaseBrowserClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Get builder store for home page
  const builderStore = useAgentBuilderStore();
  
  // Determine context
  const context = useMemo(() => getPageContext(pathname, agentId), [pathname, agentId]);
  
  // Check auth status
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    
    const checkAuth = async () => {
      const { data: { session } } = await client.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
    
    const { data: { subscription } } = client.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session);
    });
    
    return () => subscription.unsubscribe();
  }, [supabase]);
  
  // Welcome message based on context
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage = getWelcomeMessage(context, isAuthenticated);
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage,
        },
      ]);
    }
  }, [context.type, isAuthenticated]);
  
  const getWelcomeMessage = (ctx: PageContext, auth: boolean): string => {
    if (ctx.type === "home") {
      return auth
        ? "Let's build your AI agent! First — what's your company name and what do you sell or do?"
        : "Let's build your AI agent! First — what's your company name and what do you sell or do? (You can create one agent as a guest, no login required.)";
    }
    if (ctx.type === "agent-detail") {
      return "I can see this agent's full config. I can help optimize settings, troubleshoot issues, or explain anything. What would you like to know?";
    }
    if (ctx.type === "knowledge-base") {
      return "I can help you organize documents, troubleshoot ingestion issues, or optimize your knowledge base for better answers. What do you need help with?";
    }
    if (ctx.type === "conversations") {
      return "I can help you analyze conversations, identify patterns, or suggest improvements to your agents. What are you looking for?";
    }
    if (ctx.type === "analytics") {
      return "I can help you understand your metrics, identify trends, or suggest optimizations. What would you like to explore?";
    }
    if (ctx.type === "missions") {
      return "This is where you manage outbound call campaigns. I can help you create missions, assign agents, add contacts, and launch them. I can also see your existing missions and suggest improvements. What do you need?";
    }
    if (ctx.type === "mission-detail") {
      return "I can see this mission's config, contacts, and call results. I can help you understand the outcomes, troubleshoot failed calls, or optimize for your next campaign. What would you like to know?";
    }
    if (ctx.type === "contacts") {
      return "This is your contact database. I can help you import contacts via CSV, organize them, or explain how contacts work with missions and conversations. What do you need?";
    }
    if (ctx.type === "teams") {
      return "Agent Teams let you combine multiple agents to handle complex workflows. I can help you create teams, assign agents with roles, or explain how team routing works. What would you like to do?";
    }
    if (ctx.type === "team-detail") {
      return "I can see this team's configuration and members. I can help you optimize the team setup, add or remove agents, or configure routing. What do you need?";
    }
    if (ctx.type === "messages") {
      return "This is your messaging inbox. I can help you understand conversations, explain message statuses, or troubleshoot delivery issues. How can I help?";
    }
    if (ctx.type === "evals") {
      return "Agent Testing lets you run automated evaluations against your agents. I can help you create test suites, understand results, or suggest improvements based on test outcomes. What would you like to do?";
    }
    if (ctx.type === "insights") {
      return "AI Insights automatically extracts patterns from your conversations — sentiment trends, common topics, escalation reasons. I can help you interpret the data or set up insight extraction. What are you looking for?";
    }
    if (ctx.type === "phone-numbers") {
      return "This is where you manage your phone numbers for voice AI. I can help you provision numbers, assign them to agents, configure voicemail, or troubleshoot call issues. What do you need?";
    }
    if (ctx.type === "widget") {
      return "The chat widget lets you embed your AI agent on any website. I can help you configure the widget appearance, behavior, and generate the embed code. What would you like to do?";
    }
    if (ctx.type === "apps") {
      return "Connected apps extend your agents with third-party integrations like CRMs, calendars, and more. I can help you set up integrations or troubleshoot existing ones. What do you need?";
    }
    if (ctx.type === "settings") {
      return "I can help you configure platform settings — organization details, API keys, billing, and more. What would you like to adjust?";
    }
    if (ctx.type === "agents") {
      return "This is your agent listing. I can help you understand your agents' status, compare configurations, or guide you through creating a new one. What do you need?";
    }
    if (ctx.type === "live-calls") {
      return "Live Calls shows you active voice calls in real-time. I can help you understand call states, monitor quality, or troubleshoot ongoing calls. What would you like to know?";
    }
    return "Hi! I'm your AI workspace copilot. I can see your current page context and help you get things set up correctly. How can I help?";
  };
  
  const appendMessage = useCallback((role: "user" | "assistant", content: React.ReactNode, loading = false) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role,
        content,
        loading,
      },
    ]);
  }, []);
  
  const streamResponse = useCallback(async (userMessage: string) => {
    setIsStreaming(true);
    let processedFieldUpdates: FieldUpdate[] = [];
    
    // Add loading message with thought chain
    appendMessage("assistant", <BuilderThoughtChain stage="thinking" />, true);
    
    try {
      const conversationHistory = messages
        .filter((msg) => typeof msg.content === "string")
        .map((msg) => ({
          role: msg.role,
          content: msg.content as string,
        }));
      
      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: "user", content: userMessage }],
          context: {
            pageType: context.type,
            pageDescription: context.description,
            agentId: context.type === "agent-detail" ? context.agentId : undefined,
            missionId: (context.type === "mission-detail" && "missionId" in context) ? context.missionId : undefined,
            teamId: (context.type === "team-detail" && "teamId" in context) ? context.teamId : undefined,
            isAuthenticated,
          },
          agentConfig: isHomePage ? {
            name: builderStore.draft.name,
            systemPrompt: builderStore.draft.systemPrompt,
            voice: builderStore.draft.voice,
            tools: builderStore.draft.tools,
            channels: builderStore.draft.channels,
            greeting: builderStore.draft.greetingMessage,
            liveApi: builderStore.draft.liveApi,
            memoryEnabled: builderStore.draft.memory.enabled,
            guardrailsEnabled: builderStore.draft.guardrails.enabled,
            escalationEnabled: builderStore.draft.escalation.enabled,
          } : undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get response: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream");
      }
      
      const decoder = new TextDecoder();
      let fullText = "";
      let pending = "";
      
      // Helper to build tool call items for completed field updates
      const buildToolCallItems = (updates: FieldUpdate[]): ToolCallItem[] => {
        return updates.map((update) => ({
          key: `set-${update.field}`,
          title: FIELD_DISPLAY_NAMES[update.field],
          icon: FIELD_ICONS[update.field],
          status: "success" as const,
          description: update.value.length > 50 ? update.value.slice(0, 50) + "..." : update.value,
        }));
      };
      
      // Helper to build the message content with actions
      const buildMessageContent = (text: string, updates: FieldUpdate[], components: string[]) => {
        const hasToolCalls = updates.length > 0;
        const uiComponents = components
          .filter((c) => c !== "agent_ready")
          .map((type) => renderTokenComponent(type as any, {
            isGuest: !isAuthenticated,
          }));
        
        if (!hasToolCalls && uiComponents.length === 0) {
          return text;
        }
        
        return (
          <Flex vertical gap={12} style={{ width: "100%" }}>
            {hasToolCalls && <BuilderThoughtChain stage="custom" toolCalls={buildToolCallItems(updates)} />}
            {text && <Typography.Text>{text}</Typography.Text>}
            {uiComponents}
          </Flex>
        );
      };
      
      while (true) {
        const { done, value: chunk } = await reader.read();
        
        if (chunk) {
          pending += decoder.decode(chunk, { stream: !done });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          
          for (const line of lines) {
            if (line.trim().startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data && data !== "[DONE]") {
                try {
                  const parsed = JSON.parse(data) as { text?: string; error?: string };
                  if (parsed.text) {
                    fullText += parsed.text;
                    const { text, components, fieldUpdates } = parseSpecialTokens(fullText);
                    
                    // Process new field updates and apply to store
                    for (const update of fieldUpdates) {
                      const alreadyProcessed = processedFieldUpdates.some(
                        (p) => p.field === update.field && p.value === update.value
                      );
                      if (!alreadyProcessed && isHomePage) {
                        processedFieldUpdates.push(update);
                        
                        // Apply the field update to the builder store
                        switch (update.field) {
                          case "name":
                            builderStore.setName(update.value);
                            break;
                          case "prompt":
                            builderStore.setSystemPrompt(update.value);
                            break;
                          case "voice":
                            builderStore.setVoice(update.value);
                            break;
                          case "tools":
                            builderStore.setTools(update.value.split(",").map((t) => t.trim()).filter(Boolean));
                            break;
                          case "channels": {
                            const channelValues = update.value.split(",").map((c) => c.trim()).filter(Boolean);
                            builderStore.setChannels(channelValues as ("web_chat" | "web_voice" | "phone" | "whatsapp" | "sms")[]);
                            break;
                          }
                          case "greeting":
                            builderStore.setGreetingMessage(update.value);
                            break;
                          case "memory":
                            builderStore.setMemory({ enabled: update.value === "true" || update.value === "yes" });
                            break;
                          case "guardrails":
                            builderStore.setGuardrails({ enabled: update.value !== "false" && update.value !== "no" });
                            break;
                          case "escalation":
                            builderStore.setEscalation({ enabled: update.value === "true" || update.value === "yes" });
                            break;
                        }
                      }
                    }
                    
                    // Update the message with text, tool calls, and UI components
                    const messageContent = buildMessageContent(text, processedFieldUpdates, components);
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.loading
                          ? { ...msg, loading: false, content: messageContent }
                          : msg
                      )
                    );
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
        
        if (done) break;
      }
      
      // Final update to ensure loading is cleared
      if (fullText) {
        const { text, components, fieldUpdates } = parseSpecialTokens(fullText);
        const messageContent = buildMessageContent(text, processedFieldUpdates, components);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.loading
              ? { ...msg, loading: false, content: messageContent }
              : msg
          )
        );
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.loading
            ? { ...msg, loading: false, content: "Sorry, I encountered an error. Please try again." }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [messages, context, isAuthenticated, isHomePage, builderStore, appendMessage]);
  
  const handleSubmit = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    
    appendMessage("user", trimmed);
    setInputValue("");
    
    void streamResponse(trimmed);
  }, [appendMessage, streamResponse]);
  
  // Convert to AntxPlaygroundMessage format
  const playgroundMessages: AntxPlaygroundMessage[] = useMemo(() => 
    messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      loading: msg.loading,
    })),
  [messages]);
  
  if (compact) {
    return (
      <AntxPlaygroundChat
        messages={playgroundMessages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
        loading={isStreaming}
        showConversations={false}
        showWelcome={false}
        mode="compact"
        inputPlaceholder="Ask me anything..."
        disableSuggestions
        assistantAvatar={
          <Avatar
            size={36}
            src="/assets/avatars/bota-copilot-avatar.png"
            style={{ background: "transparent" }}
          />
        }
        assistantName="Copilot"
      />
    );
  }
  
  return (
    <div className="agent-copilot">
      <div className="agent-copilot-header">
        {onExpand && (
          <Button
            type="text"
            shape="circle"
            icon={<ArrowsAltOutlined />}
            onClick={onExpand}
            aria-label="Expand"
          />
        )}
      </div>
      
      <div className="agent-copilot-welcome">
        <Image
          src="/assets/illustrations/bota/agent-hero.svg"
          alt="Botaplace AI Copilot illustration"
          width={240}
          height={107}
        />
        <Typography.Title level={4}>
          AI Workspace Copilot
        </Typography.Title>
        <Typography.Text type="secondary">
          Context: {context.description}
        </Typography.Text>
      </div>
      
      <AntxPlaygroundChat
        messages={playgroundMessages}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSubmit={handleSubmit}
        loading={isStreaming}
        showConversations={false}
        showWelcome={false}
        mode="compact"
        inputPlaceholder={`Ask about ${context.description.toLowerCase()}...`}
        disableSuggestions
        assistantAvatar={
          <Avatar
            size={36}
            src="/assets/avatars/bota-copilot-avatar.png"
            style={{ background: "transparent" }}
          />
        }
        assistantName="Copilot"
      />
      
      <Flex justify="center" wrap gap={8} className="agent-copilot-shortcuts">
        <Button shape="round" size="small" onClick={() => handleSubmit("Help me get started")}>
          Get Started
        </Button>
        <Button shape="round" size="small" onClick={() => handleSubmit("I have a question")}>
          Ask Question
        </Button>
        {isHomePage && (
          <Button shape="round" size="small" onClick={() => handleSubmit("I want to build an AI agent for my business")}>
            Build Agent
          </Button>
        )}
      </Flex>
    </div>
  );
}
