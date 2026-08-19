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

    async function clickButton(label, exact = true) {
      await page.waitForFunction(
        (wanted, exactMatch) => [...document.querySelectorAll("button")].some((button) => {
          const text = (button.textContent || "").trim();
          return exactMatch ? text === wanted : text.includes(wanted);
        }),
        { timeout: SHORT_TIMEOUT_MS },
        label,
        exact,
      );
      await page.evaluate((wanted, exactMatch) => {
        const button = [...document.querySelectorAll("button")].find((candidate) => {
          const text = (candidate.textContent || "").trim();
          return exactMatch ? text === wanted : text.includes(wanted);
        });
        if (!button) throw new Error(`Button "${wanted}" not found`);
        button.click();
      }, label, exact);
    }

    async function startGuessing() {
      await clickButton("Start guessing");
      await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
    }

    async function selectNoAdmitClaims() {
      const claimLabels = [
        "Applicant was not admitted to any T50 University",
        "Applicant was not admitted to any T20 LAC",
      ];
      for (const label of claimLabels) {
        await page.waitForFunction(
          (wanted) => [...document.querySelectorAll('[data-screen-label="02 Tier"] [role="button"]')]
            .some((claim) => (claim.textContent || "").includes(wanted)),
          { timeout: SHORT_TIMEOUT_MS },
          label,
        );
        await page.evaluate((wanted) => {
          const claim = [...document.querySelectorAll('[data-screen-label="02 Tier"] [role="button"]')]
            .find((candidate) => (candidate.textContent || "").includes(wanted));
          if (!claim) throw new Error(`Claim "${wanted}" not found`);
          if (claim.getAttribute("aria-pressed") !== "true") claim.click();
        }, label);
        await page.waitForFunction(
          (wanted) => [...document.querySelectorAll('[data-screen-label="02 Tier"] [role="button"]')]
            .some((claim) => (claim.textContent || "").includes(wanted) && claim.getAttribute("aria-pressed") === "true"),
          { timeout: SHORT_TIMEOUT_MS },
          label,
        );
      }
    }

    async function revealWithNoAdmitClaims() {
      await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
      await selectNoAdmitClaims();
      await page.waitForFunction(
        () => [...document.querySelectorAll("button")]
          .some((button) => (button.textContent || "").includes("Lock in predictions") && !button.disabled),
        { timeout: SHORT_TIMEOUT_MS },
      );
      await Promise.all([
        page.waitForSelector('[data-screen-label="03 Schools"]', { timeout: POLL_TIMEOUT_MS }),
        clickButton("Lock in predictions"),
      ]);
      await Promise.all([
        page.waitForSelector('[data-screen-label="04 Reveal"]', { timeout: POLL_TIMEOUT_MS }),
        clickButton("Reveal results"),
      ]);
    }

    async function readCaseScore(profileIdx) {
      await page.waitForSelector('[data-screen-label="04 Reveal"] .score-pop .num', { timeout: SHORT_TIMEOUT_MS });
      await page.waitForFunction(
        () => {
          const value = (document.querySelector('[data-screen-label="04 Reveal"] .score-pop .num')?.textContent || "").trim();
          if (!/^\d{1,3}$/.test(value)) return false;
          const score = Number(value);
          return Number.isInteger(score) && score >= 0 && score <= 100;
        },
        { timeout: SHORT_TIMEOUT_MS },
      );
      const score = await page.$eval(
        '[data-screen-label="04 Reveal"] .score-pop .num',
        (element) => Number((element.textContent || "").trim()),
      );
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        throw new Error(`Reveal score out of range for profile #${profileIdx}: ${score}`);
      }
      return score;
    }

    // ── Step 1: Register -> signed-in Home -> Play -> applicant menu ───────
    await page.waitForSelector('input[placeholder="your_username"]', { timeout: POLL_TIMEOUT_MS });
    await clickButton("Create account");
    await page.waitForSelector('input[placeholder="Same password again"]', { timeout: SHORT_TIMEOUT_MS });

    await page.type('input[placeholder="your_username"]', username);
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs.length < 2) throw new Error("Expected two password inputs in register mode");
    await pwdInputs[0].type(password);
    await pwdInputs[1].type(password);

    const submitBtn = await page.$("button.btn-primary");
    if (!submitBtn) throw new Error("Register submit button not found");
    await Promise.all([
      page.waitForSelector('[data-screen-label="Home"]', { timeout: POLL_TIMEOUT_MS }),
      submitBtn.click(),
    ]);
    log("PASS registered and opened signed-in Home");

    // Theme persistence remains covered on the new signed-in landing screen.
    const themeBefore = await page.evaluate(() => document.documentElement.dataset.theme || "dark");
    const expectedTheme = themeBefore === "light" ? "dark" : "light";
    await page.click('[aria-label="Toggle theme"]');
    await page.waitForFunction(
      (expected) => document.documentElement.dataset.theme === expected && localStorage.getItem("ao_theme") === expected,
      { timeout: SHORT_TIMEOUT_MS },
      expectedTheme,
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-screen-label="Home"]', { timeout: POLL_TIMEOUT_MS });
    const persistedTheme = await page.evaluate(() => ({
      attr: document.documentElement.dataset.theme,
      stored: localStorage.getItem("ao_theme"),
    }));
    if (persistedTheme.attr !== expectedTheme || persistedTheme.stored !== expectedTheme) {
      throw new Error(`Theme did not persist after reload: ${JSON.stringify(persistedTheme)}`);
    }
    log(`PASS theme toggled ${themeBefore} -> ${expectedTheme} and persisted on Home`);

    await clickButton("Play");
    await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });
    log("PASS Home Play action opened the applicant menu");

    // ── Step 2: Finalize five distinct scored cases through the one retry ──
    const NUM_PROFILES = 5;
    if (profiles.length < NUM_PROFILES) {
      throw new Error(`Need at least ${NUM_PROFILES} distinct profiles, found ${profiles.length}`);
    }
    const playedProfileIds = new Set();

    for (let profileIdx = 0; profileIdx < NUM_PROFILES; profileIdx++) {
      await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: SHORT_TIMEOUT_MS });
      const selectedProfileId = await page.evaluate((idx) => {
        const cards = document.querySelectorAll('[data-screen-label="00 Menu"] .school-card');
        const card = cards[idx];
        if (!card) throw new Error(`Profile card ${idx} not found; menu has ${cards.length}`);
        const id = (card.querySelector(".name")?.textContent || "").trim();
        card.click();
        return id;
      }, profileIdx);
      if (!selectedProfileId || playedProfileIds.has(selectedProfileId)) {
        throw new Error(`Profile #${profileIdx} was not distinct: "${selectedProfileId}"`);
      }
      playedProfileIds.add(selectedProfileId);
      await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });

      if (profileIdx === 0) {
        const correctChoicesPremature = await page.evaluate(() =>
          [...document.querySelectorAll('[data-screen-label="01 Profile"] button')]
            .some((button) => (button.textContent || "").trim() === "Correct choices")
        );
        if (correctChoicesPremature) throw new Error("Correct choices were visible before the case was finalized");
      }

      await startGuessing();
      await revealWithNoAdmitClaims();

      // First reveal exposes only aggregate score cards and the five-second
      // retry action. Outcome details must remain hidden during this window.
      const firstScore = await readCaseScore(profileIdx);
      await page.waitForFunction(
        () => [...document.querySelectorAll('[data-screen-label="04 Reveal"] button')]
          .some((button) => /^Retry case \([1-5]s\)$/.test((button.textContent || "").trim())),
        { timeout: SHORT_TIMEOUT_MS },
      );
      const firstRevealGate = await page.evaluate(() => {
        const screen = document.querySelector('[data-screen-label="04 Reveal"]');
        const text = screen?.textContent || "";
        return {
          hasAggregates: ["Case score", "Accuracy", "Time"].every((label) => text.includes(label)),
          hasDetails: text.includes("Tier results") || text.includes("School-by-school") || !!screen?.querySelector(".final-banner"),
          retryText: [...(screen?.querySelectorAll("button") || [])]
            .map((button) => (button.textContent || "").trim())
            .find((label) => label.startsWith("Retry case (")) || "",
        };
      });
      if (!firstRevealGate.hasAggregates || firstRevealGate.hasDetails || !/^Retry case \([1-5]s\)$/.test(firstRevealGate.retryText)) {
        throw new Error(`First reveal gate failed for profile #${profileIdx}: ${JSON.stringify(firstRevealGate)}`);
      }
      log(`PASS [profile #${profileIdx}] first reveal aggregate-only, score=${firstScore}, ${firstRevealGate.retryText}`);

      await clickButton("Retry case (", false);
      await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
      await revealWithNoAdmitClaims();

      // The retry is the final scoring attempt. Await the persisted lock and
      // the resulting detailed verdict before navigating away.
      await page.waitForFunction(
        () => {
          const screen = document.querySelector('[data-screen-label="04 Reveal"]');
          const text = screen?.textContent || "";
          return text.includes("Tier results") && !!screen?.querySelector(".final-banner");
        },
        { timeout: POLL_TIMEOUT_MS },
      );
      const finalScore = await readCaseScore(profileIdx);
      const retryStillVisible = await page.evaluate(() =>
        [...document.querySelectorAll('[data-screen-label="04 Reveal"] button')]
          .some((button) => (button.textContent || "").includes("Retry case ("))
      );
      if (retryStillVisible) throw new Error(`Retry remained available after profile #${profileIdx} finalization`);
      log(`PASS [profile #${profileIdx}] retry finalized with full details, score=${finalScore}`);

      await clickButton("Menu");
      await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });

      const practiceBadgeVisible = await page.evaluate((idx) => {
        const card = document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx];
        return !!card && [...card.querySelectorAll(".badge")]
          .some((badge) => (badge.textContent || "").trim() === "Practice");
      }, profileIdx);
      if (!practiceBadgeVisible) throw new Error(`Finalized profile #${profileIdx} was not marked Practice in the menu`);

      // Exercise one locked profile end-to-end as practice. Its profile shows
      // Correct choices, and its reveal skips the scoring retry entirely.
      if (profileIdx === 0) {
        await page.evaluate((idx) => {
          const card = document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx];
          if (!card) throw new Error(`Practice card ${idx} not found`);
          card.click();
        }, profileIdx);
        await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });
        await page.waitForFunction(
          () => [...document.querySelectorAll('[data-screen-label="01 Profile"] button')]
            .some((button) => (button.textContent || "").trim() === "Correct choices"),
          { timeout: POLL_TIMEOUT_MS },
        );
        await clickButton("Correct choices");
        await page.waitForFunction(
          () => (document.querySelector('[data-screen-label="01 Profile"]')?.textContent || "")
            .includes("This file is finalized and no longer affects your score."),
          { timeout: SHORT_TIMEOUT_MS },
        );

        await startGuessing();
        await revealWithNoAdmitClaims();
        await page.waitForFunction(
          () => {
            const screen = document.querySelector('[data-screen-label="04 Reveal"]');
            return !!screen?.querySelector(".final-banner") && (screen.textContent || "").includes("Tier results");
          },
          { timeout: POLL_TIMEOUT_MS },
        );
        const practiceHasRetry = await page.evaluate(() =>
          [...document.querySelectorAll('[data-screen-label="04 Reveal"] button')]
            .some((button) => (button.textContent || "").includes("Retry case ("))
        );
        if (practiceHasRetry) throw new Error("Practice reveal incorrectly offered a scoring retry");
        log("PASS locked profile opened practice with Correct choices and full no-retry reveal");

        await clickButton("Menu");
        await page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS });
      }
    }

    if (playedProfileIds.size !== NUM_PROFILES) {
      throw new Error(`Expected ${NUM_PROFILES} distinct finalized cases, got ${playedProfileIds.size}`);
    }

    // ── Step 3: Global leaderboard UI has no season dependency ─────────────
    await clickButton("Leaderboard");
    await page.waitForFunction(
      () => [...document.querySelectorAll("h2")]
        .some((heading) => (heading.textContent || "").trim() === "Global leaderboard"),
      { timeout: POLL_TIMEOUT_MS },
    );
    await page.waitForFunction(
      (wanted) => [...document.querySelectorAll(".leaderboard-grid")]
        .some((row) => (row.textContent || "").includes(wanted)),
      { timeout: POLL_TIMEOUT_MS },
      username,
    );

    const leaderboardUi = await page.evaluate((wanted) => {
      const grids = [...document.querySelectorAll(".leaderboard-grid")];
      const header = grids.find((grid) => (grid.textContent || "").includes("Rank") && (grid.textContent || "").includes("Player"));
      const row = grids.find((grid) => [...grid.children]
        .some((cell) => (cell.textContent || "").includes(wanted)));
      const cells = row ? [...row.children].map((cell) => (cell.textContent || "").trim()) : [];
      const bodyText = document.body.textContent || "";
      return {
        header: header ? [...header.children].map((cell) => (cell.textContent || "").trim()) : [],
        row: cells,
        hasYouTag: !!row && [...row.querySelectorAll(".chip")].some((chip) => (chip.textContent || "").trim() === "you"),
        hasRivalry: bodyText.includes("Rivalry") && bodyText.includes("Head-to-head on shared cases"),
        hasSeason: /\bseason\b/i.test(bodyText) || document.querySelectorAll("select").length > 0,
      };
    }, username);
    if (leaderboardUi.header.join("|") !== "Rank|Player|Avg|Cases|Best") {
      throw new Error(`Unexpected global leaderboard columns: ${JSON.stringify(leaderboardUi.header)}`);
    }
    if (leaderboardUi.row.length !== 5 || !leaderboardUi.hasYouTag) {
      throw new Error(`Current user row missing or malformed: ${JSON.stringify(leaderboardUi)}`);
    }
    const uiAvg = Number.parseFloat(leaderboardUi.row[2]);
    const uiGames = Number(leaderboardUi.row[3]);
    const uiBest = Number(leaderboardUi.row[4]);
    if (!Number.isFinite(uiAvg) || uiGames < NUM_PROFILES || !Number.isFinite(uiBest)) {
      throw new Error(`Global avg/games/best invalid: ${JSON.stringify(leaderboardUi.row)}`);
    }
    if (!leaderboardUi.hasRivalry || leaderboardUi.hasSeason) {
      throw new Error(`Leaderboard rivalry/season gate failed: ${JSON.stringify(leaderboardUi)}`);
    }
    log(`PASS global leaderboard UI: avg=${uiAvg}, games=${uiGames}, best=${uiBest}, rivalry visible, no seasons`);

    // Preserve the API cross-check for this unique user after five distinct
    // finalized cases, now including the global best field.
    let row = null;
    const lbStart = Date.now();
    while (Date.now() - lbStart < 15000) {
      const lb = await fetchJson(port, "/api/leaderboard");
      row = lb.find((candidate) => candidate && candidate.username === username) || null;
      if (row && Number(row.games) >= NUM_PROFILES) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!row) throw new Error(`User "${username}" not found on /api/leaderboard after 15s`);
    const games = Number(row.games);
    const avg = Number(row.avg);
    const best = Number(row.best);
    if (games < NUM_PROFILES || !Number.isFinite(avg) || !Number.isFinite(best)) {
      throw new Error(`Leaderboard avg/games/best invalid for "${username}": ${JSON.stringify(row)}`);
    }
    log(`PASS leaderboard API: ${username} games=${games} avg=${avg} best=${best}`);

    const lbRecheck = await fetchJson(port, "/api/leaderboard");
    const rowRecheck = lbRecheck.find((candidate) => candidate && candidate.username === username) || null;
    if (!rowRecheck) throw new Error(`Cross-check: "${username}" missing from /api/leaderboard re-fetch`);
    if (Number(rowRecheck.games) < NUM_PROFILES || !Number.isFinite(Number(rowRecheck.avg)) || !Number.isFinite(Number(rowRecheck.best))) {
      throw new Error(`Cross-check: avg/games/best invalid (row=${JSON.stringify(rowRecheck)})`);
    }
    log("PASS cross-checked global /api/leaderboard JSON for", username);

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
