import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profileId = "profile_1";
const predictionA = { universityTierPick: "HYPSM", lacTierPick: "T5 LAC", noUniClaim: false, noLacClaim: false, schoolSelections: [] };
const predictionB = { universityTierPick: "T50", lacTierPick: "T20 LAC", noUniClaim: false, noLacClaim: false, schoolSelections: [] };
let dataDir;
let port;
let child;
let base;
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
}

function startServer() {
  child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, DATA_DIR: dataDir, PORT: String(port), JWT_SECRET: "focused-test-secret" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 10_000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (output.includes("Server running")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${output}`));
    });
  });
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

async function api(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json();
  return { response, body };
}

async function register(label) {
  const result = await api("/api/register", {
    method: "POST",
    body: JSON.stringify({ username: `lc_${label}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`.slice(0, 20), password: "password123" }),
  });
  assert.equal(result.response.status, 200);
  return result.body;
}

async function authApi(token, pathname, options = {}) {
  return api(pathname, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) } });
}

function db() {
  return new Database(path.join(dataDir, "game.db"));
}

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "admission-lifecycle-"));
  fs.copyFileSync(path.join(ROOT, "data", "profiles.jsonl"), path.join(dataDir, "profiles.jsonl"));
  port = await freePort();
  base = `http://127.0.0.1:${port}`;
  await startServer();
});

after(async () => {
  await stopServer();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("new auth tokens expire in about seven days", async () => {
  const registered = await register("jwt");
  const payloads = [registered.token];
  const login = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username: registered.username, password: "password123" }),
  });
  assert.equal(login.response.status, 200);
  payloads.push(login.body.token);
  for (const token of payloads) {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    assert.ok(payload.exp - payload.iat >= 7 * 24 * 60 * 60 - 2);
    assert.ok(payload.exp - payload.iat <= 7 * 24 * 60 * 60 + 2);
  }
});

test("health and readiness probes report a usable single-instance service", async () => {
  const health = await api("/healthz");
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(health.response.headers.get("cache-control"), "no-store");
  assert.equal(health.response.headers.get("x-content-type-options"), "nosniff");

  const readiness = await api("/readyz");
  assert.equal(readiness.response.status, 200);
  assert.equal(readiness.body.status, "ready");
  assert.ok(readiness.body.profiles > 0);
});

test("production startup fails closed without JWT_SECRET", async () => {
  const failed = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      JWT_SECRET: "",
      DATA_DIR: dataDir,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  failed.stdout.on("data", (chunk) => { output += chunk; });
  failed.stderr.on("data", (chunk) => { output += chunk; });
  const code = await new Promise((resolve) => failed.once("exit", resolve));
  assert.notEqual(code, 0);
  assert.match(output, /JWT_SECRET.*required in production/i);
});

test("profiles list redacts answer-bearing metadata while locked detail retains it", async () => {
  const listed = await api("/api/profiles");
  assert.equal(listed.response.status, 200);
  assert.ok(listed.body.length > 0);
  for (const profile of listed.body) {
    assert.equal(Object.hasOwn(profile, "application_results"), false);
    assert.equal(Object.hasOwn(profile, "source"), false);
    assert.equal(Object.hasOwn(profile, "game_metadata"), false);
  }
  const auth = await register("detail");
  const started = await authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId }) });
  const revealed = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/reveal`, { method: "POST", body: JSON.stringify(predictionA) });
  const abandoned = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/abandon`, { method: "POST" });
  assert.equal(revealed.response.status, 200);
  assert.equal(abandoned.response.status, 200);
  const detail = await authApi(auth.token, `/api/profiles/${profileId}`);
  assert.equal(detail.response.status, 200);
  assert.ok(Object.hasOwn(detail.body, "application_results"));
  assert.ok(Object.hasOwn(detail.body, "game_metadata"));
});

test("concurrent starts allow no attempt after a permanent lock", async () => {
  const auth = await register("start");
  const starts = await Promise.all([
    authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId: "profile_2" }) }),
    authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId: "profile_2" }) }),
  ]);
  assert.deepEqual(starts.map(({ response }) => response.status).sort(), [201, 409]);
  const attempt = starts.find(({ response }) => response.status === 201).body.attemptId;
  await authApi(auth.token, `/api/attempts/${attempt}/reveal`, { method: "POST", body: JSON.stringify(predictionA) });
  await authApi(auth.token, `/api/attempts/${attempt}/abandon`, { method: "POST" });
  const after = await authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId: "profile_2" }) });
  assert.equal(after.response.status, 409);
});

