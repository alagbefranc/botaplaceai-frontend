import type { CSSProperties, ReactNode } from 'react';
import type { Locale } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// THEME & STYLING
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetTheme {
  /** Primary brand color (default: #6366f1) */
  primaryColor?: string;
  /** Background color of the widget (default: #ffffff) */
  backgroundColor?: string;
  /** Text color (default: #1f2937) */
  textColor?: string;
  /** Secondary text color for timestamps, hints (default: #6b7280) */
  secondaryTextColor?: string;
  /** Border color (default: #e5e7eb) */
  borderColor?: string;
  /** User message bubble background (default: primaryColor) */
  userBubbleColor?: string;
  /** User message text color (default: #ffffff) */
  userTextColor?: string;
  /** Assistant message bubble background (default: #f3f4f6) */
  assistantBubbleColor?: string;
  /** Assistant message text color (default: textColor) */
  assistantTextColor?: string;
  /** Font family (default: system-ui) */
  fontFamily?: string;
  /** Border radius for widget container (default: 16) */
  borderRadius?: number;
  /** Border radius for message bubbles (default: 12) */
  bubbleBorderRadius?: number;
}

export interface ChatWidgetStyles {
  /** Style for the root container */
  root?: CSSProperties;
  /** Style for the header section */
  header?: CSSProperties;
  /** Style for the message list container */
  messageList?: CSSProperties;
  /** Style for the input area */
  inputArea?: CSSProperties;
  /** Style for the launcher button (FAB) */
  launcher?: CSSProperties;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'failed' | 'delivered' | 'read';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp?: Date;
  status?: MessageStatus;
  metadata?: Record<string, unknown>;
}

