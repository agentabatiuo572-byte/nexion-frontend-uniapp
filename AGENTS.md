# Project Instructions

## Main-only owner decision (2026-09-05)

- The only retained branch is `main`, locally and on GitHub. This supersedes the `UniApp` branch name and the package-branch workflow below.
- The owner explicitly authorized publishing the current local source directly over remote `main` for the 2026-09-05 consolidation. Back up old refs and dirty files first; use an exact `--force-with-lease`, never an unconditional force.
- This consolidation is an explicitly authorized mainline-commit exception. Keep the existing audited exception mechanism, secret checks, and verification requirements; do not use `--no-verify`.
- Do not recreate `UniApp`, `pkg/*`, or `codex/*` branches without a new explicit owner instruction.

## UniApp GitHub Sync Rules

- After each completed task, sync (commit + push) to GitHub automatically without asking; state the pushed range in the wrap-up report. (Owner decision 2026-08-15 — supersedes the old ask-first rule.)
- Before pushing, check local vs remote differences (`git fetch` + compare).
- Only stop to ask when the push would overwrite remote-only commits (non-fast-forward); fast-forward pushes need no confirmation. Never force-push without explicit user confirmation.
- Do not create a new branch unless the user asks for one.

## Mainline gates in git (owner decisions 2026-08-17 / 2026-08-19; wired 2026-09-02)

- 🔴 On the mainline branch `UniApp`, only an **S-level** commit may land directly: ≤5 staged files, nothing under `docs/changes/`, and no unpushed commits already on the mainline. Anything bigger goes to a `pkg/<letter>-<slug>` (or `codex/<topic>`) branch and is merged back. Enforced by `.githooks/pre-commit` → `guard-mainline-commit.mjs`.
- 🔴 A push to `UniApp` is accepted only if the **exact commit being pushed** has a green **full** verify: after your last commit, with a clean tree, run `npm run verify` (writes `.verify-cache/last-run.json`), then push. Enforced by `.githooks/pre-push` → `verify-before-push.mjs`. Known, ledgered red steps live in `scripts/known-red.json` (each with a reason and an expiry) and do not turn the verdict red.
- Hooks are installed by `npm install` (the `prepare` script sets `core.hooksPath=.githooks`); manual: `git config core.hooksPath .githooks`. Self-test: `npm run test:githooks`.
- If this environment cannot run the full verify (no browser / no deps), do NOT push to `UniApp`: push to a `codex/<topic>` branch and say so in the wrap-up.
- Escape valves leave a trace and are for explicit owner orders only: `ALLOW_MAIN_COMMIT="<reason>" git commit …` (`.verify-cache/commit-valve.log`), `ALLOW_UNVERIFIED_PUSH="<reason>" git push …` (`.verify-cache/push-valve.log`). `--no-verify` leaves no trace — do not use it.
