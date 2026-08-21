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
    "auth.passwordMin": "Password must be at least 8 characters.",
    "auth.invalidCredentials": "Invalid username or password.",
    "auth.userExists": "That username is already taken.",
    "auth.usernameInvalid": "Username must be 3–20 characters: letters, numbers, or underscore.",
    "auth.sessionChecking": "Checking your session…",

    "nav.toggleLanguage": "Switch to Simplified Chinese",
    "nav.home": "Home",
    "nav.menu": "Menu",
    "nav.leaderboard": "Leaderboard",
    "nav.logout": "Log out",
    "nav.back": "Back",
    "nav.toggleTheme": "Toggle theme",
    "nav.appName": "Admissions Oracle",
    "nav.homeAria": "Open home",
    "nav.menuAria": "Back to applicant menu",
    "nav.caseMeta": "Case {current} / {total}",
    "nav.phaseMeta": "Phase {phase} / 4",
    "nav.profile": "Profile",
    "nav.tier": "Tier",
    "nav.schools": "Schools",
    "nav.reveal": "Reveal",
    "stepper.progress": "Game progress, step {phase} of 4",

    "home.kicker": "Read the file. Make the call.",
    "home.copy": "Predict where an applicant was admitted, then see how closely your read matched the real outcome.",
    "home.rulesLabel": "How to play",
    "home.scoreStrong": "0–100 points",
    "home.scoreBody": "Match the best university and LAC bands, then identify the admits inside your chosen bands.",
    "home.retryStrong": "One scoring retry",
    "home.retryBody": "Your first reveal opens a five-second retry window. Later attempts on that case are practice only.",
    "home.paceStrong": "Time matters",
    "home.paceBody": "A time factor rewards decisive reads while preserving the 100-point case maximum.",
    "home.createdBy": "Created by",
    "home.github": "GitHub",
    "home.score": "Score",
    "home.retry": "Retry",
    "home.play": "Play",
    "home.pace": "Pace",

    "menu.title": "Menu",
    "menu.practice": "Practice",
    "menu.eyebrow": "Admissions reading room",
    "menu.description": "Eight compact applicant cases. No endless feed, no public usernames, just the evidence and your prediction.",
    "menu.libraryLabel": "Case library",
    "menu.selectApplicant": "Select an applicant",
    "menu.progressLabel": "Case library progress",
    "menu.seedCases": "Seed cases",
    "menu.completed": "Completed",
    "menu.applicant": "Applicant {num}",
    "menu.selectAria": "Select applicant {num}, {id}{status}{practice}",
    "menu.playedStatus": ", played, {score} points",
    "menu.unplayedStatus": ", not yet played",
    "menu.practiceStatus": ", practice only",
    "menu.points": "{score} pts",
    "menu.unread": "Unread",
    "menu.revealHint": "Each file hides the final decisions until the reveal.",
    "menu.loadingProfiles": "Loading applicant files…",
    "menu.unplayed": "Unplayed",

    "common.loading": "Loading…",
    "common.retry": "Try again",
    "common.none": "None",
    "common.unknown": "Unknown",
    "common.score": "Score",
    "common.error": "Error",

    "profile.academics": "Academics",
    "profile.gender": "Gender",
    "profile.income": "Family income",
    "profile.schoolType": "School type",
    "profile.gpa": "GPA",
    "profile.correctChoices": "Correct choices",
    "profile.finalEnrollment": "Final enrollment",
    "profile.applicant": "Applicant {current} / {total}",
    "profile.start": "Start guessing",
    "profile.overview": "Overview",
    "profile.extracurriculars": "Extracurriculars",
    "profile.correctFinalized": "This file is finalized and no longer affects your score.",
    "profile.bestUniversityBand": "Best top-50 university band",
    "profile.noUniversityAdmit": "No top-50 university admit",
    "profile.bestLacBand": "Best top-20 LAC band",
    "profile.noLacAdmit": "No top-20 LAC admit",
    "profile.admittedSchools": "Admitted schools",
    "profile.universities": "Universities",
    "profile.liberalArtsColleges": "Liberal Arts Colleges",
    "profile.otherAdmits": "Other admits",
    "profile.admittedStamp": "Admitted",
    "profile.admittedOn": "Admitted on {date}",
    "profile.ethnicity": "Ethnicity",
    "profile.region": "Region",
    "profile.classification": "Classification",
    "profile.legacy": "Legacy",
    "profile.firstGeneration": "First-gen",
    "profile.testOptional": "Test-optional",
    "profile.satSuperscore": "SAT superscore",
    "profile.actComposite": "ACT composite",
    "profile.gpaUnweighted": "GPA (unweighted)",
    "profile.rigor": "Rigor",
    "profile.apCount": "{count} APs",
    "profile.postApAndHonors": "+ {postAp} post-AP · {honors} honors",
    "profile.apScoreBreakdown": "AP score breakdown",
    "profile.reportedPending": "{reported} reported · {pending} pending",
    "profile.chartBar": "Bar",
    "profile.chartDonut": "Donut",
    "profile.courseHistory": "Course history",
    "profile.year": "Year",
    "profile.course": "Course",
    "profile.level": "Level",
    "profile.scoreValue": "Score {score}",
    "profile.pending": "Pending",
    "profile.reported": "Reported",
    "profile.ecTier": "Tier {tier}",

    "tier.eyebrow": "Phase 2 · University tiers",
    "tier.title": "Where does the applicant land?",
    "tier.instructions": "Choose the most likely university and liberal arts college tiers.",
    "tier.back": "Back to profile",
    "tier.profileReview": "Review profile",
    "tier.bandExplanation": "Tiers are bands, not ranges — T10 means ranks 6–10 only, T15 means 11–15, T20 means 16–20, and so on. Pick the band you think this applicant landed in. Your choices unlock the school list — pick carefully.",
    "tier.panelUniversity": "Panel A · University tier",
    "tier.panelLac": "Panel B · Liberal Arts College tier",
    "tier.choiceCount": "{current} of {total}",
    "tier.noUniversityClaim": "Applicant was not admitted to any T50 University",
    "tier.noUniversityClaimHint": "Claim this if the profile had zero admits in every configured top-50 university band.",
    "tier.noLacClaim": "Applicant was not admitted to any T20 LAC",
    "tier.noLacClaimHint": "Claim this if the profile had zero admits in every configured top-20 LAC band.",
    "tier.lacSeparateRanking": "LACs are ranked on a separate US News list.",
    "tier.claimPoints": "{points} pts",
    "tier.correctClaimScoring": "A correct claim earns 15 points; a wrong claim earns 0.",
    "tier.lockPredictions": "Lock in predictions",
    "tier.timeBonusState": "Time bonus · {state}",
    "tier.timeBonusFull": "full",
    "tier.timeBonusShrinking": "shrinking",
    "tier.timeBonusFloor": "minimum",

    "schools.title": "Build the final list.",
    "schools.instructions": "Select the schools you think will admit this applicant.",
    "schools.university": "Universities",
    "schools.lac": "Liberal arts colleges",
    "schools.selected": "{count} selected",
    "schools.universityTierLabel": "University tier · {tier}",
    "schools.lacTierLabel": "LAC tier · {tier}",
    "schools.withinTier": "Within {tier}",
    "schools.scoringSummary": "Scoring — out of 100, never negative",
    "schools.schoolSelection": "School selection",
    "schools.universityTier": "University tier",
    "schools.lacTier": "LAC tier",
    "schools.upTo": "up to {points}",
    "schools.scoringHint": "Selection is scored by overlap with the admits in view; tier picks earn partial credit by distance from the correct band.",
    "schools.changeTiers": "Change tiers",
    "schools.revealResults": "Reveal results",
    "schools.claimLocked": "Claim locked",
    "schools.skippedClaim": "{claim}. This school grid is skipped; the claim is scored at reveal.",
    "schools.schoolCount": "{count} schools in band",
    "schools.emptyBand": "No schools defined in this band — pick another tier to see options.",
    "schools.selectCard": "Select {school}",
    "schools.deselectCard": "Deselect {school}",

    "reveal.title": "The verdict is in.",
    "reveal.teaching": "What the case teaches",
    "reveal.celebrationGreat": "Sharp eye!",
    "reveal.celebrationGood": "Nice work!",
    "reveal.celebrationAccuracy": "{accuracy}% accuracy on admits — you read this profile well.",
    "reveal.celebrationScore": "You scored {score}/100 on this case.",
    "reveal.practiceFeedback": "Practice feedback",
    "reveal.practiceFeedbackBody": "not recorded and does not affect your score.",
    "reveal.practiceScore": "Practice score",
    "reveal.caseScore": "Case score",
    "reveal.feedbackOnly": "feedback only · out of 100",
    "reveal.scoreSource": "from this profile · out of 100",
    "reveal.afterTimeAdjustment": " · after time adjustment",
    "reveal.accuracy": "Accuracy",
    "reveal.accuracyDescription": "selection overlap with admits in view",
    "reveal.time": "Time",
    "reveal.elapsedSeconds": "{seconds}s",
    "reveal.scoreMultiplier": "Score multiplier ×{multiplier}",
    "reveal.tierResults": "Tier results",
    "reveal.university": "University",
    "reveal.lac": "LAC",
    "reveal.tierPick": "{kind} tier — {pick}",
    "reveal.tierHit": "Hit · matched at least one admit",
    "reveal.tierMiss": "Miss · no admits in this tier",
    "reveal.actualTier": "Actual tier · {tier}",
    "reveal.noUniversityClaim": "Applicant was not admitted to any T50 University",
    "reveal.noLacClaim": "Applicant was not admitted to any T20 LAC",
    "reveal.universityTierPoints": "Reach · university tier",
    "reveal.lacTierPoints": "LAC tier",
    "reveal.noUniversityIncorrect": "Claim was incorrect — applicant had a top-50 university admit",
    "reveal.noUniversityCorrect": "Correctly identified no top-50 university admit",
    "reveal.noLacIncorrect": "Claim was incorrect — applicant had a top-20 LAC admit",
    "reveal.noLacCorrect": "Correctly identified no top-20 LAC admit",
    "reveal.selectionPoints": "Selection · admit overlap",
    "reveal.timeBreakdown": "Time · {seconds}s",
    "reveal.schoolBySchool": "School-by-school",
    "reveal.universitiesTier": "Universities · {tier}",
    "reveal.lacsTier": "LACs · {tier}",
    "reveal.admittedStamp": "Admitted",
    "reveal.enrolledAt": "Enrolled at",
    "reveal.admittedOn": "Admitted on {date}",
    "reveal.overallRanking": "Overall ranking",
    "reveal.currentAverage": "{average} avg · current average",
    "reveal.thisCaseContributed": "This case contributed",
    "reveal.tryAgain": "Try again",
    "reveal.nextProfile": "Next profile",
    "reveal.allProfilesPlayed": "All profiles played",
    "reveal.retryCase": "Retry case ({seconds}s)",
    "reveal.otherSchoolsSkipped": "{count} other schools — correctly skipped",
    "reveal.resultSkipped": "Skipped · was not admitted",
    "reveal.resultCorrect": "Correct admit",
    "reveal.resultWrong": "Wrong — applicant did not get in",
    "reveal.resultMissed": "Missed · this was actually an admit",
    "reveal.admit": "Admit",
    "reveal.notAdmit": "Not admit",
    "reveal.resultRowAria": "{school}: {status}. {outcome}.",

    "leaderboard.title": "Global leaderboard",
    "leaderboard.rank": "Rank",
    "leaderboard.player": "Player",
    "leaderboard.cases": "Cases",
    "leaderboard.best": "Best",
    "leaderboard.rivalry": "Rivalry",
    "leaderboard.duel": "Duel",
    "leaderboard.addRival": "Add rival",
    "leaderboard.standings": "Standings",
    "leaderboard.qualify": "≥ 5 cases to qualify",
    "leaderboard.avg": "Avg",
    "leaderboard.noScores": "No scores yet — be the first!",
    "leaderboard.rivalSubtitle": "Head-to-head on shared cases",
    "leaderboard.rivalPlaceholder": "Add a rival by username",
    "leaderboard.rivalAria": "Rival username",
    "leaderboard.duelWith": "Duel · you vs {username}",
    "leaderboard.closeDuel": "Close duel view",
    "leaderboard.sharedEmpty": "No shared cases yet — play the same profiles to compare.",
    "leaderboard.case": "Case",
    "leaderboard.youShort": "You",
    "leaderboard.noPlayer": "No player named \"{username}\".",
    "leaderboard.addFailed": "Could not add that rival.",
    "leaderboard.rivalNotFound": "Player not found.",
    "leaderboard.rivalInvalid": "Enter a valid rival username.",
    "leaderboard.loggedInAs": "Logged in as",
    "leaderboard.avgScore": "{average} avg",
    "leaderboard.youChip": "you",
    "leaderboard.rankAria": "Rank {rank}",
    "profile.loadingChoices": "Loading finalized choices…",
    "leaderboard.loadingStandings": "Loading standings…",
    "leaderboard.loadingDuel": "Loading duel…",
    "leaderboard.rivalsTitle": "Rivals",
    "leaderboard.rivalEmpty": "No rivals yet — add a player's username, then open a duel to compare cases you've both played.",

    "errors.generic": "Something went wrong. Please try again.",
    "rank.chipTitle": "{rank} · {average} avg",
    "rank.chipValue": "{average} avg",
    "errors.profiles": "Could not load profiles. Make sure the server is running.",
    "errors.locks": "Could not load your finalized cases. Please retry.",
    "errors.leave": "Could not safely leave this case. Please retry.",
    "errors.start": "Could not start a scoring attempt. Please retry.",
    "errors.inactiveAttempt": "This scoring attempt is no longer active. Please retry.",
    "errors.reveal": "Could not save this reveal. Your answers remain hidden; please retry.",
    "errors.finalize": "Could not finalize this case. Your answers remain hidden; please retry.",
    "errors.retry": "Could not reserve the retry. Your first result is still pending.",
    "errors.profileLocked": "Profile locked — practice only.",
    "errors.attemptInProgress": "Attempt already in progress.",
    "errors.invalidProfile": "Invalid profile.",
    "errors.attemptNotFound": "Attempt not found.",
    "errors.scoreAttempt": "Could not score attempt.",
    "errors.retryUnavailable": "Retry is unavailable.",
    "errors.retryExpired": "Retry window expired.",
    "errors.retryOpen": "Retry window is still open.",
    "errors.notReadyFinalize": "Attempt is not ready to finalize.",
    "errors.noScore": "Attempt has no score.",
    "errors.profileNotFound": "Profile not found.",
    "errors.profileNotFinalized": "Profile is not finalized.",

    "ranks.observer": "Observer",
    "ranks.reader": "Reader",
    "ranks.junior": "Junior analyst",
    "ranks.senior": "Senior analyst",
    "ranks.dean": "Dean",
    "ranks.oracle": "Oracle",
    "rank.pointsTitle": "{rank} · {points} pts",
    "rank.pointsValue": "{points} pts",
    "rank.pointsToNext": "{points} pts to {rank}",
    "rank.maxReached": "Max rank reached",

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
    "auth.sessionChecking": "正在检查登录状态…",
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
    "nav.homeAria": "打开首页",
    "nav.menuAria": "返回申请人菜单",
    "nav.caseMeta": "案件 {current} / {total}",
    "nav.phaseMeta": "阶段 {phase} / 4",
    "auth.passwordMinPlaceholder": "至少 8 个字符",
    "auth.confirmPassword": "确认密码",
    "auth.confirmPlaceholder": "再次输入密码",
    "auth.passwordsMatch": "两次密码一致",
    "auth.passwordsMismatch": "两次密码不一致",
    "auth.submitLoading": "请稍候…",
    "auth.fillFields": "请填写所有字段。",
    "auth.passwordMin": "密码至少需要 8 个字符。",
    "auth.invalidCredentials": "用户名或密码无效。",
    "auth.userExists": "该用户名已被占用。",
    "auth.usernameInvalid": "用户名必须为 3–20 个字符，仅可使用字母、数字或下划线。",

    "nav.toggleLanguage": "切换到英语",
    "nav.home": "首页",
    "nav.menu": "菜单",
    "nav.leaderboard": "排行榜",
    "nav.logout": "退出登录",
    "nav.back": "返回",
    "nav.appName": "Admissions Oracle",
    "nav.profile": "档案",
    "nav.tier": "层级",
    "nav.toggleTheme": "切换主题",
    "nav.schools": "学校",
    "nav.reveal": "揭晓",
    "stepper.progress": "游戏进度：第 {phase} 步，共 4 步",

    "home.play": "开始游戏",
    "home.kicker": "阅读档案，做出判断。",
    "home.copy": "预测申请人被哪所学校录取，再看看你的判断与真实结果有多接近。",
    "home.rulesLabel": "玩法说明",
    "home.score": "得分",
    "home.retry": "重试",
    "home.pace": "节奏",

    "menu.title": "菜单",
    "menu.practice": "练习",

    "common.loading": "加载中…",
    "menu.eyebrow": "招生阅览室",
    "menu.description": "八份精简申请档案。没有无尽的信息流，也没有公开用户名，只有证据和你的预测。",
    "menu.libraryLabel": "案件库",
    "menu.selectApplicant": "选择申请人",
    "menu.progressLabel": "案件库进度",
    "menu.seedCases": "案例总数",
    "menu.completed": "已完成",
    "menu.unread": "未阅读",
    "menu.unplayed": "未游玩",
    "common.retry": "重试",
    "common.none": "无",
    "common.unknown": "未知",
    "common.score": "分数",
    "common.error": "错误",

    "profile.academics": "学业",
    "profile.gender": "性别",
    "profile.income": "家庭收入",
    "profile.schoolType": "学校类型",
    "profile.gpa": "GPA",
    "profile.correctChoices": "正确选择",
    "profile.finalEnrollment": "最终入读",
    "profile.applicant": "申请人 {current} / {total}",
    "profile.start": "开始预测",
    "profile.overview": "概览",
    "profile.extracurriculars": "课外活动",
    "profile.correctFinalized": "此档案已结算，不再影响你的分数。",
    "profile.bestUniversityBand": "最佳全美前 50 综合大学档位",
    "profile.noUniversityAdmit": "未被任何全美前 50 综合大学录取",
    "profile.bestLacBand": "最佳全美前 20 文理学院档位",
    "profile.noLacAdmit": "未被任何全美前 20 文理学院录取",
    "profile.admittedSchools": "录取学校",
    "profile.universities": "综合大学",
    "profile.liberalArtsColleges": "文理学院",
    "profile.otherAdmits": "其他录取",
    "profile.admittedStamp": "已录取",
    "profile.admittedOn": "录取日期：{date}",
    "profile.ethnicity": "族裔",
    "profile.region": "地区",
    "profile.classification": "学校类别",
    "profile.legacy": "校友亲属",
    "profile.firstGeneration": "第一代大学生",
    "profile.testOptional": "可不提交标化成绩",
    "profile.satSuperscore": "SAT 拼分",
    "profile.actComposite": "ACT 综合分",
    "profile.gpaUnweighted": "GPA（未加权）",
    "profile.rigor": "课程难度",
    "profile.apCount": "{count} 门 AP",
    "profile.postApAndHonors": "+ {postAp} 门 AP 进阶课程 · {honors} 门荣誉课程",
    "profile.apScoreBreakdown": "AP 分数分布",
    "profile.reportedPending": "{reported} 门已出分 · {pending} 门待出分",
    "profile.chartBar": "条形图",
    "profile.chartDonut": "环形图",
    "profile.courseHistory": "课程记录",
    "profile.year": "年级",
    "profile.course": "课程",
    "profile.level": "级别",
    "profile.scoreValue": "{score} 分",
    "profile.pending": "待出分",
    "profile.reported": "已出分",
    "profile.ecTier": "第 {tier} 级",

    "tier.eyebrow": "阶段 2 · 大学层级",
    "tier.title": "申请人会被哪一档学校录取？",
    "tier.instructions": "选择最可能的综合大学和文理学院层级。",
    "tier.back": "返回档案",
    "tier.profileReview": "查看档案",
    "tier.bandExplanation": "层级按档位划分，并非累计范围——T10 仅指第 6–10 名，T15 仅指第 11–15 名，T20 仅指第 16–20 名，依此类推。选择你认为申请人最终录取的档位。你的选择会解锁学校列表，请谨慎判断。",
    "tier.panelUniversity": "面板 A · 综合大学层级",
    "tier.panelLac": "面板 B · 文理学院层级",
    "tier.choiceCount": "{current} / {total}",
    "tier.noUniversityClaim": "申请人未被任何全美前 50 综合大学录取",
    "tier.noUniversityClaimHint": "如果档案在所有已配置的全美前 50 综合大学档位中均无录取，请选择此项。",
    "tier.noLacClaim": "申请人未被任何全美前 20 文理学院录取",
    "tier.noLacClaimHint": "如果档案在所有已配置的全美前 20 文理学院档位中均无录取，请选择此项。",
    "tier.lacSeparateRanking": "文理学院采用单独的《美国新闻》排名。",
    "tier.claimPoints": "{points} 分",
    "tier.correctClaimScoring": "判断正确得 15 分，判断错误得 0 分。",
    "tier.lockPredictions": "锁定预测",
    "tier.timeBonusState": "时间奖励 · {state}",
    "tier.timeBonusFull": "完整",
    "tier.timeBonusShrinking": "递减中",
    "tier.timeBonusFloor": "最低",

    "schools.title": "列出最终学校。",
    "schools.instructions": "选择你认为会录取申请人的学校。",
    "profile.loadingChoices": "正在加载已完成的选择…",
    "schools.university": "综合大学",
    "schools.lac": "文理学院",
    "schools.selected": "已选 {count} 所",
    "schools.universityTierLabel": "综合大学层级 · {tier}",
    "schools.lacTierLabel": "文理学院层级 · {tier}",
    "schools.withinTier": "{tier} 档位内",
    "schools.scoringSummary": "计分说明——满分 100 分，最低为 0 分",
    "schools.schoolSelection": "学校选择",
    "schools.universityTier": "综合大学层级",
    "schools.lacTier": "文理学院层级",
    "schools.upTo": "最高 {points} 分",
    "schools.scoringHint": "学校选择按所选学校与当前录取学校的重合度计分；层级预测则根据与正确档位的距离给予部分分数。",
    "schools.changeTiers": "修改层级",
    "schools.revealResults": "揭晓结果",
    "schools.claimLocked": "判断已锁定",
    "schools.skippedClaim": "{claim}。此学校列表已跳过；该判断将在揭晓时计分。",
    "schools.schoolCount": "本档共有 {count} 所学校",
    "schools.emptyBand": "此档位尚未配置学校——请选择其他层级查看选项。",
    "schools.selectCard": "选择 {school}",
    "schools.deselectCard": "取消选择 {school}",

    "reveal.title": "判决揭晓。",
    "reveal.teaching": "案件启示",
    "reveal.celebrationGreat": "眼光犀利！",
    "reveal.celebrationGood": "做得不错！",
    "reveal.celebrationAccuracy": "录取判断准确率 {accuracy}%——你很好地读懂了这份档案。",
    "reveal.celebrationScore": "你在本案件中获得 {score}/100 分。",
    "reveal.practiceFeedback": "练习反馈",
    "reveal.practiceFeedbackBody": "不会记录，也不会影响你的分数。",
    "reveal.practiceScore": "练习分数",
    "reveal.caseScore": "案件分数",
    "reveal.feedbackOnly": "仅供反馈 · 满分 100 分",
    "reveal.scoreSource": "来自本档案 · 满分 100 分",
    "reveal.afterTimeAdjustment": " · 已计入时间调整",
    "reveal.accuracy": "准确率",
    "reveal.accuracyDescription": "所选学校与当前显示录取学校的重合度",
    "reveal.time": "用时",
    "reveal.elapsedSeconds": "{seconds} 秒",
    "reveal.scoreMultiplier": "分数乘数 ×{multiplier}",
    "reveal.tierResults": "层级结果",
    "reveal.university": "综合大学",
    "reveal.lac": "文理学院",
    "reveal.tierPick": "{kind}层级——{pick}",
    "reveal.tierHit": "命中 · 至少匹配到一所录取学校",
    "reveal.tierMiss": "未命中 · 此层级没有录取学校",
    "reveal.actualTier": "实际层级 · {tier}",
    "reveal.noUniversityClaim": "申请人未被任何 T50 综合大学录取",
    "reveal.noLacClaim": "申请人未被任何 T20 文理学院录取",
    "reveal.universityTierPoints": "冲刺 · 综合大学层级",
    "reveal.lacTierPoints": "文理学院层级",
    "reveal.noUniversityIncorrect": "判断错误——申请人获得了全美前 50 综合大学的录取",
    "reveal.noUniversityCorrect": "正确判断申请人没有全美前 50 综合大学录取",
    "reveal.noLacIncorrect": "判断错误——申请人获得了全美前 20 文理学院的录取",
    "reveal.noLacCorrect": "正确判断申请人没有全美前 20 文理学院录取",
    "reveal.selectionPoints": "学校选择 · 录取重合度",
    "reveal.timeBreakdown": "用时 · {seconds} 秒",
    "reveal.schoolBySchool": "逐校结果",
    "reveal.universitiesTier": "综合大学 · {tier}",
    "reveal.lacsTier": "文理学院 · {tier}",
    "reveal.admittedStamp": "录取",
    "reveal.enrolledAt": "最终入读",
    "reveal.admittedOn": "录取日期：{date}",
    "reveal.overallRanking": "总排名",
    "reveal.currentAverage": "平均 {average} 分 · 当前平均分",
    "reveal.thisCaseContributed": "本案件贡献",
    "reveal.tryAgain": "再试一次",
    "reveal.nextProfile": "下一份档案",
    "reveal.allProfilesPlayed": "所有档案均已完成",
    "reveal.retryCase": "重试案件（{seconds} 秒）",
    "reveal.otherSchoolsSkipped": "其余 {count} 所学校——已正确跳过",
    "reveal.resultSkipped": "已跳过 · 未获录取",
    "reveal.resultCorrect": "正确录取",
    "reveal.resultWrong": "选择错误——申请人未获录取",
    "reveal.resultMissed": "遗漏 · 实际获得录取",
    "reveal.admit": "已录取",
    "reveal.notAdmit": "未录取",
    "reveal.resultRowAria": "{school}：{status}。{outcome}。",

    "leaderboard.title": "全球排行榜",
    "leaderboard.rank": "名次",
    "leaderboard.player": "玩家",
    "leaderboard.cases": "案件数",
    "leaderboard.best": "最高分",
    "leaderboard.rivalry": "对手",
    "leaderboard.duel": "对决",
    "leaderboard.addRival": "添加对手",
    "leaderboard.standings": "排名情况",
    "leaderboard.qualify": "至少完成 5 个案件才可上榜",
    "leaderboard.avg": "平均分",
    "leaderboard.noScores": "还没有分数，成为第一个吧！",
    "leaderboard.rivalSubtitle": "比较共同完成的案件",
    "leaderboard.rivalPlaceholder": "输入用户名添加对手",
    "leaderboard.rivalAria": "对手用户名",
    "leaderboard.duelWith": "你与 {username} 对决",
    "leaderboard.closeDuel": "关闭对决视图",
    "leaderboard.sharedEmpty": "还没有共同完成的案件——玩同一份档案来比较吧。",
    "leaderboard.case": "案件",
    "leaderboard.youShort": "你",
    "leaderboard.noPlayer": "找不到名为“{username}”的玩家。",
    "leaderboard.addFailed": "无法添加该对手。",
    "leaderboard.rivalNotFound": "找不到该玩家。",
    "leaderboard.rivalInvalid": "请输入有效的对手用户名。",
    "errors.profiles": "无法加载档案，请确认服务器正在运行。",
    "errors.locks": "无法加载已完成的案件，请重试。",
    "errors.leave": "无法安全离开此案件，请重试。",
    "errors.start": "无法开始计分，请重试。",
    "errors.inactiveAttempt": "此计分尝试已不再有效，请重试。",
    "errors.reveal": "无法保存本次揭晓。你的答案仍未公开，请重试。",
    "errors.finalize": "无法完成此案件。你的答案仍未公开，请重试。",
    "errors.retry": "无法保留重试机会。你的第一次结果仍在等待处理。",
    "errors.profileLocked": "该档案已锁定——仅供练习。",
    "errors.attemptInProgress": "已有进行中的尝试。",
    "errors.invalidProfile": "申请档案无效。",
    "errors.attemptNotFound": "找不到该次尝试。",
    "errors.scoreAttempt": "无法为本次尝试计分。",
    "errors.retryUnavailable": "重试不可用。",
    "errors.retryExpired": "重试窗口已过期。",
    "errors.retryOpen": "重试窗口仍在开放。",
    "errors.notReadyFinalize": "此尝试还不能完成。",
    "errors.noScore": "此尝试没有分数。",
    "errors.profileNotFound": "找不到该申请档案。",
    "errors.profileNotFinalized": "该申请档案尚未完成。",

    "errors.generic": "发生了一些问题，请重试。",

    "ranks.observer": "观察者",
    "ranks.reader": "阅卷人",
    "ranks.junior": "初级分析师",
    "ranks.senior": "高级分析师",
    "ranks.dean": "院长",
    "ranks.oracle": "预言家",
    "rank.pointsTitle": "{rank} · {points} 分",
    "rank.pointsValue": "{points} 分",
    "rank.pointsToNext": "还差 {points} 分升至{rank}",
    "rank.maxReached": "已达到最高段位",

    "ranges.HYPSM": "排名第 1–5",
    "ranges.T10": "排名第 6–10",
    "ranges.T15": "排名第 11–15",
    "ranges.T20": "排名第 16–20",
    "ranges.T30": "排名第 21–30",
    "home.scoreStrong": "0–100 分",
    "home.scoreBody": "匹配最合适的综合大学和文理学院层级，再从所选层级中找出会录取的学校。",
    "home.retryStrong": "一次计分重试",
    "home.retryBody": "第一次揭晓后会开启五秒重试窗口。之后在该案件中的尝试仅供练习。",
    "home.paceStrong": "时间很重要",
    "home.paceBody": "时间因素会奖励果断判断，同时保持每案 100 分的上限。",
    "home.createdBy": "制作团队",
    "home.github": "项目主页",
    "menu.applicant": "申请人 {num}",
    "menu.selectAria": "选择申请人 {num}，{id}{status}{practice}",
    "menu.playedStatus": "，已完成，{score} 分",
    "menu.unplayedStatus": "，尚未完成",
    "menu.practiceStatus": "，仅供练习",
    "leaderboard.loadingStandings": "正在加载排名…",
    "leaderboard.loadingDuel": "正在加载对决…",
    "menu.points": "{score} 分",
    "leaderboard.loggedInAs": "当前登录",
    "leaderboard.avgScore": "平均 {average} 分",
    "leaderboard.youChip": "你",
    "leaderboard.rankAria": "第 {rank} 名",
    "leaderboard.rivalsTitle": "对手",
    "menu.revealHint": "每份档案都会在揭晓前隐藏最终决定。",
    "leaderboard.rivalEmpty": "还没有对手——添加玩家用户名，然后开启对决，比较你们共同完成的案件。",
    "menu.loadingProfiles": "正在加载申请档案…",
    "ranges.T50": "排名第 31–50",
    "ranges.T5 LAC": "文理学院排名第 1–5",
    "ranges.T10 LAC": "文理学院排名第 6–10",
    "rank.chipTitle": "{rank} · 平均 {average} 分",
    "rank.chipValue": "平均 {average} 分",
    "ranges.T20 LAC": "文理学院排名第 11–20"
  };
  const ERROR_KEYS = Object.freeze({
    "User already exists": "auth.userExists",
    "That username is already taken.": "auth.userExists",
    "Invalid username or password.": "auth.invalidCredentials",
    "Please fill in all fields.": "auth.fillFields",
    "Username must be 3-20 characters: letters, numbers, or underscore": "auth.usernameInvalid",
    "Password must be between 8 and 72 characters": "auth.passwordMin",
    "Missing username or password": "auth.fillFields",
    "Invalid username or password": "auth.invalidCredentials",
    "Passwords don't match.": "auth.passwordsMismatch",
    "Attempt is no longer accepting a reveal": "errors.reveal",
    "Could not reserve retry": "errors.retry",
    "Could not finalize attempt": "errors.finalize",
    "Could not abandon attempt": "errors.leave",
    "Could not load profiles": "errors.profiles",
    "Could not load locks": "errors.locks",
    "Could not start attempt": "errors.start",
    "Attempt is no longer active": "errors.inactiveAttempt",
    "Attempt is no longer ready to finalize": "errors.notReadyFinalize",
    "Could not save this reveal": "errors.reveal",
    "Could not finalize this case": "errors.finalize",
    "Could not reserve the retry": "errors.retry",
    "Profile locked — practice only": "errors.profileLocked",
    "Attempt already in progress": "errors.attemptInProgress",
    "Invalid profile": "errors.invalidProfile",
    "Attempt not found": "errors.attemptNotFound",
    "Could not score attempt": "errors.scoreAttempt",
    "Retry is unavailable": "errors.retryUnavailable",
    "Retry window expired": "errors.retryExpired",
    "Retry window is still open": "errors.retryOpen",
    "Attempt has no score": "errors.noScore",
    "Profile not found": "errors.profileNotFound",
    "Profile is not finalized": "errors.profileNotFinalized",
    "Profile locked — practice only.": "errors.profileLocked",
    "Attempt already in progress.": "errors.attemptInProgress",
    "Invalid profile.": "errors.invalidProfile",
    "Attempt not found.": "errors.attemptNotFound",
    "Could not score attempt.": "errors.scoreAttempt",
    "Retry is unavailable.": "errors.retryUnavailable",
    "Retry window expired.": "errors.retryExpired",
    "User not found": "leaderboard.rivalNotFound",
    "username must be a non-empty string": "leaderboard.rivalInvalid",
    "Attempt is no longer ready to finalize.": "errors.notReadyFinalize",
    "Attempt has no score.": "errors.noScore",
    "Profile not found.": "errors.profileNotFound",
    "Profile is not finalized.": "errors.profileNotFinalized",
  });

  function localizeError(error, lang = readStoredLang()) {
    const raw = error && typeof error.message === "string" ? error.message : String(error ?? "");
    const key = ERROR_KEYS[raw];
    if (key) return interpolate(lookup(lang, key));
    if (raw) {
      try { (root.console || console).error("Untranslated application error:", raw); } catch (_) {}
    }
    return interpolate(lookup(lang, "errors.generic"));
  }


  const resources = Object.freeze({ en: Object.freeze(en), "zh-CN": Object.freeze(zhCN) });
  const enumMaps = Object.freeze({
    "zh-CN": Object.freeze({
      gender: Object.freeze({ Male: "男性", Female: "女性", Unknown: "未知" }),
      boolean: Object.freeze({ yes: "是", no: "否", Yes: "是", No: "否", true: "是", false: "否" }),
      income: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入", Unknown: "未知" }),
      incomeLevel: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入", Unknown: "未知" }),
      ses: Object.freeze({ "Low Income": "低收入", "Middle Income": "中等收入", "High Income": "高收入", Unknown: "未知" }),
      schoolType: Object.freeze({ Public: "公立", "Private Day": "私立走读", "Private Boarding School": "私立寄宿", Unknown: "未知" }),
      school_type: Object.freeze({ Public: "公立", "Private Day": "私立走读", "Private Boarding School": "私立寄宿", Unknown: "未知" }),
      schoolFeed: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校", Unknown: "未知" }),
      schoolFeeder: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校", Unknown: "未知" }),
      schoolClassification: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校", Unknown: "未知" }),
      school_classification: Object.freeze({ "Feeder School": "输送型学校", "Non-feeder": "非输送型学校", Unknown: "未知" }),
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
      if (value == null || value === "") return "—";
      const dateOnly = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      let date;
      if (dateOnly) {
        const year = Number(dateOnly[1]);
        const month = Number(dateOnly[2]);
        const day = Number(dateOnly[3]);
        date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "—";
      } else {
        date = value instanceof Date ? value : new Date(value);
      }
      if (Number.isNaN(date.getTime())) return "—";
      const locale = activeLang === "zh-CN" ? "zh-CN" : "en-US";
      const dateOptions = options
        ? { ...options }
        : { year: "numeric", month: "short", day: "numeric" };
      if (dateOnly) dateOptions.timeZone = "UTC";
      return new Intl.DateTimeFormat(locale, dateOptions).format(date);
    };
    return {
      lang: activeLang,
      setLang,
      toggleLanguage: () => setLang(activeLang === "en" ? "zh-CN" : "en"),
      t,
      formatDate,
      localizeError: (error) => localizeError(error, activeLang),
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
    localizeError,
    LanguageProvider,
    useI18n
  };
})(typeof window !== "undefined" ? window : globalThis);
