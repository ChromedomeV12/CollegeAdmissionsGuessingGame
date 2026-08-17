// app.jsx — updated with real auth (login/register)

const API_BASE = window.API_BASE || "";

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

function Phase0Menu({ profiles, onSelectProfile, scoresByProfile }) {
  return (
    <div className="fade-in" data-screen-label="00 Menu">
      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">Casework</span>
          <h2>Select an Applicant</h2>
        </div>
        <span className="sub">Choose a profile to evaluate.</span>
      </div>
      <div className="grid grid-2 stagger">
        {profiles.map((p, i) => {
          const score = scoresByProfile[p.id];
          const hasPlayed = score !== undefined;
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
              aria-label={`Select applicant ${num}, ${p.id}${hasPlayed ? `, played, ${score} points` : ", not yet played"}`}
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
                <span className="check" aria-hidden="true">
                  {hasPlayed && <i className="ti ti-check" style={{ fontSize: "var(--fs-xs)" }} />}
                </span>
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
  const [noLacClaim, setNoLacClaim] = React.useState(false);
  const [scoresByProfile, setScoresByProfile] = React.useState({});
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);
  const [fullProfile, setFullProfile] = React.useState(null);

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

  const totalPoints = Object.values(scoresByProfile).reduce((a, b) => a + b, 0);
  const rank = window.rankFor(totalPoints);

  function handleLogin(username, token, scores) {
    setAuth({ username, token });
    if (scores) setScoresByProfile(scores);
  }

  function handleLogout() {
    localStorage.removeItem("ao_token");
    localStorage.removeItem("ao_username");
    setAuth(null);
    setProfiles(null);
    setScoresByProfile({});
    setProfileIdx(null);
    setPhase(0);
    setFullProfile(null);
  }

  function commitScore(pid, score, breakdown) {
    setScoresByProfile(prev => {
      const best = prev[pid];
      if (best == null || score > best) {
        if (auth) {
          fetch(`${API_BASE}/api/scores`, {
            method: "POST",
            headers: authHeaders(auth.token),
            body: JSON.stringify({ profileId: pid, score, breakdown }),
          }).catch(console.error);
        }
        return { ...prev, [pid]: score };
      }
      return prev;
    });
  }

  function resetForProfile() {
    setPhase(1);
    setUniversityTierPick(null);
    setLacTierPick(null);
    setSchoolSelections(new Set());
    setNoLacClaim(false);
    setFullProfile(null);
  }

  function goNextProfile() {
    setPhase(0);
    setProfileIdx(null);
  }

  function handleLockTier() {
    const p = profiles[profileIdx];
    fetch(`${API_BASE}/api/profiles/${p.id}`)
      .then(r => r.json())
      .then(data => { setFullProfile(data); setPhase(3); })
      .catch(() => setPhase(3));
  }

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

  if (!profiles) {
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
            <button className="btn-ghost" onClick={() => setShowLeaderboard(false)} aria-label="Back to applicant menu">
              <i className="ti ti-arrow-left" aria-hidden="true" /> Back
            </button>
            <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
              <i className="ti ti-logout" aria-hidden="true" /> Log out
            </button>
          </div>
        </header>
        <LeaderboardScreen username={auth.username} totalPoints={totalPoints} rank={rank} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <h1>Admissions <em>Oracle</em></h1>
        </div>
        <div className="row">
          <button className="btn-ghost" onClick={() => setShowLeaderboard(true)} aria-label="Open leaderboard">
            <i className="ti ti-trophy" aria-hidden="true" /> Leaderboard
          </button>
          {phase > 0 && profileIdx !== null && (
            <>
              <div className="phase-meta">
                <span>Case {String(profileIdx + 1).padStart(2, "0")} / {String(profiles.length).padStart(2, "0")}</span>
                <span className="dot" />
                <span>Phase {phase} / 4</span>
              </div>
              <button className="btn-ghost" onClick={goNextProfile} aria-label="Back to applicant menu">
                <i className="ti ti-list" aria-hidden="true" /> Menu
              </button>
            </>
          )}
          <RankChip rank={rank} totalPoints={totalPoints} />
          <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
            <i className="ti ti-logout" aria-hidden="true" /> Log out
          </button>
        </div>
      </header>

      {phase === 0 && (
        <Phase0Menu
          profiles={profiles}
          scoresByProfile={scoresByProfile}
          onSelectProfile={(idx) => {
            setProfileIdx(idx);
            resetForProfile();
          }}
        />
      )}

      {phase === 1 && profileIdx !== null && (
        <Phase1Profile profile={profile} profileIdx={profileIdx} profileCount={profiles.length} onStart={() => setPhase(2)} />
      )}
      {phase === 2 && profileIdx !== null && (
        <Phase2Tier
          profile={profile}
          universityTierPick={universityTierPick} setUniversityTierPick={setUniversityTierPick}
          lacTierPick={lacTierPick} setLacTierPick={setLacTierPick}
          noLacClaim={noLacClaim} setNoLacClaim={setNoLacClaim}
          onLock={handleLockTier}
          onBack={() => setPhase(1)}
        />
      )}
      {phase === 3 && profileIdx !== null && (
        <Phase3School
          profile={fullProfile || profile}
          universityTierPick={universityTierPick} lacTierPick={lacTierPick} noLacClaim={noLacClaim}
          schoolSelections={schoolSelections} setSchoolSelections={setSchoolSelections}
          onReveal={() => setPhase(4)} onBack={() => setPhase(2)}
        />
      )}
      {phase === 4 && profileIdx !== null && (
        <Phase4Results
          profile={fullProfile || profile}
          universityTierPick={universityTierPick} lacTierPick={lacTierPick} noLacClaim={noLacClaim}
          schoolSelections={schoolSelections} totalPoints={totalPoints} rank={rank}
          onCommitScore={commitScore} onTryAgain={resetForProfile}
          onNext={goNextProfile} hasNext={profileIdx + 1 < profiles.length}
        />
      )}
    </div>
  );
}

function LeaderboardScreen({ username, totalPoints, rank }) {
  const [rows, setRows] = React.useState(null);
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard`).then(r => r.json()),
      fetch(`${API_BASE}/api/stats`).then(r => r.json()),
    ]).then(([lb, st]) => { setRows(lb); setStats(st); }).catch(console.error);
  }, []);

  const RANK_NAMES = [
    { name: "Curious Observer", min: 0 },
    { name: "Application Reader", min: 30 },
    { name: "Junior Counselor", min: 80 },
    { name: "Senior Counselor", min: 150 },
    { name: "Dean of Admissions", min: 250 },
    { name: "Admissions Oracle", min: 400 },
  ];
  function rankTitle(pts) {
    let t = RANK_NAMES[0].name;
    for (const r of RANK_NAMES) if (pts >= r.min) t = r.name;
    return t;
  }

  return (
    <main className="fade-in" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <div className="stack" style={{ gap: "var(--sp-1)" }}>
            <span className="label">Logged in as <span className="accent-text">{username}</span></span>
            <span className="num" style={{ fontSize: "var(--fs-h2)", fontWeight: 700, lineHeight: 1 }}>{totalPoints} pts</span>
            <span className="muted">{rankTitle(totalPoints)}</span>
          </div>
          {stats && (
            <div className="row" style={{ gap: "var(--sp-5)" }}>
              <div className="metric" style={{ alignItems: "flex-end" }}>
                <span className="v">{stats.profileCount}</span>
                <span className="k">cases</span>
              </div>
              <div className="metric" style={{ alignItems: "flex-end" }}>
                <span className="v">{stats.uniquePlayers}</span>
                <span className="k">players</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">Standings</span>
          <h2>Global leaderboard</h2>
        </div>
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
          {rows.map((row, i) => {
            const isYou = row.username === username;
            const top3 = i < 3;
            return (
              <div
                key={row.username}
                className="row"
                style={{
                  padding: "var(--sp-3) var(--sp-5)",
                  borderBottom: i < rows.length - 1 ? "1px solid var(--border-1)" : "none",
                  background: isYou ? "var(--bg-info-subtle)" : "transparent",
                  flexWrap: "nowrap",
                  gap: "var(--sp-3)",
                }}
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
                <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{row.games} cases</span>
                <span className="num" style={{ fontWeight: 600 }}>{row.total} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
