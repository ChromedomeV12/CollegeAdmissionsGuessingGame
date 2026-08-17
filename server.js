import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3005;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev";
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET not set — using insecure dev fallback. Set JWT_SECRET in production.");
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
`);

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

// ─── API Endpoints: Game ──────────────────────────────────────────────────────

app.get("/api/profiles", (req, res) => {
  profiles = loadProfiles();
  const stripped = profiles.map(p => {
    const { application_results, ...rest } = p;
    return rest;
  });
  res.json(stripped);
});

app.get("/api/profiles/:id", (req, res) => {
  const profile = profiles.find(p => p.id === req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  res.json(profile);
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
