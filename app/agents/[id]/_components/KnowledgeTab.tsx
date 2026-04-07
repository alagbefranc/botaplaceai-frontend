"use client";

import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import {
  BookOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  ExportOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useState } from "react";
import type { TabProps } from "./types";

const { Dragger } = Upload;
const { Text } = Typography;

interface KnowledgeBase {
  id: string;
  name: string;
  source_type: "file" | "website" | "google_drive" | "slack" | "jira" | "sharepoint";
  source_url: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  chunks_count: number;
  processing_status: "pending" | "processing" | "ready" | "error";
  created_at: string;
}

type SourceType = "file" | "website";

export function KnowledgeTab({ agent }: TabProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [allKnowledgeBases, setAllKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [fileName, setFileName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const loadKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      // Load KBs assigned to this agent
      const response = await fetch(`/api/knowledge-base?orgId=_current&agentId=${agent.id}`);
      const data = await response.json();
      if (response.ok) {
        setKnowledgeBases(data.knowledgeBases || []);
      }

      // Load all KBs for linking
      const allResponse = await fetch(`/api/knowledge-base?orgId=_current`);
      const allData = await allResponse.json();
      if (allResponse.ok) {
        setAllKnowledgeBases(allData.knowledgeBases || []);
      }
    } catch {
      message.error("Failed to load knowledge bases");
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    void loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  const handleUpload = async () => {
    setUploading(true);
    try {
      if (sourceType === "file") {
        if (fileList.length === 0) {
          message.error("Please select a file");
          setUploading(false);
          return;
        }

        const file = fileList[0].originFileObj;
        if (!file) {
          message.error("Invalid file");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("orgId", "_current");
        formData.append("agentId", agent.id);
        formData.append("sourceType", "file");
        if (fileName) {
          formData.append("name", fileName);
        }

        const response = await fetch("/api/knowledge-base/upload", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Upload failed");
        }

        message.success("File uploaded successfully!");
      } else if (sourceType === "website") {
        if (!websiteUrl) {
          message.error("Please enter a website URL");
          setUploading(false);
          return;
        }

        const response = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: "_current",
            agentId: agent.id,
            name: fileName || websiteUrl,
            sourceType: "website",
            sourceUrl: websiteUrl,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to add website");
        }

        const kb = data.knowledgeBase;
        if (kb?.processing_status === "ready" && kb.chunks_count > 0) {
          message.success(`Website indexed with ${kb.chunks_count} chunks`);
        } else if (kb?.processing_status === "error") {
          message.warning("Website added but extraction failed. Try re-extracting.");
        } else {
          message.success("Website added successfully");
        }
      }

      setIsModalOpen(false);
      setFileList([]);
      setFileName("");
      setWebsiteUrl("");
      setSourceType("file");
      void loadKnowledgeBases();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUnassign = async (kbId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${kbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to unassign");
      }

      message.success("Knowledge base unassigned from agent");
      void loadKnowledgeBases();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to unassign");
    }
  };

  const handleDelete = async (kbId: string) => {
    Modal.confirm({
      title: "Delete Knowledge Base",
      content: "Are you sure you want to permanently delete this knowledge base?",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await fetch(`/api/knowledge-base/${kbId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to delete");
          }

          message.success("Knowledge base deleted");
          void loadKnowledgeBases();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Failed to delete");
        }
      },
    });
  };

  const handleLinkExisting = async (kbId: string) => {
    try {
      const response = await fetch(`/api/knowledge-base/${kbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to link");
      }

      message.success("Knowledge base linked to agent");
      setIsLinkModalOpen(false);
      void loadKnowledgeBases();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to link");
    }
  };

  const handleReextract = async (kb: KnowledgeBase) => {
    if (kb.source_type !== "website") return;

    setExtractingId(kb.id);
    try {
      const response = await fetch(`/api/knowledge-base/${kb.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reextractWebsite: true }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      message.success(data.message || "Website re-extracted successfully");
      void loadKnowledgeBases();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Extraction failed");
    } finally {
      setExtractingId(null);
    }
  };

  const uploadProps: UploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      setFileList([file as unknown as UploadFile]);
      return false;
    },
    fileList,
    maxCount: 1,
    accept: ".txt,.md,.pdf,.json,.csv",
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case "ready":
        return <Tag color="green">Ready</Tag>;
      case "processing":
        return <Tag color="blue">Processing</Tag>;
      case "pending":
        return <Tag color="orange">Pending</Tag>;
      case "error":
        return <Tag color="red">Error</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "website":
        return <GlobalOutlined style={{ color: "#1890ff" }} />;
      default:
        return <FileTextOutlined style={{ color: "#52c41a" }} />;
    }
  };

  // Get unlinked knowledge bases for the link modal
  const unlinkedKnowledgeBases = allKnowledgeBases.filter(
    (kb) => !knowledgeBases.some((assigned) => assigned.id === kb.id)
  );

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: KnowledgeBase) => (
        <Space>
          {getSourceIcon(record.source_type)}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "source_type",
      key: "type",
      width: 100,
      render: (type: string) => (
        <Tag>{type === "website" ? "Website" : "File"}</Tag>
      ),
    },
    {
      title: "Chunks",
      dataIndex: "chunks_count",
      key: "chunks",
      width: 80,
      render: (count: number) => count || "—",
    },
    {
      title: "Status",
      dataIndex: "processing_status",
      key: "status",
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_: unknown, record: KnowledgeBase) => (
        <Space size="small">
          {record.source_type === "website" && (
            <Tooltip title="Re-extract website">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                loading={extractingId === record.id}
                onClick={() => handleReextract(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Unassign from agent">
            <Button
              type="text"
              size="small"
              icon={<ExportOutlined />}
              onClick={() => handleUnassign(record.id)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      {/* Main Knowledge Base Card */}
      <Card
        title={
          <Space>
            <BookOutlined />
            <span>Knowledge Base</span>
            <Tooltip title="Upload documents and websites to give your agent contextual knowledge for better responses">
              <QuestionCircleOutlined style={{ color: "#999" }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<LinkOutlined />}
              onClick={() => setIsLinkModalOpen(true)}
              disabled={unlinkedKnowledgeBases.length === 0}
            >
              Link Existing
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Knowledge
            </Button>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text>No knowledge assigned to this agent</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Add files or websites to enhance your agent's responses
                </Text>
              </Space>
            }
          >
            <Space>
              <Button type="primary" onClick={() => setIsModalOpen(true)}>
                Add Knowledge
              </Button>
              {unlinkedKnowledgeBases.length > 0 && (
                <Button onClick={() => setIsLinkModalOpen(true)}>
                  Link Existing
                </Button>
              )}
            </Space>
          </Empty>
        ) : (
          <Table
            dataSource={knowledgeBases}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* Info Card */}
      <Alert
        type="info"
        icon={<InfoCircleOutlined />}
        title="How Knowledge Base Works"
        description={
          <Space direction="vertical" size={4}>
            <Text>
              Knowledge bases are crawled and chunked for retrieval. When your agent receives a question,
              relevant chunks are automatically included in the context.
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Supported file types: .txt, .md, .pdf, .json, .csv (max 10MB)
            </Text>
          </Space>
        }
        showIcon
      />

      {/* Add Knowledge Modal */}
      <Modal
        title="Add Knowledge"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setFileList([]);
          setFileName("");
          setWebsiteUrl("");
          setSourceType("file");
        }}
        onOk={handleUpload}
        okText={sourceType === "file" ? "Upload" : "Add Website"}
        confirmLoading={uploading}
        okButtonProps={{
          disabled: sourceType === "file" ? fileList.length === 0 : !websiteUrl,
        }}
        width={520}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Source Type
            </Text>
            <Segmented
              block
              value={sourceType}
              onChange={(value) => setSourceType(value as SourceType)}
              options={[
                {
                  label: (
                    <Space>
                      <FileTextOutlined />
                      <span>File</span>
                    </Space>
                  ),
                  value: "file",
                },
                {
                  label: (
                    <Space>
                      <GlobalOutlined />
                      <span>Website</span>
                    </Space>
                  ),
                  value: "website",
                },
              ]}
            />
          </div>

          <Form.Item label="Name (optional)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Enter a name for this knowledge source"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
            />
          </Form.Item>

          {sourceType === "file" && (
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">
                Supported: .txt, .md, .pdf, .json, .csv (max 10MB)
              </p>
            </Dragger>
          )}

          {sourceType === "website" && (
            <Form.Item label="Website URL" style={{ marginBottom: 0 }}>
              <Input
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                prefix={<GlobalOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                We'll crawl and index up to 6 pages from this domain
              </Text>
            </Form.Item>
          )}
        </Space>
      </Modal>

      {/* Link Existing Modal */}
      <Modal
        title="Link Existing Knowledge Base"
        open={isLinkModalOpen}
        onCancel={() => setIsLinkModalOpen(false)}
        footer={null}
        width={600}
      >
        {unlinkedKnowledgeBases.length === 0 ? (
          <Empty description="All knowledge bases are already assigned to this agent" />
        ) : (
          <Table
            dataSource={unlinkedKnowledgeBases}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: "Name",
                dataIndex: "name",
                key: "name",
                render: (name: string, record: KnowledgeBase) => (
                  <Space>
                    {getSourceIcon(record.source_type)}
                    <Text>{name}</Text>
                  </Space>
                ),
              },
              {
                title: "Type",
                dataIndex: "source_type",
                key: "type",
                width: 100,
                render: (type: string) => (
                  <Tag>{type === "website" ? "Website" : "File"}</Tag>
                ),
              },
              {
                title: "Status",
                dataIndex: "processing_status",
                key: "status",
                width: 100,
                render: (status: string) => getStatusTag(status),
              },
              {
                title: "",
                key: "action",
                width: 80,
                render: (_: unknown, record: KnowledgeBase) => (
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => handleLinkExisting(record.id)}
                  >
                    Link
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Modal>
    </Space>
  );
}
