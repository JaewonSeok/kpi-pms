export type AdminJobTitleLeaderTier = 'TEAM_LEADER' | 'SECTION_CHIEF' | 'DIV_HEAD'

// ROLE_ADMIN 은 권한 플래그라 평가 역할 정보가 없다. jobTitle 로만 분류한다.
// role 이 평가 역할을 담으면 그것이 권위다. 이 함수는 ADMIN 의 jobTitle 만 본다.
export function resolveAdminJobTitleLeaderTier(
  jobTitle: string | null | undefined
): AdminJobTitleLeaderTier | null {
  if (jobTitle === '팀장') return 'TEAM_LEADER'
  if (jobTitle === '실장' || jobTitle === '부문장') return 'SECTION_CHIEF'
  if (jobTitle === '본부장' || jobTitle === '대표이사') return 'DIV_HEAD'
  return null
}
