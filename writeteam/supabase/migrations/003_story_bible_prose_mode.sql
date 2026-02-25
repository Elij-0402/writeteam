alter table public.story_bibles
  add column if not exists prose_mode text,
  add column if not exists style_sample text;

update public.story_bibles
set prose_mode = 'balanced'
where prose_mode is null;

alter table public.story_bibles
  alter column prose_mode set default 'balanced';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'story_bibles_prose_mode_check'
  ) then
    alter table public.story_bibles
      add constraint story_bibles_prose_mode_check
      check (prose_mode in ('balanced', 'cinematic', 'lyrical', 'minimal', 'match-style'));
  end if;
end;
$$;
