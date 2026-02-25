alter table public.ai_history
  add column if not exists latency_ms integer,
  add column if not exists output_chars integer,
  add column if not exists response_fingerprint text,
  add column if not exists user_rating smallint,
  add column if not exists rated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_history_user_rating_check'
  ) then
    alter table public.ai_history
      add constraint ai_history_user_rating_check
      check (user_rating is null or user_rating in (-1, 1));
  end if;
end;
$$;

create index if not exists idx_ai_history_fingerprint
  on public.ai_history(response_fingerprint);

create index if not exists idx_ai_history_user_rating
  on public.ai_history(user_id, user_rating);
