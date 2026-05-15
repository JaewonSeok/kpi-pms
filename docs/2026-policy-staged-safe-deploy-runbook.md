# 2026 Policy Staged Safe Deploy Runbook

This runbook is for the staged 2026 evaluation policy preview features only.

Do not run `prisma migrate deploy` against production for this compatibility patch.
Production `_prisma_migrations` history is not reliable, so production compatibility must be checked and patched manually with additive SQL only.

## Safety Rules

- Do not activate official 2026 scoring.
- Do not replace saved official evaluation totals.
- Do not replace saved official grades.
- Do not run backfill `--apply`.
- Do not mutate production data.
- Do not deploy staged feature code to production before this compatibility patch is confirmed.
- Run precheck first, review the output, then apply the additive patch only after a production DB backup/snapshot exists.

## Schema Inventory

New enum types:

- `EvaluationPolicyGrade`
- `EvaluationGradeThresholdGroup`
- `EvaluationPolicyItemCategory`
- `EvaluationScoreContributionType`

New table:

- `evaluation_grade_policies`

New columns:

- `personal_kpis.policyCategory`
- `personal_kpis.policyCategoryConfidence`
- `personal_kpis.policyCategorySource`
- `personal_kpis.policyCategoryReviewedAt`
- `personal_kpis.policyCategoryReviewNote`
- `personal_kpis.targetValueT`
- `personal_kpis.targetValueE`
- `personal_kpis.targetValueS`
- `evaluations.policyFormulaVersion`
- `evaluations.organizationPerformanceScore`
- `evaluations.personalPerformanceScore`
- `evaluations.aiScoreIncludedInTotal`
- `evaluations.scorePolicySnapshot`
- `evaluation_items.policyCategory`
- `evaluation_items.scoreContributionType`
- `evaluation_items.policyFormulaVersion`
- `evaluation_items.basePolicyScore`
- `evaluation_items.adjustmentScore`
- `evaluation_items.adjustmentGroupKey`
- `evaluation_items.adjustmentReason`
- `evaluation_items.targetAchievementLevel`
- `evaluation_items.policyScoreSnapshot`
- `ai_competency_gate_cases.policyVersion`
- `ai_competency_gate_cases.policyRecognitionRoute`
- `org_kpis.mboExceptionApproved`
- `org_kpis.mboExceptionReason`
- `org_kpis.mboExceptionApprovedById`
- `org_kpis.mboExceptionApprovedAt`

New indexes and constraints:

- `evaluation_grade_policies_pkey`
- `evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key`
- `evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx`
- `evaluation_grade_policies_orgId_fkey`
- `personal_kpis_evalYear_policyCategory_idx`
- `evaluation_items_policyCategory_idx`
- `evaluation_items_adjustmentGroupKey_idx`
- `org_kpis_evalYear_mboExceptionApproved_idx`

Runtime P2022 risk if missing:

- `/kpi/org` and `/api/kpi/org/[id]/hr-exception` read `org_kpis.mboException*`.
- `/kpi/personal` reads `personal_kpis.policyCategory` and linked `org_kpis.mboException*`.
- `/evaluation/workbench` preview/readiness/mapping panels read `evaluation_items.*policy*`, `personal_kpis.policyCategory`, and AI recognition metadata.
- `/api/evaluation/[id]/preview-2026` reads evaluation item, personal KPI, and AI policy metadata.
- `/api/evaluation/preview-2026/*` readiness/mapping endpoints read the new metadata and schema status.
- Any Prisma query that defaults to all scalar fields on `OrgKpi`, `PersonalKpi`, `Evaluation`, `EvaluationItem`, or `AiCompetencyGateCase` can fail with P2022 if the generated Prisma client expects a column that production DB lacks.

## Precheck SQL

Run this first. It performs no writes.

