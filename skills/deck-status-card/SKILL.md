---
name: deck-status-card
description: Write a Command Deck status card (JSON) for the current project, so its Weekend, Black Swan or NASA dashboard in the Command Deck can be updated by pasting. Use when asked for a status card, a deck update, or to sync or track this project in the Command Deck.
---

# Command Deck status card

The Command Deck is the owner's phone dashboard. Projects in it can run on his Lean Systems Engineering framework: NASA's six phases and five gates, with Musk's five steps (question requirements, delete, simplify, speed up, automate, in that order) inside every phase. A status card is one JSON object that he copies from this chat and pastes into the deck with **Import card**. The deck previews the changes before applying them.

## Steps

1. **Gather the evidence.** Read this project's files, instructions and conversation. If he pasted an earlier card (the deck's **Copy card** makes one, with an `id`), start from it, keep its `id`, and change only what has changed since.
2. **Pick the tier**, or ask once if it isn't clear. Rigor scales with the consequence of failure, not with ambition:
   - `weekend`: small. A class project or weekend build. Gates G1 and G4 only. One-page requirements and a test log.
   - `blackswan`: medium. A thesis or student payload. All five gates, lightweight (one hour, a few slides). Requirements, risk and verification matrices, and an ICD.
   - `nasa`: large. Funded, flight or safety-critical. All five gates as full reviews with external reviewers. Full set: SEMP, ICDs, hazard analysis.
3. **Fill only what the evidence supports.** Never invent requirements, owners, risks, budgets, test results or gate decisions.
   - Leave a field out when you don't know it. The deck keeps its current value for any field that's missing.
   - A list you include (requirements, risks, tests…) **replaces** the deck's whole list. Include every item or leave the list out.
   - Mark a gate `"pass"` only if he says the review happened, and include who reviewed it for NASA-tier projects.
   - Tick an interrogation question only if it was actually answered for that requirement.
   - Put a checklist ID in `checklistDone` only when the work is visibly done.
   - Record deletions (requirements, parts, processes, documents, meetings that were cut) in `deletions`, with the reason. They are the evidence for Musk step 2.
