// Headless check of the deck at iPhone sizes.
// Usage: node tools/test_iphone.mjs <chromium-path> <backup.json> <out-dir>
// Needs playwright-core. Serves this folder on localhost, then for each phone size:
// loads the app, imports a backup, checks layout, offline answers, the API link
// (against a mocked api.anthropic.com), the service worker and an offline relaunch.
import { chromium } from "playwright-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [exe, backup, outDir] = process.argv.slice(2);
const root = process.env.DECK_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const check = (name, ok, detail = "") => { results.push({ name, ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  · " + detail : "")); };

const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
function mockReplies() {
  let n = 0; const seen = [];
  const handler = async route => {
    const req = route.request(); const body = JSON.parse(req.postData() || "{}");
    seen.push({ headers: req.headers(), body });
    n++;
    if (n === 1) {
      return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse([
        { type: "message_start", message: { id: "m1", role: "assistant", content: [] } },
        { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig123" } },
        { type: "content_block_stop", index: 0 },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu1", name: "update_project", input: {} } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"id\":\"mu-flow-" } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "payload\",\"status\":\"watch\"}" } },
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "tool_use" } },
        { type: "message_stop" }
      ]) });
    }
    return route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" }, body: sse([
      { type: "message_start", message: { id: "m2", role: "assistant", content: [] } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Done. The payload is on watch now." } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn" } },
      { type: "message_stop" }
    ]) });
  };
  return { handler, seen };
}

for (const [w, h] of [[390, 844], [430, 932]]) {
  // A fresh browser per phone size (the small serverless Chromium build runs single-process).
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"] });
  const tag = `${w}x${h}`;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text())) errors.push("console: " + m.text()); });
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(600);

  check(`${tag} empty board offers import`, (await page.textContent("#grid")).includes("import a backup"));

  // Import the backup through Settings
  await page.click("#open-settings");
  await page.setInputFiles("#d-import", backup);
  await page.waitForTimeout(300);
  check(`${tag} import message`, /Imported 10 projects/.test(await page.textContent("#d-msg")), await page.textContent("#d-msg"));
  const keyType = await page.getAttribute("#s-key", "type");
  check(`${tag} key field is masked`, keyType === "password");
  await page.screenshot({ path: path.join(outDir, `${tag}-settings.png`) });
  await page.click("#settings-drawer [data-close]");
  await page.waitForTimeout(200);
  const cards = await page.$$eval(".card", n => n.length);
  check(`${tag} 10 project cards`, cards === 10, String(cards));

  // Layout: no sideways page scroll, inputs at 16px, tap targets
  const lay = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, iw: innerWidth,
    inputs: [...document.querySelectorAll("input[type=text],textarea,select")].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)),
    small: [...document.querySelectorAll("button,.btn")].filter(e => e.offsetParent && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 36 && !e.classList.contains("check-box")).map(e => (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 20) + ":" + Math.round(e.getBoundingClientRect().height))
  }));
  check(`${tag} no horizontal page scroll`, lay.sw <= lay.iw, `${lay.sw} vs ${lay.iw}`);
  check(`${tag} inputs ≥16px (no iOS zoom)`, lay.inputs.every(s => s >= 16), lay.inputs.join(","));
  check(`${tag} buttons ≥36px tall`, lay.small.length === 0, lay.small.slice(0, 8).join(" | "));
  await page.screenshot({ path: path.join(outDir, `${tag}-top.png`) });
  await page.screenshot({ path: path.join(outDir, `${tag}-full.png`), fullPage: true });

  // Offline answers
  await page.fill("#ask-input", "How many weeks until race day, and what should I focus on?");
  await page.click("#ask-send");
  await page.waitForTimeout(300);
  const ans = await page.$$eval(".turn.ai .txt", n => n.map(x => x.textContent).pop() || "");
  check(`${tag} offline answer about the race`, /Ironman 70\.3/.test(ans) && /week/.test(ans), ans.slice(0, 140));
  await page.fill("#ask-input", "What needs my attention this week?");
  await page.click("#ask-send");
  await page.waitForTimeout(300);
  const ans2 = await page.$$eval(".turn.ai .txt", n => n.map(x => x.textContent).pop() || "");
  check(`${tag} offline attention summary`, ans2.length > 20 && !/only answer from the board/.test(ans2), ans2.slice(0, 140));
  await page.fill("#ask-input", "Add stretch 10 minutes to my daily routine");
  await page.click("#ask-send");
  await page.waitForTimeout(300);
  check(`${tag} offline add to routine`, (await page.textContent("#check-daily-list")).includes("stretch 10 minutes"));

  // API link against a mocked api.anthropic.com
  const mock = mockReplies();
  await page.route("https://api.anthropic.com/v1/messages", mock.handler);
  await page.click("#open-settings");
  await page.fill("#s-key", "sk-ant-test-0000000000000000000000000000");
  await page.click("#s-key-save");
  check(`${tag} key saved and masked`, /Key saved · sk-ant-…0000/.test(await page.textContent("#s-key-state")), await page.textContent("#s-key-state"));
  await page.click("#settings-drawer [data-close]");
  await page.fill("#ask-input", "Mark the payload as on watch");
  await page.click("#ask-send");
  await page.waitForFunction(() => [...document.querySelectorAll(".turn.ai .txt")].some(n => n.textContent.includes("on watch now")), null, { timeout: 5000 }).catch(() => {});
  const status = await page.evaluate(() => JSON.parse(localStorage.getItem("deck.db.projects"))["mu-flow-payload"].status);
  check(`${tag} API tool call changed the board`, status === "watch", status);
  const h0 = mock.seen[0] && mock.seen[0].headers || {};
  check(`${tag} API headers`, h0["x-api-key"] && h0["anthropic-dangerous-direct-browser-access"] === "true" && h0["anthropic-version"], Object.keys(h0).filter(k => k.startsWith("anthropic") || k === "x-api-key").join(","));
  const b0 = mock.seen[0] && mock.seen[0].body || {};
  check(`${tag} API body`, b0.model === "claude-opus-5-5" && b0.stream === true && b0.fallbacks === "default" && typeof b0.system === "string" && b0.tools && b0.tools.length === 2, `model=${b0.model}`);
  const b1 = mock.seen[1] && mock.seen[1].body || {};
  const echoed = b1.messages && b1.messages[b1.messages.length - 2];
  check(`${tag} thinking + tool_use echoed back`, echoed && echoed.content[0].type === "thinking" && echoed.content[0].signature === "sig123" && echoed.content[1].input.status === "watch" && !("_json" in echoed.content[1]));
  const bk = await page.evaluate(() => JSON.stringify(DeckDB.exportAll()));
  check(`${tag} backup leaves the key out`, !bk.includes("sk-ant-"));

  // Service worker + offline relaunch
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 8000 }).catch(() => {});
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload({ waitUntil: "load" }); await page.waitForTimeout(800); }
  check(`${tag} service worker controls the page`, await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)));
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "load" }).catch(e => errors.push("offline reload: " + e.message));
  await page.waitForTimeout(500);
  const offCards = await page.$$eval(".card", n => n.length).catch(() => 0);
  check(`${tag} opens offline with data`, offCards === 10, String(offCards));
  await ctx.setOffline(false);

  const manifest = await page.evaluate(async () => (await fetch("manifest.webmanifest")).json());
  check(`${tag} manifest standalone`, manifest.display === "standalone" && manifest.short_name === "Command Deck");

  check(`${tag} no script errors`, errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, errors.join(" | ").slice(0, 300));
  await ctx.close();
  await browser.close();
}
server.close();
fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
