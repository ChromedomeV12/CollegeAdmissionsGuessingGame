import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagedGame = path.join(ROOT, "site-assets", "game");
const publicGame = path.join(ROOT, "public", "game");

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (publicGame !== path.join(ROOT, "public", "game")) {
  throw new Error(`Refusing to replace unexpected public asset directory: ${publicGame}`);
}
fs.rmSync(publicGame, { recursive: true, force: true });

run(process.execPath, ["scripts/build.mjs"], {
  ...process.env,
  BUILD_OUTPUT_DIR: path.relative(ROOT, stagedGame),
});

fs.cpSync(stagedGame, publicGame, { recursive: true });

run(process.platform === "win32" ? "npx.cmd" : "npx", ["vinext", "build"]);
