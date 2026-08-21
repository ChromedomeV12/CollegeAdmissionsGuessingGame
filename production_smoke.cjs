#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const puppeteer = require("puppeteer");

const ROOT = __dirname;

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function waitForReady(base, child, output) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`production server exited early: ${output()}`);
    try {
      const response = await fetch(`${base}/readyz`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`production server did not become ready: ${output()}`);
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "admission-production-smoke-"));
  fs.copyFileSync(path.join(ROOT, "data", "profiles.jsonl"), path.join(dataDir, "profiles.jsonl"));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let output = "";
  let browser;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: String(port),
      DATA_DIR: dataDir,
      STATIC_DIR: "dist",
      JWT_SECRET: "production-smoke-secret-production-smoke-secret-1234567890",
      SUBMISSIONS_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });

  try {
    await waitForReady(base, child, () => output);
    const response = await fetch(`${base}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.match(response.headers.get("content-security-policy") || "", /default-src 'self'/);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    const html = await response.text();
    assert.equal(/https?:\/\/(?!127\.0\.0\.1)/.test(html), false, "production HTML contains a third-party URL");

    const assetPath = html.match(/src="(assets\/browser-vendor-[^"]+\.js)"/)?.[1];
    assert.ok(assetPath, "production HTML is missing its local vendor bundle");
    const asset = await fetch(`${base}/${assetPath}`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("cache-control") || "", /immutable/);

    const externalHosts = new Set();
    const browserErrors = [];
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") {
        externalHosts.add(url.hostname);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(message.text());
        console.error("[production-browser]", message.text());
      }
    });
    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
      console.error("[production-browser]", error.message);
    });
    await page.goto(`${base}/`, { waitUntil: "networkidle0" });
    await page.waitForSelector("#auth-username");
    assert.deepEqual([...externalHosts], []);
    assert.deepEqual(browserErrors, []);
    assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    console.log(`[production-smoke] PASS ${base} served a CSP-protected, first-party-only browser build`);
  } finally {
    if (browser) await browser.close();
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("[production-smoke] FAIL", error);
  process.exitCode = 1;
});
