import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(DIST, "assets");
const JSX_FILES = [
  "ui-primitives.jsx",
  "phase1-profile.jsx",
  "phase2-tier.jsx",
  "phase3-school.jsx",
  "phase4-results.jsx",
  "auth.jsx",
  "app.jsx",
];

if (DIST !== path.join(ROOT, "dist") || !DIST.startsWith(`${ROOT}${path.sep}`)) {
  throw new Error(`Refusing to replace unexpected build directory: ${DIST}`);
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.cpSync(PUBLIC, DIST, { recursive: true });
fs.mkdirSync(ASSETS, { recursive: true });

const commonBuild = {
  bundle: true,
  minify: true,
  sourcemap: false,
  metafile: true,
  outdir: ASSETS,
  entryNames: "[name]-[hash]",
  assetNames: "[name]-[hash]",
  legalComments: "eof",
  logLevel: "warning",
};

const [vendorJs, vendorCss] = await Promise.all([
  build({
    ...commonBuild,
    entryPoints: [path.join(ROOT, "scripts", "browser-vendor.js")],
    platform: "browser",
    format: "iife",
    target: ["es2020"],
    define: { "process.env.NODE_ENV": '"production"' },
  }),
  build({
    ...commonBuild,
    entryPoints: [path.join(ROOT, "scripts", "browser-vendor.css")],
    loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
  }),
]);

function outputName(result, extension) {
  const output = Object.keys(result.metafile.outputs).find((file) => file.endsWith(extension));
  if (!output) throw new Error(`Build did not emit a ${extension} file`);
  return path.basename(output);
}

const vendorJsName = outputName(vendorJs, ".js");
const vendorCssName = outputName(vendorCss, ".css");

for (const sourceName of JSX_FILES) {
  const sourcePath = path.join(PUBLIC, sourceName);
  const outputPath = path.join(DIST, sourceName.replace(/\.jsx$/, ".js"));
  const compiled = await transform(fs.readFileSync(sourcePath, "utf8"), {
    loader: "jsx",
    format: "iife",
    minify: true,
    target: "es2020",
    legalComments: "eof",
  });
  fs.writeFileSync(outputPath, compiled.code);
  fs.rmSync(path.join(DIST, sourceName));
}

const indexPath = path.join(DIST, "index.html");
let html = fs.readFileSync(indexPath, "utf8");
html = html
  .replace(/<!-- Fonts -->[\s\S]*?family=Space\+Grotesk[^>]*>\s*/m, "")
  .replace(/<!-- Tabler icons -->[\s\S]*?tabler-icons\.min\.css"\s*\/?>\s*/m,
    `<link rel="stylesheet" href="assets/${vendorCssName}" />\n`)
  .replace(/<!-- Tailwind Play CDN:[\s\S]*?<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>[\s\S]*?<\/script>\s*/m, "")
  .replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^\"]+"><\/script>/,
    `<script src="assets/${vendorJsName}"></script>`)
  .replace(/<!-- React \+ Babel -->[\s\S]*?<script src="https:\/\/unpkg\.com\/@babel\/standalone[^>]*><\/script>\s*/m, "")
  .replace(/<script type="text\/babel" src="([^"]+)\.jsx"><\/script>/g, '<script src="$1.js"></script>');

const forbiddenHosts = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
  "cdn.tailwindcss.com",
  "unpkg.com",
];
for (const host of forbiddenHosts) {
  if (html.includes(host)) throw new Error(`Production index still depends on ${host}`);
}
if (/type="text\/babel"|\.jsx/.test(html)) throw new Error("Production index still contains runtime JSX compilation");

fs.writeFileSync(indexPath, html);
console.log(`Built production assets in ${path.relative(ROOT, DIST)}/`);
