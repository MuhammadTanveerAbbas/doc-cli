import { describe, expect, it } from 'vitest'
import { renderBanner, renderLogo } from '../../src/ui/banner.js'
import { createStyler, shouldUseColor } from '../../src/ui/colors.js'
import { renderTable } from '../../src/ui/tables.js'

const base = { colorOption: undefined, configColor: true, theme: 'dark' as const, isTTY: true }

describe('terminal output', () => {
  it('respects NO_COLOR, dumb terminals and non tty output', () => {
    expect(shouldUseColor({ ...base, env: {} })).toBe(true)
    expect(shouldUseColor({ ...base, env: { NO_COLOR: '1' } })).toBe(false)
    expect(shouldUseColor({ ...base, env: { TERM: 'dumb' } })).toBe(false)
    expect(shouldUseColor({ ...base, env: {}, isTTY: false })).toBe(false)
    expect(shouldUseColor({ ...base, env: {}, colorOption: false })).toBe(false)
    expect(shouldUseColor({ ...base, env: {}, theme: 'mono' })).toBe(false)
  })
  it('emits no escape codes when disabled', () => {
    const s = createStyler(false)
    expect(s.error('x')).toBe('x')
    expect(createStyler(true).error('x')).toContain('\u001b[')
  })
  it('never uses purple colors', () => {
    const src = createStyler(true)
    for (const fn of [src.info, src.success, src.warn, src.error, src.muted, src.primary]) {
      expect(fn('x').includes('\u001b[35m') || fn('x').includes('\u001b[95m')).toBe(false)
    }
  })
  it('renders a banner that fits narrow and wide terminals', () => {
    const s = createStyler(false)
    const wide = renderBanner({
      version: '0.1.0',
      platformLabel: 'Linux x64',
      width: 100,
      compact: false,
      ascii: false,
      styler: s,
    })
    expect(wide.split('\n').length).toBeGreaterThan(3)
    const narrow = renderBanner({
      version: '0.1.0',
      platformLabel: 'Linux x64',
      width: 30,
      compact: false,
      ascii: false,
      styler: s,
    })
    expect(narrow.split('\n')).toHaveLength(1)
    expect(Math.max(...renderLogo(true).map((l) => l.length))).toBeLessThan(60)
  })
  it('keeps tables inside the terminal width', () => {
    const t = renderTable(['Name', 'Value'], [['a'.repeat(40), 'b'.repeat(80)]], 60)
    for (const line of t.split('\n')) expect(line.length).toBeLessThanOrEqual(60)
  })
})
