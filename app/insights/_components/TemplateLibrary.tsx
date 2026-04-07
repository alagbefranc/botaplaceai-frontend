"use client";

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
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  BulbOutlined,
  CheckOutlined,
  CopyOutlined,
  CustomerServiceOutlined,
  MedicineBoxOutlined,
  RiseOutlined,
  SearchOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { InsightDefinition, InsightParameter } from "@/lib/domain/agent-builder";
import { BotaFailureIcon } from "@/app/_components/bota-alert-icons";

interface TemplateLibraryProps {
  onUseTemplate: (template: InsightDefinition) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  healthcare: { icon: <MedicineBoxOutlined />, color: "#eb2f96", label: "Healthcare" },
  sales: { icon: <RiseOutlined />, color: "#52c41a", label: "Sales" },
  support: { icon: <CustomerServiceOutlined />, color: "#1890ff", label: "Support" },
  ecommerce: { icon: <ShoppingOutlined />, color: "#fa8c16", label: "E-commerce" },
  hr: { icon: <TeamOutlined />, color: "#722ed1", label: "HR & Recruiting" },
};

function TemplateCard({
  template,
  onUse,
}: {
  template: InsightDefinition;
  onUse: () => void;
}) {
  const category = template.templateCategory || "other";
  const config = CATEGORY_CONFIG[category] || { icon: <BulbOutlined />, color: "#666", label: category };
  const params = template.schema?.parameters || [];

  return (
    <Card
      hoverable
      size="small"
      style={{ borderRadius: 12, height: "100%", minHeight: 200 }}
      actions={[
        <Button
          key="use"
          type="primary"
          icon={<CopyOutlined />}
          onClick={onUse}
          size="small"
        >
          Use Template
        </Button>,
      ]}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {/* Category badge */}
        <Tag color={config.color} icon={config.icon}>
          {config.label}
        </Tag>

        {/* Title */}
        <Typography.Text strong style={{ fontSize: 16 }}>
          {template.name}
        </Typography.Text>

        {/* Description */}
        {template.description && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {template.description}
          </Typography.Text>
        )}

        {/* Parameters preview */}
        {params.length > 0 && (
          <div>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
              Parameters:
            </Typography.Text>
            <Space size={4} wrap>
              {params.slice(0, 4).map((p: InsightParameter) => (
                <Tooltip key={p.name} title={`${p.type}${p.required ? " (required)" : ""}: ${p.description}`}>
                  <Tag
                    style={{ fontSize: 11, margin: 0 }}
                    color={
                      p.type === "boolean"
                        ? "green"
                        : p.type === "number"
                        ? "blue"
                        : p.type === "array"
                        ? "orange"
                        : "default"
                    }
                  >
                    {p.name}
                  </Tag>
                </Tooltip>
              ))}
              {params.length > 4 && (
                <Tag style={{ fontSize: 11, margin: 0 }}>+{params.length - 4} more</Tag>
              )}
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
}

export function TemplateLibrary({ onUseTemplate }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<InsightDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/insights/templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load templates");
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleUse = async (template: InsightDefinition) => {
    setCopiedId(template.id || null);
    await onUseTemplate(template);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || t.templateCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories: string[] = ["all", ...new Set(templates.map((t) => t.templateCategory).filter((c): c is string => Boolean(c)))];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Industry Templates
          </Typography.Title>
          <Typography.Text type="secondary">
            Pre-built insight definitions for common use cases. Click to add to your insights.
          </Typography.Text>
        </div>
        <Input
          placeholder="Search templates..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 240 }}
          allowClear
        />
      </div>

      {/* Category Filter */}
      <Segmented
        value={selectedCategory}
        onChange={(val) => setSelectedCategory(val as string)}
        options={categories.map((cat) => ({
          value: cat,
          label:
            cat === "all" ? (
              "All"
            ) : (
              <Space size={4}>
                {CATEGORY_CONFIG[cat]?.icon}
                <span>{CATEGORY_CONFIG[cat]?.label || cat}</span>
              </Space>
            ),
        }))}
      />

      {/* Templates Grid */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col key={i} xs={24} sm={12} md={8} lg={6}>
              <Card style={{ borderRadius: 12 }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : error ? (
        <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
      ) : filteredTemplates.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: "center", padding: 48 }}>
          <Empty
            image="/assets/illustrations/bota/analytics.svg"
            imageStyle={{ height: 80 }}
            description={
              <Space direction="vertical" size={8}>
                <Typography.Text type="secondary">No templates found</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Try adjusting your search or category filter
                </Typography.Text>
              </Space>
            }
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredTemplates.map((template) => (
            <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
              <div style={{ position: "relative" }}>
                <TemplateCard
                  template={template}
                  onUse={() => handleUse(template)}
                />
                {copiedId === template.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(82, 196, 26, 0.9)",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Space>
                      <CheckOutlined style={{ color: "white", fontSize: 24 }} />
                      <Typography.Text style={{ color: "white", fontWeight: 500 }}>
                        Added to My Insights
                      </Typography.Text>
                    </Space>
                  </div>
                )}
              </div>
            </Col>
          ))}
        </Row>
      )}
    </Space>
  );
}
