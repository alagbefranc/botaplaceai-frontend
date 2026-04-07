"use client";

import { Card, Typography, Space, Empty } from "antd";
import { SafetyOutlined } from "@ant-design/icons";

export default function AdminSecurityPage() {
  return (
    <div>
      <div className="admin-page-header">
        <Typography.Title level={3} className="admin-page-title">
          Security
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage API keys, access controls, and security settings
        </Typography.Text>
      </div>

      <Card className="admin-card">
        <Empty
          image={<SafetyOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
          description={
            <Space direction="vertical">
              <Typography.Text>Security management coming soon</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                API keys, rate limits, and access controls
              </Typography.Text>
            </Space>
          }
        />
      </Card>
    </div>
  );
}
