# Data Migration and Launch Plan

## Scope

This plan covers:

- legacy HR / PMS data mapping
- dry-run migration
- pilot rollout
- cutover and freeze window
- rollback criteria
- go-live day execution
- hypercare for the first 2 weeks

## Existing system data mapping summary

Detailed field-level mapping lives in:

- `docs/operations/data-mapping-matrix.csv`

High-level domain mapping:

| Legacy domain | Source owner | Target models | Primary join key | Notes |
| --- | --- | --- | --- | --- |
| Organization / department | HR master | `Organization`, `Department` | `org_code`, `dept_code` | Load before users |
| User / employment | HR master | `Employee` | `emp_id` | `emp_id` is the migration reconciliation key |
| Org KPI | Legacy PMS | `OrgKpi` | `dept_code + eval_year + kpi_name` | Normalize category/type before load |
| Personal KPI | Legacy PMS | `PersonalKpi` | `emp_id + eval_year + kpi_name` | Validate weight totals by employee/year |
| Evaluation header | Legacy PMS | `EvalCycle`, `Evaluation` | `cycle + target_emp_id + stage_code` | Create cycles first |
| Evaluation item | Legacy PMS | `EvaluationItem` | evaluation header key + KPI lookup | KPI references must resolve before item load |

## Migration strategy

### 1. Organization and department

- Import base organization and all departments first.
- Resolve parent-child hierarchy in a second pass.
- Reject rows with duplicate `dept_code`.

### 2. User and organization membership

- Use `emp_id` as the immutable reconciliation key.
- Normalize email and validate uniqueness before import.
- Map legacy position/role codes to Prisma enums.
- Do not launch with unresolved manager hierarchy for pilot users.

### 3. KPI data

- Load org KPIs first, then personal KPIs.
- Validate personal KPI weight sum per employee/year.
- Convert legacy free-text type/difficulty to controlled enums.
- Archive legacy rows that should not be active at launch rather than deleting them.

### 4. Evaluation data

- Create cycles and stages before evaluation import.
- Import evaluation headers first, items second.
- Preserve original score/comment values for auditability.
- If legacy data quality is low, keep old comments in an attachment/export file and launch with normalized scores only for pilot.

## Dry-run migration procedure

### Preparation

1. Take a fresh stage database backup.
2. Export legacy source snapshots for:
   - org/dept
   - employee
   - KPI
   - evaluation header/item
3. Freeze transformation logic version and mapping CSV version.

### Dry-run execution

1. Load raw extracts into a staging workspace.
2. Run validation:
   - required fields
   - duplicate business keys
   - enum mapping errors
   - unresolved foreign keys
   - KPI weight anomalies
3. Run preview import for organization/users using existing admin upload flow where possible.
4. Import into stage in this order:
   - organization / department
   - employee
   - org KPI
   - personal KPI
   - evaluation cycle / evaluation / evaluation item
5. Generate reconciliation report:
   - source count
   - loaded count
   - rejected row count
   - unresolved reference count
6. Run functional smoke test with pilot users.

### Dry-run success criteria

- 100% of pilot group users can log in
- 0 unresolved department references for pilot users
- 0 duplicate `emp_id`
- personal KPI weight errors under agreed threshold and manually resolved
- no Sev1 or Sev2 defect in stage smoke test

## Pilot group operating plan

- Size: 1 HR admin, 1 division head, 2 team leaders, 8-15 members
- Scope:
  - login
  - KPI creation/view
  - evaluation assistant
  - notification preferences
  - compensation self-view if applicable
- Duration: 5 business days before full cutover
- Exit criteria:
  - no open Sev1 defect
  - Sev2 defects have workaround or fix committed
  - admin confirms support/runbook usability

## Freeze window

- Suggested freeze:
  - `T-2 business days 18:00` to `go-live day 12:00`
- Freeze scope:
  - no legacy HR master bulk update without release lead approval
  - no schema change
  - no compensation rule version changes
  - no evaluation cycle date changes

## Cutover plan

### T-7 to T-3

1. Complete final dry-run.
2. Finalize pilot review.
3. Confirm backups and rollback owner.
4. Share launch communication draft.

### T-2 to T-1

1. Start freeze window.
2. Take final legacy extracts.
3. Reconcile delta changes since dry-run.
4. Validate secrets, feature flags, health endpoints.

### Go-live day

1. Backup target database.
2. Run migration in approved order.
3. Run smoke test with admin + pilot leads.
4. Open access to pilot or full audience per launch decision.
5. Start hypercare monitoring bridge.

## Rollback criteria

Rollback if any of the following is true:

- login failure rate blocks more than 10% of target users
- core data reconciliation gap exceeds 2% in pilot scope
- Sev1 production defect remains unresolved for 30 minutes
- database migration causes irrecoverable reference errors
- KPI/evaluation create or view flow fails for pilot admins and no workaround exists

## Go-live day checklist

1. Final backup completed and verified
2. Freeze window active
3. Source extracts timestamp recorded
4. Migration owner, validator, rollback owner on-call
5. `db:generate` and target migration completed
6. `/api/health/live` and `/api/health/ready` green
7. `/admin/ops` reviewed
8. pilot HR admin smoke test complete
9. communications sent
10. hypercare tracker opened

## Hypercare plan

- Duration: first 2 calendar weeks after launch
- Cadence:
  - day 1: war-room style coverage during business hours
  - days 2-5: twice-daily checkpoint
  - week 2: daily checkpoint
- Participants:
  - release lead
  - HR system admin
  - engineering on-call
  - data migration owner

## First 2 weeks monitoring metrics

- login success rate
- new user activation count
- KPI create success / failure count
- evaluation page load and submit success rate
- AI assist success vs fallback ratio
- notification dead-letter count
- admin ops health check failures
- reconciliation exceptions reported by HR
- support ticket volume by category

## Issue classification for hypercare

| Level | Definition | Example | SLA target |
| --- | --- | --- | --- |
| P1 | Launch blocking, no workaround | Most users cannot log in, DB outage | Immediate bridge, update every 30 min |
| P2 | Major business workflow blocked | HR cannot import users, evaluation submit fails for pilot | Acknowledge within 30 min |
| P3 | Partial degradation with workaround | AI fallback only, a dashboard widget broken | Same business day |
| P4 | Low-risk cosmetic / content issue | Label mismatch, FAQ wording update | Backlog or next patch |
