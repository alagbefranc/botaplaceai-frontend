"use client";

import { App as AntApp, ConfigProvider, Spin } from "antd";
import type { ThemeConfig } from "antd";
import type { PropsWithChildren } from "react";
import { BotaLoader } from "@/app/_components/bota-loader";
import { DeployDrawer } from "@/components/deploy";
import { NotificationProvider } from "@/app/_components/notification-provider";

// Replace Ant Design's default spinner with the BOTA branded Lottie animation globally.
Spin.setDefaultIndicator(<BotaLoader size={64} />);

const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#17DEBC",
    colorBgBase: "#FFFFFF",
    colorBgLayout: "#FFFFFF",
    colorText: "#1E293B",
    colorTextHeading: "#0F172A",
    colorBorder: "#E2E8F0",
    borderRadius: 8,
    fontFamily:
      'var(--font-space-grotesk), "Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  components: {
    Layout: {
      bodyBg: "#FFFFFF",
      siderBg: "#FFFFFF",
      headerBg: "#FFFFFF",
    },
    Card: {
      colorBorderSecondary: "#E2E8F0",
      borderRadiusLG: 8,
    },
    Input: {
      activeShadow: "0 0 0 2px rgba(23, 222, 188, 0.15)",
      activeBorderColor: "#17DEBC",
    },
    Button: {
      borderRadius: 8,
      contentFontSize: 14,
      // Default buttons use dark style
      defaultBg: "#0A0B0A",
      defaultColor: "#FFFFFF",
      defaultBorderColor: "#0A0B0A",
      defaultHoverBg: "#2B2928",
      defaultHoverColor: "#FFFFFF",
      defaultHoverBorderColor: "#2B2928",
      // Primary buttons: teal with dark text for readability
      primaryColor: "#0A0B0A",
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Segmented: {
      itemSelectedBg: "#17DEBC",
      itemSelectedColor: "#0A0B0A",
    },
  },
};

export function Providers({ children }: PropsWithChildren) {
  return (
    <ConfigProvider theme={themeConfig}>
      <AntApp>
        <NotificationProvider>
          {children}
          <DeployDrawer />
        </NotificationProvider>
      </AntApp>
    </ConfigProvider>
  );
}
