#!/usr/bin/env node
// e2e_test.cjs — self-contained CommonJS Puppeteer end-to-end harness for
// Admissions Oracle. Spins up server.js on a free port, drives the full
// play flow in a headless browser, and asserts the run lands on the
// leaderboard. Run with: node e2e_test.cjs

"use strict";

const net = require("net");
const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const puppeteer = require("puppeteer");

const REPO_DIR = __dirname;
const POLL_TIMEOUT_MS = 30000; // generous: in-browser Babel compile + fetch
const SHORT_TIMEOUT_MS = 15000;

// ─── helpers ────────────────────────────────────────────────────────────────

function log(...args) {
  console.log("[e2e]", ...args);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

// GET /api/profiles until it returns 200, or timeout.
function waitForServer(port, timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get(
        { hostname: "127.0.0.1", port, path: "/api/profiles", timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) return resolve();
          if (Date.now() - start > timeoutMs)
            return reject(new Error(`Server up but /api/profiles returned ${res.statusCode}`));
          setTimeout(attempt, 300);
        }
      );
      req.on("error", () => {
        if (Date.now() - start > timeoutMs)
          return reject(new Error("Server never came up on port " + port));
        setTimeout(attempt, 300);
      });
      req.on("timeout", () => req.destroy());
    }
    attempt();
  });
}

function fetchJson(port, p) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: "127.0.0.1", port, path: p, timeout: 5000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`GET ${p} -> ${res.statusCode}: ${body}`));
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`GET ${p} bad JSON: ${body.slice(0, 200)}`));
        }
      });
    }).on("error", reject);
  });
}

// ─── main ───────────────────────────────────────────────────────────────────

// Module-scope diagnostics so the top-level catch handler can report them
// even when main() throws before they'd be captured in local scope.
let consoleErrors = [];
let pageErrors = [];
let serverStdout = "";
let serverStderr = "";

