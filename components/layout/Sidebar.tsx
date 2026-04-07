"use client";

import type { CSSProperties } from "react";

const sidebarStyle: CSSProperties = {
  width: 56,
  minWidth: 56,
  maxWidth: 56,
  flexShrink: 0,
  height: "100%",
  backgroundColor: "#FFFFFF",
  borderRight: "1px solid #F1F5F9",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: 16,
};

export function Sidebar() {
  return (
    <aside style={sidebarStyle}>
      {/* Placeholder - Sidebar */}
    </aside>
  );
}
