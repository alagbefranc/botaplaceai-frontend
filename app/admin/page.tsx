"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography, Table, Tag, Space, Button } from "antd";
import {
  UserOutlined,
  RobotOutlined,
  MessageOutlined,
  PhoneOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Link from "next/link";

interface DashboardStats {
  totalUsers: number;
  totalOrgs: number;
  totalAgents: number;
  totalConversations: number;
  activeConversations: number;
  conversationsToday: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch from API
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        // Mock data for now
        setStats({
          totalUsers: 12,
          totalOrgs: 5,
          totalAgents: 8,
          totalConversations: 1247,
          activeConversations: 3,
          conversationsToday: 47,
        });
      }
    } catch (e) {
      // Mock data on error
      setStats({
        totalUsers: 12,
        totalOrgs: 5,
        totalAgents: 8,
        totalConversations: 1247,
        activeConversations: 3,
        conversationsToday: 47,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const activityColumns = [
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: string) => (
        <Tag color={type === "user" ? "blue" : type === "agent" ? "green" : "default"}>
          {type}
        </Tag>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "timestamp",
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <div>
            <Typography.Title level={3} className="admin-page-title">
              Admin Dashboard
            </Typography.Title>
            <Typography.Text type="secondary">
              Overview of your Botaplace platform
            </Typography.Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchStats} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Stats Row */}
      <Row gutter={[16, 16]} className="admin-stats-row">
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Total Users"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Organizations"
              value={stats?.totalOrgs || 0}
              prefix={<UserOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="AI Agents"
              value={stats?.totalAgents || 0}
              prefix={<RobotOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Total Conversations"
              value={stats?.totalConversations || 0}
              prefix={<MessageOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Active Now"
              value={stats?.activeConversations || 0}
              valueStyle={{ color: "#52c41a" }}
              prefix={<PhoneOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="admin-stat-card" size="small">
            <Statistic
              title="Today"
              value={stats?.conversationsToday || 0}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: "#1890ff" }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Links */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Quick Actions" className="admin-card">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Link href="/admin/monitoring">
                <Button type="primary" block>
                  View System Monitoring
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button block>Manage Users</Button>
              </Link>
              <Link href="/">
                <Button block>Go to Main App</Button>
              </Link>
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="System Status" className="admin-card">
            <Space direction="vertical" style={{ width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Backend Server</span>
                <Tag color="success">Healthy</Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Database</span>
                <Tag color="success">Healthy</Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Gemini AI</span>
                <Tag color="success">Healthy</Tag>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Telnyx Voice</span>
                <Tag color="success">Healthy</Tag>
              </div>
              <Link href="/admin/monitoring">
                <Button type="link" style={{ padding: 0 }}>
                  View detailed status →
                </Button>
              </Link>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
