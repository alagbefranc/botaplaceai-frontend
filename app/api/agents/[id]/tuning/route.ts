/**
 * Model Tuning API
 * GET   /api/agents/[id]/tuning  — list tuning jobs for this agent
 * POST  /api/agents/[id]/tuning  — launch a new fine-tuning job
 * PATCH /api/agents/[id]/tuning  — poll / sync Vertex AI job status
 */

import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { ApiRouteError, getOrgMemberContext } from "@/lib/server/org-member";

export const runtime = "nodejs";

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT!;
const LOCATION = process.env.VERTEX_AI_LOCATION ?? "us-central1";
const BUCKET   = process.env.GOOGLE_CLOUD_STORAGE_BUCKET ?? `${PROJECT}-tuning-data`;

// Vertex AI supported models for supervised fine-tuning
// gemini-3-flash-preview is the current model that supports fine-tuning
const TUNABLE_MODELS = ["gemini-3-flash-preview"] as const;

// ── Google Auth helper ───────────────────────────────────────────────────────
let _auth: GoogleAuth | null = null;
function getAuth(): GoogleAuth {
  if (!_auth) {
    const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    _auth = credJson
      ? new GoogleAuth({ credentials: JSON.parse(credJson), scopes: ["https://www.googleapis.com/auth/cloud-platform"] })
      : new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  }
  return _auth;
}

async function getAccessToken(): Promise<string> {
  const client = await getAuth().getClient();
  const res = await client.getAccessToken();
  if (!res.token) throw new Error("Failed to get Google access token");
  return res.token;
}

// ── GCS upload via JSON API ──────────────────────────────────────────────────
async function uploadToGCS(gcsUri: string, content: string): Promise<void> {
  // Parse gs://bucket/path → bucket, objectPath
  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid GCS URI: ${gcsUri}`);
  const [, bucket, objectPath] = match;

  const token = await getAccessToken();
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;

  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/jsonl",
    },
    body: content,
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`GCS upload failed (${resp.status}): ${errBody}`);
  }
}

// ── Vertex AI tuning job helpers ─────────────────────────────────────────────
const VERTEX_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}`;

async function createVertexTuningJob(opts: {
  baseModel: string;
  trainingDataUri: string;
  epochs: number;
  learningRateMultiplier: number;
  displayName: string;
}): Promise<{ name: string; state: string }> {
  const token = await getAccessToken();
  const resp = await fetch(`${VERTEX_BASE}/tuningJobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      baseModel: opts.baseModel,
      supervisedTuningSpec: {
        training_dataset_uri: opts.trainingDataUri,
        hyper_parameters: {
          epoch_count: opts.epochs,
          learning_rate_multiplier: opts.learningRateMultiplier,
        },
      },
      tunedModelDisplayName: opts.displayName,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Vertex tuningJobs.create failed (${resp.status}): ${errBody}`);
  }

  return resp.json();
}

async function getVertexTuningJob(jobName: string): Promise<{
  name: string;
  state: string;
  tunedModel?: { model?: string; endpoint?: string };
  error?: { message?: string };
}> {
  const token = await getAccessToken();
  const resp = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1/${jobName}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    throw new Error(`Vertex tuningJobs.get failed (${resp.status}): ${errBody}`);
  }
  return resp.json();
}

// Map Vertex AI job states to our DB status
function mapVertexState(state: string): "pending" | "running" | "succeeded" | "failed" | "cancelled" {
  switch (state) {
    case "JOB_STATE_PENDING":
    case "JOB_STATE_QUEUED":
      return "pending";
    case "JOB_STATE_RUNNING":
      return "running";
    case "JOB_STATE_SUCCEEDED":
      return "succeeded";
    case "JOB_STATE_FAILED":
    case "JOB_STATE_PARTIALLY_FAILED":
      return "failed";
    case "JOB_STATE_CANCELLED":
    case "JOB_STATE_CANCELLING":
      return "cancelled";
    default:
      return "running";
  }
}

// ── GET — list jobs ──────────────────────────────────────────────────────────
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();

    const { data, error } = await admin
      .from("tuning_jobs")
      .select("*")
      .eq("org_id", member.orgId)
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    if (error instanceof ApiRouteError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to list tuning jobs" }, { status: 500 });
  }
}

