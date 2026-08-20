// Core bilingual runtime contract tests. Runs the classic global without a browser or React.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, "..", "public", "i18n.js"), "utf8");
const tiersSource = fs.readFileSync(path.join(__dirname, "..", "public", "tiers.js"), "utf8");

function loadScript(script, extra = {}) {
  const browserGlobal = extra.window === true;
  const sandbox = { ...extra };
  if (browserGlobal) sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  return { I18N: sandbox.I18N, sandbox };
}

function loadGlobal(extra = {}) {
  return loadScript(source, extra);
}

function fakeReact() {
  let hookIndex = 0;
  const states = [];
  return {
    beginRender() {
      hookIndex = 0;
    },
    createContext(defaultValue) {
      const context = { value: defaultValue };
      context.Provider = { context };
      return context;
    },
    createElement(type, props, children) {
      if (type && type.context) type.context.value = props.value;
      return { type, props, children };
    },
    useState(initial) {
      const index = hookIndex++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      }];
    },
    useCallback(fn) {
      hookIndex++;
      return fn;
    },
    useEffect(effect) {
      hookIndex++;
      effect();
    },
    useMemo(factory) {
      hookIndex++;
      return factory();
    },
    useContext(context) {
      return context.value;
    }
  };
}

test("resources have identical flat key sets and required top-level namespaces", () => {
  const { I18N } = loadGlobal();
  assert.deepEqual(Object.keys(I18N.resources.en).sort(), Object.keys(I18N.resources["zh-CN"]).sort());

  const requiredPrefixes = [
    "auth.", "nav.", "home.", "menu.", "common.", "profile.", "tier.",
    "schools.", "reveal.", "leaderboard.", "errors.", "ranks.", "ranges."
  ];
  for (const prefix of requiredPrefixes) {
    assert.ok(Object.keys(I18N.resources.en).some((key) => key.startsWith(prefix)), `missing ${prefix}`);
  }
});
test("Task 3 shell resources cover visible auth, menu, navigation, leaderboard, rivalry, and rank copy", () => {
  const { I18N } = loadGlobal();
  const requiredKeys = [
    "auth.eyebrow", "auth.headline", "auth.description", "auth.modeLabel", "auth.usernamePlaceholder",
    "auth.passwordPlaceholder", "auth.passwordMinPlaceholder", "auth.confirmPlaceholder", "auth.submitLoading",
    "nav.home", "nav.menu", "nav.leaderboard", "nav.logout", "nav.back", "nav.toggleTheme",
    "nav.homeAria", "nav.menuAria", "nav.caseMeta", "nav.phaseMeta",
    "home.kicker", "home.copy", "home.play", "home.rulesLabel", "home.score", "home.retry", "home.pace",
    "menu.eyebrow", "menu.title", "menu.description", "menu.libraryLabel", "menu.selectApplicant",
    "menu.progressLabel", "menu.seedCases", "menu.completed", "menu.unread", "menu.practice", "menu.unplayed",
    "menu.applicant", "menu.selectAria", "menu.playedStatus", "menu.unplayedStatus", "menu.practiceStatus", "menu.points",
    "leaderboard.standings", "leaderboard.qualify", "leaderboard.rank", "leaderboard.player", "leaderboard.avg",
    "leaderboard.cases", "leaderboard.best", "leaderboard.noScores",
    "leaderboard.rivalSubtitle", "leaderboard.rivalPlaceholder", "leaderboard.rivalAria",
    "leaderboard.duelWith", "leaderboard.closeDuel", "leaderboard.sharedEmpty", "leaderboard.case",
    "leaderboard.youShort", "leaderboard.noPlayer", "leaderboard.addFailed",
  ];
  for (const key of requiredKeys) {
    assert.notEqual(I18N.resources.en[key], undefined, `missing English key ${key}`);
    assert.notEqual(I18N.resources["zh-CN"][key], undefined, `missing Chinese key ${key}`);
    assert.notEqual(I18N.resources.en[key], I18N.resources["zh-CN"][key], `untranslated ${key}`);
  }
  for (const id of ["observer", "reader", "junior", "senior", "dean", "oracle"]) {
    assert.equal(typeof I18N.resources.en[`ranks.${id}`], "string");
    assert.equal(typeof I18N.resources["zh-CN"][`ranks.${id}`], "string");
  }
});
test("localizeError maps known server messages and hides unknown details", () => {
  const diagnostics = [];
  const zh = loadGlobal({
    window: true,
    console: { error: (...args) => diagnostics.push(args.join(" ")) },
    localStorage: { getItem: () => "zh-CN", setItem: () => {} }
  }).I18N.useI18n();
  assert.equal(zh.localizeError(new Error("User already exists")), "该用户名已被占用。");
  assert.equal(zh.localizeError("Invalid username or password."), "用户名或密码无效。");
  assert.equal(zh.localizeError(new Error("server internals")), "发生了一些问题，请重试。");
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0], /server internals/);
});

