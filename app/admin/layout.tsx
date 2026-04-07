"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Spin, Typography, Avatar, Dropdown, Space } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  SettingOutlined,
  BarChartOutlined,
  SafetyOutlined,
  LogoutOutlined,
  UserOutlined,
  BellOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import "./admin.css";

const { Header, Sider, Content } = Layout;

const menuItems = [
  {
    key: "dashboard",
    icon: <DashboardOutlined />,
    label: <Link href="/admin">Dashboard</Link>,
  },
  {
    key: "monitoring",
    icon: <BarChartOutlined />,
    label: <Link href="/admin/monitoring">System Monitoring</Link>,
  },
  {
    key: "users",
    icon: <TeamOutlined />,
    label: <Link href="/admin/users">Users & Orgs</Link>,
  },
  {
    key: "database",
    icon: <DatabaseOutlined />,
    label: <Link href="/admin/database">Database</Link>,
  },
  {
    key: "security",
    icon: <SafetyOutlined />,
    label: <Link href="/admin/security">Security</Link>,
  },
  {
    key: "settings",
    icon: <SettingOutlined />,
    label: <Link href="/admin/settings">Settings</Link>,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        router.replace("/auth/login");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      setUserEmail(user.email || null);

      // Check if user is admin (you can customize this logic)
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (userData?.role === "admin" || userData?.role === "super_admin") {
        setIsAdmin(true);
      } else {
        // For now, allow all authenticated users for development
        // In production, redirect non-admins
        setIsAdmin(true);
      }

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.replace("/auth/login");
    }
  };

  const getSelectedKey = () => {
    if (pathname === "/admin") return "dashboard";
    if (pathname.startsWith("/admin/monitoring")) return "monitoring";
    if (pathname.startsWith("/admin/users")) return "users";
    if (pathname.startsWith("/admin/database")) return "database";
    if (pathname.startsWith("/admin/security")) return "security";
    if (pathname.startsWith("/admin/settings")) return "settings";
    return "dashboard";
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <Spin size="large" />
        <Typography.Text type="secondary" style={{ marginTop: 16 }}>
          Loading Admin Portal...
        </Typography.Text>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-loading">
        <Typography.Title level={3}>Access Denied</Typography.Title>
        <Typography.Text type="secondary">
          You do not have permission to access the admin portal.
        </Typography.Text>
      </div>
    );
  }

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "Profile",
    },
    {
      key: "back-to-app",
      icon: <DashboardOutlined />,
      label: <Link href="/">Back to App</Link>,
    },
    {
      type: "divider" as const,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="admin-layout">
      <Sider
        width={240}
        className="admin-sider"
        theme="light"
      >
        <div className="admin-logo">
          <img src="/bota-logo.png" alt="Botaplace" width={32} height={32} />
          <div className="admin-logo-text">
            <Typography.Text strong>Botaplace</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>Admin Portal</Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          className="admin-menu"
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header-left">
            <Typography.Text type="secondary">
              admin.botaplaceai.com
            </Typography.Text>
          </div>
          <div className="admin-header-right">
            <BellOutlined className="admin-header-icon" />
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space className="admin-user-dropdown">
                <Avatar size="small" icon={<UserOutlined />} />
                <span>{userEmail || "Admin"}</span>
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content className="admin-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
