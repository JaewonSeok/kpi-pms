const ALLOWED_TAGS = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'a', 'span', 'div'])
const SAFE_URL_PATTERN = /^(https?:\/\/|mailto:|\/|#)/i

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function sanitizeStyle(styleValue: string) {
  const allowed: string[] = []
  const rules = styleValue
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)

  for (const rule of rules) {
    const [rawKey, rawValue] = rule.split(':')
    const key = rawKey?.trim().toLowerCase()
    const value = rawValue?.trim()
    if (!key || !value) continue

    if (key === 'color' && /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(value)) {
      allowed.push(`color:${value}`)
    }

    if (key === 'font-size' && /^(1[0-9]|2[0-8])px$/i.test(value)) {
      allowed.push(`font-size:${value}`)
    }

    if ((key === 'margin-left' || key === 'text-indent') && /^(0|12|24|36|48)px$|^(0|1|2|3|4)em$/i.test(value)) {
      allowed.push(`${key}:${value}`)
    }
  }

  return allowed.join(';')
}

function sanitizeOpeningTag(tag: string, attributes: string) {
  let safeAttributes = ''

  if (tag === 'a') {
    const hrefMatch = attributes.match(/\shref=(["'])(.*?)\1/i)
    const href = hrefMatch?.[2]?.trim() ?? ''
    if (href && SAFE_URL_PATTERN.test(href) && !/^javascript:/i.test(href)) {
      safeAttributes += ` href="${href.replace(/"/g, '&quot;')}"`
      if (/^https?:\/\//i.test(href)) {
        safeAttributes += ' target="_blank" rel="noreferrer noopener"'
      }
    }
  }

  if (tag === 'span' || tag === 'p' || tag === 'div' || tag === 'li' || tag === 'ul' || tag === 'ol') {
    const styleMatch = attributes.match(/\sstyle=(["'])(.*?)\1/i)
    const style = sanitizeStyle(styleMatch?.[2] ?? '')
    if (style) {
      safeAttributes += ` style="${style}"`
    }
  }

  return `<${tag}${safeAttributes}>`
}

export function hasReviewEmailHtml(value: string) {
  return /<\/?[a-z][^>]*>/i.test(value)
}

export function plainTextToReviewEmailHtml(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return '<p><br></p>'
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function sanitizeReviewEmailHtml(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  const html = hasReviewEmailHtml(normalized) ? normalized : plainTextToReviewEmailHtml(normalized)

  let sanitized = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link)\b[^>]*\/?>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\son\w+=([^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')

  sanitized = sanitized.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawTag, rawAttributes) => {
    const tag = String(rawTag).toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) {
      return ''
    }

    if (match.startsWith('</')) {
      return `</${tag}>`
    }

    return sanitizeOpeningTag(tag, String(rawAttributes ?? ''))
  })

  return sanitized.trim() || '<p><br></p>'
}

export function reviewEmailHtmlToText(value: string) {
  const sanitized = sanitizeReviewEmailHtml(value)

  const withAnchors = sanitized.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, text: string) => {
    const cleaned = text.replace(/<[^>]+>/g, '').trim()
    return href ? `${cleaned} (${href})` : cleaned
  })

  const asText = withAnchors
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(p|div|ul|ol|strong|b|em|i|u|span)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')

  return decodeHtmlEntities(asText)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function buildReviewEmailContent(value: string) {
  const html = sanitizeReviewEmailHtml(value)
  const text = reviewEmailHtmlToText(html)

  return {
    html,
    text,
  }
}
