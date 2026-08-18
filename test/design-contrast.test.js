// test/design-contrast.test.js — asserts WCAG contrast ratios for the design
// token pairs recorded in test/design-contrast.json. Body pairs must reach
// >= 4.5:1; UI pairs (borders, focus indicators, icons) must reach >= 3:1.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "design-contrast.json"), "utf8")
);

// WCAG 2.x relative luminance. Channel values are sRGB 0..255 hex strings.
function channelLinear(c) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) throw new Error(`Bad hex color in contrast manifest: ${hex}`);
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

function contrastRatio(fg, bg) {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const pairs = Array.isArray(manifest.pairs) ? manifest.pairs : manifest;

for (const pair of pairs) {
  const role = pair.role || "body";
  const threshold = role === "ui" ? 3 : 4.5;
  const ratio = contrastRatio(pair.fg, pair.bg);
  const label = `${pair.fg_name || pair.fg} on ${pair.bg_name || pair.bg} (${role})`;
  test(`contrast ${label} >= ${threshold}:1 (actual ${ratio.toFixed(2)}:1)`, () => {
    assert.ok(
      ratio >= threshold,
      `${label}: ${ratio.toFixed(2)}:1 is below the ${threshold}:1 ${role} minimum`
    );
  });
}
