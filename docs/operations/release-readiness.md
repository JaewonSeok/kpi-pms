# Release Readiness

## Red team checklist

Precondition for the release checklist. See `docs/governance/redteam.md`
for trigger scope and record locations.

- run `/change-simulation` against the release scope; when the skill is
  unavailable, run a cross-session review instead and note the substitution
- record objections in the ADR that drove the change, or here when no ADR exists
- record human-raised objections, not only AI findings
- record rejected objections with the reason, not only accepted ones
- confirm the reviewing session is independent from the implementing session

## Release checklist

1. `pnpm run db:generate`
2. `pnpm run db:push` in stage
3. `pnpm run test:ai`
4. `pnpm run test:compensation`
5. `pnpm run test:notifications`
6. target lint for changed files
7. smoke test `/api/health/live` and `/api/health/ready`
8. confirm feature flags for release scope
9. confirm secrets are present in target environment
10. confirm backup completed before migration

## Accessibility checklist

- keyboard-only navigation works on login, KPI, evaluation assistant, admin ops
- focus styles visible
- color contrast acceptable for badges and warning cards
- touch targets are at least mobile-friendly size
- critical actions are still readable without color alone

## Security checklist

- no secrets in repo
- admin endpoints require role checks
- cron and metrics endpoints use shared secret
- AI outbound payload strips names/email/id fields
- stage uses masked or synthetic data only

## UAT checklist

- login works for admin and member roles
- KPI creation works on desktop and mobile
- AI assist preview -> approve -> apply works
- AI disabled fallback still works
- compensation self-view still opens after prior changes
- notification preferences save correctly
- admin ops dashboard loads and shows health/flags/events
