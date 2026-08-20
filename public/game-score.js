// Shared authoritative evaluator for browser and server.
// Depends only on global TIERS and SCORING globals.
(function (root) {
  "use strict";

  const BAD = (message) => {
    const error = new Error(message);
    error.code = "INVALID_GAME_INPUT";
    return error;
  };

  function ownObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function actualIndex(admitted, tierList, kind) {
    for (let i = 0; i < tierList.length; i += 1) {
      const schools = root.TIERS.getSchoolsInTier(tierList[i], kind) || [];
      if (schools.some((school) => admitted.has(school.key))) return i;
    }
    return -1;
  }

  function visibleSchools(tier, kind, noClaim) {
    if (noClaim) return [];
    return root.TIERS.getSchoolsInTier(tier, kind) || [];
  }

  function evaluate(profile, prediction, startedAt, finishedAt) {
    if (!ownObject(profile) || typeof profile.id !== "string" || !ownObject(prediction)) {
      throw BAD("Invalid profile or prediction");
    }
    const uniList = root.TIERS.UNI_TIER_LIST;
    const lacList = root.TIERS.LAC_TIER_LIST;
    const uniPick = prediction.universityTierPick;
    const lacPick = prediction.lacTierPick;
    const noUni = prediction.noUniClaim === true;
    const noLac = prediction.noLacClaim === true;
    const validTier = (value, list) => typeof value === "string" && list.includes(value);
    if (noUni ? uniPick != null : !validTier(uniPick, uniList)) throw BAD("Invalid university prediction");
    if (noLac ? lacPick != null : !validTier(lacPick, lacList)) throw BAD("Invalid LAC prediction");
    if (typeof prediction.noUniClaim !== "boolean" || typeof prediction.noLacClaim !== "boolean") {
      throw BAD("Prediction claims must be booleans");
    }
    if (!Array.isArray(prediction.schoolSelections) || prediction.schoolSelections.some((key) => typeof key !== "string")) {
      throw BAD("Invalid school selections");
    }
    const selections = prediction.schoolSelections;
    const selected = new Set(selections);
    if (selected.size !== selections.length) throw BAD("Duplicate school selection");

    const uniVisible = visibleSchools(uniPick, "uni", noUni);
    const lacVisible = visibleSchools(lacPick, "lac", noLac);
    const visible = [...uniVisible, ...lacVisible];
    const visibleKeys = new Set(visible.map((school) => school.key));
    for (const key of selected) if (!visibleKeys.has(key)) throw BAD("School selection is not visible");

    const admitted = new Set((root.TIERS.getAdmittedSchools(profile) || []).map(root.TIERS.normSchool));
    const admittedInViewKeys = visible.filter((school) => admitted.has(school.key)).map((school) => school.key);
    const uniActualIdx = actualIndex(admitted, uniList, "uni");
    const lacActualIdx = actualIndex(admitted, lacList, "lac");
    const hasUniAdmit = uniActualIdx >= 0;
    const hasLacAdmit = lacActualIdx >= 0;
    const startMs = Date.parse(startedAt);
    const finishMs = Date.parse(finishedAt);
    if (!Number.isFinite(startMs) || !Number.isFinite(finishMs) || finishMs < startMs) throw BAD("Invalid timestamps");
    const timeSeconds = Math.max(0, Math.floor((finishMs - startMs) / 1000));
    const scored = root.SCORING.caseScore({
      uniPickIdx: noUni ? -1 : uniList.indexOf(uniPick),
      lacPickIdx: noLac ? -1 : lacList.indexOf(lacPick),
      noUniClaim: noUni,
      hasUniAdmit,
      noLacClaim: noLac,
      hasLacAdmit,
      uniActualIdx,
      lacActualIdx,
      selectedKeys: selected,
      admittedInViewKeys,
    });
    const timeFactor = root.SCORING.timeFactor(timeSeconds);
    const score = root.SCORING.applyTimeFactor(scored.score, timeSeconds);
    return {
      score,
      rawScore: scored.score,
      accuracy: scored.accuracy,
      uniPts: scored.uniPts,
      lacPts: scored.lacPts,
      selectionPts: scored.selectionPts,
      timeSeconds,
      timeFactor,
    };
  }

  root.GAME_SCORE = { evaluate };
})(typeof window !== "undefined" ? window : globalThis);
