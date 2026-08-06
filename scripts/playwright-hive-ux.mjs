/**
 * Comb deep-hive Playwright UX suite — grounded in user complaints:
 * 1. App links visible on Stella/Praeto (Submission-style App rows)
 * 2. Football/ETA labeled folder doors (Contracts, Study guide…)
 * 3. Center hex is System; ring has ETA not School work
 * 4. Folder panel has visible ← Back (pback)
 * 5. File open → Back returns to folder (not close everything / not window-in-window)
 * 6. Embedded PDF/DOCX uses bare=1 (no nested “Back to Comb” chrome)
 *
 * Usage: node scripts/playwright-hive-ux.mjs
 * Requires: Comb serve on 8765, playwright browsers installed.
 */
import { chromium } from "playwright";

const BASE = process.env.COMB_BASE || "http://127.0.0.1:8765";
let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log("PASS  " + name);
  else {
    failures++;
    console.log("FAIL  " + name + (detail ? " — " + detail : ""));
  }
}

async function clickDeepHex(page, label) {
  const cell = page.locator("#deepStage .deep-cell").filter({ hasText: label }).first();
  await cell.click({ timeout: 8000 });
}

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  await page.goto(BASE + "/?pw=1#/hive", { waitUntil: "networkidle" });
  await page.waitForSelector("#deepHive:not([hidden])", { timeout: 10000 });
  await page.waitForSelector("#deepStage .deep-cell", { timeout: 10000 });
  await page.waitForTimeout(400);

  // --- L1 layout complaints ---
  const hubText = await page.locator("#deepStage .deep-cell.hub").evaluate((el) => el.textContent || "");
  check("center hub is System", /System/i.test(hubText), hubText);

  const ring = await page.locator("#deepStage .deep-cell:not(.hub)").evaluateAll((els) =>
    els.map((el) => (el.textContent || "").replace(/\s+/g, " ").trim())
  );
  const ringJoined = ring.join(" | ");
  check("ring has ETA", ring.some((t) => /\bETA\b/.test(t)), ringJoined);
  check("ring does not say School work", !ring.some((t) => /School work/i.test(t)), ringJoined);
  check("ring has Football", ring.some((t) => /Football/i.test(t)), ringJoined);
  check("ring has Stella", ring.some((t) => /Stella/i.test(t)), ringJoined);
  check("ring has Praeto", ring.some((t) => /Praeto/i.test(t)), ringJoined);
  check("System is not a ring hex", !ring.some((t) => /^System$/i.test(t.trim())), ringJoined);

  const scrollLock = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const cs = getComputedStyle(body);
    return {
      deepOn: body.classList.contains("deep-on") && html.classList.contains("deep-on"),
      overflow: cs.overflow + "/" + cs.overflowY,
      bodyScrollable: body.scrollHeight > body.clientHeight + 2,
      docScrollable: html.scrollHeight > html.clientHeight + 2,
      windowScrollYMax: Math.max(0, (html.scrollHeight - html.clientHeight)),
    };
  });
  check("deep-on on html+body", scrollLock.deepOn, JSON.stringify(scrollLock));
  check("hive L1 page not document-scrollable", scrollLock.windowScrollYMax <= 2, JSON.stringify(scrollLock));

  // --- Stella app links (Submission-style) ---
  await clickDeepHex(page, "Stella");
  await page.waitForSelector("#panel.on");
  await page.waitForFunction(() => /Stella/i.test(document.getElementById("pbody")?.innerText || ""));
  const stellaBody = await page.locator("#pbody").evaluate((el) => el.innerText || "");
  check("Stella panel open", /Stella/i.test(stellaBody), stellaBody.slice(0, 120));
  const appKeys = await page.locator("#pbody .row .k").evaluateAll((els) => els.map((e) => (e.textContent || "").trim()));
  check("Stella has App rows", appKeys.filter((k) => /^app$/i.test(k)).length >= 2, appKeys.join(","));
  check("Stella Indoor client link", await page.locator('#pbody a[href*="stella-indoor.web.app"]').count() >= 1, "");
  check("Stella Indoor admin link", await page.locator('#pbody a[href*="stella-indoor-admin.web.app"]').count() >= 1, "");
  check("Stella Glenwood link", await page.locator('#pbody a[href*="stella-glenwood.vercel.app"]').count() >= 1, "");
  check("folder/file panel has ← Back button", await page.locator("#pback").isVisible(), "");
  await page.locator("#pback").click();
  await page.waitForFunction(() => !document.getElementById("panel").classList.contains("on"));

  // --- Praeto app links ---
  await clickDeepHex(page, "Praeto");
  await page.waitForSelector("#panel.on");
  await page.waitForFunction(() => /Praeto|Compliance|Balance/i.test(document.getElementById("pbody")?.innerText || ""));
  check("Praeto Compliance Club link", await page.locator('#pbody a[href*="compliance-club.vercel.app"]').count() >= 1, "");
  check("Praeto Balance demo link", await page.locator('#pbody a[href*="praeto-balance-demo"]').count() >= 1, "");
  await page.locator("#px").click();
  await page.waitForFunction(() => !document.getElementById("panel").classList.contains("on"));

  // --- Football labeled doors + back stack ---
  await clickDeepHex(page, "Football");
  await page.waitForSelector("#panel.on");
  const folderChips = page.locator("#pbody [data-work-door]");
  await folderChips.first().waitFor({ state: "visible", timeout: 10000 });
  const folderLabels = await folderChips.evaluateAll((els) => els.map((e) => (e.textContent || "").trim()));
  check("Football has Contracts door", folderLabels.some((t) => /Contracts/i.test(t)), folderLabels.join(", "));
  check("Football has Player profiles door", folderLabels.some((t) => /Player profiles/i.test(t)), folderLabels.join(", "));
  check("Football websites MYSAFA", await page.locator('#pbody a[href*="mysafa"]').count() >= 1, "");

  const contracts = folderChips.filter({ hasText: "Contracts" }).first();
  await contracts.click();
  await page.waitForFunction(() => /Contracts/i.test(document.getElementById("pbody").innerText));
  check("Contracts folder panel Back visible", await page.locator("#pback").isVisible(), "");
  const fileBtn = page.locator("#pbody [data-file-idx]").first();
  await fileBtn.waitFor({ state: "visible" });
  const folderTitle = await page.locator("#pbody h2").evaluate((el) => el.textContent || "");

  await fileBtn.click();
  await page.waitForSelector("#pbody iframe.comb-embed", { timeout: 10000 });
  const iframeSrc = await page.locator("#pbody iframe.comb-embed").getAttribute("src");
  check("file preview uses bare=1 (no nested Comb chrome)", !!(iframeSrc && iframeSrc.includes("bare=1")), iframeSrc || "(no iframe)");

  // Back from file → folder (not fully closed)
  await page.locator("#pback").click();
  await page.waitForFunction((prev) => {
    const body = document.getElementById("pbody");
    const panel = document.getElementById("panel");
    return panel.classList.contains("on") && body && body.innerText.includes(prev) && !panel.classList.contains("embed");
  }, folderTitle);
  check("Back from file returns to folder panel", true, "");
  check("folder still shows Files chips", await page.locator("#pbody [data-file-idx]").count() >= 1, "");

  // Back from folder → Football work panel
  await page.locator("#pback").click();
  await page.waitForFunction(() => {
    const body = document.getElementById("pbody");
    return body && /Football/i.test(body.innerText) && body.querySelector("[data-work-door]");
  });
  check("Back from folder returns to Football work panel", true, "");

  // --- ETA labeled doors + websites ---
  await page.locator("#px").click();
  await page.waitForFunction(() => !document.getElementById("panel").classList.contains("on"));
  await clickDeepHex(page, "ETA");
  await page.waitForSelector("#panel.on");
  await page.waitForSelector("#pbody [data-work-door]");
  const etaDoors = await page.locator("#pbody [data-work-door]").evaluateAll((els) => els.map((e) => (e.textContent || "").trim()));
  check("ETA has Study guide door", etaDoors.some((t) => /Study guide/i.test(t)), etaDoors.join(", "));
  check("ETA has Assignments door", etaDoors.some((t) => /Assignments/i.test(t)), etaDoors.join(", "));
  check("ETA websites etaConnect", await page.locator('#pbody a[href*="etaconnect"]').count() >= 1, "");

  await browser.close();
  console.log("");
  if (failures) {
    console.log(failures + " Playwright check(s) FAILED");
    process.exit(1);
  }
  console.log("All Playwright hive UX checks PASSED");
};

run().catch((err) => {
  console.log("FATAL  " + (err && err.message ? err.message : err));
  process.exit(1);
});
