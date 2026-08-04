// CDP check: Assignments left of comb, Meetings right, same row.
import http from "http";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
// Node 22+ provides a global WebSocket (no npm dep).
const browser =
  process.env.BROWSER_PATH ||
  [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].find((p) => fs.existsSync(p));

if (!browser) {
  console.error("No Chrome/Edge found");
  process.exit(2);
}

const port = Number(process.env.CDP_PORT || 9344);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "comb-cdp-"));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpJson(p) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port, path: p }, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function waitPort(tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      await httpJson("/json/version");
      return;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("CDP not up");
}

function attach(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener("open", () => {
      const send = (method, params = {}) =>
        new Promise((res, rej) => {
          const i = ++id;
          pending.set(i, (msg) =>
            msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
          );
          ws.send(JSON.stringify({ id: i, method, params }));
        });
      resolve({ ws, send });
    });
    ws.addEventListener("error", () => reject(new Error("WebSocket error")));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });
  });
}

async function freshPage() {
  const targets = await httpJson("/json/list");
  let page = targets.find((t) => t.type === "page");
  if (!page) {
    // Create one
    await httpJson("/json/new?about:blank").catch(() => null);
    await sleep(300);
    const again = await httpJson("/json/list");
    page = again.find((t) => t.type === "page") || again[0];
  }
  return attach(page.webSocketDebuggerUrl);
}

async function measure(width) {
  const { ws, send } = await freshPage();
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Page.navigate", {
    url: `http://127.0.0.1:8765/?nocache=${Date.now()}-${width}`,
  });
  // Wait for load
  await sleep(1500);
  // Unregister SW then navigate again (no in-page reload — keeps CDP session)
  await send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `(async()=>{
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (_) {}
      return true;
    })()`,
  });
  await send("Page.navigate", {
    url: `http://127.0.0.1:8765/?fresh=${Date.now()}-${width}`,
  });
  await sleep(1600);

  const { result } = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(()=>{
      const assign = document.getElementById('assignRail');
      const meet = document.getElementById('meetRail');
      const core = document.querySelector('#combcard .comb-core');
      const wrap = document.querySelector('#combcard .combwrap');
      const box = el => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height };
      };
      return {
        cols: wrap ? getComputedStyle(wrap).gridTemplateColumns : null,
        overflowX: wrap ? getComputedStyle(wrap).overflowX : null,
        assign: box(assign),
        core: box(core),
        meet: box(meet),
      };
    })()`,
  });
  ws.close();
  const geo = result.value;
  const a = geo.assign;
  const c = geo.core;
  const m = geo.meet;
  const leftOf = !!(a && c && a.right <= c.left + 2);
  const rightOf = !!(m && c && m.left >= c.right - 2);
  const sameRow = !!(a && c && m && Math.abs(a.top - c.top) < 100 && Math.abs(m.top - c.top) < 100);
  console.log(`--- viewport ${width} ---`);
  console.log(
    JSON.stringify(
      {
        cols: geo.cols,
        overflowX: geo.overflowX,
        assign: a,
        core: c,
        meet: m,
        leftOf,
        rightOf,
        sameRow,
      },
      null,
      2
    )
  );
  return leftOf && rightOf && sameRow;
}

const child = spawn(
  browser,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userData}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true }
);

try {
  await waitPort();
  const r1 = await measure(1400);
  const r2 = await measure(1100);
  const r3 = await measure(900);
  console.log("SUMMARY", { w1400: r1, w1100: r2, w900: r3 });
  process.exit(r1 && r2 && r3 ? 0 : 1);
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  try {
    child.kill();
  } catch {
    /* ignore */
  }
}
