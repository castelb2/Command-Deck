# Command Deck for iPhone

The Bryaninho Command Deck as a Home Screen app for iPhone (a progressive web app). It runs in Safari's engine, opens full screen from its own icon, works offline, and keeps your board on the phone.

The original deck on claude.ai is untouched. This repository holds the app only. Your projects, checklist and log are not in it; you import them on the phone from a backup file.

## Install on your iPhone

1. **Host the folder over HTTPS.** Either:
   - **GitHub Pages:** in this repository, open Settings > Pages, choose "Deploy from a branch", pick `main` and `/ (root)`, and save. The app appears at `https://<your-user>.github.io/Command-Deck/` after a minute or two. GitHub hosts Pages for a private repository only on a paid plan; on a free plan it asks you to upgrade or make the repository public.
   - **Netlify Drop:** drag this folder onto app.netlify.com/drop.
2. **Open that address in Safari** on the iPhone (it has to be Safari).
3. Tap **Share**, then **Add to Home Screen**, then **Add**.
4. **Open Command Deck from the Home Screen icon.** The installed app has its own storage, separate from Safari's, so do step 5 inside the app.
5. Tap **Settings**, then **Import backup**, and pick your `command-deck-backup-….json` file (save it to the Files app first, for example from iCloud Drive or an AirDrop).
6. Optional: in **Settings > AI link**, paste an Anthropic API key to turn on open-ended questions (see below).

For better speech, download an Enhanced voice in iPhone Settings > Accessibility > Spoken Content > Voices, then pick it in the deck's Settings.

## Tiered projects: Weekend, Black Swan, NASA

Any project on the board can run on the Lean Systems Engineering framework: NASA's phases and gates, with Musk's five steps inside each phase. Pick the rigor to match the consequence of failure:

| Type | Scale | Gates | Paperwork |
|---|---|---|---|
| **Weekend** | Small: class project, weekend build | G1 SRR, G4 ORR/FRR | One-page requirements and a test log |
| **Black Swan** | Medium: thesis, student payload | G0–G4, lightweight | Requirements, risk and verification matrices, ICD |
| **NASA** | Large: funded, flight, safety-critical | G0–G4, full, with named external reviewers | Full set: SEMP, ICDs, hazard analysis |

- **Make one.** Edit a project (or Add project), then pick a **Project type**. The card gains a tier badge, its phase, next-gate readiness and a gate track. Tap it to open the mission dashboard.
- **The dashboard.** It shows the phase track (tap a phase to see its checklist; tap a gate to review it), the Musk steps that run in the current phase, alerts the project raises from its own evidence, and the framework's metrics: requirements, % verified, red risks, tightest margin, cycle time and deletion add-back. Tabs hold the checklist, requirements (with the 7-question interrogation and verification method and result), the 5×5 risk register, budgets, interfaces and parts count, the test log, the deletion log and lessons. Weekend projects get the lighter set.
- **Gates.** Readiness is computed from the project itself. Going ahead with unmet checks needs a written waiver, and the card then shows "passed on a waiver". NASA gates need the reviewers' names. A Go moves the project to the next phase.
- **Progress** is computed from the checklists and gates, so tiered projects have no typed progress field.
- **From a Claude project.** In the Claude project, ask for a status card (the `deck-status-card` skill in [`skills/`](skills/deck-status-card/SKILL.md) writes one), copy it, then tap **Import card** on the board and paste. You see a preview, and nothing changes until **Apply**. **Copy card** in a dashboard goes the other way: paste it into the project's Claude chat, ask for an update, and import the result. The format is in [`docs/status-card.md`](docs/status-card.md).

How this feature was built, with its requirements (R13–R23), deletion review and verification, is in [`docs/tiered-projects.md`](docs/tiered-projects.md).

## What works without a key, and what needs one

| Works offline, no key | Needs an Anthropic API key |
|---|---|
| The board: projects, statuses, next steps, deadlines, flags | Open-ended questions ("help me pitch my PhD idea") |
| Run briefing and project briefs, spoken aloud | Edits phrased freely that the offline parser doesn't understand |
| Daily and weekly checklist, daily log notes | |
| Ask: deadlines, what needs attention, flags, a project by name, the checklist, the log | |
| Simple edits by text: "add X to my daily routine", "mark the payload as watch", "next step for X is Y", "check off X" | |
| Backup export and import, erase | |

### About the API key

- The key is saved only in this app's storage on this phone and is sent only to `api.anthropic.com`. It is never put in a backup file or in this repository.
- The app calls the Claude Messages API directly from the phone, which Anthropic allows with the `anthropic-dangerous-direct-browser-access` header. That is fine for a personal app on your own device. Don't host a copy with a key built in.
- Usage is billed to the account that owns the key. Pick the model in Settings: Claude Opus 5.5 (default), Sonnet 5.5 or Haiku 5.5.
- **Remove key** deletes it from the phone.

## What did not carry over from claude.ai

- **The nightly auto-written log entry and the scheduled updates from Claude.** Those ran inside claude.ai and still update the claude.ai deck, not the phone.
- **Sync between the two.** The phone app starts from the backup and then keeps its own copy. To move changes back or forth, export a backup from one and import it into the other.
- **Claude without a key.** On claude.ai the deck used your Claude session. On the phone it needs your own API key, or it answers offline.

## Files

