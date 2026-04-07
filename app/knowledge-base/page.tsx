"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  Input,
} from "antd";
import type { UploadFile, UploadProps } from "antd";
import {
  CheckCircleOutlined,
  CloudOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  GlobalOutlined,
  GoogleOutlined,
  InboxOutlined,
  IssuesCloseOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SlackOutlined,
} from "@ant-design/icons";
import { DisconnectOutlined } from "@ant-design/icons";
import { RoutePageShell } from "@/app/_components/route-page-shell";

const { Text } = Typography;
const { Dragger } = Upload;

interface KnowledgeBase {
  id: string;
  org_id?: string;
  name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  chunks_count: number;
  processing_status: "pending" | "processing" | "ready" | "error";
  agent_id: string | null;
  source_type: "file" | "website" | "google_drive" | "slack" | "jira" | "sharepoint";
  source_url: string | null;
  source_config?: Record<string, unknown> | null;
  vertex_corpus_id: string | null;
  created_at: string;
}

type SourceType = "file" | "website" | "google_drive" | "slack" | "jira";

function parseDriveUrl(input: string): { id: string; type: "folder" | "file" } | null {
  try {
    // Handle folder URLs: /drive/folders/<id>
    const folderMatch = input.match(/\/folders\/([\w-]+)/);
    if (folderMatch) return { id: folderMatch[1], type: "folder" };
    // Handle file URLs: /file/d/<id>
    const fileMatch = input.match(/\/file\/d\/([\w-]+)/);
    if (fileMatch) return { id: fileMatch[1], type: "file" };
    // Handle raw IDs (alphanumeric + dash/underscore, ~25–44 chars)
    if (/^[\w-]{20,}$/.test(input.trim())) return { id: input.trim(), type: "folder" };
    return null;
  } catch {
    return null;
  }
}

interface Agent {
  id: string;
  name: string;
}

interface WebsiteSourcePage {
  url: string;
  title?: string | null;
  excerpt?: string;
  charCount?: number;
}

interface WebsiteSourceConfig {
  provider?: string;
  ingestion_mode?: string;
  connector?: string;
  extraction_engine?: string;
  extracted_at?: string;
  total_pages?: number;
  total_characters?: number;
  extraction_error?: string | null;
  pages?: WebsiteSourcePage[];
  sample_chunks?: string[];
}

