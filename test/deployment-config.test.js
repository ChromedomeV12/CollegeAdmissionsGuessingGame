import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

test("container release is non-root, health-checked, and reproducibly built", () => {
  const dockerfile = read("Dockerfile");
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS build/);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /npm prune --omit=dev/);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /HEALTHCHECK[\s\S]*readyz/);
  assert.match(dockerfile, /VOLUME \["\/app\/data"\]/);
});

test("private compose deployment is loopback-only with durable data and submissions disabled", () => {
  const compose = read("deploy/compose.private.yaml");
  assert.match(compose, /127\.0\.0\.1:\$\{APP_PORT:-3005\}:3005/);
  assert.match(compose, /SUBMISSIONS_ENABLED:\s*"false"/);
  assert.match(compose, /JWT_SECRET:\s*\$\{JWT_SECRET:\?/);
  assert.match(compose, /read_only:\s*true/);
  assert.match(compose, /app-data:\/app\/data/);
  assert.doesNotMatch(compose, /0\.0\.0\.0:\$\{APP_PORT/);

  const envExample = read("deploy/private.env.example");
  assert.match(envExample, /^JWT_SECRET=\s*$/m);
  const runbook = read("docs/PRIVATE_DEPLOYMENT_RUNBOOK.md");
  assert.match(runbook, /ssh -L 3005:127\.0\.0\.1:3005/);
  assert.match(runbook, /not a public launch/i);
});
