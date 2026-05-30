-- 2026 evaluation official schema boundary.
-- Additive only: no official writes are wired by this migration.

CREATE TYPE "EvaluationOperationMode" AS ENUM ('OFFICIAL', 'SANDBOX', 'PREVIEW_IMPORTED');

CREATE TYPE "OfficialEvaluationState" AS ENUM (
  'NOT_POPULATED',
  'POPULATED',
  'SELF_DRAFT',
  'SELF_SUBMITTED',
  'FIRST_DRAFT',
  'FIRST_SUBMITTED',
  'SECOND_DRAFT',
  'SECOND_SUBMITTED',
  'FINAL_DRAFT',
  'FINAL_SUBMITTED',
  'CEO_ADJUST_DRAFT',
  'CEO_CONFIRMED',
  'SCORE_CALCULATED',
  'GRADE_CALCULATED',
  'FINALIZED',
  'RETURNED_FOR_REVISION',
  'APPEAL_OPEN',
  'APPEAL_RESOLVED'
);

CREATE TYPE "OfficialEvaluationCycleStatus" AS ENUM (
  'NOT_STARTED',
  'POPULATION_READY',
  'POPULATED',
  'IN_PROGRESS',
  'SCORE_READY',
  'GRADE_READY',
  'FINALIZED'
);

CREATE TYPE "ScoreWriteStatus" AS ENUM (
  'NOT_ALLOWED',
  'READY_FOR_CALCULATION',
  'CALCULATED',
  'LOCKED'
);

CREATE TYPE "GradeWriteStatus" AS ENUM (
  'NOT_ALLOWED',
  'READY_FOR_CALCULATION',
  'CALCULATED',
  'LOCKED'
);

CREATE TYPE "EvaluationPopulationRunStatus" AS ENUM (
  'DRY_RUN',
  'READY_FOR_APPLY',
  'APPLIED',
  'FAILED',
  'REJECTED'
);

CREATE TYPE "EvaluationStageAction" AS ENUM (
  'DRAFT_SAVED',
  'SUBMITTED',
  'RETURNED',
  'REOPENED',
  'APPROVED',
  'CEO_CONFIRMED'
);

ALTER TABLE "eval_cycles"
  ADD COLUMN "officialEvaluationStatus" "OfficialEvaluationCycleStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "officialEvaluationStartedAt" TIMESTAMP(3),
  ADD COLUMN "officialEvaluationStartedById" TEXT,
  ADD COLUMN "officialEvaluationFinalizedAt" TIMESTAMP(3),
  ADD COLUMN "officialEvaluationFinalizedById" TEXT;

CREATE TABLE "evaluation_population_runs" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "operationMode" "EvaluationOperationMode" NOT NULL,
  "status" "EvaluationPopulationRunStatus" NOT NULL,
  "sourceSnapshotHash" TEXT,
  "targetEmployeeCount" INTEGER NOT NULL DEFAULT 0,
  "createdEvaluationCount" INTEGER NOT NULL DEFAULT 0,
  "createdEvaluationItemCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "blockerSummaryJson" JSONB,
  "dryRunOutputJson" JSONB,
  "approvalReference" TEXT,
  "appliedAt" TIMESTAMP(3),
  "appliedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "evaluation_population_runs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "evaluations"
  ADD COLUMN "operationMode" "EvaluationOperationMode" NOT NULL DEFAULT 'OFFICIAL',
  ADD COLUMN "officialState" "OfficialEvaluationState" NOT NULL DEFAULT 'NOT_POPULATED',
  ADD COLUMN "populationRunId" TEXT,
  ADD COLUMN "scoreWriteStatus" "ScoreWriteStatus" NOT NULL DEFAULT 'NOT_ALLOWED',
  ADD COLUMN "gradeWriteStatus" "GradeWriteStatus" NOT NULL DEFAULT 'NOT_ALLOWED',
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT,
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "returnedById" TEXT,
  ADD COLUMN "returnReason" TEXT,
  ADD COLUMN "ceoConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "ceoConfirmedById" TEXT,
  ADD COLUMN "ceoAdjustmentReason" TEXT,
  ADD COLUMN "scoreCalculatedAt" TIMESTAMP(3),
  ADD COLUMN "scoreCalculatedById" TEXT,
  ADD COLUMN "gradeCalculatedAt" TIMESTAMP(3),
  ADD COLUMN "gradeCalculatedById" TEXT;

