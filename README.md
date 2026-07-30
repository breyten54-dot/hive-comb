# HIVE — The Comb

A standalone web app: honeycomb navigation for every HIVE project, encircled by
live pipeline, attention, priority and completion data read from Notion.

Independent of Claude — its own repo, its own Vercel deployment, its own URL.
Works on a phone home screen (installable PWA).

## Layer roles (why three surfaces exist, not one)

| Layer | Role | Flair |
|-------|------|-------|
| **The Comb** (this app) | Phone-installable **command view** — honeycomb, motion, status orbit | High — the "not a plain dashboard" surface |
| **Notion Command Center** | **Source of truth for editing** tasks/projects (⚡ HIVE Command Center) | Medium — structured DBs, pages, filters; not hex UI |
| **HIVE disk** (`_STATE.md`, sector, Digital Brain) | Pipeline truth for the Agent | Agent-facing |

Comb reads Notion (never writes). Notion is where humans/Agent edit records. Disk (`_STATE.md` +
`sector-kimi.js`) is what the Agent itself trusts for pipeline state. See
`Digital Brain\Brain\reports\2026-07-30_comb-notion-video-plan.md` for the full reasoning (why
scrapping Comb for pure Notion was rejected).

**Live:** <https://hive-comb-iota.vercel.app>
Vercel project `hive-comb` (team LetsBuild).

> ⚠️ `hive-comb.vercel.app` is **not us** — that subdomain is already taken by an
> unrelated account ("Hive Comb | Hivedec"). Vercel's `.vercel.app` namespace is
> global. Always use the `-iota` URL above, or attach a custom domain.

---

## Architecture

```
public/index.html   the whole frontend — no build step, no framework, no CDN
api/hive.js         Vercel serverless: holds the Notion token, returns flat JSON
```

**Why the serverless function exists:** a Notion token in frontend code is
publicly readable by anyone who views source. The token lives only in Vercel's
environment, and the browser only ever sees already-fetched rows. This is the
"keys server-only" rule that queued task **A2** exists to enforce.

**The comb always renders.** It draws from a hardcoded list of HIVE folder names
before any network call, so navigation never disappears because a fetch failed.
Live Notion data then upgrades it in place (status dots, real counts).

---

## Setup — one-time

See also [`NOTION-SETUP.md`](NOTION-SETUP.md) for the Cursor-sole schema checklist.

### 1. Create a Notion integration (only you can do this)

1. Go to <https://www.notion.so/my-integrations>
2. **New integration** → internal → name it `HIVE Comb` → submit
3. Copy the **Internal Integration Secret** (starts `ntn_`)

### 2. Share both databases with it

Notion returns **404 for databases the integration can't see**, even with a
valid token. For each database below: open it → `•••` (top right) →
**Connections** → add `HIVE Comb`.

| Database | ID |
|---|---|
| HIVE Tasks | `0dc4a16399414e0087faf4105a9205c7` |
| HIVE Projects Registry | `a3f251c46daf43339c585f72bda63d8c` |

### 3. Set the token in Vercel

Vercel → this project → **Settings → Environment Variables**:

| Name | Value | Environments |
|---|---|---|
| `NOTION_TOKEN` | the `ntn_…` secret | Production, Preview, Development |
| `COMB_USER` | app-gate username (K-28) | Production, Preview, Development |
| `COMB_PASSWORD` | app-gate password — strong | Production, Preview, Development |

Redeploy after adding them — env vars are read at build/run time.

**The app gate (K-28):** `middleware.js` enforces HTTP Basic auth on **every** path —
the static page AND `/api/*`. If either `COMB_*` var is unset the whole app fails
**closed** (401, no data). The browser holds the credentials (Basic-over-HTTPS), so
the phone only asks once per browser/profile.

**Rotating the gate password:** change `COMB_PASSWORD` in Vercel settings and redeploy.
Old sessions simply get a fresh Basic prompt on next load. Rotate on any suspicion of
leak — there is exactly one shared credential by design (single-operator dashboard).

> **Never** put the token in this repo, in `.env` (only `.env.local`, which is
> gitignored), or anywhere under `HIVE\` — that folder is OneDrive-synced.

---

## Local development

```bash
npm i -g vercel      # once
cp .env.example .env.local && edit it   # add the real token
npm run serve        # = vercel dev → http://localhost:3000
```

## Repo state

This repository is **local-only** — it has no git remote configured. Branches cannot
be pushed; every merge happens on this machine, and deploys run from here with
`vercel --prod`. Ref verification (BUILD-STANDARDS #26) must therefore compare the
local branch against local `master` (`git log master..<branch>`), never `origin/*`.
Whether it gets a remote is the owner's open decision (2026-07-28, K-28b).

**LAUNCH-phase note (added 2026-07-30):** once a remote exists, the standard flow is: hive-marker
verifies on `cursor/comb-video-takeaways`, the parent merges `--no-ff` into local `master`, then
pushes `master` (and the branch, if keeping it) to `origin`. Until a remote exists, "launch" means
the local `--no-ff` merge only — do not invent a remote or push anywhere from a build or mark pass.

## Deploy

```bash
vercel --prod
```

Or connect the GitHub repo to Vercel and push — every push to `main` deploys.

---

## API

`GET /api/hive`

```jsonc
{
  "fetchedAt": "2026-07-28T13:00:00.000Z",
  "tasks":    [ { "id": "…", "Task": "…", "Status": "Done", "Priority": "P1 High",
                  "Owner": "Kimi", "Area": ["Deploy"], "Ref": "K26", "Next Step": "…" } ],
  "projects": [ { "id": "…", "Project": "…", "Folder": "…", "Live URL": "…",
                  "Status": "Active", "Notes": "…" } ],
  "partial":  { "tasks": "…error…" }   // present only if ONE database failed
}
```

Failure modes are distinct on purpose — the frontend shows a different message
for each, because each has a different fix:

| Status | Meaning | Fix |
|---|---|---|
| 500 `missing_token` | `NOTION_TOKEN` not set | Add it in Vercel settings |
| 401 / 403 | Token wrong or revoked | Regenerate, update Vercel |
| 404 | Database not shared with the integration | Add the connection in Notion |
| 429 | Notion rate limit | Waits and clears itself |

---

## Data model

The app reads, never writes. Notion remains the single place work is edited —
this is a view onto it.

- **Completion by area** is `Done ÷ total` per `Area` tag. It is *not* per
  project: tasks carry Area tags, not project relations. Per-project completion
  would need a `Project` relation added to the Tasks database first.
- **Needs attention** = `Blocked` + `Pending Review` + anything owned by `User`.
- **The comb** = one cell per row in the Projects Registry, ringed around a
  central `HIVE` hub cell that summarises the pipeline.
