/* Command Deck · tiered project dashboards (Weekend / Black Swan / NASA)
   Draws the mission dashboard drawer, the extras on a tiered project's card, and the
   status-card import drawer. The framework itself lives in js/se-model.js (DeckSE);
   the page hands over its helpers with DeckSEUI.mount(ctx). Every write goes through
   the deck's own database, so tier data stays on the phone and in backups. */
(function () {
  "use strict";
  const S = window.DeckSE;
  let ctx = null, drawer = null, body = null, cardDrawer = null, pending = null;
  const st = { pid: null, tab: "checklist", phase: null, form: null, gate: null, gateDraft: null, note: "", bad: false, copyText: "" };

  const TABS = { checklist: "Checklist", reqs: "Requirements", risks: "Risks", design: "Design", tests: "Tests", dels: "Deletions", lessons: "Lessons" };
  const MUSK_SHORT = ["Question", "Delete", "Simplify", "Speed up", "Automate"];
  const GATE_WORD = { "pass": "passed", "pass waived": "passed on a waiver", nogo: "no-go", skipped: "not passed", due: "up next", ahead: "ahead" };
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const el = (tag, cls, text) => ctx.el(tag, cls, text);
  const clone = v => JSON.parse(JSON.stringify(v));
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const fmtN = v => (v == null || v === "" ? "—" : Number.isInteger(+v) ? String(+v) : String(Math.round(+v * 100) / 100));
  const cssq = s => String(s).replace(/["\\]/g, "\\$&");
  const project = () => ctx.getProjects().find(p => p.id === st.pid) || null;
  function btn(cls, text, fn, label, fk) {
    const b = el("button", cls, text); b.type = "button";
    if (label) b.setAttribute("aria-label", label);
    if (fk) b.dataset.fk = fk;
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  const tag = (text, cls) => el("span", "tag" + (cls ? " " + cls : ""), text);

  /* ---------- gates ---------- */
  function gateState(p, gid) {
    const rec = p.se.gates[gid], after = S.GATES[gid].after;
    if (rec && rec.status === "pass") return rec.waived ? "pass waived" : "pass";
    if (rec && rec.status === "nogo") return "nogo";
    if (after < p.se.phase) return "skipped";
    if (after === p.se.phase) return "due";
    return "ahead";
  }

  /* ---------- registry card extras ---------- */
  function tierBadge(tier) {
    const t = S.TIERS[tier];
    const b = el("span", "tier-badge", t.label);
    b.dataset.tier = tier;
    b.title = t.scale + " · " + t.fits;
    return b;
  }
  function miniTrack(p) {
    const w = el("div", "mini-track");
    w.setAttribute("aria-hidden", "true");
    S.PHASES.forEach(ph => {
      w.append(el("i", "mt-ph" + (ph.n < p.se.phase ? " past" : ph.n === p.se.phase ? " now" : "")));
      if (ph.n < 5) { const gid = S.gateAfter(p.tier, ph.n); if (gid) w.append(el("b", "mt-gate " + gateState(p, gid))); }
    });
    return w;
  }
  function cardBlock(p) {
    const w = el("div", "card-se");
    const ph = S.PHASES[p.se.phase];
    const line = el("div", "card-phase");
    line.append(el("span", "ph", "P" + ph.n + " · " + ph.name));
    const ng = S.nextGate(p);
    if (ng) { const ch = S.gateChecks(p, ng); line.append(el("span", "ng", "Next " + ng + " " + S.GATES[ng].short + " · " + ch.filter(c => c.ok).length + "/" + ch.length)); }
    else line.append(el("span", "ng", "All gates passed"));
    w.append(line, miniTrack(p));
    return w;
  }
  // One spoken/written line about a tiered project, for briefings and offline answers.
  function phaseLine(p) {
    const ph = S.PHASES[p.se.phase], ng = S.nextGate(p);
    let s = p.name + " is a " + S.TIERS[p.tier].label + " project in phase " + ph.n + ", " + ph.name.toLowerCase().replace("&", "and") + ".";
    if (ng) { const ch = S.gateChecks(p, ng); s += " Next gate: " + S.GATES[ng].name + ", " + ch.filter(c => c.ok).length + " of " + ch.length + " checks met."; }
    else s += " Every gate is passed.";
    return s;
  }
  function snapshot(p) {
    const m = S.metrics(p), ng = S.nextGate(p), ch = ng ? S.gateChecks(p, ng) : [];
    return {
      tier: S.TIERS[p.tier].label, phase: p.se.phase, phase_name: S.PHASES[p.se.phase].name,
      next_gate: ng ? ng + " " + S.GATES[ng].short : "none", next_gate_checks_met: ng ? ch.filter(c => c.ok).length + "/" + ch.length : "",
      unmet_checks: ch.filter(c => !c.ok).map(c => c.label).slice(0, 6), alerts: p.alerts || [],
      requirements: m.reqCount, verified_percent: m.verifiedPct, red_risks: m.redRisks, open_risks: m.openRisks,
      tightest_margin: m.tightest ? m.tightest.name + " " + m.tightest.margin + "% (target " + m.tightest.target + "%)" : null,
      median_cycle_days: m.cycleMedian, deletions: m.deletions, added_back: m.addedBack
    };
  }

  /* ---------- writes ---------- */
  async function saveSE(p, mutate, extra) {
    const db = ctx.getDB();
    if (!db) throw new Error("Storage is unavailable.");
    const se = clone(p.se); mutate(se);
    const patch = Object.assign({ se: S.cleanSE(se), updatedAt: new Date().toISOString() }, extra || {});
    await ctx.writeDoc("projects/" + p.id, () => db.doc("projects/" + p.id).update(patch));
  }
  function note(msg, bad) {
    st.note = msg || ""; st.bad = !!bad;
    const n = body && body.querySelector(".m-note");
    if (n) { n.textContent = st.note; n.classList.toggle("bad", st.bad); n.hidden = !st.note; }
  }
  async function run(p, mutate, okMsg, extra) {
    try { await saveSE(p, mutate, extra); if (okMsg != null) note(okMsg); return true; }
    catch (e) { note(e && e.code === "quota_exceeded" ? "Storage is full on this phone. Remove something first." : "That didn't save. Try again.", true); return false; }
  }

  /* ---------- the mission dashboard ---------- */
  function open(id) {
    const p = ctx.getProjects().find(x => x.id === id);
    if (!p || !p.tier) return;
    if (st.pid !== id) { st.tab = "checklist"; st.phase = null; }
    Object.assign(st, { pid: id, form: null, gate: null, gateDraft: null, note: "", bad: false, copyText: "" });
    ctx.openDrawer(drawer);
    render();
    drawer.scrollTop = 0;
    drawer.querySelector("[data-fk='m:close']").focus({ preventScroll: true });
  }
  function refresh() { if (drawer && !drawer.hidden) render(); }
  function isOpen() { return !!drawer && !drawer.hidden; }
  function scrollToEl(n) { if (n && n.scrollIntoView) n.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" }); }

  function render() {
    if (!drawer || drawer.hidden) return;
    const p = project();
    if (!p || !p.tier) { ctx.closeDrawers(); return; }
    const a = document.activeElement;
    const fk = a && drawer.contains(a) && a.dataset ? a.dataset.fk : "";
    const tier = S.TIERS[p.tier];
    drawer.dataset.tier = p.tier;
    drawer.querySelector("#m-eyebrow").textContent = tier.label + " · " + tier.scale + " · Mission dashboard";
    drawer.querySelector("#m-title").textContent = p.name;
    if (st.phase == null) st.phase = p.se.phase;
    if (!tier.tabs.includes(st.tab)) st.tab = "checklist";
    body.textContent = "";
    body.append(summary(p), track(p), muskStrip(p), actions(p));
    const n = el("p", "save-msg m-note", st.note);
    n.setAttribute("role", "status"); n.classList.toggle("bad", st.bad); n.hidden = !st.note;
    body.append(n);
    if (st.copyText) body.append(copyBox());
    if (st.gate) body.append(gatePanel(p, st.gate));
    body.append(alertsBlock(p), metricsBlock(p), missionBlock(p), tabsBlock(p), tabBody(p));
    if (fk) { const t = body.querySelector('[data-fk="' + cssq(fk) + '"]'); if (t) t.focus({ preventScroll: true }); }
  }

  function summary(p) {
    const t = S.TIERS[p.tier], ph = S.PHASES[p.se.phase];
    const w = el("div", "m-summary");
    const top = el("div", "m-sumtop");
    top.append(tierBadge(p.tier), el("span", "m-phase", "Phase " + ph.n + " · " + ph.name), el("span", "readout", p.progress + "% complete"));
    w.append(top, el("p", "hint", t.scale + " · " + t.fits + ". Gates " + t.gates.join(", ") + ". " + t.docs + "."));
    return w;
  }

  function track(p) {
    const t = el("div", "m-track");
    t.setAttribute("role", "group");
    t.setAttribute("aria-label", "Phases and gates");
    S.PHASES.forEach(ph => {
      const s = S.phaseStats(p, ph.n);
      const cls = "m-ph" + (ph.n < p.se.phase ? " past" : ph.n === p.se.phase ? " now" : "") + (ph.n === st.phase ? " view" : "");
      const b = btn(cls, null, () => { st.phase = ph.n; st.tab = "checklist"; st.form = null; render(); scrollToEl(body.querySelector("#m-tabs")); },
        "Phase " + ph.n + ", " + ph.name + ", " + s.done + " of " + s.total + " done" + (ph.n === p.se.phase ? ", current phase" : ""), "ph:" + ph.n);
      b.append(el("span", "k", "P" + ph.n), el("span", "q", ph.q), el("span", "n", s.done + "/" + s.total));
      t.append(b);
      if (ph.n < 5) {
        const gid = S.gateAfter(p.tier, ph.n);
        if (gid) {
          const gs = gateState(p, gid);
          const g = btn("m-gate " + gs, null, () => openGate(gid), gid + " " + S.GATES[gid].name + ", " + GATE_WORD[gs], "gate:" + gid);
          g.append(el("i"), el("span", "gl", gid));
          t.append(g);
        } else t.append(el("span", "m-link"));
      }
    });
    return t;
  }

  function muskStrip(p) {
    const ph = S.PHASES[st.phase];
    const w = el("div", "m-musk-wrap");
    w.append(el("div", "m-label", "Musk filter · phase " + ph.n + (ph.musk.length ? " runs step " + ph.musk.join(" then ") : " · lessons only")));
    const g = el("ol", "m-musk");
    S.MUSK.forEach((m, i) => {
      const on = ph.musk.includes(i + 1);
      const li = el("li", "mk" + (on ? " on" : ""));
      li.title = m;
      li.append(el("span", "d", String(i + 1)), el("span", "t", MUSK_SHORT[i]));
      g.append(li);
    });
    w.append(g, el("p", "hint m-rule", S.RULE_OF_ORDER));
    return w;
  }

  function actions(p) {
    const row = el("div", "m-actions");
    if (p.status === "done") row.append(el("span", "readout", "Mission closed out"));
    else {
      const a = S.advance(p);
      if (a.action === "gate") row.append(btn("btn primary", "Hold " + a.gate + " " + S.GATES[a.gate].short + " review", () => openGate(a.gate), null, "act:gate"));
      else {
        const s = S.phaseStats(p, p.se.phase), left = s.total - s.done;
        const label = a.action === "advance" ? "Advance to phase " + a.phase : "Close out mission";
        const b = btn("btn primary", label, null, null, "act:adv");
        let armed = false, tmr = 0;
        b.addEventListener("click", () => {
          if (left && !armed) { armed = true; b.textContent = "Sure? " + plural(left, "item", "items") + " open"; tmr = setTimeout(() => { armed = false; b.textContent = label; }, 3500); return; }
          clearTimeout(tmr);
          if (a.action === "advance") { st.phase = a.phase; run(p, se => { se.phase = a.phase; }, "Phase " + a.phase + ": " + S.PHASES[a.phase].name + "."); }
          else run(p, () => {}, "Mission closed out. Status set to done.", { status: "done" });
        });
        row.append(b);
      }
    }
    row.append(
      btn("btn", "Copy card", () => copyCard(p), "Copy the status card for " + p.name, "act:copy"),
      btn("btn", "Edit", () => { drawer.hidden = true; ctx.openEditor(p.id); }, "Edit " + p.name, "act:edit")
    );
    return row;
  }

  function alertsBlock(p) {
    const all = (p.flags || []).concat(p.alerts || []);
    const w = el("div", "m-alerts");
    w.hidden = !all.length;
    all.forEach(f => w.append(el("div", "flag", f)));
    return w;
  }

  function tile(label, value, sub, hot) {
    const t = el("div", "tele" + (hot ? " hot" : ""));
    t.append(el("div", "tele-label", label), el("div", "tele-value", value), el("div", "tele-sub", sub));
    return t;
  }
  function metricsBlock(p) {
    const m = S.metrics(p), big = p.tier !== "weekend";
    const g = el("div", "m-metrics");
    g.append(tile("Requirements", String(m.reqCount), m.reqAtSRR != null ? "at SRR: " + m.reqAtSRR : "baselined at G1 SRR"));
    g.append(tile("Verified", m.verifiedPct == null ? "—" : m.verifiedPct + "%", m.verified + " of " + m.reqCount + " passing", m.failed > 0));
    if (big) {
      g.append(tile("Red risks", String(m.redRisks), m.openRisks ? plural(m.openRisks, "open risk", "open risks") : "none open", m.redRisks > 0));
      g.append(tile("Margin", m.tightest ? m.tightest.margin + "%" : "—", m.tightest ? m.tightest.name + " · target " + m.tightest.target + "%" : "no budgets yet", !!m.tightest && m.tightest.margin < m.tightest.target));
    }
    g.append(tile("Cycle time", m.cycleMedian == null ? "—" : fmtN(m.cycleMedian) + "d", m.cycleN ? "median of last " + m.cycleN + " loops" : "log loops in Tests"));
    g.append(tile("Add-back", m.addBackPct == null ? "—" : m.addBackPct + "%", m.deletions ? m.addedBack + " of " + m.deletions + " · target ≥10%" : "nothing deleted yet", m.deletions >= 5 && !m.addedBack));
    return g;
  }

  function missionBlock(p) {
    const w = el("section", "panel m-mission");
    const crit = p.se.criteria, met = crit.filter(c => c.met).length;
    const lab = el("div", "panel-label");
    lab.append(el("span", null, "Mission & success criteria"), el("span", null, crit.length ? met + "/" + crit.length + " met" : "none yet"));
    w.append(lab);
    w.append(el("p", "m-missiontext" + (p.mission ? "" : " hint"), p.mission || "No mission statement yet. Write one paragraph with Edit."));
    const ul = el("ul", "check-list");
    crit.forEach((c, i) => {
      const li = el("li", "check-item" + (c.met ? " done" : ""));
      const box = el("button", "check-box");
      box.type = "button"; box.setAttribute("role", "checkbox"); box.setAttribute("aria-checked", String(c.met));
      box.setAttribute("aria-label", c.id + " met: " + c.text); box.dataset.fk = "sc:" + c.id;
      box.addEventListener("click", () => run(p, se => { se.criteria[i].met = !se.criteria[i].met; }, null));
      const tx = el("div", "check-text");
      tx.append(document.createTextNode(c.text), el("span", "check-tag", c.id));
      const del = el("button", "check-del", "Remove");
      del.type = "button"; del.setAttribute("aria-label", "Remove " + c.id); del.dataset.fk = "scdel:" + c.id;
      let armed = false, tmr = 0;
      del.addEventListener("click", () => {
        if (!armed) { armed = true; del.classList.add("arm"); del.textContent = "Sure?"; tmr = setTimeout(() => { armed = false; del.classList.remove("arm"); del.textContent = "Remove"; }, 3000); return; }
        clearTimeout(tmr);
        run(p, se => { se.criteria.splice(i, 1); }, "Removed " + c.id + ".");
      });
      li.append(box, tx, del);
      ul.append(li);
    });
    w.append(ul);
    if (crit.length < S.LIMITS.criteria) {
      const f = el("form", "check-add");
      f.autocomplete = "off";
      const inp = el("input"); inp.type = "text"; inp.maxLength = 240; inp.id = "m-sc"; inp.dataset.fk = "sc:new";
      inp.placeholder = p.tier === "weekend" ? "Add a criterion (1–3 total)" : "Add a criterion (3–5 total)";
      const lb = el("label", "sr", "New success criterion"); lb.htmlFor = "m-sc";
      const add = el("button", "btn", "Add"); add.type = "submit";
      f.append(lb, inp, add);
      f.addEventListener("submit", async e => {
        e.preventDefault();
        const text = inp.value.trim(); if (!text) return;
        await run(p, se => { se.criteria.push({ text, met: false }); }, "Criterion added.");
      });
      w.append(f);
    }
    return w;
  }

  function tabCount(p, k) {
    const se = p.se;
    switch (k) {
      case "checklist": { const s = S.phaseStats(p, st.phase); return s.done + "/" + s.total; }
      case "reqs": return se.requirements.length;
      case "risks": return se.risks.filter(r => r.status === "open").length;
      case "design": return se.budgets.length + se.interfaces.length;
      case "tests": return se.tests.length;
      case "dels": return se.deletions.length;
      case "lessons": return se.lessons.length;
    }
    return "";
  }
  function tabsBlock(p) {
    const w = el("div", "m-tabs");
    w.id = "m-tabs"; w.setAttribute("role", "tablist"); w.setAttribute("aria-label", "Project artifacts");
    S.TIERS[p.tier].tabs.forEach(k => {
      const b = btn("filter", TABS[k], () => { st.tab = k; st.form = null; render(); }, null, "tab:" + k);
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", String(st.tab === k));
      b.append(el("span", "n", String(tabCount(p, k))));
      w.append(b);
    });
    return w;
  }
  function tabBody(p) {
    switch (st.tab) {
      case "reqs": return listTab(p, "requirements", reqHead(p));
      case "risks": { const w = listTab(p, "risks", riskHead(p)); w.insertBefore(heat(p), w.children[1]); return w; }
      case "design": {
        const w = el("section", "m-tab"); w.setAttribute("role", "tabpanel");
        w.append(listTab(p, "budgets", "Budgets & margins · " + p.se.budgets.length), listTab(p, "interfaces", "Interfaces (ICD) · " + p.se.interfaces.length), partsForm(p));
        return w;
      }
      case "tests": { const m = S.metrics(p); return listTab(p, "tests", plural(m.tests, "loop", "loops") + " logged" + (m.cycleMedian != null ? " · median cycle " + fmtN(m.cycleMedian) + " d" : "")); }
      case "dels": { const w = listTab(p, "deletions", delHead(p)); w.insertBefore(addBackMeter(p), w.children[1]); return w; }
      case "lessons": return listTab(p, "lessons", plural(p.se.lessons.length, "lesson", "lessons") + " captured");
      default: return checklistTab(p);
    }
  }

  /* ---------- checklist tab ---------- */
  function checklistTab(p) {
    const n = st.phase, ph = S.PHASES[n], done = new Set(p.se.done);
    const w = el("section", "m-tab"); w.setAttribute("role", "tabpanel");
    const head = el("div", "m-phasehead");
    head.append(el("div", "eyebrow", "P" + n + " · NASA " + ph.nasa + (n === p.se.phase ? " · current phase" : n < p.se.phase ? " · done phase" : " · ahead")));
    head.append(el("h3", "m-h3", ph.name + " · " + ph.q));
    head.append(el("p", "hint", ph.goal));
    w.append(head);
    const ul = el("ul", "check-list m-cl");
    S.itemsFor(p.tier, n).forEach(it => {
      const on = done.has(it.id);
      const li = el("li", "check-item" + (on ? " done" : ""));
      const box = el("button", "check-box");
      box.type = "button"; box.setAttribute("role", "checkbox"); box.setAttribute("aria-checked", String(on));
      box.setAttribute("aria-label", it.t); box.dataset.fk = "ci:" + it.id;
      box.addEventListener("click", () => run(p, se => { const i = se.done.indexOf(it.id); if (i >= 0) se.done.splice(i, 1); else se.done.push(it.id); }, null));
      const tx = el("div", "check-text");
      tx.append(document.createTextNode(it.t));
      if (it.musk) tx.append(el("span", "check-tag musk", "Musk step " + it.musk + " · " + S.MUSK[it.musk - 1]));
      li.append(box, tx);
      ul.append(li);
    });
    w.append(ul);
    const gid = S.gateAfter(p.tier, n);
    if (gid) {
      const ch = S.gateChecks(p, gid), met = ch.filter(c => c.ok).length;
      const gc = el("div", "m-gatecard");
      const tx = el("div");
      tx.append(el("span", "k", gid + " · " + S.GATES[gid].short + " · " + GATE_WORD[gateState(p, gid)]), el("span", "v", S.GATES[gid].name + " · " + met + " of " + ch.length + " checks met"));
      gc.append(tx, btn("btn sm", "Open review", () => openGate(gid), "Open the " + gid + " review", "gc:" + gid));
      w.append(gc);
    } else if (n < 5) w.append(el("p", "hint", "No gate after this phase on a " + S.TIERS[p.tier].label + " project. Advance when the list is done."));
    return w;
  }

  /* ---------- list tabs ---------- */
  const yes = v => (v ? "1" : "");
  const SPECS = {
    requirements: {
      noun: "requirement", idPrefix: "R-", idWidth: 3, logDelete: true,
      empty: "No requirements yet. Write each in \"shall\" form, give it an owner, and say how you'll prove it.",
      blank: p => ({ text: "", owner: "", origin: "", parent: p.se.criteria[0] ? p.se.criteria[0].id : "", method: "", result: "", rationale: "", interrogation: S.INTERROGATION.map(() => false) }),
      fields: p => [
        { k: "text", label: "Requirement", hint: "\"The system shall …\"", type: "textarea", max: 400, req: true },
        { k: "owner", label: "Owner", hint: "a named person", type: "text", max: 60 },
        { k: "origin", label: "Origin", type: "select", options: [["", "Not set"], ["physics", "Physics"], ["regulation", "Regulation"], ["stakeholder", "Stakeholder"], ["habit", "Habit (question it)"]] },
        { k: "parent", label: "Traces to", type: "select", options: [["", p.se.criteria.length ? "Not set" : "Add success criteria first"]].concat(p.se.criteria.map(c => [c.id, c.id + " · " + c.text.slice(0, 48)])) },
        { k: "method", label: "Verification", type: "select", options: [["", "Not set"]].concat(Object.keys(S.METHODS).map(k => [k, S.METHODS[k]])) },
        { k: "result", label: "Result", type: "select", options: [["", "Not verified yet"], ["pass", "Pass"], ["fail", "Fail"]] },
        { k: "rationale", label: "Rationale", type: "text", max: 300 },
        { k: "interrogation", label: "Interrogation · Musk step 1", type: "ticks", options: S.INTERROGATION }
      ],
      label: r => r.id + ": " + r.text,
      row: (b, r) => {
        const q = r.interrogation.filter(Boolean).length;
        const top = el("span", "top");
        top.append(el("span", "id", r.id), tag(r.method ? S.METHODS[r.method] : "No method", r.method ? "" : "warn"),
          tag(r.result === "pass" ? "Pass" : r.result === "fail" ? "Fail" : "Unverified", r.result), tag("Q " + q + "/7", q === 7 ? "pass" : "warn"));
        b.append(top, el("span", "tx", r.text));
        b.append(el("span", "meta", [r.owner ? "Owner " + r.owner : "No owner", r.origin || "origin not set", r.parent ? "traces to " + r.parent : "no trace"].join(" · ")));
        if (!r.owner || r.origin === "habit" || !r.method) b.classList.add("warn");
      }
    },
    risks: {
      noun: "risk", idPrefix: "RK-", idWidth: 2,
      empty: "No risks yet. Score each one on likelihood and consequence, 1 to 5.",
      blank: () => ({ title: "", likelihood: 3, consequence: 3, mitigation: "", owner: "", status: "open" }),
      fields: () => [
        { k: "title", label: "Risk", hint: "if … then …", type: "textarea", max: 200, req: true },
        { k: "likelihood", label: "Likelihood", type: "select", options: [["1", "1 · Remote"], ["2", "2 · Unlikely"], ["3", "3 · Possible"], ["4", "4 · Likely"], ["5", "5 · Near certain"]] },
        { k: "consequence", label: "Consequence", type: "select", options: [["1", "1 · Minimal"], ["2", "2 · Minor"], ["3", "3 · Moderate"], ["4", "4 · Major"], ["5", "5 · Severe"]] },
        { k: "mitigation", label: "Mitigation", type: "textarea", max: 300 },
        { k: "owner", label: "Owner", type: "text", max: 60 },
        { k: "status", label: "Status", type: "select", options: [["open", "Open"], ["closed", "Closed"]] }
      ],
      label: r => r.id + ": " + r.title,
      sort: (a, b) => (b.it.status === "open") - (a.it.status === "open") || S.riskScore(b.it) - S.riskScore(a.it),
      row: (b, r) => {
        const lvl = S.riskLevel(r);
        const top = el("span", "top");
        top.append(el("span", "id", r.id), tag("L" + r.likelihood + " × C" + r.consequence + " = " + S.riskScore(r), r.status === "open" ? lvl : ""), tag(r.status === "open" ? "Open" : "Closed"));
        b.append(top, el("span", "tx", r.title), el("span", "meta", (r.mitigation ? "Mitigation: " + r.mitigation : "No mitigation yet") + (r.owner ? " · " + r.owner : "")));
        if (r.status === "closed") b.classList.add("closed");
      }
    },
    budgets: {
      noun: "budget",
      empty: "No budgets yet. Mass, power, volume, thermal, data and cost, each with 20–30% margin early on.",
      blank: () => ({ name: "", unit: "", limit: "", current: "", target: 20 }),
      fields: () => [
        { k: "name", label: "Budget", hint: "mass, power, cost…", type: "text", max: 40, req: true },
        { k: "unit", label: "Unit", type: "text", max: 12 },
        { k: "limit", label: "Allocation", type: "number" },
        { k: "current", label: "Current estimate", type: "number" },
        { k: "target", label: "Margin target %", type: "number" }
      ],
      label: b => b.name + " budget",
      row: (b, x) => {
        const mg = S.margin(x);
        const lvl = x.current > x.limit ? "red" : mg != null && mg < x.target ? "amber" : "green";
        const top = el("span", "top");
        top.append(el("span", "id", x.name), tag(mg == null ? "No allocation" : mg + "% margin", lvl), tag("target " + fmtN(x.target) + "%"));
        b.append(top, el("span", "tx", fmtN(x.current) + " of " + fmtN(x.limit) + (x.unit ? " " + x.unit : "")));
        const bar = el("span", "m-bar " + lvl), fill = el("i");
        fill.style.width = (x.limit > 0 ? Math.max(0, Math.min(100, 100 * x.current / x.limit)) : 0) + "%";
        bar.append(fill); b.append(bar);
      }
    },
    interfaces: {
      noun: "interface",
      empty: "No interfaces yet. One line per connection: what flows from where to where.",
      blank: () => ({ from: "", to: "", what: "" }),
      fields: () => [
        { k: "from", label: "From", type: "text", max: 60, req: true },
        { k: "to", label: "To", type: "text", max: 60 },
        { k: "what", label: "What crosses it", hint: "power, data, load, fluid…", type: "text", max: 200 }
      ],
      label: f => f.from + " to " + f.to,
      row: (b, f) => { b.append(el("span", "tx", (f.from || "?") + " → " + (f.to || "?")), el("span", "meta", f.what || "Not described")); }
    },
    tests: {
      noun: "test", newestFirst: true,
      empty: "No loops logged. Each design → build → test loop goes here with its cycle time. Failure is data.",
      blank: () => ({ date: ctx.isoToday(), what: "", result: "data", cycleDays: "" }),
      fields: () => [
        { k: "what", label: "What was tested", type: "textarea", max: 240, req: true },
        { k: "date", label: "Date", type: "date" },
        { k: "result", label: "Result", type: "select", options: [["pass", "Pass"], ["fail", "Fail"], ["data", "Data (no pass/fail)"]] },
        { k: "cycleDays", label: "Cycle time, days", hint: "idea to test data", type: "number" }
      ],
      label: t => "Test: " + t.what,
      row: (b, t) => {
        const top = el("span", "top");
        top.append(el("span", "id", t.date ? ctx.fmtShort(t.date) : "No date"), tag(t.result === "pass" ? "Pass" : t.result === "fail" ? "Fail" : "Data", t.result));
        if (t.cycleDays != null) top.append(tag(fmtN(t.cycleDays) + " d cycle"));
        b.append(top, el("span", "tx", t.what));
      }
    },
    deletions: {
      noun: "deletion", newestFirst: true,
      empty: "Nothing deleted yet. The best part is no part; the best process is no process.",
      blank: () => ({ date: ctx.isoToday(), item: "", kind: "part", function: "", breaks: "", decision: "delete", reason: "", addedBack: false }),
      fields: () => [
        { k: "item", label: "Item", type: "text", max: 200, req: true },
        { k: "kind", label: "Kind", type: "select", options: S.DELETE_KINDS.map(k => [k, k[0].toUpperCase() + k.slice(1)]) },
        { k: "function", label: "Function it served", type: "text", max: 200 },
        { k: "breaks", label: "What breaks if deleted?", type: "text", max: 200 },
        { k: "decision", label: "Decision", type: "select", options: [["delete", "Delete"], ["merge", "Merge"]] },
        { k: "reason", label: "Reason", type: "text", max: 240 },
        { k: "date", label: "Date", type: "date" },
        { k: "addedBack", label: "Added back later", type: "check" }
      ],
      label: d => "Deleted: " + d.item,
      row: (b, d) => {
        const top = el("span", "top");
        top.append(el("span", "id", d.date ? ctx.fmtShort(d.date) : "No date"), tag(d.kind), tag(d.decision === "merge" ? "Merged" : "Deleted"));
        if (d.addedBack) top.append(tag("Added back", "pass"));
        b.append(top, el("span", "tx", d.item), el("span", "meta", [d.reason, d.breaks ? "Breaks: " + d.breaks : ""].filter(Boolean).join(" · ") || "No reason logged"));
      },
      extra: (li, d, i, p) => {
        li.append(btn("btn sm m-addback", d.addedBack ? "Undo add-back" : "Mark added back", () => run(p, se => { se.deletions[i].addedBack = !se.deletions[i].addedBack; }, null), (d.addedBack ? "Undo add-back for " : "Mark added back: ") + d.item, "ab:" + i + yes(d.addedBack)));
      }
    },
    lessons: {
      noun: "lesson", newestFirst: true,
      empty: "No lessons yet. What to delete next time, which requirements were dumb, which gates added value.",
      blank: () => ({ date: ctx.isoToday(), text: "" }),
      fields: () => [
        { k: "text", label: "Lesson", type: "textarea", max: 400, req: true },
        { k: "date", label: "Date", type: "date" }
      ],
      label: l => "Lesson: " + l.text,
      row: (b, l) => { b.append(el("span", "top", l.date ? ctx.fmtShort(l.date) : ""), el("span", "tx", l.text)); }
    }
  };

  function reqHead(p) {
    const r = p.se.requirements, q = r.filter(x => x.interrogation.every(Boolean)).length;
    return plural(r.length, "requirement", "requirements") + " · " + q + " interrogated · " + r.filter(x => x.result === "pass").length + " passing";
  }
  function riskHead(p) {
    const open = p.se.risks.filter(r => r.status === "open");
    return plural(open.length, "open risk", "open risks") + " · " + open.filter(r => S.riskLevel(r) === "red").length + " red";
  }
  function delHead(p) { return plural(p.se.deletions.length, "deletion", "deletions") + " logged"; }

  function listTab(p, list, head) {
    const spec = SPECS[list];
    const w = el("section", "m-tab"); w.setAttribute("role", "tabpanel");
    const bar = el("div", "m-tabbar");
    bar.append(el("div", "m-label", head), btn("btn sm", "Add " + spec.noun, () => openForm(p, list, null), null, "add:" + list));
    w.append(bar);
    if (st.form && st.form.list === list) w.append(formView(p, list));
    let items = p.se[list].map((it, i) => ({ it, i }));
    if (spec.sort) items.sort(spec.sort); else if (spec.newestFirst) items.reverse();
    if (!items.length) w.append(el("p", "hint", spec.empty));
    const ul = el("ul", "m-list");
    items.forEach(({ it, i }) => {
      const li = el("li");
      const row = btn("m-row", null, () => openForm(p, list, i), "Edit " + spec.label(it), "row:" + list + ":" + i);
      spec.row(row, it, p);
      li.append(row);
      if (spec.extra) spec.extra(li, it, i, p);
      ul.append(li);
    });
    w.append(ul);
    return w;
  }
  function openForm(p, list, index) {
    const spec = SPECS[list];
    st.form = { list, index, draft: clone(index == null ? spec.blank(p) : p.se[list][index]), confirmDel: false, err: "" };
    render();
    const f = body.querySelector("#m-form");
    scrollToEl(f);
    const first = f && f.querySelector("input, textarea, select");
    if (first) first.focus({ preventScroll: true });
  }
  function field(fd, d) {
    const id = "mf-" + fd.k;
    if (fd.type === "check") {
      const l = el("label", "check"); l.htmlFor = id;
      const i = el("input"); i.type = "checkbox"; i.id = id; i.checked = !!d[fd.k]; i.dataset.fk = "f:" + fd.k;
      i.addEventListener("change", () => { d[fd.k] = i.checked; });
      l.append(i, document.createTextNode(fd.label));
      return l;
    }
    if (fd.type === "ticks") {
      const fs = el("fieldset", "m-ticks");
      const lg = el("legend", null, fd.label + " · " + d[fd.k].filter(Boolean).length + "/" + fd.options.length);
      fs.append(lg);
      fd.options.forEach((q, i) => {
        const l = el("label", "check");
        const inp = el("input"); inp.type = "checkbox"; inp.id = id + "-" + i; inp.checked = !!d[fd.k][i]; inp.dataset.fk = "f:" + fd.k + ":" + i;
        inp.addEventListener("change", () => { d[fd.k][i] = inp.checked; lg.textContent = fd.label + " · " + d[fd.k].filter(Boolean).length + "/" + fd.options.length; });
        l.htmlFor = inp.id;
        l.append(inp, document.createTextNode(q));
        fs.append(l);
      });
      return fs;
    }
    const l = el("label"); l.htmlFor = id;
    l.append(document.createTextNode(fd.label));
    if (fd.hint) l.append(el("small", null, fd.hint));
    let inp;
    if (fd.type === "textarea") { inp = el("textarea"); inp.rows = 2; }
    else if (fd.type === "select") { inp = el("select"); fd.options.forEach(([v, t]) => { const o = el("option", null, t); o.value = v; inp.append(o); }); }
    else {
      inp = el("input");
      inp.type = fd.type === "number" ? "number" : fd.type === "date" ? "date" : "text";
      if (fd.type === "number") { inp.step = "any"; inp.inputMode = "decimal"; }
    }
    if (fd.max) inp.maxLength = fd.max;
    inp.id = id; inp.dataset.fk = "f:" + fd.k;
    inp.value = d[fd.k] == null ? "" : String(d[fd.k]);
    inp.addEventListener(fd.type === "select" ? "change" : "input", () => { d[fd.k] = inp.value; });
    l.append(inp);
    return l;
  }
  function formView(p, list) {
    const spec = SPECS[list], f = st.form, d = f.draft;
    const form = el("form", "form m-form");
    form.id = "m-form"; form.noValidate = true; form.autocomplete = "off";
    form.append(el("div", "eyebrow", (f.index == null ? "New " : "Edit ") + spec.noun + (d.id ? " · " + d.id : "")));
    spec.fields(p).forEach(fd => form.append(field(fd, d)));
    const msg = el("p", "save-msg bad", f.err); msg.setAttribute("role", "alert"); msg.hidden = !f.err;
    const acts = el("div", "drawer-actions");
    const save = el("button", "btn primary", "Save"); save.type = "submit"; save.dataset.fk = "f:save";
    acts.append(save, btn("btn", "Cancel", () => { st.form = null; render(); }, null, "f:cancel"));
    if (f.index != null) {
      acts.append(el("span", "spacer"));
      acts.append(btn("btn danger", spec.logDelete ? "Delete & log" : "Delete", () => { f.confirmDel = true; render(); const c = body.querySelector(".m-form .confirm"); if (c) c.querySelector("input, button").focus(); }, null, "f:del"));
    }
    form.append(acts, msg);
    if (f.index != null && f.confirmDel) {
      const c = el("div", "confirm");
      if (spec.logDelete) {
        const l = el("label"); l.htmlFor = "mf-delreason";
        l.append(document.createTextNode("Why delete it? This goes in the deletion log."));
        const r = el("input"); r.type = "text"; r.id = "mf-delreason"; r.maxLength = 240; r.value = d.delReason || ""; r.dataset.fk = "f:delreason";
        r.addEventListener("input", () => { d.delReason = r.value; });
        l.append(r); c.append(l);
      } else c.append(el("span", null, "Delete this " + spec.noun + "?"));
      c.append(btn("btn danger sm", "Delete", () => doDelete(p, list), null, "f:delyes"), btn("btn sm", "Keep it", () => { f.confirmDel = false; render(); }, null, "f:delno"));
      form.append(c);
    }
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const miss = spec.fields(p).find(fd => fd.req && !String(d[fd.k] == null ? "" : d[fd.k]).trim());
      if (miss) { f.err = miss.label + " can't be empty."; render(); return; }
      const item = clone(d); delete item.delReason;
      if (f.index == null && spec.idPrefix) item.id = S.nextId(p.se[list], spec.idPrefix, spec.idWidth);
      const ok = await run(p, se => { if (f.index == null) se[list].push(item); else se[list][f.index] = item; },
        (f.index == null ? "Added " : "Saved ") + spec.noun + (item.id ? " " + item.id : "") + ".");
      if (ok) { st.form = null; render(); }
    });
    return form;
  }
  async function doDelete(p, list) {
    const f = st.form, spec = SPECS[list], item = p.se[list][f.index];
    if (!item) { st.form = null; render(); return; }
    const reason = String(f.draft.delReason || "").trim();
    if (spec.logDelete && !reason) { f.err = "Say why, so the deletion log is useful next time."; render(); return; }
    const ok = await run(p, se => {
      se[list].splice(f.index, 1);
      if (spec.logDelete) se.deletions.push({ date: ctx.isoToday(), item: (item.id ? item.id + ": " : "") + item.text, kind: "requirement", function: "", breaks: "", decision: "delete", reason, addedBack: false });
    }, spec.logDelete ? "Deleted " + item.id + " and logged it under Deletions." : "Deleted.");
    if (ok) { st.form = null; render(); }
  }

  function heat(p) {
    const open = p.se.risks.filter(r => r.status === "open");
    const w = el("div", "m-heatwrap");
    w.append(el("div", "m-label", "5×5 · likelihood (up) × consequence (across)"));
    const g = el("div", "m-heat");
    g.setAttribute("role", "img");
    g.setAttribute("aria-label", "Risk matrix: " + open.filter(r => S.riskLevel(r) === "red").length + " red, " + open.filter(r => S.riskLevel(r) === "amber").length + " amber, " + open.filter(r => S.riskLevel(r) === "green").length + " green open risks");
    for (let L = 5; L >= 1; L--) {
      g.append(el("span", "ax", String(L)));
      for (let C = 1; C <= 5; C++) {
        const n = open.filter(r => r.likelihood === L && r.consequence === C).length;
        g.append(el("span", "hc " + S.riskLevel({ likelihood: L, consequence: C }) + (n ? " has" : ""), n ? String(n) : ""));
      }
    }
    g.append(el("span", "ax"));
    for (let C = 1; C <= 5; C++) g.append(el("span", "ax", String(C)));
    w.append(g);
    return w;
  }
  function addBackMeter(p) {
    const m = S.metrics(p);
    const w = el("div", "m-addback-meter");
    const pct = m.addBackPct == null ? 0 : m.addBackPct;
    w.append(el("div", "m-label", "Added back " + m.addedBack + " of " + m.deletions + (m.deletions ? " · " + pct + "%" : "") + " · target ≥10% (P3)"));
    const bar = el("span", "m-bar " + (!m.deletions ? "" : pct >= 10 ? "green" : "amber")), fill = el("i");
    fill.style.width = Math.min(100, pct * 5) + "%";
    bar.append(fill);
    w.append(bar, el("p", "hint", "If nothing ever comes back, you aren't deleting enough. The bar fills at 20%."));
    return w;
  }
  function partsForm(p) {
    const f = el("form", "form m-parts");
    f.autocomplete = "off";
    f.append(el("div", "m-label", "Parts count · Musk step 2"));
    const row = el("div", "row2");
    const mk = (id, label, v) => {
      const l = el("label"); l.htmlFor = id; l.append(document.createTextNode(label));
      const i = el("input"); i.type = "number"; i.id = id; i.min = "0"; i.step = "1"; i.inputMode = "numeric"; i.value = v == null ? "" : String(v); i.dataset.fk = "f:" + id;
      l.append(i); row.append(l); return i;
    };
    const a = mk("m-parts", "Parts", p.se.parts), b = mk("m-variants", "Part variants", p.se.variants);
    f.append(row);
    const s = el("button", "btn sm", "Save counts"); s.type = "submit"; s.dataset.fk = "f:parts-save";
    f.append(s);
    f.addEventListener("submit", e => { e.preventDefault(); run(p, se => { se.parts = a.value; se.variants = b.value; }, "Parts count saved."); });
    return f;
  }

  /* ---------- gate review ---------- */
  function openGate(gid) {
    const p = project(); if (!p) return;
    const rec = p.se.gates[gid] || { status: "pending" };
    st.gate = gid;
    st.gateDraft = { status: rec.status === "pending" ? "pass" : rec.status, date: rec.date || ctx.isoToday(), reviewers: rec.reviewers || "", note: rec.note || "", err: "" };
    st.form = null;
    render();
    const g = body.querySelector("#m-gatepanel");
    scrollToEl(g);
    const h = g && g.querySelector("h3"); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  function closeGate() { st.gate = null; st.gateDraft = null; render(); }
  function gatePanel(p, gid) {
    const g = S.GATES[gid], t = S.TIERS[p.tier], rec = p.se.gates[gid] || { status: "pending" }, d = st.gateDraft;
    const checks = S.gateChecks(p, gid), met = checks.filter(c => c.ok).length;
    const box = el("section", "panel m-gatepanel");
    box.id = "m-gatepanel"; box.setAttribute("aria-label", gid + " gate review");
    box.append(el("div", "eyebrow", "Gate review · " + t.review));
    box.append(el("h3", "m-h3", gid + " · " + g.name + " (" + g.short + ")"));
    box.append(el("p", "hint", g.question));
    if (rec.status !== "pending") box.append(el("p", "readout", "On record: " + (rec.status === "pass" ? "go" : "no-go") + (rec.date ? " · " + ctx.fmtShort(rec.date) : "") + (rec.waived ? " · waiver" : "") + (rec.reviewers ? " · " + rec.reviewers : "")));
    box.append(el("div", "m-label", met + " of " + checks.length + " checks met"));
    const ul = el("ul", "m-checks");
    checks.forEach(c => { const li = el("li", c.ok ? "ok" : "bad"); li.append(el("span", "g", c.ok ? "✓" : "✗"), el("span", null, c.label)); ul.append(li); });
    box.append(ul);
    if (g.after > p.se.phase) {
      box.append(el("p", "hint", "This gate opens when the project reaches phase " + g.after + ". The checks show what it will ask for."));
      const r = el("div", "drawer-actions"); r.append(btn("btn", "Close", closeGate, null, "g:close")); box.append(r);
      return box;
    }
    const f = el("form", "form");
    f.autocomplete = "off"; f.noValidate = true;
    const row = el("div", "row2");
    const dl = el("label"); dl.htmlFor = "g-status"; dl.append(document.createTextNode("Decision"));
    const sel = el("select"); sel.id = "g-status"; sel.dataset.fk = "g:status";
    [["pass", "Go"], ["nogo", "No-go"], ["pending", "Not decided (reset)"]].forEach(([v, tx]) => { const o = el("option", null, tx); o.value = v; sel.append(o); });
    sel.value = d.status; dl.append(sel); row.append(dl);
    const dd = el("label"); dd.htmlFor = "g-date"; dd.append(document.createTextNode("Date"));
    const date = el("input"); date.type = "date"; date.id = "g-date"; date.value = d.date; date.dataset.fk = "g:date";
    date.addEventListener("input", () => { d.date = date.value; });
    dd.append(date); row.append(dd);
    f.append(row);
    if (p.tier !== "weekend") {
      const rl = el("label"); rl.htmlFor = "g-rev"; rl.append(document.createTextNode("Reviewers"));
      rl.append(el("small", null, t.reviewers ? "required: external reviewers by name" : "optional"));
      const rv = el("input"); rv.type = "text"; rv.id = "g-rev"; rv.maxLength = 200; rv.value = d.reviewers; rv.dataset.fk = "g:rev";
      rv.addEventListener("input", () => { d.reviewers = rv.value; });
      rl.append(rv); f.append(rl);
    }
    const nl = el("label"); nl.htmlFor = "g-note";
    const noteLabel = () => (d.status === "pass" && met < checks.length ? "Waiver: why go ahead with unmet checks?" : "Note");
    const nlt = document.createTextNode(noteLabel()); nl.append(nlt);
    const nt = el("textarea"); nt.id = "g-note"; nt.rows = 3; nt.maxLength = 600; nt.value = d.note; nt.dataset.fk = "g:note";
    nt.addEventListener("input", () => { d.note = nt.value; });
    nl.append(nt); f.append(nl);
    sel.addEventListener("change", () => { d.status = sel.value; nlt.textContent = noteLabel(); });
    const msg = el("p", "save-msg bad", d.err); msg.setAttribute("role", "alert"); msg.hidden = !d.err;
    const acts = el("div", "drawer-actions");
    const save = el("button", "btn primary", "Save decision"); save.type = "submit"; save.dataset.fk = "g:save";
    acts.append(save, btn("btn", "Cancel", closeGate, null, "g:cancel"));
    f.append(msg, acts);
    f.addEventListener("submit", async e => {
      e.preventDefault();
      const probs = S.gateProblems(p, gid, d);
      if (probs.length) { d.err = probs.join(" "); render(); return; }
      const before = p.se.phase;
      const res = S.decideGate(p, gid, d);
      const rec2 = res.se.gates[gid];
      const msgOk = rec2.status === "pass"
        ? gid + " " + g.short + ": go" + (rec2.waived ? " on a waiver" : "") + "." + (res.se.phase !== before ? " Phase " + res.se.phase + ", " + S.PHASES[res.se.phase].name + ", starts." : "")
        : rec2.status === "nogo" ? gid + " " + g.short + ": no-go recorded." : gid + " reset to not decided.";
      if (res.se.phase !== before) st.phase = res.se.phase;
      const ok = await run(p, se => { Object.keys(res.se).forEach(k => { se[k] = res.se[k]; }); }, msgOk);
      if (ok) closeGate();
    });
    box.append(f);
    return box;
  }

  /* ---------- status card out ---------- */
  async function copyCard(p) {
    const text = JSON.stringify(S.toCard(p), null, 2);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      st.copyText = "";
      note("Status card copied. Paste it into this project's Claude chat and ask for an update.");
    } catch (e) {
      st.copyText = text;
      note("Copy the card from the box below.");
      render();
      const ta = body.querySelector(".m-copy textarea"); if (ta) { ta.focus(); ta.select(); }
    }
  }
  function copyBox() {
    const w = el("div", "m-copy");
    const ta = el("textarea"); ta.readOnly = true; ta.rows = 6; ta.value = st.copyText; ta.setAttribute("aria-label", "Status card JSON");
    w.append(ta, btn("btn sm", "Done", () => { st.copyText = ""; note(""); render(); }, null, "copy:done"));
    return w;
  }

  /* ---------- status card in ---------- */
  function buildCardDrawer() {
    cardDrawer = el("aside", "drawer");
    cardDrawer.id = "card-drawer"; cardDrawer.hidden = true;
    cardDrawer.setAttribute("role", "dialog"); cardDrawer.setAttribute("aria-modal", "true"); cardDrawer.setAttribute("aria-labelledby", "c-title");
    const head = el("div", "drawer-head"), t = el("div");
    const h = el("h2", null, "Import status card"); h.id = "c-title";
    t.append(el("div", "eyebrow", "From a Claude project"), h);
    head.append(t, btn("btn ghost", "Close", () => ctx.closeDrawers(), null, "c:close"));
    const form = el("form", "form"); form.autocomplete = "off";
    form.append(el("p", "hint", "In the Claude project, ask for a Command Deck status card (the deck-status-card skill writes one). Copy the JSON it gives you and paste it here. Nothing changes until you tap Apply."));
    const l = el("label"); l.htmlFor = "c-text"; l.append(document.createTextNode("Status card"));
    const ta = el("textarea"); ta.id = "c-text"; ta.rows = 8; ta.spellcheck = false; ta.setAttribute("autocapitalize", "off"); ta.setAttribute("autocorrect", "off");
    ta.placeholder = "{ \"deck\": \"status-card\", \"name\": \"…\", \"tier\": \"blackswan\", … }";
    l.append(ta); form.append(l);
    const acts = el("div", "drawer-actions");
    const pv = el("button", "btn primary", "Preview"); pv.type = "submit";
    acts.append(btn("btn", "Paste", async () => {
      try { ta.value = await navigator.clipboard.readText(); preview(); }
      catch (e) { cmsg("The clipboard is blocked here. Press and hold in the box, then tap Paste.", true); ta.focus(); }
    }), pv);
    form.append(acts);
    const msg = el("p", "save-msg"); msg.id = "c-msg"; msg.setAttribute("role", "status");
    const prev = el("div", "c-preview"); prev.id = "c-preview";
    form.append(msg, prev);
    form.addEventListener("submit", e => { e.preventDefault(); preview(); });
    cardDrawer.append(head, form);
    document.body.append(cardDrawer);
  }
  function cmsg(t, bad) { const m = cardDrawer.querySelector("#c-msg"); m.textContent = t || ""; m.classList.toggle("bad", !!bad); }
  function openImport() {
    pending = null;
    cardDrawer.querySelector("#c-text").value = "";
    cardDrawer.querySelector("#c-preview").textContent = "";
    cmsg("");
    ctx.openDrawer(cardDrawer);
  }
  function preview() {
    const prev = cardDrawer.querySelector("#c-preview");
    prev.textContent = ""; pending = null;
    const cards = S.parseCards(cardDrawer.querySelector("#c-text").value).map(S.cleanCard).filter(Boolean);
    if (!cards.length) { cmsg("No status card found in that text. Paste the JSON block Claude gave you.", true); return; }
    const projects = ctx.getProjects();
    cards.forEach(c => {
      const m = S.matchCard(projects, c);
      const box = el("div", "c-item");
      box.append(el("div", "eyebrow", m ? "Updates" : "New project"), el("strong", null, m ? m.name : c.name));
      const lines = S.describeCard(m, c);
      const tier = c.has.has("tier") ? c.tier : m && m.tier;
      if (!tier) lines.push("No tier: it shows as a plain project until you pick Weekend, Black Swan or NASA.");
      if (!lines.length) lines.push("Nothing tracked would change.");
      const ul = el("ul", "m-checks");
      lines.forEach(x => ul.append(el("li", null, x)));
      box.append(ul);
      prev.append(box);
    });
    pending = cards;
    const acts = el("div", "drawer-actions");
    acts.append(btn("btn primary", cards.length > 1 ? "Apply " + cards.length + " cards" : "Apply", apply, null, "c:apply"),
      btn("btn", "Cancel", () => { pending = null; prev.textContent = ""; cmsg(""); }, null, "c:cancel"));
    prev.append(acts);
    cmsg(cards.length === 1 ? "Check the changes, then tap Apply." : cards.length + " cards found. Check the changes, then tap Apply.");
  }
  async function apply() {
    const db = ctx.getDB();
    if (!db || !pending) return;
    let first = null, n = 0;
    try {
      for (const c of pending) {
        const projects = ctx.getProjects();
        const m = S.matchCard(projects, c);
        let id, raw = null;
        if (m) { id = m.id; const snap = await db.doc("projects/" + id).get(); raw = snap.exists ? snap.data() : null; }
        else id = c.id && !projects.some(p => p.id === c.id) ? c.id : ctx.slug(c.name || "project");
        const doc = S.applyCard(raw, c);
        if (!m) doc.order = ctx.nextOrder();
        await ctx.writeDoc("projects/" + id, () => db.doc("projects/" + id).set(doc));
        n++;
        if (!first && doc.tier) first = id;
      }
    } catch (e) {
      cmsg((n ? "Applied " + plural(n, "card", "cards") + ", then storage refused the rest. " : "Storage refused the card. ") + (e && e.code === "quota_exceeded" ? "The phone's storage for the deck is full." : "Try again."), true);
      return;
    }
    pending = null;
    cardDrawer.querySelector("#c-preview").textContent = "";
    cardDrawer.querySelector("#c-text").value = "";
    cmsg("Applied " + plural(n, "card", "cards") + ".");
    setTimeout(() => { ctx.closeDrawers(); if (first) open(first); }, 450);
  }

  /* ---------- mount ---------- */
  function mount(c) {
    ctx = c;
    drawer = el("aside", "drawer mission");
    drawer.id = "mission-drawer"; drawer.hidden = true;
    drawer.setAttribute("role", "dialog"); drawer.setAttribute("aria-modal", "true"); drawer.setAttribute("aria-labelledby", "m-title");
    const head = el("div", "drawer-head"), t = el("div");
    const eb = el("div", "eyebrow"); eb.id = "m-eyebrow";
    const h = el("h2"); h.id = "m-title";
    t.append(eb, h);
    head.append(t, btn("btn ghost", "Close", () => ctx.closeDrawers(), "Close the mission dashboard", "m:close"));
    body = el("div", "m-body");
    drawer.append(head, body);
    document.body.append(drawer);
    buildCardDrawer();
  }

  window.DeckSEUI = { mount, open, refresh, isOpen, openImport, tierBadge, cardBlock, phaseLine, snapshot };
})();
