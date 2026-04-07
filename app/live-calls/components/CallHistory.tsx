"use client";

import {
  ClockCircleOutlined,
  PhoneOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { useNotification } from "@telnyx/react-client";

const { Text } = Typography;

interface CallLogEntry {
  id: string;
  direction: "inbound" | "outbound";
  caller_number: string | null;
  caller_name: string | null;
  callee_number: string | null;
  call_state: string;
  duration_seconds: number;
  started_at: string;
}

export function CallHistory() {
  const notification = useNotification();
  const [callLog, setCallLog] = useState<CallLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch call logs from Supabase
  const fetchCallLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/call-logs?limit=20");
      if (response.ok) {
        const data = await response.json();
        setCallLog(data.call_logs || []);
      }
    } catch (error) {
      console.error("[CallHistory] Failed to fetch call logs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCallLogs();
  }, [fetchCallLogs]);

  // Track call state changes and persist to database
  useEffect(() => {
    if (notification?.type !== "callUpdate") return;

    const call = notification.call;
    if (!call) return;

    // Create or update call log in database
    const persistCallLog = async () => {
      try {
        if (call.state === "new" || call.state === "trying") {
          // Create new call log
          await fetch("/api/call-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              direction: call.direction === "inbound" ? "inbound" : "outbound",
              caller_number: call.remoteCallerNumber,
              caller_name: call.remoteCallerName,
              call_state: call.state,
              telnyx_call_control_id: call.id,
            }),
          });
        }
        // Refresh the list
        fetchCallLogs();
      } catch (error) {
        console.error("[CallHistory] Failed to persist call log:", error);
      }
    };

    persistCallLog();
  }, [notification, fetchCallLogs]);

  const formatTimeAgo = (dateStr: string): string => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getStateTag = (state: string) => {
    switch (state) {
      case "active":
        return <Tag color="green">Active</Tag>;
      case "ringing":
        return <Tag color="blue">Ringing</Tag>;
      case "held":
        return <Tag color="orange">On Hold</Tag>;
      case "done":
      case "hangup":
        return <Tag color="default">Completed</Tag>;
      case "destroy":
        return <Tag color="red">Ended</Tag>;
      default:
        return <Tag>{state}</Tag>;
    }
  };

  return (
    <Card 
      title={
        <Space>
          <ClockCircleOutlined />
          <span>Call History</span>
        </Space>
      }
      extra={
        <Button 
          size="small" 
          icon={<ReloadOutlined />} 
          onClick={fetchCallLogs}
          loading={loading}
        />
      }
      styles={{ 
        body: { 
          padding: 0, 
          maxHeight: 300, 
          overflow: "auto" 
        } 
      }}
    >
      {callLog.length === 0 ? (
        <Empty
          image="/assets/illustrations/bota/channels.svg"
          imageStyle={{ height: 80 }}
          description={
            <Text type="secondary">No recent calls</Text>
          }
          style={{ padding: "24px 0" }}
        />
      ) : (
        <List
          size="small"
          dataSource={callLog}
          loading={loading}
          renderItem={(entry) => (
            <List.Item 
              style={{ padding: "8px 16px" }}
              extra={getStateTag(entry.call_state)}
            >
              <List.Item.Meta
                avatar={
                  entry.direction === "inbound" ? (
                    <ArrowDownOutlined style={{ fontSize: 18, color: "#1677ff" }} />
                  ) : (
                    <ArrowUpOutlined style={{ fontSize: 18, color: "#52c41a" }} />
                  )
                }
                title={
                  <Text style={{ fontSize: 13 }}>
                    {entry.caller_name || entry.caller_number || entry.callee_number || "Unknown"}
                  </Text>
                }
                description={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {formatTimeAgo(entry.started_at)}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}
