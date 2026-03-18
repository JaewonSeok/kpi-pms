# KPI 성과관리 구현 준비 Backlog

이 문서는 PRD와 와이어프레임을 실제 개발 티켓으로 쪼개기 위한 준비 문서다.

관련 문서:
- [PRD](./performance-management-prd.md)
- [Low-Fidelity Wireframes](./page-wireframes-lowfi.md)

## 1. 구현 원칙

- 기존 동작 페이지를 최대한 유지하면서 도메인 모델을 확장한다.
- 화면 shell만 추가하지 않고 `데이터 모델`, `권한`, `상태 전이`, `감사 로그`를 함께 설계한다.
- 모든 운영형 페이지는 최소한의 auditability를 가져야 한다.
- 모바일은 조회/승인 중심으로 우선 제공한다.

## 2. 도메인별 엔티티 Backlog

### KPI Domain

#### `OrgKpi`
- add `status`
- add `ownerId`
- add `parentOrgKpiId`
- add `measurementCycle`
- add `submittedAt`
- add `confirmedAt`
- add `lockedAt`
- add `archivedAt`

#### `PersonalKpi`
- extend `status` to support review workflow
- add `reviewerId`
- add `reviewComment`
- add `submittedAt`
- add `confirmedAt`
- add `lockedAt`
- add `orgKpiId` validation constraints for linkage integrity

#### `MonthlyRecord`
- add `reviewComment`
- add `reviewedById`
- add `reviewedAt`
- add `submissionStatus` if distinct from record status
- consider `MonthlyRecordAttachment` relation for stronger evidence lifecycle

### Evaluation Domain

#### `EvalCycle`
- add `schemeType`
- add `targetScope`
- add `publishedAt`
- add `appealStartAt`
- add `appealEndAt`
- add readiness flags or computed projection endpoint

#### `Evaluation`
- add `finalGradeName`
- add `publishedAt`
- add `calibratedScore`
- add `calibratedGradeName`
- add `calibrationReason`
- add `isAppealOpen`

#### `EvaluationItem`
- ensure traceability of source KPI / monthly evidence link
- add reviewer note history if needed

#### `Appeal`
- add `category`
- add `assignedToId`
- add `slaDueAt`
- add `resolutionType`
- add `resolvedAt`
- add `withdrawnAt`
- add attachment relation if current payload is too thin

### Compensation Domain

#### `CompensationRuleSet`
- add `status`
- add `publishedAt`
- add `copiedFromYear`

#### `CompensationScenario`
- add `publishedById`
- add `publishedAt`
- add `publishNote`
- extend status with `PUBLISHED`
- add `requiresRecalculation`

#### `CompensationScenarioEmployee`
- ensure audit fields for overridden amount/rate
- add `adjustmentReason`

#### `CompensationApproval`
- align approval stage names with actual org policy
- add `actedAt`
- add `comment`

### Admin / Ops Domain

#### `Department`
- consider `effectiveFrom`
- consider `effectiveTo`
- consider org history table if frequent restructures are expected

#### `Employee`
- add stronger Google account mapping metadata if needed
- consider login readiness cache field

#### `Notification`
- add `linkUrl`
- add `priority`
- add `actionRequired`
- add `archivedAt`

#### `NotificationTemplate`
- add preview metadata
- add supported variables manifest

#### `AuditLog`
- standardize object types and action names across KPI/evaluation/compensation/admin

## 3. API Backlog

### KPI APIs

- `GET /api/kpi/org/tree`
  - organization-scoped KPI tree summary
- `GET /api/kpi/org/[id]`
  - single org KPI detail with audit summary
- `PATCH /api/kpi/org/[id]`
  - edit org KPI
- `POST /api/kpi/org/[id]/submit`
- `POST /api/kpi/org/[id]/confirm`
- `POST /api/kpi/org/[id]/lock`
- `GET /api/kpi/org/linkage-summary`

- `GET /api/kpi/personal/review`
  - manager review queue
- `POST /api/kpi/personal/[id]/submit`
- `POST /api/kpi/personal/[id]/review`
- `POST /api/kpi/personal/[id]/confirm`

- `GET /api/kpi/monthly-record/summary`
- `POST /api/kpi/monthly-record/[id]/review`
- `POST /api/kpi/monthly-record/[id]/attachments`

