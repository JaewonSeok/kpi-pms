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
    label: 'KPI 관리',
    href: '/kpi',
    children: [
      { label: '조직 KPI', href: '/kpi/org', menuKey: 'ORG_KPI_UPLOAD' },
      { label: '개인 KPI', href: '/kpi/personal', menuKey: 'KPI_SETTING' },
      { label: '월간 실적', href: '/kpi/monthly', menuKey: 'MONTHLY_INPUT' },
    ],
  },
  {
    label: '평가',
    href: '/evaluation',
    children: [
      { label: 'AI 활용능력 평가', href: '/evaluation/ai-competency', menuKey: 'AI_COMPETENCY' },
      { label: 'AI 보조 작성', href: '/evaluation/workbench', menuKey: 'AI_ASSIST' },
      { label: '360 다면평가', href: '/evaluation/360', menuKey: 'FEEDBACK_360' },
      { label: '워드클라우드 다면평가', href: '/evaluation/word-cloud-360', menuKey: 'WORD_CLOUD_360' },
      { label: '평가 결과', href: '/evaluation/results', menuKey: 'EVAL_RESULT' },
      { label: '이의 요청', href: '/evaluation/appeal', menuKey: 'APPEAL' },
      { label: '등급 조정', href: '/evaluation/ceo-adjust', menuKey: 'GRADE_ADJUST' },
    ],
  },
  {
    label: '체크인',
    href: '/checkin',
    children: [{ label: '체크인 일정', href: '/checkin', menuKey: 'CHECKIN' }],
  },
  {
    label: '보상',
    href: '/compensation',
    children: [
      { label: '시뮬레이션 관리', href: '/compensation/manage', menuKey: 'COMPENSATION_MANAGE' },
      { label: '내 보상 결과', href: '/compensation/my', menuKey: 'COMPENSATION_SELF' },
    ],
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
      { label: '조직도 관리', href: '/admin/org-chart', menuKey: 'ORG_MANAGE' },
      { label: '등급 설정', href: '/admin/grades', menuKey: 'GRADE_SETTING' },
      { label: '평가 주기', href: '/admin/eval-cycle', menuKey: 'EVAL_CYCLE' },
      { label: 'Google 계정 등록', href: '/admin/google-access', menuKey: 'SYSTEM_SETTING' },
      { label: '알림 운영', href: '/admin/notifications', menuKey: 'SYSTEM_SETTING' },
      { label: '운영 / 관제', href: '/admin/ops', menuKey: 'SYSTEM_SETTING' },
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
