-- KPI 예외 승인 요청 워크플로: 팀장 신청 → HR 검토 → 승인/반려.
-- Additive only — new enum + new table + indexes + FKs.
-- Existing org_kpis rows and columns are untouched.

CREATE TYPE "OrgKpiExceptionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "org_kpi_exception_requests" (
  "id"          TEXT NOT NULL,
  "orgKpiId"    TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "reason"      TEXT NOT NULL,
  "status"      "OrgKpiExceptionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote"  TEXT,
  "reviewerId"  TEXT,
  "resolvedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_kpi_exception_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_kpi_exception_requests_orgKpiId_status_idx"
  ON "org_kpi_exception_requests"("orgKpiId", "status");

CREATE INDEX "org_kpi_exception_requests_status_createdAt_idx"
  ON "org_kpi_exception_requests"("status", "createdAt");

ALTER TABLE "org_kpi_exception_requests"
  ADD CONSTRAINT "org_kpi_exception_requests_orgKpiId_fkey"
  FOREIGN KEY ("orgKpiId") REFERENCES "org_kpis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_kpi_exception_requests"
  ADD CONSTRAINT "org_kpi_exception_requests_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "org_kpi_exception_requests"
  ADD CONSTRAINT "org_kpi_exception_requests_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
