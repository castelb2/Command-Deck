// Headless check of the Weekend / Black Swan / NASA dashboards at iPhone sizes.
// Usage: node tools/test_tiers.mjs <chromium-path> <out-dir>
// Needs playwright-core. Uses tools/fixtures/sample-backup.json (invented projects only).
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [exe, outDir] = process.argv.slice(2);
const root = process.env.DECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(root, "tools/fixtures/sample-backup.json");
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail: String(detail) }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  · " + detail : "")); };
const stored = (page, id) => page.evaluate(i => JSON.parse(localStorage.getItem("deck.db.projects") || "{}")[i], id);
const BS = "thruster-stand-c3d4", WK = "recovery-beacon-e5f6";

for (const [w, h] of [[390, 844], [430, 932]]) {
  const tag = `${w}x${h}`;
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu"] });
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.click("#open-settings");
  await page.setInputFiles("#d-import", fixture);
  await page.waitForTimeout(200);
  await page.click("#settings-drawer [data-close]");
  await page.waitForTimeout(150);

  // R13, R14 · the board
  const filters = await page.$$eval("#filters .filter", n => n.map(x => x.textContent));
  check(`${tag} R13 tier filters on the board`, filters.some(t => /Weekend\s*1/.test(t)) && filters.some(t => /Black Swan\s*1/.test(t)), filters.join(" | "));
  const gatesOnCards = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".card[data-tier]")].map(c => [c.dataset.tier, c.querySelectorAll(".mt-gate").length])));
  check(`${tag} R14 card gate tracks: Weekend 2, Black Swan 5`, gatesOnCards.weekend === 2 && gatesOnCards.blackswan === 5, JSON.stringify(gatesOnCards));
  check(`${tag} R13 plain projects keep their plain card`, await page.$$eval(".card:not([data-tier]) .card-se", n => n.length) === 0 && await page.$$eval(".card:not([data-tier])", n => n.length) === 1);
  await page.click('#filters .filter:has-text("Black Swan")');
  check(`${tag} R13 the tier filter shows only that tier`, (await page.$$eval(".card", n => n.map(c => c.dataset.tier))).join() === "blackswan");
  await page.click('#filters .filter:has-text("All")');

  // Black Swan dashboard
  await page.click(`.card[data-tier=blackswan] .card-title`);
  await page.waitForTimeout(200);
  check(`${tag} tapping a tiered card opens its dashboard`, await page.isVisible("#mission-drawer") && (await page.textContent("#m-title")) === "Cold-gas thruster test stand");
  const bsGates = await page.$$eval(".m-track .m-gate", n => n.map(x => x.textContent));
  const bsTabs = await page.$$eval(".m-tabs .filter", n => n.length);
  check(`${tag} R14 Black Swan: gates G0–G4 and 7 artifact tabs`, bsGates.join() === "G0,G1,G2,G3,G4" && bsTabs === 7, bsGates.join() + " / " + bsTabs);
  const tiles = await page.$$eval(".m-metrics .tele", n => n.map(t => t.querySelector(".tele-label").textContent + "=" + t.querySelector(".tele-value").textContent));
  check(`${tag} R17 metrics: requirements, verified, red risks, margin, cycle time, add-back`,
    tiles.join("|") === "Requirements=5|Verified=40%|Red risks=1|Margin=13.3%|Cycle time=4d|Add-back=33%", tiles.join("|"));
  const alertText = await page.textContent(".m-alerts");
  check(`${tag} R16 alerts come from the evidence`, /no owner/.test(alertText) && /habit/.test(alertText) && /red risk/.test(alertText) && /Cost margin/.test(alertText), alertText.slice(0, 160));
  const p2items = await page.$$eval(".m-cl .check-item", n => n.length);
  const muskTags = await page.$$eval(".m-cl .check-tag.musk", n => n.map(x => x.textContent));
  check(`${tag} R15 phase 2 checklist with its Musk steps (delete, then simplify)`, p2items === 5 && muskTags.length === 2 && /step 2/.test(muskTags[0]) && /step 3/.test(muskTags[1]), p2items + " items; " + muskTags.join(", "));
  check(`${tag} R15 Musk strip lights steps 2 and 3 in phase 2`, (await page.$$eval(".m-musk .mk.on .d", n => n.map(x => x.textContent))).join() === "2,3");
  await page.screenshot({ path: path.join(outDir, `${tag}-blackswan-top.png`) });

  // Layout inside the dashboard
  const lay = await page.evaluate(() => {
    const d = document.querySelector("#mission-drawer");
    return {
      over: d.scrollWidth - d.clientWidth, sw: document.documentElement.scrollWidth, iw: innerWidth,
      inputs: [...d.querySelectorAll("input[type=text],input[type=number],input[type=date],textarea,select")].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)),
      small: [...d.querySelectorAll("button,.btn")].filter(e => e.offsetParent && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 36 && !e.classList.contains("check-box")).map(e => (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20) + ":" + Math.round(e.getBoundingClientRect().height))
    };
  });
  check(`${tag} R5 dashboard: no sideways scroll`, lay.over <= 0 && lay.sw <= lay.iw, `drawer ${lay.over}, page ${lay.sw}/${lay.iw}`);
  check(`${tag} R6 dashboard: inputs ≥16px, buttons ≥36px`, lay.inputs.every(s => s >= 16) && !lay.small.length, lay.small.slice(0, 6).join(" | "));

  // R21 · ticking a checklist item moves computed progress
  const before = await page.$eval(".m-sumtop .readout", n => n.textContent);
  await page.click('[data-fk="ci:P2.budgets"]');
  await page.waitForTimeout(100);
  const after = await page.$eval(".m-sumtop .readout", n => n.textContent);
  const doneNow = (await stored(page, BS)).se.done.includes("P2.budgets");
  check(`${tag} R21 a checklist tick updates computed progress and saves`, before !== after && doneNow, before + " → " + after);
  check(`${tag} R21 the card's progress follows`, (await page.textContent(`.card[data-tier=blackswan] .progress .readout`)) === after.replace(" complete", ""));

  // R16 · gate review with a waiver
  await page.click('[data-fk="act:gate"]');
  await page.waitForTimeout(200);
  check(`${tag} R16 gate review shows computed readiness`, /2 of 5 checks met|3 of 5 checks met/.test(await page.textContent("#m-gatepanel")), (await page.textContent("#m-gatepanel .m-label")));
  await page.click('[data-fk="g:save"]');
  await page.waitForTimeout(100);
  check(`${tag} R16 Go with unmet checks is refused without a waiver`, /waiver/i.test(await page.textContent("#m-gatepanel .save-msg")) && (await stored(page, BS)).se.phase === 2);
  await page.fill("#g-note", "Advisor accepts cost margin; mitigation tracked");
  await page.click('[data-fk="g:save"]');
  await page.waitForTimeout(200);
  const g2 = (await stored(page, BS)).se;
  check(`${tag} R16 with a waiver: G2 passes, phase 3 starts, waiver flagged`, g2.gates.G2.status === "pass" && g2.gates.G2.waived && g2.phase === 3 && /passed on a waiver/.test(await page.textContent(".m-alerts")));
  await page.screenshot({ path: path.join(outDir, `${tag}-blackswan-after-gate.png`) });

  // Musk step 2 · deleting a requirement logs it
  await page.click('[data-fk="tab:reqs"]');
  await page.click('[data-fk="row:requirements:4"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(outDir, `${tag}-requirement-form.png`) });
  await page.click('[data-fk="f:del"]');
  await page.click('[data-fk="f:delyes"]');
  check(`${tag} Musk 2: a deletion needs a reason`, /Say why/.test(await page.textContent("#m-form")));
  await page.fill("#mf-delreason", "Anodizing is habit, not a need");
  await page.click('[data-fk="f:delyes"]');
  await page.waitForTimeout(150);
  const afterDel = (await stored(page, BS)).se;
  check(`${tag} Musk 2: deleted requirement lands in the deletion log`, afterDel.requirements.length === 4 && afterDel.deletions.some(d => d.kind === "requirement" && /R-005/.test(d.item) && /habit/.test(d.reason)));

  // Adding a requirement through the form
  await page.click('[data-fk="add:requirements"]');
  await page.fill("#mf-text", "The stand shall survive 100 firings");
  await page.fill("#mf-owner", "Alex");
  await page.selectOption("#mf-method", "T");
  await page.click('[data-fk="f:save"]');
  await page.waitForTimeout(150);
  const newReq = (await stored(page, BS)).se.requirements.find(r => /100 firings/.test(r.text));
  check(`${tag} new requirement gets the next ID`, newReq && newReq.id === "R-006" && newReq.owner === "Alex" && newReq.method === "T", newReq && newReq.id);

  // Risks tab
  await page.click('[data-fk="tab:risks"]');
  check(`${tag} R17 5×5 risk grid shows the open risks`, (await page.$$eval(".m-heat .hc.has", n => n.map(x => x.className.split(" ")[1] + x.textContent))).sort().join() === "amber1,red1");
  await page.evaluate(() => document.querySelector("#m-tabs").scrollIntoView());
  await page.screenshot({ path: path.join(outDir, `${tag}-risks.png`) });

  // R20 · copy card
  await page.click('[data-fk="act:copy"]');
  await page.waitForTimeout(150);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  let card = null; try { card = JSON.parse(clip); } catch (e) {}
  check(`${tag} R20 Copy card puts a status card on the clipboard`, card && card.deck === "status-card" && card.id === BS && card.tier === "blackswan" && card.phase === 3, clip.slice(0, 60));
  await page.click('[data-fk="m:close"]');

  // Weekend dashboard
  await page.click(`.card[data-tier=weekend] .card-title`);
  await page.waitForTimeout(150);
  const wkGates = await page.$$eval(".m-track .m-gate", n => n.map(x => x.textContent));
  const wkTabs = await page.$$eval(".m-tabs .filter", n => n.map(x => x.firstChild.textContent));
  const wkTiles = await page.$$eval(".m-metrics .tele-label", n => n.map(x => x.textContent));
  check(`${tag} R14 Weekend: G1 and G4 only, no risk or design tabs, 4 metrics`, wkGates.join() === "G1,G4" && wkTabs.join() === "Checklist,Requirements,Tests,Deletions,Lessons" && wkTiles.length === 4, wkGates.join() + " / " + wkTabs.join(","));
  check(`${tag} R14 Weekend phase 0 advances without a gate`, (await page.textContent('[data-fk="act:adv"]')) === "Advance to phase 1");
  await page.click('[data-fk="act:adv"]');
  check(`${tag} advancing with open items asks first`, /^Sure\?/.test(await page.textContent('[data-fk="act:adv"]')) && (await stored(page, WK)).se.phase === 0);
  await page.screenshot({ path: path.join(outDir, `${tag}-weekend.png`) });
  await page.click('[data-fk="m:close"]');

  // NASA: create through the editor
  await page.click("#add-btn");
  await page.fill("#f-name", "Flight avionics box");
  await page.selectOption("#f-tier", "nasa");
  check(`${tag} R13 editor hides typed progress for tiered projects`, !(await page.isVisible("#f-progress")) && /SEMP/.test(await page.textContent("#f-tier-hint")));
  await page.click("#f-save");
  await page.waitForTimeout(600);
  check(`${tag} R13 a new NASA project opens its dashboard`, await page.isVisible("#mission-drawer") && /NASA/.test(await page.textContent("#m-eyebrow")));
  await page.click('[data-fk="gate:G0"]');
  await page.fill("#g-note", "Proceeding");
  await page.click('[data-fk="g:save"]');
  await page.waitForTimeout(100);
  check(`${tag} R16 NASA gates need named reviewers`, /reviewers/i.test(await page.textContent("#m-gatepanel .save-msg")));
  await page.click('[data-fk="m:close"]');

  // R18, R19 · import cards
  const raw = await page.evaluate(() => localStorage.getItem("deck.db.projects"));
  const paste = "Sure, here are your cards.\n```json\n" + JSON.stringify([
    { deck: "status-card", v: 1, name: "rocket recovery beacon", phase: 1, criteria: ["Beacon heard at 1 km"], checklistDone: ["P0.mission", "P0.criteria-w"] },
    { deck: "status-card", v: 1, name: "<img src=x onerror=window.__pwned=1> Payload", tier: "Black Swan", phase: 7, evil: "drop me",
      risks: [{ title: "Too hot", likelihood: 99, consequence: 3 }] }
  ]) + "\n```\nPaste them into the deck.";
  await page.click("#card-btn");
  await page.fill("#c-text", paste);
  await page.click('#card-drawer button[type=submit]');
  await page.waitForTimeout(150);
  const prevText = await page.textContent("#c-preview");
  check(`${tag} R18 preview shows an update and a new project`, /Updates\s*Rocket recovery beacon/.test(prevText) && /New project/.test(prevText) && /Phase: 0 → 1/.test(prevText), prevText.slice(0, 120));
  check(`${tag} R18 nothing changes before Apply`, (await page.evaluate(() => localStorage.getItem("deck.db.projects"))) === raw);
  await page.screenshot({ path: path.join(outDir, `${tag}-import-preview.png`) });
  await page.click('[data-fk="c:apply"]');
  await page.waitForTimeout(700);
  const all = await page.evaluate(() => JSON.parse(localStorage.getItem("deck.db.projects")));
  const wk = all[WK], neu = Object.values(all).find(p => /Payload/.test(p.name));
  check(`${tag} R18 Apply updates the matched project by name`, wk.se.phase === 1 && wk.se.criteria.length === 1 && wk.next === "Order the GPS module" && wk.tier === "weekend");
  check(`${tag} R19 card cleaned: tier normalized, phase and likelihood clamped, unknown field dropped`, neu && neu.tier === "blackswan" && neu.se.phase === 5 && neu.se.risks[0].likelihood === 5 && !("evil" in neu));
  check(`${tag} R19 card text is shown as text, never as HTML`, await page.evaluate(() => !window.__pwned && !document.querySelector("img[src=x]")) && await page.isVisible("#mission-drawer"));
  await page.click('[data-fk="m:close"]');

  // R22 · briefings and offline answers
  await page.fill("#ask-input", "What phase is the thruster test stand in?");
  await page.click("#ask-send");
  await page.waitForTimeout(200);
  const ans = await page.$$eval(".turn.ai .txt", n => n.map(x => x.textContent).pop() || "");
  check(`${tag} R22 offline answer gives phase and next gate`, /phase 3/.test(ans) && /Next gate: Critical Design/.test(ans), ans.slice(0, 160));
  await page.fill("#ask-input", "Which gates are next?");
  await page.click("#ask-send");
  await page.waitForTimeout(200);
  const ans2 = await page.$$eval(".turn.ai .txt", n => n.map(x => x.textContent).pop() || "");
  check(`${tag} R22 offline "gates" question lists tiered projects`, /Black Swan project/.test(ans2) && /Weekend project/.test(ans2), ans2.slice(0, 160));
  await page.click("#brief-btn");
  await page.waitForTimeout(150);
  const brief = await page.$$eval(".turn.ai .txt", n => n.map(x => x.textContent).pop() || "");
  check(`${tag} R22 the briefing reports tiered projects`, /Cold-gas thruster test stand is a Black Swan project in phase 3/.test(brief));

  // R22 · the Claude link gets the lean_se block (mocked API)
  let sent = null;
  await page.route("https://api.anthropic.com/v1/messages", async route => {
    sent = JSON.parse(route.request().postData() || "{}");
    const sse = [
      { type: "message_start", message: { id: "m", role: "assistant", content: [] } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "It is in phase three." } },
      { type: "content_block_stop", index: 0 }, { type: "message_delta", delta: { stop_reason: "end_turn" } }, { type: "message_stop" }
    ].map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse });
  });
  await page.click("#open-settings");
  await page.fill("#s-key", "sk-ant-test-0000000000000000000000000000");
  await page.click("#s-key-save");
  await page.click("#settings-drawer [data-close]");
  await page.fill("#ask-input", "Where is the thruster stand?");
  await page.click("#ask-send");
  await page.waitForFunction(() => [...document.querySelectorAll(".turn.ai .txt")].some(n => n.textContent.includes("phase three")), null, { timeout: 5000 }).catch(() => {});
  const content = sent && sent.messages ? JSON.stringify(sent.messages[sent.messages.length - 1].content) : "";
  check(`${tag} R22 Claude link sends phase, next gate and alerts`, /lean_se/.test(content) && /Preliminary Design|Detailed Design/.test(content) && /next_gate/.test(content) && /Lean Systems Engineering/.test(sent.system || ""));

  // R23 · backups carry tier data
  const bk = await page.evaluate(() => DeckDB.exportAll());
  check(`${tag} R23 backups include tier and SE data, not the key`, bk.collections.projects[BS].tier === "blackswan" && bk.collections.projects[BS].se.gates.G2.status === "pass" && !JSON.stringify(bk).includes("sk-ant-"));

  // Full-page shots switch off touch emulation in this Chrome build, so this one goes last.
  await page.screenshot({ path: path.join(outDir, `${tag}-board.png`), fullPage: true });
  check(`${tag} no script errors`, errors.length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
  await browser.close();
}
server.close();
fs.writeFileSync(path.join(outDir, "results-tiers.json"), JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} tier checks passed`);
process.exit(failed ? 1 : 0);
