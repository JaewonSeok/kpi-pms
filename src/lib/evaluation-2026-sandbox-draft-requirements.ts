export const EVALUATION_2026_SANDBOX_DRAFT_MODE = 'SANDBOX_2026_WORKBENCH_PILOT'

export const evaluation2026SandboxDraftPersistenceDecision = {
  status: 'SCHEMA_REQUIRED',
  implemented: false,
  safeWithoutMigration: false,
  uiMessage: 'Sandbox draft 저장은 아직 지원하지 않습니다. 전용 스키마 설계가 필요합니다.',
  safetyCopy:
    'Sandbox draft는 공식 평가가 아니며 totalScore, gradeId, 공식 Evaluation/EvaluationItem을 변경하지 않습니다.',
  currentPersistenceModel: [
    'Evaluation.isDraft는 공식 평가 초안 상태로 이미 사용됩니다.',
    'Evaluation에는 sandbox 또는 official=false를 보장하는 전용 플래그가 없습니다.',
    'Evaluation unique key는 evalCycleId + targetId + evalStage라 sandbox row가 공식 row와 충돌할 수 있습니다.',
    'EvaluationItem에는 sandbox 구분자, owner, expiration, reset scope가 없습니다.',
    'EvalCycle.performanceDesignConfig는 주기 설정 metadata이며 사용자별 workbench draft 저장소가 아닙니다.',
    'AuditLog는 감사 기록용이며 reset 가능한 현재 draft 저장소로 사용하기에는 조회/소유권/만료 경계가 부족합니다.',
  ],
  officialWriteApisToAvoid: [
    'POST /api/evaluation',
    'PATCH /api/evaluation/[id]',
    'PATCH /api/evaluation/[id]/submit',
    'PATCH /api/evaluation/[id]/review',
  ],
  requiredSchema: [
    'EvaluationSandboxSession: id, ownerId, evalCycleId, targetId, status, mode, official=false, payload, expiresAt, createdById, updatedById, createdAt, updatedAt',
    'EvaluationSandboxItem: id, sandboxSessionId, personalKpiId, stagePayload, scorePreviewPayload, warningPayload, createdAt, updatedAt',
    'Audit fields: createdById, updatedById, resetById, resetAt, sourceRoute, userAgent, ipAddress',
    'Constraints: unique active sandbox per owner/cycle/target/mode; no relation that makes it appear in official Evaluation queries',
    'Lifecycle: explicit reset/delete for sandbox only, expiration cleanup, admin/HR authorization guard',
  ],
  prohibitedUntilSchemaExists: [
    'sandbox Evaluation row creation',
    'sandbox EvaluationItem row creation',
    'totalScore persistence',
    'gradeId persistence',
    'official submit/finalize transition',
    'notification/email dispatch',
  ],
} as const
