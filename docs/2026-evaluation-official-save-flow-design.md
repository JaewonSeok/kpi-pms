# 2026 Evaluation Official Save Flow Design

## Scope

This document is design-only. It does not enable official scoring, official grade calculation, backfill, apply, feature flags, or any production write path.

The goal is to define how the 2026 evaluation workbench can safely move from preview-only screens to real operational evaluation data.

## Decision

The existing schema is close to an official evaluation workflow, but it is not safe enough to open the 2026 official save flow as-is.

Decision: minor schema and API gate additions are required before implementation.

Reasons:

- Existing draft save and submit routes write official `Evaluation.totalScore`.
- Existing draft save and submit routes can write official `Evaluation.gradeId`.
- Existing submit flow creates next-stage official `Evaluation` and `EvaluationItem` rows.
- Existing calibration flows create/update/delete official `CEO_ADJUST` evaluations.
- Audit logging exists, but it is generic and non-blocking.
- There is no explicit 2026 official write gate, population run id, score write lock, grade write lock, or stage history model.
- There is no explicit way to distinguish 2026 pilot/sandbox records from official records if persistence is added later.

No official writes should be implemented until these gaps are closed.

## Current Persistence Model

### EvalCycle

Current role:

- Evaluation cycle and schedule owner.
- Stores cycle status and dates.
- Stores JSON configs such as `performanceDesignConfig` and `calibrationSessionConfig`.

Important fields:

- `status`: `SETUP`, `KPI_SETTING`, `IN_PROGRESS`, `SELF_EVAL`, `FIRST_EVAL`, `SECOND_EVAL`, `FINAL_EVAL`, `CEO_ADJUST`, `RESULT_OPEN`, `APPEAL`, `CLOSED`
- `performanceDesignConfig`: used by readiness and policy metadata.
- `calibrationSessionConfig`: used by calibration/final confirmation tools.
- schedule dates for KPI setup, self evaluation, review stages, result open, appeal deadline.

Gap:

- No explicit 2026 official activation state.
- No explicit write gate state for population, score write, grade write, finalization.

### Evaluation

Current role:

- One row per target, cycle, and stage.
- Stage is represented by `evalStage`.
- Draft/submission state is represented by `status`, `isDraft`, and `submittedAt`.

Important fields:

- `evalCycleId`
- `targetId`
- `evaluatorId`
- `evalStage`: `SELF`, `FIRST`, `SECOND`, `FINAL`, `CEO_ADJUST`
- `status`: `PENDING`, `IN_PROGRESS`, `SUBMITTED`, `REJECTED`, `CONFIRMED`
- `isDraft`
- `submittedAt`
- `isRejected`, `rejectionReason`, `rejectedAt`
- `totalScore`
- `gradeId`
- comments and guidance fields

Gap:

- `totalScore` and `gradeId` live on the same row that draft save updates.
- No separate score write status.
- No separate grade write status.
- No finalized/locked state beyond `CONFIRMED`.
- No population run id.
- No explicit official/sandbox mode.

### EvaluationItem

Current role:

- Item-level score/comment row under one `Evaluation`.
- One set of item inputs per stage evaluation row.

Important fields:

- `evaluationId`
- `personalKpiId`
- `policyCategory`
- score fields
- adjustment fields
- `weightedScore`
- `policyScoreSnapshot`

Gap:

- No stage submission history.
- No explicit item draft/submitted history.
- No official write lock.

### EvaluationAssignment

Current role:

- Stores evaluator assignment per cycle, target, and stage.
- Supports auto/manual assignment source.

Important fields:

- `evalCycleId`
- `targetId`
- `evalStage`
- `evaluatorId`
- `assignmentSource`
- `createdById`, `updatedById`

Gap:

- Assignment sync can update evaluator on editable existing Evaluation rows.
- Needs official population/review gate checks before being reused for 2026 official operation.

### EvaluationGradePolicy

