create extension if not exists citext;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username ~ '^[A-Za-z0-9_]{3,18}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_scores (
  challenge_date text not null check (challenge_date ~ '^\d{8}$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username citext not null,
  score integer not null check (score between 0 and 10000000),
  words integer not null check (words between 0 and 10000),
  board_hash text not null check (char_length(board_hash) between 8 and 64),
  submitted_at timestamptz not null default now(),
  primary key (challenge_date, user_id)
);

create index if not exists daily_scores_ranking
  on public.daily_scores (challenge_date, score desc, submitted_at asc);

alter table public.profiles enable row level security;
alter table public.daily_scores enable row level security;

drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "Players update only their own profile" on public.profiles;
create policy "Players update only their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Daily rankings are publicly readable" on public.daily_scores;
create policy "Daily rankings are publicly readable"
  on public.daily_scores for select
  using (true);

create or replace function public.create_player_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := coalesce(new.raw_user_meta_data ->> 'username', 'Player_' || substr(new.id::text, 1, 8));
  if requested_username !~ '^[A-Za-z0-9_]{3,18}$' then
    requested_username := 'Player_' || substr(new.id::text, 1, 8);
  end if;
  insert into public.profiles (id, username)
  values (new.id, requested_username)
  on conflict (id) do nothing;
  return new;
exception when unique_violation then
  insert into public.profiles (id, username)
  values (new.id, 'Player_' || substr(new.id::text, 1, 8))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_profile_after_signup on auth.users;
create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_player_profile();

create or replace function public.ensure_my_profile(p_username text default null)
returns public.profiles
language plpgsql
security definer set search_path = public, auth
as $$
declare
  requested_username text;
  player_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must sign in before creating a profile.';
  end if;
  requested_username := coalesce(
    nullif(trim(p_username), ''),
    nullif(trim(auth.jwt() -> 'user_metadata' ->> 'username'), ''),
    'Player_' || substr(auth.uid()::text, 1, 8)
  );
  if requested_username !~ '^[A-Za-z0-9_]{3,18}$' then
    requested_username := 'Player_' || substr(auth.uid()::text, 1, 8);
  end if;

  insert into public.profiles (id, username)
  values (auth.uid(), requested_username)
  on conflict (id) do update
    set username = case
      when public.profiles.username::text ~ '^Player_[0-9a-f]{8}$'
        then excluded.username
      else public.profiles.username
    end,
    updated_at = now()
  returning * into player_profile;
  return player_profile;
exception when unique_violation then
  raise exception 'That username is taken. Try another one.';
end;
$$;

revoke all on function public.ensure_my_profile(text) from public;
grant execute on function public.ensure_my_profile(text) to authenticated;

create or replace function public.sync_player_username()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.updated_at := now();
  update public.daily_scores set username = new.username where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_username_after_profile_update on public.profiles;
create trigger sync_username_after_profile_update
  before update of username on public.profiles
  for each row execute function public.sync_player_username();

create or replace function public.submit_daily_score(
  p_score integer,
  p_words integer,
  p_board_hash text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  player_username citext;
  today_key text := to_char(timezone('utc', now()), 'YYYYMMDD');
begin
  if auth.uid() is null then
    raise exception 'You must sign in before submitting a score.';
  end if;
  if p_score < 0 or p_score > 10000000 or p_words < 0 or p_words > 10000 then
    raise exception 'Score data is outside the allowed range.';
  end if;
  perform public.ensure_my_profile(null);
  select username into player_username from public.profiles where id = auth.uid();
  if player_username is null then
    raise exception 'Create a username before submitting a score.';
  end if;

  insert into public.daily_scores (challenge_date, user_id, username, score, words, board_hash)
  values (today_key, auth.uid(), player_username, p_score, p_words, p_board_hash)
  on conflict (challenge_date, user_id) do update
    set username = excluded.username,
        score = excluded.score,
        words = excluded.words,
        board_hash = excluded.board_hash,
        submitted_at = now()
    where excluded.score > public.daily_scores.score;
end;
$$;

revoke all on function public.submit_daily_score(integer, integer, text) from public;
grant execute on function public.submit_daily_score(integer, integer, text) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'You must sign in before deleting an account.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_scores'
  ) then
    alter publication supabase_realtime add table public.daily_scores;
  end if;
end $$;
