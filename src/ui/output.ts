import type { Styler } from './colors.js'
import { renderKeyValues, renderTable } from './tables.js'

export type StatusKind = 'ok' | 'warn' | 'fail' | 'info' | 'skip'

export interface OutputOptions {
  json: boolean
  quiet: boolean
  verbose: boolean
  styler: Styler
  width: number
  stdout?: (s: string) => void
  stderr?: (s: string) => void
}

const LABELS: Record<StatusKind, string> = {
  ok: '[OK]  ',
  warn: '[WARN]',
  fail: '[FAIL]',
  info: '[INFO]',
  skip: '[SKIP]',
}

export class Output {
  readonly json: boolean
  readonly quiet: boolean
  readonly verbose: boolean
  readonly style: Styler
  readonly width: number
  private readonly outFn: (s: string) => void
  private readonly errFn: (s: string) => void

  constructor(opts: OutputOptions) {
    this.json = opts.json
    this.quiet = opts.quiet
    this.verbose = opts.verbose
    this.style = opts.styler
    this.width = opts.width
    this.outFn = opts.stdout ?? ((s) => void process.stdout.write(s))
    this.errFn = opts.stderr ?? ((s) => void process.stderr.write(s))
  }

  get human(): boolean {
    return !this.json
  }

  line(text = ''): void {
    if (this.json || this.quiet) return
    this.outFn(text + '\n')
  }

  essential(text: string): void {
    if (this.json) return
    this.outFn(text + '\n')
  }

  heading(text: string): void {
    if (this.json || this.quiet) return
    this.outFn('\n' + this.style.bold(this.style.info(text)) + '\n')
  }

  kv(rows: Array<[string, string]>): void {
    if (this.json || this.quiet) return
    this.outFn(renderKeyValues(rows, this.width) + '\n')
  }

  table(headers: string[], rows: string[][]): void {
    if (this.json || this.quiet) return
    if (rows.length === 0) {
      this.outFn(this.style.muted('  (none)') + '\n')
      return
    }
    this.outFn(renderTable(headers, rows, this.width) + '\n')
  }

  status(kind: StatusKind, text: string): void {
    if (this.json || this.quiet) return
    const label = LABELS[kind]
    const styled =
      kind === 'ok'
        ? this.style.success(label)
        : kind === 'warn'
          ? this.style.warn(label)
          : kind === 'fail'
            ? this.style.error(label)
            : kind === 'info'
              ? this.style.info(label)
              : this.style.muted(label)
    this.outFn(`${styled} ${text}\n`)
  }

  warn(text: string): void {
    this.errFn(`${this.style.warn('[WARN]')} ${text}\n`)
  }

  error(text: string): void {
    this.errFn(`${this.style.error('[FAIL]')} ${text}\n`)
  }

  hint(text: string): void {
    this.errFn(`${this.style.muted('Hint:')} ${text}\n`)
  }

  debug(text: string): void {
    if (this.verbose) this.errFn(this.style.muted(`[debug] ${text}`) + '\n')
  }

  data(value: unknown): void {
    this.outFn(JSON.stringify(value, null, 2) + '\n')
  }

  emit<T>(value: T, render: (o: Output, v: T) => void): void {
    if (this.json) this.data(value)
    else render(this, value)
  }
}
