# Admissions Oracle - Agent Instructions

## Architecture & Data Flow
- **Frontend (`public/`)**: React SPA compiled in-browser via `@babel/standalone`; no build step. Signed-in users land on Home, then enter Profile → Tier → Schools → Reveal. `styles-v2.css` is authoritative semantic CSS; Tailwind Play CDN has preflight disabled. `ambient-waves.js` renders a full-viewport Three.js sculpted-fold wallpaper with a broad filled-SVG fallback.
- **Backend (`server.js`)**: Express serves `public/` and one `/api/*` mount. There are no legacy non-API routes. Unknown `/api/*` paths return `404 {"error":"Not found"}`.
- **Hybrid Storage**:
  - **Static Content (`data/profiles.jsonl`)**: read-only to the server, reloaded on each `/api/profiles` request, and the only profile source. List responses strip outcomes/source; `/api/profiles/:id` returns the full public case only after the client locks predictions or opens permanent practice.
  - **Dynamic State (`data/game.db`)**: SQLite (`better-sqlite3`, WAL) storing accounts, per-profile best scores, permanent practice locks, rivals, consent receipts, and private Reddit submission records.
- **Game API**: auth/profile/score/stats routes plus `/api/locks`, `/api/rivals`, `/api/duel/:username`, and the seasonless global `/api/leaderboard`. Submission routes are maintainer-only and disabled unless `SUBMISSIONS_ENABLED=true`; `/api/submissions/config` remains readable to authenticated callers and reports the flag.

## Development Commands
- **Run Server**: `npm run dev` (Express via `node --watch`).
- **Run Tests**: `npm test` runs `npm run test:unit` (`node --test test/*.test.js`) then `npm run test:e2e` (`node e2e_test.cjs`, the Puppeteer harness). `.cjs` because `package.json` is `"type": "module"`. **No manual setup** — the e2e harness picks a free port and spawns `server.js` itself.
- **Export verified drafts**: `npm run export-verified` (see pipeline below — connects verified consent submissions to the game draft queue).
- **Approve**: `npm run approve` (see pipeline below).

## Consent-import pipeline
*IMPORTANT: bulk subreddit scraping and arbitrary URL scraping are disabled. Consent import is a maintainer-only tool, not player-facing functionality, and is disabled by default.*
1. **Enable deliberately**: only a maintainer environment sets `SUBMISSIONS_ENABLED=true`. Normal game deployments keep it false; guarded submission routes return HTTP 503 when disabled.
2. **Submit**: an authenticated maintainer records one Reddit post URL from its author plus versioned consent (`POST /api/submissions`, auth + rate-limited).
3. **Verify ownership** — selected by config:
   - **OAuth**: temporary `identity read`; compare `/api/v1/me` with the post author; never store tokens.
   - **Edit-code fallback**: issue `ORACLE-[A-Z0-9]{6}`, then `POST /api/submissions/:id/confirm-fallback` fetches that post and checks the code. A miss is retryable; expiry becomes `verification_expired`. Public Reddit JSON currently returns HTTP 403 from this environment, so this path is best-effort. Never copy personal browser cookies or automate a personal Reddit profile to bypass it.
4. **Export**: `npm run export-verified` appends `verified_pending_review` rows to `data/queue.jsonl` as consent drafts and marks them `exported_pending_approval`. Supports `--dry-run`, `--all`, and `--db <path>`.
5. **Approve**: `npm run approve` performs human review and writes approved records to `data/profiles.jsonl`; OpenRouter structuring is optional. No verified submission auto-publishes.
6. **Withdraw**: `DELETE /api/submissions/:id` purges pending post content and ownership proof fields.

## Code Conventions & Gotchas
- **Defensive UI Rendering**: When modifying `public/phase*.jsx` components, **ALWAYS use optional chaining (`?.`)** and fallback defaults (`|| {}`, `|| []`) when accessing profile data (e.g., `test_scores`, `academic_profile`, `extracurriculars`). The LLM scraper is imperfect; missing data must render empty states, not crash the React tree. Hardening is already applied to `phase1-profile.jsx`, `phase2-tier.jsx`, `phase4-results.jsx`.
- **Theme System**: Tokyo Night/Day anchors live only in `public/styles-v2.css`; the toggle in `app.jsx` persists `ao_theme`. Use existing tokens and derive surfaces via `color-mix()`. Ambient WebGL is limited to broad procedural folds: no particles/spinning/noise flicker. Motion is a very slow ≥45s breathing cycle plus clamped scroll/pointer parallax, capped at ~30fps and paused when hidden. Fallback must remain full-viewport and visually coherent when Three/CDN/WebGL fails. All layers are pointer-events-none, below `#root`, and static under `prefers-reduced-motion`.
- **Scoring Logic (`public/scoring.js` + `phase4-results.jsx`)**: every case scores 0–100, never negative.
  - School selection: up to **70** — rounded Jaccard overlap `70 × |selected ∩ admitted| / |selected ∪ admitted|` over only visible schools.
  - University tier: up to **15** — distance credit (15/9/5/0). The explicit no-T50-University claim scores 15 only when the profile has no configured top-50 university admit.
  - LAC tier: up to **15** — the same ladder. The explicit no-T20-LAC claim scores 15 only when correct.
  - First reveal: aggregates only plus a 5-second retry; no tier/school/final-decision disclosure. Retry finalizes the second attempt; timeout finalizes the first. Finalization permanently locks the case to practice, where Correct choices/full answers are visible and no score/retry is allowed.
  - `SCORING_VERSION = "2"`; `/api/scores` validates 0..100 and rejects locked profiles; `/api/leaderboard` returns global `{username, games, avg, best}` with a five-case floor. There are no seasons.
- **API Fetching**: Frontend `fetch` calls in `public/app.jsx` must point explicitly to `/api/*` endpoints (e.g., `/api/scores`, `/api/leaderboard`). A typo here now 404s with JSON instead of silently returning `index.html` — so a wrong path fails loudly rather than feeding the SPA HTML to `.json()` parsing.
- **No inline profiles copy**: `public/data.js` was **removed**. Never reintroduce an inline/bundled profiles copy in the frontend; the only data path is `GET /api/profiles` backed by `data/profiles.jsonl`.
- **e2e test uses the real DB**: `e2e_test.cjs` writes to `data/game.db` and generates a unique username. It verifies Home/theme persistence, five finalized cases, aggregate-only first reveal, one retry, permanent practice/Correct choices, both no-admit claims, rivalry UI, and the seasonless global leaderboard. Never assert global user/score counts; the DB accumulates rows.
