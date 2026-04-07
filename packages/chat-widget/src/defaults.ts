import type { ChatWidgetTheme, ChatWidgetStringSet } from './types';

export const defaultTheme: Required<ChatWidgetTheme> = {
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  secondaryTextColor: '#6b7280',
  borderColor: '#e5e7eb',
  userBubbleColor: '#6366f1',
  userTextColor: '#ffffff',
  assistantBubbleColor: '#f3f4f6',
  assistantTextColor: '#1f2937',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  borderRadius: 16,
  bubbleBorderRadius: 12,
};

export const defaultStringSet: Required<ChatWidgetStringSet> = {
  // Header
  headerTitle: 'Chat with us',
  headerSubtitle: 'We typically reply within a few minutes',
  headerOnlineStatus: 'Online',
  headerOfflineStatus: 'Offline',
  headerTypingIndicator: 'is typing...',

  // Input
  inputPlaceholder: 'Type a message...',
  inputPlaceholderDisabled: 'Chat is currently unavailable',
  inputSendButton: 'Send',
  inputAttachButton: 'Attach file',
  inputVoiceButton: 'Voice message',

  // Messages
  messageDelivered: 'Delivered',
  messageRead: 'Read',
  messageFailed: 'Failed to send',
  messageRetry: 'Retry',
  messageDeleted: 'This message was deleted',

  // Timestamps
  timestampToday: 'Today',
  timestampYesterday: 'Yesterday',
  timestampJustNow: 'Just now',
  timestampMinutesAgo: '{count} min ago',
  timestampHoursAgo: '{count}h ago',

  // Actions
  actionCopy: 'Copy',
  actionRetry: 'Retry',
  actionDelete: 'Delete',
  actionEdit: 'Edit',

  // Feedback
  feedbackHelpful: 'Was this helpful?',
  feedbackNotHelpful: 'Not helpful',
  feedbackThanks: 'Thanks for your feedback!',

  // States
  stateConnecting: 'Connecting...',
  stateReconnecting: 'Reconnecting...',
  stateOffline: 'You are offline',
  stateError: 'Something went wrong',

  // Empty state
  emptyStateTitle: 'Start a conversation',
  emptyStateDescription: 'Send a message to begin chatting with our AI assistant.',

  // Errors
  errorGeneric: 'Something went wrong. Please try again.',
  errorNetwork: 'Network error. Please check your connection.',
  errorRateLimit: 'Too many messages. Please wait a moment.',
};

