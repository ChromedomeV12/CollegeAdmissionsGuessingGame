# Human Acceptance Checklist

Manual verification of the post-revamp Admissions Oracle. Work top to bottom; each box is a single observable result. UI labels quoted below were checked against [`public/*.jsx`](public/app.jsx).

## 1. Setup (~2 min)

- [ ] Copy [`.env.example`](.env.example) → `.env`.
- [ ] Fill `JWT_SECRET=` using the documented one-liner: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (shown in `.env.example`).
- [ ] `npm install` finishes with no errors.
- [ ] `npm run dev` prints a listen banner; open <http://localhost:3005> and the auth screen ("Admissions Oracle", "Log in" / "Create account" toggle) renders.

## 2. Auth

- [ ] Switch to **Create account**, enter a fresh username + password (≥8 chars) + confirm, click **Create account** → land on the **Select an Applicant** menu.
- [ ] Register again with the *same* username → expect a clear "User already exists" error, no crash.
- [ ] Try a bad password (e.g. 7 chars): expect a clear server error ("Password must be between 8 and 72 characters"), no crash. (Passwords shorter than 6 chars are blocked locally with "Password must be at least 6 characters.")
- [ ] Try a bad username (spaces, e.g. `foo bar`, or too short, e.g. `ab`): expect a clear server error ("Username must be 3-20 characters: letters, numbers, or underscore"), no crash.
- [ ] Click **Log out** in the topbar → returns to the auth screen.
- [ ] Log back in with the same credentials → menu returns; previously earned points reappear in the header rank chip.

## 3. Game flow (all 4 phases)

- [ ] **Phase 0** menu: heading "Select an Applicant"; 8 applicant cards labeled `Applicant 01 — <id>` … each showing gender · ethnicity and a "Unplayed" badge.
- [ ] Click a card → **Phase 1** profile viewer; the tabs **Overview**, **Academics**, **Extracurriculars** all render content with no blank panes.
- [ ] Click **Start guessing** (top-right) → **Phase 2** "Predict the ceiling".
- [ ] In **Panel A · University tier** pick a University tier (e.g. `HYPSM`).
- [ ] In **Panel B · Liberal Arts College tier** toggle the dashed "Applicant was not admitted to any LAC" card → LAC grid greys out / becomes unclickable.
- [ ] Click **Lock in predictions** (enabled only once a Uni tier and either an LAC tier or the no-LAC claim are set) → **Phase 3** "Which ones did they get in?".
- [ ] School grid shows only the bands from your pick; badges read `University tier · <pick>` and `LAC · Claimed no admit`. Select then deselect a few schools (cards toggle a check/selected state).
- [ ] Click **Reveal results** → **Phase 4** "The verdict".
- [ ] The **Points earned** number animates in (score-pop); **Accuracy** animates to a percentage.
- [ ] **Tier results** row (University + LAC) and the **School-by-school** breakdown (Universities / LACs sections) both render.

## 4. Navigation / persistence

- [ ] From any phase > 0, the topbar **Menu** button returns to the **Select an Applicant** list.
- [ ] Hard-refresh the page (Ctrl/Cmd+R) while logged in → still logged in, menu reappears, and the header rank chip shows the same total points as before.
- [ ] Click **Leaderboard** in the topbar → "Global leaderboard" lists your username with a `you` tag, a games count ≥ 1, and a points total.

## 5. Error paths

- [ ] Stop the server (`Ctrl+C`) and reload the page → the app shows an error state (the red error card from [`app.jsx`](public/app.jsx)), not a blank white page. Clicking through still shows that error, not a crash.
- [ ] With the server running, visit <http://localhost:3005/api/nope> → response body is JSON `{"error":"Not found"}`, not the HTML app.

## 6. Automated

- [ ] `npm test` runs the self-contained Puppeteer harness in [`e2e_test.cjs`](e2e_test.cjs): every step prints `[e2e] PASS …` and the run ends with `[e2e] ALL STEPS PASSED` (exit code 0).

## 7. Data pipeline (optional — costs OpenRouter API credits)

- [ ] `npm run scrape -- --url <a r/collegeresults post URL>` fetches the Reddit post, calls the LLM extractor, and writes a pending profile. On failure it prints a clear status + body snippet, not an opaque crash.
- [ ] `npm run approve` promotes the pending profile into the live data set so it appears in the **Select an Applicant** menu.
