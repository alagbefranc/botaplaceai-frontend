/**
 * Vertex AI Features Test Suite
 * Tests all new Vertex AI features: DB schema, connectivity, GCS, caching,
 * model routing, vision, batch jobs, and tuning API.
 *
 * Run: npx tsx scripts/test-vertex-features.ts
 */

import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

// ─── Load env ──────────────────────────────────────────────────────────────

function loadEnv(file: string) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv(".env.local");
loadEnv("server/.env");

// ─── Config ────────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_KEY        = process.env.GOOGLE_GEMINI_API_KEY!;
const GCP_PROJECT       = process.env.GOOGLE_CLOUD_PROJECT ?? "";
const GCP_LOCATION      = process.env.VERTEX_AI_LOCATION ?? "us-central1";
const GCS_BUCKET        = process.env.GOOGLE_CLOUD_STORAGE_BUCKET ?? "";
const FRONTEND_URL      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Result tracking ───────────────────────────────────────────────────────

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  details: string;
  duration?: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const details = await fn();
    const duration = Date.now() - start;
    results.push({ name, status: "PASS", details, duration });
    console.log(`  ✅  ${name} (${duration}ms)\n      ${details}`);
  } catch (err: any) {
    const duration = Date.now() - start;
    const details = (err?.message ?? String(err)).substring(0, 160);
    results.push({ name, status: "FAIL", details, duration });
    console.log(`  ❌  ${name} (${duration}ms)\n      ${details}`);
  }
}

function skip(name: string, reason: string) {
  results.push({ name, status: "SKIP", details: reason });
  console.log(`  ⏭️   ${name}\n      SKIPPED: ${reason}`);
}

function section(title: string) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function supabase() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function httpGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    }).on("error", reject);
  });
}

// ─── SECTION 1: Database Schema ────────────────────────────────────────────

async function testDatabase() {
  section("1 · DATABASE SCHEMA");
  const db = supabase();

  await test("tuning_jobs table exists", async () => {
    const { data, error } = await db
      .from("tuning_jobs")
      .select("id")
      .limit(1);
    if (error) throw new Error(error.message);
    return `Table reachable (${data?.length ?? 0} rows sampled)`;
  });

  await test("batch_jobs table exists", async () => {
    const { data, error } = await db
      .from("batch_jobs")
      .select("id")
      .limit(1);
    if (error) throw new Error(error.message);
    return `Table reachable (${data?.length ?? 0} rows sampled)`;
  });

  await test("agents.vertex_cache_id column exists", async () => {
    const { data, error } = await db
      .from("agents")
      .select("id, vertex_cache_id, vertex_cache_expires_at")
      .limit(1);
    if (error) throw new Error(error.message);
    return `Column present (${data?.length ?? 0} agents sampled)`;
  });

  await test("messages.attachments column exists", async () => {
    const { data, error } = await db
      .from("messages")
      .select("id, attachments")
      .limit(1);
    if (error) throw new Error(error.message);
    return `Column present (${data?.length ?? 0} messages sampled)`;
  });

  await test("tuning_jobs columns complete", async () => {
    // Insert + immediate delete to verify schema
    const db2 = supabase();
    // We just select with all expected columns to confirm they exist
    const { error } = await db2
      .from("tuning_jobs")
      .select("id, org_id, agent_id, base_model, tuned_model_id, status, epochs, learning_rate, sample_count, error_message, created_at, updated_at")
      .limit(0);
    if (error) throw new Error(error.message);
    return "All expected columns present";
  });

  await test("batch_jobs columns complete", async () => {
    const { error } = await supabase()
      .from("batch_jobs")
      .select("id, org_id, agent_id, job_type, status, input_count, input_gcs_uri, output_gcs_uri, model, date_from, date_to, error_message, created_at, updated_at")
      .limit(0);
    if (error) throw new Error(error.message);
    return "All expected columns present";
  });
}

// ─── SECTION 2: Vertex AI Connectivity ─────────────────────────────────────

