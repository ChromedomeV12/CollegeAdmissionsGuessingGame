// app.jsx — game shell with Cloudflare Sites identity

const API_BASE = window.API_BASE || "";
const ACTIVE_ATTEMPT_KEY = "ao_active_attempt";

function usesHostedIdentity() {
  return window.location.pathname.startsWith("/game/");
}

function getStoredAuth() {
  const token = localStorage.getItem("ao_token");
  const username = localStorage.getItem("ao_username");
  return token && username ? { token, username } : null;
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    ...(token && token !== "site" ? { Authorization: `Bearer ${token}` } : {}),
  };
}
async function readApiResponse(response) {
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}

function profileDisplayName(t, profiles, profileId) {
  const index = profiles.findIndex(profile => profile.id === profileId);
  return t("profile.displayName", { number: index >= 0 ? index + 1 : "—" });
}

function CalmLoading({ label, minHeight = "60vh" }) {
  const { t } = window.I18N.useI18n();
  return (
    <div className="app-shell center" style={{ minHeight, flexDirection: "column", gap: "var(--sp-3)" }}>
      <style>{`@keyframes aoPulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <p className="muted" style={{ animation: "aoPulse 1.6s ease-in-out infinite", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", margin: 0 }}>
        {label || t("common.loading")}
      </p>
    </div>
  );
}

function AvgRankChip({ rank, average }) {
  const { t } = window.I18N.useI18n();
  const rankName = t(`ranks.${rank.current.id}`);
  return (
    <div className="rank-chip" title={t("rank.chipTitle", { rank: rankName, average })}>
      <span className="rank-chip__icon">
        <i className={`ti ti-${rank.current.icon}`} aria-hidden="true" />
      </span>
      <span className="rank-chip__name">{rankName}</span>
      <span className="rank-chip__divider" aria-hidden="true">·</span>
      <span className="num rank-chip__points">{t("rank.chipValue", { average })}</span>
    </div>
  );
}

function HomeScreen({ onPlay }) {
  const { t } = window.I18N.useI18n();
  return (
    <main className="home-screen fade-in" data-screen-label="Home">
      <section className="home-hero">
        <span className="home-kicker">{t("home.kicker")}</span>
        <h2 className="home-title">{t("auth.brand")}</h2>
        <p className="home-copy">{t("home.copy")}</p>
        <div className="home-actions">
          <Btn onClick={onPlay} iconRight="arrow-right" testId="home-play">{t("home.play")}</Btn>
        </div>
      </section>

      <section className="home-rules" aria-label={t("home.rulesLabel")}>
        <article className="home-rule">
          <span className="label">{t("home.score")}</span>
          <strong>{t("home.scoreStrong")}</strong>
          <p>{t("home.scoreBody")}</p>
        </article>
        <article className="home-rule">
          <span className="label">{t("home.retry")}</span>
          <strong>{t("home.retryStrong")}</strong>
          <p>{t("home.retryBody")}</p>
        </article>
        <article className="home-rule">
          <span className="label">{t("home.pace")}</span>
          <strong>{t("home.paceStrong")}</strong>
          <p>{t("home.paceBody")}</p>
        </article>
      </section>

      <footer className="home-meta">
        <div className="home-authors">
          <span className="label">{t("home.createdBy")}</span>
          <span>ChromedomeV12 + Mason W (MJanW)</span>
        </div>
        <a
          className="home-github"
          href="https://github.com/ChromedomeV12/CollegeAdmissionsGuessingGame"
          target="_blank"
          rel="noreferrer"
          aria-label={t("home.github")}
        >
          <i className="ti ti-brand-github" aria-hidden="true" />
          <span>{t("home.github")}</span>
        </a>
      </footer>
    </main>
  );
}

function Phase0Menu({ profiles, onSelectProfile, scoresByProfile, lockedProfiles }) {
  const { t, translateEnum } = window.I18N.useI18n();
  const completed = profiles.filter(profile => scoresByProfile[profile.id] !== undefined).length;
  return (
    <div className="fade-in" data-screen-label="00 Menu">
      <section className="library-intro">
        <div>
          <span className="eyebrow">{t("menu.eyebrow")}</span>
          <h2>{t("home.kicker")}</h2>
          <p>{t("menu.description")}</p>
        </div>
        <div className="library-stats" aria-label={t("menu.progressLabel")}>
          <div><strong className="num">{profiles.length}</strong><span>{t("menu.seedCases")}</span></div>
          <div><strong className="num">{completed}</strong><span>{t("menu.completed")}</span></div>
          <div><strong className="num">{profiles.length - completed}</strong><span>{t("menu.unread")}</span></div>
        </div>
      </section>
      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">{t("menu.libraryLabel")}</span>
          <h2>{t("menu.selectApplicant")}</h2>
        </div>
        <span className="sub">{t("menu.revealHint")}</span>
      </div>
      <div className="grid grid-2 stagger">
        {profiles.map((p, i) => {
          const score = scoresByProfile[p.id];
          const hasPlayed = score !== undefined;
          const isLocked = lockedProfiles && lockedProfiles.has(p.id);
          const num = String(i + 1).padStart(2, "0");
          const kind = hasPlayed ? (score > 0 ? "ok" : score < 0 ? "danger" : "neutral") : "neutral";
          const status = hasPlayed
            ? t("menu.playedStatus", { score })
            : t("menu.unplayedStatus");
          const practice = isLocked ? t("menu.practiceStatus") : "";
          const displayName = t("profile.displayName", { number: i + 1 });
          return (
            <div
              key={p.id}
              className="card school-card"
              role="button"
              tabIndex={0}
              aria-label={t("menu.selectAria", { num, name: displayName, status, practice })}
              data-card-num={num}
              aria-pressed={hasPlayed ? "true" : "false"}
              onClick={() => onSelectProfile(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectProfile(i);
                }
              }}
            >
              <div className="stack" style={{ gap: "var(--sp-1)" }}>
                <span className="label">{t("menu.applicant", { num })}</span>
                <span className="name accent-text">{displayName}</span>
                <span className="row" style={{ gap: "var(--sp-1)", flexWrap: "wrap", marginTop: "var(--sp-1)" }}>
                  <span className="chip">{translateEnum("gender", p.demographics?.gender) || t("common.unknown")}</span>
                  <span className="chip">{p.demographics?.ethnicity || t("common.unknown")}</span>
                </span>
              </div>
              <div className="stack" style={{ gap: "var(--sp-1)", alignItems: "flex-end" }}>
                <span className={`check${hasPlayed ? " is-complete" : ""}`} aria-hidden="true">
                  {hasPlayed && <i className="ti ti-check" style={{ fontSize: "var(--fs-xs)" }} />}
                </span>
                {isLocked && <Badge icon="lock">{t("menu.practice")}</Badge>}
                {hasPlayed ? (
                  <Badge kind={kind} icon={score > 0 ? "trophy" : null}>{t("menu.points", { score })}</Badge>
                ) : (
                  <Badge icon="player-play">{t("menu.unplayed")}</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function App() {
  const { t, localizeError } = window.I18N.useI18n();
  const [auth, setAuth] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [profiles, setProfiles] = React.useState(null);
  const [error, setError] = React.useState(null);

  const [profileIdx, setProfileIdx] = React.useState(null);
  const [phase, setPhase] = React.useState(0);
  const [universityTierPick, setUniversityTierPick] = React.useState(null);
  const [lacTierPick, setLacTierPick] = React.useState(null);
  const [schoolSelections, setSchoolSelections] = React.useState(new Set());
  const [noUniClaim, setNoUniClaim] = React.useState(false);
  const [noLacClaim, setNoLacClaim] = React.useState(false);
  const [scoresByProfile, setScoresByProfile] = React.useState({});
  const [showHome, setShowHome] = React.useState(true);
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);
  const [fullProfile, setFullProfile] = React.useState(null);
  const [profileLoading, setProfileLoading] = React.useState(false);
  const [retryUsed, setRetryUsed] = React.useState(false);
  const [isPractice, setIsPractice] = React.useState(false);
  const [attempt, setAttempt] = React.useState(null);
  const [serverResult, setServerResult] = React.useState(null);
  const [scoringFinalized, setScoringFinalized] = React.useState(false);
  const [orphanRecoveryDone, setOrphanRecoveryDone] = React.useState(false);
  // Permanent practice-only blacklist for the signed-in user.
  const [lockedProfiles, setLockedProfiles] = React.useState(new Set());
  const [locksLoaded, setLocksLoaded] = React.useState(false);
  const attemptRef = React.useRef(null);
  const [theme, setTheme] = React.useState(() => {
    const stored = localStorage.getItem("ao_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  React.useEffect(() => {
    const hosted = usesHostedIdentity();
    const stored = hosted ? null : getStoredAuth();
    if (!hosted && !stored) { setAuthChecked(true); return; }
    fetch(`${API_BASE}/api/me`, { headers: authHeaders(stored?.token) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.username) {
          setAuth(hosted ? { username: data.username, token: "site" } : stored);
          localStorage.setItem("ao_username", data.username);
          if (data.scores) setScoresByProfile(data.scores);
        }
        else {
          localStorage.removeItem("ao_token");
          localStorage.removeItem("ao_username");
        }
      })
      .catch(() => { if (!hosted && stored) setAuth(stored); })
      .finally(() => setAuthChecked(true));
  }, []);

  React.useEffect(() => {
    if (!auth) return;
    fetch(`${API_BASE}/api/profiles`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Bad response");
        setProfiles(data);
      })
      .catch(err => {
        setError(err);
      });
  }, [auth]);

  // A reload or tab close cannot leave a guessing attempt usable. The server
  // remains authoritative; this recovery call deletes an unscored guess or
  // finalizes the pending first reveal before the profile list is enabled.
  React.useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    setOrphanRecoveryDone(false);
    let stored = null;
    try {
      stored = JSON.parse(localStorage.getItem(ACTIVE_ATTEMPT_KEY) || "null");
    } catch (_) {
      localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
    }
    if (!stored?.attemptId || stored.username !== auth.username) {
      localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
      setOrphanRecoveryDone(true);
      return;
    }

    fetch(`${API_BASE}/api/attempts/${encodeURIComponent(stored.attemptId)}/abandon`, {
      method: "POST",
      headers: authHeaders(auth.token),
    })
      .then(response => {
        if (!response.ok && response.status !== 404) {
          throw new Error(`Attempt recovery failed (${response.status})`);
        }
        localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
        return fetch(`${API_BASE}/api/me`, { headers: authHeaders(auth.token) });
      })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.scores) setScoresByProfile(data.scores);
      })
      .catch(err => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setOrphanRecoveryDone(true);
      });
    return () => { cancelled = true; };
  }, [auth]);

  React.useEffect(() => {
    if (!auth) return;
    const abandonOnExit = () => {
      const current = attemptRef.current;
      if (!current?.attemptId) return;
      fetch(`${API_BASE}/api/attempts/${encodeURIComponent(current.attemptId)}/abandon`, {
        method: "POST",
        headers: authHeaders(auth.token),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", abandonOnExit);
    return () => window.removeEventListener("pagehide", abandonOnExit);
  }, [auth]);

  // Practice-only locks for this user, fetched before the case menu is shown.
  React.useEffect(() => {
    if (!auth || !orphanRecoveryDone) return;
    setLocksLoaded(false);
    fetch(`${API_BASE}/api/locks`, { headers: authHeaders(auth.token) })
      .then(r => {
        if (!r.ok) throw new Error(`Profile locks failed (${r.status})`);
        return r.json();
      })
      .then(ids => {
        if (!Array.isArray(ids)) throw new Error("Bad profile locks response");
        setLockedProfiles(new Set(ids));
      })
      .catch(err => setError(err))
      .finally(() => setLocksLoaded(true));
  }, [auth, orphanRecoveryDone]);
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("ao_theme", next);
    setTheme(next);
  }

  const totalPoints = Object.values(scoresByProfile).reduce((a, b) => a + b, 0);
  const cases = Object.keys(scoresByProfile).length;
  const average = cases ? Math.round(totalPoints / cases) : 0;
  const rank = window.rankFor(average);

  function handleLogin(username, token, scores) {
    setAuth({ username, token });
    setOrphanRecoveryDone(false);
    setLocksLoaded(false);
    if (scores) setScoresByProfile(scores);
    setShowHome(true);
    setShowLeaderboard(false);
  }

  function setCurrentAttempt(next) {
    attemptRef.current = next;
    setAttempt(next);
    if (next?.attemptId && auth) {
      localStorage.setItem(ACTIVE_ATTEMPT_KEY, JSON.stringify({ ...next, username: auth.username }));
    } else {
      localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
    }
  }

  async function apiJson(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(auth.token), ...(options.headers || {}) },
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function isValidResult(result) {
    return !!result
      && Number.isInteger(result.score) && result.score >= 0 && result.score <= 100
      && Number.isInteger(result.rawScore) && result.rawScore >= 0 && result.rawScore <= 100
      && Number.isFinite(result.accuracy)
      && Number.isFinite(result.uniPts)
      && Number.isFinite(result.lacPts)
      && Number.isFinite(result.selectionPts)
      && Number.isFinite(result.timeSeconds)
      && Number.isFinite(result.timeFactor);
  }

  function applyFinalizedResult(pid, result) {
    if (!pid || !isValidResult(result)) return;
    setScoresByProfile(prev => ({ ...prev, [pid]: result.score }));
    setLockedProfiles(prev => prev.has(pid) ? prev : new Set(prev).add(pid));
  }

  async function syncAccountState() {
    const [me, locks] = await Promise.all([
      apiJson("/api/me"),
      apiJson("/api/locks"),
    ]);
    if (!Array.isArray(locks) || !me?.scores) throw new Error("Invalid account state response");
    setScoresByProfile(me.scores);
    setLockedProfiles(new Set(locks));
  }

  async function abandonCurrentAttempt() {
    const current = attemptRef.current;
    if (!current?.attemptId) return true;
    try {
      const data = await apiJson(`/api/attempts/${encodeURIComponent(current.attemptId)}/abandon`, { method: "POST" });
      setCurrentAttempt(null);
      if (data?.result && isValidResult(data.result)) applyFinalizedResult(current.profileId, data.result);
      await syncAccountState();
      return true;
    } catch (err) {
      console.error(err);
      setError(err);
      return false;
    }
  }

  async function handleLogout() {
    if (!await abandonCurrentAttempt()) return;
    localStorage.removeItem("ao_token");
    localStorage.removeItem("ao_username");
    localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
    if (usesHostedIdentity()) {
      window.location.assign("/signout-with-chatgpt?return_to=%2Fgame%2Findex.html");
      return;
    }
    setAuth(null);
    setProfiles(null);
    setScoresByProfile({});
    setProfileIdx(null);
    setPhase(0);
    setShowHome(true);
    setShowLeaderboard(false);
    setFullProfile(null);
    setProfileLoading(false);
    setRetryUsed(false);
    setIsPractice(false);
    setServerResult(null);
    setScoringFinalized(false);
    setLockedProfiles(new Set());
    setLocksLoaded(false);
    setOrphanRecoveryDone(false);
  }

  function clearPicks() {
    setUniversityTierPick(null);
    setLacTierPick(null);
    setSchoolSelections(new Set());
    setNoUniClaim(false);
    setNoLacClaim(false);
  }

  async function fetchFullProfile(pid) {
    const response = await fetch(`${API_BASE}/api/profiles/${encodeURIComponent(pid)}`, {
      headers: authHeaders(auth.token),
    });
    return readApiResponse(response);
  }

  async function selectProfile(idx) {
    const selected = profiles && profiles[idx];
    if (!selected) return;
    const practice = lockedProfiles.has(selected.id);
    setShowHome(false);
    setShowLeaderboard(false);
    setProfileIdx(idx);
    setIsPractice(practice);
    setRetryUsed(false);
    setServerResult(null);
    setScoringFinalized(false);
    clearPicks();
    setFullProfile(null);
    setPhase(1);
    if (!practice) return;
    setProfileLoading(true);
    try {
      setFullProfile(await fetchFullProfile(selected.id));
    } catch (err) {
      console.error(err);
      setError(err);
    } finally {
      setProfileLoading(false);
    }
  }

  async function beginGuessing() {
    const selected = profileIdx !== null && profiles ? profiles[profileIdx] : null;
    if (!selected) return;
    if (isPractice) {
      setPhase(2);
      return;
    }
    const current = attemptRef.current;
    if (current?.profileId === selected.id && (current.stage === "guessing" || current.stage === "retrying")) {
      setPhase(2);
      return;
    }
    try {
      const data = await apiJson("/api/attempts/start", {
        method: "POST",
        body: JSON.stringify({ profileId: selected.id }),
      });
      if (!data?.attemptId || !data.startedAt || !Number.isFinite(Date.parse(data.startedAt))) {
        throw new Error("Invalid attempt start response");
      }
      setCurrentAttempt({
        attemptId: data.attemptId,
        profileId: selected.id,
        stage: "guessing",
        startedAt: data.startedAt,
      });
      setPhase(2);
    } catch (err) {
      if (err?.status === 409 && err?.data?.state === "guessing" && err?.data?.attemptId) {
        try {
          await apiJson(`/api/attempts/${encodeURIComponent(err.data.attemptId)}/abandon`, { method: "POST" });
          const restarted = await apiJson("/api/attempts/start", {
            method: "POST",
            body: JSON.stringify({ profileId: selected.id }),
          });
          if (!restarted?.attemptId || !Number.isFinite(Date.parse(restarted.startedAt))) {
            throw new Error("Invalid attempt start response");
          }
          setCurrentAttempt({
            attemptId: restarted.attemptId,
            profileId: selected.id,
            stage: "guessing",
            startedAt: restarted.startedAt,
          });
          setPhase(2);
          return;
        } catch (recoveryError) {
          err = recoveryError;
        }
      }
      console.error(err);
      setError(err);
    }
  }

  function predictionPayload() {
    return {
      universityTierPick,
      lacTierPick,
      noUniClaim: !!noUniClaim,
      noLacClaim: !!noLacClaim,
      schoolSelections: [...schoolSelections],
    };
  }

  async function acceptFinalizedReveal(data, selected) {
    if (!data?.finalized || data.locked !== true || !isValidResult(data.result)) {
      throw new Error("Invalid finalized attempt response");
    }
    setCurrentAttempt(null);
    applyFinalizedResult(selected.id, data.result);
    const authorizedProfile = await fetchFullProfile(selected.id);
    setFullProfile(authorizedProfile);
    setServerResult(data.result);
    setScoringFinalized(true);
    setPhase(4);
  }

  async function revealResults() {
    const selected = profileIdx !== null && profiles ? profiles[profileIdx] : null;
    if (!selected) return;
    if (isPractice) {
      setServerResult(null);
      setScoringFinalized(false);
      setPhase(4);
      return;
    }
    const current = attemptRef.current;
    if (!current?.attemptId || (current.stage !== "guessing" && current.stage !== "retrying")) {
      setError({ key: "errors.inactiveAttempt" });
      return;
    }
    try {
      const data = await apiJson(`/api/attempts/${encodeURIComponent(current.attemptId)}/reveal`, {
        method: "POST",
        body: JSON.stringify(predictionPayload()),
      });
      if (!isValidResult(data?.result)) throw new Error("Invalid attempt result");
      if (data.finalized) {
        await acceptFinalizedReveal(data, selected);
        return;
      }
      if (!data.retryDeadline || !Number.isFinite(Date.parse(data.retryDeadline))) {
        throw new Error("Invalid retry deadline");
      }
      setCurrentAttempt({
        ...current,
        stage: "retry_pending",
        firstResult: data.result,
        retryDeadline: data.retryDeadline,
      });
      setServerResult(data.result);
      setScoringFinalized(false);
      setPhase(4);
    } catch (err) {
      console.error(err);
      setError(err);
    }
  }

  async function finalizeCurrentAttempt() {
    const selected = profileIdx !== null && profiles ? profiles[profileIdx] : null;
    const current = attemptRef.current;
    if (!selected || !current?.attemptId || current.stage !== "retry_pending") return false;
    try {
      const data = await apiJson(`/api/attempts/${encodeURIComponent(current.attemptId)}/finalize`, { method: "POST" });
      await acceptFinalizedReveal(data, selected);
      return true;
    } catch (err) {
      console.error(err);
      setError(err);
      return false;
    }
  }

  async function handleRetry() {
    const current = attemptRef.current;
    if (isPractice || retryUsed || !current?.attemptId || current.stage !== "retry_pending") return false;
    try {
      const data = await apiJson(`/api/attempts/${encodeURIComponent(current.attemptId)}/retry`, { method: "POST" });
      if (data?.success !== true || !data.startedAt || !Number.isFinite(Date.parse(data.startedAt))) {
        throw new Error("Invalid retry response");
      }
      setCurrentAttempt({ ...current, stage: "retrying", startedAt: data.startedAt });
      setRetryUsed(true);
      clearPicks();
      setFullProfile(null);
      setServerResult(null);
      setPhase(2);
      return true;
    } catch (err) {
      console.error(err);
      setError(err);
      return false;
    }
  }

  function startPracticeRound() {
    const selected = profileIdx !== null && profiles ? profiles[profileIdx] : null;
    if (!selected || !lockedProfiles.has(selected.id) || !fullProfile) return;
    clearPicks();
    setIsPractice(true);
    setRetryUsed(false);
    setServerResult(null);
    setScoringFinalized(false);
    setPhase(1);
  }

  async function goNextProfile() {
    if (!await abandonCurrentAttempt()) return false;
    clearPicks();
    setPhase(0);
    setProfileIdx(null);
    setFullProfile(null);
    setRetryUsed(false);
    setIsPractice(false);
    setServerResult(null);
    setScoringFinalized(false);
    setShowHome(false);
    setShowLeaderboard(false);
    return true;
  }

  async function openLeaderboard() {
    if (phase > 0 && profileIdx !== null && !await goNextProfile()) return;
    setShowHome(false);
    setShowLeaderboard(true);
  }

  function handleLockTier() {
    setPhase(3);
  }

  function resetForProfile() {
    startPracticeRound();
  }

  React.useEffect(() => {
    if (phase <= 0 || profileIdx === null) return;
    const leaveOnEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      goNextProfile();
    };
    window.addEventListener("keydown", leaveOnEscape);
    return () => window.removeEventListener("keydown", leaveOnEscape);
  }, [phase, profileIdx]);

  if (!authChecked) {
    return <CalmLoading label={t("auth.sessionChecking")} />;
  }

  if (!auth) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (error) {
    return (
      <div className="app-shell center" style={{ minHeight: "60vh" }}>
        <div className="card stack" style={{ maxWidth: 420, gap: "var(--sp-4)" }}>
          <div className="callout" role="alert" style={{ background: "var(--bg-danger)", borderColor: "var(--border-danger)" }}>
            <i className="ti ti-alert-triangle" style={{ color: "var(--text-danger)" }} aria-hidden="true" />
            <div className="stack" style={{ gap: "var(--sp-1)" }}>
              <span className="badge badge--danger" style={{ alignSelf: "flex-start" }}>{t("common.error")}</span>
              <span style={{ color: "var(--text-danger)" }}>{error.key ? t(error.key, error.params) : localizeError(error)}</span>
            </div>
          </div>
          <button className="btn-primary" onClick={() => window.location.reload()} style={{ alignSelf: "center" }}>
            <i className="ti ti-refresh" aria-hidden="true" /> {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!profiles || !locksLoaded || !orphanRecoveryDone) {
    return <CalmLoading label={t("menu.loadingProfiles")} />;
  }

  const profile = profileIdx !== null ? profiles[profileIdx] : null;
  const profileLabel = profileIdx !== null
    ? t("profile.displayName", { number: profileIdx + 1 })
    : null;


  if (showLeaderboard) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <h1>{t("nav.appName")}</h1>
          </div>
          <div className="row">
            <button className="btn-ghost" data-testid="nav-home" onClick={() => { setShowLeaderboard(false); setShowHome(true); }} aria-label={t("nav.home")}>
              <i className="ti ti-home" aria-hidden="true" /> {t("nav.home")}
            </button>
            <button className="btn-ghost" data-testid="nav-menu" onClick={() => { setShowLeaderboard(false); setShowHome(false); setPhase(0); }} aria-label={t("nav.menuAria")}>
              <i className="ti ti-arrow-left" aria-hidden="true" /> {t("nav.menu")}
            </button>
            <LanguageToggle />
            <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label={t("nav.logout")}>
              <i className="ti ti-logout" aria-hidden="true" /> {t("nav.logout")}
            </button>
          </div>
        </header>
        <LeaderboardScreen username={auth.username} average={average} rank={rank} token={auth.token} profiles={profiles} />
      </div>
    );
  }

  if (showHome) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <h1>{t("nav.appName")}</h1>
          </div>
          <div className="row">
            <button className="btn-ghost" data-testid="nav-leaderboard" onClick={openLeaderboard} aria-label={t("nav.leaderboard")}>
              <i className="ti ti-trophy" aria-hidden="true" /> {t("nav.leaderboard")}
            </button>
            <button className="btn-ghost" data-testid="theme-toggle" onClick={toggleTheme} aria-label={t("nav.toggleTheme")}>
              <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
            </button>
            <LanguageToggle />
            <AvgRankChip rank={rank} average={average} />
            <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label={t("nav.logout")}>
              <i className="ti ti-logout" aria-hidden="true" /> {t("nav.logout")}
            </button>
          </div>
        </header>
        <HomeScreen onPlay={() => { setShowHome(false); setPhase(0); }} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className={`topbar${phase > 0 && profileIdx !== null ? " is-active-round" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <h1>{t("nav.appName")}</h1>
        </div>
        <div className="row">
          {phase === 0 && (
            <button className="btn-ghost" data-testid="nav-home" onClick={() => setShowHome(true)} aria-label={t("nav.homeAria")}>
              <i className="ti ti-home" aria-hidden="true" /> {t("nav.home")}
            </button>
          )}
          <button className="btn-ghost" data-testid="nav-leaderboard" onClick={openLeaderboard} aria-label={t("nav.leaderboard")}>
            <i className="ti ti-trophy" aria-hidden="true" /> {t("nav.leaderboard")}
          </button>
          {phase > 0 && profileIdx !== null && (
            <>
              <div className="phase-meta">
                <span>{t("nav.caseMeta", { current: String(profileIdx + 1).padStart(2, "0"), total: String(profiles.length).padStart(2, "0") })}</span>
                <span className="dot" aria-hidden="true" />
                <span>{t("nav.phaseMeta", { phase })}</span>
              </div>
              <button className="btn-ghost" data-testid="nav-menu" onClick={goNextProfile} aria-label={t("nav.menuAria")}>
                <i className="ti ti-list" aria-hidden="true" /> {t("nav.menu")}
              </button>
            </>
          )}
          <button className="btn-ghost" data-testid="theme-toggle" onClick={toggleTheme} aria-label={t("nav.toggleTheme")}>
            <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
          </button>
          <LanguageToggle />
          <AvgRankChip rank={rank} average={average} />
          <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label={t("nav.logout")}>
            <i className="ti ti-logout" aria-hidden="true" /> {t("nav.logout")}
          </button>
        </div>
      </header>

      {phase === 0 && (
        <Phase0Menu
          profiles={profiles}
          scoresByProfile={scoresByProfile}
          lockedProfiles={lockedProfiles}
          onSelectProfile={selectProfile}
        />
      )}
      {phase === 1 && profileIdx !== null && (
        profileLoading ? (
          <CalmLoading label={t("profile.loadingChoices")} minHeight="30vh" />
        ) : (
          <Phase1Profile
            profile={fullProfile || profile}
            profileLabel={profileLabel}
            profileIdx={profileIdx}
            profileCount={profiles.length}
            canViewCorrectChoices={isPractice && !!fullProfile}
            onStart={beginGuessing}
          />
        )
      )}
      {phase === 2 && profileIdx !== null && (
        <Phase2Tier
          profile={profile}
          profileLabel={profileLabel}
          universityTierPick={universityTierPick} setUniversityTierPick={setUniversityTierPick}
          lacTierPick={lacTierPick} setLacTierPick={setLacTierPick}
          noUniClaim={noUniClaim} setNoUniClaim={setNoUniClaim}
          noLacClaim={noLacClaim} setNoLacClaim={setNoLacClaim}
          isPractice={isPractice}
          attemptStartedAt={attempt?.startedAt || null}
          onLock={handleLockTier}
          onBack={() => setPhase(1)}
        />
      )}
      {phase === 3 && profileIdx !== null && (
        <Phase3School
          profile={isPractice ? (fullProfile || profile) : profile}
          profileLabel={profileLabel}
          universityTierPick={universityTierPick} lacTierPick={lacTierPick}
          noUniClaim={noUniClaim} noLacClaim={noLacClaim}
          schoolSelections={schoolSelections} setSchoolSelections={setSchoolSelections}
          isPractice={isPractice}
          attemptStartedAt={attempt?.startedAt || null}
          onReveal={revealResults} onBack={() => setPhase(2)}
        />
      )}
      {phase === 4 && profileIdx !== null && (
        <Phase4Results
          profile={fullProfile || profile}
          profileLabel={profileLabel}
          universityTierPick={universityTierPick} lacTierPick={lacTierPick}
          noUniClaim={noUniClaim} noLacClaim={noLacClaim}
          schoolSelections={schoolSelections} average={average} rank={rank}
          result={serverResult}
          retryDeadline={attempt?.retryDeadline}
          scoringFinalized={scoringFinalized}
          isPractice={isPractice}
          onTryAgain={resetForProfile}
          onRetry={handleRetry}
          onFinalizeScoring={finalizeCurrentAttempt}
          onNext={goNextProfile} hasNext={profileIdx + 1 < profiles.length}
        />
      )}
    </div>
  );
}

function LeaderboardScreen({ username, average, rank, token, profiles }) {
  const { t, localizeError } = window.I18N.useI18n();
  const [rows, setRows] = React.useState(null);
  const [leaderboardError, setLeaderboardError] = React.useState(null);
  const [rivals, setRivals] = React.useState(null);
  const [rivalInput, setRivalInput] = React.useState("");
  const [rivalError, setRivalError] = React.useState(null);
  const [duel, setDuel] = React.useState(null);
  const [duelError, setDuelError] = React.useState(null);
  React.useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then(readApiResponse)
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Invalid leaderboard response");
        setRows(data);
      })
      .catch(err => setLeaderboardError(err));
  }, []);

  React.useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/rivals`, { headers: authHeaders(token) })
      .then(readApiResponse)
      .then(data => {
        if (!Array.isArray(data)) throw new Error("Invalid rivals response");
        setRivals(data);
      })
      .catch(err => setRivalError(err));
  }, [token]);

  function addRival() {
    const name = rivalInput.trim();
    if (!name || !token) return;
    setRivalError(null);
    fetch(`${API_BASE}/api/rivals`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ username: name }),
    })
      .then(readApiResponse)
      .then(() => {
        setRivalInput("");
        setRivals(prev => {
          const list = Array.isArray(prev) ? prev.slice() : [];
          if (!list.some(x => x.username === name)) list.push({ username: name });
          return list;
        });
      })
      .catch(err => {
        if (err && (err.message === "not-found" || err.message === "User not found")) {
          setRivalError({ key: "leaderboard.noPlayer", params: { username: name } });
        } else if (err && err.message === "failed") {
          setRivalError({ key: "leaderboard.addFailed" });
        } else {
          setRivalError(err);
        }
      });

  }
  function openDuel(name) {
    setDuelError(null);
    setDuel({ username: name, data: null });
    fetch(`${API_BASE}/api/duel/${encodeURIComponent(name)}`, { headers: authHeaders(token) })
      .then(readApiResponse)
      .then(data => {
        if (!data || !Array.isArray(data.common)) throw new Error("Invalid duel response");
        setDuel({ username: name, data });
      })
      .catch(err => {
        setDuelError(err);
        setDuel({ username: name, data: { common: [] } });
      });
  }

  return (
    <main className="fade-in" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <div className="stack" style={{ gap: "var(--sp-1)" }}>
            <span className="label">{t("leaderboard.loggedInAs")} <span className="accent-text">{username}</span></span>
            <span className="num" style={{ fontSize: "var(--fs-h2)", fontWeight: 700, lineHeight: 1 }}>{t("leaderboard.avgScore", { average })}</span>
            <span className="muted">{t(`ranks.${rank.current.id}`)}</span>
          </div>
        </div>
      </div>

      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">{t("leaderboard.standings")}</span>
          <h2>{t("leaderboard.title")}</h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", whiteSpace: "nowrap" }}>{t("leaderboard.qualify")}</span>
      </div>

      {leaderboardError && (
        <div className="callout callout--danger" role="alert" style={{ marginBottom: "var(--sp-3)" }}>
          <span>{leaderboardError.key ? t(leaderboardError.key, leaderboardError.params) : localizeError(leaderboardError)}</span>
        </div>
      )}
      {!rows && !leaderboardError && <CalmLoading label={t("leaderboard.loadingStandings")} minHeight="20vh" />}
      {rows && rows.length === 0 && (
        <div className="card center" style={{ flexDirection: "column", gap: "var(--sp-2)", padding: "var(--sp-6)", textAlign: "center" }}>
          <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 28, color: "var(--text-tertiary)" }} />
          <p className="muted" style={{ margin: 0 }}>{t("leaderboard.noScores")}</p>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="leaderboard-grid" style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
            <span>{t("leaderboard.rank")}</span>
            <span>{t("leaderboard.player")}</span>
            <span>{t("leaderboard.avg")}</span>
            <span>{t("leaderboard.cases")}</span>
            <span>{t("leaderboard.best")}</span>
          </div>
          {rows.map((row, i) => {
            const isYou = row.username === username;
            const top3 = i < 3;
            return (
              <div
                key={row.username}
                className="leaderboard-grid"
                style={{ background: isYou ? "var(--bg-info-subtle)" : "transparent" }}
              >
                <span
                  className={`badge ${top3 ? "badge--warn" : "badge--neutral"}`}
                  style={{ minWidth: 30, justifyContent: "center", fontFamily: "var(--font-mono)" }}
                  aria-label={t("leaderboard.rankAria", { rank: i + 1 })}
                >
                  {i + 1}
                </span>
                <span className="grow" style={{ fontWeight: isYou ? 600 : 400 }}>
                  {row.username}
                  {isYou && <span className="chip" style={{ marginLeft: "var(--sp-2)" }}>{t("leaderboard.youChip")}</span>}
                </span>
                <span className="num" style={{ fontWeight: 600 }}>{t("leaderboard.avgScore", { average: row.avg })}</span>
                <span className="num muted" style={{ fontSize: "var(--fs-sm)" }}>{row.games}</span>
                <span className="num muted" style={{ fontSize: "var(--fs-sm)" }}>{row.best}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head" style={{ marginTop: "var(--sp-6)" }}>
        <div className="title-block">
          <span className="eyebrow">{t("leaderboard.rivalry")}</span>
          <h2>{t("leaderboard.rivalsTitle")}</h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{t("leaderboard.rivalSubtitle")}</span>
      </div>

      <div className="card">
        <form
          className="row"
          style={{ gap: "var(--sp-2)", flexWrap: "nowrap", alignItems: "center" }}
          onSubmit={(e) => { e.preventDefault(); addRival(); }}
        >
          <input
            type="text"
            data-testid="rival-input"
            value={rivalInput}
            onChange={(e) => setRivalInput(e.target.value)}
            placeholder={t("leaderboard.rivalPlaceholder")}
            aria-label={t("leaderboard.rivalAria")}
            style={{ flex: 1, minWidth: 0 }}
          />
          <Btn onClick={addRival} icon="user-plus" disabled={!rivalInput.trim()} testId="rival-add">{t("leaderboard.addRival")}</Btn>
        </form>
        {rivalError && (
          <div className="label" role="alert" style={{ color: "var(--text-danger)", marginTop: "var(--sp-2)" }}>{rivalError.key ? t(rivalError.key, rivalError.params) : localizeError(rivalError)}</div>
        )}
        {rivals && rivals.length === 0 && !rivalError && (
          <p className="muted" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-sm)" }}>
            {t("leaderboard.rivalEmpty")}
          </p>
        )}
        {rivals && rivals.length > 0 && (
          <div style={{ marginTop: "var(--sp-3)", borderTop: "0.5px solid var(--border-1)" }}>
            {rivals.map(r => (
              <div key={r.username} className="row" style={{ justifyContent: "space-between", padding: "var(--sp-2) 0", flexWrap: "nowrap", borderBottom: "0.5px solid var(--border-1)" }}>
                <span style={{ fontWeight: 500 }}>
                  <i className="ti ti-swords" aria-hidden="true" style={{ marginRight: 6, color: "var(--text-tertiary)" }} />
                  {r.username}
                </span>
                <Btn variant="ghost" onClick={() => openDuel(r.username)} iconRight="arrow-right" testId="duel-open">{t("leaderboard.duel")}</Btn>
              </div>
            ))}
          </div>
        )}
      </div>

      {duel && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: "var(--sp-4)" }}>
          <div className="row" style={{ padding: "var(--sp-3) var(--sp-5)", borderBottom: "1px solid var(--border-1)", justifyContent: "space-between", flexWrap: "nowrap" }}>
            <span className="label">{t("leaderboard.duelWith", { username: duel.username })}</span>
            <Btn variant="ghost" onClick={() => setDuel(null)} icon="x" ariaLabel={t("leaderboard.closeDuel")} />
          </div>
          {duelError && (
            <div className="callout callout--danger" role="alert">
              <span>{duelError.key ? t(duelError.key, duelError.params) : localizeError(duelError)}</span>
            </div>
          )}
          {!duel.data && <CalmLoading label={t("leaderboard.loadingDuel")} minHeight="15vh" />}
          {duel.data && duel.data.common.length === 0 && (
            <p className="muted" style={{ margin: 0, padding: "var(--sp-5)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              {t("leaderboard.sharedEmpty")}
            </p>
          )}
          {duel.data && duel.data.common.length > 0 && (
            <>
              <div className="leaderboard-grid leaderboard-grid--duel" style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
                <span>{t("leaderboard.case")}</span>
                <span>{t("leaderboard.youShort")}</span>
                <span>{duel.username}</span>
              </div>
              {duel.data.common.map(c => {
                const youWin = c.you > c.them;
                const theyWin = c.them > c.you;
                return (
                  <div
                    key={c.profileId}
                    className="leaderboard-grid leaderboard-grid--duel"
                  >
                    <span className="grow" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {profileDisplayName(t, profiles, c.profileId)}
                    </span>
                    <span className="num" style={{ fontWeight: youWin ? 700 : 400, color: youWin ? "var(--accent-ok-fg)" : "inherit" }}>{c.you}</span>
                    <span className="num" style={{ fontWeight: theyWin ? 700 : 400, color: theyWin ? "var(--accent-danger-fg)" : "inherit" }}>{c.them}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
const { LanguageProvider } = window.I18N;
root.render(<LanguageProvider><App /></LanguageProvider>);
