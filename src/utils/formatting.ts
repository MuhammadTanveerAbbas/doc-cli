export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  return `${m} min ${Math.round(s % 60)} s`
}

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d) parts.push(`${d}d`)
  if (h || d) parts.push(`${h}h`)
  parts.push(`${m}m`)
  return parts.join(' ')
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  if (max <= 3) return text.slice(0, max)
  return text.slice(0, max - 3) + '...'
}

export function tokenize(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: string | null = null
  let has = false
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      has = true
      continue
    }
    if (/\s/.test(ch)) {
      if (has || cur) out.push(cur)
      cur = ''
      has = false
      continue
    }
    cur += ch
  }
  if (has || cur) out.push(cur)
  return out
}
