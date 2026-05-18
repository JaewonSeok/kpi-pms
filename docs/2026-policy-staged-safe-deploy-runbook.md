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

## Strict Model-vs-Database Compatibility Precheck

The basic precheck below covers the staged 2026 additions. Before PR #5 can merge, also run this stricter read-only check.
It verifies every scalar column expected by the staged Prisma models that are touched by the preview/KPI/MBO pages.

```sql
WITH required_tables(table_name) AS (
  VALUES
    ('org_kpis'),
    ('personal_kpis'),
    ('evaluations'),
    ('evaluation_items'),
    ('ai_competency_gate_assignments'),
    ('ai_competency_gate_cases'),
    ('evaluation_grade_policies')
),
required_columns(table_name, column_name) AS (
  VALUES
    ('org_kpis', 'id'),
    ('org_kpis', 'deptId'),
    ('org_kpis', 'evalYear'),
    ('org_kpis', 'kpiType'),
    ('org_kpis', 'kpiCategory'),
    ('org_kpis', 'kpiName'),
    ('org_kpis', 'definition'),
    ('org_kpis', 'formula'),
    ('org_kpis', 'targetValue'),
    ('org_kpis', 'targetValueT'),
    ('org_kpis', 'targetValueE'),
    ('org_kpis', 'targetValueS'),
    ('org_kpis', 'unit'),
    ('org_kpis', 'weight'),
    ('org_kpis', 'difficulty'),
    ('org_kpis', 'status'),
    ('org_kpis', 'tags'),
    ('org_kpis', 'mboExceptionApproved'),
    ('org_kpis', 'mboExceptionReason'),
    ('org_kpis', 'mboExceptionApprovedById'),
    ('org_kpis', 'mboExceptionApprovedAt'),
    ('org_kpis', 'parentOrgKpiId'),
    ('org_kpis', 'copiedFromOrgKpiId'),
    ('org_kpis', 'copyMetadata'),
    ('org_kpis', 'createdAt'),
    ('org_kpis', 'updatedAt'),
    ('personal_kpis', 'id'),
    ('personal_kpis', 'employeeId'),
    ('personal_kpis', 'evalYear'),
    ('personal_kpis', 'kpiType'),
    ('personal_kpis', 'policyCategory'),
    ('personal_kpis', 'policyCategoryConfidence'),
    ('personal_kpis', 'policyCategorySource'),
    ('personal_kpis', 'policyCategoryReviewedAt'),
    ('personal_kpis', 'policyCategoryReviewNote'),
    ('personal_kpis', 'kpiName'),
    ('personal_kpis', 'definition'),
    ('personal_kpis', 'formula'),
    ('personal_kpis', 'targetValue'),
    ('personal_kpis', 'targetValueT'),
    ('personal_kpis', 'targetValueE'),
    ('personal_kpis', 'targetValueS'),
    ('personal_kpis', 'unit'),
    ('personal_kpis', 'weight'),
    ('personal_kpis', 'difficulty'),
    ('personal_kpis', 'linkedOrgKpiId'),
    ('personal_kpis', 'status'),
    ('personal_kpis', 'tags'),
    ('personal_kpis', 'copiedFromPersonalKpiId'),
    ('personal_kpis', 'copyMetadata'),
    ('personal_kpis', 'createdAt'),
    ('personal_kpis', 'updatedAt'),
    ('evaluations', 'id'),
    ('evaluations', 'evalCycleId'),
    ('evaluations', 'targetId'),
    ('evaluations', 'evaluatorId'),
    ('evaluations', 'evalStage'),
    ('evaluations', 'totalScore'),
    ('evaluations', 'policyFormulaVersion'),
    ('evaluations', 'organizationPerformanceScore'),
    ('evaluations', 'personalPerformanceScore'),
    ('evaluations', 'aiScoreIncludedInTotal'),
    ('evaluations', 'scorePolicySnapshot'),
    ('evaluations', 'gradeId'),
    ('evaluations', 'comment'),
    ('evaluations', 'strengthComment'),
    ('evaluations', 'improvementComment'),
    ('evaluations', 'nextStepGuidance'),
    ('evaluations', 'status'),
    ('evaluations', 'isDraft'),
    ('evaluations', 'submittedAt'),
    ('evaluations', 'isRejected'),
    ('evaluations', 'rejectionReason'),
    ('evaluations', 'rejectedAt'),
    ('evaluations', 'createdAt'),
    ('evaluations', 'updatedAt'),
    ('evaluation_items', 'id'),
    ('evaluation_items', 'evaluationId'),
    ('evaluation_items', 'personalKpiId'),
    ('evaluation_items', 'policyCategory'),
    ('evaluation_items', 'scoreContributionType'),
    ('evaluation_items', 'policyFormulaVersion'),
    ('evaluation_items', 'basePolicyScore'),
    ('evaluation_items', 'adjustmentScore'),
    ('evaluation_items', 'adjustmentGroupKey'),
    ('evaluation_items', 'adjustmentReason'),
    ('evaluation_items', 'targetAchievementLevel'),
    ('evaluation_items', 'policyScoreSnapshot'),
    ('evaluation_items', 'quantScore'),
    ('evaluation_items', 'planScore'),
    ('evaluation_items', 'doScore'),
    ('evaluation_items', 'checkScore'),
    ('evaluation_items', 'actScore'),
    ('evaluation_items', 'qualScore'),
    ('evaluation_items', 'itemComment'),
    ('evaluation_items', 'weightedScore'),
    ('evaluation_items', 'createdAt'),
    ('evaluation_items', 'updatedAt'),
    ('ai_competency_gate_assignments', 'id'),
    ('ai_competency_gate_assignments', 'cycleId'),
    ('ai_competency_gate_assignments', 'employeeId'),
    ('ai_competency_gate_assignments', 'reviewerId'),
    ('ai_competency_gate_assignments', 'status'),
    ('ai_competency_gate_assignments', 'employeeNameSnapshot'),
    ('ai_competency_gate_assignments', 'departmentNameSnapshot'),
    ('ai_competency_gate_assignments', 'positionSnapshot'),
    ('ai_competency_gate_assignments', 'reviewerNameSnapshot'),
    ('ai_competency_gate_assignments', 'assignedAt'),
    ('ai_competency_gate_assignments', 'submittedAt'),
    ('ai_competency_gate_assignments', 'reviewStartedAt'),
    ('ai_competency_gate_assignments', 'decisionAt'),
    ('ai_competency_gate_assignments', 'closedAt'),
    ('ai_competency_gate_assignments', 'currentRevisionRound'),
    ('ai_competency_gate_assignments', 'adminNote'),
    ('ai_competency_gate_assignments', 'createdAt'),
    ('ai_competency_gate_assignments', 'updatedAt'),
    ('ai_competency_gate_cases', 'id'),
    ('ai_competency_gate_cases', 'assignmentId'),
    ('ai_competency_gate_cases', 'track'),
    ('ai_competency_gate_cases', 'policyVersion'),
    ('ai_competency_gate_cases', 'policyRecognitionRoute'),
    ('ai_competency_gate_cases', 'title'),
    ('ai_competency_gate_cases', 'problemStatement'),
    ('ai_competency_gate_cases', 'importanceReason'),
    ('ai_competency_gate_cases', 'goalStatement'),
    ('ai_competency_gate_cases', 'scopeDescription'),
    ('ai_competency_gate_cases', 'ownerRoleDescription'),
    ('ai_competency_gate_cases', 'beforeWorkflow'),
    ('ai_competency_gate_cases', 'afterWorkflow'),
    ('ai_competency_gate_cases', 'impactSummary'),
    ('ai_competency_gate_cases', 'teamOrganizationAdoption'),
    ('ai_competency_gate_cases', 'reusableOutputSummary'),
    ('ai_competency_gate_cases', 'humanReviewControl'),
    ('ai_competency_gate_cases', 'factCheckMethod'),
    ('ai_competency_gate_cases', 'securityEthicsPrivacyHandling'),
    ('ai_competency_gate_cases', 'sharingExpansionActivity'),
    ('ai_competency_gate_cases', 'toolList'),
    ('ai_competency_gate_cases', 'approvedToolBasis'),
    ('ai_competency_gate_cases', 'sensitiveDataHandling'),
    ('ai_competency_gate_cases', 'maskingAnonymizationHandling'),
    ('ai_competency_gate_cases', 'prohibitedAutomationAcknowledged'),
    ('ai_competency_gate_cases', 'finalDeclarationAccepted'),
    ('ai_competency_gate_cases', 'lastSavedAt'),
    ('ai_competency_gate_cases', 'createdAt'),
    ('ai_competency_gate_cases', 'updatedAt'),
    ('evaluation_grade_policies', 'id'),
    ('evaluation_grade_policies', 'orgId'),
    ('evaluation_grade_policies', 'evalYear'),
    ('evaluation_grade_policies', 'policyVersion'),
    ('evaluation_grade_policies', 'thresholdGroup'),
    ('evaluation_grade_policies', 'gradeLabel'),
    ('evaluation_grade_policies', 'displayName'),
    ('evaluation_grade_policies', 'minScore'),
    ('evaluation_grade_policies', 'maxScore'),
    ('evaluation_grade_policies', 'lowerBoundInclusive'),
    ('evaluation_grade_policies', 'upperBoundInclusive'),
    ('evaluation_grade_policies', 'selectionRule'),
    ('evaluation_grade_policies', 'notes'),
    ('evaluation_grade_policies', 'isActive'),
    ('evaluation_grade_policies', 'createdAt'),
    ('evaluation_grade_policies', 'updatedAt')
),
required_indexes(index_name) AS (
  VALUES
    ('org_kpis_evalYear_parentOrgKpiId_idx'),
    ('org_kpis_evalYear_mboExceptionApproved_idx'),
    ('personal_kpis_employeeId_evalYear_kpiName_key'),
    ('personal_kpis_evalYear_policyCategory_idx'),
    ('evaluations_evalCycleId_targetId_evalStage_key'),
    ('evaluation_items_policyCategory_idx'),
    ('evaluation_items_adjustmentGroupKey_idx'),
    ('ai_competency_gate_assignments_cycleId_employeeId_key'),
    ('ai_competency_gate_assignments_cycleId_status_idx'),
    ('ai_competency_gate_assignments_reviewerId_status_idx'),
    ('ai_competency_gate_cases_assignmentId_key'),
    ('evaluation_grade_policies_orgId_evalYear_policyVersion_thresholdGroup_gradeLabel_key'),
    ('evaluation_grade_policies_orgId_evalYear_thresholdGroup_isActive_idx')
)
SELECT 'TABLE' AS object_kind,
       table_name AS table_name,
       NULL::text AS column_name,
       table_name AS object_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = required_tables.table_name
       ) AS exists
FROM required_tables
UNION ALL
SELECT 'COLUMN',
       table_name,
       column_name,
       table_name || '.' || column_name,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = required_columns.table_name
           AND column_name = required_columns.column_name
       )
FROM required_columns
UNION ALL
SELECT 'INDEX',
       NULL::text,
       NULL::text,
       index_name,
       EXISTS (
         SELECT 1
         FROM pg_indexes
         WHERE schemaname = 'public'
           AND indexname = required_indexes.index_name
       )
FROM required_indexes
ORDER BY object_kind, object_name;
```

