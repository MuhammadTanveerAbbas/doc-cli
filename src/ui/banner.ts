import type { Styler } from './colors.js'

const GLYPHS: Record<string, string[]> = {
  D: [' ___  ', '|   \\ ', '| |) |', '|___/ '],
  O: ['  ___  ', ' / _ \\ ', '| (_) |', ' \\___/ '],
  C: ['  ___ ', ' / __|', '| (__ ', ' \\___|'],
  L: [' _    ', '| |   ', '| |__ ', '|____|'],
  I: [' ___ ', '|_ _|', ' | | ', '|___|'],
  ' ': ['   ', '   ', '   ', '   '],
}

const BLOCK_GLYPHS: Record<string, string[]> = {
  D: ['DDDD ', 'D   D', 'D   D', 'DDDD '],
  O: [' OOO ', 'O   O', 'O   O', ' OOO '],
  C: [' CCC ', 'C    ', 'C    ', ' CCC '],
  L: ['L    ', 'L    ', 'L    ', 'LLLLL'],
  I: ['III', ' I ', ' I ', 'III'],
  ' ': ['   ', '   ', '   ', '   '],
}

export interface BannerInput {
  version: string
  platformLabel: string
  width: number
  compact: boolean
  ascii: boolean
  updateNote?: string | undefined
  styler: Styler
}

export function renderLogo(ascii: boolean): string[] {
  const glyphs = ascii ? BLOCK_GLYPHS : GLYPHS
  const rows = ['', '', '', '']
  for (const ch of 'DOC CLI') {
    const g = glyphs[ch] ?? glyphs[' ']!
    for (let i = 0; i < 4; i++) rows[i] += g[i] ?? ''
  }
  return rows.map((r) => r.trimEnd())
}

export function renderBanner(b: BannerInput): string {
  const s = b.styler
  const meta = `v${b.version}  ${b.platformLabel}`
  if (b.compact || b.width < 50) {
    const lines = [`${s.bold(s.info('DOC CLI'))} ${s.muted(meta)}`]
    if (b.updateNote) lines.push(s.warn(b.updateNote))
    return lines.join('\n')
  }
  const logo = renderLogo(b.ascii).map((l) => s.info(l))
  const lines = [...logo, s.muted(meta)]
  if (b.updateNote) lines.push(s.warn(b.updateNote))
  return lines.join('\n')
}
