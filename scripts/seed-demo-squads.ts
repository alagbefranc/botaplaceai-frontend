/**
 * Seed Demo Squads — 3 pre-built team scenarios for testing
 *
 * Scenarios:
 *  1. Clinic Triage Squad        (Triage Nurse → Doctor | Scheduler | Billing)
 *  2. E-commerce Support Squad   (Order Bot → Returns | Tech Support | VIP Concierge)
 *  3. Property Management Squad  (Router → Maintenance | Leasing)
 *
 * Run with: npx tsx scripts/seed-demo-squads.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Load env ────────────────────────────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  live_api: {
    model: "gemini-3.1-flash-live-preview",
    thinkingLevel: "minimal",
    thinkingBudget: 1024,
    includeThoughts: false,
    inputAudioTranscription: true,
    outputAudioTranscription: true,
    automaticVad: true,
    vadStartSensitivity: "START_SENSITIVITY_LOW",
    vadEndSensitivity: "END_SENSITIVITY_LOW",
    vadPrefixPaddingMs: 20,
    vadSilenceDurationMs: 700,
    turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
    mediaResolution: "MEDIA_RESOLUTION_LOW",
    initialHistoryInClientContent: false,
    proactiveAudio: false,
    enableAffectiveDialog: false,
  },
  custom_functions: [],
  behavior: {
    responseLength: "medium",
    tone: "professional",
    language: "en",
    responseFormat: "auto",
    personality: "",
    instructions: "",
    variables: [],
    multilingual: { enabled: false, primaryLanguage: "en", supportedLanguages: [], autoDetect: false },
    personalization: { enabled: false, useUserName: false, adaptTone: false, rememberPreferences: false },
    backgroundMessages: [],
    idleMessages: [],
  },
  speech: {
    speed: 1,
    pitch: 0,
    stability: 0.5,
    clarityEnhancement: true,
    backgroundDenoise: { enabled: false, level: "medium" },
    pronunciationGuide: [],
    voiceFallback: { enabled: false, fallbackVoice: "Puck", triggerOnError: true },
    transcriber: { provider: "google", model: "default", language: "en" },
  },
  tools: {
    rejectionPlan: "retry",
    maxRetries: 2,
    staticAliases: {},
    voicemailEnabled: false,
    voicemailConfig: { enabled: false, detectionTimeout: 3, message: "" },
    codeToolEnabled: false,
    escalation: {
      enabled: false,
      rules: [],
      defaultDepartment: "support",
      defaultPriority: "normal",
      confirmBeforeTransfer: true,
      maxWaitTimeSeconds: 300,
    },
    holdMusic: { enabled: false, type: "none", presetId: "", volume: 50, loopAnnouncement: false, announcementIntervalSeconds: 60, estimatedWaitMessage: false },
  },
  hooks: { hooks: [] },
  provider: { chatModel: "gemini-3-flash-preview", gemini: { useDefault: true }, enablePartnerModels: false, fallbackEnabled: false, fallbackModel: "gemini-3-flash-preview" },
  custom_insights: { enabled: false, definitionIds: [], groupIds: [], autoExtractOnEnd: false },
  guardrails: { enabled: false, outputTopics: [], inputTopics: [], outputPlaceholder: "I can't help with that.", inputPlaceholder: "I can't help with that." },
};

const DEFAULT_ANALYSIS_PLAN = {
  summaryPrompt: "",
  structuredDataPrompt: "",
  structuredDataSchema: {},
  successEvaluationPrompt: "",
  successEvaluationRubric: "NumericScale",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function agentPayload(orgId: string, name: string, voice: string, greeting: string, systemPrompt: string, tools: string[] = ["web_chat"]): Record<string, unknown> {
  return {
    org_id: orgId,
    name,
    voice,
    greeting_message: greeting,
    system_prompt: systemPrompt,
    tools: [],
    channels: tools,
    status: "active",
    settings: DEFAULT_SETTINGS,
    analysis_plan: DEFAULT_ANALYSIS_PLAN,
  };
}

async function createAgent(orgId: string, name: string, voice: string, greeting: string, systemPrompt: string, channels: string[] = ["web_chat"]): Promise<string> {
  const { data, error } = await supabase
    .from("agents")
    .insert(agentPayload(orgId, name, voice, greeting, systemPrompt, channels))
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create agent "${name}": ${error?.message}`);
  console.log(`  ✓ Agent created: ${name} (${data.id})`);
  return data.id;
}

async function createTeam(orgId: string, name: string, description: string, entryAgentId: string): Promise<string> {
  const { data, error } = await supabase
    .from("agent_teams")
    .insert({
      org_id: orgId,
      name,
      description,
      entry_agent_id: entryAgentId,
      status: "active",
      settings: { maxHandoffs: 5, handoffTimeout: 30, enableSummary: true, enableVariableExtraction: true },
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create team "${name}": ${error?.message}`);
  console.log(`  ✓ Team created: ${name} (${data.id})`);
  return data.id;
}

async function addMember(teamId: string, agentId: string, role: "entry" | "specialist", specialization: string, position: number): Promise<void> {
  const { error } = await supabase.from("team_members").insert({ team_id: teamId, agent_id: agentId, role, specialization, position });
  if (error) throw new Error(`Failed to add member: ${error.message}`);
}

async function addHandoffRule(
  teamId: string,
  sourceAgentId: string | null,
  targetAgentId: string,
  ruleType: "keyword" | "intent" | "always",
  conditions: Array<{ type: "keyword" | "intent"; value: string; matchType?: "exact" | "contains" | "regex" }>,
  priority: number,
  contextConfig: { includeSummary: boolean; includeHistory: boolean; historyLimit?: number; variables: string[] },
  label: string,
): Promise<void> {
  const { error } = await supabase.from("handoff_rules").insert({
    team_id: teamId,
    source_agent_id: sourceAgentId,
    target_agent_id: targetAgentId,
    rule_type: ruleType,
    conditions,
    priority,
    context_config: contextConfig,
    enabled: true,
  });
  if (error) throw new Error(`Failed to add rule "${label}": ${error.message}`);
  console.log(`    ↪ Rule: ${label}`);
}

async function addContextVariables(teamId: string, vars: Array<{ name: string; description: string; extractPrompt: string; required: boolean }>): Promise<void> {
  const rows = vars.map((v, i) => ({
    team_id: teamId,
    name: v.name,
    description: v.description,
    extract_prompt: v.extractPrompt,
    required: v.required,
    position: i,
  }));
  const { error } = await supabase.from("team_context_variables").insert(rows);
  if (error) throw new Error(`Failed to insert context variables: ${error.message}`);
  console.log(`    ↪ Context variables: ${vars.map((v) => v.name).join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1 — Clinic Triage Squad
// ═══════════════════════════════════════════════════════════════════════════════

async function seedClinicSquad(orgId: string): Promise<void> {
  console.log("\n📋 Scenario 1: Clinic Triage Squad");

  // Agents
  const triageId = await createAgent(orgId,
    "Triage Nurse",
    "Aoede",
    "Hello! You've reached the clinic. I'm your triage nurse. Can you tell me what brings you in today?",
    `You are a triage nurse AI at a medical clinic. Your job is to:
1. Greet the patient warmly.
2. Ask about their chief complaint and symptoms.
3. Assess urgency (emergency, urgent, routine, wellness, or scheduling).
4. If the patient describes a medical emergency (chest pain, difficulty breathing, stroke symptoms, severe injury) → immediately transfer to Doctor Consultation.
5. If the patient needs a prescription refill, specialist consult, or follow-up → transfer to Doctor Consultation.
6. If the patient wants to book, change, or cancel an appointment → transfer to Appointment Scheduler.
7. If the patient has billing, insurance, or payment questions → transfer to Billing Specialist.
8. Never diagnose. Never prescribe. Always stay empathetic and reassuring.
Always extract: patientName, chiefComplaint, urgencyLevel before transferring.`,
    ["web_chat", "web_voice"],
  );

  const doctorId = await createAgent(orgId,
    "Doctor Consultation",
    "Charon",
    "Hi {{patientName}}, I'm reviewing your case now. I understand you're here about {{chiefComplaint}}. Let me help you.",
    `You are a doctor consultation AI. You have received a patient transfer from the triage nurse.
You know: Patient name: {{patientName}}, Chief complaint: {{chiefComplaint}}, Urgency: {{urgencyLevel}}.
Your role:
- Gather more clinical detail about the patient's symptoms (duration, severity, associated symptoms).
- Provide medical information and general guidance (not a diagnosis).
- Recommend whether the patient should visit the clinic, go to urgent care, or call 911.
- For prescription refills: collect the medication name and pharmacy details, then advise next steps.
- If the patient needs to schedule a follow-up → transfer to Appointment Scheduler.
- Always be calm, thorough, and medically informative.`,
    ["web_chat", "web_voice"],
  );

  const schedulerId = await createAgent(orgId,
    "Appointment Scheduler",
    "Leda",
    "Hi {{patientName}}! I'm here to help you schedule your appointment. What date works best for you?",
    `You are an appointment scheduling AI for a medical clinic.
Patient context: Name: {{patientName}}, Reason for visit: {{chiefComplaint}}.
Your role:
- Confirm the type of appointment (new patient, follow-up, specialist, wellness check).
- Ask for preferred dates and times.
- Confirm the patient's date of birth and insurance provider for the records.
- Explain what to bring (ID, insurance card, referral if required).
- Confirm the appointment details at the end.
- If a billing question comes up → transfer to Billing Specialist.`,
    ["web_chat"],
  );

  const billingId = await createAgent(orgId,
    "Billing Specialist",
    "Kore",
    "Hi {{patientName}}, I'm your billing specialist. I can help with your insurance, bills, and payment options.",
    `You are a medical billing specialist AI.
Patient context: Name: {{patientName}}.
Your role:
- Help patients understand their bills, EOBs (explanation of benefits), and insurance coverage.
- Explain copays, deductibles, and out-of-pocket costs.
- Assist with setting up payment plans.
- Verify insurance information.
- Escalate to a human billing agent if the case is complex or disputed.
Always be patient and non-judgmental — billing can be stressful.`,
    ["web_chat"],
  );

  // Team
  const teamId = await createTeam(orgId, "Clinic Triage Squad",
    "Medical clinic multi-agent team: triage intake → doctor consult → scheduling → billing",
    triageId,
  );

  // Members
  await addMember(teamId, triageId, "entry", "Patient triage and intake", 0);
  await addMember(teamId, doctorId, "specialist", "Medical consultation and clinical guidance", 1);
  await addMember(teamId, schedulerId, "specialist", "Appointment booking and scheduling", 2);
  await addMember(teamId, billingId, "specialist", "Billing, insurance, and payments", 3);

  // Handoff Rules (higher priority number = evaluated first)
  await addHandoffRule(teamId, triageId, doctorId, "keyword",
    [
      { type: "keyword", value: "chest pain", matchType: "contains" },
      { type: "keyword", value: "difficulty breathing", matchType: "contains" },
      { type: "keyword", value: "emergency", matchType: "contains" },
      { type: "keyword", value: "prescription", matchType: "contains" },
      { type: "keyword", value: "refill", matchType: "contains" },
      { type: "keyword", value: "follow up", matchType: "contains" },
      { type: "keyword", value: "specialist", matchType: "contains" },
      { type: "keyword", value: "doctor", matchType: "contains" },
      { type: "keyword", value: "symptoms", matchType: "contains" },
      { type: "keyword", value: "pain", matchType: "contains" },
    ],
    90,
    { includeSummary: true, includeHistory: false, variables: ["patientName", "chiefComplaint", "urgencyLevel"] },
    "Triage → Doctor (medical need)",
  );

  await addHandoffRule(teamId, triageId, schedulerId, "keyword",
    [
      { type: "keyword", value: "appointment", matchType: "contains" },
      { type: "keyword", value: "schedule", matchType: "contains" },
      { type: "keyword", value: "book", matchType: "contains" },
      { type: "keyword", value: "cancel", matchType: "contains" },
      { type: "keyword", value: "reschedule", matchType: "contains" },
    ],
    80,
    { includeSummary: true, includeHistory: false, variables: ["patientName", "chiefComplaint"] },
    "Triage → Scheduler (appointment)",
  );

  await addHandoffRule(teamId, triageId, billingId, "keyword",
    [
      { type: "keyword", value: "bill", matchType: "contains" },
      { type: "keyword", value: "insurance", matchType: "contains" },
      { type: "keyword", value: "payment", matchType: "contains" },
      { type: "keyword", value: "invoice", matchType: "contains" },
      { type: "keyword", value: "copay", matchType: "contains" },
    ],
    70,
    { includeSummary: true, includeHistory: false, variables: ["patientName"] },
    "Triage → Billing (payment question)",
  );

  await addHandoffRule(teamId, doctorId, schedulerId, "keyword",
    [
      { type: "keyword", value: "appointment", matchType: "contains" },
      { type: "keyword", value: "schedule", matchType: "contains" },
      { type: "keyword", value: "follow up", matchType: "contains" },
    ],
    80,
    { includeSummary: true, includeHistory: true, historyLimit: 10, variables: ["patientName", "chiefComplaint"] },
    "Doctor → Scheduler (follow-up booking)",
  );

  await addHandoffRule(teamId, schedulerId, billingId, "keyword",
    [
      { type: "keyword", value: "bill", matchType: "contains" },
      { type: "keyword", value: "insurance", matchType: "contains" },
      { type: "keyword", value: "cost", matchType: "contains" },
      { type: "keyword", value: "payment", matchType: "contains" },
    ],
    80,
    { includeSummary: true, includeHistory: false, variables: ["patientName"] },
    "Scheduler → Billing",
  );

  // Context variables
  await addContextVariables(teamId, [
    { name: "patientName", description: "Patient's full name", extractPrompt: "Extract the patient's full name from the conversation.", required: false },
    { name: "chiefComplaint", description: "Main reason for the visit", extractPrompt: "Extract the patient's main complaint or reason for visiting the clinic.", required: false },
    { name: "urgencyLevel", description: "Urgency: emergency | urgent | routine | wellness | scheduling", extractPrompt: "Classify urgency: emergency, urgent, routine, wellness, or scheduling based on the symptoms described.", required: false },
  ]);

  console.log(`  ✅ Clinic Triage Squad ready — Team ID: ${teamId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2 — E-commerce Support Squad
// ═══════════════════════════════════════════════════════════════════════════════

async function seedEcommerceSquad(orgId: string): Promise<void> {
  console.log("\n🛒 Scenario 2: E-commerce Support Squad");

  const orderBotId = await createAgent(orgId,
    "Order Support Bot",
    "Puck",
    "Hey there! Welcome to support. I'm your order assistant. What can I help you with today?",
    `You are a customer support entry agent for an e-commerce store. Your job:
1. Greet the customer warmly.
2. Collect their order number if they have one.
3. Identify their issue type:
   - Order status / tracking → handle directly (describe how to check their email for tracking info)
   - Return, refund, or exchange → transfer to Returns & Refunds Specialist
   - Website/app not working, account login issue → transfer to Technical Support
   - VIP or high-value customer (mentions account tier "gold", "platinum", or order value over $500) → transfer to VIP Concierge
   - General product question → handle directly
4. Always collect: customerName, orderNumber, issueType before transferring.
5. Be friendly, fast, and solution-focused.`,
    ["web_chat"],
  );

  const returnsId = await createAgent(orgId,
    "Returns & Refunds Specialist",
    "Zephyr",
    "Hi {{customerName}}! I'm your returns specialist. I see you have an issue with order {{orderNumber}}. Let me sort this out for you.",
    `You are a returns and refunds specialist. Customer context: Name: {{customerName}}, Order: {{orderNumber}}, Issue: {{issueType}}.
Your role:
- Verify the order is within the return window (typically 30 days from delivery).
- Confirm the reason for return (wrong item, damaged, changed mind, size issue, etc.).
- Explain the return process: generate return label, drop-off location, refund timeline.
- For exchanges: confirm the desired replacement item and size/color.
- Process refund to original payment method or store credit (customer's choice).
- For damaged items: ask for a photo description and escalate if needed.
- Always confirm final resolution and set clear expectations on timeline.`,
    ["web_chat"],
  );

  const techSupportId = await createAgent(orgId,
    "Technical Support",
    "Fenrir",
    "Hi {{customerName}}, I'm tech support. Let me help you resolve this quickly.",
    `You are a technical support agent for an e-commerce platform.
Customer context: Name: {{customerName}}, Issue: {{issueType}}.
Your role:
- Help with login and account access issues (password reset, 2FA, locked account).
- Troubleshoot checkout errors (payment failing, promo code not working, cart issues).
- Fix app/website display issues (broken pages, images not loading).
- Guide customers through common browser/cache fixes.
- Escalate to human tech team if the issue requires backend access.
Always provide step-by-step instructions. Confirm resolution before closing.`,
    ["web_chat"],
  );

  const vipId = await createAgent(orgId,
    "VIP Concierge",
    "Aoede",
    "Hello {{customerName}}, and welcome! I'm your dedicated VIP concierge. It's a pleasure to assist you personally today.",
    `You are a white-glove VIP concierge agent for high-value customers.
Customer context: Name: {{customerName}}, Order: {{orderNumber}}, Issue: {{issueType}}.
Your role:
- Provide premium, personalized service with no wait times.
- Proactively offer solutions before the customer has to ask.
- For returns/refunds: process immediately, waive restocking fees, offer complimentary shipping.
- Offer exclusive loyalty perks: discount on next order, free gift wrapping, priority delivery upgrade.
- For product questions: provide detailed expert recommendations.
- Always end with a proactive offer: "Is there anything else I can do for you today?"
Tone: warm, attentive, and genuinely appreciative.`,
    ["web_chat"],
  );

  const teamId = await createTeam(orgId, "E-commerce Support Squad",
    "Multi-agent e-commerce support: order bot → returns | tech support | VIP concierge",
    orderBotId,
  );

  await addMember(teamId, orderBotId, "entry", "Order intake and routing", 0);
  await addMember(teamId, returnsId, "specialist", "Returns, refunds, and exchanges", 1);
  await addMember(teamId, techSupportId, "specialist", "Technical and account issues", 2);
  await addMember(teamId, vipId, "specialist", "VIP and high-value customer service", 3);

  // VIP rule: highest priority — runs first across ALL agents for any VIP signal
  await addHandoffRule(teamId, null, vipId, "keyword",
    [
      { type: "keyword", value: "gold member", matchType: "contains" },
      { type: "keyword", value: "platinum", matchType: "contains" },
      { type: "keyword", value: "vip", matchType: "contains" },
    ],
    100,
    { includeSummary: true, includeHistory: false, variables: ["customerName", "orderNumber", "issueType"] },
    "Any → VIP (VIP customer detected)",
  );

  await addHandoffRule(teamId, orderBotId, returnsId, "keyword",
    [
      { type: "keyword", value: "return", matchType: "contains" },
      { type: "keyword", value: "refund", matchType: "contains" },
      { type: "keyword", value: "exchange", matchType: "contains" },
      { type: "keyword", value: "send back", matchType: "contains" },
      { type: "keyword", value: "wrong item", matchType: "contains" },
      { type: "keyword", value: "damaged", matchType: "contains" },
    ],
    80,
    { includeSummary: true, includeHistory: false, variables: ["customerName", "orderNumber", "issueType"] },
    "Order Bot → Returns (return/refund request)",
  );

  await addHandoffRule(teamId, orderBotId, techSupportId, "keyword",
    [
      { type: "keyword", value: "not working", matchType: "contains" },
      { type: "keyword", value: "login", matchType: "contains" },
      { type: "keyword", value: "password", matchType: "contains" },
      { type: "keyword", value: "can't access", matchType: "contains" },
      { type: "keyword", value: "error", matchType: "contains" },
      { type: "keyword", value: "broken", matchType: "contains" },
      { type: "keyword", value: "checkout", matchType: "contains" },
    ],
    70,
    { includeSummary: true, includeHistory: false, variables: ["customerName", "issueType"] },
    "Order Bot → Tech Support (technical issue)",
  );

  await addContextVariables(teamId, [
    { name: "customerName", description: "Customer's name", extractPrompt: "Extract the customer's name from the conversation.", required: false },
    { name: "orderNumber", description: "Order number or reference ID", extractPrompt: "Extract any order number, reference number, or order ID mentioned.", required: false },
    { name: "issueType", description: "Type of issue: return | refund | technical | order_status | product_question | vip", extractPrompt: "Classify the issue type based on the conversation.", required: false },
  ]);

  console.log(`  ✅ E-commerce Support Squad ready — Team ID: ${teamId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3 — Property Management Routing Squad
// ═══════════════════════════════════════════════════════════════════════════════

async function seedPropertySquad(orgId: string): Promise<void> {
  console.log("\n🏠 Scenario 3: Property Management Routing Squad");

  const routerId = await createAgent(orgId,
    "Property Router",
    "Charon",
    "Thanks for calling. How can I help you today?",
    `You are the routing agent for a property management company. Your only job is to:
1. Greet the caller.
2. Listen to their question or concern.
3. Classify it:
   - Maintenance, repairs, emergencies (leaks, broken heat/AC, electrical, structural) → transfer to Maintenance Specialist
   - Leasing, rent payment, applications, move-in/out, general inquiries → transfer to Leasing Specialist
4. Before transferring, collect: callerName, unitNumber, inquiryType.
5. If you cannot classify, ask a clarifying question.
Never try to resolve maintenance or leasing issues yourself. Your role is routing only.`,
    ["web_chat", "web_voice"],
  );

  const maintenanceId = await createAgent(orgId,
    "Maintenance Specialist",
    "Orus",
    "Hi {{callerName}}! I'm the maintenance specialist. I see you're calling about unit {{unitNumber}}. What's the issue?",
    `You are a maintenance specialist for a property management company.
Caller context: Name: {{callerName}}, Unit: {{unitNumber}}, Issue: {{inquiryType}}.
Your role:
- Get full details of the maintenance issue (what, when it started, severity).
- Classify urgency:
  - Emergency (flooding, no heat in winter, gas smell, electrical hazard) → dispatch immediately and advise caller on immediate safety steps.
  - Urgent (appliance failure, HVAC not working, pest issue) → schedule within 24–48 hours.
  - Routine (cosmetic repairs, minor fixture issues) → schedule within the week.
- Confirm a maintenance window with the tenant.
- Issue a ticket/work order reference number (use format WO-[current year]-[random 4 digit number]).
- For true emergencies, escalate to a human dispatcher immediately using the transfer_to_human tool.`,
    ["web_chat", "web_voice"],
  );

  const leasingId = await createAgent(orgId,
    "Leasing Specialist",
    "Leda",
    "Hi {{callerName}}! I'm your leasing specialist. Happy to help with anything related to your lease or rental. What can I do for you?",
    `You are a leasing specialist for a property management company.
Caller context: Name: {{callerName}}, Unit: {{unitNumber}}, Inquiry: {{inquiryType}}.
Your role:
- Rent questions: explain due dates, late fees, payment methods (online portal, check, ACH).
- Lease renewal: explain renewal terms, rent increases, renewal incentives.
- Move-out: explain move-out notice period, deposit return timeline, checklist.
- New applications: explain requirements (income verification, credit check, references), current available units.
- General policy questions: pets, guests, parking, storage.
Always confirm the caller's lease end date if relevant. Be professional and informative.`,
    ["web_chat"],
  );

  const teamId = await createTeam(orgId, "Property Management Squad",
    "Property management routing: Router classifies → Maintenance | Leasing specialist",
    routerId,
  );

  await addMember(teamId, routerId, "entry", "Intake routing and classification", 0);
  await addMember(teamId, maintenanceId, "specialist", "Repairs, maintenance, and emergencies", 1);
  await addMember(teamId, leasingId, "specialist", "Leasing, rent, and tenancy questions", 2);

  await addHandoffRule(teamId, routerId, maintenanceId, "keyword",
    [
      { type: "keyword", value: "maintenance", matchType: "contains" },
      { type: "keyword", value: "repair", matchType: "contains" },
      { type: "keyword", value: "broken", matchType: "contains" },
      { type: "keyword", value: "leak", matchType: "contains" },
      { type: "keyword", value: "flooding", matchType: "contains" },
      { type: "keyword", value: "heat", matchType: "contains" },
      { type: "keyword", value: "ac", matchType: "contains" },
      { type: "keyword", value: "air conditioning", matchType: "contains" },
      { type: "keyword", value: "electrical", matchType: "contains" },
      { type: "keyword", value: "plumbing", matchType: "contains" },
      { type: "keyword", value: "emergency", matchType: "contains" },
      { type: "keyword", value: "not working", matchType: "contains" },
      { type: "keyword", value: "pest", matchType: "contains" },
      { type: "keyword", value: "bug", matchType: "contains" },
    ],
    90,
    { includeSummary: true, includeHistory: false, variables: ["callerName", "unitNumber", "inquiryType"] },
    "Router → Maintenance (repair/emergency)",
  );

  await addHandoffRule(teamId, routerId, leasingId, "keyword",
    [
      { type: "keyword", value: "lease", matchType: "contains" },
      { type: "keyword", value: "rent", matchType: "contains" },
      { type: "keyword", value: "application", matchType: "contains" },
      { type: "keyword", value: "apply", matchType: "contains" },
      { type: "keyword", value: "move in", matchType: "contains" },
      { type: "keyword", value: "move out", matchType: "contains" },
      { type: "keyword", value: "deposit", matchType: "contains" },
      { type: "keyword", value: "available", matchType: "contains" },
      { type: "keyword", value: "vacancy", matchType: "contains" },
      { type: "keyword", value: "renewal", matchType: "contains" },
      { type: "keyword", value: "payment", matchType: "contains" },
      { type: "keyword", value: "general", matchType: "contains" },
      { type: "keyword", value: "question", matchType: "contains" },
    ],
    80,
    { includeSummary: true, includeHistory: false, variables: ["callerName", "unitNumber", "inquiryType"] },
    "Router → Leasing (leasing/rent inquiry)",
  );

  await addContextVariables(teamId, [
    { name: "callerName", description: "Tenant or caller's name", extractPrompt: "Extract the caller's name from the conversation.", required: false },
    { name: "unitNumber", description: "Unit or apartment number", extractPrompt: "Extract any unit number, apartment number, or property address mentioned.", required: false },
    { name: "inquiryType", description: "Type: maintenance | emergency | leasing | rent | application | general", extractPrompt: "Classify the inquiry type based on the issue described.", required: false },
  ]);

  console.log(`  ✅ Property Management Squad ready — Team ID: ${teamId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("🚀 Seeding demo squads for francalagbe@gmail.com...\n");

  // Resolve org ID
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, org_id")
    .eq("email", "francalagbe@gmail.com")
    .maybeSingle();

  if (userError || !userData?.org_id) {
    console.error("❌ Could not find user or org_id:", userError?.message ?? "No user found for francalagbe@gmail.com");
    process.exit(1);
  }

  const orgId = userData.org_id;
  console.log(`✓ Found org: ${orgId} for ${userData.email}`);

  // Run all 3 scenarios
  await seedClinicSquad(orgId);
  await seedEcommerceSquad(orgId);
  await seedPropertySquad(orgId);

  console.log("\n🎉 All 3 demo squads created successfully!");
  console.log("   Log into your dashboard and go to Agent Teams to see them.");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
