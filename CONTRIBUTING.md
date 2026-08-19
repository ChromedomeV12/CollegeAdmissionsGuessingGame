# Contributing to Admissions Oracle

Thanks for your interest in improving this project. This document covers how to
contribute code, and the ground rules that keep the project healthy.

## Ground rules

1. **License scope.** By submitting a contribution (code, docs, data), you agree
   it is licensed to this project under the repository's
   [MIT License](LICENSE). Don't submit code you don't have the right to
   license that way.
2. **Owner-consented data only.** Do not add bulk subreddit crawlers or
   arbitrary URL import paths. A Reddit-derived case must carry versioned
   consent, pass OAuth author matching or an edit-code ownership check, and
   complete human anonymization/editorial review before it reaches
   `data/profiles.jsonl`. Import routes remain disabled-by-default maintainer
   tooling. Never ingest private data, identifying information, or content
   behind authentication/paywalls.
3. **No credentials in git.** Secrets belong in `.env` (already gitignored).
   Never commit API keys, tokens, or database dumps. If you accidentally push
   a secret, rotate it immediately — history rewriting is a last resort.
4. **Dependencies.** Ask before adding a runtime dependency; the stack is
   deliberately small. Dev tooling additions should be justified in the PR.

## Workflow

1. **Fork & branch.** Branch from `main`:
   `git checkout -b feat/short-description`.
2. **Make your change.** Follow the conventions in
   [AGENTS.md](AGENTS.md) (they apply to human contributors too — especially
   the defensive-rendering rules for `public/phase*.jsx`).
3. **Verify before opening a PR:**
   ```bash
   npm test        # unit suite + end-to-end Puppeteer harness
   ```
   For UI changes, also run the relevant sections of
   [AGENT_CHECKLIST.md](AGENT_CHECKLIST.md).
4. **Open a pull request.** Describe what changed and why. Screenshots for UI
   changes. PRs that fail `npm test` won't be merged.
5. **Data changes** (new profiles): link the change to an owner-verified
   submission and document the anonymization review. Include only the approved
   `data/profiles.jsonl` diff, never raw post content or database files.

## Reporting issues / security

- Bugs: open a GitHub issue with repro steps and what you expected instead.
- Security problems (e.g. an auth flaw): do **not** open a public issue —
  use the repository's private security advisories
  (GitHub → Security → "Report a vulnerability"), or contact the maintainer
  directly. Include impact and repro steps.

## Code of conduct

Be decent. Personal attacks, harassment, or hostile language toward
contributors or applicants whose (public, anonymized) profiles appear in the
game will not be tolerated.
