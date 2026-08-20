# Simplified Chinese UI Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent English / Simplified Chinese UI toggle across every player-facing surface while preserving locale-independent game data and researching, but not implementing, bidirectional imported-profile translation.

**Architecture:** A zero-dependency `public/i18n.js` owns complete `en` and `zh-CN` resources plus a React language context. Components request semantic keys explicitly; known structured profile values use controlled maps; free-form profile prose passes through unchanged. Stable test IDs replace e2e dependence on visible English copy.

**Tech Stack:** React 18 UMD, Babel standalone JSX, classic browser globals, Node test runner, Puppeteer e2e, localStorage.

## Global Constraints

- First visit defaults to `en`; only exact persisted values `en` and `zh-CN` are accepted.
- Persist under `localStorage.ao_lang`; set `<html lang>` to the active locale immediately and after every toggle.
- Keep `Admissions Oracle`, usernames, applicant IDs, school names, tier codes, numeric scores, API paths/fields, `data-screen-label` values, and scoring behavior unchanged.
- Translate every visible UI string, status, error, loading label, placeholder, title, and accessible name.
- Translate only known structured profile enums; preserve unknown values and all free-form imported prose.
- No runtime translation API, i18n package, bundler, or build step.
- Tests locate actions by stable semantic hooks, not localized visible text.
- Existing authoritative attempts, answer privacy, Practice locks, scoring, and leaderboard behavior must remain unchanged.

---

### Task 1: Core i18n runtime and resource contract

**Files:**
- Create: `public/i18n.js`
- Create: `test/i18n.test.js`
- Modify: `public/index.html`

**Interfaces:**
- Produces: `window.I18N = { SUPPORTED_LANGS, resources, LanguageProvider, useI18n, translateEnumValue }`.
- `useI18n()` returns `{ lang, setLang, toggleLanguage, t, formatDate, translateEnum }`.
- Later tasks consume semantic resource keys; no component defines private locale dictionaries.

- [ ] **Step 1: Write the failing resource-parity and helper tests**

Create a VM/browser-global harness matching existing scoring tests. Assert:

```js
assert.deepEqual(Object.keys(I18N.resources.en).sort(), Object.keys(I18N.resources["zh-CN"]).sort());
assert.equal(I18N.interpolate("Retry in {seconds}s", { seconds: 5 }), "Retry in 5s");
assert.equal(I18N.translateEnumValue("zh-CN", "gender", "Female"), "女性");
assert.equal(I18N.translateEnumValue("zh-CN", "gender", "Nonbinary custom value"), "Nonbinary custom value");
assert.equal(I18N.normalizeLang("zh-CN"), "zh-CN");
assert.equal(I18N.normalizeLang("zh-TW"), "en");
```

