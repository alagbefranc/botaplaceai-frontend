create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  settings jsonb not null default '{}'::jsonb,
  billing_email text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'admin' check (role in ('admin', 'editor', 'viewer')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  system_prompt text,
  voice text not null default 'Puck',
  tools text[] not null default '{}',
  channels text[] not null default '{web_chat}',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused')),
  greeting_message text not null default 'Hi! How can I help you today?',
  widget_config jsonb not null default '{"color":"#6C5CE7","position":"bottom-right","auto_open":false}'::jsonb,
  knowledge_base_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  channel text not null check (channel in ('web_chat', 'web_voice', 'phone', 'whatsapp', 'sms', 'slack', 'email')),
  external_user_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text,
  tool_calls jsonb,
  audio_url text,
  created_at timestamptz not null default now()
);

create table if not exists tool_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  toolkit text not null,
  composio_connection_id text,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error', 'pending')),
  connected_at timestamptz not null default now()
);

create table if not exists phone_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  telnyx_number text not null,
  telnyx_number_id text,
  display_label text,
  region text,
  status text not null default 'active' check (status in ('active', 'inactive', 'provisioning')),
  created_at timestamptz not null default now()
);

create table if not exists knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  name text,
  file_path text,
  file_size_bytes bigint,
  chunks_count integer not null default 0,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'ready', 'error')),
  created_at timestamptz not null default now()
);

create table if not exists usage_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  channel text,
  duration_seconds integer not null default 0,
  tokens_used integer not null default 0,
  tool_calls_count integer not null default 0,
  cost_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agents_updated_at on agents;
create trigger trg_agents_updated_at
before update on agents
for each row execute function set_updated_at();

create or replace function current_org_id()
returns uuid
language sql
stable
as $$
  select users.org_id
  from users
  where users.id = auth.uid()
  limit 1;
$$;

create or replace function current_org_role()
returns text
language sql
stable
as $$
  select users.role
  from users
  where users.id = auth.uid()
  limit 1;
$$;

alter table organizations enable row level security;
alter table users enable row level security;
alter table agents enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table tool_connections enable row level security;
alter table phone_numbers enable row level security;
alter table knowledge_bases enable row level security;
alter table usage_logs enable row level security;

drop policy if exists organizations_select on organizations;
create policy organizations_select on organizations
for select using (id = current_org_id());

drop policy if exists organizations_update on organizations;
create policy organizations_update on organizations
for update using (id = current_org_id()) with check (id = current_org_id());

drop policy if exists users_select on users;
create policy users_select on users
for select using (org_id = current_org_id());

drop policy if exists users_insert on users;
create policy users_insert on users
for insert with check (org_id = current_org_id());

drop policy if exists users_update on users;
create policy users_update on users
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists users_delete on users;
create policy users_delete on users
for delete using (org_id = current_org_id() and current_org_role() = 'admin');

drop policy if exists agents_select on agents;
create policy agents_select on agents
for select using (org_id = current_org_id());

drop policy if exists agents_insert on agents;
create policy agents_insert on agents
for insert with check (org_id = current_org_id());

drop policy if exists agents_update on agents;
create policy agents_update on agents
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists agents_delete on agents;
create policy agents_delete on agents
for delete using (org_id = current_org_id() and current_org_role() = 'admin');

drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations
for select using (org_id = current_org_id());

drop policy if exists conversations_insert on conversations;
create policy conversations_insert on conversations
for insert with check (org_id = current_org_id());

drop policy if exists conversations_update on conversations;
create policy conversations_update on conversations
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists conversations_delete on conversations;
create policy conversations_delete on conversations
for delete using (org_id = current_org_id() and current_org_role() = 'admin');

drop policy if exists messages_select on messages;
create policy messages_select on messages
for select using (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.org_id = current_org_id()
  )
);

drop policy if exists messages_insert on messages;
create policy messages_insert on messages
for insert with check (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.org_id = current_org_id()
  )
);

drop policy if exists messages_update on messages;
create policy messages_update on messages
for update using (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.org_id = current_org_id()
  )
);

drop policy if exists messages_delete on messages;
create policy messages_delete on messages
for delete using (
  exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
      and conversations.org_id = current_org_id()
  ) and current_org_role() in ('admin', 'editor')
);

drop policy if exists tool_connections_select on tool_connections;
create policy tool_connections_select on tool_connections
for select using (org_id = current_org_id());

drop policy if exists tool_connections_insert on tool_connections;
create policy tool_connections_insert on tool_connections
for insert with check (org_id = current_org_id());

drop policy if exists tool_connections_update on tool_connections;
create policy tool_connections_update on tool_connections
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists tool_connections_delete on tool_connections;
create policy tool_connections_delete on tool_connections
for delete using (org_id = current_org_id() and current_org_role() in ('admin', 'editor'));

drop policy if exists phone_numbers_select on phone_numbers;
create policy phone_numbers_select on phone_numbers
for select using (org_id = current_org_id());

drop policy if exists phone_numbers_insert on phone_numbers;
create policy phone_numbers_insert on phone_numbers
for insert with check (org_id = current_org_id());

drop policy if exists phone_numbers_update on phone_numbers;
create policy phone_numbers_update on phone_numbers
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists phone_numbers_delete on phone_numbers;
create policy phone_numbers_delete on phone_numbers
for delete using (org_id = current_org_id() and current_org_role() in ('admin', 'editor'));

drop policy if exists knowledge_bases_select on knowledge_bases;
create policy knowledge_bases_select on knowledge_bases
for select using (org_id = current_org_id());

drop policy if exists knowledge_bases_insert on knowledge_bases;
create policy knowledge_bases_insert on knowledge_bases
for insert with check (org_id = current_org_id());

drop policy if exists knowledge_bases_update on knowledge_bases;
create policy knowledge_bases_update on knowledge_bases
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists knowledge_bases_delete on knowledge_bases;
create policy knowledge_bases_delete on knowledge_bases
for delete using (org_id = current_org_id() and current_org_role() in ('admin', 'editor'));

drop policy if exists usage_logs_select on usage_logs;
create policy usage_logs_select on usage_logs
for select using (org_id = current_org_id());

drop policy if exists usage_logs_insert on usage_logs;
create policy usage_logs_insert on usage_logs
for insert with check (org_id = current_org_id());

drop policy if exists usage_logs_update on usage_logs;
create policy usage_logs_update on usage_logs
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists usage_logs_delete on usage_logs;
create policy usage_logs_delete on usage_logs
for delete using (org_id = current_org_id() and current_org_role() = 'admin');
