'use client'

import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { ROLE_LABELS } from '@/lib/utils'

type TopBarProps = {
  session: {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      empId: string
      deptName: string
    }
  }
  onMenuClick?: () => void
}

export function TopBar({ session, onMenuClick }: TopBarProps) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?unreadOnly=true&pageSize=5')
      const json = await res.json()
      return json.data
    },
    refetchInterval: 30000,
  })

  const unreadCount = notifData?.unreadCount || 0

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
            aria-label="메뉴 열기"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Performance
            </p>
            <p className="text-sm font-semibold text-slate-900 sm:text-base">KPI & Evaluation Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/notifications"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </Link>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProfileMenu((current) => !current)}
              className="flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2 text-left transition hover:bg-slate-50"
            >
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User profile'}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {session.user.name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-slate-900">{session.user.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {ROLE_LABELS[session.user.role]} · {session.user.deptName}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {showProfileMenu ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setShowProfileMenu(false)}
                  aria-label="프로필 메뉴 닫기"
                />
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{session.user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{session.user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
                  >
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