// ── POST — launch fine-tuning ────────────────────────────────────────────────
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext({ allowedRoles: ["admin", "editor"] });

    const body = (await request.json().catch(() => null)) as {
      baseModel?: string;
      epochs?: number;
      learningRate?: number;
      batchSize?: number;
    } | null;

    const baseModel   = body?.baseModel   ?? "gemini-3-flash-preview";
    const epochs      = body?.epochs      ?? 3;
    const learningRate = body?.learningRate ?? 0.0002;
    const batchSize   = body?.batchSize   ?? 4;

    if (!TUNABLE_MODELS.includes(baseModel as any)) {
      return NextResponse.json(
        { error: `Model "${baseModel}" does not support fine-tuning. Use: ${TUNABLE_MODELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify agent belongs to org
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id, name, system_prompt, settings")
      .eq("id", agentId)
      .eq("org_id", member.orgId)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Fetch conversation data for training
    const { data: conversations } = await admin
      .from("conversations")
      .select("id")
      .eq("org_id", member.orgId)
      .eq("agent_id", agentId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(500);

    const conversationIds = (conversations ?? []).map((c: any) => c.id);

    if (conversationIds.length < 10) {
      return NextResponse.json(
        { error: "At least 10 completed conversations are needed to start fine-tuning." },
        { status: 400 }
      );
    }

    // Fetch messages
    const { data: messages } = await admin
      .from("messages")
      .select("conversation_id, role, content")
      .in("conversation_id", conversationIds)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true });

    // Build supervised fine-tuning pairs (question/answer format)
    const msgsByConv: Record<string, Array<{ role: string; content: string }>> = {};
    for (const msg of (messages ?? []) as any[]) {
      if (!msgsByConv[msg.conversation_id]) msgsByConv[msg.conversation_id] = [];
      if (msg.content) msgsByConv[msg.conversation_id].push({ role: msg.role, content: msg.content });
    }

    // Build JSONL training pairs (Vertex SFT format)
    // Vertex expects: {"messages": [{"role":"system","content":"..."}, {"role":"user","content":"..."}, {"role":"model","content":"..."}]}
    const trainingPairs: Array<{ messages: Array<{ role: string; content: string }> }> = [];
    for (const convId of conversationIds) {
      const msgs = msgsByConv[convId] ?? [];
      if (msgs.length < 2) continue;
      const systemPrompt = typeof agent.system_prompt === "string" ? agent.system_prompt : "";
      // Vertex uses "model" instead of "assistant" for the AI role
      const vertexMsgs = msgs.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role,
        content: m.content,
      }));
      const formattedMsgs = systemPrompt
        ? [{ role: "system", content: systemPrompt }, ...vertexMsgs]
        : vertexMsgs;
      trainingPairs.push({ messages: formattedMsgs });
    }

    const sampleCount = trainingPairs.length;

    if (sampleCount < 10) {
      return NextResponse.json(
        { error: "Not enough conversation pairs for fine-tuning (minimum 10 required)." },
        { status: 400 }
      );
    }

    const trainingDataUri = `gs://${BUCKET}/tuning/${member.orgId}/${agentId}/${Date.now()}.jsonl`;

    // Create tuning job record in DB
    const { data: job, error: jobError } = await admin
      .from("tuning_jobs")
      .insert({
        org_id: member.orgId,
        agent_id: agentId,
        base_model: baseModel,
        status: "pending",
        epochs,
        learning_rate: learningRate,
        batch_size: batchSize,
        sample_count: sampleCount,
        training_data_uri: trainingDataUri,
      })
      .select("*")
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: jobError?.message ?? "Failed to create tuning job" }, { status: 500 });
    }

    // Upload JSONL to GCS and submit to Vertex AI
    try {
      // 1. Build JSONL content
      const jsonlContent = trainingPairs.map((p) => JSON.stringify(p)).join("\n");
      console.log(`[Tuning] Uploading ${sampleCount} samples (${jsonlContent.length} bytes) to ${trainingDataUri}`);

      // 2. Upload to GCS
      await uploadToGCS(trainingDataUri, jsonlContent);
      console.log(`[Tuning] GCS upload complete`);

      // 3. Submit to Vertex AI
      const agentName = typeof agent.name === "string" ? agent.name : "agent";
      const vertexJob = await createVertexTuningJob({
        baseModel,
        trainingDataUri,
        epochs,
        learningRateMultiplier: learningRate,
        displayName: `${agentName}-sft-${Date.now()}`.slice(0, 128),
      });
      console.log(`[Tuning] Vertex job created: ${vertexJob.name} (state: ${vertexJob.state})`);

      // 4. Update DB with Vertex job name and running status
      await admin
        .from("tuning_jobs")
        .update({
          vertex_job_id: vertexJob.name,
          status: mapVertexState(vertexJob.state),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      job.vertex_job_id = vertexJob.name;
      job.status = mapVertexState(vertexJob.state);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Tuning] Failed to submit Vertex tuning job:", errMsg);
      await admin
        .from("tuning_jobs")
        .update({ status: "failed", error_message: errMsg, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      job.status = "failed";
      job.error_message = errMsg;
    }

    return NextResponse.json({ job, sampleCount }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiRouteError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Failed to launch tuning job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH — poll/sync Vertex AI job status ───────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params;
    const { admin, member } = await getOrgMemberContext();

    const body = (await request.json().catch(() => null)) as { jobId?: string } | null;
    if (!body?.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    // Fetch the DB record
    const { data: job, error: jobError } = await admin
      .from("tuning_jobs")
      .select("*")
      .eq("id", body.jobId)
      .eq("org_id", member.orgId)
      .eq("agent_id", agentId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Tuning job not found" }, { status: 404 });
    }

    // Already terminal? No need to poll
    if (["succeeded", "failed", "cancelled"].includes(job.status)) {
      return NextResponse.json({ job });
    }

    // No Vertex job ID? Can't poll
    if (!job.vertex_job_id) {
      return NextResponse.json({ job, message: "No Vertex job ID — job may not have been submitted" });
    }

    // Poll Vertex AI
    try {
      const vertexJob = await getVertexTuningJob(job.vertex_job_id);
      const newStatus = mapVertexState(vertexJob.state);

      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // If succeeded, capture the tuned model ID
      if (newStatus === "succeeded" && vertexJob.tunedModel?.model) {
        updates.tuned_model_id = vertexJob.tunedModel.model;
      }

      // If failed, capture error
      if (newStatus === "failed" && vertexJob.error?.message) {
        updates.error_message = vertexJob.error.message;
      }

      await admin.from("tuning_jobs").update(updates).eq("id", job.id);

      return NextResponse.json({
        job: { ...job, ...updates },
        vertexState: vertexJob.state,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ job, pollError: errMsg });
    }
  } catch (error) {
    if (error instanceof ApiRouteError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Failed to poll tuning job" }, { status: 500 });
  }
}
