-- Phase 2-D: metadata-only HR exception approval for team KPI -> Personal MBO org-goal exceptions.
-- Additive only. Does not alter scoring, grades, or existing KPI content.

ALTER TABLE "org_kpis"
  ADD COLUMN IF NOT EXISTS "mboExceptionApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mboExceptionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "mboExceptionApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "mboExceptionApprovedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "org_kpis_evalYear_mboExceptionApproved_idx"
  ON "org_kpis"("evalYear", "mboExceptionApproved");
