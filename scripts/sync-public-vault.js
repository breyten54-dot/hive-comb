/**
 * sync-public-vault.js
 *
 * Copies safe public artefacts into Comb/public/vault-public/<root>/
 * and writes Comb/public/public-tree.json for live Comb (no serve.js disk).
 *
 * Roots:
 *  - football: Football/public-surface/
 *  - eta-work: assessment outputs + handouts from ETA registry manifests
 *
 * Usage (from Comb/): node scripts/sync-public-vault.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMB_ROOT = path.resolve(__dirname, "..");
const HIVE_ROOT = path.resolve(COMB_ROOT, "..");
const ETA_WORK = path.join(HIVE_ROOT, "ETA Work");
const REGISTRY_FILE = path.join(ETA_WORK, "assessments", "_registry.json");
const OUT_VAULT = path.join(COMB_ROOT, "public", "vault-public");
const OUT_TREE = path.join(COMB_ROOT, "public", "public-tree.json");

/** Folder-walk public roots (Football-style). */
const FOLDER_ROOTS = [
  {
    id: "football",
    label: "Football",
    source: path.join(HIVE_ROOT, "Football", "public-surface"),
    sections: [
      { id: "assets", label: "Club badges", match: /^assets\//i },
      { id: "trials", label: "Trials", match: /^trials\//i },
      { id: "forms", label: "Blank forms", match: /^forms\//i },
      { id: "safa", label: "SAFA letters", match: /^safa\//i },
    ],
    stemLabels: {
      "ethekwini-city-fc-badge": "Badge - Ethekwini City FC",
      "manning-rangers-sporting-badge": "Badge - Manning Rangers Sporting",
      "ethekwini-city-fc-player-trials-15-aug-2026": "Trials Poster - 15 Aug 2026",
      "Player-Profile-Form-2026": "Player Profile Form (blank, 2026)",
      "MYSAFA-Registration-Form": "MYSAFA Registration Form (blank)",
      "SAFA-Club-Name-Change-and-League-Placement-Request-2026":
        "SAFA Club Name Change & League Placement (2026)",
    },
  },
];

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function walkFiles(dir, baseRel = "") {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === "README.md" || name.startsWith(".")) continue;
    const abs = path.join(dir, name);
    const rel = baseRel ? `${baseRel}/${name}` : name;
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walkFiles(abs, rel.replace(/\\/g, "/")));
    else if (st.isFile()) {
      out.push({
        abs,
        rel: rel.replace(/\\/g, "/"),
        bytes: st.size,
        mtime: st.mtime.toISOString(),
      });
    }
  }
  return out;
}

function stemLabel(rel, map) {
  const stem = path.basename(rel, path.extname(rel));
  if (map[stem]) return map[stem];
  const hit = Object.keys(map).find((k) => k.toLowerCase() === stem.toLowerCase());
  if (hit) return map[hit];
  return stem.replace(/[-_+]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function toEtaRel(p) {
  if (!p) return null;
  let s = String(p).replace(/\\/g, "/");
  if (s.startsWith("/files/")) {
    s = decodeURIComponent(s.slice("/files/".length));
  }
  s = s.replace(/^ETA Work\//i, "");
  return s || null;
}

function absFromEtaRel(rel) {
  return path.join(ETA_WORK, ...rel.split("/"));
}

function entriesFromAbsList(fileAbsByRel, rootId, stemLabels) {
  const entries = [];
  for (const [rel, abs] of Object.entries(fileAbsByRel)) {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      console.warn(`skip missing ${rel}`);
      continue;
    }
    const st = fs.statSync(abs);
    const dest = path.join(OUT_VAULT, rootId, ...rel.split("/"));
    copyFile(abs, dest);
    const ext = path.extname(rel).toLowerCase();
    const stem = path.basename(rel, ext);
    const label = stemLabel(rel, stemLabels || {});
    entries.push({
      id: slugify(rel),
      label,
      stem,
      stemLabel: label,
      ext,
      rel,
      url: `/vault-public/${rootId}/${rel.split("/").map(encodeURIComponent).join("/")}`,
      bytes: st.size,
      mtime: st.mtime.toISOString(),
    });
  }
  return entries;
}

function sectionize(entries, sectionDefs) {
  const sections = sectionDefs
    .map((s) => ({
      id: s.id,
      label: s.label,
      files: entries.filter((e) => s.match.test(e.rel)),
    }))
    .filter((s) => s.files.length);
  const other = entries.filter((e) => !sectionDefs.some((s) => s.match.test(e.rel)));
  if (other.length) sections.push({ id: "other", label: "Other", files: other });
  return sections;
}

function syncFolderRoot(def) {
  const destRoot = path.join(OUT_VAULT, def.id);
  if (fs.existsSync(destRoot)) fs.rmSync(destRoot, { recursive: true, force: true });
  ensureDir(destRoot);
  const files = walkFiles(def.source);
  const byRel = {};
  for (const f of files) byRel[f.rel] = f.abs;
  const entries = entriesFromAbsList(byRel, def.id, def.stemLabels);
  return {
    root: { id: def.id, label: def.label },
    sections: sectionize(entries, def.sections),
    fileCount: entries.length,
  };
}

/** Collect ETA assessment drafts + handouts from registry manifests. */
function collectEtaPublicFiles() {
  const byRel = {};
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.warn("ETA registry missing — skip eta-work sync");
    return byRel;
  }
  const reg = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
  for (const entry of reg.assessments || []) {
    const manPath = path.join(ETA_WORK, "assessments", entry.dir, "manifest.json");
    if (!fs.existsSync(manPath)) continue;
    const m = JSON.parse(fs.readFileSync(manPath, "utf8"));
    const add = (p) => {
      const rel = toEtaRel(p);
      if (!rel) return;
      const abs = absFromEtaRel(rel);
      if (fs.existsSync(abs)) byRel[rel] = abs;
    };
    if (m.outputs) {
      add(m.outputs.pdf);
      add(m.outputs.docx);
      add(m.outputs.html);
    }
    if (m.comb) {
      add(m.comb.handoutWord);
      add(m.comb.viewPdf);
    }
    // Source briefs marked official in sources.artefacts (docx/pdf/html only)
    for (const a of (m.sources && m.sources.artefacts) || []) {
      const role = String(a.role || "");
      if (/brief|handout|official/i.test(role) || /\.(pdf|docx|html)$/i.test(a.path || "")) {
        if (/\.(pdf|docx|html)$/i.test(a.path || "")) add(a.path);
      }
    }
  }
  return byRel;
}

function syncEtaRoot() {
  const id = "eta-work";
  const destRoot = path.join(OUT_VAULT, id);
  if (fs.existsSync(destRoot)) fs.rmSync(destRoot, { recursive: true, force: true });
  ensureDir(destRoot);
  const byRel = collectEtaPublicFiles();
  const entries = entriesFromAbsList(byRel, id, {
    "BMSR116-Integrated-Task-DRAFT": "BMSR 116 Integrated Task — Draft",
    "BMSR120-LA1-Role-Play-Scenarios-DRAFT": "BMSR 120 Role-Play — Draft",
    "BMSR120-Key-Functions-The-Interview-DRAFT": "BMSR 120 Key Functions Interview — Draft",
    "BMSR114-Written-Test-STUDY-GUIDE": "BMSR 114 Written Test — Study Guide",
    "BMSR116_Integrated assessment_2026": "BMSR 116 Integrated Task — Official brief",
    "Consent Form_BMSR 120": "BMSR 120 Consent Form",
  });
  const sections = sectionize(entries, [
    { id: "assessments", label: "Assessment drafts", match: /^assessments\//i },
    { id: "study-guide", label: "Study guides", match: /^study-guide\//i },
    { id: "deadlines", label: "Handouts", match: /^deadlines\//i },
  ]);
  return {
    root: { id, label: "ETA Work" },
    sections,
    fileCount: entries.length,
  };
}

function main() {
  ensureDir(OUT_VAULT);
  const roots = [];
  for (const def of FOLDER_ROOTS) {
    if (!fs.existsSync(def.source)) {
      console.warn(`skip ${def.id}: missing ${def.source}`);
      continue;
    }
    const tree = syncFolderRoot(def);
    roots.push(tree);
    console.log(`OK ${def.id}: ${tree.fileCount} files → vault-public/${def.id}/`);
  }
  const eta = syncEtaRoot();
  roots.push(eta);
  console.log(`OK eta-work: ${eta.fileCount} files → vault-public/eta-work/`);

  const doc = {
    updatedAt: new Date().toISOString(),
    source: "Football/public-surface + ETA assessment outputs → Comb/public/vault-public",
    privacy:
      "Public Comb URL plane only. Full ETA shelf and Football contracts stay on local serve.js.",
    roots,
  };
  fs.writeFileSync(OUT_TREE, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT_TREE}`);
}

main();
