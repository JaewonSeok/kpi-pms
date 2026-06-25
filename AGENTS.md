# KPI PMS Agent Guide

Last updated: 2026-06-16

This repository is `kpi-pms`, an internal Korean HR performance management and evaluation system. Use this file as the first-stop operating guide for Codex work in this repo.

Before changing code, also read:

- `docs/CODEX_PROJECT_CONTEXT.md`
- `docs/CODEX_QA_CHECKLIST.md`
- `docs/CODEX_ROUTE_MAP.md`
- `docs/AI_PROJECT_CONTEXT.md`
- `docs/AI_CODEMAP.md`
- `docs/AI_SAFETY_GUARDRAILS.md`
- `docs/AI_CURRENT_STATUS.md`

## Project Overview

KPI PMS supports:

- 본부/실/팀 organization KPI planning and alignment
- Personal KPI/MBO writing and leader review
- Monthly result, evidence, and comment preparation
- Evaluation preview/workbench flows
- 2026 readiness, blocker tracking, and official write guard visibility
- Evaluator assignment, performance calendar, and HR operations
- 360/upward/word-cloud feedback
- AI competency and AI-assisted coaching
- Compensation pages and APIs, currently hidden from the MBO opening sidebar scope

The near-term product focus is the 2026 MBO opening and CEO demo. Official 2026 scoring, grade activation, final writes, and schema-boundary save-flow work remain safety-gated.

## Tech Stack

| Area | Stack |
| --- | --- |
| Framework | Next.js App Router, React 19, TypeScript |
| UI | Tailwind CSS, Radix UI, lucide-react, Recharts |
| Data | Prisma 7, PostgreSQL |
| Auth | NextAuth/Auth.js style setup with Google OAuth and credentials fallback |
| State/forms | React client components, TanStack Query, React Hook Form where used |
| Validation | Zod |
| AI | Server-side OpenAI Responses API callers and fallback helpers |
| Tests | Direct `ts-node` tests under `tests/` |
| Deployment | Vercel production alias and Docker artifacts |
| Package manager | `pnpm` |

## Repo Layout

| Path | Purpose |
| --- | --- |
| `src/app/(main)` | Protected App Router pages |
| `src/app/api` | Route handlers for reads, writes, AI, exports, admin operations |
| `src/components` | Domain UI components and client workspaces |
| `src/server` | Server-only loaders, workflows, readiness logic, AI orchestration |
| `src/lib` | Shared policy, auth, validation, scoring, utility, feature flags |
| `src/types` | Shared TypeScript types, especially auth/session claims |
| `prisma/schema.prisma` | Database source of truth |
| `prisma/migrations` | Applied migration SQL |
| `prisma/migration-drafts` | Draft SQL, not automatically applied |
| `tests` | TypeScript test files run via `ts-node` |
| `scripts` | Operational scripts, backfills, dry-run utilities, admin helpers |
| `docs` | Product docs, runbooks, AI context, 2026 evaluation design |

## Important Routes

Core 2026 MBO opening demo routes:

- `/evaluation/performance`: HR MBO/KPI operations dashboard.
- `/kpi/personal`: Personal KPI/MBO writing, policy category guidance, leader review tab.
- `/kpi/monthly`: Monthly result, evidence, and comment flow.
- `/admin/evaluation-ops`: HR operations hub.
- `/admin/performance-assignments`: Evaluator assignment readiness and manual review.
- `/admin/evaluation-readiness`: Official data readiness, baseline, policyCategory resolver, write guard.
- `/evaluation/workbench`: Preview-only evaluation process, score/grade/final preview.

Other major routes:

- `/kpi/org`: Organization KPI management.
- `/admin/department-score-intake`: Department score intake admin surface.
- `/admin/preview-2026-grade`: 2026 grade preview admin surface.
- `/evaluation/results`, `/evaluation/appeal`, `/evaluation/ceo-adjust`.
- `/evaluation/360`, `/evaluation/upward/*`, `/evaluation/word-cloud-360`.
- `/evaluation/ai-competency` and admin subroutes.
- `/compensation/*` exists but compensation is not part of the current MBO opening demo navigation.

## Auth And Permission Conventions

- Protected pages call `requireProtectedPageSession` from `src/server/auth/protected-page.ts`.
- Middleware checks session tokens and menu authorization through `src/lib/auth/permissions.ts`.
- Roles are defined in `src/types/auth.ts`: `ROLE_ADMIN`, `ROLE_CEO`, `ROLE_DIV_HEAD`, `ROLE_SECTION_CHIEF`, `ROLE_TEAM_LEADER`, `ROLE_MEMBER`.
- Menu keys and path mapping live in `src/lib/auth/permissions.ts`.
- Organization scope logic lives in `src/server/auth/org-scope.ts` and authorization helpers in `src/server/auth/authorize.ts`.
- Unauthenticated protected routes should redirect to login or return 401. Do not allow 500s for ordinary auth failures.
- Admin-only operational areas should use `ROLE_ADMIN` or appropriate menu keys, not ad hoc client-only guards.

