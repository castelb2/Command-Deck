// Unit checks for js/se-model.js (no browser needed).
// Usage: node tools/test_se_model.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = createRequire(import.meta.url)(path.join(root, "js/se-model.js"));
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  · " + detail : "")); };
const proj = (tier, se, extra) => Object.assign({ id: "p", name: "P", tier, mission: "M", status: "active", flags: [] }, extra || {}, { se: S.cleanSE(se) });

// R14 · tailoring table
check("R14 Weekend gates are G1 and G4", S.gatesFor("weekend").join() === "G1,G4");
check("R14 Black Swan and NASA gates are G0–G4", S.gatesFor("blackswan").join() === "G0,G1,G2,G3,G4" && S.gatesFor("nasa").join() === "G0,G1,G2,G3,G4");
check("R14 NASA gates need reviewers, the others don't", S.TIERS.nasa.reviewers === true && !S.TIERS.blackswan.reviewers && !S.TIERS.weekend.reviewers);
check("R14 Weekend has no risk or design tabs", !S.TIERS.weekend.tabs.includes("risks") && !S.TIERS.weekend.tabs.includes("design") && S.TIERS.blackswan.tabs.includes("risks"));

// R15 · checklists
const ids = S.CHECKLIST.map(c => c.id);
check("R15 checklist IDs are unique", new Set(ids).size === ids.length, ids.length + " items");
check("R15 every tier has items in every phase", S.TIER_ORDER.every(t => S.PHASES.every(ph => S.itemsFor(t, ph.n).length > 0)));
const muskPhase = { 1: [0, 1], 2: [1, 2], 3: [2, 3], 4: [3], 5: [4] };
check("R15 Musk steps sit in the phases the framework puts them in", S.CHECKLIST.filter(c => c.musk).every(c => muskPhase[c.musk].includes(c.p)));
check("R15 each phase's Musk steps match the framework", S.PHASES.map(p => p.musk.join("")).join("|") === "1|12|23|34|5|");
for (const [file, label] of [["docs/status-card.md", "interface doc"], ["skills/deck-status-card/SKILL.md", "skill"]]) {
  const txt = fs.readFileSync(path.join(root, file), "utf8");
  const found = new Set((txt.match(/`P\d\.[a-z-]+`/g) || []).map(s => s.slice(1, -1)));
  const missing = ids.filter(i => !found.has(i)), extra = [...found].filter(i => !ids.includes(i));
  check(`R15 ${label} lists exactly the model's checklist IDs`, !missing.length && !extra.length, missing.concat(extra).join(","));
}

// R16 · gates decided with evidence
const w0 = proj("weekend", { phase: 1 });
const g1w = S.gateChecks(w0, "G1").map(c => c.label);
check("R16 Weekend G1 also checks mission and phase 0 (no G0 before it)", g1w.includes("Mission statement written") && g1w.some(l => l.startsWith("Phase 0 checklist")) && g1w.some(l => l.startsWith("Phase 1 checklist")));
check("R16 Weekend G1 doesn't ask for a risk register", !g1w.includes("Risk register v1 started"));
const g4w = S.gateChecks(w0, "G4").map(c => c.label);
check("R16 Weekend G4 covers phases 2, 3 and 4", ["Phase 2", "Phase 3", "Phase 4"].every(x => g4w.some(l => l.startsWith(x))));
const b1 = proj("blackswan", { phase: 1, criteria: ["a", "b", "c"] });
check("R16 passing with unmet checks needs a waiver note", S.gateProblems(b1, "G1", { status: "pass", note: "" }).length === 1 && S.gateProblems(b1, "G1", { status: "pass", note: "Advisor accepted the risk" }).length === 0);
const dec = S.decideGate(b1, "G1", { status: "go", note: "Accepted", date: "2026-11-19" });
check("R16 a go moves the project past the gate and records the waiver", dec.se.phase === 2 && dec.se.gates.G1.status === "pass" && dec.se.gates.G1.waived === true && dec.se.gates.G1.reqCount === 0);
check("R16 NASA gates refuse a decision without reviewers", S.gateProblems(proj("nasa", { phase: 0 }), "G0", { status: "pass", note: "x" }).some(m => /reviewers/.test(m)));
check("R16 a gate ahead of the current phase can't be decided", S.gateProblems(b1, "G3", { status: "pass", note: "x" }).some(m => /opens when/.test(m)));
check("R16 advance asks for the gate first", S.advance(b1).action === "gate" && S.advance(b1).gate === "G1" && S.advance(proj("weekend", { phase: 0 })).action === "advance");

// R17 · metrics
const m = S.metrics(proj("blackswan", {
  requirements: [{ text: "a", result: "pass" }, { text: "b", result: "fail" }, { text: "c" }, { text: "d", result: "pass" }],
  risks: [{ title: "x", likelihood: 5, consequence: 3 }, { title: "y", likelihood: 2, consequence: 2 }, { title: "z", likelihood: 5, consequence: 5, status: "closed" }],
  budgets: [{ name: "Mass", limit: 10, current: 9 }, { name: "Cost", limit: 100, current: 50, target: 30 }],
  tests: [{ what: "1", cycleDays: 10 }, { what: "2", cycleDays: 2 }, { what: "3", cycleDays: 4 }, { what: "4" }],
  deletions: ["a", "b", "c", "d", { item: "e", addedBack: true }]
}));
check("R17 % verified", m.verifiedPct === 50 && m.failed === 1, m.verifiedPct + "%");
check("R17 red risks count only open ones", m.redRisks === 1 && m.openRisks === 2);
check("R17 tightest margin is the one furthest under target", m.tightest.name === "Mass" && m.tightest.margin === 10);
check("R17 median cycle time", m.cycleMedian === 4 && m.cycleN === 3);
check("R17 deletion add-back", m.addedBack === 1 && m.addBackPct === 20);

