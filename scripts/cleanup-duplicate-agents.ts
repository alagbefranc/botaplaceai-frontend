/**
 * Check and clean up duplicate AjoPro agents
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("🔍 Checking for duplicate AjoPro agents...\n");

  // Get all AjoPro agents
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, name, created_at")
    .like("name", "AjoPro%")
    .order("name")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${agents?.length || 0} AjoPro agents:\n`);

  // Group by name
  const byName = new Map<string, typeof agents>();
  for (const agent of agents || []) {
    if (!byName.has(agent.name)) {
      byName.set(agent.name, []);
    }
    byName.get(agent.name)!.push(agent);
  }

  // Find duplicates
  const duplicates: Array<{ name: string; toDelete: string[]; toKeep: string }> = [];

  for (const [name, agentsList] of byName) {
    if (agentsList.length > 1) {
      // Keep the oldest one (first created)
      const toKeep = agentsList[0];
      const toDelete = agentsList.slice(1).map((a) => a.id);
      duplicates.push({ name, toDelete, toKeep: toKeep.id });
      console.log(`⚠️  ${name}: ${agentsList.length} copies`);
      console.log(`   Keep: ${toKeep.id} (created ${toKeep.created_at})`);
      console.log(`   Delete: ${toDelete.join(", ")}\n`);
    } else {
      console.log(`✅ ${name}: 1 copy (${agentsList[0].id})`);
    }
  }

  if (duplicates.length === 0) {
    console.log("\n✅ No duplicates found!");
    return;
  }

  console.log(`\n🧹 Deleting ${duplicates.reduce((sum, d) => sum + d.toDelete.length, 0)} duplicate agents...\n`);

  // Delete duplicates (but first delete related records)
  for (const dup of duplicates) {
    for (const id of dup.toDelete) {
      // Delete team members
      await supabase.from("team_members").delete().eq("agent_id", id);
      
      // Delete handoff rules
      await supabase.from("handoff_rules").delete().eq("source_agent_id", id);
      await supabase.from("handoff_rules").delete().eq("target_agent_id", id);
      
      // Delete knowledge bases
      await supabase.from("knowledge_bases").delete().eq("agent_id", id);
      
      // Delete the agent
      const { error: delError } = await supabase.from("agents").delete().eq("id", id);
      if (delError) {
        console.log(`  ❌ Failed to delete ${id}: ${delError.message}`);
      } else {
        console.log(`  ✅ Deleted duplicate: ${dup.name} (${id})`);
      }
    }
  }

  // Show final count
  const { count } = await supabase
    .from("agents")
    .select("*", { count: "exact", head: true })
    .like("name", "AjoPro%");

  console.log(`\n📊 Final count: ${count || 0} AjoPro agents`);
  console.log("✅ Cleanup complete!");
}

main().catch(console.error);
