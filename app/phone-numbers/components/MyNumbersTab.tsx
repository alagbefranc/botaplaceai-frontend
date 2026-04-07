"use client";

import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Drawer,
  Dropdown,
  Flex,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType, TableRowSelection } from "antd/es/table/interface";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AgentOption,
  Capability,
  Connection,
  MessagingProfile,
  NumberFilters,
  NumberStatus,
  NumberType,
  PhoneNumber,
} from "../types";

const { Text } = Typography;

// CDN Channel Icons (consistent with agent details)
const CHANNEL_ICONS = {
  voice: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
  sms: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
  mms: "https://api.iconify.design/mdi:image.svg?color=%2313c2c2",
  fax: "https://api.iconify.design/mdi:fax.svg?color=%238c8c8c",
  whatsapp: "https://api.iconify.design/logos:whatsapp-icon.svg",
};

// Status badge component
const StatusBadge = ({ status }: { status: NumberStatus }) => {
  const statusConfig: Record<NumberStatus, { color: string; text: string }> = {
    active: { color: "success", text: "Active" },
    inactive: { color: "default", text: "Inactive" },
    pending: { color: "processing", text: "Pending" },
    porting: { color: "warning", text: "Porting" },
    reserved: { color: "purple", text: "Reserved" },
  };
  const config = statusConfig[status] || { color: "default", text: status };
  return <Badge status={config.color as "success"} text={config.text} />;
};

interface MyNumbersTabProps {
  onBuyNumber: () => void;
}

