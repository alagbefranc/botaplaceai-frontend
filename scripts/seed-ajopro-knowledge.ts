/**
 * Seed AjoPro Knowledge Bases for Each Agent
 * 
 * Creates role-specific knowledge bases for the AjoPro agent team
 * Run with: npx tsx scripts/seed-ajopro-knowledge.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
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

// AjoPro website base URL
const AJOPRO_BASE = "https://ajopro.us";

// Knowledge base definitions per agent role
// Each agent gets the main website as their knowledge source
// The Vertex AI Search crawler will index all linked pages automatically
const knowledgeBases = [
  {
    agentName: "AjoPro Onboarding Guide",
    name: "AjoPro Website - Onboarding",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
  {
    agentName: "AjoPro Plan Advisor",
    name: "AjoPro Website - Plans",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
  {
    agentName: "AjoPro Trust & Rewards Specialist",
    name: "AjoPro Website - Trust & Rewards",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
  {
    agentName: "AjoPro EPT Specialist",
    name: "AjoPro Website - EPT",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
  {
    agentName: "AjoPro Compliance & Security",
    name: "AjoPro Website - Compliance",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
  {
    agentName: "AjoPro Tech Support",
    name: "AjoPro Website - Support",
    sourceType: "website",
    sourceUrl: AJOPRO_BASE,
  },
];

async function main() {
  console.log("🚀 Starting AjoPro Knowledge Base seed script...\n");

  // Get user and org
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, email, org_id")
    .eq("email", "francalagbe@gmail.com")
    .single();

  if (userError || !userData?.org_id) {
    console.error("❌ User/org not found:", userError?.message);
    process.exit(1);
  }

  const orgId = userData.org_id;
  console.log("✅ Found organization:", orgId);

  // Get all AjoPro agents
  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("id, name, org_id")
    .eq("org_id", orgId)
    .like("name", "AjoPro%");

  if (agentsError || !agents?.length) {
    console.error("❌ No AjoPro agents found. Run seed-ajopro-team.ts first.");
    process.exit(1);
  }

  console.log(`✅ Found ${agents.length} AjoPro agents\n`);

  // Create agent name to ID map
  const agentMap = new Map(agents.map((a) => [a.name, a.id]));

  // Track created knowledge bases
  const created: Array<{ agent: string; kb: string; source: string }> = [];

  // Create knowledge bases
  for (const kb of knowledgeBases) {
    const agentId = agentMap.get(kb.agentName);
    
    if (!agentId) {
      console.log(`⚠️ Agent not found: ${kb.agentName}`);
      continue;
    }

    console.log(`📚 Creating: ${kb.name} for ${kb.agentName}`);

    // Insert knowledge base record
    const { data: newKb, error: insertError } = await supabase
      .from("knowledge_bases")
      .insert({
        org_id: orgId,
        agent_id: agentId,
        name: kb.name,
        source_type: kb.sourceType,
        source_url: kb.sourceUrl,
        processing_status: "pending",
        chunks_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.log(`   ⚠️ Failed: ${insertError.message}`);
      continue;
    }

    console.log(`   ✅ Created KB: ${newKb.id}`);
    created.push({ agent: kb.agentName, kb: newKb.id, source: kb.sourceUrl });

    // Note: The POST endpoint triggers indexing automatically when sourceType=website
    // If dev server is running, the indexing happens via dual-approach system
    console.log(`   ℹ️ KB created - will be indexed when processed`);
  }

  // Summary
  console.log("\n============================================");
  console.log("🎉 KNOWLEDGE BASE SEEDING COMPLETE!");
  console.log("============================================");
  console.log(`\n📊 Created ${created.length} Knowledge Bases:`);
  
  // Group by agent
  const byAgent = new Map<string, Array<{ kb: string; source: string }>>();
  for (const item of created) {
    if (!byAgent.has(item.agent)) byAgent.set(item.agent, []);
    byAgent.get(item.agent)!.push({ kb: item.kb, source: item.source });
  }

  for (const [agent, kbs] of byAgent) {
    console.log(`\n🤖 ${agent}:`);
    for (const kb of kbs) {
      console.log(`   • ${kb.kb}`);
      console.log(`     Source: ${kb.source}`);
    }
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Start the dev server: npm run dev");
  console.log("   2. Knowledge bases will be indexed via Vertex AI Search");
  console.log("   3. Or manually trigger: POST /api/knowledge-base/{id}/reindex");
  console.log("============================================\n");
}

main().catch(console.error);
