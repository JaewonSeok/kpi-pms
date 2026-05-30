# RFC: 2026 Evaluation Official Schema Boundary

## 1. Summary

This RFC defines the schema boundary that must exist before the 2026 evaluation workbench can move from preview-only operation to official save flows.

This is a design-only document. It does not edit `prisma/schema.prisma`, does not create a migration, does not add write APIs, and does not enable official scoring or grade calculation.

Primary decision:

- The current schema can express parts of the evaluation workflow.
- The current schema is not safe enough to activate 2026 official save flows as-is.
- Minor schema additions are required to separate preview, sandbox, draft, official, score write, grade write, finalization, audit, and rollback boundaries.

## 2. Background

The current 2026 evaluation UI now separates:

- `/evaluation/performance`: compact HR/admin daily dashboard.
- `/evaluation/workbench`: preview-only evaluation workbench.
- `/admin/evaluation-readiness`: official transition/readiness/dry-run tools.
- `/admin/evaluation-ops`: HR/admin operations hub.

The workbench supports preview-only item-level flow for:

- self evaluation
- first review
- second/final review
- CEO adjustment
- score preview
- grade preview
- safety confirmation

The next step is not to enable official writes. The next step is to define the schema and API boundaries that make official writes safe later.

## 3. Current Persistence Model

### EvalCycle

Current role:

- Owns evaluation year, cycle name, status, schedule windows, and config JSON fields.
- Stores `performanceDesignConfig` for 2026 readiness metadata.
- Stores `calibrationSessionConfig` for calibration and CEO/final workflows.

Current fields relevant to this RFC:

- `status`
- `showQuestionWeight`
- `showScoreSummary`
- `goalEditMode`
- `performanceDesignConfig`
- `calibrationSessionConfig`
- stage schedule dates
- `appealDeadline`

Current status enum:

- `SETUP`
- `KPI_SETTING`
- `IN_PROGRESS`
- `SELF_EVAL`
- `FIRST_EVAL`
- `SECOND_EVAL`
- `FINAL_EVAL`
- `CEO_ADJUST`
- `RESULT_OPEN`
- `APPEAL`
- `CLOSED`

Gap:

- No explicit official evaluation activation status for 2026.
- No explicit population gate state.
- No explicit score write gate.
- No explicit grade write gate.
- No official finalization ownership metadata.

### Evaluation

Current role:

- One evaluation row per cycle, target, and stage.
- Unique key: `[evalCycleId, targetId, evalStage]`.
- Stores both stage draft state and final result fields.

Current fields relevant to this RFC:

- `evalCycleId`
- `targetId`
- `evaluatorId`
- `evalStage`
- `status`
- `isDraft`
- `submittedAt`
- `isRejected`
- `rejectionReason`
- `rejectedAt`
- `totalScore`
- `organizationPerformanceScore`
- `personalPerformanceScore`
- `aiScoreIncludedInTotal`
- `scorePolicySnapshot`
- `gradeId`
- comment fields

Current stage enum:

- `SELF`
- `FIRST`
- `SECOND`
- `FINAL`
- `CEO_ADJUST`

Current status enum:

- `PENDING`
- `IN_PROGRESS`
- `SUBMITTED`
- `REJECTED`
- `CONFIRMED`

Gap:

- `totalScore` is on the same row draft save can update.
- `gradeId` is on the same row draft save can update.
- There is no score write status.
- There is no grade write status.
- There is no explicit operation mode such as official or sandbox.
- There is no population run reference.
- There is no structured finalized/returned/reopened metadata beyond current rejection fields.

### EvaluationItem

Current role:

- Item-level KPI score/comment row under one `Evaluation`.
- Stores policy category, score contribution metadata, adjustment fields, item scores, comments, and weighted score.

Current fields relevant to this RFC:

- `evaluationId`
- `personalKpiId`
- `policyCategory`
- `scoreContributionType`
- `policyFormulaVersion`
- `basePolicyScore`
- `adjustmentScore`
- `adjustmentGroupKey`
- `adjustmentReason`
- `targetAchievementLevel`
- `policyScoreSnapshot`
- score fields
- `itemComment`
- `weightedScore`

