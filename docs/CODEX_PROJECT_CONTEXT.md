# Codex Project Context

Last updated: 2026-06-16

This document summarizes repository context for future Codex sessions. Code remains the final source of truth. If this document conflicts with implementation, inspect code and update the document.

## Repository Summary

`kpi-pms` is a Korean HR performance management system. It is no longer just a KPI input tool. The product connects organization KPI alignment, personal KPI/MBO, monthly evidence, evaluator routing, readiness blockers, evaluation preview, score/grade preview, and safety locks before official writes.

The current near-term business goal is a usable 2026 MBO opening and CEO demo. Official score/grade/finalization writes remain intentionally blocked.

## Core Directory Responsibilities

| Path | Responsibility |
| --- | --- |
| `src/app/(main)` | Protected pages in the main shell |
| `src/app/api` | API route handlers and write boundaries |
| `src/components/kpi` | Personal KPI, organization KPI, monthly result UI |
| `src/components/evaluation` | Evaluation workbench, readiness, results, AI competency, feedback UI |
| `src/components/admin` | Admin-oriented operational clients |
| `src/server` | Server loaders, policy workflows, readiness aggregators, AI orchestration |
| `src/lib` | Shared validation, auth, feature flags, policy, score helpers, AI utilities |
| `src/types` | Auth role and session claim types |
| `prisma` | Prisma schema, migrations, seed |
| `tests` | Direct TypeScript tests run with `ts-node` |
| `docs` | Product docs, runbooks, AI context, safety notes |
| `scripts` | Operational scripts, backfill/dry-run utilities, admin helpers |

## Key Configuration

| File | Notes |
| --- | --- |
| `package.json` | Uses `pnpm@10.17.1`. Tests are script chains of `ts-node` files. |
| `next.config.ts` | `standalone` output, auth/no-store headers for login/auth/PWA resources. |
| `tsconfig.json` | Strict TypeScript, `@/*` alias to `src/*`, incremental build info. |
| `eslint.config.mjs` | Next core web vitals and TypeScript rules, several warnings only. |
| `prisma.config.ts` | Prisma config entry. Do not print env values. |
| `.env.example` | Safe example names only. Do not copy `.env` values. |

## Data Model Overview

Important Prisma models and concepts:

| Model | Purpose |
| --- | --- |
| `Organization` | Top-level organization container. |
| `Department` | Org hierarchy node. Has explicit `DepartmentLevel` for `DIVISION`, `SECTION`, `TEAM`. |
| `Employee` | User directory, role, position, department, evaluator chain fields. |
| `OrgKpi` | Organization KPI by department/year. Includes hierarchy and HR reflection concepts. |
| `PersonalKpi` | Employee KPI/MBO, target values, weight, linked org KPI, policy category metadata. |
| `MonthlyRecord` | Monthly result/evidence/comment records linked to personal KPI. |
| `EvalCycle` | Evaluation cycle, status, design config, organization weights, goal edit mode. |
| `DepartmentScoreIntake` | One department score intake per eval cycle and department for future organization score support. |
| `Evaluation` | Persisted evaluation record by cycle, target, and stage. Dangerous fields include `totalScore` and `gradeId`. |
| `EvaluationItem` | Evaluation item linked to `PersonalKpi`, with score/policy fields. |
| `EvaluationAssignment` | FIRST/SECOND/FINAL evaluator routing. |
| `EvaluationGradePolicy` | Year/group grade threshold policy. |
| `AuditLog` | Operational audit trail. |
| `Appeal` | Evaluation result appeal flow. |
| `AiRequestLog` | AI request/response logging with status, approval, cost, and minimized payload. |

Dangerous fields:

- `Evaluation.totalScore`
- `Evaluation.gradeId`
- official scoring/grade feature flags
- official Evaluation/EvaluationItem creation paths

## Current Route Map Summary

Core pages:

