"use client";

import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  NumberOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { CustomInsightResult, InsightDefinition, InsightParameter } from "@/lib/domain/agent-builder";
import {
  BotaFailureIcon,
  BotaNecessaryAttentionIcon,
} from "@/app/_components/bota-alert-icons";

interface CustomInsightsPanelProps {
  conversationId: string;
  agentId: string;
}

interface ExtendedResult extends CustomInsightResult {
  definition?: InsightDefinition;
}

function renderParameterValue(
  param: InsightParameter,
  value: unknown
): React.ReactNode {
  if (value === null || value === undefined) {
    return <Typography.Text type="secondary">Not extracted</Typography.Text>;
  }

  switch (param.type) {
    case "boolean":
      return value ? (
        <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag>
      ) : (
        <Tag color="red" icon={<CloseCircleOutlined />}>No</Tag>
      );

    case "number":
      return (
        <Tag color="blue" icon={<NumberOutlined />}>
          {String(value)}
        </Tag>
      );

    case "string":
      if (param.enumValues?.length) {
        return <Tag color="purple">{String(value)}</Tag>;
      }
      return <Typography.Text>{String(value)}</Typography.Text>;

    case "array":
      if (Array.isArray(value)) {
        return (
          <Space wrap size={4}>
            {value.map((item, i) => (
              <Tag key={i} icon={<OrderedListOutlined />}>
                {String(item)}
              </Tag>
            ))}
          </Space>
        );
      }
      return <Typography.Text>{JSON.stringify(value)}</Typography.Text>;

    default:
      return <Typography.Text>{JSON.stringify(value)}</Typography.Text>;
  }
}