CREATE TABLE "evaluation_stage_submissions" (
  "id" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "stage" "EvalStage" NOT NULL,
  "action" "EvaluationStageAction" NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "EvalStatus",
  "toStatus" "EvalStatus",
  "fromOfficialState" "OfficialEvaluationState",
  "toOfficialState" "OfficialEvaluationState",
  "reason" TEXT,
  "payloadSnapshotJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluation_stage_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_audit_events" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT,
  "evaluationId" TEXT,
  "evaluationItemId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "operationMode" "EvaluationOperationMode" NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "metadataJson" JSONB,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluation_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluation_sandbox_sessions" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "evaluation_sandbox_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evaluations_operationMode_officialState_idx" ON "evaluations"("operationMode", "officialState");
CREATE INDEX "evaluations_populationRunId_idx" ON "evaluations"("populationRunId");
CREATE INDEX "evaluations_scoreWriteStatus_idx" ON "evaluations"("scoreWriteStatus");
CREATE INDEX "evaluations_gradeWriteStatus_idx" ON "evaluations"("gradeWriteStatus");

CREATE INDEX "evaluation_population_runs_cycleId_idx" ON "evaluation_population_runs"("cycleId");
CREATE INDEX "evaluation_population_runs_operationMode_status_idx" ON "evaluation_population_runs"("operationMode", "status");

CREATE INDEX "evaluation_stage_submissions_evaluationId_idx" ON "evaluation_stage_submissions"("evaluationId");
CREATE INDEX "evaluation_stage_submissions_stage_action_idx" ON "evaluation_stage_submissions"("stage", "action");
CREATE INDEX "evaluation_stage_submissions_actorId_idx" ON "evaluation_stage_submissions"("actorId");

CREATE INDEX "evaluation_audit_events_cycleId_idx" ON "evaluation_audit_events"("cycleId");
CREATE INDEX "evaluation_audit_events_employeeId_idx" ON "evaluation_audit_events"("employeeId");
CREATE INDEX "evaluation_audit_events_evaluationId_idx" ON "evaluation_audit_events"("evaluationId");
CREATE INDEX "evaluation_audit_events_evaluationItemId_idx" ON "evaluation_audit_events"("evaluationItemId");
CREATE INDEX "evaluation_audit_events_eventType_idx" ON "evaluation_audit_events"("eventType");
CREATE INDEX "evaluation_audit_events_actorId_idx" ON "evaluation_audit_events"("actorId");
CREATE INDEX "evaluation_audit_events_operationMode_idx" ON "evaluation_audit_events"("operationMode");

CREATE INDEX "evaluation_sandbox_sessions_cycleId_idx" ON "evaluation_sandbox_sessions"("cycleId");
CREATE INDEX "evaluation_sandbox_sessions_employeeId_idx" ON "evaluation_sandbox_sessions"("employeeId");
CREATE INDEX "evaluation_sandbox_sessions_ownerId_idx" ON "evaluation_sandbox_sessions"("ownerId");

ALTER TABLE "evaluation_population_runs"
  ADD CONSTRAINT "evaluation_population_runs_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "eval_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluations"
  ADD CONSTRAINT "evaluations_populationRunId_fkey"
  FOREIGN KEY ("populationRunId") REFERENCES "evaluation_population_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "evaluation_stage_submissions"
  ADD CONSTRAINT "evaluation_stage_submissions_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_audit_events"
  ADD CONSTRAINT "evaluation_audit_events_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "eval_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_audit_events"
  ADD CONSTRAINT "evaluation_audit_events_evaluationId_fkey"
  FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
