create extension if not exists pgcrypto;

create table if not exists public.sessions (
  session_id text primary key,
  state jsonb not null default jsonb_build_object(
    'language', 'eng',
    'mode', 'A',
    'section', 'gebaeude64',
    'delays', jsonb_build_object(
      'gebaeude64', jsonb_build_object('entryA', 8, 'entryB', 8, 'arrival', 8),
      'wegZurMensa', jsonb_build_object('entryA', 8, 'entryB', 8, 'arrival', 8),
      'inDerMensa', jsonb_build_object('entryA', 8, 'entryB', 8, 'arrival', 8),
      'vrVorlesung', jsonb_build_object('entryA', 8, 'entryB', 8, 'arrival', 8)
    )
  ),
  next_seq integer not null default 0,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.commands (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(session_id) on delete cascade,
  seq integer not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acked_at timestamptz null,
  ack_by text null,
  unique (session_id, seq)
);

create index if not exists commands_session_seq_idx on public.commands(session_id, seq);

alter table public.sessions enable row level security;
alter table public.commands enable row level security;

drop policy if exists sessions_anon_all on public.sessions;
create policy sessions_anon_all on public.sessions
for all to anon
using (true)
with check (true);

drop policy if exists commands_anon_all on public.commands;
create policy commands_anon_all on public.commands
for all to anon
using (true)
with check (true);

create or replace function public.ensure_session(p_session_id text)
returns setof public.sessions
language plpgsql
security definer
as $$
begin
  insert into public.sessions (session_id)
  values (p_session_id)
  on conflict (session_id) do nothing;

  return query
  select *
  from public.sessions
  where session_id = p_session_id;
end;
$$;

create or replace function public.enqueue_command(
  p_session_id text,
  p_type text,
  p_payload jsonb default '{}'::jsonb
)
returns setof public.commands
language plpgsql
security definer
as $$
declare
  v_seq integer;
begin
  insert into public.sessions (session_id)
  values (p_session_id)
  on conflict (session_id) do nothing;

  update public.sessions
  set next_seq = next_seq + 1,
      revision = revision + 1,
      updated_at = now()
  where session_id = p_session_id
  returning next_seq - 1 into v_seq;

  return query
  insert into public.commands (session_id, seq, type, payload)
  values (p_session_id, v_seq, p_type, coalesce(p_payload, '{}'::jsonb))
  returning *;
end;
$$;