```sql
WITH required_types(type_name) AS (
  VALUES
    ('EvaluationPolicyGrade'),
    ('EvaluationGradeThresholdGroup'),
    ('EvaluationPolicyItemCategory'),
    ('EvaluationScoreContributionType')
),
required_tables(table_name) AS (
  VALUES
    ('evaluation_grade_policies')
),
required_columns(table_name, column_name) AS (
  VALUES
    ('personal_kpis', 'policyCategory'),
    ('personal_kpis', 'policyCategoryConfidence'),
    ('personal_kpis', 'policyCategorySource'),
    ('personal_kpis', 'policyCategoryReviewedAt'),
    ('personal_kpis', 'policyCategoryReviewNote'),
    ('personal_kpis', 'targetValueT'),
    ('personal_kpis', 'targetValueE'),
    ('personal_kpis', 'targetValueS'),
    ('evaluations', 'policyFormulaVersion'),
    ('evaluations', 'organizationPerformanceScore'),
    ('evaluations', 'personalPerformanceScore'),
    ('evaluations', 'aiScoreIncludedInTotal'),
    ('evaluations', 'scorePolicySnapshot'),
    ('evaluation_items', 'policyCategory'),
    ('evaluation_items', 'scoreContributionType'),
    ('evaluation_items', 'policyFormulaVersion'),
    ('evaluation_items', 'basePolicyScore'),
    ('evaluation_items', 'adjustmentScore'),
    ('evaluation_items', 'adjustmentGroupKey'),
    ('evaluation_items', 'adjustmentReason'),
    ('evaluation_items', 'targetAchievementLevel'),
    ('evaluation_items', 'policyScoreSnapshot'),
    ('ai_competency_gate_cases', 'policyVersion'),
    ('ai_competency_gate_cases', 'policyRecognitionRoute'),
    ('org_kpis', 'mboExceptionApproved'),
    ('org_kpis', 'mboExceptionReason'),
    ('org_kpis', 'mboExceptionApprovedById'),
    ('org_kpis', 'mboExceptionApprovedAt')
),
required_indexes(index_name) AS (
  VALUES
    ('evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key'),
    ('evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx'),
    ('personal_kpis_evalYear_policyCategory_idx'),
    ('evaluation_items_policyCategory_idx'),
    ('evaluation_items_adjustmentGroupKey_idx'),
    ('org_kpis_evalYear_mboExceptionApproved_idx')
)
SELECT 'TYPE' AS object_kind, type_name AS object_name,
       EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) AS exists
FROM required_types
UNION ALL
SELECT 'TABLE', table_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = required_tables.table_name
       )
FROM required_tables
UNION ALL
SELECT 'COLUMN', table_name || '.' || column_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = required_columns.table_name
           AND column_name = required_columns.column_name
       )
FROM required_columns
UNION ALL
SELECT 'INDEX', index_name,
       EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = required_indexes.index_name
       )
FROM required_indexes
ORDER BY object_kind, object_name;
```

## Additive Compatibility Patch SQL

Run only after a production DB backup/snapshot exists.
This patch is additive and idempotent where PostgreSQL allows it.

```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvaluationPolicyGrade') THEN
    CREATE TYPE "EvaluationPolicyGrade" AS ENUM (
      'SUPER',
      'OUTSTANDING',
      'EXCELLENT',
      'GOOD',
      'NEED_IMPROVEMENT',
      'UNSATISFACTORY'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvaluationGradeThresholdGroup') THEN
    CREATE TYPE "EvaluationGradeThresholdGroup" AS ENUM (
      'TEAM_MEMBER_NON_SALES',
      'TEAM_SECTION_LEADER_NON_SALES',
      'TEAM_MEMBER_SALES',
      'TEAM_SECTION_LEADER_SALES',
      'DIVISION_HEAD'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvaluationPolicyItemCategory') THEN
    CREATE TYPE "EvaluationPolicyItemCategory" AS ENUM (
      'ORG_GOAL',
      'PROJECT_T',
      'PROJECT_K',
      'DAILY_WORK'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EvaluationScoreContributionType') THEN
    CREATE TYPE "EvaluationScoreContributionType" AS ENUM (
      'ORGANIZATION',
      'PERSONAL'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "evaluation_grade_policies" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evaluation_grade_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key"
  ON "evaluation_grade_policies"("orgId", "evalYear", "policyVersion", "thresholdGroup", "gradeLabel");

CREATE INDEX IF NOT EXISTS "evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx"
  ON "evaluation_grade_policies"("orgId", "evalYear", "thresholdGroup", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'evaluation_grade_policies_orgId_fkey'
  ) THEN
    ALTER TABLE "evaluation_grade_policies"
      ADD CONSTRAINT "evaluation_grade_policies_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "personal_kpis"
  ADD COLUMN IF NOT EXISTS "policyCategory" "EvaluationPolicyItemCategory",
  ADD COLUMN IF NOT EXISTS "policyCategoryConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "policyCategorySource" TEXT,
  ADD COLUMN IF NOT EXISTS "policyCategoryReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "policyCategoryReviewNote" TEXT,
  ADD COLUMN IF NOT EXISTS "targetValueT" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "targetValueE" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "targetValueS" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "personal_kpis_evalYear_policyCategory_idx"
  ON "personal_kpis"("evalYear", "policyCategory");

ALTER TABLE "evaluations"
  ADD COLUMN IF NOT EXISTS "policyFormulaVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "organizationPerformanceScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "personalPerformanceScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "aiScoreIncludedInTotal" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "scorePolicySnapshot" JSONB;

ALTER TABLE "evaluation_items"
  ADD COLUMN IF NOT EXISTS "policyCategory" "EvaluationPolicyItemCategory",
  ADD COLUMN IF NOT EXISTS "scoreContributionType" "EvaluationScoreContributionType",
  ADD COLUMN IF NOT EXISTS "policyFormulaVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "basePolicyScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "adjustmentScore" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "adjustmentGroupKey" TEXT,
  ADD COLUMN IF NOT EXISTS "adjustmentReason" TEXT,
  ADD COLUMN IF NOT EXISTS "targetAchievementLevel" TEXT,
  ADD COLUMN IF NOT EXISTS "policyScoreSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "evaluation_items_policyCategory_idx"
  ON "evaluation_items"("policyCategory");

CREATE INDEX IF NOT EXISTS "evaluation_items_adjustmentGroupKey_idx"
  ON "evaluation_items"("adjustmentGroupKey");

ALTER TABLE "ai_competency_gate_cases"
  ADD COLUMN IF NOT EXISTS "policyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "policyRecognitionRoute" TEXT;

ALTER TABLE "org_kpis"
  ADD COLUMN IF NOT EXISTS "mboExceptionApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mboExceptionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "mboExceptionApprovedById" TEXT,
  ADD COLUMN IF NOT EXISTS "mboExceptionApprovedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "org_kpis_evalYear_mboExceptionApproved_idx"
  ON "org_kpis"("evalYear", "mboExceptionApproved");

COMMIT;
```

