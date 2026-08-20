// app.jsx — updated with real auth (login/register)

const API_BASE = window.API_BASE || "";
const ACTIVE_ATTEMPT_KEY = "ao_active_attempt";

function getStoredAuth() {
  const token = localStorage.getItem("ao_token");
  const username = localStorage.getItem("ao_username");
  return token && username ? { token, username } : null;
}

function authHeaders(token) {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

function CalmLoading({ label = "Loading…", minHeight = "60vh" }) {
  return (
    <div className="app-shell center" style={{ minHeight, flexDirection: "column", gap: "var(--sp-3)" }}>
      <style>{`@keyframes aoPulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <p className="muted" style={{ animation: "aoPulse 1.6s ease-in-out infinite", fontFamily: "var(--font-mono)", letterSpacing: "0.06em", margin: 0 }}>
        {label}
      </p>
    </div>
  );
}

function AvgRankChip({ rank, average }) {
  return (
    <div className="rank-chip" title={`${rank.current.name} · ${average} avg`}>
      <span className="rank-chip__icon">
        <i className={`ti ti-${rank.current.icon}`} />
      </span>
      <span className="rank-chip__name">{rank.current.name}</span>
      <span className="rank-chip__divider">·</span>
      <span className="num rank-chip__points">{average} avg</span>
    </div>
  );
}

function HomeScreen({ onPlay }) {
  return (
    <main className="home-screen fade-in" data-screen-label="Home">
      <section className="home-hero">
        <span className="home-kicker">Read the file. Make the call.</span>
        <h2 className="home-title">Admissions Oracle</h2>
        <p className="home-copy">
          Predict where an applicant was admitted, then see how closely your read matched the real outcome.
        </p>
        <div className="home-actions">
          <Btn onClick={onPlay} iconRight="arrow-right" testId="home-play">Play</Btn>
        </div>
      </section>

      <section className="home-rules" aria-label="How to play">
        <article className="home-rule">
          <span className="label">Score</span>
          <strong>0–100 points</strong>
          <p>Match the best university and LAC bands, then identify the admits inside your chosen bands.</p>
        </article>
        <article className="home-rule">
          <span className="label">Retry</span>
          <strong>One scoring retry</strong>
          <p>Your first reveal opens a five-second retry window. Later attempts on that case are practice only.</p>
        </article>
        <article className="home-rule">
          <span className="label">Pace</span>
          <strong>Time matters</strong>
          <p>A time factor rewards decisive reads while preserving the 100-point case maximum.</p>
        </article>
      </section>

      <footer className="home-meta">
        <div className="home-authors">
          <span className="label">Created by</span>
          <span>ChromedomeV12 + Mason W (MJanW)</span>
        </div>
        <a
          className="home-github"
          href="https://github.com/ChromedomeV12/CollegeAdmissionsGuessingGame"
          target="_blank"
          rel="noreferrer"
        >
          <i className="ti ti-brand-github" aria-hidden="true" />
          <span>GitHub</span>
        </a>
      </footer>
    </main>
  );
}

function Phase0Menu({ profiles, onSelectProfile, scoresByProfile, lockedProfiles }) {
  const completed = profiles.filter(profile => scoresByProfile[profile.id] !== undefined).length;
  return (
    <div className="fade-in" data-screen-label="00 Menu">
      <section className="library-intro">
        <div>
          <span className="eyebrow">Admissions reading room</span>
          <h2>Read the file.<br />Make the call.</h2>
          <p>Eight compact applicant cases. No endless feed, no public usernames, just the evidence and your prediction.</p>
        </div>
        <div className="library-stats" aria-label="Case library progress">
          <div><strong className="num">{profiles.length}</strong><span>Seed cases</span></div>
          <div><strong className="num">{completed}</strong><span>Completed</span></div>
          <div><strong className="num">{profiles.length - completed}</strong><span>Unread</span></div>
        </div>
      </section>
      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">Case library</span>
          <h2>Select an applicant</h2>
        </div>
        <span className="sub">Each file hides the final decisions until the reveal.</span>
      </div>
      <div className="grid grid-2 stagger">
        {profiles.map((p, i) => {
          const score = scoresByProfile[p.id];
          const hasPlayed = score !== undefined;
          const isLocked = lockedProfiles && lockedProfiles.has(p.id);
          const num = String(i + 1).padStart(2, "0");
          const kind = hasPlayed
            ? (score > 0 ? "ok" : score < 0 ? "danger" : "neutral")
            : "neutral";
          return (
            <div
              key={p.id}
              className="card school-card"
              role="button"
              tabIndex={0}
              aria-label={`Select applicant ${num}, ${p.id}${hasPlayed ? `, played, ${score} points` : ", not yet played"}${isLocked ? ", practice only" : ""}`}
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
                <span className="label">Applicant {num}</span>
                <span className="name accent-text">{p.id}</span>
                <span className="row" style={{ gap: "var(--sp-1)", flexWrap: "wrap", marginTop: "var(--sp-1)" }}>
                  <span className="chip">{p.demographics?.gender || "Unknown"}</span>
                  <span className="chip">{p.demographics?.ethnicity || "Unknown"}</span>
                </span>
              </div>
              <div className="stack" style={{ gap: "var(--sp-1)", alignItems: "flex-end" }}>
                <span className={`check${hasPlayed ? " is-complete" : ""}`} aria-hidden="true">
                  {hasPlayed && <i className="ti ti-check" style={{ fontSize: "var(--fs-xs)" }} />}
                </span>
                {isLocked && (
                  <Badge icon="lock">Practice</Badge>
                )}
                {hasPlayed ? (
                  <Badge kind={kind} icon={score > 0 ? "trophy" : null}>{score} pts</Badge>
                ) : (
                  <Badge icon="player-play">Unplayed</Badge>
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
    const stored = getStoredAuth();
    if (!stored) { setAuthChecked(true); return; }
    fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${stored.token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.username) {
          setAuth(stored);
          if (data.scores) setScoresByProfile(data.scores);
        }
        else { localStorage.removeItem("ao_token"); localStorage.removeItem("ao_username"); }
      })
      .catch(() => setAuth(stored))
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
      .catch(() => {
        setError("Could not load profiles. Make sure the server is running.");
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
        return fetch(`${API_BASE}/api/me`, { headers: { Authorization: `Bearer ${auth.token}` } });
      })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!cancelled && data?.scores) setScoresByProfile(data.scores);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setError("Could not safely recover your unfinished case. Please retry.");
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
      .catch(() => setError("Could not load your finalized cases. Please retry."))
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
      throw new Error(message);
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
      apiJson("/api/me", { headers: { Authorization: `Bearer ${auth.token}` } }),
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
      setError("Could not safely leave this case. Please retry.");
      return false;
    }
  }

  async function handleLogout() {
    if (!await abandonCurrentAttempt()) return;
    localStorage.removeItem("ao_token");
    localStorage.removeItem("ao_username");
    localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
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
    if (!response.ok) throw new Error(`Profile fetch failed (${response.status})`);
    return response.json();
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
      setError("Could not load the finalized applicant file. Please retry.");
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
      console.error(err);
      setError("Could not start a scoring attempt. Please retry.");
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
      setError("This scoring attempt is no longer active. Please retry.");
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
      setError("Could not save this reveal. Your answers remain hidden; please retry.");
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
      setError("Could not finalize this case. Your answers remain hidden; please retry.");
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
      setError("Could not reserve the retry. Your first result is still pending.");
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
    return <CalmLoading label="Checking your session…" />;
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
              <span className="badge badge--danger" style={{ alignSelf: "flex-start" }}>Error</span>
              <span style={{ color: "var(--text-danger)" }}>{error}</span>
            </div>
          </div>
          <button className="btn-primary" onClick={() => window.location.reload()} style={{ alignSelf: "center" }}>
            <i className="ti ti-refresh" aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profiles || !locksLoaded || !orphanRecoveryDone) {
    return <CalmLoading label="Loading applicant files…" />;
  }

  const profile = profileIdx !== null ? profiles[profileIdx] : null;


  if (showLeaderboard) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <h1>Admissions <em>Oracle</em></h1>
          </div>
          <div className="row">
            <button className="btn-ghost" data-testid="nav-home" onClick={() => { setShowLeaderboard(false); setShowHome(true); }} aria-label="Open home">
              <i className="ti ti-home" aria-hidden="true" /> Home
            </button>
            <button className="btn-ghost" data-testid="nav-menu" onClick={() => { setShowLeaderboard(false); setShowHome(false); setPhase(0); }} aria-label="Back to applicant menu">
              <i className="ti ti-arrow-left" aria-hidden="true" /> Menu
            </button>
            <LanguageToggle />
            <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label="Log out">
              <i className="ti ti-logout" aria-hidden="true" /> Log out
            </button>
          </div>
        </header>
        <LeaderboardScreen username={auth.username} average={average} rank={rank} token={auth.token} />
      </div>
    );
  }

  if (showHome) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <h1>Admissions <em>Oracle</em></h1>
          </div>
          <div className="row">
            <button className="btn-ghost" data-testid="nav-leaderboard" onClick={openLeaderboard} aria-label="Open leaderboard">
              <i className="ti ti-trophy" aria-hidden="true" /> Leaderboard
            </button>
            <button className="btn-ghost" data-testid="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
            </button>
            <LanguageToggle />
            <AvgRankChip rank={rank} average={average} />
            <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label="Log out">
              <i className="ti ti-logout" aria-hidden="true" /> Log out
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
          <h1>Admissions <em>Oracle</em></h1>
        </div>
        <div className="row">
          {phase === 0 && (
            <button className="btn-ghost" data-testid="nav-home" onClick={() => setShowHome(true)} aria-label="Open home">
              <i className="ti ti-home" aria-hidden="true" /> Home
            </button>
          )}
          <button className="btn-ghost" data-testid="nav-leaderboard" onClick={openLeaderboard} aria-label="Open leaderboard">
            <i className="ti ti-trophy" aria-hidden="true" /> Leaderboard
          </button>
          {phase > 0 && profileIdx !== null && (
            <>
              <div className="phase-meta">
                <span>Case {String(profileIdx + 1).padStart(2, "0")} / {String(profiles.length).padStart(2, "0")}</span>
                <span className="dot" />
                <span>Phase {phase} / 4</span>
              </div>
              <button className="btn-ghost" data-testid="nav-menu" onClick={goNextProfile} aria-label="Back to applicant menu">
                <i className="ti ti-list" aria-hidden="true" /> Menu
              </button>
            </>
          )}
          <button className="btn-ghost" data-testid="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
          </button>
          <LanguageToggle />
          <AvgRankChip rank={rank} average={average} />
          <button className="btn-ghost" data-testid="nav-logout" onClick={handleLogout} aria-label="Log out">
            <i className="ti ti-logout" aria-hidden="true" /> Log out
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
          <CalmLoading label="Loading finalized choices…" minHeight="30vh" />
        ) : (
          <Phase1Profile
            profile={fullProfile || profile}
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

function LeaderboardScreen({ username, average, rank, token }) {
  const [rows, setRows] = React.useState(null);
  const [rivals, setRivals] = React.useState(null);
  const [rivalInput, setRivalInput] = React.useState("");
  const [rivalError, setRivalError] = React.useState(null);
  const [duel, setDuel] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/rivals`, { headers: authHeaders(token) })
      .then(r => (r.ok ? r.json() : []))
      .then(data => setRivals(Array.isArray(data) ? data : []))
      .catch(console.error);
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
      .then(r => {
        if (r.status === 404) throw new Error("not-found");
        if (!r.ok) throw new Error("failed");
        return r.json();
      })
      .then(() => {
        setRivalInput("");
        setRivals(prev => {
          const list = Array.isArray(prev) ? prev.slice() : [];
          if (!list.some(x => x.username === name)) list.push({ username: name });
          return list;
        });
      })
      .catch(err => setRivalError(err && err.message === "not-found" ? `No player named "${name}".` : "Could not add that rival."));
  }

  function openDuel(name) {
    if (!token) return;
    setDuel({ username: name, data: null });
    fetch(`${API_BASE}/api/duel/${encodeURIComponent(name)}`, { headers: authHeaders(token) })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then(data => setDuel({ username: name, data }))
      .catch(() => setDuel({ username: name, data: { common: [] } }));
  }

  return (
    <main className="fade-in" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <div className="stack" style={{ gap: "var(--sp-1)" }}>
            <span className="label">Logged in as <span className="accent-text">{username}</span></span>
            <span className="num" style={{ fontSize: "var(--fs-h2)", fontWeight: 700, lineHeight: 1 }}>{average} avg</span>
            <span className="muted">{rank.current.name}</span>
          </div>
        </div>
      </div>

      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">Standings</span>
          <h2>Global leaderboard</h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", whiteSpace: "nowrap" }}>≥ 5 cases to qualify</span>
      </div>

      {!rows && <CalmLoading label="Loading standings…" minHeight="20vh" />}
      {rows && rows.length === 0 && (
        <div className="card center" style={{ flexDirection: "column", gap: "var(--sp-2)", padding: "var(--sp-6)", textAlign: "center" }}>
          <i className="ti ti-trophy" aria-hidden="true" style={{ fontSize: 28, color: "var(--text-tertiary)" }} />
          <p className="muted" style={{ margin: 0 }}>No scores yet — be the first!</p>
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="leaderboard-grid" style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
            <span>Rank</span>
            <span>Player</span>
            <span>Avg</span>
            <span>Cases</span>
            <span>Best</span>
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
                  aria-label={`Rank ${i + 1}`}
                >
                  {i + 1}
                </span>
                <span className="grow" style={{ fontWeight: isYou ? 600 : 400 }}>
                  {row.username}
                  {isYou && <span className="chip" style={{ marginLeft: "var(--sp-2)" }}>you</span>}
                </span>
                <span className="num" style={{ fontWeight: 600 }}>{row.avg} avg</span>
                <span className="num muted" style={{ fontSize: "var(--fs-sm)" }}>{row.games}</span>
                <span className="num muted" style={{ fontSize: "var(--fs-sm)" }}>{row.best}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head" style={{ marginTop: "var(--sp-6)" }}>
        <div className="title-block">
          <span className="eyebrow">Rivalry</span>
          <h2>Rivals</h2>
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>Head-to-head on shared cases</span>
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
            placeholder="Add a rival by username"
            aria-label="Rival username"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Btn onClick={addRival} icon="user-plus" disabled={!rivalInput.trim()} testId="rival-add">Add rival</Btn>
        </form>
        {rivalError && (
          <div className="label" role="alert" style={{ color: "var(--text-danger)", marginTop: "var(--sp-2)" }}>{rivalError}</div>
        )}
        {rivals && rivals.length === 0 && !rivalError && (
          <p className="muted" style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-sm)" }}>
            No rivals yet — add a player's username, then open a duel to compare cases you've both played.
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
                <Btn variant="ghost" onClick={() => openDuel(r.username)} iconRight="arrow-right" testId="duel-open">Duel</Btn>
              </div>
            ))}
          </div>
        )}
      </div>

      {duel && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: "var(--sp-4)" }}>
          <div className="row" style={{ padding: "var(--sp-3) var(--sp-5)", borderBottom: "1px solid var(--border-1)", justifyContent: "space-between", flexWrap: "nowrap" }}>
            <span className="label">Duel · you vs {duel.username}</span>
            <Btn variant="ghost" onClick={() => setDuel(null)} icon="x" ariaLabel="Close duel view" />
          </div>
          {!duel.data && <CalmLoading label="Loading duel…" minHeight="15vh" />}
          {duel.data && duel.data.common.length === 0 && (
            <p className="muted" style={{ margin: 0, padding: "var(--sp-5)", fontSize: "var(--fs-sm)", textAlign: "center" }}>
              No shared cases yet — play the same profiles to compare.
            </p>
          )}
          {duel.data && duel.data.common.length > 0 && (
            <>
              <div className="leaderboard-grid leaderboard-grid--duel" style={{ color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
                <span>Case</span>
                <span>You</span>
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
                    <span className="grow" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.profileId}</span>
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
