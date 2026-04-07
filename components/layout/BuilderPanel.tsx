"use client";

import type { CSSProperties } from "react";

const builderPanelStyle: CSSProperties = {
  width: 400,
  minWidth: 400,
  maxWidth: 400,
  flexShrink: 0,
  height: "100%",
  backgroundColor: "#FFFFFF",
  borderRight: "1px solid #F1F5F9",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
};

export function BuilderPanel() {
  return (
    <section style={builderPanelStyle}>
      {/* Placeholder - BuilderPanel */}
      <div style={{ padding: 24, color: "#64748B" }}>
        BuilderPanel
      </div>
    </section>
  );
}
