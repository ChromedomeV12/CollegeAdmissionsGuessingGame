import { env } from "cloudflare:workers";
import { siteUserFromHeaders, type SiteUser } from "@/app/chatgpt-auth";
import {
  evaluateGame,
  type GamePrediction,
  type GameResult,
} from "@/lib/cloudflare-game-score";

const RETRY_WINDOW_MS = 5_000;
const RECOVERY_WINDOW_MS = 5 * 60_000;
const GUESSING_WINDOW_MS = 30 * 60_000;
const LEADERBOARD_MIN_GAMES = 5;
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_IMPORT_BODY_BYTES = 2 * 1024 * 1024;

type RouteContext = { params: Promise<{ path: string[] }> };
type UserRow = { id: string; username: string };
type ProfileRow = {
  id: string;
  sort_order: number;
  public_json: string;
  full_json: string;
};
type AttemptRow = {
  id: string;
  user_id: string;
  profile_id: string;
  state: "guessing" | "retry_pending" | "retrying" | "finalized";
  started_at: string;
  retry_deadline: string | null;
  recovery_deadline: string | null;
  retry_started_at: string | null;
  first_result: string | null;
  first_prediction: string | null;
  finalized_result: string | null;
  finalized_at: string | null;
};

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    sort_order INTEGER NOT NULL UNIQUE,
    public_json TEXT NOT NULL,
    full_json TEXT NOT NULL,
    imported_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    breakdown TEXT,
    PRIMARY KEY (user_id, profile_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS profile_locks (
    user_id TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    locked_at TEXT NOT NULL,
    PRIMARY KEY (user_id, profile_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS rivals (
    user_id TEXT NOT NULL,
    rival_user_id TEXT NOT NULL,
    PRIMARY KEY (user_id, rival_user_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (rival_user_id) REFERENCES users (id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS game_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_game_attempts_active_profile
    ON game_attempts(user_id, profile_id) WHERE state <> 'finalized'`,
  `CREATE INDEX IF NOT EXISTS idx_game_attempts_user_profile
    ON game_attempts(user_id, profile_id)`,
  `CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `INSERT OR IGNORE INTO meta (key, value) VALUES ('scoring_version', '3')`,
];

function responseJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

async function readJson<T>(request: Request, limit = MAX_JSON_BODY_BYTES): Promise<T> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > limit) {
    throw new ApiError(413, "Request body is too large");
  }
  try {
    return JSON.parse(text || "{}") as T;
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}

async function ensureSchema(): Promise<void> {
  if (!env.DB) throw new ApiError(503, "Database unavailable");
  await env.DB.batch(SCHEMA_STATEMENTS.map((statement) => env.DB.prepare(statement)));
}

async function shortIdentityHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

function requestIdentity(request: Request): SiteUser | null {
  return siteUserFromHeaders(request.headers);
}

async function requireUser(request: Request): Promise<UserRow> {
  const identity = requestIdentity(request);
  if (!identity) throw new ApiError(401, "Sign in required");

  const existing = await env.DB.prepare(
    "SELECT id, username FROM users WHERE id = ?",
  )
    .bind(identity.userId)
    .first<UserRow>();
  if (existing) return existing;

  const suffix = await shortIdentityHash(identity.userId);
  const username = `Player-${suffix}`;
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, username, created_at) VALUES (?, ?, ?)",
  )
    .bind(identity.userId, username, new Date().toISOString())
    .run();

  const created = await env.DB.prepare(
    "SELECT id, username FROM users WHERE id = ?",
  )
    .bind(identity.userId)
    .first<UserRow>();
  if (!created) throw new ApiError(500, "Could not initialize account");
  return created;
}

async function profileById(profileId: string): Promise<ProfileRow | null> {
  if (!/^profile_[1-9][0-9]{0,2}$/.test(profileId)) return null;
  return env.DB.prepare(
    "SELECT id, sort_order, public_json, full_json FROM profiles WHERE id = ?",
  )
    .bind(profileId)
    .first<ProfileRow>();
}

function parseStoredJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parsePrediction(body: Record<string, unknown>): GamePrediction {
  return {
    universityTierPick:
      typeof body.universityTierPick === "string" ? body.universityTierPick : null,
    lacTierPick: typeof body.lacTierPick === "string" ? body.lacTierPick : null,
    noUniClaim: body.noUniClaim === true,
    noLacClaim: body.noLacClaim === true,
    schoolSelections: Array.isArray(body.schoolSelections)
      ? body.schoolSelections.filter((value): value is string => typeof value === "string")
      : [],
  };
}

async function attemptForUser(attemptId: string, userId: string): Promise<AttemptRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return null;
  return env.DB.prepare(
    "SELECT * FROM game_attempts WHERE id = ? AND user_id = ?",
  )
    .bind(attemptId, userId)
    .first<AttemptRow>();
}

async function finalizeAttempt(
  attempt: AttemptRow,
  result: GameResult,
  expectedStates: AttemptRow["state"][],
): Promise<boolean> {
  const finalizedAt = new Date().toISOString();
  const resultJson = JSON.stringify(result);
  const placeholders = expectedStates.map(() => "?").join(",");
  const batch = await env.DB.batch([
    env.DB.prepare(
      `UPDATE game_attempts
       SET state='finalized', finalized_result=?, finalized_at=?,
           retry_deadline=NULL, recovery_deadline=NULL
       WHERE id=? AND user_id=? AND state IN (${placeholders})`,
    ).bind(resultJson, finalizedAt, attempt.id, attempt.user_id, ...expectedStates),
    env.DB.prepare(
      `INSERT OR IGNORE INTO profile_locks (user_id, profile_id, locked_at)
       SELECT user_id, profile_id, ? FROM game_attempts
       WHERE id=? AND user_id=? AND state='finalized'
         AND finalized_at=? AND finalized_result=?`,
    ).bind(finalizedAt, attempt.id, attempt.user_id, finalizedAt, resultJson),
    env.DB.prepare(
      `INSERT INTO scores (user_id, profile_id, score, breakdown)
       SELECT user_id, profile_id, ?, ? FROM game_attempts
       WHERE id=? AND user_id=? AND state='finalized'
         AND finalized_at=? AND finalized_result=?
       ON CONFLICT(user_id, profile_id)
       DO UPDATE SET score=excluded.score, breakdown=excluded.breakdown`,
    ).bind(
      result.score,
      resultJson,
      attempt.id,
      attempt.user_id,
      finalizedAt,
      resultJson,
    ),
  ]);
  return Number(batch[0]?.meta?.changes || 0) > 0;
}

async function recoverExpiredAttempts(userId: string): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `DELETE FROM game_attempts
     WHERE user_id=? AND state='guessing'
       AND recovery_deadline IS NOT NULL AND recovery_deadline<=?`,
  )
    .bind(userId, now)
    .run();
  const { results } = await env.DB.prepare(
    `SELECT * FROM game_attempts
     WHERE user_id=? AND first_result IS NOT NULL AND (
       (state='retry_pending' AND retry_deadline IS NOT NULL AND retry_deadline<=?) OR
       (state='retrying' AND recovery_deadline IS NOT NULL AND recovery_deadline<=?)
     ) LIMIT 4`,
  )
    .bind(userId, now, now)
    .all<AttemptRow>();

  for (const attempt of results) {
    const result = parseStoredJson<GameResult | null>(attempt.first_result, null);
    if (result) await finalizeAttempt(attempt, result, [attempt.state]);
  }
}

