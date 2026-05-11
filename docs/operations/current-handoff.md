# Current Handoff

Last updated: 2026-05-12
Branch: `main`
Latest commit checked: `4974df3` (`실 kpi 추가`)
Remote state observed: `HEAD -> main, origin/main`

## Must-Read First

1. `docs/operations/working-rules.md`
2. `docs/operations/current-handoff.md`
3. `README.md`
4. If the task touches auth, login, session, middleware, Google OAuth, master login, or pending access, read:
   - `docs/auth-rbac-matrix.md`
   - `docs/operations/deployment-and-env.md`
5. If the task touches AI features, read `docs/ai-assistant-operations.md`.
6. If the task changes product scope or backlog priority, read:
   - `docs/product/implementation-backlog.md`
   - `docs/product/global-benchmark-gap-analysis.md`
   - `docs/product/implementation-roadmap-world-class.md`
7. Before release or external handoff, read `docs/operations/release-readiness.md`.

## Current Worktree Status

- `git status --short` returned clean during this refresh.
- No tracked modified files were waiting before this handoff document update.
- The repo contains tracked PDF fixture/artifact files such as `tmp-session1.pdf` and `tmp-session2.pdf`; do not delete or rename them without confirming their purpose.
- `..kpi-pms.zip` exists in the repo history/worktree context and should be treated carefully as a large artifact.

## Current Focus

The active continuation point is no longer only auth stabilization. Since the older auth/calibration handoff, the repository has moved through a large product expansion and the latest visible commit series is mainly `실 kpi 추가` / organization KPI scope work.

Most recent focus to preserve:

- Organization KPI hierarchy now includes `division`, `section` (`실 KPI`), and `team` scope concepts.
- Org KPI UI and filtering were expanded in `src/components/kpi/OrgKpiManagementClient.tsx`.
- Hierarchy helpers were expanded in `src/lib/org-kpi-hierarchy.ts`.
- Latest HEAD added/updated targeted coverage:
  - `tests/org-kpi-hierarchy-filters.test.ts`
  - `tests/org-kpi-section-team-scope.test.ts`
- Team AI / org KPI recommendation workspace exists around:
  - `src/components/kpi/OrgKpiTeamAiWorkspace.tsx`
  - `src/server/org-kpi-team-ai.ts`
  - `src/app/api/kpi/org/team-ai/*`
  - `src/app/api/kpi/org/business-plan/route.ts`
  - `src/app/api/kpi/org/job-description/route.ts`
- Large related workstreams now present in the codebase include personal KPI AI drafting, monthly KPI/mid-review support, CEO final evaluation, statistics dashboards, performance assignments, AI competency gate work, master login hardening, and Google account/admin hierarchy work.

## Important Completed Context

### Auth/Login Stabilization

Previously completed and still important:

- `NEXTAUTH_URL` / `AUTH_URL` alias handling.
- `NEXTAUTH_SECRET` / `AUTH_SECRET` alias handling.
- Shared secure-cookie/runtime policy between middleware and Auth.js.
- Same-origin callback preservation and `/login` redirect loop prevention.
- First-request recovery when callback token claims are incomplete.
- Google Workspace login remains the main flow.
- Credentials/master/admin login remains an emergency/admin fallback, not a general password login.
- `/access-pending` handling exists for pending or incomplete access states.

### Calibration Session Setup

Previously completed and still present:

- Dedicated session setup model in `src/lib/calibration-session-setup.ts`.
- Session config parsing/serialization with `observerIds` and `setup`.
- Validation coverage for setup fields and `START_SESSION`.
- Workflow guard blocks session start when required setup is incomplete.
- Audit log support for `CALIBRATION_SESSION_STARTED`.
- `CalibrationSessionSetupHub` is wired into the calibration client.

### Recent Org KPI / Section KPI Work

Current likely working area:

- Preserve separate division/section/team filter behavior.
- When a section is selected, team choices should stay under that selected section and should not fall back to unrelated direct division teams.
- When there is no section layer, direct division-team behavior should continue to work.
- `실 KPI` naming appears in tests and UI expectations.
- Org KPI route/client must preserve section context with a department anchor.
- Members and leaders should only see/edit scope allowed by lineage and permission rules.

## Detailed Remaining Work

### P1. Refresh verification after latest `실 kpi 추가` work

Run targeted checks before continuing deeper changes:

- `pnpm typecheck`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-hierarchy-filters.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-section-team-scope.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-scope-model.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-access.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-structure-ui.test.ts`

If touching AI recommendation paths, also run:

- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-team-ai-workspace.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-ai-recommendation-modal.test.ts`
- `pnpm exec ts-node -P tsconfig.seed.json tests/org-kpi-ai-recommendation-upgrade.test.ts`

