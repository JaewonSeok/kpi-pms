# AI Current Status

Last updated: 2026-06-05

## Repository State

- Current branch for this document set: `feature/create-ai-project-context-pack`.
- Base used: latest `origin/main`.
- Latest observed `origin/main` includes PR #74:
  - `36e487b Merge pull request #74 from JaewonSeok/feat/2026-weight-cap-wiring`
  - `ea72b71 feat: wire 2026 weight-cap validators to personal-kpi POST/PATCH (dormant)`

Production status should always be verified with Vercel before claiming a commit is live. Recent workflow context says stable production was restored to safe main during the 2026 readiness work, but alias target can become stale and must be checked per deployment.

## Recent PR Context

| PR | Status | Summary |
| --- | --- | --- |
| #64 | Reverted | Added 2026 official schema boundary migration, then identified production migration sequencing risk |
| #65 | Completed | Reverted PR #64 runtime schema/migration changes from main |
| #66 | Completed | Added official data readiness baseline export |
| #67 | Completed | Exposed `policyCategory` missing resolver visibility |
| #68 | Completed | Added pure official write guard helpers |
| #69 | Completed | Integrated official write guard readiness summary into readiness/export flow |
| #71 | Completed | Added 2026 score policy readiness work |
| #72 | Completed | Enforced DAILY_WORK 80-point cap at submit/draft persistence path |
| #73 | Completed | Improved evaluation workbench hero/layout |
| #74 | Completed in `origin/main` | Wired 2026 weight-cap validators to personal-kpi POST/PATCH in dormant/safe policy path |

## PR #64 Schema Boundary Status

PR #64 runtime Prisma schema/migration changes are not currently part of main after PR #65.

Design docs remain:

- `docs/2026-evaluation-official-schema-boundary-rfc.md`
- `docs/2026-evaluation-official-save-flow-design.md`

No official save-flow implementation should start until schema migration strategy, staging/preview DB rehearsal, and production migration sequencing are approved.

## Cycle 1 Baseline

Cycle: `2026 Official Data Readiness Cycle 1`

| Metric | Baseline |
| --- | ---: |
| Active employees | 289 |
| Confirmed KPI count / coverage | 1 / 0.3% |
| MBO missing | 284 |
| Confirmed KPI shortage | 288 |
| Team KPI pending/discussion | 25 |
| `policyCategory` missing | 1 |
| Evaluator routing blockers | 289 |
| Official gate blockers | 1,753 |
| Go/No-Go | 진행 불가 |
| Apply | 허용 안 됨 |

Official population readiness: `NOT_READY`.

## Current Operational Task

Priority HR operations:

1. `policyCategory missing: 1 -> 0`
2. Team KPI pending/discussion: `25 -> 0` or approved exceptions
3. Evaluator routing blockers: classify and reduce from `289`
4. MBO/KPI coverage follow-up:
   - MBO missing `284`
   - confirmed KPI shortage `288`

Before policyCategory mapping, run a SELECT-only backup query and verify whether test items are in official readiness scope.

## Current Engineering Hold

Engineering may work on read-only readiness reporting, pure helper tests, state machine tests, permission matrix tests, documentation, UI wording, and non-write previews.

Engineering must not implement official 2026 population, official stage save/submit/finalize APIs, official `Evaluation.totalScore` writes, official `Evaluation.gradeId` writes, official scoring/grade/AI activation, or schema boundary migration reintroduction without an approved deployment plan.

## Known Production Verification Pattern

For any production claim:

1. Verify `origin/main` contains the commit.
2. Verify latest Vercel deployment is `Ready`.
3. Verify stable alias points to the intended deployment.
4. Smoke:
   - `/evaluation/performance`
   - `/evaluation/workbench`
   - `/admin/evaluation-readiness`
   - `/admin/evaluation-ops`
5. Watch logs for Prisma/runtime/auth/write-risk signals.

