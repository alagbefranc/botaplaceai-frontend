import React, { useCallback, useMemo, useState } from 'react';
import { MessageOutlined, CloseOutlined, ExpandOutlined, CompressOutlined, RobotOutlined, UserOutlined, SendOutlined } from '@ant-design/icons';
import { Avatar, Button, Input, Spin } from 'antd';
import { Bubble, Sender, Welcome } from '@ant-design/x';
import type { ChatWidgetProps } from './types';
import { ChatWidgetProvider, useChatWidget } from './ChatWidgetProvider';
import { defaultTheme } from './defaults';
import './ChatWidget.css';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function WidgetLauncher() {
  const { toggle, isOpen, unreadCount, config, theme } = useChatWidget();
  
  if (isOpen) return null;
  
  const customLauncher = config.customLauncherComponent;
  
  return (
    <button
      className="bo-chat-widget-launcher"
      onClick={toggle}
      style={{
        backgroundColor: theme.primaryColor,
        ...(customLauncher?.style || {}),
        width: customLauncher?.width || 56,
        height: customLauncher?.height || 56,
      }}
      aria-label="Open chat"
    >
      {customLauncher?.icon || <MessageOutlined style={{ fontSize: 24, color: '#fff' }} />}
      {unreadCount > 0 && (
        <span className="bo-chat-widget-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
      )}
    </button>
  );
}

function WidgetHeader() {
  const { close, expand, collapse, isExpanded, config, theme, strings, isConnected, isTyping, currentAgentName } = useChatWidget();
  
  const customHeader = config.customHeaderComponent;
  
  return (
    <div 
      className="bo-chat-widget-header"
      style={{ backgroundColor: theme.primaryColor, ...customHeader?.style }}
    >
      <div className="bo-chat-widget-header-content">
        {customHeader?.avatar || (
          <Avatar
            size={40}
            icon={<RobotOutlined />}
            src={config.agentAvatarUrl}
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.3)',
              flexShrink: 0,
            }}
          />
        )}
        <div className="bo-chat-widget-header-info">
          <span className="bo-chat-widget-header-title">
            {customHeader?.title || currentAgentName || strings.headerTitle}
          </span>
          <span className="bo-chat-widget-header-subtitle">
            {isTyping ? (
              <>{currentAgentName || 'Agent'} {strings.headerTypingIndicator}</>
            ) : (
              customHeader?.subtitle || (
                <>
                  <span className={`bo-chat-widget-status-dot ${isConnected ? 'online' : 'offline'}`} />
                  {isConnected ? strings.headerOnlineStatus : strings.headerOfflineStatus}
                </>
              )
            )}
          </span>
        </div>
      </div>
      <div className="bo-chat-widget-header-actions">
        {customHeader?.actions}
        {config.enableWidgetExpandButton && (
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={isExpanded ? collapse : expand}
            style={{ color: '#fff' }}
          />
        )}
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={close}
          style={{ color: '#fff' }}
        />
      </div>
    </div>
  );
}

