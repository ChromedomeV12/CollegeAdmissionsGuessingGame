# Changelog

All notable changes to this project. Dates are YYYY-MM-DD.

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
