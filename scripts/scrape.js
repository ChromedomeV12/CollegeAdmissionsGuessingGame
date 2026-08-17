import "dotenv/config";
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const QUEUE_FILE = path.join(DATA_DIR, "queue.jsonl");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.jsonl");
const SEEN_FILE = path.join(DATA_DIR, "seen_ids.json");

fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── Reddit public JSON ───────────────────────────────────────────────────────

async function fetchPostByUrl(url) {
  let jsonUrl = url;
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith('.json')) {
    const cleanPath = parsed.pathname.endsWith('/') ? parsed.pathname.slice(0, -1) : parsed.pathname;
    jsonUrl = `${parsed.protocol}//${parsed.host}${cleanPath}.json`;
  }
  console.log(`Fetching specific post from ${jsonUrl}`);
  const res = await fetch(jsonUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9"
    },
  });
  if (!res.ok) throw new Error(`Reddit fetch failed for ${jsonUrl}: HTTP ${res.status}`);
  const bodyText = await res.text();
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Reddit fetch failed for ${jsonUrl}: HTTP ${res.status} returned non-JSON body (${bodyText.slice(0, 200)})`);
  }
  if (Array.isArray(data) && data.length > 0) {
    const children = data[0]?.data?.children || [];
    if (children.length > 0) return children[0].data;
  }
  return null;
}

async function fetchSubredditPosts(subreddit, limit = 50) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Reddit fetch failed for ${url}: HTTP ${res.status}`);
  const bodyText = await res.text();
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch {
    throw new Error(`Reddit fetch failed for ${url}: HTTP ${res.status} returned non-JSON body (${bodyText.slice(0, 200)})`);
  }
  return data?.data?.children?.map((c) => c.data) ?? [];
}

// ─── OpenRouter AI call ───────────────────────────────────────────────────────

