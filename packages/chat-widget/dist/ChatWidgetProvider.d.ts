import React from 'react';
import type { ChatWidgetProps, ChatWidgetContextValue } from './types';
export declare function useChatWidget(): ChatWidgetContextValue;
interface ChatWidgetProviderProps extends ChatWidgetProps {
    children: React.ReactNode;
}
export declare function ChatWidgetProvider({ children, ...props }: ChatWidgetProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ChatWidgetProvider.d.ts.map