The test also asserts the required top-level key prefixes exist: `auth.`, `nav.`, `home.`, `menu.`, `common.`, `profile.`, `tier.`, `schools.`, `reveal.`, `leaderboard.`, `errors.`, `ranks.`, and `ranges.`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test test/i18n.test.js`

Expected: FAIL because `public/i18n.js` does not exist.

- [ ] **Step 3: Implement the classic-global runtime**

Implement a flat resource contract and named interpolation:

```js
(function (root) {
  "use strict";
  const SUPPORTED_LANGS = ["en", "zh-CN"];
  const resources = Object.freeze({
    en: Object.freeze({
      "common.loading": "Loading…",
      "nav.toggleLanguage": "Switch to Simplified Chinese",
      "auth.login": "Log in"
    }),
    "zh-CN": Object.freeze({
      "common.loading": "加载中…",
      "nav.toggleLanguage": "切换到英语",
      "auth.login": "登录"
    })
  });
  const normalizeLang = value => SUPPORTED_LANGS.includes(value) ? value : "en";
  const interpolate = (template, params = {}) => String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
  const lookup = (lang, key) => resources[normalizeLang(lang)][key] ?? resources.en[key] ?? key;
  const enumMaps = Object.freeze({
    "zh-CN": {
      gender: { Male: "男性", Female: "女性", Unknown: "未知" },
      boolean: { yes: "是", no: "否" },
      difficulty: { Easy: "简单", Medium: "中等", Hard: "困难" }
    }
  });
  function translateEnumValue(lang, group, value) {
    if (value == null || value === "") return value;
    return enumMaps[normalizeLang(lang)]?.[group]?.[String(value)] ?? value;
  }
  // LanguageProvider/useI18n use React.createContext and localStorage ao_lang.
  root.I18N = { SUPPORTED_LANGS, resources, normalizeLang, interpolate, translateEnumValue, LanguageProvider, useI18n };
})(typeof window !== "undefined" ? window : globalThis);
```

Resources must contain real English and idiomatic Simplified Chinese copy for every key used by Tasks 2–5; never leave an English value in `zh-CN` except preserved brand/tier tokens supplied as interpolation parameters.

- [ ] **Step 4: Load i18n before JSX**

In `public/index.html`, add `<script src="i18n.js"></script>` after `ranks.js`/`game-score.js` and before `ui-primitives.jsx`.

- [ ] **Step 5: Verify GREEN**

Run: `node --test test/i18n.test.js`

Expected: all i18n tests pass.

- [ ] **Step 6: Commit**

```bash
git add public/i18n.js public/index.html test/i18n.test.js
git commit -m "feat(i18n): add bilingual runtime"
```

---

### Task 2: Stable selectors, provider, and global language controls

**Files:**
- Modify: `public/app.jsx`
- Modify: `public/auth.jsx`
- Modify: `public/ui-primitives.jsx`
- Modify: `e2e_test.cjs`

**Interfaces:**
- Consumes: `window.I18N.LanguageProvider`, `window.I18N.useI18n`.
- Produces stable `data-testid` values: `language-toggle`, `auth-mode-login`, `auth-mode-register`, `auth-submit`, `home-play`, `nav-home`, `nav-menu`, `nav-leaderboard`, `nav-logout`, `phase-start`, `phase-lock`, `phase-reveal`, `retry-case`, `correct-choices-tab`, `rival-input`, `rival-add`, `duel-open`.

- [ ] **Step 1: Add failing e2e assertions for default/persistence**

Before translating visible copy, change helpers to click `[data-testid]` and add assertions:

```js
await page.evaluate(() => localStorage.removeItem("ao_lang"));
await page.reload({ waitUntil: "domcontentloaded" });
assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
await page.click('[data-testid="language-toggle"]');
await page.waitForFunction(() => document.documentElement.lang === "zh-CN" && localStorage.ao_lang === "zh-CN");
await page.reload({ waitUntil: "domcontentloaded" });
assert.equal(await page.evaluate(() => document.documentElement.lang), "zh-CN");
```

- [ ] **Step 2: Run e2e to verify RED**

Run: `npm run test:e2e`

Expected: FAIL because the language toggle/test IDs do not exist.

- [ ] **Step 3: Wrap the root and add one reusable toggle**

Wrap `App` at root render:

```jsx
const { LanguageProvider } = window.I18N;
root.render(<LanguageProvider><App /></LanguageProvider>);
```

Add `LanguageToggle` in `ui-primitives.jsx`:

```jsx
function LanguageToggle() {
  const { lang, toggleLanguage, t } = window.I18N.useI18n();
  return <button type="button" className="btn-ghost" data-testid="language-toggle" onClick={toggleLanguage} aria-label={t("nav.toggleLanguage")}><i className="ti ti-world" aria-hidden="true" />{lang === "en" ? "中文" : "EN"}</button>;
}
```

Render it on auth and every topbar without altering responsive structure.

- [ ] **Step 4: Add stable semantic hooks**

Add the exact `data-testid` values from this task to existing controls. Do not remove accessible names.

- [ ] **Step 5: Migrate e2e control lookup**

Replace English `clickButton` calls and placeholder/visible-text locators where a semantic hook exists. Keep visible-text assertions only when the assertion specifically verifies translated copy.

- [ ] **Step 6: Verify GREEN**

Run: `npm run test:e2e`

Expected: language persistence passes and the existing full game flow remains green.

- [ ] **Step 7: Commit**

```bash
git add public/app.jsx public/auth.jsx public/ui-primitives.jsx e2e_test.cjs
git commit -m "test(i18n): stabilize bilingual UI selectors"
```

---

### Task 3: Auth, Home, menu, navigation, and leaderboard localization

**Files:**
- Modify: `public/auth.jsx`
- Modify: `public/app.jsx`
- Modify: `public/ranks.js`
- Modify: `public/i18n.js`
- Modify: `test/i18n.test.js`

**Interfaces:**
- Rank records gain stable `id` values: `observer`, `reader`, `junior`, `senior`, `dean`, `oracle`; names render through `t("ranks." + id)`.
- Known API errors pass through `localizeError(error)`; unknown errors use `errors.generic`.

- [ ] **Step 1: Add failing resource/visible-copy tests**

Assert Chinese resources include idiomatic translations for auth mode, Home rules, menu states, global leaderboard columns, rivalry, and all navigation accessible names. Assert every rank ID resolves in both locales.

- [ ] **Step 2: Verify RED**

Run: `node --test test/i18n.test.js`

Expected: FAIL on missing resource keys/rank IDs.

- [ ] **Step 3: Localize auth completely**

Replace auth visible literals, placeholders, feedback, group labels, button text, and error rendering with `t`. Map known server messages (`User already exists`, username/password validation, invalid credentials) to stable locale keys; unknown messages render `errors.generic` while logging the original.

- [ ] **Step 4: Localize App surfaces completely**

Use `t` for Home, menu badges/card accessible labels, topbars, loading/errors, phase metadata, leaderboard/rival/duel copy, empty states, chips, and buttons. Preserve usernames/profile IDs/scores as interpolation values.

- [ ] **Step 5: Localize ranks by ID**

Add IDs without changing thresholds/icons. Render rank names and progress copy through resources.

- [ ] **Step 6: Verify focused tests**

Run: `node --test test/i18n.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add public/auth.jsx public/app.jsx public/ranks.js public/i18n.js test/i18n.test.js
git commit -m "feat(i18n): localize shell and leaderboard"
```

---

### Task 4: Profile, tier, and school localization

**Files:**
- Modify: `public/phase1-profile.jsx`
- Modify: `public/phase2-tier.jsx`
- Modify: `public/phase3-school.jsx`
- Modify: `public/ui-primitives.jsx`
- Modify: `public/tiers.js`
- Modify: `public/i18n.js`
- Modify: `test/i18n.test.js`

**Interfaces:**
- Tier codes remain raw; range text renders via `t("ranges." + tierCodeKey)`.
- Structured profile values call `translateEnum(group, value)`; unknown values return unchanged.

- [ ] **Step 1: Add failing tests for structured values and ranges**

Cover real values from `data/profiles.jsonl`: `Male`, `Female`, `Unknown`, `Low Income`, `Middle Income`, `High Income`, `Public`, `Private Day`, `Private Boarding School`, `Feeder School`, `Non-feeder`, `Easy`, `Medium`, `Hard`. Verify an unknown custom value survives unchanged. Verify all nine tier-range keys exist in both locales.

- [ ] **Step 2: Verify RED**

Run: `node --test test/i18n.test.js`

Expected: FAIL until mappings/range resources exist.

- [ ] **Step 3: Localize shared primitives/profile**

Translate stepper labels/ARIA, tabs, field labels, badges, metrics, charts, table headers, Correct choices, final enrollment, and date formatting. Apply enum translation only to approved groups; leave courses, EC descriptions, awards, and unknown values untouched.

- [ ] **Step 4: Localize tier selection**

Translate instructions, panel labels, hints, claim text, time-bonus states, buttons, and accessible labels. Preserve tier codes and server prediction payloads.

- [ ] **Step 5: Localize school selection**

Translate section headings, claim states, selection counts, empty/skipped states, score-allocation labels, buttons, and school-card accessible names. Preserve school display names.

- [ ] **Step 6: Verify tests**

Run: `node --test test/i18n.test.js test/scoring.test.js`

Expected: PASS; scoring remains locale-independent.

- [ ] **Step 7: Commit**

```bash
git add public/phase1-profile.jsx public/phase2-tier.jsx public/phase3-school.jsx public/ui-primitives.jsx public/tiers.js public/i18n.js test/i18n.test.js
git commit -m "feat(i18n): localize game profile phases"
```

---

### Task 5: Reveal, Practice, and result localization

**Files:**
- Modify: `public/phase4-results.jsx`
- Modify: `public/i18n.js`
- Modify: `test/i18n.test.js`
- Modify: `e2e_test.cjs`

**Interfaces:**
- Server aggregate result fields remain unchanged.
- `formatDate` comes from `useI18n`; no hardcoded English month array remains.

- [ ] **Step 1: Add failing reveal resource tests**

Assert both locales cover pending aggregate labels, retry countdown, tier/selection breakdown, no-admit explanations, teaching header, enrollment banner, Practice-not-recorded copy, rank contribution, row statuses, and navigation.

- [ ] **Step 2: Verify RED**

Run: `node --test test/i18n.test.js`

Expected: FAIL on missing reveal keys.

- [ ] **Step 3: Localize Phase 4 completely**

Replace every visible literal and accessible name. Keep first-reveal detail gating unchanged. Preserve score values, school names, tier codes, and server result field use. Practice must still omit time/rank/contribution claims in both languages.

- [ ] **Step 4: Add bilingual changed-contract e2e**

In Chinese mode, drive one aggregate first reveal, retry/finalization, Correct choices, Practice, leaderboard, and rivalry using stable selectors. Assert representative Chinese strings and absence of English UI labels. Toggle back to English without reload and assert English copy returns. Keep the existing five-case authoritative flow once, not duplicated in full per locale.

- [ ] **Step 5: Verify focused and full tests**

Run: `node --test test/i18n.test.js`

Run: `npm test`

Expected: all tests and e2e pass.

- [ ] **Step 6: Commit**

```bash
git add public/phase4-results.jsx public/i18n.js test/i18n.test.js e2e_test.cjs
git commit -m "feat(i18n): localize reveal and Practice"
```

---

### Task 6: Browser visual/accessibility verification and docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `AGENT_CHECKLIST.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Documents `ao_lang`, supported locales, untranslated content boundary, and stable selector rules.

