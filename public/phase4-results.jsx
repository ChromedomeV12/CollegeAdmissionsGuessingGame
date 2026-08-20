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
  const isGreat = score >= 80;
  const isGood = score >= 60;
  if (!isGood) return null;

  return (
    <div className="ao-celebrate-banner" style={{
      background: isGreat
        ? "linear-gradient(135deg, var(--accent-ok-bg), var(--accent-info-bg))"
        : "var(--accent-ok-bg)",
      border: "1px solid var(--accent-ok-bd)",
      borderRadius: "var(--r-lg)", padding: "var(--sp-4) var(--sp-5)", marginBottom: "var(--sp-4)",
      display: "flex", alignItems: "center", gap: "var(--sp-3)",
    }}>
      <span style={{ fontSize: "var(--fs-h2)", lineHeight: 1 }}>{isGreat ? "🎯" : "🎉"}</span>
      <div>
        <div style={{ fontSize: "var(--fs-md)", fontWeight: 600, color: "var(--accent-ok-fg)" }}>
          {isGreat ? "Sharp eye!" : "Nice work!"}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-tertiary)", marginTop: "var(--sp-1)" }}>
          {isGreat
            ? `${accuracy}% accuracy on admits — you read this profile well.`
            : `You scored ${score}/100 on this case.`}
        </div>
      </div>
    </div>
  )
}

// Phase 4 — Results reveal

function scoreFor(profile, universityTierPick, lacTierPick, schoolSelections, noUniClaim, noLacClaim) {
  const T = window.TIERS;
  const evaluator = window.GAME_SCORE;
  if (!evaluator?.evaluate) throw new Error("Shared game scorer is unavailable");

  const uniAvail = computeAvailable(profile, noUniClaim ? null : universityTierPick, "uni");
  const lacAvail = computeAvailable(profile, noLacClaim ? null : lacTierPick, "lac");
  const visible = [...uniAvail.all, ...lacAvail.all];
  const admittedSet = new Set(T.getAdmittedSchools(profile).map(T.normSchool));
  const rows = visible.map(school => {
    const wasSelected = schoolSelections.has(school.key);
    const wasAdmit = admittedSet.has(school.key);
    let status = "skipped-rejected";
    if (wasSelected && wasAdmit) status = "correct";
    else if (wasSelected) status = "wrong";
    else if (wasAdmit) status = "missed";
    return { ...school, wasSelected, wasAdmit, delta: 0, status };
  });

  // Practice feedback deliberately uses the exact evaluator loaded by the
  // server. Equal timestamps disable the time adjustment for an unrecorded run.
  const untimed = new Date(0).toISOString();
  const scored = evaluator.evaluate(profile, {
    universityTierPick: noUniClaim ? null : universityTierPick,
    lacTierPick: noLacClaim ? null : lacTierPick,
    noUniClaim: !!noUniClaim,
    noLacClaim: !!noLacClaim,
    schoolSelections: [...schoolSelections],
  }, untimed, untimed);
  function actualBandIndex(tierList, kind) {
    for (let index = 0; index < tierList.length; index += 1) {
      if (T.getSchoolsInTier(tierList[index], kind).some(school => admittedSet.has(school.key))) return index;
    }
    return -1;
  }
  const uniActualIdx = actualBandIndex(T.UNI_TIER_LIST, "uni");
  const lacActualIdx = actualBandIndex(T.LAC_TIER_LIST, "lac");
  const hasUniAdmit = uniActualIdx >= 0;
  const hasLacAdmit = lacActualIdx >= 0;

  return {
    rows,
    score: scored.score,
    accuracy: scored.accuracy,
    uniPts: scored.uniPts,
    lacPts: scored.lacPts,
    selectionPts: scored.selectionPts,
    hasUniAdmit,
    hasLacAdmit,
    uniAvail,
    lacAvail,
    uniActualIdx,
    lacActualIdx,
  };
}

