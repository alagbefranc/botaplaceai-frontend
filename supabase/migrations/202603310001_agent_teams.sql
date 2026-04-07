-- ============================================================================
-- Agent Teams Migration
-- Enables multi-agent orchestration with handoffs between specialized agents
-- ============================================================================

-- Agent Teams table
create table if not exists agent_teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  entry_agent_id uuid references agents(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Team Members (agents in a team with specialization)
create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references agent_teams(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  role text not null default 'specialist' check (role in ('entry', 'specialist')),
  specialization text, -- e.g., 'billing', 'technical', 'sales'
  position integer not null default 0, -- for UI ordering
  unique(team_id, agent_id)
);

-- Handoff Rules (rule-based triggers)
create table if not exists handoff_rules (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references agent_teams(id) on delete cascade,
  source_agent_id uuid references agents(id) on delete cascade,
  target_agent_id uuid not null references agents(id) on delete cascade,
  rule_type text not null check (rule_type in ('keyword', 'intent', 'always')),
  conditions jsonb not null default '[]'::jsonb, -- [{keyword: 'billing'}, {intent: 'payment_issue'}]
  priority integer not null default 0,
  context_config jsonb not null default '{"include_summary": true, "variables": []}'::jsonb,
  enabled boolean not null default true
);

-- Context Variables (extracted data passed between agents)
create table if not exists team_context_variables (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references agent_teams(id) on delete cascade,
  name text not null, -- e.g., 'customer_name', 'account_number'
  description text,
  extract_prompt text, -- AI prompt to extract this variable
  required boolean not null default false,
  position integer not null default 0
);

-- Add team_id to conversations for tracking
alter table conversations add column if not exists team_id uuid references agent_teams(id);
alter table conversations add column if not exists current_agent_id uuid references agents(id);

-- Team conversation context (passed between agents)
create table if not exists team_conversation_context (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  team_id uuid not null references agent_teams(id) on delete cascade,
  variables jsonb not null default '{}'::jsonb, -- extracted variables
  summary text, -- AI-generated conversation summary
  handoff_history jsonb not null default '[]'::jsonb, -- [{from_agent, to_agent, reason, timestamp}]
  handoff_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(conversation_id)
);

-- Indexes for performance
create index if not exists idx_agent_teams_org on agent_teams(org_id);
create index if not exists idx_agent_teams_status on agent_teams(status);
create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_agent on team_members(agent_id);
create index if not exists idx_handoff_rules_team on handoff_rules(team_id);
create index if not exists idx_handoff_rules_source on handoff_rules(source_agent_id);
create index if not exists idx_handoff_rules_target on handoff_rules(target_agent_id);
create index if not exists idx_team_context_conversation on team_conversation_context(conversation_id);
create index if not exists idx_team_context_variables_team on team_context_variables(team_id);
create index if not exists idx_conversations_team on conversations(team_id);
create index if not exists idx_conversations_current_agent on conversations(current_agent_id);

-- Enable RLS
alter table agent_teams enable row level security;
alter table team_members enable row level security;
alter table handoff_rules enable row level security;
alter table team_context_variables enable row level security;
alter table team_conversation_context enable row level security;

-- RLS Policies for agent_teams
create policy "Users can view their org teams"
  on agent_teams for select
  using (org_id in (
    select org_id from org_members where user_id = auth.uid()
  ));

create policy "Admins and editors can manage teams"
  on agent_teams for all
  using (org_id in (
    select org_id from org_members 
    where user_id = auth.uid() and role in ('admin', 'editor')
  ));

-- RLS Policies for team_members
create policy "Users can view team members in their org"
  on team_members for select
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  ));

create policy "Admins and editors can manage team members"
  on team_members for all
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members 
      where user_id = auth.uid() and role in ('admin', 'editor')
    )
  ));

-- RLS Policies for handoff_rules
create policy "Users can view handoff rules in their org"
  on handoff_rules for select
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  ));

create policy "Admins and editors can manage handoff rules"
  on handoff_rules for all
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members 
      where user_id = auth.uid() and role in ('admin', 'editor')
    )
  ));

-- RLS Policies for team_context_variables
create policy "Users can view context variables in their org"
  on team_context_variables for select
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  ));

create policy "Admins and editors can manage context variables"
  on team_context_variables for all
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members 
      where user_id = auth.uid() and role in ('admin', 'editor')
    )
  ));

-- RLS Policies for team_conversation_context
create policy "Users can view conversation context in their org"
  on team_conversation_context for select
  using (team_id in (
    select id from agent_teams where org_id in (
      select org_id from org_members where user_id = auth.uid()
    )
  ));

create policy "System can manage conversation context"
  on team_conversation_context for all
  using (true);

-- Trigger to update updated_at
create or replace function update_agent_teams_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger agent_teams_updated_at
  before update on agent_teams
  for each row execute function update_agent_teams_updated_at();

create trigger team_conversation_context_updated_at
  before update on team_conversation_context
  for each row execute function update_agent_teams_updated_at();
