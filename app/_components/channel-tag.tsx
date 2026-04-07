"use client";

import {
  AudioOutlined,
  MessageOutlined,
  MobileOutlined,
  PhoneOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { Space, Tag } from "antd";
import type React from "react";

/** Channel display config — icon + label + color, used consistently across all tables */
export const channelConfig: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  web_chat: { icon: <MessageOutlined />, label: "Chat", color: "blue" },
  web_voice: { icon: <AudioOutlined />, label: "Voice", color: "cyan" },
  phone: { icon: <PhoneOutlined />, label: "Phone", color: "green" },
  whatsapp: { icon: <WhatsAppOutlined />, label: "WhatsApp", color: "green" },
  sms: { icon: <MobileOutlined />, label: "SMS", color: "volcano" },
};

/** Renders a single consistent channel tag with icon */
export function ChannelTag({ channel }: { channel: string }) {
  const cfg = channelConfig[channel];
  if (!cfg) return <Tag style={{ display: "inline-flex", alignItems: "center" }}>{channel}</Tag>;
  return (
    <Tag
      icon={cfg.icon}
      color={cfg.color}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {cfg.label}
    </Tag>
  );
}

/** Renders a group of channel tags — drop-in for any table's channels column */
export function ChannelTags({ channels }: { channels: string[] }) {
  const list = channels.length > 0 ? channels : ["web_chat"];
  return (
    <Space wrap size={4}>
      {list.map((ch) => (
        <ChannelTag key={ch} channel={ch} />
      ))}
    </Space>
  );
}
