# Admissions Oracle interface direction

## Design brief

- **Purpose:** make evidence-heavy applicant profiles feel readable, playful, and trustworthy for players while giving post owners a clear consent surface.
- **Tone:** editorial admissions dossier with a civic-tech edge. The interface should feel like a modern reading room, not a casino, luxury product, or generic dashboard.
- **Constraints:** existing no-build React architecture, responsive from 375px upward, WCAG AA contrast, visible keyboard focus, 44px primary touch targets, and reduced-motion support.
- **Memorable device:** squared file-card surfaces, the cobalt crosshair mark, and a red decision signal that moves through the four-step reading workflow.

The redesign preserves the tested information architecture and scoring flow while replacing the previous dark gold visual language.

## Tokens

| Role | Value |
|---|---|
| Canvas | `#eef4fa` |
| Ink | `#10243e` |
| Surface | `#ffffff` |
| Primary action | `#2457f5` |
| Decision signal | `#ce3b27` |
| Body text | `#10243e` |
| Secondary text | `#3d5873` |
| Border | `#b7c8d9` |
| Success | `#0a6848` on `#e0f4ea` |
| Warning | `#765000` on `#fff2cf` |
| Danger | `#922d25` on `#fde9e7` |

Typography:

- display: Space Grotesk, 500–700
- body: DM Sans, 400–700
- data and labels: IBM Plex Mono, 400–600

Spacing follows a 4/8-point scale. Cards use 5–8px radii, one-pixel borders, and offset shadows rather than floating blur. Motion is limited to one page-entry reveal and short 190ms interaction feedback.

## Core components

- sticky dossier top bar
- compact four-segment progress rail
- file-card applicant library
- metric cards and evidence tables
- tier and school decision cards
- result ledger and final decision banner
- owner-submission hero, consent card, proof path, and private queue records

## Accessibility contract

- all actionable controls are keyboard reachable;
- `:focus-visible` receives a cobalt ring with a white separator;
- no status relies on color alone;
- body text targets at least 4.5:1 contrast and UI boundaries at least 3:1;
- controls target 44px or greater where practical;
- the interface respects `prefers-reduced-motion`;
- essential headings are DOM content, not generated CSS content;
- responsive checks target 375, 768, 1024, and 1440px widths.
