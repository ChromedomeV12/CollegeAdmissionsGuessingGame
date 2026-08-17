# Contributing to Admissions Oracle

Thanks for your interest in improving this project. This document covers how to
contribute code, and the ground rules that keep the project healthy.

## Ground rules

1. **License scope.** By submitting a contribution (code, docs, data), you agree
   it is licensed to this project under the repository's
   [MIT License](LICENSE). Don't submit code you don't have the right to
   license that way.
2. **No scraping of private or personal data.** The content pipeline
   (`npm run scrape`) targets public Reddit posts only. Never add pipelines
   that ingest private datasets, personally identifying information, or data
   behind authentication/paywalls. Profiles in `data/profiles.jsonl` must be
   derived from public posts and pass human review (`npm run approve`).
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
   npm test        # end-to-end Puppeteer suite — must end with ALL STEPS PASSED
   ```
   For UI changes, also run the relevant sections of
   [AGENT_CHECKLIST.md](AGENT_CHECKLIST.md).
4. **Open a pull request.** Describe what changed and why. Screenshots for UI
   changes. PRs that fail `npm test` won't be merged.
5. **Data changes** (new profiles): run the scrape → approve pipeline locally
   and include only the resulting `data/profiles.jsonl` diff. Never hand-edit
   profile records without review — malformed records crash the game UI.

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
