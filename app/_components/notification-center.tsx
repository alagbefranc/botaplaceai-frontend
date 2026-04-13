"use client";

import React, { useState } from "react";
import {
  Badge,
  Button,
  Dropdown,
  Empty,
  Flex,
  Segmented,
  Space,
  Spin,
  Tooltip,
  Typography,
} from "antd";
import {
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  InfoCircleFilled,
  PhoneFilled,
  MessageFilled,
  RocketFilled,
  SwapOutlined,
  ThunderboltFilled,
  WarningFilled,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  useNotifications,
  type AppNotification,
  type NotificationType,
} from "./notification-provider";

// ── Icon + color mapping ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ReactNode; color: string; label: string }
> = {
  escalation: {
    icon: <ExclamationCircleFilled />,
    color: "#FF4D4F",
    label: "Escalation",
  },
  transfer_to_human: {
    icon: <ThunderboltFilled />,
    color: "#FF7A45",
    label: "Human Transfer",
  },
  transfer_to_agent: {
    icon: <SwapOutlined />,
    color: "#1890FF",
    label: "Agent Handoff",
  },
  new_conversation: {
    icon: <PhoneFilled />,
    color: "#17DEBC",
    label: "New Conversation",
  },
  mission_complete: {
    icon: <RocketFilled />,
    color: "#52C41A",
    label: "Mission Complete",
  },
  mission_failed: {
    icon: <WarningFilled />,
    color: "#FF4D4F",
    label: "Mission Failed",
  },
  new_message: {
    icon: <MessageFilled />,
    color: "#722ED1",
    label: "New Message",
  },
  agent_error: {
    icon: <WarningFilled />,
    color: "#FA541C",
    label: "Agent Error",
  },
  system: {
    icon: <InfoCircleFilled />,
    color: "#8C8C8C",
    label: "System",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Single notification item ─────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onClick,
}: {
  notification: AppNotification;
  onMarkRead: () => void;
  onDismiss: () => void;
  onClick: () => void;
}) {
  const cfg = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "10px 14px",
        cursor: "pointer",
        borderBottom: "1px solid #f0f0f0",
        background: notification.read ? "transparent" : "rgba(23, 222, 188, 0.04)",
        transition: "background 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = notification.read
          ? "transparent"
          : "rgba(23, 222, 188, 0.04)";
      }}
    >
      <Flex gap={10} align="flex-start">
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${cfg.color}15`,
            color: cfg.color,
            fontSize: 16,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {cfg.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Flex justify="space-between" align="center">
            <Typography.Text
              strong={!notification.read}
              style={{ fontSize: 13, lineHeight: "18px" }}
              ellipsis
            >
              {notification.title}
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, flexShrink: 0, marginLeft: 8 }}
            >
              {timeAgo(notification.created_at)}
            </Typography.Text>
          </Flex>
          {notification.body && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, lineHeight: "16px", display: "block", marginTop: 2 }}
              ellipsis
            >
              {notification.body}
            </Typography.Text>
          )}
          <Flex gap={4} style={{ marginTop: 4 }}>
            <Typography.Text
              style={{
                fontSize: 10,
                color: cfg.color,
                background: `${cfg.color}12`,
                padding: "1px 6px",
                borderRadius: 4,
                fontWeight: 500,
              }}
            >
              {cfg.label}
            </Typography.Text>
            {notification.priority === "urgent" && (
              <Typography.Text
                style={{
                  fontSize: 10,
                  color: "#FF4D4F",
                  background: "#FF4D4F12",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                URGENT
              </Typography.Text>
            )}
          </Flex>
        </div>
        <Space size={2} style={{ flexShrink: 0 }}>
          {!notification.read && (
            <Tooltip title="Mark read">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined style={{ fontSize: 11 }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead();
                }}
                style={{ width: 24, height: 24, padding: 0 }}
              />
            </Tooltip>
          )}
          <Tooltip title="Dismiss">
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ fontSize: 11 }} />}
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              style={{ width: 24, height: 24, padding: 0 }}
            />
          </Tooltip>
        </Space>
      </Flex>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function NotificationCenter() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllRead,
    dismiss,
    clearAll,
  } = useNotifications();

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [open, setOpen] = useState(false);

  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  const handleClick = (n: AppNotification) => {
    if (!n.read) markAsRead([n.id]);
    setOpen(false);

    // Deep link based on type
    if (n.conversation_id && (n.type === "new_conversation" || n.type === "escalation" || n.type === "new_message")) {
      router.push(`/conversations?id=${n.conversation_id}`);
    } else if (n.mission_id) {
      router.push(`/missions/${n.mission_id}`);
    } else if (n.conversation_id) {
      router.push(`/conversations?id=${n.conversation_id}`);
    }
  };

  const dropdownContent = (
    <div
      style={{
        width: 380,
        maxHeight: 520,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
        border: "1px solid #f0f0f0",
      }}
    >
      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Typography.Text strong style={{ fontSize: 15 }}>
          Notifications
          {unreadCount > 0 && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, marginLeft: 6 }}
            >
              ({unreadCount} unread)
            </Typography.Text>
          )}
        </Typography.Text>
        <Space size={4}>
          {unreadCount > 0 && (
            <Tooltip title="Mark all read">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  markAllRead();
                }}
              />
            </Tooltip>
          )}
          {notifications.length > 0 && (
            <Tooltip title="Clear all">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              />
            </Tooltip>
          )}
        </Space>
      </Flex>

      {/* Filter */}
      <div style={{ padding: "8px 14px 4px" }}>
        <Segmented
          size="small"
          value={filter}
          onChange={(val) => setFilter(val as "all" | "unread")}
          options={[
            { label: "All", value: "all" },
            { label: `Unread (${unreadCount})`, value: "unread" },
          ]}
          block
        />
      </div>

      {/* List */}
      <div
        style={{
          maxHeight: 400,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {loading && notifications.length === 0 ? (
          <Flex justify="center" align="center" style={{ padding: 40 }}>
            <Spin size="small" />
          </Flex>
        ) : filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              filter === "unread" ? "No unread notifications" : "No notifications yet"
            }
            style={{ padding: "30px 0" }}
          />
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={() => markAsRead([n.id])}
              onDismiss={() => dismiss([n.id])}
              onClick={() => handleClick(n)}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={["click"]}
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Tooltip title="Notifications" placement="left">
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            shape="circle"
            className="right-rail-link"
            icon={
              <BellOutlined
                style={{
                  fontSize: 20,
                  color: unreadCount > 0 ? "#17DEBC" : "#1E293B",
                }}
              />
            }
            aria-label="Notifications"
          />
        </Badge>
      </Tooltip>
    </Dropdown>
  );
}
