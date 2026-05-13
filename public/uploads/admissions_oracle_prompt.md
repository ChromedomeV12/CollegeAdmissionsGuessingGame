# Admissions Oracle — Implementation Prompt

## Overview

Build a **React** artifact: a college admissions guessing game called **Admissions Oracle**. The game fetches structured applicant profiles from a `.jsonl` data source, shows users the student's background, and challenges them to predict admissions outcomes through a two-part tier guessing system. Use the Anthropic claude.ai design system throughout (CSS variables, Tabler outline icons, flat surfaces, no gradients/shadows).

---

## Data Format

Each record in the `.jsonl` file is one applicant. The relevant fields are:

```json
{
  "id": "cr_2026_001",
  "source": { "subreddit": "collegeresults", "post_date": "..." },
  "demographics": {
    "gender": "Male", "ethnicity": "East Asian",
    "school_type": "Private Boarding School", "school_region": "New England",
    "school_classification": "Feeder School", "ses": "High Income",
    "first_generation": false, "legacy_status": true
  },
  "test_scores": {
    "sat": {
      "superscore_total": 1550,
      "superscore_breakdown": { "math": 790, "ebrw": 760 },
      "test_dates": [{ "total": 1530, "math": 790, "ebrw": 740 }, ...]
    },
    "act": null,
    "ap_scores_count": 11
  },
  "academic_profile": {
    "gpa": { "unweighted": 3.5, "unweighted_scale": "90/100" },
    "course_rigor": {
      "total_ap_courses": 11,
      "total_honors_courses": 4,
      "total_post_ap_courses": 9,
      "courses_by_year": {
        "9th": [{ "name": "AP Computer Science A", "level": "AP", "score": 5 }, ...],
        "10th": [...], "11th": [...], "12th": [...]
      },
      "course_load_notes": "..."
    }
  },
  "extracurriculars": [
    {
      "id": 1, "category": "Research/Internship", "title": "...",
      "description": "...", "achievements": ["..."], "tier": 1
    },
    ...
  ],
  "application_results": {
    "rejected": [{ "school": "Harvard", "decision_type": "EA -> Deferral -> Reject", "notes": "Family connection" }, ...],
    "accepted": [{ "school": "UCSC", "notes": "Dean's Award ~$60k" }, ...],
    "waitlisted": [{ "school": "UChicago", "decision_type": "Waitlist -> Accepted", "notes": "Accepted April 1" }, ...],
    "final_decision": { "school": "UChicago", "decision_date": "2026-04-01" }
  },
  "game_metadata": {
    "difficulty_level": "Hard",
    "actual_school_tier": "Top 10",
    "teaching_points": ["...", "..."],
    "hints": { "easy": [...], "medium": [...], "hard": [...] }
  }
}
```

The frontend should load this `.jsonl` by fetching the raw file (or accept it as a prop/inline constant for the artifact). Parse it by splitting on newlines and `JSON.parse`-ing each non-empty line to get an array of profiles.

---

## Tier System (Hardcoded Lookup Tables)

### University Tiers (US News Rankings)

The game uses five cumulative tiers — each tier **includes all schools from the tier(s) above it**:

| Tier Label | Schools Included |
|---|---|
| **HYPSM** | Harvard, Yale, Princeton, Stanford, MIT |
| **T10** | HYPSM + Columbia, UChicago, UPenn, Duke, Johns Hopkins |
| **T20** | T10 + Dartmouth, Brown, Rice, Northwestern, Vanderbilt, Notre Dame, Cornell, Washington University in St. Louis |
| **T30** | T20 + Emory, Georgetown, Carnegie Mellon, UCLA, UC Berkeley, USC, NYU, University of Michigan |
| **T50** | T30 + Boston University, Tufts, Tulane, UC San Diego, UC Santa Barbara, UC Davis, UC Irvine, Boston College, George Washington, Wake Forest, Lehigh, Villanova, Northeastern, University of Florida, University of Rochester, Case Western Reserve, Rensselaer Polytechnic |

