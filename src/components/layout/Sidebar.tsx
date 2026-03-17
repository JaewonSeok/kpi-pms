'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  BarChart3,
  Bell,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  icon?: ReactNode
  roles?: string[]
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: '대시보드',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    label: 'KPI 관리',
    href: '/kpi',
    icon: <BarChart3 className="h-5 w-5" />,
    children: [
      { label: '조직 KPI', href: '/kpi/org' },
      { label: '개인 KPI', href: '/kpi/personal' },
      { label: '월간 실적', href: '/kpi/monthly' },
    ],
  },
  {
    label: '평가',
    href: '/evaluation',
    icon: <ClipboardCheck className="h-5 w-5" />,
    children: [
      { label: 'AI 보조 작성', href: '/evaluation/assistant', icon: <Bot className="h-4 w-4" /> },
      { label: '평가 결과', href: '/evaluation/results' },
      { label: '이의 신청', href: '/evaluation/appeal' },
      {
        label: '등급 조정',
        href: '/evaluation/ceo-adjust',
        roles: ['ROLE_CEO', 'ROLE_ADMIN'],
      },
    ],
  },
  {
    label: '체크인',
    href: '/checkin',
    icon: <CalendarClock className="h-5 w-5" />,
    children: [{ label: '체크인 일정', href: '/checkin' }],
  },
  {
    label: '보상',
    href: '/compensation',
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    children: [
      {
        label: '시뮬레이션 관리',
        href: '/compensation/manage',
        roles: ['ROLE_ADMIN', 'ROLE_DIV_HEAD', 'ROLE_CEO'],
      },
      { label: '내 보상 결과', href: '/compensation/my' },
    ],
  },
  {
    label: '알림',
    href: '/notifications',
    icon: <Bell className="h-5 w-5" />,
  },
  {
    label: '관리자',
    href: '/admin',
    icon: <Settings className="h-5 w-5" />,
    roles: ['ROLE_ADMIN'],
    children: [
      { label: '조직도 관리', href: '/admin/org-chart' },
      { label: '등급 설정', href: '/admin/grades' },
      { label: '평가 주기', href: '/admin/eval-cycle' },
      { label: 'Google 계정 등록', href: '/admin/google-access' },
      { label: '알림 운영', href: '/admin/notifications' },
      { label: '운영 / 관제', href: '/admin/ops' },
    ],
  },
]

type SidebarProps = {
  role: string
  className?: string
  onNavigate?: () => void
}

export function Sidebar({ role, className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const filteredItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-slate-200 bg-white',
        className
      )}
      style={{ width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)' }}
    >
      <div className="border-b border-slate-100 px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">PMS</p>
            <p className="text-sm font-bold text-slate-900">Performance System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {filteredItems.map((item) => (
          <NavGroup
            key={item.href}
            item={item}
            pathname={pathname}
            role={role}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
        v1.6 · Mobile + AI ready
      </div>
    </aside>
  )
}

function NavGroup({
  item,
  pathname,
  role,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  role: string
  onNavigate?: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
  const children = item.children?.filter((child) => !child.roles || child.roles.includes(role))

  if (!children?.length) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-blue-50 text-blue-700 shadow-sm'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        {item.icon}
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-2">
      <div
        className={cn(
          'flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold',
          isActive ? 'text-blue-700' : 'text-slate-700'
        )}
      >
        {item.icon}
        <span>{item.label}</span>
      </div>
      <div className="mt-1 space-y-1 pl-3">
        {children.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-2xl px-3 py-2 text-sm transition',
              pathname === child.href
                ? 'bg-white font-semibold text-blue-700 shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            )}
          >
            {child.icon}
            <span>{child.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
