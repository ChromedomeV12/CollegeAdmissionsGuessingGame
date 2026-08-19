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
- Registration and score inputs are bounded; `/api/scores` accepts only 0–100 integers and rejects permanently practice-locked profiles.
- Profile-list responses omit outcomes/source and detail responses strip source. `/api/profiles/:id` is public; first-reveal answer concealment is a gameplay UI contract, not an authorization boundary.
- Reddit submission mutations/callbacks are disabled unless `SUBMISSIONS_ENABLED=true`. Player deployments must keep the flag false; enabled maintainer environments still require consent, ownership proof, rate limiting, and human review.
- Unknown `/api/*` paths return JSON 404s. `.env` is gitignored; `.env.example` documents every secret/feature flag. Never deploy with the JWT fallback secret.
