"use client";

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  GlobalOutlined,
  PhoneOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  List,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useState } from "react";
import type { Capability, CoverageInfo, NumberType } from "../types";

const { Text, Title, Paragraph } = Typography;

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

// Default coverage data (used as fallback)
const DEFAULT_COVERAGE_DATA: CoverageInfo[] = [
  {
    country: "US",
    countryName: "United States",
    countryCode: "+1",
    flagCode: "us",
    coverage: "excellent",
    totalInventory: 50000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "high", monthlyPrice: 1.99, setupFee: 1.00, capabilities: ["voice", "sms", "mms", "fax", "e911"], regulatoryRequired: false },
      { type: "toll-free", available: true, inventoryLevel: "high", monthlyPrice: 2.99, setupFee: 1.00, capabilities: ["voice", "sms"], regulatoryRequired: false },
      { type: "mobile", available: true, inventoryLevel: "medium", monthlyPrice: 3.99, setupFee: 2.00, capabilities: ["voice", "sms", "mms"], regulatoryRequired: false },
    ],
  },
  {
    country: "CA",
    countryName: "Canada",
    countryCode: "+1",
    flagCode: "ca",
    coverage: "excellent",
    totalInventory: 25000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "high", monthlyPrice: 2.49, setupFee: 1.00, capabilities: ["voice", "sms", "mms"], regulatoryRequired: false },
      { type: "toll-free", available: true, inventoryLevel: "medium", monthlyPrice: 3.49, setupFee: 1.00, capabilities: ["voice", "sms"], regulatoryRequired: false },
    ],
  },
  {
    country: "GB",
    countryName: "United Kingdom",
    countryCode: "+44",
    flagCode: "gb",
    coverage: "excellent",
    totalInventory: 20000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "high", monthlyPrice: 2.99, setupFee: 1.50, capabilities: ["voice", "sms"], regulatoryRequired: true },
      { type: "toll-free", available: true, inventoryLevel: "medium", monthlyPrice: 4.99, setupFee: 2.00, capabilities: ["voice"], regulatoryRequired: false },
      { type: "mobile", available: true, inventoryLevel: "low", monthlyPrice: 4.99, setupFee: 2.50, capabilities: ["voice", "sms", "mms"], regulatoryRequired: true },
    ],
  },
  {
    country: "DE",
    countryName: "Germany",
    countryCode: "+49",
    flagCode: "de",
    coverage: "good",
    totalInventory: 15000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "medium", monthlyPrice: 3.49, setupFee: 2.00, capabilities: ["voice", "sms"], regulatoryRequired: true },
      { type: "toll-free", available: true, inventoryLevel: "low", monthlyPrice: 5.99, setupFee: 3.00, capabilities: ["voice"], regulatoryRequired: true },
    ],
  },
  {
    country: "FR",
    countryName: "France",
    countryCode: "+33",
    flagCode: "fr",
    coverage: "good",
    totalInventory: 12000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "medium", monthlyPrice: 3.99, setupFee: 2.00, capabilities: ["voice", "sms"], regulatoryRequired: true },
      { type: "national", available: true, inventoryLevel: "high", monthlyPrice: 2.99, setupFee: 1.50, capabilities: ["voice", "sms"], regulatoryRequired: true },
    ],
  },
  {
    country: "AU",
    countryName: "Australia",
    countryCode: "+61",
    flagCode: "au",
    coverage: "good",
    totalInventory: 10000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "medium", monthlyPrice: 3.99, setupFee: 2.00, capabilities: ["voice", "sms"], regulatoryRequired: false },
      { type: "toll-free", available: true, inventoryLevel: "low", monthlyPrice: 5.99, setupFee: 3.00, capabilities: ["voice"], regulatoryRequired: false },
    ],
  },
  {
    country: "ES",
    countryName: "Spain",
    countryCode: "+34",
    flagCode: "es",
    coverage: "limited",
    totalInventory: 5000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "low", monthlyPrice: 4.99, setupFee: 3.00, capabilities: ["voice"], regulatoryRequired: true },
    ],
  },
  {
    country: "IT",
    countryName: "Italy",
    countryCode: "+39",
    flagCode: "it",
    coverage: "limited",
    totalInventory: 3000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "low", monthlyPrice: 5.99, setupFee: 4.00, capabilities: ["voice"], regulatoryRequired: true },
    ],
  },
  {
    country: "MX",
    countryName: "Mexico",
    countryCode: "+52",
    flagCode: "mx",
    coverage: "good",
    totalInventory: 8000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "medium", monthlyPrice: 3.49, setupFee: 2.00, capabilities: ["voice", "sms"], regulatoryRequired: false },
      { type: "toll-free", available: true, inventoryLevel: "medium", monthlyPrice: 4.49, setupFee: 2.00, capabilities: ["voice"], regulatoryRequired: false },
    ],
  },
  {
    country: "BR",
    countryName: "Brazil",
    countryCode: "+55",
    flagCode: "br",
    coverage: "limited",
    totalInventory: 4000,
    numberTypes: [
      { type: "local", available: true, inventoryLevel: "low", monthlyPrice: 5.99, setupFee: 4.00, capabilities: ["voice"], regulatoryRequired: true },
    ],
  },
];

