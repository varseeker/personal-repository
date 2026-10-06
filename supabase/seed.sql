-- Optional development seed.
-- 1. Create a user in Supabase Auth.
-- 2. Set that profile's username to "demo" (or change the lookup below).
-- 3. Run this file with `supabase db reset` or the SQL editor.
-- It does not contain passwords or production credentials.

do $$
declare
  owner uuid;
  public_repo uuid;
  private_repo uuid;
  docs_folder uuid;
begin
  select id into owner from public.profiles where username = 'demo';

  if owner is null then
    raise notice 'Seed skipped: no profile with username "demo".';
    return;
  end if;

  insert into public.repositories (owner_id, name, slug, description, visibility)
  values (
    owner,
    'Public Notes',
    'public-notes',
    'Sample public repository created by the development seed.',
    'public'
  )
  on conflict (owner_id, slug) do update
  set description = excluded.description
  returning id into public_repo;

  insert into public.repositories (owner_id, name, slug, description, visibility)
  values (
    owner,
    'Private Archive',
    'private-archive',
    'Sample private repository. Only the owner can read this.',
    'private'
  )
  on conflict (owner_id, slug) do nothing
  returning id into private_repo;

  if public_repo is not null
    and not exists (
      select 1 from public.folders
      where repository_id = public_repo and parent_folder_id is null and lower(name) = 'docs'
    ) then
    insert into public.folders (repository_id, parent_folder_id, name)
    values (public_repo, null, 'docs')
    returning id into docs_folder;
  end if;

  raise notice 'Seed finished for demo user %. Upload README.md through the app to preview Markdown.', owner;
end;
$$;
