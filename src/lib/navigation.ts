import { buildAdminGoogleAccessHref } from './admin-google-access-tabs'
import { canAccessMenu } from './auth/permissions'
import type { MenuKey } from '../types/auth'

export type NavigationItem = {
  label: string
  href: string
  menuKey?: MenuKey
  roles?: string[]
  children?: NavigationItem[]
}

export const NAV_ITEMS: NavigationItem[] = [
  {
    label: '대시보드',
    href: '/dashboard',
    menuKey: 'DASHBOARD',
  },
  {
    label: '통계',
    href: '/statistics',
    menuKey: 'STATISTICS',
  },
  {
    label: 'KPI/MBO',
    href: '/kpi',
    children: [
      { label: '조직 KPI', href: '/kpi/org', menuKey: 'ORG_KPI_UPLOAD' },
      { label: '내 KPI/MBO', href: '/kpi/personal', menuKey: 'KPI_SETTING' },
      {
        label: '팀원 KPI 검토',
        href: '/kpi/personal?tab=review',
        menuKey: 'KPI_SETTING',
        roles: ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIV_HEAD', 'ROLE_SECTION_CHIEF', 'ROLE_TEAM_LEADER'],
      },
      { label: '월간 실적', href: '/kpi/monthly', menuKey: 'MONTHLY_INPUT' },
    ],
  },
  {
    label: '평가',
    href: '/evaluation',
    children: [
      { label: 'HR 평가 운영 대시보드', href: '/evaluation/performance', menuKey: 'PERFORMANCE_EVALUATION' },
      { label: '평가 워크벤치 미리보기', href: '/evaluation/workbench', menuKey: 'PERFORMANCE_EVALUATION' },
      { label: 'AI 역량평가', href: '/evaluation/ai-competency', menuKey: 'AI_COMPETENCY' },
      { label: '360 다면평가', href: '/evaluation/360', menuKey: 'FEEDBACK_360' },
      { label: '상향 평가', href: '/evaluation/upward/respond', menuKey: 'FEEDBACK_360' },
      {
        label: '상향 평가 운영',
        href: '/evaluation/upward/admin',
        menuKey: 'FEEDBACK_360',
        roles: ['ROLE_ADMIN'],
      },
      {
        label: '워드클라우드 다면평가',
        href: '/evaluation/word-cloud-360',
        menuKey: 'WORD_CLOUD_360',
      },
      { label: '평가 결과', href: '/evaluation/results', menuKey: 'EVAL_RESULT' },
      { label: '이의 요청', href: '/evaluation/appeal', menuKey: 'APPEAL' },
      { label: '대표이사 확정(고급)', href: '/evaluation/ceo-adjust', menuKey: 'GRADE_ADJUST' },
    ],
  },
  {
    label: '체크인',
    href: '/checkin',
    children: [{ label: '체크인 일정', href: '/checkin', menuKey: 'CHECKIN' }],
  },
  {
    label: '알림',
    href: '/notifications',
    menuKey: 'NOTIFICATIONS',
  },
  {
    label: '관리자',
    href: '/admin',
    roles: ['ROLE_ADMIN'],
    children: [
      { label: '평가 운영 허브', href: '/admin/evaluation-ops', menuKey: 'EVAL_CYCLE' },
      { label: '평가 배정', href: '/admin/performance-assignments', menuKey: 'EVAL_CYCLE' },
      { label: '성과 관리 일정', href: '/admin/performance-calendar', menuKey: 'EVAL_CYCLE' },
      { label: '공식 전환 준비(고급)', href: '/admin/evaluation-readiness', menuKey: 'EVAL_CYCLE' },
      {
        label: '조직도 관리',
        href: buildAdminGoogleAccessHref('org-chart'),
        menuKey: 'ORG_MANAGE',
      },
      { label: '평가 주기', href: '/admin/eval-cycle', menuKey: 'EVAL_CYCLE' },
      { label: '조직 점수 입력(고급)', href: '/admin/department-score-intake', menuKey: 'DEPARTMENT_SCORE_INTAKE' },
      { label: '등급 설정(고급)', href: '/admin/grades', menuKey: 'GRADE_SETTING' },
      { label: '성과 체계(고급)', href: '/admin/performance-design', menuKey: 'EVAL_CYCLE' },
      { label: '성과 얼라인먼트(고급)', href: '/admin/goal-alignment', menuKey: 'EVAL_CYCLE' },
      { label: 'Google 계정 등록', href: '/admin/google-access', menuKey: 'SYSTEM_SETTING' },
      { label: '알림 운영', href: '/admin/notifications', menuKey: 'SYSTEM_SETTING' },
      { label: '운영 / 시스템 관리', href: '/admin/ops', menuKey: 'SYSTEM_SETTING' },
    ],
  },
]

function isAllowedByRole(item: NavigationItem, role: string) {
  if (item.roles && !item.roles.includes(role)) {
    return false
  }

  if (item.menuKey && !canAccessMenu(role, item.menuKey)) {
    return false
  }

  return true
}

export function filterNavigationItemsByRole(items: NavigationItem[], role: string): NavigationItem[] {
  return items.reduce<NavigationItem[]>((visibleItems, item) => {
    if (!isAllowedByRole(item, role)) {
      return visibleItems
    }

    if (!item.children?.length) {
      visibleItems.push(item)
      return visibleItems
    }

    const children = filterNavigationItemsByRole(item.children, role)
    if (!children.length) {
      return visibleItems
    }

    visibleItems.push({
      ...item,
      children,
    })

    return visibleItems
  }, [])
}

export function flattenNavigationItems(items: NavigationItem[]): NavigationItem[] {
  return items.flatMap((item) => (item.children?.length ? flattenNavigationItems(item.children) : [item]))
}

export function isNavigationHrefActive(
  href: string,
  pathname: string,
  currentTab?: string | null
) {
  const url = new URL(href, 'https://kpi-pms.local')
  const hrefPathname = url.pathname
  const hrefTab = url.searchParams.get('tab')
  const isLegacyOrgChartPath = pathname === '/admin/org-chart'

  if (isLegacyOrgChartPath && hrefPathname === '/admin/google-access' && hrefTab === 'org-chart') {
    return true
  }

  const pathMatches =
    pathname === hrefPathname ||
    (hrefPathname !== '/' && pathname.startsWith(`${hrefPathname}/`))

  if (!pathMatches) {
    return false
  }

  if (hrefPathname === '/admin/google-access') {
    if (hrefTab) {
      return currentTab === hrefTab
    }

    return currentTab !== 'org-chart'
  }

  if (hrefTab) {
    return currentTab === hrefTab
  }

  return true
}