export default function KnowledgeBasePage() {
  const { message, modal } = App.useApp();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [sourceType, setSourceType] = useState<SourceType>("file");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveConfigured, setDriveConfigured] = useState(false);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);

  const resolveOrgId = useCallback(async () => {
    const response = await fetch("/api/auth/bootstrap", { method: "POST" });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      org?: { id: string };
    } | null;

    if (response.ok && payload?.org?.id) {
      localStorage.setItem("orgId", payload.org.id);
      return payload.org.id;
    }

    const cachedOrgId = localStorage.getItem("orgId");
    return cachedOrgId && cachedOrgId.length > 0 ? cachedOrgId : null;
  }, []);

  const loadDriveStatus = useCallback(async (orgId: string) => {
    try {
      const res = await fetch(`/api/integrations/google-drive/status?orgId=${orgId}`);
      if (res.ok) {
        const d = await res.json();
        setDriveConnected(!!d.connected);
        setDriveEmail(d.email ?? null);
        setDriveConfigured(!!d.configured);
      }
    } catch { /* non-critical */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const orgId = await resolveOrgId();

    if (!orgId) {
      setKnowledgeBases([]);
      setAgents([]);
      setLoading(false);
      message.warning("No organization context found. Please sign in again.");
      return;
    }

    try {
      const [kbResponse, agentsResponse] = await Promise.all([
        fetch(`/api/knowledge-base?orgId=${orgId}`),
        fetch("/api/agents"),
      ]);

      const kbData = await kbResponse.json();
      const agentsData = await agentsResponse.json();

      if (kbResponse.ok && kbData.knowledgeBases) {
        setKnowledgeBases(kbData.knowledgeBases);
      }

      if (agentsResponse.ok && agentsData.agents) {
        setAgents(agentsData.agents);
      }

      // Check Drive connection status
      await loadDriveStatus(orgId);
    } catch {
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [message, resolveOrgId, loadDriveStatus]);

  useEffect(() => {
    loadData();
    // Handle Google Drive OAuth callback result from URL params
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const driveParam = params.get("drive");
      if (driveParam === "connected") {
        message.success("Google Drive connected successfully!");
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
      } else if (driveParam === "denied") {
        message.warning("Google Drive connection was cancelled.");
        window.history.replaceState({}, "", window.location.pathname);
      } else if (driveParam === "error") {
        const reason = params.get("reason") ?? "unknown";
        message.error(`Google Drive connection failed: ${reason}`);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [loadData, message]);

  const handleSubmit = async () => {
    const orgId = await resolveOrgId();

    if (!orgId) {
      message.error("Organization context is missing. Please sign in again.");
      return;
    }

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
        formData.append("orgId", orgId);
        formData.append("sourceType", "file");
        if (selectedAgentId) {
          formData.append("agentId", selectedAgentId);
        }
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
            orgId,
            agentId: selectedAgentId,
            name: fileName || websiteUrl,
            sourceType: "website",
            sourceUrl: websiteUrl,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to add website");
        }

        const createdKnowledgeBase = data.knowledgeBase as KnowledgeBase | undefined;
        const apiMessage = typeof data.message === "string" ? data.message : null;
        const warning = typeof data.warning === "string" ? data.warning : null;

        if (createdKnowledgeBase?.processing_status === "ready" && createdKnowledgeBase.chunks_count > 0) {
          message.success(
            apiMessage
              || `Website indexed successfully with ${createdKnowledgeBase.chunks_count} extracted chunk(s).`
          );
        } else if (createdKnowledgeBase?.processing_status === "error") {
          message.warning(
            warning
              || apiMessage
              || "Website was added but content extraction failed. Open details and run Extract Data."
          );
        } else {
          message.success(apiMessage || "Website source added successfully.");
        }
      } else if (sourceType === "google_drive") {
        if (!driveUrl) {
          message.error("Please enter a Google Drive URL or folder/file ID");
          setUploading(false);
          return;
        }

        const parsed = parseDriveUrl(driveUrl);
        if (!parsed) {
          message.error("Invalid Google Drive URL. Paste a folder or file URL from Google Drive.");
          setUploading(false);
          return;
        }

        const response = await fetch("/api/knowledge-base", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            agentId: selectedAgentId,
            name: fileName || `Google Drive - ${parsed.type === "folder" ? "Folder" : "File"}`,
            sourceType: "google_drive",
            driveResourceId: parsed.id,
            driveResourceType: parsed.type,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.warning || "Failed to import from Google Drive");
        }

        if (data.warning) {
          message.warning(data.warning);
        } else {
          message.success(data.message || "Google Drive import started successfully");
        }
      } else {
        // Slack/Jira coming soon
        message.info(`${sourceType} integration coming soon!`);
        setUploading(false);
        return;
      }

      // Reset form
      setIsModalOpen(false);
      setFileList([]);
      setFileName("");
      setWebsiteUrl("");
      setDriveUrl("");
      setSelectedAgentId(null);
      setSourceType("file");
      loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDisconnectDrive = async () => {
    const orgId = await resolveOrgId();
    if (!orgId) return;
    setDisconnectingDrive(true);
    try {
      const res = await fetch(`/api/integrations/google-drive/status?orgId=${orgId}`, { method: "DELETE" });
      if (res.ok) {
        setDriveConnected(false);
        setDriveEmail(null);
        message.success("Google Drive disconnected.");
      } else {
        message.error("Failed to disconnect Google Drive.");
      }
    } finally {
      setDisconnectingDrive(false);
    }
  };

  const extractWebsiteDataNow = async (record: KnowledgeBase) => {
    if (record.source_type !== "website") {
      message.error("Extraction is only supported for website sources");
      return;
    }

    setExtractingId(record.id);

    try {
      const response = await fetch(`/api/knowledge-base/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reextractWebsite: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract website data");
      }

      const updated = data.knowledgeBase as KnowledgeBase;

      setKnowledgeBases((prev) => prev.map((kb) => (kb.id === updated.id ? updated : kb)));
      if (selectedKnowledgeBase?.id === updated.id) {
        setSelectedKnowledgeBase(updated);
      }

      message.success(
        typeof data.message === "string"
          ? data.message
          : `Extracted ${updated.chunks_count} chunk(s) from website source.`
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to extract website data");
    } finally {
      setExtractingId(null);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "—";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  };

  const selectedWebsiteConfig: WebsiteSourceConfig =
    selectedKnowledgeBase?.source_type === "website"
      ? ((selectedKnowledgeBase.source_config as WebsiteSourceConfig | null) ?? {})
      : {};

  const extractedPages = Array.isArray(selectedWebsiteConfig.pages)
    ? selectedWebsiteConfig.pages
    : [];

  const sampleChunks = Array.isArray(selectedWebsiteConfig.sample_chunks)
    ? selectedWebsiteConfig.sample_chunks
    : [];

  const handleDelete = async (id: string) => {
    modal.confirm({
      title: "Delete Knowledge Base",
      content: "Are you sure you want to delete this knowledge base? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await fetch(`/api/knowledge-base/${id}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Delete failed");
          }

          message.success("Knowledge base deleted");
          if (selectedKnowledgeBase?.id === id) {
            setSelectedKnowledgeBase(null);
            setDetailsOpen(false);
          }
          loadData();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "Delete failed");
        }
      },
    });
  };

  const handleAssignAgent = async (kbId: string, agentId: string | null) => {
    try {
      const response = await fetch(`/api/knowledge-base/${kbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Update failed");
      }

      message.success("Agent assignment updated");
      loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Update failed");
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

  const getSourceLabel = (type: string) => {
    switch (type) {
      case "google_drive":
        return "Google Drive";
      case "sharepoint":
        return "SharePoint";
      case "website":
        return "Website";
      default:
        return type?.charAt(0).toUpperCase() + type?.slice(1) || "File";
    }
  };

  const toExternalUrl = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url}`;

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

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "website":
        return <GlobalOutlined />;
      case "google_drive":
        return <GoogleOutlined />;
      case "slack":
        return <SlackOutlined />;
      case "jira":
        return <IssuesCloseOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { status: "success" | "processing" | "default" | "error" | "warning"; text: string }> = {
      ready: { status: "success", text: "Ready" },
      processing: { status: "processing", text: "Processing" },
      pending: { status: "warning", text: "Pending" },
      error: { status: "error", text: "Error" },
    };

    return map[status] ?? { status: "default", text: status };
  };

  const openDetailsDrawer = async (record: KnowledgeBase) => {
    setDetailsOpen(true);
    setSelectedKnowledgeBase(record);
    setDetailsLoading(true);

    try {
      const response = await fetch(`/api/knowledge-base/${record.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load knowledge source details");
      }

      if (data.knowledgeBase) {
        setSelectedKnowledgeBase(data.knowledgeBase as KnowledgeBase);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to load details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const markKnowledgeReady = async (record: KnowledgeBase) => {
    try {
      const response = await fetch(`/api/knowledge-base/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processingStatus: "ready" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      const updated = data.knowledgeBase as KnowledgeBase;

      setKnowledgeBases((prev) => prev.map((kb) => (kb.id === updated.id ? updated : kb)));
      if (selectedKnowledgeBase?.id === updated.id) {
        setSelectedKnowledgeBase(updated);
      }

      message.success("Knowledge source marked as ready");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: KnowledgeBase) => (
        <Space>
          {getSourceIcon(record.source_type || "file")}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: "Source",
      dataIndex: "source_type",
      key: "source",
      render: (type: string) => (
        <Tag>{getSourceLabel(type)}</Tag>
      ),
    },
    {
      title: "Size",
      dataIndex: "file_size_bytes",
      key: "size",
      render: (size: number | null) => formatFileSize(size),
    },
    {
      title: "Status",
      dataIndex: "processing_status",
      key: "status",
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "Assigned Agent",
      dataIndex: "agent_id",
      key: "agent",
      render: (agentId: string | null, record: KnowledgeBase) => (
        <Select
          style={{ width: 200 }}
          placeholder="Select agent"
          allowClear
          value={agentId}
          onChange={(value) => handleAssignAgent(record.id, value || null)}
          options={agents.map((a) => ({ value: a.id, label: a.name }))}
        />
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: KnowledgeBase) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            title="View details"
            onClick={() => openDetailsDrawer(record)}
          />
          {record.source_type === "website" ? (
            <Button
              type="text"
              icon={<ReloadOutlined />}
              title="Re-crawl website"
              loading={extractingId === record.id}
              onClick={() => extractWebsiteDataNow(record)}
            />
          ) : (record.processing_status === "pending" || record.processing_status === "error") ? (
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              title="Mark as ready"
              onClick={() => markKnowledgeReady(record)}
            />
          ) : record.processing_status === "processing" ? (
            <Button
              type="text"
              icon={<CheckCircleOutlined />}
              title="Mark as ready"
              onClick={() => markKnowledgeReady(record)}
            />
          ) : null}
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            title="Delete"
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <RoutePageShell
      title="Knowledge Base"
      subtitle="Upload documents to give your agents context and information"
      actions={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            Add Knowledge
          </Button>
        </Space>
      }
    >
      <Card>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No knowledge bases yet"
          >
            <Button type="primary" onClick={() => setIsModalOpen(true)}>
              Upload Your First Document
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={knowledgeBases}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      <Modal
        title="Add Knowledge"
        open={isModalOpen}
        width={600}
        onCancel={() => {
          setIsModalOpen(false);
          setFileList([]);
          setFileName("");
          setWebsiteUrl("");
          setSelectedAgentId(null);
          setSourceType("file");
        }}
        onOk={handleSubmit}
        okText={sourceType === "file" ? "Upload" : "Add"}
        confirmLoading={uploading}
        okButtonProps={{ 
          disabled: sourceType === "file" ? fileList.length === 0 
            : sourceType === "website" ? !websiteUrl 
            : sourceType === "google_drive" ? (!driveConnected || !driveUrl)
            : true 
        }}
      >
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong style={{ marginBottom: 8, display: "block" }}>Source Type</Text>
            <Segmented
              block
              value={sourceType}
              onChange={(value) => setSourceType(value as SourceType)}
              options={[
                { label: <Space><FileTextOutlined />Files</Space>, value: "file" },
                { label: <Space><GlobalOutlined />Website</Space>, value: "website" },
                { label: <Space><GoogleOutlined />Google Drive</Space>, value: "google_drive" },
                { label: <Space><SlackOutlined />Slack</Space>, value: "slack" },
                { label: <Space><IssuesCloseOutlined />Jira</Space>, value: "jira" },
              ]}
            />
          </div>

          <div>
            <Text strong>Name (optional)</Text>
            <Input
              placeholder="Enter a name for this knowledge source"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>

          <div>
            <Text strong>Assign to Agent (optional)</Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              placeholder="Select an agent"
              allowClear
              value={selectedAgentId}
              onChange={setSelectedAgentId}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>

          {sourceType === "file" && (
            <div>
              <Text strong>File</Text>
              <Dragger {...uploadProps} style={{ marginTop: 8 }}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">Click or drag file to upload</p>
                <p className="ant-upload-hint">
                  Supported: .txt, .md, .pdf, .json, .csv (max 10MB)
                </p>
              </Dragger>
            </div>
          )}

          {sourceType === "website" && (
            <div>
              <Text strong>Website URL</Text>
              <Input
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                style={{ marginTop: 8 }}
                prefix={<GlobalOutlined />}
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: "block" }}>
                We&apos;ll crawl and index all pages from this domain using Vertex AI Search.
              </Text>
            </div>
          )}

          {(sourceType === "google_drive") && (
            <div>
              {!driveConfigured ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Google Drive OAuth not configured"
                  description="Add GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET to your environment variables to enable this feature."
                />
              ) : driveConnected ? (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Alert
                    type="success"
                    showIcon
                    message={<span>Connected as <strong>{driveEmail}</strong></span>}
                    action={
                      <Button
                        size="small"
                        danger
                        icon={<DisconnectOutlined />}
                        loading={disconnectingDrive}
                        onClick={handleDisconnectDrive}
                      >
                        Disconnect
                      </Button>
                    }
                  />
                  <Text strong>Google Drive URL or Folder/File ID</Text>
                  <Input
                    placeholder="https://drive.google.com/drive/folders/... or File ID"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    prefix={<GoogleOutlined />}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Paste a Google Drive folder or file URL. Supported: Google Docs, Sheets, Slides, .txt, .md, .csv, .json.
                  </Text>
                  {driveUrl && (() => {
                    const parsed = parseDriveUrl(driveUrl);
                    if (!parsed) return <Text type="danger" style={{ fontSize: 12 }}>⚠️ Invalid Google Drive URL</Text>;
                    return <Text type="success" style={{ fontSize: 12 }}>✅ Detected: {parsed.type} (ID: {parsed.id.slice(0, 16)}...)</Text>;
                  })()}
                </Space>
              ) : (
                <Alert
                  type="info"
                  showIcon
                  message="Connect your Google Drive"
                  description="Each user connects their own Google account. Your files are only accessible to your organization."
                  action={
                    <Button
                      type="primary"
                      icon={<GoogleOutlined />}
                      href="/api/integrations/google-drive/connect"
                    >
                      Connect Google Drive
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {(sourceType === "slack" || sourceType === "jira") && (
            <Card style={{ textAlign: "center", background: "#fafafa" }}>
              <CloudOutlined style={{ fontSize: 32, color: "#999", marginBottom: 8 }} />
              <div>
                <Text type="secondary">
                  {sourceType === "slack" && "Slack integration coming soon!"}
                  {sourceType === "jira" && "Jira integration coming soon!"}
                </Text>
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Powered by Vertex AI RAG Engine connectors.
              </Text>
            </Card>
          )}
        </Space>
      </Modal>

      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            <span>Knowledge Source Details</span>
          </Space>
        }
        placement="right"
        size="50vw"
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        styles={{
          body: {
            background: "#f5f7fb",
            padding: 20,
          },
        }}
        extra={
          <Space>
            {selectedKnowledgeBase?.source_type === "website" && (
              <Button
                icon={<ReloadOutlined />}
                loading={extractingId === selectedKnowledgeBase.id}
                onClick={() => selectedKnowledgeBase && extractWebsiteDataNow(selectedKnowledgeBase)}
              >
                Extract Data
              </Button>
            )}
            {selectedKnowledgeBase?.processing_status === "processing" && selectedKnowledgeBase?.source_type !== "website" && (
              <Button
                icon={<CheckCircleOutlined />}
                onClick={() => selectedKnowledgeBase && markKnowledgeReady(selectedKnowledgeBase)}
              >
                Mark Ready
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedKnowledgeBase && openDetailsDrawer(selectedKnowledgeBase)}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        {detailsLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : selectedKnowledgeBase ? (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card style={{ borderRadius: 12 }}>
              <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                <Space align="start" style={{ width: "100%", justifyContent: "space-between" }}>
                  <Space>
                    {getSourceIcon(selectedKnowledgeBase.source_type || "file")}
                    <Text strong style={{ fontSize: 16 }}>{selectedKnowledgeBase.name}</Text>
                  </Space>
                  {getStatusTag(selectedKnowledgeBase.processing_status)}
                </Space>

                <Alert
                  type="info"
                  showIcon
                  title="Vertex AI managed ingestion"
                  description="Website sources are crawled and chunked for retrieval, then tracked with Vertex-style ingestion metadata in the same connector flow."
                />
              </Space>
            </Card>

            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic title="Chunks" value={selectedKnowledgeBase.chunks_count} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic title="File Size" value={formatFileSize(selectedKnowledgeBase.file_size_bytes)} />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Created"
                    value={new Date(selectedKnowledgeBase.created_at).toLocaleDateString()}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="Source Metadata" style={{ borderRadius: 12 }}>
              <Descriptions column={1} size="small" colon={false}>
                <Descriptions.Item label="Source Type">
                  <Tag>{getSourceLabel(selectedKnowledgeBase.source_type || "file")}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {(() => {
                    const badge = getStatusBadge(selectedKnowledgeBase.processing_status);
                    return <Badge status={badge.status} text={badge.text} />;
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="Knowledge ID">
                  <Text code>{selectedKnowledgeBase.id}</Text>
                </Descriptions.Item>
                {selectedKnowledgeBase.vertex_corpus_id && (
                  <Descriptions.Item label="Vertex Corpus ID">
                    <Text code>{selectedKnowledgeBase.vertex_corpus_id}</Text>
                  </Descriptions.Item>
                )}
                {selectedKnowledgeBase.source_url && (
                  <Descriptions.Item label="Source URL">
                    <Button
                      type="link"
                      icon={<LinkOutlined />}
                      href={toExternalUrl(selectedKnowledgeBase.source_url)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ paddingInline: 0 }}
                    >
                      {selectedKnowledgeBase.source_url}
                    </Button>
                  </Descriptions.Item>
                )}
                {selectedKnowledgeBase.file_path && (
                  <Descriptions.Item label="Storage Path">
                    <Text code>{selectedKnowledgeBase.file_path}</Text>
                  </Descriptions.Item>
                )}
                {selectedKnowledgeBase.source_type === "website" && (
                  <Descriptions.Item label="Crawled Pages">
                    {selectedWebsiteConfig.total_pages ?? extractedPages.length}
                  </Descriptions.Item>
                )}
                {selectedKnowledgeBase.source_type === "website" && (
                  <Descriptions.Item label="Extracted Characters">
                    {selectedWebsiteConfig.total_characters ?? 0}
                  </Descriptions.Item>
                )}
                {selectedKnowledgeBase.source_type === "website" && (
                  <Descriptions.Item label="Last Extracted">
                    {formatDateTime(selectedWebsiteConfig.extracted_at)}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Divider style={{ marginBlock: 16 }} />
              <Text type="secondary">
                This source is configured for a Google-first ingestion architecture where crawling,
                indexing, embeddings, and retrieval remain inside Vertex AI Search.
              </Text>
            </Card>

            {selectedKnowledgeBase.source_type === "website" && (
              <Card title="Extracted Content Preview" style={{ borderRadius: 12 }}>
                {selectedWebsiteConfig.extraction_error && (
                  <Alert
                    type="warning"
                    showIcon
                    title="Extraction issue"
                    description={selectedWebsiteConfig.extraction_error}
                    style={{ marginBottom: 12 }}
                  />
                )}

                {sampleChunks.length > 0 ? (
                  <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                    {sampleChunks.map((chunk, index) => (
                      <Card key={`chunk-${index}`} size="small" title={`Chunk ${index + 1}`}>
                        <Text style={{ whiteSpace: "pre-wrap" }}>{chunk}</Text>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No chunks extracted yet. Run Extract Data to crawl and index this site."
                  />
                )}

                {extractedPages.length > 0 && (
                  <>
                    <Divider style={{ marginBlock: 16 }} />
                    <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                      <Text strong>Pages Crawled</Text>
                      {extractedPages.map((page, index) => (
                        <Card key={`${page.url}-${index}`} size="small">
                          <Space orientation="vertical" size={4} style={{ width: "100%" }}>
                            <Text strong>{page.title || page.url}</Text>
                            <Button
                              type="link"
                              icon={<LinkOutlined />}
                              href={toExternalUrl(page.url)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ paddingInline: 0, height: "auto" }}
                            >
                              {page.url}
                            </Button>
                            <Text type="secondary">{page.excerpt || "No excerpt available."}</Text>
                            <Text type="secondary">Characters: {page.charCount ?? 0}</Text>
                          </Space>
                        </Card>
                      ))}
                    </Space>
                  </>
                )}
              </Card>
            )}
          </Space>
        ) : (
          <Empty description="Select a knowledge source to view details." />
        )}
      </Drawer>
    </RoutePageShell>
  );
}