test("Chinese resources do not accidentally leave English copy untranslated", () => {
  const { I18N } = loadGlobal();
  const preservedTokens = new Set(["Admissions Oracle", "GPA"]);
  for (const key of Object.keys(I18N.resources.en)) {
    if (I18N.resources.en[key] === I18N.resources["zh-CN"][key]) {
      assert.ok(preservedTokens.has(I18N.resources.en[key]), `unexpected untranslated value at ${key}`);
    }
  }
});
test("localizeError covers known app and attempt API failures", () => {
  const zh = I18NForLocale("zh-CN");
  const cases = [
    ["Profile locked — practice only", "该档案已锁定——仅供练习。"],
    ["Attempt already in progress", "已有进行中的尝试。"],
    ["Invalid profile", "申请档案无效。"],
    ["Attempt not found", "找不到该次尝试。"],
    ["Could not score attempt", "无法为本次尝试计分。"],
    ["Retry is unavailable", "重试不可用。"],
    ["Retry window expired", "重试窗口已过期。"],
    ["Retry window is still open", "重试窗口仍在开放。"],
    ["Attempt is no longer ready to finalize", "此尝试还不能完成。"],
    ["Attempt has no score", "此尝试没有分数。"],
    ["Profile not found", "找不到该申请档案。"],
    ["Profile is not finalized", "该申请档案尚未完成。"],
    ["Attempt is no longer accepting a reveal", "无法保存本次揭晓。你的答案仍未公开，请重试。"],
    ["Could not reserve retry", "无法保留重试机会。你的第一次结果仍在等待处理。"],
    ["Could not finalize attempt", "无法完成此案件。你的答案仍未公开，请重试。"],
    ["Could not abandon attempt", "无法安全离开此案件，请重试。"],
    ["Could not load profiles", "无法加载档案，请确认服务器正在运行。"],
    ["User not found", "找不到该玩家。"],
    ["username must be a non-empty string", "请输入有效的对手用户名。"],
    ["Could not start attempt", "无法开始计分，请重试。"]
  ];
  for (const [message, expected] of cases) assert.equal(zh.localizeError(message), expected, message);
});
test("Chinese duel copy is idiomatic", () => {
  assert.equal(I18NForLocale("zh-CN").t("leaderboard.duelWith", { username: "张三" }), "你与 张三 对决");
});

test("interpolate substitutes named values and preserves missing placeholders", () => {
  const { I18N } = loadGlobal();
  assert.equal(I18N.interpolate("Retry in {seconds}s", { seconds: 5 }), "Retry in 5s");
  assert.equal(I18N.interpolate("Hello {name}"), "Hello {name}");
});

test("enum translation covers every supported structured value and preserves unknowns", () => {
  const { I18N } = loadGlobal();
  const cases = [
    ["gender", "Male", "男性"],
    ["gender", "Female", "女性"],
    ["gender", "Unknown", "未知"],
    ["boolean", "yes", "是"],
    ["boolean", "no", "否"],
    ["income", "Low Income", "低收入"],
    ["income", "Middle Income", "中等收入"],
    ["income", "High Income", "高收入"],
    ["income", "Unknown", "未知"],
    ["schoolType", "Public", "公立"],
    ["schoolType", "Private Day", "私立走读"],
    ["schoolType", "Private Boarding School", "私立寄宿"],
    ["schoolType", "Unknown", "未知"],
    ["schoolFeed", "Feeder School", "输送型学校"],
    ["schoolFeed", "Non-feeder", "非输送型学校"],
    ["schoolFeed", "Unknown", "未知"],
    ["difficulty", "Easy", "简单"],
    ["difficulty", "Medium", "中等"],
    ["difficulty", "Hard", "困难"]
  ];
  for (const [group, value, expected] of cases) {
    assert.equal(I18N.translateEnumValue("zh-CN", group, value), expected);
  }
  assert.equal(I18N.translateEnumValue("zh-CN", "gender", "Nonbinary custom value"), "Nonbinary custom value");
  assert.equal(I18N.translateEnumValue("zh-CN", "schoolType", "International school"), "International school");
  assert.equal(I18N.translateEnumValue("zh-CN", "schoolFeed", "Average public"), "Average public");
  assert.equal(I18N.translateEnumValue("zh-CN", "gender", null), null);
  assert.equal(I18N.translateEnumValue("en", "gender", "Female"), "Female");
});

