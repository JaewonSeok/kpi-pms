# Codex Route Map

Last updated: 2026-06-16

This route map is a working guide. Inspect the route and loader before making changes.

## Main Page Routes

| Route | Purpose | Primary roles | Key files |
| --- | --- | --- | --- |
| `/dashboard` | Main landing dashboard | Authenticated | `src/app/(main)/dashboard/page.tsx` |
| `/statistics` | Statistics dashboard | Admin/CEO | `src/app/(main)/statistics/page.tsx` |
| `/kpi/org` | Organization KPI management | Admin, CEO, division, section, team, member scoped | `src/app/(main)/kpi/org/page.tsx`, `OrgKpiManagementClient` |
| `/kpi/personal` | Personal KPI/MBO workspace and review tab | Authenticated, scoped | `src/app/(main)/kpi/personal/page.tsx`, `PersonalKpiManagementClient`, `personal-kpi-page.ts` |
| `/kpi/monthly` | Monthly result/evidence/comment workspace | Authenticated, scoped | `src/app/(main)/kpi/monthly/page.tsx`, `MonthlyKpiManagementClient`, `monthly-kpi-page.ts` |
| `/evaluation/performance` | HR performance/MBO operations dashboard | Authenticated, demo core | `evaluation/performance/page.tsx`, `EvaluationWorkbenchClient` |
| `/evaluation/workbench` | Preview-only evaluation workbench | Authenticated, demo core | `evaluation/workbench/page.tsx`, `EvaluationProcessPreviewGuide2026`, `EvaluationWorkbenchClient` |
| `/evaluation/results` | Evaluation result view | Authenticated, scoped | `evaluation/results/page.tsx`, `EvaluationResultsClient` |
| `/evaluation/appeal` | Evaluation appeal workspace | Authenticated, scoped | `evaluation/appeal/page.tsx`, `EvaluationAppealClient` |
| `/evaluation/ceo-adjust` | CEO final/adjustment area | Admin/CEO | `evaluation/ceo-adjust/page.tsx`, `EvaluationCeoFinalClient` |
| `/evaluation/assistant` | Evaluation assistant | Authenticated | `evaluation/assistant/page.tsx` |
| `/evaluation/360` | 360 feedback workspace | Authenticated | `evaluation/360/page.tsx` |
| `/evaluation/upward/respond` | Upward review response | Authenticated | `evaluation/upward/respond/page.tsx` |
| `/evaluation/upward/admin` | Upward review admin | Admin-oriented | `evaluation/upward/admin/page.tsx` |
| `/evaluation/word-cloud-360` | Word-cloud 360 workspace | Authenticated | `evaluation/word-cloud-360/page.tsx` |
| `/evaluation/ai-competency` | AI competency evaluation | Authenticated | `evaluation/ai-competency/page.tsx`, `AiCompetencyClient` |
| `/admin/evaluation-ops` | HR operation hub | Admin | `admin/evaluation-ops/page.tsx` |
| `/admin/evaluation-readiness` | 2026 official readiness and write guard | Admin | `admin/evaluation-readiness/page.tsx`, `EvaluationWorkbenchClient` |
| `/admin/performance-assignments` | Evaluator assignment management | Admin | `admin/performance-assignments/page.tsx` |
| `/admin/performance-calendar` | Performance calendar | Admin | `admin/performance-calendar/page.tsx` |
| `/admin/department-score-intake` | Department score intake admin | Admin | `admin/department-score-intake/page.tsx`, `/api/admin/department-score-intake` |
| `/admin/preview-2026-grade` | 2026 grade preview | Admin | `admin/preview-2026-grade/page.tsx` |
| `/admin/eval-cycle` | Evaluation cycle admin | Admin | `admin/eval-cycle/page.tsx`, `/api/admin/eval-cycles` |
| `/admin/grades` | Grade policy admin | Admin | `admin/grades/page.tsx`, `/api/admin/grades/[year]` |
| `/admin/performance-design` | Performance design admin | Admin | `admin/performance-design/page.tsx` |
| `/admin/google-access` | Google account/org chart admin | Admin | `admin/google-access/page.tsx`, `/api/admin/employees/google-account/**` |
| `/admin/ops` | Operations dashboard | Admin | `admin/ops/page.tsx`, `/api/ops/metrics` |
| `/notifications` | Notification center | Authenticated | `notifications/page.tsx`, `/api/notifications/**` |
| `/checkin` | Check-in and mid-review | Authenticated | `checkin/page.tsx`, `/api/checkin/**` |
| `/compensation/manage` | Compensation scenario management | Admin/division/CEO | Exists but hidden from MBO demo nav |
| `/compensation/my` | Individual compensation results | Authenticated | Exists but hidden from MBO demo nav |

## API Route Families

