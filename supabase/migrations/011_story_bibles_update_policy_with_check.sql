drop policy if exists "Users can update own story bibles" on public.story_bibles;

create policy "Users can update own story bibles"
  on public.story_bibles for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
