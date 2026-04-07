"use client";

import type { CSSProperties } from "react";
import { Sidebar } from "./Sidebar";
import { BuilderPanel } from "./BuilderPanel";
import { DashboardPanel } from "./DashboardPanel";

const appLayoutStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  width: "100vw",
  height: "100vh",
  overflow: "hidden",
};

export function AppLayout() {
  return (
    <div style={appLayoutStyle}>
      <Sidebar />
      <BuilderPanel />
      <DashboardPanel />
    </div>
  );
}
