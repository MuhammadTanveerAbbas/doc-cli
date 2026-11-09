import { Chalk } from 'chalk'

export interface Styler {
  enabled: boolean
  info(s: string): string
  success(s: string): string
  warn(s: string): string
  error(s: string): string
  muted(s: string): string
  bold(s: string): string
  primary(s: string): string
}

export interface ColorDecision {
  colorOption: boolean | undefined
  configColor: boolean
  theme: 'dark' | 'light' | 'mono'
  env: NodeJS.ProcessEnv
  isTTY: boolean
}

export function shouldUseColor(d: ColorDecision): boolean {
  if (d.colorOption === false) return false
  if (!d.configColor) return false
  if (d.theme === 'mono') return false
  if (d.env['NO_COLOR'] !== undefined && d.env['NO_COLOR'] !== '') return false
  if (d.env['TERM'] === 'dumb') return false
  if (d.env['FORCE_COLOR'] && d.env['FORCE_COLOR'] !== '0') return true
  return d.isTTY
}

export function createStyler(enabled: boolean, light = false): Styler {
  const c = new Chalk({ level: enabled ? 2 : 0 })
  return {
    enabled,
    info: (s) => (light ? c.blue(s) : c.cyan(s)),
    success: (s) => c.green(s),
    warn: (s) => c.yellow(s),
    error: (s) => c.red(s),
    muted: (s) => c.gray(s),
    bold: (s) => c.bold(s),
    primary: (s) => (light ? c.black(s) : c.white(s)),
  }
}