async function handleMe(request: Request): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const { results } = await env.DB.prepare(
    "SELECT profile_id, score FROM scores WHERE user_id = ?",
  )
    .bind(user.id)
    .all<{ profile_id: string; score: number }>();
  const scores = Object.fromEntries(results.map((row) => [row.profile_id, row.score]));
  return responseJson({ username: user.username, scores });
}

async function handleProfilesList(request: Request): Promise<Response> {
  await requireUser(request);
  const { results } = await env.DB.prepare(
    "SELECT public_json FROM profiles ORDER BY sort_order ASC",
  ).all<{ public_json: string }>();
  return responseJson(results.map((row) => parseStoredJson(row.public_json, {})));
}

async function handleProfile(request: Request, profileId: string): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const row = await profileById(profileId);
  if (!row) throw new ApiError(404, "Profile not found");
  const locked = await env.DB.prepare(
    "SELECT 1 AS found FROM profile_locks WHERE user_id=? AND profile_id=?",
  )
    .bind(user.id, profileId)
    .first<{ found: number }>();
  if (!locked) throw new ApiError(403, "Profile is not finalized");
  return responseJson(parseStoredJson(row.full_json, {}));
}

async function handleStartAttempt(request: Request): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const body = await readJson<{ profileId?: unknown }>(request);
  const profileId = typeof body.profileId === "string" ? body.profileId : "";
  const profile = await profileById(profileId);
  if (!profile) throw new ApiError(400, "Invalid profile");

  const locked = await env.DB.prepare(
    "SELECT 1 AS found FROM profile_locks WHERE user_id=? AND profile_id=?",
  )
    .bind(user.id, profileId)
    .first<{ found: number }>();
  if (locked) throw new ApiError(409, "Profile locked — practice only");

  const attemptId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const recoveryDeadline = new Date(Date.now() + GUESSING_WINDOW_MS).toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO game_attempts
         (id,user_id,profile_id,state,started_at,recovery_deadline)
       VALUES (?,?,?,?,?,?)`,
    )
      .bind(attemptId, user.id, profileId, "guessing", startedAt, recoveryDeadline)
      .run();
  } catch (error) {
    const active = await env.DB.prepare(
      `SELECT id, state FROM game_attempts
       WHERE user_id=? AND profile_id=? AND state<>'finalized'`,
    )
      .bind(user.id, profileId)
      .first<{ id: string; state: AttemptRow["state"] }>();
    if (active) {
      return responseJson(
        {
          error: "Attempt already in progress",
          attemptId: active.id,
          state: active.state,
        },
        409,
      );
    }
    throw error;
  }
  return responseJson({ attemptId, startedAt }, 201);
}

async function handleReveal(
  request: Request,
  attemptId: string,
): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const attempt = await attemptForUser(attemptId, user.id);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.state === "finalized") {
    return responseJson({
      finalized: true,
      result: parseStoredJson(attempt.finalized_result, null),
      locked: true,
    });
  }
  const profileRow = await profileById(attempt.profile_id);
  if (!profileRow) throw new ApiError(404, "Profile not found");
  const body = await readJson<Record<string, unknown>>(request);
  const prediction = parsePrediction(body);
  const profile = parseStoredJson<Record<string, unknown>>(profileRow.full_json, {});
  const startedAt =
    attempt.state === "retrying" ? attempt.retry_started_at : attempt.started_at;
  if (!startedAt) throw new ApiError(409, "Attempt start time is missing");

  let result: GameResult;
  try {
    result = evaluateGame(profile, prediction, startedAt, new Date().toISOString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid game input";
    throw new ApiError(400, message);
  }

  if (attempt.state === "guessing") {
    const retryDeadline = new Date(Date.now() + RETRY_WINDOW_MS).toISOString();
    const changed = await env.DB.prepare(
      `UPDATE game_attempts
       SET state='retry_pending', retry_deadline=?, recovery_deadline=NULL,
           first_result=?, first_prediction=?
       WHERE id=? AND user_id=? AND state='guessing'`,
    )
      .bind(
        retryDeadline,
        JSON.stringify(result),
        JSON.stringify(prediction),
        attempt.id,
        user.id,
      )
      .run();
    if (!changed.meta.changes) {
      throw new ApiError(409, "Attempt is no longer accepting a reveal");
    }
    return responseJson({ finalized: false, result, retryDeadline });
  }

  if (attempt.state !== "retrying") {
    throw new ApiError(409, "Attempt is no longer accepting a reveal");
  }
  if (!(await finalizeAttempt(attempt, result, ["retrying"]))) {
    const current = await attemptForUser(attempt.id, user.id);
    if (current?.state === "finalized") {
      return responseJson({
        finalized: true,
        result: parseStoredJson(current.finalized_result, null),
        locked: true,
      });
    }
    throw new ApiError(409, "Attempt is no longer accepting a reveal");
  }
  return responseJson({ finalized: true, result, locked: true });
}

async function handleRetry(request: Request, attemptId: string): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const attempt = await attemptForUser(attemptId, user.id);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.state !== "retry_pending") {
    throw new ApiError(409, "Retry is unavailable");
  }
  if (!attempt.retry_deadline || Date.parse(attempt.retry_deadline) <= Date.now()) {
    const firstResult = parseStoredJson<GameResult | null>(attempt.first_result, null);
    if (firstResult) await finalizeAttempt(attempt, firstResult, ["retry_pending"]);
    throw new ApiError(409, "Retry window expired");
  }

  const startedAt = new Date().toISOString();
  const recoveryDeadline = new Date(Date.now() + RECOVERY_WINDOW_MS).toISOString();
  const changed = await env.DB.prepare(
    `UPDATE game_attempts
     SET state='retrying', retry_started_at=?, retry_deadline=NULL, recovery_deadline=?
     WHERE id=? AND user_id=? AND state='retry_pending'`,
  )
    .bind(startedAt, recoveryDeadline, attempt.id, user.id)
    .run();
  if (!changed.meta.changes) throw new ApiError(409, "Retry is unavailable");
  return responseJson({ success: true, startedAt });
}

async function handleFinalize(request: Request, attemptId: string): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const attempt = await attemptForUser(attemptId, user.id);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.state === "finalized") {
    return responseJson({
      finalized: true,
      result: parseStoredJson(attempt.finalized_result, null),
      locked: true,
    });
  }
  if (attempt.state !== "retry_pending" || !attempt.first_result) {
    throw new ApiError(409, "Attempt is not ready to finalize");
  }
  if (attempt.retry_deadline && Date.parse(attempt.retry_deadline) > Date.now()) {
    throw new ApiError(409, "Retry window is still open");
  }
  const result = parseStoredJson<GameResult | null>(attempt.first_result, null);
  if (!result) throw new ApiError(409, "Attempt result is unavailable");
  if (!(await finalizeAttempt(attempt, result, ["retry_pending"]))) {
    throw new ApiError(409, "Attempt is no longer ready to finalize");
  }
  return responseJson({ finalized: true, result, locked: true });
}

async function handleAbandon(request: Request, attemptId: string): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  let attempt = await attemptForUser(attemptId, user.id);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.state === "guessing") {
    const deleted = await env.DB.prepare(
      "DELETE FROM game_attempts WHERE id=? AND user_id=? AND state='guessing'",
    )
      .bind(attempt.id, user.id)
      .run();
    if (deleted.meta.changes) {
      return responseJson({ success: true, finalized: false });
    }
    attempt = await attemptForUser(attemptId, user.id);
  }
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (attempt.state === "finalized") {
    return responseJson({
      success: true,
      finalized: true,
      result: parseStoredJson(attempt.finalized_result, null),
      locked: true,
    });
  }
  const result = parseStoredJson<GameResult | null>(attempt.first_result, null);
  if (!result || !["retry_pending", "retrying"].includes(attempt.state)) {
    throw new ApiError(409, "Attempt has no score");
  }
  if (!(await finalizeAttempt(attempt, result, [attempt.state]))) {
    throw new ApiError(409, "Attempt is no longer active");
  }
  return responseJson({ success: true, finalized: true, result, locked: true });
}

async function handleLeaderboard(request: Request): Promise<Response> {
  await requireUser(request);
  const { results: profileRows } = await env.DB.prepare(
    "SELECT id FROM profiles ORDER BY sort_order",
  ).all<{ id: string }>();
  if (!profileRows.length) return responseJson([]);
  const placeholders = profileRows.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT u.username, COUNT(s.profile_id) AS games,
            ROUND(AVG(s.score)) AS avg, MAX(s.score) AS best
     FROM users u JOIN scores s ON u.id=s.user_id
     WHERE s.profile_id IN (${placeholders})
     GROUP BY u.id, u.username
     HAVING COUNT(s.profile_id)>=?
     ORDER BY avg DESC LIMIT 100`,
  )
    .bind(...profileRows.map((row) => row.id), LEADERBOARD_MIN_GAMES)
    .all();
  return responseJson(results);
}