## Prisma Mapped Column Diagnostic

Use this read-only diagnostic when Prisma reports P2022 from `prisma.orgKpi.findMany()` even though a broad column-existence precheck looked healthy.
It lists the Prisma field name, the exact DB column name Prisma expects from generated client metadata, and whether that column exists in the target database.

```sql
WITH expected_columns AS (
  SELECT 'OrgKpi' AS prisma_model_name, 'org_kpis' AS table_name, 'id' AS prisma_field_name, 'id' AS expected_db_column_name
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'deptId', 'deptId'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'evalYear', 'evalYear'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'kpiType', 'kpiType'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'kpiCategory', 'kpiCategory'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'kpiName', 'kpiName'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'definition', 'definition'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'formula', 'formula'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'targetValue', 'targetValue'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'targetValueT', 'targetValueT'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'targetValueE', 'targetValueE'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'targetValueS', 'targetValueS'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'unit', 'unit'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'weight', 'weight'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'difficulty', 'difficulty'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'status', 'status'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'tags', 'tags'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'mboExceptionApproved', 'mboExceptionApproved'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'mboExceptionReason', 'mboExceptionReason'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'mboExceptionApprovedById', 'mboExceptionApprovedById'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'mboExceptionApprovedAt', 'mboExceptionApprovedAt'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'parentOrgKpiId', 'parentOrgKpiId'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'copiedFromOrgKpiId', 'copiedFromOrgKpiId'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'copyMetadata', 'copyMetadata'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'createdAt', 'createdAt'
  UNION ALL SELECT 'OrgKpi', 'org_kpis', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'Department', 'departments', 'id', 'id'
  UNION ALL SELECT 'Department', 'departments', 'deptCode', 'deptCode'
  UNION ALL SELECT 'Department', 'departments', 'deptName', 'deptName'
  UNION ALL SELECT 'Department', 'departments', 'parentDeptId', 'parentDeptId'
  UNION ALL SELECT 'Department', 'departments', 'leaderEmployeeId', 'leaderEmployeeId'
  UNION ALL SELECT 'Department', 'departments', 'excludeLeaderFromEvaluatorAutoAssign', 'excludeLeaderFromEvaluatorAutoAssign'
  UNION ALL SELECT 'Department', 'departments', 'orgId', 'orgId'
  UNION ALL SELECT 'Department', 'departments', 'createdAt', 'createdAt'
  UNION ALL SELECT 'Department', 'departments', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'Organization', 'organizations', 'id', 'id'
  UNION ALL SELECT 'Organization', 'organizations', 'name', 'name'
  UNION ALL SELECT 'Organization', 'organizations', 'fiscalYear', 'fiscalYear'
  UNION ALL SELECT 'Organization', 'organizations', 'createdAt', 'createdAt'
  UNION ALL SELECT 'Organization', 'organizations', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'Employee', 'employees', 'id', 'id'
  UNION ALL SELECT 'Employee', 'employees', 'empId', 'empId'
  UNION ALL SELECT 'Employee', 'employees', 'empName', 'empName'
  UNION ALL SELECT 'Employee', 'employees', 'deptId', 'deptId'
  UNION ALL SELECT 'Employee', 'employees', 'position', 'position'
  UNION ALL SELECT 'Employee', 'employees', 'role', 'role'
  UNION ALL SELECT 'Employee', 'employees', 'status', 'status'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'id', 'id'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'employeeId', 'employeeId'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'evalYear', 'evalYear'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'kpiType', 'kpiType'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'policyCategory', 'policyCategory'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'policyCategoryConfidence', 'policyCategoryConfidence'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'policyCategorySource', 'policyCategorySource'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'policyCategoryReviewedAt', 'policyCategoryReviewedAt'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'policyCategoryReviewNote', 'policyCategoryReviewNote'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'kpiName', 'kpiName'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'definition', 'definition'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'formula', 'formula'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'targetValue', 'targetValue'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'targetValueT', 'targetValueT'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'targetValueE', 'targetValueE'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'targetValueS', 'targetValueS'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'unit', 'unit'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'weight', 'weight'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'difficulty', 'difficulty'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'linkedOrgKpiId', 'linkedOrgKpiId'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'status', 'status'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'tags', 'tags'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'copiedFromPersonalKpiId', 'copiedFromPersonalKpiId'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'copyMetadata', 'copyMetadata'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'createdAt', 'createdAt'
  UNION ALL SELECT 'PersonalKpi', 'personal_kpis', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'id', 'id'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'personalKpiId', 'personalKpiId'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'employeeId', 'employeeId'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'yearMonth', 'yearMonth'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'actualValue', 'actualValue'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'achievementRate', 'achievementRate'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'activities', 'activities'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'obstacles', 'obstacles'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'efforts', 'efforts'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'evidenceComment', 'evidenceComment'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'attachments', 'attachments'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'isDraft', 'isDraft'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'submittedAt', 'submittedAt'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'createdAt', 'createdAt'
  UNION ALL SELECT 'MonthlyRecord', 'monthly_records', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'id', 'id'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'runId', 'runId'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'orgKpiId', 'orgKpiId'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'recommendationType', 'recommendationType'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'reviewType', 'reviewType'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'kpiTitleSnapshot', 'kpiTitleSnapshot'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'verdict', 'verdict'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'rationale', 'rationale'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'linkageComment', 'linkageComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'roleFitComment', 'roleFitComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'measurabilityComment', 'measurabilityComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'controllabilityComment', 'controllabilityComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'challengeComment', 'challengeComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'externalRiskComment', 'externalRiskComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'clarityComment', 'clarityComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'duplicationComment', 'duplicationComment'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'strongPoint', 'strongPoint'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'weakPoint', 'weakPoint'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'improvementSuggestions', 'improvementSuggestions'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'recommendationText', 'recommendationText'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'createdAt', 'createdAt'
  UNION ALL SELECT 'TeamKpiReviewItem', 'team_kpi_review_items', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'id', 'id'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'businessPlanId', 'businessPlanId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'sourceDepartmentId', 'sourceDepartmentId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'targetDepartmentId', 'targetDepartmentId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'evalYear', 'evalYear'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'evalCycleId', 'evalCycleId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'requesterId', 'requesterId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'aiRequestLogId', 'aiRequestLogId'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'reviewType', 'reviewType'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'overallVerdict', 'overallVerdict'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'overallSummary', 'overallSummary'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'linkedParentCoverage', 'linkedParentCoverage'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'independentKpiCoverage', 'independentKpiCoverage'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'createdAt', 'createdAt'
  UNION ALL SELECT 'TeamKpiReviewRun', 'team_kpi_review_runs', 'updatedAt', 'updatedAt'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'id', 'id'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'userId', 'userId'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'action', 'action'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'entityType', 'entityType'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'entityId', 'entityId'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'oldValue', 'oldValue'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'newValue', 'newValue'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'ipAddress', 'ipAddress'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'userAgent', 'userAgent'
  UNION ALL SELECT 'AuditLog', 'audit_logs', 'timestamp', 'timestamp'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'id', 'id'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'orgId', 'orgId'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'evalYear', 'evalYear'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'cycleName', 'cycleName'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'status', 'status'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'showQuestionWeight', 'showQuestionWeight'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'showScoreSummary', 'showScoreSummary'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'goalEditMode', 'goalEditMode'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'calibrationSessionConfig', 'calibrationSessionConfig'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'performanceDesignConfig', 'performanceDesignConfig'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'kpiSetupStart', 'kpiSetupStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'kpiSetupEnd', 'kpiSetupEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'selfEvalStart', 'selfEvalStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'selfEvalEnd', 'selfEvalEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'firstEvalStart', 'firstEvalStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'firstEvalEnd', 'firstEvalEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'secondEvalStart', 'secondEvalStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'secondEvalEnd', 'secondEvalEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'finalEvalStart', 'finalEvalStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'finalEvalEnd', 'finalEvalEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'ceoAdjustStart', 'ceoAdjustStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'ceoAdjustEnd', 'ceoAdjustEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'resultOpenStart', 'resultOpenStart'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'resultOpenEnd', 'resultOpenEnd'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'appealDeadline', 'appealDeadline'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'createdAt', 'createdAt'
  UNION ALL SELECT 'EvalCycle', 'eval_cycles', 'updatedAt', 'updatedAt'
)
SELECT
  prisma_model_name,
  table_name,
  prisma_field_name,
  expected_db_column_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = expected_columns.table_name
      AND column_name = expected_columns.expected_db_column_name
  ) AS exists_in_database
FROM expected_columns
ORDER BY table_name, expected_db_column_name;
```

