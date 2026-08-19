// Scoring engine for the Reddit Uni Admission Game.
// Plain (non-module) browser script: attaches a pure API to window.SCORING.
// No DOM access, no window.TIERS dependency — callers pass indices and sets.

window.SCORING = (function () {
  "use strict";

  // Jaccard similarity over two iterables of keys. Returns 0 when the union
  // is empty (i.e. both sides have no keys).
  function jaccard(keysA, keysB) {
    const a = new Set(keysA);
    const b = new Set(keysB);
    let intersection = 0;
    for (const k of a) {
      if (b.has(k)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    if (union === 0) return 0;
    return intersection / union;
  }

  // University/LAC tier points by absolute index difference.
  // diff 0 -> 15, diff 1 -> 9, diff 2 -> 5, else 0.
  function tierPoints(pickIndex, actualIndex) {
    const diff = Math.abs(pickIndex - actualIndex);
    if (diff === 0) return 15;
    if (diff === 1) return 9;
    if (diff === 2) return 5;
    return 0;
  }

  // Compute a single per-case score (0..100) from three non-negative
  // components: university tier, LAC tier (with no-Lac-claim handling), and
  // selection Jaccard.
  //
  // Input shape:
  //   { uniPickIdx, lacPickIdx, noLacClaim, hasLacAdmit,
  //     uniActualIdx, lacActualIdx, selectedKeys, admittedInViewKeys }
  function caseScore(input) {
    const uniPts = tierPoints(input.uniPickIdx, input.uniActualIdx);

    let lacPts;
    if (input.noLacClaim) {
      // Claiming "no LAC admit": correct (no LAC admitted in view) -> 15,
      // wrong (an LAC was admitted) -> 0.
      lacPts = input.hasLacAdmit ? 0 : 15;
    } else {
      lacPts = tierPoints(input.lacPickIdx, input.lacActualIdx);
    }

    const j = jaccard(input.selectedKeys, input.admittedInViewKeys);
    const selectionPts = Math.round(70 * j);

    const score = uniPts + lacPts + selectionPts;
    const accuracy = Math.round(j * 100);

    return {
      score: score,
      uniPts: uniPts,
      lacPts: lacPts,
      selectionPts: selectionPts,
      accuracy: accuracy
    };
  }

  return {
    jaccard: jaccard,
    tierPoints: tierPoints,
    caseScore: caseScore
  };
})();
