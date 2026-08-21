import vm from "vm";
import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import {
  buildRedditAuthorizeUrl,
  exchangeRedditAuthorizationCode,
  fetchFallbackPost,
  fetchVerifiedRedditPost,
  hashOAuthState,
  normalizeRedditPostUrl,
  sanitizeRedditPost,
  verifyFallbackEditCode,
} from "./lib/reddit-consent.js";

const app = express();
const PORT = process.env.PORT || 3005;
const HOST = process.env.HOST || "0.0.0.0";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev";
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || (IS_PRODUCTION ? "dist" : "public"));
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || "";
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || "";
const REDDIT_REDIRECT_URI = process.env.REDDIT_REDIRECT_URI || "";
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "web:AdmissionsOracle:1.0 (by /u/MJanW)";
const MAINTAINER_API_KEY = process.env.MAINTAINER_API_KEY || "";
const RETRY_WINDOW_MS = 5_000;
const RECOVERY_WINDOW_MS = 5 * 60_000;
const attemptTimers = new Map();
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};

const SUBMISSIONS_ENABLED = process.env.SUBMISSIONS_ENABLED === "true";
const CONSENT_VERSION = "2026-08-17";
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CODE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_VERIFICATION_ENABLED = true;
const redditOAuthConfigured = Boolean(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET && REDDIT_REDIRECT_URI);
if (IS_PRODUCTION && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET is required in production and must be at least 32 characters");
}
if (IS_PRODUCTION && SUBMISSIONS_ENABLED && !MAINTAINER_API_KEY) {
  throw new Error("MAINTAINER_API_KEY is required when submissions are enabled in production");
}
if (IS_PRODUCTION && !fs.existsSync(path.join(STATIC_DIR, "index.html"))) {
  throw new Error(`Production assets are missing from ${STATIC_DIR}; run npm run build first`);
}
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in production.");
}
if (!redditOAuthConfigured) {
  console.warn("⚠️  Reddit ownership verification is disabled. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_REDIRECT_URI.");
}

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
} else if (process.env.TRUST_PROXY === "loopback") {
  app.set("trust proxy", "loopback");
} else if (IS_PRODUCTION && process.env.TRUST_PROXY) {
  throw new Error("TRUST_PROXY must be unset, '1', or 'loopback'");
}
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (IS_PRODUCTION) {
    res.setHeader("Content-Security-Policy", [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'none'",
    ].join("; "));
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(bodyParser.json({ limit: "32kb" }));

const dataDir = process.env.DATA_DIR || "data";
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ─── Database Setup (SQLite) ──────────────────────────────────────────────────
const db = new Database(path.join(dataDir, "game.db"));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scores (
    user_id INTEGER NOT NULL,
    profile_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    breakdown TEXT,
    PRIMARY KEY (user_id, profile_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS reddit_submissions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    reddit_post_id TEXT NOT NULL UNIQUE,
    reddit_url TEXT NOT NULL,
    consent_version TEXT NOT NULL,
    consented_at TEXT NOT NULL,
    oauth_state_hash TEXT UNIQUE,
    oauth_expires_at TEXT,
    status TEXT NOT NULL,
    ownership_fingerprint TEXT,
    reddit_account_id TEXT,
    subreddit TEXT,
    post_title TEXT,
    post_body TEXT,
    post_created_utc INTEGER,
    post_permalink TEXT,
    verified_at TEXT,
    withdrawn_at TEXT,
    failure_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE INDEX IF NOT EXISTS idx_reddit_submissions_user_created
    ON reddit_submissions (user_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_reddit_submissions_status
    ON reddit_submissions (status, created_at ASC);

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_locks (
    user_id INTEGER NOT NULL,
    profile_id TEXT NOT NULL,
    locked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, profile_id),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );

  CREATE TABLE IF NOT EXISTS rivals (
    user_id INTEGER NOT NULL,
    rival_username TEXT NOT NULL,
    PRIMARY KEY (user_id, rival_username),
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
  CREATE TABLE IF NOT EXISTS game_attempts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    profile_id TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('guessing','retry_pending','retrying','finalized')),
    started_at TEXT NOT NULL,
    retry_deadline TEXT,
    recovery_deadline TEXT,
    retry_started_at TEXT,
    first_result TEXT,
    first_prediction TEXT,
    finalized_result TEXT,
    finalized_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_attempts_active_profile
    ON game_attempts(user_id, profile_id) WHERE state <> 'finalized';
  CREATE INDEX IF NOT EXISTS idx_game_attempts_user_profile ON game_attempts(user_id, profile_id);

`);

// ─── Schema Migration: fallback code columns ─────────────────────────────────
{
  const cols = db.prepare("PRAGMA table_info(reddit_submissions)").all().map(c => c.name);
  if (!cols.includes("fallback_code")) {
    db.exec("ALTER TABLE reddit_submissions ADD COLUMN fallback_code TEXT");
  }
  if (!cols.includes("fallback_code_expires_at")) {
    db.exec("ALTER TABLE reddit_submissions ADD COLUMN fallback_code_expires_at TEXT");
  }
}

{
  const cols = db.prepare("PRAGMA table_info(game_attempts)").all().map((column) => column.name);
  if (!cols.includes("retry_started_at")) db.exec("ALTER TABLE game_attempts ADD COLUMN retry_started_at TEXT");
  if (!cols.includes("recovery_deadline")) db.exec("ALTER TABLE game_attempts ADD COLUMN recovery_deadline TEXT");
  const retrying = db.prepare("SELECT id, retry_started_at FROM game_attempts WHERE state='retrying' AND recovery_deadline IS NULL").all();
  const setRecoveryDeadline = db.prepare("UPDATE game_attempts SET recovery_deadline=? WHERE id=? AND state='retrying' AND recovery_deadline IS NULL");
  for (const row of retrying) {
    const startedMs = Date.parse(row.retry_started_at || "");
    const deadline = new Date((Number.isFinite(startedMs) ? startedMs : Date.now()) + RECOVERY_WINDOW_MS).toISOString();
    setRecoveryDeadline.run(deadline, row.id);
  }
}

// ─── Schema Migration: scoring version reset ──────────────────────────────────
const SCORING_VERSION = "3";
{
  const row = db.prepare("SELECT value FROM meta WHERE key = 'scoring_version'").get();
  if (!row || row.value !== SCORING_VERSION) {
    console.log(`Resetting scores for scoring version ${SCORING_VERSION} (was ${row ? row.value : "none"})...`);
    db.transaction(() => {
      db.exec("DELETE FROM scores; DELETE FROM game_attempts; DELETE FROM profile_locks");
      db.prepare(`
        INSERT INTO meta (key, value) VALUES ('scoring_version', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(SCORING_VERSION);
    })();
  }
}


