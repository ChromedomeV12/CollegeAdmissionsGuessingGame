// Tier lookup tables + name normalization

const UNI_TIER_LIST = ["HYPSM", "T10", "T15", "T20", "T30", "T50"];
const LAC_TIER_LIST = ["T5 LAC", "T10 LAC", "T20 LAC"];

// US News National Universities rankings, recent edition (approximate).
// Bands are exclusive — each school appears in exactly one band.
const UNI_TIERS_RAW = {
  HYPSM: ["Harvard", "Yale", "Princeton", "Stanford", "MIT"],
  T10:   ["Northwestern", "UPenn", "UChicago", "Duke", "Johns Hopkins"],
  T15:   ["Caltech", "Cornell", "Brown", "Dartmouth", "Columbia", "UC Berkeley"],
  T20:   ["UCLA", "Notre Dame", "Rice", "Vanderbilt", "University of Michigan", "Washington University in St. Louis", "Carnegie Mellon"],
  T30:   ["Emory", "Georgetown", "USC", "UVA", "NYU", "UNC Chapel Hill", "University of Florida"],
  T50:   ["Georgia Tech", "UT Austin", "UC San Diego", "Wake Forest", "Boston College", "UC Davis", "UC Irvine", "UIUC", "William & Mary", "Tufts", "University of Rochester", "UC Santa Barbara", "University of Wisconsin", "Boston University", "Lehigh", "Northeastern", "Tulane", "University of Maryland", "University of Washington", "Villanova"]
};

const LAC_TIERS_RAW = {
  "T5 LAC":  ["Williams", "Amherst", "Swarthmore", "Pomona", "Wellesley"],
  "T10 LAC": ["Bowdoin", "Carleton", "Claremont McKenna", "Middlebury", "Haverford"],
  "T20 LAC": ["Vassar", "Colby", "Grinnell", "Hamilton", "Harvey Mudd", "Wesleyan", "Smith", "Davidson", "Barnard"]
};

const TIER_RANGE = {
  HYPSM: "Ranks 1-5",
  T10:   "Ranks 6-10",
  T15:   "Ranks 11-15",
  T20:   "Ranks 16-20",
  T30:   "Ranks 21-30",
  T50:   "Ranks 31-50",
  "T5 LAC":  "LAC ranks 1-5",
  "T10 LAC": "LAC ranks 6-10",
  "T20 LAC": "LAC ranks 11-20"
};

// Common aliases — left side is canonical (matches tier table), right is alt
const ALIASES = {
  "berkeley": "uc berkeley",
  "cal": "uc berkeley",
  "penn": "upenn",
  "university of pennsylvania": "upenn",
  "michigan": "university of michigan",
  "umich": "university of michigan",
  "u of m": "university of michigan",
  "wustl": "washington university in st. louis",
  "wash u": "washington university in st. louis",
  "washu": "washington university in st. louis",
  "cmu": "carnegie mellon",
  "ga tech": "georgia tech",
  "gatech": "georgia tech",
  "u chicago": "uchicago",
  "univ of chicago": "uchicago",
  "university of chicago": "uchicago",
  "hopkins": "johns hopkins",
  "jhu": "johns hopkins",
  "ucsb": "uc santa barbara",
  "ucsd": "uc san diego",
  "ucd": "uc davis",
  "uci": "uc irvine",
  "bu": "boston university",
  "bc": "boston college",
  "uva": "uva",
  "u virginia": "uva",
  "university of virginia": "uva",
  "unc": "unc chapel hill",
  "u of florida": "university of florida",
  "uf": "university of florida",
  "u texas": "ut austin",
  "ut": "ut austin",
  "ut-austin": "ut austin",
  "uiuc": "uiuc",
  "u illinois": "uiuc",
  "illinois": "uiuc",
  "u washington": "university of washington",
  "uw": "university of washington",
  "u wisconsin": "university of wisconsin",
  "wisconsin": "university of wisconsin",
  "u maryland": "university of maryland",
  "umd": "university of maryland",
  "william and mary": "william & mary",
  "wm": "william & mary",
  "caltech": "caltech"
};

function normSchool(name) {
  if (!name) return "";
  let n = String(name).toLowerCase().trim();
  // strip trailing "university" / "college" only if it changes hits
  if (ALIASES[n]) n = ALIASES[n];
  return n;
}

// Build exclusive-tier sets (each tier contains only its own band).
// Stores both display names and normalized keys for direct rendering.
function buildExclusive(raw, order) {
  const out = {};
  const list = {};
  for (const t of order) {
    out[t] = new Set(raw[t].map(normSchool));
    list[t] = raw[t].map(name => ({ key: normSchool(name), name }));
  }
  return { sets: out, lists: list };
}

const UNI_BUILT = buildExclusive(UNI_TIERS_RAW, UNI_TIER_LIST);
const LAC_BUILT = buildExclusive(LAC_TIERS_RAW, LAC_TIER_LIST);

const UNI_CUMULATIVE = UNI_BUILT.sets;
const LAC_CUMULATIVE = LAC_BUILT.sets;

function getSchoolsInTier(tier, kind) {
  if (kind === "uni") return UNI_BUILT.lists[tier] || [];
  return LAC_BUILT.lists[tier] || [];
}

// All-tier sets — union of every tier band — used to detect whether a
// school is "in the LAC universe" vs "in the university universe".
function unionAll(byTier) {
  const u = new Set();
  for (const s of Object.values(byTier)) for (const n of s) u.add(n);
  return u;
}
const ALL_UNI_SET = unionAll(UNI_CUMULATIVE);
const ALL_LAC_SET = unionAll(LAC_CUMULATIVE);

function schoolInTier(schoolName, tier, kind /* "uni" | "lac" */) {
  const table = kind === "uni" ? UNI_CUMULATIVE : LAC_CUMULATIVE;
  if (!table[tier]) return false;
  return table[tier].has(normSchool(schoolName));
}

function schoolKind(schoolName) {
  const n = normSchool(schoolName);
  if (ALL_LAC_SET.has(n)) return "lac";
  if (ALL_UNI_SET.has(n)) return "uni";
  return null;
}

// Build the "admit set" — every school the applicant got into.
// Includes accepted[] and waitlisted[] entries whose decision_type contains "Accepted".
function getAdmittedSchools(profile) {
  const r = profile.application_results || {};
  const admits = [];
  for (const s of r.accepted || []) admits.push(s.school);
  for (const s of r.waitlisted || []) {
    if (s.decision_type && s.decision_type.includes("Accepted")) admits.push(s.school);
  }
  return admits;
}

// Every school the applicant *applied* to (any decision).
function getAppliedSchools(profile) {
  const r = profile.application_results || {};
  const applied = new Map(); // normName -> displayName
  const push = (s) => {
    const k = normSchool(s.school);
    if (!applied.has(k)) applied.set(k, s.school);
  };
  for (const s of r.accepted || [])   push(s);
  for (const s of r.rejected || [])   push(s);
  for (const s of r.waitlisted || []) push(s);
  return [...applied.entries()].map(([k, name]) => ({ key: k, name }));
}

window.TIERS = {
  UNI_TIER_LIST, LAC_TIER_LIST, TIER_RANGE,
  UNI_CUMULATIVE, LAC_CUMULATIVE,
  normSchool, schoolInTier, schoolKind,
  getAdmittedSchools, getAppliedSchools,
  getSchoolsInTier
};
