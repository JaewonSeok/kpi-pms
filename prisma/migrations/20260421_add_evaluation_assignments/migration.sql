CREATE TYPE "EvaluationAssignmentSource" AS ENUM ('AUTO', 'MANUAL');

ALTER TYPE "AIRequestType" ADD VALUE 'EVAL_PERFORMANCE_BRIEFING';

CREATE TABLE "evaluation_assignments" (
  "id" TEXT NOT NULL,
  "evalCycleId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "evalStage" "EvalStage" NOT NULL,
  "evaluatorId" TEXT NOT NULL,
  "assignmentSource" "EvaluationAssignmentSource" NOT NULL DEFAULT 'AUTO',
  "note" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evaluation_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluation_assignments_evalCycleId_targetId_evalStage_key"
  ON "evaluation_assignments"("evalCycleId", "targetId", "evalStage");

CREATE INDEX "evaluation_assignments_evaluatorId_evalCycleId_evalStage_idx"
  ON "evaluation_assignments"("evaluatorId", "evalCycleId", "evalStage");

CREATE INDEX "evaluation_assignments_targetId_evalCycleId_idx"
  ON "evaluation_assignments"("targetId", "evalCycleId");

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_evalCycleId_fkey"
  FOREIGN KEY ("evalCycleId") REFERENCES "eval_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_evaluatorId_fkey"
  FOREIGN KEY ("evaluatorId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "evaluation_assignments"
  ADD CONSTRAINT "evaluation_assignments_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