// ─── Load Profiles ────────────────────────────────────────────────────────────
const profilesPath = path.join(dataDir, "profiles.jsonl");

function loadProfiles() {
  if (!fs.existsSync(profilesPath)) return [];
  return fs
    .readFileSync(profilesPath, "utf-8")
    .split("\n")
    .filter(line => line.trim() !== "")
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((profile) => profile && typeof profile === "object" && !Array.isArray(profile)
      && typeof profile.id === "string" && profile.id.length > 0 && profile.id.length <= 64);
}

for (const script of ["tiers.js", "scoring.js", "game-score.js"]) {
  const source = fs.readFileSync(path.join("public", script), "utf8");
  vm.runInThisContext(source, { filename: path.join("public", script) });
}
const GAME_SCORE = globalThis.GAME_SCORE;
if (!GAME_SCORE || !globalThis.TIERS || !globalThis.SCORING) throw new Error("Shared scoring scripts failed to load");

let profiles = loadProfiles();

app.get("/healthz", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ status: "ok" });
});

app.get("/readyz", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    db.prepare("SELECT 1 AS ready").get();
    if (profiles.length === 0) return res.status(503).json({ status: "not_ready", profiles: 0 });
    return res.json({ status: "ready", profiles: profiles.length });
  } catch (error) {
    console.error("Readiness check failed", error);
    return res.status(503).json({ status: "not_ready" });
  }
});

