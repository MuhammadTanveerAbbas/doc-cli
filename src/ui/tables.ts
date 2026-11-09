import { truncate } from '../utils/formatting.js'

export function terminalWidth(stream: { columns?: number } = process.stdout): number {
  const w = stream.columns
  return typeof w === 'number' && w > 20 ? w : 80
}

export function renderTable(headers: string[], rows: string[][], width: number): string {
  const cols = headers.length
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length), 1),
  )
  const gap = 2
  const total = widths.reduce((a, b) => a + b, 0) + gap * (cols - 1)
  if (total > width) {
    let excess = total - width
    while (excess > 0) {
      let idx = 0
      for (let i = 1; i < cols; i++) if ((widths[i] ?? 0) > (widths[idx] ?? 0)) idx = i
      if ((widths[idx] ?? 0) <= 6) break
      widths[idx] = (widths[idx] ?? 0) - 1
      excess--
    }
  }
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => {
        const w = widths[i] ?? 0
        const t = truncate(c ?? '', w)
        return i === cols - 1 ? t : t.padEnd(w)
      })
      .join(' '.repeat(gap))
      .trimEnd()
  const lines = [
    fmt(headers),
    widths.map((w) => '='.repeat(w)).join(' '.repeat(gap)),
    ...rows.map(fmt),
  ]
  return lines.join('\n')
}

export function renderKeyValues(rows: Array<[string, string]>, width: number): string {
  const keyWidth = Math.min(Math.max(...rows.map(([k]) => k.length), 1), Math.floor(width / 2))
  return rows.map(([k, v]) => `  ${truncate(k, keyWidth).padEnd(keyWidth)}  ${v}`).join('\n')
}
