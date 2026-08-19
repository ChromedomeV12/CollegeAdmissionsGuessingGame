# Consent and Reddit import architecture

## Product rule

Admissions Oracle does not crawl subreddits or publish a case from a pasted URL. A new Reddit-derived case must move through four gates:

1. An authenticated app user submits one Reddit post URL and accepts a versioned consent statement.
2. Ownership is proven. When Reddit OAuth is configured (preferred), the user completes a temporary `identity read` grant and the server compares `/api/v1/me` with the post author. When OAuth is **not** configured, the user proves ownership with an edit-code: the server issues an `ORACLE-XXXXXX` receipt code that the submitter must edit into their Reddit post body.
3. The server fetches that one post (via the OAuth API, or the public JSON endpoint in fallback mode) and confirms ownership — by author match, or by finding the receipt code in the post body.
4. A matched post enters a private `verified_pending_review` queue. Human review is required before any separate publication workflow.

There is no automatic path from URL submission to `data/profiles.jsonl`.

## Data flow

```mermaid
flowchart LR
  U["Signed-in player"] -->|"URL + explicit consent"| A["Admissions Oracle API"]
  A -->|"OAuth grant OR edit-code"| R["Reddit"]
  R -->|"Account identity OR receipt code in post"| O["Ownership comparison"]
  O -->|"Mismatch"| X["No import"]
  O -->|"Match"| Q["Private review queue"]
  Q -->|"npm run export-verified"| E["Draft queue (data/queue.jsonl)"]
  E -->|"npm run approve"| H["Human anonymization and review"]
  H -->|"Approve"| G["Playable case library"]
```

## Proof model

There are two proof paths, selected by whether Reddit OAuth credentials are configured.

### OAuth path (preferred)

- A Reddit web-app authorization code is exchanged server-side.
- OAuth `state` is 32 random bytes. Only its SHA-256 hash is stored, and it expires after 15 minutes.
- The access token is temporary and held only in memory while calling `/api/v1/me` and `/api/info?id=t3_<post_id>`.
- Ownership passes only when the authenticated Reddit username exactly matches the post author, case-insensitively.
- The stored proof is a keyed username fingerprint plus Reddit's account ID. The username itself is not returned by application APIs.
- Deleted, removed, inaccessible, or account-mismatched posts fail closed.

### Edit-code fallback path

Used automatically when `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_REDIRECT_URI` are not all configured. No Reddit OAuth is involved.

- On submission the server generates a receipt code `ORACLE-` followed by six characters from `crypto.randomBytes(6)` rendered base64url and reduced to `[A-Z0-9]` — i.e. `/^ORACLE-[A-Z0-9]{6}$/`.
- The code is stored on the row with a 30-minute TTL (`FALLBACK_CODE_TTL_MS`) and the submission status becomes `awaiting_fallback_code`. No Reddit network call happens at issue time.
- The submitter edits the code into their Reddit post body, then hits the confirm endpoint. The server fetches the post from Reddit's public JSON and checks whether the code appears in the body (`verifyFallbackEditCode`).
- A match moves the row to `verified_pending_review` and stores the minimized post snapshot, exactly like the OAuth path. A miss keeps the row in `awaiting_fallback_code` with `failure_reason = 'edit_code_not_found'` — the submitter can retry in place after editing the post.
- Expiry moves the row to `verification_expired`; the user must re-submit to get a fresh code.

#### Observed public JSON limitation

Testing on 2026-08-19 found that top-level browser navigation and server-side `curl` requests to both `https://www.reddit.com/*.json` and `https://old.reddit.com/*.json` returned HTTP 403 HTML ("blocked by network security"), including requests with a browser-like or descriptive application User-Agent. Therefore edit-code confirmation is **best-effort**: issuing the local code works offline, but the final confirmation cannot succeed when Reddit blocks the public JSON fetch. Treat 403 as an operational outage, not an ownership mismatch.

Do not bypass this by copying a developer's personal Chrome cookies into WSL. Chrome on Windows protects cookies with App-Bound Encryption, and Chrome 136+ ignores remote-debugging switches for the default data directory specifically to prevent cookie extraction. A cookie database copied into Linux is not a portable login session.

