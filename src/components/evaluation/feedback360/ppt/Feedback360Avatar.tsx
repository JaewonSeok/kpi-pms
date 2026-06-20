'use client'

import { useState } from 'react'

export type Feedback360AvatarPerson = {
  name?: string | null
  profileImageUrl?: string | null
  avatarUrl?: string | null
  image?: string | null
  picture?: string | null
}

type Feedback360AvatarProps = {
  person?: Feedback360AvatarPerson | null
  name?: string | null
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_CLASS_NAMES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
} as const

function getAvatarInitials(name?: string | null) {
  const normalized = String(name ?? '').trim()
  if (!normalized) return '?'

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
  return Array.from(normalized).slice(0, 2).join('').toUpperCase()
}

export function resolveFeedback360AvatarUrl(person?: Feedback360AvatarPerson | null, src?: string | null) {
  return (
    src ||
    person?.profileImageUrl ||
    person?.avatarUrl ||
    person?.image ||
    person?.picture ||
    null
  )
}

export function Feedback360Avatar(props: Feedback360AvatarProps) {
  const [failed, setFailed] = useState(false)
  const name = props.name ?? props.person?.name ?? '구성원'
  const src = resolveFeedback360AvatarUrl(props.person, props.src)
  const size = props.size ?? 'md'
  const sizeClassName = SIZE_CLASS_NAMES[size]
  const baseClassName = `${sizeClassName} shrink-0 overflow-hidden rounded-full border border-white bg-gradient-to-br from-blue-100 to-slate-200 shadow-sm ring-1 ring-slate-200 ${props.className ?? ''}`

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} 프로필`}
        className={`${baseClassName} object-cover`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <span
      aria-label={`${name} 프로필`}
      className={`${baseClassName} inline-flex items-center justify-center font-bold text-blue-800`}
    >
      {getAvatarInitials(name)}
    </span>
  )
}