Current role:

- Stores 2026 score-to-grade policy by year/version/group/grade.

Important fields:

- `evalYear`
- `policyVersion`
- `thresholdGroup`
- `gradeLabel`
- `minScore`
- `maxScore`
- `isActive`

Gap:

- Ready for preview, but official grade write needs a separate gate and audit boundary.

### AuditLog

Current role:

- Generic append log for many evaluation actions.

Important fields:

- `userId`
- `action`
- `entityType`
- `entityId`
- `oldValue`
- `newValue`
- `ipAddress`
- `userAgent`
- `timestamp`

Gap:

- Audit helper catches errors instead of making writes fail when audit fails.
- No first-class evaluation stage history table.
- No rollback linkage between population runs, stage submissions, score writes, and grade writes.

### Appeal

Current role:

- Stores submitted appeal records after result open.
- Draft appeal state is stored in AuditLog rather than an Appeal row.

Important fields:

- `evaluationId`
- `appealerId`
- `reason`
- `status`
- `adminResponse`
- `resolvedAt`

Gap:

- Appeal resolution does not currently define official score/grade adjustment write semantics.

## Existing Evaluation Write APIs

| Route | Method | Purpose | Official writes | Reuse decision |
| --- | --- | --- | --- | --- |
| `/api/evaluation` | POST | Start self evaluation | Creates official `Evaluation` and `EvaluationItem` rows | Do not reuse until population gate exists |
| `/api/evaluation/[id]` | PATCH | Draft save | Updates items, comments, `totalScore`, `gradeId`, status | Unsafe as-is for 2026 because draft writes official score/grade fields |
| `/api/evaluation/[id]/submit` | PATCH | Submit current stage and create next stage | Updates score/grade, sets submitted state, creates next official stage rows, sends notification | Unsafe as-is; needs stage gate and score/grade separation |
| `/api/evaluation/[id]/review` | PATCH | Return/reject previous stage | Reopens previous official Evaluation and clears current score/grade | Needs 2026 return policy and audit linkage |
| `/api/evaluation/[id]/guide` | PATCH | Guide viewed/confirmed audit | AuditLog only | Safe as read/ack audit, not a save flow |
| `/api/evaluation/calibration` | PATCH | CEO adjustment/calibration update | Updates or creates `CEO_ADJUST`, writes `totalScore`/`gradeId`, can delete adjustment rows | Unsafe until finalization gate exists |
| `/api/evaluation/calibration/workflow` | POST | Calibration workflow | Some actions audit-only; merge/delete creates or deletes `CEO_ADJUST` rows | Unsafe until CEO/finalization gate exists |
| `/api/admin/performance-assignments` | POST | Sync/override/reset assignments | Writes `EvaluationAssignment`, can update existing Evaluation evaluator | Safe only behind HR/admin assignment gate before review progress |
| `/api/appeals` | POST | Appeal draft/submit | Draft is AuditLog; submit creates Appeal | Can be reused after result open policy is formalized |
| `/api/appeals/[id]` | PATCH | Appeal workflow | Updates Appeal status/admin response; no direct score/grade write | Needs official appeal resolution write design |
| `/api/evaluation/results/[cycleId]/acknowledge` | POST | Employee acknowledges result | AuditLog only | Safe after result publication |
| `/api/evaluation/preview-2026/*` | GET/PATCH | Readiness and metadata preview | Mostly metadata/config writes, not official Evaluation writes | Keep separate from official save flow |

## Proposed Official State Machine

The 2026 official flow should be modeled explicitly, even if it maps to existing fields at first.

