import { Suspense } from 'react'
import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  const breakglassEnabled = process.env.ADMIN_BREAKGLASS_ENABLED === 'true'

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-medium text-white shadow-2xl backdrop-blur">
            로딩 중...
          </div>
        </div>
      }
    >
      <LoginPageClient breakglassEnabled={breakglassEnabled} />
    </Suspense>
  )
}
