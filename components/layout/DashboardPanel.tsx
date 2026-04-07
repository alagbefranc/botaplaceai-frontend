"use client";

import type { CSSProperties } from "react";

const dashboardPanelStyle: CSSProperties = {
  flex: 1,
  height: "100%",
  backgroundColor: "#F8FAFC",
  overflowY: "auto",
  padding: 32,
};

export function DashboardPanel() {
  return (
    <main style={dashboardPanelStyle}>
      {/* Placeholder - DashboardPanel */}
      <div style={{ color: "#64748B" }}>
        DashboardPanel
      </div>
    </main>
  );
}
