"use client";

import {
  CheckCircleOutlined,
  CreditCardOutlined,
  GlobalOutlined,
  PhoneOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Radio,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useCallback, useState } from "react";
import type { AvailableNumber, Capability, CountryOption, NumberCart, NumberType } from "../types";

const { Text, Title } = Typography;

// CDN Channel Icons (consistent with agent details)
const CHANNEL_ICONS = {
  voice: "https://api.iconify.design/mdi:phone.svg?color=%23722ed1",
  sms: "https://api.iconify.design/mdi:message-text.svg?color=%23faad14",
  mms: "https://api.iconify.design/mdi:image.svg?color=%2313c2c2",
  fax: "https://api.iconify.design/mdi:fax.svg?color=%238c8c8c",
};

const COUNTRIES: CountryOption[] = [
  { name: "United States", value: "US", dialCode: "+1", flagCode: "us", supported: true },
  { name: "Canada", value: "CA", dialCode: "+1", flagCode: "ca", supported: true },
  { name: "United Kingdom", value: "GB", dialCode: "+44", flagCode: "gb", supported: true },
  { name: "Australia", value: "AU", dialCode: "+61", flagCode: "au", supported: true },
  { name: "Germany", value: "DE", dialCode: "+49", flagCode: "de", supported: true },
  { name: "France", value: "FR", dialCode: "+33", flagCode: "fr", supported: true },
  { name: "Spain", value: "ES", dialCode: "+34", flagCode: "es", supported: true },
  { name: "Italy", value: "IT", dialCode: "+39", flagCode: "it", supported: true },
  { name: "Netherlands", value: "NL", dialCode: "+31", flagCode: "nl", supported: true },
  { name: "Mexico", value: "MX", dialCode: "+52", flagCode: "mx", supported: true },
];

const NUMBER_TYPES: { value: NumberType; label: string; description: string }[] = [
  { value: "local", label: "Local", description: "Geographic numbers with area codes" },
  { value: "toll-free", label: "Toll-Free", description: "800, 888, 877 numbers" },
  { value: "mobile", label: "Mobile", description: "Wireless-enabled numbers" },
  { value: "national", label: "National", description: "Non-geographic national numbers" },
];

interface BuyNumbersTabProps {
  onComplete: () => void;
}