| Route | Purpose | Main code |
| --- | --- | --- |
| `/evaluation/performance` | HR MBO/KPI operations dashboard and process guide | `src/app/(main)/evaluation/performance/page.tsx`, `EvaluationWorkbenchClient` |
| `/kpi/personal` | Personal KPI/MBO writing and leader review tab | `personal-kpi-page.ts`, `PersonalKpiManagementClient` |
| `/kpi/monthly` | Monthly result/evidence/comment workspace | `monthly-kpi-page.ts`, `MonthlyKpiManagementClient` |
| `/admin/evaluation-ops` | HR operations hub | `src/app/(main)/admin/evaluation-ops/page.tsx` |
| `/admin/performance-assignments` | Evaluator routing assignments and blocker review | `PerformanceAssignmentAdminClient` |
| `/admin/evaluation-readiness` | Baseline export, policyCategory resolver, official write guard | `EvaluationWorkbenchClient` in `readiness-admin` mode |
| `/evaluation/workbench` | Preview-only evaluation flow, score/grade/CEO preview | `EvaluationProcessPreviewGuide2026`, `EvaluationWorkbenchClient` |
| `/admin/department-score-intake` | Admin department score intake surface | `src/app/(main)/admin/department-score-intake/page.tsx` |
| `/admin/preview-2026-grade` | 2026 automatic grade preview | `src/app/(main)/admin/preview-2026-grade/page.tsx` |

API families:

- `/api/kpi/personal/**`: personal KPI CRUD, workflow, clone, AI, midcheck coach.
- `/api/kpi/monthly-record/**`: monthly result CRUD, workflow, AI.
- `/api/kpi/org/**`: organization KPI CRUD, bulk, AI, HR exception, team AI.
- `/api/evaluation/**`: evaluation CRUD, submit/review, preview 2026, readiness, calibration, results, feedback.
- `/api/admin/**`: eval cycles, assignments, design, department score intake, grades, org chart, Google access, notifications, ops.
- `/api/ai/**`: general AI assistance and evaluation briefing.
- `/api/feedback/**`: 360, upward, onboarding, reports.
- `/api/compensation/**`: compensation planning routes exist but are outside current MBO demo scope.

## Auth And Role Matrix

Roles from `src/types/auth.ts`:

- `ROLE_ADMIN`
- `ROLE_CEO`
- `ROLE_DIV_HEAD`
- `ROLE_SECTION_CHIEF`
- `ROLE_TEAM_LEADER`
- `ROLE_MEMBER`

Permission mapping lives in `src/lib/auth/permissions.ts`. Important patterns:

- Admin setup, readiness, assignments, department score intake, grade policy, performance design are admin-oriented.
- KPI/MBO and evaluation preview menus are available to broader roles based on menu keys.
- `requireProtectedPageSession` is the page-level guard.
- Middleware redirects unauthenticated users to login and forbidden menu access to `/403`.
- Session claim rehydration failures are intended to degrade to pending/login states rather than raw 500s.

## KPI And Monthly Flow

Personal KPI/MBO:

- Page: `/kpi/personal`.
- Loader: `src/server/personal-kpi-page.ts`.
- Client: `src/components/kpi/PersonalKpiManagementClient.tsx`.
- API: `/api/kpi/personal`, `/api/kpi/personal/[id]`, workflow/clone/AI/midcheck coach.
- Create uses `CreatePersonalKpiSchema`, Zod validation, permission checks, org link validation, weight guards, policyCategory persistence at create, and audit log.
- 2026 categories are `ORG_GOAL`, `PROJECT_T`, `PROJECT_K`, `DAILY_WORK`.

Monthly results:

- Page: `/kpi/monthly`.
- Loader: `src/server/monthly-kpi-page.ts`.
- Client: `src/components/kpi/MonthlyKpiManagementClient.tsx`.
- API: `/api/kpi/monthly-record/**`.
- Evidence supports comments and attachment/link metadata. Evidence is recommended, not always mandatory.

## Evaluation And 2026 Readiness Flow

Important files:

