// Phase 1 — Profile viewer with three tabs

function Phase1Profile({ profile, onStart, profileIdx, profileCount }) {
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
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "0.5px solid var(--border-1)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Applicant {String(profileIdx + 1).padStart(2, "0")} / {String(profileCount).padStart(2, "0")}</div>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, letterSpacing: "-0.01em" }}>
                {profile.id}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Btn onClick={onStart} iconRight="arrow-right">Start guessing</Btn>
          </div>
        </div>

        {/* tabs */}
        <div style={{ padding: "0 20px" }}>
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { id: "overview",   label: "Overview" },
              { id: "academics",  label: "Academics" },
              { id: "ecs",        label: "Extracurriculars" }
            ]}
          />
        </div>

        <div style={{ padding: "18px 20px 18px" }}>
          {tab === "overview" && <OverviewTab d={d} />}
          {tab === "academics" && (
            <AcademicsTab
              sat={sat} act={act} gpa={gpa} rigor={rigor}
              chartMode={chartMode} setChartMode={setChartMode}
            />
          )}
          {tab === "ecs" && <ECsTab ecs={ecs} />}
        </div>

      </div>
    </div>
  );
}

function OverviewTab({ d }) {
  const rows = [
    ["Gender", d.gender],
    ["Ethnicity", d.ethnicity],
    ["School type", d.school_type],
    ["Region", d.school_region],
    ["Classification", d.school_classification],
    ["Income level", d.ses]
  ];
  return (
    <div className="fade-in">
      <dl className="deflist" style={{ marginBottom: 14 }}>
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
      <div className={"grid " + (act ? "grid-2" : "grid-3")} style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="metric">
            <span className="k">SAT superscore</span>
            <span className="v">
              {sat ? sat.superscore_total : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
              {sat ? <span className="sub"> / 1600</span> : null}
            </span>
            {sat && sat.superscore_breakdown && (
              <span className="label" style={{ color: "var(--text-tertiary)" }}>
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
                <span className="label" style={{ color: "var(--text-tertiary)" }}>
                  E {act.breakdown.english} · M {act.breakdown.math} · R {act.breakdown.reading} · S {act.breakdown.science}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="card">
          <div className="metric">
            <span className="k">GPA (unweighted)</span>
            <span className="v">{gpa.unweighted} <span className="sub">/ {gpa.unweighted_scale}</span></span>
          </div>
        </div>
        <div className="card">
          <div className="metric">
            <span className="k">Rigor</span>
            <span className="v">{rigor.total_ap_courses} <span className="sub">APs</span></span>
            <span className="label" style={{ color: "var(--text-tertiary)" }}>
              + {rigor.total_post_ap_courses} post-AP · {rigor.total_honors_courses} honors
            </span>
          </div>
        </div>
      </div>

      {/* AP chart */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div className="label">AP score breakdown</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
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
        <div className="label" style={{ marginBottom: 8 }}>Course history</div>
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
                  <td style={{ color: "var(--text-tertiary)" }}>{c.level}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                    {c.score == null ? <span style={{ color: "var(--text-tertiary)" }}>—</span> : c.score}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {rigor.course_load_notes && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
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
      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        <LegendDot color={AP_COLORS[5]} label="Score 5" />
        <LegendDot color={AP_COLORS[4]} label="Score 4" />
        <LegendDot color={AP_COLORS[3]} label="Score 3" />
        <LegendDot color="var(--border-1)" label="Pending" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
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
    { key: "pending", color: "#cccccc", val: counts.pending }
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
        <div><span className="sw" style={{ background: "#cccccc" }} /> Pending · {counts.pending}</div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="title">{e.title}</span>
              <span className="label" style={{ color: "var(--text-tertiary)" }}>{e.category}</span>
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
