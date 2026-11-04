-- Phone number for "Call me", and the Vapi id so a later webhook can
-- attach the transcript to the same row the free-call counter created.
--
-- Run this in the Supabase SQL editor after 20261028160000_init.sql.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164 check (
    phone is null or phone ~ '^\+[1-9][0-9]{1,14}$'
  )
);

alter table public.calls
  add column vapi_call_id text;

create unique index calls_vapi_call_id_idx
  on public.calls (vapi_call_id)
  where vapi_call_id is not null;

alter table public.profiles enable row level security;

create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "insert own profile"
  on public.profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on table public.profiles from anon, public;
grant select, insert, update on table public.profiles to authenticated;

-- New accounts get an empty profile. Existing accounts get one on first save.
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

  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
