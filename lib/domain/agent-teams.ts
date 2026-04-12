// ============================================================================
// Agent Teams Type Definitions
// Multi-agent orchestration with handoffs between specialized agents
// ============================================================================

export interface AgentTeam {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  entryAgentId: string | null;
  status: 'draft' | 'active' | 'paused';
  settings: TeamSettings;
  createdAt: string;
  updatedAt: string;
  // Joined data
  members?: TeamMember[];
  entryAgent?: {
    id: string;
    name: string;
    status: string;
  };
}

export interface TeamSettings {
  maxHandoffs?: number; // Prevent infinite loops (default: 5)
  handoffTimeout?: number; // Seconds before auto-escalate
  enableSummary?: boolean; // Generate AI summary on handoff
  summaryPrompt?: string; // Custom prompt for summary generation
  enableVariableExtraction?: boolean; // Extract context variables
}

export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  maxHandoffs: 5,
  handoffTimeout: 300,
  enableSummary: true,
  enableVariableExtraction: true,
};

export interface TeamMember {
  id: string;
  teamId: string;
  agentId: string;
  role: 'entry' | 'specialist';
  specialization?: string;
  position: number;
  // Joined from agents table
  agent?: {
    id: string;
    name: string;
    status: string;
    voice?: string;
    avatar_url?: string | null;
  };
}

export interface HandoffRule {
  id: string;
  teamId: string;
  sourceAgentId: string | null; // null = any agent
  targetAgentId: string;
  ruleType: 'keyword' | 'intent' | 'always';
  conditions: RuleCondition[];
  priority: number;
  contextConfig: ContextConfig;
  enabled: boolean;
  // Joined data
  sourceAgent?: {
    id: string;
    name: string;
  };
  targetAgent?: {
    id: string;
    name: string;
  };
}

export interface RuleCondition {
  type: 'keyword' | 'intent';
  value: string;
  matchType?: 'exact' | 'contains' | 'regex';
}

export interface ContextConfig {
  includeSummary: boolean;
  includeHistory: boolean;
  historyLimit?: number;
  variables: string[]; // Variable names to extract
}

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  includeSummary: true,
  includeHistory: false,
  historyLimit: 10,
  variables: [],
};

export interface ContextVariable {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  extractPrompt?: string;
  required: boolean;
  position: number;
}

export interface TeamConversationContext {
  id: string;
  conversationId: string;
  teamId: string;
  variables: Record<string, unknown>;
  summary: string | null;
  handoffHistory: HandoffEvent[];
  handoffCount: number;
  updatedAt: string;
}

export interface HandoffEvent {
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  reason: string;
  contextSummary?: string;
  extractedVariables?: Record<string, unknown>;
  timestamp: string;
}

export interface HandoffRequest {
  targetAgentId?: string;
  targetAgentName?: string;
  reason: string;
  extractedVariables?: Record<string, unknown>;
}

export interface HandoffResult {
  success: boolean;
  targetAgentId?: string;
  targetAgentName?: string;
  contextSummary?: string;
  extractedVariables?: Record<string, unknown>;
  error?: string;
}

// Common intents for rule-based handoffs
export const COMMON_INTENTS = [
  { value: 'billing_inquiry', label: 'Billing Inquiry' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'refund_request', label: 'Refund Request' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'account_issue', label: 'Account Issue' },
  { value: 'sales_inquiry', label: 'Sales Inquiry' },
  { value: 'pricing_question', label: 'Pricing Question' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'upgrade_request', label: 'Upgrade Request' },
  { value: 'general_question', label: 'General Question' },
];

// Common specializations for team members
export const COMMON_SPECIALIZATIONS = [
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical Support' },
  { value: 'sales', label: 'Sales' },
  { value: 'support', label: 'General Support' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'retention', label: 'Retention' },
  { value: 'escalation', label: 'Escalation' },
];

// API Response types
export interface TeamsListResponse {
  teams: AgentTeam[];
}

export interface TeamResponse {
  team: AgentTeam;
}

export interface TeamMembersResponse {
  members: TeamMember[];
}

export interface HandoffRulesResponse {
  rules: HandoffRule[];
}

export interface ContextVariablesResponse {
  variables: ContextVariable[];
}

// API Request types
export interface CreateTeamRequest {
  name: string;
  description?: string;
  entryAgentId?: string;
  status?: 'draft' | 'active' | 'paused';
  settings?: Partial<TeamSettings>;
}

export interface UpdateTeamRequest {
  id: string;
  name?: string;
  description?: string;
  entryAgentId?: string | null;
  status?: 'draft' | 'active' | 'paused';
  settings?: Partial<TeamSettings>;
}

export interface AddTeamMemberRequest {
  agentId: string;
  role?: 'entry' | 'specialist';
  specialization?: string;
  position?: number;
}

export interface UpdateTeamMemberRequest {
  id: string;
  role?: 'entry' | 'specialist';
  specialization?: string;
  position?: number;
}

export interface CreateHandoffRuleRequest {
  sourceAgentId?: string | null;
  targetAgentId: string;
  ruleType: 'keyword' | 'intent' | 'always';
  conditions?: RuleCondition[];
  priority?: number;
  contextConfig?: Partial<ContextConfig>;
  enabled?: boolean;
}

export interface UpdateHandoffRuleRequest {
  id: string;
  sourceAgentId?: string | null;
  targetAgentId?: string;
  ruleType?: 'keyword' | 'intent' | 'always';
  conditions?: RuleCondition[];
  priority?: number;
  contextConfig?: Partial<ContextConfig>;
  enabled?: boolean;
}

export interface CreateContextVariableRequest {
  name: string;
  description?: string;
  extractPrompt?: string;
  required?: boolean;
  position?: number;
}

export interface UpdateContextVariableRequest {
  id: string;
  name?: string;
  description?: string;
  extractPrompt?: string;
  required?: boolean;
  position?: number;
}
