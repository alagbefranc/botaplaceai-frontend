"use client";

import {
  Button,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  HolderOutlined,
  InfoCircleOutlined,
  NumberOutlined,
  OrderedListOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { InsightDefinition, InsightParameter, InsightParamType } from "@/lib/domain/agent-builder";

interface InsightBuilderProps {
  open: boolean;
  onClose: () => void;
  onSave: (insight: Partial<InsightDefinition>) => void;
  initialData?: InsightDefinition;
}

const TYPE_OPTIONS: { value: InsightParamType; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "boolean", label: "Boolean", icon: <CheckOutlined />, color: "#52c41a" },
  { value: "number", label: "Number", icon: <NumberOutlined />, color: "#1890ff" },
  { value: "string", label: "String", icon: <span style={{ fontWeight: 600 }}>Aa</span>, color: "#722ed1" },
  { value: "array", label: "Array", icon: <OrderedListOutlined />, color: "#fa8c16" },
];

function ParameterRow({
  parameter,
  index,
  onChange,
  onDelete,
}: {
  parameter: InsightParameter;
  index: number;
  onChange: (param: InsightParameter) => void;
  onDelete: () => void;
}) {
  const [showEnum, setShowEnum] = useState(
    parameter.type === "string" && (parameter.enumValues?.length || 0) > 0
  );
  const [enumInput, setEnumInput] = useState("");

  const handleAddEnum = () => {
    if (!enumInput.trim()) return;
    const newEnums = [...(parameter.enumValues || []), enumInput.trim()];
    onChange({ ...parameter, enumValues: newEnums });
    setEnumInput("");
  };

  const handleRemoveEnum = (val: string) => {
    const newEnums = (parameter.enumValues || []).filter((e) => e !== val);
    onChange({ ...parameter, enumValues: newEnums });
  };

  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #f0f0f0",
        borderRadius: 10,
        marginBottom: 12,
        backgroundColor: "#fafafa",
      }}
    >
      <Row gutter={12} align="middle">
        <Col flex="none">
          <HolderOutlined style={{ cursor: "grab", color: "#999" }} />
        </Col>
        <Col flex="1">
          <Input
            placeholder="Parameter name"
            value={parameter.name}
            onChange={(e) => onChange({ ...parameter, name: e.target.value })}
            style={{ fontWeight: 500 }}
          />
        </Col>
        <Col flex="none" style={{ width: 130 }}>
          <Select
            value={parameter.type}
            onChange={(val) => onChange({ ...parameter, type: val })}
            style={{ width: "100%" }}
            options={TYPE_OPTIONS.map((t) => ({
              value: t.value,
              label: (
                <Space>
                  <span style={{ color: t.color }}>{t.icon}</span>
                  {t.label}
                </Space>
              ),
            }))}
          />
        </Col>
        <Col flex="none">
          <Tooltip title="Required">
            <Switch
              size="small"
              checked={parameter.required}
              onChange={(checked) => onChange({ ...parameter, required: checked })}
            />
          </Tooltip>
        </Col>
        <Col flex="none">
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={onDelete}
          />
        </Col>
      </Row>

      <div style={{ marginTop: 12 }}>
        <Input.TextArea
          placeholder="Description - What should the AI extract for this field?"
          value={parameter.description}
          onChange={(e) => onChange({ ...parameter, description: e.target.value })}
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{ fontSize: 13 }}
        />
      </div>

      {/* Number constraints */}
      {parameter.type === "number" && (
        <Row gutter={12} style={{ marginTop: 12 }}>
          <Col span={12}>
            <InputNumber
              placeholder="Min value"
              value={parameter.min}
              onChange={(val) => onChange({ ...parameter, min: val ?? undefined })}
              style={{ width: "100%" }}
              addonBefore="Min"
            />
          </Col>
          <Col span={12}>
            <InputNumber
              placeholder="Max value"
              value={parameter.max}
              onChange={(val) => onChange({ ...parameter, max: val ?? undefined })}
              style={{ width: "100%" }}
              addonBefore="Max"
            />
          </Col>
        </Row>
      )}

      {/* String enum values */}
      {parameter.type === "string" && (
        <div style={{ marginTop: 12 }}>
          <Space>
            <Switch
              size="small"
              checked={showEnum}
              onChange={setShowEnum}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Fixed options (enum)
            </Typography.Text>
          </Space>

          {showEnum && (
            <div style={{ marginTop: 8 }}>
              <Space wrap style={{ marginBottom: 8 }}>
                {(parameter.enumValues || []).map((val) => (
                  <Tag
                    key={val}
                    closable
                    onClose={() => handleRemoveEnum(val)}
                  >
                    {val}
                  </Tag>
                ))}
              </Space>
              <Input.Search
                placeholder="Add option..."
                value={enumInput}
                onChange={(e) => setEnumInput(e.target.value)}
                onSearch={handleAddEnum}
                enterButton={<PlusOutlined />}
                style={{ maxWidth: 250 }}
              />
            </div>
          )}
        </div>
      )}

      {/* Array item type */}
      {parameter.type === "array" && (
        <div style={{ marginTop: 12 }}>
          <Select
            placeholder="Item type"
            value={parameter.itemType}
            onChange={(val) => onChange({ ...parameter, itemType: val })}
            style={{ width: 150 }}
            options={[
              { value: "string", label: "String items" },
              { value: "number", label: "Number items" },
              { value: "boolean", label: "Boolean items" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

export function InsightBuilder({ open, onClose, onSave, initialData }: InsightBuilderProps) {
  const [form] = Form.useForm();
  const [insightType, setInsightType] = useState<"structured" | "unstructured">(
    initialData?.insightType || "structured"
  );
  const [parameters, setParameters] = useState<InsightParameter[]>(
    initialData?.schema?.parameters || []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        form.setFieldsValue({
          name: initialData.name,
          description: initialData.description,
          prompt: initialData.prompt,
        });
        setInsightType(initialData.insightType);
        setParameters(initialData.schema?.parameters || []);
      } else {
        form.resetFields();
        setInsightType("structured");
        setParameters([]);
      }
    }
  }, [open, initialData, form]);

  const handleAddParameter = () => {
    setParameters([
      ...parameters,
      {
        name: "",
        type: "string",
        description: "",
        required: false,
      },
    ]);
  };

  const handleParameterChange = (index: number, param: InsightParameter) => {
    const newParams = [...parameters];
    newParams[index] = param;
    setParameters(newParams);
  };

  const handleParameterDelete = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const insight: Partial<InsightDefinition> = {
        name: values.name,
        description: values.description,
        insightType,
      };

      if (insightType === "structured") {
        insight.schema = { parameters };
      } else {
        insight.prompt = values.prompt;
      }

      await onSave(insight);
    } catch (err) {
      console.error("Validation failed:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={initialData ? "Edit Insight Definition" : "Create New Insight"}
      width={680}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {initialData ? "Save Changes" : "Create Insight"}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        {/* Name */}
        <Form.Item
          name="name"
          label={
            <Space>
              <span>Insight Name</span>
              <Tooltip title="A descriptive name for this insight definition">
                <InfoCircleOutlined style={{ color: "#999" }} />
              </Tooltip>
            </Space>
          }
          rules={[{ required: true, message: "Please enter a name" }]}
        >
          <Input placeholder="e.g., Lead Qualification, Customer Satisfaction" />
        </Form.Item>

        {/* Description */}
        <Form.Item
          name="description"
          label="Description"
        >
          <Input.TextArea
            placeholder="What does this insight extract from conversations?"
            autoSize={{ minRows: 2, maxRows: 4 }}
          />
        </Form.Item>

        <Divider />

        {/* Insight Type */}
        <Form.Item
          label={
            <Space>
              <span>Insight Type</span>
              <Tooltip title="Structured insights have typed parameters, unstructured use free-form prompts">
                <QuestionCircleOutlined style={{ color: "#999" }} />
              </Tooltip>
            </Space>
          }
        >
          <Segmented
            value={insightType}
            onChange={(val) => setInsightType(val as "structured" | "unstructured")}
            options={[
              {
                value: "structured",
                label: (
                  <Space>
                    <CheckOutlined />
                    <span>Structured</span>
                  </Space>
                ),
              },
              {
                value: "unstructured",
                label: (
                  <Space>
                    <CloseOutlined />
                    <span>Unstructured</span>
                  </Space>
                ),
              },
            ]}
            block
          />
        </Form.Item>

        {/* Structured: Parameters */}
        {insightType === "structured" && (
          <div>
            <Typography.Text strong style={{ display: "block", marginBottom: 16 }}>
              Parameters
            </Typography.Text>

            {parameters.length === 0 ? (
              <div
                style={{
                  padding: 32,
                  textAlign: "center",
                  border: "2px dashed #d9d9d9",
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <Typography.Text type="secondary">
                  No parameters yet. Add parameters to define what data to extract.
                </Typography.Text>
              </div>
            ) : (
              parameters.map((param, index) => (
                <ParameterRow
                  key={index}
                  parameter={param}
                  index={index}
                  onChange={(p) => handleParameterChange(index, p)}
                  onDelete={() => handleParameterDelete(index)}
                />
              ))
            )}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddParameter}
              block
            >
              Add Parameter
            </Button>
          </div>
        )}

        {/* Unstructured: Prompt */}
        {insightType === "unstructured" && (
          <Form.Item
            name="prompt"
            label={
              <Space>
                <span>Extraction Prompt</span>
                <Tooltip title="Describe what information to extract. The AI will return free-form text.">
                  <InfoCircleOutlined style={{ color: "#999" }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: "Please enter an extraction prompt" }]}
          >
            <Input.TextArea
              placeholder="e.g., Summarize the customer's main concerns and any deadlines mentioned..."
              autoSize={{ minRows: 4, maxRows: 8 }}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
}
