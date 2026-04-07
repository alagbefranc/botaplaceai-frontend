"use client";

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Result,
  Row,
  Segmented,
  Space,
  Spin,
  Steps,
  Table,
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
import type { PortabilityCheckResult, PortEvent, PortRequest, PortStatus } from "../types";

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const STATUS_CONFIG: Record<PortStatus, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: "default", icon: <ClockCircleOutlined />, label: "Pending" },
  submitted: { color: "processing", icon: <ClockCircleOutlined spin />, label: "Submitted" },
  loa_required: { color: "warning", icon: <FileTextOutlined />, label: "LOA Required" },
  approved: { color: "success", icon: <CheckCircleOutlined />, label: "Approved" },
  rejected: { color: "error", icon: <CloseCircleOutlined />, label: "Rejected" },
  completed: { color: "success", icon: <CheckCircleOutlined />, label: "Completed" },
  cancelled: { color: "default", icon: <CloseCircleOutlined />, label: "Cancelled" },
  draft: { color: "default", icon: <FileTextOutlined />, label: "Draft" },
  "in-process": { color: "processing", icon: <ClockCircleOutlined spin />, label: "In Process" },
  exception: { color: "warning", icon: <InfoCircleOutlined />, label: "Exception" },
  unknown: { color: "default", icon: <ClockCircleOutlined />, label: "Unknown" },
};

