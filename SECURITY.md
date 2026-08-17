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

- Passwords: bcrypt-hashed (`bcryptjs`); sessions: short-lived JWTs.
- Validation: username/password rules on register; bounded `score` /
  `profile_id` on `/api/scores`; unknown `/api/*` paths return JSON 404s.
- Secrets: `.env` is gitignored; see `.env.example` for the full list.
  A startup warning fires if `JWT_SECRET` is unset — never deploy that way.
