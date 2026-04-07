"use client";

import {
  AudioOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  MailOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Progress,
  Row,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadFile } from "antd/es/upload";
import { useCallback, useEffect, useState } from "react";
import type { VoicemailBox } from "../types";

const { Text } = Typography;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const GREETING_TYPES = [
  { value: "default", label: "Default System Greeting", description: "Generic voicemail greeting" },
  { value: "name", label: "Name Recording", description: "Record just your name, system creates greeting" },
  { value: "custom", label: "Custom Recording", description: "Upload your own full greeting" },
];

interface PhoneNumberOption {
  value: string;
  label: string;
  number: string;
}

export default function VoicemailTab() {
  const { message, modal } = App.useApp();
  const [voicemailBoxes, setVoicemailBoxes] = useState<VoicemailBox[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<VoicemailBox | null>(null);
  const [form] = Form.useForm();
  const [greetingFile, setGreetingFile] = useState<UploadFile[]>([]);

  const activeBoxes = voicemailBoxes.filter((b) => b.enabled).length;
  const totalMessages = voicemailBoxes.reduce((sum, b) => sum + b.currentMessages, 0);

  // Fetch phone numbers from backend
  const loadPhoneNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("orgId");
      if (!orgId) return;
      const resp = await fetch(`${BACKEND_URL}/phone-numbers?orgId=${orgId}`);
      if (resp.ok) {
        const data = await resp.json();
        const options: PhoneNumberOption[] = (data || []).map((n: { id: string; number: string; displayLabel?: string }) => ({
          value: n.id,
          label: n.displayLabel ? `${n.number} (${n.displayLabel})` : n.number,
          number: n.number,
        }));
        setPhoneNumbers(options);
        
        // Create voicemail box entries for each number
        const boxes: VoicemailBox[] = options.map((n, idx) => ({
          id: `vm-${n.value}`,
          name: `Voicemail for ${n.number}`,
          phoneNumberId: n.value,
          phoneNumber: n.number,
          pin: "1234",
          greetingType: "default",
          emailForwarding: "",
          transcriptionEnabled: true,
          maxMessageLength: 120,
          maxMessages: 50,
          currentMessages: 0,
          enabled: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setVoicemailBoxes(boxes);
      }
    } catch (error) {
      console.error("Failed to load phone numbers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhoneNumbers();
  }, [loadPhoneNumbers]);

  const openCreateDrawer = () => {
    setEditingBox(null);
    form.resetFields();
    form.setFieldsValue({
      greetingType: "default",
      maxMessageLength: 120,
      maxMessages: 50,
      transcriptionEnabled: true,
      enabled: true,
    });
    setGreetingFile([]);
    setDrawerOpen(true);
  };

  const openEditDrawer = (box: VoicemailBox) => {
    setEditingBox(box);
    form.setFieldsValue({
      name: box.name,
      phoneNumber: box.phoneNumber,
      pin: box.pin,
      greetingType: box.greetingType,
      emailForwarding: box.emailForwarding,
      smsForwarding: box.smsForwarding,
      transcriptionEnabled: box.transcriptionEnabled,
      maxMessageLength: box.maxMessageLength,
      maxMessages: box.maxMessages,
      enabled: box.enabled,
    });
    setGreetingFile([]);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      if (editingBox) {
        // Update existing
        setVoicemailBoxes((prev) =>
          prev.map((b) =>
            b.id === editingBox.id
              ? {
                  ...b,
                  ...values,
                  updatedAt: new Date().toISOString(),
                }
              : b
          )
        );
        message.success("Voicemail box updated");
      } else {
        // Create new
        const newBox: VoicemailBox = {
          id: `vm-${Date.now()}`,
          ...values,
          currentMessages: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setVoicemailBoxes((prev) => [newBox, ...prev]);
        message.success("Voicemail box created");
      }

      setDrawerOpen(false);
      form.resetFields();
    } catch (error) {
      message.error("Please fill in all required fields");
    }
  };

  const handleDelete = (box: VoicemailBox) => {
    modal.confirm({
      title: "Delete Voicemail Box",
      content: `Are you sure you want to delete "${box.name}"? All messages will be lost.`,
      okText: "Delete",
      okType: "danger",
      onOk: () => {
        setVoicemailBoxes((prev) => prev.filter((b) => b.id !== box.id));
        message.success("Voicemail box deleted");
      },
    });
  };

  const handleToggleEnabled = (box: VoicemailBox) => {
    setVoicemailBoxes((prev) =>
      prev.map((b) =>
        b.id === box.id
          ? { ...b, enabled: !b.enabled, updatedAt: new Date().toISOString() }
          : b
      )
    );
    message.success(`Voicemail box ${box.enabled ? "disabled" : "enabled"}`);
  };

  const columns: ColumnsType<VoicemailBox> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Flex align="center" gap={8}>
          <AudioOutlined style={{ fontSize: 20, color: record.enabled ? "#1677ff" : "#d9d9d9" }} />
          <div>
            <Text strong>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.phoneNumber}
            </Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_, record) => (
        <Badge
          status={record.enabled ? "success" : "default"}
          text={record.enabled ? "Active" : "Disabled"}
        />
      ),
    },
    {
      title: "Messages",
      key: "messages",
      width: 120,
      render: (_, record) => (
        <Tooltip title={`${record.currentMessages} of ${record.maxMessages} messages`}>
          <Space direction="vertical" size={0} style={{ width: "100%" }}>
            <Text>
              {record.currentMessages} / {record.maxMessages}
            </Text>
            <Progress
              percent={Math.round((record.currentMessages / record.maxMessages) * 100)}
              size="small"
              showInfo={false}
              status={record.currentMessages >= record.maxMessages * 0.9 ? "exception" : "normal"}
            />
          </Space>
        </Tooltip>
      ),
    },
    {
      title: "Greeting",
      dataIndex: "greetingType",
      key: "greetingType",
      width: 120,
      render: (type: string) => {
        const config = GREETING_TYPES.find((g) => g.value === type);
        return <Tag>{config?.label || type}</Tag>;
      },
    },
    {
      title: "Forwarding",
      key: "forwarding",
      ellipsis: true,
      render: (_, record) => (
        <Space size={4}>
          {record.emailForwarding && (
            <Tooltip title={record.emailForwarding}>
              <Tag icon={<MailOutlined />} color="blue">
                Email
              </Tag>
            </Tooltip>
          )}
          {record.smsForwarding && (
            <Tooltip title={record.smsForwarding}>
              <Tag icon={<MessageOutlined />} color="green">
                SMS
              </Tag>
            </Tooltip>
          )}
          {record.transcriptionEnabled && (
            <Tooltip title="Transcription enabled">
              <Tag>TXT</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 130,
      render: (_, record) => (
        <Space>
          <Tooltip title={record.enabled ? "Disable" : "Enable"}>
            <Switch
              size="small"
              checked={record.enabled}
              onChange={() => handleToggleEnabled(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openEditDrawer(record)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Voicemail Boxes"
              value={activeBoxes}
              suffix={`/ ${voicemailBoxes.length}`}
              prefix={<AudioOutlined />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Messages"
              value={totalMessages}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Transcription Enabled"
              value={voicemailBoxes.filter((b) => b.transcriptionEnabled).length}
              suffix={`/ ${voicemailBoxes.length}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Voicemail List */}
      <Card
        title={
          <Flex align="center" gap={8}>
            <AudioOutlined />
            Voicemail Boxes
          </Flex>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
            Create Voicemail Box
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={voicemailBoxes}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty description={phoneNumbers.length === 0 ? "No phone numbers available. Buy a number first." : "No voicemail boxes configured"}>
                {phoneNumbers.length > 0 && (
                  <Button type="primary" onClick={openCreateDrawer}>
                    Create Your First Voicemail Box
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </Card>

      {/* Create/Edit Drawer */}
      <Drawer
        title={editingBox ? "Edit Voicemail Box" : "Create Voicemail Box"}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          form.resetFields();
          setGreetingFile([]);
        }}
        width={520}
        footer={
          <Flex justify="end" gap={12}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>
              {editingBox ? "Save Changes" : "Create"}
            </Button>
          </Flex>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Voicemail Box Name"
            rules={[{ required: true, message: "Enter a name" }]}
          >
            <Input placeholder="e.g. Main Support Line" />
          </Form.Item>

          <Form.Item
            name="phoneNumber"
            label="Phone Number"
            rules={[{ required: true, message: "Select a phone number" }]}
          >
            <Select
              placeholder="Select phone number"
              options={phoneNumbers}
              loading={loading}
              notFoundContent={phoneNumbers.length === 0 ? "No numbers available" : undefined}
            />
          </Form.Item>

          <Form.Item
            name="pin"
            label="Access PIN"
            rules={[
              { required: true, message: "Enter a PIN" },
              { pattern: /^\d{4,6}$/, message: "PIN must be 4-6 digits" },
            ]}
            extra="4-6 digit PIN to access voicemail"
          >
            <Input.Password placeholder="1234" maxLength={6} />
          </Form.Item>

          <Divider>Greeting Settings</Divider>

          <Form.Item name="greetingType" label="Greeting Type">
            <Select
              options={GREETING_TYPES.map((g) => ({
                value: g.value,
                label: (
                  <div>
                    <Text>{g.label}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {g.description}
                    </Text>
                  </div>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.greetingType !== curr.greetingType}>
            {({ getFieldValue }) =>
              getFieldValue("greetingType") === "custom" && (
                <Form.Item label="Custom Greeting Audio">
                  <Upload
                    accept=".mp3,.wav,.m4a"
                    fileList={greetingFile}
                    onChange={({ fileList }) => setGreetingFile(fileList)}
                    beforeUpload={() => false}
                    maxCount={1}
                  >
                    <Button icon={<PlayCircleOutlined />}>Upload Audio File</Button>
                  </Upload>
                </Form.Item>
              )
            }
          </Form.Item>

          <Divider>Forwarding & Notifications</Divider>

          <Form.Item
            name="emailForwarding"
            label="Email Forwarding"
            rules={[{ type: "email", message: "Enter a valid email" }]}
          >
            <Input placeholder="support@company.com" prefix={<MailOutlined />} />
          </Form.Item>

          <Form.Item name="smsForwarding" label="SMS Notification">
            <Input placeholder="+1-555-000-0000" prefix={<MessageOutlined />} />
          </Form.Item>

          <Form.Item name="transcriptionEnabled" label="Enable Transcription" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Divider>Message Settings</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="maxMessageLength"
                label="Max Message Length"
                extra="seconds"
              >
                <Slider min={30} max={300} step={30} marks={{ 30: "30s", 120: "2m", 300: "5m" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxMessages" label="Max Messages">
                <InputNumber min={10} max={500} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider />

          <Form.Item name="enabled" label="Enable Voicemail Box" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
