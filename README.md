# Admissions Oracle

A React-based college admissions guessing game. Players read real high school applicant profiles (scraped from r/collegeresults) and predict admissions outcomes across university tiers, competing on a global leaderboard.

## License

MIT — see [LICENSE](LICENSE). Contributing rules: [CONTRIBUTING.md](CONTRIBUTING.md). Vulnerability reporting: [SECURITY.md](SECURITY.md).

This project is co-owned and co-developed by [ChromedomeV12](https://github.com/ChromedomeV12) (repo owner) and [MJanW](https://github.com/MJanW).

## Architecture

1. **Frontend (`public/`)** — React SPA, no build step: JSX is compiled in the browser by `@babel/standalone`. Four game phases (Profile → Tier → Schools → Reveal) plus auth and leaderboard screens. State lives client-side; scores sync to the backend.
2. **Backend (`server.js`)** — Express. Serves `public/` statically and exposes the JSON API under `/api/*` (unknown `/api` paths return 404 JSON, not the SPA). JWT sessions (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`).

3. **Storage (hybrid)**:
   - `data/profiles.jsonl` — static game content. Read-only to the server, loaded into memory at startup. Replace the file to update content.
   - `data/game.db` — SQLite (`better-sqlite3`, WAL) for `users` and `scores`. Powers persistence and the leaderboard.

### API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/register` | — | `{username, password}` → `{token, username, scores}`. Username `^[a-zA-Z0-9_]{3,20}$`, password 8–72 chars. |
| POST | `/api/login` | — | Same shape as register. |
| GET | `/api/me` | Bearer | Session check + score history. |
| GET | `/api/profiles` | — | All playable profiles. |
| GET | `/api/profiles/:id` | — | One profile (full detail, fetched when tiers lock). |
| POST | `/api/scores` | Bearer | `{profile_id, score, breakdown}` — keeps the higher score per (user, profile). |
| GET | `/api/leaderboard` | — | `[{username, games, total}]`. |
| GET | `/api/stats` | — | Aggregate play stats. |

## Scoring

- `+10` correct school, `−2` wrong school *(only if the tier band was a hit)*
- `+10` correct University tier band, `+10` correct LAC tier band
- `−5` per tier band that contained none of the admits
- "No LAC admit" claim scored explicitly: `+10` correct / `−5` wrong (waives standard LAC penalties)

## Local setup

```bash
npm install
cp .env.example .env   # then edit: set JWT_SECRET (generation one-liner inside)
npm run dev            # http://localhost:3005
```

`.env` keys: `PORT`, `JWT_SECRET` (server; a startup warning fires if unset), `OPENROUTER_API_KEY` (scraper only).

## Testing

```bash
npm test
```

Runs `e2e_test.cjs`: a self-contained Puppeteer harness that spawns the server on a free port, registers a throwaway user, drives all four phases through the real UI, and asserts the score lands on the leaderboard. It writes to the real `data/game.db` (unique usernames per run) — safe to re-run, but don't use it against a production database copy you care about keeping pristine.

Acceptance checks: [AGENT_CHECKLIST.md](AGENT_CHECKLIST.md) — the agent-run self-check workflow (boot, API, auth, all four phases, navigation/persistence, console-error watch, screenshots, and the `npm test` gate).

## Content pipeline (run locally only)

1. `npm run scrape [-- --url <reddit-post-url>]` — fetches r/collegeresults posts via the public `.json` endpoint, filters/structures them through an OpenRouter LLM with a strict schema, writes candidates to `data/queue.jsonl`.
2. `npm run approve` — interactive CLI: `[a]pprove` / `[r]eject` each queued profile. Approved profiles get an ID (`cr_2026_NNN`) and are appended to `data/profiles.jsonl`.
3. Push the updated `data/profiles.jsonl` to production. Restart (or scrape-free hot path: the file loads at server startup).

## Known limitations / roadmap

- **No build pipeline** — in-browser Babel is fine for an MVP, production wants Vite.
- **Scraper rate limits** — the unofficial Reddit `.json` endpoint is strictly limited; migration path is PRAW once a Reddit developer token exists.
- **Admin dashboard** — profile review is CLI-only today.
- `public/uploads/` still holds early prototype artifacts (`sample.jsonl`, original scraper prompt) — candidates for pruning.

## Deployment notes

- Deploy `server.js` to any Node host (Railway, Render, DO, EC2).
- Mount `data/` on a persistent volume so `game.db` survives restarts.
- Always set `JWT_SECRET` in the host environment.
