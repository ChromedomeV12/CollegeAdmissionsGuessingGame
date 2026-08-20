# Simplified Chinese UI Localization Design

## Goal

Add a complete English / Simplified Chinese (`zh-CN`) interface toggle without adding a build step or network translation dependency. This phase localizes UI chrome and known structured profile values. It deliberately does not translate free-form imported profile prose.

## Product decisions

- First visit defaults to English.
- The user can switch languages from the unauthenticated auth screen and every signed-in topbar.
- The selected language persists under `localStorage.ao_lang`.
- Supported locale identifiers are exactly `en` and `zh-CN`.
- `document.documentElement.lang` always matches the active locale.
- The product name `Admissions Oracle` remains in English.
- Applicant IDs, usernames, school names, tier codes (`HYPSM`, `T10`, `T20 LAC`, etc.), numeric scores, and API field names are never translated.

## Part 1 scope

### Translate

- Auth modes, headings, descriptions, form labels, placeholders, validation feedback, errors, loading states, and accessible names.
- Home rules, authorship copy, navigation, menu states, topbar controls, and phase progress.
- Profile field labels, tabs, metric labels, table headers, chart controls, final-answer labels, and date formatting.
- Tier/school prediction instructions, claim text, hints, empty states, score-allocation labels, selection state, and accessible names.
- Reveal, retry, timeout, Practice, result details, rank/leaderboard, rivalry, duel, and error/status copy.
- Rank display names and tier range descriptions.
- Known structured profile values through a controlled mapping: gender, SES/income level, school type, school classification, difficulty, yes/no states, and known decision/status values.

### Preserve as imported

- Course names and levels not covered by a known enum.
- Extracurricular names/descriptions, awards, honors, notes, qualitative analysis, hints, teaching points, and other free-form prose.
- Unknown structured values. The localization helper returns the original value rather than guessing.

## Architecture

Create `public/i18n.js`, loaded after React plus the existing tier/scoring/rank globals and before all JSX component scripts.

It exposes one `window.I18N` namespace:

- `LanguageProvider`
- `useI18n()` returning `{ lang, setLang, toggleLanguage, t, formatDate, translateEnum }`
- complete `en` and `zh-CN` resource objects
- supported locale constants

`LanguageProvider` owns locale state. It reads `ao_lang` once; only exact supported values are accepted, otherwise it chooses `en`. Every change writes `ao_lang` and updates `<html lang>`.

Resources use stable semantic keys grouped by surface (`auth.*`, `nav.*`, `home.*`, `profile.*`, `tier.*`, `schools.*`, `reveal.*`, `leaderboard.*`, `errors.*`, `enums.*`). `t(key, params)` performs exact lookup and named interpolation. Missing keys fail loudly in development and fall back to the English resource in the rendered UI.

All React surfaces consume `useI18n`; no component owns a second translation table. No DOM post-processing or machine translation is used.

## Language control

Use one compact control with a globe icon and destination label:

- English UI: `中文`
- Chinese UI: `EN`

It appears on the auth screen and every signed-in topbar, including Home, menu/active round, and leaderboard. It has a localized `aria-label`, preserves existing topbar responsive behavior, and uses current button/focus styles rather than adding a new visual system.

## Dates, interpolation, and values

- Dates use `Intl.DateTimeFormat` with the active locale. Invalid/missing dates retain the existing em-dash fallback.
- Interpolation handles profile/case counts, points, averages, retry seconds, selected counts, and progress steps.
- Chinese copy does not introduce English plural rules.
- Enum translation normalizes only known exact values. Unknown or null values retain the existing safe fallback.
- Scoring inputs and server payloads remain locale-independent.

## Error handling

Known server/client errors map to stable locale keys before display. Chinese mode never displays a raw known English server error. Unknown failures show a localized generic message and preserve the original error in console diagnostics.

The localization layer never suppresses API or rendering failures. Missing resource keys are detectable through tests.

## Stable test selectors

Existing e2e helpers rely on English visible text. Before changing copy, add stable `data-testid` hooks for actions and state gates that tests click or inspect. Keep existing `data-screen-label` values unchanged because they are internal layout/test identifiers, not visible copy.

Tests must not use translated visible text to locate controls when a stable semantic hook is available.

## Verification

### Unit tests

- English and Chinese resource key sets are identical.
- Named interpolation works in both locales.
- Missing locale/key behavior is deterministic.
- Enum mappings translate known values and preserve unknown values.
- Date formatting uses the selected locale.

### Browser/e2e

- First visit is English when `ao_lang` is absent.
- Toggle on auth updates visible copy, `ao_lang`, and `<html lang>`.
- Preference survives registration, login, reload, Home, game phases, Practice, and leaderboard.
- Auth, Home, menu, all four phases, finalized/Practice reveal, Correct choices, leaderboard, rivalry, errors, and accessible labels have Chinese copy.
- Brand, applicant IDs, school names, tier codes, scores, and API behavior remain unchanged.
- Toggle back to English restores English copy without reload.
- Desktop/mobile layouts have no new overflow or topbar wrapping regression.
- Existing authoritative attempt, score, privacy, and Practice tests remain green.

## Deferred part 2: imported profile translation

This implementation does not call a translation API or rewrite profile records. A separate research deliverable will evaluate bidirectional Chinese ↔ English import translation, caching, schema-aware field selection, terminology glossaries, small-model revision, cost/rate/privacy constraints, and human review. That future pipeline must preserve the original source text and store provenance rather than destructively replacing it.

## Non-goals

- Traditional Chinese.
- Runtime translation of arbitrary profile prose.
- Translating school names or tier codes.
- Adding an i18n package, bundler, or build pipeline.
- Localizing maintainer-only CLI prompts or private raw submission content in this phase.
