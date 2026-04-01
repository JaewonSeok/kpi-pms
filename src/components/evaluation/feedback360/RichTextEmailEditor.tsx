'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bold, Link2, List, Redo2, Undo2 } from 'lucide-react'
import { buildReviewEmailContent, reviewEmailHtmlToText } from '@/lib/review-email-editor'

const FONT_SIZE_OPTIONS = [
  { label: '작게', value: '12px' },
  { label: '기본', value: '14px' },
  { label: '크게', value: '16px' },
  { label: '제목', value: '18px' },
] as const

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

type RichTextEmailEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export function RichTextEmailEditor(props: RichTextEmailEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [linkValue, setLinkValue] = useState('')
  const [isLinkOpen, setIsLinkOpen] = useState(false)
  const [activeFontSize, setActiveFontSize] = useState('14px')
  const [activeColor, setActiveColor] = useState('#0f172a')

  const normalizedValue = useMemo(() => buildReviewEmailContent(props.value).html, [props.value])
  const isEmpty = useMemo(() => !buildReviewEmailContent(normalizedValue).text.trim(), [normalizedValue])

  useEffect(() => {
    if (!editorRef.current) return
    if (editorRef.current.innerHTML === normalizedValue) return
    editorRef.current.innerHTML = normalizedValue
  }, [normalizedValue])

  function syncEditor() {
    if (!editorRef.current) return
    const next = buildReviewEmailContent(editorRef.current.innerHTML)
    if (editorRef.current.innerHTML !== next.html) {
      editorRef.current.innerHTML = next.html
    }
    props.onChange(next.html)
  }

  function focusEditor() {
    editorRef.current?.focus()
  }

  function runCommand(command: string, value?: string) {
    if (props.disabled) return
    focusEditor()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(command, false, value)
    syncEditor()
  }

  function wrapSelection(styleText: string, tagName = 'span', href?: string) {
    if (props.disabled) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    const content = range.extractContents()
    const element = document.createElement(tagName)
    if (styleText) {
      element.setAttribute('style', styleText)
    }
    if (tagName === 'a' && href) {
      element.setAttribute('href', href)
      if (/^https?:\/\//i.test(href)) {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noreferrer noopener')
      }
    }
    element.appendChild(content)
    range.insertNode(element)
    selection.removeAllRanges()
    const nextRange = document.createRange()
    nextRange.selectNodeContents(element)
    selection.addRange(nextRange)
    syncEditor()
  }

  function adjustIndent(delta: number) {
    if (props.disabled || !editorRef.current) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    let node: Node | null = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (
        node instanceof HTMLElement &&
        ['P', 'DIV', 'LI'].includes(node.tagName)
      ) {
        const current = Number.parseInt(node.style.marginLeft || '0', 10)
        const next = Math.max(0, current + delta)
        node.style.marginLeft = next > 0 ? `${next}px` : ''
        syncEditor()
        return
      }
      node = node.parentNode
    }
  }

  function applyLink() {
    const trimmed = linkValue.trim()
    if (!trimmed) return
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) return
    wrapSelection('', 'a', trimmed)
    setLinkValue('')
    setIsLinkOpen(false)
  }

  return (
    <div className="rounded-2xl border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-3">
        <ToolbarButton label="굵게" onClick={() => runCommand('bold')} disabled={props.disabled}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="목록" onClick={() => runCommand('insertUnorderedList')} disabled={props.disabled}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="되돌리기" onClick={() => runCommand('undo')} disabled={props.disabled}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="다시 실행" onClick={() => runCommand('redo')} disabled={props.disabled}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="들여쓰기" onClick={() => adjustIndent(24)} disabled={props.disabled}>
          들여쓰기
        </ToolbarButton>
        <ToolbarButton label="내어쓰기" onClick={() => adjustIndent(-24)} disabled={props.disabled}>
          내어쓰기
        </ToolbarButton>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600">
          글자 크기
          <select
            value={activeFontSize}
            onChange={(event) => {
              const next = event.target.value
              setActiveFontSize(next)
              wrapSelection(`font-size:${next}`)
            }}
            disabled={props.disabled}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600">
          글자 색상
          <input
            type="color"
            value={activeColor}
            onChange={(event) => {
              const next = event.target.value
              setActiveColor(next)
              wrapSelection(`color:${next}`)
            }}
            disabled={props.disabled}
            className="h-8 w-8 rounded border border-slate-200 bg-white p-1"
          />
        </label>
        <ToolbarButton
          label="링크"
          onClick={() => setIsLinkOpen((current) => !current)}
          disabled={props.disabled}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {isLinkOpen ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 md:flex-row md:items-center">
          <input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            placeholder="https:// 또는 /internal/path"
            className="min-h-10 flex-1 rounded-xl border border-slate-300 px-3 text-sm text-slate-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyLink}
              disabled={props.disabled || !linkValue.trim()}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              링크 삽입
            </button>
            <button
              type="button"
              onClick={() => {
                setLinkValue('')
                setIsLinkOpen(false)
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        {isEmpty && props.placeholder ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 text-sm text-slate-400">
            {props.placeholder}
          </div>
        ) : null}
        <div
          ref={editorRef}
          contentEditable={!props.disabled}
          suppressContentEditableWarning
          onInput={syncEditor}
          onBlur={syncEditor}
          className="min-h-40 w-full rounded-b-2xl px-4 py-4 text-sm leading-6 text-slate-900 outline-none [&_a]:text-blue-600 [&_a]:underline [&_li]:ml-5 [&_p]:mb-3 [&_ul]:list-disc"
        />
      </div>
    </div>
  )
}

function ToolbarButton(props: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      title={props.label}
    >
      {props.children}
    </button>
  )
}

export function buildReviewEmailEditorPlainText(value: string) {
  return reviewEmailHtmlToText(value)
}

export function buildReviewEmailEditorPreview(value: string) {
  return escapeHtml(reviewEmailHtmlToText(value)).replace(/\n/g, '<br>')
}
