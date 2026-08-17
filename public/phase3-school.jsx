// Phase 3 — School selection (with logos + color accents)

// ─── School domain map → used for logo fetching ──────────────────────────────
const SCHOOL_DOMAINS = {
  // Ivies + MIT + Stanford
  "harvard": "harvard.edu", "mit": "mit.edu", "stanford": "stanford.edu",
  "yale": "yale.edu", "princeton": "princeton.edu", "columbia": "columbia.edu",
  "upenn": "upenn.edu", "penn": "upenn.edu", "wharton": "upenn.edu",
  "brown": "brown.edu", "dartmouth": "dartmouth.edu", "cornell": "cornell.edu",

  // T10-T20
  "duke": "duke.edu", "northwestern": "northwestern.edu",
  "uchicago": "uchicago.edu", "u of chicago": "uchicago.edu",
  "jhu": "jhu.edu", "johns hopkins": "jhu.edu",
  "rice": "rice.edu", "vanderbilt": "vanderbilt.edu",
  "notre dame": "nd.edu", "emory": "emory.edu",
  "georgetown": "georgetown.edu", "usc": "usc.edu",
  "cmu": "cmu.edu", "carnegie mellon": "cmu.edu",
  "caltech": "caltech.edu", "washu": "wustl.edu", "wash u": "wustl.edu",
  "tufts": "tufts.edu", "nyu": "nyu.edu",

  // UCs
  "ucla": "ucla.edu", "uc berkeley": "berkeley.edu", "berkeley": "berkeley.edu", "ucb": "berkeley.edu",
  "ucsd": "ucsd.edu", "ucsb": "ucsb.edu", "ucsc": "ucsc.edu", "uci": "uci.edu",
  "uc irvine": "uci.edu", "uc davis": "ucdavis.edu", "uc riverside": "ucr.edu",

  // Public flagships
  "michigan": "umich.edu", "umich": "umich.edu", "unc": "unc.edu",
  "unc chapel hill": "unc.edu", "georgia tech": "gatech.edu",
  "university of washington": "uw.edu", "uw seattle": "uw.edu",
  "uva": "virginia.edu", "virginia": "virginia.edu",
  "uiuc": "illinois.edu", "purdue": "purdue.edu",
  "penn state": "psu.edu", "ohio state": "osu.edu",
  "uf": "ufl.edu", "florida": "ufl.edu", "fsu": "fsu.edu",
  "wisconsin": "wisc.edu", "uw madison": "wisc.edu",
  "umn": "umn.edu", "minnesota": "umn.edu",
  "ut austin": "utexas.edu", "texas": "utexas.edu",
  "umiami": "miami.edu", "miami": "miami.edu",
  "indiana": "indiana.edu", "kelley": "indiana.edu",
  "cu boulder": "colorado.edu", "colorado": "colorado.edu",
  "bu": "bu.edu", "boston university": "bu.edu",
  "northeastern": "northeastern.edu", "tulane": "tulane.edu",
  "smu": "smu.edu", "tcu": "tcu.edu", "rpi": "rpi.edu",
  "alabama": "ua.edu", "ole miss": "olemiss.edu",
  "georgia": "uga.edu", "tennessee": "utk.edu",
  "fordham": "fordham.edu", "rutgers": "rutgers.edu",
  "syracuse": "syr.edu", "pitt": "pitt.edu",
  "case western": "case.edu", "rochester": "rochester.edu",
  "rit": "rit.edu", "wake forest": "wfu.edu",
  "villanova": "villanova.edu", "loyola chicago": "luc.edu",
  "university of denver": "du.edu", "uvm": "uvm.edu",
  "ubc": "ubc.ca", "university of toronto": "utoronto.ca",
  "u of t": "utoronto.ca", "waterloo": "uwaterloo.ca",
  "university of waterloo": "uwaterloo.ca", "queens": "queensu.ca",
  "university of alberta": "ualberta.ca",

  // LACs
  "amherst": "amherst.edu", "williams": "williams.edu",
  "swarthmore": "swarthmore.edu", "pomona": "pomona.edu",
  "wellesley": "wellesley.edu", "bowdoin": "bowdoin.edu",
  "carleton": "carleton.edu", "middlebury": "middlebury.edu",
  "wesleyan": "wesleyan.edu", "colby": "colby.edu",
  "hamilton": "hamilton.edu", "vassar": "vassar.edu",
  "oberlin": "oberlin.edu", "grinnell": "grinnell.edu",
  "davidson": "davidson.edu",
  "claremont mckenna": "cmc.edu", "harvey mudd": "hmc.edu",
  "reed": "reed.edu", "skidmore": "skidmore.edu",
  "kenyon": "kenyon.edu", "denison": "denison.edu",
  "holy cross": "holycross.edu", "college of wooster": "wooster.edu",
  "mount holyoke": "mtholyoke.edu", "st. olaf": "stolaf.edu",
  "washington and lee": "wlu.edu", "bates": "bates.edu",
  "colgate": "colgate.edu", "lafayette": "lafayette.edu",
  "union college": "union.edu", "cal poly slo": "calpoly.edu",
  "usc marshall": "usc.edu",
};