- [ ] **Step 1: Browser-drive both locales**

At 1600×900 and 390×844, capture auth, Home, profile, tier, school, aggregate reveal, finalized reveal, Practice/Correct choices, and leaderboard. Verify toggle persistence, `<html lang>`, focus names, no overflow, one-row desktop topbar, readable Chinese wrapping, and unchanged Tokyo themes/wallpaper.

- [ ] **Step 2: Update documentation**

README: language toggle and part-1 boundary. AGENTS: resource ownership/no inline literals/stable hooks. Checklist: bilingual browser checks. Changelog: implemented behavior and verification.

- [ ] **Step 3: Run final gate**

Run: `npm test`

Expected: unit/integration tests have zero failures and e2e ends `ALL STEPS PASSED`.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md AGENT_CHECKLIST.md CHANGELOG.md
git commit -m "docs(i18n): document bilingual interface"
```

---

### Task 7: Research bidirectional imported-profile translation

**Files:**
- Create: `docs/PROFILE_TRANSLATION_PIPELINE.md`

**Interfaces:**
- Research only; no server/import/runtime code changes.
- Produces a later implementation decision covering source preservation, field selection, translation provider, model revision, caching, privacy, cost, rate limits, provenance, and human review.

- [ ] **Step 1: Verify current provider terms and limits**

Use current primary documentation and live service terms for at least: LibreTranslate/self-hosting, Argos Translate, Google Cloud Translation free tier, Azure Translator free tier, DeepL API Free availability, and one China-accessible alternative. Record availability by region, free quota, commercial restrictions, data retention/privacy, Chinese quality, and whether mainland access requires ICP/local hosting.

- [ ] **Step 2: Evaluate pipeline architectures**

Compare:

1. deterministic self-hosted translation + optional small-model revision;
2. managed free-tier translation + revision;
3. small-model direct structured translation.

Score cost, quality, reproducibility, China/global access, privacy, schema safety, latency, and operational burden.

- [ ] **Step 3: Define recommended schema-aware pipeline**

Specify immutable `source_text`, detected `source_locale`, field allowlist, glossary for admissions terms/school names/tier codes, translation cache key, translated fields per target locale, revision prompt/model constraints, automated validation, human approval, provenance/version fields, withdrawal behavior, and failure/retry states. No destructive overwrite.

- [ ] **Step 4: Write the research report**

Include dated source links, a recommendation, a zero-cost development path, production caveats, and explicit non-implementation status. Do not claim a provider is China-accessible without current evidence.

- [ ] **Step 5: Commit**

```bash
git add docs/PROFILE_TRANSLATION_PIPELINE.md
git commit -m "docs(import): research profile translation pipeline"
```
