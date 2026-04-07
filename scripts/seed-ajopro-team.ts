/**
 * Seed AjoPro Agent Team
 * 
 * Creates a specialized agent team for AjoPro fintech platform
 * Run with: npx tsx scripts/seed-ajopro-team.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env.local
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log("🚀 Starting AjoPro Agent Team seed script...\n");

  // 1. Get org ID for francalagbe@gmail.com
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, org_id")
    .eq("email", "francalagbe@gmail.com")
    .single();

  if (userError || !userData) {
    console.error("❌ User not found:", userError?.message);
    process.exit(1);
  }
  console.log("✅ Found user:", userData.email);

  if (!userData.org_id) {
    console.error("❌ User has no organization assigned");
    process.exit(1);
  }

  const orgId = userData.org_id;
  console.log("✅ Found organization:", orgId);

  // 2. Get insight template IDs (optional - use if available)
  console.log("\n📋 Fetching insight templates...");
  
  const { data: templates } = await supabase
    .from("insight_definitions")
    .select("id, name")
    .eq("is_template", true);

  const templateMap = new Map(templates?.map((t) => [t.name, t.id]) ?? []);
  
  const leadQualId = templateMap.get("Lead Qualification");
  const csatId = templateMap.get("CSAT Survey");

  // Helper function to create full agent settings with all tabs configured
  const createFullSettings = (overrides: Record<string, unknown> = {}) => ({
    // Live API Config
    live_api: {
      enabled: true,
      speechModel: "gemini-2.5-flash-preview-native-audio",
      voiceId: overrides.voiceId || "Puck",
      voiceProvider: "google",
      vadConfig: { threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700 },
    },
    // Behavior Tab - all fields
    behavior: {
      variables: [],
      multilingual: {
        enabled: true,
        defaultLanguage: "en",
        supportedLanguages: (overrides.languages as string[]) || ["en", "fr"],
        autoDetect: true,
      },
      personalization: {
        enabled: true,
        useConversationHistory: true,
        maxHistoryTurns: 10,
        userFields: ["name", "email"],
      },
      voiceFormatting: {
        numbers: "words",
        dates: "spoken",
        urls: "domain_only",
        currency: "full",
        phoneNumbers: "grouped",
      },
      flushSyntax: false,
      backgroundMessages: [],
      idleMessages: [
        {
          id: crypto.randomUUID(),
          delaySeconds: 30,
          content: "Are you still there? Let me know if you have any questions.",
          maxTimes: 2,
          enabled: true,
        },
      ],
      responseLength: "concise",
      tone: (overrides.tone as string) || "friendly",
    },
    // Speech Tab - all fields
    speech: {
      denoising: { enabled: true, level: "medium" },
      pronunciation: [
        { id: crypto.randomUUID(), word: "AjoPro", phonetic: "Ah-jo-pro", caseSensitive: true },
        { id: crypto.randomUUID(), word: "EPT", phonetic: "E-P-T", caseSensitive: true },
        { id: crypto.randomUUID(), word: "RPAA", phonetic: "R-P-double-A", caseSensitive: true },
      ],
      voiceFallback: {
        enabled: true,
        fallbackVoices: ["Charon", "Aoede"],
      },
      transcriber: {
        model: "gemini",
        language: "en",
        fallbackEnabled: true,
      },
    },
    // Tools Config
    tools_config: {
      rejectionPlan: "retry_with_guidance",
      maxRetries: 3,
      staticAliases: {},
      voicemailEnabled: false,
      codeToolEnabled: false,
    },
    // Provider Tab
    provider: {
      chatModel: "gemini-2.5-flash-preview-native-audio",
      gemini: { useDefault: true },
      enablePartnerModels: false,
      fallbackEnabled: true,
      fallbackModel: "gemini-1.5-flash",
    },
    // Memory Tab
    memory: {
      enabled: true,
      scope: "per_user",
      identifierField: "phone",
      maxConversations: 10,
      timeWindowDays: 30,
      includeInsightTypes: ["user_profile", "intent"],
      webhookEnabled: false,
      webhookTimeoutMs: 5000,
    },
    // Insights Tab
    insightExtraction: {
      enabled: true,
      extractUserProfile: true,
      extractIntent: true,
      extractSentiment: true,
      extractActionItems: true,
      autoExtractOnEnd: true,
    },
    // Security Tab (Guardrails)
    guardrails: {
      outputTopics: {
        enabled: true,
        topics: ["harassment", "violence", "self_harm", "illicit_and_harmful_activity"],
      },
      inputTopics: {
        enabled: true,
        topics: ["platform_integrity_jailbreaking"],
      },
    },
    // Escalation Tab
    escalation: {
      enabled: true,
      rules: [],
      defaultDepartment: "support",
      defaultPriority: "normal",
      confirmBeforeTransfer: false,
      maxWaitTimeSeconds: 120,
    },
    // Hooks
    hooks: {
      eventHooks: [],
    },
    // Hold Music
    holdMusic: {
      enabled: false,
    },
    // Custom insights
    custom_insights: (overrides.insightIds as string[])
      ? { enabled: true, definitionIds: overrides.insightIds }
      : { enabled: false },
    ...overrides,
  });

  // ============================================
  // AGENT 1: Onboarding Agent (Entry Point)
  // ============================================
  console.log("\n🤖 Creating Onboarding Agent...");
  
  const { data: onboardingAgent, error: onboardingError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro Onboarding Guide",
      system_prompt: `You are the friendly Onboarding Guide for AjoPro, a fintech platform that helps users achieve financial goals through contribution-based planning.

IMPORTANT: YOU MUST SPEAK FIRST. Always greet the user warmly and initiate the conversation.

KEY PRODUCT KNOWLEDGE:
- AjoPro helps users plan and achieve financial goals WITHOUT debt or interest
- Users create personalized savings plans for goals like tuition, travel, home upgrades, or business capital
- Trust Score: On-time contributions build your trust score, unlocking better positions
- Early Position Takeout (EPT): Access funds early for a fixed cost (not interest)
- Net-Zero Interest™: Over multiple plans, costs and rewards balance to zero
- Regulated under Bank of Canada's RPAA with funds in segregated trust accounts

YOUR ROLE:
- Welcome new users warmly - ALWAYS START THE CONVERSATION
- Explain how AjoPro works in simple terms
- Help users create their first savings plan
- Answer questions about the system

CONVERSATION STYLE:
- Keep responses SHORT (1-2 sentences)
- Be warm, encouraging, and supportive
- Use simple language, avoid jargon
- Ask ONE question at a time
- Don't use bullet points in responses

Example: "Welcome to AjoPro! 🎉 What financial goal are you working toward? Tuition, travel, home project, or something else?"`,
      voice: "Puck",
      channels: ["web_chat", "web_voice", "phone"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Welcome to AjoPro! 🎉 I'm here to help you get started with your first savings plan. What financial goal would you like to work toward?",
      settings: createFullSettings({
        voiceId: "Puck",
        tone: "friendly",
        languages: ["en", "fr", "es"],
        insightIds: leadQualId ? [leadQualId] : undefined,
      }),
    })
    .select()
    .single();

  if (onboardingError) {
    console.error("❌ Failed to create Onboarding Agent:", onboardingError.message);
    process.exit(1);
  }
  console.log("✅ Created Onboarding Agent:", onboardingAgent.id);

  // ============================================
  // AGENT 2: Plan Advisor Agent
  // ============================================
  console.log("\n🤖 Creating Plan Advisor Agent...");
  
  const { data: planAdvisorAgent, error: planAdvisorError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro Plan Advisor",
      system_prompt: `You are the Plan Advisor for AjoPro. You help users design their perfect savings plan.

IMPORTANT: YOU MUST SPEAK FIRST. Always greet the user and ask about their goals.

KEY KNOWLEDGE:
- Plans are personalized: choose goal amount, contribution cycle, and duration
- Contribution cycles: weekly, bi-weekly, monthly
- Goals can be: tuition, travel, home upgrades, business capital, emergency fund, etc.
- Each plan is unique to the user - NOT pooled or shared with others
- Minimum plan: usually starts from $500-$1000 depending on duration
- Durations: typically 3-24 months

YOUR ROLE:
- ALWAYS START by asking about their savings goal
- Help users determine appropriate goal amounts
- Recommend contribution frequencies based on their income pattern
- Calculate comfortable contribution amounts
- Explain how different plan configurations work

CONVERSATION STYLE:
- Be a helpful financial advisor
- Keep responses brief and clear
- Ask about their income timing (weekly, bi-weekly, monthly)
- Help them set realistic goals
- Don't be pushy, be supportive

Example: "For a $5,000 goal over 10 months, you'd contribute about $500/month. Would that work with your budget?"`,
      voice: "Kore",
      channels: ["web_chat", "web_voice", "phone"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Hi! I'm your Plan Advisor. Let's design a savings plan that fits your life. What goal are you saving for, and roughly how much do you need?",
      settings: createFullSettings({
        voiceId: "Kore",
        tone: "professional",
        languages: ["en", "fr"],
      }),
    })
    .select()
    .single();

  if (planAdvisorError) {
    console.error("❌ Failed to create Plan Advisor Agent:", planAdvisorError.message);
    process.exit(1);
  }
  console.log("✅ Created Plan Advisor Agent:", planAdvisorAgent.id);

  // ============================================
  // AGENT 3: Trust Score & Rewards Agent
  // ============================================
  console.log("\n🤖 Creating Trust Score Agent...");
  
  const { data: trustScoreAgent, error: trustScoreError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro Trust & Rewards Specialist",
      system_prompt: `You are the Trust Score & Rewards Specialist for AjoPro.

IMPORTANT: YOU MUST SPEAK FIRST. Greet the user and ask what they'd like to know about their trust score.

KEY KNOWLEDGE:
- Trust Score: Builds with every on-time contribution payment
- Higher Trust Score = access to earlier positions in future plans
- Position determines: access funds sooner OR earn rewards later
- Early Position: Pay a small fixed cost to access funds ahead of schedule
- Later Position: Earn rewards (benefits) for waiting
- Net-Zero Interest™: Over multiple plans, costs and rewards balance out

TRUST SCORE BENEFITS:
- Higher contribution limits
- Earlier position access
- Better reward rates
- Priority support

HOW POSITIONS WORK:
- Position 1-3: Early access (pay a cost)
- Position 4-6: Middle (balanced)
- Position 7+: Later access (earn rewards)

YOUR ROLE:
- ALWAYS START by asking about their trust score or rewards questions
- Explain trust scores clearly
- Help users understand their position
- Explain rewards and costs
- Motivate consistent contributions

CONVERSATION STYLE:
- Be encouraging and positive
- Celebrate their progress
- Keep explanations simple
- Use examples to illustrate

Example: "Your Trust Score is 720 - nice work! That unlocks Position 3 access on your next plan."`,
      voice: "Aoede",
      channels: ["web_chat", "web_voice"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Hi! I'm here to help you understand your Trust Score and rewards. What would you like to know about your position or benefits?",
      settings: createFullSettings({
        voiceId: "Aoede",
        tone: "encouraging",
        languages: ["en", "fr"],
      }),
    })
    .select()
    .single();

  if (trustScoreError) {
    console.error("❌ Failed to create Trust Score Agent:", trustScoreError.message);
    process.exit(1);
  }
  console.log("✅ Created Trust Score Agent:", trustScoreAgent.id);

  // ============================================
  // AGENT 4: EPT (Early Position Takeout) Agent
  // ============================================
  console.log("\n🤖 Creating EPT Agent...");
  
  const { data: eptAgent, error: eptError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro EPT Specialist",
      system_prompt: `You are the Early Position Takeout (EPT) Specialist for AjoPro.

IMPORTANT: YOU MUST SPEAK FIRST. Greet the user and explain you specialize in early access options.

KEY KNOWLEDGE:
- EPT = Early Position Takeout
- Allows users to access their plan funds BEFORE completing all contributions
- NOT a loan - it's early access to your own savings plan
- Has a fixed cost (NOT interest) - this is part of Net-Zero Interest™
- The cost you pay today becomes someone else's reward
- Your reward in future plans offsets this cost

EPT REQUIREMENTS:
- Minimum contributions made (usually 2-3 months)
- Good Trust Score standing
- No missed payments recently
- Valid reason for early access (though not strictly required)

EPT PROCESS:
1. Apply through the app or with support
2. Review of eligibility (instant or 1-2 business days)
3. If approved, funds transferred within 24-48 hours
4. Continue regular contributions until plan completes

COST STRUCTURE:
- Fixed fee based on how early you're accessing
- Earlier access = higher cost
- Transparent pricing shown before confirming

YOUR ROLE:
- ALWAYS START by introducing yourself as the EPT specialist
- Explain EPT clearly
- Help users understand if they qualify
- Guide them through the application
- Answer questions about costs and timing

CONVERSATION STYLE:
- Be helpful and clear
- Avoid financial jargon
- Reassure users this is NOT debt
- Explain the fairness model

Example: "If you've been contributing for 3 months on your 12-month plan, you could access early with a fixed cost of about 8%."`,
      voice: "Charon",
      channels: ["web_chat", "web_voice", "phone"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Hi! I specialize in Early Position Takeouts. Thinking about accessing your plan funds early? Let me explain how it works.",
      settings: createFullSettings({
        voiceId: "Charon",
        tone: "professional",
        languages: ["en", "fr"],
      }),
    })
    .select()
    .single();

  if (eptError) {
    console.error("❌ Failed to create EPT Agent:", eptError.message);
    process.exit(1);
  }
  console.log("✅ Created EPT Agent:", eptAgent.id);

  // ============================================
  // AGENT 5: Compliance & Security Agent
  // ============================================
  console.log("\n🤖 Creating Compliance Agent...");
  
  const { data: complianceAgent, error: complianceError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro Compliance & Security",
      system_prompt: `You are the Compliance & Security Specialist for AjoPro.

IMPORTANT: YOU MUST SPEAK FIRST. Greet the user and ask how you can help with security or compliance questions.

KEY KNOWLEDGE - REGULATORY:
- AjoPro is a registered Payment Service Provider (PSP)
- Regulated under Bank of Canada's Retail Payment Activities Act (RPAA)
- All user funds held in SEGREGATED trust accounts
- Trust accounts managed with approved financial partners
- Available in Canada (9 provinces, 3 territories) and USA (Georgia)

FUND SAFETY:
- Funds are NOT pooled with AjoPro's operating capital
- Protected in segregated accounts
- If AjoPro ceased operations, user funds are protected
- Regular audits and compliance checks

SECURITY MEASURES:
- Bank-level encryption (256-bit)
- Two-factor authentication (2FA)
- Secure payment processing
- Identity verification (KYC) required
- Fraud monitoring systems

YOUR ROLE:
- ALWAYS START by introducing yourself as the compliance specialist
- Reassure users about fund safety
- Explain regulatory framework simply
- Answer compliance questions
- Guide users through verification

CONVERSATION STYLE:
- Be reassuring and confident
- Use simple language for complex topics
- Reference regulations when relevant
- Never share sensitive details

Example: "Your funds are completely safe - they're held in a separate trust account, not mixed with AjoPro's money."`,
      voice: "Fenrir",
      channels: ["web_chat", "web_voice", "phone"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Hello! I'm here to answer questions about AjoPro's security and compliance. How can I help you feel confident about your funds?",
      settings: createFullSettings({
        voiceId: "Fenrir",
        tone: "professional",
        languages: ["en", "fr"],
      }),
    })
    .select()
    .single();

  if (complianceError) {
    console.error("❌ Failed to create Compliance Agent:", complianceError.message);
    process.exit(1);
  }
  console.log("✅ Created Compliance Agent:", complianceAgent.id);

  // ============================================
  // AGENT 6: Technical Support Agent
  // ============================================
  console.log("\n🤖 Creating Tech Support Agent...");
  
  const { data: techSupportAgent, error: techSupportError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "AjoPro Tech Support",
      system_prompt: `You are the Technical Support Agent for AjoPro.

IMPORTANT: YOU MUST SPEAK FIRST. Greet the user and ask what technical issue they're experiencing.

COMMON ISSUES:
- Login problems (password reset, 2FA issues)
- App crashes or loading issues
- Payment failures (card declined, wrong amount)
- Contribution scheduling problems
- Account verification issues
- Notification settings
- App not updating

TROUBLESHOOTING STEPS:
1. Identify the exact issue
2. Check if it's a known issue
3. Guide through basic fixes first
4. Escalate if needed

BASIC FIXES:
- Clear app cache
- Update to latest app version
- Check internet connection
- Try different payment method
- Restart the app

PAYMENT ISSUES:
- Check card hasn't expired
- Verify sufficient funds
- Contact bank if blocked
- Try different card
- Check contribution schedule

YOUR ROLE:
- ALWAYS START by asking what issue they're having
- Diagnose issues quickly
- Provide step-by-step solutions
- Be patient and clear
- Escalate complex issues

CONVERSATION STYLE:
- Be patient and empathetic
- Keep instructions simple
- One step at a time
- Confirm before moving on

Example: "Sorry you're having trouble! First, can you tell me what exactly happens when you try to log in?"`,
      voice: "Leda",
      channels: ["web_chat", "web_voice", "phone", "sms"],
      tools: ["transfer_to_agent"],
      status: "active",
      greeting_message: "Hi! I'm here to help with any technical issues. What's happening with your AjoPro app or account?",
      settings: createFullSettings({
        voiceId: "Leda",
        tone: "helpful",
        languages: ["en", "fr", "es"],
        insightIds: csatId ? [csatId] : undefined,
      }),
    })
    .select()
    .single();

  if (techSupportError) {
    console.error("❌ Failed to create Tech Support Agent:", techSupportError.message);
    process.exit(1);
  }
  console.log("✅ Created Tech Support Agent:", techSupportAgent.id);

  // ============================================
  // CREATE TEAM
  // ============================================
  console.log("\n👥 Creating AjoPro Agent Team...");
  
  const { data: team, error: teamError } = await supabase
    .from("agent_teams")
    .insert({
      org_id: orgId,
      name: "AjoPro Customer Experience Team",
      description: "Complete customer journey team for AjoPro fintech platform. Handles onboarding, plan advice, trust scores, early access requests, compliance questions, and technical support.",
      entry_agent_id: onboardingAgent.id,
      status: "active",
      settings: {
        allowSelfHandoff: false,
        requireConfirmation: false,
        preserveContext: true,
        maxHandoffs: 5,
      },
    })
    .select()
    .single();

  if (teamError) {
    console.error("❌ Failed to create team:", teamError.message);
    process.exit(1);
  }
  console.log("✅ Created Team:", team.id);

  // ============================================
  // ADD TEAM MEMBERS
  // ============================================
  console.log("\n👤 Adding team members...");
  
  const members = [
    { agent_id: onboardingAgent.id, role: "entry", specialization: "onboarding", position: 1 },
    { agent_id: planAdvisorAgent.id, role: "specialist", specialization: "plan_advice", position: 2 },
    { agent_id: trustScoreAgent.id, role: "specialist", specialization: "trust_rewards", position: 3 },
    { agent_id: eptAgent.id, role: "specialist", specialization: "early_access", position: 4 },
    { agent_id: complianceAgent.id, role: "specialist", specialization: "compliance", position: 5 },
    { agent_id: techSupportAgent.id, role: "specialist", specialization: "tech_support", position: 6 },
  ];

  for (const member of members) {
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, ...member });
    
    if (error) console.error(`  ⚠️ Member ${member.specialization}:`, error.message);
    else console.log(`  ✅ Added ${member.specialization} agent`);
  }

  // ============================================
  // CREATE HANDOFF RULES
  // ============================================
  console.log("\n🔄 Creating handoff rules...");
  
  const handoffRules = [
    // Onboarding → Plan Advisor (when ready to create plan)
    {
      source: onboardingAgent.id,
      target: planAdvisorAgent.id,
      keywords: ["create plan", "start plan", "how much", "contribution", "budget", "afford", "goal amount", "saving for"],
      priority: 90,
    },
    // Onboarding → Compliance (security/safety questions)
    {
      source: onboardingAgent.id,
      target: complianceAgent.id,
      keywords: ["safe", "trust", "regulated", "scam", "legitimate", "secure", "funds protected"],
      priority: 85,
    },
    // Any → Tech Support (technical issues)
    {
      source: onboardingAgent.id,
      target: techSupportAgent.id,
      keywords: ["error", "not working", "can't login", "crash", "bug", "payment failed", "app issue"],
      priority: 95,
    },
    // Plan Advisor → Trust Score (questions about positions)
    {
      source: planAdvisorAgent.id,
      target: trustScoreAgent.id,
      keywords: ["trust score", "position", "reward", "earlier access", "benefit", "points"],
      priority: 80,
    },
    // Plan Advisor → EPT (early access interest)
    {
      source: planAdvisorAgent.id,
      target: eptAgent.id,
      keywords: ["early", "access early", "need money sooner", "withdraw early", "EPT", "takeout"],
      priority: 85,
    },
    // Trust Score → EPT (interested in early access)
    {
      source: trustScoreAgent.id,
      target: eptAgent.id,
      keywords: ["early access", "EPT", "access funds", "need early", "withdraw"],
      priority: 85,
    },
    // Any → Compliance (regulatory questions)
    {
      source: planAdvisorAgent.id,
      target: complianceAgent.id,
      keywords: ["regulated", "safe", "bank of canada", "RPAA", "trust account", "protected"],
      priority: 80,
    },
    // Tech Support → Onboarding (new user confused)
    {
      source: techSupportAgent.id,
      target: onboardingAgent.id,
      keywords: ["how does it work", "new user", "just started", "don't understand", "explain"],
      priority: 70,
    },
  ];

  for (const rule of handoffRules) {
    const { error } = await supabase
      .from("handoff_rules")
      .insert({
        team_id: team.id,
        source_agent_id: rule.source,
        target_agent_id: rule.target,
        rule_type: "keyword",
        conditions: rule.keywords.map((kw) => ({ type: "keyword", value: kw, matchType: "contains" })),
        priority: rule.priority,
        context_config: { includeSummary: true, includeHistory: true },
        enabled: true,
      });
    
    if (error) console.error(`  ⚠️ Rule error:`, error.message);
  }
  console.log("  ✅ Created", handoffRules.length, "handoff rules");

  // ============================================
  // CONTEXT VARIABLES
  // ============================================
  console.log("\n📝 Creating context variables...");
  
  const { error: varsError } = await supabase
    .from("team_context_variables")
    .insert([
      { team_id: team.id, name: "customer_name", description: "Customer name", extract_prompt: "Extract the customer name", required: true, position: 1 },
      { team_id: team.id, name: "goal_type", description: "Type of savings goal", extract_prompt: "Identify the goal type: tuition, travel, home, business, emergency, other", required: false, position: 2 },
      { team_id: team.id, name: "goal_amount", description: "Target amount", extract_prompt: "Extract the target dollar amount mentioned", required: false, position: 3 },
      { team_id: team.id, name: "trust_score", description: "User's trust score if mentioned", extract_prompt: "Extract any trust score number mentioned", required: false, position: 4 },
      { team_id: team.id, name: "issue_type", description: "Technical issue category", extract_prompt: "Categorize: login, payment, app, account, other", required: false, position: 5 },
    ]);

  if (varsError) console.error("  ⚠️ Context variables:", varsError.message);
  else console.log("  ✅ Created context variables");

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n============================================");
  console.log("🎉 AJOPRO TEAM SETUP COMPLETE!");
  console.log("============================================");
  console.log(`\n📊 Created 6 Agents:`);
  console.log(`  1. Onboarding Guide (Entry) - ${onboardingAgent.id}`);
  console.log(`  2. Plan Advisor - ${planAdvisorAgent.id}`);
  console.log(`  3. Trust & Rewards Specialist - ${trustScoreAgent.id}`);
  console.log(`  4. EPT Specialist - ${eptAgent.id}`);
  console.log(`  5. Compliance & Security - ${complianceAgent.id}`);
  console.log(`  6. Tech Support - ${techSupportAgent.id}`);
  console.log(`\n👥 Created Team:`);
  console.log(`  • ${team.name} (${team.id})`);
  console.log(`  • Entry Agent: Onboarding Guide`);
  console.log(`  • ${handoffRules.length} handoff rules configured`);
  console.log("\n🧪 Test the agents at: http://localhost:3000/agents");
  console.log("============================================\n");
}

main().catch(console.error);