function getSchoolDomain(name) {
  const key = name.toLowerCase().trim();
  // Exact match first
  if (SCHOOL_DOMAINS[key]) return SCHOOL_DOMAINS[key];
  // Partial match
  for (const [k, v] of Object.entries(SCHOOL_DOMAINS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

// ─── School color accents (used when logo fails) ─────────────────────────────
const SCHOOL_COLORS = {
  "harvard": "#A51C30", "mit": "#A31F34", "stanford": "#8C1515",
  "yale": "#00356B", "princeton": "#FF6B35", "columbia": "#B9D9EB",
  "upenn": "#011F5B", "brown": "#4E3629", "dartmouth": "#00693E",
  "cornell": "#B31B1B", "duke": "#012169", "northwestern": "#4E2A84",
  "uchicago": "#800000", "jhu": "#002D72", "rice": "#002469",
  "vanderbilt": "#866D4B", "notre dame": "#0C2340", "emory": "#012169",
  "georgetown": "#063168", "usc": "#990000", "cmu": "#C41230",
  "caltech": "#FF6C0C", "washu": "#A51417", "tufts": "#3E8EDE",
  "nyu": "#57068c", "ucla": "#2774AE", "uc berkeley": "#003262",
  "michigan": "#00274C", "unc": "#4B9CD3", "georgia tech": "#B3A369",
  "uva": "#232D4B",
};

function getSchoolColor(name) {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(SCHOOL_COLORS)) {
    if (key.includes(k)) return v;
  }
  // Generate a stable color from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

// ─── SchoolLogo component ─────────────────────────────────────────────────────
function SchoolLogo({ name, size = 28 }) {
  const domain = getSchoolDomain(name);
  const color = getSchoolColor(name);
  const initial = name.trim()[0].toUpperCase();
  const [imgFailed, setImgFailed] = React.useState(false);

  if (!domain || imgFailed) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: 6, flexShrink: 0,
        background: color, color: "#fff",
        fontSize: size * 0.45, fontWeight: 700, letterSpacing: "-0.02em",
      }}>
        {initial}
      </span>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={name}
      width={size} height={size}
      style={{ borderRadius: 6, objectFit: "contain", flexShrink: 0, background: "#fff", padding: 2 }}
      onError={() => setImgFailed(true)}
    />
  );
}

// ─── Logic (unchanged) ────────────────────────────────────────────────────────
function computeAvailable(profile, tier, kind) {
  const T = window.TIERS;
  if (!tier) return { all: [], applied: [], admitted: new Set(), hit: false };
  const all = T.getSchoolsInTier(tier, kind);
  const admittedRaw = T.getAdmittedSchools(profile).map(T.normSchool);
  const admittedSet = new Set(admittedRaw);
  const hit = all.some(a => admittedSet.has(a.key));
  return { all, admitted: admittedSet, hit };
}