| State | Existing mapping candidate | Meaning |
| --- | --- | --- |
| `NOT_POPULATED` | No Evaluation rows | Cycle/target not populated |
| `POPULATED` | SELF Evaluation exists, `PENDING` or `IN_PROGRESS` | Official target and items created |
| `SELF_DRAFT` | SELF `IN_PROGRESS`, `isDraft=true` | Employee draft exists |
| `SELF_SUBMITTED` | SELF `SUBMITTED`, `isDraft=false` | Employee submitted |
| `FIRST_DRAFT` | FIRST `IN_PROGRESS`, `isDraft=true` | First reviewer draft exists |
| `FIRST_SUBMITTED` | FIRST `SUBMITTED`, `isDraft=false` | First reviewer submitted |
| `SECOND_DRAFT` | SECOND `IN_PROGRESS`, `isDraft=true` | Second reviewer draft exists |
| `SECOND_SUBMITTED` | SECOND `SUBMITTED`, `isDraft=false` | Second reviewer submitted |
| `FINAL_DRAFT` | FINAL `IN_PROGRESS`, `isDraft=true` | Final reviewer draft exists |
| `FINAL_SUBMITTED` | FINAL `SUBMITTED`, `isDraft=false` | Final reviewer submitted |
| `CEO_ADJUST_DRAFT` | CEO_ADJUST `IN_PROGRESS`, `isDraft=true` | CEO adjustment draft |
| `CEO_CONFIRMED` | CEO_ADJUST `CONFIRMED`, `isDraft=false` | CEO confirmation complete |
| `SCORE_CALCULATED` | New score write state needed | Official `totalScore` written and locked |
| `GRADE_CALCULATED` | New grade write state needed | Official `gradeId` written and locked |
| `FINALIZED` | New finalization state needed or cycle CLOSED | Evaluation result locked |
| `RETURNED_FOR_REVISION` | Current `REJECTED`/`isRejected` | Returned to prior actor |
| `APPEAL_OPEN` | EvalCycle `APPEAL`, Appeal submitted | Appeal window open |
| `APPEAL_RESOLVED` | Appeal accepted/rejected/closed | Appeal resolution complete |

## Transition Requirements

| Transition | Actor | Required previous state | Required data | Official write | Allowed before activation |
| --- | --- | --- | --- | --- | --- |
| Select official cycle | HR admin | readiness target selected | cycle, HR approval | EvalCycle gate/config | No, approval required |
| Populate target/items | HR admin | `NOT_POPULATED` | MBO/KPI coverage, policyCategory, assignments | Evaluation/EvaluationItem create | No |
| Save SELF draft | target employee | `POPULATED` or `SELF_DRAFT` | item comments/scores, evidence checks | Evaluation/EvaluationItem draft fields | Only after self phase opens |
| Submit SELF | target employee | `SELF_DRAFT` | required comments/evidence | stage submitted state | Only after self gate opens |
| Save FIRST draft | assigned reviewer | `SELF_SUBMITTED` | reviewer scores/comments | FIRST Evaluation/Item draft | Only after review gate opens |
| Submit FIRST | assigned reviewer | `FIRST_DRAFT` | adjustment reasons if needed | FIRST submitted state | Only after review gate opens |
| Save SECOND draft | assigned reviewer | `FIRST_SUBMITTED` | reviewer scores/comments | SECOND Evaluation/Item draft | Only after review gate opens |
| Submit SECOND | assigned reviewer | `SECOND_DRAFT` | adjustment reasons if needed | SECOND submitted state | Only after review gate opens |
| Save FINAL draft | final reviewer | `SECOND_SUBMITTED` or allowed direct route | final recommendation | FINAL Evaluation/Item draft | Only after final review gate opens |
| Submit FINAL | final reviewer | `FINAL_DRAFT` | final comments/recommendation | FINAL submitted state | Only after final review gate opens |
| Save CEO adjustment | CEO/admin | `FINAL_SUBMITTED` | adjustment reason if changed | CEO_ADJUST draft | No, finalization gate required |
| Confirm CEO | CEO/admin | `CEO_ADJUST_DRAFT` | reason, calibration checks | CEO_ADJUST confirmed | No |
| Write totalScore | HR admin/system job | all reviews complete, score policy ready | score snapshot | `Evaluation.totalScore` write | No |
| Write gradeId | HR admin/system job | score written, grade policy ready | grade snapshot | `Evaluation.gradeId` write | No |
| Finalize result | HR admin/CEO | score and grade locked | HR/CEO approval | final lock/state | No |
| Return for revision | reviewer/admin | submitted prior stage | return reason | status/stage rollback | Only by policy |
| Open appeal | employee | result open | appeal reason | Appeal create | After result open |
| Resolve appeal | admin | appeal open | resolution note | Appeal update; score/grade write TBD | After appeal gate |

