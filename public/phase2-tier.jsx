// Phase 2 — Tier selection

function ProfileCollapsedSummary({ profile, onExpand }) {
  const d = profile.demographics || {};
  const sat = profile.test_scores?.sat;
  const act = profile.test_scores?.act;
  const test = sat ? `SAT ${sat.superscore_total ?? "—"}` : (act ? `ACT ${act.composite ?? "—"}` : "Test-optional");
  return (
    <div className="profile-collapsed-summary">
      <div className="row">
        <div className="who">{profile.id}</div>
        <div className="row" style={{ gap: "var(--sp-1)" }}>
          <span className="chip">{d.gender || <span className="muted">—</span>}</span>
          <span className="chip">{d.ethnicity || <span className="muted">—</span>}</span>
          <span className="chip">{d.ses || <span className="muted">—</span>}</span>
          <span className="chip">{test}</span>
          <span className="chip">GPA {profile.academic_profile?.gpa?.unweighted ?? <span className="muted">—</span>}</span>
          <span className="chip">{profile.academic_profile?.course_rigor?.total_ap_courses ?? 0} APs</span>
        </div>
      </div>
      <button className="btn btn--ghost" onClick={onExpand}>
        <i className="ti ti-eye" style={{ fontSize: "var(--fs-md)" }} /> Review profile
      </button>
    </div>
  );
}

// Informational per-phase countdown for the time-bonus window.
// Display only — actual scoring uses the app-level guessStartAt timer.
function TimeBonusChip() {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const state = elapsed <= 30 ? "full" : elapsed >= 120 ? "floor" : "shrinking";
  const kind = state === "full" ? "warn" : state === "shrinking" ? "info" : "neutral";
  const fade = state === "full" ? 1 : Math.max(0.55, 1 - 0.45 * (elapsed - 30) / 90);
  return (
    <span style={{ marginLeft: "auto", opacity: fade, transition: "opacity .6s" }}>
      <Badge kind={kind} icon="clock">Time bonus · {state}</Badge>
    </span>
  );
}

function Phase2Tier({
  profile,
  universityTierPick, setUniversityTierPick,
  lacTierPick, setLacTierPick,
  noUniClaim, setNoUniClaim,
  noLacClaim, setNoLacClaim,
  onLock, onBack
}) {
  const T = window.TIERS;

  return (
    <div className="fade-in" data-screen-label="02 Tier">
      <Stepper phase={2} />

      <ProfileCollapsedSummary profile={profile} onExpand={onBack} />

      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">Step 02</span>
          <h2>Predict the ceiling</h2>
        </div>
        <span className="sub">Pick one university outcome and one LAC outcome.</span>
        <TimeBonusChip />
      </div>

      <div className="callout" style={{ marginBottom: "var(--sp-4)" }}>
        <i className="ti ti-info-circle" />
        <div>
          Tiers are bands, not ranges — T10 means ranks 6-10 only, T20 means 11-20, and so on. Pick the band you think this applicant landed in. Your choices unlock the school list — pick carefully.
        </div>
      </div>

      <div className="card stagger" style={{ marginBottom: "var(--sp-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
          <span className="label">Panel A · University tier</span>
          <span className="chip">1 of 5</span>
        </div>
        <div className="tier-grid tier-grid--uni" aria-disabled={noUniClaim}>
          {T.UNI_TIER_LIST.map(t => (
            <TierPickCard
              key={t}
              label={t}
              sublabel={T.TIER_RANGE[t]}
              active={!noUniClaim && universityTierPick === t}
              onClick={() => {
                setUniversityTierPick(t === universityTierPick ? null : t);
                setNoUniClaim(false);
              }}
            />
          ))}
        </div>
        <ClaimCard
          active={noUniClaim}
          label="Applicant was not admitted to any T50 University"
          hint="Claim this if the profile had zero admits in every configured top-50 university band."
          onToggle={() => {
            setNoUniClaim(!noUniClaim);
            if (!noUniClaim) setUniversityTierPick(null);
          }}
        />
      </div>

      <div className="card stagger" style={{ marginBottom: "var(--sp-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
          <span className="label">Panel B · Liberal Arts College tier</span>
          <span className="chip">1 of 3</span>
        </div>
        <div className="tier-grid tier-grid--lac" aria-disabled={noLacClaim}>
          {T.LAC_TIER_LIST.map(t => (
            <TierPickCard
              key={t}
              label={t}
              sublabel={T.TIER_RANGE[t]}
              active={!noLacClaim && lacTierPick === t}
              onClick={() => {
                setLacTierPick(t === lacTierPick ? null : t);
                setNoLacClaim(false);
              }}
            />
          ))}
        </div>
        <div className="label" style={{ marginTop: "var(--sp-3)" }}>
          LACs are ranked on a separate US News list.
        </div>

        <ClaimCard
          active={noLacClaim}
          label="Applicant was not admitted to any T20 LAC"
          hint="Claim this if the profile had zero admits in every configured top-20 LAC band."
          onToggle={() => {
            setNoLacClaim(!noLacClaim);
            if (!noLacClaim) setLacTierPick(null);
          }}
        />
      </div>

      <hr className="divider" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-3)" }}>
        <Btn variant="ghost" onClick={onBack} icon="arrow-left">Back to profile</Btn>
        <Btn
          onClick={onLock}
          disabled={!(universityTierPick || noUniClaim) || !(lacTierPick || noLacClaim)}
          iconRight="lock"
        >
          Lock in predictions
        </Btn>
      </div>
    </div>
  );
}

function TierPickCard({ label, sublabel, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={"tier-pick" + (active ? " is-active" : "")}
    >
      <span className="tname">{label}</span>
      <span className="trange">{sublabel}</span>
    </button>
  );
}

function ClaimCard({ active, label, hint, onToggle }) {
  function toggleFromKeyboard(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onToggle();
  }

  return (
    <div
      className={"school-card" + (active ? " is-selected" : "")}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={toggleFromKeyboard}
      style={{ marginTop: "var(--sp-3)", borderStyle: "dashed", gap: "var(--sp-3)" }}
    >
      <span className="check">{active ? <i className="ti ti-check" /> : null}</span>
      <div className="grow">
        <div className="row" style={{ gap: "var(--sp-2)" }}>
          <span className="name">{label}</span>
          <span className="chip">15 pts</span>
        </div>
        <div className="muted" style={{ marginTop: "var(--sp-1)", fontSize: "var(--fs-sm)" }}>
          {hint} A correct claim earns 15 points; a wrong claim earns 0.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Phase2Tier, ProfileCollapsedSummary });
