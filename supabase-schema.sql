create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  saved_listings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(saved_listings) = 'array'),
  skill_preferences jsonb not null default '[]'::jsonb
    check (jsonb_typeof(skill_preferences) = 'array'),
  reply_template text not null default ''
    check (char_length(reply_template) <= 3000),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
grant select, insert, update, delete on table public.user_preferences to authenticated;

drop policy if exists "Users can read their own preferences" on public.user_preferences;
create policy "Users can read their own preferences"
  on public.user_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own preferences" on public.user_preferences;
create policy "Users can create their own preferences"
  on public.user_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own preferences" on public.user_preferences;
create policy "Users can update their own preferences"
  on public.user_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own preferences" on public.user_preferences;
create policy "Users can delete their own preferences"
  on public.user_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);
