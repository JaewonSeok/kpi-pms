-- M1 / PR-A1: additive Department.level column for organization 30% score subsystem.
-- Additive only — new enum + nullable column. Existing rows are unaffected (NULL by default).
-- Does not alter live scoring, live grade calculation, or any read path. The column is
-- dormant (no code reads it yet); HR backfill + reader wiring ships in later PRs.

CREATE TYPE "DepartmentLevel" AS ENUM ('DIVISION', 'SECTION', 'TEAM');

ALTER TABLE "departments"
  ADD COLUMN "level" "DepartmentLevel";
