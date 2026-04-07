/**
 * Seed Test Agents with Industry Insights and Team
 * 
 * Run with: npx tsx scripts/seed-test-agents.ts
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
  console.log("🚀 Starting agent seed script...\n");

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

  // 2. Get insight template IDs
  console.log("\n📋 Fetching insight templates...");
  
  const { data: templates, error: templateError } = await supabase
    .from("insight_definitions")
    .select("id, name")
    .eq("is_template", true);

  if (templateError) {
    console.error("❌ Failed to fetch templates:", templateError.message);
    process.exit(1);
  }

  const templateMap = new Map(templates?.map((t) => [t.name, t.id]) ?? []);
  
  const leadQualId = templateMap.get("Lead Qualification");
  const objectionId = templateMap.get("Objection Handling");
  const csatId = templateMap.get("CSAT Survey");
  const ticketId = templateMap.get("Ticket Classification");

  console.log("  Lead Qualification:", leadQualId || "NOT FOUND");
  console.log("  Objection Handling:", objectionId || "NOT FOUND");
  console.log("  CSAT Survey:", csatId || "NOT FOUND");
  console.log("  Ticket Classification:", ticketId || "NOT FOUND");

  if (!leadQualId || !objectionId || !csatId || !ticketId) {
    console.error("\n❌ Missing insight templates. Please run: supabase db reset or seed the templates first.");
    process.exit(1);
  }

  // 3. Create Sales Agent
  console.log("\n🤖 Creating Sales Agent...");
  
  const { data: salesAgent, error: salesError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "Sales Agent - Lead Qualifier",
      system_prompt: `You are a friendly Sales Agent. Your job is to qualify leads naturally through conversation.

IMPORTANT RULES:
- Keep responses SHORT (1-2 sentences max)
- Ask ONE question at a time
- Sound natural and conversational, not scripted
- Don't use bullet points or numbered lists
- Don't be overly formal

When qualifying leads, naturally discover:
- Their budget range
- If they're a decision maker
- Their main pain point
- Purchase timeline

Example good response: "Oh no, that sounds frustrating! What's been going on with it?"
Example bad response: "I understand. To help you better, could you tell me: 1. What is the issue? 2. When did it start? 3. What have you tried?"`,
      voice: "Puck",
      channels: ["web_chat", "web_voice", "phone"],
      tools: ["googlecalendar", "gmail", "transfer_to_agent"],
      status: "active",
      greeting_message: "Hello! I'm here to learn about your needs and see how we might help. What challenges are you currently facing?",
      settings: {
        behavior: {
          responseLength: "concise",
          tone: "friendly",
          multilingual: {
            enabled: true,
            autoDetect: true,
            defaultLanguage: "en",
            supportedLanguages: ["en", "fr", "es"],
          },
        },
        speech: {
          speechModel: "gemini-2.5-flash-preview-native-audio",
          voiceId: "Puck",
          voiceProvider: "google",
          vadConfig: { threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700 },
        },
        custom_insights: {
          enabled: true,
          definitionIds: [leadQualId, objectionId],
        },
        guardrails: {
          outputTopics: {
            enabled: true,
            topics: ["harassment", "violence", "illicit_and_harmful_activity"],
          },
          inputTopics: {
            enabled: true,
            topics: ["platform_integrity_jailbreaking"],
          },
        },
      },
    })
    .select()
    .single();

  if (salesError) {
    console.error("❌ Failed to create Sales Agent:", salesError.message);
    process.exit(1);
  }
  console.log("✅ Created Sales Agent:", salesAgent.id);

  // 4. Create Support Agent
  console.log("\n🤖 Creating Support Agent...");
  
  const { data: supportAgent, error: supportError } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: "Support Agent - CSAT Focused",
      system_prompt: `You are a friendly Support Agent. Help customers resolve issues quickly.

IMPORTANT RULES:
- Keep responses SHORT (1-2 sentences max)  
- Ask ONE clarifying question at a time
- Be empathetic but brief
- Don't use bullet points or numbered lists
- Get to the point quickly

For issue resolution:
- Understand the problem first
- Offer a solution or next step
- Confirm it's resolved before ending

Example good response: "I'm sorry to hear that! Can you tell me what error you're seeing?"
Example bad response: "I apologize for the inconvenience. To assist you effectively, I'll need to gather some information. First, could you describe the exact nature of the problem?"`,
      voice: "Charon",
      channels: ["web_chat", "web_voice", "sms"],
      tools: ["gmail", "slack", "transfer_to_agent"],
      status: "active",
      greeting_message: "Hi there! I'm here to help resolve any issues you're experiencing. How can I assist you today?",
      settings: {
        behavior: {
          responseLength: "concise",
          tone: "friendly",
          multilingual: {
            enabled: true,
            autoDetect: true,
            defaultLanguage: "en",
            supportedLanguages: ["en", "fr", "es", "de"],
          },
        },
        speech: {
          speechModel: "gemini-2.5-flash-preview-native-audio",
          voiceId: "Charon",
          voiceProvider: "google",
          vadConfig: { threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 700 },
        },
        custom_insights: {
          enabled: true,
          definitionIds: [csatId, ticketId],
        },
        guardrails: {
          outputTopics: {
            enabled: true,
            topics: ["harassment", "self_harm", "violence"],
          },
          inputTopics: {
            enabled: true,
            topics: ["platform_integrity_jailbreaking"],
          },
        },
      },
    })
    .select()
    .single();

  if (supportError) {
    console.error("❌ Failed to create Support Agent:", supportError.message);
    process.exit(1);
  }
  console.log("✅ Created Support Agent:", supportAgent.id);

  // 5. Create Team
  console.log("\n👥 Creating Agent Team...");
  
  const { data: team, error: teamError } = await supabase
    .from("agent_teams")
    .insert({
      org_id: orgId,
      name: "Omnichannel Sales & Support Team",
      description: "A multi-agent team handling both sales inquiries and customer support. Sales Agent qualifies leads while Support Agent handles post-sale issues.",
      entry_agent_id: salesAgent.id,
      status: "active",
      settings: {
        allowSelfHandoff: false,
        requireConfirmation: false,
        preserveContext: true,
        maxHandoffs: 3,
      },
    })
    .select()
    .single();

  if (teamError) {
    console.error("❌ Failed to create team:", teamError.message);
    process.exit(1);
  }
  console.log("✅ Created Team:", team.id);

  // 6. Add Team Members
  console.log("\n👤 Adding team members...");
  
  const { error: member1Error } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, agent_id: salesAgent.id, role: "entry", specialization: "sales", position: 1 });

  if (member1Error) console.error("  ⚠️ Sales agent member:", member1Error.message);
  else console.log("  ✅ Added Sales Agent as entry");

  const { error: member2Error } = await supabase
    .from("team_members")
    .insert({ team_id: team.id, agent_id: supportAgent.id, role: "specialist", specialization: "support", position: 2 });

  if (member2Error) console.error("  ⚠️ Support agent member:", member2Error.message);
  else console.log("  ✅ Added Support Agent as specialist");

  // 7. Create Handoff Rules
  console.log("\n🔄 Creating handoff rules...");
  
  // Sales → Support rule
  const { error: rule1Error } = await supabase
    .from("handoff_rules")
    .insert({
      team_id: team.id,
      source_agent_id: salesAgent.id,
      target_agent_id: supportAgent.id,
      rule_type: "keyword",
      conditions: [
        { type: "keyword", value: "support", matchType: "contains" },
        { type: "keyword", value: "issue", matchType: "contains" },
        { type: "keyword", value: "problem", matchType: "contains" },
        { type: "keyword", value: "help", matchType: "contains" },
        { type: "keyword", value: "broken", matchType: "contains" },
        { type: "keyword", value: "not working", matchType: "contains" },
      ],
      priority: 80,
      context_config: { includeSummary: true, includeHistory: true, variables: ["customer_name", "issue_type"] },
      enabled: true,
    });

  if (rule1Error) console.error("  ⚠️ Sales→Support rule:", rule1Error.message);
  else console.log("  ✅ Created Sales → Support handoff rule");

  // Support → Sales rule
  const { error: rule2Error } = await supabase
    .from("handoff_rules")
    .insert({
      team_id: team.id,
      source_agent_id: supportAgent.id,
      target_agent_id: salesAgent.id,
      rule_type: "keyword",
      conditions: [
        { type: "keyword", value: "upgrade", matchType: "contains" },
        { type: "keyword", value: "pricing", matchType: "contains" },
        { type: "keyword", value: "purchase", matchType: "contains" },
        { type: "keyword", value: "buy", matchType: "contains" },
        { type: "keyword", value: "interested in", matchType: "contains" },
      ],
      priority: 70,
      context_config: { includeSummary: true, includeHistory: true, variables: ["customer_name", "product_interest"] },
      enabled: true,
    });

  if (rule2Error) console.error("  ⚠️ Support→Sales rule:", rule2Error.message);
  else console.log("  ✅ Created Support → Sales handoff rule");

  // 8. Create Context Variables
  console.log("\n📝 Creating context variables...");
  
  const { error: varsError } = await supabase
    .from("team_context_variables")
    .insert([
      { team_id: team.id, name: "customer_name", description: "Customer name for personalization", extract_prompt: "Extract the customer name from the conversation", required: true, position: 1 },
      { team_id: team.id, name: "issue_type", description: "Type of issue or inquiry", extract_prompt: "Identify the main issue category (billing, technical, account, general)", required: false, position: 2 },
      { team_id: team.id, name: "product_interest", description: "Products the customer is interested in", extract_prompt: "List products or features the customer mentioned interest in", required: false, position: 3 },
    ]);

  if (varsError) console.error("  ⚠️ Context variables:", varsError.message);
  else console.log("  ✅ Created context variables");

  // Summary
  console.log("\n============================================");
  console.log("🎉 SETUP COMPLETE!");
  console.log("============================================");
  console.log(`\n📊 Created Agents:`);
  console.log(`  • Sales Agent: ${salesAgent.id}`);
  console.log(`    - Insights: Lead Qualification, Objection Handling`);
  console.log(`    - Channels: Web Chat, Voice, Phone`);
  console.log(`  • Support Agent: ${supportAgent.id}`);
  console.log(`    - Insights: CSAT Survey, Ticket Classification`);
  console.log(`    - Channels: Web Chat, Voice, SMS`);
  console.log(`\n👥 Created Team:`);
  console.log(`  • ${team.name} (${team.id})`);
  console.log(`  • Entry Agent: Sales Agent`);
  console.log(`  • Bidirectional handoff rules configured`);
  console.log("\n🧪 Test the agents at: http://localhost:3000/agents");
  console.log("============================================\n");
}

main().catch(console.error);
