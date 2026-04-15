# OTSAR Input Pipeline

Phase 1 MVP per EC-026. A single-page Next.js app that converts YouTube URLs, AI chat transcripts, and free memos into CD-025-compliant markdown nodes, and commits them to the AgenticOS vault via the GitHub API.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO,
# PIPELINE_SECRET, NEXT_PUBLIC_PIPELINE_SECRET
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude parsing (`claude-opus-4-6`). |
| `GITHUB_TOKEN` | PAT with `repo` scope for commits. |
| `GITHUB_OWNER` | GitHub username or org owning the vault repo. |
| `GITHUB_REPO` | Repo name (e.g. `AgenticOS`). |
| `PIPELINE_SECRET` | Server-side secret; required in `x-pipeline-secret` header. |
| `NEXT_PUBLIC_PIPELINE_SECRET` | Same value, exposed to the client so it can attach the header. |

The shared secret is not a real auth boundary — it only deters drive-by traffic on a single-user deployment.

## Flow

1. Pick a mode: **YouTube / 대화 / 메모**.
2. Paste URL or text → **Parse**.
   - YouTube URLs fetch captions via `youtube-transcript` (videos without captions fail — Whisper fallback is Phase 2).
   - Claude returns `{ importance, summary, nodes[], edges[] }` using the closed CD-052 relation set.
3. Review the nodes and relations.
4. **Approve & Commit** → one commit per node under `vault/raw/input-pipeline/{prefix}-{slug}.md`.
   - Prefix map: `concept→c, person→p, tool→t, idea→d, event→x`.
   - If the path already exists, a UTC timestamp suffix is appended (`...-20260416T031245.md`) — no in-place merging in Phase 1.

## Deploying to Vercel

1. Push to GitHub, import into Vercel.
2. Set all env vars in the Vercel dashboard. Keep `PIPELINE_SECRET` and `NEXT_PUBLIC_PIPELINE_SECRET` identical.
3. `/api/parse` and `/api/save` set `maxDuration = 60` — requires Vercel Pro. On the free tier the ceiling is 10 s; short memos work but long YouTube transcripts may time out.

## Out of scope (Phase 2)

Graph viewer, Obsidian export, `decay_score`/`recurrence`, LightRAG, Supabase Auth, Whisper fallback, in-place relation merging for duplicate node ids.
