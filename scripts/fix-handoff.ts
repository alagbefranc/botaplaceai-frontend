/**
 * Fix Handoff Setup - Add transfer_to_agent tool to team agents
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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
  console.log("🔧 Adding transfer_to_agent tool to team agents...\n");

  // Get agents
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, tools")
    .in("name", ["Sales Agent - Lead Qualifier", "Support Agent - CSAT Focused"]);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  for (const agent of agents || []) {
    const currentTools = (agent.tools as string[]) || [];
    
    if (!currentTools.includes("transfer_to_agent")) {
      const newTools = [...currentTools, "transfer_to_agent"];
      
      const { error: updateError } = await supabase
        .from("agents")
        .update({ tools: newTools })
        .eq("id", agent.id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${agent.name}:`, updateError.message);
      } else {
        console.log(`✅ Added transfer_to_agent to ${agent.name}`);
        console.log(`   Tools: ${JSON.stringify(newTools)}`);
      }
    } else {
      console.log(`✓ ${agent.name} already has transfer_to_agent`);
    }
  }

  // Also update system prompts to include handoff instructions
  const salesPrompt = `You are a friendly Sales Agent. Your job is to qualify leads naturally through conversation.

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

HANDOFF: If the customer mentions technical issues, problems, bugs, or needs support help, use the transfer_to_agent tool to hand off to "Support Agent - CSAT Focused".

Example: "Oh no, that sounds frustrating! What's been going on with it?"`;

  const supportPrompt = `You are a friendly Support Agent. Help customers resolve issues quickly.

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

HANDOFF: If the customer wants to purchase, upgrade, or asks about pricing, use the transfer_to_agent tool to hand off to "Sales Agent - Lead Qualifier".

Example: "I'm sorry to hear that! Can you tell me what error you're seeing?"`;

  // Update Sales Agent prompt
  const { error: salesErr } = await supabase
    .from("agents")
    .update({ system_prompt: salesPrompt })
    .eq("name", "Sales Agent - Lead Qualifier");

  if (salesErr) {
    console.error("❌ Failed to update Sales Agent prompt:", salesErr.message);
  } else {
    console.log("✅ Updated Sales Agent system prompt with handoff instructions");
  }

  // Update Support Agent prompt
  const { error: supportErr } = await supabase
    .from("agents")
    .update({ system_prompt: supportPrompt })
    .eq("name", "Support Agent - CSAT Focused");

  if (supportErr) {
    console.error("❌ Failed to update Support Agent prompt:", supportErr.message);
  } else {
    console.log("✅ Updated Support Agent system prompt with handoff instructions");
  }

  console.log("\n✅ Done! Handoffs should now work.");
  console.log("\n📝 How to test:");
  console.log("   1. Chat with Sales Agent");
  console.log("   2. Say 'I have a problem with my account'");
  console.log("   3. The agent should transfer you to Support Agent");
}

main().catch(console.error);
