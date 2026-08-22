// Phase 2 — Tier selection

function ProfileCollapsedSummary({ profile, profileLabel, onExpand }) {
  const { t, translateEnum } = window.I18N.useI18n();
  const d = profile.demographics || {};
  const sat = profile.test_scores?.sat;
  const act = profile.test_scores?.act;
  const test = sat ? `SAT ${sat.superscore_total ?? "—"}` : (act ? `ACT ${act.composite ?? "—"}` : t("profile.testOptional"));
  return (
    <div className="profile-collapsed-summary">
      <div className="row">
        <div className="who">{profileLabel}</div>
        <div className="row" style={{ gap: "var(--sp-1)" }}>
          <span className="chip">{d.gender ? translateEnum("gender", d.gender) : <span className="muted">—</span>}</span>
          <span className="chip">{d.ethnicity || <span className="muted">—</span>}</span>
          <span className="chip">{d.ses ? translateEnum("income", d.ses) : <span className="muted">—</span>}</span>
          <span className="chip">{test}</span>
          <span className="chip">{t("profile.gpa")} {profile.academic_profile?.gpa?.unweighted ?? <span className="muted">—</span>}</span>
          <span className="chip">{t("profile.apCount", { count: profile.academic_profile?.course_rigor?.total_ap_courses ?? 0 })}</span>
        </div>
      </div>
      <button className="btn btn--ghost" onClick={onExpand}>
        <i className="ti ti-eye" style={{ fontSize: "var(--fs-md)" }} aria-hidden="true" /> {t("tier.profileReview")}
      </button>
    </div>
  );
}

// Informational countdown aligned to the server attempt's authoritative start.
function TimeBonusChip({ startedAt }) {
  const { t } = window.I18N.useI18n();
  const startMs = Date.parse(startedAt || "");
  const [elapsed, setElapsed] = React.useState(() => Number.isFinite(startMs)
    ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
    : 0);
  React.useEffect(() => {
    const update = () => setElapsed(Number.isFinite(startMs)
      ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      : 0);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startMs]);
  const state = elapsed <= 30 ? "full" : elapsed >= 120 ? "floor" : "shrinking";
  const kind = state === "full" ? "warn" : state === "shrinking" ? "info" : "neutral";
  const fade = state === "full" ? 1 : Math.max(0.55, 1 - 0.45 * (elapsed - 30) / 90);
  return (
    <span style={{ marginLeft: "auto", opacity: fade, transition: "opacity .6s" }}>
      <Badge kind={kind} icon="clock">{t("tier.timeBonusState", { state: t(`tier.timeBonus${state[0].toUpperCase()}${state.slice(1)}`) })}</Badge>
    </span>
  );
}

function Phase2Tier({
  profile, profileLabel,
  universityTierPick, setUniversityTierPick,
  lacTierPick, setLacTierPick,
  noUniClaim, setNoUniClaim,
  noLacClaim, setNoLacClaim,
  isPractice = false, attemptStartedAt = null,
  onLock, onBack
}) {
  const T = window.TIERS;
  const { t } = window.I18N.useI18n();

  return (
    <div className="fade-in" data-screen-label="02 Tier">
      <Stepper phase={2} />

      <ProfileCollapsedSummary profile={profile} profileLabel={profileLabel} onExpand={onBack} />

      <div className="section-head">
        <div className="title-block">
          <span className="eyebrow">{t("tier.eyebrow")}</span>
          <h2>{t("tier.title")}</h2>
        </div>
        <span className="sub">{t("tier.instructions")}</span>
        {isPractice ? null : <TimeBonusChip startedAt={attemptStartedAt} />}
      </div>

      <div className="callout" style={{ marginBottom: "var(--sp-4)" }}>
        <i className="ti ti-info-circle" aria-hidden="true" />
        <div>
          {t("tier.bandExplanation")}
        </div>
      </div>

      <div className="card stagger" style={{ marginBottom: "var(--sp-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
          <span className="label">{t("tier.panelUniversity")}</span>
          <span className="chip">{t("tier.choiceCount", { current: 1, total: T.UNI_TIER_LIST.length })}</span>
        </div>
        <div className="tier-grid tier-grid--uni" aria-disabled={noUniClaim}>
          {T.UNI_TIER_LIST.map(tierCode => (
            <TierPickCard
              key={tierCode}
              label={tierCode}
              sublabel={t(`ranges.${tierCode}`)}
              active={!noUniClaim && universityTierPick === tierCode}
              onClick={() => {
                setUniversityTierPick(tierCode === universityTierPick ? null : tierCode);
                setNoUniClaim(false);
              }}
            />
          ))}
        </div>
        <ClaimCard
          active={noUniClaim}
          label={t("tier.noUniversityClaim")}
          hint={t("tier.noUniversityClaimHint")}
          onToggle={() => {
            setNoUniClaim(!noUniClaim);
            if (!noUniClaim) setUniversityTierPick(null);
          }}
        />
      </div>

      <div className="card stagger" style={{ marginBottom: "var(--sp-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
          <span className="label">{t("tier.panelLac")}</span>
          <span className="chip">{t("tier.choiceCount", { current: 1, total: T.LAC_TIER_LIST.length })}</span>
        </div>
        <div className="tier-grid tier-grid--lac" aria-disabled={noLacClaim}>
          {T.LAC_TIER_LIST.map(tierCode => (
            <TierPickCard
              key={tierCode}
              label={tierCode}
              sublabel={t(`ranges.${tierCode}`)}
              active={!noLacClaim && lacTierPick === tierCode}
              onClick={() => {
                setLacTierPick(tierCode === lacTierPick ? null : tierCode);
                setNoLacClaim(false);
              }}
            />
          ))}
        </div>
        <div className="label" style={{ marginTop: "var(--sp-3)" }}>
          {t("tier.lacSeparateRanking")}
        </div>

        <ClaimCard
          active={noLacClaim}
          label={t("tier.noLacClaim")}
          hint={t("tier.noLacClaimHint")}
          onToggle={() => {
            setNoLacClaim(!noLacClaim);
            if (!noLacClaim) setLacTierPick(null);
          }}
        />
      </div>

      <hr className="divider" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--sp-3)" }}>
        <Btn variant="ghost" onClick={onBack} icon="arrow-left">{t("tier.back")}</Btn>
        <Btn
          onClick={onLock}
          disabled={!(universityTierPick || noUniClaim) || !(lacTierPick || noLacClaim)}
          iconRight="lock"
          testId="phase-lock"
        >
          {t("tier.lockPredictions")}
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
  const { t } = window.I18N.useI18n();
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
          <span className="chip">{t("tier.claimPoints", { points: 15 })}</span>
        </div>
        <div className="muted" style={{ marginTop: "var(--sp-1)", fontSize: "var(--fs-sm)" }}>
          {hint} {t("tier.correctClaimScoring")}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Phase2Tier, ProfileCollapsedSummary });
