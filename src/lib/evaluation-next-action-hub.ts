export type EvaluationNextActionKind = 'write' | 'review' | 'result' | 'admin'
export type EvaluationNextActionTone = 'success' | 'warn' | 'error' | 'neutral'

export type EvaluationNextActionSummary = {
  label: string
  value: string
  description: string
  tone: EvaluationNextActionTone
}

export type EvaluationNextActionItem = {
  title: string
  description: string
  href: string
  badge: '이동' | '확인 필요' | '조회 가능' | '운영 화면' | '준비 중'
  kind: EvaluationNextActionKind
}

export type EvaluationNextActionHub = {
  summary: EvaluationNextActionSummary[]
  actions: EvaluationNextActionItem[]
}

const MEMBER_ACTIONS: EvaluationNextActionItem[] = [
  {
    title: 'KPI 작성',
    description: '내 KPI/MBO와 조직 목표 연결 상태를 확인합니다.',
    href: '/kpi/personal',
    badge: '확인 필요',
    kind: 'write',
  },
  {
    title: '월간 실적 입력',
    description: '이번 달 실적과 증빙 준비 상태를 확인합니다.',
    href: '/kpi/monthly',
    badge: '확인 필요',
    kind: 'write',
  },
  {
    title: '업적평가 작성',
    description: '업적평가 워크벤치로 이동해 작성 대상을 확인합니다.',
    href: '/evaluation/workbench',
    badge: '이동',
    kind: 'write',
  },
  {
    title: '360 다면평가 응답',
    description: '내가 응답해야 할 다면평가 대상을 확인합니다.',
    href: '/evaluation/360?tab=response',
    badge: '확인 필요',
    kind: 'write',
  },
  {
    title: '리더십 진단 응답',
    description: '리더십 진단 문항과 제출 요약을 확인합니다.',
    href: '/evaluation/upward/respond',
    badge: '확인 필요',
    kind: 'write',
  },
  {
    title: '360 결과 보기',
    description: '공유 가능한 360 결과 리포트로 이동합니다.',
    href: '/evaluation/360?tab=results',
    badge: '조회 가능',
    kind: 'result',
  },
  {
    title: '리더십 진단 결과 보기',
    description: '리더십 진단 결과와 코칭 참고 정보를 확인합니다.',
    href: '/evaluation/upward/results',
    badge: '조회 가능',
    kind: 'result',
  },
]

const TEAM_MANAGER_ACTIONS: EvaluationNextActionItem[] = [
  {
    title: '팀원 업적평가',
    description: '팀원 평가와 검토 대상을 워크벤치에서 확인합니다.',
    href: '/evaluation/workbench?view=leader',
    badge: '확인 필요',
    kind: 'review',
  },
  {
    title: '가감점 검토',
    description: '팀원 평가 맥락에서 조정 필요 항목을 확인합니다.',
    href: '/evaluation/workbench?view=leader',
    badge: '이동',
    kind: 'review',
  },
  {
    title: '팀원 피드백',
    description: '체크인과 후속 피드백 흐름으로 이동합니다.',
    href: '/checkin',
    badge: '이동',
    kind: 'review',
  },
]

const HQ_MANAGER_ACTIONS: EvaluationNextActionItem[] = [
  {
    title: '본부 평가 조회',
    description: '본부 범위 평가 결과와 검토 흐름을 확인합니다.',
    href: '/evaluation/results',
    badge: '조회 가능',
    kind: 'result',
  },
  {
    title: '등급 검토',
    description: '평가 워크벤치의 본부 검토 화면으로 이동합니다.',
    href: '/evaluation/workbench?view=executive',
    badge: '이동',
    kind: 'review',
  },
  {
    title: '360 결과 조회',
    description: '다면평가 결과 리포트로 이동합니다.',
    href: '/evaluation/360?tab=results',
    badge: '조회 가능',
    kind: 'result',
  },
  {
    title: '리더십 진단 결과 조회',
    description: '리더십 진단 결과 화면으로 이동합니다.',
    href: '/evaluation/upward/results',
    badge: '조회 가능',
    kind: 'result',
  },
]

const HR_ADMIN_ACTIONS: EvaluationNextActionItem[] = [
  {
    title: '전체 평가 운영',
    description: '평가 운영 허브에서 운영 화면들을 확인합니다.',
    href: '/admin/evaluation-ops',
    badge: '운영 화면',
    kind: 'admin',
  },
  {
    title: '기간 설정',
    description: '성과 관리 일정과 평가 주기 화면으로 이동합니다.',
    href: '/admin/performance-calendar',
    badge: '운영 화면',
    kind: 'admin',
  },
  {
    title: '대상자·평가자 매칭 관리',
    description: '360 평가자 매핑 화면으로 이동합니다.',
    href: '/evaluation/360?tab=mapping',
    badge: '운영 화면',
    kind: 'admin',
  },
  {
    title: '리더십 진단 운영',
    description: '리더십 진단 운영 대시보드로 이동합니다.',
    href: '/evaluation/upward/admin',
    badge: '운영 화면',
    kind: 'admin',
  },
  {
    title: '조직·권한 관리',
    description: '조직도와 계정 권한 관리 화면으로 이동합니다.',
    href: '/admin/google-access?tab=org-chart',
    badge: '운영 화면',
    kind: 'admin',
  },
]

const ROLE_LEVEL: Record<string, number> = {
  ROLE_MEMBER: 0,
  ROLE_TEAM_LEADER: 1,
  ROLE_SECTION_CHIEF: 2,
  ROLE_DIV_HEAD: 2,
  ROLE_CEO: 2,
  ROLE_ADMIN: 3,
}

function uniqueActions(actions: EvaluationNextActionItem[]) {
  const seen = new Set<string>()
  return actions.filter((action) => {
    const key = `${action.title}:${action.href}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildEvaluationNextActionHub(role: string): EvaluationNextActionHub {
  const level = ROLE_LEVEL[role] ?? ROLE_LEVEL.ROLE_MEMBER
  const actions = uniqueActions([
    ...MEMBER_ACTIONS,
    ...(level >= ROLE_LEVEL.ROLE_TEAM_LEADER ? TEAM_MANAGER_ACTIONS : []),
    ...(level >= ROLE_LEVEL.ROLE_SECTION_CHIEF ? HQ_MANAGER_ACTIONS : []),
    ...(level >= ROLE_LEVEL.ROLE_ADMIN ? HR_ADMIN_ACTIONS : []),
  ])

  const countByKind = (kind: EvaluationNextActionKind) => actions.filter((action) => action.kind === kind).length

  return {
    summary: [
      {
        label: '내가 작성할 항목',
        value: String(countByKind('write')),
        description: '입력과 응답 화면',
        tone: countByKind('write') > 0 ? 'warn' : 'neutral',
      },
      {
        label: '검토할 항목',
        value: String(countByKind('review')),
        description: '팀·본부 검토 화면',
        tone: countByKind('review') > 0 ? 'warn' : 'neutral',
      },
      {
        label: '조회 가능한 결과',
        value: String(countByKind('result')),
        description: '결과 리포트 화면',
        tone: countByKind('result') > 0 ? 'success' : 'neutral',
      },
      {
        label: '관리자 운영 항목',
        value: String(countByKind('admin')),
        description: '운영 전용 화면',
        tone: countByKind('admin') > 0 ? 'warn' : 'neutral',
      },
    ],
    actions,
  }
}
