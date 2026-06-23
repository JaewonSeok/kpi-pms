'use client'

import { CheckCircle2, X } from 'lucide-react'

export function CeoDemoToast(props: { message: string; onClose?: () => void }) {
  if (!props.message) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-slate-800 shadow-xl">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="font-extrabold text-slate-950">{props.message}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">시연 환경에서는 운영 데이터에 반영되지 않습니다.</p>
        </div>
        {props.onClose ? (
          <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={props.onClose}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