4. **Output** one ```` ```json ```` block with the card, then one line: "Copy this, then in the Command Deck tap **Import card** and paste." Don't add anything else. If something important was missing, say what in one sentence before the block (for example, "No owners are named for the requirements yet").

## Card format (version 1)

```json
{
  "deck": "status-card", "v": 1,
  "id": "keep it if the pasted card had one; otherwise leave it out",
  "name": "Project name", "tier": "weekend | blackswan | nasa",
  "status": "active | watch | planning | parked | done",
  "category": "Research", "org": "Lab or team",
  "mission": "One paragraph: why the project exists",
  "next": "The very next concrete step", "due": "YYYY-MM-DD",
  "flags": ["Things that need attention"],
  "phase": 0,
  "criteria": [{ "id": "SC1", "text": "Measurable success criterion", "met": false }],
  "checklistDone": ["P0.mission"],
  "gates": { "G1": { "status": "pass | nogo | pending", "date": "YYYY-MM-DD", "note": "", "reviewers": "" } },
  "requirements": [{ "id": "R-001", "text": "The system shall …", "owner": "a named person", "origin": "physics | regulation | stakeholder | habit", "parent": "SC1", "method": "T | A | I | D", "rationale": "", "interrogation": [true, true, true, true, true, true, true], "result": "" }],
  "risks": [{ "id": "RK-01", "title": "If … then …", "likelihood": 3, "consequence": 4, "mitigation": "", "owner": "", "status": "open" }],
  "budgets": [{ "name": "Mass", "unit": "kg", "limit": 2.0, "current": 1.6, "target": 20 }],
  "interfaces": [{ "from": "Flight computer", "to": "Valve driver", "what": "PWM, 5 V" }],
  "tests": [{ "date": "YYYY-MM-DD", "what": "Bench thrust test", "result": "pass | fail | data", "cycleDays": 4 }],
  "deletions": [{ "date": "YYYY-MM-DD", "item": "Separate attitude sensor board", "kind": "requirement | part | process | document | meeting | other", "reason": "Flight computer IMU suffices", "addedBack": false }],
  "lessons": [{ "date": "YYYY-MM-DD", "text": "" }],
  "parts": 42, "variants": 6
}
```

- **Phases:** 0 Mission Definition (WHY), 1 Requirements & Architecture (WHAT), 2 Preliminary Design (HOW), 3 Detailed Design & Build (BUILD), 4 Verification & Validation (PROVE), 5 Operations & Closeout (LEARN).
- **Gates:** G0 Mission Concept Review (after phase 0), G1 System Requirements Review (after 1), G2 Preliminary Design Review (after 2), G3 Critical Design / Test Readiness Review (after 3), G4 Operational / Flight Readiness Review (after 4).
- **Verification methods:** T Test, A Analysis, I Inspection, D Demonstration.
- **Interrogation questions, in order:** owner (a person, not a department), origin, which success criterion it traces to, is the number justified, what happens if relaxed 2×, how it will be proven, was it questioned even if an expert wrote it.
- **Risk scores** are likelihood × consequence, each 1–5. 15 or more is red.

## Checklist IDs

The letters after each ID are the tiers it applies to: W Weekend, B Black Swan, N NASA. Use only the IDs for the project's tier.

- **P0 Mission Definition**
  - `P0.mission` [WBN] Write a one-paragraph mission statement
  - `P0.criteria` [BN] Set 3–5 measurable success criteria
  - `P0.criteria-w` [W] Set 1–3 measurable success criteria
  - `P0.stakeholders` [BN] List the stakeholders and their real needs
  - `P0.conops` [BN] Sketch the ConOps: how it will be used, start to finish
  - `P0.owners` [WBN] For each need, ask who says so and what happens if it's ignored. Strike needs nobody owns
  - `P0.worth` [W] Decide it's worth the weekend (go or no-go)
  - `P0.reviewers` [N] Book external reviewers for the MCR
- **P1 Requirements & Architecture**
  - `P1.list` [W] Write the one-page requirements list, each with an owner and how you'll prove it
  - `P1.shall` [BN] Write requirements in "shall" form with ID, owner, rationale, parent need and verification method
  - `P1.interrogate` [WBN] Run the interrogation checklist on every requirement
  - `P1.delete` [WBN] Delete requirements, subsystems and documents that don't trace to a success criterion. Log each one
  - `P1.alternatives` [BN] Generate 2–3 architecture alternatives
  - `P1.trade` [BN] Trade them with weighted criteria: mass, cost, risk, schedule, performance
  - `P1.risks` [BN] Start the risk register (likelihood × consequence, 5×5)
  - `P1.doors` [BN] Mark one-way-door decisions for analysis and peer review. Decide two-way doors fast
  - `P1.semp` [N] Write the SEMP: how this project will be engineered and reviewed
- **P2 Preliminary Design**
  - `P2.budgets` [BN] Set budgets with 20–30% margin: mass, power, volume, thermal, data, cost
  - `P2.interfaces` [BN] Define the interfaces with ICDs or a simple N² diagram
  - `P2.riskfirst` [WBN] Prototype or analyze the highest-risk items first
  - `P2.parts` [WBN] Parts-count review: for each component, ask what breaks if it's gone
  - `P2.simplify` [WBN] Simplify: combine functions, use COTS, cut interfaces and part variants
  - `P2.hazards` [N] Run the preliminary hazard analysis
- **P3 Detailed Design & Build**
  - `P3.git` [WBN] Put CAD, code and docs under version control (Git)
  - `P3.dfm` [BN] Simplify manufacturing and assembly: fewer fasteners, fewer tools
  - `P3.loops` [WBN] Run design → build → test loops in days, not months, and log each loop's cycle time
  - `P3.build` [WBN] Build the hardware or software
  - `P3.release` [BN] Release the design and write the test procedures
  - `P3.config` [N] Put released designs under formal configuration control
- **P4 Verification & Validation**
  - `P4.tests` [W] Test every requirement on the list and log the results
  - `P4.matrix` [BN] Fill the verification matrix: every requirement → method → result → pass/fail
  - `P4.fly` [WBN] Test like you fly, fly like you test
  - `P4.validate` [BN] Validate against the mission need, not just the requirements
  - `P4.automate` [WBN] Automate now, and only now: test scripts, data pipelines, CI, automated checklists
  - `P4.report` [BN] Write the V&V report
- **P5 Operations & Closeout**
  - `P5.operate` [WBN] Operate and collect data
  - `P5.compare` [WBN] Compare the results against the success criteria
  - `P5.lessons` [WBN] Capture lessons: what to delete next time, which requirements were dumb, which gates added value
  - `P5.template` [BN] Feed the lessons into the template for the next project
  - `P5.archive` [N] Archive the data and close out formally
