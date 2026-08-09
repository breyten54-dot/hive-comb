# HIVE — The Comb

Phone-installable command view of the HIVE workspace: honeycomb navigation, alive bees,
open todos, ETA / meetings rails, and pipeline panels.

Independent of Claude — its own repo (`hive-comb`), Vercel deploy, and URL.

## Layer roles (disk-first — Notion retired for Comb)

| Layer | Role |
|-------|------|
| **HIVE disk** | Source of truth — `public/open-todos.json`, Hand-Over / sector, Digital Brain `_STATE` |
| **The Comb** (this app) | Live board — hexes, bees, pipeline derived from disk JSON (+ optional rails) |
| **Cursor Agent + Ani** | Operators that edit the ledger; optional future: file-drop + Ani interview onboarding |

Comb **does not** require Notion. Pipeline detail falls back to `open-todos.json` when
`/api/hive` is empty or unconfigured. Legacy `api/hive.js` (Notion) may still exist for
optional use; do not block Comb setup on a Notion token.

**Live:** <https://hive-comb-iota.vercel.app>  
**Local:** `npm run serve` → <http://127.0.0.1:8765>

> ⚠️ `hive-comb.vercel.app` is **not us** — use the `-iota` URL above.

---

## Architecture

```
public/index.html        SPA (no build step)
public/open-todos.json   P0/P1 backlog the Comb + Agent keep current
public/eta.json          ETA rails
public/sw.js             App-shell cache only — never caches *.json
serve.js                 Local static + /api/tree vault scan; /api/live SSE; /api/hive stubs empty
api/hive.js              Optional Vercel Notion bridge (legacy)
```

**Auto-update (no manual refresh):**
- **Local (`8765`)** — `serve.js` watches `public/*.json` and pushes SSE on `/api/live`; the SPA refreshes panels within ~1s.
- **Everywhere** — panels also poll every **5s** (`cache: no-store`). JSON is never SW-cached.
- **Live (Vercel)** — still serves the last deploy. After editing Comb JSON: push `hive-comb` and `npx vercel --prod` so open tabs pick up the new board on the next poll.

**The comb always renders** from a skeleton + `open-todos.json` before any Notion call.

**Bees:** `HOME_BEE_COUNT=15` on the surface; `DEEP_BEE_COUNT=20` inside `#/hive`
(same wander / drama system; queen dramas deep-only).

---

## Setup

### Local

```bash
npm run serve          # http://127.0.0.1:8765
npm run verify:deep    # deep-hive + bee count checks
```

### Vercel

No app password. Deploy with `npx vercel --prod`. Optional / legacy: `NOTION_TOKEN` for `/api/hive`.

Redeploy after changing env.

---

## Product pitch (file-drop + Ani)

Already shipping the stack: disk ledger + Comb board + agent operators.
Sellable onboarding ritual (not built yet — Comb todo parked):

1. Drop a brief into a Comb Inbox folder  
2. Ani asks setup questions (owner, priority, blocked-on, path)  
3. Answers write `open-todos.json` (+ Brain / Hand-Over as needed)  
4. Comb updates without a third-party task SaaS  

---

## Deploy

```bash
vercel --prod
```

Remote: <https://github.com/breyten54-dot/hive-comb>

---

## Data model (open-todos)

- **Open todos** drive the surface ring and (when Notion is absent) Pipeline detail.
- **Needs attention** ≈ Blocked + review-like + User-owned open items.
- **Completion by area** from todo `section` tags when using the disk fallback.
- Agent standing rule: mark Done / add rows in `open-todos.json` as work finishes, bump `updatedAt`, push `hive-comb`, and `npx vercel --prod` when the list changes (local Comb updates via SSE without deploy; live Comb needs the deploy).
