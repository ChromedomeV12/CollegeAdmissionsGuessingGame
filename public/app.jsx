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

function Phase0Menu({ profiles, onSelectProfile, scoresByProfile }) {
  return (
    <div className="fade-in" data-screen-label="00 Menu">
      <div className="section-head">
        <h2>Select an Applicant</h2>
        <span className="sub">Choose a profile to evaluate.</span>
      </div>
      <div className="grid">
        {profiles.map((p, i) => {
          const score = scoresByProfile[p.id];
          const hasPlayed = score !== undefined;
          return (
            <div key={p.id} className="card school-card" onClick={() => onSelectProfile(i)}>
              <div>
                <div className="name">Applicant {String(i + 1).padStart(2, "0")} — {p.id}</div>
                <div className="label" style={{ marginTop: 2, color: "var(--text-tertiary)" }}>
                  {p.demographics?.gender || "Unknown"} · {p.demographics?.ethnicity || "Unknown"}
                </div>
              </div>
              <div>
                {hasPlayed ? (
                  <Badge kind={score > 0 ? "ok" : (score < 0 ? "danger" : "neutral")}>Score: {score}</Badge>
                ) : (
                  <Badge>Unplayed</Badge>
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
        if (window.PROFILES) setProfiles(window.PROFILES);
        else setError("Could not load profiles. Make sure the server is running.");
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
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>
      </div>
    );
  }

  if (!auth) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  if (error) {
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ maxWidth: 360, textAlign: "center", padding: "2rem" }}>
          <p style={{ fontSize: 13, color: "var(--text-danger)", marginBottom: 8 }}>{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!profiles) {
    return (
      <div className="app-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading profiles…</p>
      </div>
    );
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowLeaderboard(false)}>← Back</button>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={handleLogout}>Log out</button>
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setShowLeaderboard(true)}>
            <i className="ti ti-trophy" aria-hidden="true" /> Leaderboard
          </button>
          {phase > 0 && profileIdx !== null && (
            <>
              <div className="phase-meta">
                <span>Case {String(profileIdx + 1).padStart(2, "0")} / {String(profiles.length).padStart(2, "0")}</span>
                <span className="dot" />
                <span>Phase {phase} / 4</span>
              </div>
              <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={goNextProfile}>
                <i className="ti ti-list" aria-hidden="true" /> Menu
              </button>
            </>
          )}
          <RankChip rank={rank} totalPoints={totalPoints} />
          <button className="btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={handleLogout}>
            Log out
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
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>
              Logged in as <strong>{username}</strong>
            </p>
            <p style={{ fontSize: 28, fontWeight: 700 }}>{totalPoints} pts</p>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{rankTitle(totalPoints)}</p>
          </div>
          {stats && (
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 20, fontWeight: 600 }}>{stats.profileCount}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>cases</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 20, fontWeight: 600 }}>{stats.uniquePlayers}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>players</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>Global leaderboard</h2>
      {!rows && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Loading…</p>}
      {rows && rows.length === 0 && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No scores yet — be the first!</p>}
      {rows && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {rows.map((row, i) => {
            const isYou = row.username === username;
            return (
              <div key={row.username} style={{
                display: "flex", alignItems: "center",
                padding: "10px 1.25rem",
                borderBottom: i < rows.length - 1 ? "0.5px solid var(--border-light)" : "none",
                background: isYou ? "var(--bg-info-subtle)" : "transparent",
                gap: 12,
              }}>
                <span style={{ width: 24, fontSize: 13, fontWeight: 600, color: i < 3 ? "var(--text-warning)" : "var(--text-tertiary)", textAlign: "right", flexShrink: 0 }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: isYou ? 600 : 400 }}>
                  {row.username}
                  {isYou && <span style={{ fontSize: 11, color: "var(--text-info)", marginLeft: 6 }}>you</span>}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{row.games} cases</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{row.total} pts</span>
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
