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
| GET | `/api/submissions/config` | Bearer | Public-safe configuration state and current consent version. |
| GET | `/api/submissions` | Bearer | The current user's private submission history. |
| POST | `/api/submissions` | Bearer | Validate a Reddit post URL, record consent, and return a temporary Reddit OAuth URL. |
| GET | `/api/submissions/reddit/callback` | OAuth state | Compare the Reddit account with the post author, then queue the post privately. |
| DELETE | `/api/submissions/:id` | Bearer | Withdraw a submission and purge the stored post snapshot. |

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

`.env` keys: `PORT`, `JWT_SECRET`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_REDIRECT_URI`, and `REDDIT_USER_AGENT`. Create a Reddit **web app** and register the redirect URI exactly. The production redirect must use HTTPS.

## Testing

```bash
npm test
```

Runs the Node unit suite for Reddit URL parsing, OAuth construction, ownership matching, and post sanitization, followed by `e2e_test.cjs`. The browser test registers a throwaway user, checks the submission center's safe unconfigured state, drives all four game phases, and asserts the score lands on the leaderboard. It writes to the real `data/game.db` with unique usernames per run.

Acceptance checks: [AGENT_CHECKLIST.md](AGENT_CHECKLIST.md) — the agent-run self-check workflow (boot, API, auth, all four phases, navigation/persistence, console-error watch, screenshots, and the `npm test` gate).

## Consent-first content pipeline

1. A signed-in user pastes the URL of a Reddit post they authored and accepts the displayed consent language.
2. The server records the consent version and a hashed, 15-minute OAuth state. It requests only Reddit's `identity` and `read` scopes with `duration=temporary`.
3. After Reddit redirects back, the server compares `/api/v1/me` with the post's API-reported author. A mismatch imports nothing.
4. On a match, the server stores a minimized post snapshot in `reddit_submissions` with status `verified_pending_review`. It never stores the Reddit access token or exposes the Reddit username in the game API.
5. A human editor must anonymize and approve the case before adding it to `data/profiles.jsonl`. There is intentionally no automatic publish path.
6. The submitting user can withdraw a pending record; its stored title, body, account identifier, and ownership fingerprint are purged.

Bulk subreddit scraping and arbitrary `--url` imports are disabled. `npm run approve` remains available only for already-consented editorial drafts in the legacy JSONL review queue. See [Consent and Reddit import architecture](docs/CONSENT_IMPORT.md).

## Known limitations / roadmap

- **No build pipeline** — in-browser Babel is fine for an MVP, production wants Vite.
- **Editorial dashboard** — ownership verification is implemented, but converting a verified post into a playable anonymized profile remains a human workflow.
- **Reddit app review** — Reddit may require review or approval before public distribution or higher-volume API access.
- **Legacy seed consent** — the eight current seed cases predate the new proof flow. Replace them with consented or synthetic cases before a broad public launch.
- `public/uploads/` still holds early prototype artifacts (`sample.jsonl`, original scraper prompt) — candidates for pruning.

## Deployment notes

- Deploy `server.js` to any Node host (Railway, Render, DO, EC2).
- Mount `data/` on a persistent volume so `game.db` survives restarts.
- Always set `JWT_SECRET` in the host environment.
- Configure a Reddit web app with the exact production callback URL and a descriptive `REDDIT_USER_AGENT`.
- Publish a privacy policy and deletion contact before enabling submissions. Reddit's current Developer and Data API Terms can require app review and impose privacy/security obligations.
