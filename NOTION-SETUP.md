# NOTION-SETUP — Cursor-sole schema checklist (2026-07-30)

Prepared so the user can open each database, click the property, and paste. The Agent has no
Notion MCP access and cannot apply these — they are **manual, user-applied edits in the Notion
UI**. Source: the 2026-07-30 `comb-video-takeaways` handover, "Notion checklist (C5–C7)".

Comb's frontend (Workstream D of that handover) already recognizes **both** the legacy and the
new option strings, so nothing breaks while this migration is applied — old rows keep working.

Hub: **⚡ HIVE Command Center** — `https://app.notion.com/p/3aaab30fe57181539be4f58c767debd3`
DBs: **HIVE Tasks** `0dc4a16399414e0087faf4105a9205c7` · **HIVE Projects Registry** `a3f251c46daf43339c585f72bda63d8c`

## HIVE Tasks: `Owner` select — replace/add these exact options

```
Cursor
User
hive-builder
hive-marker
```

(Retire `Claude` and `Kimi` as the DEFAULT for new rows — existing rows using them stay valid;
Comb's code recognizes both eras, so nothing breaks if old rows keep the legacy value.)

## HIVE Tasks: `Status` select — replace/add these exact options, mapped from the old set

```
Todo            (unchanged)
Building        (was "In Progress")
In Review       (was "Pending Review")
Blocked         (unchanged)
Done            (unchanged)
Parked          (new)
```

## HIVE Tasks: new `Phase` select — add these exact options

```
PLAN
BUILD
MARK
LAUNCH
```

## HIVE Tasks: `Project` relation

Confirm every open task row has a **Project** relation set (link to the matching row in HIVE
Projects Registry) — this is what makes Comb's per-project completion bars and the cell "breathe"
effect accurate. Name any row that is genuinely cross-cutting rather than forcing a relation that
doesn't fit — Comb already displays an "untagged" count for exactly this case.

## HIVE Projects Registry: add `HIVE path` (text) + `GitHub` (url) properties, set to:

| Project row | `HIVE path` | `GitHub` |
|---|---|---|
| Stella Indoor | `Stella Project\` | `https://github.com/breyten54-dot/stella-Indoor` |
| Stella Glenwood | `Stella@Glenwood Webapp\` | `https://github.com/breyten54-dot/Stella-Glenwood` |
| Project Tech (TechCo) | `Project Tech\` | `https://github.com/breyten54-dot/Praeto-Group-TechCo` |
| Praeto Balance / PABOS | `Praeto Office AI Portal\` | `https://github.com/breyten54-dot/pabos-enterprise` |
| Praeto Compliance Club | `Million dollar 90 day plan\Praeto-Web-Project\vercel-compliance-club\` | `https://github.com/breyten54-dot/compliance-club` |
| The Comb | `Comb\` | *(none yet — repo is local-only, remote is an open owner decision)* |

(Values sourced from `Digital Brain\Brain\entities\topics\Projects.md`, verified against that
table's own 2026-07-30 corrections — re-check that table if it has moved since this file.)

## Optional, not required

- A Video-Inbox log database in Notion (file / reviewed? / themes / Brain-report-link columns) —
  skip unless the user asks for it separately.

## User gates (still explicitly NOT automated — from the 2026-07-30 plan report C1–C3)

- Rotate `NOTION_TOKEN` (it was pasted into an old transcript).
- Confirm `NOTION_TOKEN` / `COMB_USER` / `COMB_PASSWORD` are still set in Vercel after the profile
  rebuild.
- Custom domain for Comb (optional).
