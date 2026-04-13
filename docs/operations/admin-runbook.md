# Admin Runbook

## Daily startup checks

1. Open `/admin/ops`
2. Confirm:
   - environment is correct
   - database health is `ok`
   - required secrets are configured
   - failed jobs in 24h are within tolerance
   - AI fallback count is not unexpectedly high
3. Open admin notifications page and check dead letters if count > 0

## Before release

1. Read `docs/operations/release-readiness.md`
2. Read `docs/operations/data-migration-and-launch-plan.md`
3. Review `docs/operations/data-mapping-matrix.csv`
4. Review `docs/operations/admin-training-outline.md` and `docs/operations/faq-draft.md`
5. Confirm stage validation complete
6. Confirm latest backup exists
7. Confirm migration owner and rollback owner are assigned

## After release

1. Verify `/api/health/live`
2. Verify `/api/health/ready`
3. Open `/admin/ops`
4. Check recent operational events for new errors
5. Run smoke flows:
   - login
   - KPI personal page
   - evaluation assistant page
   - compensation manage
   - notifications admin page

## Feature flag operations

- AI assist:
  - env: `FEATURE_AI_ASSIST`
  - impact: enables OpenAI request path
- notification scheduler:
  - env: `FEATURE_NOTIFICATIONS_SCHEDULER`
  - impact: blocks cron-triggered scheduling/dispatch
- email delivery:
  - env: `FEATURE_EMAIL_DELIVERY`
  - impact: email falls back to transport stub when disabled
- ops dashboard:
  - env: `FEATURE_OPS_DASHBOARD`
  - impact: admin ops summary endpoint disabled when off

## Incident triage flow

1. Classify severity.
2. Capture current time and affected environment.
3. Use `/admin/ops` for health, flags, secrets, recent events.
4. If database related, pause rollout and read `backup-restore-drill.md`.
5. If AI related, disable `FEATURE_AI_ASSIST` and rely on fallback UI.
6. If notification related, inspect dead letters and re-run cron after fix.

## Migration day

1. Confirm backup complete.
2. Run `pnpm run db:generate`
3. Run `pnpm run db:push`
4. Follow cutover order in `docs/operations/data-migration-and-launch-plan.md`
5. Run health checks.
6. Smoke test critical admin/member flows.
7. Watch `/admin/ops` for 15 minutes.

## Backup / restore drill

1. Follow `docs/operations/backup-restore-drill.md`
2. Record RTO and RPO
3. Save findings with date, owner, and blockers

## Useful endpoints

- `GET /api/health/live`
- `GET /api/health/ready`
- `GET /api/ops/metrics` with `x-ops-token`
- `GET /api/admin/ops/summary`

## Launch references

- `docs/operations/data-migration-and-launch-plan.md`
- `docs/operations/data-mapping-matrix.csv`
- `docs/operations/admin-training-outline.md`
- `docs/operations/faq-draft.md`
