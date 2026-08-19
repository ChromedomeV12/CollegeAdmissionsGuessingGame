# Changelog

All notable changes to this project. Dates are YYYY-MM-DD.

## 2026-08-19 — Scoring & ranking redesign (0–100, skill-based)

- **Normalized per-case scoring (0–100, never negative).** New pure `public/scoring.js` (`window.SCORING`): school selection = 70 × Jaccard overlap with the admits in view; University tier = distance credit (15/9/5/0); LAC tier = same ladder with the "No LAC Admit" claim folded in (15 correct / 0 wrong). `scoreFor` in `phase4-results.jsx` now composes these; per-school rows remain for display but carry no −2/−5.
- **Skill-based ranking.** `ranks.js` ladder re-thresholded on the average scale (Oracle at ≥90). The app header and leaderboard now show **average** (`avg`) + case count + best, not raw sum.
- **Backend.** `/api/scores` validates 0–100; `/api/leaderboard` returns `{username, games, avg, best}` ordered by `avg` with a `LEADERBOARD_MIN_GAMES = 5` floor; `SCORING_VERSION = "2"` meta migration wipes incompatible legacy scores once on startup.
- **Tests.** 12 new `test/scoring.test.js` unit tests (Jaccard, tier distance, case-score composition, no-LAC branches); e2e now plays 5 distinct cases and asserts the new leaderboard shape.

### Tokyo Night/Day visual system

- Added exact Tokyo Night/Tokyo Day CSS anchor palettes with a persistent signed-in theme toggle (`ao_theme`). Intermediate surfaces/borders derive from those anchors via `color-mix()`; unrelated cobalt/paper/vermilion literals were removed.
- Refined matte-glass surfaces (cards, topbars, metrics, badges, callouts) to retain stronger Tokyo surface identity: 12px blur, increased surface opacity, and light/dark-aware token shadows.
- Added Tailwind Play CDN with preflight disabled; semantic CSS stays authoritative. The initially-added three.js constellation was removed after visual review — the final backdrop is static (subtle Tokyo grid + blue→magenta→cyan line), with attention redirected to card/button/tab/tier/school microinteractions and reduced-motion-safe transitions.
- Added e2e coverage for theme toggle persistence; manual browser verification covers every exact palette anchor, derived surfaces, glass blur, transitions, no canvas/three.js, and both themes.
- Reddit fallback research confirmed HTTP 403 public-JSON blocking on both `www.reddit.com` and `old.reddit.com`; personal cookie export is explicitly prohibited in project guidance.

## 2026-08-18 — Consent-first content import (Mason's-Code) + review fixes

### Ownership-verified import (dual mode)
- **Consent-first submission center** (`public/submission.jsx`, `reddit_submissions` table): a signed-in user pastes the URL of a Reddit post they authored, accepts consent, and proves ownership before any content is stored.
- **OAuth mode** (Reddit app credentials configured): temporary OAuth flow with `identity`/`read` scopes; server compares the Reddit identity with the post author.
- **Edit-code fallback mode** (no credentials — Reddit app registration rejected): server issues a one-time `ORACLE-XXXXXX` code; the user edits the post to include it and confirms; the server re-fetches via the public `.json` endpoint and verifies. New endpoint `POST /api/submissions/:id/confirm-fallback`.
- **Resubmission retry** (bug fix): a post in a terminal/unverified state (expired/cancelled/failed/withdrawn) can be re-submitted by its original owner with a fresh code instead of a permanent 409.
- **Export pipeline** (integration fix): `npm run export-verified` moves `verified_pending_review` records into `data/queue.jsonl` as consent drafts; `npm run approve` publishes them (LLM structuring when `OPENROUTER_API_KEY` is set, defensively-rendered scaffold otherwise).
- **Hardening**: OAuth callback wrapped in a full-body try/catch (Express 4 async crash window) with JSON errors; rate-limit map cleanup; idempotent DB migration for fallback columns; privacy fix — `/api/profiles/:id` strips `source` (subreddit/post ID) from players.

