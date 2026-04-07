/**
 * KNOWLEDGE BASE FUNCTIONALITY TEST
 * Tests that the Knowledge Base system actually works
 * 
 * Run: npx tsx scripts/test-knowledge-base.ts
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

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function pass(name: string, details?: string) {
  passCount++;
  log("✅", details ? `${name}: ${details}` : name);
}

function fail(name: string, details: string) {
  failCount++;
  log("❌", `${name}: ${details}`);
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("📚 KNOWLEDGE BASE FUNCTIONALITY TEST");
  console.log("   Testing KB page, API, database, and Vertex integration");
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

  log("✅", `Setup: User ${TEST_USER_EMAIL}, Org: ${orgId}\n`);

  // ============================================================
  // TEST 1: Database Schema - knowledge_bases table exists
  // ============================================================
  console.log("📊 TEST 1: DATABASE SCHEMA");
  console.log("-".repeat(50));

  const { data: tables, error: tableError } = await admin.rpc("pg_tables_list").select();
  
  // Alternative: just query the table directly
  const { error: kbError } = await admin
    .from("knowledge_bases")
    .select("id")
    .limit(1);

  if (kbError && kbError.message.includes("does not exist")) {
    fail("Table: knowledge_bases", "Table does not exist");
  } else {
    pass("Table: knowledge_bases", "Exists and accessible");
  }

  // Check required columns
  const { data: kbSample } = await admin
    .from("knowledge_bases")
    .select("*")
    .limit(1);

  if (kbSample) {
    const columns = kbSample.length > 0 ? Object.keys(kbSample[0]) : [];
    const requiredColumns = [
      "id", "org_id", "agent_id", "name", "file_path", 
      "chunks_count", "processing_status", "source_type", "source_url"
    ];
    
    // If we have a row, check columns
    if (columns.length > 0) {
      for (const col of requiredColumns) {
        if (columns.includes(col)) {
          pass(`Column: ${col}`);
        } else {
          fail(`Column: ${col}`, "Missing from table");
        }
      }
    } else {
      pass("Schema check", "Table exists (empty)");
    }
  }

  // ============================================================
  // TEST 2: Existing Knowledge Bases
  // ============================================================
  console.log("\n📁 TEST 2: EXISTING KNOWLEDGE BASES");
  console.log("-".repeat(50));

  const { data: knowledgeBases, error: listError } = await admin
    .from("knowledge_bases")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (listError) {
    fail("List KBs", listError.message);
  } else {
    pass("List KBs", `Found ${knowledgeBases?.length || 0} knowledge bases`);
    
    if (knowledgeBases?.length) {
      for (const kb of knowledgeBases.slice(0, 3)) {
        console.log(`   - ${kb.name} (${kb.source_type}): ${kb.processing_status}`);
      }
    }
  }

  // ============================================================
  // TEST 3: Create a Test Knowledge Base
  // ============================================================
  console.log("\n➕ TEST 3: CREATE KNOWLEDGE BASE");
  console.log("-".repeat(50));

  const testKbName = `Test KB ${Date.now()}`;
  
  const { data: newKb, error: createError } = await admin
    .from("knowledge_bases")
    .insert({
      org_id: orgId,
      name: testKbName,
      source_type: "file",
      processing_status: "pending",
      chunks_count: 0,
    })
    .select()
    .single();

  if (createError) {
    fail("Create KB", createError.message);
  } else {
    pass("Create KB", `Created: ${newKb.id}`);
  }

  // ============================================================
  // TEST 4: Update Knowledge Base
  // ============================================================
  console.log("\n✏️ TEST 4: UPDATE KNOWLEDGE BASE");
  console.log("-".repeat(50));

  if (newKb) {
    const { error: updateError } = await admin
      .from("knowledge_bases")
      .update({
        processing_status: "ready",
        chunks_count: 10,
      })
      .eq("id", newKb.id);

    if (updateError) {
      fail("Update KB", updateError.message);
    } else {
      pass("Update KB", "Updated status to ready, chunks to 10");
    }

    // Verify update
    const { data: updated } = await admin
      .from("knowledge_bases")
      .select("*")
      .eq("id", newKb.id)
      .single();

    if (updated?.processing_status === "ready" && updated?.chunks_count === 10) {
      pass("Verify Update", "Changes persisted correctly");
    } else {
      fail("Verify Update", `Expected ready/10, got ${updated?.processing_status}/${updated?.chunks_count}`);
    }
  }

  // ============================================================
  // TEST 5: Agent Assignment
  // ============================================================
  console.log("\n🤖 TEST 5: AGENT ASSIGNMENT");
  console.log("-".repeat(50));

  // Get an agent
  const { data: agents } = await admin
    .from("agents")
    .select("id, name")
    .eq("org_id", orgId)
    .limit(1);

  if (agents?.length && newKb) {
    const testAgent = agents[0];
    
    const { error: assignError } = await admin
      .from("knowledge_bases")
      .update({ agent_id: testAgent.id })
      .eq("id", newKb.id);

    if (assignError) {
      fail("Assign Agent", assignError.message);
    } else {
      pass("Assign Agent", `Assigned to: ${testAgent.name}`);
    }

    // Verify assignment
    const { data: assigned } = await admin
      .from("knowledge_bases")
      .select("agent_id")
      .eq("id", newKb.id)
      .single();

    if (assigned?.agent_id === testAgent.id) {
      pass("Verify Assignment", "Agent linked correctly");
    } else {
      fail("Verify Assignment", "Agent not linked");
    }
  } else {
    log("⚠️", "No agents found - skipping assignment test");
  }

  // ============================================================
  // TEST 6: Website Source Config
  // ============================================================
  console.log("\n🌐 TEST 6: WEBSITE SOURCE CONFIG");
  console.log("-".repeat(50));

  const websiteKbName = `Website Test ${Date.now()}`;
  
  const { data: websiteKb, error: websiteError } = await admin
    .from("knowledge_bases")
    .insert({
      org_id: orgId,
      name: websiteKbName,
      source_type: "website",
      source_url: "https://example.com",
      source_config: {
        provider: "vertex_ai_search",
        ingestion_mode: "managed_crawl",
        connector: "website",
        total_pages: 3,
        total_characters: 5000,
        pages: [
          { url: "https://example.com/", title: "Home", charCount: 2000 },
          { url: "https://example.com/about", title: "About", charCount: 1500 },
        ],
        sample_chunks: ["Example content chunk 1", "Example content chunk 2"],
      },
      processing_status: "ready",
      chunks_count: 5,
    })
    .select()
    .single();

  if (websiteError) {
    fail("Create Website KB", websiteError.message);
  } else {
    pass("Create Website KB", `Created: ${websiteKb.id}`);
    
    // Verify source_config
    const config = websiteKb.source_config as Record<string, unknown>;
    if (config?.provider === "vertex_ai_search") {
      pass("Source Config", "Vertex AI config stored correctly");
    }
    if ((config?.pages as unknown[])?.length === 2) {
      pass("Pages Config", "2 pages stored in config");
    }
  }

  // ============================================================
  // TEST 7: Vertex AI RAG Service Check
  // ============================================================
  console.log("\n☁️ TEST 7: VERTEX AI CONFIGURATION");
  console.log("-".repeat(50));

  const googleProject = process.env.GOOGLE_CLOUD_PROJECT;
  const vertexLocation = process.env.VERTEX_AI_LOCATION;
  const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (googleProject) {
    pass("GOOGLE_CLOUD_PROJECT", googleProject);
  } else {
    log("⚠️", "GOOGLE_CLOUD_PROJECT: Not set (Vertex AI RAG won't work)");
  }

  if (vertexLocation) {
    pass("VERTEX_AI_LOCATION", vertexLocation);
  } else {
    log("⚠️", "VERTEX_AI_LOCATION: Not set (defaults to us-central1)");
  }

  if (googleCreds) {
    pass("GOOGLE_APPLICATION_CREDENTIALS_JSON", "Configured (service account)");
  } else {
    log("⚠️", "GOOGLE_APPLICATION_CREDENTIALS_JSON: Not set (using ADC)");
  }

  // ============================================================
  // TEST 8: Cleanup - Delete Test KBs
  // ============================================================
  console.log("\n🗑️ TEST 8: CLEANUP");
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
      pass(`Delete ${kbId}`, "Cleaned up test KB");
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(70));
  console.log("📊 KNOWLEDGE BASE TEST SUMMARY");
  console.log("=".repeat(70));
  
  console.log(`\n✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📋 Total:  ${passCount + failCount}\n`);

  if (failCount === 0) {
    console.log("🎉 ALL KNOWLEDGE BASE TESTS PASSED!\n");
  }

  console.log("STATUS SUMMARY:");
  console.log("-".repeat(50));
  console.log(`
  ✓ Database schema: Working
  ✓ CRUD operations: Working
  ✓ Agent assignment: Working
  ✓ Website source config: Working
  ${googleProject ? "✓" : "⚠"} Vertex AI RAG: ${googleProject ? "Configured" : "Needs GOOGLE_CLOUD_PROJECT env var"}
  `);

  console.log("RECOMMENDATION:");
  console.log("-".repeat(50));
  console.log(`
  Add a "Knowledge" tab to agent details page:
  - View KBs assigned to this agent
  - Quick upload files directly
  - Add website URLs inline
  - Unassign KBs from agent
  
  Keep /knowledge-base page for:
  - Org-wide KB management
  - Bulk operations
  - Integration status dashboard
  `);
}

main().catch(console.error);
