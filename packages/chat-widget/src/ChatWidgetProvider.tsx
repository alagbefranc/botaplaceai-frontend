import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChatWidgetProps, ChatWidgetContextValue, ChatMessage, ChatWidgetTheme, ChatWidgetStringSet } from './types';
import { defaultTheme, defaultStringSet } from './defaults';

const ChatWidgetContext = createContext<ChatWidgetContextValue | null>(null);

export function useChatWidget(): ChatWidgetContextValue {
  const context = useContext(ChatWidgetContext);
  if (!context) {
    throw new Error('useChatWidget must be used within a ChatWidgetProvider');
  }
  return context;
}

interface ChatWidgetProviderProps extends ChatWidgetProps {
  children: React.ReactNode;
}

export function ChatWidgetProvider({ children, ...props }: ChatWidgetProviderProps) {
  const [isOpen, setIsOpen] = useState(props.autoOpen ?? false);
  const [isExpanded, setIsExpanded] = useState(props.startExpanded ?? false);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  // Track current agent (may change during team handoffs)
  const [currentAgentId, setCurrentAgentId] = useState(props.agentId);
  const [currentAgentName, setCurrentAgentName] = useState(props.agentName || 'Agent');
  
  const sessionIdRef = useRef<string>(props.sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  // Merge theme with defaults
  const theme = useMemo<Required<ChatWidgetTheme>>(() => ({
    ...defaultTheme,
    ...props.theme,
  }), [props.theme]);

  // Merge string set with defaults
  const strings = useMemo<Required<ChatWidgetStringSet>>(() => ({
    ...defaultStringSet,
    ...props.stringSet,
  }), [props.stringSet]);

  // Auto-open with delay
  useEffect(() => {
    if (props.autoOpen && props.autoOpenDelay && props.autoOpenDelay > 0) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        props.eventHandlers?.onOpen?.();
      }, props.autoOpenDelay * 1000);
      return () => clearTimeout(timer);
    }
  }, [props.autoOpen, props.autoOpenDelay, props.eventHandlers]);

  // Add greeting message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0 && props.greeting) {
      const greetingMessage: ChatMessage = {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: props.greeting,
        timestamp: new Date(),
        status: 'delivered',
      };
      setMessages([greetingMessage]);
    }
  }, [isOpen, messages.length, props.greeting]);

  // Connect on mount
  useEffect(() => {
    // Simulate connection
    const connectTimer = setTimeout(() => {
      setIsConnected(true);
      props.eventHandlers?.onConnect?.(sessionIdRef.current);
    }, 500);

    return () => {
      clearTimeout(connectTimer);
      props.eventHandlers?.onDisconnect?.();
    };
  }, [props.agentId, props.eventHandlers]);

  const open = useCallback(() => {
    setIsOpen(true);
    setUnreadCount(0);
    props.eventHandlers?.onOpen?.();
  }, [props.eventHandlers]);

  const close = useCallback(() => {
    setIsOpen(false);
    props.eventHandlers?.onClose?.();
  }, [props.eventHandlers]);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const expand = useCallback(() => {
    setIsExpanded(true);
    props.eventHandlers?.onExpand?.();
  }, [props.eventHandlers]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    props.eventHandlers?.onCollapse?.();
  }, [props.eventHandlers]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    props.eventHandlers?.onMessageSent?.(userMessage);
    setIsTyping(true);

    try {
      const apiUrl = props.apiBaseUrl || '';
      const response = await fetch(`${apiUrl}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: currentAgentId,
          teamId: props.teamId,
          message: content,
          sessionId: sessionIdRef.current,
          userId: props.userId,
          userMetadata: props.userMetadata,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Update user message status
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        )
      );

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullText = '';
      let pending = '';
      const assistantId = `assistant-${Date.now()}`;

      // Add placeholder
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
      ]);

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            if (payload && payload !== '[DONE]') {
              try {
                const parsed = JSON.parse(payload) as { 
                  text?: string;
                  type?: string;
                  agentId?: string;
                  agentName?: string;
                  greeting?: string;
                  summary?: string;
                  variables?: Record<string, unknown>;
                };
                
                // Handle agent change event during team handoffs
                if (parsed.type === 'agent_changed' && parsed.agentId) {
                  setCurrentAgentId(parsed.agentId);
                  setCurrentAgentName(parsed.agentName || 'Agent');
                  props.eventHandlers?.onAgentChanged?.(parsed.agentId, parsed.agentName || 'Agent', parsed.greeting);
                  
                  // Add a system message about the handoff
                  if (parsed.greeting) {
                    const handoffMessage: ChatMessage = {
                      id: `handoff-${Date.now()}`,
                      role: 'assistant',
                      content: parsed.greeting,
                      timestamp: new Date(),
                      status: 'delivered',
                      metadata: { type: 'handoff', agentId: parsed.agentId, agentName: parsed.agentName },
                    };
                    setMessages((prev) => [...prev, handoffMessage]);
                  }
                  continue;
                }
                
                // Handle handoff context event
                if (parsed.type === 'handoff_context') {
                  props.eventHandlers?.onHandoffContext?.(parsed.summary, parsed.variables);
                  continue;
                }
                
                // Handle regular text response
                if (parsed.text) {
                  fullText += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: fullText } : m
                    )
                  );
                }
              } catch { /* ignore */ }
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
        status: 'delivered',
      };

      props.eventHandlers?.onMessageReceived?.(assistantMessage);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      props.eventHandlers?.onError?.(error);

      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: 'failed' } : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  }, [currentAgentId, props.teamId, props.apiBaseUrl, props.userId, props.userMetadata, props.eventHandlers]);

  const retryMessage = useCallback(async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message && message.role === 'user' && message.status === 'failed') {
      // Remove failed message and resend
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      await sendMessage(message.content);
    }
  }, [messages, sendMessage]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    if (props.greeting) {
      const greetingMessage: ChatMessage = {
        id: `greeting-${Date.now()}`,
        role: 'assistant',
        content: props.greeting,
        timestamp: new Date(),
        status: 'delivered',
      };
      setMessages([greetingMessage]);
    }
  }, [props.greeting]);

  const setTypingState = useCallback((typing: boolean) => {
    setIsTyping(typing);
    if (typing) {
      props.eventHandlers?.onTypingStart?.();
    } else {
      props.eventHandlers?.onTypingEnd?.();
    }
  }, [props.eventHandlers]);

  const value: ChatWidgetContextValue = useMemo(() => ({
    // State
    isOpen,
    isExpanded,
    isConnected,
    isTyping,
    messages,
    unreadCount,
    error,
    currentAgentId,
    currentAgentName,

    // Actions
    open,
    close,
    toggle,
    expand,
    collapse,
    sendMessage,
    retryMessage,
    clearHistory,
    setTyping: setTypingState,

    // Config
    config: props,
    theme,
    strings,
  }), [
    isOpen, isExpanded, isConnected, isTyping, messages, unreadCount, error, currentAgentId, currentAgentName,
    open, close, toggle, expand, collapse, sendMessage, retryMessage, clearHistory, setTypingState,
    props, theme, strings,
  ]);

  return (
    <ChatWidgetContext.Provider value={value}>
      {children}
    </ChatWidgetContext.Provider>
  );
}
