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
| `tools/test_iphone.mjs` | Headless test at iPhone sizes |
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
| R13 | Each project is Personal, or Work in Weekend, Black Swan or NASA | Personal or work dropdown in the project form; a Work area dropdown appears only for Work. Stored as `area` (`personal` or `work`) and `category` (`Personal`, `Weekend`, `Black Swan` or `NASA`) |
| R12 | Changes are traceable | Git history in small commits, and `DELETE_LOG.md` |

## Verification

Run on 2026-11-19 with `node tools/test_iphone.mjs <chromium> <backup.json> <out-dir>` (Chromium in iPhone mode with touch, at 390×844 and 430×932; the Claude API was mocked). **50 of 50 checks passed** (25 per size).

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
| Work area dropdown appears only for Work | R13 | Pass |
| Saves Work · NASA and shows it on the card | R13 | Pass |
| Editor reopens on Work · NASA | R13 | Pass |
| Personal hides the work area and saves | R13 | Pass |
| No script errors | R11 | Pass |

**Still to check on the phone itself** (a headless browser can't do these):

- [ ] Add to Home Screen shows the icon and the name Command Deck (R1)
- [ ] Opens full screen, with the status bar over the deck's dark background (R1, R5)
- [ ] Airplane mode: the app still opens with the board (R2)
- [ ] Run briefing speaks after the first tap (R7)
- [ ] Import works from the Files app inside the installed app (R4)

## Updating

Edit the files, bump `VERSION` in `sw.js`, and push. The installed app shows "New version ready" with a Reload button.
