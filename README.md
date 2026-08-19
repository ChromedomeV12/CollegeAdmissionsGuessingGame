# Admissions Oracle

A React-based college admissions guessing game. Players study a deliberately small case library and predict admissions outcomes across university tiers. New Reddit material is accepted only from the post owner through a consent-first submission flow.

## License

MIT — see [LICENSE](LICENSE). Contributing rules: [CONTRIBUTING.md](CONTRIBUTING.md). Vulnerability reporting: [SECURITY.md](SECURITY.md).

This project is co-owned and co-developed by ChromedomeV12 (repo owner) and Mason W ([MJanW](https://github.com/MJanW)).

## Architecture

1. **Frontend (`public/`)** — React SPA, no build step: JSX is compiled in the browser by `@babel/standalone`. Four game phases (Profile → Tier → Schools → Reveal), auth, leaderboard, and an owner-submission center. State lives client-side; scores sync to the backend.
2. **Backend (`server.js`)** — Express. Serves `public/` statically and exposes the JSON API under `/api/*` (unknown `/api` paths return 404 JSON, not the SPA). JWT sessions (`jsonwebtoken`), bcrypt password hashing (`bcryptjs`).

3. **Storage (hybrid)**:
   - `data/profiles.jsonl` — static game content. Read-only to the server, loaded into memory at startup. Replace the file to update content.
   - `data/game.db` — SQLite (`better-sqlite3`, WAL) for users, scores, consent receipts, OAuth state hashes, and privately queued Reddit submissions.

## Theme & visual system
- **Tokyo Night / Tokyo Day**: use the moon/sun button in the signed-in topbar. The choice persists as `ao_theme` in local storage. Exact palette anchors and derived web surfaces live in `public/styles-v2.css`.
- **Palette integrity**: canvas, text, comments and semantic blue/magenta/cyan/green/yellow/red tokens use the supplied Tokyo values exactly; intermediate surfaces and borders are derived with `color-mix()` rather than unrelated hex colors.
- **Matte glass**: semantic cards/topbars keep strong Tokyo surface identity with restrained 12px blur, higher surface opacity, token borders, and theme-aware shadows.
- **Static backdrop**: a subtle token grid and blue→magenta→cyan top line provide atmosphere without an animated canvas. Component hover/selection/reveal transitions use short 190ms transform/opacity/color motion and respect `prefers-reduced-motion`.
- Tailwind Play CDN is configured with preflight disabled for no-build utility classes; the existing semantic CSS remains authoritative.

### API surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/register` | — | `{username, password}` → `{token, username, scores}`. Username `^[a-zA-Z0-9_]{3,20}$`, password 8–72 chars. |
| POST | `/api/login` | — | Same shape as register. |
| GET | `/api/me` | Bearer | Session check + score history. |
| GET | `/api/profiles` | — | All playable profiles. |
| GET | `/api/profiles/:id` | — | One profile (full detail, fetched when tiers lock). |
| POST | `/api/scores` | Bearer | `{profile_id, score, breakdown}` — keeps the higher score per (user, profile). |
| GET | `/api/leaderboard` | — | `[{username, games, avg, best}]` — `avg` is the rounded mean per-case score over distinct cases; only players with `>= 5` cases qualify. |
| GET | `/api/stats` | — | Aggregate play stats. |
| GET | `/api/submissions/config` | Bearer | Public-safe configuration state and current consent version. |
| GET | `/api/submissions` | Bearer | The current user's private submission history. |
| POST | `/api/submissions` | Bearer | Validate a Reddit post URL, record consent, and start ownership verification — an OAuth authorize URL when Reddit app credentials are configured, otherwise a one-time edit-code proof. |
| POST | `/api/submissions/:id/confirm-fallback` | Bearer | (Fallback mode) Re-fetch the post via Reddit's public JSON endpoint and confirm the owner's edit-code is present. |
| GET | `/api/submissions/reddit/callback` | OAuth state | Compare the Reddit account with the post author, then queue the post privately. |
| DELETE | `/api/submissions/:id` | Bearer | Withdraw a submission and purge the stored post snapshot. |

## Scoring

Every case scores **0–100 — never negative** — split across three skills:

- **School selection (70):** Jaccard overlap `|selected ∩ admitted| / |selected ∪ admitted|` over the schools in view. Proportional credit for every correct pick; no penalty for wrong picks, only lost potential.
- **University tier (15):** distance credit — correct band 15, off-by-one 9, off-by-two 5, else 0.
- **LAC tier (15):** same ladder; the "No LAC Admit" claim scores the full 15 when correct and 0 when wrong.

The leaderboard ranks by **average per-case score** over your distinct cases (minimum 5 to qualify), not by total — so it measures skill, not how many cases you grinded.

## Local setup

```bash
npm install
cp .env.example .env   # then edit: set JWT_SECRET (generation one-liner inside)
npm run dev            # http://localhost:3005
```

`.env` keys: `PORT`, `JWT_SECRET`, and optionally `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`/`REDDIT_REDIRECT_URI` (OAuth ownership verification) plus `REDDIT_USER_AGENT` and `OPENROUTER_API_KEY` (optional LLM structuring during `npm run approve`). Create a Reddit **web app** and register the redirect URI exactly (production must use HTTPS). Without the `REDDIT_*` credentials the app attempts the edit-code fallback, but Reddit may block the public `.json` confirmation request with HTTP 403; the fallback is therefore best-effort, not a guaranteed substitute for approved API access.

## Testing

```bash
npm test
```

Runs the Node unit suite (Reddit URL parsing, OAuth construction, ownership matching, edit-code fallback verification, post sanitization, design-contrast AA checks) followed by `e2e_test.cjs`. The browser test registers a throwaway user, drives the submission center's edit-code fallback flow (asserts a local proof code is issued with no Reddit network call), plays all four game phases, and asserts the score lands on the leaderboard. It writes to the real `data/game.db` with unique usernames per run.

Acceptance checks: [AGENT_CHECKLIST.md](AGENT_CHECKLIST.md) — the agent-run self-check workflow (boot, API, auth, all four phases, navigation/persistence, console-error watch, screenshots, and the `npm test` gate).

## Consent-first content pipeline

1. A signed-in user pastes the URL of a Reddit post they authored and accepts the displayed consent language.
2. **OAuth mode** (Reddit app credentials configured): the server records the consent version and a hashed, 15-minute OAuth state, then redirects to Reddit with only `identity` and `read` scopes (`duration=temporary`). After redirect, it compares `/api/v1/me` with the post's API-reported author — a mismatch imports nothing.
3. **Fallback mode** (no credentials): the server issues a one-time edit-code (`ORACLE-XXXXXX`, 30-minute TTL). The user edits their post to include it and confirms; the server re-fetches via Reddit's public JSON endpoint and verifies the code. Only the post author can edit a post, so this proves ownership without any Reddit app registration.
4. On success the server stores a minimized post snapshot in `reddit_submissions` with status `verified_pending_review`. It never stores access tokens or exposes the Reddit username in the game API.
5. `npm run export-verified` moves verified records into `data/queue.jsonl` as consent drafts; a human editor runs `npm run approve` to publish (with optional LLM structuring if `OPENROUTER_API_KEY` is set). There is intentionally no automatic publish path.
6. The submitting user can withdraw a pending record; its stored title, body, account identifier, and ownership fingerprint are purged.

Bulk subreddit scraping and arbitrary `--url` imports are disabled. See [Consent and Reddit import architecture](docs/CONSENT_IMPORT.md).

## Known limitations / roadmap

- **No build pipeline** — in-browser Babel is fine for an MVP, production wants Vite.
- **Editorial dashboard** — ownership verification plus export (`npm run export-verified`) is implemented, but there is still no web UI for the approve step; it is CLI-only (`npm run approve`).
- **Reddit app review** — Reddit may require review or approval before public distribution or higher-volume API access when the OAuth path is used; the edit-code fallback avoids the official API entirely but is weaker against adversarial proof.
- **Reddit public JSON blocking** — verified on 2026-08-19: `www.reddit.com` and `old.reddit.com` returned HTTP 403 from browser and server-side requests, even with a browser-like User-Agent. Do not bypass this by exporting personal cookies; use approved API access, a dedicated throwaway test profile for one-off diagnostics, or a manual content-paste workflow.
- **Runtime frontend CDN** — Tailwind Play CDN fits the current no-build architecture, but a production deployment should pin/bundle Tailwind via a real build pipeline (Vite/Tailwind CLI) to remove runtime Play-CDN risk.
- **Legacy seed consent** — the eight current seed cases predate the new proof flow. Replace them with consented or synthetic cases before a broad public launch.
- `public/uploads/` still holds early prototype artifacts (`sample.jsonl`, original scraper prompt) — candidates for pruning.

## Deployment notes

- Deploy `server.js` to any Node host (Railway, Render, DO, EC2).
- Mount `data/` on a persistent volume so `game.db` survives restarts.
- Always set `JWT_SECRET` in the host environment.
- Configure a Reddit web app with the exact production callback URL and a descriptive `REDDIT_USER_AGENT` — or deploy without any `REDDIT_*` vars and rely on the edit-code fallback.
- Publish a privacy policy and deletion contact before enabling submissions. Reddit's Developer and Data API Terms can require app review and impose privacy/security obligations when the OAuth path is used.