const COVERAGE_CONFIG = {
  excellent: { color: "#52c41a", label: "Excellent", percent: 100 },
  good: { color: "#1677ff", label: "Good", percent: 75 },
  limited: { color: "#faad14", label: "Limited", percent: 40 },
  none: { color: "#ff4d4f", label: "None", percent: 0 },
};

const INVENTORY_CONFIG = {
  high: { color: "success", label: "High", icon: <CheckCircleOutlined /> },
  medium: { color: "processing", label: "Medium", icon: <CheckCircleOutlined /> },
  low: { color: "warning", label: "Low", icon: <CheckCircleOutlined /> },
  none: { color: "error", label: "Unavailable", icon: <CloseCircleOutlined /> },
};

const NUMBER_TYPE_LABELS: Record<NumberType, string> = {
  local: "Local",
  "toll-free": "Toll-Free",
  mobile: "Mobile",
  national: "National",
};

const CAPABILITY_LABELS: Record<Capability, string> = {
  voice: "Voice",
  sms: "SMS",
  mms: "MMS",
  fax: "Fax",
  e911: "E911",
};

interface CoverageTabProps {
  onBuyNumbers: (country: string) => void;
}

export default function CoverageTab({ onBuyNumbers }: CoverageTabProps) {
  const { message } = App.useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CoverageInfo | null>(null);
  const [coverageFilter, setCoverageFilter] = useState<string | null>(null);
  const [coverageData, setCoverageData] = useState<CoverageInfo[]>(DEFAULT_COVERAGE_DATA);
  const [loading, setLoading] = useState(false);

  // Fetch coverage from API
  const fetchCoverage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/coverage/countries`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.countries && data.countries.length > 0) {
          // Transform API response to our format
          const transformed: CoverageInfo[] = data.countries.map((c: { code: string; name: string; regions?: string[] }) => {
            // Find matching default data or create new
            const existing = DEFAULT_COVERAGE_DATA.find((d) => d.country === c.code);
            if (existing) return existing;
            return {
              country: c.code,
              countryName: c.name,
              countryCode: getCountryDialCode(c.code),
              flagCode: c.code.toLowerCase(),
              coverage: "good" as const,
              totalInventory: 1000,
              numberTypes: [
                { type: "local" as NumberType, available: true, inventoryLevel: "medium" as const, monthlyPrice: 2.99, setupFee: 1.00, capabilities: ["voice" as Capability, "sms" as Capability], regulatoryRequired: false },
              ],
            };
          });
          setCoverageData(transformed.slice(0, 30)); // Limit to 30 countries
        }
      }
    } catch (error) {
      console.error("Failed to fetch coverage:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Helper to get dial code
  function getCountryDialCode(code: string): string {
    const dialCodes: Record<string, string> = {
      US: "+1", CA: "+1", GB: "+44", DE: "+49", FR: "+33", AU: "+61",
      ES: "+34", IT: "+39", MX: "+52", BR: "+55", JP: "+81", SG: "+65",
    };
    return dialCodes[code] || `+${code}`;
  }

  const filteredCoverage = coverageData.filter((c) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!c.countryName.toLowerCase().includes(search) && !c.countryCode.includes(search)) {
        return false;
      }
    }
    if (coverageFilter && c.coverage !== coverageFilter) {
      return false;
    }
    return true;
  });

  const totalCountries = coverageData.length;
  const excellentCoverage = coverageData.filter((c) => c.coverage === "excellent").length;

  const coverageColumns: ColumnsType<CoverageInfo> = [
    {
      title: "Country",
      key: "country",
      render: (_, record) => (
        <Flex align="center" gap={12}>
          <img
            src={`/flags/${record.flagCode}.png`}
            alt={record.countryName}
            width={28}
            height={20}
            style={{ borderRadius: 2, border: "1px solid #f0f0f0" }}
          />
          <div>
            <Text strong>{record.countryName}</Text>
            <br />
            <Text type="secondary">{record.countryCode}</Text>
          </div>
        </Flex>
      ),
    },
    {
      title: "Coverage",
      key: "coverage",
      width: 120,
      filters: [
        { text: "Excellent", value: "excellent" },
        { text: "Good", value: "good" },
        { text: "Limited", value: "limited" },
      ],
      onFilter: (value, record) => record.coverage === value,
      render: (_, record) => {
        const config = COVERAGE_CONFIG[record.coverage];
        return (
          <Space>
            <Progress
              type="circle"
              percent={config.percent}
              size={36}
              strokeColor={config.color}
              format={() => ""}
            />
            <Text style={{ color: config.color }}>{config.label}</Text>
          </Space>
        );
      },
    },
    {
      title: "Number Types",
      key: "numberTypes",
      render: (_, record) => (
        <Space wrap>
          {record.numberTypes.map((nt) => (
            <Tooltip
              key={nt.type}
              title={
                <>
                  <div>Inventory: {INVENTORY_CONFIG[nt.inventoryLevel].label}</div>
                  <div>Price: ${nt.monthlyPrice}/mo</div>
                  <div>Capabilities: {nt.capabilities.map((c) => CAPABILITY_LABELS[c]).join(", ")}</div>
                </>
              }
            >
              <Tag
                color={nt.available ? INVENTORY_CONFIG[nt.inventoryLevel].color : "default"}
                icon={nt.available ? INVENTORY_CONFIG[nt.inventoryLevel].icon : <CloseCircleOutlined />}
              >
                {NUMBER_TYPE_LABELS[nt.type]}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: "Starting Price",
      key: "price",
      width: 120,
      sorter: (a, b) => {
        const minA = Math.min(...a.numberTypes.map((nt) => nt.monthlyPrice));
        const minB = Math.min(...b.numberTypes.map((nt) => nt.monthlyPrice));
        return minA - minB;
      },
      render: (_, record) => {
        const minPrice = Math.min(...record.numberTypes.map((nt) => nt.monthlyPrice));
        return (
          <Text strong style={{ color: "#1677ff" }}>
            From ${minPrice.toFixed(2)}/mo
          </Text>
        );
      },
    },
    {
      title: "Regulatory",
      key: "regulatory",
      width: 90,
      render: (_, record) => {
        const hasRegulatory = record.numberTypes.some((nt) => nt.regulatoryRequired);
        return hasRegulatory ? (
          <Tooltip title="Some numbers require regulatory documents">
            <Tag color="orange">Required</Tag>
          </Tooltip>
        ) : (
          <Tag color="green">None</Tag>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 110,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => setSelectedCountry(record)}>
            Details
          </Button>
          <Button type="primary" size="small" onClick={() => onBuyNumbers(record.country)}>
            Buy
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      {/* Stats Overview */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Countries Covered"
              value={totalCountries}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: "#1677ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Excellent Coverage"
              value={excellentCoverage}
              suffix={`/ ${totalCountries}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Inventory"
              value={coverageData.reduce((sum, c) => sum + c.totalInventory, 0)}
              prefix={<PhoneOutlined />}
              formatter={(value) => `${(Number(value) / 1000).toFixed(0)}K+`}
            />
          </Card>
        </Col>
      </Row>

      {/* Search and Filters */}
      <Card bodyStyle={{ padding: "16px 24px" }} style={{ marginBottom: 16 }}>
        <Flex gap={16} wrap="wrap">
          <Input.Search
            placeholder="Search countries..."
            style={{ width: 300 }}
            allowClear
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onSearch={setSearchTerm}
          />
          <Select
            placeholder="Coverage Level"
            style={{ width: 160 }}
            allowClear
            value={coverageFilter}
            onChange={setCoverageFilter}
            options={[
              { value: "excellent", label: "Excellent" },
              { value: "good", label: "Good" },
              { value: "limited", label: "Limited" },
            ]}
          />
        </Flex>
      </Card>

      {/* Coverage Table */}
      <Card title="Country Coverage">
        <Table
          columns={coverageColumns}
          dataSource={filteredCoverage}
          rowKey="country"
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Country Detail Drawer */}
      {selectedCountry && (
        <Card
          title={
            <Flex align="center" gap={12}>
              <img
                src={`/flags/${selectedCountry.flagCode}.png`}
                alt={selectedCountry.countryName}
                width={32}
                height={22}
                style={{ borderRadius: 2 }}
              />
              <span>{selectedCountry.countryName} Coverage Details</span>
            </Flex>
          }
          extra={
            <Button onClick={() => setSelectedCountry(null)}>
              Close
            </Button>
          }
          style={{ marginTop: 16 }}
        >
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Country Code">{selectedCountry.countryCode}</Descriptions.Item>
                <Descriptions.Item label="Coverage Level">
                  <Tag color={COVERAGE_CONFIG[selectedCountry.coverage].color}>
                    {COVERAGE_CONFIG[selectedCountry.coverage].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Total Inventory">
                  {selectedCountry.totalInventory.toLocaleString()} numbers
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} md={16}>
              <Title level={5}>Available Number Types</Title>
              <List
                dataSource={selectedCountry.numberTypes}
                renderItem={(nt) => (
                  <List.Item
                    actions={[
                      <Button
                        key="buy"
                        type="primary"
                        size="small"
                        onClick={() => onBuyNumbers(selectedCountry.country)}
                      >
                        Buy Now
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Tag color={INVENTORY_CONFIG[nt.inventoryLevel].color}>
                          {NUMBER_TYPE_LABELS[nt.type]}
                        </Tag>
                      }
                      title={
                        <Space>
                          <Text strong>${nt.monthlyPrice}/mo</Text>
                          <Text type="secondary">+ ${nt.setupFee} setup</Text>
                          {nt.regulatoryRequired && <Tag color="orange">Docs Required</Tag>}
                        </Space>
                      }
                      description={
                        <Space>
                          {nt.capabilities.map((cap) => (
                            <Tag key={cap}>{CAPABILITY_LABELS[cap]}</Tag>
                          ))}
                          <Divider type="vertical" />
                          <Text type="secondary">
                            Inventory: {INVENTORY_CONFIG[nt.inventoryLevel].label}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Col>
          </Row>

          {selectedCountry.numberTypes.some((nt) => nt.regulatoryRequired) && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 16 }}
              message="Regulatory Requirements"
              description={`Some number types in ${selectedCountry.countryName} require regulatory documents such as proof of address or business registration. You can upload these documents in the Regulatory tab after purchasing numbers.`}
            />
          )}
        </Card>
      )}
    </Spin>
  );
}
