<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cloud Agent

The Cloud Agent environment installs dependencies, Docker, and the Supabase CLI. On boot it starts Docker and the local Supabase stack, writes `.env.local` from `supabase status`, and runs `npm run dev` on port 3000. `.env.local` is gitignored. Email confirmation is off in `supabase/config.toml`, so local registration does not need an inbox.

Docker in this VM uses the `fuse-overlayfs` storage driver. Container-to-container traffic also needs `net.bridge.bridge-nf-call-iptables=0` and `net.bridge.bridge-nf-call-ip6tables=0`. The environment scripts set both before `supabase start`.
