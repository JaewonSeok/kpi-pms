# FAQ Draft

## Q. 기존 시스템의 사번은 그대로 유지되나요?

Yes. `emp_id` is treated as the primary reconciliation key and should remain unchanged.

## Q. 조직도 업로드 전에 무엇을 확인해야 하나요?

Check duplicate `dept_code`, invalid emails, unresolved manager codes, and missing required columns.

## Q. 파일 업로드는 바로 반영되나요?

Use preview first, review validation errors, then run the actual upload.

## Q. AI 기능이 실패하면 평가를 못 쓰나요?

No. The system shows a deterministic fallback draft and the user can keep working.

## Q. 런칭 당일 문제가 생기면 가장 먼저 어디를 보나요?

Start with `/api/health/live`, `/api/health/ready`, then open `/admin/ops`.

## Q. 알림이 발송되지 않으면 어떻게 확인하나요?

Review notification dead letters and recent job executions in the admin notifications area.

## Q. 롤백은 언제 결정하나요?

Use the rollback criteria in `data-migration-and-launch-plan.md`. P1 incidents and unresolved critical reconciliation gaps are the main triggers.

## Q. 하이퍼케어 기간은 얼마나 되나요?

Initial hypercare runs for 2 weeks after go-live with daily monitoring and issue triage.
