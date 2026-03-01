create unique index if not exists idx_characters_project_user_name_unique
  on public.characters(project_id, user_id, name);
