-- Personal repository schema, storage buckets, and row level security.
-- Privileged helpers live in the private schema so they are not exposed by the Data API.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.visibility as enum ('private', 'public');
create type public.collaborator_role as enum ('owner', 'editor', 'viewer');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  bio text,
  storage_limit_bytes bigint not null default 53687091200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'),
  constraint profiles_username_unique unique (username),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 80),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 500),
  constraint profiles_avatar_url_http check (
    avatar_url is null
    or (char_length(avatar_url) <= 500 and avatar_url ~ '^https?://')
  ),
  constraint profiles_storage_limit_positive check (storage_limit_bytes > 0)
);

comment on table public.profiles is
  'Public profile data. Email and auth secrets stay in auth.users and are not copied here.';

-- ---------------------------------------------------------------------------
-- Repositories
-- ---------------------------------------------------------------------------

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  visibility public.visibility not null default 'private',
  storage_limit_bytes bigint not null default 10737418240,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repositories_owner_slug_unique unique (owner_id, slug),
  constraint repositories_name_length check (char_length(name) between 1 and 80),
  constraint repositories_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  constraint repositories_description_length check (description is null or char_length(description) <= 2000),
  constraint repositories_storage_limit_positive check (storage_limit_bytes > 0)
);

create index repositories_owner_id_idx on public.repositories (owner_id);
create index repositories_public_updated_idx
  on public.repositories (updated_at desc)
  where visibility = 'public';
create index repositories_name_trgm_idx
  on public.repositories using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Collaborators (prepared for a later release; no product UI yet)
-- ---------------------------------------------------------------------------

create table public.repository_collaborators (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.collaborator_role not null,
  created_at timestamptz not null default now(),
  constraint repository_collaborators_unique unique (repository_id, user_id),
  constraint repository_collaborators_not_owner_role check (role <> 'owner')
);

create index repository_collaborators_user_idx
  on public.repository_collaborators (user_id, repository_id);

-- ---------------------------------------------------------------------------
-- Folders and files
-- ---------------------------------------------------------------------------

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories (id) on delete cascade,
  parent_folder_id uuid references public.folders (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_length check (char_length(name) between 1 and 120)
);

create index folders_repository_parent_idx
  on public.folders (repository_id, parent_folder_id);

