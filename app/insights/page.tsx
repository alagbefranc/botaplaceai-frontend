"use client";

import BotaLottieEmpty from "@/app/_components/BotaLottieEmpty";

import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  BarsOutlined,
  BulbOutlined,
  GroupOutlined,
  LineChartOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useState, useCallback, useEffect } from "react";
import { RoutePageShell } from "../_components/route-page-shell";
import { InsightBuilder } from "./_components/InsightBuilder";
import { InsightGroups } from "./_components/InsightGroups";
import { TemplateLibrary } from "./_components/TemplateLibrary";
import { AnalyticsDashboard } from "./_components/AnalyticsDashboard";
import type { InsightDefinition } from "@/lib/domain/agent-builder";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

// Insight card component
function InsightCard({
  insight,
  onEdit,
  onDelete,
}: {
  insight: InsightDefinition;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const paramCount = insight.schema?.parameters?.length || 0;

  return (
    <Card
      hoverable
      size="small"
      style={{ borderRadius: 12, height: "100%" }}
      actions={[
        <Tooltip key="edit" title="Edit">
          <Button type="text" size="small" onClick={onEdit}>
            Edit
          </Button>
        </Tooltip>,
        <Tooltip key="delete" title="Delete">
          <Button type="text" size="small" danger onClick={onDelete}>
            Delete
          </Button>
        </Tooltip>,
      ]}
    >
      <Space direction="vertical" size={8} style={{ width: "100%" }}>
        <Space>
          <Tag color={insight.insightType === "structured" ? "blue" : "purple"}>
            {insight.insightType === "structured" ? (
              <><ThunderboltOutlined /> Structured</>
            ) : (
              <><BulbOutlined /> Unstructured</>
            )}
          </Tag>
          {insight.templateCategory && (
            <Tag color="default">{insight.templateCategory}</Tag>
          )}
        </Space>
        <Typography.Text strong style={{ fontSize: 16 }}>
          {insight.name}
        </Typography.Text>
        {insight.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {insight.description}
          </Typography.Text>
        )}
        {insight.insightType === "structured" && paramCount > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {paramCount} parameter{paramCount !== 1 ? "s" : ""}
          </Typography.Text>
        )}
      </Space>
    </Card>
  );
}

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState("my-insights");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [insights, setInsights] = useState<InsightDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<InsightDefinition | null>(null);

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleCreateNew = () => {
    setEditingInsight(null);
    setBuilderOpen(true);
  };

  const handleEdit = (insight: InsightDefinition) => {
    setEditingInsight(insight);
    setBuilderOpen(true);
  };

  const handleDelete = async (insight: InsightDefinition) => {
    if (!insight.id) return;
    try {
      const res = await fetch(`/api/insights/${insight.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      fetchInsights();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleBuilderSave = async (insight: Partial<InsightDefinition>) => {
    try {
      const method = editingInsight?.id ? "PUT" : "POST";
      const url = editingInsight?.id ? `/api/insights/${editingInsight.id}` : "/api/insights";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(insight),
      });
      if (!res.ok) throw new Error("Failed to save");
      setBuilderOpen(false);
      fetchInsights();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  const handleUseTemplate = async (template: InsightDefinition) => {
    // Copy template to user's insights
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...template,
          id: undefined,
          isTemplate: false,
          name: `${template.name} (Copy)`,
        }),
      });
      if (!res.ok) throw new Error("Failed to copy template");
      fetchInsights();
      setActiveTab("my-insights");
    } catch (err) {
      console.error("Copy template failed:", err);
    }
  };

  // Filter insights by search
  const filteredInsights = insights.filter((i) =>
    !i.isTemplate && (
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Stats
  const structuredCount = insights.filter((i) => !i.isTemplate && i.insightType === "structured").length;
  const unstructuredCount = insights.filter((i) => !i.isTemplate && i.insightType === "unstructured").length;

  const tabItems = [
    {
      key: "my-insights",
      label: (
        <Space>
          <BulbOutlined />
          <span>My Insights</span>
          <Tag>{filteredInsights.length}</Tag>
        </Space>
      ),
      children: (
        <Space direction="vertical" size={24} style={{ width: "100%" }}>
          {/* Stats Row */}
          <Row gutter={16}>
            <Col span={8}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic
                  title="Total Insights"
                  value={filteredInsights.length}
                  prefix={<BulbOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic
                  title="Structured"
                  value={structuredCount}
                  prefix={<ThunderboltOutlined style={{ color: "#1890ff" }} />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderRadius: 10 }}>
                <Statistic
                  title="Unstructured"
                  value={unstructuredCount}
                  prefix={<BulbOutlined style={{ color: "#722ed1" }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* Insights Grid/List */}
          {loading ? (
            <Row gutter={[16, 16]}>
              {[1, 2, 3, 4].map((i) => (
                <Col key={i} xs={24} sm={12} md={8} lg={6}>
                  <Card style={{ borderRadius: 12 }}>
                    <Skeleton active paragraph={{ rows: 2 }} />
                  </Card>
                </Col>
              ))}
            </Row>
          ) : error ? (
            <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
          ) : filteredInsights.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: "center", padding: 48 }}>
              <Empty
                image={<BotaLottieEmpty />}
                imageStyle={{ height: 80 }}
                description={
                  <Space direction="vertical" size={12}>
                    <Typography.Text type="secondary">
                      No custom insights yet
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Create your first insight to start extracting structured data from conversations
                    </Typography.Text>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateNew}
                    >
                      Create Your First Insight
                    </Button>
                  </Space>
                }
              />
            </Card>
          ) : viewMode === "grid" ? (
            <Row gutter={[16, 16]}>
              {filteredInsights.map((insight) => (
                <Col key={insight.id} xs={24} sm={12} md={8} lg={6}>
                  <InsightCard
                    insight={insight}
                    onEdit={() => handleEdit(insight)}
                    onDelete={() => handleDelete(insight)}
                  />
                </Col>
              ))}
            </Row>
          ) : (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {filteredInsights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onEdit={() => handleEdit(insight)}
                  onDelete={() => handleDelete(insight)}
                />
              ))}
            </Space>
          )}
        </Space>
      ),
    },
    {
      key: "groups",
      label: (
        <Space>
          <GroupOutlined />
          <span>Insight Groups</span>
        </Space>
      ),
      children: <InsightGroups insights={insights.filter(i => !i.isTemplate)} onRefresh={fetchInsights} />,
    },
    {
      key: "templates",
      label: (
        <Space>
          <AppstoreOutlined />
          <span>Templates</span>
        </Space>
      ),
      children: <TemplateLibrary onUseTemplate={handleUseTemplate} />,
    },
    {
      key: "analytics",
      label: (
        <Space>
          <LineChartOutlined />
          <span>Analytics</span>
        </Space>
      ),
      children: <AnalyticsDashboard />,
    },
  ];

  return (
    <RoutePageShell
      title="AI Insights"
      subtitle="Define custom insights to extract structured data from conversations"
      actions={
        <Space size={12}>
          <Input
            placeholder="Search insights..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as "grid" | "list")}
            options={[
              { value: "grid", icon: <AppstoreOutlined /> },
              { value: "list", icon: <BarsOutlined /> },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateNew}>
            Create Insight
          </Button>
        </Space>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      {/* Insight Builder Drawer */}
      <InsightBuilder
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={handleBuilderSave}
        initialData={editingInsight || undefined}
      />
    </RoutePageShell>
  );
}
