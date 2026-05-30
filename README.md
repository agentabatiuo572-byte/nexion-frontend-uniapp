# Nexion uni-app

Nexion App native baseline built with uni-app, Vue 3, TypeScript and Pinia.

This repository is the formal App implementation line. `D:\workspace\nexion-frontend-app`
is retained as the high-fidelity Next.js prototype and visual reference only; do
not wire full backend business flows in both projects.

## Development

```bash
npm install
npm run dev:h5
```

H5 development uses `VITE_NEXION_API_BASE_URL=/api` and Vite proxies `/api` to `http://127.0.0.1:8090`.

For App packaging, set `VITE_NEXION_API_BASE_URL` to the reachable Gateway address for the device or emulator.

## Page QA Gate

Every completed uni-app page must pass the visual QA gate before moving to the
next page:

1. Locate the matching Next.js prototype page in `D:\workspace\nexion-frontend-app`.
2. Implement the uni-app page against real Gateway APIs.
3. Run `npm run type-check` and `npm run build:h5`.
4. Open both pages with the same account and data state, capture screenshots,
   and compare layout, spacing, color, typography, images, states and i18n text.
5. Write a QA report from `docs/page-qa-template.json`.
6. Run `npm run qa:page -- <report-file>`.

The page is accepted only when the total score is at least 95/100.

Scoring:

- Visual fidelity: 35
- Interaction completeness: 25
- Backend integration: 25
- App adaptation: 15

## Implemented

- User login: `POST /api/auth/users/login`
- User register: `POST /api/auth/users/register`
- Local session storage: token, userId, nickname, referralCode, userLevel, vRank
- Launch, login, register, home placeholder and me placeholder pages

OTP, forgot password and third-party login are intentionally not implemented until backend endpoints exist.