async function handleLocks(request: Request): Promise<Response> {
  const user = await requireUser(request);
  await recoverExpiredAttempts(user.id);
  const { results } = await env.DB.prepare(
    "SELECT profile_id FROM profile_locks WHERE user_id=? ORDER BY locked_at",
  )
    .bind(user.id)
    .all<{ profile_id: string }>();
  return responseJson(results.map((row) => row.profile_id));
}

async function handleRivalsList(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const { results } = await env.DB.prepare(
    `SELECT rival.username
     FROM rivals link JOIN users rival ON rival.id=link.rival_user_id
     WHERE link.user_id=? ORDER BY rival.username`,
  )
    .bind(user.id)
    .all<{ username: string }>();
  return responseJson(results);
}

async function handleRivalAdd(request: Request): Promise<Response> {
  const user = await requireUser(request);
  const body = await readJson<{ username?: unknown }>(request);
  const username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username || username.length > 64) {
    throw new ApiError(400, "username must be a non-empty string");
  }
  const rival = await env.DB.prepare("SELECT id FROM users WHERE username=?")
    .bind(username)
    .first<{ id: string }>();
  if (!rival) throw new ApiError(404, "User not found");
  if (rival.id === user.id) throw new ApiError(400, "You cannot add yourself");
  await env.DB.prepare(
    "INSERT OR IGNORE INTO rivals (user_id, rival_user_id) VALUES (?, ?)",
  )
    .bind(user.id, rival.id)
    .run();
  return responseJson({ success: true });
}