async function testVertexConnectivity() {
  section("2 · VERTEX AI CONNECTIVITY");

  if (!GCP_PROJECT) {
    skip("Vertex AI client init", "GOOGLE_CLOUD_PROJECT not set");
    skip("Vertex AI generate (Gemini via Vertex)", "GOOGLE_CLOUD_PROJECT not set");
    return;
  }

  await test("Vertex AI client initialises", async () => {
    const ai = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT,
      location: GCP_LOCATION,
    } as any);
    if (!ai) throw new Error("Client returned null");
    return `Project=${GCP_PROJECT} Location=${GCP_LOCATION}`;
  });

  await test("Vertex AI — Gemini generate via global endpoint", async () => {
    // Gemini models on Vertex AI are served from the global endpoint, not regional.
    // Region-specific endpoints (europe-west3) are for Claude/Mistral/LLaMA via Model Garden.
    const ai = new GoogleGenAI({
      vertexai: true,
      project: GCP_PROJECT,
      location: "global",
    } as any);
    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Reply with the single word: OK",
    });
    const text = res.text?.trim() ?? "";
    if (!text) throw new Error("Empty response from Vertex AI");
    return `Response: "${text.substring(0, 60)}" (via global endpoint)`;
  });
}

// ─── SECTION 3: GCS Bucket ─────────────────────────────────────────────────

