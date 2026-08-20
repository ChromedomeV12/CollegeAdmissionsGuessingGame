// Verifies the pure scoring engine and shared authoritative evaluator.
// Loads the classic browser scripts in VM sandboxes with and without window.
// No DOM is required.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptNames = ["tiers.js", "scoring.js", "game-score.js"];
const scriptSources = scriptNames.map((name) => fs.readFileSync(path.join(__dirname, "..", "public", name), "utf8"));

const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const source of scriptSources) vm.runInContext(source, sandbox);

const SCORING = sandbox.SCORING;
const GAME_SCORE = sandbox.GAME_SCORE;
const TIERS = sandbox.TIERS;

test("SCORING is exposed on the sandbox window", () => {
  assert.equal(typeof SCORING, "object");
  assert.equal(typeof SCORING.jaccard, "function");
  assert.equal(typeof SCORING.tierPoints, "function");
  assert.equal(typeof SCORING.caseScore, "function");
});

test("jaccard returns 0 when both sides are empty (empty union)", () => {
  assert.equal(SCORING.jaccard([], []), 0);
  assert.equal(SCORING.jaccard([], null), 0);
});

test("jaccard is 0 for a total miss (disjoint sets)", () => {
  assert.equal(SCORING.jaccard(["a", "b"], ["c", "d"]), 0);
});

test("jaccard is 1 for a perfect match (identical sets)", () => {
  assert.equal(SCORING.jaccard(["a", "b"], ["a", "b"]), 1);
  assert.equal(SCORING.jaccard(["a", "b"], ["b", "a"]), 1);
});

test("jaccard handles a partial overlap and ignores overshoot/duplicates", () => {
  // {a} ∩ {a,b} = 1, union = 2 -> 0.5
  assert.equal(SCORING.jaccard(["a"], ["a", "b"]), 0.5);
  // Duplicates collapse via Set; {a,a} ∩ {a} = 1, union = 1 -> 1
  assert.equal(SCORING.jaccard(["a", "a"], ["a"]), 1);
  // Overshoot: extra picks the user made that weren't admitted lower the score.
  assert.ok(SCORING.jaccard(["a", "b", "c"], ["a"]) < SCORING.jaccard(["a"], ["a"]));
});

test("tierPoints returns 15/9/5/0 by absolute index distance", () => {
  assert.equal(SCORING.tierPoints(0, 0), 15);
  assert.equal(SCORING.tierPoints(1, 1), 15);
  assert.equal(SCORING.tierPoints(0, 1), 9);
  assert.equal(SCORING.tierPoints(1, 0), 9);
  assert.equal(SCORING.tierPoints(0, 2), 5);
  assert.equal(SCORING.tierPoints(2, 0), 5);
  assert.equal(SCORING.tierPoints(0, 3), 0);
  assert.equal(SCORING.tierPoints(5, 0), 0);
  assert.equal(SCORING.tierPoints(3, 7), 0);
  assert.equal(SCORING.tierPoints(0, -1), 0);
});

test("caseScore perfect case = 100 (correct uni, correct no-Lac claim, perfect selection)", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 1,
    uniActualIdx: 1,        // diff 0 -> 15
    lacPickIdx: 0,          // irrelevant: noLacClaim true
    noLacClaim: true,
    hasLacAdmit: false,     // correct -> 15
    lacActualIdx: 0,        // irrelevant
    selectedKeys: ["a", "b"],
    admittedInViewKeys: ["a", "b"]   // jaccard 1 -> 70
  });
  assert.equal(r.uniPts, 15);
  assert.equal(r.lacPts, 15);
  assert.equal(r.selectionPts, 70);
  assert.equal(r.score, 100);
  assert.equal(r.accuracy, 100);
});

test("caseScore all-miss = 0 (wrong uni far away, missed LAC tier, empty selection)", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 0,
    uniActualIdx: 5,        // diff 5 -> 0
    lacPickIdx: 0,
    noLacClaim: false,
    lacActualIdx: 3,        // diff 3 -> 0
    hasLacAdmit: true,
    selectedKeys: [],
    admittedInViewKeys: []  // jaccard 0 -> 0
  });
  assert.equal(r.uniPts, 0);
  assert.equal(r.lacPts, 0);
  assert.equal(r.selectionPts, 0);
  assert.equal(r.score, 0);
  assert.equal(r.accuracy, 0);
});