async function handleRivalDelete(request: Request, username: string): Promise<Response> {
  const user = await requireUser(request);
  await env.DB.prepare(
    `DELETE FROM rivals WHERE user_id=? AND rival_user_id=(SELECT id FROM users WHERE username=?)`,
  )
    .bind(user.id, username)
    .run();
  return responseJson({ success: true });
}

async function handleDuel(request: Request, username: string): Promise<Response> {
  const user = await requireUser(request);
  const rival = await env.DB.prepare("SELECT id FROM users WHERE username=?")
    .bind(username)
    .first<{ id: string }>();
  if (!rival) throw new ApiError(404, "User not found");
  const [youRows, themRows] = await Promise.all([
    env.DB.prepare(
      "SELECT profile_id AS profileId, score FROM scores WHERE user_id=?",
    )
      .bind(user.id)
      .all<{ profileId: string; score: number }>(),
    env.DB.prepare(
      "SELECT profile_id AS profileId, score FROM scores WHERE user_id=?",
    )
      .bind(rival.id)
      .all<{ profileId: string; score: number }>(),
  ]);
  const you = youRows.results;
  const them = themRows.results;
  const youMap = new Map(you.map((row) => [row.profileId, row.score]));
  const themMap = new Map(them.map((row) => [row.profileId, row.score]));
  const common = [...youMap.keys()]
    .filter((profileId) => themMap.has(profileId))
    .map((profileId) => ({
      profileId,
      you: youMap.get(profileId),
      them: themMap.get(profileId),
    }));
  return responseJson({ you, them, common });
}

