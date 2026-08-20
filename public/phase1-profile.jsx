// Phase 1 — Profile viewer with three tabs

function Phase1Profile({ profile, onStart, profileIdx, profileCount, canViewCorrectChoices = false }) {
  const [tab, setTab] = useState("overview");
  const [chartMode, setChartMode] = useState("bar"); // bar | donut

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
            <span className="eyebrow">Applicant {String(profileIdx + 1).padStart(2, "0")} / {String(profileCount).padStart(2, "0")}</span>
            <h2>{profile.id}</h2>
          </div>
          <Btn onClick={onStart} iconRight="arrow-right" testId="phase-start">Start guessing</Btn>
        </div>

        <div style={{ padding: "0 var(--sp-5)" }}>
          <Tabs
            idBase="phase1"
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "academics", label: "Academics" },
              { id: "ecs", label: "Extracurriculars" },
              ...(canViewCorrectChoices ? [{ id: "correct", label: "Correct choices", testId: "correct-choices-tab" }] : []),
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
    ["Universities", admitted.filter(name => T.schoolKind(name) === "uni")],
    ["Liberal Arts Colleges", admitted.filter(name => T.schoolKind(name) === "lac")],
    ["Other admits", admitted.filter(name => !T.schoolKind(name))],
  ];
  const finalDecision = profile.application_results?.final_decision;

  return (
    <div className="fade-in stack" style={{ gap: "var(--sp-4)" }}>
      <div className="callout callout--teach" style={{ alignItems: "flex-start" }}>
        <i className="ti ti-lock-open" aria-hidden="true" />
        <div className="stack" style={{ gap: "var(--sp-1)" }}>
          <strong>Correct choices</strong>
          <span className="muted">This file is finalized and no longer affects your score.</span>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <span className="label">Best top-50 university band</span>
          <strong style={{ display: "block", marginTop: "var(--sp-2)" }}>{uniTier || "No top-50 university admit"}</strong>
        </div>
        <div className="card">
          <span className="label">Best top-20 LAC band</span>
          <strong style={{ display: "block", marginTop: "var(--sp-2)" }}>{lacTier || "No top-20 LAC admit"}</strong>
        </div>
      </div>

      <div className="card">
        <div className="label" style={{ marginBottom: "var(--sp-3)" }}>Admitted schools</div>
        {groups.map(([label, schools]) => (
          <div key={label} style={{ marginTop: label === "Universities" ? 0 : "var(--sp-3)" }}>
            <div className="label" style={{ color: "var(--text-tertiary)" }}>{label}</div>
            {schools.length > 0
              ? <div className="row" style={{ gap: "var(--sp-2)", flexWrap: "wrap", marginTop: "var(--sp-1)" }}>{schools.map(name => <Badge key={name} kind="ok" icon="check">{name}</Badge>)}</div>
              : <div className="muted" style={{ marginTop: "var(--sp-1)" }}>None</div>}
          </div>
        ))}
      </div>

      <div className="final-banner">
        <span className="stamp-mark" aria-hidden="true">Admitted</span>
        <span className="label">Final enrollment</span>
        <div className="school">{finalDecision?.school || "—"}</div>
        <div className="date">Admitted on {formatDate(finalDecision?.decision_date)}</div>
      </div>
    </div>
  );
}
function OverviewTab({ d }) {
  const m = (x) => x ? x : <span className="muted">—</span>;
  const rows = [
    ["Gender", m(d.gender)],
    ["Ethnicity", m(d.ethnicity)],
    ["School type", m(d.school_type)],
    ["Region", m(d.school_region)],
    ["Classification", m(d.school_classification)],
    ["Income level", m(d.ses)]
  ];
  return (
    <div className="fade-in">
      <dl className="deflist" style={{ marginBottom: "var(--sp-3)" }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="row" style={{ gap: "var(--sp-2)" }}>
        <Badge kind={d.legacy_status ? "info" : "neutral"} icon={d.legacy_status ? "check" : "minus"}>
          Legacy {d.legacy_status ? "yes" : "no"}
        </Badge>
        <Badge kind={d.first_generation ? "info" : "neutral"} icon={d.first_generation ? "check" : "minus"}>
          First-gen {d.first_generation ? "yes" : "no"}
        </Badge>
      </div>
    </div>
  );
}

function AcademicsTab({ sat, act, gpa, rigor, chartMode, setChartMode }) {
  // flat list of every AP course across years
  const allCourses = useMemo(() => {
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
            <span className="k">SAT superscore</span>
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
              <span className="k">ACT composite</span>
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
            <span className="k">GPA (unweighted)</span>
            <span className="v">{gpa.unweighted ?? <span className="muted">—</span>} <span className="sub">/ {gpa.unweighted_scale ?? "—"}</span></span>
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <span className="k">Rigor</span>
            <span className="v">{rigor.total_ap_courses ?? 0} <span className="sub">APs</span></span>
            <span className="label">
              + {rigor.total_post_ap_courses ?? 0} post-AP · {rigor.total_honors_courses ?? 0} honors
            </span>
          </div>
        </div>
      </div>

      {/* AP chart */}
      <div className="card" style={{ marginBottom: "var(--sp-3)" }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--sp-3)" }}>
          <div>
            <div className="label">AP score breakdown</div>
            <div className="muted" style={{ fontSize: "var(--fs-base)", marginTop: "var(--sp-1)" }}>
              {apCourses.filter(c => c.score != null).length} reported · {apCourses.filter(c => c.score == null).length} pending
            </div>
          </div>
          <div className="seg">
            <button aria-pressed={chartMode === "bar"} onClick={() => setChartMode("bar")}>Bar</button>
            <button aria-pressed={chartMode === "donut"} onClick={() => setChartMode("donut")}>Donut</button>
          </div>
        </div>

        {chartMode === "bar" ? <APBars courses={sorted} /> : <APDonut courses={apCourses} />}
      </div>

      {/* Course history table */}
      <div className="card">
        <div className="label" style={{ marginBottom: "var(--sp-2)" }}>Course history</div>
        <table className="course-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Course</th>
              <th>Level</th>
              <th style={{ textAlign: "right" }}>Score</th>
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
        <LegendDot color={AP_COLORS[5]} label="Score 5" />
        <LegendDot color={AP_COLORS[4]} label="Score 4" />
        <LegendDot color={AP_COLORS[3]} label="Score 3" />
        <LegendDot color="var(--border-2)" label="Pending" />
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
          REPORTED
        </text>
      </svg>
      <div className="donut-legend">
        <div><span className="sw" style={{ background: AP_COLORS[5] }} /> Score 5 · {counts[5]}</div>
        <div><span className="sw" style={{ background: AP_COLORS[4] }} /> Score 4 · {counts[4]}</div>
        <div><span className="sw" style={{ background: AP_COLORS[3] }} /> Score 3 · {counts[3]}</div>
        <div><span className="sw" style={{ background: "var(--border-2)" }} /> Pending · {counts.pending}</div>
      </div>
    </div>
  );
}

function ECsTab({ ecs }) {
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
          <Badge kind={ecTierKind(e.tier)}>Tier {e.tier}</Badge>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Phase1Profile });
