'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
import {
  filterNavigationItemsByRole,
  isNavigationHrefActive,
  NAV_ITEMS,
  type NavigationItem,
} from '@/lib/navigation'
import { cn } from '@/lib/utils'

type SidebarProps = {
  role: string
  className?: string
  onNavigate?: () => void
}

export function Sidebar({ role, className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filteredItems = filterNavigationItemsByRole(NAV_ITEMS, role)
  const currentTab = searchParams.get('tab')

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
            currentTab={currentTab}
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
  currentTab,
  onNavigate,
}: {
  item: NavigationItem
  pathname: string
  currentTab?: string | null
  onNavigate?: () => void
}) {
  const children = item.children
  const isActive = children?.length
    ? children.some((child) => isNavigationHrefActive(child.href, pathname, currentTab))
    : isNavigationHrefActive(item.href, pathname, currentTab)

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
        {getNavIcon(item.href)}
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
        {getNavIcon(item.href)}
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
              isNavigationHrefActive(child.href, pathname, currentTab)
                ? 'bg-white font-semibold text-blue-700 shadow-sm'
                : 'text-slate-500 hover:bg-white hover:text-slate-900'
            )}
          >
            {getNavIcon(child.href)}
            <span>{child.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function getNavIcon(href: string): ReactNode {
  const iconClassName = href === '/evaluation/workbench' ? 'h-4 w-4' : 'h-5 w-5'

  const icons: Record<string, ReactNode> = {
    '/dashboard': <LayoutDashboard className={iconClassName} />,
    '/kpi': <BarChart3 className={iconClassName} />,
    '/evaluation': <ClipboardCheck className={iconClassName} />,
    '/evaluation/workbench': <Bot className={iconClassName} />,
    '/checkin': <CalendarClock className={iconClassName} />,
    '/compensation': <BriefcaseBusiness className={iconClassName} />,
    '/notifications': <Bell className={iconClassName} />,
    '/admin': <Settings className={iconClassName} />,
  }

  return icons[href] ?? null
}