## Data Ownership Matrix

| Data | Created by | Updated by | Source of truth | Official or draft | Regenerable | Audit required | Safe before activation | Blocked until activation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Evaluation | population job/API | stage actor, HR/admin | official stage row | both draft and official today | partially | yes | no | create/update official rows |
| EvaluationItem | population/stage creation | stage actor | official item row | both draft and official today | from KPI before submit | yes | no | create/update official rows |
| EvaluationAssignment | HR/admin sync/override | HR/admin | assignment table | official routing | yes before progress | yes | yes, if no evaluation progress | evaluator changes after progress |
| EvalCycle | HR/admin | HR/admin | cycle table | official cycle | no | yes | schedule/config yes | official activation gates |
| PersonalKpi | employee/manager flow | KPI owners | KPI table | official KPI | no | existing KPI audit | yes | none for evaluation save itself |
| MonthlyRecord | employee/leader flow | owners | monthly record table | official evidence | no | yes | yes | none for evaluation save itself |
| EvaluationGradePolicy | HR/admin | HR/admin | grade policy table | official policy | versioned | yes | policy setup yes | grade write |
| AuditLog | all write APIs | append-only | audit table | official audit | no | itself | yes | must be mandatory for official writes |
| Appeal | employee/admin | employee/admin | appeal table | official appeal | no | yes | no | after result open |

## Official Write Gates

### A. Population gate

Required before creating official Evaluation/EvaluationItem rows:

- Official cycle selected and approved.
- MBO/KPI coverage sufficient or exception-approved.
- `policyCategory` complete.
- Evaluator assignment exists for required stages.
- HR approval captured.
- Population run created with expected counts.
- Rollback/reset plan exists for the population run.

### B. Self-evaluation gate

Required before employee draft/submit:

- Official Evaluation and EvaluationItem rows exist.
- Cycle self-evaluation phase is open.
- Employee is the target.
- Result summary, evidence, contribution fields satisfy policy.
- Submit requires explicit confirmation and audit.

### C. Reviewer gate

Required before first/second/final draft/submit:

- Assigned evaluator matches stage.
- Prior stage submitted.
- Adjustment amount and score range are valid.
- Adjustment reason is required when adjustment is non-zero or grade-impacting.
- Return/reject requires reason and stage rollback audit.

### D. Score calculation gate

Required before official `totalScore` write:

- Required review stages complete.
- Score policy readiness is clean.
- AI Pass/Fail is excluded from annual performance score.
- Score preview snapshot reviewed.
- HR approval and write lock are recorded.

### E. Grade calculation gate

Required before official `gradeId` write:

- Official `totalScore` is written and locked.
- Grade policy readiness is clean.
- Calibration/CEO readiness complete.
- Grade preview snapshot reviewed.
- HR/CEO approval and write lock are recorded.

### F. Finalization gate

Required before final lock/result publication:

- CEO confirmation complete.
- HR approval complete.
- Appeal window policy configured.
- Result publication date configured.
- Final audit event written transactionally.

## Permission Model

Current role checks:

