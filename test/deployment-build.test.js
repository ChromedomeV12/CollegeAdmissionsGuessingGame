import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

test("production build self-hosts every boot-critical browser dependency", () => {
  const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const forbidden = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
    "cdn.jsdelivr.net",
    "cdn.tailwindcss.com",
    "unpkg.com",
    "logo.clearbit.com",
    "text/babel",
    ".jsx",
  ];
  for (const value of forbidden) assert.equal(html.includes(value), false, `production HTML contains ${value}`);

  assert.match(html, /assets\/browser-vendor-[A-Z0-9]+\.css/i);
  assert.match(html, /assets\/browser-vendor-[A-Z0-9]+\.js/i);
  for (const script of [
    "ui-primitives.js",
    "phase1-profile.js",
    "phase2-tier.js",
    "phase3-school.js",
    "phase4-results.js",
    "auth.js",
    "app.js",
  ]) {
    assert.equal(fs.existsSync(path.join(DIST, script)), true, `missing compiled ${script}`);
  }
  assert.equal(fs.existsSync(path.join(DIST, "uploads")), false, "prototype uploads leaked into production assets");

  const builtSources = fs.readdirSync(DIST)
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.join(DIST, file), "utf8"))
    .join("\n");
  assert.equal(builtSources.includes("logo.clearbit.com"), false, "production JS still calls the retired logo service");
});
