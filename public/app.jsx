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
                <span className="check" aria-hidden="true">
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
  const [noLacClaim, setNoLacClaim] = React.useState(false);
  const [scoresByProfile, setScoresByProfile] = React.useState({});
  const [showLeaderboard, setShowLeaderboard] = React.useState(false);
  const [showSubmission, setShowSubmission] = React.useState(() => new URLSearchParams(window.location.search).has("submission_status"));
  const [fullProfile, setFullProfile] = React.useState(null);
  // Timestamp (ms) of the last phase1→phase2 transition; phase 4 measures the
  // reveal-time guess duration against it for the time factor. Null in menu.
  const [guessStartAt, setGuessStartAt] = React.useState(null);
  // Practice-only profiles (retry window expired or case abandoned). Scores
  // for these ids are neither POSTed nor counted locally.
  const [lockedProfiles, setLockedProfiles] = React.useState(new Set());
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

  // Practice-only locks for this user, fetched once per session.
  React.useEffect(() => {
    if (!auth) return;
    fetch(`${API_BASE}/api/locks`, { headers: authHeaders(auth.token) })
      .then(r => (r.ok ? r.json() : []))
      .then(ids => { if (Array.isArray(ids)) setLockedProfiles(new Set(ids)); })
      .catch(() => {});
  }, [auth]);
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
    setGuessStartAt(null);
    setLockedProfiles(new Set());
  }

  function commitScore(pid, score, breakdown) {
    // Practice-only profiles: scores no longer count, locally or server-side.
    if (lockedProfiles.has(pid)) return;
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

  // Mark a profile practice-only: local badge state immediately, server upsert
  // fire-and-forget. Permanent per (user, profile) — server upserts on repost.
  function lockProfile(pid) {
    if (!pid || lockedProfiles.has(pid)) return;
    setLockedProfiles(prev => new Set(prev).add(pid));
    if (auth) {
      fetch(`${API_BASE}/api/locks`, {
        method: "POST",
        headers: authHeaders(auth.token),
        body: JSON.stringify({ profileId: pid }),
      }).catch(console.error);
    }
  }

  function resetForProfile() {
    setPhase(1);
    setUniversityTierPick(null);
    setLacTierPick(null);
    setSchoolSelections(new Set());
    setNoLacClaim(false);
    setFullProfile(null);
  }

  // Retry within the 5s window: same case, cleared picks, straight back to
  // tier selection, fresh guess timer. Explicitly does NOT lock the profile.
  function handleRetry() {
    setUniversityTierPick(null);
    setLacTierPick(null);
    setSchoolSelections(new Set());
    setNoLacClaim(false);
    setFullProfile(null);
    setGuessStartAt(Date.now());
    setPhase(2);
  }

  function goNextProfile() {
    // Leaving a case for the menu (topbar Menu or Next profile) forfeits the
    // retry window — the profile becomes practice-only.
    if (profileIdx !== null && profiles && profiles[profileIdx]) {
      lockProfile(profiles[profileIdx].id);
    }
    setPhase(0);
    setProfileIdx(null);
    setGuessStartAt(null);
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

  if (showSubmission) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <h1>Admissions <em>Oracle</em></h1>
          </div>
          <div className="row">
            <button className="btn-ghost" onClick={() => setShowSubmission(false)} aria-label="Back to applicant menu">
              <i className="ti ti-arrow-left" aria-hidden="true" /> Game
            </button>
            <button className="btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">
              <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
            </button>
            <AvgRankChip rank={rank} average={average} />
            <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
              <i className="ti ti-logout" aria-hidden="true" /> Log out
            </button>
          </div>
        </header>
        <SubmissionScreen token={auth.token} onBack={() => setShowSubmission(false)} />
      </div>
    );
  }

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
            <button className="btn-ghost" onClick={() => { setShowLeaderboard(false); setShowSubmission(true); }} aria-label="Submit your Reddit post">
              <i className="ti ti-file-upload" aria-hidden="true" /> Submit a post
            </button>
            <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
              <i className="ti ti-logout" aria-hidden="true" /> Log out
            </button>
          </div>
        </header>
        <LeaderboardScreen username={auth.username} average={average} rank={rank} token={auth.token} />
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
          <button className="btn-ghost" onClick={() => setShowSubmission(true)} aria-label="Submit your Reddit post">
            <i className="ti ti-file-upload" aria-hidden="true" /> Submit a post
          </button>
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
          <button className="btn-ghost" onClick={toggleTheme} aria-label="Toggle theme">
            <i className={`ti ti-${theme === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
          </button>
          <AvgRankChip rank={rank} average={average} />
          <button className="btn-ghost" onClick={handleLogout} aria-label="Log out">
            <i className="ti ti-logout" aria-hidden="true" /> Log out
          </button>
        </div>
      </header>

      {phase === 0 && (
        <Phase0Menu
          profiles={profiles}
          scoresByProfile={scoresByProfile}
          lockedProfiles={lockedProfiles}
          onSelectProfile={(idx) => {
            setProfileIdx(idx);
            resetForProfile();
          }}
        />
      )}

      {phase === 1 && profileIdx !== null && (
        <Phase1Profile profile={profile} profileIdx={profileIdx} profileCount={profiles.length} onStart={() => { setGuessStartAt(Date.now()); setPhase(2); }} />
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
          schoolSelections={schoolSelections} average={average} rank={rank}
          guessStartAt={guessStartAt}
          onCommitScore={commitScore} onTryAgain={resetForProfile}
          onRetry={handleRetry}
          onRetryExpired={() => { if (profile) lockProfile(profile.id); }}
          onNext={goNextProfile} hasNext={profileIdx + 1 < profiles.length}
        />
      )}
    </div>
  );
}

function LeaderboardScreen({ username, average, rank, token }) {
  const [rows, setRows] = React.useState(null);
  // undefined = seasons not loaded yet; null = seasonless fetch (fallback);
  // string = explicit season id.
  const [seasons, setSeasons] = React.useState(null);
  const [season, setSeason] = React.useState(undefined);
  const [rivals, setRivals] = React.useState(null);
  const [rivalInput, setRivalInput] = React.useState("");
  const [rivalError, setRivalError] = React.useState(null);
  const [duel, setDuel] = React.useState(null);

  React.useEffect(() => {
    fetch(`${API_BASE}/api/seasons`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data?.seasons) ? data.seasons : [];
        setSeasons(list);
        setSeason(prev => prev ?? data?.current ?? (list[0] && list[0].id) ?? null);
      })
      .catch(err => {
        console.error(err);
        setSeasons([]);
        setSeason(prev => prev ?? null);
      });
  }, []);

  React.useEffect(() => {
    if (season === undefined) return;
    setRows(null);
    const url = season
      ? `${API_BASE}/api/leaderboard?season=${encodeURIComponent(season)}`
      : `${API_BASE}/api/leaderboard`;
    fetch(url)
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  }, [season]);

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
        <div className="row" style={{ gap: "var(--sp-3)", alignItems: "center", flexWrap: "nowrap" }}>
          {seasons && seasons.length > 0 && (
            <select aria-label="Season" value={season ?? ""} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
          <span className="muted" style={{ fontSize: "var(--fs-sm)", whiteSpace: "nowrap" }}>≥ 5 cases to qualify</span>
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
          <div className="row" style={{ padding: "var(--sp-2) var(--sp-5)", borderBottom: "1px solid var(--border-1)", flexWrap: "nowrap", gap: "var(--sp-3)", color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
            <span style={{ minWidth: 30, textAlign: "center" }}>Rank</span>
            <span className="grow">Player</span>
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
                <span className="num" style={{ fontWeight: 600 }}>{row.avg} avg</span>
                <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{row.games}</span>
                <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>{row.best}</span>
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
            value={rivalInput}
            onChange={(e) => setRivalInput(e.target.value)}
            placeholder="Add a rival by username"
            aria-label="Rival username"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Btn onClick={addRival} icon="user-plus" disabled={!rivalInput.trim()}>Add rival</Btn>
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
                <Btn variant="ghost" onClick={() => openDuel(r.username)} iconRight="arrow-right">Duel</Btn>
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
              <div className="row" style={{ padding: "var(--sp-2) var(--sp-5)", borderBottom: "1px solid var(--border-1)", flexWrap: "nowrap", gap: "var(--sp-3)", color: "var(--text-tertiary)", fontSize: "var(--fs-xs)" }}>
                <span className="grow">Case</span>
                <span style={{ minWidth: 44, textAlign: "right" }}>You</span>
                <span style={{ minWidth: 44, textAlign: "right" }}>{duel.username}</span>
              </div>
              {duel.data.common.map((c, i) => {
                const youWin = c.you > c.them;
                const theyWin = c.them > c.you;
                return (
                  <div
                    key={c.profileId}
                    className="row"
                    style={{
                      padding: "var(--sp-3) var(--sp-5)",
                      borderBottom: i < duel.data.common.length - 1 ? "1px solid var(--border-1)" : "none",
                      flexWrap: "nowrap",
                      gap: "var(--sp-3)",
                    }}
                  >
                    <span className="grow" style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.profileId}</span>
                    <span className="num" style={{ minWidth: 44, textAlign: "right", fontWeight: youWin ? 700 : 400, color: youWin ? "var(--accent-ok-fg)" : "inherit" }}>{c.you}</span>
                    <span className="num" style={{ minWidth: 44, textAlign: "right", fontWeight: theyWin ? 700 : 400, color: theyWin ? "var(--accent-danger-fg)" : "inherit" }}>{c.them}</span>
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
root.render(<App />);
