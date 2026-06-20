'use client'

import Link from 'next/link'

export type Feedback360PptShellTab = {
  href: string
  label: string
  active: boolean
  visible?: boolean
}

type Feedback360PptShellTabsProps = {
  tabs: Feedback360PptShellTab[]
}

export function Feedback360PptShellTabs(props: Feedback360PptShellTabsProps) {
  return (
    <nav className="flex flex-wrap gap-6 border-b border-slate-200 pt-2" role="tablist" aria-label="360 다면평가 허브 섹션">
      {props.tabs
        .filter((tab) => tab.visible !== false)
        .map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            role="tab"
            aria-selected={tab.active}
            aria-current={tab.active ? 'page' : undefined}
            className={`-mb-px inline-flex min-h-11 items-center justify-center border-b-2 px-1 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              tab.active
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-600 hover:border-blue-200 hover:text-blue-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
    </nav>
  )
}
