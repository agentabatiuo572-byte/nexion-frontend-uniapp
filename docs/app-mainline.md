# Nexion App Mainline

## Project Roles

- `D:\workspace\nexion-frontend-app`: Next.js high-fidelity prototype, visual
  and interaction reference only.
- `D:\workspace\nexion-frontend-uniapp`: formal App delivery line for backend
  integration, H5 verification and iOS/Android packaging.

Backend integration must happen in the uni-app project. The Next.js prototype
should not be expanded into a second production client, otherwise every API,
state and i18n rule has to be maintained twice.

## Per-page Implementation Rule

For every new App page:

1. Find the corresponding Next.js route, components and assets.
2. Record the prototype route and uni-app route in a QA report.
3. Implement the uni-app page with real Gateway APIs and the same data state.
4. Include loading, empty, error and permission states when the page needs them.
5. Verify H5 first, then run App build when the page affects native packaging.
6. Compare screenshots and score the page before starting the next page.

## Acceptance Rule

The page passes only when the final score is at least 95/100:

| Category | Max |
| --- | ---: |
| Visual fidelity | 35 |
| Interaction completeness | 25 |
| Backend integration | 25 |
| App adaptation | 15 |

If the score is below 95, fix the uni-app page and rerun the same report.

## Required Evidence

Each accepted page should keep a JSON report based on
`docs/page-qa-template.json`. Screenshot paths must be absolute paths so they
can be opened from Codex Desktop.