app.use(express.static(STATIC_DIR, {
  index: false,
  setHeaders(res, filePath) {
    const relative = path.relative(STATIC_DIR, filePath).split(path.sep).join("/");
    if (/^assets\/.*-[A-Z0-9]+\.(?:css|js|woff2?|ttf)$/i.test(relative)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

// ─── Authentication Middleware ────────────────────────────────────────────────

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

function requireSubmissionsEnabled(req, res, next) {
  if (!SUBMISSIONS_ENABLED) {
    return res.status(503).json({ error: "Submission tools are disabled" });
  }
  next();
}

function requireMaintainerKey(req, res, next) {
  if (!safeEqual(req.get("X-Maintainer-Key") || "", MAINTAINER_API_KEY)) {
    return res.status(403).json({ error: "Maintainer key required" });
  }
  next();
}


function submissionForClient(row) {
  const client = {
    id: row.id,
    redditUrl: row.reddit_url,
    status: row.status,
    subreddit: row.subreddit || null,
    title: row.post_title || null,
    consentVersion: row.consent_version,
    consentedAt: row.consented_at,
    verifiedAt: row.verified_at || null,
    withdrawnAt: row.withdrawn_at || null,
    createdAt: row.created_at,
    canWithdraw: !["withdrawn", "rejected"].includes(row.status),
  };
  if (row.status === "awaiting_fallback_code") {
    client.fallbackCode = row.fallback_code;
    client.fallbackCodeExpiresAt = row.fallback_code_expires_at;
  }
  return client;
}

function submissionRedirect(res, submissionId, status) {
  const query = new URLSearchParams({ submission: submissionId, submission_status: status });
  res.redirect(303, `/?${query.toString()}`);
}

function ownershipFingerprint(redditUsername) {
  return crypto
    .createHmac("sha256", JWT_SECRET)
    .update(String(redditUsername).trim().toLowerCase())
    .digest("hex");
}

const FALLBACK_INSTRUCTIONS = `Edit your Reddit post and add the proof code below on a new line, then confirm here. The code proves you own the post. It expires in 30 minutes.`;

function generateProofCode() {
  let body = "";
  while (body.length < 6) {
    body += crypto.randomBytes(6).toString("base64url").replace(/[^A-Z0-9]/g, "");
  }
  return `ORACLE-${body.slice(0, 6)}`;
}

const submissionRateWindows = new Map();
function submissionRateLimit(req, res, next) {
  const now = Date.now();
  const windowStart = now - 60 * 60 * 1000;
  const attempts = (submissionRateWindows.get(req.user.id) || []).filter(timestamp => timestamp > windowStart);
  if (attempts.length >= 5) {
    return res.status(429).json({ error: "Too many submission attempts. Try again later." });
  }
  attempts.push(now);
  if (attempts.length === 0) {
    submissionRateWindows.delete(req.user.id);
  } else {
    submissionRateWindows.set(req.user.id, attempts);
  }
  next();
}

// ─── API Endpoints: Auth ──────────────────────────────────────────────────────
async function registerHandler(req, res) {
  const { username, password } = req.body;
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, or underscore" });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ error: "Password must be between 8 and 72 characters" });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
    const info = stmt.run(username, hash);

    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, username, token, scores: {} });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: "User already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function loginHandler(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }

  try {
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    recoverExpiredAttempts();
    const userScores = db.prepare("SELECT profile_id, score FROM scores WHERE user_id = ?").all(user.id);
    const scoresDict = {};
    for (const row of userScores) {
      scoresDict[row.profile_id] = row.score;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, username: user.username, token, scores: scoresDict });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

app.post("/api/register", registerHandler);
app.post("/api/login", loginHandler);

app.get("/api/me", authenticateToken, (req, res) => {
  try {
    recoverExpiredAttempts();
    const userScores = db.prepare("SELECT profile_id, score FROM scores WHERE user_id = ?").all(req.user.id);
    const scoresDict = {};
    for (const row of userScores) {
      scoresDict[row.profile_id] = row.score;
    }
    res.json({ loggedIn: true, username: req.user.username, scores: scoresDict });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── API Endpoints: Consent-first Reddit submissions ─────────────────────────

app.get("/api/submissions/config", authenticateToken, (req, res) => {
  res.json({
    enabled: SUBMISSIONS_ENABLED,
    redditOAuthConfigured,
    fallbackEnabled: true,
    consentVersion: CONSENT_VERSION,
    maxSubmissionsPerHour: 5,
  });
});

app.get("/api/submissions", requireSubmissionsEnabled, requireMaintainerKey, authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM reddit_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).all(req.user.id);
    res.json(rows.map(submissionForClient));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load submissions" });
  }
});

app.post("/api/submissions", requireSubmissionsEnabled, requireMaintainerKey, authenticateToken, submissionRateLimit, (req, res) => {
  if (!redditOAuthConfigured && !FALLBACK_VERIFICATION_ENABLED) {
    return res.status(503).json({ error: "Reddit ownership verification is not configured yet" });
  }
  if (req.body?.consentAccepted !== true || req.body?.consentVersion !== CONSENT_VERSION) {
    return res.status(400).json({ error: "You must accept the current submission consent before continuing" });
  }

  let normalized;
  try {
    normalized = normalizeRedditPostUrl(req.body?.redditUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const useOAuth = redditOAuthConfigured;
  const retryableStatuses = [
    "awaiting_reddit_verification",
    "awaiting_fallback_code",
    "verification_expired",
    "verification_cancelled",
    "verification_failed",
    "withdrawn",
  ];

  function freshFlowPayload(existingId) {
    if (useOAuth) {
      const rawState = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'awaiting_reddit_verification', oauth_state_hash = ?, oauth_expires_at = ?,
            fallback_code = NULL, fallback_code_expires_at = NULL, failure_reason = NULL,
            subreddit = NULL, post_title = NULL, post_body = NULL, post_created_utc = NULL,
            post_permalink = NULL, reddit_account_id = NULL, ownership_fingerprint = NULL,
            verified_at = NULL, withdrawn_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(hashOAuthState(rawState), expiresAt.toISOString(), nowIso, existingId);
      const authorizeUrl = buildRedditAuthorizeUrl({
        clientId: REDDIT_CLIENT_ID,
        redirectUri: REDDIT_REDIRECT_URI,
        state: rawState,
      });
      return {
        submission: submissionForClient(db.prepare("SELECT * FROM reddit_submissions WHERE id = ?").get(existingId)),
        authorizeUrl,
      };
    }
    const proofCode = generateProofCode();
    const expiresAt = new Date(now.getTime() + FALLBACK_CODE_TTL_MS);
    db.prepare(`
      UPDATE reddit_submissions
      SET status = 'awaiting_fallback_code', fallback_code = ?, fallback_code_expires_at = ?,
          oauth_state_hash = NULL, oauth_expires_at = NULL, failure_reason = NULL,
          subreddit = NULL, post_title = NULL, post_body = NULL, post_created_utc = NULL,
          post_permalink = NULL, reddit_account_id = NULL, ownership_fingerprint = NULL,
          verified_at = NULL, withdrawn_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(proofCode, expiresAt.toISOString(), nowIso, existingId);
    return {
      submission: submissionForClient(db.prepare("SELECT * FROM reddit_submissions WHERE id = ?").get(existingId)),
      proofCode,
      fallbackInstructions: FALLBACK_INSTRUCTIONS,
    };
  }

  const submissionId = crypto.randomUUID();

  try {
    if (useOAuth) {
      const rawState = crypto.randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS);
      db.prepare(`
        INSERT INTO reddit_submissions (
          id, user_id, reddit_post_id, reddit_url, consent_version, consented_at,
          oauth_state_hash, oauth_expires_at, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_reddit_verification', ?, ?)
      `).run(
        submissionId,
        req.user.id,
        normalized.postId,
        normalized.canonicalUrl,
        CONSENT_VERSION,
        nowIso,
        hashOAuthState(rawState),
        expiresAt.toISOString(),
        nowIso,
        nowIso,
      );
      const authorizeUrl = buildRedditAuthorizeUrl({
        clientId: REDDIT_CLIENT_ID,
        redirectUri: REDDIT_REDIRECT_URI,
        state: rawState,
      });
      return res.status(201).json({
        submission: submissionForClient(db.prepare("SELECT * FROM reddit_submissions WHERE id = ?").get(submissionId)),
        authorizeUrl,
      });
    }

    const proofCode = generateProofCode();
    const expiresAt = new Date(now.getTime() + FALLBACK_CODE_TTL_MS);
    db.prepare(`
      INSERT INTO reddit_submissions (
        id, user_id, reddit_post_id, reddit_url, consent_version, consented_at,
        status, fallback_code, fallback_code_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'awaiting_fallback_code', ?, ?, ?, ?)
    `).run(
      submissionId,
      req.user.id,
      normalized.postId,
      normalized.canonicalUrl,
      CONSENT_VERSION,
      nowIso,
      proofCode,
      expiresAt.toISOString(),
      nowIso,
      nowIso,
    );
    return res.status(201).json({
      submission: submissionForClient(db.prepare("SELECT * FROM reddit_submissions WHERE id = ?").get(submissionId)),
      proofCode,
      fallbackInstructions: FALLBACK_INSTRUCTIONS,
    });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      const existing = db.prepare("SELECT * FROM reddit_submissions WHERE reddit_post_id = ?").get(normalized.postId);
      if (existing && existing.user_id === req.user.id && retryableStatuses.includes(existing.status)) {
        return res.status(201).json(freshFlowPayload(existing.id));
      }
      return res.status(409).json({ error: "That Reddit post has already been submitted" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not create the submission" });
  }
});

app.post("/api/submissions/:id/confirm-fallback", requireSubmissionsEnabled, requireMaintainerKey, authenticateToken, async (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM reddit_submissions WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Submission not found" });
    if (row.status !== "awaiting_fallback_code") {
      return res.status(409).json({ error: "Submission is not awaiting a fallback code" });
    }

    const now = new Date();
    if (!row.fallback_code_expires_at || new Date(row.fallback_code_expires_at).getTime() < now.getTime()) {
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verification_expired', fallback_code = NULL, fallback_code_expires_at = NULL, updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), row.id);
      return res.status(410).json({ error: "Verification expired. Re-submit to get a fresh code." });
    }

    let post;
    try {
      post = await fetchFallbackPost(row.reddit_post_id, { userAgent: REDDIT_USER_AGENT });
    } catch (err) {
      console.error("Fallback post fetch failed:", err.message);
      return res.status(502).json({ error: "Could not fetch the post from Reddit. Try again shortly." });
    }

    if (verifyFallbackEditCode(post, row.fallback_code)) {
      const sanitized = sanitizeRedditPost(post);
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verified_pending_review', fallback_code = NULL, fallback_code_expires_at = NULL,
            subreddit = ?, post_title = ?, post_body = ?, post_created_utc = ?, post_permalink = ?,
            verified_at = ?, failure_reason = NULL, updated_at = ?
        WHERE id = ?
      `).run(
        sanitized.subreddit,
        sanitized.title,
        sanitized.body,
        sanitized.createdUtc,
        sanitized.permalink,
        now.toISOString(),
        now.toISOString(),
        row.id,
      );
      return res.status(200).json({ status: "verified_pending_review", message: "Case queued for review" });
    }

    db.prepare(`
      UPDATE reddit_submissions
      SET failure_reason = 'edit_code_not_found', updated_at = ?
      WHERE id = ?
    `).run(now.toISOString(), row.id);
    return res.status(200).json({ status: "awaiting_fallback_code", message: "Code not found in your post yet — add it and try again" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/submissions/reddit/callback", requireSubmissionsEnabled, async (req, res) => {
  try {
    const rawState = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!rawState || rawState.length > 256) return res.status(400).json({ error: "Invalid OAuth state" });

    const stateHash = hashOAuthState(rawState);
    const submission = db.prepare("SELECT * FROM reddit_submissions WHERE oauth_state_hash = ?").get(stateHash);
    if (!submission) return res.status(400).json({ error: "This verification link is invalid or has already been used" });

    const now = new Date();
    if (!submission.oauth_expires_at || new Date(submission.oauth_expires_at).getTime() < now.getTime()) {
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verification_expired', oauth_state_hash = NULL, failure_reason = 'oauth_expired', updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), submission.id);
      return submissionRedirect(res, submission.id, "expired");
    }

    if (req.query.error || !code) {
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verification_cancelled', oauth_state_hash = NULL, failure_reason = 'oauth_cancelled', updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), submission.id);
      return submissionRedirect(res, submission.id, "cancelled");
    }

    try {
      const accessToken = await exchangeRedditAuthorizationCode({
        code,
        clientId: REDDIT_CLIENT_ID,
        clientSecret: REDDIT_CLIENT_SECRET,
        redirectUri: REDDIT_REDIRECT_URI,
        userAgent: REDDIT_USER_AGENT,
      });
      const verified = await fetchVerifiedRedditPost({
        accessToken,
        postId: submission.reddit_post_id,
        userAgent: REDDIT_USER_AGENT,
      });

      if (!verified.isOwner) {
        db.prepare(`
          UPDATE reddit_submissions
          SET status = 'verification_failed', oauth_state_hash = NULL,
              failure_reason = 'reddit_account_does_not_match_post_author', updated_at = ?
          WHERE id = ?
        `).run(now.toISOString(), submission.id);
        return submissionRedirect(res, submission.id, "owner_mismatch");
      }

      const post = sanitizeRedditPost(verified.post);
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verified_pending_review', oauth_state_hash = NULL, oauth_expires_at = NULL,
            ownership_fingerprint = ?, reddit_account_id = ?, subreddit = ?, post_title = ?,
            post_body = ?, post_created_utc = ?, post_permalink = ?, verified_at = ?,
            failure_reason = NULL, updated_at = ?
        WHERE id = ?
      `).run(
        ownershipFingerprint(verified.owner.name),
        verified.owner.id,
        post.subreddit,
        post.title,
        post.body,
        post.createdUtc,
        post.permalink,
        now.toISOString(),
        now.toISOString(),
        submission.id,
      );
      return submissionRedirect(res, submission.id, "verified");
    } catch (err) {
      console.error("Reddit ownership verification failed:", err.message);
      db.prepare(`
        UPDATE reddit_submissions
        SET status = 'verification_failed', oauth_state_hash = NULL,
            failure_reason = 'reddit_api_error', updated_at = ?
        WHERE id = ?
      `).run(now.toISOString(), submission.id);
      return submissionRedirect(res, submission.id, "failed");
    }
  } catch (err) {
    console.error("OAuth callback error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/submissions/:id", requireSubmissionsEnabled, requireMaintainerKey, authenticateToken, (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM reddit_submissions WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: "Submission not found" });

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE reddit_submissions
      SET status = 'withdrawn', post_title = NULL, post_body = NULL, subreddit = NULL,
          post_created_utc = NULL, post_permalink = NULL, reddit_account_id = NULL,
          ownership_fingerprint = NULL, oauth_state_hash = NULL, oauth_expires_at = NULL,
          withdrawn_at = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(now, now, req.params.id, req.user.id);
    res.json({ success: true, status: "withdrawn" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not withdraw the submission" });
  }
});

// ─── API Endpoints: Game ──────────────────────────────────────────────────────

function realProfile(profileId) {
  if (typeof profileId !== "string" || profileId.length === 0 || profileId.length > 64) return null;
  profiles = loadProfiles();
  return profiles.find((profile) => profile && profile.id === profileId) || null;
}

function profileIsLocked(userId, profileId) {
  return Boolean(db.prepare("SELECT 1 FROM profile_locks WHERE user_id = ? AND profile_id = ?").get(userId, profileId));
}


function finalizeAttemptTx(attempt, resultJson, nowIso, expectedStates) {
  const states = Array.isArray(expectedStates) ? expectedStates : [expectedStates];
  const placeholders = states.map(() => "?").join(",");
  let committed = false;
  try {
    db.transaction(() => {
      const parsed = JSON.parse(resultJson);
      const changed = db.prepare(`
        UPDATE game_attempts
        SET state='finalized', finalized_result=?, finalized_at=?,
            retry_deadline=NULL, recovery_deadline=NULL
        WHERE id=? AND state IN (${placeholders})
      `).run(resultJson, nowIso, attempt.id, ...states);
      if (!changed.changes) {
        const error = new Error("Attempt finalization lost CAS");
        error.code = "ATTEMPT_CAS_CONFLICT";
        throw error;
      }

      const lock = db.prepare(`
        INSERT OR IGNORE INTO profile_locks (user_id, profile_id, locked_at)
        VALUES (?, ?, ?)
      `).run(attempt.user_id, attempt.profile_id, nowIso);
      if (!lock.changes) {
        const error = new Error("Profile lock already owned");
        error.code = "ATTEMPT_CAS_CONFLICT";
        throw error;
      }

      db.prepare(`
        INSERT INTO scores (user_id, profile_id, score, breakdown)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, profile_id) DO UPDATE SET score=excluded.score, breakdown=excluded.breakdown
      `).run(attempt.user_id, attempt.profile_id, parsed.score, resultJson);
      committed = true;
    })();
  } catch (err) {
    if (err?.code !== "ATTEMPT_CAS_CONFLICT") throw err;
  }
  if (committed) {
    clearTimeout(attemptTimers.get(attempt.id));
    attemptTimers.delete(attempt.id);
  }
  return committed;
}

function recoverExpiredAttempts() {
  const now = Date.now();
  const rows = db.prepare(`
    SELECT * FROM game_attempts
    WHERE (state='retry_pending' AND retry_deadline IS NOT NULL)
       OR (state='retrying' AND recovery_deadline IS NOT NULL)
  `).all();
  for (const row of rows) {
    const deadline = row.state === "retrying" ? row.recovery_deadline : row.retry_deadline;
    if (!row.first_result || !deadline || Date.parse(deadline) > now) continue;
    try {
      finalizeAttemptTx(row, row.first_result, new Date().toISOString(), [row.state]);
    } catch (err) {
      console.error("Attempt recovery failed:", err);
    }
  }
}

function scheduleAttemptRecovery(id, state, deadline) {
  clearTimeout(attemptTimers.get(id));
  const delay = Math.max(0, Date.parse(deadline) - Date.now());
  const timer = setTimeout(() => {
    const row = db.prepare("SELECT * FROM game_attempts WHERE id=?").get(id);
    const currentDeadline = row?.state === "retrying" ? row.recovery_deadline : row?.retry_deadline;
    if (row && row.state === state && currentDeadline && Date.parse(currentDeadline) <= Date.now() && row.first_result) {
      try { finalizeAttemptTx(row, row.first_result, new Date().toISOString(), [state]); }
      catch (err) { console.error("Attempt timer finalization failed:", err); }
    }
    attemptTimers.delete(id);
  }, delay);
  attemptTimers.set(id, timer);
}

recoverExpiredAttempts();
for (const row of db.prepare(`
  SELECT id,state,retry_deadline,recovery_deadline FROM game_attempts
  WHERE (state='retry_pending' AND retry_deadline IS NOT NULL)
     OR (state='retrying' AND recovery_deadline IS NOT NULL)
`).all()) {
  scheduleAttemptRecovery(row.id, row.state, row.state === "retrying" ? row.recovery_deadline : row.retry_deadline);
}

function attemptForUser(id, userId) {
  return db.prepare("SELECT * FROM game_attempts WHERE id=? AND user_id=?").get(id, userId);
}

function parsePrediction(body) {
  return {
    universityTierPick: body?.universityTierPick ?? null,
    lacTierPick: body?.lacTierPick ?? null,
    noUniClaim: body?.noUniClaim,
    noLacClaim: body?.noLacClaim,
    schoolSelections: body?.schoolSelections,
  };
}

app.get("/api/profiles", (req, res) => {
  profiles = loadProfiles();
  res.json(profiles.map(({ application_results, source, game_metadata, ...rest }) => rest));
});

app.get("/api/profiles/:id", authenticateToken, (req, res) => {
  recoverExpiredAttempts();
  const profile = realProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  if (!profileIsLocked(req.user.id, profile.id)) return res.status(403).json({ error: "Profile is not finalized" });
  const { source, ...publicProfile } = profile;
  res.json(publicProfile);
});

app.post("/api/attempts/start", authenticateToken, (req, res) => {
  recoverExpiredAttempts();
  const profile = realProfile(req.body?.profileId);
  if (!profile) return res.status(400).json({ error: "Invalid profile" });
  const attemptId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    const outcome = db.transaction(() => {
      if (db.prepare("SELECT 1 FROM profile_locks WHERE user_id=? AND profile_id=?").get(req.user.id, profile.id)) {
        return { locked: true };
      }
      const active = db.prepare("SELECT id FROM game_attempts WHERE user_id=? AND profile_id=? AND state <> 'finalized'").get(req.user.id, profile.id);
      if (active) return { active };
      db.prepare("INSERT INTO game_attempts (id,user_id,profile_id,state,started_at) VALUES (?,?,?,?,?)").run(attemptId, req.user.id, profile.id, "guessing", startedAt);
      return null;
    })();
    if (outcome?.locked) return res.status(409).json({ error: "Profile locked — practice only" });
    if (outcome?.active) return res.status(409).json({ error: "Attempt already in progress", attemptId: outcome.active.id });
    return res.status(201).json({ attemptId, startedAt });
  } catch (err) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Attempt already in progress" });
    console.error(err);
    return res.status(500).json({ error: "Could not start attempt" });
  }
});

app.post("/api/attempts/:id/reveal", authenticateToken, (req, res) => {
  recoverExpiredAttempts();
  const attempt = attemptForUser(req.params.id, req.user.id);
  if (!attempt) return res.status(404).json({ error: "Attempt not found" });
  if (attempt.state === "finalized") return res.json({ finalized: true, result: JSON.parse(attempt.finalized_result), locked: true });
  const profile = realProfile(attempt.profile_id);
  try {
    const prediction = parsePrediction(req.body);
    const startedAt = attempt.state === "retrying" ? attempt.retry_started_at : attempt.started_at;
    const result = GAME_SCORE.evaluate(profile, prediction, startedAt, new Date().toISOString());
    const resultJson = JSON.stringify(result);
    if (attempt.state === "guessing") {
      const deadline = new Date(Date.now() + RETRY_WINDOW_MS).toISOString();
      const changed = db.transaction(() => db.prepare(`
        UPDATE game_attempts
        SET state='retry_pending', retry_deadline=?, recovery_deadline=NULL, first_result=?, first_prediction=?
        WHERE id=? AND state='guessing'
      `).run(deadline, resultJson, JSON.stringify(prediction), attempt.id))();
      if (!changed.changes) return res.status(409).json({ error: "Attempt is no longer accepting a reveal" });
      scheduleAttemptRecovery(attempt.id, "retry_pending", deadline);
      return res.json({ finalized: false, result, retryDeadline: deadline });
    }
    if (attempt.state !== "retrying") return res.status(409).json({ error: "Attempt is no longer accepting a reveal" });
    if (!finalizeAttemptTx(attempt, resultJson, new Date().toISOString(), ["retrying"])) {
      const current = attemptForUser(attempt.id, req.user.id);
      if (current?.state === "finalized") return res.json({ finalized: true, result: JSON.parse(current.finalized_result), locked: true });
      return res.status(409).json({ error: "Attempt is no longer accepting a reveal" });
    }
    return res.json({ finalized: true, result, locked: true });
  } catch (err) {
    if (err?.code === "INVALID_GAME_INPUT") return res.status(400).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: "Could not score attempt" });
  }
});

app.post("/api/attempts/:id/retry", authenticateToken, (req, res) => {
  try {
    recoverExpiredAttempts();
    const attempt = attemptForUser(req.params.id, req.user.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.state !== "retry_pending") return res.status(409).json({ error: "Retry is unavailable" });
    if (!attempt.retry_deadline || Date.parse(attempt.retry_deadline) <= Date.now()) {
      if (attempt.first_result) finalizeAttemptTx(attempt, attempt.first_result, new Date().toISOString(), ["retry_pending"]);
      return res.status(409).json({ error: "Retry window expired" });
    }
    const startedAt = new Date().toISOString();
    const recoveryDeadline = new Date(Date.now() + RECOVERY_WINDOW_MS).toISOString();
    const changed = db.transaction(() => db.prepare(`
      UPDATE game_attempts
      SET state='retrying', retry_started_at=?, retry_deadline=NULL, recovery_deadline=?
      WHERE id=? AND state='retry_pending'
    `).run(startedAt, recoveryDeadline, attempt.id))();
    if (!changed.changes) return res.status(409).json({ error: "Retry is unavailable" });
    clearTimeout(attemptTimers.get(attempt.id));
    scheduleAttemptRecovery(attempt.id, "retrying", recoveryDeadline);
    return res.json({ success: true, startedAt });
  } catch (err) {
    console.error("Attempt retry failed:", err);
    return res.status(500).json({ error: "Could not reserve retry" });
  }
});

app.post("/api/attempts/:id/finalize", authenticateToken, (req, res) => {
  try {
    recoverExpiredAttempts();
    const attempt = attemptForUser(req.params.id, req.user.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.state === "finalized") return res.json({ finalized: true, result: JSON.parse(attempt.finalized_result), locked: true });
    if (attempt.state !== "retry_pending" || !attempt.first_result) return res.status(409).json({ error: "Attempt is not ready to finalize" });
    if (attempt.retry_deadline && Date.parse(attempt.retry_deadline) > Date.now()) return res.status(409).json({ error: "Retry window is still open" });
    if (!finalizeAttemptTx(attempt, attempt.first_result, new Date().toISOString(), ["retry_pending"])) {
      const current = attemptForUser(attempt.id, req.user.id);
      if (current?.state === "finalized") return res.json({ finalized: true, result: JSON.parse(current.finalized_result), locked: true });
      return res.status(409).json({ error: "Attempt is no longer ready to finalize" });
    }
    return res.json({ finalized: true, result: JSON.parse(attempt.first_result), locked: true });
  } catch (err) {
    console.error("Attempt finalization failed:", err);
    return res.status(500).json({ error: "Could not finalize attempt" });
  }
});

app.post("/api/attempts/:id/abandon", authenticateToken, (req, res) => {
  try {
    recoverExpiredAttempts();
    let attempt = attemptForUser(req.params.id, req.user.id);
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.state === "guessing") {
      const changed = db.transaction(() => db.prepare("DELETE FROM game_attempts WHERE id=? AND state='guessing'").run(attempt.id))();
      if (changed.changes) return res.json({ success: true, finalized: false });
      attempt = attemptForUser(req.params.id, req.user.id);
    }
    if (!attempt) return res.status(404).json({ error: "Attempt not found" });
    if (attempt.state === "finalized") return res.json({ success: true, finalized: true, result: JSON.parse(attempt.finalized_result), locked: true });
    if (!attempt.first_result || !["retry_pending", "retrying"].includes(attempt.state)) return res.status(409).json({ error: "Attempt has no score" });
    if (!finalizeAttemptTx(attempt, attempt.first_result, new Date().toISOString(), [attempt.state])) {
      const current = attemptForUser(attempt.id, req.user.id);
      if (current?.state === "finalized") return res.json({ success: true, finalized: true, result: JSON.parse(current.finalized_result), locked: true });
      return res.status(409).json({ error: "Attempt is no longer active" });
    }
    return res.json({ success: true, finalized: true, result: JSON.parse(attempt.first_result), locked: true });
  } catch (err) {
    console.error("Attempt abandonment failed:", err);
    return res.status(500).json({ error: "Could not abandon attempt" });
  }
});

const LEADERBOARD_MIN_GAMES = 5;
app.get("/api/leaderboard", (req, res) => {
  recoverExpiredAttempts();
  try {
    profiles = loadProfiles();
    const ids = profiles.map((p) => p.id);
    if (!ids.length) return res.json([]);
    const placeholders = ids.map(() => "?").join(",");
    const rows = db.prepare(`SELECT u.username, COUNT(s.profile_id) AS games, ROUND(AVG(s.score)) AS avg, MAX(s.score) AS best
      FROM users u JOIN scores s ON u.id=s.user_id WHERE s.profile_id IN (${placeholders}) GROUP BY u.id HAVING games>=? ORDER BY avg DESC LIMIT 100`)
      .all(...ids, LEADERBOARD_MIN_GAMES);
    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

app.get("/api/locks", authenticateToken, (req, res) => {
  recoverExpiredAttempts();
  try { res.json(db.prepare("SELECT profile_id FROM profile_locks WHERE user_id=?").all(req.user.id).map((row) => row.profile_id)); }
  catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// ─── API Endpoints: Rivals ────────────────────────────────────────────────────

app.post("/api/rivals", authenticateToken, (req, res) => {
  const { username } = req.body;
  if (typeof username !== 'string' || username.length === 0) {
    return res.status(400).json({ error: "username must be a non-empty string" });
  }
  try {
    const rival = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
    if (!rival) {
      return res.status(404).json({ error: "User not found" });
    }
    db.prepare(`
      INSERT INTO rivals (user_id, rival_username) VALUES (?, ?)
      ON CONFLICT(user_id, rival_username) DO NOTHING
    `).run(req.user.id, username);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/rivals/:username", authenticateToken, (req, res) => {
  try {
    db.prepare("DELETE FROM rivals WHERE user_id = ? AND rival_username = ?").run(req.user.id, req.params.username);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/rivals", authenticateToken, (req, res) => {
  try {
    const rows = db.prepare("SELECT rival_username AS username FROM rivals WHERE user_id = ?").all(req.user.id);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── API Endpoints: Duel ──────────────────────────────────────────────────────

app.get("/api/duel/:username", authenticateToken, (req, res) => {
  const rivalUsername = req.params.username;
  try {
    const rival = db.prepare("SELECT id FROM users WHERE username = ?").get(rivalUsername);
    if (!rival) {
      return res.status(404).json({ error: "User not found" });
    }

    // Best score per profile for both players
    const bestPerProfile = (userId) => db.prepare(`
      SELECT profile_id AS profileId, MAX(score) AS score
      FROM scores
      WHERE user_id = ?
      GROUP BY profile_id
    `).all(userId);

    const youRows = bestPerProfile(req.user.id);
    const themRows = bestPerProfile(rival.id);

    const youMap = new Map(youRows.map(r => [r.profileId, r.score]));
    const themMap = new Map(themRows.map(r => [r.profileId, r.score]));

    const you = youRows.map(r => ({ profileId: r.profileId, score: r.score }));
    const them = themRows.map(r => ({ profileId: r.profileId, score: r.score }));
    const common = [...youMap.keys()].filter(pid => themMap.has(pid)).map(pid => ({
      profileId: pid,
      you: youMap.get(pid),
      them: themMap.get(pid)
    }));

    res.json({ you, them, common });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});


app.get("/api/stats", (req, res) => {
  try {
    const usersCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
    res.json({
      profileCount: profiles.length,
      uniquePlayers: usersCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Frontend ─────────────────────────────────────────────────────────────────

// Unknown API paths return JSON rather than the SPA index
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

app.get("*", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(STATIC_DIR, "index.html"));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running at http://${HOST}:${PORT}`);
  console.log(`📦 Profiles loaded: ${profiles.length}`);
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down cleanly`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(() => {
    for (const timer of attemptTimers.values()) clearTimeout(timer);
    attemptTimers.clear();
    try {
      db.close();
    } catch (error) {
      console.error("Failed to close SQLite cleanly", error);
      process.exitCode = 1;
    }
    clearTimeout(forceExit);
    process.exit();
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
