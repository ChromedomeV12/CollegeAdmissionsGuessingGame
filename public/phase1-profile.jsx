// Phase 1 — Profile viewer with three tabs

function Phase1Profile({ profile, profileLabel, onStart, profileIdx, profileCount, canViewCorrectChoices = false }) {
  const [tab, setTab] = React.useState("overview");
  const [chartMode, setChartMode] = React.useState("bar"); // bar | donut
  const { t } = window.I18N.useI18n();

  const d = profile.demographics || {};
  const sat = profile.test_scores?.sat;
  const act = profile.test_scores?.act;
  const gpa = profile.academic_profile?.gpa || {};
  const rigor = profile.academic_profile?.course_rigor || { courses_by_year: {} };
  const ecs = [...(profile.extracurriculars || [])].sort((a, b) => a.tier - b.tier);

  return (
    <div className="fade-in" data-screen-label="01 Profile">
      <Stepper phase={1} />

      <div className="card" style={{ padding: 0 }}>
        <div className="section-head" style={{ padding: "var(--sp-4) var(--sp-5)", borderBottom: "1px solid var(--border-1)", marginBottom: 0 }}>
          <div className="title-block">
            <span className="eyebrow">{t("profile.applicant", {
              current: String(profileIdx + 1).padStart(2, "0"),
              total: String(profileCount).padStart(2, "0")
            })}</span>
            <h2>{profileLabel}</h2>
          </div>
          <Btn onClick={onStart} iconRight="arrow-right" testId="phase-start">{t("profile.start")}</Btn>
        </div>

        <div style={{ padding: "0 var(--sp-5)" }}>
          <Tabs
            idBase="phase1"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: t("profile.overview") },
              { id: "academics", label: t("profile.academics") },
              { id: "ecs", label: t("profile.extracurriculars") },
              ...(canViewCorrectChoices ? [{ id: "correct", label: t("profile.correctChoices"), testId: "correct-choices-tab" }] : []),
            ]}
          />
        </div>

        <div
          role="tabpanel"
          id={`phase1-panel-${tab}`}
          aria-labelledby={`phase1-tab-${tab}`}
          tabIndex={0}
          style={{ padding: "var(--sp-4) var(--sp-5)" }}
        >
          {tab === "overview" && <OverviewTab d={d} />}
          {tab === "academics" && (
            <AcademicsTab
              sat={sat} act={act} gpa={gpa} rigor={rigor}
              chartMode={chartMode} setChartMode={setChartMode}
            />
          )}
          {tab === "ecs" && <ECsTab ecs={ecs} />}
          {tab === "correct" && canViewCorrectChoices && <CorrectChoicesTab profile={profile} />}
        </div>
      </div>
    </div>
  );
}

