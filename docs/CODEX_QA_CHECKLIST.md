# Codex QA Checklist

Last updated: 2026-06-16

Use this checklist after changes. Pick the smallest set that covers the risk. For production checks, verify only unless the user explicitly approves an operation.

## Basic Preflight

Before edits:

```bash
git status --short
git branch --show-current
git log --oneline -10
```

If unrelated dirty files exist, do not touch them. Never use `git add .`.

## Smoke Test Route List

Core MBO opening routes:

- `/evaluation/performance`
- `/kpi/personal`
- `/kpi/monthly`
- `/admin/evaluation-ops`
- `/admin/performance-assignments`
- `/admin/evaluation-readiness`
- `/evaluation/workbench`

Other protected route samples:

- `/kpi/org`
- `/evaluation/results`
- `/evaluation/appeal`
- `/evaluation/ai-competency`
- `/evaluation/360`
- `/evaluation/upward/admin`
- `/admin/department-score-intake`
- `/admin/preview-2026-grade`

Expected unauthenticated shell result for protected routes:

- `307` redirect to `/login?error=SessionRequired`, or `401` where API-like protection applies.
- No `500`.
- No Prisma schema errors.

## Role-Based Browser Checks

### HR/Admin

Check:

- `/evaluation/performance` opens and shows HR dashboard/process guide.
- `/admin/evaluation-ops` opens and shows MBO/KPI operations links first.
- `/admin/evaluation-readiness` shows baseline/readiness, policyCategory resolver, official write guard.
- `/admin/performance-assignments` shows evaluator assignment readiness. Do not click sync/save.
- `/admin/department-score-intake` is admin-only and not part of basic MBO demo unless requested.
- No official score/grade/finalization/backfill/apply control is presented as a normal action.

### Employee/Member

Check:

- `/kpi/personal` opens.
- KPI/MBO create path is understandable.
- Fields include KPI name, definition, formula/evaluation criteria, T/E/S targets, unit, weight, policyCategory where applicable, linked org KPI, tags where current UI supports them.
- Submit/request approval path is visible but do not click in production.
- `/kpi/monthly` shows monthly result/evidence/comment flow.
- No official scoring/grade controls are visible.

### Leader/Manager

Check:

- `/kpi/personal?tab=review` or in-page review tab is reachable.
- Submitted KPI review queue/detail is understandable if data exists.
- Return/confirm controls are visible but not clicked in production smoke.
- AI midcheck coach visibility matches role rules.

### Developer/Watch

Check:

- Stable alias target and deployment status if production is involved.
- Recent logs for `500`, `P2021`, `P2022`, `PrismaClientKnownRequestError`, `JWT_SESSION_ERROR`, `Evaluation.totalScore`, `Evaluation.gradeId`, `backfill`, `official scoring`, `official grade`, `feature flag`.
- Do not mutate production data.

## KPI Input Checklist

Personal KPI:

- T/E/S targets are separate.
- T is required where create/update schema requires it.
- E/S can be empty where schema/UI allows.
- Unit does not silently default to `%` unless code explicitly requires it.
- Weight uses clear `%` copy.
- policyCategory selection or guidance is visible.
- Linked org KPI behavior respects hierarchy and HR reflection rules.
- Duplicate names should not be blocked unless current code explicitly validates it.
- Delete behavior should match current approved product requirement. Do not hide delete buttons casually.

Org KPI:

- Division/section/team hierarchy is respected.
- Section teams still see team KPI tab.
- Division without sections can still show direct teams.
- Organization code inputs should not be reintroduced.
- Role scope: team leader/team, section chief/section, division head/division.

Monthly result:

- Month chips and selected year/month logic are understandable.
- Evidence is optional unless current schema says otherwise.
- Google Drive link/comment/file metadata flow remains intact.
- AI coach or monthly AI helper degrades safely when disabled.

## AI Coach Checklist

For AI changes:

- Server-side only. No secret in client code.
- Uses Zod input validation.
- Uses structured output validation for AI JSON where applicable.
- Uses `store:false` for OpenAI Responses API requests.
- Does not read Google Drive file bodies in v1.
- Falls back on disabled/missing key/timeout/malformed output.
- Logs minimized payloads and does not print secrets.
- Adds or updates tests around disabled/fallback/malformed states.

## Auth, Session, And Permission Regression

Check:

- Protected pages use `requireProtectedPageSession`.
- APIs use `getServerSession`, `authorize`, or `authorizeMenu` patterns.
- Non-admin access to admin routes goes to `/403` or returns 403.
- Auth/session failures degrade to login/pending/403, not raw 500.
- Middleware path-to-menu mapping is updated when adding protected routes.
- Navigation label visibility and permission mapping stay consistent.

## Official 2026 Safety Checklist

Always verify these remain true unless the task explicitly approves official activation:

- No production data mutation.
- No production migration.
- No dry-run/backfill/apply.
- No official scoring activation.
- No official grade activation.
- No AI annual score exclusion activation.
- No `Evaluation.totalScore` write.
- No `Evaluation.gradeId` write.
- No official `Evaluation`/`EvaluationItem` creation.
- No feature flag change.

## Commands

General:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test
```

Focused:

```bash
pnpm.cmd run test:navigation
pnpm.cmd run test:interactions
pnpm.cmd run test:evaluation-workbench
pnpm.cmd run test:operational-pages
pnpm.cmd run test:ai
pnpm.cmd run test:ai-competency
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/navigation-integrity.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/personal-kpi-workspace.test.ts
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/monthly-kpi-workspace.test.ts
```

Prisma schema preparation only:

```bash
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
pnpm.cmd build
```

Do not run production migration commands from Codex without explicit approval.

## When To Run Full Build

Run `pnpm.cmd build` when:

- App Router page or layout structure changed.
- Prisma schema or generated client expectations changed.
- Auth/session/middleware changed.
- Server/client component boundaries changed.
- Imports were moved across server/client files.
- A route handler or server loader changed shared types.
- The change is going to production or affects CEO/demo routes.

For docs-only changes, build is normally unnecessary. Run markdown/self-check and report that code validation was not needed.

## Definition Of Done Report

Final reports should include:

- Files changed.
- What changed.
- What intentionally did not change.
- Tests/validation run.
- Known warnings or skipped checks.
- Remaining risk.
- Safety confirmation.
