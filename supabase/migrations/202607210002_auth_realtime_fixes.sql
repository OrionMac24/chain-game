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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_scores'
  ) then
    alter publication supabase_realtime add table public.daily_scores;
  end if;
end $$;