function CustomInsightResultCard({
  result,
  onReExtract,
  extracting,
}: {
  result: ExtendedResult;
  onReExtract: () => void;
  extracting: boolean;
}) {
  const definition = result.definition;
  const params = definition?.schema?.parameters || [];

  return (
    <Card
      size="small"
      title={
        <Space>
          <Tag color={definition?.insightType === "structured" ? "blue" : "purple"}>
            {definition?.insightType === "structured" ? (
              <ThunderboltOutlined />
            ) : (
              <BulbOutlined />
            )}
          </Tag>
          <Typography.Text strong>{definition?.name || "Unknown Insight"}</Typography.Text>
        </Space>
      }
      extra={
        <Tooltip title="Re-extract this insight">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            loading={extracting}
            onClick={onReExtract}
          />
        </Tooltip>
      }
      style={{ borderRadius: 10 }}
    >
      {definition?.insightType === "structured" ? (
        <Descriptions size="small" column={1}>
          {params.map((param) => (
            <Descriptions.Item
              key={param.name}
              label={
                <Tooltip title={param.description}>
                  <Space>
                    <span>{param.name}</span>
                    {param.required && (
                      <Typography.Text type="danger" style={{ fontSize: 10 }}>
                        *
                      </Typography.Text>
                    )}
                  </Space>
                </Tooltip>
              }
            >
              {renderParameterValue(param, (result.result as Record<string, unknown>)[param.name])}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : (
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {typeof result.result === "string"
            ? result.result
            : JSON.stringify(result.result, null, 2)}
        </Typography.Paragraph>
      )}

      {result.extractedAt && (
        <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
          Extracted: {new Date(result.extractedAt).toLocaleString()}
        </Typography.Text>
      )}
    </Card>
  );
}

export function CustomInsightsPanel({ conversationId, agentId }: CustomInsightsPanelProps) {
  const [results, setResults] = useState<ExtendedResult[]>([]);
  const [definitions, setDefinitions] = useState<InsightDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<string | null>(null);
  const [extractingAll, setExtractingAll] = useState(false);

  // Fetch results and definitions
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [resultsRes, defsRes] = await Promise.all([
        fetch(`/api/conversations/${conversationId}/custom-insights`),
        fetch("/api/insights"),
      ]);

      const [resultsData, defsData] = await Promise.all([
        resultsRes.json(),
        defsRes.json(),
      ]);

      if (!resultsRes.ok) throw new Error(resultsData.error || "Failed to load results");
      if (!defsRes.ok) throw new Error(defsData.error || "Failed to load definitions");

      const defs = defsData.insights || [];
      setDefinitions(defs);

      // Merge results with definitions
      const extended: ExtendedResult[] = (resultsData.results || []).map((r: CustomInsightResult) => ({
        ...r,
        definition: defs.find((d: InsightDefinition) => d.id === r.definitionId),
      }));
      setResults(extended);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExtract = async (definitionId?: string) => {
    try {
      if (definitionId) {
        setExtracting(definitionId);
      } else {
        setExtractingAll(true);
      }

      const res = await fetch(`/api/conversations/${conversationId}/custom-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionIds: definitionId ? [definitionId] : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to extract");

      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(null);
      setExtractingAll(false);
    }
  };

  // Group results by definition
  const groupedResults = results.reduce((acc, result) => {
    const key = result.definitionId;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {} as Record<string, ExtendedResult[]>);

  // Get available definitions that haven't been extracted yet
  const availableDefinitions = definitions.filter(
    (d) => !d.isTemplate && !groupedResults[d.id!]
  );

  if (loading) {
    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Skeleton active paragraph={{ rows: 3 }} />
        <Skeleton active paragraph={{ rows: 3 }} />
      </Space>
    );
  }

  if (error) {
    return <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />;
  }

  if (results.length === 0 && definitions.length === 0) {
    return (
      <Empty
        image="/assets/illustrations/bota/analytics.svg"
        imageStyle={{ height: 80 }}
        description={
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">
              No custom insights configured
            </Typography.Text>
            <Button type="link" href="/insights" target="_blank">
              Create Custom Insights
            </Button>
          </Space>
        }
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography.Text strong>Custom Insights</Typography.Text>
        {definitions.filter(d => !d.isTemplate).length > 0 && (
          <Button
            size="small"
            icon={<BulbOutlined />}
            loading={extractingAll}
            onClick={() => handleExtract()}
          >
            Extract All
          </Button>
        )}
      </div>

      {/* Extracted Results */}
      {results.length > 0 ? (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {Object.entries(groupedResults).map(([defId, defResults]) => {
            const latestResult = defResults.sort((a, b) =>
              new Date(b.extractedAt || 0).getTime() - new Date(a.extractedAt || 0).getTime()
            )[0];

            return (
              <CustomInsightResultCard
                key={defId}
                result={latestResult}
                onReExtract={() => handleExtract(defId)}
                extracting={extracting === defId}
              />
            );
          })}
        </Space>
      ) : (
        <Alert
          type="info"
          message="No insights extracted yet"
          description="Click 'Extract All' or configure custom insights in your agent settings."
          showIcon
          icon={<BotaNecessaryAttentionIcon size={16} />}
        />
      )}

      {/* Available to extract */}
      {availableDefinitions.length > 0 && (
        <Collapse
          size="small"
          items={[
            {
              key: "available",
              label: (
                <Typography.Text type="secondary">
                  {availableDefinitions.length} more insight{availableDefinitions.length !== 1 ? "s" : ""} available
                </Typography.Text>
              ),
              children: (
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  {availableDefinitions.map((def) => (
                    <div
                      key={def.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <Space>
                        <Tag color={def.insightType === "structured" ? "blue" : "purple"}>
                          {def.insightType === "structured" ? (
                            <ThunderboltOutlined />
                          ) : (
                            <BulbOutlined />
                          )}
                        </Tag>
                        <Typography.Text>{def.name}</Typography.Text>
                      </Space>
                      <Button
                        size="small"
                        type="text"
                        loading={extracting === def.id}
                        onClick={() => handleExtract(def.id!)}
                      >
                        Extract
                      </Button>
                    </div>
                  ))}
                </Space>
              ),
            },
          ]}
        />
      )}
    </Space>
  );
}
