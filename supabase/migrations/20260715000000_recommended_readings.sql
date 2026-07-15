create extension if not exists pgcrypto;

create table if not exists public.recommended_readings (
  id uuid primary key default gen_random_uuid(),
  canonical_url text not null unique check (canonical_url ~ '^https?://'),
  title text not null check (char_length(title) between 1 and 240),
  author text check (author is null or char_length(author) <= 160),
  publication text check (publication is null or char_length(publication) <= 160),
  note text not null check (char_length(note) between 1 and 600),
  tags text[] not null default '{}'::text[],
  published_at date,
  added_at timestamptz not null default now()
);

alter table public.recommended_readings enable row level security;

create policy "Public can read recommended readings"
  on public.recommended_readings
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.recommended_readings from anon, authenticated;
grant select on public.recommended_readings to anon, authenticated;

create index if not exists recommended_readings_added_at_idx
  on public.recommended_readings (added_at desc);
