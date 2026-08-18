// scripts/export-verified.js — connects verified consent submissions to the game.
//
// Reads verified_pending_review rows from data/game.db (better-sqlite3), appends
// each to data/queue.jsonl as a reddit-consent draft, and flips the row to
// exported_pending_approval. This is the only writer that bridges the consent
// verification queue into the playable-case review queue.
//
// Usage:
//   node scripts/export-verified.js              # export pending rows
//   node scripts/export-verified.js --dry-run    # report only, no writes
//   node scripts/export-verified.js --all        # also re-export already-exported rows
//   node scripts/export-verified.js --db <path>  # target a different DB (e.g. a temp copy)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const QUEUE_FILE = path.join(DATA_DIR, "queue.jsonl");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const includeExported = args.includes("--all");
const dbIdx = args.indexOf("--db");
const dbPath =
  dbIdx !== -1 && args[dbIdx + 1]
    ? args[dbIdx + 1]
    : path.join(DATA_DIR, "game.db");

const PENDING = "verified_pending_review";
const EXPORTED = "exported_pending_approval";

function loadQueueLines() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return fs.readFileSync(QUEUE_FILE, "utf8").trim().split("\n").filter(Boolean);
}

function draftEntryFromRow(row) {
  return {
    draft: true,
    draftKind: "reddit-consent",
    consent: {
      submissionId: row.id,
      verifiedAt: row.verified_at,
      subreddit: row.subreddit,
      postTitle: row.post_title,
      postBody: row.post_body,
      postPermalink: row.post_permalink,
    },
    source: {
      subreddit: row.subreddit,
      scrape_date: row.verified_at,
    },
  };
}

function main() {
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exitCode = 1;
    return;
  }

  const db = new Database(dbPath, { readonly: dryRun });
  try {
    const statuses = includeExported ? [PENDING, EXPORTED] : [PENDING];
    const placeholders = statuses.map(() => "?").join(", ");
    const rows = db
      .prepare(`SELECT * FROM reddit_submissions WHERE status IN (${placeholders}) ORDER BY verified_at ASC`)
      .all(...statuses);

    if (!rows.length) {
      console.log("0 submissions to export");
      return;
    }

    const queue = loadQueueLines();
    const baseLines = queue.length;
    const updateStatus = db.prepare(
      `UPDATE reddit_submissions SET status = ?, updated_at = ? WHERE id = ?`
    );
    const now = new Date().toISOString();
    let processed = 0;

    const exportAll = db.transaction(() => {
      for (const row of rows) {
        const draft = draftEntryFromRow(row);
        processed += 1;
        if (!dryRun) {
          queue.push(JSON.stringify(draft));
          updateStatus.run(EXPORTED, now, row.id);
        }
        const lineCount = dryRun ? baseLines + processed : queue.length;
        console.log(
          `exported id=${row.id} subreddit=${row.subreddit} title="${(row.post_title || "").slice(0, 60)}" queue_lines=${lineCount}`
        );
      }
    });

    exportAll();
    if (!dryRun) {
      fs.writeFileSync(QUEUE_FILE, queue.join("\n") + (queue.length ? "\n" : ""));
    }

    const finalLines = dryRun ? baseLines + processed : queue.length;
    const label = dryRun ? "[dry-run] would export" : "exported";
    console.log(`\n${label} ${rows.length} submission${rows.length === 1 ? "" : "s"}. queue now ${finalLines} line${finalLines === 1 ? "" : "s"}.`);
    if (rows.length > 0) console.log(`Next: npm run approve`);
  } finally {
    db.close();
  }
}

main();