| Path | What it is |
|---|---|
| `index.html` | The deck itself (the claude.ai page, adapted) |
| `js/local-db.js` | On-device database that stands in for the claude.ai artifact database |
| `js/ai.js` | Direct Claude API link (streaming, tool use, key and model settings) |
| `manifest.webmanifest` | App name, colours, icons, full-screen display |
| `sw.js` | Service worker: caches the app and fonts so it opens offline |
| `icons/` | Home Screen and app icons (made by `tools/make_icons.py`) |
| `js/se-model.js` | The Lean SE framework as data: tiers, phases, gates, checklists, metrics, status-card cleaning |
| `js/se-ui.js` | Mission dashboard, card extras and the status-card import drawer |
| `docs/status-card.md` | The status-card format (the interface to Claude projects) |
| `docs/tiered-projects.md` | Build record for tiered projects: requirements, deletions, verification, lessons |
| `skills/deck-status-card/SKILL.md` | The Claude skill that writes status cards |
| `tools/test_iphone.mjs` | Headless test at iPhone sizes |
| `tools/test_tiers.mjs` | Headless test of the tiered dashboards at iPhone sizes |
| `tools/test_se_model.mjs` | Unit checks for the framework model (Node, no browser) |
| `tools/fixtures/sample-backup.json` | Invented projects for the tests (no personal data) |
| `DELETE_LOG.md` | What was removed from the original and why |

## Requirements (Lean Systems Engineering)

**Value, from the owner's point of view:** the deck on the iPhone Home Screen, usable in a few seconds, with or without signal, without giving up the board's data or privacy.

**Waste removed:** no app store, no server to run, no account to create, no build step. One folder of static files.

| ID | Requirement | How it is met |
|---|---|---|
| R1 | Installs to the iPhone Home Screen and opens full screen | Web app manifest (standalone), Apple web-app meta tags, 180 px touch icon |
| R2 | Opens and works with no connection | Service worker caches the app shell and fonts; data lives on the phone |
| R3 | Keeps the board on the phone, private to the owner | localStorage database; no data in the repository; backups are files the owner holds |
| R4 | Moves data in and out | Backup export (share sheet or download) and import (merge) in Settings |
| R5 | Fits iPhone screens with nothing hidden behind the notch or home bar | Safe-area insets, no sideways scroll at 390 and 430 px widths |
| R6 | Comfortable to use by touch | Buttons at least 36 px (most 44 px), 16 px inputs so iOS doesn't zoom |
| R7 | Speaks briefings on iPhone | Speech is unlocked on the first tap, as iOS requires |
| R8 | Ask works offline for questions about the board | On-device answer engine for deadlines, attention, flags, projects, checklist, log, simple edits |
| R9 | Optional Claude link, with the key kept on the phone | Key stored only on the device, masked in Settings, sent only to api.anthropic.com, left out of backups |
| R10 | Claude can change the board when linked | Tool use (update a project, change the checklist), with inputs checked before they run |
| R11 | Runs without script errors in a current iPhone browser | No regex lookbehind; checked headless |
| R12 | Changes are traceable | Git history in small commits, and `DELETE_LOG.md` |

## Verification

Run on 2026-11-19 with `node tools/test_iphone.mjs <chromium> <backup.json> <out-dir>` (Chromium in iPhone mode with touch, at 390×844 and 430×932; the Claude API was mocked). **40 of 40 checks passed** (20 per size).

| Check | Requirement | Result |
|---|---|---|
| Empty board offers import | R4 | Pass |
| Import reports every project | R3, R4 | Pass |
| Every project card shown after import | R3, R4 | Pass |
| Key field is masked | R9 | Pass |
| No sideways page scroll | R5 | Pass |
| Inputs at 16 px or more | R6 | Pass |
| Buttons 36 px or taller | R6 | Pass |
| Offline answer about deadlines | R8 | Pass |
| Offline "what needs my attention" | R8 | Pass |
| Offline "add to my daily routine" | R8 | Pass |
| Key saved and shown masked | R9 | Pass |
| Claude tool call changed the board | R10 | Pass |
| API headers (key, version, direct-browser access) | R9 | Pass |
| API body (model, streaming, system prompt, two tools) | R9, R10 | Pass |
| Thinking and tool calls echoed back correctly | R10 | Pass |
| Backup file leaves the key out | R3, R9 | Pass |
| Service worker controls the page | R2 | Pass |
| Reopens offline with the data | R2, R3 | Pass |
| Manifest is standalone, named Command Deck | R1 | Pass |
| No script errors | R11 | Pass |

**Still to check on the phone itself** (a headless browser can't do these):

- [ ] Add to Home Screen shows the icon and the name Command Deck (R1)
- [ ] Opens full screen, with the status bar over the deck's dark background (R1, R5)
- [ ] Airplane mode: the app still opens with the board (R2)
- [ ] Run briefing speaks after the first tap (R7)
- [ ] Import works from the Files app inside the installed app (R4)

**Tiered projects, 2026-11-19:** 40 of 40 model checks, 78 of 78 tier checks at both sizes, and the 40 checks above again (`node tools/test_iphone.mjs <chrome> tools/fixtures/sample-backup.json <out-dir>`). The details are in [`docs/tiered-projects.md`](docs/tiered-projects.md#phase-4--verification-prove). Playwright: `npm i playwright-core` (or link it into `node_modules/`, which git ignores).

## Updating

Edit the files, bump `VERSION` in `sw.js`, and push. The installed app shows "New version ready" with a Reload button.
