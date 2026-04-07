// Telecom Management Types

export type NumberType = 'local' | 'toll-free' | 'mobile' | 'national';
export type NumberStatus = 'active' | 'inactive' | 'pending' | 'porting' | 'reserved';
export type Capability = 'voice' | 'sms' | 'mms' | 'fax' | 'e911';
export type PortStatus = 'pending' | 'submitted' | 'loa_required' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'draft' | 'in-process' | 'exception' | 'unknown';

export interface PhoneNumber {
  id: string;
  number: string;
  formattedNumber: string;
  status: NumberStatus;
  type: NumberType;
  capabilities: Capability[];
  monthlyPrice: number;
  setupFee?: number;
  assignedAgentId?: string;
  assignedAgentName?: string;
  messagingProfileId?: string;
  messagingProfileName?: string;
  connectionId?: string;
  connectionName?: string;
  tags: string[];
  emergencyEnabled: boolean;
  region: string;
  country: string;
  countryCode: string;
  areaCode?: string;
  source: 'purchased' | 'ported' | 'hosted';
  billingGroup?: string;
  voiceBillingMethod?: 'per-minute' | 'channel';
  bundleId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableNumber {
  number: string;
  rawNumber: string;
  formattedNumber: string;
  region: string;
  country: string;
  countryCode: string;
  type: NumberType;
  capabilities: Capability[];
  monthlyPrice: number;
  setupFee: number;
  features: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
    fax: boolean;
    e911: boolean;
  };
  regulatoryRequired: boolean;
  reservationId?: string;
}

export interface NumberSearchParams {
  country: string;
  type?: NumberType;
  areaCode?: string;
  city?: string;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  capabilities?: Capability[];
  limit?: number;
}

export interface PortRequest {
  id: string;
  type: 'in' | 'out';
  status: PortStatus;
  numbers: string[];
  losingCarrier?: string;
  winningCarrier?: string;
  accountNumber?: string;
  accountPin?: string;
  authorizedName?: string;
  billingAddress?: string;
  requestedPortDate?: string;
  actualPortDate?: string;
  loaDocumentId?: string;
  loaDocumentUrl?: string;
  rejectionReason?: string;
  events: PortEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PortEvent {
  id: string;
  type: 'created' | 'submitted' | 'loa_uploaded' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'note';
  message: string;
  timestamp: string;
  user?: string;
}

export interface PortabilityCheckResult {
  number: string;
  portable: boolean;
  carrier?: string;
  losingCarrier?: string;
  portType?: 'wireless' | 'landline' | 'voip';
  reason?: string;
  fastPortEligible?: boolean;
  estimatedDays?: number;
}

export interface RegulatoryRequirement {
  id: string;
  country: string;
  countryName: string;
  requirementType: 'address' | 'identity' | 'business' | 'local_presence';
  description: string;
  required: boolean;
  documentTypes: string[];
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  submittedDocumentId?: string;
}

export interface RegulatoryDocument {
  id: string;
  type: 'id_card' | 'passport' | 'utility_bill' | 'business_license' | 'proof_of_address' | 'loa' | 'other';
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  country?: string;
  expiresAt?: string;
  uploadedAt: string;
}

export interface RegulatoryBundle {
  id: string;
  name: string;
  description: string;
  countries: string[];
  requirements: string[];
  status: 'incomplete' | 'pending' | 'approved';
  completionPercent: number;
}

export interface VoicemailBox {
  id: string;
  name: string;
  phoneNumberId?: string;
  phoneNumber?: string;
  pin: string;
  greetingUrl?: string;
  greetingType: 'default' | 'custom' | 'name';
  emailForwarding?: string;
  smsForwarding?: string;
  transcriptionEnabled: boolean;
  maxMessageLength: number;
  maxMessages: number;
  currentMessages: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CoverageInfo {
  country: string;
  countryName: string;
  countryCode: string;
  flagCode: string;
  coverage: 'excellent' | 'good' | 'limited' | 'none';
  numberTypes: {
    type: NumberType;
    available: boolean;
    inventoryLevel: 'high' | 'medium' | 'low' | 'none';
    monthlyPrice: number;
    setupFee: number;
    capabilities: Capability[];
    regulatoryRequired: boolean;
  }[];
  totalInventory: number;
}

export interface CountryOption {
  name: string;
  value: string;
  dialCode: string;
  flagCode: string;
  supported: boolean;
}

export interface AgentOption {
  label: string;
  value: string;
}

export interface MessagingProfile {
  id: string;
  name: string;
}

export interface Connection {
  id: string;
  name: string;
  type: 'sip' | 'fqdn' | 'credential';
}

// Filter state for My Numbers tab
export interface NumberFilters {
  search?: string;
  status?: NumberStatus[];
  type?: NumberType[];
  capabilities?: Capability[];
  country?: string[];
  tags?: string[];
  connectionId?: string[];
  messagingProfileId?: string[];
  billingGroup?: string[];
  emergencyStatus?: ('enabled' | 'disabled')[];
  bundleId?: string[];
  source?: ('purchased' | 'ported' | 'hosted')[];
}

// Cart for purchasing numbers
export interface NumberCart {
  items: AvailableNumber[];
  totalMonthly: number;
  totalSetup: number;
}

// SaaS Pricing
export interface PricingConfig {
  markupPercentage: number;
  minimumMarkup: number;
  setupFeeMarkup: number;
  currency: string;
}