If a one-off authenticated diagnostic is approved, use a **dedicated non-default Windows Chrome profile and throwaway Reddit test account**, log in manually, launch Chrome with an explicit non-default `--user-data-dir` and remote-debugging port, then connect Puppeteer over CDP and disconnect after the single test. Never automate the developer's daily profile, persist exported cookies, or mass-scrape. Prefer approved Reddit API access or a manual user-supplied post-text workflow for production. See [Chrome's remote-debugging security change](https://developer.chrome.com/blog/remote-debugging-port) and [Reddit Data API Terms](https://redditinc.com/policies/data-api-terms).

This proves control of the Reddit account at verification time. It does not prove that every statement in the post is true or that third-party material inside the post is licensed.

### Consent-phishing tradeoff

Neither proof path fully resists a determined social engineer. In the OAuth path an attacker could forward the `authorizeUrl` to the post's real author and social-engineer that author into clicking through Reddit's own consent screen — the victim's own OAuth grant then "legitimately" verifies a post the attacker chose. In the fallback path the attacker only needs the author to paste a short `ORACLE-` code. Both attacks require the genuine author to perform an action on Reddit's own surface. This residual risk is accepted because every verified submission is gated by human review before publication: a reviewer who notices a mismatched submission can reject it, and the post content itself is what ultimately gets anonymized and published, not the verification metadata.

## Stored data

For every attempt:

- local app user ID
- normalized Reddit post ID and canonical URL
- consent version and timestamp
- submission status and timestamps
- hashed OAuth state while OAuth verification is pending; OR the fallback receipt code and its expiry timestamp while an edit-code verification is pending

Only after ownership succeeds:

- subreddit, title, self-post body, creation time, and permalink
- Reddit account ID and a keyed ownership fingerprint
- verification timestamp

Never stored:

- Reddit password
- Reddit access or refresh token
- cookies
- comments, votes, inbox data, subscriptions, or unrelated posts

Withdrawing a pending submission clears the title, body, subreddit, post metadata, Reddit account ID, ownership fingerprint, and pending OAuth state. The minimum audit record remains: submission ID, app user ID, canonical URL, consent version, timestamps, and `withdrawn` status.

## Statuses

| Status | Meaning |
|---|---|
| `awaiting_reddit_verification` | Consent recorded; OAuth must finish within 15 minutes. |
| `verified_pending_review` | Account matched the post author; private editorial review is required. |
| `verification_expired` | The OAuth state expired before completion. |
| `verification_cancelled` | The user denied or cancelled Reddit authorization. |
| `verification_failed` | Ownership mismatch, missing post, or Reddit API failure. |
| `withdrawn` | User withdrew; stored post content was purged. |
| `awaiting_fallback_code` | Edit-code fallback active: a receipt code was issued and the submitter must edit it into the post, then confirm. |
| `exported_pending_approval` | Verified submission was exported to `data/queue.jsonl` as a draft by `npm run export-verified`; awaiting `npm run approve`. |

The export CLI (`npm run export-verified`) moves `verified_pending_review` rows to `exported_pending_approval` as it appends them to `data/queue.jsonl`; `npm run approve` then structures and approves those drafts into `data/profiles.jsonl`. Future editorial tooling may add `rejected` and `published`, but publishing must remain a distinct authorized action.

## API and security controls

- All submission list, create, and withdrawal routes require the existing app bearer token.
- Create attempts are limited to five per app user per hour in the current process.
- URLs accept HTTPS links from known Reddit hosts only and discard query strings and tracking parameters.
- Duplicate Reddit post IDs are rejected unless the existing row is owned by the same user and still in a retryable state (`awaiting_reddit_verification`, `awaiting_fallback_code`, `verification_expired`, `verification_cancelled`, `verification_failed`, or `withdrawn`), in which case the submission is reset with a fresh proof and flow payload.
- OAuth requests use the least-privilege `identity read` scopes and `duration=temporary`.
- Callback state is single-use because its stored hash is cleared on every terminal result.
- Errors shown to users do not expose Reddit tokens, client secrets, or raw API responses.
- Production must use HTTPS, a strong `JWT_SECRET`, a persistent SQLite volume, backups, retention rules, and structured security logs that exclude post bodies and secrets.

## Editorial export and approval pipeline

Once a submission reaches `verified_pending_review`, it is not yet a playable case. Two CLI steps move it there:

1. **Export verified drafts** — `npm run export-verified`. Reads `data/game.db` for rows with `status='verified_pending_review'` (pass `--all` to also re-export rows already in `exported_pending_approval`), appends each to `data/queue.jsonl` as a draft entry `{ draft: true, draftKind: 'reddit-consent', consent: { … }, source: { subreddit, scrape_date } }`, then updates the row to `exported_pending_approval`. Supports `--dry-run` (no writes) and `--db <path>` to target a copy. This is the only writer that connects verified consent submissions to the game.
2. **Approve drafts** — `npm run approve`. Structured via OpenRouter when `OPENROUTER_API_KEY` is set; otherwise approved drafts are written as defensive `GameRecord` scaffolds with empty fields that render as empty states. See `AGENTS.md`.

## Launch requirements

Before enabling public submissions:

- register a Reddit **web app** and set the callback URI exactly; if API access is unavailable, treat the edit-code public-JSON path as best-effort and be prepared to disable confirmation or switch to a manual post-text workflow when Reddit returns 403;
- never deploy personal-cookie extraction or authenticated browser scraping as an API substitute;
- publish a privacy policy describing Reddit data use, retention, withdrawal, and contact methods;
- complete a legal review of copyright, publicity, minors' data, and applicable privacy law;
- replace or re-consent legacy seed cases that predate this ownership flow;
- define the editorial anonymization checklist and appeals/removal process;
- add persistent rate limiting and an abuse-reporting channel;
- verify current Reddit Developer Terms and Data API Terms again immediately before launch.

The implementation reduces risk but is not legal advice and does not by itself establish permission for third-party content quoted inside a user's post.
