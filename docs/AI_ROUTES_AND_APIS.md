# AI Routes And APIs

Last updated: 2026-06-05

## Key Page Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/dashboard` | Main dashboard | Authenticated |
| `/kpi/org` | Organization KPI management | Role/RBAC scoped |
| `/kpi/personal` | Personal KPI/MBO management | Authenticated, scoped |
| `/kpi/monthly` | Monthly result records | Authenticated, scoped |
| `/evaluation/performance` | HR/operator evaluation dashboard | Authenticated |
| `/evaluation/workbench` | Evaluation workbench / pilot | Authenticated |
| `/admin/evaluation-readiness` | 2026 readiness admin hub | Admin-oriented |
| `/admin/evaluation-ops` | Evaluation operations hub | Admin-oriented |
| `/admin/performance-assignments` | Evaluator assignment management | Admin-oriented |
| `/evaluation/results` | Evaluation results | Authenticated, scoped |
| `/evaluation/360` | 360 feedback workspace | Authenticated, scoped |
| `/evaluation/ai-competency` | AI competency evaluation | Authenticated, scoped |
| `/admin/ops` | Admin operations dashboard | Admin-oriented |

## Read-Only / Export-Oriented APIs

| API | Method | Notes |
| --- | --- | --- |
| `/api/health/live` | GET | Liveness |
| `/api/health/ready` | GET | Readiness |
| `/api/ops/metrics` | GET | Ops token protected metrics |
| `/api/evaluation` | GET | Evaluation list/read surface |
| `/api/evaluation/[id]/preview-2026` | GET | 2026 preview for one evaluation |
| `/api/evaluation/preview-2026/readiness` | GET | 2026 preview readiness |
| `/api/evaluation/preview-2026/activation-readiness` | GET | Integrated activation/readiness data |
| `/api/evaluation/preview-2026/readiness-population` | GET | Population readiness snapshot |
| `/api/evaluation/preview-2026/mapping-candidates` | GET | Policy metadata mapping candidates |
| `/api/evaluation/preview-2026/grade-policy` | GET | Grade policy readiness |
| `/api/evaluation/results/[cycleId]/export` | GET | Results export |
| `/api/kpi/export` | GET | KPI export |
| `/api/admin/goal-alignment/export` | GET | Goal alignment export |

## Metadata-Only / Preview-Only APIs

These APIs can write metadata but should not be treated as official scoring or official grade writes.

| API | Method | What it may write | Must not write |
| --- | --- | --- | --- |
| `/api/evaluation/preview-2026/policy-metadata` | PATCH | `PersonalKpi` policy metadata; existing `EvaluationItem` policy metadata; audit logs; sometimes preview config if non-category drafts are included | `Evaluation.totalScore`, `Evaluation.gradeId`, official population, new `Evaluation`/`EvaluationItem` rows |
| `/api/evaluation/preview-2026/team-kpi-review-decision` | PATCH | Team KPI review metadata | Official Evaluation rows or scores |
| `/api/evaluation/preview-2026/official-readiness-cycle` | PATCH | `EvalCycle.performanceDesignConfig` readiness target metadata | Official score/grade flags |
| `/api/evaluation/preview-2026/grade-policy` | PATCH | Grade policy readiness metadata | `Evaluation.gradeId` |
| `/api/admin/performance-assignments` | POST | Evaluator assignment records if HR intentionally manages assignments | Score/grade fields |
| `/api/admin/performance-design/[cycleId]` | PATCH | Performance design config | Official score/grade activation |

## Official Write-Risk APIs

Do not call casually. These can modify real evaluation workflow data.

| API | Method | Risk |
| --- | --- | --- |
| `/api/evaluation` | POST | Can create `Evaluation` and `EvaluationItem` rows |
| `/api/evaluation/[id]` | PATCH | Draft save path can update items, comments, `totalScore`, `gradeId`, and status |
| `/api/evaluation/[id]/submit` | PATCH | Submit path can write score/grade fields and create next-stage rows |
| `/api/evaluation/[id]/review` | PATCH | Review/reject flow affects evaluation status |
| `/api/evaluation/calibration` | PATCH | Calibration/CEO adjustment can write `totalScore`/`gradeId` and adjustment rows |
| `/api/evaluation/calibration/workflow` | POST | Calibration workflow transitions |
| `/api/evaluation/results/[cycleId]/acknowledge` | POST | Result acknowledgment write |
| `/api/kpi/personal` and `/api/kpi/personal/[id]` | POST/PATCH/DELETE | Personal KPI writes |
| `/api/kpi/monthly-record` and children | POST/PATCH/workflow | Monthly result writes |
| `/api/kpi/org` and children | POST/PATCH/DELETE/workflow | Organization KPI writes |
| `/api/admin/eval-cycles` and children | POST/PATCH | Evaluation cycle writes |
| `/api/admin/grades/[year]` | PUT | Grade policy writes |
| `/api/admin/org-chart/upload` | POST | Employee/org data upload |
| `/api/admin/employees/google-account/**` | POST/PUT/PATCH/DELETE | Account, employee, master-login, evaluator management |
| `/api/cron/**` | POST | Scheduled operational effects; do not invoke manually without approval |

## AI APIs

AI routes are server-side and should remain preview-first:

- `/api/ai/assist`
- `/api/ai/evaluation-assist`
- `/api/ai/evaluation-briefing`
- `/api/kpi/personal/ai`
- `/api/kpi/monthly-record/ai`
- `/api/kpi/org/ai`
- `/api/feedback/360/ai`
- `/api/admin/ops/ai`

Do not send direct PII to AI providers. AI results should be reviewed before being applied.

## Auth / Permission Notes

- Protected pages use `requireProtectedPageSession`.
- RBAC/menu behavior is centralized under `src/lib/auth/permissions.ts` and server auth helpers.
- 2026 preview/admin policy mapping requires `ROLE_ADMIN`.
- Client visibility often also checks `permissions.canSeeAllInCycle`.
- Unauthenticated protected routes normally return a login redirect or 401, not a 500.

## Dangerous APIs / Scripts To Avoid

- `prisma migrate deploy` against production
- `scripts/backfill-2026-policy-metadata.ts --apply`
- Any dry-run/backfill script unless explicitly approved for safe local/staging use
- Official scoring/grade flag activation
- Cron notification endpoints unless the operation is explicitly approved

