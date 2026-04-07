-- ============================================================================
-- Vertex AI Features Migration
-- Adds: context caching, model tuning jobs, batch prediction jobs
-- ============================================================================

-- ── Context Caching ──────────────────────────────────────────────────────────
-- Store the Vertex cached content ID per agent so system prompts
-- aren't re-sent on every conversation turn.
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS vertex_cache_id       text,
  ADD COLUMN IF NOT EXISTS vertex_cache_expires_at timestamptz;

COMMENT ON COLUMN agents.vertex_cache_id        IS 'Vertex AI cached content name (e.g. cachedContents/abc123)';
COMMENT ON COLUMN agents.vertex_cache_expires_at IS 'When the cached content expires on Vertex; auto-refreshed on agent save';

-- ── Model Tuning Jobs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tuning_jobs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id          uuid        REFERENCES agents(id) ON DELETE SET NULL,
  -- Vertex AI tuning job resource name
  vertex_job_id     text,
  -- e.g. gemini-3-flash-preview
  base_model        text        NOT NULL,
  -- Set once tuning completes: the tuned model endpoint name
  tuned_model_id    text,
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  -- Training hyper-parameters
  epochs            integer     NOT NULL DEFAULT 3,
  learning_rate     numeric(8,6) DEFAULT 0.0002,
  batch_size        integer     DEFAULT 4,
  -- How many conversation pairs were used
  sample_count      integer     NOT NULL DEFAULT 0,
  -- GCS URI of the uploaded JSONL training file
  training_data_uri text,
  -- Vertex AI job error message if status = failed
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tuning_jobs_org     ON tuning_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_tuning_jobs_agent   ON tuning_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_tuning_jobs_status  ON tuning_jobs(status);

-- RLS
ALTER TABLE tuning_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tuning_jobs_select ON tuning_jobs
  FOR SELECT USING (org_id = current_org_id());
CREATE POLICY tuning_jobs_insert ON tuning_jobs
  FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY tuning_jobs_update ON tuning_jobs
  FOR UPDATE USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY tuning_jobs_delete ON tuning_jobs
  FOR DELETE USING (org_id = current_org_id() AND current_org_role() = 'admin');

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_tuning_jobs_updated_at ON tuning_jobs;
CREATE TRIGGER trg_tuning_jobs_updated_at
  BEFORE UPDATE ON tuning_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Batch Prediction Jobs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batch_jobs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id         uuid        REFERENCES agents(id) ON DELETE SET NULL,
  -- Job type: conversation analysis, insight extraction, etc.
  job_type         text        NOT NULL DEFAULT 'conversation_analysis'
                   CHECK (job_type IN ('conversation_analysis', 'insight_extraction', 'sentiment_analysis')),
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  -- Vertex batch prediction job name
  vertex_job_id    text,
  -- Date range of conversations included
  date_from        timestamptz,
  date_to          timestamptz,
  -- Number of conversations/records processed
  input_count      integer     NOT NULL DEFAULT 0,
  output_count     integer     DEFAULT 0,
  -- GCS URI where results are written
  output_gcs_uri   text,
  -- Input JSONL GCS URI
  input_gcs_uri    text,
  -- Model used for the batch job
  model            text        NOT NULL DEFAULT 'gemini-3-flash-preview',
  error_message    text,
  -- Cost of the batch job in cents
  cost_cents       integer     DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_org     ON batch_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_agent   ON batch_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status  ON batch_jobs(status);

-- RLS
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY batch_jobs_select ON batch_jobs
  FOR SELECT USING (org_id = current_org_id());
CREATE POLICY batch_jobs_insert ON batch_jobs
  FOR INSERT WITH CHECK (org_id = current_org_id());
CREATE POLICY batch_jobs_update ON batch_jobs
  FOR UPDATE USING (org_id = current_org_id()) WITH CHECK (org_id = current_org_id());
CREATE POLICY batch_jobs_delete ON batch_jobs
  FOR DELETE USING (org_id = current_org_id() AND current_org_role() = 'admin');

DROP TRIGGER IF EXISTS trg_batch_jobs_updated_at ON batch_jobs;
CREATE TRIGGER trg_batch_jobs_updated_at
  BEFORE UPDATE ON batch_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Vision support ────────────────────────────────────────────────────────────
-- Allow messages to carry image attachments (base64 data URI or GCS URL)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN messages.attachments IS 'Array of {type:"image",mimeType:"image/jpeg",data:"base64..."} objects';
