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
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev";
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || "";
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || "";
const REDDIT_REDIRECT_URI = process.env.REDDIT_REDIRECT_URI || "";
const REDDIT_USER_AGENT = process.env.REDDIT_USER_AGENT || "web:AdmissionsOracle:1.0 (by /u/MJanW)";
const CONSENT_VERSION = "2026-08-17";
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_CODE_TTL_MS = 30 * 60 * 1000;
const FALLBACK_VERIFICATION_ENABLED = true;
const redditOAuthConfigured = Boolean(REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET && REDDIT_REDIRECT_URI);
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in production.");
}
if (!redditOAuthConfigured) {
  console.warn("⚠️  Reddit ownership verification is disabled. Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_REDIRECT_URI.");
}

app.use(bodyParser.json());
app.use(express.static("public"));

const dataDir = "data";
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
    .filter(Boolean);
}

let profiles = loadProfiles();

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
    
    const token = jwt.sign({ id: info.lastInsertRowid, username }, JWT_SECRET);
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

    const userScores = db.prepare("SELECT profile_id, score FROM scores WHERE user_id = ?").all(user.id);
    const scoresDict = {};
    for (const row of userScores) {
      scoresDict[row.profile_id] = row.score;
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
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
    redditOAuthConfigured,
    fallbackEnabled: true,
    consentVersion: CONSENT_VERSION,
    maxSubmissionsPerHour: 5,
  });
});

app.get("/api/submissions", authenticateToken, (req, res) => {
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

app.post("/api/submissions", authenticateToken, submissionRateLimit, (req, res) => {
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

app.post("/api/submissions/:id/confirm-fallback", authenticateToken, async (req, res) => {
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

app.get("/api/submissions/reddit/callback", async (req, res) => {
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

app.delete("/api/submissions/:id", authenticateToken, (req, res) => {
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

app.get("/api/profiles", (req, res) => {
  profiles = loadProfiles();
  const stripped = profiles.map(p => {
    const { application_results, source, ...rest } = p;
    return rest;
  });
  res.json(stripped);
});

app.get("/api/profiles/:id", (req, res) => {
  const profile = profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const { source, ...publicProfile } = profile;
  res.json(publicProfile);
});

app.post("/api/scores", authenticateToken, (req, res) => {
  const { profileId, score, breakdown } = req.body;
  if (typeof profileId !== 'string' || profileId.length === 0 || profileId.length > 64) {
    return res.status(400).json({ error: "profile_id must be a non-empty string up to 64 characters" });
  }
  if (!Number.isInteger(score) || score < -100 || score > 100) {
    return res.status(400).json({ error: "score must be an integer between -100 and 100" });
  }

  try {
    // Only update if new score is higher or it doesn't exist
    const current = db.prepare("SELECT score FROM scores WHERE user_id = ? AND profile_id = ?").get(req.user.id, profileId);
    
    if (!current || score > current.score) {
      db.prepare(`
        INSERT INTO scores (user_id, profile_id, score, breakdown) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id, profile_id) DO UPDATE SET 
        score=excluded.score, breakdown=excluded.breakdown
      `).run(req.user.id, profileId, score, breakdown ? JSON.stringify(breakdown) : null);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/leaderboard", (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.username, COUNT(s.profile_id) as games, SUM(s.score) as total 
      FROM users u 
      JOIN scores s ON u.id = s.user_id 
      GROUP BY u.id 
      ORDER BY total DESC 
      LIMIT 100
    `).all();
    res.json(rows);
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
  res.sendFile(path.resolve("public/index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📦 Profiles loaded: ${profiles.length}`);
});
