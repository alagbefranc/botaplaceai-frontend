"use client";

import {
  BugOutlined,
  CalendarOutlined,
  ContactsOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  MailOutlined,
  ScheduleOutlined,
  SlackOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { Button, Checkbox, Space, Typography } from "antd";
import type { CheckboxGroupProps } from "antd/es/checkbox";
import { useAgentBuilderStore } from "@/lib/stores/agent-builder-store";

const TOOLS = [
  { value: "gmail", label: "Send emails", icon: <MailOutlined /> },
  { value: "google_calendar", label: "Book appointments", icon: <CalendarOutlined /> },
  { value: "slack", label: "Send Slack messages", icon: <SlackOutlined /> },
  { value: "stripe", label: "Process payments", icon: <CreditCardOutlined /> },
  { value: "hubspot", label: "Update CRM", icon: <ContactsOutlined /> },
  { value: "jira", label: "Create tickets", icon: <BugOutlined /> },
  { value: "notion", label: "Log to Notion", icon: <FileTextOutlined /> },
  { value: "calendly", label: "Schedule via Calendly", icon: <ScheduleOutlined /> },
  { value: "google_sheets", label: "Look up data", icon: <TableOutlined /> },
];

interface ToolPickerProps {
  onConnectApps?: () => void;
}

export function ToolPicker({ onConnectApps }: ToolPickerProps) {
  const { draft, setTools } = useAgentBuilderStore();

  const handleChange: CheckboxGroupProps["onChange"] = (checkedValues) => {
    setTools(checkedValues as string[]);
  };

  return (
    <div className="builder-inline-card">
      <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
        What should your agent be able to do?
      </Typography.Text>

      <Checkbox.Group
        value={draft.tools}
        onChange={handleChange}
        style={{ width: "100%" }}
      >
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          {TOOLS.map((tool) => (
            <div key={tool.value} className="tool-option">
              <Checkbox value={tool.value}>
                <Space size={8}>
                  <span className="tool-icon">{tool.icon}</span>
                  <Typography.Text>{tool.label}</Typography.Text>
                </Space>
              </Checkbox>
            </div>
          ))}
        </Space>
      </Checkbox.Group>

      <Button
        type="primary"
        size="middle"
        onClick={onConnectApps}
        style={{ marginTop: 16 }}
      >
        Connect Selected Apps
      </Button>
    </div>
  );
}
