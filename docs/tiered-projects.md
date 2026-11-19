# Tiered project dashboards: build record

How the Weekend, Black Swan and NASA project dashboards were added to the Command Deck, run through the Lean Systems Engineering Framework. The build itself is a **Weekend** (small) project: Gate 1 and Gate 4 only, one-page requirements and a test log.

## Phase 0 · Mission (WHY)

**Mission.** Let the owner track any project in the Command Deck at the rigor its consequences deserve (Weekend, Black Swan or NASA). A glance at the phone should show the phase, the gate readiness and the framework's metrics, and any Claude project should be able to report into it.

**Success criteria**

| ID | Criterion | Measure |
|---|---|---|
| SC1 | Each tier shows only its own gates and artifacts | Weekend shows G1 and G4; Black Swan and NASA show G0 to G4 |
| SC2 | A Claude project's status card goes from a chat into the deck quickly | Paste, preview, apply in under 30 seconds; nothing changes before Apply |
| SC3 | The framework's metrics are on the dashboard | Requirements count, % verified, open top risks, margin, cycle time, deletion add-back |
| SC4 | The deck still works as a phone app | Offline, at 390 and 430 px, and all 40 existing checks still pass |
| SC5 | Gates are decided with evidence | Readiness is computed; passing with unmet checks needs a written waiver; NASA gates need named reviewers |

**Musk step 1 on the needs.** Every need above comes from the owner (Bryaninho) in the request of 2026-11-19 or from the framework document he wrote. One need was struck: real-time sync between devices. Nobody needs it yet, because the phone is the only place the deck is used.

## Phase 1 · Requirements (WHAT)

Owner of every requirement: **Bryaninho** (P1: a named person, not a department). Methods: T = Test, I = Inspection, D = Demonstration, A = Analysis.

| ID | Requirement | Origin | Traces to | Method |
|---|---|---|---|---|
| R13 | Any project shall take a tier: none, Weekend, Black Swan or NASA | Stakeholder | SC1 | T |
| R14 | Each tier shall show only the gates and artifacts in the framework's tailoring table | Framework | SC1 | T |
| R15 | Each phase shall carry a checklist taken from the framework, including the Musk steps that run in that phase | Framework | SC1 | I, T |
| R16 | Gate readiness shall be computed from the project's own evidence. Passing with unmet checks shall need a waiver note, and NASA gates shall need named reviewers | Framework (P4) | SC5 | T |
| R17 | The dashboard shall show requirements count, % verified, open top risks, lowest margin, median cycle time and deletion add-back | Framework (metrics) | SC3 | T |
| R18 | The deck shall import a status card pasted as text (JSON, bare or in a code block), show a preview, and change nothing until Apply | Stakeholder | SC2 | T |
| R19 | Imported cards shall be cleaned: unknown fields dropped, enums and dates checked, text lengths and list sizes capped | Physics of the platform (untrusted text) | SC2, SC4 | T |
| R20 | The deck shall copy a project's status card, so it can be pasted back into its Claude project | Stakeholder | SC2 | T |
| R21 | A tiered project's progress shall be computed from its checklists and gates, not typed | Framework (one source of truth) | SC3 | T |
| R22 | Briefings, offline answers and the Claude link shall report a tiered project's phase, next gate and alerts | Stakeholder | SC1, SC3 | T |
| R23 | Tier data shall live on the phone and in backups like the rest of the board, and the 40 existing checks shall still pass | Existing deck (R2, R3) | SC4 | T |

Every requirement went through the interrogation checklist (owner, origin, need, number, consequence, verifiable, experts questioned). Changes it forced:

- "Real-time sync" was cut. Pasting a card is real-time enough for a single phone.
- "3–5 success criteria" stays for Black Swan and NASA. Weekend projects get 1–3, because a weekend build with five criteria is not a weekend build.
- "Progress %" became computed for tiered projects. A typed number and a checklist would disagree within a week.

## Deletion review (Musk step 2)

