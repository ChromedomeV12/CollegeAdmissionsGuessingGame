# Cloudflare private beta

Last verified: 2026-08-21

## Architecture

- **Frontend and API:** Cloudflare Worker deployed through OpenAI Sites/Vinext.
- **Database:** Cloudflare D1, bound to the Worker as `DB`.
- **Identity:** the hosting layer supplies authenticated user headers. The Cloudflare path does not collect or store passwords, password hashes, or browser JWTs.
- **Profile data:** 33 source-stripped records are imported into D1 after deployment. They are not committed to the repository or bundled into the Worker.

The original Express/SQLite runtime remains available as a rollback path. Its browser entry point keeps the legacy login flow; the hosted `/game/` entry point uses managed identity.

## Privacy and access decision

This release is approved only as an **owner-only private beta** until invited users are explicitly allowlisted. Do not switch the site to public access merely to share the URL.

The current profile seed is a sanitized copy:

- public identifiers are `profile_1` through `profile_33`;
- source-platform fields and links are removed;
- outcomes and scoring metadata are excluded from the locked public list;
- the full record becomes available only after that player finalizes the profile.

This reduces exposure but does not establish consent from the people represented by the historical samples. A broader release requires a consent/licensing review and should replace historical samples with owner-submitted or clearly licensed records.

## One-time profile import

The deployment can temporarily receive `PROFILE_IMPORT_TOKEN` as a secret environment variable. While it exists, `POST /api/admin/profiles/import` accepts at most 100 profiles, strips a top-level `source` field again, and assigns neutral sequential identifiers. Remove the secret immediately after the import and deploy the resulting environment revision. When the secret is absent, the route returns `404`.

Never commit the import token or the profile JSONL file.

## Verification gate

Before a release:

1. `npm audit --omit=dev --audit-level=high`
2. `npx tsc --noEmit`
3. `npm run build:cloudflare`
4. `npm test` for the legacy rollback path
5. Verify `/readyz`, `/api/me`, 33 neutral profile IDs, profile redaction, attempt start/reveal/finalize, score persistence, and profile locking against D1.
6. Run a browser smoke check for `/game/index.html` and confirm no password token is stored.

## Sharing with friends

Keep the site private and add each friend through the hosting access controls using the email address tied to their sign-in. Removing an email must revoke access. D1 is never exposed directly to players or collaborators; all game access goes through the authenticated API.
