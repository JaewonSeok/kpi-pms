'use client'

import { useEffect, useMemo, useState } from 'react'

type SearchParamsLike =
  | {
      get(name: string): string | null
    }
  | Record<string, string | string[] | undefined | null>
  | null
  | undefined

export function getCeoDemoParam(searchParams?: SearchParamsLike) {
  if (!searchParams) return ''
  if (typeof (searchParams as { get?: unknown }).get === 'function') {
    return (searchParams as { get(name: string): string | null }).get('demo') ?? ''
  }
  const value = (searchParams as Record<string, string | string[] | undefined | null>).demo
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export function isCeoDemoMode(searchParams?: SearchParamsLike) {
  return getCeoDemoParam(searchParams) === 'ceo' || process.env.NEXT_PUBLIC_CEO_DEMO_MODE === 'true'
}

export function isDemoActionEnabled(originalDisabled: boolean, demoMode: boolean) {
  return demoMode ? false : originalDisabled
}

export function createDemoToastMessage(action: string) {
  switch (action) {
    case 'save-draft':
      return '임시 저장되었습니다.'
    case 'submit':
      return '제출되었습니다.'
    case 'save-evaluation':
      return '평가가 저장되었습니다.'
    case 'adjust-grade':
      return '등급 조정 내용이 저장되었습니다.'
    case 'prepare-reminder':
      return '리마인드 알림 준비가 완료되었습니다.'
    case 'prepare-result-share':
      return '결과 공유 준비가 완료되었습니다.'
    case 'ai-coaching':
      return 'AI 코칭이 생성되었습니다.'
    case 'next-step':
      return '결과 화면으로 이동할 수 있습니다.'
    default:
      return '시연 상태가 업데이트되었습니다.'
  }
}

export function useCeoDemoLocalState<T>(key: string, initialValue: T) {
  const storageKey = useMemo(() => `ceo-demo:${key}`, [key])
  const [value, setValue] = useState<T>(initialValue)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.sessionStorage.getItem(storageKey)
    if (!stored) return
    try {
      setValue(JSON.parse(stored) as T)
    } catch {
      setValue(initialValue)
    }
  }, [initialValue, storageKey])

  const setStoredValue = (nextValue: T | ((current: T) => T)) => {
    setValue((current) => {
      const resolved = typeof nextValue === 'function' ? (nextValue as (current: T) => T)(current) : nextValue
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(storageKey, JSON.stringify(resolved))
      }
      return resolved
    })
  }

  return [value, setStoredValue] as const
}
