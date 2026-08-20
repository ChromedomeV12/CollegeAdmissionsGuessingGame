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
const assert = require("assert");

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

function requestJson(port, p, { method = "GET", token, body, headers: extraHeaders } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = body === undefined ? null : JSON.stringify(body);
    const headers = { Accept: "application/json", ...(extraHeaders || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (encoded !== null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(encoded);
    }
    const req = http.request({ hostname: "127.0.0.1", port, path: p, method, headers, timeout: 5000 }, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; }
        catch (_) { return reject(new Error(`${method} ${p} bad JSON: ${raw.slice(0, 200)}`)); }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error(`${method} ${p} timed out`)));
    if (encoded !== null) req.write(encoded);
    req.end();
  });
}

async function fetchJson(port, p, options) {
  const response = await requestJson(port, p, options);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${options?.method || "GET"} ${p} -> ${response.status}: ${JSON.stringify(response.data)}`);
  }
  return response.data;
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
    if (profiles.some((profile) => profile && ("source" in profile || "application_results" in profile || "game_metadata" in profile)))
      throw new Error("Profile list leaked source metadata, hidden results, or outcome hints");
    const anonymousDetail = await requestJson(port, `/api/profiles/${encodeURIComponent(profiles[0].id)}`);
    if (anonymousDetail.status !== 401 && anonymousDetail.status !== 403) {
      throw new Error(`Premature full profile request was not denied: ${anonymousDetail.status}`);
    }
    log("PASS full profile endpoint denied anonymous answer access");
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
    await page.evaluate(() => localStorage.removeItem("ao_lang"));
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    await page.click('[data-testid="language-toggle"]');
    await page.waitForFunction(() => document.documentElement.lang === "zh-CN" && localStorage.ao_lang === "zh-CN");
    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.evaluate(() => document.documentElement.lang), "zh-CN");
    await page.click('[data-testid="language-toggle"]');
    await page.waitForFunction(() => document.documentElement.lang === "en" && localStorage.ao_lang === "en");

    async function clickTestId(testId) {
      await page.waitForSelector(`[data-testid="${testId}"]`, { timeout: SHORT_TIMEOUT_MS });
      await page.click(`[data-testid="${testId}"]`);
    }

    async function startGuessing() {
      await clickTestId("phase-start");
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
        () => {
          const button = document.querySelector('[data-testid="phase-lock"]');
          return !!button && !button.disabled;
        },
        { timeout: SHORT_TIMEOUT_MS },
      );
      await Promise.all([
        page.waitForSelector('[data-screen-label="03 Schools"]', { timeout: POLL_TIMEOUT_MS }),
        clickTestId("phase-lock"),
      ]);
      await Promise.all([
        page.waitForSelector('[data-screen-label="04 Reveal"]', { timeout: POLL_TIMEOUT_MS }),
        clickTestId("phase-reveal"),
      ]);
    }
    async function revealWithTierPicks(universityTier, lacTier) {
      await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
      await page.evaluate((uni, lac) => {
        const pick = (selector, wanted) => {
          const button = [...document.querySelectorAll(selector)]
            .find((candidate) => (candidate.querySelector(".tname")?.textContent || "").trim() === wanted);
          if (!button) throw new Error(`Tier pick ${wanted} not found`);
          button.click();
        };
        pick(".tier-grid--uni button", uni);
        pick(".tier-grid--lac button", lac);
      }, universityTier, lacTier);
      await Promise.all([
        page.waitForSelector('[data-screen-label="03 Schools"]', { timeout: POLL_TIMEOUT_MS }),
        clickTestId("phase-lock"),
      ]);
      await Promise.all([
        page.waitForSelector('[data-screen-label="04 Reveal"]', { timeout: POLL_TIMEOUT_MS }),
        clickTestId("phase-reveal"),
      ]);
    }


    async function readCaseScore(profileIdx, expected = null) {
      if (Number.isInteger(expected)) {
        await page.waitForFunction((wanted) => Number((document.querySelector('[data-screen-label="04 Reveal"] .score-pop .num')?.textContent || "").trim()) === wanted,
          { timeout: SHORT_TIMEOUT_MS }, expected);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
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
    await page.waitForSelector("#auth-username", { timeout: POLL_TIMEOUT_MS });
    await clickTestId("auth-mode-register");
    await page.waitForSelector("#auth-confirm", { timeout: SHORT_TIMEOUT_MS });

    await page.type("#auth-username", username);
    const pwdInputs = await page.$$('input[type="password"]');
    if (pwdInputs.length < 2) throw new Error("Expected two password inputs in register mode");
    await pwdInputs[0].type(password);
    await pwdInputs[1].type(password);

    const submitBtn = await page.$('[data-testid="auth-submit"]');
    if (!submitBtn) throw new Error("Register submit button not found");
    await Promise.all([
      page.waitForSelector('[data-screen-label="Home"]', { timeout: POLL_TIMEOUT_MS }),
      submitBtn.click(),
    ]);
    log("PASS registered and opened signed-in Home");
    const token = await page.evaluate(() => localStorage.getItem("ao_token"));
    if (!token) throw new Error("Registration did not persist an auth token");
    const prematureDetail = await requestJson(port, `/api/profiles/${encodeURIComponent(profiles[0].id)}`, { token });
    if (prematureDetail.status !== 403) {
      throw new Error(`Authenticated unfinalized profile detail was not denied: ${prematureDetail.status}`);
    }
    log("PASS authenticated unfinalized answer access denied");

    const disabledSubmissions = await requestJson(port, "/api/submissions", { token });
    if (disabledSubmissions.status !== 503 || disabledSubmissions.data?.error !== "Submission tools are disabled") {
      throw new Error(`Default submission gate failed: ${JSON.stringify(disabledSubmissions)}`);
    }
    log("PASS submission tools default to disabled");


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

    await clickTestId("home-play");
    await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });
    log("PASS Home Play action opened the applicant menu");

    // A failed authoritative reveal write must disclose neither answers nor a
    // lock/score. Preserve this injected persistence regression at the API
    // boundary rather than the removed direct score endpoint.
    let failNextRevealWrite = false;
    let legacyMutationPosts = 0;
    const attemptMutationPaths = [];
    const detailRequestPaths = [];
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "POST" && (url.pathname === "/api/scores" || url.pathname === "/api/locks")) {
        legacyMutationPosts += 1;
      }
      if (request.method() === "POST" && url.pathname.startsWith("/api/attempts/")) {
        attemptMutationPaths.push(url.pathname);
      }
      if (request.method() === "GET" && /^\/api\/profiles\/[^/]+$/.test(url.pathname)) {
        detailRequestPaths.push(url.pathname);
      }
      if (request.method() === "POST" && /\/api\/attempts\/[^/]+\/reveal$/.test(url.pathname) && failNextRevealWrite) {
        failNextRevealWrite = false;
        request.respond({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Injected reveal persistence failure" }),
        });
        return;
      }
      request.continue();
    });
    const observedRevealResponses = [];
    page.on("response", async (response) => {
      try {
        const url = new URL(response.url());
        if (/\/api\/attempts\/[^/]+\/reveal$/.test(url.pathname)) {
          observedRevealResponses.push({ status: response.status(), body: await response.json() });
        }
      } catch (_) {}
    });

    const failureCardIndex = profiles.length - 1;
    const failureProfileId = profiles[failureCardIndex].id;
    await page.evaluate((idx) => {
      const card = document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx];
      if (!card) throw new Error(`Failure-path profile card ${idx} not found`);
      card.click();
    }, failureCardIndex);
    await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });
    await startGuessing();
    await selectNoAdmitClaims();
    await Promise.all([
      page.waitForSelector('[data-screen-label="03 Schools"]', { timeout: POLL_TIMEOUT_MS }),
      clickTestId("phase-lock"),
    ]);
    failNextRevealWrite = true;
    await clickTestId("phase-reveal");
    await page.waitForSelector('[role="alert"]', { timeout: SHORT_TIMEOUT_MS });
    await new Promise((resolve) => setTimeout(resolve, 5500));
    const failedWriteState = await page.evaluate(() => ({
      hasSaveError: document.body.textContent.includes("Could not save this reveal"),
      hasDetails: document.body.textContent.includes("Tier results") || !!document.querySelector(".final-banner"),
    }));
    const failedLocks = await fetchJson(port, "/api/locks", { token });
    const failedMe = await fetchJson(port, "/api/me", { token });
    if (!failedWriteState.hasSaveError || failedWriteState.hasDetails || failedLocks.includes(failureProfileId) || failedMe.scores?.[failureProfileId] !== undefined) {
      throw new Error(`Reveal failure disclosed or persisted state: ${JSON.stringify({ ...failedWriteState, failedLocks, score: failedMe.scores?.[failureProfileId] })}`);
    }
    consoleErrors = consoleErrors.filter((message) => !message.includes("Injected reveal persistence failure"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-screen-label="Home"]', { timeout: POLL_TIMEOUT_MS });
    await clickTestId("home-play");
    await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });
    log("PASS failed reveal write blocked answer disclosure and backend lock/score");
    const escapeCardIndex = profiles.length - 2;
    const escapeProfileId = profiles[escapeCardIndex].id;
    const pageStartsBeforeEscape = attemptMutationPaths.filter((pathname) => pathname === "/api/attempts/start").length;
    await page.evaluate((idx) => document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx].click(), escapeCardIndex);
    await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });
    await startGuessing();
    await page.keyboard.press("Escape");
    await page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS });
    const pageStartsAfterEscape = attemptMutationPaths.filter((pathname) => pathname === "/api/attempts/start").length;
    if (pageStartsAfterEscape !== pageStartsBeforeEscape + 1) throw new Error("Escape created an unexpected client attempt count");
    const escapeLocks = await fetchJson(port, "/api/locks", { token });
    const escapeMe = await fetchJson(port, "/api/me", { token });
    if (escapeLocks.includes(escapeProfileId) || escapeMe.scores?.[escapeProfileId] !== undefined) {
      throw new Error("Escape persisted an unscored attempt");
    }
    const escapeProbe = await fetchJson(port, "/api/attempts/start", {
      method: "POST", token, body: { profileId: escapeProfileId },
    });
    await fetchJson(port, `/api/attempts/${encodeURIComponent(escapeProbe.attemptId)}/abandon`, { method: "POST", token });
    log("PASS Escape abandoned the guess without score, lock, or stale attempt");


    // ── Step 2: Finalize five distinct cases across retry, timeout, reload ──
    const NUM_PROFILES = 5;
    if (profiles.length < NUM_PROFILES) {
      throw new Error(`Need at least ${NUM_PROFILES} distinct profiles, found ${profiles.length}`);
    }
    const playedProfileIds = new Set();
    const expectedResultKeys = ["accuracy", "lacPts", "rawScore", "score", "selectionPts", "timeFactor", "timeSeconds", "uniPts"];

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
          !!document.querySelector('[data-testid="correct-choices-tab"]')
        );
        if (correctChoicesPremature) throw new Error("Correct choices were visible before the case was finalized");
      }

      const detailRequestsBeforeReveal = detailRequestPaths.length;
      const pendingResponseOffset = observedRevealResponses.length;
      await startGuessing();
      await revealWithNoAdmitClaims();
      await page.waitForSelector('[data-testid="retry-case"]', { timeout: SHORT_TIMEOUT_MS });

      const responseDeadline = Date.now() + SHORT_TIMEOUT_MS;
      let pendingResponse = null;
      while (Date.now() < responseDeadline && !pendingResponse) {
        pendingResponse = observedRevealResponses.slice(pendingResponseOffset)
          .find((entry) => entry.status === 200 && entry.body?.finalized === false) || null;
        if (!pendingResponse) await new Promise((resolve) => setTimeout(resolve, 25));
      }
      if (!pendingResponse) throw new Error(`Missing pending reveal response for profile #${profileIdx}`);
      const resultKeys = Object.keys(pendingResponse.body.result || {}).sort();
      const firstScore = pendingResponse.body.result.score;
      const firstUiScore = await readCaseScore(profileIdx, firstScore);
      if (firstUiScore !== firstScore) throw new Error(`UI/server first score mismatch: ${firstUiScore} vs ${firstScore}`);
      if (JSON.stringify(resultKeys) !== JSON.stringify(expectedResultKeys)) {
        throw new Error(`Pending reveal leaked or omitted result fields: ${JSON.stringify(resultKeys)}`);
      }

      const firstRevealGate = await page.evaluate(() => {
        const screen = document.querySelector('[data-screen-label="04 Reveal"]');
        const text = screen?.textContent || "";
        const scoreCard = screen?.querySelector(".score-pop")?.closest(".card");
        const grid = scoreCard?.parentElement;
        const retry = screen?.querySelector('[data-testid="retry-case"]');
        const scoreStyle = scoreCard ? getComputedStyle(scoreCard) : null;
        return {
          hasAggregates: ["Case score", "Accuracy", "Time"].every((label) => text.includes(label)),
          hasDetails: text.includes("Tier results") || text.includes("School-by-school") || !!screen?.querySelector(".final-banner"),
          retryText: (retry?.textContent || "").trim(),
          visual: !!scoreCard && getComputedStyle(grid).display === "grid"
            && Number.parseFloat(scoreStyle.borderRadius) > 0
            && retry.getBoundingClientRect().height >= 30,
        };
      });
      if (!firstRevealGate.hasAggregates || firstRevealGate.hasDetails || !firstRevealGate.visual
          || !/^Retry case \([1-5]s\)$/.test(firstRevealGate.retryText)) {
        throw new Error(`First reveal gate failed for profile #${profileIdx}: ${JSON.stringify(firstRevealGate)}`);
      }

      if (detailRequestPaths.length !== detailRequestsBeforeReveal) {
        throw new Error(`Client requested full profile details before finalization for profile #${profileIdx}`);
      }
      let finalScore = firstScore;
      let alreadyAtMenu = false;
      if (profileIdx === 0) {
        await clickTestId("retry-case");
        await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
        await revealWithTierPicks("T50", "T5 LAC");
        await page.waitForFunction(() => {
          const screen = document.querySelector('[data-screen-label="04 Reveal"]');
          return (screen?.textContent || "").includes("Tier results") && !!screen?.querySelector(".final-banner");
        }, { timeout: POLL_TIMEOUT_MS });
        finalScore = await readCaseScore(profileIdx);
        if (finalScore >= firstScore) {
          throw new Error(`Exact retry replacement was not lower: first=${firstScore}, second=${finalScore}`);
        }
        log(`PASS lower second result replaced first exactly (${firstScore} -> ${finalScore})`);
      } else if (profileIdx === 1) {
        await page.waitForFunction(() => {
          const screen = document.querySelector('[data-screen-label="04 Reveal"]');
          return (screen?.textContent || "").includes("Tier results") && !!screen?.querySelector(".final-banner");
        }, { timeout: POLL_TIMEOUT_MS });
        finalScore = await readCaseScore(profileIdx);
        if (finalScore !== firstScore) throw new Error(`Timeout changed first result: ${firstScore} -> ${finalScore}`);
        log("PASS retry timeout finalized the first server result");
      } else if (profileIdx === 2) {
        const startsBeforeReload = attemptMutationPaths.filter((pathname) => pathname === "/api/attempts/start").length;
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector('[data-screen-label="Home"]', { timeout: POLL_TIMEOUT_MS });
        await clickTestId("home-play");
        await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });
        const startsAfterReload = attemptMutationPaths.filter((pathname) => pathname === "/api/attempts/start").length;
        if (startsAfterReload !== startsBeforeReload) throw new Error("Reload created an extra scoring attempt");
        alreadyAtMenu = true;
        log("PASS reload during retry window recovered without another attempt");
      } else {
        await clickTestId("retry-case");
        await page.waitForSelector('[data-screen-label="02 Tier"]', { timeout: POLL_TIMEOUT_MS });
        await revealWithNoAdmitClaims();
        await page.waitForFunction(() => {
          const screen = document.querySelector('[data-screen-label="04 Reveal"]');
          return (screen?.textContent || "").includes("Tier results") && !!screen?.querySelector(".final-banner");
        }, { timeout: POLL_TIMEOUT_MS });
        finalScore = await readCaseScore(profileIdx);
      }

      if (!alreadyAtMenu) {
        const finalText = await page.$eval('[data-screen-label="04 Reveal"]', (screen) => screen.textContent || "");
        if (/\bseason\b/i.test(finalText)) throw new Error(`Final result for profile #${profileIdx} contains season text`);
        await clickTestId("nav-menu");
        await page.waitForSelector('[data-screen-label="00 Menu"] .school-card', { timeout: POLL_TIMEOUT_MS });
      }

      const locks = await fetchJson(port, "/api/locks", { token });
      const me = await fetchJson(port, "/api/me", { token });
      if (!locks.includes(selectedProfileId) || me.scores?.[selectedProfileId] !== finalScore) {
        throw new Error(`Backend final state mismatch for ${selectedProfileId}: ${JSON.stringify({ locks, score: me.scores?.[selectedProfileId], finalScore })}`);
      }
      const authorizedDetail = await fetchJson(port, `/api/profiles/${encodeURIComponent(selectedProfileId)}`, { token });
      if (!authorizedDetail.application_results || "source" in authorizedDetail) {
        throw new Error(`Locked profile detail authorization malformed for ${selectedProfileId}`);
      }

      const practiceBadgeVisible = await page.evaluate((idx) => {
        const card = document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx];
        return !!card && [...card.querySelectorAll(".badge")]
          .some((badge) => (badge.textContent || "").trim() === "Practice");
      }, profileIdx);
      if (!practiceBadgeVisible) throw new Error(`Finalized profile #${profileIdx} was not marked Practice`);

      if (profileIdx === 0) {
        const scoreBeforePractice = me.scores[selectedProfileId];
        const attemptCallsBeforePractice = attemptMutationPaths.length;
        await page.evaluate((idx) => document.querySelectorAll('[data-screen-label="00 Menu"] .school-card')[idx].click(), profileIdx);
        await page.waitForSelector('[data-screen-label="01 Profile"]', { timeout: POLL_TIMEOUT_MS });
        await page.waitForSelector('[data-testid="correct-choices-tab"]', { timeout: POLL_TIMEOUT_MS });
        await clickTestId("correct-choices-tab");
        await page.waitForFunction(() => (document.querySelector('[data-screen-label="01 Profile"]')?.textContent || "")
          .includes("This file is finalized and no longer affects your score."), { timeout: SHORT_TIMEOUT_MS });
        await startGuessing();
        const practiceTierText = await page.$eval('[data-screen-label="02 Tier"]', (screen) => screen.textContent || "");
        if (practiceTierText.includes("Time bonus")) throw new Error("Practice tier phase claimed a time bonus");
        await revealWithNoAdmitClaims();
        const practiceState = await page.$eval('[data-screen-label="04 Reveal"]', (screen) => {
          const text = screen.textContent || "";
          const labels = [...screen.querySelectorAll(".label")].map((node) => (node.textContent || "").trim());
          return {
            text,
            hasPracticeCopy: text.includes("Practice feedback") && text.includes("not recorded"),
            hasTimeClaim: labels.includes("Time") || text.includes("Score multiplier"),
            hasScoringClaim: /ranking|contributed|season/i.test(text),
            hasRetry: !!screen.querySelector('[data-testid="retry-case"]'),
          };
        });
        if (!practiceState.hasPracticeCopy || practiceState.hasTimeClaim || practiceState.hasScoringClaim || practiceState.hasRetry) {
          throw new Error(`Practice copy exposed scoring claims: ${JSON.stringify(practiceState)}`);
        }
        if (attemptMutationPaths.length !== attemptCallsBeforePractice) throw new Error("Practice called an attempt endpoint");
        const meAfterPractice = await fetchJson(port, "/api/me", { token });
        if (meAfterPractice.scores?.[selectedProfileId] !== scoreBeforePractice) {
          throw new Error("Practice changed the persisted score");
        }
        await clickTestId("nav-menu");
        await page.waitForSelector('[data-screen-label="00 Menu"]', { timeout: POLL_TIMEOUT_MS });
        log("PASS persisted Practice shows Correct choices, no scoring copy/calls, immutable score");
      }
    }

    if (playedProfileIds.size !== NUM_PROFILES) {
      throw new Error(`Expected ${NUM_PROFILES} distinct finalized cases, got ${playedProfileIds.size}`);
    }
    if (legacyMutationPosts !== 0) throw new Error(`Observed ${legacyMutationPosts} legacy score/lock mutation calls`);


    const rivalUsername = `r_${Date.now().toString().slice(-10)}`;
    const rivalRegistration = await fetchJson(port, "/api/register", {
      method: "POST",
      body: { username: rivalUsername, password },
    });
    const rivalToken = rivalRegistration.token;
    if (!rivalToken) throw new Error("Rival registration returned no token");
    const rivalAttempt = await fetchJson(port, "/api/attempts/start", {
      method: "POST",
      token: rivalToken,
      body: { profileId: profiles[0].id },
    });
    const rivalReveal = await fetchJson(port, `/api/attempts/${encodeURIComponent(rivalAttempt.attemptId)}/reveal`, {
      method: "POST",
      token: rivalToken,
      body: {
        universityTierPick: null,
        lacTierPick: null,
        noUniClaim: true,
        noLacClaim: true,
        schoolSelections: [],
      },
    });
    if (rivalReveal.finalized !== false || !Number.isInteger(rivalReveal.result?.score)) {
      throw new Error(`Rival pending reveal malformed: ${JSON.stringify(rivalReveal)}`);
    }
    await fetchJson(port, `/api/attempts/${encodeURIComponent(rivalAttempt.attemptId)}/abandon`, {
      method: "POST",
      token: rivalToken,
    });

    // ── Step 3: Global leaderboard UI has no season dependency ─────────────
    await clickTestId("nav-leaderboard");
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
    await page.type('[data-testid="rival-input"]', rivalUsername);
    await clickTestId("rival-add");
    await page.waitForFunction((wanted) => [...document.querySelectorAll(".card .row span")]
      .some((node) => (node.textContent || "").includes(wanted)), { timeout: SHORT_TIMEOUT_MS }, rivalUsername);
    const rivalList = await fetchJson(port, "/api/rivals", { token });
    if (!rivalList.some((entry) => entry.username === rivalUsername)) {
      throw new Error(`Rival was not persisted: ${JSON.stringify(rivalList)}`);
    }
    await clickTestId("duel-open");
    await page.waitForFunction((profileId) => [...document.querySelectorAll(".leaderboard-grid--duel")]
      .some((row) => (row.textContent || "").includes(profileId)), { timeout: POLL_TIMEOUT_MS }, profiles[0].id);
    const duel = await fetchJson(port, `/api/duel/${encodeURIComponent(rivalUsername)}`, { token });
    const shared = duel.common?.find((entry) => entry.profileId === profiles[0].id);
    if (!shared || !Number.isInteger(shared.you) || !Number.isInteger(shared.them)) {
      throw new Error(`Duel shared row missing or malformed: ${JSON.stringify(duel)}`);
    }
    log(`PASS actual rival add/list/duel shared row for ${profiles[0].id}`);


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

    // Enabled submission tooling still requires the independent maintainer
    // secret in addition to the user's bearer token.
    const maintainerPort = await getFreePort();
    const maintainerKey = "e2e-maintainer-key";
    const maintainerServer = spawn("node", ["server.js"], {
      cwd: REPO_DIR,
      env: {
        ...process.env,
        PORT: String(maintainerPort),
        SUBMISSIONS_ENABLED: "true",
        MAINTAINER_API_KEY: maintainerKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await waitForServer(maintainerPort);
      const missingKey = await requestJson(maintainerPort, "/api/submissions", { token });
      const wrongKey = await requestJson(maintainerPort, "/api/submissions", {
        token,
        headers: { "X-Maintainer-Key": "wrong-key" },
      });
      const acceptedKey = await requestJson(maintainerPort, "/api/submissions", {
        token,
        headers: { "X-Maintainer-Key": maintainerKey },
      });
      if (missingKey.status !== 403 || wrongKey.status !== 403 || acceptedKey.status !== 200 || !Array.isArray(acceptedKey.data)) {
        throw new Error(`Maintainer key gate failed: ${JSON.stringify({ missingKey, wrongKey, acceptedKey })}`);
      }
      log("PASS enabled submission tools require the maintainer key");
    } finally {
      maintainerServer.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!maintainerServer.killed) maintainerServer.kill("SIGKILL");
    }

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
