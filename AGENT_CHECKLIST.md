# Agent Acceptance Checklist

An executable self-check workflow for an AI agent with a real browser + shell. Run every check in order; record results in the report table at the bottom.

All selectors below are grounded in the verified Contract facts or in `public/*.jsx` (file:line cited in an HTML comment where a selector is not a Contract fact). Selector preference, in descending order: `data-screen-label` attribute → visible button text → CSS class. The reference implementation for selector anchoring is [`e2e_test.cjs`](e2e_test.cjs).

## Preamble

- **Start the server** on a throwaway port so you never collide with a human's `npm run dev` or with `npm test` (which spawns its own server): `PORT=3005 npm run dev` (or any free port — pick one and use it everywhere below). `npm run dev` runs `node --watch server.js` (`package.json:10`); it prints a listen banner. Wait for the banner before driving the UI. If `JWT_SECRET` is unset the server logs a startup warning but still boots.
- **Unique usernames**: use `ui_<timestamp>` (e.g. `ui_$(date +%s)`) for every run so you never trip the "User already exists" path unintentionally, and so leaderboard assertions are unambiguous. Use a password ≥ 8 chars for happy paths (e.g. `uitest1234`).
- **Base URL**: `http://127.0.0.1:<PORT>/` for the browser; `http://127.0.0.1:<PORT>/api/...` for `curl`.
- **Console-error watch**: from the very first `page.goto`, attach `page.on("console")` (type `error`) and `page.on("pageerror")` listeners and accumulate into arrays. Several checks below depend on this; keep the same page/tab alive across the whole playthrough so the watch covers everything.
- **Resilience**: if a `data-screen-label` selector is missing, fall back to the visible text named in each check before falling back to a class. Never assert on a selector you have not first waited for.

