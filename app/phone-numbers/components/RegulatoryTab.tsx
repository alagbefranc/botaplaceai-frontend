"use client";

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  FileTextOutlined,
  GlobalOutlined,
  InboxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Image,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import type { RegulatoryBundle, RegulatoryDocument, RegulatoryRequirement } from "../types";

const { Text, Title, Paragraph } = Typography;
const { Dragger } = Upload;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  id_card: "ID Card",
  passport: "Passport",
  utility_bill: "Utility Bill",
  business_license: "Business License",
  proof_of_address: "Proof of Address",
  loa: "Letter of Authorization",
  other: "Other Document",
  address_proof: "Address Proof",
  identity_proof: "Identity Proof",
  business_registration: "Business Registration",
};

const STATUS_CONFIG = {
  not_started: { color: "default", icon: <ClockCircleOutlined />, label: "Not Started" },
  pending: { color: "processing", icon: <ClockCircleOutlined spin />, label: "Under Review" },
  approved: { color: "success", icon: <CheckCircleOutlined />, label: "Approved" },
  rejected: { color: "error", icon: <CloseCircleOutlined />, label: "Rejected" },
  incomplete: { color: "warning", icon: <WarningOutlined />, label: "Incomplete" },
  expired: { color: "error", icon: <WarningOutlined />, label: "Expired" },
};