- `src/components/evaluation/EvaluationWorkbenchClient.tsx`
- `src/components/evaluation/EvaluationProcessPreviewGuide2026.tsx`
- `src/server/evaluation-workbench.ts`
- `src/server/evaluation-2026-activation-readiness.ts`
- `src/server/evaluation-2026-readiness-population.ts`
- `src/server/evaluation-2026-official-write-guards.ts`
- `src/server/evaluation-preview-2026-mapping.ts`
- `src/server/evaluation-scoring-2026.ts`

2026 readiness is preview/readiness-first:

- Baseline export
- policyCategory missing resolver
- Team KPI review visibility
- Evaluator routing blockers
- Score/grade readiness
- Official write guard summary
- Workbench preview with score/grade/final/CEO flow

Official 2026 population, official score writes, official grade writes, and finalization remain blocked unless a separate approved process starts.

## 2026 Policy State

From `src/lib/evaluation-policy-2026.ts`:

- `weightRule.enforced`: `false`
- `belowTargetExceptionRule.active`: `false`
- `dailyWorkScoringRule.active`: `false`
- `finalScoreFormula.active`: `false`
- `adjustmentRule.active`: `false`
- `aiCapability.annualEvaluationScoreIncluded`: `false`
- AI level-up Pass/Fail starts from 2028.

Important nuance:

- DAILY_WORK score cap at 80 is implemented as a data invariant in persistence helpers even while broader daily-work scoring rule is dormant.
- Weight caps and below-target exception are wired/readiness tested but remain dormant until policy activation.

## AI Coach And AI Safety

AI entry points include:

- `src/server/ai/personal-kpi-midcheck-coach.ts`
- `src/server/ai/personal-kpi.ts`
- `src/server/ai/monthly-kpi.ts`
- `src/server/ai/org-kpi.ts`
- `src/server/ai/evaluation-assist.ts`
- `src/server/ai/executive-performance-briefing-openai.ts`

Confirmed pattern in personal KPI midcheck coach:

- Server-side only.
- Uses OpenAI Responses API `/responses`.
- Sends `store: false`.
- Uses JSON schema plus Zod result validation.
- Logs to `AiRequestLog`.
- Falls back safely when disabled, missing key, timeout, invalid JSON, or invalid shape.
- Does not read Google Drive file contents in v1. It uses link/comment/metadata inputs.

## Resolved Issues And Regression Risks

Known resolved or recent areas:

- MBO opening navigation simplified.
- Compensation sidebar hidden from MBO demo navigation.
- Evaluation process preview guide added to HR dashboard and workbench.
- policyCategory resolver visible in readiness.
- Official write guard helper and readiness integration added.
- Department score intake model/admin surface added.
- 2026 grade preview UI and PPT threshold alignment improved.
- Team KPI review sidebar entry removed in favor of in-page tab.
- Login/session claim rehydration P2022 style failures are handled non-fatally where possible.

Regression risks:

- Reintroducing compensation into the CEO/MBO demo sidebar.
- Exposing official scoring/grade/finalization as normal action buttons.
- Changing Prisma schema without deployment/migration order.
- Breaking protected route degrade behavior.
- Reintroducing organization code input where it was removed.
- Hiding team KPI tab for section teams.
- Adding AI client-side secret exposure.
- Changing policy flags from dormant to active without cutover approval.

## Facts Confirmed From Code

- `AGENTS.md` did not exist before this task.
- Core pages use server loaders and pass data to client components.
- `src/lib/navigation.ts` currently omits the compensation sidebar section.
- `src/lib/auth/permissions.ts` still maps compensation routes for route protection even if sidebar is hidden.
- `DepartmentScoreIntake` exists in Prisma schema.
- Official 2026 flags default to false except preview.
- Personal KPI create supports `policyCategory` input and policy metadata persistence.
- Personal KPI midcheck coach uses server-side Responses API, `store:false`, JSON schema, and Zod validation.

## Assumptions To Recheck When Needed

- Whether production DB has every schema object expected by the latest Prisma client.
- Whether Vercel stable alias points to latest `origin/main`.
- Whether current HR data counts have changed since the last readiness export.
- Whether a given UI control is visible only after role-specific login or tab/collapse interaction.
- Whether existing untracked local docs are user drafts. Do not overwrite without asking.
