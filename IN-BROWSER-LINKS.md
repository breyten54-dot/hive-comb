# Comb — in-browser links

All links from The Comb stay in the Cursor browser (same tab). No `target="_blank"` remains in `public/index.html`, so product websites, Notion rows, GitHub URLs, and ETA files all navigate inside the same browser surface.

## Serve command

```powershell
cd "C:\Users\Breyten\OneDrive\Desktop\HIVE\Comb"
npm run serve
```

This starts `node serve.js` on `http://127.0.0.1:8765`. It serves:

- `public/` at `/`
- `../ETA Work/` at `/files/`

## Layout

```
Header
[ Left: Open todos ] [ Center: SHRUNK honeycomb ] [ Right: ETA deadlines ]
[ Bottom: Meetings from calendars ]
```

- **Open todos** reads `public/open-todos.json` (seeded from `ETA Work\etaconnect-monitor\open-todos-seed.js`).
- **Honeycomb** is the shrunk spine of HIVE projects. Click a cell to open a drawer with Notion-style labeled website chips from `public/product-lanes.json` and the HIVE path.
- **ETA** reads `public/eta.json` and shows Name · Type · Date · Study guide · PDF.
- **Meetings** reads `public/meetings.json` and labels each item Work or Personal. Empty state is shown when no meetings are loaded.
- **Pipeline detail** is an optional disclosure below the spine that keeps the old orbit panels (Pipeline, Needs attention, What to do next, Completion, corner stats) without competing with the spine.

## Test URLs

Open the Comb homepage in the Cursor browser:

```
http://127.0.0.1:8765/
```

ETA sample links in the UI:

- **PDF:** `http://127.0.0.1:8765/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf`  
  Serves with `Content-Type: application/pdf` and `Content-Disposition: inline`, so it opens in the browser’s PDF viewer.

- **Word:** `http://127.0.0.1:8765/preview/docx.html?file=/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx`  
  Renders the DOCX as HTML inside the Cursor browser using [mammoth.js](https://unpkg.com/mammoth). Falls back to a download link if preview fails.

## Calendar sync

`scripts/sync-meetings.js` is a stub that documents the OAuth setup for Work Outlook (`Breyten@praeto.co.za`) and Personal Google (`Breyten54@gmail.com`). Tokens live in `~/.eta-monitor/calendar.json` or env vars — never commit secrets. The stub writes `public/meetings.json` with an empty `meetings` array until tokens are configured.

## What changed

- `public/index.html` — new spine layout (open todos / honeycomb / ETA), meetings strip, optional Pipeline detail disclosure, updated SKELETON, product-lanes website chips, same-tab links.
- `public/open-todos.json` — local open todo list seeded from the portfolio backlog.
- `public/product-lanes.json` — websites per product matching the Notion hub.
- `public/meetings.json` — calendar data shape, starts empty.
- `public/eta.json` — local ETA list with PDF and DOCX paths.
- `public/preview/docx.html` — in-browser DOCX preview page.
- `serve.js` — local Node static server that serves both `public/` and `../ETA Work/`.
- `package.json` — `npm run serve` now runs `node serve.js` (old `vercel dev` kept as `serve:vercel`).
- `verify-in-browser-links.js` — 14-point verifier runnable with `node verify-in-browser-links.js` while the server is up.
- `scripts/sync-meetings.js` — OAuth stub for calendar sync.

## DOCX preview limitation

- mammoth.js converts document body to HTML; complex formatting, embedded images, tables, and tracked changes may render imperfectly.
- If the preview fails, the page still shows a direct download link to the DOCX in the same browser tab.
- The sample assignment DOCX was generated from the existing `BMSR114-Written-Test-brief.txt` for click-testing the preview mechanism.
