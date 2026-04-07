"use client";

import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ExperimentOutlined,
} from "@ant-design/icons";
import { Button, Divider, Drawer, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useDeployStore } from "@/lib/stores/deploy-store";

export function DeployDrawer() {
  const router = useRouter();
  const { isDeployDrawerOpen, deployedAgent, closeDeployDrawer } = useDeployStore();

  const handleGoToDashboard = () => {
    closeDeployDrawer();
    router.push("/agents");
  };

  if (!deployedAgent) {
    return null;
  }

  return (
    <Drawer
      open={isDeployDrawerOpen}
      onClose={closeDeployDrawer}
      placement="right"
      size={520}
      title={null}
      className="deploy-drawer"
    >
      <div className="deploy-drawer-content">
        {/* Success Header */}
        <div className="deploy-success-header">
          <CheckCircleFilled style={{ color: "#22C55E", fontSize: 32 }} />
          <Typography.Title level={4} style={{ margin: "12px 0 0" }}>
            Your agent is live!
          </Typography.Title>
        </div>

        {/* Web Chat Widget Section */}
        <div className="deploy-section">
          <Typography.Title level={5}>Web Chat Widget</Typography.Title>
          <Typography.Text type="secondary">
            Paste this before {"</body>"} on your website:
          </Typography.Text>
          <Typography.Paragraph
            code
            copyable={{ text: deployedAgent.widgetCode }}
            className="deploy-code-block"
          >
            {deployedAgent.widgetCode}
          </Typography.Paragraph>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Works on Shopify, WordPress, Wix, Squarespace, or any HTML site.
          </Typography.Text>
        </div>

        <Divider />

        {/* Voice Chat Section */}
        <div className="deploy-section">
          <Typography.Title level={5}>Voice Chat</Typography.Title>
          <Typography.Text type="secondary">
            Built into the widget. Your visitors click the 🎙 mic icon to talk to your agent.
          </Typography.Text>
        </div>

        <Divider />

        {/* Phone Line Section */}
        <div className="deploy-section">
          <Typography.Title level={5}>Phone Line</Typography.Title>
          <Typography.Text type="secondary">
            Your agent&apos;s voice line:
          </Typography.Text>
          <Typography.Title
            level={3}
            copyable
            style={{ margin: "8px 0" }}
          >
            {deployedAgent.phoneNumber}
          </Typography.Title>
          <Typography.Text type="secondary">
            Share this with customers. Callers talk to your agent live.
          </Typography.Text>
        </div>

        <Divider />

        {/* Footer Buttons */}
        <Space size={12} className="deploy-footer">
          <Button icon={<ExperimentOutlined />}>
            Test your agent
          </Button>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={handleGoToDashboard}
          >
            Go to Dashboard
          </Button>
        </Space>
      </div>
    </Drawer>
  );
}
