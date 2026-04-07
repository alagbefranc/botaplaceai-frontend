-- ============================================================================
-- CONVERSATION INSIGHTS AND MEMORY SYSTEM
-- Enables AI assistants to recall details from past conversations
-- ============================================================================

-- Conversation Insights table - stores AI-extracted insights from conversations
create table if not exists conversation_insights (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  
  -- User Profile extracted from conversation
  user_profile jsonb default '{}'::jsonb,
  -- Expected structure: { name, email, phone, company, location, language }
  
  -- Intent and Topics
  primary_intent text,
  topics text[] default '{}',
  
  -- Sentiment Analysis
  sentiment text check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  satisfaction_score integer check (satisfaction_score is null or (satisfaction_score between 1 and 5)),
  issue_resolved boolean,
  
  -- Action Items
  action_items jsonb default '[]'::jsonb,
  -- Expected structure: [{ description, assignee, due_date, completed }]
  
  -- Summary
  summary text,
  key_points text[] default '{}',
  
  -- Metadata
  extracted_at timestamptz default now(),
  extraction_model text default 'gemini-1.5-flash',
  
  -- Ensure one insight per conversation
  constraint unique_conversation_insight unique (conversation_id)
);

-- Add conversation_id to usage_logs for per-conversation cost tracking
alter table usage_logs add column if not exists conversation_id uuid references conversations(id) on delete set null;

-- Add input/output token breakdown to usage_logs
alter table usage_logs add column if not exists input_tokens integer default 0;
alter table usage_logs add column if not exists output_tokens integer default 0;
alter table usage_logs add column if not exists model text;

-- Add billing_markup_percentage to organizations metadata (or as column)
-- We'll store it in metadata for flexibility
-- organizations.metadata.billing_markup_percentage

-- Indexes for efficient memory queries
create index if not exists idx_insights_conversation on conversation_insights(conversation_id);
create index if not exists idx_insights_org on conversation_insights(org_id);
create index if not exists idx_insights_org_extracted on conversation_insights(org_id, extracted_at desc);
create index if not exists idx_insights_user_phone on conversation_insights(org_id, (user_profile->>'phone')) where user_profile->>'phone' is not null;
create index if not exists idx_insights_user_email on conversation_insights(org_id, (user_profile->>'email')) where user_profile->>'email' is not null;
create index if not exists idx_usage_conversation on usage_logs(conversation_id) where conversation_id is not null;

-- Enable RLS
alter table conversation_insights enable row level security;

-- RLS Policies for conversation_insights
drop policy if exists insights_select on conversation_insights;
create policy insights_select on conversation_insights
for select using (org_id = current_org_id());

drop policy if exists insights_insert on conversation_insights;
create policy insights_insert on conversation_insights
for insert with check (org_id = current_org_id());

drop policy if exists insights_update on conversation_insights;
create policy insights_update on conversation_insights
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists insights_delete on conversation_insights;
create policy insights_delete on conversation_insights
for delete using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));
