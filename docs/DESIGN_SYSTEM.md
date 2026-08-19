# Admissions Oracle design system

## Direction

- **Purpose:** make dense applicant evidence readable, playful, and trustworthy without exposing answers before a scoring attempt is final.
- **Tone:** an editorial admissions dossier over restrained macOS-like sculpted paper/cloth relief—not a casino, generic dashboard, neon grid, or contour map.
- **Constraints:** no-build React, responsive from 320px, WCAG AA contrast, visible keyboard focus, practical 44px touch targets, and reduced-motion support.
- **Product hierarchy:** signed-in Home → applicant file → tier claims → school predictions → gated reveal → permanent practice/Correct choices.

Player-facing submission surfaces no longer exist. Consent import is disabled-by-default maintainer tooling and does not belong in the game navigation or component language.

## Tokyo palettes

`public/styles-v2.css` is the source of truth. Use the existing tokens; do not introduce unrelated literal colors for themed UI.

| Role | Tokyo Night | Tokyo Day |
|---|---|---|
| Canvas | `#1a1b26` | `#e1e2e7` |
| Foreground | `#c0caf5` | `#343b58` |
| Comment / tertiary | `#565f89` | `#848cb5` |
| Blue action | `#7aa2f7` | `#2e7de9` |
| Magenta | `#bb9af7` | `#9854f1` |
| Cyan / info | `#7dcfff` | `#00719c` |
| Green / completion | `#9ece6a` | `#587539` |
| Yellow / warning | `#e0af68` | `#8c6c3e` |
| Red / decision | `#f7768e` | `#f52a65` |

Intermediate surfaces, borders, tints, and shadows derive from these anchors with `color-mix()`. The persistent theme key is `localStorage.ao_theme`.

## Surfaces and depth

- Semantic cards and the topbar use matte glass: `blur(12px) saturate(125%)`, high Tokyo-surface opacity, token borders, and theme-specific shadows.
- The film layer is `body::after`: monochrome fractal grain plus a quiet matte veil, `soft-light` at `.20` Night / `.13` Day. It has no backdrop blur.
- Required stack: sculpted wallpaper → film/grain → `#root` → glass surfaces. Film must texture the wallpaper without making cards equally noisy.
- Cards keep squared dossier geometry (3/5/8px radii), not inflated floating pills. Pills are reserved for chips/badges.
- The completed menu check is `.check.is-complete`; Tokyo Day computed green must be `rgb(88, 117, 57)` (`#587539`). Status also uses the Practice label, so it never relies on color alone.

## Sculpted wallpaper

- `ambient-waves.js` renders six broad overlapping organic folds with crest highlights and deep valley shadows.
- Motion: one slow ≥45-second breathing cycle, scroll parallax clamped to 64px, pointer parallax clamped to 8px, approximately 30fps, paused while hidden.
- `prefers-reduced-motion` renders one static frame with no scroll/pointer/time loop.
- The full-viewport six-layer SVG fallback remains visible until a successful WebGL frame marks `data-wave-rendered="true"`.
- Every wallpaper/fallback layer is fixed, clipped, pointer-events-none, and must create zero horizontal overflow.
- Prohibited regressions: grids, particles, rotating shapes, contour/topographic lines, high-frequency noise flicker, and neon wave language.

## Core components

- signed-in Home hero with rules, authorship, GitHub, and Play;
- single-row desktop topbar during active rounds;
- compact four-step progress rail;
- applicant file cards with Unplayed / score / Practice states;
- profile evidence tabs plus post-finalization Correct choices;
- two tier panels, each supporting either a band or an explicit no-admit claim;
- school decision cards and skipped-category callouts;
- aggregate-only first reveal with five-second retry;
- finalized result ledger and decision banner;
- aligned global leaderboard grid and rivalry/shared-case duel panel.

## Reveal and disclosure contract

The first scoring reveal may show only Case score, Accuracy, Time, and Retry case. Do not render tier results, school outcomes, final decision, teaching points, or rank detail behind CSS; omit them from the DOM until finalization. The retry attempt is final. Practice rounds show full details immediately and never write a score.

## Accessibility contract

- All actionable controls are keyboard reachable and expose state (`aria-pressed`, disabled state, labels) where applicable.
- `:focus-visible` uses the themed two-ring `--focus-ring`.
- No status relies on color alone.
- Body text targets at least 4.5:1 contrast and UI boundaries at least 3:1.
- Controls target 44px or greater where practical.
- Essential headings and answer-state labels are DOM content, not generated CSS.
- Responsive checks target 375, 768, 1024, 1440, and 1600px. Desktop active-round topbar must stay one row; every viewport must have zero horizontal overflow.

## Verification assets

- `test/design-contrast.json` defines the foreground/background pairs asserted by `test/design-contrast.test.js`.
- `AGENT_CHECKLIST.md` defines the browser visual, disclosure, theme, wallpaper, and responsive acceptance checks.
- `e2e_test.cjs` covers Home/theme persistence, reveal gating, retry/finalization, practice/Correct choices, and global leaderboard structure.
