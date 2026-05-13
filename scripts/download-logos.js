/**
 * download-logos.js — uses Google's favicon service (always works, free)
 * Run: node scripts/download-logos.js
 */

import fs from "fs";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../public/logos");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SCHOOLS = {
  "harvard":           "harvard.edu",
  "mit":               "mit.edu",
  "stanford":          "stanford.edu",
  "yale":              "yale.edu",
  "princeton":         "princeton.edu",
  "columbia":          "columbia.edu",
  "upenn":             "upenn.edu",
  "brown":             "brown.edu",
  "dartmouth":         "dartmouth.edu",
  "cornell":           "cornell.edu",
  "duke":              "duke.edu",
  "northwestern":      "northwestern.edu",
  "uchicago":          "uchicago.edu",
  "jhu":               "jhu.edu",
  "rice":              "rice.edu",
  "vanderbilt":        "vanderbilt.edu",
  "notre-dame":        "nd.edu",
  "emory":             "emory.edu",
  "georgetown":        "georgetown.edu",
  "usc":               "usc.edu",
  "cmu":               "cmu.edu",
  "caltech":           "caltech.edu",
  "washu":             "wustl.edu",
  "tufts":             "tufts.edu",
  "nyu":               "nyu.edu",
  "ucla":              "ucla.edu",
  "uc-berkeley":       "berkeley.edu",
  "ucsd":              "ucsd.edu",
  "ucsb":              "ucsb.edu",
  "ucsc":              "ucsc.edu",
  "uci":               "uci.edu",
  "uc-davis":          "ucdavis.edu",
  "uc-riverside":      "ucr.edu",
  "umich":             "umich.edu",
  "unc":               "unc.edu",
  "georgia-tech":      "gatech.edu",
  "uw-seattle":        "uw.edu",
  "uva":               "virginia.edu",
  "uiuc":              "illinois.edu",
  "purdue":            "purdue.edu",
  "penn-state":        "psu.edu",
  "ohio-state":        "osu.edu",
  "uf":                "ufl.edu",
  "fsu":               "fsu.edu",
  "uw-madison":        "wisc.edu",
  "minnesota":         "umn.edu",
  "ut-austin":         "utexas.edu",
  "umiami":            "miami.edu",
  "indiana":           "indiana.edu",
  "cu-boulder":        "colorado.edu",
  "boston-university": "bu.edu",
  "northeastern":      "northeastern.edu",
  "tulane":            "tulane.edu",
  "smu":               "smu.edu",
  "tcu":               "tcu.edu",
  "rpi":               "rpi.edu",
  "alabama":           "ua.edu",
  "ole-miss":          "olemiss.edu",
  "georgia":           "uga.edu",
  "tennessee":         "utk.edu",
  "fordham":           "fordham.edu",
  "rutgers":           "rutgers.edu",
  "syracuse":          "syr.edu",
  "pitt":              "pitt.edu",
  "case-western":      "case.edu",
  "rit":               "rit.edu",
  "wake-forest":       "wfu.edu",
  "villanova":         "villanova.edu",
  "loyola-chicago":    "luc.edu",
  "u-denver":          "du.edu",
  "uvm":               "uvm.edu",
  "ubc":               "ubc.ca",
  "toronto":           "utoronto.ca",
  "waterloo":          "uwaterloo.ca",
  "queens":            "queensu.ca",
  "alberta":           "ualberta.ca",
  "amherst":           "amherst.edu",
  "williams":          "williams.edu",
  "swarthmore":        "swarthmore.edu",
  "pomona":            "pomona.edu",
  "wellesley":         "wellesley.edu",
  "bowdoin":           "bowdoin.edu",
  "carleton":          "carleton.edu",
  "middlebury":        "middlebury.edu",
  "wesleyan":          "wesleyan.edu",
  "colby":             "colby.edu",
  "hamilton":          "hamilton.edu",
  "vassar":            "vassar.edu",
  "oberlin":           "oberlin.edu",
  "grinnell":          "grinnell.edu",
  "davidson":          "davidson.edu",
  "claremont-mckenna": "cmc.edu",
  "harvey-mudd":       "hmc.edu",
  "reed":              "reed.edu",
  "skidmore":          "skidmore.edu",
  "kenyon":            "kenyon.edu",
  "denison":           "denison.edu",
  "holy-cross":        "holycross.edu",
  "wooster":           "wooster.edu",
  "mount-holyoke":     "mtholyoke.edu",
  "st-olaf":           "stolaf.edu",
  "washington-lee":    "wlu.edu",
  "bates":             "bates.edu",
  "colgate":           "colgate.edu",
  "cal-poly":          "calpoly.edu",
};

function download(url, dest) {
  return new Promise((resolve) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        download(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        resolve(false);
        return;
      }
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(true); });
    }).on("error", () => {
      file.close();
      try { fs.unlinkSync(dest); } catch {}
      resolve(false);
    });
  });
}

async function run() {
  const entries = Object.entries(SCHOOLS);
  let ok = 0, fail = 0;

  console.log(`\nDownloading ${entries.length} logos to public/logos/\n`);
  console.log("Using Google favicon service (sz=128 for best quality)\n");

  for (const [name, domain] of entries) {
    const dest = path.join(OUT_DIR, `${name}.png`);

    if (fs.existsSync(dest) && fs.statSync(dest).size > 200) {
      process.stdout.write(`  ✓ ${name} (cached)\n`);
      ok++;
      continue;
    }

    // Google's favicon API — always returns something, even if just a letter
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    process.stdout.write(`  ${name} (${domain})... `);

    const success = await download(url, dest);
    const size = success && fs.existsSync(dest) ? fs.statSync(dest).size : 0;

    if (success && size > 200) {
      console.log(`✓`);
      ok++;
    } else {
      console.log(`✗`);
      fail++;
    }

    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n✅ Done! ${ok} logos saved, ${fail} failed.`);
  console.log(`📁 Logos folder: public/logos/`);
}

run().catch(console.error);
