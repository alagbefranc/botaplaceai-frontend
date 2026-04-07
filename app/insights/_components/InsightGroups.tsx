"use client";

import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Transfer,
  Typography,
} from "antd";
import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  GroupOutlined,
  PlusOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { InsightDefinition, InsightGroup } from "@/lib/domain/agent-builder";
import type { ColumnsType } from "antd/es/table";
import {
  BotaFailureIcon,
  BotaNecessaryAttentionIcon,
  BotaRejectedIcon,
} from "@/app/_components/bota-alert-icons";

interface InsightGroupsProps {
  insights: InsightDefinition[];
  onRefresh: () => void;
}

export function InsightGroups({ insights, onRefresh }: InsightGroupsProps) {
  const [groups, setGroups] = useState<InsightGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InsightGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form] = Form.useForm();
  const [selectedInsightIds, setSelectedInsightIds] = useState<string[]>([]);
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/insights/groups");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load groups");
      setGroups(data.groups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = () => {
    setEditingGroup(null);
    form.resetFields();
    setSelectedInsightIds([]);
    setWebhookEnabled(false);
    setWebhookResult(null);
    setModalOpen(true);
  };

  const handleEdit = (group: InsightGroup) => {
    setEditingGroup(group);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      webhookUrl: group.webhookUrl,
      webhookEnabled: group.webhookEnabled,
    });
    setSelectedInsightIds(group.insightIds);
    setWebhookEnabled(group.webhookEnabled);
    setWebhookResult(null);
    setModalOpen(true);
  };

  const handleDelete = async (group: InsightGroup) => {
    if (!group.id) return;
    Modal.confirm({
      title: "Delete Insight Group?",
      content: `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await fetch(`/api/insights/groups/${group.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error("Failed to delete");
          fetchGroups();
        } catch (err) {
          console.error("Delete failed:", err);
        }
      },
    });
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const groupData: Partial<InsightGroup> = {
        name: values.name,
        description: values.description,
        webhookUrl: values.webhookUrl,
        webhookEnabled,
        insightIds: selectedInsightIds,
      };

      const method = editingGroup?.id ? "PUT" : "POST";
      const url = editingGroup?.id ? `/api/insights/groups/${editingGroup.id}` : "/api/insights/groups";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupData),
      });

      if (!res.ok) throw new Error("Failed to save");

      setModalOpen(false);
      fetchGroups();
      onRefresh();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    const url = form.getFieldValue("webhookUrl");
    if (!url) return;

    setTestingWebhook(true);
    setWebhookResult(null);

    try {
      const res = await fetch("/api/insights/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url }),
      });

      const data = await res.json();

      setWebhookResult({
        success: res.ok && data.success,
        message: data.message || (res.ok ? "Webhook responded successfully" : "Webhook test failed"),
      });
    } catch (err) {
      setWebhookResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  // Transfer data source
  const transferData = insights.map((i) => ({
    key: i.id!,
    title: i.name,
    description: i.description,
    insightType: i.insightType,
  }));

  const columns: ColumnsType<InsightGroup> = [
    {
      title: "Group Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record) => (
        <Space>
          <GroupOutlined />
          <Typography.Text strong>{name}</Typography.Text>
          {record.webhookEnabled && (
            <Tag color="green" icon={<ApiOutlined />}>
              Webhook
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      render: (desc: string) => (
        <Typography.Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
          {desc || "-"}
        </Typography.Text>
      ),
    },
    {
      title: "Insights",
      dataIndex: "insightIds",
      key: "insights",
      render: (ids: string[]) => (
        <Tag color="blue">{ids?.length || 0} insights</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, record: InsightGroup) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Insight Groups
          </Typography.Title>
          <Typography.Text type="secondary">
            Bundle multiple insights together and deliver results via webhook
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Group
        </Button>
      </div>

      {/* Groups Table */}
      {error ? (
        <Alert type="error" message={error} showIcon icon={<BotaFailureIcon size={16} />} />
      ) : groups.length === 0 && !loading ? (
        <Card style={{ borderRadius: 12, textAlign: "center", padding: 48 }}>
          <Empty
            image="/assets/illustrations/bota/analytics.svg"
            imageStyle={{ height: 80 }}
            description={
              <Space direction="vertical" size={12}>
                <Typography.Text type="secondary">No insight groups yet</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Create a group to bundle insights and set up webhook delivery
                </Typography.Text>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  Create Your First Group
                </Button>
              </Space>
            }
          />
        </Card>
      ) : (
        <Table
          columns={columns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          pagination={false}
          style={{ borderRadius: 12 }}
        />
      )}

      {/* Create/Edit Modal */}
      <Modal
        title={editingGroup ? "Edit Insight Group" : "Create Insight Group"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editingGroup ? "Save Changes" : "Create Group"}
        confirmLoading={saving}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: "Please enter a name" }]}
          >
            <Input placeholder="e.g., Sales Qualification Bundle" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              placeholder="What insights does this group bundle together?"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>

          {/* Insight Selection */}
          <Form.Item label="Select Insights">
            {insights.length === 0 ? (
              <Alert
                type="info"
                message="No insights available"
                description="Create some insight definitions first before adding them to a group."
                showIcon
                icon={<BotaNecessaryAttentionIcon size={16} />}
              />
            ) : (
              <Transfer
                dataSource={transferData}
                targetKeys={selectedInsightIds}
                onChange={(targetKeys) => setSelectedInsightIds(targetKeys as string[])}
                render={(item) => (
                  <Space>
                    <Tag color={item.insightType === "structured" ? "blue" : "purple"} style={{ margin: 0 }}>
                      {item.insightType === "structured" ? <ThunderboltOutlined /> : "U"}
                    </Tag>
                    {item.title}
                  </Space>
                )}
                titles={["Available", "Selected"]}
                listStyle={{ width: 280, height: 250 }}
                showSearch
                filterOption={(input, item) =>
                  item.title.toLowerCase().includes(input.toLowerCase())
                }
              />
            )}
          </Form.Item>

          {/* Webhook Configuration */}
          <Form.Item label="Webhook Delivery">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Space>
                <Switch
                  checked={webhookEnabled}
                  onChange={setWebhookEnabled}
                />
                <Typography.Text>
                  Send extraction results to a webhook URL
                </Typography.Text>
              </Space>

              {webhookEnabled && (
                <>
                  <Form.Item
                    name="webhookUrl"
                    style={{ marginBottom: 8 }}
                    rules={[
                      { required: true, message: "Webhook URL is required when enabled" },
                      { type: "url", message: "Please enter a valid URL" },
                    ]}
                  >
                    <Input placeholder="https://your-api.com/webhook/insights" />
                  </Form.Item>

                  <Button
                    icon={<SendOutlined />}
                    onClick={handleTestWebhook}
                    loading={testingWebhook}
                  >
                    Test Webhook
                  </Button>

                  {webhookResult && (
                    <Alert
                      type={webhookResult.success ? "success" : "error"}
                      message={webhookResult.message}
                      showIcon
                      icon={webhookResult.success ? undefined : <BotaRejectedIcon size={16} />}
                      style={{ marginTop: 8 }}
                    />
                  )}

                  <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                    Webhook will receive POST requests with extracted insight results when extraction completes.
                  </Typography.Text>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