## KPI And Evaluation Domain Rules

- Organization hierarchy is non-uniform: company -> division -> optional section -> team. A division can contain direct teams and sections.
- `Department.level` explicitly identifies `DIVISION`, `SECTION`, or `TEAM`.
- Employees in a section team must still see team KPI context. Do not hide team KPI just because a section exists.
- Members can read upper organization KPI context.
- Team leaders edit team KPIs, section chiefs edit section KPIs, division heads edit division KPIs.
- Personal KPI/MBO has policy categories: `ORG_GOAL`, `PROJECT_T`, `PROJECT_K`, `DAILY_WORK`.
- T/E/S target values are split. T is required; E/S can be empty where schema/UI allows.
- Unit should not default to `%` unless the current code explicitly does so for a field.
- Evidence is recommended but not mandatory in monthly result flows.
- Duplicate KPI names in the same organization/year may be allowed by current migration history. Do not reintroduce uniqueness casually.

## 2026 Evaluation Safety Rules

- 2026 official writes remain blocked unless the user explicitly starts an approved official-write process.
- Do not activate official scoring or official grade.
- Do not write `Evaluation.totalScore` or `Evaluation.gradeId`.
- Do not create official `Evaluation` or `EvaluationItem` records as part of readiness/demo work.
- Preview/readiness is allowed. Official save/submit/finalize/scoring/grade activation is not.
- Feature flags in `src/lib/feature-flags.ts` for official scoring, official grade, AI score exclusion, backfill, and HR approval must stay unchanged unless the task explicitly approves a release plan.

## AI Feature Rules

- OpenAI calls must be server-side only.
- Do not expose `OPENAI_API_KEY` or any secret to client bundles.
- Responses API payloads should use `store: false`.
- Structured output should combine JSON schema and Zod validation when practical.
- AI mid-check coach is intended for 직책자, especially team leader/section/division leadership contexts.
- v1 Google Drive handling is link/comment/metadata based. Do not read Google Drive file bodies unless explicitly designed and approved later.
- AI disabled, malformed, weak evidence, timeout, or missing key states must degrade to safe fallback UI.
- When using `previous_response_id`, do not assume previous developer instructions persist. Include required instructions in every request.

## UI Language Rules

- User-facing UI copy is Korean.
- Code identifiers, tests, and comments can stay English unless Korean copy is under test.
- Use direct, operational Korean for HR/admin screens.
- Avoid making advanced official transition controls look like normal demo actions.
- Do not re-add removed clutter such as bottom-right 4-button groups, broad AI usage logs, AI tab-wide traces, or compensation sidebar entries unless explicitly requested.

## Do-Not Rules

Do not do these without explicit user approval:

- Mutate production data.
- Run production migrations or `prisma migrate deploy`.
- Run dry-run/backfill/apply scripts.
- Run `backfill --apply`.
- Edit `.env` or print secret values.
- Change production feature flags.
- Send emails or notifications.
- Delete routes, APIs, database models, or business logic unless explicitly requested.
- Use `git add .`.
- Force push.
- Delete backup/protected refs.
- Refactor broadly when a small targeted change is enough.

## Required Verification Commands

Pick commands based on change scope:

```bash
pnpm.cmd lint
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test
pnpm.cmd run test:navigation
pnpm.cmd run test:interactions
pnpm.cmd run test:evaluation-workbench
pnpm.cmd exec ts-node -P tsconfig.seed.json tests/protected-page-regression.test.ts
```

For Prisma schema changes:

```bash
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
pnpm.cmd build
```

Never run production migration commands unless explicitly approved.

## Definition Of Done

A task is done when:

- The requested behavior is implemented or the requested diagnosis is complete.
- Existing unrelated worktree files are untouched.
- Dangerous write surfaces were not expanded.
- Relevant tests/lint/typecheck/build are run or the reason for not running is reported.
- The final report lists changed files, validation results, remaining risks, and safety confirmation.

## How To Respond To Future User Requests

- For “확인해줘”, verify with git, source, deployment, route smoke, or logs as appropriate. Do not mutate.
- For “고쳐줘/반영해줘/만들어줘”, inspect related files first, then make the smallest safe change.
- For production or Vercel alias work, verify commit, deployment, stable alias, route smoke, and logs. Ask before alias restore.
- For schema work, explain migration/deployment order before any production step.
- For AI work, keep calls server-side, validate output, log safely, and degrade gracefully.
- For HR demo work, prioritize clear Korean UX and safe preview/readiness messaging.