function CorrectChoicesTab({ profile }) {
  const T = window.TIERS;
  const { t, formatDate } = window.I18N.useI18n();
  const admitted = T?.getAdmittedSchools ? T.getAdmittedSchools(profile) : [];
  const admittedKeys = new Set(admitted.map(name => T.normSchool(name)));

  function bestBand(tiers, kind) {
    for (const tier of tiers || []) {
      const schools = T.getSchoolsInTier(tier, kind);
      if (schools.some(school => admittedKeys.has(school.key))) return tier;
    }
    return null;
  }

  const uniTier = bestBand(T?.UNI_TIER_LIST, "uni");
  const lacTier = bestBand(T?.LAC_TIER_LIST, "lac");
  const groups = [
    [t("profile.universities"), admitted.filter(name => T.schoolKind(name) === "uni")],
    [t("profile.liberalArtsColleges"), admitted.filter(name => T.schoolKind(name) === "lac")],
    [t("profile.otherAdmits"), admitted.filter(name => !T.schoolKind(name))],
  ];
  const finalDecision = profile.application_results?.final_decision;

  return (
    <div className="fade-in stack" style={{ gap: "var(--sp-4)" }}>
      <div className="callout callout--teach" style={{ alignItems: "flex-start" }}>
        <i className="ti ti-lock-open" aria-hidden="true" />
        <div className="stack" style={{ gap: "var(--sp-1)" }}>
          <strong>{t("profile.correctChoices")}</strong>
          <span className="muted">{t("profile.correctFinalized")}</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <span className="label">{t("profile.bestUniversityBand")}</span>
          <strong style={{ display: "block", marginTop: "var(--sp-2)" }}>{uniTier || t("profile.noUniversityAdmit")}</strong>
        </div>
        <div className="card">
          <span className="label">{t("profile.bestLacBand")}</span>
          <strong style={{ display: "block", marginTop: "var(--sp-2)" }}>{lacTier || t("profile.noLacAdmit")}</strong>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: "var(--sp-3)" }}>{t("profile.admittedSchools")}</div>
        {groups.map(([label, schools], index) => (
          <div key={label} style={{ marginTop: index === 0 ? 0 : "var(--sp-3)" }}>
            <div className="label" style={{ color: "var(--text-tertiary)" }}>{label}</div>
            {schools.length > 0
              ? <div className="row" style={{ gap: "var(--sp-2)", flexWrap: "wrap", marginTop: "var(--sp-1)" }}>{schools.map(name => <Badge key={name} kind="ok" icon="check">{name}</Badge>)}</div>
              : <div className="muted" style={{ marginTop: "var(--sp-1)" }}>{t("common.none")}</div>}
          </div>
        ))}
      </div>

      <div className="final-banner">
        <span className="stamp-mark" aria-hidden="true">{t("profile.admittedStamp")}</span>
        <span className="label">{t("profile.finalEnrollment")}</span>
        <div className="school">{finalDecision?.school || "—"}</div>
        <div className="date">{t("profile.admittedOn", { date: formatDate(finalDecision?.decision_date) })}</div>
      </div>
    </div>
  );
}
function OverviewTab({ d }) {
  const { t, translateEnum } = window.I18N.useI18n();
  const m = (x) => x ? x : <span className="muted">—</span>;
  const rows = [
    [t("profile.gender"), m(translateEnum("gender", d.gender))],
    [t("profile.ethnicity"), m(d.ethnicity)],
    [t("profile.schoolType"), m(translateEnum("schoolType", d.school_type))],
    [t("profile.region"), m(d.school_region)],
    [t("profile.classification"), m(translateEnum("schoolFeeder", d.school_classification))],
    [t("profile.income"), m(translateEnum("income", d.ses))]
  ];
  return (
    <div className="fade-in">
      <dl className="deflist" style={{ marginBottom: "var(--sp-3)" }}>
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="row" style={{ gap: "var(--sp-2)" }}>
        <Badge kind={d.legacy_status ? "info" : "neutral"} icon={d.legacy_status ? "check" : "minus"}>
          {t("profile.legacy")} {translateEnum("boolean", Boolean(d.legacy_status))}
        </Badge>
        <Badge kind={d.first_generation ? "info" : "neutral"} icon={d.first_generation ? "check" : "minus"}>
          {t("profile.firstGeneration")} {translateEnum("boolean", Boolean(d.first_generation))}
        </Badge>
      </div>
    </div>
  );
}