### P1. Manual QA for organization KPI hierarchy

Open `/kpi/org` and verify:

- Division, section (`실 KPI`), and team tabs/filters render correctly.
- Selecting a division shows its section options and valid direct teams.
- Selecting a section only shows child teams inside that section.
- A section with no child team does not pull in unrelated division teams.
- Existing org KPI records keep the right department context after refresh.
- Create/edit/save/delete/workflow actions still obey permission scope.
- Bulk upload and bulk edit still work with section/team context.
- Long KPI text does not break the table, detail panel, or modal layouts.

### P1. Permission and role QA

Check with seeded/admin users or representative accounts:

- Admin can manage all organization KPI scopes.
- Division head can work within division scope.
- Section leader can read section lineage and child teams.
- Team leader can read/write only allowed team/lineage scope.
- Regular member can view allowed org KPI menu and lineage without write access.
- Master login/impersonation banners and risk prompts still behave correctly.

### P1. Auth and environment audit before release

The auth work was completed earlier, but release still needs real environment validation:

- Confirm `NEXTAUTH_URL` and `AUTH_URL` match exactly if both exist.
- Confirm `NEXTAUTH_SECRET` and `AUTH_SECRET` match exactly if both exist.
- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are real values, not placeholders.
- Confirm `ALLOWED_DOMAIN` matches intended Google Workspace domain and employee `gwsEmail` data.
- Confirm Google Cloud Console OAuth client is type `Web application`.
- Confirm callback URLs include:
  - local: `http://localhost:3000/api/auth/callback/google`
  - production: `https://<production-domain>/api/auth/callback/google`

### P1. Browser QA for login/auth flow

Open `/login` and verify:

- Google sign-in starts correctly.
- Callback lands on `/dashboard` or the intended same-origin callback target.
- Callback does not loop back to `/login`.
- Emergency admin/master login still works.
- Korean error messages render for failed admin login and blocked Google login.
- First protected page request after callback does not bounce due to incomplete token claims.
- Pending access states route to `/access-pending` with a useful message.

### P1. Broader release verification

Before deploy or handoff to operations, run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Smoke test `/api/health/live`
- Smoke test `/api/health/ready`
- Smoke test `/login`
- Smoke test `/dashboard`
- Smoke test `/kpi/org`
- Smoke test `/statistics`

### P2. Calibration manual QA still pending

If returning to calibration:

- Open the calibration page and verify setup hub renders in the policy/setup area.
- Save session setup fields and confirm refresh preserves values.
- Try `세션 시작` with incomplete setup and verify the blocking message.
- Complete required fields, start the session, and verify timeline/status become `CALIBRATING`.

### P2. Product-wide manual QA after large expansion

Because many feature surfaces changed since the old auth handoff, run a broad user-flow pass when time allows:

- Personal KPI creation/edit/AI draft/apply.
- Monthly KPI records and mid-review drawer.
- Evaluation workbench load/submit/reject.
- CEO final evaluation adjustment/finalization.
- AI competency admin and case review flow.
- Statistics dashboard filtering and empty/error states.
- Admin performance assignments.
- Google account registration and department hierarchy management.
- Notification ops page and admin ops dashboard.

### P2. Artifact and documentation cleanup

- Confirm whether tracked `tmp-session*.pdf` files are intentional fixtures.
- Confirm whether large zip artifacts should remain in the repo.
- Keep `docs/operations/current-handoff.md` and `docs/operations/next-chat-prompt.md` updated whenever the active focus changes.
- Consider splitting long accumulated handoff history into dated sections if future chats become confused by older completed work.

## Verification During This Refresh

Verified while preparing this handoff:

- Existing rule/policy docs were found and read:
  - `docs/operations/working-rules.md`
  - `docs/operations/current-handoff.md`
  - `docs/operations/next-chat-prompt.md`
  - `docs/operations/release-readiness.md`
  - `README.md`
- `git status --short` was clean before document edits.
- Latest visible commit was `4974df3` on `main` and `origin/main`.
- Recent commit log contains repeated `실 kpi 추가` work after the older auth/calibration baseline.

Not rerun during this documentation refresh:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- Browser QA

## Non-Negotiable Rules To Carry Forward

- Use `pnpm` as the primary package manager.
- Do not revert existing user changes unless explicitly asked.
- Keep shared UI copy in Korean.
- Keep code, comments, and tests in English.
- Keep write paths in route handlers or server-side code.
- Validate request bodies with Zod.
- OpenAI usage stays server-side and must not receive direct PII such as names, emails, employee IDs, target IDs, or evaluator IDs.
- AI output is preview-first and approval-based.
- Preserve auth same-origin callback handling and prevent `/login` redirect loops.
- Workflow pages should design data model, permissions, state transitions, and audit log together.
