'use client'

import { type ReactNode, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MasterLoginBanner } from '@/components/layout/MasterLoginBanner'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'

type MainShellUser = {
  name?: string | null
  email?: string | null
  image?: string | null
  role: string
  empId: string
  deptName: string
  masterLogin?: {
    active: boolean
    sessionId: string
    actorId: string
    actorName: string
    actorEmail: string
    targetId: string
    startedAt: string
    expiresAt: string
    reason: string
    targetName: string
    targetEmail: string
  } | null
}

type MainShellProps = {
  session: {
    user: MainShellUser
  }
  children: ReactNode
}

export function MainShell({ session, children }: MainShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const pathname = usePathname()
  const usePageNativeHeader = pathname?.startsWith('/evaluation/upward') ?? false
  const useWideEvaluationCanvas =
    pathname?.startsWith('/evaluation/360') || pathname?.startsWith('/evaluation/upward')
  const mainClassName = useWideEvaluationCanvas
    ? 'flex-1 px-2 pb-24 pt-3 sm:px-4 lg:px-5 lg:pb-8'
    : 'flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <MasterLoginBanner session={session} />

      <div className="flex min-h-screen bg-[var(--background)]">
        <div className="hidden lg:block">
          <Sidebar role={session.user.role} />
        </div>

        {mobileSidebarOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="사이드바 닫기"
            />
            <div className="absolute inset-y-0 left-0">
              <Sidebar role={session.user.role} onNavigate={() => setMobileSidebarOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {usePageNativeHeader ? (
            <div className="lg:hidden">
              <TopBar session={session} onMenuClick={() => setMobileSidebarOpen(true)} />
            </div>
          ) : (
            <TopBar session={session} onMenuClick={() => setMobileSidebarOpen(true)} />
          )}
          <main className={mainClassName}>{children}</main>
        </div>
      </div>
    </div>
  )
}
