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
  const { data, error } = await supabase
    .from("knowledge_bases")
    .select("id, name, processing_status, vertex_corpus_id, source_url, source_config")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Knowledge Bases:\n");
  for (const kb of data || []) {
    console.log(`ID: ${kb.id}`);
    console.log(`Name: ${kb.name}`);
    console.log(`Status: ${kb.processing_status}`);
    console.log(`Vertex Corpus: ${kb.vertex_corpus_id || "none"}`);
    console.log(`Source: ${kb.source_url}`);
    console.log(`Crawl Method: ${kb.source_config?.crawl_method || "N/A"}`);
    console.log("---");
  }
}

main().catch(console.error);
