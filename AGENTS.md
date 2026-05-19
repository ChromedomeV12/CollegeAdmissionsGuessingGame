# Admissions Oracle - Agent Instructions

## Architecture & Data Flow
- **Frontend (`public/`)**: React Single-Page Application using `@babel/standalone` to compile JSX in the browser. There is currently **no build step** (Webpack/Vite).
- **Backend (`server.js`)**: Express server that serves static files from `public/` and handles API requests under `/api/`.
- **Hybrid Storage**:
  - **Static Content (`data/profiles.jsonl`)**: Read-only to the server. Contains the parsed college applicant profiles. Loaded into memory on startup.
  - **Dynamic State (`data/game.db`)**: SQLite (`better-sqlite3`) database storing user accounts, passwords (bcrypt hashed), and scores for the leaderboard.

## Development Commands
- **Run Server**: `npm run dev` (starts the Express server with node --watch).
- **Run Tests**: `node e2e_test.cjs` (Runs a self-contained Puppeteer headless browser test that automatically starts the server, registers a user, and navigates the React UI. Uses `.cjs` because `package.json` specifies `"type": "module"`).

## Local Data Scraping Pipeline
*IMPORTANT: Scraping should only be run locally. The resulting `data/profiles.jsonl` is then pushed to production.*
1. **Environment**: Requires `OPENROUTER_API_KEY` in `.env`.
2. **Scrape**: `npm run scrape` (or `node scripts/scrape.js --url <reddit_url>`). Fetches from Reddit's `.json` endpoint, filters via OpenRouter LLM, and outputs to `data/queue.jsonl`.
3. **Approve**: `npm run approve`. Interactive CLI to manually review queued profiles. Approved profiles are appended to `data/profiles.jsonl`.

## Code Conventions & Gotchas
- **Defensive UI Rendering**: When modifying `public/phase*.jsx` components, **ALWAYS use optional chaining (`?.`)** and fallback defaults (`|| {}`, `|| []`) when accessing profile data (e.g., `test_scores`, `academic_profile`, `extracurriculars`). The LLM scraper is imperfect, and missing data must gracefully render empty states rather than crashing the React tree.
- **Scoring Logic (`phase4-results.jsx`)**:
  - `+10` for correct school, `-2` for incorrect school *(only if the tier band was a hit)*.
  - `+10` for correct Uni tier, `+10` for correct LAC tier.
  - `-5` per incorrect tier band.
  - "No LAC Admit" claim explicitly scored (`+10` if correct, `-5` if wrong, waives standard LAC penalties).
- **API Fetching**: Frontend fetch calls inside `public/app.jsx` must point explicitly to `/api/*` endpoints (e.g., `/api/scores`, `/api/leaderboard`), otherwise Express will fall back to serving `index.html`.
