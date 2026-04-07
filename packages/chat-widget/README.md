# @bo-support/chat-widget

Embeddable AI Chat Widget for BO Support Platform. A modern, customizable chat widget built with React and Ant Design X.

## Installation

```bash
npm install @bo-support/chat-widget
# or
yarn add @bo-support/chat-widget
# or
pnpm add @bo-support/chat-widget
```

## Quick Start

```tsx
import { ChatWidget } from '@bo-support/chat-widget';

function App() {
  return (
    <ChatWidget
      agentId="your-agent-id"
      greeting="Hi! How can I help you today?"
    />
  );
}
```

## Available Props

### Required Props

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `agentId` | `string` | **Yes** | N/A | Your BO Support agent ID |

### API Configuration

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `apiBaseUrl` | `string` | No | Auto-detected | API base URL for the chat service |
| `websocketUrl` | `string` | No | N/A | WebSocket URL for real-time updates |

### User Configuration

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `userId` | `string` | No | N/A | User ID for authenticated sessions. Must be used with `sessionToken` and `configureSession`. |
| `userNickname` | `string` | No | N/A | The nickname of the user displayed in chat |
| `userProfileUrl` | `string` | No | N/A | User's profile image URL |
| `userEmail` | `string` | No | N/A | User email for identification |
| `userMetadata` | `Record<string, string>` | No | N/A | Additional user metadata |

### Session & Authentication

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `sessionToken` | `string` | No | N/A | Session token for authenticated access. Must be used with `userId` and `configureSession`. |
| `configureSession` | `() => SessionHandler` | No | N/A | Session configuration handler. Must be used with `userId` and `sessionToken`. |
| `sessionId` | `string` | No | Auto-generated | Session ID for continuing conversations |
| `enableResetHistoryOnConnect` | `boolean` | No | `false` | Determines whether the chat history is reset when the user connects |

### Appearance

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `theme` | `ChatWidgetTheme` | No | See defaults | Theme customization object |
| `styles` | `ChatWidgetStyles` | No | N/A | Style overrides for specific elements |
| `deviceType` | `'desktop' \| 'mobile'` | No | Auto-detected | Device type to be used in the widget |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | No | `'bottom-right'` | Widget position on screen |
| `zIndex` | `number` | No | `9999` | Z-index for the widget |
| `width` | `number \| string` | No | `380` | Widget width in pixels or CSS value |
| `height` | `number \| string` | No | `600` | Widget height in pixels or CSS value |
| `offset` | `{ x?: number; y?: number }` | No | `{ x: 20, y: 20 }` | Offset from screen edge in pixels |
| `darkMode` | `boolean` | No | `undefined` | Enable dark mode (follows system if undefined) |

### Behavior

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `autoOpen` | `boolean` | No | `false` | Determines whether the widget automatically opens when the browser window is opened. This property is ignored in mobile view. |
| `autoOpenDelay` | `number` | No | `0` | Delay before auto-opening in seconds |
| `visible` | `boolean` | No | `true` | Show/hide the widget |
| `startExpanded` | `boolean` | No | `false` | Start in expanded/fullscreen mode |
| `enableWidgetExpandButton` | `boolean` | No | `false` | Determines whether the expand button is displayed in the widget |
| `enableHideWidgetForDeactivatedUser` | `boolean` | No | `false` | Determines whether the widget is hidden when the user is deactivated |
| `messageStackDirection` | `'top' \| 'bottom'` | No | `'bottom'` | Determines direction at which message stack starts in the message list |
| `enableSmoothScroll` | `boolean` | No | `true` | Enable smooth scrolling in message list |
| `autoScrollToBottom` | `boolean` | No | `true` | Auto-scroll to new messages |

### Features

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `enableEmojiFeedback` | `boolean` | No | `true` | Enables emoji feedback functionality on messages |
| `enableMention` | `boolean` | No | `false` | Enables @mention functionality |
| `enableMarkdown` | `boolean` | No | `true` | Enable markdown rendering in messages |
| `enableCodeHighlight` | `boolean` | No | `true` | Enable code syntax highlighting |
| `enableLinkPreview` | `boolean` | No | `false` | Enable link previews in messages |
| `enableTypingIndicator` | `boolean` | No | `true` | Show typing indicator when agent is responding |
| `enableTimestamps` | `boolean` | No | `true` | Show message timestamps |
| `enableReadReceipts` | `boolean` | No | `false` | Enable message read receipts |
| `enableSoundNotifications` | `boolean` | No | `false` | Enable sound notifications for new messages |
| `enableSuggestedReplies` | `boolean` | No | `true` | Enable suggested replies feature |
| `enableMessageRetry` | `boolean` | No | `true` | Enable retry button for failed messages |

### Content

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `greeting` | `string` | No | N/A | Greeting message shown when chat starts |
| `agentName` | `string` | No | N/A | Agent name displayed in header |
| `agentAvatarUrl` | `string` | No | N/A | Agent avatar image URL |
| `initialSuggestedReplies` | `SuggestedReply[]` | No | N/A | Suggested replies to show initially |
| `inputPlaceholder` | `string` | No | `'Type a message...'` | Placeholder text for input field |