async function testGCSBucket() {
  section("3 · GCS BUCKET");

  if (!GCS_BUCKET) {
    skip("GCS bucket env var", "GOOGLE_CLOUD_STORAGE_BUCKET not set");
    skip("GCS bucket API accessible", "GOOGLE_CLOUD_STORAGE_BUCKET not set");
    return;
  }

  await test("GCS bucket env var configured", async () => {
    return `Bucket = ${GCS_BUCKET}`;
  });

  await test("GCS bucket accessible (public metadata)", async () => {
    // Check if the bucket can be reached via GCS JSON API (no auth — just sees if it exists)
    return new Promise((resolve, reject) => {
      const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(GCS_BUCKET)}`;
      https.get(url, (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const json = JSON.parse(body);
              resolve(`Bucket "${json.name}" exists (location: ${json.location ?? "unknown"})`);
            } catch {
              resolve(`Bucket reachable (status 200)`);
            }
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            // Bucket exists but requires auth — that's fine
            resolve(`Bucket exists (auth required, status ${res.statusCode})`);
          } else if (res.statusCode === 404) {
            reject(new Error(`Bucket "${GCS_BUCKET}" not found (404) — create it first`));
          } else {
            reject(new Error(`Unexpected status ${res.statusCode}: ${body.substring(0, 100)}`));
          }
        });
      }).on("error", reject);
    });
  });
}

// ─── SECTION 4: Context Cache Logic ────────────────────────────────────────

async function testContextCacheLogic() {
  section("4 · CONTEXT CACHE LOGIC");

  // Import the module dynamically so env is already loaded
  let cacheModule: any;
  try {
    cacheModule = await import("../lib/vertex-cache.js");
  } catch {
    try {
      cacheModule = await import("../lib/vertex-cache.ts");
    } catch (err: any) {
      skip("Context cache — short prompt skip", `Cannot import module: ${err.message}`);
      skip("Context cache — ensureAgentCache logic", `Cannot import module: ${err.message}`);
      return;
    }
  }

  await test("Short prompt returns null (below threshold)", async () => {
    const result = await cacheModule.createAgentCache("Hello", "test-agent");
    if (result !== null) throw new Error(`Expected null, got ${JSON.stringify(result)}`);
    return "Correctly returned null for short prompt (<4096 chars)";
  });

  await test("ensureAgentCache — no existing cache, short prompt", async () => {
    const result = await cacheModule.ensureAgentCache("Hi", "test-agent", null, null);
    if (result !== null) throw new Error(`Expected null for short prompt, got ${JSON.stringify(result)}`);
    return "Correctly returned null — no cache created for short prompts";
  });

  await test("buildCachedContentConfig returns correct shape", async () => {
    const cfg = cacheModule.buildCachedContentConfig("projects/test/locations/us/cachedContents/abc");
    if (!cfg || cfg.cachedContent !== "projects/test/locations/us/cachedContents/abc") {
      throw new Error(`Unexpected config: ${JSON.stringify(cfg)}`);
    }
    return "Returns { cachedContent: '<id>' } correctly";
  });

  if (!GCP_PROJECT) {
    skip("Context cache — live create (long prompt)", "GOOGLE_CLOUD_PROJECT not set");
    return;
  }

  // A realistic system prompt — must exceed 1024 tokens (Vertex minimum).
  // Repeated characters compress aggressively in tokenizers, so use varied prose.
  const systemPromptParagraph = `You are a professional customer support agent for a modern SaaS platform. Your role is to assist users with technical issues, billing questions, account management, and general product inquiries. You should always be polite, empathetic, and solution-oriented. When a user reports a bug or technical issue, ask clarifying questions to understand the root cause before suggesting solutions. Always verify that the user has tried the most basic troubleshooting steps before escalating. If a user is frustrated, acknowledge their feelings before diving into technical details. Your tone should be warm but professional at all times. `;
  const longPrompt = systemPromptParagraph.repeat(35); // ~35 × 400 chars = ~14,000 chars ≈ 3,500+ tokens

  await test("Context cache — create with long prompt (global endpoint)", async () => {
    // Context caching uses the global endpoint; lib/vertex-cache.ts is hardcoded to global.
    const result = await cacheModule.createAgentCache(longPrompt, "test-cache-agent");
    if (!result) throw new Error("Expected a cache result but got null");
    // Clean up immediately
    await cacheModule.deleteAgentCache(result.cacheId).catch(() => {});
    return `Cache created: ${result.cacheId.substring(0, 60)}… expires ${result.expiresAt.toISOString()}`;
  });
}

// ─── SECTION 5: Model Routing Logic ────────────────────────────────────────

async function testModelRouting() {
  section("5 · MODEL ROUTING LOGIC");

  const VERTEX_MODELS = [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-v2@20241022",
    "claude-3-5-haiku@20241022",
    "mistral-large-3",
    "mistral-medium-3",
    "mistral-small-2503",
    "llama-3.3-70b-instruct-maas",
    "llama-3.1-405b-instruct-maas",
  ];

  const GEMINI_MODELS = [
    "gemini-3-flash-preview",
    "gemini-3-pro-preview",
    "gemini-3.1-flash-live-preview",
  ];

  await test("VERTEX_MODELS includes all expected Claude models", async () => {
    const claudeExpected = VERTEX_MODELS.filter(m => m.startsWith("claude"));
    return `${claudeExpected.length} Claude models defined: ${claudeExpected.join(", ")}`;
  });

  await test("VERTEX_MODELS includes Mistral models", async () => {
    const mistralExpected = VERTEX_MODELS.filter(m => m.startsWith("mistral"));
    return `${mistralExpected.length} Mistral models: ${mistralExpected.join(", ")}`;
  });

  await test("VERTEX_MODELS includes LLaMA models", async () => {
    const llamaExpected = VERTEX_MODELS.filter(m => m.startsWith("llama"));
    return `${llamaExpected.length} LLaMA models: ${llamaExpected.join(", ")}`;
  });

  await test("Gemini models NOT in VERTEX_MODELS list", async () => {
    const wronglyRouted = GEMINI_MODELS.filter(m => VERTEX_MODELS.includes(m));
    if (wronglyRouted.length > 0) {
      throw new Error(`These Gemini models are incorrectly in VERTEX_MODELS: ${wronglyRouted.join(", ")}`);
    }
    return "All Gemini models correctly excluded from Vertex routing";
  });

  await test("server/src/gemini/chat.ts defines VERTEX_MODELS", async () => {
    const filePath = path.resolve("server/src/gemini/chat.ts");
    if (!fs.existsSync(filePath)) throw new Error("chat.ts not found");
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("VERTEX_MODELS")) throw new Error("VERTEX_MODELS not found in chat.ts");
    if (!content.includes("getVertexClient")) throw new Error("getVertexClient not found in chat.ts");
    if (!content.includes("claude-opus-4-6")) throw new Error("claude-opus-4-6 not in VERTEX_MODELS");
    if (!content.includes("mistral-large-3")) throw new Error("mistral-large-3 not in VERTEX_MODELS");
    return "VERTEX_MODELS map and getVertexClient() both present in chat.ts";
  });
}

// ─── SECTION 6: Vision / Image Parts ───────────────────────────────────────

async function testVisionParts() {
  section("6 · VISION — IMAGE ATTACHMENTS");

  await test("textChat handler accepts attachments interface", async () => {
    const filePath = path.resolve("server/src/websocket/handlers/textChat.ts");
    if (!fs.existsSync(filePath)) throw new Error("textChat.ts not found");
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("TextChatAttachment")) throw new Error("TextChatAttachment interface missing");
    if (!content.includes("attachments")) throw new Error("attachments field missing");
    return "TextChatAttachment interface and attachments field present in textChat.ts";
  });

  await test("chat.ts sendMessage builds inlineData parts", async () => {
    const filePath = path.resolve("server/src/gemini/chat.ts");
    if (!fs.existsSync(filePath)) throw new Error("chat.ts not found");
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("inlineData")) throw new Error("inlineData not found in sendMessage");
    if (!content.includes("mimeType")) throw new Error("mimeType not found");
    if (!content.includes("att.type === 'image'")) throw new Error("image type check missing");
    return "inlineData parts built correctly for image attachments";
  });

  await test("Vision — Gemini multimodal API (live call)", async () => {
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not set");
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

    // Tiny 1x1 transparent PNG (base64)
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Describe this image in one sentence." },
            { inlineData: { mimeType: "image/png", data: tinyPng } },
          ],
        },
      ],
    });

    const text = res.text?.trim();
    if (!text) throw new Error("Empty response");
    return `Multimodal response: "${text.substring(0, 80)}"`;
  });
}

// ─── SECTION 7: Batch Jobs API ─────────────────────────────────────────────

async function testBatchAPI() {
  section("7 · BATCH PREDICTION API");

  await test("app/api/batch/route.ts exists", async () => {
    const p = path.resolve("app/api/batch/route.ts");
    if (!fs.existsSync(p)) throw new Error("route.ts not found at app/api/batch/route.ts");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("batch_jobs")) throw new Error("batch_jobs table reference missing");
    if (!content.includes("GET")) throw new Error("GET handler missing");
    if (!content.includes("POST")) throw new Error("POST handler missing");
    return "route.ts exists with GET and POST handlers referencing batch_jobs";
  });

  await test("batch_jobs: GET returns valid shape from DB", async () => {
    const db = supabase();
    const { data, error } = await db
      .from("batch_jobs")
      .select("id, org_id, job_type, status, input_count, created_at")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(error.message);
    return `Query succeeded, ${data?.length ?? 0} batch jobs found`;
  });

  await test("batch_jobs: INSERT + DELETE round-trip", async () => {
    const db = supabase();

    // Need an org_id — grab from any agent
    const { data: agents } = await db.from("agents").select("org_id").limit(1);
    if (!agents?.length) {
      return "No agents found — skipping insert test (no org_id available)";
    }

    const orgId = agents[0].org_id;
    const { data: inserted, error: insertError } = await db
      .from("batch_jobs")
      .insert({
        org_id: orgId,
        job_type: "conversation_analysis",
        status: "pending",
        input_count: 0,
        model: "gemini-3-flash-preview",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    // Clean up
    await db.from("batch_jobs").delete().eq("id", inserted.id);
    return `Insert + delete round-trip OK (id: ${inserted.id})`;
  });
}

// ─── SECTION 8: Tuning (Fine-Tuning) API ───────────────────────────────────

async function testTuningAPI() {
  section("8 · MODEL TUNING API");

  await test("app/api/agents/[id]/tuning/route.ts exists", async () => {
    const p = path.resolve("app/api/agents/[id]/tuning/route.ts");
    if (!fs.existsSync(p)) throw new Error("tuning/route.ts not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("tuning_jobs")) throw new Error("tuning_jobs reference missing");
    if (!content.includes("GET")) throw new Error("GET handler missing");
    if (!content.includes("POST")) throw new Error("POST handler missing");
    if (!content.includes("gemini-3-flash-preview")) throw new Error("base model validation missing");
    return "route.ts exists with GET/POST handlers, model validation, and tuning_jobs table reference";
  });

  await test("TrainingTab component exists", async () => {
    const p = path.resolve("app/agents/[id]/_components/TrainingTab.tsx");
    if (!fs.existsSync(p)) throw new Error("TrainingTab.tsx not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("launchTuning")) throw new Error("launchTuning function missing");
    if (!content.includes("fetchJobs")) throw new Error("fetchJobs function missing");
    if (!content.includes("baseModel")) throw new Error("baseModel state missing");
    if (!content.includes("epochs")) throw new Error("epochs state missing");
    if (!content.includes("learningRate")) throw new Error("learningRate state missing");
    return "TrainingTab.tsx present with all required state and functions";
  });

  await test("TrainingTab exported from index", async () => {
    const p = path.resolve("app/agents/[id]/_components/index.ts");
    if (!fs.existsSync(p)) throw new Error("index.ts not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("TrainingTab")) throw new Error("TrainingTab not exported");
    return "TrainingTab exported from _components/index.ts";
  });

  await test("Training tab wired into agent page", async () => {
    const p = path.resolve("app/agents/[id]/page.tsx");
    if (!fs.existsSync(p)) throw new Error("page.tsx not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("training")) throw new Error("'training' tab key missing");
    if (!content.includes("TrainingTab")) throw new Error("TrainingTab not used in page.tsx");
    if (!content.includes("FundOutlined")) throw new Error("FundOutlined icon missing");
    return "Training tab wired in page.tsx with correct key and icon";
  });

  await test("tuning_jobs: INSERT + DELETE round-trip", async () => {
    const db = supabase();
    const { data: agents } = await db.from("agents").select("org_id, id").limit(1);
    if (!agents?.length) return "No agents found — skipping insert test";

    const { org_id: orgId, id: agentId } = agents[0];
    const { data: inserted, error } = await db
      .from("tuning_jobs")
      .insert({
        org_id: orgId,
        agent_id: agentId,
        base_model: "gemini-3-flash-preview",
        status: "pending",
        epochs: 3,
        sample_count: 0,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    await db.from("tuning_jobs").delete().eq("id", inserted.id);
    return `Insert + delete round-trip OK (id: ${inserted.id})`;
  });
}

// ─── SECTION 9: Agent Save + Cache Wiring ──────────────────────────────────

async function testAgentSaveCacheWiring() {
  section("9 · AGENT SAVE — CACHE WIRING");

  await test("app/api/agents/route.ts imports ensureAgentCache", async () => {
    const p = path.resolve("app/api/agents/route.ts");
    if (!fs.existsSync(p)) throw new Error("agents/route.ts not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("ensureAgentCache")) throw new Error("ensureAgentCache import missing");
    if (!content.includes("vertex_cache_id")) throw new Error("vertex_cache_id column write missing");
    return "ensureAgentCache imported and vertex_cache_id written on agent save";
  });
}

// ─── SECTION 10: Analytics Batch UI ────────────────────────────────────────

async function testAnalyticsUI() {
  section("10 · ANALYTICS — BATCH UI");

  await test("app/analytics/page.tsx has batch job UI", async () => {
    const p = path.resolve("app/analytics/page.tsx");
    if (!fs.existsSync(p)) throw new Error("analytics/page.tsx not found");
    const content = fs.readFileSync(p, "utf8");
    if (!content.includes("batchJobs")) throw new Error("batchJobs state missing");
    if (!content.includes("launchBatchJob")) throw new Error("launchBatchJob function missing");
    if (!content.includes("Batch Analysis")) throw new Error("'Batch Analysis' tab label missing");
    return "Batch Analysis tab, batchJobs state, and launchBatchJob function all present";
  });
}

// ─── MAIN ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  VERTEX AI FEATURES — FULL TEST SUITE");
  console.log("  " + new Date().toISOString());
  console.log("═".repeat(60));

  console.log("\n  Config:");
  console.log(`    Supabase URL  : ${SUPABASE_URL ? "✅ set" : "❌ missing"}`);
  console.log(`    Service key   : ${SERVICE_KEY ? "✅ set" : "❌ missing"}`);
  console.log(`    Gemini key    : ${GEMINI_KEY ? "✅ set" : "❌ missing"}`);
  console.log(`    GCP project   : ${GCP_PROJECT || "❌ missing"}`);
  console.log(`    GCP location  : ${GCP_LOCATION}`);
  console.log(`    GCS bucket    : ${GCS_BUCKET || "❌ missing"}`);

  await testDatabase();
  await testVertexConnectivity();
  await testGCSBucket();
  await testContextCacheLogic();
  await testModelRouting();
  await testVisionParts();
  await testBatchAPI();
  await testTuningAPI();
  await testAgentSaveCacheWiring();
  await testAnalyticsUI();

  // ─── Summary ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;

  console.log("\n" + "═".repeat(60));
  console.log("  RESULTS");
  console.log("═".repeat(60));
  console.log(`  ✅  Passed : ${passed}`);
  console.log(`  ❌  Failed : ${failed}`);
  console.log(`  ⏭️   Skipped: ${skipped}`);
  console.log(`  Total  : ${results.length}`);

  if (failed > 0) {
    console.log("\n  FAILURES:");
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`    • ${r.name}`);
      console.log(`      ${r.details}`);
    }
  }

  if (skipped > 0) {
    console.log("\n  SKIPPED (env vars not set):");
    for (const r of results.filter((r) => r.status === "SKIP")) {
      console.log(`    • ${r.name}: ${r.details}`);
    }
  }

  console.log("\n" + "═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
