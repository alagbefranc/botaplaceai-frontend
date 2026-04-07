/**
 * Tenant Provisioning Script
 * 
 * This script automatically provisions a tenant with:
 * 1. Telnyx SIP Connection for WebRTC
 * 2. A real phone number from Telnyx
 * 3. Database records in Supabase
 * 
 * Usage: npx tsx scripts/provision-tenant.ts <org_id> [--assign-number]
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables first
dotenv.config({ path: ".env.local" });

const TELNYX_API_KEY = process.env.TELNYX_API_KEY || "";
const TELNYX_API_URL = "https://api.telnyx.com/v2";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface TelnyxNumber {
  id: string;
  phone_number: string;
  status: string;
  connection_id: string | null;
  connection_name: string | null;
}

interface TelnyxConnection {
  id: string;
  connection_name: string;
  active: boolean;
  webhook_event_url: string;
}

async function telnyxFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${TELNYX_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TELNYX_API_KEY}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telnyx API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function listTelnyxNumbers(): Promise<TelnyxNumber[]> {
  console.log("📞 Fetching phone numbers from Telnyx...");
  const data = await telnyxFetch<{ data: TelnyxNumber[] }>("/phone_numbers?page[size]=50");
  console.log(`   Found ${data.data.length} phone number(s)`);
  return data.data;
}

async function listCredentialConnections(): Promise<any[]> {
  console.log("🔌 Fetching credential connections from Telnyx...");
  const data = await telnyxFetch<{ data: any[] }>("/credential_connections");
  console.log(`   Found ${data.data.length} credential connection(s)`);
  return data.data;
}

async function listTelnyxConnections(): Promise<TelnyxConnection[]> {
  console.log("🔌 Fetching connections from Telnyx...");
  const data = await telnyxFetch<{ data: TelnyxConnection[] }>("/connections?filter[connection_name][contains]=");
  console.log(`   Found ${data.data.length} connection(s)`);
  return data.data;
}

async function createTelnyxConnection(orgId: string, orgName: string): Promise<TelnyxConnection> {
  console.log(`🔧 Creating Telnyx credential connection for org: ${orgName}...`);
  
  // First, get or create a credential connection
  const existingConnections = await listCredentialConnections();
  
  let connectionId: string;
  if (existingConnections.length > 0) {
    // Use the first available credential connection
    connectionId = existingConnections[0].id;
    console.log(`   Using existing credential connection: ${existingConnections[0].connection_name} (${connectionId})`);
  } else {
    // Create a new credential connection first
    console.log("   Creating new credential connection...");
    const connData = await telnyxFetch<{ data: any }>("/credential_connections", {
      method: "POST",
      body: JSON.stringify({
        connection_name: `bosupport-webrtc`,
        active: true,
      }),
    });
    connectionId = connData.data.id;
    console.log(`   Created credential connection: ${connData.data.connection_name} (${connectionId})`);
  }

  // Now create a telephony credential for this org
  const data = await telnyxFetch<{ data: any }>("/telephony_credentials", {
    method: "POST",
    body: JSON.stringify({
      connection_id: connectionId,
      name: `webrtc-${orgId.slice(0, 8)}`,
      tag: `org:${orgId}`,
    }),
  });

  console.log(`   Created telephony credential: ${data.data.name} (${data.data.id})`);
  return {
    id: data.data.id,
    connection_name: data.data.name,
    active: true,
    webhook_event_url: "",
  };
}

async function assignNumberToConnection(numberId: string, connectionId: string): Promise<void> {
  // Note: Phone numbers are assigned to SIP connections in Telnyx portal
  // For WebRTC credentials, we just need to store the association in our database
  console.log(`📌 Associating number ${numberId} with org credential ${connectionId}...`);
  console.log("   Note: SIP connection assignment is managed via Telnyx portal");
}

async function provisionTenant(orgId: string, assignNumber: boolean = false) {
  console.log("\n🚀 Starting tenant provisioning...\n");

  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Get org info
  console.log("📋 Fetching organization info...");
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .single();

  if (orgError || !org) {
    throw new Error(`Organization not found: ${orgId}`);
  }
  console.log(`   Organization: ${org.name}`);

  // 2. Check if tenant already has a connection
  const { data: existingConnection } = await supabase
    .from("telnyx_connections")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_default", true)
    .single();

  let connectionId: string;

  if (existingConnection) {
    console.log(`✅ Tenant already has a Telnyx connection: ${existingConnection.connection_id}`);
    connectionId = existingConnection.connection_id;
  } else {
    // 3. Create a new Telnyx connection
    const connection = await createTelnyxConnection(orgId, org.name);
    connectionId = connection.id;

    // 4. Save connection to Supabase
    const { error: insertError } = await supabase.from("telnyx_connections").insert({
      org_id: orgId,
      connection_id: connection.id,
      connection_name: connection.connection_name,
      status: "active",
      is_default: true,
      settings: {
        webhook_event_url: connection.webhook_event_url,
      },
    });

    if (insertError) {
      console.error("❌ Failed to save connection to database:", insertError.message);
    } else {
      console.log("✅ Connection saved to database");
    }
  }

  // 5. List available Telnyx numbers
  const numbers = await listTelnyxNumbers();
  
  if (numbers.length === 0) {
    console.log("\n⚠️  No phone numbers found in your Telnyx account.");
    console.log("   Please purchase a number from the Telnyx portal first.\n");
    return;
  }

  // Show available numbers
  console.log("\n📱 Available Telnyx Numbers:");
  console.log("─".repeat(60));
  numbers.forEach((num, i) => {
    const assigned = num.connection_id ? `→ ${num.connection_name}` : "(unassigned)";
    console.log(`   ${i + 1}. ${num.phone_number} ${assigned}`);
  });
  console.log("─".repeat(60));

  if (assignNumber) {
    // Find first unassigned number or first number
    const unassignedNumber = numbers.find(n => !n.connection_id) || numbers[0];
    
    if (unassignedNumber) {
      // Assign the number to the connection
      await assignNumberToConnection(unassignedNumber.id, connectionId);

      // Update phone_numbers table in Supabase
      const { data: existingPhoneRecord } = await supabase
        .from("phone_numbers")
        .select("id")
        .eq("org_id", orgId)
        .eq("telnyx_number", unassignedNumber.phone_number)
        .single();

      if (existingPhoneRecord) {
        // Update existing record
        await supabase
          .from("phone_numbers")
          .update({
            telnyx_number_id: unassignedNumber.id,
            status: "active",
          })
          .eq("id", existingPhoneRecord.id);
        console.log("✅ Updated existing phone number record");
      } else {
        // Create new record
        const { error: phoneError } = await supabase.from("phone_numbers").insert({
          org_id: orgId,
          telnyx_number: unassignedNumber.phone_number,
          telnyx_number_id: unassignedNumber.id,
          display_label: `${org.name} Main Line`,
          status: "active",
          region: "US",
        });

        if (phoneError) {
          console.error("❌ Failed to save phone number:", phoneError.message);
        } else {
          console.log(`✅ Phone number ${unassignedNumber.phone_number} assigned to tenant`);
        }
      }
    }
  }

  console.log("\n✨ Tenant provisioning complete!\n");
  console.log("Summary:");
  console.log(`   Organization: ${org.name}`);
  console.log(`   Org ID: ${orgId}`);
  console.log(`   Telnyx Connection: ${connectionId}`);
  if (assignNumber) {
    console.log(`   Phone Number: Assigned`);
  }
  console.log("");
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes("--help")) {
    console.log(`
Tenant Provisioning Script
===========================

Usage:
  npx tsx scripts/provision-tenant.ts <org_id> [options]

Options:
  --assign-number   Also assign a phone number from your Telnyx account
  --list-numbers    Just list available Telnyx numbers
  --list-orgs       List all organizations in the database
  --help            Show this help message

Examples:
  npx tsx scripts/provision-tenant.ts 59764ad1-b420-4e92-a654-d6284ed5b396
  npx tsx scripts/provision-tenant.ts 59764ad1-b420-4e92-a654-d6284ed5b396 --assign-number
  npx tsx scripts/provision-tenant.ts --list-numbers
`);
    return;
  }

  // Load env
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });

  if (args.includes("--list-numbers")) {
    const numbers = await listTelnyxNumbers();
    console.log("\n📱 Telnyx Phone Numbers:");
    numbers.forEach((num, i) => {
      console.log(`   ${i + 1}. ${num.phone_number} (ID: ${num.id})`);
      console.log(`      Status: ${num.status}`);
      console.log(`      Connection: ${num.connection_name || "None"}`);
    });
    return;
  }

  if (args.includes("--list-orgs")) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } }
    );
    
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name, plan, created_at")
      .order("created_at", { ascending: false });

    console.log("\n🏢 Organizations:");
    orgs?.forEach((org, i) => {
      console.log(`   ${i + 1}. ${org.name}`);
      console.log(`      ID: ${org.id}`);
      console.log(`      Plan: ${org.plan}`);
    });
    return;
  }

  const orgId = args.find(a => !a.startsWith("--"));
  const assignNumber = args.includes("--assign-number");

  if (!orgId) {
    console.error("❌ Please provide an organization ID");
    process.exit(1);
  }

  await provisionTenant(orgId, assignNumber);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