| Item | Function it serves | What breaks if deleted? | Decision | Added back? |
|---|---|---|---|---|
| A separate app for tiered projects | Show tiered projects | Nothing; the registry already lists projects | Delete (owner's call) | No |
| A separate "Missions" section | Group tiered projects | Nothing; the tier badge and filter do it | Delete (owner's call) | No |
| GitHub sync with a token on the phone | Move cards in automatically | Nothing today; paste covers it, and the card format is sync-ready | Delete | No |
| A separate verification matrix tab | Requirement → method → result | Nothing; the requirements list already holds method and result | Merge into Requirements | No |
| An N² diagram editor | Show interfaces | Nothing; the framework allows "ICD or a simple N²", so a plain interface list meets it | Delete | No |
| A decisions log for one-way and two-way doors | Two-speed rule | Not one of the six living artifacts | Merge into a phase 1 checklist item | No |
| A hazard analysis module | NASA hazard analysis | Nothing; a NASA phase 2 checklist item plus the risk register cover it | Merge into checklist | No |
| A charting library | Bars and the 5×5 risk grid | Nothing; CSS draws both, offline, with no download | Delete | No |
| AI tools to edit gates and requirements | Voice edits of SE data | Nothing yet; cards and taps cover editing | Delete | No |
| Requirements-count history | "Should fall after SRR, then stabilize" | The trend metric | Keep one number: the count saved when G1 passes | **Yes** (simplified) |

Add-back so far: 1 of 10 (10%), which meets the P3 target of at least 10%.

## Gate 1 · SRR (self-check)

- [x] Mission statement written
- [x] Success criteria set (5)
- [x] Every requirement has an owner, an origin, a parent criterion and a verification method
- [x] Every requirement interrogated
- [x] Deletion review done and logged

## Phases 2–3 · Design and build (HOW, BUILD)

- **Simplify (Musk step 3).** One cleaner, `cleanSE`, reads both stored projects and pasted cards, so there is one definition of valid data. The checklist tables in `docs/status-card.md` and the skill are generated from the model, not typed.
- **Interfaces.** The status card is the only interface between Claude projects and the deck. It is specified in [`status-card.md`](status-card.md).
- **Configuration control.** Git, on the branch `feature/tiered-project-dashboards`, in small commits, with removals recorded in `DELETE_LOG.md`.

## Phase 4 · Verification (PROVE)

Run on 2026-11-19 in headless Chrome 153 in iPhone mode (touch, 390×844 and 430×932):

```
node tools/test_se_model.mjs                                   # 40/40
node tools/test_tiers.mjs <chrome> <out-dir>                   # 78/78 (39 per size)
node tools/test_iphone.mjs <chrome> tools/fixtures/sample-backup.json <out-dir>   # 40/40
```

**Verification matrix**

| Req | Method | How it was checked | Result |
|---|---|---|---|
| R13 | T | Tier filters appear; the editor's project type creates a NASA project that opens its dashboard; plain cards unchanged | Pass |
| R14 | T | Weekend shows G1 and G4 with five tabs and four metrics; Black Swan and NASA show G0–G4 with seven tabs | Pass |
| R15 | I, T | Checklist IDs are unique; every tier has items in every phase; Musk steps sit in the phases the framework puts them; the doc and skill list exactly the model's IDs | Pass |
| R16 | T | Readiness is computed; Go with unmet checks is refused without a waiver and recorded as one with it; NASA needs reviewers; gates ahead can't be decided | Pass |
| R17 | T | Requirements 5, verified 40%, red risks 1, margin 13.3%, cycle 4 d and add-back 33% on the fixture; 5×5 grid places the open risks | Pass |
| R18 | T | A card inside prose and a code block previews an update and a new project; storage is byte-identical until Apply | Pass |
| R19 | T | Unknown fields dropped; phase 7 → 5, likelihood 99 → 5, "Black Swan" → `blackswan`; 400 requirements capped at 300; HTML in a name is shown as text and never runs | Pass |
| R20 | T | Copy card puts a valid card with the project's id on the clipboard; card → import round trip loses nothing | Pass |
| R21 | T | A checklist tick moves progress on the dashboard and the card; the editor hides typed progress for tiered projects | Pass |
| R22 | T | Offline answers and the briefing give the phase and next gate; the Claude link sends a `lean_se` block and the framework rules | Pass |
| R23 | T | Backups carry tier and SE data and leave the API key out; the original 40 checks still pass | Pass |

**Test log**

| Run | Result | Note |
|---|---|---|
| Model checks, first run | 39/39 | |
| Tier checks, first run | 74/78 | Two real findings and one test artifact, below |
| Fix: IDs reused after a deletion | | A new requirement got R-005 right after R-005 was deleted, so the deletion log pointed at the wrong item. `nextId` now treats IDs named in the deletion log as taken. Test added |
| Fix: test harness | | A full-page screenshot switches off touch emulation in this Chrome build, so later buttons measured 35 px instead of 44 px. The screenshot now runs last |
| Tier checks, rerun | 78/78 | |
| Original iPhone checks | 38/40, then 40/40 twice | The two misses were the first check (empty board) firing before the first draw on a busy machine. It passes on reruns; `main` passes too |

**Still to check on the phone itself** (a headless browser can't do these):

- [ ] The installed app shows "New version ready" and picks up v1.1.0 after Reload
- [ ] Copy a card from the Claude iPhone app, then Import card → Paste works inside the installed app
- [ ] Copy card in the installed app puts the card on the iPhone clipboard
- [ ] The dashboard scrolls smoothly and the gate track fits on the smallest phone you use

## Phase 5 · Lessons (LEARN)

- **Never reuse an ID.** It's obvious once the deletion log points at the wrong requirement. Worth carrying into any tracker.
- **Generate tables, don't type them.** The checklist IDs live in one place, and a test fails if the doc or skill drifts.
- **Check the test before blaming the product.** The 35 px buttons were the harness, not the CSS. One probe settled it.
- **Deletions held.** Nothing deleted in Gate 1 had to come back during the build. That 1-in-10 add-back came from Gate 1 itself, so the deletion was about right.

## Gate 4 · ORR (self-check)

- [x] Every requirement verified and passing (R13–R23)
- [x] Original checks still pass
- [ ] Phone-only checks above (owner)