async function handleStats(request: Request): Promise<Response> {
  await requireUser(request);
  const [profiles, users] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS count FROM profiles"),
    env.DB.prepare("SELECT COUNT(*) AS count FROM users"),
  ]);
  return responseJson({
    profileCount: Number((profiles.results[0] as { count?: number })?.count || 0),
    uniquePlayers: Number((users.results[0] as { count?: number })?.count || 0),
  });
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < max; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function handleProfileImport(request: Request): Promise<Response> {
  const configuredToken = env.PROFILE_IMPORT_TOKEN;
  if (!configuredToken) throw new ApiError(404, "Not found");
  const providedToken = request.headers.get("x-import-token") || "";
  if (!constantTimeStringEqual(providedToken, configuredToken)) {
    throw new ApiError(403, "Import is not authorized");
  }
  const body = await readJson<{ profiles?: unknown }>(request, MAX_IMPORT_BODY_BYTES);
  if (!Array.isArray(body.profiles) || body.profiles.length < 1 || body.profiles.length > 100) {
    throw new ApiError(400, "profiles must contain between 1 and 100 records");
  }
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM profiles")
    .first<{ count: number }>();
  if (Number(existing?.count || 0) > 0) {
    throw new ApiError(409, "Profiles have already been imported");
  }

  const importedAt = new Date().toISOString();
  const statements = body.profiles.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ApiError(400, `Profile ${index + 1} is invalid`);
    }
    const input = value as Record<string, unknown>;
    const id = `profile_${index + 1}`;
    const { source: _source, ...withoutSource } = input;
    const fullProfile: Record<string, unknown> = { ...withoutSource, id };
    const serializedProfile = JSON.stringify(fullProfile).toLowerCase();
    if (/reddit|rednote|xiaohongshu|https?:\/\//.test(serializedProfile)) {
      throw new ApiError(400, `Profile ${index + 1} contains source-platform metadata`);
    }
    const {
      application_results: _applicationResults,
      game_metadata: _gameMetadata,
      ...publicProfile
    } = fullProfile;
    return env.DB.prepare(
      `INSERT INTO profiles (id, sort_order, public_json, full_json, imported_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         sort_order=excluded.sort_order,
         public_json=excluded.public_json,
         full_json=excluded.full_json,
         imported_at=excluded.imported_at`,
    ).bind(
      id,
      index + 1,
      JSON.stringify(publicProfile),
      JSON.stringify(fullProfile),
      importedAt,
    );
  });

  await env.DB.batch(statements);
  return responseJson({ imported: statements.length }, 201);
}