function Phase4Results({
  profile, universityTierPick, lacTierPick, noUniClaim, noLacClaim, schoolSelections,
  average, rank, result: serverResult, retryDeadline, scoringFinalized,
  onTryAgain, onRetry, onFinalizeScoring, onNext, hasNext,
  isPractice
}) {
  const showDetails = !!isPractice || !!scoringFinalized;
  const feedback = useMemo(() => {
    if (showDetails) {
      return scoreFor(profile, universityTierPick, lacTierPick, schoolSelections, noUniClaim, noLacClaim);
    }
    const unavailable = { all: [], admitted: new Set(), hit: false };
    return {
      rows: [], score: 0, accuracy: 0, uniPts: 0, lacPts: 0, selectionPts: 0,
      hasUniAdmit: false, hasLacAdmit: false, uniAvail: unavailable, lacAvail: unavailable,
    };
  }, [showDetails, profile, universityTierPick, lacTierPick, schoolSelections, noUniClaim, noLacClaim]);
  const practiceResult = isPractice ? {
    score: feedback.score,
    rawScore: feedback.score,
    accuracy: feedback.accuracy,
    uniPts: feedback.uniPts,
    lacPts: feedback.lacPts,
    selectionPts: feedback.selectionPts,
    timeSeconds: null,
    timeFactor: 1,
  } : null;
  const result = isPractice ? practiceResult : serverResult;
  const {
    rows, uniAvail, lacAvail, hasUniAdmit, hasLacAdmit,
  } = feedback;
  const finalScore = result?.score ?? 0;
  const accuracy = result?.accuracy ?? 0;
  const uniPts = result?.uniPts ?? 0;
  const lacPts = result?.lacPts ?? 0;
  const selectionPts = result?.selectionPts ?? 0;
  const elapsedSeconds = isPractice ? null : result?.timeSeconds;
  const timeMult = isPractice ? 1 : (result?.timeFactor ?? 1);
  const firstScoringReveal = !isPractice && !scoringFinalized;
  const [retryLeft, setRetryLeft] = React.useState(() => {
    const deadline = Date.parse(retryDeadline || "");
    return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
  });
  const actionRequested = React.useRef(false);

  React.useEffect(() => {
    if (!firstScoringReveal) return;
    function updateCountdown() {
      const deadline = Date.parse(retryDeadline || "");
      setRetryLeft(Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 200);
    return () => clearInterval(timer);
  }, [firstScoringReveal, retryDeadline]);

  React.useEffect(() => {
    if (!firstScoringReveal || retryLeft > 0 || actionRequested.current) return;
    actionRequested.current = true;
    Promise.resolve(onFinalizeScoring && onFinalizeScoring());
  }, [firstScoringReveal, retryLeft, onFinalizeScoring]);

  async function handleScoringRetry() {
    if (actionRequested.current || retryLeft <= 0) return;
    actionRequested.current = true;
    const reserved = await (onRetry && onRetry());
    if (reserved === false) actionRequested.current = false;
  }

  const actualTier = profile.game_metadata?.actual_school_tier;
  const finalDecision = profile.application_results?.final_decision;

  // Partition feedback rows into university and LAC sections. These rows are
  // rendered only after the lock authorizes the full profile.
  const uniKeys = new Set(uniAvail.all.map(a => a.key));
  const lacKeys = new Set(lacAvail.all.map(a => a.key));
  const uniRows = rows.filter(r => uniKeys.has(r.key));
  const lacRows = rows.filter(r => lacKeys.has(r.key));

  return (
    <div className="fade-in" data-screen-label="04 Reveal">
      <Stepper phase={4} />

      {showDetails && <ProfileCollapsedSummary profile={profile} onExpand={onTryAgain} />}

      <div className="section-head">
        <h2>The verdict</h2>
        <span className="sub">{profile.id}</span>
      </div>
      {isPractice && (
        <div className="callout" role="status" style={{ marginBottom: "var(--sp-4)" }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <div><strong>Practice feedback</strong> · not recorded and does not affect your score.</div>
        </div>
      )}


      {showDetails && <CelebrationBanner score={Math.round(finalScore)} accuracy={accuracy} />}

      {/* Score cards */}
      <div className="grid grid-2 stagger" style={{ marginBottom: "var(--sp-5)" }}>
        <div className="card" style={{ padding: "var(--sp-5) var(--sp-6)" }}>
          <div className="label">{isPractice ? "Practice score" : "Case score"}</div>
          <div className="score-pop" style={{ marginTop: "var(--sp-2)", color: "var(--text-primary)" }}>
            <AnimatedNum value={Math.round(finalScore)} format={n => String(Math.round(n))} />
          </div>
          <div className="label" style={{ color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
            {isPractice ? "feedback only · out of 100" : <>from this profile · out of 100{timeMult < 1 ? " · after time adjustment" : ""}</>}
          </div>
        </div>
        <div className="card" style={{ padding: "var(--sp-5) var(--sp-6)" }}>
          <div className="label">Accuracy</div>
          <div className="score-pop" style={{ marginTop: "var(--sp-2)" }}>
            <AnimatedNum value={accuracy} format={n => Math.round(n) + "%"} />
          </div>
          <div className="label" style={{ color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
            selection overlap with admits in view
          </div>
        </div>
        {!isPractice && (
          <div className="card" style={{ padding: "var(--sp-5) var(--sp-6)" }}>
            <div className="label">Time</div>
            <div className="score-pop" style={{ marginTop: "var(--sp-2)" }}>
              {`${elapsedSeconds}s`}
            </div>
            <div className="label" style={{ color: "var(--text-tertiary)", marginTop: "var(--sp-2)" }}>
              {`Score multiplier ×${timeMult.toFixed(2)}`}
            </div>
          </div>
        )}
      </div>

      {showDetails && <>
      {/* Tier result */}
      <div className="card stagger" style={{ marginBottom: "var(--sp-4)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-3)" }}>Tier results</div>
        <TierResultRow
          kind="University"
          pick={noUniClaim ? "Applicant was not admitted to any T50 University" : universityTierPick}
          hit={noUniClaim ? !hasUniAdmit : uniAvail.hit}
          admits={uniAvail.all.filter(a => uniAvail.admitted.has(a.key)).map(a => a.name)}
          actualTier={actualTier}
        />
        <hr className="sep" />
        <TierResultRow
          kind="LAC"
          pick={noLacClaim ? "Applicant was not admitted to any T20 LAC" : lacTierPick}
          hit={noLacClaim ? !hasLacAdmit : lacAvail.hit}
          admits={lacAvail.all.filter(a => lacAvail.admitted.has(a.key)).map(a => a.name)}
          actualTier={null}
        />
        {/* Points breakdown — three non-negative components (0..100 total).
            Replaces the old tierBonuses / tierPenalties / lacClaim +/- rows. */}
        <div style={{ marginTop: "var(--sp-3)", paddingTop: "var(--sp-3)", borderTop: "0.5px solid var(--border-1)" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", fontSize: "var(--fs-base)", padding: "var(--sp-1) 0" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <i className="ti ti-target-arrow" style={{ marginRight: 6 }} />
              {noUniClaim ? "Applicant was not admitted to any T50 University" : "Reach · university tier"}
            </span>
            <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ok-fg)" }}>
              +{uniPts}
            </span>
          </div>
          {noUniClaim && (
            <div className="label" style={{ color: "var(--text-tertiary)", padding: "var(--sp-1) 0 var(--sp-2)" }}>
              {hasUniAdmit
                ? "Claim was incorrect — applicant had a top-50 university admit"
                : "Correctly identified no top-50 university admit"}
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", fontSize: "var(--fs-base)", padding: "var(--sp-1) 0" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <i className="ti ti-building-monument" style={{ marginRight: 6 }} />
              {noLacClaim ? "Applicant was not admitted to any T20 LAC" : "LAC tier"}
            </span>
            <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ok-fg)" }}>
              +{lacPts}
            </span>
          </div>
          {noLacClaim && (
            <div className="label" style={{ color: "var(--text-tertiary)", padding: "var(--sp-1) 0 var(--sp-2)" }}>
              {hasLacAdmit
                ? "Claim was incorrect — applicant had a top-20 LAC admit"
                : "Correctly identified no top-20 LAC admit"}
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", fontSize: "var(--fs-base)", padding: "var(--sp-1) 0" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <i className="ti ti-checks" style={{ marginRight: 6 }} />
              Selection · admit overlap
            </span>
            <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ok-fg)" }}>
              +{selectionPts}
            </span>
          </div>
          {elapsedSeconds != null && (
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", fontSize: "var(--fs-base)", padding: "var(--sp-1) 0" }}>
              <span style={{ color: "var(--text-secondary)" }}>
                <i className="ti ti-clock" style={{ marginRight: 6 }} />
                Time · {elapsedSeconds}s
              </span>
              <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
                ×{timeMult.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* School breakdown */}
      {(uniRows.length + lacRows.length) > 0 && (
        <div className="card stagger" style={{ marginBottom: "var(--sp-4)" }}>
          <div className="label" style={{ marginBottom: "var(--sp-2)" }}>School-by-school</div>
          {uniRows.length > 0 && (
            <>
              <div className="label" style={{ marginTop: "var(--sp-2)", marginBottom: "var(--sp-1)", color: "var(--text-tertiary)" }}>
                Universities · {universityTierPick}
              </div>
              <ResultGroup rows={uniRows} />
            </>
          )}
          {lacRows.length > 0 && (
            <>
              <div className="label" style={{ marginTop: "var(--sp-4)", marginBottom: "var(--sp-1)", color: "var(--text-tertiary)" }}>
                LACs · {lacTierPick}
              </div>
              <ResultGroup rows={lacRows} />
            </>
          )}
        </div>
      )}

      {/* Teaching points */}
      {(profile.game_metadata?.teaching_points || []).length > 0 && (
        <div className="callout callout--teach stagger" style={{ marginBottom: "var(--sp-4)", alignItems: "flex-start" }}>
          <i className="ti ti-bulb" />
          <div>
            <div className="label" style={{ color: "var(--accent-info-fg)", marginBottom: "var(--sp-2)" }}>What this case teaches</div>
            <ul style={{ margin: 0, paddingLeft: "var(--sp-4)" }}>
              {profile.game_metadata.teaching_points.map((p, i) =>
                <li key={i} style={{ margin: "var(--sp-1) 0" }}>{p}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Final banner */}
      <div className="final-banner fade-in">
        <span className="stamp-mark" aria-hidden="true">Admitted</span>
        <span className="label">Enrolled at</span>
        <div className="school">{finalDecision?.school ?? "—"}</div>
        <div className="date">Admitted on {formatDate(finalDecision?.decision_date)}</div>
      </div>

      {!isPractice && rank && (
        <div className="card stagger" style={{ marginTop: "var(--sp-4)" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
            <div className="label">Overall ranking</div>
            <span className="badge badge--neutral" style={{ fontFamily: "var(--font-mono)" }}>
              <span className="num">{average ?? 0}</span> avg · current average
            </span>
          </div>
          <RankProgressBar rank={rank} totalPoints={average ?? 0} />
          <div className="row" style={{ marginTop: "var(--sp-4)", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            <span className="label" style={{ color: "var(--text-tertiary)" }}>This case contributed</span>
            <span className="num" style={{ fontFamily: "var(--font-mono)", color: "var(--accent-ok-fg)" }}>
              {Math.round(finalScore)}/100
            </span>
          </div>
        </div>
      )}
      </>}

      {showDetails ? (
        <div className="row" style={{ justifyContent: "space-between", marginTop: "var(--sp-6)" }}>
          <Btn variant="ghost" onClick={onTryAgain} icon="rotate">Try again</Btn>
          <Btn onClick={onNext} disabled={!hasNext} iconRight="arrow-right">
            {hasNext ? "Next profile" : "All profiles played"}
          </Btn>
        </div>
      ) : firstScoringReveal && retryLeft > 0 ? (
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "var(--sp-6)" }}>
          <Btn variant="ghost" onClick={handleScoringRetry} icon="refresh" testId="retry-case">Retry case ({retryLeft}s)</Btn>
        </div>
      ) : null}
    </div>
  );
}

function TierResultRow({ kind, pick, hit, admits, actualTier }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: "var(--sp-4)", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div className="row" style={{ gap: "var(--sp-3)", alignItems: "center", flexWrap: "nowrap" }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: "var(--fs-base)", flexShrink: 0,
          background: hit ? "var(--accent-ok-bg)" : "var(--accent-warn-bg)",
          color: hit ? "var(--accent-ok-fg)" : "var(--accent-warn-fg)",
        }}>
          <i className={"ti ti-" + (hit ? "check" : "x")} />
        </span>
        <div>
          <div style={{ fontSize: "var(--fs-md)", fontWeight: 500 }}>{kind} tier — {pick}</div>
          <div className="label" style={{ marginTop: "var(--sp-1)", color: "var(--text-tertiary)" }}>
            {hit ? "Hit · matched at least one admit" : "Miss · no admits in this tier"}
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 360, textAlign: "right" }}>
        {hit ? (
          <div className="row" style={{ gap: "var(--sp-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
        <details className="collapsible" style={{ borderTop: interesting.length > 0 ? "0.5px solid var(--border-1)" : "none", marginTop: "var(--sp-1)" }}>
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
      <div className="row" style={{ alignItems: "center", gap: "var(--sp-2)", flex: 1, minWidth: 0, flexWrap: "nowrap" }}>
        {window.SchoolLogo ? <SchoolLogo name={row.name} size={22} /> : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-base)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
          <div className="label" style={{ marginTop: "var(--sp-1)", color: "var(--text-tertiary)" }}>{note}</div>
        </div>
      </div>
      {row.wasAdmit ? <Badge kind="ok">Admit</Badge> : <Badge>Not admit</Badge>}
      <span className={"delta " + deltaCls} style={{ fontVariantNumeric: "tabular-nums", textAlign: "right", minWidth: "3ch" }}>
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
