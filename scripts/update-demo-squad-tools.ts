/**
 * Add Composio toolkit tools to demo squad agents
 * Run with: npx tsx scripts/update-demo-squad-tools.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── Load env ─────────────────────────────────────────────────────────────────
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Tools per agent role ──────────────────────────────────────────────────────
// toolkit names match TOOLKIT_TO_APP keys in server/src/gemini/tools.ts
const AGENT_TOOLS: Array<{ name: string; tools: string[]; reason: string }> = [
  // ── Clinic Triage Squad ──────────────────────────────────────────────────
  {
    name: "Appointment Scheduler",
    tools: ["google_calendar", "gmail"],
    reason: "Books calendar events + sends email confirmation to patient",
  },
  {
    name: "Doctor Consultation",
    tools: ["gmail"],
    reason: "Sends follow-up / prescription guidance emails",
  },
  {
    name: "Billing Specialist",
    tools: ["gmail"],
    reason: "Sends billing summaries and payment plan confirmations",
  },
  // ── E-commerce Support Squad ─────────────────────────────────────────────
  {
    name: "Returns & Refunds Specialist",
    tools: ["gmail"],
    reason: "Sends return label and refund confirmation emails",
  },
  {
    name: "VIP Concierge",
    tools: ["gmail"],
    reason: "Sends personalised follow-up and loyalty offers via email",
  },
  {
    name: "Order Support Bot",
    tools: ["gmail"],
    reason: "Sends order status / tracking confirmation emails",
  },
  // ── Property Management Squad ─────────────────────────────────────────────
  {
    name: "Maintenance Specialist",
    tools: ["gmail"],
    reason: "Sends work order confirmation and scheduled visit details",
  },
  {
    name: "Leasing Specialist",
    tools: ["google_calendar", "gmail"],
    reason: "Books property viewing appointments + sends lease info emails",
  },
];

async function main() {
  console.log("🔧 Updating demo squad agents with Composio toolkit tools...\n");

  const { data: userData } = await supabase
    .from("users")
    .select("org_id")
    .eq("email", "francalagbe@gmail.com")
    .maybeSingle();

  if (!userData?.org_id) {
    console.error("❌ Could not find org for francalagbe@gmail.com");
    process.exit(1);
  }

  const orgId = userData.org_id;

  for (const entry of AGENT_TOOLS) {
    // Find the agent by name in this org
    const { data: agents, error: fetchErr } = await supabase
      .from("agents")
      .select("id, name, tools")
      .eq("org_id", orgId)
      .eq("name", entry.name);

    if (fetchErr || !agents?.length) {
      console.warn(`  ⚠ Agent not found: "${entry.name}" — skipping`);
      continue;
    }

    // Update all matching agents (in case there are duplicates from re-runs)
    for (const agent of agents) {
      // Merge existing tools with new ones (deduplicate)
      const existing = (agent.tools as string[]) || [];
      const merged = Array.from(new Set([...existing, ...entry.tools]));

      const { error: updateErr } = await supabase
        .from("agents")
        .update({ tools: merged })
        .eq("id", agent.id);

      if (updateErr) {
        console.error(`  ❌ Failed to update "${entry.name}" (${agent.id}): ${updateErr.message}`);
      } else {
        console.log(`  ✓ ${entry.name} → tools: [${merged.join(", ")}]`);
        console.log(`    (${entry.reason})`);
      }
    }
  }

  console.log("\n✅ Done! Tools added to all demo squad agents.");
  console.log("\nNext step to activate them:");
  console.log("  1. Go to your dashboard → Apps (left sidebar)");
  console.log("  2. Click Connect on Gmail and Google Calendar");
  console.log("  3. Sign in with your Google account");
  console.log("  4. Once connected, the agents can book appointments and send emails automatically");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
