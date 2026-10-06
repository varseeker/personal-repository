# Personal Repository

A multi-user file repository: private cloud storage with a repository browser, Markdown reading, and public sharing. It runs on Next.js and uses Supabase for authentication, Postgres, and file storage so it can be deployed to Vercel without writing uploads to the server disk.

## Project structure

```text
src/
  app/                  routes, route handlers, proxy
  actions/              server actions
  components/           UI, repository browser, previews
  lib/                  auth, security, formatting, Supabase clients
  services/             repository, folder, file, storage, compression
  types/                domain types
supabase/
  migrations/           schema, RLS, storage policies
  seed.sql              optional demo repositories
```

Business rules live in `src/services`. Pages load data on the server and pass it into client components only where the screen needs interaction.

## Database

| Table | Purpose |
| --- | --- |
| `profiles` | Username, display name, avatar, bio, storage quota. No email. |
| `repositories` | Owned repositories. Visibility defaults to `private`. |
| `folders` | Nested folders. Names are unique per parent, case-insensitively. |
| `files` | Metadata, checksum, sizes, compression, and the storage object path. |
| `repository_collaborators` | Reserved for later owner/editor/viewer sharing. Not exposed in the UI. |
| `activity_events` | Created, updated, uploaded, renamed, and deleted events. |

Privileged helpers live in the `private` schema so the Data API cannot call them directly. Search functions `search_public_repositories` and `search_my_items` are `security invoker`, so row level security still applies. `search_my_items` also requires `owner_id = auth.uid()`, so another person's public repository does not appear in your private search.

Storage object keys are `{owner_id}/{repository_id}/{file_id}`. The original filename is only in Postgres. Folder location is metadata, so moving a file does not rewrite the object.

## Supabase setup

1. Create a Supabase project.
2. In Authentication, enable email/password. Leave OAuth disabled until you are ready, then set `NEXT_PUBLIC_AUTH_PROVIDERS=github` or `google` and add the callback `https://your-domain/auth/callback`.
3. Apply the migration in `supabase/migrations/20261006120000_initial_schema.sql` with the Supabase CLI (`supabase db push`) or the SQL editor.
4. The migration creates two buckets:
   - `repository-files` is private, with a 50 MB object limit.
   - `avatars` is public-read, image types only, 2 MB limit.
5. Optional seed: create a user, set `profiles.username` to `demo`, then run `supabase/seed.sql`.

Local stack, if you use the CLI:

```bash
supabase start
supabase db reset
```

## Row level security

- Profiles can be read by anyone. Only the signed-in user can update their own row, and they cannot change their storage quota.
- Repository, folder, and file rows are readable when the repository is public, the user owns it, or a collaborator row exists.
- Inserts, updates, and deletes require ownership. Editors will be allowed to write files and folders once collaboration is turned on. Only the owner can change visibility, quota, or delete the repository.
- New repositories are inserted as the current user. The database default visibility is private. Making a repository public is a separate owner update, and the app asks for confirmation first.
- Storage policies mirror the same rules. Private objects are not served from a public bucket URL.
- Activity rows are visible only to the repository owner.
- File writes check that the storage object exists, force `stored_size` from that object, and reject the write when the user or repository quota would be exceeded.

Changing a repository id in a request does not grant access. Policies use `auth.uid()` and the repository owner, not ids supplied by the client.

## Environment variables

Copy `.env.example` to `.env.local`.

| Variable | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works as a fallback |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Rate limits, download signing, download activity |
| `NEXT_PUBLIC_AUTH_PROVIDERS` | Optional `github` and/or `google` |
| `NEXT_PUBLIC_SITE_URL` | Canonical and Open Graph URLs |
| `MAX_UPLOAD_BYTES` | App upload cap, never above the 50 MB database cap |

Never expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run typecheck
npm run build
```

## Vercel

1. Import `https://github.com/varseeker/personal-repository.git`.
2. Set these environment variables for Production and Preview: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment URL.
4. Deploy. The app does not write uploads to the Vercel filesystem.

In the Supabase Auth URL settings, add the Vercel domain and `/auth/callback`.

## How files are stored

Text, Markdown, JSON, XML, CSV, and source files are gzip-compressed when the compressed bytes are at least 5% smaller. Images, video, audio, PDF, and existing archives are stored as-is. Downloads decompress gzip objects and return the original filename. The browser computes the SHA-256 checksum of the original bytes. The database stores the checksum and replaces the reported stored size with the real object size, so a client cannot shrink its quota by lying about the byte count.

Uploads go directly from the browser to Storage so files are not limited by the Vercel request-body cap. Folder downloads build a temporary zip stream and do not keep the archive.

## Known limitations

- The hard file cap is 50 MB. Raising it requires a new migration for the check constraints and the storage bucket limit.
- Checksums are computed in the browser. The server verifies size and path ownership, not the hash bytes. An owner can record a bad checksum for their own file.
- Folder and repository zip downloads are capped at 200 files and 100 MB of original bytes so a serverless function does not hold a huge archive.
- Without `SUPABASE_SERVICE_ROLE_KEY`, rate limits are per server instance, and signed downloads fall back to the user session.
- File lists in one folder load up to 200 entries. A repository loads up to 2,000 folders for breadcrumbs and moves.
- Replacing a file overwrites the stored object. The `version` column increments, but older bytes are not kept.
- Collaboration tables and permission checks exist. There is no invite UI yet.
- Markdown does not execute raw HTML. Relative images inside Markdown are not rewritten to repository files; use an `https` image URL.
- Names are unique without regard to case, which matches Windows and avoids two README files that differ only by case.
- Public download activity is written only when the service role key is configured.
- `npm test` covers naming, compression decisions, quota math, folder trees, and the permission matrix. Live RLS tests need a Supabase database and are not run by Vitest.

## Recommended next steps

- Invite collaborators as editor or viewer using `repository_collaborators`.
- Keep `file_versions` when a file is replaced, with a separate storage object per version.
- Add expiring share links that do not make the whole repository public.
- Move rate limiting fully onto the database, which is already wired for the service role.
- Add a cleanup job for storage objects that were uploaded but never committed.
- Index more of the public catalog if the directory grows past a few thousand repositories.
