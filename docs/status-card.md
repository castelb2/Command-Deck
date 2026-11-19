# Status card: the interface between Claude projects and the Command Deck

A status card is one JSON object that describes a project's Lean Systems Engineering state. A Claude project writes it (the `deck-status-card` skill does this), you paste it into the deck with **Import card**, and the deck shows a preview before anything changes. **Copy card** in a project's dashboard produces the same format, so a card can go back into the Claude chat, get updated there and come back.

This document is the interface control document for that hand-off. `js/se-model.js` (`parseCards`, `cleanCard`, `applyCard`, `toCard`) implements it.

## How a card is read

- **Where the JSON can sit.** Bare JSON, a ```` ```json ```` block, or JSON inside other text all work. An array of cards, or `{ "cards": [...] }`, imports several at once (up to 50).
- **What it's matched to.** First the `id`, if it matches a project in the deck. Otherwise the `name`, matched exactly but ignoring case. If neither matches, the card creates a new project.
- **Partial updates.** Only fields present in the card change. A field left out leaves the deck's value alone. A list that is present (requirements, risks and so on) **replaces** the deck's whole list, so send the full list or leave it out.
- **Cleaning.** Unknown fields are dropped. Enums fall back to a safe default, dates must be real `YYYY-MM-DD` dates, numbers are clamped to their range, text is trimmed and length-capped, and lists are capped (see Limits). Text is always shown as text, never as HTML.
- **Nothing changes before Apply.** The preview lists what each card would change.

## Fields

| Field | Type | Notes |
|---|---|---|
| `deck` | `"status-card"` | Marks the object as a card. Optional if `name` is present |
| `v` | `1` | Format version |
| `id` | string | The deck's project id (`a-z`, `0-9`, `-`). Copy card fills it in. Leave it out for a new project |
| `name` | string ≤ 80 | Required if there's no `id` |
| `tier` | `"weekend"` \| `"blackswan"` \| `"nasa"` \| `null` | `"Black Swan"` and `"black_swan"` are accepted. `null` makes it a plain project |
| `status` | `"active"` \| `"watch"` \| `"planning"` \| `"parked"` \| `"done"` | |
| `category`, `org` | string ≤ 30, ≤ 90 | Card header and "where / with whom" |
| `mission` | string ≤ 320 | The one-paragraph mission statement |
| `next` | string ≤ 220 | Next action |
| `due` | `YYYY-MM-DD` or `null` | |
| `flags` | string[] ≤ 20 | The owner's own flags. The deck adds its computed alerts separately |
| `phase` | 0–5 | 0 Mission, 1 Requirements & Architecture, 2 Preliminary Design, 3 Detailed Design & Build, 4 V&V, 5 Operations & Closeout |
| `criteria` | `{ id?, text, met }[]` ≤ 10 | Success criteria. IDs are `SC1`, `SC2`… and are kept when present |
| `checklistDone` | string[] | IDs of finished checklist items (table below). Replaces the done set |
| `gates` | `{ G0..G4: { status, date, note, reviewers } }` | `status`: `"pass"` (or `"go"`), `"nogo"` (or `"no-go"`), `"pending"` |
| `requirements` | object[] ≤ 300 | `{ id, text, owner, origin, parent, method, rationale, interrogation, result }` |
| `risks` | object[] ≤ 100 | `{ id, title, likelihood 1–5, consequence 1–5, mitigation, owner, status: "open" \| "closed" }` |
| `budgets` | object[] ≤ 30 | `{ name, unit, limit, current, target }`. `target` is the margin target in %, default 20 |
| `interfaces` | object[] ≤ 100 | `{ from, to, what }` |
| `tests` | object[] ≤ 300 | `{ date, what, result: "pass" \| "fail" \| "data", cycleDays }` |
| `deletions` | object[] ≤ 300 | `{ date, item, kind, function, breaks, decision: "delete" \| "merge", reason, addedBack }`. `kind`: requirement, part, process, document, meeting, other |
| `lessons` | `{ date, text }[]` ≤ 100 | Plain strings are accepted too |
| `parts`, `variants` | integer | Parts count and part-variant count |

**Requirement fields.** `origin`: `physics`, `regulation`, `stakeholder` or `habit`. `parent`: a success-criterion ID such as `SC1`. `method`: `T` (Test), `A` (Analysis), `I` (Inspection) or `D` (Demonstration), or the full word. `result`: `""`, `"pass"` or `"fail"`. `interrogation`: seven booleans, one per question of the interrogation checklist (owner, origin, need, number, consequence, verifiable, experts questioned), or `"interrogated": true` for all seven.

**Gate decisions.** A card may record a gate as passed only if the review actually happened. The deck still shows its own readiness checks, and flags a gate passed with unmet checks as "passed on a waiver" when it's decided in the deck.

## Tiers

| Tier | Scale | Gates | Documentation |
|---|---|---|---|
| `weekend` | Small: class project, weekend build | G1 SRR, G4 ORR/FRR | One-page requirements and a test log |
| `blackswan` | Medium: thesis, student payload | G0–G4, lightweight (one hour, a few slides) | Requirements, risk and verification matrices, and an ICD |
| `nasa` | Large: funded, flight, safety-critical | G0–G4, full reviews with external reviewers (named reviewers required) | Full NASA-style set: SEMP, ICDs, hazard analysis |

## Checklist IDs

W = Weekend, B = Black Swan, N = NASA. An ID for another tier is kept but doesn't count toward that project's progress.

| ID | Phase | Tiers | Item |
|---|---|---|---|
| `P0.mission` | P0 | W B N | Write a one-paragraph mission statement |
| `P0.criteria` | P0 | B N | Set 3–5 measurable success criteria |
| `P0.criteria-w` | P0 | W | Set 1–3 measurable success criteria |
| `P0.stakeholders` | P0 | B N | List the stakeholders and their real needs |
| `P0.conops` | P0 | B N | Sketch the ConOps: how it will be used, start to finish |
| `P0.owners` | P0 | W B N | For each need, ask who says so and what happens if it's ignored. Strike needs nobody owns (Musk step 1) |
| `P0.worth` | P0 | W | Decide it's worth the weekend (go or no-go) |
| `P0.reviewers` | P0 | N | Book external reviewers for the MCR |
| `P1.list` | P1 | W | Write the one-page requirements list, each with an owner and how you'll prove it |
| `P1.shall` | P1 | B N | Write requirements in "shall" form with ID, owner, rationale, parent need and verification method |
| `P1.interrogate` | P1 | W B N | Run the interrogation checklist on every requirement (Musk step 1) |
| `P1.delete` | P1 | W B N | Delete requirements, subsystems and documents that don't trace to a success criterion. Log each one (Musk step 2) |
| `P1.alternatives` | P1 | B N | Generate 2–3 architecture alternatives |
| `P1.trade` | P1 | B N | Trade them with weighted criteria: mass, cost, risk, schedule, performance |
| `P1.risks` | P1 | B N | Start the risk register (likelihood × consequence, 5×5) |
| `P1.doors` | P1 | B N | Mark one-way-door decisions for analysis and peer review. Decide two-way doors fast |
| `P1.semp` | P1 | N | Write the SEMP: how this project will be engineered and reviewed |
| `P2.budgets` | P2 | B N | Set budgets with 20–30% margin: mass, power, volume, thermal, data, cost |
| `P2.interfaces` | P2 | B N | Define the interfaces with ICDs or a simple N² diagram |
| `P2.riskfirst` | P2 | W B N | Prototype or analyze the highest-risk items first |
| `P2.parts` | P2 | W B N | Parts-count review: for each component, ask what breaks if it's gone (Musk step 2) |
| `P2.simplify` | P2 | W B N | Simplify: combine functions, use COTS, cut interfaces and part variants (Musk step 3) |
| `P2.hazards` | P2 | N | Run the preliminary hazard analysis |
| `P3.git` | P3 | W B N | Put CAD, code and docs under version control (Git) |
| `P3.dfm` | P3 | B N | Simplify manufacturing and assembly: fewer fasteners, fewer tools (Musk step 3) |
| `P3.loops` | P3 | W B N | Run design → build → test loops in days, not months, and log each loop's cycle time (Musk step 4) |
| `P3.build` | P3 | W B N | Build the hardware or software |
| `P3.release` | P3 | B N | Release the design and write the test procedures |
| `P3.config` | P3 | N | Put released designs under formal configuration control |
| `P4.tests` | P4 | W | Test every requirement on the list and log the results |
| `P4.matrix` | P4 | B N | Fill the verification matrix: every requirement → method → result → pass/fail |
| `P4.fly` | P4 | W B N | Test like you fly, fly like you test |
| `P4.validate` | P4 | B N | Validate against the mission need, not just the requirements |
| `P4.automate` | P4 | W B N | Automate now, and only now: test scripts, data pipelines, CI, automated checklists (Musk step 5) |
| `P4.report` | P4 | B N | Write the V&V report |
| `P5.operate` | P5 | W B N | Operate and collect data |
| `P5.compare` | P5 | W B N | Compare the results against the success criteria |
| `P5.lessons` | P5 | W B N | Capture lessons: what to delete next time, which requirements were dumb, which gates added value |
| `P5.template` | P5 | B N | Feed the lessons into the template for the next project |
| `P5.archive` | P5 | N | Archive the data and close out formally |

## Example

```json
{
  "deck": "status-card",
  "v": 1,
  "name": "Cold-gas thruster test stand",
  "tier": "blackswan",
  "status": "active",
  "mission": "Measure the thrust of a COTS CO2 cold-gas valve to within 5% so a capsule controller can be sized from data.",
  "next": "Calibrate the load cell",
  "phase": 2,
  "criteria": [
    { "id": "SC1", "text": "Thrust measured within ±5% of a reference weight", "met": false }
  ],
  "checklistDone": ["P0.mission", "P0.criteria", "P1.shall", "P1.interrogate", "P1.delete"],
  "gates": { "G0": { "status": "pass", "date": "2026-10-02" }, "G1": { "status": "pass", "date": "2026-10-20" } },
  "requirements": [
    { "id": "R-001", "text": "The stand shall measure thrust from 0 to 5 N within ±5%", "owner": "Alex", "origin": "stakeholder", "parent": "SC1", "method": "T", "interrogated": true, "result": "" }
  ],
  "risks": [
    { "id": "RK-01", "title": "If the load cell drifts with temperature, then thrust error exceeds 5%", "likelihood": 4, "consequence": 4, "mitigation": "Thermal soak before each run", "owner": "Alex", "status": "open" }
  ],
  "deletions": [
    { "date": "2026-10-15", "item": "Second sensor board", "kind": "part", "reason": "DAQ has spare channels", "addedBack": false }
  ]
}
```

## Limits

Criteria 10 · requirements 300 · risks 100 · budgets 30 · interfaces 100 · tests 300 · deletions 300 · lessons 100 · flags 20 · cards per paste 50.

## Changes to this interface

| Version | Date | Change |
|---|---|---|
| 1 | 2026-11-19 | First version |
