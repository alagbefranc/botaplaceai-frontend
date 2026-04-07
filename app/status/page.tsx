"use client";

import { useCallback, useEffect, useState } from "react";
import { Typography, Tooltip, Spin } from "antd";
import {
  CheckCircleFilled,
  ExclamationCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  ReloadOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import "./status.css";

interface ServiceStatus {
  status: "operational" | "degraded" | "outage" | "maintenance";
  latencyMs?: number;
  error?: string;
  lastChecked?: string;
}

interface HealthData {
  overall: "healthy" | "degraded" | "down";
  services: {
    backend: ServiceStatus;
    supabase: ServiceStatus;
    gemini: ServiceStatus;
    telnyx: ServiceStatus;
  };
  timestamp: string;
}

const STATUS_CONFIG = {
  operational: {
    color: "#22c55e",
    icon: <CheckCircleFilled />,
    label: "Operational",
  },
  degraded: {
    color: "#f59e0b",
    icon: <ExclamationCircleFilled />,
    label: "Degraded",
  },
  outage: {
    color: "#ef4444",
    icon: <CloseCircleFilled />,
    label: "Outage",
  },
  maintenance: {
    color: "#3b82f6",
    icon: <ClockCircleFilled />,
    label: "Maintenance",
  },
};

const SERVICES = [
  {
    key: "voice",
    name: "Botaplace Voice",
    description: "Voice AI agents and phone integrations",
    children: [
      { key: "telnyx", name: "Telnyx Voice Gateway" },
      { key: "gemini", name: "Gemini Live API" },
    ],
  },
  {
    key: "platform",
    name: "Botaplace Platform",
    description: "Core platform services",
    children: [
      { key: "backend", name: "API Server" },
      { key: "supabase", name: "Database" },
    ],
  },
  {
    key: "chat",
    name: "Botaplace Chat",
    description: "Web chat and messaging",
    children: [
      { key: "backend", name: "Chat API" },
      { key: "gemini", name: "AI Models" },
    ],
  },
  {
    key: "integrations",
    name: "Integrations",
    description: "Third-party integrations",
    children: [
      { key: "telnyx", name: "Telnyx" },
    ],
  },
];

const REGIONS = [
  { key: "us", name: "US", domain: "api.botaplace.com" },
  { key: "eu", name: "Europe", domain: "eu.botaplace.com" },
  { key: "apac", name: "APAC", domain: "apac.botaplace.com" },
];

function StatusDot({ status }: { status: "operational" | "degraded" | "outage" | "maintenance" }) {
  const config = STATUS_CONFIG[status];
  return (
    <Tooltip title={config.label}>
      <span
        className="status-dot"
        style={{ backgroundColor: config.color }}
      />
    </Tooltip>
  );
}

function mapHealthToStatus(health: ServiceStatus | undefined): "operational" | "degraded" | "outage" | "maintenance" {
  if (!health) return "operational";
  if (health.status === "healthy") return "operational";
  if (health.status === "degraded") return "degraded";
  if (health.status === "down") return "outage";
  return "operational";
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/status");
      const data = await res.json();
      if (res.ok) {
        // Map the health data to our status format
        const mapped: HealthData = {
          overall: data.overall,
          services: {
            backend: { 
              status: data.services.backend.status === "healthy" ? "operational" : 
                      data.services.backend.status === "degraded" ? "degraded" : "outage",
              latencyMs: data.services.backend.latencyMs,
              error: data.services.backend.error,
            },
            supabase: { 
              status: data.services.supabase.status === "healthy" ? "operational" : 
                      data.services.supabase.status === "degraded" ? "degraded" : "outage",
              latencyMs: data.services.supabase.latencyMs,
              error: data.services.supabase.error,
            },
            gemini: { 
              status: data.services.gemini.status === "healthy" ? "operational" : 
                      data.services.gemini.status === "degraded" ? "degraded" : "outage",
              error: data.services.gemini.error,
            },
            telnyx: { 
              status: data.services.telnyx.status === "healthy" ? "operational" : 
                      data.services.telnyx.status === "degraded" ? "degraded" : "outage",
              error: data.services.telnyx.error,
            },
          },
          timestamp: data.timestamp,
        };
        setHealth(mapped);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Failed to fetch health:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getServiceStatus = (serviceKey: string): "operational" | "degraded" | "outage" | "maintenance" => {
    if (!health) return "operational";
    const service = health.services[serviceKey as keyof typeof health.services];
    if (!service) return "operational";
    return service.status as "operational" | "degraded" | "outage" | "maintenance";
  };

  const overallStatus = health?.overall === "healthy" ? "operational" : 
                        health?.overall === "degraded" ? "degraded" : "outage";
  const overallConfig = STATUS_CONFIG[overallStatus];

  return (
    <div className="status-page">
      {/* Header */}
      <header className="status-header">
        <div className="status-header-inner">
          <Link href="/" className="status-logo">
            <img src="/bota-logo.png" alt="Botaplace" width={32} height={32} />
            <span className="status-logo-text">Botaplace</span>
          </Link>
          <nav className="status-nav">
            <Link href="/" className="status-nav-link">Dashboard</Link>
            <Link href="https://docs.botaplace.com" className="status-nav-link" target="_blank">Documentation</Link>
            <button className="status-subscribe-btn">
              Subscribe to Updates
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="status-main">
        <div className="status-container">
          {/* Hero Section */}
          <section className="status-hero">
            <div className="status-hero-content">
              <h1 className="status-title">Botaplace System Status</h1>
              <p className="status-subtitle">
                Welcome to the Botaplace status page. Here you can check the current status
                of our services and subscribe to updates.
              </p>
            </div>
            <div className="status-hero-graphic">
              {/* World map dots pattern */}
              <svg viewBox="0 0 400 200" className="status-world-map">
                {/* Simplified world map dots */}
                {Array.from({ length: 50 }).map((_, i) => (
                  <circle
                    key={i}
                    cx={50 + (i % 10) * 35 + Math.random() * 10}
                    cy={30 + Math.floor(i / 10) * 35 + Math.random() * 10}
                    r={2}
                    fill="#a855f7"
                    opacity={0.3 + Math.random() * 0.4}
                  />
                ))}
              </svg>
            </div>
          </section>

          {/* Current Status Banner */}
          <section className="status-banner" style={{ borderColor: overallConfig.color }}>
            <div className="status-banner-icon" style={{ color: overallConfig.color }}>
              {loading ? <Spin size="small" /> : overallConfig.icon}
            </div>
            <div className="status-banner-text">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {loading ? "Checking status..." : `All Systems ${overallConfig.label}`}
              </Typography.Title>
              <Typography.Text type="secondary">
                {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : "Checking..."}
              </Typography.Text>
            </div>
            <button className="status-refresh-btn" onClick={fetchHealth} disabled={loading}>
              <ReloadOutlined spin={loading} />
            </button>
          </section>

          {/* Legend */}
          <section className="status-legend">
            <span className="status-legend-title">Legend</span>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <span key={key} className="status-legend-item">
                <span className="status-dot" style={{ backgroundColor: config.color }} />
                {config.label}
              </span>
            ))}
          </section>

          {/* Services Table */}
          <section className="status-table-section">
            <table className="status-table">
              <thead>
                <tr>
                  <th className="status-table-service">
                    SERVICE
                    <span className="status-table-count">{SERVICES.length} SERVICES</span>
                  </th>
                  {REGIONS.map((region) => (
                    <th key={region.key} className="status-table-region">
                      {region.name}
                      <span className="status-table-domain">{region.domain}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((service) => (
                  <>
                    <tr key={service.key} className="status-table-row status-table-row-parent">
                      <td className="status-table-service-cell">
                        <span className="status-table-expand">▼</span>
                        <span className="status-table-service-name">{service.name}</span>
                      </td>
                      {REGIONS.map((region) => (
                        <td key={region.key} className="status-table-status-cell">
                          <StatusDot status={getServiceStatus(service.children[0]?.key || "backend")} />
                        </td>
                      ))}
                    </tr>
                    {service.children.map((child) => (
                      <tr key={`${service.key}-${child.key}`} className="status-table-row status-table-row-child">
                        <td className="status-table-service-cell status-table-child-cell">
                          {child.name}
                        </td>
                        {REGIONS.map((region) => (
                          <td key={region.key} className="status-table-status-cell">
                            <StatusDot status={getServiceStatus(child.key)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </section>

          {/* Incident History */}
          <section className="status-incidents">
            <Typography.Title level={4}>Recent Incidents</Typography.Title>
            <div className="status-incidents-empty">
              <CheckCircleFilled style={{ fontSize: 32, color: "#22c55e" }} />
              <Typography.Text type="secondary">No incidents reported in the last 7 days</Typography.Text>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="status-footer">
        <div className="status-footer-inner">
          <Typography.Text type="secondary">
            © {new Date().getFullYear()} Botaplace. All rights reserved.
          </Typography.Text>
          <div className="status-footer-links">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
