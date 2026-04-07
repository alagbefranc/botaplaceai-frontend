/**
 * Update Agents to Use Concise Responses
 * 
 * Run with: npx tsx scripts/update-agent-concise.ts
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
  console.log("🔧 Updating agents to use concise responses...\n");

  // Update Sales Agent
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

Example good response: "Oh no, that sounds frustrating! What's been going on with it?"
Example bad response: "I understand. To help you better, could you tell me: 1. What is the issue? 2. When did it start? 3. What have you tried?"`;

  const { error: salesError } = await supabase
    .from("agents")
    .update({
      system_prompt: salesPrompt,
    })
    .eq("name", "Sales Agent - Lead Qualifier");

  if (salesError) {
    console.error("❌ Failed to update Sales Agent:", salesError.message);
  } else {
    console.log("✅ Updated Sales Agent prompt");
  }

  // Update Support Agent
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

Example good response: "I'm sorry to hear that! Can you tell me what error you're seeing?"
Example bad response: "I apologize for the inconvenience. To assist you effectively, I'll need to gather some information. First, could you describe the exact nature of the problem?"`;

  const { error: supportError } = await supabase
    .from("agents")
    .update({
      system_prompt: supportPrompt,
    })
    .eq("name", "Support Agent - CSAT Focused");

  if (supportError) {
    console.error("❌ Failed to update Support Agent:", supportError.message);
  } else {
    console.log("✅ Updated Support Agent prompt");
  }

  // Now update settings using raw SQL or jsonb_set
  const { data: agents, error: fetchError } = await supabase
    .from("agents")
    .select("id, name, settings")
    .in("name", ["Sales Agent - Lead Qualifier", "Support Agent - CSAT Focused"]);

  if (fetchError) {
    console.error("❌ Failed to fetch agents:", fetchError.message);
    process.exit(1);
  }

  for (const agent of agents || []) {
    const settings = (agent.settings as Record<string, unknown>) || {};
    const behavior = (settings.behavior as Record<string, unknown>) || {};
    
    const updatedSettings = {
      ...settings,
      behavior: {
        ...behavior,
        responseLength: "concise",
      },
    };

    const { error: updateError } = await supabase
      .from("agents")
      .update({ settings: updatedSettings })
      .eq("id", agent.id);

    if (updateError) {
      console.error(`❌ Failed to update ${agent.name} settings:`, updateError.message);
    } else {
      console.log(`✅ Updated ${agent.name} to use concise responses`);
    }
  }

  console.log("\n✅ Done! Agents will now give shorter, more conversational responses.");
}

main().catch(console.error);