create unique index folders_sibling_name_idx
  on public.folders (
    repository_id,
    coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

create table public.files (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories (id) on delete cascade,
  folder_id uuid references public.folders (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  original_name text not null,
  storage_path text not null,
  mime_type text not null,
  extension text,
  original_size bigint not null,
  stored_size bigint not null,
  compression_type text,
  checksum text not null,
  description text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint files_storage_path_unique unique (storage_path),
  constraint files_name_length check (char_length(name) between 1 and 180),
  constraint files_original_size_range check (original_size >= 0 and original_size <= 52428800),
  constraint files_stored_size_range check (stored_size >= 0 and stored_size <= 52428800),
  constraint files_compression_type check (compression_type is null or compression_type = 'gzip'),
  constraint files_checksum_sha256 check (checksum ~ '^[a-f0-9]{64}$'),
  constraint files_version_positive check (version >= 1),
  constraint files_mime_length check (char_length(mime_type) between 1 and 180),
  constraint files_description_length check (description is null or char_length(description) <= 500)
);

create index files_repository_folder_idx on public.files (repository_id, folder_id);
create index files_owner_id_idx on public.files (owner_id);
create index files_checksum_idx on public.files (checksum);

create unique index files_sibling_name_idx
  on public.files (
    repository_id,
    coalesce(folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

-- ---------------------------------------------------------------------------
-- Activity
-- ---------------------------------------------------------------------------

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  repository_id uuid references public.repositories (id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_event_type_length check (char_length(event_type) between 1 and 80)
);

create index activity_events_repository_created_idx
  on public.activity_events (repository_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.can_read_repo(repo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select repo_id is not null and exists (
    select 1
    from public.repositories as repository
    where repository.id = repo_id
      and (
        repository.visibility = 'public'
        or repository.owner_id = (select auth.uid())
        or exists (
          select 1
          from public.repository_collaborators as collaborator
          where collaborator.repository_id = repository.id
            and collaborator.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function private.can_write_repo(repo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select repo_id is not null and (
    exists (
      select 1
      from public.repositories as repository
      where repository.id = repo_id
        and repository.owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.repository_collaborators as collaborator
      where collaborator.repository_id = repo_id
        and collaborator.user_id = (select auth.uid())
        and collaborator.role = 'editor'
    )
  );
$$;

create or replace function private.is_repo_owner(repo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select repo_id is not null and exists (
    select 1
    from public.repositories as repository
    where repository.id = repo_id
      and repository.owner_id = (select auth.uid())
  );
$$;

create or replace function private.repository_id_from_path(object_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  part text := split_part(object_name, '/', 2);
begin
  if part ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return part::uuid;
  end if;
  return null;
end;
$$;

create or replace function private.folder_contains(ancestor_id uuid, maybe_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select id
    from public.folders
    where id = ancestor_id
    union all
    select folder.id
    from public.folders as folder
    join chain on folder.parent_folder_id = chain.id
  )
  select exists (
    select 1 from chain where chain.id = maybe_child_id
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  final_username text;
  display_name text;
begin
  base_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  base_username := regexp_replace(base_username, '[^a-z0-9-]', '', 'g');
  base_username := left(base_username, 32);

  if base_username !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
    base_username := 'user';
  end if;

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    final_username := left(base_username, 24) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end loop;

  display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', final_username));
  display_name := regexp_replace(display_name, '[[:cntrl:]]', '', 'g');
  if display_name = '' then
    display_name := final_username;
  end if;
  display_name := left(display_name, 80);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, display_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.protect_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'forbidden';
  end if;

  if new.storage_limit_bytes is distinct from old.storage_limit_bytes
    and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'forbidden';
  end if;

  if new.username !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
    raise exception 'invalid_username';
  end if;

  return new;
end;
$$;

create or replace function private.protect_repository()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_limit bigint;
begin
  if tg_op = 'INSERT' then
    if new.owner_id is distinct from (select auth.uid())
      and current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'forbidden';
    end if;

    select storage_limit_bytes into owner_limit
    from public.profiles
    where id = new.owner_id;

    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      new.storage_limit_bytes := least(10737418240, coalesce(owner_limit, 10737418240));
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'forbidden';
    end if;
    if new.storage_limit_bytes is distinct from old.storage_limit_bytes
      and current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'forbidden';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_write_repo(new.repository_id) then
    raise exception 'forbidden';
  end if;

  if new.name is null
    or btrim(new.name) = ''
    or new.name ~ '[/\\]'
    or new.name in ('.', '..')
    or char_length(new.name) > 120 then
    raise exception 'invalid_name';
  end if;

  if new.parent_folder_id is not null then
    if not exists (
      select 1
      from public.folders as parent
      where parent.id = new.parent_folder_id
        and parent.repository_id = new.repository_id
    ) then
      raise exception 'invalid_parent_folder';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.repository_id is distinct from old.repository_id then
      raise exception 'forbidden';
    end if;
    if new.parent_folder_id is not null
      and private.folder_contains(new.id, new.parent_folder_id) then
      raise exception 'folder_cycle';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_file()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  object_size bigint;
  user_limit bigint;
  repo_limit bigint;
  used_user bigint;
  used_repo bigint;
  path_owner text;
  path_repo text;
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
    and new.owner_id is distinct from (select auth.uid()) then
    raise exception 'forbidden';
  end if;

  if not private.can_write_repo(new.repository_id) then
    raise exception 'forbidden';
  end if;

  if new.name is null
    or btrim(new.name) = ''
    or new.name ~ '[/\\]'
    or new.name in ('.', '..') then
    raise exception 'invalid_name';
  end if;

  if new.folder_id is not null
    and not exists (
      select 1
      from public.folders as folder
      where folder.id = new.folder_id
        and folder.repository_id = new.repository_id
    ) then
    raise exception 'invalid_parent_folder';
  end if;

  path_owner := split_part(new.storage_path, '/', 1);
  path_repo := split_part(new.storage_path, '/', 2);

  if path_owner <> new.owner_id::text or path_repo <> new.repository_id::text then
    raise exception 'invalid_storage_path';
  end if;

  if new.storage_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$' then
    raise exception 'invalid_storage_path';
  end if;

  if tg_op = 'UPDATE' then
    if new.repository_id is distinct from old.repository_id
      or new.owner_id is distinct from old.owner_id
      or new.storage_path is distinct from old.storage_path then
      raise exception 'forbidden';
    end if;
    if new.checksum is distinct from old.checksum then
      new.version := old.version + 1;
    end if;
  end if;

  select (object.metadata ->> 'size')::bigint
  into object_size
  from storage.objects as object
  where object.bucket_id = 'repository-files'
    and object.name = new.storage_path;

  if object_size is null then
    raise exception 'storage_object_missing';
  end if;

  new.stored_size := object_size;

  select storage_limit_bytes into user_limit
  from public.profiles
  where id = new.owner_id;

  select coalesce(sum(file.stored_size), 0) into used_user
  from public.files as file
  where file.owner_id = new.owner_id
    and file.id is distinct from new.id;

  if used_user + new.stored_size > coalesce(user_limit, 0) then
    raise exception 'storage_quota_exceeded';
  end if;

  select storage_limit_bytes into repo_limit
  from public.repositories
  where id = new.repository_id;

  select coalesce(sum(file.stored_size), 0) into used_repo
  from public.files as file
  where file.repository_id = new.repository_id
    and file.id is distinct from new.id;

  if used_repo + new.stored_size > coalesce(repo_limit, 0) then
    raise exception 'repository_quota_exceeded';
  end if;

  return new;
end;
$$;

create or replace function private.record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if tg_table_name = 'repositories' then
    if tg_op = 'INSERT' then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (coalesce(actor, new.owner_id), new.id, 'repository_created', jsonb_build_object('name', new.name));
    elsif tg_op = 'UPDATE' and new.visibility is distinct from old.visibility then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, new.id, 'repository_visibility_changed', jsonb_build_object('from', old.visibility, 'to', new.visibility));
    elsif tg_op = 'UPDATE' and (new.name is distinct from old.name or new.description is distinct from old.description) then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, new.id, 'repository_updated', jsonb_build_object('name', new.name));
    end if;
  elsif tg_table_name = 'folders' then
    if tg_op = 'INSERT' then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, new.repository_id, 'folder_created', jsonb_build_object('name', new.name));
    elsif tg_op = 'DELETE' then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, old.repository_id, 'folder_deleted', jsonb_build_object('name', old.name));
    end if;
  elsif tg_table_name = 'files' then
    if tg_op = 'INSERT' then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (coalesce(actor, new.owner_id), new.repository_id, 'file_uploaded', jsonb_build_object('name', new.name, 'file_id', new.id));
    elsif tg_op = 'DELETE' then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, old.repository_id, 'file_deleted', jsonb_build_object('name', old.name, 'file_id', old.id));
    elsif tg_op = 'UPDATE' and new.name is distinct from old.name then
      insert into public.activity_events (actor_id, repository_id, event_type, metadata)
      values (actor, new.repository_id, 'file_renamed', jsonb_build_object('from', old.name, 'to', new.name, 'file_id', new.id));
    end if;
  end if;

  return null;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

create trigger profiles_protect
  before update on public.profiles
  for each row execute function private.protect_profile();

create trigger repositories_touch_updated_at
  before update on public.repositories
  for each row execute function private.touch_updated_at();

create trigger repositories_protect
  before insert or update on public.repositories
  for each row execute function private.protect_repository();

create trigger repositories_activity
  after insert or update on public.repositories
  for each row execute function private.record_activity();

create trigger folders_touch_updated_at
  before update on public.folders
  for each row execute function private.touch_updated_at();

create trigger folders_validate
  before insert or update on public.folders
  for each row execute function private.validate_folder();

create trigger folders_activity
  after insert or delete on public.folders
  for each row execute function private.record_activity();

create trigger files_touch_updated_at
  before update on public.files
  for each row execute function private.touch_updated_at();

create trigger files_validate
  before insert or update on public.files
  for each row execute function private.validate_file();

create trigger files_activity
  after insert or update or delete on public.files
  for each row execute function private.record_activity();

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

create or replace function public.search_public_repositories(
  p_query text default '',
  p_sort text default 'updated',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  slug text,
  description text,
  owner_username text,
  owner_display_name text,
  file_count bigint,
  folder_count bigint,
  stored_bytes bigint,
  has_readme boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      least(greatest(coalesce(p_limit, 12), 1), 24) as lim,
      greatest(coalesce(p_offset, 0), 0) as off,
      case
        when p_query is null or length(btrim(p_query)) = 0 then null
        else '%' || replace(replace(replace(left(btrim(p_query), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%'
      end as pattern,
      case
        when p_sort in ('updated', 'created', 'name', 'size') then p_sort
        else 'updated'
      end as sort
  ),
  matched as (
    select
      repository.id,
      repository.name,
      repository.slug,
      repository.description,
      profile.username as owner_username,
      profile.display_name as owner_display_name,
      (select count(*) from public.files as file where file.repository_id = repository.id) as file_count,
      (select count(*) from public.folders as folder where folder.repository_id = repository.id) as folder_count,
      (
        select coalesce(sum(file.stored_size), 0)
        from public.files as file
        where file.repository_id = repository.id
      ) as stored_bytes,
      exists (
        select 1
        from public.files as readme
        where readme.repository_id = repository.id
          and readme.folder_id is null
          and lower(readme.name) in ('readme.md', 'readme')
      ) as has_readme,
      repository.created_at,
      repository.updated_at
    from public.repositories as repository
    join public.profiles as profile on profile.id = repository.owner_id
    cross join params
    where repository.visibility = 'public'
      and (
        params.pattern is null
        or repository.name ilike params.pattern escape '\'
        or coalesce(repository.description, '') ilike params.pattern escape '\'
        or profile.username ilike params.pattern escape '\'
        or profile.display_name ilike params.pattern escape '\'
      )
  )
  select
    matched.id,
    matched.name,
    matched.slug,
    matched.description,
    matched.owner_username,
    matched.owner_display_name,
    matched.file_count,
    matched.folder_count,
    matched.stored_bytes,
    matched.has_readme,
    matched.created_at,
    matched.updated_at,
    count(*) over () as total_count
  from matched
  cross join params
  order by
    case when params.sort = 'name' then matched.name end asc,
    case when params.sort = 'created' then matched.created_at end desc,
    case when params.sort = 'size' then matched.stored_bytes end desc,
    case when params.sort = 'updated' then matched.updated_at end desc,
    matched.updated_at desc
  limit (select lim from params)
  offset (select off from params);
$$;

create or replace function public.search_my_items(p_query text)
returns table (
  kind text,
  item_id uuid,
  name text,
  repository_id uuid,
  repository_name text,
  repository_slug text,
  owner_username text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      '%' || replace(replace(replace(left(btrim(coalesce(p_query, '')), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select *
  from (
    select
      'repository'::text as kind,
      repository.id as item_id,
      repository.name,
      repository.id as repository_id,
      repository.name as repository_name,
      repository.slug as repository_slug,
      profile.username as owner_username,
      repository.updated_at
    from public.repositories as repository
    join public.profiles as profile on profile.id = repository.owner_id
    cross join params
    where length(btrim(coalesce(p_query, ''))) >= 2
      and repository.owner_id = (select auth.uid())
      and (
        repository.name ilike params.pattern escape '\'
        or coalesce(repository.description, '') ilike params.pattern escape '\'
      )
    union all
    select
      'folder'::text,
      folder.id,
      folder.name,
      repository.id,
      repository.name,
      repository.slug,
      profile.username,
      folder.updated_at
    from public.folders as folder
    join public.repositories as repository on repository.id = folder.repository_id
    join public.profiles as profile on profile.id = repository.owner_id
    cross join params
    where length(btrim(coalesce(p_query, ''))) >= 2
      and repository.owner_id = (select auth.uid())
      and folder.name ilike params.pattern escape '\'
    union all
    select
      'file'::text,
      file.id,
      file.name,
      repository.id,
      repository.name,
      repository.slug,
      profile.username,
      file.updated_at
    from public.files as file
    join public.repositories as repository on repository.id = file.repository_id
    join public.profiles as profile on profile.id = repository.owner_id
    cross join params
    where length(btrim(coalesce(p_query, ''))) >= 2
      and repository.owner_id = (select auth.uid())
      and file.name ilike params.pattern escape '\'
  ) as result
  order by result.updated_at desc
  limit 30;
$$;

-- Rate-limit counter. The public wrapper is invoker-only and executable by service_role.
create table private.rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);

create or replace function private.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if p_key is null or length(p_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into private.rate_limits as bucket (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set
      count = case
        when bucket.window_start + make_interval(secs => p_window_seconds) < now() then 1
        else bucket.count + 1
      end,
      window_start = case
        when bucket.window_start + make_interval(secs => p_window_seconds) < now() then now()
        else bucket.window_start
      end
  returning count into current_count;

  return current_count <= p_limit;
end;
$$;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.consume_rate_limit(p_key, p_limit, p_window_seconds);
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;

grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;

grant select on public.repositories to anon, authenticated;
grant insert, update, delete on public.repositories to authenticated;

grant select on public.repository_collaborators to authenticated;
grant insert, update, delete on public.repository_collaborators to authenticated;

grant select on public.folders to anon, authenticated;
grant insert, update, delete on public.folders to authenticated;

grant select on public.files to anon, authenticated;
grant insert, update, delete on public.files to authenticated;

grant select on public.activity_events to authenticated;

grant execute on function public.search_public_repositories(text, text, integer, integer) to anon, authenticated;
grant execute on function public.search_my_items(text) to authenticated;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function private.consume_rate_limit(text, integer, integer) to service_role;

grant execute on function private.can_read_repo(uuid) to anon, authenticated;
grant execute on function private.can_write_repo(uuid) to authenticated;
grant execute on function private.is_repo_owner(uuid) to authenticated;
grant execute on function private.repository_id_from_path(text) to anon, authenticated;
grant execute on function private.touch_updated_at() to anon, authenticated;
grant execute on function private.protect_profile() to authenticated;
grant execute on function private.protect_repository() to authenticated;
grant execute on function private.validate_folder() to authenticated;
grant execute on function private.validate_file() to authenticated;
grant execute on function private.record_activity() to authenticated;
grant execute on function private.folder_contains(uuid, uuid) to authenticated;
grant execute on function private.handle_new_user() to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.repositories enable row level security;
alter table public.repository_collaborators enable row level security;
alter table public.folders enable row level security;
alter table public.files enable row level security;
alter table public.activity_events enable row level security;

alter table public.profiles force row level security;
alter table public.repositories force row level security;
alter table public.repository_collaborators force row level security;
alter table public.folders force row level security;
alter table public.files force row level security;
alter table public.activity_events force row level security;

create policy profiles_select
  on public.profiles
  for select
  to anon, authenticated
  using (true);

create policy profiles_insert
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy repositories_select
  on public.repositories
  for select
  to anon, authenticated
  using (private.can_read_repo(id));

create policy repositories_insert
  on public.repositories
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy repositories_update
  on public.repositories
  for update
  to authenticated
  using (private.is_repo_owner(id))
  with check (private.is_repo_owner(id) and owner_id = (select auth.uid()));

create policy repositories_delete
  on public.repositories
  for delete
  to authenticated
  using (private.is_repo_owner(id));

create policy collaborators_select
  on public.repository_collaborators
  for select
  to authenticated
  using (private.can_read_repo(repository_id));

create policy collaborators_insert
  on public.repository_collaborators
  for insert
  to authenticated
  with check (private.is_repo_owner(repository_id));

create policy collaborators_update
  on public.repository_collaborators
  for update
  to authenticated
  using (private.is_repo_owner(repository_id))
  with check (private.is_repo_owner(repository_id));

create policy collaborators_delete
  on public.repository_collaborators
  for delete
  to authenticated
  using (private.is_repo_owner(repository_id));

create policy folders_select
  on public.folders
  for select
  to anon, authenticated
  using (private.can_read_repo(repository_id));

create policy folders_insert
  on public.folders
  for insert
  to authenticated
  with check (private.can_write_repo(repository_id));

create policy folders_update
  on public.folders
  for update
  to authenticated
  using (private.can_write_repo(repository_id))
  with check (private.can_write_repo(repository_id));

create policy folders_delete
  on public.folders
  for delete
  to authenticated
  using (private.can_write_repo(repository_id));

create policy files_select
  on public.files
  for select
  to anon, authenticated
  using (private.can_read_repo(repository_id));

create policy files_insert
  on public.files
  for insert
  to authenticated
  with check (
    private.can_write_repo(repository_id)
    and owner_id = (select auth.uid())
  );

create policy files_update
  on public.files
  for update
  to authenticated
  using (private.can_write_repo(repository_id))
  with check (private.can_write_repo(repository_id));

create policy files_delete
  on public.files
  for delete
  to authenticated
  using (private.can_write_repo(repository_id));

create policy activity_select
  on public.activity_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.repositories as repository
      where repository.id = activity_events.repository_id
        and repository.owner_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('repository-files', 'repository-files', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

create policy repository_files_select
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'repository-files'
    and private.can_read_repo(private.repository_id_from_path(name))
  );

create policy repository_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'repository-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_write_repo(private.repository_id_from_path(name))
  );

create policy repository_files_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'repository-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_write_repo(private.repository_id_from_path(name))
  )
  with check (
    bucket_id = 'repository-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_write_repo(private.repository_id_from_path(name))
  );

create policy repository_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'repository-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.can_write_repo(private.repository_id_from_path(name))
  );

create policy avatars_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy avatars_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy avatars_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
