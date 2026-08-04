# Comb — in-browser links

All links from The Comb now stay in the Cursor browser (same tab where possible). No `target="_blank"` remains in `public/index.html`, so product websites, Notion rows, GitHub URLs, and ETA files all navigate inside the same browser surface.

## Serve command

```powershell
cd "C:\Users\Breyten\OneDrive\Desktop\HIVE\Comb"
npm run serve
```

This starts `node serve.js` on `http://127.0.0.1:8765`. It serves:

- `public/` at `/`
- `../ETA Work/` at `/files/`

It replaces the previous `python -m http.server` from `Comb/public` because that server could not reach files outside `public/`.

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

## What changed

- `public/index.html` — removed all `target="_blank"`; added ETA panel loaded from `eta.json`; product/Notion/GitHub links use same-tab navigation.
- `public/eta.json` — local ETA list with PDF and DOCX paths.
- `public/preview/docx.html` — in-browser DOCX preview page.
- `serve.js` — local Node static server that serves both `public/` and `../ETA Work/`.
- `package.json` — `npm run serve` now runs `node serve.js` (old `vercel dev` kept as `serve:vercel`).
- `verify-in-browser-links.js` — 10-point verifier runnable with `node verify-in-browser-links.js` while the server is up.

## DOCX preview limitation

- mammoth.js converts document body to HTML; complex formatting, embedded images, tables, and tracked changes may render imperfectly.
- If the preview fails, the page still shows a direct download link to the DOCX in the same browser tab.
- The sample assignment DOCX was generated from the existing `BMSR114-Written-Test-brief.txt` for click-testing the preview mechanism.
