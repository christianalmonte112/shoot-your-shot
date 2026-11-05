-- Buyer customization, safer call accounting, and webhook idempotency.
-- Run after 20261028160000_init.sql and 20261104140000_phone_and_vapi_call_id.sql.
--
-- Personality, difficulty, and practice questions are stored per user.
-- They cannot insert a call or raise the free-call cap.
-- start_practice_call() is replaced so web and phone share one locked counter,
-- and a repeated request does not mint a second call.

create table public.buyer_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  personality text not null default 'skeptical'
    check (personality in ('friendly', 'skeptical', 'busy-exec')),
  difficulty text not null default 'standard'
    check (difficulty in ('easy', 'standard', 'tough')),
  practice_questions text not null default '',
  constraint buyer_settings_questions_len check (char_length(practice_questions) <= 800),
  updated_at timestamptz not null default now()
);

alter table public.buyer_settings enable row level security;

create policy "read own buyer settings"
  on public.buyer_settings for select
  to authenticated
  using (user_id = auth.uid());

create policy "insert own buyer settings"
  on public.buyer_settings for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own buyer settings"
  on public.buyer_settings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.buyer_settings from anon, public;
grant select, insert, update on table public.buyer_settings to authenticated;

alter table public.calls
  add column if not exists channel text not null default 'web';

alter table public.calls
  drop constraint if exists calls_channel_check;

alter table public.calls
  add constraint calls_channel_check check (channel in ('web', 'phone'));

alter table public.calls
  add column if not exists idempotency_key text;

create unique index if not exists calls_user_idempotency_idx
  on public.calls (user_id, idempotency_key)
  where idempotency_key is not null;

create table public.webhook_events (
  event_key text primary key,
  vapi_call_id text not null,
  applied_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
revoke all on table public.webhook_events from anon, public, authenticated;

drop function if exists public.start_practice_call();

create function public.start_practice_call(
  p_channel text default 'web',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  call_limit constant integer := 3;
  open_window constant interval := interval '45 seconds';
  used integer;
  existing_id uuid;
  new_id uuid;
  channel text := coalesce(p_channel, 'web');
  idem text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if channel not in ('web', 'phone') then
    raise exception 'bad_channel' using errcode = '22023';
  end if;

  insert into public.usage (user_id, free_calls_used)
  values (uid, 0)
  on conflict (user_id) do nothing;

  select free_calls_used
    into used
  from public.usage
  where user_id = uid
  for update;

  if idem is not null then
    select id into existing_id
    from public.calls
    where user_id = uid and idempotency_key = idem
    limit 1;
    if existing_id is not null then
      return jsonb_build_object(
        'call_id', existing_id,
        'free_calls_used', used,
        'free_call_limit', call_limit,
        'replayed', true
      );
    end if;
  end if;

  select id into existing_id
  from public.calls
  where user_id = uid
    and ended_at is null
    and started_at > now() - open_window
  order by started_at desc
  limit 1;

  if existing_id is not null then
    return jsonb_build_object(
      'call_id', existing_id,
      'free_calls_used', used,
      'free_call_limit', call_limit,
      'replayed', true
    );
  end if;

  if used >= call_limit then
    raise exception 'free_call_limit' using errcode = 'P0001';
  end if;

  update public.usage
  set free_calls_used = free_calls_used + 1,
      updated_at = now()
  where user_id = uid;

  insert into public.calls (user_id, started_at, channel, idempotency_key)
  values (uid, now(), channel, idem)
  returning id into new_id;

  return jsonb_build_object(
    'call_id', new_id,
    'free_calls_used', used + 1,
    'free_call_limit', call_limit,
    'replayed', false
  );
end;
$$;

revoke all on function public.start_practice_call(text, text) from public, anon;
grant execute on function public.start_practice_call(text, text) to authenticated;

create function public.apply_vapi_report(
  p_event_key text,
  p_vapi_call_id text,
  p_transcript jsonb,
  p_worked text,
  p_tighten text,
  p_next_line text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  inserted_count integer;
begin
  if p_event_key is null or length(trim(p_event_key)) = 0 then
    raise exception 'bad_event' using errcode = '22023';
  end if;

  insert into public.webhook_events (event_key, vapi_call_id)
  values (p_event_key, p_vapi_call_id)
  on conflict (event_key) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select id into cid
  from public.calls
  where vapi_call_id = p_vapi_call_id
  limit 1;

  if cid is null then
    delete from public.webhook_events where event_key = p_event_key;
    return jsonb_build_object('status', 'unknown_call');
  end if;

  update public.calls
  set transcript = coalesce(p_transcript, '[]'::jsonb),
      coaching_worked = p_worked,
      coaching_tighten = p_tighten,
      coaching_next_line = p_next_line,
      ended_at = coalesce(ended_at, now()),
      duration_seconds = coalesce(
        duration_seconds,
        greatest(0, extract(epoch from (now() - started_at))::integer)
      )
  where id = cid;

  return jsonb_build_object('status', 'applied', 'call_id', cid);
end;
$$;

revoke all on function public.apply_vapi_report(text, text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.apply_vapi_report(text, text, jsonb, text, text, text) to service_role;
