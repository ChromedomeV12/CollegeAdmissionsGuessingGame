import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const source = args[args.indexOf("--source") + 1];
const destination = args[args.indexOf("--destination") + 1];
const requestedLimit = Number(args[args.indexOf("--limit") + 1] || 0);

if (!source || !destination || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
  throw new Error("Usage: node scripts/sanitize-profile-seed.mjs --source <jsonl> --destination <jsonl> --limit <count>");
}
if (path.basename(destination) !== "profiles.jsonl") {
  throw new Error("Destination must be an explicitly named profiles.jsonl file");
}

const records = fs.readFileSync(source, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

if (records.length < requestedLimit) {
  throw new Error(`Requested ${requestedLimit} profiles but source contains ${records.length}`);
}

const deniedKeys = new Set([
  "source",
  "source_url",
  "source_platform",
  "post_url",
  "permalink",
  "author",
  "author_name",
  "username",
  "handle",
]);

function stripSourceMetadata(value) {
  if (Array.isArray(value)) return value.map(stripSourceMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !deniedKeys.has(key.toLowerCase()))
      .map(([key, child]) => [key, stripSourceMetadata(child)]),
  );
}

const sanitized = records.slice(0, requestedLimit).map((record, index) => {
  const result = { ...stripSourceMetadata(record), id: `profile_${index + 1}` };
  const serialized = JSON.stringify(result).toLowerCase();
  if (/reddit|rednote|xiaohongshu|https?:\/\//.test(serialized)) {
    throw new Error(`Profile ${index + 1} still contains source-platform metadata`);
  }
  return result;
});

fs.writeFileSync(destination, `${sanitized.map((record) => JSON.stringify(record)).join("\n")}\n`);
console.log(`Wrote ${sanitized.length} sanitized profiles to ${destination}`);