test("Task 4 resources cover profile, tier, school, and accessibility copy", () => {
  const { I18N } = loadGlobal();
  const requiredKeys = [
    "stepper.progress",
    "rank.pointsTitle", "rank.pointsValue", "rank.pointsToNext", "rank.maxReached",
    "profile.applicant", "profile.start", "profile.overview", "profile.extracurriculars",
    "profile.correctFinalized", "profile.bestUniversityBand", "profile.noUniversityAdmit",
    "profile.bestLacBand", "profile.noLacAdmit", "profile.admittedSchools",
    "profile.universities", "profile.liberalArtsColleges", "profile.otherAdmits",
    "profile.admittedStamp", "profile.admittedOn", "profile.ethnicity", "profile.region",
    "profile.classification", "profile.legacy", "profile.firstGeneration",
    "profile.testOptional", "profile.satSuperscore", "profile.actComposite",
    "profile.gpaUnweighted", "profile.rigor", "profile.apCount",
    "profile.postApAndHonors", "profile.apScoreBreakdown", "profile.reportedPending",
    "profile.chartBar", "profile.chartDonut", "profile.courseHistory", "profile.year",
    "profile.course", "profile.level", "profile.scoreValue", "profile.pending",
    "profile.reported", "profile.ecTier", "tier.profileReview", "tier.bandExplanation",
    "tier.panelUniversity", "tier.panelLac", "tier.choiceCount",
    "tier.noUniversityClaim", "tier.noUniversityClaimHint", "tier.noLacClaim",
    "tier.noLacClaimHint", "tier.lacSeparateRanking", "tier.claimPoints",
    "tier.correctClaimScoring", "tier.lockPredictions", "tier.timeBonusState",
    "tier.timeBonusFull", "tier.timeBonusShrinking", "tier.timeBonusFloor",
    "schools.universityTierLabel", "schools.lacTierLabel", "schools.withinTier",
    "schools.scoringSummary", "schools.schoolSelection", "schools.universityTier",
    "schools.lacTier", "schools.upTo", "schools.scoringHint", "schools.changeTiers",
    "schools.revealResults", "schools.claimLocked", "schools.skippedClaim",
    "schools.schoolCount", "schools.emptyBand", "schools.selectCard", "schools.deselectCard"
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof I18N.resources.en[key], "string", `missing English key ${key}`);
    assert.equal(typeof I18N.resources["zh-CN"][key], "string", `missing Chinese key ${key}`);
  }
});