export interface SuggestedReply {
  id: string;
  label: string;
  value: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEEDBACK & REACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'emoji';

export interface MessageFeedback {
  messageId: string;
  type: FeedbackType;
  value?: string;
  comment?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION & USER
// ═══════════════════════════════════════════════════════════════════════════════

export interface SessionHandler {
  onSessionTokenRequired: () => Promise<string>;
  onSessionClosed: () => void;
  onSessionError: (error: Error) => void;
  onSessionRefresh: () => Promise<string>;
}

export interface UserInfo {
  id?: string;
  nickname?: string;
  profileUrl?: string;
  email?: string;
  metadata?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMIZATION COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomRefreshComponent {
  icon?: ReactNode;
  style?: CSSProperties;
  width?: string | number;
  height?: string | number;
  onClick?: () => void;
}

export interface CustomLauncherComponent {
  icon?: ReactNode;
  style?: CSSProperties;
  width?: string | number;
  height?: string | number;
  badgeCount?: number;
  onClick?: () => void;
}

export interface CustomHeaderComponent {
  title?: ReactNode;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  style?: CSSProperties;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRING SET (i18n)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetStringSet {
  // Header
  headerTitle?: string;
  headerSubtitle?: string;
  headerOnlineStatus?: string;
  headerOfflineStatus?: string;
  headerTypingIndicator?: string;

  // Input
  inputPlaceholder?: string;
  inputPlaceholderDisabled?: string;
  inputSendButton?: string;
  inputAttachButton?: string;
  inputVoiceButton?: string;

  // Messages
  messageDelivered?: string;
  messageRead?: string;
  messageFailed?: string;
  messageRetry?: string;
  messageDeleted?: string;

  // Timestamps
  timestampToday?: string;
  timestampYesterday?: string;
  timestampJustNow?: string;
  timestampMinutesAgo?: string;
  timestampHoursAgo?: string;

  // Actions
  actionCopy?: string;
  actionRetry?: string;
  actionDelete?: string;
  actionEdit?: string;

  // Feedback
  feedbackHelpful?: string;
  feedbackNotHelpful?: string;
  feedbackThanks?: string;

  // States
  stateConnecting?: string;
  stateReconnecting?: string;
  stateOffline?: string;
  stateError?: string;

  // Empty state
  emptyStateTitle?: string;
  emptyStateDescription?: string;

  // Errors
  errorGeneric?: string;
  errorNetwork?: string;
  errorRateLimit?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetEventHandlers {
  /** Called when user sends a message */
  onMessageSent?: (message: ChatMessage) => void;
  /** Called when a message is received */
  onMessageReceived?: (message: ChatMessage) => void;
  /** Called when user provides feedback */
  onFeedback?: (feedback: MessageFeedback) => void;
  /** Called when widget is opened */
  onOpen?: () => void;
  /** Called when widget is closed */
  onClose?: () => void;
  /** Called when widget is expanded (fullscreen) */
  onExpand?: () => void;
  /** Called when widget is collapsed */
  onCollapse?: () => void;
  /** Called when user starts typing */
  onTypingStart?: () => void;
  /** Called when user stops typing */
  onTypingEnd?: () => void;
  /** Called when session connects */
  onConnect?: (sessionId: string) => void;
  /** Called when session disconnects */
  onDisconnect?: () => void;
  /** Called on any error */
  onError?: (error: Error) => void;
  /** Called when user clicks a suggested reply */
  onSuggestedReplyClick?: (reply: SuggestedReply) => void;
  /** Called when user clicks a link in a message */
  onLinkClick?: (url: string, message: ChatMessage) => void;
  /** Called when the agent changes during a team handoff */
  onAgentChanged?: (agentId: string, agentName: string, greeting?: string) => void;
  /** Called when handoff context is received */
  onHandoffContext?: (summary?: string, variables?: Record<string, unknown>) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER PROPS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetRenderProps {
  /** Custom renderer for message bubbles */
  renderMessage?: (message: ChatMessage, defaultRenderer: () => ReactNode) => ReactNode;
  /** Custom renderer for the header */
  renderHeader?: (props: { title: string; isOnline: boolean; onClose: () => void }) => ReactNode;
  /** Custom renderer for the input area */
  renderInput?: (props: { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean }) => ReactNode;
  /** Custom renderer for the launcher button */
  renderLauncher?: (props: { onClick: () => void; unreadCount: number }) => ReactNode;
  /** Custom renderer for suggested replies */
  renderSuggestedReplies?: (replies: SuggestedReply[], onClick: (reply: SuggestedReply) => void) => ReactNode;
  /** Custom renderer for empty state */
  renderEmptyState?: () => ReactNode;
  /** Custom renderer for loading state */
  renderLoading?: () => ReactNode;
  /** Custom renderer for error state */
  renderError?: (error: Error, retry: () => void) => ReactNode;
  /** Custom renderer for typing indicator */
  renderTypingIndicator?: () => ReactNode;
  /** Custom renderer for message timestamp */
  renderTimestamp?: (timestamp: Date) => ReactNode;
  /** Custom renderer for message status */
  renderMessageStatus?: (status: MessageStatus) => ReactNode;
  /** Custom avatar for assistant messages */
  renderAssistantAvatar?: () => ReactNode;
  /** Custom avatar for user messages */
  renderUserAvatar?: () => ReactNode;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE INPUT CONTROLS
// ═══════════════════════════════════════════════════════════════════════════════

export interface MessageInputControls {
  /** Block input while bot is responding. If number, auto-unblock after ms. */
  blockWhileBotResponding?: boolean | number;
  /** Maximum message length */
  maxLength?: number;
  /** Enable/disable file attachments */
  enableAttachments?: boolean;
  /** Enable/disable voice input */
  enableVoiceInput?: boolean;
  /** Enable/disable emoji picker */
  enableEmojiPicker?: boolean;
  /** Accepted file types for attachments */
  acceptedFileTypes?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WIDGET PROPS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetProps {
  // ─────────────────────────────────────────────────────────────────────────────
  // Required Props
  // ─────────────────────────────────────────────────────────────────────────────

  /** Your BO Support agent ID */
  agentId: string;

  /** Team ID for multi-agent team conversations (alternative to single agent) */
  teamId?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // API Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /** API base URL (default: auto-detected from script src) */
  apiBaseUrl?: string;

  /** WebSocket URL for real-time updates */
  websocketUrl?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // User Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /** User ID for authenticated sessions */
  userId?: string;

  /** User nickname displayed in chat */
  userNickname?: string;

  /** User profile image URL */
  userProfileUrl?: string;

  /** User email for identification */
  userEmail?: string;

  /** Additional user metadata */
  userMetadata?: Record<string, string>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Session & Authentication
  // ─────────────────────────────────────────────────────────────────────────────

  /** Session token for authenticated access */
  sessionToken?: string;

  /** Session configuration handler */
  configureSession?: () => SessionHandler;

  /** Session ID for continuing conversations */
  sessionId?: string;

  /** Reset chat history on each connect (default: false) */
  enableResetHistoryOnConnect?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Appearance
  // ─────────────────────────────────────────────────────────────────────────────

  /** Theme customization */
  theme?: ChatWidgetTheme;

  /** Style overrides */
  styles?: ChatWidgetStyles;

  /** Device type override (default: auto-detected) */
  deviceType?: 'desktop' | 'mobile';

  /** Widget position (default: 'bottom-right') */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /** Z-index for the widget (default: 9999) */
  zIndex?: number;

  /** Widget width in pixels or CSS value (default: 380) */
  width?: number | string;

  /** Widget height in pixels or CSS value (default: 600) */
  height?: number | string;

  /** Offset from screen edge in pixels (default: 20) */
  offset?: { x?: number; y?: number };

  /** Enable dark mode (default: false, follows system if undefined) */
  darkMode?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Behavior
  // ─────────────────────────────────────────────────────────────────────────────

  /** Auto-open widget on page load (default: false) */
  autoOpen?: boolean;

  /** Delay before auto-opening in seconds (default: 0) */
  autoOpenDelay?: number;

  /** Show/hide the widget (default: true) */
  visible?: boolean;

  /** Start in expanded/fullscreen mode (default: false) */
  startExpanded?: boolean;

  /** Enable widget expand button (default: false) */
  enableWidgetExpandButton?: boolean;

  /** Hide widget for deactivated users (default: false) */
  enableHideWidgetForDeactivatedUser?: boolean;

  /** Message stack direction (default: 'bottom') */
  messageStackDirection?: 'top' | 'bottom';

  /** Enable smooth scroll (default: true) */
  enableSmoothScroll?: boolean;

  /** Auto-scroll to new messages (default: true) */
  autoScrollToBottom?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Features
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable emoji feedback on messages (default: true) */
  enableEmojiFeedback?: boolean;

  /** Enable @mentions (default: false) */
  enableMention?: boolean;

  /** Enable markdown rendering (default: true) */
  enableMarkdown?: boolean;

  /** Enable code syntax highlighting (default: true) */
  enableCodeHighlight?: boolean;

  /** Enable link previews (default: false) */
  enableLinkPreview?: boolean;

  /** Enable typing indicators (default: true) */
  enableTypingIndicator?: boolean;

  /** Enable message timestamps (default: true) */
  enableTimestamps?: boolean;

  /** Enable message read receipts (default: false) */
  enableReadReceipts?: boolean;

  /** Enable sound notifications (default: false) */
  enableSoundNotifications?: boolean;

  /** Enable suggested replies (default: true) */
  enableSuggestedReplies?: boolean;

  /** Enable message retry on failure (default: true) */
  enableMessageRetry?: boolean;

  // ─────────────────────────────────────────────────────────────────────────────
  // Content
  // ─────────────────────────────────────────────────────────────────────────────

  /** Greeting message shown when chat starts */
  greeting?: string;

  /** Agent name displayed in header */
  agentName?: string;

  /** Agent avatar URL */
  agentAvatarUrl?: string;

  /** Suggested replies to show initially */
  initialSuggestedReplies?: SuggestedReply[];

  /** Placeholder text for input */
  inputPlaceholder?: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Localization
  // ─────────────────────────────────────────────────────────────────────────────

  /** Custom string set for i18n */
  stringSet?: Partial<ChatWidgetStringSet>;

  /** Date locale from date-fns (default: enUS) */
  dateLocale?: Locale;

  /** Text direction (default: 'ltr') */
  textDirection?: 'ltr' | 'rtl';

  // ─────────────────────────────────────────────────────────────────────────────
  // Input Controls
  // ─────────────────────────────────────────────────────────────────────────────

  /** Message input behavior controls */
  messageInputControls?: MessageInputControls;

  // ─────────────────────────────────────────────────────────────────────────────
  // Custom Components
  // ─────────────────────────────────────────────────────────────────────────────

  /** Custom refresh component */
  customRefreshComponent?: CustomRefreshComponent;

  /** Custom launcher button component */
  customLauncherComponent?: CustomLauncherComponent;

  /** Custom header component */
  customHeaderComponent?: CustomHeaderComponent;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render Props
  // ─────────────────────────────────────────────────────────────────────────────

  /** Custom render functions */
  renderProps?: ChatWidgetRenderProps;

  // ─────────────────────────────────────────────────────────────────────────────
  // Event Handlers
  // ─────────────────────────────────────────────────────────────────────────────

  /** Event handlers */
  eventHandlers?: ChatWidgetEventHandlers;

  // ─────────────────────────────────────────────────────────────────────────────
  // Advanced
  // ─────────────────────────────────────────────────────────────────────────────

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Custom CSS class name */
  className?: string;

  /** Test ID for e2e testing */
  testId?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChatWidgetContextValue {
  // State
  isOpen: boolean;
  isExpanded: boolean;
  isConnected: boolean;
  isTyping: boolean;
  messages: ChatMessage[];
  unreadCount: number;
  error: Error | null;
  /** Current agent ID (may change during team handoffs) */
  currentAgentId: string;
  /** Current agent name (may change during team handoffs) */
  currentAgentName: string;

  // Actions
  open: () => void;
  close: () => void;
  toggle: () => void;
  expand: () => void;
  collapse: () => void;
  sendMessage: (content: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  clearHistory: () => void;
  setTyping: (isTyping: boolean) => void;

  // Config
  config: ChatWidgetProps;
  theme: Required<ChatWidgetTheme>;
  strings: Required<ChatWidgetStringSet>;
}
