"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Table, Typography, Space, Button, Tag, Input, Avatar } from "antd";
import { UserOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  org_id: string;
  created_at: string;
  organizations?: { name: string };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Failed to fetch users:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: ColumnsType<User> = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" />
          <div>
            <div>{record.full_name || "—"}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "admin" ? "blue" : role === "super_admin" ? "purple" : "default"}>
          {role}
        </Tag>
      ),
    },
    {
      title: "Organization",
      key: "org",
      render: (_, record) => record.organizations?.name || record.org_id?.slice(0, 8) || "—",
    },
    {
      title: "Joined",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <div>
            <Typography.Title level={3} className="admin-page-title">
              Users & Organizations
            </Typography.Title>
            <Typography.Text type="secondary">
              Manage platform users and organizations
            </Typography.Text>
          </div>
          <Space>
            <Input
              placeholder="Search users..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Space>
      </div>

      <Card className="admin-card">
        <Table
          dataSource={filteredUsers.map((u) => ({ ...u, key: u.id }))}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
}