Gap:

- No explicit item-level draft/submitted history.
- No relation to population run.
- No item-level official write lock.

### EvaluationAssignment

Current role:

- Stores evaluator assignment per cycle, target, and stage.
- Supports `AUTO` and `MANUAL`.

Current fields relevant to this RFC:

- `evalCycleId`
- `targetId`
- `evalStage`
- `evaluatorId`
- `assignmentSource`
- `note`
- `createdById`
- `updatedById`

Gap:

- Assignment sync can update evaluatorId on existing editable Evaluation rows.
- Official 2026 flow needs assignment changes after stage progress to be gated and audited explicitly.

### EvaluationGradePolicy

Current role:

- Stores 2026 grade policy by year, policy version, threshold group, and grade label.

Current fields relevant to this RFC:

- `evalYear`
- `policyVersion`
- `thresholdGroup`
- `gradeLabel`
- `displayName`
- `minScore`
- `maxScore`
- inclusive flags
- `selectionRule`
- `notes`
- `isActive`

Gap:

- The policy can support preview.
- Official `gradeId` write still needs a separate write gate and audit boundary.

### AuditLog

Current role:

- Generic audit table.
- Used by evaluation draft save, submit, return, calibration, guide confirmation, assignments, appeals, and readiness metadata updates.

Current fields relevant to this RFC:

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

- Current helper catches audit errors.
- Official writes need transactional audit: if audit fails, official write should fail.
- There is no structured stage submission history model.

### Appeal

Current role:

- Stores submitted appeal records after result open.

Current fields relevant to this RFC:

- `evaluationId`
- `appealerId`
- `reason`
- `status`
- `adminResponse`
- `resolvedAt`

Current status enum:

- `SUBMITTED`
- `UNDER_REVIEW`
- `ACCEPTED`
- `REJECTED`
- `CLOSED`

Gap:

- Appeal resolution does not define official score/grade rewrite semantics.
- Draft appeal state currently uses AuditLog rather than a first-class draft record.

## 4. Current Write API Inventory

