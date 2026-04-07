-- Custom AI Insights System
-- Adds custom insight definitions, groups, and results tables

-- Custom insight definitions (user-created)
create table insight_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade, -- NULL for templates
  name text not null,
  description text,
  insight_type text not null check (insight_type in ('structured', 'unstructured')),
  schema jsonb, -- For structured: { parameters: [...] }
  prompt text,  -- For unstructured: free-form extraction prompt
  is_template boolean default false,
  template_category text, -- healthcare, sales, support, etc.
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Insight groups (bundles multiple insights with webhook)
create table insight_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  webhook_url text,
  webhook_enabled boolean default false,
  insight_ids uuid[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Extracted custom insights (results per conversation)
create table custom_insight_results (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  definition_id uuid not null references insight_definitions(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  result jsonb not null,
  extracted_at timestamptz default now()
);

-- Webhook delivery logs for debugging
create table insight_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references insight_groups(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  payload jsonb not null,
  response_status integer,
  response_body text,
  success boolean default false,
  error_message text,
  delivered_at timestamptz default now()
);

-- Indexes for performance
create index idx_insight_definitions_org on insight_definitions(org_id);
create index idx_insight_definitions_template on insight_definitions(is_template, template_category) where is_template = true;
create index idx_insight_groups_org on insight_groups(org_id);
create index idx_custom_insight_results_conv on custom_insight_results(conversation_id);
create index idx_custom_insight_results_def on custom_insight_results(definition_id);
create index idx_custom_insight_results_org on custom_insight_results(org_id);
create index idx_insight_webhook_logs_group on insight_webhook_logs(group_id);

-- RLS Policies
alter table insight_definitions enable row level security;
alter table insight_groups enable row level security;
alter table custom_insight_results enable row level security;
alter table insight_webhook_logs enable row level security;

-- Insight Definitions policies
create policy definitions_select on insight_definitions
  for select using (org_id = current_org_id() or is_template = true);

create policy definitions_insert on insight_definitions
  for insert with check (org_id = current_org_id());

create policy definitions_update on insight_definitions
  for update using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));

create policy definitions_delete on insight_definitions
  for delete using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));

-- Insight Groups policies
create policy groups_select on insight_groups
  for select using (org_id = current_org_id());

create policy groups_insert on insight_groups
  for insert with check (org_id = current_org_id());

create policy groups_update on insight_groups
  for update using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));

create policy groups_delete on insight_groups
  for delete using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));

-- Custom Insight Results policies
create policy results_select on custom_insight_results
  for select using (org_id = current_org_id());

create policy results_insert on custom_insight_results
  for insert with check (org_id = current_org_id());

create policy results_delete on custom_insight_results
  for delete using (org_id = current_org_id() and current_user_role() in ('admin', 'editor'));

-- Webhook Logs policies (admin only)
create policy logs_select on insight_webhook_logs
  for select using (org_id = current_org_id() and current_user_role() = 'admin');

-- Updated_at trigger function (reuse if exists)
create or replace function update_insight_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger insight_definitions_updated_at
  before update on insight_definitions
  for each row execute function update_insight_updated_at();

create trigger insight_groups_updated_at
  before update on insight_groups
  for each row execute function update_insight_updated_at();

-- Note: Template definitions should be inserted via a separate seed script
-- See supabase/seeds/insight_templates.sql
