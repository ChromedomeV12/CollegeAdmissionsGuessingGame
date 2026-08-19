# Agent Acceptance Checklist

Executable checks for the current Admissions Oracle product. Use a throwaway port and unique username; `e2e_test.cjs` is the authoritative automated flow.

## Preamble

- Start with `PORT=<free-port> npm run dev`; wait for the listen banner.
- Use a username no longer than 20 characters, e.g. `ui` plus the last 10 timestamp digits, and a password of 8–72 characters.
- Attach `pageerror` and `console`-error listeners before the first navigation. Keep the same page through the flow.
- The browser screen gates are `Home`, `00 Menu`, `01 Profile`, `02 Tier`, `03 Schools`, and `04 Reveal` via `data-screen-label`.
- `npm test` and manual runs write uniquely named users/scores to the real `data/game.db`; never assert global row counts.

## 1. Server and API

### 1.1 Boot and routing

- `GET /` → HTTP 200 and HTML containing `<div id="root">`.
- `GET /api/profiles` → non-empty JSON array; list records have IDs but no `application_results` or `source`.
- `GET /api/nope` and `GET /api/seasons` → HTTP 404 JSON `{"error":"Not found"}`, never SPA HTML.

### 1.2 Auth validation

- Invalid username (`ab` or `foo bar`) → HTTP 400 with the 3–20-character message.
- Password shorter than 8 or longer than 72 → HTTP 400 with the password-range message.
- Registering the same valid username twice → second request HTTP 400 `User already exists`.
- Successful register/login responses contain `token`, `username`, and `scores`.

### 1.3 Maintainer submission gate

With default `SUBMISSIONS_ENABLED=false`:

- authenticated `GET /api/submissions/config` reports `enabled: false`;
- authenticated `GET /api/submissions` and mutation routes return HTTP 503 `Submission tools are disabled`;
- the player UI contains no Submission Center or Submit-a-post navigation.

### 1.4 Lock protection

After `POST /api/locks` with a profile ID:

- `GET /api/locks` includes that ID;
- `POST /api/scores` for that ID returns HTTP 409 `Profile locked — practice only`.

## 2. Auth and signed-in Home

1. Open `/`; confirm the auth screen and register a fresh user.
2. **PASS:** registration lands on `[data-screen-label="Home"]`, not the applicant menu.
3. Confirm Home explains the four-step rules, credits both authors, links to `https://github.com/ChromedomeV12/CollegeAdmissionsGuessingGame`, and has a Play action.
4. Toggle Tokyo Night/Day; reload. **PASS:** Home remains visible and `document.documentElement.dataset.theme` equals `localStorage.ao_theme`.
5. Click Play. **PASS:** `[data-screen-label="00 Menu"] .school-card` appears.
6. On a desktop viewport, confirm `.topbar.is-active-round` stays one row during a case, has no Submit-a-post control, and creates no horizontal overflow.

## 3. New case, hidden reveal, and retry

### 3.1 Profile and answer gating

1. Open an unplayed card; wait for `01 Profile`.
2. Confirm Overview, Academics, and Extracurriculars tabs render non-empty panes.
3. **PASS:** no `Correct choices` tab exists before finalization.
4. Click Start guessing; wait for `02 Tier`.

### 3.2 Both no-admit claims

1. Select `Applicant was not admitted to any T50 University` and `Applicant was not admitted to any T20 LAC`.
2. **PASS:** both claim controls have `aria-pressed="true"`; both tier grids are visually disabled and ignore pointer input.
3. **PASS:** Lock in predictions is enabled with the two claims and no tier-band selection.
4. Lock; wait for `03 Schools`. Confirm both claim badges and both skipped-category callouts appear.

### 3.3 First reveal leaks no answers

1. Click Reveal results; wait for `04 Reveal`.
2. **PASS:** aggregate cards `Case score`, `Accuracy`, and `Time` render, and score is an integer 0–100.
3. **PASS:** a button matches `Retry case ([1-5]s)`.
4. **PASS:** `Tier results`, `School-by-school`, final decision/banner, admitted schools, teaching points, and rank detail are absent.
5. Click Retry before expiry; wait for `02 Tier`.

