# Security Policy

## Supported versions

Only the latest commit on `main` receives security fixes.

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.**

Preferred: use GitHub's private vulnerability reporting —
Security tab → "Report a vulnerability" on
<https://github.com/ChromedomeV12/CollegeAdmissionsGuessingGame/security>.

Alternatively, contact the maintainer directly via GitHub profile contact
information.

Please include:

- Type of issue (auth bypass, injection, data exposure, etc.)
- Affected file(s)/endpoint(s) and reproduction steps
- Impact assessment

You should receive an acknowledgment within 7 days. Please allow up to 90
days for a fix before public disclosure; we'll try to be much faster.

## Scope notes

- Reports about the **deployment instance** (if any) rather than this codebase
  are in scope only if the underlying flaw is in this repository.
- Issues requiring a leaked `JWT_SECRET` (i.e. an already-compromised host)
  are out of scope — rotate the secret instead.

## Known hardening posture

- Passwords are bcrypt-hashed (`bcryptjs`); sessions use short-lived JWTs.
- The browser submits predictions, not scores. `public/game-score.js` is loaded by both browser and server; the server evaluates against its private profile record and atomically finalizes score + Practice lock.
- Profile-list responses omit outcomes/source. `/api/profiles/:id` requires bearer auth and a persisted lock; premature/anonymous requests cannot retrieve admissions outcomes.
- Reddit submission routes default disabled. Enabled list/create/confirm/delete calls require bearer auth plus a timing-safe `X-Maintainer-Key` match against nonempty `MAINTAINER_API_KEY`; OAuth callback authority is its hashed, single-use state.
- Unknown `/api/*` paths return JSON 404s. `.env` is gitignored; `.env.example` documents every secret/feature flag. Never deploy with the JWT fallback secret.
