# Admissions Oracle - Agent Instructions

## Architecture & Data Flow
- **Frontend (`public/`)**: React Single-Page Application compiled in-browser via `@babel/standalone`. No build step (Webpack/Vite).
- **Backend (`server.js`)**: Express server serving static files from `public/` and a single `/api/*` mount. There are **no legacy non-API routes** — every `/register`, `/login`, `/me`, `/profiles` etc. lives under `/api/`.
- **Hybrid Storage**:
  - **Static Content (`data/profiles.jsonl`)**: Read-only to the server. Loaded into memory on startup and reloaded on each `/api/profiles` request. The **single source of truth** for profile data — served to the frontend only via `GET /api/profiles` (and `/api/profiles/:id` for full records).
  - **Dynamic State (`data/game.db`)**: SQLite (`better-sqlite3`, WAL mode) storing user accounts, scores, consent receipts, and private Reddit submission records.
- **API surface**: existing auth/game routes plus `/api/submissions/config`, `/api/submissions`, `/api/submissions/reddit/callback`, and `/api/submissions/:id`. Unknown `/api/*` paths return `404` JSON (`{ "error": "Not found" }`).

## Development Commands
- **Run Server**: `npm run dev` (Express via `node --watch`).
- **Run Tests**: `npm test` runs `npm run test:unit` (`node --test test/*.test.js`) then `npm run test:e2e` (`node e2e_test.cjs`, the Puppeteer harness). `.cjs` because `package.json` is `"type": "module"`. **No manual setup** — the e2e harness picks a free port and spawns `server.js` itself.
- **Export verified drafts**: `npm run export-verified` (see pipeline below — connects verified consent submissions to the game draft queue).
- **Approve**: `npm run approve` (see pipeline below).

## Consent-import pipeline
*IMPORTANT: bulk subreddit scraping and arbitrary URL scraping are disabled. New cases enter only through consent + ownership proof.*
1. **Submit**: a signed-in user submits one Reddit post URL and accepts versioned consent (`POST /api/submissions`, auth + rate-limited).
2. **Verify ownership** — one of two paths, auto-selected by config:
   - **OAuth** (when `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`/`REDDIT_REDIRECT_URI` are set): user completes a temporary `identity read` Reddit grant; `server.js` compares `/api/v1/me` with the post author. Reddit tokens are never stored.
   - **Edit-code fallback** (otherwise): the server issues a local `ORACLE-[A-Z0-9]{6}` receipt code (no Reddit network call) and sets `awaiting_fallback_code`. The user edits the code into their Reddit post, then `POST /api/submissions/:id/confirm-fallback` fetches the post and checks the body for the code. A miss is retryable in place (`failure_reason='edit_code_not_found'`); expiry → `verification_expired`.
   Either path lands verified submissions in `verified_pending_review`. `GET /api/submissions/config` reports `redditOAuthConfigured` and `fallbackEnabled: true`.
3. **Export verified drafts**: `npm run export-verified` reads `verified_pending_review` rows from `data/game.db`, appends each to `data/queue.jsonl` as a `{ draft: true, draftKind: 'reddit-consent', consent, source }` entry, and flips the row to `exported_pending_approval`. Supports `--dry-run`, `--all` (include already-exported rows), and `--db <path>` (test on a temp copy). This is the only writer that connects verified consent submissions to the game.
4. **Approve**: `npm run approve` reviews `data/queue.jsonl`. When `OPENROUTER_API_KEY` is set, each draft is structured into a full `GameRecord` via the LLM (using the draft's consent post body as the source text); without the key, approved drafts are written as defensive `GameRecord` scaffolds with empty fields that render as empty states. Approved records land in `data/profiles.jsonl`. `OPENROUTER_API_KEY` is optional — it only affects LLM structuring during approve, not verification or export.
5. **No auto-publish**: a verified submission never reaches `data/profiles.jsonl` without a human running export + approve.
6. **Withdrawal**: `DELETE /api/submissions/:id` purges pending post content and ownership proof fields.

## Code Conventions & Gotchas
- **Defensive UI Rendering**: When modifying `public/phase*.jsx` components, **ALWAYS use optional chaining (`?.`)** and fallback defaults (`|| {}`, `|| []`) when accessing profile data (e.g., `test_scores`, `academic_profile`, `extracurriculars`). The LLM scraper is imperfect; missing data must render empty states, not crash the React tree. Hardening is already applied to `phase1-profile.jsx`, `phase2-tier.jsx`, `phase4-results.jsx`.
- **Scoring Logic (`public/scoring.js` + `phase4-results.jsx`)**: every case scores 0–100, never negative.
  - School selection: up to **70** — Jaccard overlap `|selected ∩ admitted| / |selected ∪ admitted|` over the visible schools.
  - University tier: up to **15** — distance credit (correct 15, off-by-one 9, off-by-two 5, else 0).
  - LAC tier: up to **15** — same distance ladder; the "No LAC Admit" claim scores the full 15 when correct and 0 when wrong.
  - `SCORING_VERSION = "2"` (see server.js): `/api/scores` validates 0..100; `/api/leaderboard` returns `{username, games, avg, best}` ordered by `avg` with a `LEADERBOARD_MIN_GAMES = 5` floor.
- **API Fetching**: Frontend `fetch` calls in `public/app.jsx` must point explicitly to `/api/*` endpoints (e.g., `/api/scores`, `/api/leaderboard`). A typo here now 404s with JSON instead of silently returning `index.html` — so a wrong path fails loudly rather than feeding the SPA HTML to `.json()` parsing.
- **No inline profiles copy**: `public/data.js` was **removed**. Never reintroduce an inline/bundled profiles copy in the frontend; the only data path is `GET /api/profiles` backed by `data/profiles.jsonl`.
- **e2e test uses the real DB**: `e2e_test.cjs` writes to the real `data/game.db` (no test fixture). It generates a unique username per run (`e2e_<timestamp>`) and asserts only that run's leaderboard row exists with `games >= 5`. **Never assert global user/score counts** in tests — the DB accumulates rows across runs and CI.
