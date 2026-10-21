// 평가항목의 정책 카테고리를 읽는 규칙은 여기 하나다: 항목 값이 비어 있으면 개인 KPI 값을 쓴다.
// 쓰는 쪽(HR 수동 매핑 · 생성 경로)은 항목 값을 채우지 않을 수 있어, 읽는 곳이 모두 이 함수를 거친다.
export function resolveItemPolicyCategory<T extends string>(item: {
  policyCategory?: T | null
  personalKpi?: { policyCategory?: T | null } | null
}): T | null {
  return item.policyCategory ?? item.personalKpi?.policyCategory ?? null
}
