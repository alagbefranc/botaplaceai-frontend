-- Migration: Add tables for multi-tenant porting and regulatory document tracking
-- These tables link Telnyx resources to tenant org_id

-- Port Orders Table - tracks porting orders per tenant
create table if not exists port_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  telnyx_port_order_id text not null,
  port_type text not null check (port_type in ('port_in', 'port_out')),
  phone_numbers text[] not null,
  status text not null default 'pending',
  carrier_name text,
  requested_foc_date date,
  actual_foc_date date,
  created_by uuid references profiles(id) on delete set null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regulatory Documents Table - tracks uploaded documents per tenant
create table if not exists regulatory_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  telnyx_document_id text not null,
  document_type text not null,
  description text,
  file_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  country_code text,
  requirements_met text[] default '{}',
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regulatory Requirements Cache - caches requirements by country/number type
-- This avoids repeated API calls for static data
create table if not exists regulatory_requirements_cache (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  number_type text not null,
  requirements jsonb not null,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (country_code, number_type)
);

-- Create indexes for performance
create index if not exists idx_port_orders_org_id on port_orders(org_id);
create index if not exists idx_port_orders_status on port_orders(status);
create index if not exists idx_port_orders_telnyx_id on port_orders(telnyx_port_order_id);
create index if not exists idx_regulatory_documents_org_id on regulatory_documents(org_id);
create index if not exists idx_regulatory_documents_status on regulatory_documents(status);
create index if not exists idx_regulatory_documents_telnyx_id on regulatory_documents(telnyx_document_id);

-- Enable Row Level Security
alter table port_orders enable row level security;
alter table regulatory_documents enable row level security;
alter table regulatory_requirements_cache enable row level security;

-- RLS Policies for port_orders
drop policy if exists port_orders_select on port_orders;
create policy port_orders_select on port_orders
for select using (org_id = current_org_id());

drop policy if exists port_orders_insert on port_orders;
create policy port_orders_insert on port_orders
for insert with check (org_id = current_org_id());

drop policy if exists port_orders_update on port_orders;
create policy port_orders_update on port_orders
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists port_orders_delete on port_orders;
create policy port_orders_delete on port_orders
for delete using (org_id = current_org_id() and current_org_role() in ('admin', 'editor'));

-- RLS Policies for regulatory_documents
drop policy if exists regulatory_documents_select on regulatory_documents;
create policy regulatory_documents_select on regulatory_documents
for select using (org_id = current_org_id());

drop policy if exists regulatory_documents_insert on regulatory_documents;
create policy regulatory_documents_insert on regulatory_documents
for insert with check (org_id = current_org_id());

drop policy if exists regulatory_documents_update on regulatory_documents;
create policy regulatory_documents_update on regulatory_documents
for update using (org_id = current_org_id()) with check (org_id = current_org_id());

drop policy if exists regulatory_documents_delete on regulatory_documents;
create policy regulatory_documents_delete on regulatory_documents
for delete using (org_id = current_org_id() and current_org_role() in ('admin', 'editor'));

-- Regulatory requirements cache is read-only by all authenticated users
drop policy if exists regulatory_requirements_cache_select on regulatory_requirements_cache;
create policy regulatory_requirements_cache_select on regulatory_requirements_cache
for select using (true);

-- Only service role can insert/update cache (done from backend)
drop policy if exists regulatory_requirements_cache_insert on regulatory_requirements_cache;
create policy regulatory_requirements_cache_insert on regulatory_requirements_cache
for insert with check (true);

drop policy if exists regulatory_requirements_cache_update on regulatory_requirements_cache;
create policy regulatory_requirements_cache_update on regulatory_requirements_cache
for update using (true);

-- Function to automatically update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
drop trigger if exists port_orders_updated_at on port_orders;
create trigger port_orders_updated_at
  before update on port_orders
  for each row execute function update_updated_at_column();

drop trigger if exists regulatory_documents_updated_at on regulatory_documents;
create trigger regulatory_documents_updated_at
  before update on regulatory_documents
  for each row execute function update_updated_at_column();

-- Add comments for documentation
comment on table port_orders is 'Tracks porting orders (port-in and port-out) per tenant, linked to Telnyx';
comment on table regulatory_documents is 'Tracks regulatory documents uploaded per tenant, linked to Telnyx';
comment on table regulatory_requirements_cache is 'Caches regulatory requirements by country/number type to reduce API calls';
