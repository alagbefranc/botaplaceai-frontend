"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RoutePageShell } from "@/app/_components/route-page-shell";
import {
  Badge,
  Button,
  Drawer,
  Dropdown,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { TableColumnsType, TableProps } from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SyncOutlined,
  UploadOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  tags: string[];
  source: "manual" | "csv" | "crm";
  status: "active" | "opted_out" | "do_not_call";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  active: { color: "#17DEBC", label: "Active" },
  opted_out: { color: "#faad14", label: "Opted Out" },
  do_not_call: { color: "#ff4d4f", label: "Do Not Call" },
};

const sourceConfig: Record<string, { color: string; label: string }> = {
  manual: { color: "#8c8c8c", label: "Manual" },
  csv: { color: "#1677ff", label: "CSV" },
  crm: { color: "#722ed1", label: "CRM" },
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"ascend" | "descend">("descend");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // CSV Import
  const [importOpen, setImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<UploadFile | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);

  // CRM Sync
  const [syncing, setSyncing] = useState(false);

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchContacts = useCallback(async (opts?: {
    page?: number; pageSize?: number; search?: string; sortField?: string; sortDir?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(opts?.page ?? page),
        pageSize: String(opts?.pageSize ?? pageSize),
        search: opts?.search ?? search,
        sortField: opts?.sortField ?? sortField,
        sortDir: opts?.sortDir ?? sortDir,
      });
      const res = await fetch(`/api/contacts?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortField, sortDir]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchContacts({ page: 1, search: val });
    }, 400);
  };

  const handleTableChange: TableProps<Contact>["onChange"] = (pagination, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    const newPage = pagination.current ?? 1;
    const newSize = pagination.pageSize ?? 50;
    const newField = (s.field as string) ?? "created_at";
    const newDir = s.order ?? "descend";
    setPage(newPage);
    setPageSize(newSize);
    setSortField(newField);
    setSortDir(newDir as "ascend" | "descend");
    fetchContacts({ page: newPage, pageSize: newSize, sortField: newField, sortDir: newDir as string });
  };

  const openAdd = () => {
    setEditingContact(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    form.setFieldsValue({
      name: contact.name,
      phone: contact.phone,
      email: contact.email ?? "",
      company: contact.company ?? "",
      tags: contact.tags ?? [],
      notes: contact.notes ?? "",
      status: contact.status,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const url = editingContact ? `/api/contacts/${editingContact.id}` : "/api/contacts";
      const method = editingContact ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      message.success(editingContact ? "Contact updated." : "Contact added.");
      setDrawerOpen(false);
      fetchContacts();
    } catch (err) {
      if (err instanceof Error && err.message) message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { message.error(data.error); return; }
    message.success("Contact deleted.");
    fetchContacts();
  };

  const handleBulkDelete = async () => {
    await Promise.all((selectedRowKeys as string[]).map((id) => fetch(`/api/contacts/${id}`, { method: "DELETE" })));
    message.success(`${selectedRowKeys.length} contacts deleted.`);
    setSelectedRowKeys([]);
    fetchContacts();
  };

  const handleExport = () => {
    const selected = contacts.filter((c) => selectedRowKeys.includes(c.id));
    const rows = [["Name", "Phone", "Email", "Company", "Tags", "Status", "Source"]];
    selected.forEach((c) => rows.push([c.name, c.phone, c.email ?? "", c.company ?? "", c.tags.join(";"), c.status, c.source]));
    const csv = rows.map((r) => r.map((f) => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "contacts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile: UploadProps["beforeUpload"] = (file) => {
    setCsvFile(file as unknown as UploadFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).slice(0, 7).filter(Boolean);
      const rows = lines.map((l) => l.split(",").map((v) => v.replace(/^"|"$/g, "").trim()));
      setCsvPreview(rows);
    };
    reader.readAsText(file);
    return false;
  };

  const handleImport = async () => {
    if (!csvFile) { message.error("Please upload a CSV file."); return; }
    setImporting(true);
    try {
      const reader = new FileReader();
      const text = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(csvFile as unknown as File);
      });
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const dynMsg = data.dynamicVariables?.length
        ? ` Dynamic variables: ${data.dynamicVariables.join(", ")}.`
        : "";
      const invalidMsg = data.invalid ? ` ${data.invalid} rows skipped (invalid E.164 format).` : "";
      message.success(`Imported ${data.imported} contacts.${invalidMsg}${dynMsg}`);
      setImportOpen(false);
      setCsvFile(null);
      setCsvPreview([]);
      fetchContacts();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleCrmSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/contacts/sync-crm", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.synced === 0 && data.message) {
        message.info(data.message);
      } else {
        message.success(`Synced ${data.synced} contacts from CRM.`);
        fetchContacts();
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "CRM sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  const columns: TableColumnsType<Contact> = [
    {
      title: "Name",
      dataIndex: "name",
      sorter: true,
      width: 200,
      render: (name: string, record) => (
        <Button type="link" style={{ padding: 0, color: "inherit", fontWeight: 500 }} onClick={() => openEdit(record)}>
          {name}
        </Button>
      ),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      width: 160,
      render: (phone: string) => (
        <Space size={4}>
          <span style={{ fontFamily: "monospace" }}>{phone}</span>
          <Tooltip title="Copy">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => { navigator.clipboard.writeText(phone); message.success("Copied!"); }}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "Company",
      dataIndex: "company",
      sorter: true,
      width: 160,
      filterMode: "tree",
      filterSearch: true,
      filters: [],
      render: (v?: string) => v ?? <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Tags",
      dataIndex: "tags",
      width: 180,
      render: (tags: string[]) =>
        tags?.length > 0 ? (
          <Space size={4} wrap>
            {tags.map((t) => <Tag key={t} style={{ fontSize: 11 }}>{t}</Tag>)}
          </Space>
        ) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Source",
      dataIndex: "source",
      width: 110,
      filterMode: "tree",
      filters: [
        { text: "Manual", value: "manual" },
        { text: "CSV", value: "csv" },
        { text: "CRM", value: "crm" },
      ],
      onFilter: (value, record) => record.source === value,
      render: (src: string) => {
        const cfg = sourceConfig[src] ?? { color: "#8c8c8c", label: src };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      width: 130,
      filterMode: "tree",
      filters: [
        { text: "Active", value: "active" },
        { text: "Opted Out", value: "opted_out" },
        { text: "Do Not Call", value: "do_not_call" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => {
        const cfg = statusConfig[status] ?? { color: "#8c8c8c", label: status };
        return <Badge color={cfg.color} text={cfg.label} />;
      },
    },
    {
      title: "Added",
      dataIndex: "created_at",
      sorter: true,
      width: 130,
      render: (v: string) => (
        <Tooltip title={dayjs(v).format("MMM D, YYYY h:mm A")}>
          <span>{dayjs(v).fromNow()}</span>
        </Tooltip>
      ),
    },
    {
      title: "",
      key: "actions",
      fixed: "right" as const,
      width: 120,
      render: (_: unknown, record: Contact) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title="Add to mission">
            <Button type="text" size="small" icon={<SendOutlined />} onClick={() => {
              setSelectedRowKeys([record.id]);
              message.info("Select a mission from the Missions page to add this contact.");
            }} />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm title="Delete this contact?" onConfirm={() => handleDelete(record.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const csvHeaders = (csvPreview[0] ?? []).map((h) => h.toLowerCase());

  return (
    <RoutePageShell title="Contacts" nativeContent>
    <div style={{ padding: "24px 32px", minHeight: "100vh", background: "#fafafa" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Contacts</Typography.Title>
          <Badge
            count={total}
            showZero
            style={{ backgroundColor: "#f0fdfb", color: "#17DEBC", border: "1px solid #5EEAD4", fontWeight: 600 }}
          />
        </div>
        <Space>
          <Input.Search
            placeholder="Search contacts..."
            allowClear
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 240 }}
          />
          <Tooltip title="Refresh">
            <Button icon={<ReloadOutlined />} onClick={() => fetchContacts()} loading={loading} />
          </Tooltip>
          <Button icon={<SyncOutlined spin={syncing} />} onClick={handleCrmSync} loading={syncing}>
            Sync CRM
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={openAdd}
            style={{ background: "#17DEBC", borderColor: "#17DEBC", color: "#fff" }}>
            Add Contact
          </Button>
        </Space>
      </div>

      {/* Bulk action toolbar */}
      {selectedRowKeys.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
          padding: "10px 16px", background: "#f0fdfb", borderRadius: 8,
          border: "1px solid #5EEAD4",
        }}>
          <Typography.Text style={{ color: "#17DEBC", fontWeight: 500 }}>
            {selectedRowKeys.length} selected
          </Typography.Text>
          <Dropdown menu={{
            items: [{ key: "all", label: "Use all listed contacts" }],
          }}>
            <Button size="small" icon={<SendOutlined />}>Add to Mission</Button>
          </Dropdown>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>Export</Button>
          <Popconfirm
            title={`Delete ${selectedRowKeys.length} contacts?`}
            onConfirm={handleBulkDelete}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
          <Button size="small" type="text" onClick={() => setSelectedRowKeys([])}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <Table<Contact>
        rowKey="id"
        columns={columns}
        dataSource={contacts}
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        onChange={handleTableChange}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} contacts`,
          pageSizeOptions: ["25", "50", "100"],
        }}
        scroll={{ x: "max-content" }}
        size="middle"
        style={{ background: "#fff", borderRadius: 12 }}
      />

      {/* Add/Edit Drawer */}
      <Drawer
        title={editingContact ? "Edit Contact" : "Add Contact"}
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving}
              style={{ background: "#17DEBC", borderColor: "#17DEBC" }}>
              {editingContact ? "Save Changes" : "Add Contact"}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: "Name is required." }]}>
            <Input placeholder="Jane Smith" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true, message: "Phone is required." }]}>
            <Input placeholder="+1 555 000 0000" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="jane@example.com" type="email" />
          </Form.Item>
          <Form.Item name="company" label="Company">
            <Input placeholder="Acme Corp" />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="tags" placeholder="Add tags..." tokenSeparators={[","]} />
          </Form.Item>
          {editingContact && (
            <Form.Item name="status" label="Status">
              <Select>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="opted_out">Opted Out</Select.Option>
                <Select.Option value="do_not_call">Do Not Call</Select.Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Any notes about this contact..." />
          </Form.Item>
          {editingContact && (
            <Form.Item label="Source">
              <Badge
                color={sourceConfig[editingContact.source]?.color ?? "#8c8c8c"}
                text={sourceConfig[editingContact.source]?.label ?? editingContact.source}
              />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* CSV Import Modal */}
      <Modal
        title="Import Contacts from CSV"
        open={importOpen}
        onCancel={() => { setImportOpen(false); setCsvFile(null); setCsvPreview([]); }}
        footer={
          <Space>
            <Button onClick={() => { setImportOpen(false); setCsvFile(null); setCsvPreview([]); }}>Cancel</Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={importing}
              disabled={!csvFile || !csvHeaders.includes("number")}
              onClick={handleImport}
              style={{ background: "#17DEBC", borderColor: "#17DEBC" }}
            >
              Import
            </Button>
          </Space>
        }
        width={620}
      >
        {/* Dragger — only shown when no file selected */}
        {!csvFile ? (
          <Upload.Dragger
            accept=".csv"
            beforeUpload={handleCsvFile}
            fileList={[]}
            showUploadList={false}
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 32, color: "#17DEBC" }} />
            </p>
            <p className="ant-upload-text">Click or drag a CSV file to upload</p>
            <p className="ant-upload-hint">
              Requires a <strong>number</strong> column in E.164 format (+14151234567). Extra columns become dynamic variables.
            </p>
          </Upload.Dragger>
        ) : (
          /* Compact file pill shown after upload */
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", marginBottom: 16,
            background: "#f0fdfb", border: "1px solid #5EEAD4",
            borderRadius: 8,
          }}>
            <Space size={8}>
              <UploadOutlined style={{ color: "#17DEBC", fontSize: 16 }} />
              <Typography.Text style={{ fontWeight: 500, color: "#0DBBA3" }}>
                {(csvFile as unknown as File).name}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {csvPreview.length - 1} data rows detected
              </Typography.Text>
            </Space>
            <Button
              type="text"
              size="small"
              danger
              onClick={() => { setCsvFile(null); setCsvPreview([]); }}
            >
              Remove
            </Button>
          </div>
        )}

        {csvHeaders.length > 0 && (
          <>
            {/* Validation banner */}
            {csvHeaders.includes("number") ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", marginBottom: 12,
                background: "#f0fdfb", border: "1px solid #5EEAD4", borderRadius: 6,
              }}>
                <span style={{ color: "#17DEBC", fontWeight: 700, fontSize: 15 }}>✓</span>
                <Typography.Text style={{ color: "#0DBBA3", fontWeight: 500 }}>
                  <code style={{ fontWeight: 700 }}>number</code> column detected
                </Typography.Text>
                {csvHeaders.filter((h) => !["number", "name", "email", "company", "tags", "notes"].includes(h)).length > 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
                    · Dynamic vars:{" "}
                    {csvHeaders
                      .filter((h) => !["number", "name", "email", "company", "tags", "notes"].includes(h))
                      .map((h) => <code key={h} style={{ marginRight: 4, background: "#f5f5f5", padding: "0 4px", borderRadius: 3 }}>{h}</code>)}
                  </Typography.Text>
                )}
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", marginBottom: 12,
                background: "#fff2f0", border: "1px solid #ffccc7", borderRadius: 6,
              }}>
                <span style={{ color: "#ff4d4f", fontWeight: 700, fontSize: 15 }}>✗</span>
                <Typography.Text type="danger">
                  Missing required <code>number</code> column. Rename your phone column to <code>number</code> (lowercase).
                </Typography.Text>
              </div>
            )}
            <div style={{ overflowX: "auto", border: "1px solid #e8e8e8", borderRadius: 6 }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                tableLayout: "fixed",
              }}>
                <thead>
                  <tr>
                    {csvHeaders.map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 10px",
                          background: "#fafafa",
                          borderBottom: "1px solid #e8e8e8",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "#595959",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 120,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.slice(1).map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#fafafa" }}>
                      {csvHeaders.map((_h, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: "7px 10px",
                            borderBottom: ri < csvPreview.length - 2 ? "1px solid #f0f0f0" : "none",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 120,
                            color: "#262626",
                          }}
                          title={row[ci] ?? ""}
                        >
                          {row[ci] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
    </RoutePageShell>
  );
}
