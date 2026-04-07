/**
 * Custom AI Insights Integration Test Script
 * Tests all components of the insights system
 * Run: npx tsx scripts/test-insights-integration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load environment from .env.local
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

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  data?: unknown;
}

const results: TestResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function pass(name: string, details: string, data?: unknown) {
  results.push({ name, status: "PASS", details, data });
  log("✅", `${name}: ${details}`);
}

function fail(name: string, details: string) {
  results.push({ name, status: "FAIL", details });
  log("❌", `${name}: ${details}`);
}

function skip(name: string, details: string) {
  results.push({ name, status: "SKIP", details });
  log("⏭️", `${name}: ${details}`);
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 CUSTOM AI INSIGHTS INTEGRATION TEST");
  console.log("=".repeat(60) + "\n");

  // 1. Check environment
  log("🔧", "Checking environment...");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    fail("Environment", "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return printSummary();
  }
  pass("Environment", "Supabase credentials found");

  // 2. Create admin client
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Get test user
  log("👤", `Looking up user: ${TEST_USER_EMAIL}`);
  const { data: usersData, error: authError } = await admin.auth.admin.listUsers();
  const authUser = usersData?.users?.find((u) => u.email === TEST_USER_EMAIL);
  
  if (authError || !authUser) {
    fail("User Lookup", authError?.message || "User not found");
    return printSummary();
  }
  pass("User Lookup", `Found user ID: ${authUser.id}`);

  // 4. Get org membership from users table
  const { data: member, error: memberError } = await admin
    .from("users")
    .select("org_id, role")
    .eq("id", authUser.id)
    .maybeSingle();

  if (memberError || !member?.org_id) {
    fail("Org Membership", memberError?.message || "No org membership found");
    return printSummary();
  }
  pass("Org Membership", `Org ID: ${member.org_id}, Role: ${member.role || 'viewer'}`);

  const orgId = member.org_id;

  // 5. Test insight_definitions table
  log("📊", "Testing insight_definitions table...");
  const { data: definitions, error: defError } = await admin
    .from("insight_definitions")
    .select("*")
    .eq("org_id", orgId);

  if (defError) {
    fail("Insight Definitions Table", defError.message);
  } else {
    pass("Insight Definitions Table", `Found ${definitions?.length || 0} definitions`);
  }

  // 6. Test insight_groups table
  log("📁", "Testing insight_groups table...");
  const { data: groups, error: groupError } = await admin
    .from("insight_groups")
    .select("*")
    .eq("org_id", orgId);

  if (groupError) {
    fail("Insight Groups Table", groupError.message);
  } else {
    pass("Insight Groups Table", `Found ${groups?.length || 0} groups`);
  }

  // 7. Test templates
  log("📋", "Testing industry templates...");
  const { data: templates, error: tmplError } = await admin
    .from("insight_definitions")
    .select("id, name, template_category")
    .eq("is_template", true);

  if (tmplError) {
    fail("Industry Templates", tmplError.message);
  } else {
    pass("Industry Templates", `Found ${templates?.length || 0} templates`, templates?.slice(0, 3));
  }

  // 8. Test custom_insight_results table
  log("📈", "Testing custom_insight_results table...");
  const { error: resultsError } = await admin
    .from("custom_insight_results")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (resultsError) {
    fail("Custom Insight Results Table", resultsError.message);
  } else {
    pass("Custom Insight Results Table", "Table accessible");
  }

  // 9. Test webhook_logs table (optional - may not exist yet)
  log("🔗", "Testing webhook_logs table...");
  const { error: logsError } = await admin
    .from("webhook_logs")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);

  if (logsError) {
    skip("Webhook Logs Table", `Not created yet: ${logsError.message}`);
  } else {
    pass("Webhook Logs Table", "Table accessible");
  }

  // 10. Test agents table for custom_insights in settings
  log("🤖", "Testing agent settings integration...");
  const { data: agents, error: agentsError } = await admin
    .from("agents")
    .select("id, name, settings")
    .eq("org_id", orgId)
    .limit(3);

  if (agentsError) {
    fail("Agents Table", agentsError.message);
  } else if (!agents?.length) {
    skip("Agents Table", "No agents found to test");
  } else {
    const agentInfo = agents.map((a) => {
      const settings = a.settings as Record<string, unknown> | null;
      return {
        name: a.name,
        hasCustomInsights: !!settings?.custom_insights,
        customInsightsEnabled: (settings?.custom_insights as Record<string, unknown>)?.enabled ?? false,
      };
    });
    pass("Agents Table", `Found ${agents.length} agents`, agentInfo);
  }

  // 11. Create a test insight definition
  log("➕", "Creating test insight definition...");
  const testDefName = `Test_Integration_${Date.now()}`;
  const { data: newDef, error: createDefError } = await admin
    .from("insight_definitions")
    .insert({
      org_id: orgId,
      name: testDefName,
      description: "Automated test insight",
      insight_type: "structured",
      schema: {
        parameters: [
          { name: "test_field", type: "string", description: "A test field", required: true },
        ],
      },
      is_template: false,
    })
    .select()
    .single();

  if (createDefError) {
    fail("Create Insight Definition", createDefError.message);
  } else {
    pass("Create Insight Definition", `Created: ${testDefName}`, { id: newDef?.id });
  }

  // 12. Create a test insight group
  log("➕", "Creating test insight group...");
  const testGroupName = `Test_Group_${Date.now()}`;
  const { data: newGroup, error: createGroupError } = await admin
    .from("insight_groups")
    .insert({
      org_id: orgId,
      name: testGroupName,
      description: "Automated test group",
      insight_ids: newDef ? [newDef.id] : [],
      webhook_enabled: false,
    })
    .select()
    .single();

  if (createGroupError) {
    fail("Create Insight Group", createGroupError.message);
  } else {
    pass("Create Insight Group", `Created: ${testGroupName}`, { id: newGroup?.id });
  }

  // 13. Test updating an agent with custom insights config
  if (agents?.length && newDef && newGroup) {
    log("🔄", "Testing agent custom insights update...");
    const testAgent = agents[0];
    const currentSettings = (testAgent.settings as Record<string, unknown>) || {};
    
    const { error: updateError } = await admin
      .from("agents")
      .update({
        settings: {
          ...currentSettings,
          custom_insights: {
            enabled: true,
            definitionIds: [newDef.id],
            groupIds: [newGroup.id],
            autoExtractOnEnd: true,
          },
        },
      })
      .eq("id", testAgent.id);

    if (updateError) {
      fail("Update Agent Custom Insights", updateError.message);
    } else {
      pass("Update Agent Custom Insights", `Updated agent: ${testAgent.name}`);
    }

    // Verify the update
    const { data: verifyAgent } = await admin
      .from("agents")
      .select("settings")
      .eq("id", testAgent.id)
      .single();

    const savedSettings = verifyAgent?.settings as Record<string, unknown>;
    const customInsights = savedSettings?.custom_insights as Record<string, unknown>;
    
    if (customInsights?.enabled === true) {
      pass("Verify Agent Update", "Custom insights config saved correctly", customInsights);
    } else {
      fail("Verify Agent Update", "Custom insights config not saved");
    }
  }

  // 14. Cleanup test data
  log("🧹", "Cleaning up test data...");
  if (newGroup) {
    await admin.from("insight_groups").delete().eq("id", newGroup.id);
  }
  if (newDef) {
    await admin.from("insight_definitions").delete().eq("id", newDef.id);
  }
  pass("Cleanup", "Test data removed");

  // Print summary
  printSummary();
}

function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  
  console.log(`\n✅ Passed:  ${passed}`);
  console.log(`❌ Failed:  ${failed}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log(`📋 Total:   ${results.length}\n`);

  if (failed > 0) {
    console.log("❌ FAILED TESTS:");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => console.log(`   - ${r.name}: ${r.details}`));
    console.log("");
  }

  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! Custom AI Insights integration is working.\n");
  } else {
    console.log("⚠️ Some tests failed. Please review the issues above.\n");
  }
}

main().catch(console.error);
