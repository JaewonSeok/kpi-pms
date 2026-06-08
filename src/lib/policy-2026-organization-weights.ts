import { OrganizationWeightsSchema, type OrganizationWeights2026 } from './validations'

// M1-C: 조직 30% 점수 내부 가중치 helper.
// EvalCycle.performanceDesignConfig.policy2026OrganizationWeights (JSON) 저장.
// 30:70 자체는 고정(personal=0.70), 조직 30%의 내부 분배만 커스텀.
//
// resolver/preview/UI는 별도(미구현). 이 helper도 호출처 0 — dormant.

export const DEFAULT_ORGANIZATION_WEIGHTS_2026: OrganizationWeights2026 = {
  withSection: { division: 0.0, section: 0.1, team: 0.2 },
  withoutSection: { division: 0.1, team: 0.2 },
  personal: 0.7,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 저장된 값을 읽어 검증. 파싱 실패/키 없음/잘못된 형태이면 DEFAULT.
// cycle 생성 시 시드 안 함 — 키 부재 = DEFAULT 의미. UI 첫 저장 시점에 row 생성.
export function resolveOrganizationWeights2026(cycleConfig: unknown): OrganizationWeights2026 {
  if (!isRecord(cycleConfig)) return DEFAULT_ORGANIZATION_WEIGHTS_2026
  const stored = cycleConfig.policy2026OrganizationWeights
  const parsed = OrganizationWeightsSchema.safeParse(stored)
  return parsed.success ? parsed.data : DEFAULT_ORGANIZATION_WEIGHTS_2026
}

// Merge writer — writePolicy2026PreviewMappingsToConfig 패턴 그대로.
// 기존 config의 다른 키(milestones, policy2026PreviewMappings 등)를 보존하면서
// policy2026OrganizationWeights만 갱신/추가.
// 반환 타입을 Record<string, unknown>로 명시 — generic merge 결과라 동적 키 접근 허용.
export function writePolicy2026OrganizationWeightsToConfig(
  currentConfig: unknown,
  weights: OrganizationWeights2026,
): Record<string, unknown> {
  const config = isRecord(currentConfig) ? { ...currentConfig } : {}
  return {
    ...config,
    policy2026OrganizationWeights: weights,
  }
}
