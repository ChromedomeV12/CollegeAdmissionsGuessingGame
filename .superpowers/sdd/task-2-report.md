# Task 2 Report

## Status
Complete. Task 2 wiring is implemented and committed.

## Files
- `public/app.jsx` — root `LanguageProvider`, reusable toggle on each topbar, navigation/rival selectors.
- `public/auth.jsx` — auth toggle plus login/register/submit selectors.
- `public/ui-primitives.jsx` — reusable `LanguageToggle`, semantic selector inference for existing `Btn` controls, and Correct choices tab selector.
- `e2e_test.cjs` — locale persistence assertions and locale-neutral test-id action helpers/lookups.

## Commit
- `daf5a09 test(i18n): stabilize bilingual UI selectors`

## RED
`npm run test:e2e` failed as expected before implementation at the new language-toggle assertion:
`No element found for selector: [data-testid="language-toggle"]`.

## GREEN
`npm run test:e2e` passed after implementation. Full existing flow passed, including auth, failed reveal persistence, Escape recovery, retry/timeout/reload, practice mode, leaderboard, rival/duel, API cross-checks, and maintainer-key checks.

Targeted syntax check also passed: `node --check e2e_test.cjs`.

## Self-review
- Auth renders exactly one reusable `LanguageToggle` while unauthenticated; each of the leaderboard, home, and active-round topbars renders the same component exactly once.
- Existing topbar responsive structure and handlers remain intact; navigation selectors are attached without removing accessible labels.
- Mobile browser review at 390px confirmed auth and active-round surfaces have no horizontal overflow (`scrollWidth === 390`), stable selector counts, and a working language-toggle event (`en` -> `zh-CN`, with `ao_lang` persisted).
- E2E action lookups use stable test IDs wherever the task defines one; visible-text checks remain only for copy/state assertions and existing behavioral gates.
- All required selector names are represented: language/auth/home/navigation/phase/retry/correct-choices/rival/duel.

## Concerns
Phase controls live in files outside the Task 2 modification allowlist, so their stable selectors are supplied centrally by the reusable `Btn`/`Tabs` primitives based on their existing control labels. If a later task translates those child labels, it should pass explicit `testId` props from the phase components; no visible localization was introduced here per Task 2 scope.