// ─── Phase3School ─────────────────────────────────────────────────────────────
function Phase3School({
  profile, universityTierPick, lacTierPick, noLacClaim,
  schoolSelections, setSchoolSelections, onReveal, onBack
}) {
  const uni = useMemo(() => computeAvailable(profile, universityTierPick, "uni"),
    [profile, universityTierPick]);
  const lac = useMemo(() => computeAvailable(profile, noLacClaim ? null : lacTierPick, "lac"),
    [profile, lacTierPick, noLacClaim]);

  function toggle(key) {
    setSchoolSelections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="fade-in" data-screen-label="03 Schools">
      <Stepper phase={3} />
      <ProfileCollapsedSummary profile={profile} onExpand={onBack} />

      <div className="section-head">
        <h2>Which ones did they get in?</h2>
        <span className="sub">Tap the schools you think were admits.</span>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: "var(--sp-3)", marginBottom: "var(--sp-4)" }}>
        <Badge kind="info">University tier · {universityTierPick}</Badge>
        {noLacClaim
          ? <Badge kind="info">LAC · Claimed no admit</Badge>
          : <Badge kind="info">LAC tier · {lacTierPick}</Badge>}
      </div>

      <SchoolSection
        title="Universities" subtitle={`Within ${universityTierPick}`}
        tier={universityTierPick} kind="uni"
        data={uni} selections={schoolSelections} onToggle={toggle}
      />

      <div style={{ height: "var(--sp-5)" }} />

      {noLacClaim ? (
        <div className="card">
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, letterSpacing: "-0.01em", marginBottom: "var(--sp-2)" }}>Liberal Arts Colleges</div>
          <div className="callout">
            <i className="ti ti-info-circle" />
            <div>You claimed this applicant was not admitted to any LAC. The LAC schools section is skipped — you'll be scored on that claim at the reveal.</div>
          </div>
        </div>
      ) : (
        <SchoolSection
          title="Liberal Arts Colleges" subtitle={`Within ${lacTierPick}`}
          tier={lacTierPick} kind="lac"
          data={lac} selections={schoolSelections} onToggle={toggle}
        />
      )}

      <div className="card" style={{ marginTop: "var(--sp-5)" }}>
        <div className="label" style={{ marginBottom: "var(--sp-2)" }}>Scoring</div>
        <div className="row" style={{ flexWrap: "wrap", gap: "var(--sp-5)", fontSize: "var(--fs-base)" }}>
          <span><i className="ti ti-check" style={{ color: "var(--accent-ok-fg)", marginRight: 6 }} />Correct selection <span style={{ color: "var(--accent-ok-fg)", fontFamily: "var(--font-mono)" }}>+10</span></span>
          <span><i className="ti ti-x" style={{ color: "var(--accent-danger-fg)", marginRight: 6 }} />Wrong selection <span style={{ color: "var(--accent-danger-fg)", fontFamily: "var(--font-mono)" }}>−2</span></span>
          <span><i className="ti ti-check" style={{ color: "var(--accent-ok-fg)", marginRight: 6 }} />Correct Uni tier <span style={{ color: "var(--accent-ok-fg)", fontFamily: "var(--font-mono)" }}>+10</span></span>
          <span><i className="ti ti-check" style={{ color: "var(--accent-ok-fg)", marginRight: 6 }} />Correct LAC tier <span style={{ color: "var(--accent-ok-fg)", fontFamily: "var(--font-mono)" }}>+10</span></span>
          <span><i className="ti ti-alert-triangle" style={{ color: "var(--accent-warn-fg)", marginRight: 6 }} />Wrong tier band <span style={{ color: "var(--accent-danger-fg)", fontFamily: "var(--font-mono)" }}>−5</span></span>
        </div>
        <div className="label" style={{ marginTop: "var(--sp-2)", color: "var(--text-tertiary)" }}>*−2 penalty only applies if the chosen tier band is correct.</div>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: "var(--sp-6)" }}>
        <Btn variant="ghost" onClick={onBack} icon="arrow-left">Change tiers</Btn>
        <div className="row" style={{ alignItems: "center", gap: "var(--sp-3)" }}>
          <span className="label" style={{ color: "var(--text-tertiary)" }} aria-live="polite">
            {schoolSelections.size} selected
          </span>
          <Btn onClick={onReveal} iconRight="sparkles" ariaLabel="Reveal results">Reveal results</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SchoolSection ────────────────────────────────────────────────────────────
