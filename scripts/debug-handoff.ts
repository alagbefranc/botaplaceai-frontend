/**
 * Debug Handoff Setup
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
  console.log("🔍 Checking handoff setup...\n");

  // 1. Check agents
  const { data: agents, error: agentError } = await supabase
    .from("agents")
    .select("id, name, tools, status")
    .in("name", ["Sales Agent - Lead Qualifier", "Support Agent - CSAT Focused"]);

  if (agentError) {
    console.error("❌ Error fetching agents:", agentError.message);
    return;
  }

  console.log("📋 AGENTS:");
  for (const agent of agents || []) {
    console.log(`  • ${agent.name} (${agent.id})`);
    console.log(`    Status: ${agent.status}`);
    console.log(`    Tools: ${JSON.stringify(agent.tools)}`);
    console.log();
  }

  // 2. Check team
  const { data: teams, error: teamError } = await supabase
    .from("agent_teams")
    .select("id, name, status, entry_agent_id");

  if (teamError) {
    console.error("❌ Error fetching teams:", teamError.message);
    return;
  }

  console.log("👥 TEAMS:");
  for (const team of teams || []) {
    console.log(`  • ${team.name} (${team.id})`);
    console.log(`    Status: ${team.status}`);
    console.log(`    Entry Agent: ${team.entry_agent_id}`);
  }

  // 3. Check team members
  const { data: members, error: memberError } = await supabase
    .from("team_members")
    .select(`
      id, team_id, agent_id, role, specialization,
      agents(name)
    `);

  console.log("\n👤 TEAM MEMBERS:");
  for (const member of members || []) {
    const agentData = member.agents as unknown as { name: string } | null;
    console.log(`  • Agent: ${agentData?.name || 'Unknown'}`);
    console.log(`    Role: ${member.role}`);
    console.log(`    Specialization: ${member.specialization || 'none'}`);
  }

  // 4. Check handoff rules
  const { data: rules, error: ruleError } = await supabase
    .from("handoff_rules")
    .select(`
      id, team_id, source_agent_id, target_agent_id, rule_type, conditions, enabled,
      source_agent:agents!source_agent_id(name),
      target_agent:agents!target_agent_id(name)
    `);

  console.log("\n🔄 HANDOFF RULES:");
  for (const rule of rules || []) {
    const source = rule.source_agent as unknown as { name: string } | null;
    const target = rule.target_agent as unknown as { name: string };
    console.log(`  • ${source?.name || 'Any'} → ${target?.name}`);
    console.log(`    Type: ${rule.rule_type}`);
    console.log(`    Conditions: ${JSON.stringify(rule.conditions)}`);
    console.log(`    Enabled: ${rule.enabled}`);
  }

  // 5. Check if transfer_to_agent is in tools
  const hasTransferTool = agents?.some(a => a.tools?.includes('transfer_to_agent'));
  
  console.log("\n⚠️  ISSUE CHECK:");
  if (!hasTransferTool) {
    console.log("  ❌ Agents don't have 'transfer_to_agent' in their tools array!");
    console.log("     The handoff tool needs to be added to the agent's tools.");
  } else {
    console.log("  ✅ Agents have transfer_to_agent tool");
  }

  // Check team status
  const activeTeams = teams?.filter(t => t.status === 'active');
  if (!activeTeams?.length) {
    console.log("  ❌ No active teams! Team status must be 'active' for handoffs to work.");
  } else {
    console.log("  ✅ Team is active");
  }
}

main().catch(console.error);