async function dispatch(request: Request, context: RouteContext): Promise<Response> {
  await ensureSchema();
  const { path = [] } = await context.params;
  const method = request.method.toUpperCase();

  if (method === "GET" && path.length === 1 && path[0] === "me") {
    return handleMe(request);
  }
  if (method === "GET" && path.length === 1 && path[0] === "profiles") {
    return handleProfilesList(request);
  }
  if (method === "GET" && path.length === 2 && path[0] === "profiles") {
    return handleProfile(request, path[1]);
  }
  if (method === "POST" && path.join("/") === "attempts/start") {
    return handleStartAttempt(request);
  }
  if (method === "POST" && path.length === 3 && path[0] === "attempts") {
    if (path[2] === "reveal") return handleReveal(request, path[1]);
    if (path[2] === "retry") return handleRetry(request, path[1]);
    if (path[2] === "finalize") return handleFinalize(request, path[1]);
    if (path[2] === "abandon") return handleAbandon(request, path[1]);
  }
  if (method === "GET" && path.join("/") === "leaderboard") {
    return handleLeaderboard(request);
  }
  if (method === "GET" && path.join("/") === "locks") {
    return handleLocks(request);
  }
  if (path.length === 1 && path[0] === "rivals") {
    if (method === "GET") return handleRivalsList(request);
    if (method === "POST") return handleRivalAdd(request);
  }
  if (method === "DELETE" && path.length === 2 && path[0] === "rivals") {
    return handleRivalDelete(request, path[1]);
  }
  if (method === "GET" && path.length === 2 && path[0] === "duel") {
    return handleDuel(request, path[1]);
  }
  if (method === "GET" && path.join("/") === "stats") {
    return handleStats(request);
  }
  if (method === "GET" && path.join("/") === "submissions/config") {
    return responseJson({ enabled: false });
  }
  if (method === "POST" && path.join("/") === "admin/profiles/import") {
    return handleProfileImport(request);
  }
  if (path[0] === "register" || path[0] === "login") {
    throw new ApiError(410, "Password login was replaced by managed site sign-in");
  }
  throw new ApiError(404, "Not found");
}

async function route(request: Request, context: RouteContext): Promise<Response> {
  try {
    return await dispatch(request, context);
  } catch (error) {
    if (error instanceof ApiError) {
      return responseJson({ error: error.message }, error.status);
    }
    console.error("Cloudflare API failure", error);
    return responseJson({ error: "Internal server error" }, 500);
  }
}

export const GET = route;
export const POST = route;
export const DELETE = route;