function AcademicsTab({ sat, act, gpa, rigor, chartMode, setChartMode }) {
  const { t } = window.I18N.useI18n();
  // flat list of every AP course across years
  const allCourses = React.useMemo(() => {
    const out = [];
    for (const [yr, list] of Object.entries(rigor.courses_by_year || {})) {
      for (const c of list) out.push({ ...c, year: yr });
    }
    return out;
  }, [rigor]);

  const apCourses = allCourses.filter(c => c.level && c.level.includes("AP"));
  // sort: scored first (by score desc), then pending
  const sorted = [...apCourses].sort((a, b) => {
    if (a.score == null && b.score != null) return 1;
    if (b.score == null && a.score != null) return -1;
    if (a.score != null && b.score != null) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="fade-in">
      <div className={"grid " + (act ? "grid-2" : "grid-3")} style={{ marginBottom: "var(--sp-4)" }}>
        <div className="card">
          <div className="metric">
            <span className="k">{t("profile.satSuperscore")}</span>
            <span className="v">
              {sat ? sat.superscore_total : <span className="muted">—</span>}
              {sat ? <span className="sub"> / 1600</span> : null}
            </span>
            {sat && sat.superscore_breakdown && (
              <span className="label">
                M {sat.superscore_breakdown.math} · EBRW {sat.superscore_breakdown.ebrw}
              </span>
            )}
          </div>
        </div>
        {act && (
          <div className="card">
            <div className="metric">
              <span className="k">{t("profile.actComposite")}</span>
              <span className="v">{act.composite} <span className="sub">/ 36</span></span>
              {act.breakdown && (
                <span className="label">
                  E {act.breakdown.english} · M {act.breakdown.math} · R {act.breakdown.reading} · S {act.breakdown.science}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="card">
          <div className="metric">
            <span className="k">{t("profile.gpaUnweighted")}</span>
            <span className="v">{gpa.unweighted ?? <span className="muted">—</span>} <span className="sub">/ {gpa.unweighted_scale ?? "—"}</span></span>
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <span className="k">{t("profile.rigor")}</span>
            <span className="v">{t("profile.apCount", { count: rigor.total_ap_courses ?? 0 })}</span>
            <span className="label">
              {t("profile.postApAndHonors", {
                postAp: rigor.total_post_ap_courses ?? 0,
                honors: rigor.total_honors_courses ?? 0
              })}
            </span>
          </div>
        </div>
      </div>

      {/* AP chart */}
      <div className="card" style={{ marginBottom: "var(--sp-3)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--sp-3)" }}>
          <div>
            <div className="label">{t("profile.apScoreBreakdown")}</div>
            <div className="muted" style={{ fontSize: "var(--fs-base)", marginTop: "var(--sp-1)" }}>
              {t("profile.reportedPending", {
                reported: apCourses.filter(c => c.score != null).length,
                pending: apCourses.filter(c => c.score == null).length
              })}
            </div>
          </div>
          <div className="seg">
            <button aria-pressed={chartMode === "bar"} onClick={() => setChartMode("bar")}>{t("profile.chartBar")}</button>
            <button aria-pressed={chartMode === "donut"} onClick={() => setChartMode("donut")}>{t("profile.chartDonut")}</button>
          </div>
        </div>

        {chartMode === "bar" ? <APBars courses={sorted} /> : <APDonut courses={apCourses} />}
      </div>

      {/* Course history table */}
      <div className="card">
        <div className="label" style={{ marginBottom: "var(--sp-2)" }}>{t("profile.courseHistory")}</div>
        <table className="course-table">
          <thead>
            <tr>
              <th>{t("profile.year")}</th>
              <th>{t("profile.course")}</th>
              <th>{t("profile.level")}</th>
              <th style={{ textAlign: "right" }}>{t("common.score")}</th>
            </tr>
          </thead>
          <tbody>
            {["9th", "10th", "11th", "12th"].flatMap(yr =>
              (rigor.courses_by_year?.[yr] || []).map((c, i) => (
                <tr key={yr + i}>
                  <td className="year-cell">{i === 0 ? yr : ""}</td>
                  <td>{c.name}</td>
                  <td className="muted">{c.level}</td>
                  <td className="num" style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {c.score == null ? <span className="muted">—</span> : c.score}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rigor.course_load_notes && (
          <div className="muted" style={{ marginTop: "var(--sp-3)", fontSize: "var(--fs-base)", fontStyle: "italic" }}>
            {rigor.course_load_notes}
          </div>
        )}
      </div>
    </div>
  );
}

const AP_COLORS = { 5: "#1D9E75", 4: "#378ADD", 3: "#EF9F27", 2: "#bbbbbb", 1: "#bbbbbb" };

function APBars({ courses }) {
  const { t } = window.I18N.useI18n();
  return (
    <div>
      {courses.map((c, i) => {
        const pending = c.score == null;
        const pct = pending ? 100 : (c.score / 5) * 100;
        const color = pending ? null : (AP_COLORS[c.score] || "#bbbbbb");
        return (
          <div key={i} className={"ap-row" + (pending ? " pending" : "")}>
            <div className="name">{c.name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: color || undefined }} />
            </div>
            <div className="score-cell">{pending ? "—" : c.score}</div>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: "var(--sp-3)" }}>
        <LegendDot color={AP_COLORS[5]} label={t("profile.scoreValue", { score: 5 })} />
        <LegendDot color={AP_COLORS[4]} label={t("profile.scoreValue", { score: 4 })} />
        <LegendDot color={AP_COLORS[3]} label={t("profile.scoreValue", { score: 3 })} />
        <LegendDot color="var(--border-2)" label={t("profile.pending")} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-1)", fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function APDonut({ courses }) {
  const { t } = window.I18N.useI18n();
  const counts = { 5: 0, 4: 0, 3: 0, pending: 0 };
  for (const c of courses) {
    if (c.score == null) counts.pending++;
    else if (counts[c.score] != null) counts[c.score]++;
  }
  const total = counts[5] + counts[4] + counts[3] + counts.pending || 1;
  const segments = [
    { key: 5, color: AP_COLORS[5], val: counts[5] },
    { key: 4, color: AP_COLORS[4], val: counts[4] },
    { key: 3, color: AP_COLORS[3], val: counts[3] },
    { key: "pending", color: "var(--border-2)", val: counts.pending }
  ].filter(s => s.val > 0);

  const r = 60, cx = 70, cy = 70, stroke = 18;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-surface-3)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.val / total) * circ;
          const dash = `${len} ${circ - len}`;
          const offset = -acc;
          acc += len;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={dash} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`} />
          );
        })}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "var(--font-serif)", fontSize: 26, fill: "var(--text-primary)" }}>
          {counts[5] + counts[4] + counts[3]}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle"
          style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--text-tertiary)", letterSpacing: "0.04em" }}>
          {t("profile.reported").toLocaleUpperCase()}
        </text>
      </svg>
      <div className="donut-legend">
        <div><span className="sw" style={{ background: AP_COLORS[5] }} /> {t("profile.scoreValue", { score: 5 })} · {counts[5]}</div>
        <div><span className="sw" style={{ background: AP_COLORS[4] }} /> {t("profile.scoreValue", { score: 4 })} · {counts[4]}</div>
        <div><span className="sw" style={{ background: AP_COLORS[3] }} /> {t("profile.scoreValue", { score: 3 })} · {counts[3]}</div>
        <div><span className="sw" style={{ background: "var(--border-2)" }} /> {t("profile.pending")} · {counts.pending}</div>
      </div>
    </div>
  );
}

function ECsTab({ ecs }) {
  const { t } = window.I18N.useI18n();
  return (
    <div className="fade-in">
      {ecs.map((e, i) => (
        <div className="ec-item" key={e.id}>
          <div className="num">{String(i + 1).padStart(2, "0")}</div>
          <div>
            <div className="row" style={{ gap: "var(--sp-2)" }}>
              <span className="title">{e.title}</span>
              <span className="label">{e.category}</span>
            </div>
            {e.description && <div className="desc">{e.description}</div>}
            {e.achievements && e.achievements.length > 0 && (
              <ul>
                {e.achievements.map((a, j) => <li key={j}>{a}</li>)}
              </ul>
            )}
          </div>
          <Badge kind={ecTierKind(e.tier)}>{t("profile.ecTier", { tier: e.tier })}</Badge>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Phase1Profile });
