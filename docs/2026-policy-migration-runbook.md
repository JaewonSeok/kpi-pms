# 2026 Evaluation Policy Migration Runbook

This runbook prepares the Phase 0.5 migration for a safe dev/staging rollout.
It must not be used to mutate production unless the target database has been
explicitly confirmed as production-safe and approved for deployment.

## Scope

Migration:

```text
prisma/migrations/20260514_phase0_2026_policy_prep/migration.sql
```

The migration is additive. It adds policy metadata tables, enums, and nullable
columns needed for the 2026 evaluation policy. It does not activate the 2026
scoring engine, grade calculation, AI score exclusion, or MBO validation.

## Current Local Environment Assessment

As of Phase 0.7, the checked `.env` only exposes `DATABASE_URL`.

Sanitized target:

```text
protocol: postgresql
host: aws-1-ap-northeast-1.pooler.supabase.com
database: postgres
local-like: false
```

No `LOCAL_DATABASE_URL`, `STAGING_DATABASE_URL`, `PREVIEW_DATABASE_URL`,
`DIRECT_URL`, or `SHADOW_DATABASE_URL` is configured locally.

Because the configured target is a remote Supabase pooler and is not labeled as
dev or staging, do not run migration apply commands against it.

## Why Prisma Reports Pending Migrations

`prisma migrate status` reports all repository migrations as pending because the
current remote DB does not have a `public._prisma_migrations` table. The DB does
contain application tables such as `organizations`, `personal_kpis`,
`evaluations`, and `evaluation_items`, so it appears to have been created or
managed outside Prisma migration history.

Do not blindly fix this with `migrate deploy` or manual inserts into
`_prisma_migrations`. First confirm whether this remote DB is development,
staging, preview, or production.

## Safe Target Selection

Use one of these targets for migration testing:

1. Local PostgreSQL, for example from `.env.example`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5433/kpi_pms"
```

2. A dedicated staging Supabase project or branch.
3. A disposable preview database restored from a recent sanitized snapshot.

Do not use a pooled Supabase production URL for migration development. Prefer a
direct database URL for migration commands when Supabase provides one.

## Validate Before Applying

Run these commands before any apply:

```powershell
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
pnpm.cmd exec prisma migrate status
```

Confirm:

- host/database is local, dev, staging, or preview
- `migrate status` output matches the expected target state
- no production hostname or production project is in use

## Apply Migration To Local/Dev

For a local disposable DB:

```powershell
$env:DATABASE_URL="postgresql://postgres:password@localhost:5433/kpi_pms"
pnpm.cmd exec prisma migrate dev
```

For confirmed staging/dev where migrations should be deployed non-interactively:

```powershell
$env:DATABASE_URL="<confirmed-dev-or-staging-direct-url>"
pnpm.cmd exec prisma migrate deploy
```

Do not run these commands against the current remote Supabase URL unless the
owner explicitly confirms it is dev/staging and migration deployment is approved.

## Verify Migration Applied

After applying to a safe target:

```powershell
pnpm.cmd exec prisma migrate status
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
```

Then verify the new metadata columns exist:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'personal_kpis',
    'evaluations',
    'evaluation_items',
    'ai_competency_gate_cases',
    'evaluation_grade_policies'
  )
order by table_name, column_name;
```

## Rerun No-Write Dry-Runs

After migration on dev/staging:

```powershell
pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/dry-run-classify-2026-evaluation-items.ts --year=2026
pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/dry-run-2026-score-impact.ts --year=2026
pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/dry-run-backfill-2026-policy-metadata.ts --year=2026
pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/backfill-2026-policy-metadata.ts --year=2026
```

The final command is also dry-run by default. It must print:

```text
dry-run only. No writes performed. Pass --apply to write metadata.
```

## Backfill Apply Rules

Do not run `--apply` until all of these are true:

- migration has been applied to confirmed dev/staging
- dry-run outputs have been reviewed
- HR has resolved manual-review KPI records
- production/staging ownership has approved metadata backfill
- a backup JSON report location has been selected

The apply-capable script is:

```powershell
pnpm.cmd exec ts-node -P tsconfig.seed.json scripts/backfill-2026-policy-metadata.ts --year=2026 --apply --exclude-manual-review
```

This still excludes unknown/manual-review records. Do not remove that exclusion
unless an explicit HR mapping file or manual mapping workflow has been added.

## Manual Review Records From Current Dry-Run

These records must not be auto-classified:

- 정세희 / 두번째 / UNKNOWN
- 정세희 / 세번째 / UNKNOWN
- 윤성호 / 비용절감 및 이익 창출 / ORG_GOAL candidate with daily-work conflict
- 석효진 / i-One job / 기업은행 관리 / UNKNOWN
- emstest / Test / UNKNOWN

## Phase 1-A Gate

Phase 1-A can start only after:

- a confirmed dev/staging migration has been applied
- post-migration dry-runs pass
- backfill dry-run passes
- manual-review records remain excluded or are explicitly HR-mapped
- no production mutation occurred during preparation
