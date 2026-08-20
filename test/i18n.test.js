// Core bilingual runtime contract tests. Runs the classic global without a browser or React.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(__dirname, "..", "public", "i18n.js"), "utf8");

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

test("Chinese resources do not accidentally leave English copy untranslated", () => {
  const { I18N } = loadGlobal();
  const preservedTokens = new Set(["Admissions Oracle", "GPA"]);
  for (const key of Object.keys(I18N.resources.en)) {
    if (I18N.resources.en[key] === I18N.resources["zh-CN"][key]) {
      assert.ok(preservedTokens.has(I18N.resources.en[key]), `unexpected untranslated value at ${key}`);
    }
  }
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
    ["schoolType", "Public", "公立"],
    ["schoolType", "Private Day", "私立走读"],
    ["schoolType", "Private Boarding School", "私立寄宿"],
    ["schoolFeed", "Feeder School", "输送型学校"],
    ["schoolFeed", "Non-feeder", "非输送型学校"],
    ["difficulty", "Easy", "简单"],
    ["difficulty", "Medium", "中等"],
    ["difficulty", "Hard", "困难"]
  ];
  for (const [group, value, expected] of cases) {
    assert.equal(I18N.translateEnumValue("zh-CN", group, value), expected);
  }
  assert.equal(I18N.translateEnumValue("zh-CN", "gender", "Nonbinary custom value"), "Nonbinary custom value");
  assert.equal(I18N.translateEnumValue("zh-CN", "gender", null), null);
  assert.equal(I18N.translateEnumValue("en", "gender", "Female"), "Female");
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

  assert.equal(en.formatDate("not-a-date"), "not-a-date");
  assert.equal(zhCN.formatDate("not-a-date"), "not-a-date");
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
