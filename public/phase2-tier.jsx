// Phase 2 — Tier selection

function ProfileCollapsedSummary({ profile, onExpand }) {
  const d = profile.demographics || {};
  const sat = profile.test_scores?.sat;
  const act = profile.test_scores?.act;
  const test = sat ? `SAT ${sat.superscore_total}` : (act ? `ACT ${act.composite}` : "Test-optional");
  return (
    <div className="profile-collapsed-summary">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="who">{profile.id}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Badge>{d.gender}</Badge>
          <Badge>{d.ethnicity}</Badge>
          <Badge>{d.ses}</Badge>
          <Badge>{test}</Badge>
          <Badge>GPA {profile.academic_profile?.gpa?.unweighted}</Badge>
          <Badge>{profile.academic_profile?.course_rigor?.total_ap_courses} APs</Badge>
        </div>
      </div>
      <button className="btn btn--ghost" onClick={onExpand}>
        <i className="ti ti-eye" style={{ fontSize: 14 }} /> Review profile
      </button>
    </div>
  );
}

function Phase2Tier({
  profile,
  universityTierPick, setUniversityTierPick,
  lacTierPick, setLacTierPick,
  noLacClaim, setNoLacClaim,
  onLock, onBack
}) {
  const T = window.TIERS;

  return (
    <div className="fade-in" data-screen-label="02 Tier">
      <Stepper phase={2} />

      <ProfileCollapsedSummary profile={profile} onExpand={onBack} />

      <div className="section-head">
        <h2>Predict the ceiling</h2>
        <span className="sub">Pick one university tier and one LAC tier.</span>
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <i className="ti ti-info-circle" />
        <div>
          Tiers are bands, not ranges — T10 means ranks 6-10 only, T20 means 11-20, and so on. Pick the band you think this applicant landed in. Your choices unlock the school list — pick carefully.
        </div>
      </div>

      <div className="card stagger" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div className="label">Panel A · University tier</div>
          <div className="label" style={{ color: "var(--text-tertiary)" }}>1 of 5</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8 }}>
          {T.UNI_TIER_LIST.map(t => (
            <TierPickCard
              key={t}
              label={t}
              sublabel={T.TIER_RANGE[t]}
              active={universityTierPick === t}
              onClick={() => setUniversityTierPick(t === universityTierPick ? null : t)}
            />
          ))}
        </div>
      </div>

      <div className="card stagger" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <div className="label">Panel B · Liberal Arts College tier</div>
          <div className="label" style={{ color: "var(--text-tertiary)" }}>1 of 3</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, opacity: noLacClaim ? 0.4 : 1, pointerEvents: noLacClaim ? "none" : "auto" }}>
          {T.LAC_TIER_LIST.map(t => (
            <TierPickCard
              key={t}
              label={t}
              sublabel={T.TIER_RANGE[t]}
              active={!noLacClaim && lacTierPick === t}
              onClick={() => setLacTierPick(t === lacTierPick ? null : t)}
            />
          ))}
        </div>
        <div className="label" style={{ marginTop: 12, color: "var(--text-tertiary)" }}>
          LACs are ranked on a separate US News list.
        </div>

        <div
          className={"school-card" + (noLacClaim ? " is-selected" : "")}
          onClick={() => { setNoLacClaim(!noLacClaim); if (!noLacClaim) setLacTierPick(null); }}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNoLacClaim(!noLacClaim); if (!noLacClaim) setLacTierPick(null); } }}
          style={{ marginTop: 14, borderStyle: "dashed", justifyContent: "flex-start", gap: 12 }}
        >
          <span className="check">
            {noLacClaim ? <i className="ti ti-check" /> : null}
          </span>
          <div>
            <div className="name">Applicant was not admitted to any LAC</div>
            <div className="label" style={{ marginTop: 2, color: "var(--text-tertiary)" }}>
              Skip the LAC band. +10 if true, −5 if they had any LAC admit.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
        <Btn variant="ghost" onClick={onBack} icon="arrow-left">Back to profile</Btn>
        <Btn
          onClick={onLock}
          disabled={!universityTierPick || !(lacTierPick || noLacClaim)}
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
      style={{
        border: active ? "1.5px solid var(--accent-info-bd)" : "0.5px solid var(--border-1)",
        background: active ? "var(--accent-info-bg)" : "var(--bg-surface)",
        color: active ? "var(--accent-info-fg)" : "var(--text-primary)",
        borderRadius: "var(--r-md)",
        padding: active ? "12px 14px" : "13px 15px",
        textAlign: "left",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 120ms ease",
        display: "flex", flexDirection: "column", gap: 4
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.005em" }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                     color: active ? "var(--accent-info-fg)" : "var(--text-tertiary)",
                     letterSpacing: "0.04em", opacity: active ? 0.8 : 1 }}>
        {sublabel}
      </span>
    </button>
  );
}

Object.assign(window, { Phase2Tier, ProfileCollapsedSummary });
