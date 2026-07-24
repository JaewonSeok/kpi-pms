import type { ReactNode } from 'react'

// Matches http:// or https:// URLs only.
// javascript:, data:, and all other schemes are never matched by design.
const URL_PATTERN = /https?:\/\/[^\s"<>]+/g

export function linkifyText(text: string): ReactNode[] {
  const segments: ReactNode[] = []
  let lastIndex = 0
  const regex = new RegExp(URL_PATTERN.source, URL_PATTERN.flags)
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index))
    }
    const url = match[0]
    segments.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-blue-600 underline hover:text-blue-800"
      >
        {url}
      </a>
    )
    lastIndex = match.index + url.length
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex))
  }

  return segments.length > 0 ? segments : [text]
}

export function LinkifiedText({ children }: { children: ReactNode }): ReactNode {
  if (typeof children !== 'string') return children
  return <>{linkifyText(children)}</>
}
