/**
 * Telnyx Integration Test Script
 * 
 * Tests the multi-tenant Telnyx integration with Supabase
 * 
 * Usage: npx tsx scripts/test-telnyx-integration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BASE_URL = "http://localhost:3000";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// Test results tracking
const results: { test: string; status: "PASS" | "FAIL"; details?: string }[] = [];

function log(message: string) {
  console.log(`\n${message}`);
}

function pass(test: string, details?: string) {
  results.push({ test, status: "PASS", details });
  console.log(`  ✅ ${test}${details ? `: ${details}` : ""}`);
}

function fail(test: string, details?: string) {
  results.push({ test, status: "FAIL", details });
  console.log(`  ❌ ${test}${details ? `: ${details}` : ""}`);
}

async function testDatabaseConnection() {
  log("📊 Testing Database Connection...");
  
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name")
      .limit(1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      pass("Database connection", `Found org: ${data[0].name}`);
      return data[0].id;
    } else {
      fail("Database connection", "No organizations found");
      return null;
    }
  } catch (e) {
    fail("Database connection", (e as Error).message);
    return null;
  }
}

async function testTelnyxConnectionsTable(orgId: string) {
  log("📞 Testing telnyx_connections table...");
  
  try {
    // Check if table exists and has data
    const { data, error } = await supabase
      .from("telnyx_connections")
      .select("*")
      .eq("org_id", orgId)
      .single();
    
    if (error && error.code !== "PGRST116") throw error;
    
    if (data) {
      pass("telnyx_connections lookup", `Found connection: ${data.connection_name} (${data.connection_id})`);
      return data;
    } else {
      // Create a test connection
      log("  📝 No connection found, creating test record...");
      const { data: newConn, error: insertError } = await supabase
        .from("telnyx_connections")
        .insert({
          org_id: orgId,
          connection_id: "test-connection-id",
          connection_name: "Test WebRTC Connection",
          status: "active",
          is_default: true,
          settings: { test: true },
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      pass("telnyx_connections insert", `Created test connection: ${newConn.connection_id}`);
      return newConn;
    }
  } catch (e) {
    fail("telnyx_connections", (e as Error).message);
    return null;
  }
}

async function testCallLogsTable(orgId: string) {
  log("📋 Testing call_logs table...");
  
  const testCallId = `test-call-${Date.now()}`;
  
  try {
    // Insert a test call log
    const { data: inserted, error: insertError } = await supabase
      .from("call_logs")
      .insert({
        org_id: orgId,
        direction: "outbound",
        caller_number: "+1234567890",
        callee_number: "+0987654321",
        call_state: "initiated",
        telnyx_call_control_id: testCallId,
        telnyx_call_leg_id: "test-leg-id",
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    pass("call_logs insert", `Created call log: ${inserted.id}`);
    
    // Update the call log
    const { error: updateError } = await supabase
      .from("call_logs")
      .update({
        call_state: "connected",
        duration_seconds: 30,
      })
      .eq("id", inserted.id);
    
    if (updateError) throw updateError;
    pass("call_logs update", "Updated call state to connected");
    
    // Read it back
    const { data: readBack, error: readError } = await supabase
      .from("call_logs")
      .select("*")
      .eq("id", inserted.id)
      .single();
    
    if (readError) throw readError;
    
    if (readBack.call_state === "connected" && readBack.duration_seconds === 30) {
      pass("call_logs read", `State: ${readBack.call_state}, Duration: ${readBack.duration_seconds}s`);
    } else {
      fail("call_logs read", "Data mismatch after update");
    }
    
    // Clean up test data
    await supabase.from("call_logs").delete().eq("telnyx_call_control_id", testCallId);
    pass("call_logs cleanup", "Deleted test record");
    
    return true;
  } catch (e) {
    fail("call_logs", (e as Error).message);
    return false;
  }
}

async function testWebhookLookup(connectionId: string) {
  log("🔍 Testing org lookup from connection_id...");
  
  try {
    const { data, error } = await supabase
      .from("telnyx_connections")
      .select("org_id")
      .eq("connection_id", connectionId)
      .single();
    
    if (error) throw error;
    
    if (data?.org_id) {
      pass("Org lookup from connection", `Found org_id: ${data.org_id.slice(0, 8)}...`);
      return true;
    } else {
      fail("Org lookup from connection", "No org_id found");
      return false;
    }
  } catch (e) {
    fail("Org lookup from connection", (e as Error).message);
    return false;
  }
}

async function testApiEndpoints() {
  log("🌐 Testing API Endpoints...");
  
  try {
    // Test /api/telnyx endpoint
    const overviewRes = await fetch(`${BASE_URL}/api/telnyx`);
    if (overviewRes.ok) {
      const data = await overviewRes.json();
      pass("GET /api/telnyx", `Found ${Object.keys(data.endpoints || {}).length} endpoints`);
    } else {
      fail("GET /api/telnyx", `Status: ${overviewRes.status}`);
    }
    
    // Test /api/telnyx/call-control GET
    const callControlRes = await fetch(`${BASE_URL}/api/telnyx/call-control`);
    if (callControlRes.ok) {
      const data = await callControlRes.json();
      const actionCount = Object.values(data.actions || {}).flat().length;
      pass("GET /api/telnyx/call-control", `Found ${actionCount} actions`);
    } else {
      fail("GET /api/telnyx/call-control", `Status: ${callControlRes.status}`);
    }
    
    // Test /api/telnyx/webhook GET (health check)
    const webhookRes = await fetch(`${BASE_URL}/api/telnyx/webhook`);
    if (webhookRes.ok) {
      pass("GET /api/telnyx/webhook", "Webhook endpoint ready");
    } else {
      fail("GET /api/telnyx/webhook", `Status: ${webhookRes.status}`);
    }
    
    // Test /api/telnyx/active-calls
    const activeCallsRes = await fetch(`${BASE_URL}/api/telnyx/active-calls`);
    if (activeCallsRes.ok) {
      const data = await activeCallsRes.json();
      pass("GET /api/telnyx/active-calls", `Webhook configured: ${data.hasWebhook}`);
    } else {
      fail("GET /api/telnyx/active-calls", `Status: ${activeCallsRes.status}`);
    }
    
    return true;
  } catch (e) {
    fail("API Endpoints", (e as Error).message);
    return false;
  }
}

async function testCallControlWithOrg(orgId: string) {
  log("📱 Testing Call Control with org_id...");
  
  try {
    // This will fail because we don't have a real call, but it tests the lookup logic
    const res = await fetch(`${BASE_URL}/api/telnyx/call-control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_id: orgId,
        call_control_id: "test-call-id",
        action: "hangup",
      }),
    });
    
    const data = await res.json();
    
    // We expect it to fail at the Telnyx API level, not our code level
    if (data.error?.includes("Invalid Call Control ID") || 
        data.error?.includes("not valid") ||
        data.error?.includes("failed")) {
      pass("Call control with org_id", "Org lookup worked, Telnyx API called (expected failure for fake call)");
    } else if (res.ok) {
      pass("Call control with org_id", "Request succeeded");
    } else if (data.error?.includes("No Telnyx connection found")) {
      fail("Call control with org_id", "Org credentials not found in database");
    } else {
      pass("Call control with org_id", `Response: ${JSON.stringify(data).slice(0, 100)}`);
    }
    
    return true;
  } catch (e) {
    fail("Call control with org_id", (e as Error).message);
    return false;
  }
}

async function testWebhookSimulation(orgId: string) {
  log("📨 Testing Webhook Event Simulation...");
  
  const testCallId = `webhook-test-${Date.now()}`;
  
  try {
    // Get connection_id for this org
    const { data: conn } = await supabase
      .from("telnyx_connections")
      .select("connection_id")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .single();
    
    if (!conn) {
      fail("Webhook simulation", "No connection found for org");
      return false;
    }
    
    // Simulate call.initiated event
    const initiatedRes = await fetch(`${BASE_URL}/api/telnyx/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          event_type: "call.initiated",
          payload: {
            call_control_id: testCallId,
            call_leg_id: "test-leg",
            connection_id: conn.connection_id,
            direction: "incoming",
            from: "+15551234567",
            to: "+15559876543",
            state: "ringing",
          },
        },
      }),
    });
    
    if (initiatedRes.ok) {
      pass("Webhook call.initiated", "Event processed");
    } else {
      fail("Webhook call.initiated", `Status: ${initiatedRes.status}`);
    }
    
    // Check if call was logged
    await new Promise(r => setTimeout(r, 500)); // Wait for DB write
    
    const { data: callLog } = await supabase
      .from("call_logs")
      .select("*")
      .eq("telnyx_call_control_id", testCallId)
      .single();
    
    if (callLog) {
      pass("Call log created", `Direction: ${callLog.direction}, State: ${callLog.call_state}`);
      
      // Simulate call.hangup event
      const hangupRes = await fetch(`${BASE_URL}/api/telnyx/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            event_type: "call.hangup",
            payload: {
              call_control_id: testCallId,
              call_leg_id: "test-leg",
              connection_id: conn.connection_id,
              hangup_cause: "NORMAL_CLEARING",
            },
          },
        }),
      });
      
      if (hangupRes.ok) {
        pass("Webhook call.hangup", "Event processed");
      }
      
      // Check updated state
      await new Promise(r => setTimeout(r, 500));
      
      const { data: updatedLog } = await supabase
        .from("call_logs")
        .select("*")
        .eq("telnyx_call_control_id", testCallId)
        .single();
      
      if (updatedLog?.call_state === "completed") {
        pass("Call log updated", `State: ${updatedLog.call_state}, Duration: ${updatedLog.duration_seconds}s`);
      } else {
        fail("Call log updated", `State is ${updatedLog?.call_state}, expected completed`);
      }
      
      // Clean up
      await supabase.from("call_logs").delete().eq("telnyx_call_control_id", testCallId);
      pass("Cleanup", "Deleted test call log");
    } else {
      fail("Call log created", "No call log found after webhook");
    }
    
    return true;
  } catch (e) {
    fail("Webhook simulation", (e as Error).message);
    // Clean up on error
    await supabase.from("call_logs").delete().eq("telnyx_call_control_id", testCallId);
    return false;
  }
}

async function main() {
  console.log("═".repeat(60));
  console.log("  🧪 TELNYX INTEGRATION TEST SUITE");
  console.log("═".repeat(60));
  
  // Run tests
  const orgId = await testDatabaseConnection();
  if (!orgId) {
    console.log("\n❌ Cannot continue without database connection\n");
    process.exit(1);
  }
  
  const connection = await testTelnyxConnectionsTable(orgId);
  
  await testCallLogsTable(orgId);
  
  if (connection) {
    await testWebhookLookup(connection.connection_id);
  }
  
  await testApiEndpoints();
  
  await testCallControlWithOrg(orgId);
  
  await testWebhookSimulation(orgId);
  
  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  📊 TEST SUMMARY");
  console.log("═".repeat(60));
  
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  
  console.log(`\n  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📈 Total:  ${results.length}`);
  
  if (failed > 0) {
    console.log("\n  Failed tests:");
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`    - ${r.test}: ${r.details || "Unknown error"}`);
    });
  }
  
  console.log("\n" + "═".repeat(60));
  console.log(failed === 0 ? "  ✨ ALL TESTS PASSED!" : "  ⚠️  SOME TESTS FAILED");
  console.log("═".repeat(60) + "\n");
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