| API prefix | Purpose | Risk |
| --- | --- | --- |
| `/api/kpi/personal` | Personal KPI reads/writes, workflow, clone, AI, midcheck coach | Write-risk |
| `/api/kpi/monthly-record` | Monthly record reads/writes, workflow, AI | Write-risk |
| `/api/kpi/org` | Organization KPI CRUD, bulk, AI, HR exception, team AI | Write-risk |
| `/api/evaluation/preview-2026` | 2026 readiness, mapping, grade policy, official readiness cycle | Mixed read-only and metadata-only |
| `/api/evaluation/[id]` | Evaluation draft/read/update | Official write-risk |
| `/api/evaluation/[id]/submit` | Evaluation submit | Official write-risk |
| `/api/evaluation/[id]/review` | Review/reject workflow | Official write-risk |
| `/api/evaluation/calibration` | Calibration and score/grade adjustment | High write-risk |
| `/api/evaluation/results` | Results export/acknowledge | Read and write-risk |
| `/api/admin/performance-assignments` | Evaluator assignments | Admin write-risk |
| `/api/admin/department-score-intake` | Department score intake | Admin write-risk, not live scoring |
| `/api/admin/eval-cycles` | Evaluation cycle admin | Admin write-risk |
| `/api/admin/grades` | Grade policy writes | Admin write-risk |
| `/api/admin/performance-design` | Performance design config | Admin write-risk |
| `/api/admin/employees/google-account` | Employee Google account/org operations | Admin write-risk |
| `/api/ai` | AI assist routes | Server-side AI, log/fallback required |
| `/api/evaluation/ai-competency` | AI competency actions/evidence/export | Write-risk within AI competency domain |
| `/api/feedback` | Feedback/360/upward operations | Mixed write-risk |
| `/api/compensation` | Compensation planning/result APIs | Write-risk, not MBO demo scope |
| `/api/health` | Liveness/readiness | Read-only |
| `/api/ops/metrics` | Ops metrics with token | Read-only but sensitive |
| `/api/cron` | Scheduled effects | Dangerous without approval |

## Read-Only Or Preview-Safe APIs

Commonly safe to inspect or call for smoke if authenticated/authorized:

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/evaluation/preview-2026/activation-readiness`
- `GET /api/evaluation/preview-2026/readiness`
- `GET /api/evaluation/preview-2026/readiness-population`
- `GET /api/evaluation/preview-2026/mapping-candidates`
- `GET /api/evaluation/preview-2026/grade-policy`
- Export endpoints when explicitly used for read-only reporting

## Metadata-Only But Still Write APIs

Do not call without user approval:

- `PATCH /api/evaluation/preview-2026/policy-metadata`
- `PATCH /api/evaluation/preview-2026/team-kpi-review-decision`
- `PATCH /api/evaluation/preview-2026/official-readiness-cycle`
- `PATCH /api/evaluation/preview-2026/grade-policy`

These should not write `Evaluation.totalScore` or `Evaluation.gradeId`, but they still mutate metadata.

## Official Write-Risk APIs

Do not call casually:

- `POST /api/evaluation`
- `PATCH /api/evaluation/[id]`
- `PATCH /api/evaluation/[id]/submit`
- `PATCH /api/evaluation/[id]/review`
- `PATCH /api/evaluation/calibration`
- `POST /api/evaluation/calibration/workflow`
- `POST /api/evaluation/results/[cycleId]/acknowledge`
- Personal/org/monthly KPI write routes unless the task explicitly asks for controlled writes

## Data Dependencies By Demo Route

| Route | Data dependencies | Notes |
| --- | --- | --- |
| `/evaluation/performance` | Evaluation workbench loader, cycle/evaluation data, readiness APIs in client mode | Wait for dashboard cards to load before CEO demo. |
| `/kpi/personal` | Personal KPIs, employees, linked org KPIs, monthly records | Existing write controls are normal but must not be clicked during smoke. |
| `/kpi/monthly` | Monthly records and personal KPI list | Evidence flow is visible; save/submit are write actions. |
| `/admin/evaluation-ops` | Static/navigation and operation links | Good CEO demo bridge. |
| `/admin/performance-assignments` | Eval cycle, employees, assignment records | Dense. Optional for CEO demo. Do not sync/save. |
| `/admin/evaluation-readiness` | Workbench loader, activation readiness, mapping candidates, write guard summary | Safe read-only sections plus metadata write buttons. Do not save metadata during smoke. |
| `/evaluation/workbench` | Evaluation workbench sample/current data, preview scoring/grade helpers | Core proof for evaluation process preview. |

## Navigation Notes

`src/lib/navigation.ts` is the left sidebar source. Current MBO opening nav includes:

- KPI/MBO
- HR 평가 운영 대시보드
- 평가 워크벤치 미리보기
- Admin operation links

Compensation pages and APIs still exist, but the `보상` sidebar section is hidden for the current MBO opening demo scope.
