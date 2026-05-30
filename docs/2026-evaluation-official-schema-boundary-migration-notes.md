# 2026 Evaluation Official Schema Boundary Migration Notes

## Purpose

Add the schema boundary required before 2026 official evaluation save flows can be implemented.

This migration only adds enums, nullable/defaulted boundary fields, and new tracking tables. It does not wire official save APIs, score writes, grade writes, finalization, notifications, or feature flags.

## Added

- Official operation/state enums for evaluation rows and cycles.
- Score and grade write status enums.
- Population run and stage action enums.
- Boundary fields on `Evaluation` for operation mode, official state, population run, score/grade write status, return/finalization/CEO/score/grade timestamps.
- Boundary fields on `EvalCycle` for official evaluation lifecycle status.
- `EvaluationPopulationRun` for population attempts.
- `EvaluationStageSubmission` for stage submission/return/reopen history.
- `EvaluationAuditEvent` for future transactional official evaluation audit.
- `EvaluationSandboxSession` for future non-official sandbox draft persistence.

## Safety

- No columns or tables are dropped.
- No existing columns are renamed.
- No `Evaluation.totalScore` or `Evaluation.gradeId` values are changed.
- No official `Evaluation` or `EvaluationItem` records are created.
- No official write routes are wired.

## Deployment Notes

- Apply as a normal additive Prisma migration after review.
- Do not enable official scoring, official grade, population apply, or finalization in the same deployment.
- Follow-up PRs should add guarded server helpers before any write route uses these fields.

## Post-Deploy Verification Ideas

- Confirm the new enum types exist.
- Confirm `eval_cycles` has `officialEvaluationStatus` with default `NOT_STARTED`.
- Confirm `evaluations` has `operationMode`, `officialState`, `scoreWriteStatus`, and `gradeWriteStatus` defaults.
- Confirm new tracking tables are empty immediately after deploy unless a later PR writes to them.
