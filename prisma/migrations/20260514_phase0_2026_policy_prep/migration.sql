-- Phase 0.5: additive preparation for the 2026 evaluation policy.
-- This migration does not switch live scoring, live grade calculation, or AI score behavior.

CREATE TYPE "EvaluationPolicyGrade" AS ENUM (
  'SUPER',
  'OUTSTANDING',
  'EXCELLENT',
  'GOOD',
  'NEED_IMPROVEMENT',
  'UNSATISFACTORY'
);

CREATE TYPE "EvaluationGradeThresholdGroup" AS ENUM (
  'TEAM_MEMBER_NON_SALES',
  'TEAM_SECTION_LEADER_NON_SALES',
  'TEAM_MEMBER_SALES',
  'TEAM_SECTION_LEADER_SALES',
  'DIVISION_HEAD'
);

CREATE TYPE "EvaluationPolicyItemCategory" AS ENUM (
  'ORG_GOAL',
  'PROJECT_T',
  'PROJECT_K',
  'DAILY_WORK'
);

CREATE TYPE "EvaluationScoreContributionType" AS ENUM (
  'ORGANIZATION',
  'PERSONAL'
);

CREATE TABLE "evaluation_grade_policies" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "evalYear" INTEGER NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "thresholdGroup" "EvaluationGradeThresholdGroup" NOT NULL,
  "gradeLabel" "EvaluationPolicyGrade" NOT NULL,
  "displayName" TEXT NOT NULL,
  "minScore" DOUBLE PRECISION,
  "maxScore" DOUBLE PRECISION,
  "lowerBoundInclusive" BOOLEAN NOT NULL DEFAULT true,
  "upperBoundInclusive" BOOLEAN NOT NULL DEFAULT false,
  "selectionRule" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evaluation_grade_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key"
  ON "evaluation_grade_policies"("orgId", "evalYear", "policyVersion", "thresholdGroup", "gradeLabel");

CREATE INDEX "evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx"
  ON "evaluation_grade_policies"("orgId", "evalYear", "thresholdGroup", "isActive");

ALTER TABLE "evaluation_grade_policies"
  ADD CONSTRAINT "evaluation_grade_policies_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "personal_kpis"
  ADD COLUMN "policyCategory" "EvaluationPolicyItemCategory",
  ADD COLUMN "policyCategoryConfidence" DOUBLE PRECISION,
  ADD COLUMN "policyCategorySource" TEXT,
  ADD COLUMN "policyCategoryReviewedAt" TIMESTAMP(3),
  ADD COLUMN "policyCategoryReviewNote" TEXT,
  ADD COLUMN "targetValueT" DOUBLE PRECISION,
  ADD COLUMN "targetValueE" DOUBLE PRECISION,
  ADD COLUMN "targetValueS" DOUBLE PRECISION;

CREATE INDEX "personal_kpis_evalYear_policyCategory_idx"
  ON "personal_kpis"("evalYear", "policyCategory");

ALTER TABLE "evaluations"
  ADD COLUMN "policyFormulaVersion" TEXT,
  ADD COLUMN "organizationPerformanceScore" DOUBLE PRECISION,
  ADD COLUMN "personalPerformanceScore" DOUBLE PRECISION,
  ADD COLUMN "aiScoreIncludedInTotal" BOOLEAN,
  ADD COLUMN "scorePolicySnapshot" JSONB;

ALTER TABLE "evaluation_items"
  ADD COLUMN "policyCategory" "EvaluationPolicyItemCategory",
  ADD COLUMN "scoreContributionType" "EvaluationScoreContributionType",
  ADD COLUMN "policyFormulaVersion" TEXT,
  ADD COLUMN "basePolicyScore" DOUBLE PRECISION,
  ADD COLUMN "adjustmentScore" DOUBLE PRECISION,
  ADD COLUMN "adjustmentGroupKey" TEXT,
  ADD COLUMN "adjustmentReason" TEXT,
  ADD COLUMN "targetAchievementLevel" TEXT,
  ADD COLUMN "policyScoreSnapshot" JSONB;

CREATE INDEX "evaluation_items_policyCategory_idx"
  ON "evaluation_items"("policyCategory");

CREATE INDEX "evaluation_items_adjustmentGroupKey_idx"
  ON "evaluation_items"("adjustmentGroupKey");

ALTER TABLE "ai_competency_gate_cases"
  ADD COLUMN "policyVersion" TEXT,
  ADD COLUMN "policyRecognitionRoute" TEXT;
