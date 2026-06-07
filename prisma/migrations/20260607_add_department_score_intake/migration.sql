-- M1-B1: additive DepartmentScoreIntake table for organization 30% score subsystem.
-- Stores external (전략기획팀) committee scores per cycle x department. Additive only —
-- new table + FKs + indexes + score range CHECK. Existing rows are unaffected.
-- Dormant — no code reads or writes it yet; input route + UI ship in later PRs.

CREATE TABLE "department_score_intakes" (
  "id" TEXT NOT NULL,
  "evalCycleId" TEXT NOT NULL,
  "deptId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "source" TEXT NOT NULL DEFAULT '전략기획팀',
  "note" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "department_score_intakes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_score_range_check"
  CHECK ("score" >= 0 AND "score" <= 130);

CREATE UNIQUE INDEX "department_score_intakes_evalCycleId_deptId_key"
  ON "department_score_intakes"("evalCycleId", "deptId");

CREATE INDEX "department_score_intakes_evalCycleId_idx"
  ON "department_score_intakes"("evalCycleId");

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_evalCycleId_fkey"
  FOREIGN KEY ("evalCycleId") REFERENCES "eval_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_deptId_fkey"
  FOREIGN KEY ("deptId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_score_intakes"
  ADD CONSTRAINT "department_score_intakes_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
