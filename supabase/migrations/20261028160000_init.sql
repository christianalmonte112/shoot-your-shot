-- Shoot Your Shot: accounts, briefs, calls, and the free-call limit.
--
-- Run this once in the Supabase SQL editor, or with the Supabase CLI
-- (`supabase db push`). After it runs, enable Email and Google under
-- Authentication → Providers, and add your site URL plus
-- /auth/callback to the redirect allow list.
--
-- Row-level security is on for every table. A signed-in builder can
-- read and write only rows whose user_id is auth.uid(). Inserting a
-- call is the exception: only start_practice_call() can do that, and
-- it refuses once three calls have been recorded.

-- Keep this number identical to FREE_CALL_LIMIT in lib/limits.ts.
-- TODO(stripe): when a paid plan exists, teach this function to skip
-- the cap for accounts that have an active subscription.

create table public.briefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product_name text not null default '',
  product_summary text not null default '',
  target_customer text not null default '',
  features text not null default '',
  pricing text not null default '',
  current_solution text not null default '',
  objections jsonb not null default '[]'::jsonb,
  persona text not null default 'skeptical' check (persona in ('friendly', 'skeptical', 'busy-exec')),
  updated_at timestamptz not null default now()
);

create table public.usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  free_calls_used integer not null default 0 check (free_calls_used >= 0),
  updated_at timestamptz not null default now()
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  transcript jsonb not null default '[]'::jsonb,
  coaching_worked text,
  coaching_tighten text,
  coaching_next_line text,
  coaching_raw text,
  created_at timestamptz not null default now()
);

create index calls_user_started_idx on public.calls (user_id, started_at desc);

create table public.waitlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.briefs enable row level security;
alter table public.usage enable row level security;
alter table public.calls enable row level security;
alter table public.waitlist enable row level security;

create policy "read own brief"
  on public.briefs for select
  to authenticated
  using (user_id = auth.uid());

create policy "insert own brief"
  on public.briefs for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own brief"
  on public.briefs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete own brief"
  on public.briefs for delete
  to authenticated
  using (user_id = auth.uid());

-- Usage is readable by the owner and writable only by start_practice_call().
create policy "read own usage"
  on public.usage for select
  to authenticated
  using (user_id = auth.uid());

-- Calls can be read and finished by the owner. They cannot be inserted
-- from the client, which is what keeps the free-call count honest.
create policy "read own calls"
  on public.calls for select
  to authenticated
  using (user_id = auth.uid());

create policy "finish own calls"
  on public.calls for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "read own waitlist row"
  on public.waitlist for select
  to authenticated
  using (user_id = auth.uid());

create policy "join waitlist"
  on public.waitlist for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own waitlist row"
  on public.waitlist for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.briefs from anon, public;
revoke all on table public.usage from anon, public;
revoke all on table public.calls from anon, public;
revoke all on table public.waitlist from anon, public;

grant select, insert, update, delete on table public.briefs to authenticated;
grant select on table public.usage to authenticated;
grant select, update on table public.calls to authenticated;
grant select, insert, update on table public.waitlist to authenticated;

create or replace function public.start_practice_call()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  call_limit constant integer := 3;
  used integer;
  new_id uuid;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.usage (user_id, free_calls_used)
  values (uid, 0)
  on conflict (user_id) do nothing;

  select free_calls_used
    into used
  from public.usage
  where user_id = uid
  for update;

  if used >= call_limit then
    -- TODO(stripe): paid accounts should pass this check.
    raise exception 'free_call_limit' using errcode = 'P0001';
  end if;

  update public.usage
  set free_calls_used = free_calls_used + 1,
      updated_at = now()
  where user_id = uid;

  insert into public.calls (user_id, started_at)
  values (uid, now())
  returning id into new_id;

  return jsonb_build_object(
    'call_id', new_id,
    'free_calls_used', used + 1,
    'free_call_limit', call_limit
  );
end;
$$;

revoke all on function public.start_practice_call() from public, anon;
grant execute on function public.start_practice_call() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