test("Task 5 resources cover aggregate, retry, finalized, practice, and accessible reveal copy", () => {
  const { I18N } = loadGlobal();
  const requiredKeys = [
    "reveal.celebrationGreat", "reveal.celebrationGood", "reveal.celebrationAccuracy", "reveal.celebrationScore",
    "reveal.practiceFeedback", "reveal.practiceFeedbackBody", "reveal.practiceScore", "reveal.caseScore",
    "reveal.feedbackOnly", "reveal.scoreSource", "reveal.afterTimeAdjustment", "reveal.accuracy",
    "reveal.accuracyDescription", "reveal.time", "reveal.elapsedSeconds", "reveal.scoreMultiplier", "reveal.tierResults",
    "reveal.university", "reveal.lac", "reveal.tierPick", "reveal.tierHit", "reveal.tierMiss",
    "reveal.actualTier", "reveal.noUniversityClaim", "reveal.noLacClaim", "reveal.universityTierPoints",
    "reveal.lacTierPoints", "reveal.noUniversityIncorrect", "reveal.noUniversityCorrect",
    "reveal.noLacIncorrect", "reveal.noLacCorrect", "reveal.selectionPoints", "reveal.timeBreakdown",
    "reveal.schoolBySchool", "reveal.universitiesTier", "reveal.lacsTier", "reveal.admittedStamp",
    "reveal.enrolledAt", "reveal.admittedOn", "reveal.overallRanking", "reveal.currentAverage",
    "reveal.thisCaseContributed", "reveal.tryAgain", "reveal.nextProfile", "reveal.allProfilesPlayed",
    "reveal.retryCase", "reveal.otherSchoolsSkipped", "reveal.resultSkipped", "reveal.resultCorrect",
    "reveal.resultWrong", "reveal.resultMissed", "reveal.admit", "reveal.notAdmit", "reveal.resultRowAria"
  ];
  for (const key of requiredKeys) {
    assert.equal(typeof I18N.resources.en[key], "string", `missing English key ${key}`);
    assert.equal(typeof I18N.resources["zh-CN"][key], "string", `missing Chinese key ${key}`);
    assert.notEqual(I18N.resources.en[key], I18N.resources["zh-CN"][key], `untranslated ${key}`);
  }

  const zh = I18NForLocale("zh-CN");
  assert.equal(zh.t("reveal.retryCase", { seconds: 4 }), "重试案件（4 秒）");
  assert.equal(zh.t("reveal.elapsedSeconds", { seconds: 12 }), "12 秒");
  assert.equal(zh.t("reveal.scoreMultiplier", { multiplier: "0.82" }), "分数乘数 ×0.82");
  assert.equal(zh.t("reveal.actualTier", { tier: "T20" }), "实际层级 · T20");
  assert.equal(zh.t("reveal.otherSchoolsSkipped", { count: 3 }), "其余 3 所学校——已正确跳过");
  assert.equal(
    zh.t("reveal.resultRowAria", { school: "Harvard", status: "正确录取", outcome: "已录取" }),
    "Harvard：正确录取。已录取。"
  );
});

test("all stable tier codes have localized range resources without changing identifiers", () => {
  const { I18N } = loadGlobal();
  const { sandbox } = loadScript(tiersSource);
  const tierCodes = [
    ...sandbox.TIERS.UNI_TIER_LIST,
    ...sandbox.TIERS.LAC_TIER_LIST
  ];
  assert.deepEqual(tierCodes, ["HYPSM", "T10", "T15", "T20", "T30", "T50", "T5 LAC", "T10 LAC", "T20 LAC"]);
  for (const code of tierCodes) {
    const key = `ranges.${code}`;
    assert.equal(typeof I18N.resources.en[key], "string", `missing English range ${key}`);
    assert.equal(typeof I18N.resources["zh-CN"][key], "string", `missing Chinese range ${key}`);
    assert.notEqual(I18N.resources.en[key], I18N.resources["zh-CN"][key], `untranslated range ${key}`);
  }
});

test("tier explanation describes the exclusive T10, T15, and T20 bands accurately", () => {
  const { I18N } = loadGlobal();
  assert.match(
    I18N.resources.en["tier.bandExplanation"],
    /T10 means ranks 6–10 only, T15 means 11–15, T20 means 16–20/
  );
  assert.match(
    I18N.resources["zh-CN"]["tier.bandExplanation"],
    /T10 仅指第 6–10 名，T15 仅指第 11–15 名，T20 仅指第 16–20 名/
  );
});

test("date formatting is locale-specific and invalid dates have a stable fallback", () => {
  const date = "2024-01-02T12:00:00.000Z";
  const en = loadGlobal({
    window: true,
    localStorage: { getItem: () => "en", setItem: () => {} }
  }).I18N.useI18n();
  const zhCN = loadGlobal({
    window: true,
    localStorage: { getItem: () => "zh-CN", setItem: () => {} }
  }).I18N.useI18n();
  const options = { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" };
  assert.equal(en.formatDate(date, options), "January 2, 2024");
  assert.equal(zhCN.formatDate(date, options), "2024年1月2日");
  assert.notEqual(en.formatDate(date, options), zhCN.formatDate(date, options));

  const nonUtcOptions = { timeZone: "America/Los_Angeles", year: "numeric", month: "long", day: "numeric" };
  assert.equal(en.formatDate("2024-01-02", nonUtcOptions), "January 2, 2024");
  assert.equal(zhCN.formatDate("2024-01-02", nonUtcOptions), "2024年1月2日");
  for (const invalid of [undefined, null, "", "not-a-date", "2024-02-30"]) {
    assert.equal(en.formatDate(invalid), "—");
    assert.equal(zhCN.formatDate(invalid), "—");
  }
  assert.equal(en.translateEnum("schoolType", "Private Boarding School"), "Private Boarding School");
  assert.equal(I18NForLocale("zh-CN").translateEnum("school_type", "Private Boarding School"), "私立寄宿");
});

function I18NForLocale(locale) {
  return loadGlobal({
    window: true,
    localStorage: { getItem: () => locale, setItem: () => {} }
  }).I18N.useI18n();
}

test("missing keys return their key and missing Chinese entries fall back to English", () => {
  const zhCN = I18NForLocale("zh-CN");
  assert.equal(zhCN.t("not.a.real.key"), "not.a.real.key");

  const withoutChineseLoading = source.replace('    "common.loading": "加载中…",\n', "");
  const fallback = loadScript(withoutChineseLoading, {
    window: true,
    localStorage: { getItem: () => "zh-CN", setItem: () => {} }
  }).I18N.useI18n();
  assert.equal(fallback.t("common.loading"), "Loading…");
});

test("index loads the runtime after data globals and before JSX components", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
  const ranks = html.indexOf('<script src="ranks.js"></script>');
  const runtime = html.indexOf('<script src="i18n.js"></script>');
  const jsx = html.indexOf('<script type="text/babel" src="ui-primitives.jsx"></script>');
  assert.ok(ranks >= 0 && runtime > ranks && jsx > runtime);
});