export default function BuyNumbersTab({ onComplete }: BuyNumbersTabProps) {
  const { message } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [searchForm] = Form.useForm();
  const [isSearching, setIsSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [cart, setCart] = useState<NumberCart>({ items: [], totalMonthly: 0, totalSetup: 0 });
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

  const handleSearch = async () => {
    try {
      const values = await searchForm.validateFields();
      setIsSearching(true);
      setAvailableNumbers([]);

      const response = await fetch(`${BACKEND_URL}/phone-numbers/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: values.country,
          areaCode: values.areaCode || undefined,
          type: values.numberType,
          capabilities: values.capabilities,
          limit: values.quantity || 20,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Search failed");
      }

      // Transform and add pricing (with your SaaS markup)
      const numbers: AvailableNumber[] = (data.numbers || []).map((num: { number: string; rawNumber: string; region: string }) => ({
        number: num.number,
        rawNumber: num.rawNumber,
        formattedNumber: num.number,
        region: num.region,
        country: values.country,
        countryCode: COUNTRIES.find((c) => c.value === values.country)?.dialCode || "+1",
        type: values.numberType || "local",
        capabilities: values.capabilities || ["voice", "sms"],
        monthlyPrice: 2.99, // Your SaaS price (includes markup)
        setupFee: 1.00,
        features: {
          voice: true,
          sms: true,
          mms: values.capabilities?.includes("mms") || false,
          fax: values.capabilities?.includes("fax") || false,
          e911: true,
        },
        regulatoryRequired: ["DE", "FR", "ES", "IT"].includes(values.country),
      }));

      setAvailableNumbers(numbers);
      if (numbers.length > 0) {
        setCurrentStep(1);
      } else {
        message.warning("No numbers found. Try different criteria.");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const addToCart = (number: AvailableNumber) => {
    if (cart.items.find((item) => item.rawNumber === number.rawNumber)) {
      message.warning("Number already in cart");
      return;
    }
    const newItems = [...cart.items, number];
    setCart({
      items: newItems,
      totalMonthly: newItems.reduce((sum, n) => sum + n.monthlyPrice, 0),
      totalSetup: newItems.reduce((sum, n) => sum + n.setupFee, 0),
    });
    message.success("Added to cart");
  };

  const removeFromCart = (rawNumber: string) => {
    const newItems = cart.items.filter((item) => item.rawNumber !== rawNumber);
    setCart({
      items: newItems,
      totalMonthly: newItems.reduce((sum, n) => sum + n.monthlyPrice, 0),
      totalSetup: newItems.reduce((sum, n) => sum + n.setupFee, 0),
    });
  };

  const handlePurchase = async () => {
    if (cart.items.length === 0) {
      message.warning("Cart is empty");
      return;
    }

    setIsPurchasing(true);
    const orgId = localStorage.getItem("orgId");

    try {
      // Purchase each number
      for (const number of cart.items) {
        const response = await fetch(`${BACKEND_URL}/phone-numbers/provision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId,
            region: number.country,
            phoneNumber: number.rawNumber,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to provision ${number.number}`);
        }
      }

      setPurchaseComplete(true);
      setCurrentStep(3);
      message.success(`${cart.items.length} number(s) purchased successfully!`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Purchase failed");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleDone = () => {
    setCart({ items: [], totalMonthly: 0, totalSetup: 0 });
    setAvailableNumbers([]);
    setCurrentStep(0);
    setPurchaseComplete(false);
    searchForm.resetFields();
    onComplete();
  };

  const countryOptions = COUNTRIES.map((c) => ({
    value: c.value,
    label: (
      <Flex align="center" gap={8}>
        <img
          src={`/flags/${c.flagCode}.png`}
          alt={c.name}
          width={20}
          height={14}
          style={{ borderRadius: 2, border: "1px solid #f0f0f0" }}
        />
        <span>{c.name}</span>
        <Text type="secondary">{c.dialCode}</Text>
      </Flex>
    ),
  }));

  const selectedCountryMeta = COUNTRIES.find((c) => c.value === searchForm.getFieldValue("country"));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      {/* Steps Progress */}
      <Steps
        current={currentStep}
        style={{ marginBottom: 32 }}
        items={[
          { title: "Search", icon: <SearchOutlined /> },
          { title: "Select Numbers", icon: <PhoneOutlined /> },
          { title: "Checkout", icon: <CreditCardOutlined /> },
          { title: "Complete", icon: <CheckCircleOutlined /> },
        ]}
      />

      {/* Step 0: Search Configuration */}
      {currentStep === 0 && (
        <Card>
          <Title level={4}>
            <GlobalOutlined style={{ marginRight: 8 }} />
            Find Phone Numbers
          </Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
            Search for available phone numbers by country and preferences
          </Text>

          <Form form={searchForm} layout="vertical" initialValues={{ quantity: 10, capabilities: ["voice", "sms"] }}>
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item name="country" label="Country" rules={[{ required: true, message: "Select a country" }]}>
                  <Select
                    showSearch
                    placeholder="Select a country"
                    options={countryOptions}
                    filterOption={(input, option) => {
                      const country = COUNTRIES.find((c) => c.value === option?.value);
                      return (
                        country?.name.toLowerCase().includes(input.toLowerCase()) ||
                        country?.dialCode.includes(input) ||
                        false
                      );
                    }}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="areaCode" label="Area Code (Optional)">
                  <Input
                    placeholder="e.g. 415, 212, 020"
                    prefix={<PhoneOutlined />}
                    size="large"
                    maxLength={5}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="numberType" label="Number Type" initialValue="local">
              <Radio.Group optionType="button" buttonStyle="solid" size="large">
                {NUMBER_TYPES.map((type) => (
                  <Radio.Button key={type.value} value={type.value}>
                    <Tooltip title={type.description}>{type.label}</Tooltip>
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>

            <Form.Item name="capabilities" label="Capabilities">
              <Checkbox.Group>
                <Space direction="vertical">
                  <Checkbox value="voice">
                    <Avatar size={16} src={CHANNEL_ICONS.voice} style={{ marginRight: 8 }} />
                    Voice Calling
                  </Checkbox>
                  <Checkbox value="sms">
                    <Avatar size={16} src={CHANNEL_ICONS.sms} style={{ marginRight: 8 }} />
                    SMS Messaging
                  </Checkbox>
                  <Checkbox value="mms">
                    <Avatar size={16} src={CHANNEL_ICONS.mms} style={{ marginRight: 8 }} />
                    MMS (Picture Messages)
                  </Checkbox>
                  <Checkbox value="fax">
                    <Avatar size={16} src={CHANNEL_ICONS.fax} style={{ marginRight: 8 }} />
                    Fax
                  </Checkbox>
                </Space>
              </Checkbox.Group>
            </Form.Item>

            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item name="quantity" label="Results to show">
                  <InputNumber min={5} max={50} style={{ width: "100%" }} size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Flex justify="end" gap={12}>
              <Button size="large" onClick={() => searchForm.resetFields()}>
                Reset
              </Button>
              <Button type="primary" size="large" icon={<SearchOutlined />} onClick={handleSearch} loading={isSearching}>
                Search Numbers
              </Button>
            </Flex>
          </Form>
        </Card>
      )}

      {/* Step 1: Select Numbers */}
      {currentStep === 1 && (
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card
              title={
                <Flex justify="space-between" align="center">
                  <span>Available Numbers ({availableNumbers.length})</span>
                  <Button type="link" onClick={() => setCurrentStep(0)}>
                    ← Modify Search
                  </Button>
                </Flex>
              }
            >
              {availableNumbers.length === 0 ? (
                <Empty image="/assets/illustrations/bota/channels.svg" imageStyle={{ height: 80 }} description="No numbers found" />
              ) : (
                <List
                  dataSource={availableNumbers}
                  renderItem={(item) => {
                    const inCart = cart.items.some((c) => c.rawNumber === item.rawNumber);
                    return (
                      <List.Item
                        style={{
                          padding: "16px",
                          marginBottom: 8,
                          borderRadius: 8,
                          border: inCart ? "2px solid #1677ff" : "1px solid #f0f0f0",
                          background: inCart ? "#e6f4ff" : "#fafafa",
                        }}
                        actions={[
                          inCart ? (
                            <Button key="remove" danger onClick={() => removeFromCart(item.rawNumber)}>
                              Remove
                            </Button>
                          ) : (
                            <Button key="add" type="primary" onClick={() => addToCart(item)}>
                              Add to Cart
                            </Button>
                          ),
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<PhoneOutlined style={{ fontSize: 24, color: "#1677ff" }} />}
                          title={
                            <Flex align="center" gap={8}>
                              <Text strong style={{ fontSize: 16 }}>{item.formattedNumber}</Text>
                              {item.regulatoryRequired && (
                                <Tooltip title="Regulatory documents required">
                                  <Tag color="orange">Docs Required</Tag>
                                </Tooltip>
                              )}
                            </Flex>
                          }
                          description={
                            <Space>
                              <Text type="secondary">{item.region}</Text>
                              <Divider type="vertical" />
                              {item.features.voice && <Tag>Voice</Tag>}
                              {item.features.sms && <Tag>SMS</Tag>}
                              {item.features.mms && <Tag>MMS</Tag>}
                            </Space>
                          }
                        />
                        <Flex vertical align="end">
                          <Text strong style={{ fontSize: 18, color: "#1677ff" }}>
                            ${item.monthlyPrice.toFixed(2)}/mo
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            + ${item.setupFee.toFixed(2)} setup
                          </Text>
                        </Flex>
                      </List.Item>
                    );
                  }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={
                <Flex align="center" gap={8}>
                  <ShoppingCartOutlined />
                  Cart ({cart.items.length})
                </Flex>
              }
              style={{ position: "sticky", top: 24 }}
            >
              {cart.items.length === 0 ? (
                <Empty image="/assets/illustrations/bota/channels.svg" imageStyle={{ height: 80 }} description="Your cart is empty" />
              ) : (
                <>
                  <List
                    dataSource={cart.items}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button key="remove" type="link" danger size="small" onClick={() => removeFromCart(item.rawNumber)}>
                            Remove
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={item.formattedNumber}
                          description={`$${item.monthlyPrice.toFixed(2)}/mo`}
                        />
                      </List.Item>
                    )}
                    style={{ marginBottom: 16 }}
                  />

                  <Divider />

                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Monthly Total">
                      <Text strong>${cart.totalMonthly.toFixed(2)}/mo</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Setup Fees">
                      <Text>${cart.totalSetup.toFixed(2)}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Due Today">
                      <Text strong style={{ fontSize: 18, color: "#1677ff" }}>
                        ${(cart.totalMonthly + cart.totalSetup).toFixed(2)}
                      </Text>
                    </Descriptions.Item>
                  </Descriptions>

                  <Button
                    type="primary"
                    block
                    size="large"
                    style={{ marginTop: 16 }}
                    onClick={() => setCurrentStep(2)}
                  >
                    Proceed to Checkout
                  </Button>
                </>
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Step 2: Checkout */}
      {currentStep === 2 && (
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title="Order Summary">
              <List
                dataSource={cart.items}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<PhoneOutlined style={{ fontSize: 20 }} />}
                      title={item.formattedNumber}
                      description={
                        <Space>
                          <Tag>{item.type}</Tag>
                          <Text type="secondary">{item.region}</Text>
                        </Space>
                      }
                    />
                    <Flex vertical align="end">
                      <Text>${item.monthlyPrice.toFixed(2)}/mo</Text>
                      <Text type="secondary">+ ${item.setupFee.toFixed(2)} setup</Text>
                    </Flex>
                  </List.Item>
                )}
              />

              <Divider />

              <Alert
                type="info"
                showIcon
                message="Billing Information"
                description="Numbers will be billed to your account on file. Monthly charges will begin immediately after provisioning."
                style={{ marginBottom: 16 }}
              />

              {cart.items.some((item) => item.regulatoryRequired) && (
                <Alert
                  type="warning"
                  showIcon
                  message="Regulatory Documents Required"
                  description="Some numbers require regulatory documents. You can upload these in the Regulatory tab after purchase."
                  style={{ marginBottom: 16 }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Payment Summary" style={{ position: "sticky", top: 24 }}>
              <Statistic
                title="Numbers"
                value={cart.items.length}
                style={{ marginBottom: 16 }}
              />
              <Statistic
                title="Monthly Recurring"
                prefix="$"
                value={cart.totalMonthly.toFixed(2)}
                suffix="/mo"
                style={{ marginBottom: 16 }}
              />
              <Statistic
                title="One-time Setup"
                prefix="$"
                value={cart.totalSetup.toFixed(2)}
                style={{ marginBottom: 16 }}
              />
              <Divider />
              <Statistic
                title="Due Today"
                prefix="$"
                value={(cart.totalMonthly + cart.totalSetup).toFixed(2)}
                valueStyle={{ color: "#1677ff", fontSize: 28 }}
              />

              <Button
                type="primary"
                block
                size="large"
                style={{ marginTop: 24 }}
                onClick={handlePurchase}
                loading={isPurchasing}
                icon={<CreditCardOutlined />}
              >
                Complete Purchase
              </Button>
              <Button
                block
                style={{ marginTop: 8 }}
                onClick={() => setCurrentStep(1)}
                disabled={isPurchasing}
              >
                Back to Selection
              </Button>
            </Card>
          </Col>
        </Row>
      )}

      {/* Step 3: Complete */}
      {currentStep === 3 && purchaseComplete && (
        <Card>
          <Result
            status="success"
            title="Purchase Complete!"
            subTitle={`${cart.items.length} phone number(s) have been added to your account.`}
            extra={[
              <Button type="primary" key="numbers" onClick={handleDone}>
                View My Numbers
              </Button>,
              <Button key="buy" onClick={() => {
                setCart({ items: [], totalMonthly: 0, totalSetup: 0 });
                setAvailableNumbers([]);
                setCurrentStep(0);
                setPurchaseComplete(false);
                searchForm.resetFields();
              }}>
                Buy More Numbers
              </Button>,
            ]}
          >
            <Descriptions title="Order Details" column={1} bordered style={{ marginTop: 24 }}>
              <Descriptions.Item label="Numbers Purchased">{cart.items.length}</Descriptions.Item>
              <Descriptions.Item label="Monthly Cost">${cart.totalMonthly.toFixed(2)}/mo</Descriptions.Item>
              <Descriptions.Item label="Setup Fees">${cart.totalSetup.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total Charged">${(cart.totalMonthly + cart.totalSetup).toFixed(2)}</Descriptions.Item>
            </Descriptions>
          </Result>
        </Card>
      )}
    </div>
  );
}