// R21 · progress
const pr0 = S.progress(proj("weekend", {})), all = S.itemsFor("weekend").map(c => c.id);
const pr1 = S.progress(proj("weekend", { done: all, gates: { G1: { status: "pass" }, G4: { status: "pass" } } }));
check("R21 progress runs 0 to 100 from checklists and gates", pr0 === 0 && pr1 === 100);

// Alerts
const al = S.alerts(proj("blackswan", { phase: 3, requirements: [{ text: "x", origin: "habit" }], deletions: ["a", "b", "c", "d", "e"], gates: { G0: { status: "pass" } } }));
check("Alerts: skipped gates, missing owner and method, habit, no add-back", ["G1 SRR not passed", "no owner", "no verification method", "from habit", "Nothing added back"].every(k => al.some(a => a.includes(k))), al.length + " alerts");

// R18, R19 · cards in
const prose = "Here's the card:\n```json\n" + JSON.stringify({ deck: "status-card", name: "A" }) + "\n```\nCopy it.";
check("R18 card found inside a code block in prose", S.parseCards(prose).length === 1);
check("R18 card found as bare JSON, an array, and {cards}", S.parseCards('{"name":"A"}').length === 1 && S.parseCards('[{"name":"A"},{"name":"B"}]').length === 2 && S.parseCards('{"cards":[{"name":"A"}]}').length === 1);
check("R18 text without a card gives nothing", S.parseCards("hello { not json }").length === 0 && S.parseCards('{"foo":1}').length === 0);
const evil = S.cleanCard({
  name: "<img src=x onerror=alert(1)>\u0007 Rocket", tier: "Black Swan", phase: 9, status: "exploded", due: "2026-02-31", evil: "x",
  requirements: Array.from({ length: 400 }, (_, i) => ({ text: "R" + i, method: "Test", interrogated: true })),
  risks: [{ title: "r", likelihood: 99, consequence: -4 }], gates: { G1: { status: "go" }, G9: { status: "pass" } }, checklistDone: ["P0.mission", "P9.fake"]
});
check("R19 tier names are normalized", evil.tier === "blackswan");
check("R19 numbers are clamped, enums defaulted, bad dates dropped", evil.se.phase === 5 && evil.status === "active" && evil.due === null && evil.se.risks[0].likelihood === 5 && evil.se.risks[0].consequence === 1);
check("R19 lists are capped and unknown IDs and gates dropped", evil.se.requirements.length === 300 && evil.se.done.join() === "P0.mission" && !("G9" in evil.se.gates) && evil.se.gates.G1.status === "pass");
check("R19 control characters stripped; text is kept as text", !/\u0007/.test(evil.name) && evil.name.startsWith("<img"));
const doc = S.applyCard(null, evil);
check("R19 unknown fields never reach storage", !("evil" in doc) && !JSON.stringify(doc).includes('"evil"'));
check("R19 method words and 'interrogated: true' are understood", doc.se.requirements[0].method === "T" && doc.se.requirements[0].interrogation.every(Boolean));

// Partial updates and round trip (R18, R20)
const stored = { name: "Stand", status: "active", flags: ["mine"], notes: "keep me", tier: "blackswan", se: S.cleanSE({ phase: 2, requirements: [{ text: "a" }], risks: [{ title: "r" }] }) };
const upd = S.applyCard(stored, S.cleanCard({ name: "Stand", phase: 3, tests: [{ what: "t" }] }));
check("R18 a card changes only the fields it carries", upd.se.phase === 3 && upd.se.tests.length === 1 && upd.se.requirements.length === 1 && upd.se.risks.length === 1 && upd.notes === "keep me" && upd.flags[0] === "mine");
const full = proj("nasa", { phase: 2, criteria: ["a", "b", "c"], done: ["P0.mission"], gates: { G0: { status: "pass", reviewers: "X" } }, requirements: [{ text: "q", owner: "A", parent: "SC2", method: "A" }], budgets: [{ name: "Mass", limit: 2, current: 1 }], parts: 12 });
const back = S.applyCard(null, S.cleanCard(JSON.parse(JSON.stringify(S.toCard(full)))));
check("R20 Copy card → Import card round trip loses nothing", JSON.stringify(back.se) === JSON.stringify(full.se) && back.tier === "nasa");
check("R20 match by id first, then by name ignoring case", S.matchCard([{ id: "a", name: "X" }, { id: "b", name: "Stand" }], { id: "a", name: "Stand" }).id === "a" && S.matchCard([{ id: "b", name: "Stand" }], { id: "", name: "stand" }).id === "b");
check("IDs are never reused after a deletion", S.nextId([{ id: "R-001" }], "R-", 3, ["R-005: anodized frame", "Weekly meeting"]) === "R-006" && S.nextId([], "RK-", 2) === "RK-01");
check("Criterion IDs stay put when one is removed", S.cleanSE({ criteria: [{ id: "SC1", text: "a" }, { id: "SC3", text: "c" }, { text: "new" }] }).criteria.map(c => c.id).join() === "SC1,SC3,SC4");

// The example in the interface doc imports cleanly
const ex = fs.readFileSync(path.join(root, "docs/status-card.md"), "utf8").split("## Example")[1];
const exCard = S.parseCards(ex).map(S.cleanCard)[0];
check("Interface doc example imports", exCard && exCard.tier === "blackswan" && exCard.se.requirements[0].interrogation.every(Boolean) && exCard.se.gates.G1.status === "pass");

const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} model checks passed`);
process.exit(failed ? 1 : 0);
