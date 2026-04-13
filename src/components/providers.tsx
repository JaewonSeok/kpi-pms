'use client'

import { SessionProvider } from 'next-auth/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { PWARegister } from '@/components/pwa/PWARegister'

export function Providers({
  children,
  pwaEnabled,
}: {
  children: ReactNode
  pwaEnabled: boolean
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            retry: 1,
          },
        },
      })
  )

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <PWARegister enabled={pwaEnabled} />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  )
}