Cumulative means: if a player picks **T20**, and the student got into Brown (a T20 school), that counts as a tier hit.

### LAC Tiers (US News Liberal Arts Rankings)

Similarly cumulative:

| Tier Label | Schools Included |
|---|---|
| **T5 LAC** | Williams, Amherst, Swarthmore, Pomona, Wellesley |
| **T10 LAC** | T5 LAC + Bowdoin, Carleton, Claremont McKenna, Middlebury, Haverford |
| **T20 LAC** | T10 LAC + Vassar, Colby, Grinnell, Hamilton, Harvey Mudd, Wesleyan, Smith, Davidson, Barnard |

---

## Game Flow (5 Phases)

### Phase 1 — Profile Viewer

Display the applicant's full profile in a tabbed card layout with three tabs:

**Overview tab:** Demographics table — gender, ethnicity, school type, school region, income level, legacy status (shown as a badge), first-gen status.

**Academics tab:**
- Three metric cards at the top: SAT superscore, GPA (unweighted), Rigor (X APs + Y post-AP)
- AP Score Breakdown chart: horizontal bar chart (with a bar/donut toggle) showing individual AP courses and their scores. Courses with a null score are shown as "pending" in a faded grey bar. Scored APs use color tiers: score 5 = teal (#1D9E75), score 4 = blue (#378ADD), score 3 = amber (#EF9F27). Below the chart show a year-by-year course history table.
- If `act` is non-null, show an ACT card as well.

**Extracurriculars tab:** Numbered list, sorted by `tier` ascending (tier 1 = most impressive). Show `title` as the main text, `description` beneath it in muted style, and `achievements` as indented bullet points. Show the EC `tier` as a small badge (tier 1 = teal, tier 2 = blue, tier 3 = amber, tier 4 = grey).

At the bottom of the profile viewer, show the `game_metadata.teaching_points` in a collapsed "Context" section (toggle open/close). Show `game_metadata.difficulty_level` as a badge in the header (Easy = green, Medium = amber, Hard = red/coral).

A persistent "Start guessing →" button in the top-right advances to Phase 2.

---

### Phase 2 — Tier Selection

Show a two-panel selection UI **below** the profile viewer (profile remains visible and scrollable above).

**Panel A — University Tier:** A horizontal row of 5 pill buttons labeled: `HYPSM`, `T10`, `T20`, `T30`, `T50`. The player selects **exactly one**. Selecting a new option deselects the previous. Include a one-line description under each button showing roughly what rank range it represents (e.g., "Ranks 1–5", "Ranks 1–10", etc.).

**Panel B — LAC Tier:** A horizontal row of 3 pill buttons: `T5 LAC`, `T10 LAC`, `T20 LAC`. Same single-select behavior. Include the note: "LACs are ranked on a separate US News list."

Show a small informational callout: *"Select the highest tier you think this applicant was admitted to. Your choices unlock the school list — pick carefully."*

A **"Lock in predictions →"** button is active only when both a university tier and a LAC tier are selected. Clicking it advances to Phase 3.

---

### Phase 3 — School Selection

This phase has two sections that are computed automatically.

**University section:** Check if ANY school in `application_results.accepted` or `application_results.waitlisted` (where `decision_type` contains "Accepted") falls in the university tier lookup table at or below the player's chosen tier. 

- If **hit**: Show a grid of all university schools within the player's chosen tier that this applicant *applied to* (i.e., appear in any of accepted/rejected/waitlisted). The player clicks each school card to toggle whether they think the applicant **got in** (accepted or waitlisted-then-accepted). Unselected = neutral. Selected = highlighted green with a checkmark icon.
- If **miss**: Show a muted callout: *"No matches found in this tier — your university tier selection won't earn points."*

**LAC section:** Same logic, but for the LAC tier lookup table.

Scoring rules displayed as a small legend:
- ✓ Correct school selected → **+10 pts**
- ✗ Wrong school selected → **−5 pts**
- School not selected → **0 pts** (no penalty)

A **"Reveal results →"** button is always active (player can reveal without selecting any schools — all skipped schools earn 0).

---

### Phase 4 — Results Reveal

**Score Summary:** Two metric cards: "Points earned" and "Accuracy %". Animate the score counting up from 0.

**Tier Result:**
- University tier: Show whether their tier choice was a hit or miss. If hit, list the matching schools. If miss, show the actual tier the student achieved.
- LAC tier: Same.

**School-by-school breakdown:** For all schools the player saw and could select:
- Green check + school name + "accepted" badge → if player correctly selected it
- Red X + school name → if player incorrectly selected it (school was actually rejected)
- Grey dash + school name + "accepted" badge → if player left it unselected but it was a correct answer (missed opportunity)
- Grey dash + "not selected, not admitted" → correctly skipped

**Teaching Points:** After the breakdown, show the `game_metadata.teaching_points` as a highlighted info block.

**Final Decision banner:** Always show at the bottom — *"This applicant enrolled at [final_decision.school], admitted on [final_decision.decision_date]."*

A **"Try again →"** button resets to Phase 1 with the same profile, and a **"Next profile →"** button loads the next profile in the `.jsonl` array.

---

## Scoring Logic

```
score = 0
for each school the player selected:
  if school is in applicant's accepted/waitlisted-accepted list:
    score += 10
  else:
    score -= 5
for each school the player did NOT select:
  score += 0  (no change)
```

Tier selection itself does not directly add/subtract points — it only determines *which schools are shown* in Phase 3. A missed tier means fewer schools visible, so the player loses the opportunity to earn points on those schools.

---

## Technical Notes

- **Profile loading:** Inline the `.jsonl` data as a JS constant string, then parse it: `const profiles = data.trim().split('\n').map(line => JSON.parse(line))`. 
- **School name normalization:** When matching `application_results` school names to the tier lookup table, use case-insensitive comparison and handle common aliases (e.g., "Berkeley" = "UC Berkeley", "UPenn" = "University of Pennsylvania").
- **Waitlist → Accepted:** Treat any school in `waitlisted` where `decision_type` includes "Accepted" as an accepted school for tier/scoring purposes.
- **State:** Track `{ phase, profileIdx, universityTierPick, lacTierPick, schoolSelections: Set }` in React `useState`.
- **No `localStorage`, no external fetch** — all data lives in the artifact as an inline constant.
- **Responsive:** The profile tabs and tier buttons should wrap cleanly on narrow widths.
- **Animations:** Subtly animate phase transitions (fade-in on mount using CSS `@keyframes`). Animate the score counter on reveal.

---

## Design System Constraints

- Use only CSS variables: `--color-text-primary/secondary/tertiary`, `--color-background-primary/secondary`, `--color-border-tertiary/secondary`, `--color-background-success/danger/warning`, etc.
- Tabler outline icons via `<i className="ti ti-NAME" />` (already loaded). Use `ti-check`, `ti-x`, `ti-minus`, `ti-chevron-down`, `ti-school`, `ti-trophy`, `ti-info-circle`.
- No hardcoded hex colors except inside the AP chart bars (teal #1D9E75, blue #378ADD, amber #EF9F27) which are data-semantic.
- No gradients, shadows, or blur.
- Font sizes: body 13–14px, metric values 20–28px, labels 11px uppercase. Weights: 400 regular, 500 bold only.
- Cards: `background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 1rem 1.25rem`.
- Pill buttons (tier selectors): `border: 0.5px solid var(--color-border-tertiary); border-radius: 999px; padding: 6px 16px; font-size: 13px`. Active state: `border: 2px solid var(--color-border-info); background: var(--color-background-info); color: var(--color-text-info)`.
- Sentence case everywhere. No ALL CAPS except 11px label elements.
