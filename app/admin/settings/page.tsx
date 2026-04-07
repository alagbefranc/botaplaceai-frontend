"use client";

import { Card, Typography, Space, Empty } from "antd";
import { SettingOutlined } from "@ant-design/icons";

export default function AdminSettingsPage() {
  return (
    <div>
      <div className="admin-page-header">
        <Typography.Title level={3} className="admin-page-title">
          Admin Settings
        </Typography.Title>
        <Typography.Text type="secondary">
          Configure platform-wide settings
        </Typography.Text>
      </div>

      <Card className="admin-card">
        <Empty
          image={<SettingOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
          description={
            <Space direction="vertical">
              <Typography.Text>Admin settings coming soon</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Platform configuration, feature flags, and more
              </Typography.Text>
            </Space>
          }
        />
      </Card>
    </div>
  );
}
