// 조직 점수 입력 화면에서 하위 팀을 제외하는 본부 ID 목록.
// 이 본부들은 본부 단위로만 조직 점수를 입력하며, 하위 팀 카드는
// /admin/department-score-intake 화면에서 제외한다.
// 부서 레코드 삭제가 아니라 화면 표시 범위 제한이다.
// 스키마 마이그레이션이 금지된 환경이라 DB 플래그 대신 상수로 관리한다.
export const SELF_MANAGED_DIVISION_IDS: readonly string[] = [
  'cmpev99wj000204jsz7y56jwb', // 연구개발본부
]