async function callAI(prompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "Admissions Oracle",
    },
    body: JSON.stringify({
      model: "google/gemini-flash-1.5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`OpenRouter API error HTTP ${res.status}: ${err.slice(0, 500)}`);
    throw new Error(`OpenRouter API call failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI");
  const clean = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(clean);
}

// ─── Extraction prompt ────────────────────────────────────────────────────────

function buildPrompt(post) {
  const today = new Date().toISOString().split("T")[0];
  const postDate = new Date(post.created_utc * 1000).toISOString().split("T")[0];
  return `You are a data extraction assistant for a college admissions guessing game.
Read this Reddit post where someone shares their college application results.

First, determine if the post is rich enough to be a playable game scenario. It MUST have:
1. Clear academic stats (like GPA or test scores).
2. Rigorous courses mentioned (APs, Honors, IB, etc).
3. Clear application results (Accepted/Rejected/Waitlisted).

If it is too sparse or doesn't have actual admission results, respond with exactly:
{"is_rich_enough": false, "rejection_reason": "<why>"}

If it is rich enough, set \`is_rich_enough\` to true, and extract the following into \`game_record\`. Respond with ONLY a JSON object (no markdown blocks) matching this exact structure:
{
  "is_rich_enough": true,
  "game_record": {
    "id": "cr_YEAR_XXX",
    "source": { "subreddit": "${post.subreddit}", "post_date": "${postDate}", "reddit_post_id": "${post.id}", "scrape_date": "${today}" },
    "demographics": {
      "gender": "<Male|Female|Non-binary|Unknown>",
      "ethnicity": "<Asian|East Asian|South Asian|Hispanic/Latina|Black|White|Middle Eastern|Mixed|Unknown>",
      "school_type": "<Public|Private Day|Private Boarding School|Homeschool|Unknown>",
      "school_region": "<Northeast|New England|Mid-Atlantic|Southeast|Midwest|Southwest|West|International|Unknown>",
      "school_classification": "<Feeder School|Strong public|Average public|Non-feeder|Unknown>",
      "ses": "<Low Income|Middle Income|High Income|Unknown>",
      "first_generation": null,
      "legacy_status": false
    },
    "test_scores": {
      "sat": null,
      "act": null,
      "ap_scores_count": null
    },
    "academic_profile": {
      "gpa": { "unweighted": null, "unweighted_scale": null, "weighted": null },
      "course_rigor": {
        "total_ap_courses": null,
        "total_honors_courses": null,
        "total_post_ap_courses": null,
        "courses_by_year": { "9th": [], "10th": [], "11th": [], "12th": [] },
        "course_load_notes": ""
      }
    },
    "extracurriculars": [
      { "id": 1, "category": "<Research/Internship|Athletics|Academic/STEM|Leadership|Arts|Service|Work|Competition>", "title": "<title>", "description": "<description>", "achievements": [], "tier": 2 }
    ],
    "awards_honors": [],
    "application_results": {
      "rejected": [{ "school": "<name>", "decision_type": "RD", "notes": null }],
      "accepted": [{ "school": "<name>", "decision_type": "RD", "notes": null }],
      "waitlisted": [{ "school": "<name>", "decision_type": "WL", "notes": null }],
      "deferred": [],
      "final_decision": { "school": "<school attending>", "decision_date": null }
    },
    "game_metadata": {
      "difficulty_level": "<Easy|Medium|Hard|Very Hard>",
      "actual_school_tier": "<HYPSM|T10|T15|T20|T30|T50|Below T50>",
      "teaching_points": ["<key insight about why results turned out this way>"],
      "hints": { "easy": [], "medium": [], "hard": [] }
    },
    "qualitative_notes": "<student commentary>"
  }
}

Post title: ${post.title}
Post body:
${(post.selftext || "").slice(0, 5000)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSeen() {
  try { return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8"))); }
  catch { return new Set(); }
}
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2));
}
function loadLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
}
function nextId(profiles) {
  const year = new Date().getFullYear();
  const nums = profiles.filter(p => p.id?.startsWith(`cr_${year}_`)).map(p => parseInt(p.id.split("_")[2] || "0", 10));
  return `cr_${year}_${String(Math.max(0, ...nums) + 1).padStart(3, "0")}`;
}

// ─── Scrape ───────────────────────────────────────────────────────────────────

async function runScrape(url = null) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not set in .env file");
    process.exit(1);
  }

  const seen = loadSeen();
  const queue = [];

  if (url) {
    console.log(`\nFetching specific URL: ${url}`);
    try {
      const post = await fetchPostByUrl(url);
      if (!post) throw new Error("Could not extract post data from URL");
      
      console.log(`  "${post.title.slice(0, 55)}"... `);
      const extracted = await callAI(buildPrompt(post));
      
      if (extracted.skip || extracted.is_rich_enough === false) {
        console.log(`SKIP (${extracted.rejection_reason || extracted.reason || "Not rich enough"})`);
      } else {
        const record = extracted.game_record || extracted;
        queue.push(record);
        console.log(`✓ queued`);
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  } else {
    const subreddits = ["collegeresults", "ApplyingToCollege"];

    for (const sub of subreddits) {
      console.log(`\nFetching r/${sub}...`);
      let posts;
      try {
        posts = await fetchSubredditPosts(sub, 50);
      } catch (err) {
        console.log(`  Could not fetch r/${sub}: ${err.message}`);
        continue;
      }
      console.log(`  Got ${posts.length} posts`);

      for (const post of posts) {
        if (seen.has(post.id)) { process.stdout.write("."); continue; }
        if (!post.selftext || post.selftext.length < 150 || post.selftext === "[removed]") {
          seen.add(post.id); continue;
        }

        process.stdout.write(`\n  "${post.title.slice(0, 55)}"... `);

        try {
          const extracted = await callAI(buildPrompt(post));
          seen.add(post.id);
          
          if (extracted.skip || extracted.is_rich_enough === false) {
            console.log(`SKIP (${extracted.rejection_reason || extracted.reason || "Not rich enough"})`);
            continue;
          }
          
          const record = extracted.game_record || extracted; // fallback for safety
          queue.push(record);
          console.log(`✓ queued`);
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.log(`ERROR: ${err.message}`);
          seen.add(post.id);
        }
      }
    }
  }

  const existing = loadLines(QUEUE_FILE);
  fs.writeFileSync(QUEUE_FILE, [...existing, ...queue].map(p => JSON.stringify(p)).join("\n") + "\n");
  if (!url) saveSeen(seen);

  console.log(`\n\n✅ Done! ${queue.length} new profiles queued for review.`);
  if (queue.length > 0) console.log(`Next: npm run approve`);
  else console.log(`No new profiles this time.`);
}

// ─── Approve ──────────────────────────────────────────────────────────────────

async function runApprove() {
  const queued = loadLines(QUEUE_FILE);
  if (!queued.length) { console.log("Queue is empty. Run 'npm run scrape' first."); return; }

  const approved = loadLines(PROFILES_FILE);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(res => rl.question(q, res));
  const remaining = [];

  for (const profile of queued) {
    console.log("\n" + "─".repeat(65));
    console.log(`Source:     r/${profile.source?.subreddit} | ${profile.source?.post_date}`);
    console.log(`Demo:       ${profile.demographics?.gender}, ${profile.demographics?.ethnicity}, ${profile.demographics?.school_type}`);
    console.log(`Scores:     SAT ${profile.test_scores?.sat?.superscore_total ?? "—"} | ACT ${profile.test_scores?.act?.composite ?? "—"} | GPA ${profile.academic_profile?.gpa?.unweighted ?? "—"}`);
    console.log(`Accepted:   ${profile.application_results?.accepted?.map(s => s.school).join(", ") || "none"}`);
    console.log(`Rejected:   ${profile.application_results?.rejected?.slice(0, 5).map(s => s.school).join(", ") || "none"}`);
    console.log(`Difficulty: ${profile.game_metadata?.difficulty_level} | Tier: ${profile.game_metadata?.actual_school_tier}`);

    const ans = await ask("\n[a]pprove  [r]eject  [q]uit: ");

    if (ans === "q") { remaining.push(...queued.slice(queued.indexOf(profile))); break; }
    if (ans === "r") { console.log("  Rejected."); continue; }
    if (ans === "a") {
      profile.id = nextId(approved);
      approved.push(profile);
      console.log(`  ✓ Approved as ${profile.id}`);
    } else {
      remaining.push(profile);
    }
  }

  fs.writeFileSync(PROFILES_FILE, approved.map(p => JSON.stringify(p)).join("\n") + "\n");
  fs.writeFileSync(QUEUE_FILE, remaining.map(p => JSON.stringify(p)).join("\n") + (remaining.length ? "\n" : ""));
  rl.close();
  console.log(`\n✅ ${approved.length} profiles total. ${remaining.length} still in queue.`);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

if (process.argv.includes("--approve")) {
  runApprove().catch(console.error);
} else {
  const urlArgIdx = process.argv.indexOf("--url");
  const url = urlArgIdx !== -1 ? process.argv[urlArgIdx + 1] : null;
  runScrape(url).catch(console.error);
}
