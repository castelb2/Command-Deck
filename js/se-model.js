/* Command Deck · Lean Systems Engineering model
   Tiers, phases, gates and checklists from "The Lean Systems Engineering Framework":
   NASA's lifecycle as the backbone, with Musk's five steps run inside every phase.
   Pure data and functions with no DOM. js/se-ui.js draws it; tools/test_se_model.mjs
   checks it in Node. The same cleaner reads stored projects and pasted status cards,
   so there is one definition of valid data. */
(function (root) {
  "use strict";

  /* ---------- the framework, as data ---------- */
  const TIERS = {
    weekend: {
      id: "weekend", label: "Weekend", scale: "Small", tag: "WKND", fits: "Class project or weekend build",
      gates: ["G1", "G4"], review: "Self-check against the evidence",
      docs: "One-page requirements and a test log",
      tabs: ["checklist", "reqs", "tests", "dels", "lessons"]
    },
    blackswan: {
      id: "blackswan", label: "Black Swan", scale: "Medium", tag: "BSWN", fits: "Thesis or student payload",
      gates: ["G0", "G1", "G2", "G3", "G4"], review: "Lightweight review: one hour, a few slides",
      docs: "Requirements, risk and verification matrices, and an ICD",
      tabs: ["checklist", "reqs", "risks", "design", "tests", "dels", "lessons"]
    },
    nasa: {
      id: "nasa", label: "NASA", scale: "Large", tag: "NASA", fits: "Funded, flight or safety-critical",
      gates: ["G0", "G1", "G2", "G3", "G4"], review: "Full review with external reviewers", reviewers: true,
      docs: "Full NASA-style set: SEMP, ICDs, hazard analysis",
      tabs: ["checklist", "reqs", "risks", "design", "tests", "dels", "lessons"]
    }
  };
  const TIER_ORDER = ["weekend", "blackswan", "nasa"];
  const TIER_CODE = { weekend: "w", blackswan: "b", nasa: "n" };

  const PHASES = [
    { n: 0, name: "Mission Definition", nasa: "Pre-Phase A", q: "WHY", goal: "Know why the project exists.", musk: [1] },
    { n: 1, name: "Requirements & Architecture", nasa: "Phase A", q: "WHAT", goal: "Define the minimum set of requirements and a candidate architecture.", musk: [1, 2] },
    { n: 2, name: "Preliminary Design", nasa: "Phase B", q: "HOW", goal: "Prove the chosen architecture closes.", musk: [2, 3] },
    { n: 3, name: "Detailed Design & Build", nasa: "Phases C–D", q: "BUILD", goal: "Build it fast with tight feedback loops.", musk: [3, 4] },
    { n: 4, name: "Verification & Validation", nasa: "V&V", q: "PROVE", goal: "Prove it meets the requirements and the mission need.", musk: [5] },
    { n: 5, name: "Operations & Closeout", nasa: "Phases E–F", q: "LEARN", goal: "Operate, compare against the success criteria, capture lessons.", musk: [] }
  ];

  const MUSK = ["Make requirements less dumb", "Delete the part or process", "Simplify / optimize", "Accelerate cycle time", "Automate"];
  const RULE_OF_ORDER = "Never optimize what should be deleted, never accelerate what isn't simplified, never automate what isn't fast and stable.";

  const GATES = {
    G0: { id: "G0", after: 0, name: "Mission Concept Review", short: "MCR", question: "Is this worth doing? Go or no-go." },
    G1: { id: "G1", after: 1, name: "System Requirements Review", short: "SRR", question: "Are the requirements complete, minimal, owned and verifiable?" },
    G2: { id: "G2", after: 2, name: "Preliminary Design Review", short: "PDR", question: "Does the chosen architecture close?" },
    G3: { id: "G3", after: 3, name: "Critical Design / Test Readiness Review", short: "CDR/TRR", question: "Ready to commit major money and time, and to test formally?" },
    G4: { id: "G4", after: 4, name: "Operational / Flight Readiness Review", short: "ORR/FRR", question: "Proven against every requirement and ready to operate?" }
  };
  const GATE_STATUS = ["pending", "pass", "nogo"];

  // Phase checklists. tiers: w = Weekend, b = Black Swan, n = NASA. musk: which of the five steps the item runs.
  const CHECKLIST = [
    { id: "P0.mission", p: 0, tiers: "wbn", t: "Write a one-paragraph mission statement" },
    { id: "P0.criteria", p: 0, tiers: "bn", t: "Set 3–5 measurable success criteria" },
    { id: "P0.criteria-w", p: 0, tiers: "w", t: "Set 1–3 measurable success criteria" },
    { id: "P0.stakeholders", p: 0, tiers: "bn", t: "List the stakeholders and their real needs" },
    { id: "P0.conops", p: 0, tiers: "bn", t: "Sketch the ConOps: how it will be used, start to finish" },
    { id: "P0.owners", p: 0, tiers: "wbn", musk: 1, t: "For each need, ask who says so and what happens if it's ignored. Strike needs nobody owns" },
    { id: "P0.worth", p: 0, tiers: "w", t: "Decide it's worth the weekend (go or no-go)" },
    { id: "P0.reviewers", p: 0, tiers: "n", t: "Book external reviewers for the MCR" },

    { id: "P1.list", p: 1, tiers: "w", t: "Write the one-page requirements list, each with an owner and how you'll prove it" },
    { id: "P1.shall", p: 1, tiers: "bn", t: "Write requirements in \"shall\" form with ID, owner, rationale, parent need and verification method" },
    { id: "P1.interrogate", p: 1, tiers: "wbn", musk: 1, t: "Run the interrogation checklist on every requirement" },
    { id: "P1.delete", p: 1, tiers: "wbn", musk: 2, t: "Delete requirements, subsystems and documents that don't trace to a success criterion. Log each one" },
    { id: "P1.alternatives", p: 1, tiers: "bn", t: "Generate 2–3 architecture alternatives" },
    { id: "P1.trade", p: 1, tiers: "bn", t: "Trade them with weighted criteria: mass, cost, risk, schedule, performance" },
    { id: "P1.risks", p: 1, tiers: "bn", t: "Start the risk register (likelihood × consequence, 5×5)" },
    { id: "P1.doors", p: 1, tiers: "bn", t: "Mark one-way-door decisions for analysis and peer review. Decide two-way doors fast" },
    { id: "P1.semp", p: 1, tiers: "n", t: "Write the SEMP: how this project will be engineered and reviewed" },

    { id: "P2.budgets", p: 2, tiers: "bn", t: "Set budgets with 20–30% margin: mass, power, volume, thermal, data, cost" },
    { id: "P2.interfaces", p: 2, tiers: "bn", t: "Define the interfaces with ICDs or a simple N² diagram" },
    { id: "P2.riskfirst", p: 2, tiers: "wbn", t: "Prototype or analyze the highest-risk items first" },
    { id: "P2.parts", p: 2, tiers: "wbn", musk: 2, t: "Parts-count review: for each component, ask what breaks if it's gone" },
    { id: "P2.simplify", p: 2, tiers: "wbn", musk: 3, t: "Simplify: combine functions, use COTS, cut interfaces and part variants" },
    { id: "P2.hazards", p: 2, tiers: "n", t: "Run the preliminary hazard analysis" },

    { id: "P3.git", p: 3, tiers: "wbn", t: "Put CAD, code and docs under version control (Git)" },
    { id: "P3.dfm", p: 3, tiers: "bn", musk: 3, t: "Simplify manufacturing and assembly: fewer fasteners, fewer tools" },
    { id: "P3.loops", p: 3, tiers: "wbn", musk: 4, t: "Run design → build → test loops in days, not months, and log each loop's cycle time" },
    { id: "P3.build", p: 3, tiers: "wbn", t: "Build the hardware or software" },
    { id: "P3.release", p: 3, tiers: "bn", t: "Release the design and write the test procedures" },
    { id: "P3.config", p: 3, tiers: "n", t: "Put released designs under formal configuration control" },

    { id: "P4.tests", p: 4, tiers: "w", t: "Test every requirement on the list and log the results" },
    { id: "P4.matrix", p: 4, tiers: "bn", t: "Fill the verification matrix: every requirement → method → result → pass/fail" },
    { id: "P4.fly", p: 4, tiers: "wbn", t: "Test like you fly, fly like you test" },
    { id: "P4.validate", p: 4, tiers: "bn", t: "Validate against the mission need, not just the requirements" },
    { id: "P4.automate", p: 4, tiers: "wbn", musk: 5, t: "Automate now, and only now: test scripts, data pipelines, CI, automated checklists" },
    { id: "P4.report", p: 4, tiers: "bn", t: "Write the V&V report" },

    { id: "P5.operate", p: 5, tiers: "wbn", t: "Operate and collect data" },
    { id: "P5.compare", p: 5, tiers: "wbn", t: "Compare the results against the success criteria" },
    { id: "P5.lessons", p: 5, tiers: "wbn", t: "Capture lessons: what to delete next time, which requirements were dumb, which gates added value" },
    { id: "P5.template", p: 5, tiers: "bn", t: "Feed the lessons into the template for the next project" },
    { id: "P5.archive", p: 5, tiers: "n", t: "Archive the data and close out formally" }
  ];
  const CHECK_IDS = new Set(CHECKLIST.map(c => c.id));

  const INTERROGATION = [
    "Owner: which person owns this? Not \"the customer\", not \"safety\"",
    "Origin: physics, regulation, stakeholder, or habit?",
    "Need: which success criterion does it trace to?",
    "Number: is the value justified, or a round number or copied spec?",
    "Consequence: what actually happens if we relax it by 2×?",
    "Verifiable: how will we prove it? If unprovable, rewrite or delete",
    "Smart people are wrong too: was it questioned even if an expert wrote it?"
  ];
  const METHODS = { T: "Test", A: "Analysis", I: "Inspection", D: "Demonstration" };
  const ORIGINS = ["physics", "regulation", "stakeholder", "habit"];
  const RESULTS = ["", "pass", "fail"];
  const TEST_RESULTS = ["pass", "fail", "data"];
  const DELETE_KINDS = ["requirement", "part", "process", "document", "meeting", "other"];
  const DELETE_DECISIONS = ["delete", "merge"];
  const STATUSES = ["active", "watch", "planning", "parked", "done"];

  const LIMITS = { criteria: 10, done: CHECKLIST.length, requirements: 300, risks: 100, budgets: 30, interfaces: 100, tests: 300, deletions: 300, lessons: 100, flags: 20 };

  /* ---------- cleaning (stored data and pasted cards) ---------- */
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
  const str = (v, max) => (v == null ? "" : String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max || 300);
  const num = (v, lo, hi) => { if (v === "" || v == null || typeof v === "boolean") return null; const n = Number(v); return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  const int = (v, lo, hi) => { const n = num(v, lo, hi); return n == null ? null : Math.round(n); };
  const bool = v => v === true || v === "true" || v === 1 || v === "yes";
  const oneOf = (v, list, def) => { const s = str(v, 40).toLowerCase(); return list.includes(s) ? s : def; };
  const iso = v => { const s = str(v, 10); const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if (!m) return ""; const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 ? s : ""; };
  const list = (v, max, fn) => (Array.isArray(v) ? v : []).slice(0, max).map(fn).filter(Boolean);
  const pad = (n, w) => String(n).padStart(w, "0");

  function uniqueIds(items, prefix, width) {
    const seen = new Set();
    let next = 1;
    items.forEach(it => { const m = new RegExp("^" + prefix + "(\\d+)$").exec(it.id || ""); if (m) next = Math.max(next, +m[1] + 1); });
    items.forEach(it => {
      if (!it.id || seen.has(it.id)) it.id = prefix + pad(next++, width);
      seen.add(it.id);
    });
    return items;
  }
  // Next free ID. IDs are never reused: anything named in the deletion log ("R-005: …") counts as taken.
  function nextId(items, prefix, width, alsoTaken) {
    let n = 0;
    const re = new RegExp("^" + prefix + "(\\d+)\\b");
    (items || []).map(it => it.id || "").concat(alsoTaken || []).forEach(s => { const m = re.exec(String(s)); if (m) n = Math.max(n, +m[1]); });
    return prefix + pad(n + 1, width);
  }
  function method(v) {
    const s = str(v, 20).toUpperCase();
    if (METHODS[s]) return s;
    const hit = Object.keys(METHODS).find(k => METHODS[k].toUpperCase() === s);
    return hit || "";
  }
  function gateStatus(v) {
    const s = str(v, 20).toLowerCase().replace(/[\s_]/g, "-");
    if (s === "go" || s === "passed" || s === "pass") return "pass";
    if (s === "no-go" || s === "nogo" || s === "fail" || s === "failed") return "nogo";
    return "pending";
  }

  function cleanCriterion(c, i) {
    if (typeof c === "string") c = { text: c };
    if (!isObj(c)) return null;
    const text = str(c.text, 240); if (!text) return null;
    const id = /^SC\d{1,2}$/.test(str(c.id, 6).toUpperCase()) ? str(c.id, 6).toUpperCase() : "";
    return { id, text, met: bool(c.met) };
  }
  function cleanReq(r) {
    if (typeof r === "string") r = { text: r };
    if (!isObj(r)) return null;
    const text = str(r.text, 400); if (!text) return null;
    let q;
    if (Array.isArray(r.interrogation)) q = INTERROGATION.map((_, i) => bool(r.interrogation[i]));
    else q = INTERROGATION.map(() => bool(r.interrogated));
    return {
      id: /^[A-Za-z]{1,4}-?\d{1,4}$/.test(str(r.id, 10)) ? str(r.id, 10).toUpperCase() : "",
      text, owner: str(r.owner, 60), origin: oneOf(r.origin, ORIGINS, ""), parent: str(r.parent, 6).toUpperCase(),
      method: method(r.method), rationale: str(r.rationale, 300), interrogation: q, result: oneOf(r.result, RESULTS, "")
    };
  }
  function cleanRisk(r) {
    if (!isObj(r)) return null;
    const title = str(r.title || r.text, 200); if (!title) return null;
    return {
      id: /^RK-?\d{1,3}$/.test(str(r.id, 8).toUpperCase()) ? str(r.id, 8).toUpperCase() : "",
      title, likelihood: int(r.likelihood != null ? r.likelihood : r.l, 1, 5) || 1, consequence: int(r.consequence != null ? r.consequence : r.c, 1, 5) || 1,
      mitigation: str(r.mitigation, 300), owner: str(r.owner, 60), status: oneOf(r.status, ["open", "closed"], "open")
    };
  }
  function cleanBudget(b) {
    if (!isObj(b)) return null;
    const name = str(b.name, 40); if (!name) return null;
    const limit = num(b.limit != null ? b.limit : b.allocation, 0, 1e12);
    return { name, unit: str(b.unit, 12), limit: limit == null ? 0 : limit, current: num(b.current, -1e12, 1e12) || 0, target: num(b.target, 0, 100) == null ? 20 : num(b.target, 0, 100) };
  }
  function cleanIface(f) {
    if (!isObj(f)) return null;
    const from = str(f.from, 60), to = str(f.to, 60), what = str(f.what, 200);
    return from || to || what ? { from, to, what } : null;
  }
  function cleanTest(t) {
    if (typeof t === "string") t = { what: t };
    if (!isObj(t)) return null;
    const what = str(t.what || t.text, 240); if (!what) return null;
    return { date: iso(t.date), what, result: oneOf(t.result, TEST_RESULTS, "data"), cycleDays: num(t.cycleDays, 0, 3650) };
  }
  function cleanDeletion(d) {
    if (typeof d === "string") d = { item: d };
    if (!isObj(d)) return null;
    const item = str(d.item, 200); if (!item) return null;
    return {
      date: iso(d.date), item, kind: oneOf(d.kind, DELETE_KINDS, "other"), function: str(d.function, 200), breaks: str(d.breaks, 200),
      decision: oneOf(d.decision, DELETE_DECISIONS, "delete"), reason: str(d.reason, 240), addedBack: bool(d.addedBack)
    };
  }
  function cleanLesson(l) {
    if (typeof l === "string") l = { text: l };
    if (!isObj(l)) return null;
    const text = str(l.text, 400); if (!text) return null;
    return { date: iso(l.date), text };
  }

  // Clean the systems-engineering half of a project. Accepts stored data or a card.
  function cleanSE(raw) {
    raw = isObj(raw) ? raw : {};
    const se = blank();
    se.phase = int(raw.phase, 0, 5) || 0;
    // Criterion IDs stay put when one is removed, so requirement trace links don't shift.
    se.criteria = uniqueIds(list(raw.criteria, LIMITS.criteria, cleanCriterion), "SC", 1);
    const done = Array.isArray(raw.done) ? raw.done : Array.isArray(raw.checklistDone) ? raw.checklistDone : [];
    se.done = Array.from(new Set(done.map(x => str(x, 40)).filter(x => CHECK_IDS.has(x))));
    const g = isObj(raw.gates) ? raw.gates : {};
    Object.keys(GATES).forEach(id => {
      const v = g[id]; if (!isObj(v)) return;
      const rec = { status: gateStatus(v.status), date: iso(v.date), note: str(v.note, 600), reviewers: str(v.reviewers, 200), waived: bool(v.waived) };
      const rc = int(v.reqCount, 0, 100000); if (rc != null) rec.reqCount = rc;
      se.gates[id] = rec;
    });
    se.requirements = uniqueIds(list(raw.requirements, LIMITS.requirements, cleanReq), "R-", 3);
    se.risks = uniqueIds(list(raw.risks, LIMITS.risks, cleanRisk), "RK-", 2);
    se.budgets = list(raw.budgets, LIMITS.budgets, cleanBudget);
    se.interfaces = list(raw.interfaces, LIMITS.interfaces, cleanIface);
    se.tests = list(raw.tests, LIMITS.tests, cleanTest);
    se.deletions = list(raw.deletions, LIMITS.deletions, cleanDeletion);
    se.lessons = list(raw.lessons, LIMITS.lessons, cleanLesson);
    se.parts = int(raw.parts, 0, 1e7);
    se.variants = int(raw.variants, 0, 1e7);
    return se;
  }
  function blank() {
    return { phase: 0, criteria: [], done: [], gates: {}, requirements: [], risks: [], budgets: [], interfaces: [], tests: [], deletions: [], lessons: [], parts: null, variants: null };
  }
  const isTier = t => Object.prototype.hasOwnProperty.call(TIERS, t);

  /* ---------- derived views ---------- */
  const itemsFor = (tier, phase) => CHECKLIST.filter(c => c.tiers.includes(TIER_CODE[tier] || "-") && (phase == null || c.p === phase));
  const gatesFor = tier => (TIERS[tier] ? TIERS[tier].gates : []);
  const gateAfter = (tier, phase) => gatesFor(tier).find(g => GATES[g].after === phase) || null;
  const passed = (se, gid) => !!(se.gates[gid] && se.gates[gid].status === "pass");

  function phaseStats(p, phase) {
    const items = itemsFor(p.tier, phase), done = new Set(p.se.done);
    const n = items.filter(i => done.has(i.id)).length;
    return { done: n, total: items.length };
  }
  function progress(p) {
    const items = itemsFor(p.tier), done = new Set(p.se.done), gates = gatesFor(p.tier);
    const total = items.length + gates.length;
    if (!total) return 0;
    const got = items.filter(i => done.has(i.id)).length + gates.filter(g => passed(p.se, g)).length;
    return Math.round(100 * got / total);
  }
  function nextGate(p) { return gatesFor(p.tier).find(g => !passed(p.se, g)) || null; }

  const riskScore = r => r.likelihood * r.consequence;
  const riskLevel = r => { const s = riskScore(r); return s >= 15 ? "red" : s >= 5 ? "amber" : "green"; };
  const margin = b => (b.limit > 0 ? Math.round(1000 * (b.limit - b.current) / b.limit) / 10 : null);
  function median(xs) { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function metrics(p) {
    const se = p.se, reqs = se.requirements;
    const pass = reqs.filter(r => r.result === "pass").length;
    const open = se.risks.filter(r => r.status === "open").sort((a, b) => riskScore(b) - riskScore(a) || b.consequence - a.consequence);
    const margins = se.budgets.map(b => ({ name: b.name, margin: margin(b), target: b.target })).filter(x => x.margin != null);
    const tightest = margins.slice().sort((a, b) => (a.margin - a.target) - (b.margin - b.target))[0] || null;
    const cycles = se.tests.filter(t => t.cycleDays != null).slice(-5).map(t => t.cycleDays);
    const back = se.deletions.filter(d => d.addedBack).length;
    return {
      reqCount: reqs.length,
      reqAtSRR: se.gates.G1 && se.gates.G1.reqCount != null ? se.gates.G1.reqCount : null,
      verified: pass, verifiedPct: reqs.length ? Math.round(100 * pass / reqs.length) : null,
      failed: reqs.filter(r => r.result === "fail").length,
      openRisks: open.length, topRisks: open.slice(0, 5), redRisks: open.filter(r => riskLevel(r) === "red").length,
      tightest, cycleMedian: median(cycles), cycleN: cycles.length,
      deletions: se.deletions.length, addedBack: back, addBackPct: se.deletions.length ? Math.round(100 * back / se.deletions.length) : null,
      parts: se.parts, variants: se.variants, tests: se.tests.length
    };
  }

  // Gate readiness: the evidence a reviewer would ask for, computed from the project itself.
  function gateChecks(p, gid) {
    const se = p.se, tier = TIERS[p.tier], g = GATES[gid];
    if (!tier || !g || !tier.gates.includes(gid)) return [];
    const big = p.tier !== "weekend";
    const reqs = se.requirements, out = [];
    const add = (label, ok) => out.push({ label, ok: !!ok });
    const critIds = new Set(se.criteria.map(c => c.id));
    const idx = tier.gates.indexOf(gid);
    const from = idx > 0 ? GATES[tier.gates[idx - 1]].after + 1 : 0;

    if (gid === "G0" || (gid === "G1" && !big)) {
      add("Mission statement written", str(p.mission));
      if (big) add("3–5 measurable success criteria", se.criteria.length >= 3 && se.criteria.length <= 5);
      else add("1–3 measurable success criteria", se.criteria.length >= 1 && se.criteria.length <= 3);
    }
    if (gid === "G1") {
      add("Requirements written", reqs.length > 0);
      add("Every requirement has a named owner", reqs.length && reqs.every(r => r.owner));
      add("Every requirement has a verification method", reqs.length && reqs.every(r => r.method));
      add("Every requirement traces to a success criterion", reqs.length && reqs.every(r => critIds.has(r.parent)));
      add("Every requirement survived interrogation", reqs.length && reqs.every(r => r.interrogation.every(Boolean)));
      add("Deletion log started", se.deletions.length > 0);
      if (big) add("Risk register v1 started", se.risks.length > 0);
    }
    if (gid === "G2") {
      add("Budgets set", se.budgets.length > 0);
      add("Every budget meets its margin target", se.budgets.length && se.budgets.every(b => margin(b) != null && margin(b) >= b.target));
      add("Interfaces defined (ICD or N²)", se.interfaces.length > 0);
      const top = metrics(p).topRisks;
      add("Every top open risk has a mitigation", top.every(r => r.mitigation));
    }
    if (gid === "G3") {
      add("At least one design → test loop logged", se.tests.length > 0);
      add("No budget over its allocation", se.budgets.every(b => b.current <= b.limit));
    }
    if (gid === "G4") {
      add("Every requirement verified and passing", reqs.length && reqs.every(r => r.result === "pass"));
      if (big) add("No red risks open", !se.risks.some(r => r.status === "open" && riskLevel(r) === "red"));
    }
    for (let ph = from; ph <= g.after; ph++) {
      const st = phaseStats(p, ph);
      add("Phase " + ph + " checklist complete (" + st.done + "/" + st.total + ")", st.done === st.total);
    }
    return out;
  }

  // What the "advance" button should do next.
  function advance(p) {
    const ph = p.se.phase;
    if (ph >= 5) return { action: "closeout" };
    const gid = gateAfter(p.tier, ph);
    if (gid && !passed(p.se, gid)) return { action: "gate", gate: gid };
    return { action: "advance", phase: ph + 1 };
  }
  // Record a gate decision on a copy of se. A pass moves the project past the gate.
  function decideGate(p, gid, rec) {
    const se = JSON.parse(JSON.stringify(p.se));
    const checks = gateChecks(p, gid);
    const r = {
      status: gateStatus(rec.status), date: iso(rec.date), note: str(rec.note, 600), reviewers: str(rec.reviewers, 200),
      waived: false
    };
    if (r.status === "pass") {
      r.waived = checks.some(c => !c.ok);
      r.reqCount = se.requirements.length;
      se.phase = Math.max(se.phase, GATES[gid].after + 1);
    }
    se.gates[gid] = r;
    return { se, checks };
  }
  // Problems with a gate decision before it's saved (empty = fine).
  function gateProblems(p, gid, rec) {
    const out = [];
    const st = gateStatus(rec.status);
    if (st === "pass" && gateChecks(p, gid).some(c => !c.ok) && !str(rec.note)) out.push("Some checks aren't met. Write the waiver in the note: why go ahead anyway?");
    if (st !== "pending" && TIERS[p.tier].reviewers && !str(rec.reviewers)) out.push("NASA-tier gates need the reviewers' names.");
    if (st !== "pending" && GATES[gid].after > p.se.phase) out.push("This gate opens when the project reaches phase " + GATES[gid].after + ".");
    return out;
  }

  // Derived flags. The deck shows them with the owner's own flags.
  function alerts(p) {
    const se = p.se, out = [], m = metrics(p), big = p.tier !== "weekend";
    gatesFor(p.tier).forEach(gid => {
      const rec = se.gates[gid];
      if (rec && rec.status === "nogo") out.push("No-go at " + gid + " " + GATES[gid].short + (rec.note ? ": " + rec.note : ""));
      else if (GATES[gid].after < se.phase && !passed(se, gid)) out.push(gid + " " + GATES[gid].short + " not passed, but the project is in phase " + se.phase);
      else if (rec && rec.waived && rec.status === "pass") out.push(gid + " " + GATES[gid].short + " passed on a waiver");
    });
    const reqs = se.requirements;
    const noOwner = reqs.filter(r => !r.owner).length, noMethod = reqs.filter(r => !r.method).length, habit = reqs.filter(r => r.origin === "habit").length;
    if (noOwner) out.push(noOwner + (noOwner === 1 ? " requirement has" : " requirements have") + " no owner (P1)");
    if (noMethod) out.push(noMethod + (noMethod === 1 ? " requirement has" : " requirements have") + " no verification method (P2)");
    if (habit) out.push(habit + (habit === 1 ? " requirement comes" : " requirements come") + " from habit. Question or delete");
    if (m.failed) out.push(m.failed + (m.failed === 1 ? " requirement failed" : " requirements failed") + " verification");
    if (big && m.redRisks) out.push(m.redRisks + (m.redRisks === 1 ? " red risk" : " red risks") + " open");
    if (big) se.budgets.forEach(b => {
      const mg = margin(b);
      if (b.current > b.limit) out.push(b.name + " budget is over its allocation");
      else if (mg != null && mg < b.target) out.push(b.name + " margin " + mg + "% is under its " + b.target + "% target");
    });
    if (se.phase >= 2 && !se.deletions.length) out.push("Nothing deleted yet (Musk step 2)");
    if (se.deletions.length >= 5 && !m.addedBack) out.push("Nothing added back from " + se.deletions.length + " deletions. Delete more aggressively (P3)");
    return out.slice(0, 8);
  }

  /* ---------- status cards: the interface to Claude projects (see docs/status-card.md) ---------- */
  const CARD_FIELDS = ["name", "category", "org", "status", "mission", "next", "due", "flags"];
  const SE_FIELDS = ["phase", "criteria", "gates", "requirements", "risks", "budgets", "interfaces", "tests", "deletions", "lessons", "parts", "variants"];

  // Pull one or more card objects out of pasted text: bare JSON, a ```json block, or JSON inside prose.
  function parseCards(text) {
    const s = String(text || "");
    const tries = [];
    const fence = /```(?:json)?\s*([\s\S]*?)```/gi; let m;
    while ((m = fence.exec(s))) tries.push(m[1]);
    tries.push(s);
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) tries.push(s.slice(a, b + 1));
    const c = s.indexOf("["), d = s.lastIndexOf("]");
    if (c >= 0 && d > c) tries.push(s.slice(c, d + 1));
    for (const t of tries) {
      let v; try { v = JSON.parse(t.trim()); } catch (e) { continue; }
      const arr = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.cards) ? v.cards : [v];
      const cards = arr.filter(x => isObj(x) && (x.deck === "status-card" || typeof x.name === "string"));
      if (cards.length) return cards.slice(0, 50);
    }
    return [];
  }

  // Clean a pasted card. Only fields that are present come through, so a card can update part of a project.
  function cleanCard(raw) {
    if (!isObj(raw)) return null;
    const out = { has: new Set() };
    const id = str(raw.id, 60).toLowerCase();
    out.id = /^[a-z0-9][a-z0-9-]{0,59}$/.test(id) ? id : "";
    if ("name" in raw) { const n = str(raw.name, 80); if (n) { out.name = n; out.has.add("name"); } }
    if (!out.name && !out.id) return null;
    if ("category" in raw) { out.category = str(raw.category, 30); out.has.add("category"); }
    if ("org" in raw) { out.org = str(raw.org, 90); out.has.add("org"); }
    if ("status" in raw) { out.status = oneOf(raw.status, STATUSES, "active"); out.has.add("status"); }
    if ("mission" in raw) { out.mission = str(raw.mission, 320); out.has.add("mission"); }
    if ("next" in raw) { out.next = str(raw.next, 220); out.has.add("next"); }
    if ("due" in raw) { out.due = iso(raw.due) || null; out.has.add("due"); }
    if ("flags" in raw) { out.flags = list(raw.flags, LIMITS.flags, f => str(f, 200) || null); out.has.add("flags"); }
    if ("tier" in raw) { const t = str(raw.tier, 20).toLowerCase().replace(/[\s_-]/g, ""); out.tier = isTier(t) ? t : null; out.has.add("tier"); }
    const se = cleanSE(raw);
    out.se = {};
    SE_FIELDS.forEach(k => { if (k in raw) { out.se[k] = se[k]; out.has.add(k); } });
    if ("checklistDone" in raw || "done" in raw) { out.se.done = se.done; out.has.add("done"); }
    return out;
  }

  // Merge a cleaned card into a stored project document (or a new one). Returns the new document.
  function applyCard(existing, card) {
    const doc = existing ? JSON.parse(JSON.stringify(existing)) : { status: "active", components: [], flags: [], next: "", notes: "" };
    CARD_FIELDS.forEach(k => { if (card.has.has(k)) doc[k] = card[k]; });
    if (card.has.has("tier")) doc.tier = card.tier;
    const se = cleanSE(doc.se);
    Object.keys(card.se).forEach(k => { se[k] = card.se[k]; });
    if (doc.tier || doc.se || Object.keys(card.se).length) doc.se = cleanSE(se);
    if (!doc.name) doc.name = card.name || "Untitled project";
    doc.updatedAt = new Date().toISOString();
    return doc;
  }

  // Find the project a card is about: by id, then by exact name (case-insensitive).
  function matchCard(projects, card) {
    if (card.id) { const p = projects.find(x => x.id === card.id); if (p) return p; }
    if (card.name) { const n = card.name.toLowerCase(); const p = projects.find(x => String(x.name).toLowerCase() === n); if (p) return p; }
    return null;
  }

  // Human summary of what a card would change, for the preview.
  function describeCard(existing, card) {
    const lines = [];
    const before = existing && existing.se ? cleanSE(existing.se) : null;
    if (card.has.has("tier")) lines.push("Tier: " + (existing && existing.tier && TIERS[existing.tier] ? TIERS[existing.tier].label + " → " : "") + (card.tier ? TIERS[card.tier].label : "none"));
    if (card.has.has("status")) lines.push("Status: " + card.status);
    if (card.has.has("phase")) lines.push("Phase: " + (before ? before.phase + " → " : "") + card.se.phase + " · " + PHASES[card.se.phase].name);
    if (card.has.has("gates")) {
      const g = card.se.gates, ids = Object.keys(g);
      if (ids.length) lines.push("Gates: " + ids.map(id => id + " " + (g[id].status === "pass" ? "go" : g[id].status === "nogo" ? "no-go" : "pending")).join(", "));
    }
    const counts = [["criteria", "success criteria"], ["requirements", "requirements"], ["risks", "risks"], ["budgets", "budgets"], ["interfaces", "interfaces"], ["tests", "tests"], ["deletions", "deletions"], ["lessons", "lessons"]];
    const parts = [];
    counts.forEach(([k, label]) => { if (card.has.has(k)) parts.push(label + " " + (before ? before[k].length + " → " : "") + card.se[k].length); });
    if (parts.length) lines.push("Lists (replaced): " + parts.join(", "));
    if (card.has.has("done")) lines.push("Checklist items done: " + (before ? before.done.length + " → " : "") + card.se.done.length);
    ["mission", "next", "due"].forEach(k => { if (card.has.has(k)) lines.push(k === "next" ? "Next action: " + (card.next || "cleared") : k === "due" ? "Due: " + (card.due || "cleared") : "Mission updated"); });
    if (card.has.has("flags")) lines.push("Flags: " + card.flags.length);
    return lines;
  }

  // The card for a project, ready to paste into its Claude project.
  function toCard(p) {
    const se = cleanSE(p.se);
    const card = { deck: "status-card", v: 1, id: p.id, name: p.name, tier: p.tier || null, status: p.status, category: p.category || "", org: p.org || "", mission: p.mission || "", next: p.next || "", due: p.due || null, flags: p.flags || [] };
    card.phase = se.phase;
    card.criteria = se.criteria;
    card.checklistDone = se.done;
    card.gates = se.gates;
    ["requirements", "risks", "budgets", "interfaces", "tests", "deletions", "lessons"].forEach(k => { card[k] = se[k]; });
    if (se.parts != null) card.parts = se.parts;
    if (se.variants != null) card.variants = se.variants;
    card.exportedAt = new Date().toISOString();
    return card;
  }

  const api = {
    TIERS, TIER_ORDER, PHASES, MUSK, RULE_OF_ORDER, GATES, GATE_STATUS, CHECKLIST, INTERROGATION, METHODS, ORIGINS,
    DELETE_KINDS, DELETE_DECISIONS, TEST_RESULTS, LIMITS,
    isTier, blank, cleanSE, itemsFor, gatesFor, gateAfter, passed, phaseStats, progress, nextGate,
    riskScore, riskLevel, margin, metrics, gateChecks, gateProblems, advance, decideGate, alerts, nextId,
    parseCards, cleanCard, applyCard, matchCard, describeCard, toCard
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeckSE = api;
})(typeof window !== "undefined" ? window : globalThis);
