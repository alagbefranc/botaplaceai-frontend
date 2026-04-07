"use client";

import { Card, Typography, Space, Empty } from "antd";
import { DatabaseOutlined } from "@ant-design/icons";

export default function AdminDatabasePage() {
  return (
    <div>
      <div className="admin-page-header">
        <Typography.Title level={3} className="admin-page-title">
          Database Management
        </Typography.Title>
        <Typography.Text type="secondary">
          View and manage database tables and migrations
        </Typography.Text>
      </div>

      <Card className="admin-card">
        <Empty
          image={<DatabaseOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />}
          description={
            <Space direction="vertical">
              <Typography.Text>Database management coming soon</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                View tables, run queries, and manage migrations
              </Typography.Text>
            </Space>
          }
        />
      </Card>
    </div>
  );
}
