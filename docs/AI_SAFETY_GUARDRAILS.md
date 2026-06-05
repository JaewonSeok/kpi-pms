# AI Safety Guardrails

Last updated: 2026-06-05

## Absolute Prohibited Actions Without Explicit Approval

- Mutate production data
- Run migrations against production
- Run `prisma migrate deploy` against production
- Run dry-run/backfill/apply flows
- Run `backfill --apply`
- Activate official scoring
- Activate official grade calculation
- Activate AI score exclusion
- Modify `Evaluation.totalScore`
- Modify `Evaluation.gradeId`
- Create official `Evaluation` records
- Create official `EvaluationItem` records
- Change production feature flags
- Send emails or notifications
- Expose secrets or environment values
- Edit `.env` files
- Force push or delete protected refs without explicit approval

## Production Safety Rules

- Treat `https://kpi-pms.vercel.app` as the stable production alias.
- Always verify which Vercel deployment the alias points to before claiming a change is live.
- Vercel may build with a new Prisma client before DB migrations are applied; this can cause `P2022 column does not exist`.
- Do not promote or restore aliases without explicit user approval.
- After alias changes, smoke protected routes and watch logs for `500`, `P2021`, `P2022`, `PrismaClientKnownRequestError`, `column does not exist`, `relation does not exist`, and `JWT_SESSION_ERROR`.

## Migration Rules

- Do not edit `prisma/schema.prisma` unless the task explicitly asks for schema work.
- Do not create `prisma/migrations/**` unless explicitly requested.
- Do not run production migrations from an AI session.
- If Prisma schema changes are proposed, verify staging/preview DB separation and deployment order first.
- Avoid deploying a Prisma client that expects new columns before the target DB has those columns.

## Backfill Rules

- Dry-run/backfill scripts exist under `scripts/**`.
- Do not run them unless the user explicitly approves the exact scope and environment.
- Never run `--apply` without explicit approval and backup/rollback plan.
- Treat 2026 policy metadata backfill as operationally sensitive.

## Official Score / Grade Rules

- Official scoring feature flag must stay false unless explicitly approved after readiness gates.
- Official grade feature flag must stay false unless explicitly approved after score and grade gates.
- `Evaluation.totalScore` write is a separate official scoring action.
- `Evaluation.gradeId` write is a separate official grade action.
- AI Pass/Fail annual score exclusion must not be activated casually.

## Feature Flag Rules

Important 2026 flags live in `src/lib/feature-flags.ts`:

- `EVALUATION_2026_PREVIEW_ENABLED`
- `EVALUATION_2026_OFFICIAL_SCORING_ENABLED`
- `EVALUATION_2026_OFFICIAL_GRADE_ENABLED`
- `EVALUATION_2026_AI_SCORE_EXCLUSION_ENABLED`
- `EVALUATION_2026_BACKFILL_APPLIED`
- `EVALUATION_2026_BACKFILL_EXCLUDED`
- `EVALUATION_2026_HR_APPROVAL_CONFIRMED`

Preview may be enabled. Official scoring/grade/AI exclusion/backfill/HR approval flags must not be changed without an approved release plan.

## Auth / Secrets Rules

- Do not print or copy `.env` contents.
- Do not expose `DATABASE_URL`, OAuth secrets, SMTP secrets, ops tokens, or NextAuth secrets.
- If a secret-like value appears in an excluded/sensitive file, report only: `secret-like value found in excluded/sensitive file, not copied.`
- Google auth variable names are documented in `README.md`; values are never copied into docs.

## Branch / Worktree Rules

- Start from clean `origin/main` unless the user asks otherwise.
- Run `git fetch origin`, `git status --short`, and inspect recent `origin/main` before making branches.
- If the worktree is dirty, stop and report dirty files. Do not stash/reset/clean unless explicitly asked.
- Stage only intended files. Do not use `git add .`.
- Do not force push.
- Do not delete backup/protected refs without explicit approval.

Historically protected refs from recent workflows:

- `backup/feature-score-policy-pre-rebase`
- `feat/workbench-hero-refactor`
- `feature/2026-score-policy-readiness`

This worktree did not show those local heads during the 2026-06-05 context-pack task, but future sessions should still avoid deleting any matching local or remote refs without explicit approval.

## Vercel Alias Restore Rules

1. Verify `origin/main` contains the intended commit.
2. Inspect Vercel deployment status.
3. Confirm target deployment is `Ready`, source is expected branch, and commit is expected.
4. Smoke protected routes; unauthenticated `307`/`401` is acceptable.
5. Ask for explicit user approval before changing stable alias.
6. After alias restore, verify target deployment and watch logs.

