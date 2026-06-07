-- M1-B: additive DepartmentScoreIntake table for organization/department score intake.
-- Schema preparation only. Does not alter live scoring, live grade calculation,
-- Department.level backfill data, Evaluation.totalScore, or Evaluation.gradeId.

CREATE TABLE "department_score_intakes" (
  "id" TEXT NOT NULL,
  "evalCycleId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "scaleMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "scaleMax" DOUBLE PRECISION NOT NULL DEFAULT 130,
  "source" TEXT,
  "memo" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "department_score_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "department_score_intakes_evalCycleId_departmentId_key"
  ON "department_score_intakes"("evalCycleId", "departmentId");

CREATE INDEX "department_score_intakes_evalCycleId_idx"
  ON "department_score_intakes"("evalCycleId");

CREATE INDEX "department_score_intakes_departmentId_idx"
  ON "department_score_intakes"("departmentId");

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_evalCycleId_fkey"
  FOREIGN KEY ("evalCycleId") REFERENCES "eval_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