test("caseScore noLacClaim correct (no LAC admitted) yields 15 lac points", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 0,
    uniActualIdx: 3,        // 0 uni pts
    noLacClaim: true,
    hasLacAdmit: false,     // correct claim
    selectedKeys: [],
    admittedInViewKeys: []
  });
  assert.equal(r.lacPts, 15);
});

test("caseScore noLacClaim wrong (an LAC was admitted) yields 0 lac points", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 0,
    uniActualIdx: 3,        // 0 uni pts
    noLacClaim: true,
    hasLacAdmit: true,      // wrong claim
    selectedKeys: [],
    admittedInViewKeys: []
  });
  assert.equal(r.lacPts, 0);
});

test("caseScore noUniClaim correct (no top-50 university admit) yields 15 university points", () => {
  const r = SCORING.caseScore({
    noUniClaim: true,
    hasUniAdmit: false,
    noLacClaim: true,
    hasLacAdmit: false,
    selectedKeys: [],
    admittedInViewKeys: []
  });
  assert.equal(r.uniPts, 15);
});

test("caseScore noUniClaim wrong (a top-50 university admit exists) yields 0 university points", () => {
  const r = SCORING.caseScore({
    noUniClaim: true,
    hasUniAdmit: true,
    noLacClaim: true,
    hasLacAdmit: false,
    selectedKeys: [],
    admittedInViewKeys: []
  });
  assert.equal(r.uniPts, 0);
});

test("caseScore keeps adjacent-tier and in-band school-selection partial credit", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 1,
    uniActualIdx: 0,
    noUniClaim: false,
    lacPickIdx: 0,
    lacActualIdx: 0,
    noLacClaim: false,
    hasLacAdmit: true,
    selectedKeys: ["adjacent-admit"],
    admittedInViewKeys: ["adjacent-admit"]
  });
  assert.equal(r.uniPts, 9);
  assert.ok(r.selectionPts > 0);
  assert.ok(r.score < 100);
});

test("caseScore gives 5 university tier points at distance two", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 2,
    uniActualIdx: 0,
    noUniClaim: false,
    lacPickIdx: 0,
    lacActualIdx: 0,
    noLacClaim: false,
    hasLacAdmit: true,
    selectedKeys: [],
    admittedInViewKeys: []
  });
  assert.equal(r.uniPts, 5);
});

test("caseScore mid case sums correctly across all three components", () => {
  const r = SCORING.caseScore({
    uniPickIdx: 2,
    uniActualIdx: 3,        // diff 1 -> 9
    lacPickIdx: 0,
    noLacClaim: false,
    lacActualIdx: 1,        // diff 1 -> 9
    hasLacAdmit: true,
    selectedKeys: ["a", "b", "c"],
    admittedInViewKeys: ["a", "c", "d"]   // ∩ {a,c}=2, ∪ {a,b,c,d}=4 -> 0.5
  });
  assert.equal(r.uniPts, 9);
  assert.equal(r.lacPts, 9);
  assert.equal(r.selectionPts, 35);   // round(70 * 0.5)
  assert.equal(r.score, 9 + 9 + 35);  // 53
  assert.equal(r.accuracy, 50);       // round(0.5 * 100)
});