### Evaluation APIs

- `GET /api/evaluation/results`
  - role-aware result list/query
- `GET /api/evaluation/results/[id]`
  - final score + stage history + calibration info
- `GET /api/evaluation/distribution`
  - org distribution for calibration page
- `POST /api/evaluation/calibration`
  - batch adjustment with reasons

- `GET /api/appeals`
- `POST /api/appeals`
- `GET /api/appeals/[id]`
- `PATCH /api/appeals/[id]`
- `POST /api/appeals/[id]/resolve`
- `POST /api/appeals/[id]/withdraw`

### Check-in APIs

- `GET /api/checkin/calendar`
- `POST /api/checkin/[id]/reschedule`
- `POST /api/checkin/[id]/actions`
- `PATCH /api/checkin/[id]/actions/[actionId]`

### Compensation APIs

- `GET /api/compensation/scenarios/compare`
- `POST /api/compensation/scenarios/[id]/recalculate`
- `POST /api/compensation/scenarios/[id]/publish`
- `GET /api/compensation/self/explain`
- `POST /api/compensation/self/acknowledge`

### Admin / HR Ops APIs

- `GET /api/admin/org-chart/current`
- `GET /api/admin/org-chart/history`
- `POST /api/admin/org-chart/rollback`

- `GET /api/admin/eval-cycles/[id]/progress`
- `POST /api/admin/eval-cycles/[id]/publish-results`
- `POST /api/admin/eval-cycles/[id]/close-appeal`

- `GET /api/admin/employees/google-account/issues`

- `GET /api/admin/notification-templates/preview`
- `POST /api/admin/notification-dead-letters/retry`

## 4. UI / Component Backlog

### Shared Layout
- `PageHeaderWithScope`
- `SummaryMetricGrid`
- `StatusBanner`
- `PageEmptyState`
- `PageErrorState`
- `MobileActionFooter`

### Workflow / Audit
- `AuditTimeline`
- `ApprovalStepper`
- `ReadinessChecklist`
- `EntityHistoryDrawer`
- `DiffPreviewPanel`

### Data Exploration
- `TreeTable`
- `FilterBar`
- `SavedViewBar`
- `MobileCardList`
- `MetricCardStrip`

### Form / Edit
- `DrawerForm`
- `FullScreenMobileForm`
- `WeightMeter`
- `RangeEditor`
- `AttachmentUploader`
- `RichTextareaWithPrompt`

### Charts / Insights
- `DistributionChart`
- `CascadeMap`
- `TrendSparkline`
- `BudgetGauge`
- `RiskPill`

### AI
- `AiPreviewPanel`
- `BiasRiskBadge`
- `HumanApprovalBar`

## 5. Feature Slice Breakdown

### Slice 1: KPI Foundation
- organization KPI workflow
- personal KPI review workflow
- monthly record review/evidence
- basic linkage metrics

### Slice 2: Evaluation Integrity
- evaluation results
- appeal workflow
- calibration page

### Slice 3: HR Operations
- evaluation cycle management
- org chart management
- grade setup impact view
- Google account issue management

### Slice 4: Compensation Governance
- scenario compare
- approval timeline alignment
- my compensation explanation UX

### Slice 5: Operational Excellence
- notification center action model
- notification ops improvements
- admin ops business risk aggregation

## 6. Suggested Delivery Order

### Sprint Group A
- `/admin/eval-cycle`
- `/kpi/org`
- `/kpi/personal`
- `/kpi/monthly`

### Sprint Group B
- `/evaluation/results`
- `/evaluation/appeal`
- `/evaluation/ceo-adjust`
- `/admin/org-chart`

### Sprint Group C
- `/checkin`
- `/compensation/manage`
- `/admin/grades`
- `/admin/google-access`

### Sprint Group D
- `/compensation/my`
- `/notifications`
- `/admin/notifications`
- `/admin/ops`

## 7. Definition of Done

- page route exists and is role-safe
- empty/loading/error states are implemented
- no visible route leads to 404
- submit/review/approve flows leave audit logs
- major tables degrade safely on mobile
- all destructive or publication actions have confirmation guardrails
- analytics/summary cards and drill-downs are wired to real data or explicitly hidden
