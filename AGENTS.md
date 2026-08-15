# Project Instructions

## UniApp GitHub Sync Rules

- After each completed task, sync (commit + push) to GitHub automatically without asking; state the pushed range in the wrap-up report. (Owner decision 2026-08-15 — supersedes the old ask-first rule.)
- Before pushing, check local vs remote differences (`git fetch` + compare).
- Only stop to ask when the push would overwrite remote-only commits (non-fast-forward); fast-forward pushes need no confirmation. Never force-push without explicit user confirmation.
- Do not create a new branch unless the user asks for one.