test("caseScore score is always within 0..100 across varied inputs", () => {
  const inputs = [
    { uniPickIdx: 0, uniActualIdx: 0, lacPickIdx: 0, noLacClaim: true, hasLacAdmit: false, lacActualIdx: 0, selectedKeys: ["x"], admittedInViewKeys: ["x"] },
    { uniPickIdx: 0, uniActualIdx: 5, lacPickIdx: 2, noLacClaim: false, hasLacAdmit: true, lacActualIdx: 0, selectedKeys: [], admittedInViewKeys: ["x"] },
    { uniPickIdx: 1, uniActualIdx: 2, lacPickIdx: 0, noLacClaim: false, hasLacAdmit: true, lacActualIdx: 0, selectedKeys: ["a", "b"], admittedInViewKeys: ["b"] },
    { uniPickIdx: 3, uniActualIdx: 3, lacPickIdx: 1, noLacClaim: true, hasLacAdmit: true, lacActualIdx: 2, selectedKeys: ["a", "b", "c"], admittedInViewKeys: ["a", "b", "c"] },
    { uniPickIdx: 5, uniActualIdx: 0, lacPickIdx: 2, noLacClaim: true, hasLacAdmit: false, lacActualIdx: 0, selectedKeys: ["q"], admittedInViewKeys: ["q", "r", "s"] }
  ];
  for (const input of inputs) {
    const r = SCORING.caseScore(input);
    assert.ok(
      Number.isInteger(r.score) && r.score >= 0 && r.score <= 100,
      `score out of range: ${r.score} for ${JSON.stringify(input)}`
    );
    assert.ok(
      Number.isInteger(r.accuracy) && r.accuracy >= 0 && r.accuracy <= 100,
      `accuracy out of range: ${r.accuracy}`
    );
    // Components are non-negative and sum to the score.
    assert.ok(r.uniPts >= 0 && r.lacPts >= 0 && r.selectionPts >= 0, "negative component");
    assert.equal(r.score, r.uniPts + r.lacPts + r.selectionPts);
  }
});

test("timeFactor is exposed as a function on SCORING", () => {
  assert.equal(typeof SCORING.timeFactor, "function");
  assert.equal(typeof SCORING.applyTimeFactor, "function");
});

test("timeFactor returns 1.0 at seconds <= grace (30)", () => {
  assert.equal(SCORING.timeFactor(0), 1.0);
  assert.equal(SCORING.timeFactor(30), 1.0);
  assert.equal(SCORING.timeFactor(10), 1.0);
  assert.equal(SCORING.timeFactor(30, {}), 1.0);
});

test("timeFactor returns 0.7 at seconds >= cap (120)", () => {
  assert.equal(SCORING.timeFactor(120), 0.7);
  assert.equal(SCORING.timeFactor(1000), 0.7);
});

test("timeFactor is monotonic non-increasing and interpolates between grace and cap", () => {
  const vals = [0, 30, 45, 60, 75, 90, 105, 120, 200].map((s) => SCORING.timeFactor(s));
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] <= vals[i - 1] + 1e-12, `not monotonic at i=${i}: ${vals[i]} > ${vals[i - 1]}`);
  }
  // 30 -> 1.0, 120 -> 0.7, midpoint 75 -> ~0.85.
  assert.equal(SCORING.timeFactor(30), 1.0);
  assert.equal(SCORING.timeFactor(120), 0.7);
  assert.ok(Math.abs(SCORING.timeFactor(75) - 0.85) < 1e-9, `75s factor ~0.85, got ${SCORING.timeFactor(75)}`);
});

test("timeFactor floor clamp: never below floor", () => {
  assert.equal(SCORING.timeFactor(120), 0.7);
  assert.equal(SCORING.timeFactor(1e9), 0.7);
  // Custom floor should be respected at and past cap.
  assert.equal(SCORING.timeFactor(200, { grace: 10, cap: 60, floor: 0.5 }), 0.5);
});

test("applyTimeFactor: score 100 at 10s -> 100 (within grace)", () => {
  assert.equal(SCORING.applyTimeFactor(100, 10), 100);
});

test("applyTimeFactor: score 100 at 120s -> 70 (floor)", () => {
  assert.equal(SCORING.applyTimeFactor(100, 120), 70);
});

test("applyTimeFactor: score 50 at 75s -> round(50 * 0.85) = 43", () => {
  // 50 * 0.85 = 42.5 -> round to 43.
  assert.equal(SCORING.applyTimeFactor(50, 75), Math.round(50 * SCORING.timeFactor(75)));
  assert.equal(SCORING.applyTimeFactor(50, 75), 43);
});