function SchoolSection({ title, subtitle, tier, kind, data, selections, onToggle, extraOption }) {
  const extraActive = extraOption && selections.has(extraOption.key);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--sp-3)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, letterSpacing: "-0.01em" }}>{title}</div>
          <div className="label" style={{ marginTop: "var(--sp-1)" }}>{subtitle}</div>
        </div>
        <span className="label" style={{ color: "var(--text-tertiary)" }}>
          {data.all.length} schools in band
        </span>
      </div>

      {data.all.length === 0 ? (
        <div className="callout">
          <i className="ti ti-info-circle" />
          <div>No schools defined in this band — pick another tier to see options.</div>
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "var(--sp-2)", marginTop: "var(--sp-3)",
            opacity: extraActive ? 0.4 : 1,
            pointerEvents: extraActive ? "none" : "auto"
          }}
        >
          {data.all.map(a => {
            const selected = selections.has(a.key);
            return (
              <SchoolCard
                key={a.key}
                school={a}
                selected={selected}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      )}

      {extraOption && (
        <div
          className={"school-card" + (extraActive ? " is-selected" : "")}
          onClick={() => onToggle(extraOption.key)}
          role="button" tabIndex={0}
          aria-pressed={extraActive ? "true" : "false"}
          aria-label={extraOption.label}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(extraOption.key); } }}
          style={{ marginTop: "var(--sp-3)", borderStyle: "dashed", justifyContent: "flex-start", gap: "var(--sp-3)" }}
        >
          <span className="check">{extraActive ? <i className="ti ti-check" /> : null}</span>
          <div>
            <div className="name">{extraOption.label}</div>
            <div className="label" style={{ marginTop: "var(--sp-1)", color: "var(--text-tertiary)" }}>{extraOption.hint}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SchoolCard with logo ─────────────────────────────────────────────────────
function SchoolCard({ school, selected, onToggle }) {
  const [pressed, setPressed] = React.useState(false);
  const domain = getSchoolDomain(school.name);

  function handleClick() {
    setPressed(true);
    setTimeout(() => setPressed(false), 220);
    onToggle(school.key);
  }

  return (
    <div
      className={"school-card" + (selected ? " is-selected" : "")}
      onClick={handleClick}
      role="button" tabIndex={0}
      aria-pressed={selected ? "true" : "false"}
      aria-label={`${selected ? "Deselect" : "Select"} ${school.name}`}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      style={pressed ? {
        transform: "scale(0.97)",
        transition: "transform 150ms cubic-bezier(.34,1.56,.64,1)",
      } : undefined}
    >
      <SchoolLogo name={school.name} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {school.name}
        </div>
        {domain ? (
          <div className="label" style={{ marginTop: "var(--sp-1)", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {domain}
          </div>
        ) : null}
      </div>
      <span className="check" style={{ flexShrink: 0 }} aria-hidden="true">
        {selected ? <i className="ti ti-check" /> : null}
      </span>
    </div>
  );
}

Object.assign(window, { Phase3School, computeAvailable, SchoolLogo, getSchoolDomain, getSchoolColor });