<!-- Selectors verified against public/*.jsx:
  data-screen-label values: "00 Menu" (app.jsx:17), "01 Profile" (phase1-profile.jsx:15),
  "02 Tier" (phase2-tier.jsx:38), "03 Schools" (phase3-school.jsx:176), "04 Reveal" (phase4-results.jsx:235).
  Auth screen has NO data-screen-label; detect via h1 "Admissions Oracle" + input[placeholder="your_username"] (auth.jsx:73,109).
-->

---

## 1. Boot server + API sanity

### Check 1.1 — Server boots and serves the SPA
- **Purpose**: confirm the listen banner and that `/` returns the HTML app (not an API error).
- **Invocation**: `PORT=3005 npm run dev` (background it / use a long-running process); then `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3005/`.
- **PASS**: HTTP `200` and the body contains `<div id="root">` (the SPA mount point). The server stdout contains a listen banner mentioning the port.

### Check 1.2 — `/api/profiles` returns a non-empty array
- **Purpose**: the game content loaded at startup (`data/profiles.jsonl` read into memory).
- **Invocation**: `curl -s http://127.0.0.1:3005/api/profiles`.
- **PASS**: JSON array with `length >= 1`. Each element has an `id` (string) and `demographics` object. (Server strips `application_results` from the list payload — `server.js:159-165`.)

### Check 1.3 — Unknown `/api/*` returns 404 JSON, not the SPA
- **Purpose**: the catch-all API 404 returns JSON, never the HTML app (`server.js:235`).
- **Invocation**: `curl -s -w "\n%{http_code}" http://127.0.0.1:3005/api/nope`.
- **PASS**: status `404` and body is exactly `{"error":"Not found"}` (JSON, not HTML). Confirm `Content-Type` is `application/json`.

### Check 1.4 — Register validation 400s (direct API, no UI)
- **Purpose**: server enforces username and password rules before any DB write (`server.js:86-90`).
- **Invocations** (all via `curl -s -w "\n%{http_code}" -X POST http://127.0.0.1:3005/api/register -H 'Content-Type: application/json' -d '<body>'`):
  - Bad username (too short / illegal chars): `-d '{"username":"ab","password":"validpass1"}'` and `-d '{"username":"foo bar","password":"validpass1"}'`.
  - Bad password (7 chars): `-d '{"username":"ui_shortpw","password":"1234567"}'`.
  - Bad password (73 chars): a 73-char string.
- **PASS**: every one returns status `400` with JSON body `{"error":"..."}`. Specifically: short/illegal username → `"Username must be 3-20 characters: letters, numbers, or underscore"`; password outside 8–72 → `"Password must be between 8 and 72 characters"`.

### Check 1.5 — Duplicate registration is rejected
- **Purpose**: unique-username constraint surfaces as a clear 400 (`server.js:101-102`).
- **Invocation**: register once with a fresh `ui_<timestamp>` (expect 200 + `{token, username, scores}`), then `curl` the same `register` body again.
- **PASS**: second call returns `400` with `{"error":"User already exists"}`.

---

## 2. Auth UI — happy + sad paths

Open `http://127.0.0.1:3005/` in the browser (`waitUntil: "domcontentloaded"`). The auth screen is detected by `input[placeholder="your_username"]` (`auth.jsx:109`); it has no `data-screen-label`.

### Check 2.1 — Auth screen renders
- **Purpose**: the unauthenticated landing screen is present.
- **Invocation**: `page.waitForSelector('input[placeholder="your_username"]')`; `page.evaluate(() => document.querySelector('h1')?.textContent)`.
- **PASS**: the username input exists and an `h1` contains `Admissions Oracle` (`auth.jsx:73`).

### Check 2.2 — Register happy path reaches the menu
- **Purpose**: a fresh account lands on the applicant menu.
- **Invocation**:
  1. Click the toggle button whose trimmed text is exactly `Create account` (`auth.jsx:100`) — `page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Create account').click())`.
  2. Wait for `input[placeholder="Same password again"]` (`auth.jsx:135`) — the confirm field only exists in register mode.
  3. Type `ui_<timestamp>` into `input[placeholder="your_username"]`; type the password into the first `input[type="password"]` and again into the second (`auth.jsx:120,133`). There are exactly two password inputs in register mode.
  4. Click `button.btn-primary` (`auth.jsx:157`) and race it against `page.waitForSelector('[data-screen-label="00 Menu"]')`.
- **PASS**: `[data-screen-label="00 Menu"]` is present (`app.jsx:17`).

### Check 2.3 — Duplicate-register sad path shows the error inline
- **Purpose**: re-registering the just-created username shows a clear error, no crash.
- **Invocation**: log out (topbar `Log out` button, `app.jsx:227`), switch to `Create account`, fill the *same* username + password, click submit.
- **PASS**: the auth screen's error area renders text containing `User already exists` (rendered from the 400 body at `auth.jsx:47`); the page stays on the auth screen (no `[data-screen-label]` appears, no navigation).

### Check 2.4 — Bad-password sad path (server message)
- **Purpose**: a 7-char password surfaces the server's 8–72 rule.
- **Invocation**: still on auth, register mode, enter a fresh username + a 7-char password + same confirm, click submit.
- **PASS**: error area renders text containing `Password must be between 8 and 72 characters`; stays on auth screen.

### Check 2.5 — Bad-username sad path (server message)
- **Purpose**: an illegal username surfaces the server's 3–20 rule.
- **Invocation**: register mode, enter `foo bar` (spaces) as username + valid password + confirm, click submit.
- **PASS**: error area renders text containing `Username must be 3-20 characters: letters, numbers, or underscore`; stays on auth screen.

### Check 2.6 — Login happy path
- **Purpose**: logging back in with the account from 2.2 reaches the menu and restores prior scores.
- **Invocation**: log out, switch to `Log in` toggle (`auth.jsx:90`), type the username + password (now a single `input[type="password"]`), click `button.btn-primary`, wait for `[data-screen-label="00 Menu"]`.
- **PASS**: menu appears. If a score was already committed for this user, the header rank chip shows the same total points as before logout (persistence via `localStorage` keys `ao_token` / `ao_username`, `app.jsx:6-7`).

---

## 3. All four game phases (data-screen-label gates + stable text)

Drive a full playthrough on the account from 2.2/2.6. Keep the console/pageerror listeners attached throughout.

### Check 3.1 — Phase 0 menu
- **Purpose**: applicant list renders with the expected card shape.
- **Invocation**: `page.waitForSelector('[data-screen-label="00 Menu"] .school-card')` (`app.jsx:27`); `page.evaluate(() => [...document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')].map(c => c.querySelector('.name')?.textContent))`.
- **PASS**: at least one card; first card `.name` matches `/^Applicant 01 — /` (`app.jsx:29`); each unplayed card shows an `Unplayed` badge (`app.jsx:38`).

### Check 3.2 — Phase 0 → Phase 1
- **Purpose**: selecting an applicant opens the profile viewer.
- **Invocation**: click the first `[data-screen-label="00 Menu"] .school-card`; race against `page.waitForSelector('[data-screen-label="01 Profile"]')`.
- **PASS**: `[data-screen-label="01 Profile"]` present (`phase1-profile.jsx:15`).

### Check 3.3 — Phase 1 tabs render content
- **Purpose**: Overview / Academics / Extracurriculars tabs all show non-empty panes.
- **Invocation**: for each tab label in `["Overview","Academics","Extracurriculars"]` (`phase1-profile.jsx:40-42`), `page.evaluate` to click the `button[role="tab"]` whose text equals the label, then assert the tab pane below has non-empty `innerText` (no blank pane).
- **PASS**: all three tabs switch and each pane's trimmed `innerText.length > 0`.

### Check 3.4 — Phase 1 → Phase 2
- **Purpose**: "Start guessing" advances to the tier screen.
- **Invocation**: `page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Start guessing')))` (`phase1-profile.jsx:30`); click it; race against `page.waitForSelector('[data-screen-label="02 Tier"]')`.
- **PASS**: `[data-screen-label="02 Tier"]` present; `h2` text is `Predict the ceiling` (`phase2-tier.jsx:44`).

### Check 3.5 — Phase 2: pick a University tier
- **Purpose**: a Uni tier can be selected.
- **Invocation**: within `[data-screen-label="02 Tier"]`, find the `.card` whose text includes `Panel A` (`phase2-tier.jsx:57`), then the `button` whose text contains `HYPSM` (a `TierPickCard`, `phase2-tier.jsx:129`; `HYPSM` is the first entry of `UNI_TIER_LIST`, `tiers.js:3`). Click it. Assert the clicked button's inline `style.border` contains `accent-info-bd` and `style.background` contains `accent-info-bg` — the active tokens set at `phase2-tier.jsx:133-134`.
- **PASS**: the HYPSM button's inline style switched to the active tokens (inactive border is `var(--border-1)`, active is `var(--accent-info-bd)`). Note: `TierPickCard` does **not** set `aria-pressed` — assert on the inline style, not on an attribute that is absent.

### Check 3.6 — Phase 2: toggle the no-LAC claim
- **Purpose**: the dashed "no LAC admit" card greys out the LAC grid.
- **Invocation**: `page.waitForFunction(() => [...document.querySelectorAll('[data-screen-label="02 Tier"] div[role="button"]')].some(d => d.textContent.includes('Applicant was not admitted to any LAC')))` (`phase2-tier.jsx:93-105`); click that `div[role="button"]`.
- **PASS**: the no-LAC card gains class `is-selected` (`phase2-tier.jsx:94`), and the LAC grid container has `opacity: 0.4` and `pointerEvents: none` (`phase2-tier.jsx:78`) — assert via `getComputedStyle` on the grid, or simply that no LAC `TierPickCard` button's inline `style.border` contains `accent-info-bd` (none is active).

### Check 3.7 — Phase 2 → Phase 3
- **Purpose**: "Lock in predictions" is enabled only once a Uni tier and (an LAC tier or the no-LAC claim) are set, and advances to the school screen.
- **Invocation**: `page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Lock in predictions') && !b.disabled))` (`phase2-tier.jsx:117-120`); click it; race against `page.waitForSelector('[data-screen-label="03 Schools"]')`.
- **PASS**: `[data-screen-label="03 Schools"]` present (`phase3-school.jsx:176`); `h2` text is `Which ones did they get in?` (`phase3-school.jsx:181`).

### Check 3.8 — Phase 3: badges reflect the pick; schools toggle
- **Purpose**: the school grid is scoped to the chosen bands and cards toggle selected state.
- **Invocation**:
  - Assert a badge with text `University tier · HYPSM` and a badge `LAC · Claimed no admit` are present (`phase3-school.jsx:186-188`).
  - With the no-LAC claim set, assert the LAC section is replaced by the "skipped" callout (`phase3-school.jsx:200-207`) — i.e. no LAC `SchoolCard` is rendered.
  - Click a Universities `div.school-card[role="button"]` (`phase3-school.jsx:310`) and assert it gains class `is-selected`; click again and assert it loses `is-selected`.
- **PASS**: both badges present; LAC callout present; a Uni school card toggles `is-selected` on/off.

### Check 3.9 — Phase 3 → Phase 4
- **Purpose**: "Reveal results" advances to the verdict (no selection required).
- **Invocation**: `page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Reveal results')))` (`phase3-school.jsx:230`); click it; race against `page.waitForSelector('[data-screen-label="04 Reveal"]')`.
- **PASS**: `[data-screen-label="04 Reveal"]` present (`phase4-results.jsx:235`); `h2` text is `The verdict` (`phase4-results.jsx:241`).

### Check 3.10 — Phase 4: score + accuracy render
- **Purpose**: the reveal shows an animated points number and accuracy percentage.
- **Invocation**: `page.waitForSelector('[data-screen-label="04 Reveal"] .score-pop .num')` (`phase4-results.jsx:250-251`); `page.waitForFunction(() => { const t = (document.querySelector('[data-screen-label="04 Reveal"] .score-pop .num')||{}).textContent||''; return /^[+-]?\d+$/.test(t.trim()); })` (the `AnimatedNum` eases 0→target; wait for a stable integer — pattern from `e2e_test.cjs:275-285`). Then read the `Accuracy` `.score-pop` text (`phase4-results.jsx:259-260`).
- **PASS**: "Points earned" `.score-pop .num` matches `/^[+-]?\d+$/`; "Accuracy" `.score-pop` text matches `/^\d+%$/`.

### Check 3.11 — Phase 4: tier results + school-by-school breakdown render
- **Purpose**: the verdict shows tier-band results and per-school rows.
- **Invocation**: `page.evaluate` over `[data-screen-label="04 Reveal"]` to confirm both a tier-results block (University + LAC rows, `phase4-results.jsx:281-284`) and a school-by-school breakdown (Universities / LACs sections) have non-empty `innerText`.
- **PASS**: both sections present with non-empty text.

---

## 4. Navigation / persistence

### Check 4.1 — Topbar Menu returns to the applicant list
- **Purpose**: from any phase > 0, the topbar Menu button goes back to Phase 0.
- **Invocation** (do this from Phase 4): `page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim()==='Menu'))` (`app.jsx:221-222`, rendered only when `phase>0`); click it; race against `page.waitForSelector('[data-screen-label="00 Menu"]')`.
- **PASS**: `[data-screen-label="00 Menu"]` present.

### Check 4.2 — Hard reload keeps the session
- **Purpose**: JWT in `localStorage` survives a full page reload.
- **Invocation**: record the header rank chip's points text before reload; `page.reload({ waitUntil: 'domcontentloaded' })`; wait for `[data-screen-label="00 Menu"]` (the app re-hydrates from `localStorage` and re-validates via `/api/me`, `app.jsx:65-77`).
- **PASS**: still on the menu (not bounced to auth); rank chip shows the same total points as before reload.

### Check 4.3 — Leaderboard contains the run's user
- **Purpose**: the committed score appears on the global leaderboard with a `you` tag.
- **Invocation**: click the topbar `Leaderboard` button (`app.jsx:211-212`); wait for `h2` text `Global leaderboard` (`app.jsx:329`); `page.evaluate` over the leaderboard rows to find the row whose username equals the run's `ui_<timestamp>` (`app.jsx:334-355`).
- **PASS**: a row exists with `username === <run user>`, a `games` count `>= 1`, a numeric `total`, and a `you` tag (`app.jsx:349`). Cross-check via `curl -s http://127.0.0.1:3005/api/leaderboard` (`server.js:202`) — the same row must appear in the JSON.

---

## 5. Console-error watch

### Check 5.1 — Zero pageerrors after a full playthrough
- **Purpose**: no uncaught exceptions during the entire flow from 2.1 through 4.3.
- **Invocation**: after Check 4.3, read the accumulated `pageErrors` array (listener attached at the first `page.goto`, `e2e_test.cjs:133` pattern).
- **PASS**: `pageErrors.length === 0`.

### Check 5.2 — No console errors of type "error"
- **Purpose**: no `console.error` output during the playthrough.
- **Invocation**: read the accumulated `consoleErrors` array (type `"error"` only, `e2e_test.cjs:130-132` pattern).
- **PASS**: `consoleErrors.length === 0`. (If non-empty, record the messages as evidence; a benign Babel/React dev warning may warrant a note rather than a hard fail — use judgment, but treat any stack-traced runtime error as a FAIL.)

---

## 6. Visual spot-check (screenshots)

Capture one screenshot per phase plus the auth and leaderboard screens. Save to a run-scoped directory (e.g. `shots/ui_<timestamp>/`). Look for layout regressions, not just element presence.

### Check 6.1 — Auth screen
- **Invocation**: `page.screenshot` on the auth screen.
- **Look for**: centered card, "Admissions Oracle" wordmark, Log in / Create account toggle, username + password fields.

### Check 6.2 — Phase 0 menu
- **Invocation**: screenshot `[data-screen-label="00 Menu"]`.
- **Look for**: "Select an Applicant" heading, a grid of applicant cards each with `Applicant 0N — <id>`, demographics line, and an `Unplayed` badge.

### Check 6.3 — Phase 1 profile
- **Invocation**: screenshot `[data-screen-label="01 Profile"]`.
- **Look for**: tabs Overview / Academics / Extracurriculars, the "Start guessing" button top-right, no blank panes.

### Check 6.4 — Phase 2 tier
- **Invocation**: screenshot `[data-screen-label="02 Tier"]` after picking HYPSM + no-LAC claim.
- **Look for**: "Predict the ceiling", Panel A with HYPSM highlighted, Panel B LAC grid greyed out, the dashed no-LAC card checked, "Lock in predictions" enabled.

### Check 6.5 — Phase 3 schools
- **Invocation**: screenshot `[data-screen-label="03 Schools"]`.
- **Look for**: `University tier · HYPSM` and `LAC · Claimed no admit` badges, the Universities grid, the LAC "skipped" callout, a toggled school card showing its selected state.

### Check 6.6 — Phase 4 reveal
- **Invocation**: screenshot `[data-screen-label="04 Reveal"]` after the score animation settles.
- **Look for**: "The verdict", the large "Points earned" number and "Accuracy" percentage, tier-results row, school-by-school breakdown.

### Check 6.7 — Leaderboard
- **Invocation**: screenshot the leaderboard screen.
- **Look for**: "Global leaderboard", the run's user row highlighted with a `you` tag, games count and points total.

- **PASS (6.1–6.7)**: each screenshot exists and shows the expected screen with no obvious layout breakage (overflow, blank card, missing heading). Record the file path as evidence.

---

## 7. Automated gate

### Check 7.1 — `npm test` passes
- **Purpose**: the self-contained Puppeteer harness passes end-to-end (spawns its own server on a free port, registers a throwaway `e2e_<timestamp>` user, drives all four phases, asserts the leaderboard row).
- **Invocation**: `npm test` (runs `node e2e_test.cjs`, `package.json:7`). Do not set `PORT` — the harness picks a free port itself. It writes to the real `data/game.db` with unique usernames, so it is safe to re-run.
- **PASS**: every step prints `[e2e] PASS …` and the run ends with `[e2e] ALL STEPS PASSED` and exit code `0` (`e2e_test.cjs:329`).

---

## Results report

Fill this in as you run each check. Append the screenshot paths and any curl response bodies / error messages under "Evidence".

| Check | Status (PASS/FAIL) | Evidence |
|---|---|---|
| 1.1 Server boots + SPA 200 | | |
| 1.2 /api/profiles non-empty | | |
| 1.3 /api/nope 404 JSON | | |
| 1.4 Register validation 400s | | |
| 1.5 Duplicate register 400 | | |
| 2.1 Auth screen renders | | |
| 2.2 Register → menu | | |
| 2.3 Duplicate-register error | | |
| 2.4 Bad-password error | | |
| 2.5 Bad-username error | | |
| 2.6 Login → menu | | |
| 3.1 Phase 0 menu | | |
| 3.2 Phase 0 → Phase 1 | | |
| 3.3 Phase 1 tabs | | |
| 3.4 Phase 1 → Phase 2 | | |
| 3.5 Phase 2 Uni tier | | |
| 3.6 Phase 2 no-LAC claim | | |
| 3.7 Phase 2 → Phase 3 | | |
| 3.8 Phase 3 badges + toggle | | |
| 3.9 Phase 3 → Phase 4 | | |
| 3.10 Phase 4 score + accuracy | | |
| 3.11 Phase 4 breakdown | | |
| 4.1 Topbar Menu | | |
| 4.2 Hard reload authed | | |
| 4.3 Leaderboard has run user | | |
| 5.1 Zero pageerrors | | |
| 5.2 Zero console errors | | |
| 6.1–6.7 Visual spot-check | | |
| 7.1 npm test passes | | |
