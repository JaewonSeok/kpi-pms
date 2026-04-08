'use client'

import { type ReactNode, useState } from 'react'
import { MasterLoginBanner } from '@/components/layout/MasterLoginBanner'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import type { SessionUserClaims } from '@/types/auth'

type MainShellProps = {
  session: {
    user: SessionUserClaims
  }
  children: ReactNode
}

export function MainShell({ session, children }: MainShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
          <TopBar session={session} onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-8">{children}</main>
        </div>
      </div>
    </div>
  )
}