### 3.4 Retry is the final scoring attempt

1. Make any valid second prediction and reveal again.
2. Wait until `Tier results` and `.final-banner` appear.
3. **PASS:** full result detail is visible, no Retry case button remains, and the score stays within 0–100.
4. Return with the topbar Menu control; wait for `00 Menu`.
5. **PASS:** the finalized card shows `Practice`; `.check.is-complete` uses Tokyo green `#587539` (computed `rgb(88, 117, 57)`).

Also exercise the timeout branch once: do not click Retry. After five seconds the first attempt must finalize and reveal detail; no later Retry action may appear.

## 4. Permanent practice and Correct choices

1. Reopen a finalized profile.
2. **PASS:** `Correct choices` is now a fourth profile tab and states the file is finalized/no longer affects score.
3. Start a practice round and reveal.
4. **PASS:** full details appear immediately, no Retry button is offered, and the backend score does not change.
5. Reload/login again. **PASS:** the lock, Practice badge, green check, and Correct choices access persist.

## 5. Scoring edge cases

- Verify school selection uses rounded 70-point Jaccard overlap over visible schools.
- Verify University and LAC distance ladders return 15/9/5/0 for distance 0/1/2/other.
- Verify a lower predicted band still receives distance credit when the applicant's best admit is higher; it is not forced to zero merely because that admit was not the best one.
- Verify each no-admit claim returns 15 only when its category has no configured admit, otherwise 0.
- Verify every composed case score is an integer from 0 through 100.

## 6. Global leaderboard and rivals

Finalize five distinct profiles for the throwaway user, then open Leaderboard.

- **PASS:** heading is `Global leaderboard`; no season selector/text and no `/api/seasons` dependency exists.
- **PASS:** every `.leaderboard-grid` uses the same computed grid template; header is `Rank | Player | Avg | Cases | Best` and all cells share the intended left alignment.
- **PASS:** the current user row has a `you` chip, numeric average/best, and at least five cases; `/api/leaderboard` contains the same row.
- **PASS:** Rivalry / `Head-to-head on shared cases` UI is present.
- Add a known username through `/api/rivals`, open `/api/duel/:username`, and confirm the comparison includes only profile IDs completed by both users. Remove it through `DELETE /api/rivals/:username`.

## 7. Visual and accessibility checks

Capture Home, Menu, all four phases, first reveal, final reveal, Correct choices, and Leaderboard in Tokyo Night and Day.

- Film/grain is visible over the sculpted wallpaper but below content; cards/topbar remain smoother, higher-opacity matte glass.
- Wallpaper retains six broad organic folds, crest highlights, deep valleys, ≤64px scroll and ≤8px pointer parallax, hidden-tab pause, and static reduced-motion fallback; no grid/contour/particle layer returns.
- Desktop active-round topbar stays single-row. Mobile layouts remain readable and free of horizontal overflow.
- Focus rings, keyboard-operable claim/cards, semantic labels, and documented Tokyo contrast pairs remain intact.
- Completion green is exact Tokyo `#587539`, not palette-unrelated green.

## 8. Automated gate

Run:

```bash
npm test
```

**PASS:** unit tests finish with zero failures; e2e logs Home/theme persistence, five aggregate-only first reveals, five finalized retries, permanent practice/Correct choices, global rivalry UI with no seasons, valid leaderboard API data, and `ALL STEPS PASSED`.

## Results report

| Area | Status | Evidence |
|---|---|---|
| Server/API/auth validation | | |
| Submission disabled gate | | |
| Home/theme persistence | | |
| Both no-admit claims | | |
| First reveal answer concealment | | |
| Retry + timeout finalization | | |
| Permanent practice/Correct choices | | |
| Scoring edge cases | | |
| Global leaderboard/rivals | | |
| Tokyo visual/accessibility checks | | |
| `npm test` | | |
