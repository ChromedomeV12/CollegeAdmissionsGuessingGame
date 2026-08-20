(function (root) {
  "use strict";

  const SUPPORTED_LANGS = Object.freeze(["en", "zh-CN"]);

  // Keep this dictionary flat: components own no locale-specific copy and can
  // safely share keys between the browser runtime and Node's VM harness.
  const en = {
    "auth.brand": "Admissions Oracle",
    "auth.eyebrow": "Admissions casework",
    "auth.headline": "Read closely.",
    "auth.headlineEm": "Predict boldly.",
    "auth.description": "Study a real applicant file, call the outcome, then see what the admissions process actually rewarded.",
    "auth.docketLabel": "Inside each case",
    "auth.docketItems": "Academics · activities · school tiers · final decisions",
    "auth.access": "Player access",
    "auth.loginTitle": "Continue your casework",
    "auth.registerTitle": "Create your reader profile",
    "auth.loginSubtitle": "Your scores and rank are waiting.",
    "auth.registerSubtitle": "Choose a private game username to begin.",
    "auth.modeLabel": "Authentication mode",
    "auth.login": "Log in",
    "auth.register": "Create account",
    "auth.username": "Username",
    "auth.usernamePlaceholder": "your_username",
    "auth.password": "Password",
    "auth.passwordPlaceholder": "Your password",
    "auth.passwordMinPlaceholder": "At least 8 characters",
    "auth.confirmPassword": "Confirm password",
    "auth.confirmPlaceholder": "Same password again",
    "auth.passwordsMatch": "Passwords match",
    "auth.passwordsMismatch": "Passwords don't match",
    "auth.submitLoading": "Please wait…",
    "auth.fillFields": "Please fill in all fields.",
    "auth.confirmRequired": "Please confirm your password.",
    "auth.passwordMin": "Password must be at least 8 characters.",
    "auth.invalidCredentials": "Invalid username or password.",
    "auth.userExists": "That username is already taken.",
    "auth.genericError": "Something went wrong. Please try again.",

    "nav.toggleLanguage": "Switch to Simplified Chinese",
    "nav.home": "Home",
    "nav.menu": "Menu",
    "nav.leaderboard": "Leaderboard",
    "nav.logout": "Log out",
    "nav.back": "Back",
    "nav.close": "Close",
    "nav.appName": "Admissions Oracle",
    "nav.profile": "Profile",
    "nav.tier": "Tier",
    "nav.schools": "Schools",
    "nav.reveal": "Reveal",

    "home.eyebrow": "The admissions oracle",
    "home.title": "Make the call.",
    "home.subtitle": "Read the file. Predict the outcome. Learn what mattered.",
    "home.play": "Play a case",
    "home.resume": "Resume case",
    "home.rulesTitle": "How it works",
    "home.ruleProfile": "Read the applicant profile closely.",
    "home.rulePredict": "Predict tiers, schools, and final decisions.",
    "home.ruleReveal": "Reveal the outcome and learn from the score.",
    "home.casesPlayed": "Cases played",
    "home.bestScore": "Best score",
    "home.currentRank": "Current rank",
    "home.noCases": "No cases completed yet.",

    "menu.title": "Menu",
    "menu.account": "Account",
    "menu.signedInAs": "Signed in as {username}",
    "menu.statusReady": "Ready to play",
    "menu.statusInProgress": "Case in progress",
    "menu.statusComplete": "Case complete",
    "menu.practice": "Practice",
    "menu.correctChoices": "Correct choices",
    "menu.about": "About this game",
    "menu.leaderboard": "Global leaderboard",

    "common.loading": "Loading…",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.continue": "Continue",
    "common.submit": "Submit",
    "common.retry": "Try again",
    "common.next": "Next",
    "common.done": "Done",
    "common.skip": "Skip",
    "common.none": "None",
    "common.unknown": "Unknown",
    "common.yes": "Yes",
    "common.no": "No",
    "common.optional": "Optional",
    "common.required": "Required",
    "common.points": "points",
    "common.point": "point",
    "common.seconds": "seconds",
    "common.score": "Score",
    "common.total": "Total",
    "common.date": "Date",
    "common.status": "Status",
    "common.error": "Error",

    "profile.eyebrow": "Case file",
    "profile.title": "Read the applicant.",
    "profile.instructions": "Study the record, then make your predictions.",
    "profile.academics": "Academics",
    "profile.activities": "Activities",
    "profile.awards": "Awards",
    "profile.demographics": "Background",
    "profile.gender": "Gender",
    "profile.income": "Family income",
    "profile.schoolType": "School type",
    "profile.schoolFeeder": "School history",
    "profile.courses": "Courses",
    "profile.testScores": "Test scores",
    "profile.gpa": "GPA",
    "profile.classRank": "Class rank",
    "profile.description": "Description",
    "profile.noData": "No information provided.",
    "profile.correctChoices": "Correct choices",
    "profile.finalEnrollment": "Final enrollment",
    "profile.metric": "Metric",
    "profile.value": "Value",
    "profile.next": "Choose a tier",
    "profile.stepLabel": "Profile",

    "tier.eyebrow": "Phase 2 · University tiers",
    "tier.title": "Where does the applicant land?",
    "tier.instructions": "Choose the most likely university and liberal arts college tiers.",
    "tier.university": "National university",
    "tier.lac": "Liberal arts college",
    "tier.prediction": "Your prediction",
    "tier.select": "Select a tier",
    "tier.noPrediction": "No prediction",
    "tier.claim": "Claim no admission",
    "tier.claimed": "No admission claimed",
    "tier.timeBonus": "Time bonus",
    "tier.timeBonusReady": "Time bonus available",
    "tier.timeBonusLost": "Time bonus unavailable",
    "tier.next": "Choose schools",
    "tier.back": "Back to profile",
    "tier.hint": "You can revise this choice before continuing.",

    "schools.eyebrow": "Phase 3 · School choices",
    "schools.title": "Build the final list.",
    "schools.instructions": "Select the schools you think will admit this applicant.",
    "schools.university": "Universities",
    "schools.lac": "Liberal arts colleges",
    "schools.selected": "{count} selected",
    "schools.select": "Select",
    "schools.selectedLabel": "Selected",
    "schools.noSchools": "No schools in this tier.",
    "schools.skipped": "Skipped",
    "schools.skip": "Skip this tier",
    "schools.scoreAllocation": "Score allocation",
    "schools.admit": "Admit",
    "schools.waitlist": "Waitlist",
    "schools.reject": "Reject",
    "schools.next": "Reveal outcome",
    "schools.back": "Back to tiers",
    "schools.cardLabel": "{school}, {status}",

    "reveal.eyebrow": "Case outcome",
    "reveal.title": "The verdict is in.",
    "reveal.pending": "Your result is being prepared…",
    "reveal.retryIn": "Retry in {seconds}s",
    "reveal.retry": "Retry now",
    "reveal.finalize": "Finalize result",
    "reveal.score": "Your score",
    "reveal.breakdown": "Score breakdown",
    "reveal.tierBreakdown": "Tier predictions",
    "reveal.selectionBreakdown": "School selections",
    "reveal.noAdmit": "No-admission calls",
    "reveal.explanation": "Why this result",
    "reveal.teaching": "What the case teaches",
    "reveal.enrollment": "The applicant enrolled at {school}.",
    "reveal.practice": "Practice mode — this case is not recorded.",
    "reveal.notRecorded": "Practice results are not recorded.",
    "reveal.rankContribution": "Rank contribution",
    "reveal.statusCorrect": "Correct",
    "reveal.statusPartial": "Partially correct",
    "reveal.statusIncorrect": "Incorrect",
    "reveal.statusPending": "Pending",
    "reveal.correctChoices": "Correct choices",
    "reveal.playAgain": "Play another case",
    "reveal.home": "Return home",
    "reveal.back": "Back to selections",

    "leaderboard.title": "Global leaderboard",
    "leaderboard.subtitle": "See how your casework compares.",
    "leaderboard.rank": "Rank",
    "leaderboard.player": "Player",
    "leaderboard.score": "Score",
    "leaderboard.cases": "Cases",
    "leaderboard.best": "Best",
    "leaderboard.you": "You",
    "leaderboard.empty": "No scores yet.",
    "leaderboard.loading": "Loading leaderboard…",
    "leaderboard.rivalry": "Rivalry",
    "leaderboard.rival": "Rival",
    "leaderboard.duel": "Duel",
    "leaderboard.openDuel": "Open duel",
    "leaderboard.addRival": "Add rival",
    "leaderboard.rivalName": "Username or applicant ID",
    "leaderboard.noRivals": "No rivals added yet.",
    "leaderboard.removeRival": "Remove rival",

    "errors.generic": "Something went wrong. Please try again.",
    "errors.network": "Unable to connect. Check your connection and try again.",
    "errors.invalidCredentials": "Invalid username or password.",
    "errors.userExists": "That username is already taken.",
    "errors.validation": "Please check your entries and try again.",
    "errors.load": "We couldn't load this case.",
    "errors.save": "We couldn't save your result.",

    "ranks.observer": "Observer",
    "ranks.reader": "Reader",
    "ranks.junior": "Junior analyst",
    "ranks.senior": "Senior analyst",
    "ranks.dean": "Dean",
    "ranks.oracle": "Oracle",

    "ranges.HYPSM": "Ranks 1–5",
    "ranges.T10": "Ranks 6–10",
    "ranges.T15": "Ranks 11–15",
    "ranges.T20": "Ranks 16–20",
    "ranges.T30": "Ranks 21–30",
    "ranges.T50": "Ranks 31–50",
    "ranges.T5 LAC": "LAC ranks 1–5",
    "ranges.T10 LAC": "LAC ranks 6–10",
    "ranges.T20 LAC": "LAC ranks 11–20"
  };

  const zhCN = {
    "auth.brand": "Admissions Oracle",
    "auth.eyebrow": "招生案件",
    "auth.headline": "细读材料。",
    "auth.headlineEm": "大胆预测。",
    "auth.description": "研究一份真实的申请档案，判断录取结果，再看看招生过程究竟看重什么。",
    "auth.docketLabel": "每份案件包含",
    "auth.docketItems": "学业 · 活动 · 学校层级 · 最终决定",
    "auth.access": "玩家入口",
    "auth.loginTitle": "继续你的案件分析",
    "auth.registerTitle": "创建你的读者档案",
    "auth.loginSubtitle": "你的分数和段位正在等你。",
    "auth.registerSubtitle": "选择一个私密的游戏用户名开始吧。",
    "auth.modeLabel": "登录方式",
    "auth.login": "登录",
    "auth.register": "创建账号",
    "auth.username": "用户名",
    "auth.usernamePlaceholder": "你的用户名",
    "auth.password": "密码",
    "auth.passwordPlaceholder": "你的密码",
    "auth.passwordMinPlaceholder": "至少 8 个字符",
    "auth.confirmPassword": "确认密码",
    "auth.confirmPlaceholder": "再次输入密码",
    "auth.passwordsMatch": "两次密码一致",
    "auth.passwordsMismatch": "两次密码不一致",
    "auth.submitLoading": "请稍候…",
    "auth.fillFields": "请填写所有字段。",
    "auth.confirmRequired": "请确认密码。",
    "auth.passwordMin": "密码至少需要 8 个字符。",
    "auth.invalidCredentials": "用户名或密码无效。",
    "auth.userExists": "该用户名已被占用。",
    "auth.genericError": "发生了一些问题，请重试。",

    "nav.toggleLanguage": "切换到英语",
    "nav.home": "首页",
    "nav.menu": "菜单",
    "nav.leaderboard": "排行榜",
    "nav.logout": "退出登录",
    "nav.back": "返回",
    "nav.close": "关闭",
    "nav.appName": "Admissions Oracle",
    "nav.profile": "档案",
    "nav.tier": "层级",
    "nav.schools": "学校",
    "nav.reveal": "揭晓",

    "home.eyebrow": "招生预言家",
    "home.title": "做出判断。",
    "home.subtitle": "阅读档案，预测结果，找出真正重要的因素。",
    "home.play": "开始案件",
    "home.resume": "继续案件",
    "home.rulesTitle": "玩法说明",
    "home.ruleProfile": "仔细阅读申请人的档案。",
    "home.rulePredict": "预测层级、学校和最终决定。",
    "home.ruleReveal": "揭晓结果，从分数中学习。",
    "home.casesPlayed": "已完成案件",
    "home.bestScore": "最高分",
    "home.currentRank": "当前段位",
    "home.noCases": "还没有完成任何案件。",

    "menu.title": "菜单",
    "menu.account": "账号",
    "menu.signedInAs": "当前登录：{username}",
    "menu.statusReady": "可以开始",
    "menu.statusInProgress": "案件进行中",
    "menu.statusComplete": "案件已完成",
    "menu.practice": "练习",
    "menu.correctChoices": "正确选择",
    "menu.about": "关于本游戏",
    "menu.leaderboard": "全球排行榜",

    "common.loading": "加载中…",
    "common.save": "保存",
    "common.cancel": "取消",
    "common.continue": "继续",
    "common.submit": "提交",
    "common.retry": "重试",
    "common.next": "下一步",
    "common.done": "完成",
    "common.skip": "跳过",
    "common.none": "无",
    "common.unknown": "未知",
    "common.yes": "是",
    "common.no": "否",
    "common.optional": "可选",
    "common.required": "必填",
    "common.points": "分",
    "common.point": "分",
    "common.seconds": "秒",
    "common.score": "分数",
    "common.total": "总计",
    "common.date": "日期",
    "common.status": "状态",
    "common.error": "错误",

    "profile.eyebrow": "案件档案",
    "profile.title": "读懂申请人。",
    "profile.instructions": "研究档案，然后做出你的预测。",
    "profile.academics": "学业",
    "profile.activities": "活动",
    "profile.awards": "奖项",
    "profile.demographics": "背景",
    "profile.gender": "性别",
    "profile.income": "家庭收入",
    "profile.schoolType": "学校类型",
    "profile.schoolFeeder": "学校经历",
    "profile.courses": "课程",
    "profile.testScores": "考试成绩",
    "profile.gpa": "GPA",
    "profile.classRank": "班级排名",
    "profile.description": "描述",
    "profile.noData": "未提供信息。",
    "profile.correctChoices": "正确选择",
    "profile.finalEnrollment": "最终入读",
    "profile.metric": "指标",
    "profile.value": "数值",
    "profile.next": "选择层级",
    "profile.stepLabel": "档案",

    "tier.eyebrow": "阶段 2 · 大学层级",
    "tier.title": "申请人会被哪一档学校录取？",
    "tier.instructions": "选择最可能的综合大学和文理学院层级。",
    "tier.university": "综合大学",
    "tier.lac": "文理学院",
    "tier.prediction": "你的预测",
    "tier.select": "选择层级",
    "tier.noPrediction": "暂无预测",
    "tier.claim": "判断为无录取",
    "tier.claimed": "已判断为无录取",
    "tier.timeBonus": "时间奖励",
    "tier.timeBonusReady": "可获得时间奖励",
    "tier.timeBonusLost": "无法获得时间奖励",
    "tier.next": "选择学校",
    "tier.back": "返回档案",
    "tier.hint": "继续之前可以修改选择。",

    "schools.eyebrow": "阶段 3 · 学校选择",
    "schools.title": "列出最终学校。",
    "schools.instructions": "选择你认为会录取申请人的学校。",
    "schools.university": "综合大学",
    "schools.lac": "文理学院",
    "schools.selected": "已选 {count} 所",
    "schools.select": "选择",
    "schools.selectedLabel": "已选择",
    "schools.noSchools": "此层级没有学校。",
    "schools.skipped": "已跳过",
    "schools.skip": "跳过此层级",
    "schools.scoreAllocation": "分数分配",
    "schools.admit": "录取",
    "schools.waitlist": "候补",
    "schools.reject": "拒绝",
    "schools.next": "揭晓结果",
    "schools.back": "返回层级",
    "schools.cardLabel": "{school}，{status}",

    "reveal.eyebrow": "案件结果",
    "reveal.title": "判决揭晓。",
    "reveal.pending": "正在准备你的结果…",
    "reveal.retryIn": "{seconds} 秒后重试",
    "reveal.retry": "立即重试",
    "reveal.finalize": "确认结果",
    "reveal.score": "你的分数",
    "reveal.breakdown": "分数明细",
    "reveal.tierBreakdown": "层级预测",
    "reveal.selectionBreakdown": "学校选择",
    "reveal.noAdmit": "无录取判断",
    "reveal.explanation": "结果原因",
    "reveal.teaching": "案件启示",
    "reveal.enrollment": "申请人最终入读 {school}。",
    "reveal.practice": "练习模式——本案件不会记录。",
    "reveal.notRecorded": "练习结果不会记录。",
    "reveal.rankContribution": "段位贡献",
    "reveal.statusCorrect": "正确",
    "reveal.statusPartial": "部分正确",
    "reveal.statusIncorrect": "错误",
    "reveal.statusPending": "等待中",
    "reveal.correctChoices": "正确选择",
    "reveal.playAgain": "再玩一个案件",
    "reveal.home": "返回首页",
    "reveal.back": "返回选择",

    "leaderboard.title": "全球排行榜",
    "leaderboard.subtitle": "看看你的案件分析表现。",
    "leaderboard.rank": "名次",
    "leaderboard.player": "玩家",
    "leaderboard.score": "分数",
    "leaderboard.cases": "案件数",
    "leaderboard.best": "最高分",
    "leaderboard.you": "你",
    "leaderboard.empty": "还没有分数。",
    "leaderboard.loading": "正在加载排行榜…",
    "leaderboard.rivalry": "对手",
    "leaderboard.rival": "竞争者",
    "leaderboard.duel": "对决",
    "leaderboard.openDuel": "开启对决",
    "leaderboard.addRival": "添加对手",
    "leaderboard.rivalName": "用户名或申请人 ID",
    "leaderboard.noRivals": "还没有添加对手。",
    "leaderboard.removeRival": "移除对手",

    "errors.generic": "发生了一些问题，请重试。",
    "errors.network": "无法连接，请检查网络后重试。",
    "errors.invalidCredentials": "用户名或密码无效。",
    "errors.userExists": "该用户名已被占用。",
    "errors.validation": "请检查填写内容后重试。",
    "errors.load": "无法加载此案件。",
    "errors.save": "无法保存你的结果。",

    "ranks.observer": "观察者",
    "ranks.reader": "阅卷人",
    "ranks.junior": "初级分析师",
    "ranks.senior": "高级分析师",
    "ranks.dean": "院长",
    "ranks.oracle": "预言家",

    "ranges.HYPSM": "排名第 1–5",
    "ranges.T10": "排名第 6–10",
    "ranges.T15": "排名第 11–15",
    "ranges.T20": "排名第 16–20",
    "ranges.T30": "排名第 21–30",
    "ranges.T50": "排名第 31–50",
    "ranges.T5 LAC": "文理学院排名第 1–5",
    "ranges.T10 LAC": "文理学院排名第 6–10",
    "ranges.T20 LAC": "文理学院排名第 11–20"
  };

  const resources = Object.freeze({ en: Object.freeze(en), "zh-CN": Object.freeze(zhCN) });
  const enumMaps = Object.freeze({
    "zh-CN": Object.freeze({
      gender: Object.freeze({ Male: "男性", Female: "女性", Unknown: "未知" }),
      boolean: Object.freeze({ yes: "是", no: "否", Yes: "是", No: "否", true: "是", false: "否" }),
      income: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入" }),
      incomeLevel: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入" }),
      ses: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入" }),
      schoolType: Object.freeze({ Public: "公立", "Private Day": "私立走读", "Private Boarding School": "私立寄宿" }),
      school_type: Object.freeze({ Public: "公立", "Private Day": "私立走读", "Private Boarding School": "私立寄宿" }),
      schoolFeed: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校" }),
      schoolFeeder: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校" }),
      schoolClassification: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校" }),
      school_classification: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校" }),
      difficulty: Object.freeze({ Easy: "简单", Medium: "中等", Hard: "困难" }),
      difficulty_level: Object.freeze({ Easy: "简单", Medium: "中等", Hard: "困难" })
    })
  });

  function normalizeLang(value) {
    return SUPPORTED_LANGS.includes(value) ? value : "en";
  }

  function interpolate(template, params = {}) {
    return String(template).replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => {
      const value = params[key];
      return value == null ? `{${key}}` : String(value);
    });
  }

  function lookup(lang, key) {
    const locale = resources[normalizeLang(lang)];
    return locale[key] ?? resources.en[key] ?? key;
  }

  function translateEnumValue(lang, group, value) {
    if (value == null || value === "") return value;
    return enumMaps[normalizeLang(lang)]?.[group]?.[String(value)] ?? value;
  }

  function getReact() {
    return root.React || (typeof React !== "undefined" ? React : null);
  }

  function readStoredLang() {
    try {
      const storage = root.localStorage;
      return normalizeLang(storage && storage.getItem("ao_lang"));
    } catch (_) {
      return "en";
    }
  }

  function syncDocumentLang(lang) {
    try {
      if (root.document?.documentElement) root.document.documentElement.lang = normalizeLang(lang);
    } catch (_) {
      // A restricted document should not prevent the language controls working.
    }
  }

  function persistLang(lang) {
    try {
      if (root.localStorage) root.localStorage.setItem("ao_lang", normalizeLang(lang));
    } catch (_) {
      // Storage can be unavailable in privacy mode or a VM sandbox.
    }
  }

  function createApi(lang, setLang) {
    const activeLang = normalizeLang(lang);
    const t = (key, params) => interpolate(lookup(activeLang, key), params);
    const formatDate = (value, options) => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return value == null ? "" : String(value);
      const locale = activeLang === "zh-CN" ? "zh-CN" : "en-US";
      return new Intl.DateTimeFormat(locale, options || { year: "numeric", month: "short", day: "numeric" }).format(date);
    };
    return {
      lang: activeLang,
      setLang,
      toggleLanguage: () => setLang(activeLang === "en" ? "zh-CN" : "en"),
      t,
      formatDate,
      translateEnum: (group, value) => translateEnumValue(activeLang, group, value)
    };
  }

  let languageContext = null;

  function LanguageProvider({ children }) {
    const ReactImpl = getReact();
    if (!ReactImpl || typeof ReactImpl.useState !== "function") return children;
    if (!languageContext) languageContext = ReactImpl.createContext(null);

    const [lang, setLangState] = ReactImpl.useState(readStoredLang);
    const setLang = ReactImpl.useCallback((value) => {
      const next = normalizeLang(typeof value === "function" ? value(lang) : value);
      syncDocumentLang(next);
      persistLang(next);
      setLangState(next);
    }, [lang]);
    ReactImpl.useEffect(() => {
      syncDocumentLang(lang);
      persistLang(lang);
    }, [lang]);
    const api = ReactImpl.useMemo(() => createApi(lang, setLang), [lang, setLang]);
    return ReactImpl.createElement(languageContext.Provider, { value: api }, children);
  }

  function useI18n() {
    const ReactImpl = getReact();
    if (!ReactImpl || typeof ReactImpl.useContext !== "function") return createApi(readStoredLang(), () => {});
    if (!languageContext) languageContext = ReactImpl.createContext(null);
    return ReactImpl.useContext(languageContext) || createApi(readStoredLang(), () => {});
  }

  syncDocumentLang(readStoredLang());

  root.I18N = {
    SUPPORTED_LANGS,
    resources,
    normalizeLang,
    interpolate,
    translateEnumValue,
    LanguageProvider,
    useI18n
  };
})(typeof window !== "undefined" ? window : globalThis);