| Route | Method | Writes Evaluation | Writes EvaluationItem | Writes totalScore | Writes gradeId | Stage/status side effect | Notification/email side effect | Audit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/evaluation` | POST | yes | yes | no | no | creates SELF as `IN_PROGRESS` | no | no direct audit found |
| `/api/evaluation/[id]` | PATCH | yes | yes | yes | yes | sets `IN_PROGRESS`, `isDraft=true` | no | `EVALUATION_SAVE_DRAFT` |
| `/api/evaluation/[id]/submit` | PATCH | yes | yes | yes | yes | submits current stage, may create next stage | creates notification for next evaluator | `EVALUATION_SUBMIT` |
| `/api/evaluation/[id]/review` | PATCH | yes | yes | clears current | clears current | returns/reopens prior stage | creates rejection notification | return/reopen audit |
| `/api/evaluation/[id]/guide` | PATCH | no | no | no | no | none | no | guide viewed/confirmed |
| `/api/evaluation/calibration` | PATCH | yes | yes | yes | yes | creates/updates/deletes `CEO_ADJUST` | no email seen | calibration audit |
| `/api/evaluation/calibration/workflow` | POST | yes for merge/delete | yes for merge/delete | copies existing | copies existing | starts/locks/merges/deletes calibration session | no email seen | calibration audit |
| `/api/admin/performance-assignments` | POST | can update evaluatorId | no | no | no | assignment sync/override/reset | no | assignment audit |
| `/api/appeals` | POST | no | no | no | no | creates Appeal on submit | no | appeal audit |
| `/api/appeals/[id]` | PATCH | no | no | no | no | updates Appeal status | no | appeal workflow audit |
| `/api/evaluation/results/[cycleId]/acknowledge` | POST | no | no | no | no | none | no | result acknowledgement audit |
| `/api/evaluation/preview-2026/*` | GET/PATCH | no official Evaluation writes | no official item writes | no | no | readiness metadata only | no | some metadata audit |

Unsafe to reuse as-is for 2026 official flow:

- Draft save route, because it can write `totalScore` and `gradeId`.
- Submit route, because it writes result fields and creates next official stage rows.
- Calibration route, because it writes `CEO_ADJUST`, `totalScore`, and `gradeId`.
- Calibration workflow merge/delete, because it creates or deletes official `CEO_ADJUST` rows.
- Assignment sync after stage progress, because it can change official evaluator routing.

## 5. Problems With Current Schema

1. Preview/local state is currently not represented, which is good, but any future persistence needs explicit sandbox separation.
2. Draft and official state share the same `Evaluation` row.
3. Score/grade result fields are writable through draft and submit routes.
4. Current `EvalStatus` is not granular enough for 2026 official state machine gates.
5. Population attempts are not traceable.
6. Stage submissions are not first-class records.
7. Return/reopen history is embedded in mutable fields and generic audit.
8. CEO adjustment reason exists as comment/adjust fields, but not as a required official boundary.
9. Audit is generic and best-effort.
10. Sandbox/draft/official records are not distinguishable by schema.

## 6. Schema Boundary Principles

1. Preview/local state is not persisted.
2. Sandbox/draft data must be explicitly marked non-official.
3. Official evaluation data must be created only by the population gate.
4. `Evaluation.totalScore` must not be written by draft save.
5. `Evaluation.gradeId` must not be written by draft save.
6. Official score writes require a score write gate.
7. Official grade writes require a grade write gate.
8. Stage submissions must be auditable.
9. Returned/reopened evaluations must be auditable.
10. CEO adjustment must require an explicit reason when score or grade changes.
11. Population runs must be traceable.
12. Official and sandbox/draft records must be distinguishable by schema, not by convention only.
13. Official write audit must be transactional.
14. Notifications must happen only after the official write transaction succeeds.
15. Rollback must be tied to population run or stage submission history.

## 7. Proposed Schema Additions

This section is documentation only. Do not copy it into `schema.prisma` until a separate migration PR is approved.

### Evaluation additions

```prisma
operationMode EvaluationOperationMode @default(OFFICIAL)
officialState OfficialEvaluationState @default(NOT_POPULATED)
populationRunId String?
populationRun EvaluationPopulationRun? @relation(fields: [populationRunId], references: [id])
scoreWriteStatus ScoreWriteStatus @default(NOT_ALLOWED)
gradeWriteStatus GradeWriteStatus @default(NOT_ALLOWED)
finalizedAt DateTime?
finalizedById String?
returnedAt DateTime?
returnedById String?
returnReason String?
ceoConfirmedAt DateTime?
ceoConfirmedById String?
ceoAdjustmentReason String?
scoreCalculatedAt DateTime?
scoreCalculatedById String?
gradeCalculatedAt DateTime?
gradeCalculatedById String?
```

Boundary:

- `operationMode` distinguishes official from sandbox/imported records.
- `officialState` maps the 2026 state machine without overloading `EvalStatus`.
- `scoreWriteStatus` protects `totalScore`.
- `gradeWriteStatus` protects `gradeId`.
- finalization and return metadata make rollback/reopen auditable.

### EvalCycle additions

```prisma
officialEvaluationStatus OfficialEvaluationCycleStatus @default(NOT_STARTED)
officialEvaluationStartedAt DateTime?
officialEvaluationStartedById String?
officialEvaluationFinalizedAt DateTime?
officialEvaluationFinalizedById String?
```

Boundary:

- Cycle-level official state must be separate from the historical `CycleStatus`.
- Existing `CycleStatus` can continue to drive UI schedule windows.
- New official status controls official population, score, grade, and finalization gates.

### New model: EvaluationPopulationRun

Purpose:

- Track official and sandbox population attempts.
- Make official Evaluation/EvaluationItem creation traceable and rollbackable.

```prisma
model EvaluationPopulationRun {
  id String @id @default(cuid())
  cycleId String
  cycle EvalCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  operationMode EvaluationOperationMode
  status EvaluationPopulationRunStatus
  sourceSnapshotHash String?
  targetEmployeeCount Int @default(0)
  createdEvaluationCount Int @default(0)
  createdEvaluationItemCount Int @default(0)
  skippedCount Int @default(0)
  blockerSummaryJson Json?
  dryRunOutputJson Json?
  approvalReference String?
  appliedAt DateTime?
  appliedById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### New model: EvaluationStageSubmission

Purpose:

- Track stage-level actions separately from mutable `Evaluation`.

```prisma
model EvaluationStageSubmission {
  id String @id @default(cuid())
  evaluationId String
  evaluation Evaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  stage EvalStage
  action EvaluationStageAction
  actorId String
  fromStatus EvalStatus?
  toStatus EvalStatus?
  fromOfficialState OfficialEvaluationState?
  toOfficialState OfficialEvaluationState?
  reason String?
  payloadSnapshotJson Json?
  createdAt DateTime @default(now())
}
```

### New model: EvaluationAuditEvent

Purpose:

- Provide transactional official evaluation audit separate from best-effort generic `AuditLog`.

```prisma
model EvaluationAuditEvent {
  id String @id @default(cuid())
  cycleId String
  employeeId String?
  evaluationId String?
  evaluationItemId String?
  eventType String
  actorId String
  operationMode EvaluationOperationMode
  beforeJson Json?
  afterJson Json?
  metadataJson Json?
  requestId String?
  createdAt DateTime @default(now())
}
```

### Optional model: EvaluationSandboxSession

Purpose:

- Persist non-official workbench pilot drafts without touching official `Evaluation`.

```prisma
model EvaluationSandboxSession {
  id String @id @default(cuid())
  cycleId String
  employeeId String
  ownerId String
  status String
  payloadJson Json
  expiresAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Use only if sandbox persistence becomes a product requirement.

## 8. Proposed Enums

```prisma
enum EvaluationOperationMode {
  OFFICIAL
  SANDBOX
  PREVIEW_IMPORTED
}

enum OfficialEvaluationState {
  NOT_POPULATED
  POPULATED
  SELF_DRAFT
  SELF_SUBMITTED
  FIRST_DRAFT
  FIRST_SUBMITTED
  SECOND_DRAFT
  SECOND_SUBMITTED
  FINAL_DRAFT
  FINAL_SUBMITTED
  CEO_ADJUST_DRAFT
  CEO_CONFIRMED
  SCORE_CALCULATED
  GRADE_CALCULATED
  FINALIZED
  RETURNED_FOR_REVISION
  APPEAL_OPEN
  APPEAL_RESOLVED
}

enum OfficialEvaluationCycleStatus {
  NOT_STARTED
  POPULATION_READY
  POPULATED
  IN_PROGRESS
  SCORE_READY
  GRADE_READY
  FINALIZED
}

enum ScoreWriteStatus {
  NOT_ALLOWED
  READY_FOR_CALCULATION
  CALCULATED
  LOCKED
}

enum GradeWriteStatus {
  NOT_ALLOWED
  READY_FOR_CALCULATION
  CALCULATED
  LOCKED
}

enum EvaluationPopulationRunStatus {
  DRY_RUN
  READY_FOR_APPLY
  APPLIED
  FAILED
  REJECTED
}

enum EvaluationStageAction {
  DRAFT_SAVED
  SUBMITTED
  RETURNED
  REOPENED
  APPROVED
  CEO_CONFIRMED
}
```

Mapping note:

- Keep existing `CycleStatus`, `EvalStage`, and `EvalStatus`.
- Add official state enums as gate metadata rather than replacing existing enums immediately.

## 9. State Machine

| Current state | Next state | Actor | Permission | Future API route | Required data | Writes official data | Writes totalScore | Writes gradeId | Audit required | Notification allowed | Rollback/reopen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NOT_POPULATED` | `POPULATED` | HR admin | `EVAL_CYCLE` | `POST /api/evaluation/2026/population/apply` | approved population run, KPI coverage, policyCategory, assignments | yes | no | no | yes | no | rollback by populationRunId |
| `POPULATED` | `SELF_DRAFT` | employee | target self | `PATCH /api/evaluation/2026/[evaluationId]/stage/SELF/draft` | item draft payload | yes | no | no | yes | no | clear draft only |
| `SELF_DRAFT` | `SELF_SUBMITTED` | employee | target self | `POST /api/evaluation/2026/[evaluationId]/stage/SELF/submit` | required comments/evidence | yes | no | no | yes | yes after commit | return to self draft |
| `SELF_SUBMITTED` | `FIRST_DRAFT` | first reviewer | assigned reviewer | `PATCH /api/evaluation/2026/[evaluationId]/stage/FIRST/draft` | reviewer draft | yes | no | no | yes | no | reopen self by policy |
| `FIRST_DRAFT` | `FIRST_SUBMITTED` | first reviewer | assigned reviewer | `POST /api/evaluation/2026/[evaluationId]/stage/FIRST/submit` | reviewer scores, comments, reasons | yes | no | no | yes | yes after commit | return to first draft |
| `FIRST_SUBMITTED` | `SECOND_DRAFT` | second reviewer | assigned reviewer | `PATCH /api/evaluation/2026/[evaluationId]/stage/SECOND/draft` | reviewer draft | yes | no | no | yes | no | return to first |
| `SECOND_DRAFT` | `SECOND_SUBMITTED` | second reviewer | assigned reviewer | `POST /api/evaluation/2026/[evaluationId]/stage/SECOND/submit` | reviewer scores, comments, reasons | yes | no | no | yes | yes after commit | return to second draft |
| `SECOND_SUBMITTED` | `FINAL_DRAFT` | final reviewer | assigned reviewer | `PATCH /api/evaluation/2026/[evaluationId]/stage/FINAL/draft` | final review draft | yes | no | no | yes | no | return to second |
| `FINAL_DRAFT` | `FINAL_SUBMITTED` | final reviewer | assigned reviewer | `POST /api/evaluation/2026/[evaluationId]/stage/FINAL/submit` | final review payload | yes | no | no | yes | yes after commit | return to final draft |
| `FINAL_SUBMITTED` | `CEO_ADJUST_DRAFT` | CEO/admin | `GRADE_ADJUST` | `PATCH /api/evaluation/2026/[evaluationId]/ceo-adjust/draft` | adjustment draft | yes | no | no | yes | no | clear CEO draft |
| `CEO_ADJUST_DRAFT` | `CEO_CONFIRMED` | CEO/admin | `GRADE_ADJUST` | `POST /api/evaluation/2026/[evaluationId]/ceo-confirm` | reason if adjusted | yes | no | no | yes | yes after commit | reopen CEO draft |
| `CEO_CONFIRMED` | `SCORE_CALCULATED` | HR admin/system | score gate | `POST /api/evaluation/2026/[evaluationId]/score/calculate` | score snapshot, policy version | yes | yes | no | yes | no | score unlock by admin only |
| `SCORE_CALCULATED` | `GRADE_CALCULATED` | HR admin/system | grade gate | `POST /api/evaluation/2026/[evaluationId]/grade/calculate` | grade policy snapshot | yes | no | yes | yes | no | grade unlock by admin only |
| `GRADE_CALCULATED` | `FINALIZED` | HR admin/CEO | finalization gate | `POST /api/evaluation/2026/[evaluationId]/finalize` | HR approval, CEO confirmation | yes | no | no | yes | result notification allowed | reopen only through appeal/admin policy |
| any review state | `RETURNED_FOR_REVISION` | reviewer/admin | assigned reviewer/admin | `POST /api/evaluation/2026/[evaluationId]/stage/[stage]/return` | reason | yes | no | no | yes | yes after commit | resume from returned stage |
| `FINALIZED` | `APPEAL_OPEN` | employee | owner | existing/future appeal route | appeal reason | yes | no | no | yes | yes after commit | appeal close |
| `APPEAL_OPEN` | `APPEAL_RESOLVED` | HR admin | appeal admin | future appeal resolution route | resolution | yes | maybe only through score route | maybe only through grade route | yes | yes after commit | reopen through policy |

## 10. API Boundary

These routes are proposed for future PRs only.

### Population

`POST /api/evaluation/2026/population/dry-run`

- Official or sandbox: no official writes.
- Permission: HR admin.
- Validation: cycle id, target scope, readiness snapshot id.
- Audit: dry-run audit optional.
- Notification: none.
- Prohibited fields: direct Evaluation create.
- Allowed fields: dry-run output only.
- Gate checks: readiness gate.

`POST /api/evaluation/2026/population/apply`

- Official or sandbox: official.
- Permission: HR admin.
- Validation: approved dry-run id, HR approval reference.
- Audit: mandatory transactional `EvaluationAuditEvent`.
- Notification: none by default.
- Prohibited fields: score/grade result fields.
- Allowed fields: Evaluation/EvaluationItem population fields only.
- Gate checks: population gate.

### Stage draft/submit

`PATCH /api/evaluation/2026/[evaluationId]/stage/[stage]/draft`

- Official or sandbox: official stage draft.
- Permission: target employee or assigned reviewer for stage.
- Validation: stage payload schema.
- Audit: mandatory stage draft event.
- Notification: none.
- Prohibited fields: `totalScore`, `gradeId`, finalization fields.
- Allowed fields: comments, item-level stage scores/comments.
- Gate checks: stage open, actor assignment, prior state.

`POST /api/evaluation/2026/[evaluationId]/stage/[stage]/submit`

- Official or sandbox: official.
- Permission: target employee or assigned reviewer for stage.
- Validation: required comments/evidence/reasons.
- Audit: mandatory stage submission event.
- Notification: after transaction only.
- Prohibited fields: direct score/grade writes.
- Allowed fields: stage submitted state.
- Gate checks: prior state, stage open, actor assignment.

`POST /api/evaluation/2026/[evaluationId]/stage/[stage]/return`

- Official or sandbox: official.
- Permission: reviewer/admin.
- Validation: reason required.
- Audit: mandatory return event.
- Notification: after transaction only.
- Prohibited fields: score/grade writes.
- Allowed fields: returned state metadata.
- Gate checks: return policy.

`POST /api/evaluation/2026/[evaluationId]/stage/[stage]/reopen`

- Official or sandbox: official.
- Permission: HR admin or policy-approved reviewer.
- Validation: reason required.
- Audit: mandatory reopen event.
- Notification: after transaction only.
- Prohibited fields: score/grade writes unless explicit unlock route.
- Allowed fields: reopen metadata.
- Gate checks: not finalized or appeal-approved reopen.

### Score/grade

`POST /api/evaluation/2026/[evaluationId]/score/calculate`

- Official or sandbox: official.
- Permission: HR admin or approved system job.
- Validation: score policy version, completed stage snapshot.
- Audit: mandatory score write event.
- Notification: none.
- Prohibited fields: `gradeId`.
- Allowed fields: `totalScore`, score snapshot, score status.
- Gate checks: score write gate.

`POST /api/evaluation/2026/[evaluationId]/grade/calculate`

- Official or sandbox: official.
- Permission: HR admin or approved system job.
- Validation: grade policy version, locked score.
- Audit: mandatory grade write event.
- Notification: none.
- Prohibited fields: stage draft fields.
- Allowed fields: `gradeId`, grade status.
- Gate checks: grade write gate.

### CEO/final

`PATCH /api/evaluation/2026/[evaluationId]/ceo-adjust/draft`

- Official or sandbox: official.
- Permission: CEO/admin.
- Validation: adjustment reason if score/grade-affecting.
- Audit: mandatory CEO draft event.
- Notification: none.
- Prohibited fields: direct finalization.
- Allowed fields: CEO adjustment draft fields.
- Gate checks: final review complete.

`POST /api/evaluation/2026/[evaluationId]/ceo-confirm`

- Official or sandbox: official.
- Permission: CEO/admin.
- Validation: reason if changed.
- Audit: mandatory CEO confirmation event.
- Notification: after transaction only.
- Prohibited fields: direct score/grade writes unless routed through gates.
- Allowed fields: CEO confirmation metadata.
- Gate checks: CEO gate.

`POST /api/evaluation/2026/[evaluationId]/finalize`

- Official or sandbox: official.
- Permission: HR admin plus CEO/final approval policy.
- Validation: score locked, grade locked, appeal policy ready.
- Audit: mandatory finalization event.
- Notification: result notification after transaction only.
- Prohibited fields: score/grade recalculation.
- Allowed fields: finalization metadata.
- Gate checks: finalization gate.

### Sandbox

Use only if `EvaluationSandboxSession` is approved.

`GET /api/evaluation/workbench/pilot-draft`

- Official or sandbox: sandbox.
- Permission: owner/admin.
- Audit: optional.
- Prohibited fields: official Evaluation/EvaluationItem writes.

`POST /api/evaluation/workbench/pilot-draft`

- Official or sandbox: sandbox.
- Permission: owner/admin.
- Audit: sandbox save event.
- Allowed fields: sandbox payload only.
- Prohibited fields: `totalScore`, `gradeId` official writes.

`DELETE /api/evaluation/workbench/pilot-draft`

- Official or sandbox: sandbox.
- Permission: owner/admin.
- Audit: sandbox reset event.
- Prohibited fields: official deletes.

## 11. Migration Plan

Do not create migrations in this RFC PR.

| Step | Scope | Risk | Rollback | Tests | Deployment order | Production data effect | HR approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Add enums and nullable fields | low | revert migration before use | prisma generate, typecheck | deploy before code uses fields | no data mutation except nullable columns | no |
| 2 | Add tracking models | low/medium | drop unused tables if empty | schema/client tests | after step 1 | new empty tables | no |
| 3 | Backfill safe defaults | medium | reverse update by recorded script | dry-run first, row count assertions | after models deployed | updates metadata only | yes |
| 4 | Add read-only verification query | low | revert helper | unit tests | after defaults | none | no |
| 5 | Add official write gate helpers | medium | feature flag off, no route wiring | gate matrix tests | before write APIs | none | yes for policy |
| 6 | Refactor draft save to reject score/grade writes | high | old route retained behind guard only if safe | route validation tests | before opening 2026 save | behavior change for official flow | yes |
| 7 | Add population dry-run/apply | high | rollback by populationRunId | population run tests | after gates | creates official rows only after approval | yes |
| 8 | Add stage draft/submit APIs | high | disable route via gate | stage tests | after population | official stage writes | yes |
| 9 | Add score write API | high | unlock/recalculate policy | score gate tests | after stage completion | writes `totalScore` | yes |
| 10 | Add grade write API | high | grade unlock policy | grade gate tests | after score lock | writes `gradeId` | yes |
| 11 | Add CEO/finalization write | high | reopen policy | finalization tests | after grade lock | finalizes result | yes |
| 12 | Add appeal/reopen integration | high | admin-only rollback policy | appeal tests | after finalization | may change official result via gated routes | yes |

## 12. Permission Model

| Actor | Allowed future actions | Blocked actions |
| --- | --- | --- |
| Employee | own SELF draft, own SELF submit, own appeal | reviewer stages, score write, grade write, finalization |
| First reviewer | FIRST draft/submit for assigned targets, return to SELF by policy | self submit, score write, grade write, finalization |
| Second reviewer | SECOND draft/submit for assigned targets, return by policy | unrelated targets, score/grade writes |
| Final reviewer | FINAL draft/submit for assigned targets, return by policy | CEO confirmation unless role permits |
| HR admin | population, assignment, gate approvals, final publication by policy | bypassing audit, writing score/grade outside gates |
| CEO / CEO office | CEO adjustment/confirmation | population apply unless also HR/admin policy permits |
| Developer/watch | read-only diagnostics and logs | all production writes |

Every official write must check:

- authenticated actor
- actor role
- actor relation to target/stage
- cycle official status
- stage state
- score/grade write status when relevant
- operation mode
- audit event creation

## 13. Audit Model

Generic `AuditLog` should remain for cross-system audit visibility.

New official evaluation writes should also create `EvaluationAuditEvent` transactionally.

Required audit events:

- population dry-run approved
- population applied
- Evaluation created
- EvaluationItem created
- draft saved
- stage submitted
- stage returned
- stage reopened
- evaluator reassigned after population
- CEO adjustment drafted
- CEO confirmed
- score calculated
- grade calculated
- finalized
- appeal opened
- appeal resolved

Audit must include:

- actor id
- operation mode
- cycle id
- target employee id
- evaluation id
- before/after payload
- request id
- reason when relevant
- approval reference when relevant

## 14. Rollback and Safety Plan

Population rollback:

- Roll back by `populationRunId`.
- Only allowed before any stage submission.
- Must delete created EvaluationItem rows before Evaluation rows.
- Must audit all deleted row ids.

Stage rollback:

- Use `EvaluationStageSubmission` history.
- Return/reopen must require reason.
- Reopen after finalization must be blocked unless appeal/admin policy allows it.

Score rollback:

- `totalScore` can be recalculated only if score status is not `LOCKED`.
- Unlocking a locked score requires HR admin approval and audit.

Grade rollback:

- `gradeId` can be recalculated only if grade status is not `LOCKED`.
- Unlocking a locked grade requires HR/CEO approval and audit.

Finalization rollback:

- Not allowed through normal workbench UI.
- Must use explicit admin/appeal route with audit.

Safety invariants:

- Draft save cannot write `totalScore`.
- Draft save cannot write `gradeId`.
- Preview cannot create official Evaluation or EvaluationItem rows.
- Sandbox cannot be inferred by route name only; schema must mark it.
- Official write without audit must fail.

## 15. Recommended Implementation Sequence

1. Schema boundary migration PR
   - Scope: enums, nullable fields, tracking models.
   - Files likely touched: `prisma/schema.prisma`, generated Prisma client, schema tests.
   - Tests: prisma generate, typecheck, schema integrity tests.
   - Safety gate: no routes wired.
   - Still prohibited: official writes.

2. Official write guard helper PR
   - Scope: pure gate helpers and read-only state mapping.
   - Files likely touched: `src/server/evaluation-2026-official-state.ts`, tests.
   - Tests: state machine and permission matrix.
   - Safety gate: no write route.
   - Still prohibited: population apply and score/grade writes.

3. Population dry-run/apply PR
   - Scope: population run model usage.
   - Tests: dry-run no writes, apply gated by HR approval, rollback test.
   - Safety gate: apply route hidden until approval.
   - Still prohibited: score/grade writes.

4. Self draft/submit PR
   - Scope: SELF stage only.
   - Tests: no `totalScore`/`gradeId` write.
   - Safety gate: employee owns target.
   - Still prohibited: review/finalization writes.

5. First review draft/submit PR
   - Scope: FIRST stage only.
   - Tests: assignment gate, return reason.
   - Safety gate: assigned reviewer only.
   - Still prohibited: score/grade writes.

6. Second/final review draft/submit PR
   - Scope: SECOND and FINAL stages.
   - Tests: prior stage dependency, final reviewer gate.
   - Safety gate: assignment and stage state.
   - Still prohibited: CEO/final writes.

7. CEO adjustment/confirmation PR
   - Scope: CEO adjustment draft and confirm.
   - Tests: reason required, CEO/admin permission.
   - Safety gate: final submitted first.
   - Still prohibited: score/grade writes unless separate gate.

8. Score write PR
   - Scope: official score calculation.
   - Tests: policy ready, all stages complete, writes only through score route.
   - Safety gate: score approval.
   - Still prohibited: grade write.

9. Grade write PR
   - Scope: official grade calculation.
   - Tests: score locked, grade policy ready.
   - Safety gate: grade approval.
   - Still prohibited: finalization until next PR.

10. Finalization/appeal PR
    - Scope: final result lock and appeal integration.
    - Tests: finalization gate, appeal reopen policy.
    - Safety gate: HR/CEO approval.
    - Still prohibited: unrestricted mutation.

## 16. Explicitly Prohibited Actions

This RFC does not allow:

- production data mutation
- migration creation
- `prisma migrate deploy`
- dry-run execution
- backfill
- `backfill --apply`
- official scoring activation
- official grade activation
- AI score exclusion activation
- `Evaluation.totalScore` write
- `Evaluation.gradeId` write
- official Evaluation creation
- official EvaluationItem creation
- production feature flag changes
- emails or notifications
- official save/submit/finalize buttons
- official write API behavior changes
- edits to `prisma/schema.prisma`
- files under `prisma/migrations`