export default function MyNumbersTab({ onBuyNumber }: MyNumbersTabProps) {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messagingProfiles, setMessagingProfiles] = useState<MessagingProfile[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [filters, setFilters] = useState<NumberFilters>({});
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<PhoneNumber | null>(null);
  const [editForm] = Form.useForm();

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  // Countries for filter
  const countries = [
    { label: "United States", value: "US" },
    { label: "Canada", value: "CA" },
    { label: "United Kingdom", value: "GB" },
    { label: "Australia", value: "AU" },
    { label: "Germany", value: "DE" },
    { label: "France", value: "FR" },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("orgId");
      const [numbersRes, agentsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/phone-numbers${orgId ? `?orgId=${orgId}` : ""}`, { cache: "no-store" }),
        fetch("/api/agents", { cache: "no-store" }),
      ]);

      if (numbersRes.ok) {
        const data = await numbersRes.json();
        // Transform backend data to our PhoneNumber type
        const transformed: PhoneNumber[] = (data || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          number: item.number as string,
          formattedNumber: item.number as string,
          displayLabel: item.displayLabel as string | undefined,
          status: (item.status === "released" ? "inactive" : "active") as NumberStatus,
          type: "local" as NumberType,
          capabilities: ["voice", "sms"] as Capability[],
          monthlyPrice: 2.99,
          assignedAgentId: item.agentId as string | undefined,
          assignedAgentName: "",
          tags: [],
          emergencyEnabled: false,
          region: (item.region as string) || "Unknown",
          country: "US",
          countryCode: "+1",
          source: "purchased" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setNumbers(transformed);
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(
          (data.agents || []).map((a: { id: string; name: string }) => ({
            value: a.id,
            label: a.name,
          }))
        );
      }

      // Mock connections and messaging profiles
      setConnections([
        { id: "conn-1", name: "Bo - themefor", type: "sip" },
        { id: "conn-2", name: "nextleapai", type: "credential" },
      ]);
      setMessagingProfiles([
        { id: "msg-1", name: "Bo SMS - themefor" },
        { id: "msg-2", name: "YourSend" },
      ]);
    } catch (error) {
      message.error("Failed to load phone numbers");
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL, message]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter numbers based on current filters
  const filteredNumbers = useMemo(() => {
    return numbers.filter((num) => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!num.number.toLowerCase().includes(search) && !num.formattedNumber.toLowerCase().includes(search)) {
          return false;
        }
      }
      if (filters.status?.length && !filters.status.includes(num.status)) return false;
      if (filters.type?.length && !filters.type.includes(num.type)) return false;
      if (filters.country?.length && !filters.country.includes(num.country)) return false;
      if (filters.emergencyStatus?.length) {
        const hasE911 = filters.emergencyStatus.includes("enabled");
        const noE911 = filters.emergencyStatus.includes("disabled");
        if (hasE911 && !num.emergencyEnabled) return false;
        if (noE911 && num.emergencyEnabled) return false;
      }
      return true;
    });
  }, [numbers, filters]);

  const handleCopyNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    message.success("Number copied to clipboard");
  };

  const handleAssignAgent = async (numberId: string, agentId: string | null) => {
    try {
      const res = await fetch(`${BACKEND_URL}/phone-numbers/${numberId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) throw new Error("Failed to assign agent");
      setNumbers((prev) =>
        prev.map((n) =>
          n.id === numberId
            ? { ...n, assignedAgentId: agentId || undefined, assignedAgentName: agents.find((a) => a.value === agentId)?.label }
            : n
        )
      );
      message.success("Agent assignment updated");
    } catch {
      message.error("Failed to update assignment");
    }
  };

  const handleDeleteNumber = async (numberId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/phone-numbers/${numberId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to release number");
      setNumbers((prev) => prev.filter((n) => n.id !== numberId));
      message.success("Number released successfully");
    } catch {
      message.error("Failed to release number");
    }
  };

  const handleBulkDelete = () => {
    modal.confirm({
      title: "Release Selected Numbers",
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to release ${selectedRowKeys.length} numbers? This action cannot be undone.`,
      okText: "Release",
      okType: "danger",
      onOk: async () => {
        // In real app, batch delete API call
        setNumbers((prev) => prev.filter((n) => !selectedRowKeys.includes(n.id)));
        setSelectedRowKeys([]);
        message.success(`${selectedRowKeys.length} numbers released`);
      },
    });
  };

  const handleExport = () => {
    const csv = [
      ["Number", "Status", "Type", "Region", "Assigned Agent", "Monthly Price", "Created"],
      ...filteredNumbers.map((n) => [
        n.number,
        n.status,
        n.type,
        n.region,
        n.assignedAgentName || "Unassigned",
        `$${n.monthlyPrice.toFixed(2)}`,
        new Date(n.createdAt).toLocaleDateString(),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "phone-numbers.csv";
    a.click();
    message.success("Export downloaded");
  };

  const openEditDrawer = (record: PhoneNumber) => {
    setEditingNumber(record);
    editForm.setFieldsValue({
      connectionId: record.connectionId,
      messagingProfileId: record.messagingProfileId,
      tags: record.tags,
      emergencyEnabled: record.emergencyEnabled,
    });
    setEditDrawerOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingNumber) return;
    const values = await editForm.validateFields();
    // In real app, API call to update
    setNumbers((prev) =>
      prev.map((n) =>
        n.id === editingNumber.id
          ? {
              ...n,
              connectionId: values.connectionId,
              connectionName: connections.find((c) => c.id === values.connectionId)?.name,
              messagingProfileId: values.messagingProfileId,
              messagingProfileName: messagingProfiles.find((m) => m.id === values.messagingProfileId)?.name,
              tags: values.tags || [],
              emergencyEnabled: values.emergencyEnabled,
            }
          : n
      )
    );
    setEditDrawerOpen(false);
    message.success("Number updated successfully");
  };

  const columns: ColumnsType<PhoneNumber> = [
    {
      title: "Number",
      dataIndex: "number",
      key: "number",
      sorter: (a, b) => a.number.localeCompare(b.number),
      render: (_, record) => (
        <Flex vertical gap={2}>
          <Text strong copyable={{ text: record.number, icon: <CopyOutlined style={{ fontSize: 12 }} /> }}>
            {record.number}
          </Text>
          {(record as unknown as { displayLabel?: string }).displayLabel && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {(record as unknown as { displayLabel?: string }).displayLabel}
            </Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      filters: [
        { text: "Active", value: "active" },
        { text: "Inactive", value: "inactive" },
        { text: "Pending", value: "pending" },
        { text: "Porting", value: "porting" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: NumberStatus) => <StatusBadge status={status} />,
    },
    {
      title: "Services",
      key: "services",
      width: 120,
      render: (_, record) => (
        <Space size={8}>
          {record.capabilities.includes("voice") && (
            <Tooltip title="Voice">
              <Avatar size={20} src={CHANNEL_ICONS.voice} />
            </Tooltip>
          )}
          {record.capabilities.includes("sms") && (
            <Tooltip title="SMS">
              <Avatar size={20} src={CHANNEL_ICONS.sms} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Region",
      dataIndex: "region",
      key: "region",
      width: 120,
      render: (region: string) => <Text>{region}</Text>,
    },
    {
      title: "Agent",
      dataIndex: "assignedAgentId",
      key: "agent",
      width: 160,
      render: (agentId, record) => (
        <Select
          value={agentId || undefined}
          placeholder="Select agent"
          allowClear
          style={{ width: "100%" }}
          options={agents}
          onChange={(value) => handleAssignAgent(record.id, value || null)}
          size="small"
        />
      ),
    },
    {
      title: "Price",
      dataIndex: "monthlyPrice",
      key: "price",
      width: 90,
      sorter: (a, b) => a.monthlyPrice - b.monthlyPrice,
      render: (price: number) => <Text>${price.toFixed(2)}/mo</Text>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_, record) => (
        <Dropdown
          menu={{
            items: [
              { key: "edit", icon: <EditOutlined />, label: "Edit Settings", onClick: () => openEditDrawer(record) },
              { key: "copy", icon: <CopyOutlined />, label: "Copy Number", onClick: () => handleCopyNumber(record.number) },
              { type: "divider" },
              {
                key: "delete",
                icon: <DeleteOutlined />,
                label: "Release Number",
                danger: true,
                onClick: () => {
                  modal.confirm({
                    title: "Release Number",
                    content: `Are you sure you want to release ${record.number}?`,
                    okText: "Release",
                    okType: "danger",
                    onOk: () => handleDeleteNumber(record.id),
                  });
                },
              },
            ],
          }}
          trigger={["click"]}
        >
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ];

  const rowSelection: TableRowSelection<PhoneNumber> = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
  };

  const activeFiltersCount = Object.values(filters).filter((v) => v && (Array.isArray(v) ? v.length > 0 : true)).length;

  return (
    <>
      {/* Search and Filter Bar */}
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: "16px 24px" }}
      >
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <Flex gap={12} align="center" flex={1}>
            <Input.Search
              placeholder="Search by phone number..."
              allowClear
              style={{ width: 360, maxWidth: "100%" }}
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onSearch={(value) => setFilters((f) => ({ ...f, search: value }))}
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilterDrawerOpen(true)}
              type={activeFiltersCount > 0 ? "primary" : "default"}
            >
              Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} />
          </Flex>

          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <Text type="secondary">{selectedRowKeys.length} selected</Text>
                <Button onClick={handleBulkDelete} danger>
                  Release Selected
                </Button>
                <Divider type="vertical" />
              </>
            )}
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Export
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onBuyNumber}>
              Buy Number
            </Button>
          </Space>
        </Flex>

        {/* Active Filter Tags */}
        {activeFiltersCount > 0 && (
          <Flex gap={8} style={{ marginTop: 12 }} wrap="wrap">
            {filters.status?.map((s) => (
              <Tag
                key={s}
                closable
                onClose={() => setFilters((f) => ({ ...f, status: f.status?.filter((x) => x !== s) }))}
              >
                Status: {s}
              </Tag>
            ))}
            {filters.type?.map((t) => (
              <Tag
                key={t}
                closable
                onClose={() => setFilters((f) => ({ ...f, type: f.type?.filter((x) => x !== t) }))}
              >
                Type: {t}
              </Tag>
            ))}
            {filters.country?.map((c) => (
              <Tag
                key={c}
                closable
                onClose={() => setFilters((f) => ({ ...f, country: f.country?.filter((x) => x !== c) }))}
              >
                {countries.find((x) => x.value === c)?.label || c}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={() => setFilters({})}>
              Clear all
            </Button>
          </Flex>
        )}
      </Card>

      {/* Numbers Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredNumbers}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          tableLayout="fixed"
          pagination={{
            total: filteredNumbers.length,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
        />
      </Card>

      {/* Filter Drawer */}
      <Drawer
        title="Filter Numbers"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        width={360}
        extra={
          <Button type="link" onClick={() => setFilters({})}>
            Reset
          </Button>
        }
      >
        <Form layout="vertical">
          <Form.Item label="Status">
            <Checkbox.Group
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
                { label: "Pending", value: "pending" },
                { label: "Porting", value: "porting" },
              ]}
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v as NumberStatus[] }))}
            />
          </Form.Item>
          <Form.Item label="Number Type">
            <Checkbox.Group
              options={[
                { label: "Local", value: "local" },
                { label: "Toll-Free", value: "toll-free" },
                { label: "Mobile", value: "mobile" },
                { label: "National", value: "national" },
              ]}
              value={filters.type}
              onChange={(v) => setFilters((f) => ({ ...f, type: v as NumberType[] }))}
            />
          </Form.Item>
          <Form.Item label="Country">
            <Select
              mode="multiple"
              placeholder="Select countries"
              options={countries}
              value={filters.country}
              onChange={(v) => setFilters((f) => ({ ...f, country: v }))}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Connection">
            <Select
              mode="multiple"
              placeholder="Select connections"
              options={connections.map((c) => ({ label: c.name, value: c.id }))}
              value={filters.connectionId}
              onChange={(v) => setFilters((f) => ({ ...f, connectionId: v }))}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Messaging Profile">
            <Select
              mode="multiple"
              placeholder="Select profiles"
              options={messagingProfiles.map((m) => ({ label: m.name, value: m.id }))}
              value={filters.messagingProfileId}
              onChange={(v) => setFilters((f) => ({ ...f, messagingProfileId: v }))}
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item label="Emergency Status">
            <Checkbox.Group
              options={[
                { label: "E911 Enabled", value: "enabled" },
                { label: "E911 Disabled", value: "disabled" },
              ]}
              value={filters.emergencyStatus}
              onChange={(v) => setFilters((f) => ({ ...f, emergencyStatus: v as ("enabled" | "disabled")[] }))}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Edit Number Drawer */}
      <Drawer
        title={`Edit ${editingNumber?.number || "Number"}`}
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        width={400}
        extra={
          <Button type="primary" onClick={handleEditSubmit}>
            Save Changes
          </Button>
        }
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Add tags" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
