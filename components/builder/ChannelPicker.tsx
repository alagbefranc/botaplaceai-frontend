"use client";

import {
  AudioOutlined,
  MessageOutlined,
  PhoneOutlined,
  WhatsAppOutlined,
} from "@ant-design/icons";
import { Button, Col, Row, Switch, Tag, Typography } from "antd";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";
import type { ChannelKey } from "@/lib/domain/agent-builder";

const CHANNELS: Array<{
  id: ChannelKey;
  name: string;
  icon: React.ReactNode;
  color: string;
  available: boolean;
}> = [
  { id: "web_chat", name: "Web Chat", icon: <MessageOutlined />, color: "#6C5CE7", available: true },
  { id: "web_voice", name: "Voice Chat", icon: <AudioOutlined />, color: "#06B6D4", available: true },
  { id: "phone", name: "Phone", icon: <PhoneOutlined />, color: "#22C55E", available: true },
  { id: "whatsapp", name: "WhatsApp", icon: <WhatsAppOutlined />, color: "#22C55E", available: false },
];

interface ChannelPickerProps {
  onContinue?: () => void;
}

export function ChannelPicker({ onContinue }: ChannelPickerProps) {
  const { draft, toggleChannel } = useAgentBuilderStore();

  return (
    <div className="builder-inline-card">
      <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
        Where should this agent be available?
      </Typography.Text>

      <Row gutter={[12, 12]}>
        {CHANNELS.map((channel) => {
          const isSelected = draft.channels.includes(channel.id);

          return (
            <Col span={12} key={channel.id}>
              <div className="channel-card">
                <div className="channel-info">
                  <span
                    className="channel-icon"
                    style={{ backgroundColor: channel.color }}
                  >
                    {channel.icon}
                  </span>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {channel.name}
                  </Typography.Text>
                </div>
                {channel.available ? (
                  <Switch
                    checked={isSelected}
                    onChange={() => toggleChannel(channel.id)}
                    size="small"
                  />
                ) : (
                  <Tag color="default" style={{ margin: 0 }}>
                    Coming soon
                  </Tag>
                )}
              </div>
            </Col>
          );
        })}
      </Row>

      {onContinue && (
        <Button
          type="primary"
          onClick={onContinue}
          disabled={draft.channels.length === 0}
          style={{ marginTop: 12 }}
        >
          Continue
        </Button>
      )}
    </div>
  );
}
