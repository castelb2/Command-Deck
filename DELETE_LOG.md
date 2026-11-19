# Delete log

What was removed from the Command Deck when it was turned into an iPhone app, and why. The baseline commit (`Baseline: Command Deck exactly as published on claude.ai`) holds the original, so anything here can be recovered from git. The claude.ai artifact itself was not changed.

| Date | What was removed | Where | Why | Replaced by |
|---|---|---|---|---|
| 2026-11-19 | The claude.ai page skeleton (head and its light-theme `:root` style) | `index.html` head | claude.ai adds this when it publishes; a standalone app needs its own head | A full head with charset, viewport-fit=cover, CSP, theme colour, Apple web-app tags, manifest and icons |
| 2026-11-19 | The `claude:viewport-fit-sides` meta tag | `index.html` head | Only claude.ai reads it | `viewport-fit=cover` and safe-area insets |
| 2026-11-19 | `window.claude.use("db")`, `use("sample")` and `use("user")`, and `canWrite` taken from `user.can` | `index.html` script | These are claude.ai runtime capabilities that don't exist outside claude.ai | `js/local-db.js` (DeckDB) and `js/ai.js` (DeckAI); the owner can always write on their own phone |
| 2026-11-19 | `samplePromise` and `sampleChecked` | `index.html` script | Only needed to wait for the claude.ai sampler | `DeckAI.sampler()`, checked each time Ask runs |
| 2026-11-19 | `modelTier: "quick"` and `cache: false` options on the AI call | `index.html` `ask()` | claude.ai-only options; the API takes a model id instead | Model picked in Settings (default Claude Opus 5.5), effort set to low |
| 2026-11-19 | The house rules sent as the first user message | `index.html` `ask()` | The direct API takes them as a system prompt | `system` parameter built by `rules()` |
| 2026-11-19 | The `session_expired` error message and the "sign in to claude.ai" messages | `index.html` script | There is no claude.ai session on the phone | Messages for a bad key, billing, offline and overloaded |
| 2026-11-19 | The "New entry nightly · 11:59 PM" label and the nightly-auto-entry wording in the empty log | `index.html` | The nightly entry is written by a claude.ai routine that can't reach the phone | "Saved on this phone" |
| 2026-11-19 | Regex lookbehind in the sentence splitter for speech | `index.html` `sayPush` | Older iPhone Safari versions throw on lookbehind | A split on a placeholder character |
| 2026-11-19 | The "Voice settings" button and drawer title | `index.html` | The drawer now holds the AI link and data tools too | "Settings", with the eyebrow "Assistant · AI link · Data" |
| 2026-11-19 | The path that disabled Ask when no sampler was available (`disableAsk` is now unused) | `index.html` script | Ask now always works, offline when there's no key | Offline answer engine |