test("competing retry reveal and abandon have one durable winner", async () => {
  const auth = await register("race");
  const started = await authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId: "profile_3" }) });
  await authApi(auth.token, `/api/attempts/${started.body.attemptId}/reveal`, { method: "POST", body: JSON.stringify(predictionA) });
  const retry = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/retry`, { method: "POST" });
  assert.equal(retry.response.status, 200);
  const rejectedFinalize = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/finalize`, { method: "POST" });
  assert.equal(rejectedFinalize.response.status, 409);
  const [reveal, abandon] = await Promise.all([
    authApi(auth.token, `/api/attempts/${started.body.attemptId}/reveal`, { method: "POST", body: JSON.stringify(predictionB) }),
    authApi(auth.token, `/api/attempts/${started.body.attemptId}/abandon`, { method: "POST" }),
  ]);
  assert.ok([200, 409].includes(reveal.response.status));
  assert.ok([200, 409].includes(abandon.response.status));
  const database = db();
  const row = database.prepare("SELECT state, first_result, finalized_result FROM game_attempts WHERE id=?").get(started.body.attemptId);
  const score = database.prepare("SELECT breakdown FROM scores WHERE profile_id=?").get("profile_3");
  const lockCount = database.prepare("SELECT COUNT(*) AS count FROM profile_locks WHERE profile_id=?").get("profile_3").count;
  const scoreCount = database.prepare("SELECT COUNT(*) AS count FROM scores WHERE profile_id=?").get("profile_3").count;
  database.close();
  assert.equal(row.state, "finalized");
  assert.equal(score.breakdown, row.finalized_result);
  const successfulResults = [reveal, abandon]
    .filter(({ response, body }) => response.status === 200 && body?.result)
    .map(({ body }) => JSON.stringify(body.result));
  assert.ok(successfulResults.length >= 1);
  assert.ok(successfulResults.every((result) => result === row.finalized_result));
  assert.equal(lockCount, 1);
  assert.equal(scoreCount, 1);
});

test("retrying survives restart until recovery deadline, then lazy recovery uses first result", async () => {
  const auth = await register("recovery");
  const started = await authApi(auth.token, "/api/attempts/start", { method: "POST", body: JSON.stringify({ profileId: "profile_4" }) });
  const first = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/reveal`, { method: "POST", body: JSON.stringify(predictionA) });
  await authApi(auth.token, `/api/attempts/${started.body.attemptId}/retry`, { method: "POST" });
  let database = db();
  const before = database.prepare("SELECT state, recovery_deadline, first_result FROM game_attempts WHERE id=?").get(started.body.attemptId);
  assert.equal(before.state, "retrying");
  assert.ok(before.recovery_deadline);
  database.prepare("UPDATE game_attempts SET recovery_deadline=? WHERE id=?").run(new Date(Date.now() + 60_000).toISOString(), started.body.attemptId);
  database.close();
  await stopServer();
  await startServer();
  const alive = await authApi(auth.token, "/api/me");
  assert.equal(alive.response.status, 200);
  database = db();
  const after = database.prepare("SELECT state, finalized_result FROM game_attempts WHERE id=?").get(started.body.attemptId);
  database.close();
  assert.equal(after.state, "retrying");
  assert.equal(after.finalized_result, null);
  database = db();
  database.prepare("UPDATE game_attempts SET recovery_deadline=? WHERE id=?").run(new Date(Date.now() - 1).toISOString(), started.body.attemptId);
  database.close();
  const recovered = await authApi(auth.token, "/api/me");
  assert.equal(recovered.response.status, 200);
  database = db();
  const finalized = database.prepare("SELECT state, first_result, finalized_result FROM game_attempts WHERE id=?").get(started.body.attemptId);
  database.close();
  assert.equal(finalized.state, "finalized");
  assert.equal(finalized.finalized_result, first.body.result ? JSON.stringify(first.body.result) : finalized.first_result);
});

test("finalization transaction rolls back score, lock, and attempt state on database failure", async () => {
  const auth = await register("rollback");
  const rollbackProfile = "profile_6";
  const started = await authApi(auth.token, "/api/attempts/start", {
    method: "POST",
    body: JSON.stringify({ profileId: rollbackProfile }),
  });
  assert.equal(started.response.status, 201);
  const revealed = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/reveal`, {
    method: "POST",
    body: JSON.stringify(predictionA),
  });
  assert.equal(revealed.response.status, 200);

  let database = db();
  database.exec(`
    CREATE TRIGGER fail_score_insert
    BEFORE INSERT ON scores
    BEGIN
      SELECT RAISE(ABORT, 'injected score failure');
    END;
  `);
  database.close();

  const abandoned = await authApi(auth.token, `/api/attempts/${started.body.attemptId}/abandon`, { method: "POST" });
  assert.equal(abandoned.response.status, 500);

  database = db();
  const attempt = database.prepare("SELECT state, finalized_result FROM game_attempts WHERE id=?").get(started.body.attemptId);
  const scoreCount = database.prepare("SELECT COUNT(*) AS count FROM scores WHERE user_id=? AND profile_id=?")
    .get(JSON.parse(Buffer.from(auth.token.split(".")[1], "base64url").toString("utf8")).id, rollbackProfile).count;
  const lockCount = database.prepare("SELECT COUNT(*) AS count FROM profile_locks WHERE user_id=? AND profile_id=?")
    .get(JSON.parse(Buffer.from(auth.token.split(".")[1], "base64url").toString("utf8")).id, rollbackProfile).count;
  database.exec("DROP TRIGGER fail_score_insert");
  database.close();

  assert.equal(attempt.state, "retry_pending");
  assert.equal(attempt.finalized_result, null);
  assert.equal(scoreCount, 0);
  assert.equal(lockCount, 0);
});
