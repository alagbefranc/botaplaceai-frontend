"use client";

import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Badge, Button, Card, Empty, Flex, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNotification } from "@telnyx/react-client";

const { Text, Paragraph } = Typography;

interface HandoffContext {
  id: string;
  reason: string | null;
  summary: string | null;
  department: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  caller_number: string | null;
  created_at: string;
}

interface IncomingCallPanelProps {
  onAnswer?: () => void;
  onDecline?: () => void;
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  urgent: { color: "red", label: "Urgent" },
  high: { color: "orange", label: "High" },
  normal: { color: "blue", label: "Normal" },
  low: { color: "default", label: "Low" },
};

export function IncomingCallPanel({ onAnswer, onDecline }: IncomingCallPanelProps) {
  const notification = useNotification();
  const [handoffContext, setHandoffContext] = useState<HandoffContext | null>(null);
  
  const activeCall = notification?.call;
  const isRinging = activeCall?.state === "ringing";
  const callerNumber = activeCall?.remoteCallerNumber;
  const callerName = activeCall?.remoteCallerName;

  // Fetch handoff context when call is ringing
  useEffect(() => {
    if (!isRinging || !callerNumber) {
      setHandoffContext(null);
      return;
    }

    // Try to find pending handoff for this caller
    const fetchHandoffContext = async () => {
      try {
        const response = await fetch(
          `/api/handoffs?status=pending&caller_number=${encodeURIComponent(callerNumber)}&limit=1`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.handoffs?.[0]) {
            setHandoffContext(data.handoffs[0]);
          }
        }
      } catch (err) {
        console.error("[IncomingCallPanel] Failed to fetch handoff context:", err);
      }
    };

    fetchHandoffContext();
  }, [isRinging, callerNumber]);

  const handleAnswer = useCallback(() => {
    if (activeCall) {
      activeCall.answer();
      onAnswer?.();
    }
  }, [activeCall, onAnswer]);

  const handleDecline = useCallback(() => {
    if (activeCall) {
      activeCall.hangup();
      onDecline?.();
    }
  }, [activeCall, onDecline]);

  const formatTimeAgo = (dateStr: string): string => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const pri = handoffContext 
    ? PRIORITY_CONFIG[handoffContext.priority] || PRIORITY_CONFIG.normal
    : null;

  return (
    <Card 
      title={
        <Flex align="center" gap={8}>
          <Badge dot={isRinging} status="processing" offset={[-2, 2]}>
            <PhoneOutlined />
          </Badge>
          <span>Incoming Calls</span>
          {isRinging && (
            <Tag color="red" style={{ marginLeft: 8 }}>Ringing</Tag>
          )}
        </Flex>
      }
      styles={{ body: { padding: isRinging ? 16 : 24 } }}
    >
      {isRinging ? (
        <div
          style={{
            animation: "pulse 1.5s ease-in-out infinite",
            borderRadius: 8,
            padding: 16,
            background: "linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)",
            border: "1px solid rgba(24, 144, 255, 0.3)",
          }}
        >
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.8; }
            }
          `}</style>
          
          <Flex vertical gap={12}>
            {/* Caller Info */}
            <Flex align="center" gap={12}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#1677ff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserOutlined style={{ fontSize: 24, color: "#fff" }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 16, display: "block" }}>
                  {callerName || callerNumber || "Unknown Caller"}
                </Text>
                {callerName && callerNumber && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {callerNumber}
                  </Text>
                )}
              </div>
              {pri && (
                <Tag color={pri.color} style={{ marginLeft: "auto" }}>
                  {pri.label}
                </Tag>
              )}
            </Flex>

            {/* Handoff Context */}
            {handoffContext && (
              <div style={{ paddingLeft: 60 }}>
                {handoffContext.reason && (
                  <Paragraph 
                    ellipsis={{ rows: 2 }} 
                    style={{ margin: 0, fontSize: 13 }}
                  >
                    <Text type="secondary">Reason: </Text>
                    {handoffContext.reason}
                  </Paragraph>
                )}
                
                <Space size={8} style={{ marginTop: 8 }}>
                  {handoffContext.department && (
                    <Tag>{handoffContext.department}</Tag>
                  )}
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {formatTimeAgo(handoffContext.created_at)}
                  </Text>
                </Space>
              </div>
            )}

            {/* Action Buttons */}
            <Flex gap={12} justify="center" style={{ marginTop: 8 }}>
              <Button
                type="primary"
                size="large"
                icon={<CheckOutlined />}
                onClick={handleAnswer}
                style={{ 
                  minWidth: 120,
                  background: "#52c41a",
                  borderColor: "#52c41a",
                }}
              >
                Answer
              </Button>
              <Button
                danger
                size="large"
                icon={<CloseOutlined />}
                onClick={handleDecline}
                style={{ minWidth: 120 }}
              >
                Decline
              </Button>
            </Flex>
          </Flex>
        </div>
      ) : (
        <Empty
          image="/assets/illustrations/bota/channels.svg"
          imageStyle={{ height: 80 }}
          description={
            <Text type="secondary">
              No incoming calls. Transferred calls will appear here.
            </Text>
          }
        />
      )}
    </Card>
  );
}
