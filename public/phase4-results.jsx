// Phase 4 — Results reveal (with celebration animations)

// Inject animation styles once
(function injectStyles() {
  if (document.getElementById('ao-celebrate-styles')) return;
  const s = document.createElement('style');
  s.id = 'ao-celebrate-styles';
  s.textContent = `
    @keyframes ao-pop-in {
      0%   { transform: scale(0.5); opacity: 0; }
      70%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes ao-confetti-fall {
      0%   { transform: translate(0, 0) rotate(0deg); opacity: 1; }
      100% { transform: translate(var(--cx), var(--cy)) rotate(var(--cr)); opacity: 0; }
    }
    @keyframes ao-shake-no {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-6px); }
      40%       { transform: translateX(6px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
    @keyframes ao-slide-up {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .ao-correct-row {
      animation: ao-pop-in 0.35s cubic-bezier(.34,1.56,.64,1) both;
    }
    .ao-wrong-row {
      animation: ao-shake-no 0.4s ease both;
    }
    .ao-result-row-animate {
      animation: ao-slide-up 0.3s ease both;
    }
    .confetti-piece {
      position: absolute;
      width: 8px; height: 8px;
      border-radius: 2px;
      animation: ao-confetti-fall 0.7s ease-out forwards;
      pointer-events: none;
    }
    .ao-celebrate-banner {
      animation: ao-pop-in 0.5s cubic-bezier(.34,1.56,.64,1) both;
    }
  `;
  document.head.appendChild(s);
})();


// ─── Confetti burst ───────────────────────────────────────────────────────────
function ConfettiBurst({ x, y, active }) {
  const [pieces, setPieces] = React.useState([]);

  React.useEffect(() => {
    if (!active) return;
    const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
    const newPieces = Array.from({ length: 14 }, (_, i) => {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 35 + Math.random() * 40;
      return {
        id: i,
        color: colors[i % colors.length],
        cx: Math.cos(angle) * dist + "px",
        cy: Math.sin(angle) * dist + "px",
        cr: (Math.random() * 360) + "deg",
        delay: Math.random() * 0.1,
      };
    });
    setPieces(newPieces);
    setTimeout(() => setPieces([]), 800);
  }, [active]);

  if (!pieces.length) return null;

  return (
    <div style={{ position: "absolute", top: y, left: x, pointerEvents: "none", zIndex: 100 }}>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            background: p.color,
            "--cx": p.cx,
            "--cy": p.cy,
            "--cr": p.cr,
            animationDelay: p.delay + "s",
            top: 0, left: 0,
          }}
        />
      ))}
    </div>
  );
}