### Frontend redesign (v2)
- Full `styles-v2.css` design rewrite (premium-gold accent, oklch tokens, WCAG AA contrast, focus rings, reduced-motion support); legacy 907-line `<style>` block deleted with load-bearing rules ported.
- submission.jsx: mode banner, fallback flow UI, perpetual-spinner bugfix; menu cards get `data-card-num` watermark instead of duplicating aria-label.

### Tests & docs
- 8 new mocked unit tests (fallback fetch, edit-code verification, ownership-mismatch regression, http-scheme rejection); e2e drives the fallback flow and asserts local proof-code issuance with zero Reddit network calls; `test/design-contrast.test.js` asserts the 21 documented contrast pairs.
- AGENTS.md, README, docs/CONSENT_IMPORT.md, docs/DESIGN_SYSTEM.md, `.env.example` updated for the dual-mode pipeline.

## 2026-08-17 — Repo-wide revamp & verification pass

### Backend (`server.js`)
- **Removed legacy non-API routes.** `/register`, `/login`, `/me`, `/profiles`, `/profiles/:id` are gone; only `/api/*` mounts remain (same handlers). The SPA fallback no longer masks API paths.
- **404 JSON for unknown API paths.** `app.use("/api", …)` before the catch-all returns `{"error":"Not found"}` instead of `index.html`.
- **Hardened input validation.** Register: username `^[a-zA-Z0-9_]{3,20}$`, password 8–72 chars. Scores: `profile_id` non-empty string ≤64 chars, `score` integer in [−100, 100]. All violations return 400 JSON.
- **`JWT_SECRET` warning.** Startup `console.warn` when unset (dev fallback still works).

### Frontend (`public/`)
- **Deleted `data.js`** — stale, divergent inline copy of the profiles (drifted from `data/profiles.jsonl`). Removed the dead `window.PROFILES` fallback in `app.jsx`; the only data path is `GET /api/profiles`.
- **Defensive-rendering hardening** in `phase1-profile.jsx`, `phase2-tier.jsx`, `phase4-results.jsx`: optional chaining / nullish defaults for demographics, GPA, course rigor, `game_metadata`, and `application_results.final_decision` (the latter two were crash risks on records missing those keys). `phase3-school.jsx`, `auth.jsx`, `tiers.js`, `ranks.js`, `ui-primitives.jsx` audited — already safe.
- Confirmed topbar `Menu` button returns to the profile list from every phase.

### Scripts & tooling
- **`e2e_test.cjs` created** (it was documented but never existed): self-contained Puppeteer harness — spawns the server on a free port, registers a unique user, drives all 4 game phases, asserts leaderboard persistence. Run via `npm test`.
- **`scripts/scrape.js` robustness:** Reddit fetch failures now report URL + HTTP status + body snippet (HTML block pages no longer crash with a bare `SyntaxError`); OpenRouter errors log a bounded body snippet.
- **`.env.example` added** documenting `PORT`, `JWT_SECRET`, `OPENROUTER_API_KEY` and their consumers.
- Deleted stale one-offs: `public/fix_data.js` (maintained the deleted `data.js`), `CHANGELOG.pdf` (print-to-PDF of a lost `CHANGELOG.md`, replaced by this file).
- Dev dependency added: `@babel/parser` (headless JSX syntax gate).

### Docs
- README and AGENTS.md rewritten to match the tree (see 2026-05 below for prior history).

## 2026-05-13 — Public release prep (prior agent session)

- README.md authored; AGENTS.md created for future AI sessions.
- First push to GitHub (`ChromedomeV12/CollegeAdmissionsGuessingGame`).

## 2026-05 — Merge frontend UI and scoring with backend database and auth

- Express + SQLite (`better-sqlite3`, WAL) backend: `users`, `scores` tables.
- JWT auth (bcryptjs hashing), leaderboard and stats endpoints.
- React SPA served statically, compiled in-browser via `@babel/standalone`.
- Scoring model finalized: +10 correct school, −2 wrong school (tier band hit only), +10 per correct tier band, −5 wrong band, No-LAC claim +10/−5 with waiver.
- LLM scraping pipeline: Reddit `.json` → OpenRouter extraction → queue → interactive approval.