function WidgetMessageList() {
  const { messages, config, theme, strings, isTyping, currentAgentName } = useChatWidget();
  
  const bubbleItems = useMemo(() => 
    messages.map((msg) => ({
      key: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      loading: msg.status === 'sending',
    })),
  [messages]);
  
  if (messages.length === 0) {
    return (
      <div className="bo-chat-widget-empty">
        <Welcome
          icon={
            config.renderProps?.renderAssistantAvatar?.() || (
              <Avatar
                size={64}
                icon={<RobotOutlined />}
                src={config.agentAvatarUrl}
                style={{ backgroundColor: theme.primaryColor }}
              />
            )
          }
          title={config.agentName || strings.emptyStateTitle}
          description={config.greeting || strings.emptyStateDescription}
          style={{ padding: '40px 20px' }}
        />
      </div>
    );
  }
  
  return (
    <div className="bo-chat-widget-messages">
      <Bubble.List
        items={bubbleItems}
        autoScroll={config.autoScrollToBottom !== false}
        role={{
          assistant: {
            placement: 'start',
            avatar: config.renderProps?.renderAssistantAvatar?.() || (
              <Avatar
                size={32}
                icon={<RobotOutlined />}
                src={config.agentAvatarUrl}
                style={{ backgroundColor: theme.primaryColor }}
              />
            ),
            style: {
              backgroundColor: theme.assistantBubbleColor,
              color: theme.assistantTextColor,
              borderRadius: theme.bubbleBorderRadius,
            },
          },
          user: {
            placement: 'end',
            avatar: config.renderProps?.renderUserAvatar?.() || (
              <Avatar
                size={32}
                icon={<UserOutlined />}
                src={config.userProfileUrl}
                style={{ backgroundColor: theme.userBubbleColor }}
              />
            ),
            style: {
              backgroundColor: theme.userBubbleColor,
              color: theme.userTextColor,
              borderRadius: theme.bubbleBorderRadius,
            },
          },
        }}
      />
      {isTyping && config.enableTypingIndicator !== false && (
        <div className="bo-chat-widget-typing">
          <Spin size="small" />
          <span>{currentAgentName || 'Agent'} {strings.headerTypingIndicator}</span>
        </div>
      )}
    </div>
  );
}

function WidgetInput() {
  const { sendMessage, config, strings, isTyping, setTyping } = useChatWidget();
  const [value, setValue] = useState('');
  
  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    sendMessage(value);
    setValue('');
  }, [value, sendMessage]);
  
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    if (newValue && !isTyping) {
      setTyping(true);
    } else if (!newValue && isTyping) {
      setTyping(false);
    }
  }, [isTyping, setTyping]);
  
  const isBlocked = config.messageInputControls?.blockWhileBotResponding && isTyping;
  
  return (
    <div className="bo-chat-widget-input">
      <Sender
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        loading={isTyping}
        disabled={!!isBlocked}
        placeholder={config.inputPlaceholder || strings.inputPlaceholder}
      />
    </div>
  );
}

function WidgetContainer() {
  const { isOpen, isExpanded, config, theme } = useChatWidget();
  
  if (!isOpen) return null;
  
  const position = config.position || 'bottom-right';
  const [vertical, horizontal] = position.split('-');
  
  const offset = config.offset || { x: 20, y: 20 };
  
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: config.zIndex || 9999,
    [vertical]: offset.y,
    [horizontal]: offset.x,
    width: isExpanded ? '100vw' : (config.width || 380),
    height: isExpanded ? '100vh' : (config.height || 600),
    maxWidth: isExpanded ? '100vw' : 'calc(100vw - 40px)',
    maxHeight: isExpanded ? '100vh' : 'calc(100vh - 40px)',
    ...(isExpanded ? { top: 0, left: 0, right: 0, bottom: 0 } : {}),
    borderRadius: isExpanded ? 0 : theme.borderRadius,
    backgroundColor: theme.backgroundColor,
    fontFamily: theme.fontFamily,
    boxShadow: isExpanded ? 'none' : '0 8px 40px rgba(0,0,0,0.15)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease',
  };
  
  return (
    <div 
      className={`bo-chat-widget-container ${isExpanded ? 'expanded' : ''}`}
      style={containerStyle}
      data-testid={config.testId}
    >
      <WidgetHeader />
      <WidgetMessageList />
      <WidgetInput />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function ChatWidget(props: ChatWidgetProps) {
  // Validate required props
  if (!props.agentId) {
    console.error('[ChatWidget] agentId is required');
    return null;
  }
  
  // Don't render if visibility is explicitly false
  if (props.visible === false) {
    return null;
  }
  
  const position = props.position || 'bottom-right';
  const [vertical, horizontal] = position.split('-');
  const offset = props.offset || { x: 20, y: 20 };
  
  const launcherStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: props.zIndex || 9999,
    [vertical]: offset.y,
    [horizontal]: offset.x,
  };
  
  return (
    <ChatWidgetProvider {...props}>
      <div className={`bo-chat-widget ${props.className || ''}`} style={launcherStyle}>
        <WidgetLauncher />
        <WidgetContainer />
      </div>
    </ChatWidgetProvider>
  );
}