// ─── Celebration banner ───────────────────────────────────────────────────────
function CelebrationBanner({ score, accuracy }) {
  if (score <= 5) return null;
  const isGreat = accuracy >= 80 || score >= 30;
  const isGood = accuracy >= 50 || score >= 15;
  if (!isGood) return null;

  return (
    <div className="ao-celebrate-banner" style={{
      background: isGreat ? "linear-gradient(135deg, #22c55e15, #3b82f615)" : "#f0fdf415",
      border: "1px solid " + (isGreat ? "#22c55e50" : "#86efac50"),
      borderRadius: 12, padding: "14px 18px", marginBottom: 14,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{ fontSize: 28 }}>{isGreat ? "🎯" : "🎉"}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>
          {isGreat ? "Sharp eye!" : "Nice work!"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
          {isGreat
            ? `${accuracy}% accuracy on admits — you read this profile well.`
            : `You caught ${score > 0 ? "+" + score : score} pts on this one.`}
        </div>
      </div>
    </div>
  );
}

// Phase 4 — Results reveal

function scoreFor(profile, universityTierPick, lacTierPick, schoolSelections, noLacClaim) {
  const T = window.TIERS;
  const admittedSet = new Set(T.getAdmittedSchools(profile).map(T.normSchool));

  const uniAvail = computeAvailable(profile, universityTierPick, "uni");
  const lacAvail = computeAvailable(profile, noLacClaim ? null : lacTierPick, "lac");
  const visible = [...uniAvail.all, ...lacAvail.all];

  const allLacAdmits = T.getAdmittedSchools(profile)
    .filter(s => T.schoolKind(s) === "lac");
  const hasAnyLacAdmit = allLacAdmits.length > 0;
  const declaredNoLac = !!noLacClaim;

  const rows = visible.map(s => {
    // Check if the school was selected. We don't override this with !declaredNoLac
    // because if declaredNoLac is true, lacAvail is empty and visible only contains Uni schools.
    const wasSelected = schoolSelections.has(s.key);
    const wasAdmit = admittedSet.has(s.key);
    
    // Determine if the tier band for this school is a hit or miss
    const kind = T.schoolKind(s.name);
    const isTierCorrect = (kind === "uni") ? uniAvail.hit : (kind === "lac" ? lacAvail.hit : false);
    
    let delta = 0, status;
    if (wasSelected && wasAdmit) { 
        delta = +10; 
        status = "correct"; 
    }
    else if (wasSelected && !wasAdmit) { 
        // Only deduct if tier band was correct
        delta = isTierCorrect ? -2 : 0; 
        status = "wrong"; 
    }
    else if (!wasSelected && wasAdmit) { 
        delta = 0;   
        status = "missed"; 
    }
    else { 
        delta = 0;  
        status = "skipped-rejected"; 
    }
    return { ...s, wasSelected, wasAdmit, delta, status };
  });

  // Tier-band bonuses — picking a band that contains an admit.
  const tierBonuses = [];
  if (universityTierPick && uniAvail.hit) tierBonuses.push({ kind: "University", delta: +10 });
  if (!declaredNoLac && lacTierPick && lacAvail.hit) tierBonuses.push({ kind: "LAC", delta: +10 });

  // Tier-band penalties — picking a band that contains none of the admits.
  const tierPenalties = [];
  if (universityTierPick && !uniAvail.hit) tierPenalties.push({ kind: "University", tier: universityTierPick, delta: -5 });
  if (!declaredNoLac && lacTierPick && !lacAvail.hit) {
    tierPenalties.push({ kind: "LAC", tier: lacTierPick, delta: -5 });
  }

  // "No LAC admit" claim — separate bonus / penalty row.
  const lacClaim = declaredNoLac
    ? (hasAnyLacAdmit
        ? { kind: "no-lac-wrong",   delta: -5, label: "Claimed no LAC admit — applicant did have LAC admits" }
        : { kind: "no-lac-correct", delta: +10, label: "Correctly identified no LAC admit" })
    : null;

  const baseScore = rows.reduce((acc, r) => acc + r.delta, 0);
  const tierBonusTotal = tierBonuses.reduce((acc, b) => acc + b.delta, 0);
  const tierPenaltyTotal = tierPenalties.reduce((acc, p) => acc + p.delta, 0);
  const claimDelta = lacClaim ? lacClaim.delta : 0;
  const score = baseScore + tierBonusTotal + tierPenaltyTotal + claimDelta;

  const correct = rows.filter(r => r.status === "correct").length;
  const totalAdmitsInView = rows.filter(r => r.wasAdmit).length;
  const accuracy = totalAdmitsInView === 0 ? 0 : Math.round((correct / totalAdmitsInView) * 100);

  return { rows, score, accuracy, uniAvail, lacAvail, tierBonuses, tierPenalties, lacClaim };
}

function Phase4Results({
  profile, universityTierPick, lacTierPick, noLacClaim, schoolSelections,
  totalPoints, rank, onCommitScore,
  onTryAgain, onNext, hasNext
}) {
  const T = window.TIERS;
  const { rows, score, accuracy, uniAvail, lacAvail, tierBonuses, tierPenalties, lacClaim } =
    useMemo(() =>
      scoreFor(profile, universityTierPick, lacTierPick, schoolSelections, noLacClaim),
      [profile, universityTierPick, lacTierPick, schoolSelections, noLacClaim]
    );

  // commit this profile's score on mount / when score recomputes for a new attempt
  const committed = useRef(false);
  useEffect(() => {
    if (committed.current) return;
    committed.current = true;
    onCommitScore && onCommitScore(profile.id, score);
  }, [profile.id, score]);

  const actualTier = profile.game_metadata.actual_school_tier;
  const finalDecision = profile.application_results.final_decision;

  // partition rows into university-section and LAC-section
  const uniKeys = new Set(uniAvail.all.map(a => a.key));
  const lacKeys = new Set(lacAvail.all.map(a => a.key));
  const uniRows = rows.filter(r => uniKeys.has(r.key));
  const lacRows = rows.filter(r => lacKeys.has(r.key));

  return (
    <div className="fade-in" data-screen-label="04 Reveal">
      <Stepper phase={4} />

      <ProfileCollapsedSummary profile={profile} onExpand={onTryAgain /* re-enter from top */} />

      <div className="section-head">
        <h2>The verdict</h2>
        <span className="sub">{profile.id}</span>
      </div>

      <CelebrationBanner score={score} accuracy={accuracy} />

      {/* Score cards */}
      <div className="grid grid-2 stagger" style={{ marginBottom: 18 }}>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div className="label">Points earned</div>
          <div className="score-pop" style={{ marginTop: 6, color: score < 0 ? "var(--accent-danger-fg)" : "var(--text-primary)" }}>
            <AnimatedNum value={score} format={n => {
              const r = Math.round(n);
              return (r > 0 ? "+" : "") + r;
            }} />
          </div>
        </div>
        <div className="card" style={{ padding: "20px 22px" }}>
          <div className="label">Accuracy</div>
          <div className="score-pop" style={{ marginTop: 6 }}>
            <AnimatedNum value={accuracy} format={n => Math.round(n) + "%"} />
          </div>
          <div className="label" style={{ color: "var(--text-tertiary)", marginTop: 6 }}>
            correct picks ÷ admits in your tier
          </div>
        </div>
      </div>

      {/* Tier result */}
      <div className="card stagger" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>Tier results</div>
        <TierResultRow
          kind="University"
          pick={universityTierPick}
          hit={uniAvail.hit}
          admits={uniAvail.all.filter(a => uniAvail.admitted.has(a.key)).map(a => a.name)}
          actualTier={actualTier}
        />
        <hr className="sep" />
        <TierResultRow
          kind="LAC"
          pick={noLacClaim ? "None claimed" : lacTierPick}
          hit={lacAvail.hit}
          admits={lacAvail.all.filter(a => lacAvail.admitted.has(a.key)).map(a => a.name)}
          actualTier={null}
        />
        {tierBonuses.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-1)" }}>
            {tierBonuses.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--accent-ok-fg)" }}>
                  <i className="ti ti-check" style={{ marginRight: 6 }} />
                  Correct {b.kind.toLowerCase()} tier
                </span>
                <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ok-fg)" }}>
                  +{b.delta}
                </span>
              </div>
            ))}
          </div>
        )}
        {tierPenalties.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-1)" }}>
            {tierPenalties.map((p, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--accent-danger-fg)" }}>
                  <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />
                  Wrong {p.kind.toLowerCase()} band — no admits in {p.tier}
                </span>
                <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-danger-fg)" }}>
                  {p.delta}
                </span>
              </div>
            ))}
          </div>
        )}
        {lacClaim && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: lacClaim.delta > 0 ? "var(--accent-ok-fg)" : "var(--accent-danger-fg)" }}>
                <i className={"ti ti-" + (lacClaim.delta > 0 ? "check" : "x")} style={{ marginRight: 6 }} />
                {lacClaim.label}
              </span>
              <span className="num" style={{ fontFamily: "var(--font-mono)", color: lacClaim.delta > 0 ? "var(--accent-ok-fg)" : "var(--accent-danger-fg)" }}>
                {lacClaim.delta > 0 ? "+" : ""}{lacClaim.delta}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* School breakdown */}
      {(uniRows.length + lacRows.length) > 0 && (
        <div className="card stagger" style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 8 }}>School-by-school</div>
          {uniRows.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 6, marginBottom: 4, color: "var(--text-tertiary)" }}>
                Universities · {universityTierPick}
              </div>
              <ResultGroup rows={uniRows} />
            </>
          )}
          {lacRows.length > 0 && (
            <>
              <div className="label" style={{ marginTop: 14, marginBottom: 4, color: "var(--text-tertiary)" }}>
                LACs · {lacTierPick}
              </div>
              <ResultGroup rows={lacRows} />
            </>
          )}
        </div>
      )}

      {/* Teaching points */}
      {profile.game_metadata.teaching_points && profile.game_metadata.teaching_points.length > 0 && (
        <div className="callout callout--teach stagger" style={{ marginBottom: 14, alignItems: "flex-start" }}>
          <i className="ti ti-bulb" />
          <div>
            <div className="label" style={{ color: "var(--accent-info-fg)", marginBottom: 6 }}>What this case teaches</div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {profile.game_metadata.teaching_points.map((p, i) =>
                <li key={i} style={{ margin: "4px 0" }}>{p}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Final banner */}
      <div className="final-banner fade-in">
        <span className="label">Enrolled at</span>
        <div className="school">{finalDecision.school}</div>
        <div className="date">Admitted on {formatDate(finalDecision.decision_date)}</div>
      </div>

      {/* Rank progress */}
      {rank && (
        <div className="card stagger" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
            <div className="label">Session ranking</div>
            <div className="label" style={{ color: "var(--text-tertiary)" }}>
              <span className="num">{totalPoints}</span> pts total
            </div>
          </div>
          <RankProgressBar rank={rank} totalPoints={totalPoints} />
          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <span className="label" style={{ color: "var(--text-tertiary)" }}>This case contributed</span>
            <span className="num" style={{ fontFamily: "var(--font-mono)", color: score < 0 ? "var(--accent-danger-fg)" : "var(--accent-ok-fg)" }}>
              {score > 0 ? "+" : ""}{score} pts
            </span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
        <Btn variant="ghost" onClick={onTryAgain} icon="rotate">Try again</Btn>
        <Btn onClick={onNext} disabled={!hasNext} iconRight="arrow-right">
          {hasNext ? "Next profile" : "All profiles played"}
        </Btn>
      </div>
    </div>
  );
}

function TierResultRow({ kind, pick, hit, admits, actualTier }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span className={"result-row " + ""}>
          <span className={"ico " + (hit ? "ok" : "miss")}>
            <i className={"ti ti-" + (hit ? "check" : "x")} />
          </span>
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{kind} tier — {pick}</div>
          <div className="label" style={{ marginTop: 2, color: "var(--text-tertiary)" }}>
            {hit ? "Hit · matched at least one admit" : "Miss · no admits in this tier"}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 360, textAlign: "right" }}>
        {hit ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {admits.map(s => <Badge key={s} kind="ok">{s}</Badge>)}
          </div>
        ) : (
          actualTier ? (
            <div className="label" style={{ color: "var(--text-tertiary)" }}>
              Actual tier · <span style={{ color: "var(--text-secondary)" }}>{actualTier}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

function ResultGroup({ rows }) {
  // Schools where something interesting happened: a pick (right or wrong),
  // or an admit the player missed. Everything else is a quiet skip — group
  // those into a single collapsed summary so the list stays scannable.
  const interesting = rows.filter(r => r.status !== "skipped-rejected");
  const quiet = rows.filter(r => r.status === "skipped-rejected");

  return (
    <div>
      {interesting.map(r => <ResultRow key={r.key} row={r} />)}
      {quiet.length > 0 && (
        <details className="collapsible" style={{ borderTop: interesting.length > 0 ? "0.5px solid var(--border-1)" : "none", marginTop: 4 }}>
          <summary>
            <i className="ti ti-chevron-down chev" />
            {quiet.length} other schools — correctly skipped
          </summary>
          <div className="body" style={{ padding: 0 }}>
            {quiet.map(r => <ResultRow key={r.key} row={r} />)}
          </div>
        </details>
      )}
    </div>
  );
}

function ResultRow({ row }) {
  let icoCls = "mid", icoIcon = "minus", note = "Skipped · was not admitted", deltaCls = "";
  if (row.status === "correct") { icoCls = "ok"; icoIcon = "check"; note = "Correct admit"; deltaCls = "plus"; }
  else if (row.status === "wrong") { icoCls = "bad"; icoIcon = "x"; note = "Wrong — applicant did not get in"; deltaCls = "minus"; }
  else if (row.status === "missed") { icoCls = "miss"; icoIcon = "minus"; note = "Missed · this was actually an admit"; }
  else { icoCls = "mid"; icoIcon = "minus"; note = "Skipped · was not admitted"; }

  const animClass = row.status === "correct" ? " ao-correct-row"
    : row.status === "wrong" ? " ao-wrong-row"
    : " ao-result-row-animate";

  const rowRef = React.useRef(null);
  const [burst, setBurst] = React.useState(false);

  React.useEffect(() => {
    if (row.status === "correct") {
      const t = setTimeout(() => setBurst(true), 100);
      return () => clearTimeout(t);
    }
  }, [row.status]);

  return (
    <div className={"result-row" + animClass} ref={rowRef} style={{ position: "relative", overflow: "visible" }}>
      {burst && rowRef.current && (
        <ConfettiBurst active={burst} x={14} y={14} />
      )}
      <span className={"ico " + icoCls}><i className={"ti ti-" + icoIcon} /></span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
        {window.SchoolLogo ? <SchoolLogo name={row.name} size={22} /> : null}
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{row.name}</div>
          <div className="label" style={{ marginTop: 2, color: "var(--text-tertiary)" }}>{note}</div>
        </div>
      </div>
      {row.wasAdmit ? <Badge kind="ok">Admit</Badge> : <Badge>Not admit</Badge>}
      <span className={"delta " + deltaCls}>
        {row.delta > 0 ? `+${row.delta}` : row.delta === 0 ? "0" : `${row.delta}`}
      </span>
    </div>
  );
}

function formatDate(isoLike) {
  if (!isoLike) return "";
  const parts = isoLike.split("-");
  if (parts.length !== 3) return isoLike;
  const [y, m, d] = parts.map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

Object.assign(window, { Phase4Results, scoreFor });