- Core evaluation routes allow evaluator or admin.
- Assignment routes use `authorizeMenu('EVAL_CYCLE')`.
- Calibration routes allow `ROLE_ADMIN` and `ROLE_CEO`.
- Appeal routes allow employee owner actions and admin resolution actions.
- Page-level access is mapped through `PERFORMANCE_EVALUATION`, `EVAL_CYCLE`, `GRADE_ADJUST`, `APPEAL`, and related menu permissions.

Required 2026 write roles:

- HR admin: population, assignment override, phase open/close, final publication.
- Employee: own SELF draft/submit only.
- Assigned reviewer: own stage draft/submit only.
- CEO/admin: CEO adjustment and final confirmation only.
- System job: score/grade writes only when explicit HR-approved gate is open.

Every official write must verify:

- cycle id
- actor role
- actor relationship to target/stage
- stage state
- write gate state
- no conflicting previous finalization
- audit event can be written in the same transaction or the operation fails

## Audit Requirements

Official write audit must be mandatory for:

- population run create/reset
- Evaluation create
- EvaluationItem create
- draft save
- stage submit
- return/reopen
- reviewer reassignment after progress
- official score write
- official grade write
- CEO adjustment save/confirm
- finalization
- appeal open/resolve

Recommended addition:

- Add an append-only `EvaluationAuditEvent` or `EvaluationStageSubmission` table for structured stage history.
- Keep generic `AuditLog` for cross-system audit display, but do not rely on best-effort audit for official write integrity.

## Recommended Schema Additions

Do not create this migration in the current PR. The next schema PR should propose these explicitly.

Minimum additions:

- `Evaluation.operationMode`: `OFFICIAL`, `SANDBOX`
- `Evaluation.populationRunId`
- `Evaluation.scoreWriteStatus`: `NOT_READY`, `PREVIEWED`, `APPROVED`, `WRITTEN`, `LOCKED`
- `Evaluation.gradeWriteStatus`: `NOT_READY`, `PREVIEWED`, `APPROVED`, `WRITTEN`, `LOCKED`
- `Evaluation.finalizedAt`
- `Evaluation.finalizedById`
- `Evaluation.returnedAt`
- `Evaluation.returnedById`
- `Evaluation.returnReason`
- `EvalCycle.officialEvaluationStatus`
- `EvalCycle.officialActivatedAt`
- `EvalCycle.officialActivatedById`
- `EvaluationPopulationRun`
- `EvaluationStageSubmission`
- `EvaluationAuditEvent`

If sandbox persistence is still desired, add:

- `EvaluationSandboxSession`
- `EvaluationSandboxItem`

## Recommended API Sequence

Do not implement these in one PR.

1. Schema migration for official write gates and audit history.
2. Read-only official flow status API that maps existing rows to the new state machine.
3. Population dry-run confirmation API with no writes.
4. Official population API that creates Evaluation/EvaluationItem only after gate approval.
5. SELF draft/save/submit API that never writes score/grade result fields.
6. FIRST review draft/save/submit API with return/reopen.
7. SECOND/FINAL review draft/save/submit API.
8. CEO adjustment draft/confirm API.
9. Score calculation preview API.
10. Official score write API with approval and lock.
11. Grade calculation preview API.
12. Official grade write API with approval and lock.
13. Finalization and result publication API.
14. Appeal/reopen resolution API.

## Prohibited Actions That Remain Blocked

- production data mutation from preview screens
- migration or `prisma migrate deploy`
- dry-run execution from UI
- backfill
- `backfill --apply`
- official scoring activation
- official grade activation
- AI score exclusion activation
- uncontrolled `Evaluation.totalScore` write
- uncontrolled `Evaluation.gradeId` write
- official Evaluation/EvaluationItem creation before population gate
- production feature flag changes
- emails or notifications from preview-only flow

## Implementation Recommendation

The next engineering step should be a schema/API design PR, not an official write PR.

Recommended next PR:

`feat: add 2026 evaluation official write gates`

It should include schema changes, transactional audit design, and read-only state mapping tests. Official save buttons should still remain absent until the gate API is reviewed and approved.