### Localization

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `stringSet` | `Partial<ChatWidgetStringSet>` | No | See defaults | Customizable string set for i18n. [Available strings](#string-set) |
| `dateLocale` | `Locale` | No | `enUS` | Locale value from `date-fns` for timestamps |
| `textDirection` | `'ltr' \| 'rtl'` | No | `'ltr'` | Text direction for RTL language support |

### Input Controls

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `messageInputControls.blockWhileBotResponding` | `boolean \| number` | No | N/A | Allows to control enabled/disabled state of the message input while waiting for the bot's reply. If number is given, a timer will force unblock after that many milliseconds. |
| `messageInputControls.maxLength` | `number` | No | N/A | Maximum message length |
| `messageInputControls.enableAttachments` | `boolean` | No | `false` | Enable file attachments |
| `messageInputControls.enableVoiceInput` | `boolean` | No | `false` | Enable voice input |
| `messageInputControls.enableEmojiPicker` | `boolean` | No | `false` | Enable emoji picker |
| `messageInputControls.acceptedFileTypes` | `string[]` | No | N/A | Accepted file types for attachments |
| `messageInputControls.maxFileSize` | `number` | No | N/A | Maximum file size in bytes |

### Custom Components

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `customRefreshComponent` | `CustomRefreshComponent` | No | N/A | Customizable refresh component. You can set properties such as `icon`, `style`, `width`, `height`, and `onClick`. |
| `customLauncherComponent` | `CustomLauncherComponent` | No | N/A | Customizable launcher button component |
| `customHeaderComponent` | `CustomHeaderComponent` | No | N/A | Customizable header component |

### Render Props

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `renderProps.renderMessage` | `(message, defaultRenderer) => ReactNode` | No | N/A | Custom renderer for message bubbles |
| `renderProps.renderHeader` | `(props) => ReactNode` | No | N/A | Custom renderer for the header |
| `renderProps.renderInput` | `(props) => ReactNode` | No | N/A | Custom renderer for the input area |
| `renderProps.renderLauncher` | `(props) => ReactNode` | No | N/A | Custom renderer for the launcher button |
| `renderProps.renderEmptyState` | `() => ReactNode` | No | N/A | Custom renderer for empty state |
| `renderProps.renderLoading` | `() => ReactNode` | No | N/A | Custom renderer for loading state |
| `renderProps.renderError` | `(error, retry) => ReactNode` | No | N/A | Custom renderer for error state |
| `renderProps.renderTypingIndicator` | `() => ReactNode` | No | N/A | Custom renderer for typing indicator |
| `renderProps.renderAssistantAvatar` | `() => ReactNode` | No | N/A | Custom avatar for assistant messages |
| `renderProps.renderUserAvatar` | `() => ReactNode` | No | N/A | Custom avatar for user messages |

### Event Handlers

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `eventHandlers.onMessageSent` | `(message) => void` | No | N/A | Called when user sends a message |
| `eventHandlers.onMessageReceived` | `(message) => void` | No | N/A | Called when a message is received |
| `eventHandlers.onFeedback` | `(feedback) => void` | No | N/A | Called when user provides feedback |
| `eventHandlers.onOpen` | `() => void` | No | N/A | Called when widget is opened |
| `eventHandlers.onClose` | `() => void` | No | N/A | Called when widget is closed |
| `eventHandlers.onExpand` | `() => void` | No | N/A | Called when widget is expanded |
| `eventHandlers.onCollapse` | `() => void` | No | N/A | Called when widget is collapsed |
| `eventHandlers.onTypingStart` | `() => void` | No | N/A | Called when user starts typing |
| `eventHandlers.onTypingEnd` | `() => void` | No | N/A | Called when user stops typing |
| `eventHandlers.onConnect` | `(sessionId) => void` | No | N/A | Called when session connects |
| `eventHandlers.onDisconnect` | `() => void` | No | N/A | Called when session disconnects |
| `eventHandlers.onError` | `(error) => void` | No | N/A | Called on any error |

### Advanced

| Prop Name | Type | Required | Default Value | Description |
|-----------|------|----------|---------------|-------------|
| `debug` | `boolean` | No | `false` | Enable debug logging |
| `className` | `string` | No | N/A | Custom CSS class name |
| `testId` | `string` | No | N/A | Test ID for e2e testing |

## Theme Customization

```tsx
<ChatWidget
  agentId="your-agent-id"
  theme={{
    primaryColor: '#6366f1',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    userBubbleColor: '#6366f1',
    userTextColor: '#ffffff',
    assistantBubbleColor: '#f3f4f6',
    assistantTextColor: '#1f2937',
    borderRadius: 16,
    bubbleBorderRadius: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
  }}
/>
```

## String Set

You can customize all text strings in the widget:

```tsx
<ChatWidget
  agentId="your-agent-id"
  stringSet={{
    headerTitle: 'Chat Support',
    inputPlaceholder: 'Ask me anything...',
    emptyStateTitle: 'Welcome!',
    emptyStateDescription: 'How can we help you today?',
  }}
/>
```

## Session Authentication

For authenticated users:

```tsx
<ChatWidget
  agentId="your-agent-id"
  userId="user-123"
  sessionToken="your-session-token"
  configureSession={() => ({
    onSessionTokenRequired: async () => {
      const response = await fetch('/api/auth/chat-token');
      const { token } = await response.json();
      return token;
    },
    onSessionClosed: () => console.log('Session closed'),
    onSessionError: (error) => console.error('Session error:', error),
    onSessionRefresh: async () => {
      const response = await fetch('/api/auth/refresh-token');
      const { token } = await response.json();
      return token;
    },
  })}
/>
```

## useChatWidget Hook

Access widget state and actions from child components:

```tsx
import { ChatWidgetProvider, useChatWidget } from '@bo-support/chat-widget';

function CustomButton() {
  const { open, close, isOpen, sendMessage } = useChatWidget();
  
  return (
    <button onClick={isOpen ? close : open}>
      {isOpen ? 'Close Chat' : 'Open Chat'}
    </button>
  );
}
```

## Embed Script (Non-React)

For non-React applications, use the embed script:

```html
<script
  src="https://your-domain.com/widget.js"
  data-agent-id="your-agent-id"
  data-position="bottom-right"
  data-primary-color="#6366f1"
  data-greeting="Hi! How can I help you?"
></script>
```

## License

MIT
