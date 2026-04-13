"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "escalation"
  | "transfer_to_human"
  | "transfer_to_agent"
  | "new_conversation"
  | "mission_complete"
  | "mission_failed"
  | "new_message"
  | "agent_error"
  | "system";

export interface AppNotification {
  id: string;
  org_id: string;
  user_id: string | null;
  type: NotificationType;
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  body: string | null;
  agent_id: string | null;
  conversation_id: string | null;
  mission_id: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  read_at: string | null;
  dismissed: boolean;
  created_at: string;
  updated_at: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (ids: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  markAsRead: async () => {},
  markAllRead: async () => {},
  dismiss: async () => {},
  clearAll: async () => {},
  refresh: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

// ── Sound ────────────────────────────────────────────────────────────────────

const NOTIFICATION_SOUND_URL = "/assets/sounds/notification.mp3";
let audioRef: HTMLAudioElement | null = null;

function playNotificationSound() {
  try {
    if (!audioRef && typeof window !== "undefined") {
      audioRef = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.volume = 0.4;
    }
    audioRef?.play().catch(() => {});
  } catch {
    // Ignore audio errors
  }
}

// ── Browser notification ─────────────────────────────────────────────────────

function showBrowserNotification(n: AppNotification) {
  if (typeof window === "undefined") return;
  if (Notification.permission !== "granted") return;

  const tag = `botaplace-${n.id}`;
  new Notification(n.title, {
    body: n.body || undefined,
    tag,
    icon: "/bota-logo.png",
    silent: true,
  });
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const orgIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // Ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Initial load + get org_id for realtime subscription
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (profile?.org_id) {
        orgIdRef.current = profile.org_id;
        await fetchNotifications();
        initialLoadDone.current = true;
      }
    };

    init();
  }, [fetchNotifications]);

  // Subscribe to realtime inserts on notifications table
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    // Poll until we have org_id
    const interval = setInterval(() => {
      if (!orgIdRef.current) return;
      clearInterval(interval);

      const channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `org_id=eq.${orgIdRef.current}`,
          },
          (payload) => {
            const newNotification = payload.new as AppNotification;

            setNotifications((prev) => [newNotification, ...prev].slice(0, 100));
            setUnreadCount((prev) => prev + 1);

            // Play sound for high/urgent priority
            if (newNotification.priority === "high" || newNotification.priority === "urgent") {
              playNotificationSound();
            }

            // Show browser notification
            showBrowserNotification(newNotification);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Actions
  const markAsRead = useCallback(async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - ids.length));
  }, []);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    setUnreadCount((prev) =>
      Math.max(0, prev - notifications.filter((n) => ids.includes(n.id) && !n.read).length)
    );
  }, [notifications]);

  const clearAll = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAll: true }),
    });
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllRead,
        dismiss,
        clearAll,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
