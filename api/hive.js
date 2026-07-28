/**
 * GET /api/hive
 *
 * The only server-side piece of The Comb. It holds the Notion token so the
 * browser never sees it (keys server-only — the A2 rule), queries the two
 * HIVE databases, flattens Notion's nested property shapes into plain rows,
 * and returns one JSON payload the frontend can render directly.
 *
 * Required env var (set in Vercel → Project → Settings → Environment Variables):
 *   NOTION_TOKEN   ntn_… — an internal integration token from
 *                  https://www.notion.so/my-integrations
 *                  BOTH databases below must be shared with that integration
 *                  (open database → ••• → Connections → add it), or Notion
 *                  answers 404 even with a valid token.
 *
 * Optional overrides (defaults are the live HIVE databases):
 *   NOTION_TASKS_DB, NOTION_PROJECTS_DB
 */

const NOTION_VERSION = "2022-06-28";
const DEFAULT_TASKS_DB = "0dc4a16399414e0087faf4105a9205c7";
const DEFAULT_PROJECTS_DB = "a3f251c46daf43339c585f72bda63d8c";

/** Notion wraps every value in a type envelope; the UI wants plain values. */
function flattenProp(prop) {
  if (!prop || typeof prop !== "object") return null;
  switch (prop.type) {
    case "title":
      return (prop.title || []).map((t) => t.plain_text).join("").trim();
    case "rich_text":
      return (prop.rich_text || []).map((t) => t.plain_text).join("").trim();
    case "select":
      return prop.select ? prop.select.name : null;
    case "status":
      return prop.status ? prop.status.name : null;
    case "multi_select":
      return (prop.multi_select || []).map((o) => o.name);
    case "url":
      return prop.url || null;
    case "checkbox":
      return !!prop.checkbox;
    case "number":
      return prop.number;
    case "date":
      return prop.date ? prop.date.start : null;
    case "people":
      return (prop.people || []).map((p) => p.name || p.id);
    case "formula":
      return prop.formula ? (prop.formula.string ?? prop.formula.number ?? prop.formula.boolean) : null;
    default:
      return null;
  }
}

function flattenPage(page) {
  const row = { id: page.id, url: page.url };
  const props = page.properties || {};
  for (const key of Object.keys(props)) row[key] = flattenProp(props[key]);
  return row;
}

/** Query one database, following pagination. */
async function queryDatabase(dbId, token) {
  const rows = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 }),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const body = await res.json();
        detail = body.message || body.code || "";
      } catch {
        /* non-JSON error body — status alone will have to do */
      }
      const err = new Error(detail || `Notion responded ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    (data.results || []).forEach((p) => rows.push(flattenPage(p)));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return rows;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    // Distinct from an auth failure: nothing is configured yet.
    return res.status(500).json({
      error: "missing_token",
      message: "NOTION_TOKEN is not set on this deployment.",
    });
  }

  const tasksDb = process.env.NOTION_TASKS_DB || DEFAULT_TASKS_DB;
  const projectsDb = process.env.NOTION_PROJECTS_DB || DEFAULT_PROJECTS_DB;

  try {
    // Independent failure domains: one database being unshared shouldn't
    // blank the whole page, so settle both and report per-section.
    const [tasks, projects] = await Promise.allSettled([
      queryDatabase(tasksDb, token),
      queryDatabase(projectsDb, token),
    ]);

    if (tasks.status === "rejected" && projects.status === "rejected") {
      const status = tasks.reason.status || 502;
      return res.status(status).json({
        error: "notion_error",
        message: tasks.reason.message,
      });
    }

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({
      fetchedAt: new Date().toISOString(),
      tasks: tasks.status === "fulfilled" ? tasks.value : [],
      projects: projects.status === "fulfilled" ? projects.value : [],
      partial:
        tasks.status === "rejected"
          ? { tasks: tasks.reason.message }
          : projects.status === "rejected"
            ? { projects: projects.reason.message }
            : undefined,
    });
  } catch (e) {
    return res.status(502).json({ error: "notion_error", message: e.message });
  }
}
