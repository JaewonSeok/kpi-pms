# AI Database Model Context

Last updated: 2026-06-05

Source of truth: `prisma/schema.prisma`.

## Core Model Overview

| Domain | Models |
| --- | --- |
| Organization | `Organization`, `Department`, `Employee` |
| KPI | `OrgKpi`, `PersonalKpi`, `MonthlyRecord`, business/job documents, Team KPI recommendation/review models |
| Evaluation | `EvalCycle`, `Evaluation`, `EvaluationItem`, `EvaluationAssignment`, `EvaluationGradePolicy`, `Appeal` |
| 360 / leadership | `MultiFeedbackRound`, `MultiFeedback`, `FeedbackResponse`, nomination/report/cache models, word-cloud 360 models |
| AI competency | AI competency cycles, questions, attempts, assignments, gate cases, reviews, evidence, results |
| Compensation | `CompensationRuleSet`, `CompensationRule`, `CompensationScenario`, scenario employee/approval models |
| Ops | `AuditLog`, notifications, job execution, AI request logs, upload history, impersonation sessions |
| Auth | NextAuth `Account`, `Session`, `VerificationToken` |

## Key Evaluation Models

### `EvalCycle`

Represents an evaluation cycle/year. Important fields include `evalYear`, `cycleName`, `status`, schedule windows, `performanceDesignConfig`, `showQuestionWeight`, and `showScoreSummary`.

`performanceDesignConfig` is used by multiple readiness/admin metadata flows. Treat writes to it as configuration changes.

### `Evaluation`

Represents an evaluation for a target/evaluator/stage in a cycle.

Important fields:

- `evalCycleId`
- `targetId`
- `evaluatorId`
- `evalStage`
- `status`
- `isDraft`
- comments and submission/rejection fields
- `totalScore`
- `gradeId`
- score policy fields such as `policyFormulaVersion`, `organizationPerformanceScore`, `personalPerformanceScore`, `aiScoreIncludedInTotal`, `scorePolicySnapshot`

Danger: `totalScore` and `gradeId` are official result fields and existing draft/save/submit/calibration paths can touch them.

### `EvaluationItem`

Represents KPI-level scoring/comment data inside an `Evaluation`.

Important fields include `evaluationId`, `personalKpiId`, `policyCategory`, `scoreContributionType`, `policyFormulaVersion`, `basePolicyScore`, `adjustmentScore`, `adjustmentGroupKey`, `targetAchievementLevel`, `policyScoreSnapshot`, PDCA/quantitative score fields, and `weightedScore`.

Do not create official `EvaluationItem` rows for 2026 population until schema/write strategy is approved.

### `PersonalKpi`

Represents employee MBO/KPI rows. `policyCategory` is central to 2026 readiness. A null `policyCategory` on active 2026 non-archived PersonalKpi rows contributes to readiness blockers.

Important fields include `employeeId`, `evalYear`, `kpiName`, `status`, `policyCategory`, `policyCategoryConfidence`, `policyCategorySource`, `policyCategoryReviewedAt`, `policyCategoryReviewNote`, target values, weight, difficulty, and `linkedOrgKpiId`.

### `EvaluationAssignment`

Maps target employees to evaluators by cycle and stage. Evaluator routing blockers are a Cycle 1 P0 readiness issue.

### `EvaluationGradePolicy`

Stores grade thresholds by org/year/policy version/threshold group. Grade readiness may be checked, but official grade writing to `Evaluation.gradeId` remains blocked.

### `AuditLog`

Generic audit table with `userId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `ipAddress`, `userAgent`, and `timestamp`.

Important writes and metadata changes should create audit entries.

### `Appeal`

Represents evaluation appeal/objection workflow with `evaluationId`, `appealerId`, `reason`, `status`, `adminResponse`, and `resolvedAt`.

## Dangerous Fields

Never alter casually:

- `Evaluation.totalScore`
- `Evaluation.gradeId`
- `Evaluation.scorePolicySnapshot`
- `Evaluation.organizationPerformanceScore`
- `Evaluation.personalPerformanceScore`
- `Evaluation.aiScoreIncludedInTotal`
- `EvaluationItem.weightedScore`
- `EvaluationItem.basePolicyScore`
- `EvaluationItem.adjustmentScore`
- official 2026 feature flags

## 2026 Schema Boundary Status

PR #64 added a proposed runtime schema boundary migration, but it was reverted by PR #65 because production DB migration sequencing was not ready.

Current runtime schema does not include the PR #64 official boundary fields/models such as:

- `EvaluationOperationMode`
- `OfficialEvaluationState`
- `EvaluationPopulationRun`
- `EvaluationStageSubmission`
- `EvaluationAuditEvent`
- `EvaluationSandboxSession`
- `Evaluation.operationMode`
- `Evaluation.officialState`
- `EvalCycle.officialEvaluationStatus`

The design docs remain:

- `docs/2026-evaluation-official-schema-boundary-rfc.md`
- `docs/2026-evaluation-official-save-flow-design.md`

Official save-flow implementation remains on hold until schema migration strategy, staging rehearsal, and production migration sequencing are approved.

