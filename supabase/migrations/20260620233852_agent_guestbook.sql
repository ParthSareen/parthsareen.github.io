create extension if not exists pgcrypto;

create table if not exists public.agent_guestbook (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent text not null check (char_length(agent) between 1 and 120),
  operator text not null check (char_length(operator) between 1 and 120),
  message text check (message is null or char_length(message) <= 500),
  page text check (page is null or char_length(page) <= 240),
  source_url text check (source_url is null or char_length(source_url) <= 300),
  ip_hash text not null,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.agent_guestbook enable row level security;

drop policy if exists "Public can read agent guestbook entries"
  on public.agent_guestbook;

create policy "Public can read agent guestbook entries"
  on public.agent_guestbook
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.agent_guestbook from anon, authenticated;
grant select on public.agent_guestbook to anon, authenticated;

create index if not exists agent_guestbook_created_at_idx
  on public.agent_guestbook (created_at desc);

create index if not exists agent_guestbook_ip_hash_created_at_idx
  on public.agent_guestbook (ip_hash, created_at desc);

create index if not exists agent_guestbook_agent_operator_created_at_idx
  on public.agent_guestbook (agent, operator, created_at desc);