export default function RegulatoryTab() {
  const { message, modal } = App.useApp();
  const [requirements, setRequirements] = useState<RegulatoryRequirement[]>([]);
  const [documents, setDocuments] = useState<RegulatoryDocument[]>([]);
  const [bundles] = useState<RegulatoryBundle[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<RegulatoryDocument | null>(null);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [countries, setCountries] = useState<Array<{ code: string; name: string }>>([]);

  // Fetch documents from backend
  const fetchDocuments = useCallback(async () => {
    const orgId = localStorage.getItem("orgId");
    if (!orgId) return;

    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/regulatory/documents?orgId=${orgId}`);
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(
          (data.documents || []).map((d: Record<string, unknown>) => ({
            id: d.id,
            type: d.documentType || "other",
            name: d.description || d.fileName,
            fileName: d.fileName,
            fileUrl: "",
            fileSize: 0,
            mimeType: "application/pdf",
            status: d.status,
            country: d.countryCode,
            uploadedAt: d.createdAt,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch requirements
  const fetchRequirements = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/regulatory/requirements`);
      if (resp.ok) {
        const data = await resp.json();
        // Transform requirements into our format grouped by country
        const reqs: RegulatoryRequirement[] = (data.requirements || []).flatMap(
          (r: Record<string, unknown>) =>
            (r.requirementTypes as Array<Record<string, unknown>> || []).map((rt) => ({
              id: `${r.countryCode}-${rt.requirement_type}`,
              country: r.countryCode,
              countryName: r.countryCode, // Would need country name lookup
              requirementType: rt.requirement_type as string,
              description: `${rt.requirement_type} verification required`,
              required: true,
              documentTypes: (rt.document_types as Array<Record<string, string>> || []).map(
                (dt) => dt.document_type
              ),
              status: "not_started" as const,
            }))
        );
        setRequirements(reqs.slice(0, 10)); // Limit for UI
      }
    } catch (error) {
      console.error("Failed to fetch requirements:", error);
    }
  }, []);

  // Fetch countries
  const fetchCountries = useCallback(async () => {
    try {
      const resp = await fetch(`${BACKEND_URL}/regulatory/countries`);
      if (resp.ok) {
        const data = await resp.json();
        setCountries(data.countries || []);
      }
    } catch (error) {
      console.error("Failed to fetch countries:", error);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchRequirements();
    fetchCountries();
  }, [fetchDocuments, fetchRequirements, fetchCountries]);

  const pendingRequirements = requirements.filter((r) => r.status === "not_started" || r.status === "rejected");
  const approvedDocs = documents.filter((d) => d.status === "approved").length;
  const totalDocs = documents.length || 1; // Avoid division by zero

  const handleUpload = async () => {
    try {
      const values = await uploadForm.validateFields();
      const orgId = localStorage.getItem("orgId");
      const userId = localStorage.getItem("userId");

      if (!orgId) {
        message.error("Organization not found. Please log in again.");
        return;
      }

      if (fileList.length === 0) {
        message.warning("Please select a file to upload");
        return;
      }

      // Convert file to base64
      const file = fileList[0].originFileObj as File;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });

      // Upload via API
      const resp = await fetch(`${BACKEND_URL}/regulatory/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          userId,
          documentType: values.type,
          description: values.name || file.name,
          fileName: file.name,
          fileBase64: base64,
          fileMimeType: file.type,
          countryCode: values.country,
        }),
      });

      if (!resp.ok) {
        throw new Error("Upload failed");
      }

      const data = await resp.json();

      const newDoc: RegulatoryDocument = {
        id: data.document.id,
        type: values.type,
        name: values.name || file.name,
        fileName: file.name,
        fileUrl: "",
        fileSize: file.size,
        mimeType: file.type,
        status: data.document.status || "pending",
        country: values.country,
        uploadedAt: new Date().toISOString(),
      };

      setDocuments((prev) => [newDoc, ...prev]);
      setUploadDrawerOpen(false);
      uploadForm.resetFields();
      setFileList([]);
      message.success("Document uploaded successfully");
    } catch (error) {
      message.error("Upload failed");
    }
  };

  const handleDeleteDocument = (docId: string) => {
    modal.confirm({
      title: "Delete Document",
      content: "Are you sure you want to delete this document?",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        const orgId = localStorage.getItem("orgId");
        try {
          const resp = await fetch(`${BACKEND_URL}/regulatory/documents/${docId}?orgId=${orgId}`, {
            method: "DELETE",
          });

          if (!resp.ok) throw new Error("Delete failed");

          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          message.success("Document deleted");
        } catch (error) {
          message.error("Failed to delete document");
        }
      },
    });
  };

  const documentColumns: ColumnsType<RegulatoryDocument> = [
    {
      title: "Document",
      key: "document",
      render: (_, record) => (
        <Flex align="center" gap={12}>
          <FileTextOutlined style={{ fontSize: 24, color: "#1677ff" }} />
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.fileName} • {(record.fileSize / 1024).toFixed(1)} KB
            </Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (type: string) => <Tag>{DOCUMENT_TYPE_LABELS[type] || type}</Tag>,
    },
    {
      title: "Country",
      dataIndex: "country",
      key: "country",
      width: 80,
      render: (country: string) => country || <Text type="secondary">-</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: keyof typeof STATUS_CONFIG) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Uploaded",
      dataIndex: "uploadedAt",
      key: "uploadedAt",
      width: 100,
      render: (date: string) => dayjs(date).format("MMM D, YYYY"),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="Preview">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setPreviewDoc(record);
                setPreviewOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Download">
            <Button type="text" icon={<DownloadOutlined />} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDocument(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* Overview Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Documents Approved"
              value={approvedDocs}
              suffix={`/ ${totalDocs}`}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
            <Progress percent={Math.round((approvedDocs / totalDocs) * 100)} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Pending Requirements"
              value={pendingRequirements.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: pendingRequirements.length > 0 ? "#faad14" : "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Bundles"
              value={bundles.filter((b) => b.status !== "incomplete").length}
              suffix={`/ ${bundles.length || 0}`}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Pending Actions Alert */}
      {pendingRequirements.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="Action Required"
          description={`You have ${pendingRequirements.length} pending regulatory requirement(s) that need attention.`}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={() => setUploadDrawerOpen(true)}>
              Upload Documents
            </Button>
          }
        />
      )}

      <Tabs
        items={[
          {
            key: "requirements",
            label: "Requirements",
            children: (
              <Card>
                <Collapse
                  items={Object.entries(
                    requirements.reduce((acc, req) => {
                      if (!acc[req.country]) acc[req.country] = [];
                      acc[req.country].push(req);
                      return acc;
                    }, {} as Record<string, RegulatoryRequirement[]>)
                  ).map(([country, reqs]) => ({
                    key: country,
                    label: (
                      <Flex justify="space-between" align="center" style={{ width: "100%" }}>
                        <Space>
                          <img
                            src={`/flags/${country.toLowerCase()}.png`}
                            alt={country}
                            width={20}
                            height={14}
                            style={{ borderRadius: 2 }}
                          />
                          <Text strong>{reqs[0].countryName}</Text>
                        </Space>
                        <Space>
                          {reqs.every((r) => r.status === "approved") ? (
                            <Tag color="success">Complete</Tag>
                          ) : (
                            <Tag color="warning">{reqs.filter((r) => r.status !== "approved").length} pending</Tag>
                          )}
                        </Space>
                      </Flex>
                    ),
                    children: (
                      <List
                        dataSource={reqs}
                        renderItem={(req) => (
                          <List.Item
                            actions={[
                              req.status === "not_started" && (
                                <Button
                                  key="upload"
                                  type="primary"
                                  size="small"
                                  onClick={() => setUploadDrawerOpen(true)}
                                >
                                  Upload
                                </Button>
                              ),
                            ].filter(Boolean)}
                          >
                            <List.Item.Meta
                              avatar={STATUS_CONFIG[req.status].icon}
                              title={
                                <Space>
                                  <Text>{req.requirementType.replace("_", " ").toUpperCase()}</Text>
                                  <Tag color={STATUS_CONFIG[req.status].color}>
                                    {STATUS_CONFIG[req.status].label}
                                  </Tag>
                                </Space>
                              }
                              description={req.description}
                            />
                          </List.Item>
                        )}
                      />
                    ),
                  }))}
                />
                {requirements.length === 0 && (
                  <Empty description="No regulatory requirements" />
                )}
              </Card>
            ),
          },
          {
            key: "documents",
            label: (
              <Badge count={documents.filter((d) => d.status === "pending").length} offset={[10, 0]}>
                Documents
              </Badge>
            ),
            children: (
              <Card
                title="Uploaded Documents"
                extra={
                  <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadDrawerOpen(true)}>
                    Upload Document
                  </Button>
                }
              >
                <Table
                  columns={documentColumns}
                  dataSource={documents}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                  locale={{
                    emptyText: (
                      <Empty description="No documents uploaded">
                        <Button type="primary" onClick={() => setUploadDrawerOpen(true)}>
                          Upload Your First Document
                        </Button>
                      </Empty>
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: "bundles",
            label: "Compliance Bundles",
            children: (
              <Row gutter={16}>
                {bundles.map((bundle) => (
                  <Col xs={24} md={12} key={bundle.id}>
                    <Card
                      title={
                        <Space>
                          <GlobalOutlined />
                          {bundle.name}
                        </Space>
                      }
                      extra={
                        <Tag color={STATUS_CONFIG[bundle.status].color}>
                          {STATUS_CONFIG[bundle.status].label}
                        </Tag>
                      }
                      style={{ marginBottom: 16 }}
                    >
                      <Paragraph type="secondary">{bundle.description}</Paragraph>
                      <Divider style={{ margin: "12px 0" }} />
                      <Flex justify="space-between" align="center">
                        <Text type="secondary">Completion</Text>
                        <Progress
                          percent={bundle.completionPercent}
                          size="small"
                          style={{ width: 150, marginBottom: 0 }}
                        />
                      </Flex>
                      <Divider style={{ margin: "12px 0" }} />
                      <Space wrap>
                        {bundle.requirements.map((req) => (
                          <Tag key={req}>{req}</Tag>
                        ))}
                      </Space>
                    </Card>
                  </Col>
                ))}
                {bundles.length === 0 && (
                  <Col span={24}>
                    <Empty description="No compliance bundles configured" />
                  </Col>
                )}
              </Row>
            ),
          },
        ]}
      />

      {/* Upload Drawer */}
      <Drawer
        title="Upload Document"
        open={uploadDrawerOpen}
        onClose={() => {
          setUploadDrawerOpen(false);
          uploadForm.resetFields();
          setFileList([]);
        }}
        width={480}
        footer={
          <Flex justify="end" gap={12}>
            <Button onClick={() => setUploadDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleUpload}>
              Upload
            </Button>
          </Flex>
        }
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            name="type"
            label="Document Type"
            rules={[{ required: true, message: "Select document type" }]}
          >
            <Select
              placeholder="Select type"
              options={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Form.Item>
          <Form.Item name="name" label="Document Name">
            <Input placeholder="Optional custom name" />
          </Form.Item>
          <Form.Item name="country" label="Country (if applicable)">
            <Select
              placeholder="Select country"
              allowClear
              options={[
                ...countries.map((c) => ({ value: c.code, label: c.name })),
                { value: "US", label: "United States" },
                { value: "CA", label: "Canada" },
              ].filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i)}
            />
          </Form.Item>
          <Form.Item label="File" required>
            <Dragger
              fileList={fileList}
              onChange={({ fileList }) => setFileList(fileList)}
              beforeUpload={() => false}
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              maxCount={1}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag file to upload</p>
              <p className="ant-upload-hint">PDF, PNG, JPG, DOC (max 10MB)</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Drawer>

      {/* Preview Modal */}
      <Modal
        title={previewDoc?.name}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={800}
      >
        {previewDoc && (
          <div style={{ textAlign: "center" }}>
            {previewDoc.mimeType.startsWith("image/") ? (
              <Image
                src={previewDoc.fileUrl}
                alt={previewDoc.name}
                style={{ maxWidth: "100%" }}
              />
            ) : (
              <Empty
                image={<FileOutlined style={{ fontSize: 64 }} />}
                description="Preview not available for this file type"
              >
                <Button type="primary" icon={<DownloadOutlined />}>
                  Download File
                </Button>
              </Empty>
            )}
          </div>
        )}
      </Modal>
    </Spin>
  );
}
