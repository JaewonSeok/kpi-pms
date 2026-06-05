# AI Codemap

Last updated: 2026-06-05

## Important Directories

| Path | What it does |
| --- | --- |
| `src/app` | Next.js App Router pages and API routes |
| `src/app/(main)` | Protected application pages rendered inside the main shell |
| `src/app/api` | Route handlers for reads, writes, workflow transitions, exports, AI, admin ops |
| `src/components` | Domain UI components and client workspaces |
| `src/server` | Server-only data loaders, readiness logic, workflows, policy calculators |
| `src/lib` | Shared utilities, auth, validation, policy, scoring, AI, feature flags |
| `src/types` | Shared TypeScript types, especially auth/session claims |
| `src/hooks` | React hooks if present; most domain state currently lives in components |
| `src/config` | Config helpers if present |
| `prisma` | Prisma schema, migrations, seed |
| `tests` | `ts-node` test suites |
| `scripts` | Operational scripts, dry-run/backfill scripts, account/admin utilities |
| `docs` | Runbooks, product docs, 2026 official evaluation design and safety docs |

## Key Files

| File | Why it matters |
| --- | --- |
| `package.json` | Scripts, package manager, validation commands |
| `prisma/schema.prisma` | Database model source of truth |
| `src/lib/auth.ts` | NextAuth providers, callbacks, session shape |
| `src/lib/auth/permissions.ts` | RBAC menu and route permission logic |
| `src/middleware.ts` | Protected route/middleware behavior |
| `src/lib/feature-flags.ts` | Feature flags, including 2026 preview/scoring/grade/backfill gates |
| `src/components/evaluation/EvaluationWorkbenchClient.tsx` | Main evaluation UI surface, including workbench, readiness admin panels, policy mapping |
| `src/server/evaluation-workbench.ts` | Workbench page data loader and selected evaluation/cycle shaping |
| `src/server/evaluation-2026-activation-readiness.ts` | Integrated 2026 activation/readiness response and export payloads |
| `src/server/evaluation-2026-readiness-population.ts` | 2026 population readiness/dry-run style read model |
| `src/server/evaluation-2026-official-write-guards.ts` | Pure official write guard helper; no DB writes |
| `src/server/evaluation-preview-2026-mapping.ts` | 2026 policy mapping candidate lookup and metadata save boundary |
| `src/server/evaluation-scoring-2026.ts` | 2026 score policy helpers and adjustment logic |
| `docs/2026-evaluation-official-schema-boundary-rfc.md` | Design-only schema boundary RFC |
| `docs/2026-evaluation-official-save-flow-design.md` | Design-only official save-flow plan |

## UI Locations

| UI | Main files |
| --- | --- |
| Evaluation performance dashboard | `src/app/(main)/evaluation/performance/page.tsx`, `EvaluationWorkbenchClient.tsx` |
| Evaluation workbench | `src/app/(main)/evaluation/workbench/page.tsx`, `EvaluationWorkbenchClient.tsx` |
| Admin readiness | `src/app/(main)/admin/evaluation-readiness/page.tsx`, `EvaluationWorkbenchClient.tsx` |
| Admin evaluation ops | `src/app/(main)/admin/evaluation-ops/page.tsx` |
| Performance assignments | `src/app/(main)/admin/performance-assignments/page.tsx`, `src/components/admin/PerformanceAssignmentAdminClient.tsx` |
| Personal KPI | `src/app/(main)/kpi/personal/page.tsx`, `src/components/kpi/PersonalKpiManagementClient.tsx` |
| Monthly KPI | `src/app/(main)/kpi/monthly/page.tsx`, `src/components/kpi/MonthlyKpiManagementClient.tsx` |
| Org KPI | `src/app/(main)/kpi/org/page.tsx`, `src/components/kpi/OrgKpiManagementClient.tsx` |

## Server / Readiness Logic

| Logic | Main files |
| --- | --- |
| 2026 integrated readiness | `src/server/evaluation-2026-integrated-readiness-snapshot.ts` |
| Activation readiness and baseline export | `src/server/evaluation-2026-activation-readiness.ts` |
| Population readiness | `src/server/evaluation-2026-readiness-population.ts` |
| Evaluator routing readiness | `src/server/evaluation-2026-evaluator-routing-readiness.ts` |
| Score policy readiness | `src/server/evaluation-2026-grade-policy-readiness.ts`, `src/server/evaluation-scoring-2026.ts` |
| Feedback/leadership readiness | `src/server/evaluation-2026-feedback-leadership-readiness.ts` |
| Official write guards | `src/server/evaluation-2026-official-write-guards.ts` |
| Policy mapping metadata | `src/server/evaluation-preview-2026-mapping.ts` |

## Tests

| Test area | Examples |
| --- | --- |
| 2026 readiness | `tests/evaluation-2026-activation-readiness.test.ts`, `tests/evaluation-2026-readiness-population.test.ts` |
| Official write guards | `tests/evaluation-2026-official-write-guards.test.ts` |
| Score policy | `tests/evaluation-scoring-2026.test.ts`, `tests/evaluation-weight-cap-2026.test.ts`, `tests/evaluation-daily-work-scoring-2026.test.ts` |
| Workbench | `tests/evaluation-workbench-loader.test.ts`, `tests/evaluation-workbench-adjustment-ui.test.ts` |
| API/preview | `tests/evaluation-preview-2026-api.test.ts`, `tests/evaluation-preview-2026-mapping.test.ts` |
| Protected pages | `tests/protected-page-regression.test.ts`, `tests/navigation-integrity.test.ts` |

