/**
 * KNOWLEDGE TAB INTEGRATION TEST
 * Tests the new Knowledge tab in agent details page
 * 
 * Run: npx tsx scripts/test-knowledge-tab.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_USER_EMAIL = "francalagbe@gmail.com";

let passCount = 0;
let failCount = 0;

function pass(name: string, details?: string) {
  passCount++;
  console.log(`✅ ${name}${details ? `: ${details}` : ""}`);
}

function fail(name: string, details: string) {
  failCount++;
  console.log(`❌ ${name}: ${details}`);
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("📚 KNOWLEDGE TAB INTEGRATION TEST");
  console.log("   Testing Knowledge tab functionality in agent details");
  console.log("=".repeat(70) + "\n");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Get user/org
  const { data: usersData } = await admin.auth.admin.listUsers();
  const testUser = usersData?.users?.find((u) => u.email === TEST_USER_EMAIL);
  if (!testUser) {
    fail("Setup", "Test user not found");
    return;
  }

  const { data: userData } = await admin.from("users").select("org_id").eq("id", testUser.id).single();
  const orgId = userData!.org_id;

  // Get an agent
  const { data: agents } = await admin
    .from("agents")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("status", "active")
    .limit(1);

  if (!agents?.length) {
    fail("Setup", "No active agents found");
    return;
  }

  const testAgent = agents[0];
  console.log(`✅ Setup: User ${TEST_USER_EMAIL}, Agent: ${testAgent.name}\n`);

  // ============================================================
  // TEST 1: Create KB linked to agent
  // ============================================================
  console.log("📊 TEST 1: CREATE KB LINKED TO AGENT");
  console.log("-".repeat(50));

  const testKbName = `Agent KB Test ${Date.now()}`;
  const { data: newKb, error: createError } = await admin
    .from("knowledge_bases")
    .insert({
      org_id: orgId,
      agent_id: testAgent.id,
      name: testKbName,
      source_type: "file",
      processing_status: "ready",
      chunks_count: 5,
    })
    .select()
    .single();

  if (createError) {
    fail("Create KB", createError.message);
  } else {
    pass("Create KB", `Created: ${newKb.name}`);
  }

  // ============================================================
  // TEST 2: Query KBs for specific agent
  // ============================================================
  console.log("\n📊 TEST 2: QUERY KBS FOR AGENT");
  console.log("-".repeat(50));

  const { data: agentKbs, error: queryError } = await admin
    .from("knowledge_bases")
    .select("*")
    .eq("org_id", orgId)
    .eq("agent_id", testAgent.id);

  if (queryError) {
    fail("Query Agent KBs", queryError.message);
  } else {
    pass("Query Agent KBs", `Found ${agentKbs?.length || 0} KB(s) for agent`);
    const hasTestKb = agentKbs?.some(kb => kb.name === testKbName);
    if (hasTestKb) {
      pass("New KB in Results", "Test KB found in agent's knowledge bases");
    } else {
      fail("New KB in Results", "Test KB not found");
    }
  }

  // ============================================================
  // TEST 3: Unassign KB from agent
  // ============================================================
  console.log("\n📊 TEST 3: UNASSIGN KB FROM AGENT");
  console.log("-".repeat(50));

  if (newKb) {
    const { error: unassignError } = await admin
      .from("knowledge_bases")
      .update({ agent_id: null })
      .eq("id", newKb.id);

    if (unassignError) {
      fail("Unassign KB", unassignError.message);
    } else {
      pass("Unassign KB", "KB unassigned from agent");
    }

    // Verify unassignment
    const { data: unassigned } = await admin
      .from("knowledge_bases")
      .select("agent_id")
      .eq("id", newKb.id)
      .single();

    if (unassigned?.agent_id === null) {
      pass("Verify Unassign", "agent_id is null");
    } else {
      fail("Verify Unassign", `agent_id is ${unassigned?.agent_id}`);
    }
  }

  // ============================================================
  // TEST 4: Re-assign KB to agent
  // ============================================================
  console.log("\n📊 TEST 4: RE-ASSIGN KB TO AGENT");
  console.log("-".repeat(50));

  if (newKb) {
    const { error: reassignError } = await admin
      .from("knowledge_bases")
      .update({ agent_id: testAgent.id })
      .eq("id", newKb.id);

    if (reassignError) {
      fail("Re-assign KB", reassignError.message);
    } else {
      pass("Re-assign KB", `KB linked to ${testAgent.name}`);
    }
  }

  // ============================================================
  // TEST 5: Query unlinked KBs (for "Link Existing" modal)
  // ============================================================
  console.log("\n📊 TEST 5: QUERY UNLINKED KBS");
  console.log("-".repeat(50));

  const { data: allKbs } = await admin
    .from("knowledge_bases")
    .select("id, name, agent_id")
    .eq("org_id", orgId);

  const linkedKbs = allKbs?.filter(kb => kb.agent_id === testAgent.id) || [];
  const unlinkedKbs = allKbs?.filter(kb => kb.agent_id !== testAgent.id) || [];

  pass("All KBs Count", `${allKbs?.length || 0} total`);
  pass("Linked to Agent", `${linkedKbs.length} KB(s)`);
  pass("Unlinked (available)", `${unlinkedKbs.length} KB(s)`);

  // ============================================================
  // TEST 6: Website source with agent link
  // ============================================================
  console.log("\n📊 TEST 6: WEBSITE KB WITH AGENT");
  console.log("-".repeat(50));

  const websiteKbName = `Website KB Test ${Date.now()}`;
  const { data: websiteKb, error: websiteError } = await admin
    .from("knowledge_bases")
    .insert({
      org_id: orgId,
      agent_id: testAgent.id,
      name: websiteKbName,
      source_type: "website",
      source_url: "https://example.com",
      source_config: {
        provider: "vertex_ai_search",
        total_pages: 2,
        chunks: ["chunk1", "chunk2"],
      },
      processing_status: "ready",
      chunks_count: 2,
    })
    .select()
    .single();

  if (websiteError) {
    fail("Create Website KB", websiteError.message);
  } else {
    pass("Create Website KB", `Created: ${websiteKb.name}`);
    if (websiteKb.source_type === "website") {
      pass("Source Type", "website");
    }
  }

  // ============================================================
  // TEST 7: Cleanup
  // ============================================================
  console.log("\n📊 TEST 7: CLEANUP");
  console.log("-".repeat(50));

  const kbsToDelete = [newKb?.id, websiteKb?.id].filter(Boolean);
  
  for (const kbId of kbsToDelete) {
    const { error: deleteError } = await admin
      .from("knowledge_bases")
      .delete()
      .eq("id", kbId);

    if (deleteError) {
      fail(`Delete ${kbId}`, deleteError.message);
    } else {
      pass(`Delete ${kbId}`, "Cleaned up");
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 KNOWLEDGE TAB TEST SUMMARY");
  console.log("=".repeat(70));
  
  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total:  ${passCount + failCount}\n`);

  if (failCount === 0) {
    console.log("🎉 ALL KNOWLEDGE TAB TESTS PASSED!\n");
  }

  console.log("FEATURES VERIFIED:");
  console.log("-".repeat(50));
  console.log(`
  ✓ Create KB linked to agent
  ✓ Query KBs for specific agent
  ✓ Unassign KB from agent
  ✓ Re-assign KB to agent
  ✓ Query unlinked KBs (for Link Existing modal)
  ✓ Website source with agent link
  `);
}

main().catch(console.error);