export default function PortNumbersTab() {
  const { message, modal } = App.useApp();
  const [activeSection, setActiveSection] = useState<"in" | "out">("in");
  const [portInRequests, setPortInRequests] = useState<PortRequest[]>([]);
  const [portOutRequests, setPortOutRequests] = useState<PortRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPortDrawerOpen, setNewPortDrawerOpen] = useState(false);
  const [portabilityModalOpen, setPortabilityModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PortRequest | null>(null);
  const [portabilityResults, setPortabilityResults] = useState<PortabilityCheckResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [portForm] = Form.useForm();
  const [checkForm] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch port orders from backend
  const fetchPortOrders = useCallback(async () => {
    const orgId = localStorage.getItem("orgId");
    if (!orgId) return;

    setLoading(true);
    try {
      const [portInResp, portOutResp] = await Promise.all([
        fetch(`${BACKEND_URL}/porting/orders?orgId=${orgId}&type=port_in`),
        fetch(`${BACKEND_URL}/porting/port-out?orgId=${orgId}`),
      ]);

      if (portInResp.ok) {
        const portInData = await portInResp.json();
        setPortInRequests(
          (portInData.orders || []).map((o: Record<string, unknown>) => ({
            id: o.id,
            type: "in" as const,
            status: mapTelnyxStatus(o.status as string),
            numbers: o.numbers || [],
            losingCarrier: o.losingCarrier || "Unknown",
            requestedPortDate: o.requestedPortDate,
            actualPortDate: o.actualPortDate,
            events: [],
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          }))
        );
      }

      if (portOutResp.ok) {
        const portOutData = await portOutResp.json();
        setPortOutRequests(
          (portOutData.orders || []).map((o: Record<string, unknown>) => ({
            id: o.id,
            type: "out" as const,
            status: mapTelnyxStatus(o.status as string),
            numbers: o.phoneNumbers || [],
            winningCarrier: o.winningCarrier || "Unknown",
            requestedPortDate: o.requestedFocDate,
            events: [],
            createdAt: o.createdAt,
            updatedAt: o.updatedAt,
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch port orders:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Map Telnyx status to our status
  const mapTelnyxStatus = (status: string): PortStatus => {
    const statusMap: Record<string, PortStatus> = {
      draft: "pending",
      "in-process": "submitted",
      submitted: "submitted",
      exception: "loa_required",
      approved: "approved",
      rejected: "rejected",
      ported: "completed",
      cancelled: "cancelled",
    };
    return statusMap[status?.toLowerCase()] || "pending";
  };

  useEffect(() => {
    fetchPortOrders();
  }, [fetchPortOrders]);

  const handlePortabilityCheck = async () => {
    try {
      const values = await checkForm.validateFields();
      setIsChecking(true);

      // Parse numbers (one per line)
      const numbers = values.numbers
        .split("\n")
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0);

      if (numbers.length === 0) {
        message.warning("Please enter at least one phone number");
        return;
      }

      // Call real API
      const resp = await fetch(`${BACKEND_URL}/porting/portability-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumbers: numbers }),
      });

      if (!resp.ok) {
        throw new Error("Portability check failed");
      }

      const data = await resp.json();
      const results: PortabilityCheckResult[] = (data.results || []).map((r: Record<string, unknown>) => ({
        number: r.phoneNumber,
        portable: r.portable,
        carrier: "Unknown", // Telnyx doesn't return carrier in portability check
        portType: "wireless" as const,
        fastPortEligible: r.fastPortEligible,
        estimatedDays: r.fastPortEligible ? 3 : 7,
        reason: r.notPortableReason,
      }));

      setPortabilityResults(results);
      message.success(`Checked ${numbers.length} number(s)`);
    } catch (error) {
      message.error("Portability check failed");
    } finally {
      setIsChecking(false);
    }
  };

  const handleCreatePortRequest = async () => {
    try {
      const values = await portForm.validateFields();
      const orgId = localStorage.getItem("orgId");
      const userId = localStorage.getItem("userId");

      if (!orgId) {
        message.error("Organization not found. Please log in again.");
        return;
      }

      const phoneNumbers = values.numbers
        .split("\n")
        .map((n: string) => n.trim())
        .filter((n: string) => n);

      // Call real API
      const resp = await fetch(`${BACKEND_URL}/porting/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          userId,
          phoneNumbers,
          entityName: values.authorizedName,
          authPersonName: values.authorizedName,
          accountNumber: values.accountNumber,
          pinPasscode: values.accountPin,
          streetAddress: values.billingAddress,
          locality: "City", // Would need additional fields in form
          administrativeArea: "State",
          postalCode: "00000",
          customerReference: `port-${Date.now()}`,
          requestedFocDate: values.requestedDate?.toISOString(),
        }),
      });

      if (!resp.ok) {
        const error = await resp.json();
        throw new Error(error.error || "Failed to create port request");
      }

      const data = await resp.json();
      
      // Add to local state
      const newRequest: PortRequest = {
        id: data.order.id,
        type: "in",
        status: mapTelnyxStatus(data.order.status),
        numbers: phoneNumbers,
        losingCarrier: values.losingCarrier,
        accountNumber: values.accountNumber,
        authorizedName: values.authorizedName,
        billingAddress: values.billingAddress,
        requestedPortDate: values.requestedDate?.format("YYYY-MM-DD"),
        events: [
          {
            id: "e1",
            type: "created",
            message: "Port request created",
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setPortInRequests((prev) => [newRequest, ...prev]);
      setNewPortDrawerOpen(false);
      portForm.resetFields();
      setFileList([]);
      setCurrentStep(0);
      message.success("Port request created successfully");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Failed to create port request");
    }
  };

  const handleApprovePortOut = (request: PortRequest) => {
    modal.confirm({
      title: "Approve Port-Out Request",
      content: `Are you sure you want to approve the port-out request for ${request.numbers.join(", ")}?`,
      onOk: async () => {
        const orgId = localStorage.getItem("orgId");
        try {
          const resp = await fetch(`${BACKEND_URL}/porting/port-out/${request.id}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId }),
          });

          if (!resp.ok) throw new Error("Failed to approve");

          setPortOutRequests((prev) =>
            prev.map((r) =>
              r.id === request.id
                ? {
                    ...r,
                    status: "approved" as PortStatus,
                    events: [
                      ...r.events,
                      { id: `e${r.events.length + 1}`, type: "approved" as const, message: "Port-out approved", timestamp: new Date().toISOString() },
                    ],
                  }
                : r
            )
          );
          message.success("Port-out approved");
        } catch (error) {
          message.error("Failed to approve port-out");
        }
      },
    });
  };

  const handleRejectPortOut = (request: PortRequest) => {
    modal.confirm({
      title: "Reject Port-Out Request",
      content: `Are you sure you want to reject the port-out request for ${request.numbers.join(", ")}?`,
      onOk: async () => {
        const orgId = localStorage.getItem("orgId");
        try {
          const resp = await fetch(`${BACKEND_URL}/porting/port-out/${request.id}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orgId, reason: "Customer requested rejection" }),
          });

          if (!resp.ok) throw new Error("Failed to reject");

          setPortOutRequests((prev) =>
            prev.map((r) =>
              r.id === request.id
                ? {
                    ...r,
                    status: "rejected" as PortStatus,
                    events: [
                      ...r.events,
                      { id: `e${r.events.length + 1}`, type: "rejected" as const, message: "Port-out rejected", timestamp: new Date().toISOString() },
                    ],
                  }
                : r
            )
          );
          message.success("Port-out rejected");
        } catch (error) {
          message.error("Failed to reject port-out");
        }
      },
    });
  };

  const openDetailDrawer = (request: PortRequest) => {
    setSelectedRequest(request);
    setDetailDrawerOpen(true);
  };

  const portInColumns: ColumnsType<PortRequest> = [
    {
      title: "Request ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: "Numbers",
      dataIndex: "numbers",
      key: "numbers",
      ellipsis: true,
      render: (numbers: string[]) => (
        <Space direction="vertical" size={0}>
          {numbers.slice(0, 2).map((n) => (
            <Text key={n}>{n}</Text>
          ))}
          {numbers.length > 2 && <Text type="secondary">+{numbers.length - 2} more</Text>}
        </Space>
      ),
    },
    {
      title: "Losing Carrier",
      dataIndex: "losingCarrier",
      key: "losingCarrier",
      ellipsis: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: PortStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Port Date",
      key: "portDate",
      width: 100,
      render: (_, record) => (
        <Text>{record.actualPortDate || record.requestedPortDate || "-"}</Text>
      ),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 100,
      render: (date: string) => dayjs(date).format("MMM D, YYYY"),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, record) => (
        <Button type="link" onClick={() => openDetailDrawer(record)}>
          View
        </Button>
      ),
    },
  ];

  const portOutColumns: ColumnsType<PortRequest> = [
    {
      title: "Request ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id) => <Text code>{id}</Text>,
    },
    {
      title: "Numbers",
      dataIndex: "numbers",
      key: "numbers",
      ellipsis: true,
      render: (numbers: string[]) => numbers.join(", "),
    },
    {
      title: "Winning Carrier",
      dataIndex: "winningCarrier",
      key: "winningCarrier",
      ellipsis: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: PortStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "Port Date",
      dataIndex: "requestedPortDate",
      key: "portDate",
      width: 100,
    },
    {
      title: "",
      key: "actions",
      width: 140,
      render: (_, record) =>
        record.status === "pending" ? (
          <Space>
            <Button type="primary" size="small" onClick={() => handleApprovePortOut(record)}>
              Approve
            </Button>
            <Button danger size="small" onClick={() => handleRejectPortOut(record)}>
              Reject
            </Button>
          </Space>
        ) : (
          <Button type="link" size="small" onClick={() => openDetailDrawer(record)}>
            View
          </Button>
        ),
    },
  ];

  return (
    <>
      {/* Section Toggle */}
      <Card bodyStyle={{ padding: "16px 24px" }} style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center">
          <Segmented
            value={activeSection}
            onChange={(v) => setActiveSection(v as "in" | "out")}
            options={[
              { value: "in", label: "Port In", icon: <SwapOutlined style={{ transform: "rotate(90deg)" }} /> },
              { value: "out", label: "Port Out", icon: <SwapOutlined style={{ transform: "rotate(-90deg)" }} /> },
            ]}
            size="large"
          />
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPortOrders} loading={loading}>
              Refresh
            </Button>
            {activeSection === "in" && (
              <>
                <Button icon={<SearchOutlined />} onClick={() => setPortabilityModalOpen(true)}>
                  Check Portability
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewPortDrawerOpen(true)}>
                  New Port Request
                </Button>
              </>
            )}
          </Space>
        </Flex>
      </Card>

      {/* Port In Section */}
      {activeSection === "in" && (
        <>
          <Alert
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            message="Port numbers from other carriers"
            description="Transfer your existing phone numbers from other carriers. The process typically takes 3-10 business days depending on the carrier and number type."
            style={{ marginBottom: 16 }}
          />

          <Card>
            <Table
              columns={portInColumns}
              dataSource={portInRequests}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: (
                  <Empty
                    description="No port-in requests"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Button type="primary" onClick={() => setNewPortDrawerOpen(true)}>
                      Create Port Request
                    </Button>
                  </Empty>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* Port Out Section */}
      {activeSection === "out" && (
        <>
          <Alert
            type="warning"
            showIcon
            message="Port-Out Requests"
            description="These are requests from other carriers to port your numbers away. Review and respond to pending requests within 24 hours to avoid automatic approval."
            style={{ marginBottom: 16 }}
          />

          <Card>
            <Table
              columns={portOutColumns}
              dataSource={portOutRequests}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="No port-out requests" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </>
      )}

      {/* Portability Check Modal */}
      <Modal
        title="Check Number Portability"
        open={portabilityModalOpen}
        onCancel={() => {
          setPortabilityModalOpen(false);
          setPortabilityResults([]);
          checkForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={checkForm} layout="vertical">
          <Form.Item
            name="numbers"
            label="Phone Numbers"
            rules={[{ required: true, message: "Enter at least one number" }]}
            extra="Enter one number per line. Include country code."
          >
            <TextArea rows={4} placeholder="+1-555-123-4567&#10;+1-555-123-4568" />
          </Form.Item>
          <Button type="primary" onClick={handlePortabilityCheck} loading={isChecking}>
            Check Portability
          </Button>
        </Form>

        {portabilityResults.length > 0 && (
          <>
            <Divider />
            <Title level={5}>Results</Title>
            <List
              dataSource={portabilityResults}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      item.portable ? (
                        <CheckCircleOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                      ) : (
                        <CloseCircleOutlined style={{ fontSize: 24, color: "#ff4d4f" }} />
                      )
                    }
                    title={
                      <Space>
                        <Text strong>{item.number}</Text>
                        {item.portable ? (
                          <Tag color="success">Portable</Tag>
                        ) : (
                          <Tag color="error">Not Portable</Tag>
                        )}
                      </Space>
                    }
                    description={
                      item.portable ? (
                        <Space split={<Divider type="vertical" />}>
                          <Text type="secondary">Carrier: {item.carrier}</Text>
                          <Text type="secondary">Type: {item.portType}</Text>
                          <Text type="secondary">~{item.estimatedDays} days</Text>
                          {item.fastPortEligible && <Tag color="blue">Fast Port</Tag>}
                        </Space>
                      ) : (
                        <Text type="secondary">{item.reason || "Number cannot be ported"}</Text>
                      )
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>

      {/* New Port Request Drawer */}
      <Drawer
        title="New Port-In Request"
        open={newPortDrawerOpen}
        onClose={() => {
          setNewPortDrawerOpen(false);
          portForm.resetFields();
          setFileList([]);
          setCurrentStep(0);
        }}
        width={600}
        footer={
          <Flex justify="space-between">
            <Button onClick={() => setNewPortDrawerOpen(false)}>Cancel</Button>
            <Space>
              {currentStep > 0 && <Button onClick={() => setCurrentStep((s) => s - 1)}>Previous</Button>}
              {currentStep < 2 ? (
                <Button type="primary" onClick={() => setCurrentStep((s) => s + 1)}>
                  Next
                </Button>
              ) : (
                <Button type="primary" onClick={handleCreatePortRequest}>
                  Submit Request
                </Button>
              )}
            </Space>
          </Flex>
        }
      >
        <Steps
          current={currentStep}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { title: "Numbers" },
            { title: "Account Info" },
            { title: "Documents" },
          ]}
        />

        <Form form={portForm} layout="vertical">
          {currentStep === 0 && (
            <>
              <Form.Item
                name="numbers"
                label="Phone Numbers to Port"
                rules={[{ required: true, message: "Enter numbers to port" }]}
                extra="Enter one number per line with country code"
              >
                <TextArea rows={5} placeholder="+1-555-123-4567&#10;+1-555-123-4568" />
              </Form.Item>
              <Form.Item
                name="losingCarrier"
                label="Current Carrier"
                rules={[{ required: true, message: "Enter current carrier" }]}
              >
                <Input placeholder="e.g. AT&T, Verizon, T-Mobile" />
              </Form.Item>
            </>
          )}

          {currentStep === 1 && (
            <>
              <Alert
                type="info"
                showIcon
                message="Account information must match exactly"
                description="The information provided must match the account details on file with your current carrier."
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="authorizedName"
                label="Authorized Name"
                rules={[{ required: true }]}
              >
                <Input placeholder="Name on the account" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="accountNumber"
                    label="Account Number"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Account number" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="accountPin" label="Account PIN (if applicable)">
                    <Input.Password placeholder="PIN or passcode" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="billingAddress" label="Service Address">
                <TextArea rows={2} placeholder="Address on file with carrier" />
              </Form.Item>
              <Form.Item name="requestedDate" label="Requested Port Date">
                <DatePicker
                  style={{ width: "100%" }}
                  disabledDate={(date) => date.isBefore(dayjs().add(3, "day"))}
                />
              </Form.Item>
            </>
          )}

          {currentStep === 2 && (
            <>
              <Form.Item
                label="Letter of Authorization (LOA)"
                extra="Upload a signed LOA authorizing the transfer of numbers"
              >
                <Dragger
                  fileList={fileList}
                  onChange={({ fileList }) => setFileList(fileList)}
                  beforeUpload={() => false}
                  accept=".pdf,.png,.jpg,.jpeg"
                  maxCount={1}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">Click or drag LOA document to upload</p>
                  <p className="ant-upload-hint">PDF, PNG, or JPG (max 10MB)</p>
                </Dragger>
              </Form.Item>
              <Alert
                type="warning"
                showIcon
                message="LOA Required"
                description="A signed Letter of Authorization is required to complete the port. You can upload it now or later from the request details."
              />
            </>
          )}
        </Form>
      </Drawer>

      {/* Request Detail Drawer */}
      <Drawer
        title={`Port Request ${selectedRequest?.id || ""}`}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        width={500}
      >
        {selectedRequest && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Type">
                <Tag>{selectedRequest.type === "in" ? "Port In" : "Port Out"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag icon={STATUS_CONFIG[selectedRequest.status].icon} color={STATUS_CONFIG[selectedRequest.status].color}>
                  {STATUS_CONFIG[selectedRequest.status].label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Numbers">
                {selectedRequest.numbers.join(", ")}
              </Descriptions.Item>
              <Descriptions.Item label="Carrier">
                {selectedRequest.losingCarrier || selectedRequest.winningCarrier}
              </Descriptions.Item>
              {selectedRequest.authorizedName && (
                <Descriptions.Item label="Authorized Name">
                  {selectedRequest.authorizedName}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Port Date">
                {selectedRequest.actualPortDate || selectedRequest.requestedPortDate || "TBD"}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedRequest.createdAt).format("MMM D, YYYY h:mm A")}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Timeline</Divider>
            <Timeline
              items={selectedRequest.events.map((event) => ({
                color:
                  event.type === "completed" || event.type === "approved"
                    ? "green"
                    : event.type === "rejected"
                    ? "red"
                    : "blue",
                children: (
                  <>
                    <Text strong>{event.message}</Text>
                    <br />
                    <Text type="secondary">{dayjs(event.timestamp).format("MMM D, YYYY h:mm A")}</Text>
                  </>
                ),
              }))}
            />
          </>
        )}
      </Drawer>
    </>
  );
}
