/**
 * Clean up knowledge bases with incorrect URLs
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
  console.log("🧹 Cleaning up knowledge bases...\n");

  // Get all knowledge bases
  const { data: kbs, error } = await supabase
    .from("knowledge_bases")
    .select("id, name, source_url, created_at")
    .order("name")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching KBs:", error);
    return;
  }

  console.log(`Found ${kbs?.length || 0} knowledge bases`);

  // Find ones with incorrect paths
  const incorrectPaths = [
    "/how-it-works",
    "/plans",
    "/trust-score",
    "/positions",
    "/contributions",
    "/ept",
    "/net-zero-interest",
    "/compliance",
    "/security",
    "/help",
    "/account",
  ];

  const toDelete: string[] = [];

  // Find incorrect URLs
  for (const kb of kbs || []) {
    if (incorrectPaths.some((p) => kb.source_url?.includes(p))) {
      toDelete.push(kb.id);
      console.log(`  Marking for delete (bad URL): ${kb.name}`);
    }
  }

  // Find duplicates by name (keep oldest)
  const byName = new Map<string, typeof kbs>();
  for (const kb of kbs || []) {
    if (!byName.has(kb.name)) {
      byName.set(kb.name, []);
    }
    byName.get(kb.name)!.push(kb);
  }

  for (const [name, items] of byName) {
    if (items.length > 1) {
      console.log(`\n⚠️  Duplicate: ${name} (${items.length} copies)`);
      // Keep oldest (first), delete rest
      const toDel = items.slice(1).map((k) => k.id);
      toDelete.push(...toDel);
      console.log(`   Keeping: ${items[0].id}`);
      console.log(`   Deleting: ${toDel.join(", ")}`);
    }
  }

  // Also delete test entries
  const testKbs = kbs?.filter((k) => k.name.toLowerCase().startsWith("test") || k.name.toLowerCase().includes("test")) || [];
  for (const t of testKbs) {
    if (!toDelete.includes(t.id)) {
      toDelete.push(t.id);
      console.log(`  Marking for delete (test): ${t.name}`);
    }
  }

  // Also delete error status KBs
  const errorKbs = kbs?.filter((k) => k.name === "Ajo" || k.name === "v3 Ajopro") || [];
  for (const e of errorKbs) {
    if (!toDelete.includes(e.id)) {
      toDelete.push(e.id);
      console.log(`  Marking for delete (error): ${e.name}`);
    }
  }

  console.log(`Found ${toDelete.length} KBs to delete\n`);

  for (const id of toDelete) {
    const { error: delError } = await supabase
      .from("knowledge_bases")
      .delete()
      .eq("id", id);
    if (delError) {
      console.error(`  ❌ Failed to delete ${id}: ${delError.message}`);
    } else {
      console.log(`  ✅ Deleted: ${id}`);
    }
  }

  // Count remaining
  const { count } = await supabase
    .from("knowledge_bases")
    .select("*", { count: "exact", head: true });

  console.log(`\n📊 Remaining knowledge bases: ${count || 0}`);
  console.log("✅ Cleanup complete!");
}

main().catch(console.error);

