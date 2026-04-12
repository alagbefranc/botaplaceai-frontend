"use client";

import {
  AudioOutlined,
  FileProtectOutlined,
  GlobalOutlined,
  PhoneOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { Badge, Tabs, Typography } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { RoutePageShell } from "../_components/route-page-shell";
import BuyNumbersTab from "./components/BuyNumbersTab";
import CoverageTab from "./components/CoverageTab";
import MyNumbersTab from "./components/MyNumbersTab";
import PortNumbersTab from "./components/PortNumbersTab";
import RegulatoryTab from "./components/RegulatoryTab";
import VoicemailTab from "./components/VoicemailTab";

const { Text } = Typography;

function PhoneNumbersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("my-numbers");
  const [pendingRegulatory] = useState(2); // Mock count

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["my-numbers", "buy", "port", "regulatory", "voicemail", "coverage"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = useCallback(
    (key: string) => {
      setActiveTab(key);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", key);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleBuyNumber = useCallback(() => {
    handleTabChange("buy");
  }, [handleTabChange]);

  const handleBuyComplete = useCallback(() => {
    handleTabChange("my-numbers");
  }, [handleTabChange]);

  const handleBuyFromCoverage = useCallback(
    (_country: string) => {
      handleTabChange("buy");
    },
    [handleTabChange]
  );

  const tabItems = [
    {
      key: "my-numbers",
      label: (
        <span>
          <PhoneOutlined style={{ marginRight: 8 }} />
          My Numbers
        </span>
      ),
      children: <MyNumbersTab onBuyNumber={handleBuyNumber} />,
    },
    {
      key: "buy",
      label: (
        <span>
          <ShoppingCartOutlined style={{ marginRight: 8 }} />
          Buy Numbers
        </span>
      ),
      children: <BuyNumbersTab onComplete={handleBuyComplete} />,
    },
    {
      key: "port",
      label: (
        <span>
          <SwapOutlined style={{ marginRight: 8 }} />
          Port Numbers
        </span>
      ),
      children: <PortNumbersTab />,
    },
    {
      key: "regulatory",
      label: (
        <Badge count={pendingRegulatory} offset={[10, 0]} size="small">
          <span>
            <FileProtectOutlined style={{ marginRight: 8 }} />
            Regulatory
          </span>
        </Badge>
      ),
      children: <RegulatoryTab />,
    },
    {
      key: "voicemail",
      label: (
        <span>
          <AudioOutlined style={{ marginRight: 8 }} />
          Voicemail
        </span>
      ),
      children: <VoicemailTab />,
    },
    {
      key: "coverage",
      label: (
        <span>
          <GlobalOutlined style={{ marginRight: 8 }} />
          Coverage
        </span>
      ),
      children: <CoverageTab onBuyNumbers={handleBuyFromCoverage} />,
    },
  ];

  return (
    <RoutePageShell
      title="Numbers"
      subtitle="Manage your phone numbers, porting, voicemail, and compliance"
      
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 24 }}
        destroyInactiveTabPane={false}
      />
    </RoutePageShell>
  );
}

export default function PhoneNumbersPage() {
  return (
    <Suspense
      fallback={
        <RoutePageShell
          title="Numbers"
          subtitle="Loading..."
          
        >
          <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Text type="secondary">Loading numbers...</Text>
          </div>
        </RoutePageShell>
      }
    >
      <PhoneNumbersContent />
    </Suspense>
  );
}