## Postcheck SQL

Run after the patch. All `exists` values must be true.

```sql
WITH required_types(type_name) AS (
  VALUES
    ('EvaluationPolicyGrade'),
    ('EvaluationGradeThresholdGroup'),
    ('EvaluationPolicyItemCategory'),
    ('EvaluationScoreContributionType')
),
required_tables(table_name) AS (
  VALUES
    ('evaluation_grade_policies')
),
required_columns(table_name, column_name) AS (
  VALUES
    ('personal_kpis', 'policyCategory'),
    ('personal_kpis', 'policyCategoryConfidence'),
    ('personal_kpis', 'policyCategorySource'),
    ('personal_kpis', 'policyCategoryReviewedAt'),
    ('personal_kpis', 'policyCategoryReviewNote'),
    ('personal_kpis', 'targetValueT'),
    ('personal_kpis', 'targetValueE'),
    ('personal_kpis', 'targetValueS'),
    ('evaluations', 'policyFormulaVersion'),
    ('evaluations', 'organizationPerformanceScore'),
    ('evaluations', 'personalPerformanceScore'),
    ('evaluations', 'aiScoreIncludedInTotal'),
    ('evaluations', 'scorePolicySnapshot'),
    ('evaluation_items', 'policyCategory'),
    ('evaluation_items', 'scoreContributionType'),
    ('evaluation_items', 'policyFormulaVersion'),
    ('evaluation_items', 'basePolicyScore'),
    ('evaluation_items', 'adjustmentScore'),
    ('evaluation_items', 'adjustmentGroupKey'),
    ('evaluation_items', 'adjustmentReason'),
    ('evaluation_items', 'targetAchievementLevel'),
    ('evaluation_items', 'policyScoreSnapshot'),
    ('ai_competency_gate_cases', 'policyVersion'),
    ('ai_competency_gate_cases', 'policyRecognitionRoute'),
    ('org_kpis', 'mboExceptionApproved'),
    ('org_kpis', 'mboExceptionReason'),
    ('org_kpis', 'mboExceptionApprovedById'),
    ('org_kpis', 'mboExceptionApprovedAt')
),
required_indexes(index_name) AS (
  VALUES
    ('evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key'),
    ('evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx'),
    ('personal_kpis_evalYear_policyCategory_idx'),
    ('evaluation_items_policyCategory_idx'),
    ('evaluation_items_adjustmentGroupKey_idx'),
    ('org_kpis_evalYear_mboExceptionApproved_idx')
)
SELECT 'TYPE' AS object_kind, type_name AS object_name,
       EXISTS (SELECT 1 FROM pg_type WHERE typname = type_name) AS exists
FROM required_types
UNION ALL
SELECT 'TABLE', table_name,
       EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = required_tables.table_name
       )
FROM required_tables
UNION ALL
SELECT 'COLUMN', table_name || '.' || column_name,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = required_columns.table_name
           AND column_name = required_columns.column_name
       )
FROM required_columns
UNION ALL
SELECT 'INDEX', index_name,
       EXISTS (
         SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = required_indexes.index_name
       )
FROM required_indexes
ORDER BY object_kind, object_name;
```

## Rollback Caveats

The compatibility patch is additive and contains no data writes, but rollback is not recommended after staged code has run because metadata may be written by HR/admin preview mapping or exception approval actions.

Safe rollback path for production is:

1. Roll application code back to the stable Revert PR commit.
2. Leave additive columns, indexes, enum types, and `evaluation_grade_policies` table in place.
3. Do not drop objects unless a separate backup/restore plan has been approved.

If a disposable development DB was used, dropping/recreating that DB is acceptable. Do not use destructive rollback SQL on production.

## Manual Deployment Order

1. Merge the Revert PR and confirm production is stable.
2. Create/push the staged feature branch.
3. Run full local CI on the staged branch.
4. Run the precheck SQL on the target DB.
5. Confirm a production DB backup/snapshot exists.
6. Apply the additive compatibility patch SQL manually.
7. Run postcheck SQL and confirm all objects exist.
8. Deploy or merge staged code only after compatibility is confirmed.
9. Keep official 2026 feature flags disabled.
10. Run Vercel Preview smoke tests and check logs for P2022 before production merge.
