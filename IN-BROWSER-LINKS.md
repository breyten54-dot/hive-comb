# Comb — in-browser links

All links from The Comb stay in the Cursor browser (same tab). No `target="_blank"` in `public/index.html`.

## Serve command

```powershell
cd "C:\Users\Breyten\OneDrive\Desktop\HIVE\Comb"
npm run serve
```

Serves `public/` at `/` and `../ETA Work/` at `/files/` → `http://127.0.0.1:8765`.

## Layout

```
Header
[ Left: Open todos (projects) ]
[ Left: ETA tests table ]
[ Center comb card ]
  [ Assignments hex calendar | honeycomb | Meetings hex calendar ]
[ Pipeline detail disclosure ]
```

- **Open todos** — `open-todos.json` (projects / portfolio backlog).
- **ETA tests** — `eta.json` rows with `type: Test` (study PDF columns).
- **Left rail** — assignment hex calendar (`type: Assignment`), 3 per row, scrollable; select opens detail panel.
- **Right rail** — meeting hex calendar (`meetings.json`), 3 per row, scrollable; select opens detail panel (Work / Personal).
- **Honeycomb** — product cells + website chips from `product-lanes.json`.
- Calendars: Work Outlook `Breyten@praeto.co.za` · Personal Google `Breyten54@gmail.com` via `scripts/sync-meetings.js` → `meetings.json`.

## Test URLs

```
http://127.0.0.1:8765/
http://127.0.0.1:8765/files/study-guide/2026-08-18/BMSR114-Written-Test-STUDY-GUIDE.pdf
http://127.0.0.1:8765/preview/docx.html?file=/files/deadlines/briefs/2026-08-14/BMSR114-Written-Test-brief.docx
```
