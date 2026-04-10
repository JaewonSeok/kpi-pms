# Current Handoff

Last updated: 2026-04-10
Branch: `main`
Base commit: `1324382`

## Must-Read First

1. `docs/operations/working-rules.md`
2. `docs/operations/current-handoff.md`
3. `README.md`
4. `docs/ai-assistant-operations.md`
5. `docs/product/implementation-backlog.md`

## Current Focus

The active in-progress feature is calibration session setup hardening for the evaluation calibration page.

Additional hotfix completed on 2026-04-10:

- Repaired user-facing Korean mojibake strings across:
  - `/evaluation/360`
  - `/evaluation/appeal`
  - `/evaluation/results`
  - `/evaluation/word-cloud-360`
  - `/admin/performance-design`
  - `/kpi/org`
- The root causes were page-scoped source string corruption plus one persisted config path for `performanceDesignConfig`.
- Added `tests/korean-copy-hotfix.test.ts` to catch representative broken Korean tokens in affected route copy sources.
- Verified:
  - `tests/korean-copy-hotfix.test.ts`
  - `tests/performance-design.test.ts`
  - `tests/feedback-360-foundation.test.ts`
  - `tests/evaluation-appeal-workspace.test.ts`
  - `tests/evaluation-results-workspace.test.ts`
  - `tests/word-cloud-360.test.ts`
  - `tests/word-cloud-360-ops.test.ts`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm build`

Implemented in the worktree:

- Added a dedicated session setup model in `src/lib/calibration-session-setup.ts`.
- Extended calibration session config parsing/serialization with `observerIds` and `setup`.
- Added validation schema coverage for session setup fields and `START_SESSION`.
- Added workflow guard that blocks session start when required setup is incomplete.
- Added audit log support for `CALIBRATION_SESSION_STARTED`.
- Replaced the old calibration policy panel entry with `CalibrationSessionSetupHub`.
- Exposed setup readiness, department options, visible column options, and ground rule presets through the calibration view model.
- Added calibration tests for schema, readiness, workflow wiring, and UI integration.

## Files Currently Changed

Tracked modified files:

- `src/app/api/evaluation/calibration/route.ts`
- `src/app/api/evaluation/calibration/workflow/route.ts`
- `src/components/evaluation/EvaluationCalibrationClient.tsx`
- `src/lib/validations.ts`
- `src/server/evaluation-calibration-session.ts`
- `src/server/evaluation-calibration.ts`
- `tests/calibration-ops.test.ts`

Untracked files:

- `src/components/evaluation/CalibrationSessionSetupHub.tsx`
- `src/lib/calibration-session-setup.ts`
- `tmp-session1.pdf`
- `tmp-session2.pdf`

## Verified Status

Verified on 2026-04-10:

- `pnpm test:calibration-ops` passed.
- `pnpm typecheck` passed.
- targeted `eslint` completed with warnings only, no errors.

Current lint warnings to clean up later:

- `src/components/evaluation/CalibrationSessionSetupHub.tsx`
  - `react-hooks/set-state-in-effect` warning for resetting draft from props.
- `src/components/evaluation/EvaluationCalibrationClient.tsx`
  - unused `Trash2`
  - unused `CalibrationPolicySection`
- `src/server/evaluation-calibration.ts`
  - unused `humanizeCalibrationAction`
  - unused `resolveTimelineActionType`

## Detailed Remaining Work

### P1. Browser QA for the new setup flow

- Open the calibration page and verify the `정책 안내` tab now renders `CalibrationSessionSetupHub`.
- Save session setup fields and confirm refresh preserves values.
- Try `세션 시작` with incomplete setup and verify the blocking message is shown.
- Complete required fields, start the session, and verify the timeline and status reflect `CALIBRATING`.

### P1. Decide whether to clean the current lint warnings now

- The code is type-safe and tests pass, but the worktree still has five lint warnings.
- The main one is the draft reset pattern in `CalibrationSessionSetupHub`; decide whether to refactor state sync or accept it temporarily.

### P1. Review untracked artifacts before commit

- `tmp-session1.pdf` and `tmp-session2.pdf` appear to be temp files from prior work.
- Do not delete them automatically; confirm whether they should stay, move, or be removed.

### P2. Commit / snapshot after QA

- Once manual QA is complete, create a clean commit for the calibration session setup slice.
- Keep the handoff doc updated if scope changes before commit.

## Important Notes

- The project-level rule is still to use `pnpm`, even though some older runbooks still show `npm` examples.
- For this repo, workflow pages are expected to preserve auditability and Korean UI copy.
- If the next task expands calibration fairness further, the related backlog documents point to:
  - `docs/product/implementation-backlog.md`
  - `docs/product/global-benchmark-gap-analysis.md`
  - `docs/product/implementation-roadmap-world-class.md`