async function main() {
  const port = await getFreePort();
  log("Using port", port);

  // Spawn server.js with PORT env. type:module ESM — just `node server.js`.
  const serverProc = spawn("node", ["server.js"], {
    cwd: REPO_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      REDDIT_CLIENT_ID: "",
      REDDIT_CLIENT_SECRET: "",
      REDDIT_REDIRECT_URI: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc.stdout.on("data", (d) => (serverStdout += d.toString()));
  serverProc.stderr.on("data", (d) => (serverStderr += d.toString()));
  serverProc.on("exit", (code, sig) => {
    if (!serverExitedCleanly && code !== null && sig === null) {
      // unexpected early exit will surface where it matters; recorded for dump
    }
    log("server process exited code=%s sig=%s", code, sig);
  });
  let serverExitedCleanly = false;

  const username = `e2e_${Date.now()}`;
  const password = "e2etest1234";

  let browser;

  try {
    await waitForServer(port);
    log("PASS server ready on port", port);

    // Sanity: API shapes before UI drive.
    const profiles = await fetchJson(port, "/api/profiles");
    if (!Array.isArray(profiles) || profiles.length === 0)
      throw new Error(`/api/profiles returned no profiles: ${JSON.stringify(profiles).slice(0, 200)}`);
    if (profiles.some((profile) => profile && ("source" in profile || "application_results" in profile)))
      throw new Error("Profile list leaked source metadata or hidden results");
    const fullProfile = await fetchJson(port, `/api/profiles/${encodeURIComponent(profiles[0].id)}`);
    if (fullProfile && "source" in fullProfile)
      throw new Error("Full profile endpoint leaked source metadata");
    log("PASS /api/profiles returned", profiles.length, "profiles");

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(POLL_TIMEOUT_MS);
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err && err.message ? err.message : String(err)));

    const base = `http://127.0.0.1:${port}/`;
    await page.goto(base, { waitUntil: "domcontentloaded" });
    log("PASS page loaded", base);

    // ── Step 1: Register ────────────────────────────────────────────────────
    // AuthScreen (public/auth.jsx). Starts in "login" mode. Switch to register
    // via the toggle button whose exact text is "Create account". In login mode
    // the submit button reads "Log in", so the only button with exact text
    // "Create account" is the toggle (auth.jsx ~line 100).
    await page.waitForSelector('input[placeholder="your_username"]', { timeout: POLL_TIMEOUT_MS });
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const t = btns.find((b) => b.textContent.trim() === "Create account");
      if (!t) throw new Error("Create account toggle not found");
      t.click();
    });
    log("PASS switched to register mode");

    // Confirm-password field only exists in register mode; use it as the gate.
    await page.waitForSelector('input[placeholder="Same password again"]', { timeout: SHORT_TIMEOUT_MS });

    await page.type('input[placeholder="your_username"]', username);
    // Two password inputs now exist: [0]=password, [1]=confirm.
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs.length < 2) throw new Error("Expected 2 password inputs in register mode, got " + pwdInputs.length);
    await pwdInputs[0].type(password);
    await pwdInputs[1].type(password);
    log("PASS filled register form for", username);

    // Submit via the .btn-primary button (auth.jsx ~line 157-164). In register
    // mode its label is "Create account"; selecting by class avoids colliding
    // with the toggle button which has no class.
    const submitBtn = await page.$("button.btn-primary");
    if (!submitBtn) throw new Error("Submit button.btn-primary not found");
    await Promise.all([
      // After successful register, onLogin -> auth set -> profiles fetched ->
      // Phase0Menu renders with data-screen-label="00 Menu".
      page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS }),
      submitBtn.click(),
    ]);
    log("PASS registered + reached Phase0 menu");

    // ── Step 1b: Edit-code fallback submission flow ───────────────────────
    // Server is spawned with REDDIT_* envs forced empty, so the submission
    // center runs in fallback mode: a local ORACLE-XXXXXX proof code is issued
    // with no Reddit network call. We drive the issue flow but stop before
    // confirm (which would hit real Reddit).
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.includes("Submit a post"));
      if (!button) throw new Error("Submit a post navigation button not found");
      button.click();
    });
    await page.waitForSelector('[data-screen-label="Submission Center"]', { timeout: POLL_TIMEOUT_MS });
    await page.waitForSelector('#reddit-post-url', { timeout: SHORT_TIMEOUT_MS });
    // (i) Fallback banner is visible and mentions the edit-code path.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-screen-label="Submission Center"]');
        return el && /edit-code/i.test(el.textContent);
      },
      { timeout: SHORT_TIMEOUT_MS }
    );
    log("PASS fallback banner visible (edit-code)");

    // Track any outbound Reddit requests so we can prove the proof code is
    // generated locally, not via a Reddit round-trip.
    const redditRequests = [];
    page.on("request", (req) => {
      const u = req.url();
      if (/(?:^|\.)reddit\.com|redd\.it/i.test(u)) redditRequests.push(u);
    });

    // (ii) Type a canonical Reddit URL and toggle consent → verify enables.
    // Post ID must be unique per run: reddit_post_id is globally UNIQUE and
    // cross-user duplicates are correctly rejected with a 409, so a fixed
    // fixture ID would fail every run after the first.
    const fixturePostId = 'e2e' + Math.random().toString(36).slice(2, 8);
    await page.type('#reddit-post-url', `https://www.reddit.com/r/collegeresults/comments/${fixturePostId}/a_case/`);
    await page.click('.consent-card input');
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-screen-label="Submission Center"] button[type="submit"]');
        return btn && !btn.disabled;
      },
      { timeout: SHORT_TIMEOUT_MS }
    );
    log("PASS verify button enabled after URL + consent");

    // (iii) Click verify → local proof code rendered, no Reddit network call.
    await Promise.all([
      page.waitForSelector('[data-proof-code]', { timeout: POLL_TIMEOUT_MS }),
      page.click('[data-screen-label="Submission Center"] button[type="submit"]'),
    ]);
    const proofCode = await page.$eval('[data-proof-code]', (el) => (el.textContent || "").trim());
    if (!/^ORACLE-[A-Z0-9]{6}$/.test(proofCode))
      throw new Error(`Expected local proof code matching /^ORACLE-[A-Z0-9]{6}$/, got "${proofCode}"`);
    if (redditRequests.length > 0)
      throw new Error(`Fallback issue made Reddit network calls (no key configured): ${redditRequests.join(", ")}`);
    log("PASS local proof code issued:", proofCode, "(no Reddit network call)");

    // (iv) Do NOT click confirm — that would fetch the real Reddit post.
    log("PASS stopped before confirm (would hit real Reddit)");

    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Game");
      if (!button) throw new Error("Game navigation button not found");
      button.click();
    });
    await page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS });
    log("PASS returned to game from submission center");

    // ── Step 2: Select FIRST profile (Phase0Menu) ───────────────────────────
    // app.jsx Phase0Menu: each profile is div.card.school-card with onClick.
    // Scope to the menu screen so we don't match school cards elsewhere.
    await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: SHORT_TIMEOUT_MS });
    await page.evaluate(() => {
      const card = document.querySelector('[data-screen-label="00 Menu"] .school-card');
      if (!card) throw new Error("First profile card not found in menu");
      card.click();
    });
    // Selecting a profile calls resetForProfile() -> setPhase(1) -> Phase1Profile.
    await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });
    log("PASS selected first profile, reached Phase1 viewer");

    // ── Step 3: Phase1 -> Phase2 via "Start guessing" button ────────────────
    // phase1-profile.jsx ~line 30: <Btn onClick={onStart} iconRight="arrow-right">Start guessing</Btn>
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Start guessing")),
      { timeout: SHORT_TIMEOUT_MS }
    );
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Start guessing"));
      if (!b) throw new Error("Start guessing button not found");
      b.click();
    });
    await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
    log("PASS advanced to Phase2 tier selection");

    // ── Step 4: Phase2 — pick a University tier + no-LAC claim, then lock ───
    // phase2-tier.jsx: Panel A ("Panel A · University tier") holds TierPickCard
    // <button>s for UNI_TIER_LIST = [HYPSM, T10, T15, T20, T30, T50]. Click the
    // first one (HYPSM) to set universityTierPick.
    await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: SHORT_TIMEOUT_MS });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-screen-label="02 Tier"] .card')];
      const panelA = cards.find((c) => c.textContent.includes("Panel A"));
      if (!panelA) throw new Error("Panel A (University tier) not found");
      const btn = panelA.querySelector("button");
      if (!btn) throw new Error("No university tier button in Panel A");
      btn.click();
    });
    log("PASS picked first university tier (HYPSM)");

    // No-LAC claim: phase2-tier.jsx ~line 93-110, a div[role="button"] whose
    // text contains "Applicant was not admitted to any LAC". Clicking toggles
    // noLacClaim=true and clears lacTierPick.
    await page.waitForFunction(
      () => [...document.querySelectorAll('[data-screen-label="02 Tier"] div[role="button"]')]
        .some((d) => d.textContent.includes("Applicant was not admitted to any LAC")),
      { timeout: SHORT_TIMEOUT_MS }
    );
    await page.evaluate(() => {
      const claim = [...document.querySelectorAll('[data-screen-label="02 Tier"] div[role="button"]')]
        .find((d) => d.textContent.includes("Applicant was not admitted to any LAC"));
      if (!claim) throw new Error("No-LAC claim control not found");
      claim.click();
    });
    log("PASS toggled no-LAC claim");

    // Lock button: <Btn onClick={onLock} iconRight="lock">Lock in predictions</Btn>
    // disabled until universityTierPick && (lacTierPick || noLacClaim). Wait for
    // it to be enabled, then click. onLock fetches /api/profiles/:id then
    // setPhase(3).
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some(
        (b) => b.textContent.includes("Lock in predictions") && !b.disabled
      ),
      { timeout: SHORT_TIMEOUT_MS }
    );
    await Promise.all([
      page.waitForSelector('[data-screen-label="03 Schools"]', { timeout: POLL_TIMEOUT_MS }),
      page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Lock in predictions"));
        if (!b) throw new Error("Lock in predictions button not found");
        b.click();
      }),
    ]);
    log("PASS locked tiers, reached Phase3 school selection");

    // ── Step 5: Phase3 -> Phase4 via "Reveal results" (no picks required) ────
    // phase3-school.jsx ~line 230: <Btn onClick={onReveal} iconRight="sparkles">Reveal results</Btn>
    // onReveal just setPhase(4); no disabled gate on school selections.
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Reveal results")),
      { timeout: SHORT_TIMEOUT_MS }
    );
    await Promise.all([
      page.waitForSelector('[data-screen-label="04 Reveal"]', { timeout: POLL_TIMEOUT_MS }),
      page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Reveal results"));
        if (!b) throw new Error("Reveal results button not found");
        b.click();
      }),
    ]);
    log("PASS revealed results, reached Phase4");

    // ── Step 6: Confirm Phase4 shows a points number ────────────────────────
    // phase4-results.jsx ~line 248-257: <div class="label">Points earned</div>
    // then <div class="score-pop"> with <span class="num"> (AnimatedNum).
    await page.waitForSelector('[data-screen-label="04 Reveal"] .score-pop .num', { timeout: SHORT_TIMEOUT_MS });
    // AnimatedNum eases 0->target over 900ms; wait for a stable integer.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-screen-label="04 Reveal"] .score-pop .num');
        if (!el) return false;
        const t = (el.textContent || "").trim();
        return /^[+-]?\d+$/.test(t);
      },
      { timeout: SHORT_TIMEOUT_MS }
    );
    const pointsText = await page.evaluate(
      () => (document.querySelector('[data-screen-label="04 Reveal"] .score-pop .num') || {}).textContent || ""
    );
    log("PASS Phase4 shows points:", pointsText.trim());

    // ── Step 7: Return to menu via topbar "Menu" button ─────────────────────
    // app.jsx ~line 222: <button ... onClick={goNextProfile}><i class="ti ti-list"/> Menu</button>
    // (only rendered when phase>0). goNextProfile -> setPhase(0); setProfileIdx(null).
    await page.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Menu"),
      { timeout: SHORT_TIMEOUT_MS }
    );
    await Promise.all([
      page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS }),
      page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Menu");
        if (!b) throw new Error("Menu button not found");
        b.click();
      }),
    ]);
    log("PASS returned to Phase0 menu");

    // ── Step 8: Assert leaderboard row for our user with games >= 1 ─────────
    // Phase4 mount commits score via POST /api/scores (fire-and-forget fetch in
    // app.jsx commitScore). Poll /api/leaderboard until our row appears.
    let row = null;
    const lbStart = Date.now();
    while (Date.now() - lbStart < 15000) {
      const lb = await fetchJson(port, "/api/leaderboard");
      row = lb.find((r) => r && r.username === username) || null;
      if (row && Number(row.games) >= 1) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!row) {
      throw new Error(`User "${username}" not found on /api/leaderboard after 15s`);
    }
    const games = Number(row.games);
    const total = Number(row.total || 0);
    if (games < 1) {
      throw new Error(`Leaderboard row for "${username}" has games=${games}, expected >=1 (row=${JSON.stringify(row)})`);
    }
    log(`PASS leaderboard: ${username} games=${games} total=${total}`);

    log("ALL STEPS PASSED");
    return 0;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    serverExitedCleanly = true;
    try { serverProc.kill("SIGTERM"); } catch (_) {}
    // Give it a moment to die, then SIGKILL if needed.
    await new Promise((r) => setTimeout(r, 300));
    try {
      if (!serverProc.killed) serverProc.kill("SIGKILL");
    } catch (_) {}
  }
}

main()
  .then((code) => {
    process.exit(code || 0);
  })
  .catch(async (err) => {
    console.error("[e2e] FAIL:", err && err.stack ? err.stack : err);
    if (consoleErrors.length) {
      console.error("[e2e] page console errors:\n" + consoleErrors.map((e) => "  - " + e).join("\n"));
    }
    if (pageErrors.length) {
      console.error("[e2e] page errors:\n" + pageErrors.map((e) => "  - " + e).join("\n"));
    }
    if (serverStderr) {
      console.error("[e2e] server stderr:\n" + serverStderr.slice(-3000));
    }
    if (serverStdout) {
      console.error("[e2e] server stdout (tail):\n" + serverStdout.slice(-1500));
    }
    process.exit(1);
  });
