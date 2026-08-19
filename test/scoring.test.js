// test/scoring.test.js — verifies the pure scoring engine in public/scoring.js.
// Loads the plain browser script in a vm sandbox (window.SCORING assignment)
// without a DOM, mirroring how the script runs in the browser.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scoringSrc = fs.readFileSync(
  path.join(__dirname, "..", "public", "scoring.js"),
  "utf8"
);

// Replicate the repo's vm-sandbox pattern: the script assigns onto window, so
// we hand it a sandbox whose `window` is itself (the script does window.SCORING = …).
const sandbox = {};
sandbox.window = sandbox;

vm.createContext(sandbox);
vm.runInNewContext(scoringSrc, sandbox);

const SCORING = sandbox.window.SCORING;

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
