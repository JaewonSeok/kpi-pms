# Working Rules

Last updated: 2026-04-10

## Read Order Before Any New Work

1. Read `docs/operations/working-rules.md`.
2. Read `docs/operations/current-handoff.md`.
3. Read `README.md`.
4. If the task touches AI features, read `docs/ai-assistant-operations.md`.
5. If the task changes product scope or backlog priority, read `docs/product/implementation-backlog.md`, `docs/product/global-benchmark-gap-analysis.md`, and `docs/product/implementation-roadmap-world-class.md`.
6. Before release or handoff, read `docs/operations/release-readiness.md`.

## Core Repo Rules

- Use `pnpm` as the primary package manager.
- Prefer targeted verification while developing, then run broader checks before release.
- Keep write paths in route handlers or server-side code.
- Validate request bodies with Zod.
- Keep shared UI copy in Korean.
- Keep code, comments, and tests in English.
- Do not leave visible routes empty; prefer a fallback-safe shell.
- When building workflow pages, design `data model`, `permissions`, `state transitions`, and `audit log` together.
- Mobile support should prioritize viewing, approval, and touch-safe actions.

## AI Feature Rules

- OpenAI usage stays server-side.
- Use Responses API + structured output schemas.
- Save request history in `AiRequestLog`.
- AI output is preview-first and approval-based.
- Fallback behavior must keep the UI usable when AI is disabled or fails.
- Do not send direct PII such as names, emails, employee ids, target ids, or evaluator ids to the AI provider.

## Release / Verification Rules

- Baseline checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Release checklist and operational smoke tests live in `docs/operations/release-readiness.md`.
- Admin release flow and incident steps live in `docs/operations/admin-runbook.md`.

## Continuation Rules For New Chats

- Start by checking `git status --short`.
- Do not revert existing user changes unless explicitly asked.
- Treat untracked temp files carefully; confirm before deleting them.
- If you continue the calibration session setup work, run:
  - `pnpm test:calibration-ops`
  - `pnpm typecheck`
  - targeted `eslint` on touched files
- Update `docs/operations/current-handoff.md` whenever the focus or remaining work changes materially.