test("applyTimeFactor result is always an integer in 0..100", () => {
  for (const score of [0, 1, 50, 73, 99, 100]) {
    for (const secs of [0, 10, 30, 45, 60, 75, 90, 105, 120, 1000]) {
      const r = SCORING.applyTimeFactor(score, secs);
      assert.ok(
        Number.isInteger(r) && r >= 0 && r <= 100,
 `applyTimeFactor out of range: ${r} (score=${score}, secs=${secs})`
      );
    }
  }
});

test("classic scripts expose globals without window", () => {
  const nodeSandbox = {};
  vm.createContext(nodeSandbox);
  for (const source of scriptSources) vm.runInContext(source, nodeSandbox);
  assert.equal(typeof nodeSandbox.TIERS, "object");
  assert.equal(typeof nodeSandbox.SCORING, "object");
  assert.equal(typeof nodeSandbox.GAME_SCORE.evaluate, "function");
});

function profileWithAdmits(...schools) {
  return {
    id: "fixture",
    application_results: {
      accepted: schools.map((school) => ({ school })),
      rejected: [],
      waitlisted: [],
    },
  };
}
test("admitted schools include and deduplicate the final decision school", () => {
  const profile = {
    ...profileWithAdmits("Harvard"),
    application_results: {
      ...profileWithAdmits("Harvard").application_results,
      final_decision: { school: "Harvard" },
    },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(TIERS.getAdmittedSchools(profile))), ["Harvard"]);

  const withEnrollment = {
    ...profile,
    application_results: {
      ...profile.application_results,
      final_decision: { school: "Yale" },
    },
  };
  assert.deepEqual(JSON.parse(JSON.stringify(TIERS.getAdmittedSchools(withEnrollment))), ["Harvard", "Yale"]);
});

function prediction(overrides = {}) {
  return {
    universityTierPick: "HYPSM",
    lacTierPick: "T5 LAC",
    noUniClaim: false,
    noLacClaim: false,
    schoolSelections: [],
    ...overrides,
  };
}

test("normal tier picks earn zero when no university or LAC admit exists", () => {
  const result = GAME_SCORE.evaluate(
    profileWithAdmits("Purdue"),
    prediction(),
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:00:30.000Z",
  );
  assert.equal(result.uniPts, 0);
  assert.equal(result.lacPts, 0);
  assert.equal(result.rawScore, 0);
});

test("shared evaluator rejects selections outside the chosen visible bands", () => {
  assert.throws(
    () => GAME_SCORE.evaluate(
      profileWithAdmits("Harvard"),
      prediction({ schoolSelections: ["duke"] }),
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:01.000Z",
    ),
    /not visible/,
  );
});

test("shared evaluator validates exact choice combinations and duplicate keys", () => {
  const profile = profileWithAdmits("Harvard");
  const start = "2026-01-01T00:00:00.000Z";
  const end = "2026-01-01T00:00:01.000Z";
  assert.throws(() => GAME_SCORE.evaluate(profile, prediction({ noUniClaim: true }), start, end), /university/);
  assert.throws(() => GAME_SCORE.evaluate(profile, prediction({ universityTierPick: "T100" }), start, end), /university/);
  assert.throws(() => GAME_SCORE.evaluate(profile, prediction({ schoolSelections: ["harvard", "harvard"] }), start, end), /Duplicate/);
});

test("shared evaluator uses exact 30/120 second time boundaries", () => {
  const profile = profileWithAdmits("Harvard", "Williams");
  const pick = prediction({ schoolSelections: ["harvard", "williams"] });
  const start = "2026-01-01T00:00:00.000Z";
  const at30 = GAME_SCORE.evaluate(profile, pick, start, "2026-01-01T00:00:30.000Z");
  const at31 = GAME_SCORE.evaluate(profile, pick, start, "2026-01-01T00:00:31.000Z");
  const at120 = GAME_SCORE.evaluate(profile, pick, start, "2026-01-01T00:02:00.000Z");
  assert.equal(at30.score, 100);
  assert.ok(at31.timeFactor < at30.timeFactor);
  assert.equal(at120.score, 70);
  assert.deepEqual(Object.keys(at30).sort(), ["accuracy", "lacPts", "rawScore", "score", "selectionPts", "timeFactor", "timeSeconds", "uniPts"].sort());
});
