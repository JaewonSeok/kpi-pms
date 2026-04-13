# Current Handoff

Last updated: 2026-04-13
Branch: `main`
Base commit: `c45c116`

## Must-Read First

1. `docs/operations/working-rules.md`
2. `docs/operations/current-handoff.md`
3. `README.md`
4. `docs/auth-rbac-matrix.md`
5. `docs/operations/deployment-and-env.md`
6. `docs/ai-assistant-operations.md` if the task touches AI features
7. `docs/product/implementation-backlog.md` if the task changes scope or backlog priority

## Current Focus

There is no active uncommitted WIP in the repo right now. The current handoff focus is a clean continuation point after two recent completed workstreams:

- Calibration session setup hardening for the evaluation calibration page
- Login / auth stabilization after repeated Google sign-in issues

Most recent auth/login work completed by commits `aa24904`, `9bfb070`, and `c45c116`:

- Hardened auth env parsing around `NEXTAUTH_URL` / `AUTH_URL` and `NEXTAUTH_SECRET` / `AUTH_SECRET`
- Centralized auth runtime cookie policy so middleware and Auth.js use the same secure-cookie behavior
- Preserved only safe same-origin callback URLs and blocked redirects back into `/login`
- Added first-request recovery for identity-only callback tokens before full claims are rehydrated
- Kept the login page on the Google Workspace flow while preserving the emergency admin fallback path
- Kept Korean login copy and auth trace hooks covered by tests

Calibration session setup work already present in the repo:

- Dedicated session setup model in `src/lib/calibration-session-setup.ts`
- Session config parsing / serialization with `observerIds` and `setup`
- Validation coverage for setup fields and `START_SESSION`
- Workflow guard that blocks session start when required setup is incomplete
- Audit log support for `CALIBRATION_SESSION_STARTED`
- `CalibrationSessionSetupHub` wired into the calibration client

## Current Worktree Status

- `git status --short --untracked-files=all` is clean as of 2026-04-13.
- There are no tracked modified files waiting to be committed.
- `tmp-session1.pdf` and `tmp-session2.pdf` exist in the repo and are tracked files, not current untracked temp artifacts.

## Verified Status

Verified on 2026-04-13:

- `pnpm test:auth` passed.
- `pnpm exec ts-node -P tsconfig.seed.json tests/auth-session.test.ts` passed.
- `pnpm test:calibration-ops` passed.
- `pnpm typecheck` passed.

Not rerun during this handoff refresh:

- `pnpm lint`
- `pnpm build`
- live browser QA for `/login`
- live browser QA for the calibration setup flow

## Detailed Remaining Work

### P1. Browser QA for login/auth flow

- Open `/login` and verify Google sign-in launches correctly.
- Complete a successful Google callback and confirm the app lands on `/dashboard` or another same-origin callback target instead of looping back to `/login`.
- Verify the emergency admin login form still works.
- Confirm Korean error messages still render correctly for failed admin login and blocked Google login cases.
- Confirm the first protected page request after callback does not bounce because of incomplete token claims.

### P1. Environment and OAuth configuration audit

- Check `NEXTAUTH_URL` and `AUTH_URL` match exactly if both are set.
- Check `NEXTAUTH_SECRET` and `AUTH_SECRET` match exactly if both are set.
- Confirm `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are real values, not placeholders.
- Confirm Google Cloud Console still uses the correct OAuth client, client type `Web application`, and registered callback URLs.
- Confirm `ALLOWED_DOMAIN` matches the intended Workspace domain and actual employee `gwsEmail` data.

### P1. Broader verification before release

- Run `pnpm lint`.
- Run `pnpm build`.
- Smoke test `/api/health/live`, `/api/health/ready`, `/login`, and the main dashboard after deploy or before release.

### P2. Calibration manual QA still pending

- Open the calibration page and verify the setup hub renders in the policy/setup area.
- Save session setup fields and confirm refresh preserves values.
- Try `세션 시작` with incomplete setup and verify the blocking message is shown.
- Complete required fields, start the session, and verify the timeline and status reflect `CALIBRATING`.

### P2. Decide what to do with tracked PDF fixtures

- `tmp-session1.pdf` and `tmp-session2.pdf` are now tracked in the repository.
- Before deleting, moving, or renaming them, confirm whether they are intentional fixtures or stale artifacts that should be replaced with better-named assets.

## Important Notes

- The project rule is `pnpm` first. Older runbooks that still said `npm` were updated during this handoff refresh, but keep watching for drift.
- Credentials login remains an emergency admin path backed by env credentials, not a general employee password flow.
- Current auth/RBAC limits still documented in `docs/auth-rbac-matrix.md`:
  - password reset is not implemented
  - failed-login lockout is not implemented
  - Google Workspace sync is not implemented
- Keep Korean UI copy, English code/comments/tests, and preserve auditability on workflow pages.