test("locale normalization accepts only the supported exact values", () => {
  const { I18N } = loadGlobal();
  assert.deepEqual([...I18N.SUPPORTED_LANGS], ["en", "zh-CN"]);
  assert.throws(() => I18N.SUPPORTED_LANGS.push("fr"), (error) => error.name === "TypeError");
  assert.deepEqual([...I18N.SUPPORTED_LANGS], ["en", "zh-CN"]);
  assert.equal(I18N.normalizeLang("zh-CN"), "zh-CN");
  assert.equal(I18N.normalizeLang("zh-TW"), "en");
  assert.equal(I18N.normalizeLang("ZH-cn"), "en");
  assert.equal(I18N.normalizeLang(undefined), "en");
});

test("runtime is safe without React and exposes provider interfaces", () => {
  const { I18N } = loadGlobal();
  assert.equal(typeof I18N.LanguageProvider, "function");
  assert.equal(typeof I18N.useI18n, "function");
  assert.equal(typeof I18N.t, "undefined");
});

test("React provider defaults to English, persists changes, and syncs document lang", () => {
  let stored = null;
  const document = { documentElement: {} };
  const localStorage = {
    getItem: () => stored,
    setItem: (key, value) => {
      if (key === "ao_lang") stored = value;
    }
  };
  const React = fakeReact();
  const { I18N } = loadGlobal({
    window: true,
    React,
    document,
    localStorage
  });
  React.beginRender();
  let rendered = I18N.LanguageProvider({ children: "app" });
  let api = I18N.useI18n();
  assert.equal(rendered.children, "app");
  assert.equal(api.lang, "en");
  assert.equal(api.t("common.loading"), "Loading…");
  assert.equal(stored, "en");
  assert.equal(document.documentElement.lang, "en");

  api.toggleLanguage();
  assert.equal(stored, "zh-CN");
  assert.equal(document.documentElement.lang, "zh-CN");
  React.beginRender();
  rendered = I18N.LanguageProvider({ children: "app" });
  api = I18N.useI18n();
  assert.equal(rendered.children, "app");
  assert.equal(api.lang, "zh-CN");
  assert.equal(api.t("common.loading"), "加载中…");

  api.setLang("en");
  assert.equal(stored, "en");
  assert.equal(document.documentElement.lang, "en");
  React.beginRender();
  I18N.LanguageProvider({ children: "app" });
  api = I18N.useI18n();
  assert.equal(api.lang, "en");
  assert.equal(api.t("common.loading"), "Loading…");
});

test("browser global honors persisted locale and updates the document language", () => {
  let stored = "zh-CN";
  const document = { documentElement: {} };
  const localStorage = {
    getItem(key) {
      return key === "ao_lang" ? stored : null;
    },
    setItem(key, value) {
      if (key === "ao_lang") stored = value;
    }
  };
  const { I18N, sandbox } = loadGlobal({ window: true, document, localStorage });
  assert.equal(sandbox.I18N, I18N);
  assert.equal(document.documentElement.lang, "zh-CN");
  assert.equal(I18N.useI18n().lang, "zh-CN");
  assert.equal(I18N.useI18n().t("common.loading"), "加载中…");
});
