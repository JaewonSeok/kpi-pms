'use client'

import { MonitorPlay } from 'lucide-react'

export function CeoDemoBanner() {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <MonitorPlay className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <div>
            <div className="font-extrabold">시연 환경</div>
            <p className="mt-1 leading-5">
              입력과 상태 전환은 시연용이며 운영 데이터에는 반영되지 않습니다. 공식 점수/등급은 산정하지 않습니다.
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-extrabold text-blue-700">
          demo=ceo
        </span>
      </div>
    </div>
  )
}
