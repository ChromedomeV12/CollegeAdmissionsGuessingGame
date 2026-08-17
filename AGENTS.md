# Admissions Oracle - Agent Instructions

## Architecture & Data Flow
- **Frontend (`public/`)**: React Single-Page Application compiled in-browser via `@babel/standalone`. No build step (Webpack/Vite).
- **Backend (`server.js`)**: Express server serving static files from `public/` and a single `/api/*` mount. There are **no legacy non-API routes** — every `/register`, `/login`, `/me`, `/profiles` etc. lives under `/api/`.
- **Hybrid Storage**:
  - **Static Content (`data/profiles.jsonl`)**: Read-only to the server. Loaded into memory on startup and reloaded on each `/api/profiles` request. The **single source of truth** for profile data — served to the frontend only via `GET /api/profiles` (and `/api/profiles/:id` for full records).
  - **Dynamic State (`data/game.db`)**: SQLite (`better-sqlite3`, WAL mode) storing user accounts (bcrypt-hashed passwords) and scores for the leaderboard.
- **API surface**: `/api/register`, `/api/login`, `/api/me`, `/api/profiles`, `/api/profiles/:id`, `/api/scores`, `/api/leaderboard`, `/api/stats`. Unknown `/api/*` paths return `404` JSON (`{ "error": "Not found" }`) — the SPA `index.html` fallback no longer swallows API typos.

## Development Commands
- **Run Server**: `npm run dev` (Express via `node --watch`).
- **Run Tests**: `npm test` → `node e2e_test.cjs`. A self-contained Puppeteer harness: picks a free port, spawns `server.js` itself, registers a unique user, drives all 4 game phases headless, and asserts the run lands on the leaderboard. **No manual setup** — just run it. `.cjs` because `package.json` is `"type": "module"`.
- **Scrape**: `npm run scrape` (see pipeline below).
- **Approve**: `npm run approve` (see pipeline below).

## Local Data Scraping Pipeline
*IMPORTANT: Scraping is local-only. The resulting `data/profiles.jsonl` is then pushed to production.*
1. **Environment**: Requires `OPENROUTER_API_KEY` in `.env` (see `.env.example` for `PORT`, `JWT_SECRET`, `OPENROUTER_API_KEY`).
2. **Scrape**: `npm run scrape` (or `node scripts/scrape.js --url <reddit_url>`). Fetches Reddit's `.json` endpoint, filters via OpenRouter LLM, writes to `data/queue.jsonl`. Reddit fetch and `callAI` now surface clear status/body-snippet errors instead of opaque crashes.
3. **Approve**: `npm run approve`. Interactive CLI to review queued profiles; approved ones are appended to `data/profiles.jsonl`.

## Code Conventions & Gotchas
- **Defensive UI Rendering**: When modifying `public/phase*.jsx` components, **ALWAYS use optional chaining (`?.`)** and fallback defaults (`|| {}`, `|| []`) when accessing profile data (e.g., `test_scores`, `academic_profile`, `extracurriculars`). The LLM scraper is imperfect; missing data must render empty states, not crash the React tree. Hardening is already applied to `phase1-profile.jsx`, `phase2-tier.jsx`, `phase4-results.jsx`.
- **Scoring Logic (`phase4-results.jsx`)**:
  - `+10` for correct school, `-2` for incorrect school *(only if the tier band was a hit)*.
  - `+10` for correct Uni tier, `+10` for correct LAC tier.
  - `-5` per incorrect tier band.
  - "No LAC Admit" claim explicitly scored (`+10` if correct, `-5` if wrong, waives standard LAC penalties).
- **API Fetching**: Frontend `fetch` calls in `public/app.jsx` must point explicitly to `/api/*` endpoints (e.g., `/api/scores`, `/api/leaderboard`). A typo here now 404s with JSON instead of silently returning `index.html` — so a wrong path fails loudly rather than feeding the SPA HTML to `.json()` parsing.
- **No inline profiles copy**: `public/data.js` was **removed**. Never reintroduce an inline/bundled profiles copy in the frontend; the only data path is `GET /api/profiles` backed by `data/profiles.jsonl`.
- **e2e test uses the real DB**: `e2e_test.cjs` writes to the real `data/game.db` (no test fixture). It generates a unique username per run (`e2e_<timestamp>`) and asserts only that run's leaderboard row exists with `games >= 1`. **Never assert global user/score counts** in tests — the DB accumulates rows across runs and CI.