## Org KPI Loader Relation Compatibility Precheck

Run this read-only check when `/kpi/org` or the Personal KPI org-goal selector fails with P2022 from `prisma.orgKpi.findMany()`.
The Org KPI page loader includes related department, organization, personal KPI, monthly record, employee, audit log, eval cycle, and team KPI review data; a missing column in any included relation can surface as a P2022 error on `orgKpi.findMany()`.

```sql
WITH required_tables(table_name) AS (
  SELECT 'org_kpis'
  UNION ALL SELECT 'departments'
  UNION ALL SELECT 'organizations'
  UNION ALL SELECT 'employees'
  UNION ALL SELECT 'personal_kpis'
  UNION ALL SELECT 'monthly_records'
  UNION ALL SELECT 'team_kpi_review_items'
  UNION ALL SELECT 'team_kpi_review_runs'
  UNION ALL SELECT 'audit_logs'
  UNION ALL SELECT 'eval_cycles'
),
required_columns(table_name, column_name) AS (
  SELECT 'org_kpis', 'id'
  UNION ALL SELECT 'org_kpis', 'deptId'
  UNION ALL SELECT 'org_kpis', 'evalYear'
  UNION ALL SELECT 'org_kpis', 'kpiType'
  UNION ALL SELECT 'org_kpis', 'kpiCategory'
  UNION ALL SELECT 'org_kpis', 'kpiName'
  UNION ALL SELECT 'org_kpis', 'definition'
  UNION ALL SELECT 'org_kpis', 'formula'
  UNION ALL SELECT 'org_kpis', 'targetValue'
  UNION ALL SELECT 'org_kpis', 'targetValueT'
  UNION ALL SELECT 'org_kpis', 'targetValueE'
  UNION ALL SELECT 'org_kpis', 'targetValueS'
  UNION ALL SELECT 'org_kpis', 'unit'
  UNION ALL SELECT 'org_kpis', 'weight'
  UNION ALL SELECT 'org_kpis', 'difficulty'
  UNION ALL SELECT 'org_kpis', 'status'
  UNION ALL SELECT 'org_kpis', 'tags'
  UNION ALL SELECT 'org_kpis', 'mboExceptionApproved'
  UNION ALL SELECT 'org_kpis', 'mboExceptionReason'
  UNION ALL SELECT 'org_kpis', 'mboExceptionApprovedById'
  UNION ALL SELECT 'org_kpis', 'mboExceptionApprovedAt'
  UNION ALL SELECT 'org_kpis', 'parentOrgKpiId'
  UNION ALL SELECT 'org_kpis', 'copiedFromOrgKpiId'
  UNION ALL SELECT 'org_kpis', 'copyMetadata'
  UNION ALL SELECT 'org_kpis', 'createdAt'
  UNION ALL SELECT 'org_kpis', 'updatedAt'
  UNION ALL SELECT 'departments', 'id'
  UNION ALL SELECT 'departments', 'deptCode'
  UNION ALL SELECT 'departments', 'deptName'
  UNION ALL SELECT 'departments', 'parentDeptId'
  UNION ALL SELECT 'departments', 'leaderEmployeeId'
  UNION ALL SELECT 'departments', 'excludeLeaderFromEvaluatorAutoAssign'
  UNION ALL SELECT 'departments', 'orgId'
  UNION ALL SELECT 'departments', 'createdAt'
  UNION ALL SELECT 'departments', 'updatedAt'
  UNION ALL SELECT 'organizations', 'id'
  UNION ALL SELECT 'organizations', 'name'
  UNION ALL SELECT 'organizations', 'fiscalYear'
  UNION ALL SELECT 'organizations', 'createdAt'
  UNION ALL SELECT 'organizations', 'updatedAt'
  UNION ALL SELECT 'employees', 'id'
  UNION ALL SELECT 'employees', 'empId'
  UNION ALL SELECT 'employees', 'empName'
  UNION ALL SELECT 'employees', 'deptId'
  UNION ALL SELECT 'employees', 'position'
  UNION ALL SELECT 'employees', 'role'
  UNION ALL SELECT 'employees', 'status'
  UNION ALL SELECT 'personal_kpis', 'id'
  UNION ALL SELECT 'personal_kpis', 'employeeId'
  UNION ALL SELECT 'personal_kpis', 'evalYear'
  UNION ALL SELECT 'personal_kpis', 'kpiType'
  UNION ALL SELECT 'personal_kpis', 'policyCategory'
  UNION ALL SELECT 'personal_kpis', 'policyCategoryConfidence'
  UNION ALL SELECT 'personal_kpis', 'policyCategorySource'
  UNION ALL SELECT 'personal_kpis', 'policyCategoryReviewedAt'
  UNION ALL SELECT 'personal_kpis', 'policyCategoryReviewNote'
  UNION ALL SELECT 'personal_kpis', 'kpiName'
  UNION ALL SELECT 'personal_kpis', 'definition'
  UNION ALL SELECT 'personal_kpis', 'formula'
  UNION ALL SELECT 'personal_kpis', 'targetValue'
  UNION ALL SELECT 'personal_kpis', 'targetValueT'
  UNION ALL SELECT 'personal_kpis', 'targetValueE'
  UNION ALL SELECT 'personal_kpis', 'targetValueS'
  UNION ALL SELECT 'personal_kpis', 'unit'
  UNION ALL SELECT 'personal_kpis', 'weight'
  UNION ALL SELECT 'personal_kpis', 'difficulty'
  UNION ALL SELECT 'personal_kpis', 'linkedOrgKpiId'
  UNION ALL SELECT 'personal_kpis', 'status'
  UNION ALL SELECT 'personal_kpis', 'tags'
  UNION ALL SELECT 'personal_kpis', 'copiedFromPersonalKpiId'
  UNION ALL SELECT 'personal_kpis', 'copyMetadata'
  UNION ALL SELECT 'personal_kpis', 'createdAt'
  UNION ALL SELECT 'personal_kpis', 'updatedAt'
  UNION ALL SELECT 'monthly_records', 'id'
  UNION ALL SELECT 'monthly_records', 'personalKpiId'
  UNION ALL SELECT 'monthly_records', 'employeeId'
  UNION ALL SELECT 'monthly_records', 'yearMonth'
  UNION ALL SELECT 'monthly_records', 'actualValue'
  UNION ALL SELECT 'monthly_records', 'achievementRate'
  UNION ALL SELECT 'monthly_records', 'activities'
  UNION ALL SELECT 'monthly_records', 'obstacles'
  UNION ALL SELECT 'monthly_records', 'efforts'
  UNION ALL SELECT 'monthly_records', 'evidenceComment'
  UNION ALL SELECT 'monthly_records', 'attachments'
  UNION ALL SELECT 'monthly_records', 'isDraft'
  UNION ALL SELECT 'monthly_records', 'submittedAt'
  UNION ALL SELECT 'monthly_records', 'createdAt'
  UNION ALL SELECT 'monthly_records', 'updatedAt'
  UNION ALL SELECT 'team_kpi_review_items', 'id'
  UNION ALL SELECT 'team_kpi_review_items', 'runId'
  UNION ALL SELECT 'team_kpi_review_items', 'orgKpiId'
  UNION ALL SELECT 'team_kpi_review_items', 'recommendationType'
  UNION ALL SELECT 'team_kpi_review_items', 'reviewType'
  UNION ALL SELECT 'team_kpi_review_items', 'kpiTitleSnapshot'
  UNION ALL SELECT 'team_kpi_review_items', 'verdict'
  UNION ALL SELECT 'team_kpi_review_items', 'rationale'
  UNION ALL SELECT 'team_kpi_review_items', 'linkageComment'
  UNION ALL SELECT 'team_kpi_review_items', 'roleFitComment'
  UNION ALL SELECT 'team_kpi_review_items', 'measurabilityComment'
  UNION ALL SELECT 'team_kpi_review_items', 'controllabilityComment'
  UNION ALL SELECT 'team_kpi_review_items', 'challengeComment'
  UNION ALL SELECT 'team_kpi_review_items', 'externalRiskComment'
  UNION ALL SELECT 'team_kpi_review_items', 'clarityComment'
  UNION ALL SELECT 'team_kpi_review_items', 'duplicationComment'
  UNION ALL SELECT 'team_kpi_review_items', 'strongPoint'
  UNION ALL SELECT 'team_kpi_review_items', 'weakPoint'
  UNION ALL SELECT 'team_kpi_review_items', 'improvementSuggestions'
  UNION ALL SELECT 'team_kpi_review_items', 'recommendationText'
  UNION ALL SELECT 'team_kpi_review_items', 'createdAt'
  UNION ALL SELECT 'team_kpi_review_items', 'updatedAt'
  UNION ALL SELECT 'team_kpi_review_runs', 'id'
  UNION ALL SELECT 'team_kpi_review_runs', 'businessPlanId'
  UNION ALL SELECT 'team_kpi_review_runs', 'sourceDepartmentId'
  UNION ALL SELECT 'team_kpi_review_runs', 'targetDepartmentId'
  UNION ALL SELECT 'team_kpi_review_runs', 'evalYear'
  UNION ALL SELECT 'team_kpi_review_runs', 'evalCycleId'
  UNION ALL SELECT 'team_kpi_review_runs', 'requesterId'
  UNION ALL SELECT 'team_kpi_review_runs', 'aiRequestLogId'
  UNION ALL SELECT 'team_kpi_review_runs', 'reviewType'
  UNION ALL SELECT 'team_kpi_review_runs', 'overallVerdict'
  UNION ALL SELECT 'team_kpi_review_runs', 'overallSummary'
  UNION ALL SELECT 'team_kpi_review_runs', 'linkedParentCoverage'
  UNION ALL SELECT 'team_kpi_review_runs', 'independentKpiCoverage'
  UNION ALL SELECT 'team_kpi_review_runs', 'createdAt'
  UNION ALL SELECT 'team_kpi_review_runs', 'updatedAt'
  UNION ALL SELECT 'audit_logs', 'id'
  UNION ALL SELECT 'audit_logs', 'userId'
  UNION ALL SELECT 'audit_logs', 'action'
  UNION ALL SELECT 'audit_logs', 'entityType'
  UNION ALL SELECT 'audit_logs', 'entityId'
  UNION ALL SELECT 'audit_logs', 'oldValue'
  UNION ALL SELECT 'audit_logs', 'newValue'
  UNION ALL SELECT 'audit_logs', 'ipAddress'
  UNION ALL SELECT 'audit_logs', 'userAgent'
  UNION ALL SELECT 'audit_logs', 'timestamp'
  UNION ALL SELECT 'eval_cycles', 'id'
  UNION ALL SELECT 'eval_cycles', 'orgId'
  UNION ALL SELECT 'eval_cycles', 'evalYear'
  UNION ALL SELECT 'eval_cycles', 'goalEditMode'
)
SELECT 'TABLE' AS object_kind,
       table_name,
       NULL::text AS column_name,
       table_name AS object_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = required_tables.table_name
       ) AS exists
FROM required_tables
UNION ALL
SELECT 'COLUMN' AS object_kind,
       table_name,
       column_name,
       table_name || '.' || column_name AS object_name,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = required_columns.table_name
           AND column_name = required_columns.column_name
       ) AS exists
FROM required_columns
ORDER BY object_kind, object_name;
```

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
