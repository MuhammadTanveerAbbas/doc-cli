import crypto from 'node:crypto'
import fs from 'node:fs'
import { writeFileAtomic } from '../core/config.js'
import { DocError, ExitCode } from '../core/errors.js'
import { redactArgs, redactText } from '../utils/redact.js'

export interface HistoryRecord {
  id: string
  timestamp: string
  timezoneOffsetMinutes: number
  command: string
  argv: string[]
  argvRedacted: boolean
  module: string
  operation: string
  os: string
  arch: string
  docCliVersion: string
  durationMs: number
  exitCode: number
  previewed: boolean
  confirmed: boolean
  summary: string[]
  error?: string
  logRef?: string
}

export interface AuditRecord {
  id: string
  timestamp: string
  operation: string
  title: string
  steps: string[]
  risk: string
  result: 'success' | 'failure' | 'declined' | 'preview'
  detail?: string
}

interface HistoryFile {
  version: 1
  records: HistoryRecord[]
}

export interface HistoryOptions {
  enabled: boolean
  retentionDays: number
}

export interface BeginInput {
  argv: string[]
  module: string
  operation: string
  os: string
  arch: string
  docCliVersion: string
}

export interface OpState {
  previewed: boolean
  confirmed: boolean
  summary: string[]
}

export function newOpState(): OpState {
  return { previewed: false, confirmed: false, summary: [] }
}

export class HistoryService {
  constructor(
    private readonly historyFile: string,
    private readonly auditFile: string,
    private readonly options: () => HistoryOptions,
  ) {}

  private read(): HistoryFile {
    if (!fs.existsSync(this.historyFile)) return { version: 1, records: [] }
    try {
      const raw = JSON.parse(fs.readFileSync(this.historyFile, 'utf8')) as HistoryFile
      if (raw.version !== 1 || !Array.isArray(raw.records)) throw new Error('bad schema')
      return raw
    } catch {
      const backup = `${this.historyFile}.corrupt.${Date.now()}`
      try {
        fs.renameSync(this.historyFile, backup)
      } catch {
        // ignore
      }
      return { version: 1, records: [] }
    }
  }

  private write(file: HistoryFile): void {
    writeFileAtomic(this.historyFile, JSON.stringify(file, null, 2) + '\n')
  }

  prune(now = Date.now()): number {
    const { retentionDays } = this.options()
    const file = this.read()
    const cutoff = now - retentionDays * 86_400_000
    const kept = file.records.filter((r) => Date.parse(r.timestamp) >= cutoff)
    const removed = file.records.length - kept.length
    if (removed > 0) this.write({ version: 1, records: kept })
    return removed
  }

  record(
    input: BeginInput,
    state: OpState,
    exitCode: number,
    durationMs: number,
    error?: string,
  ): HistoryRecord | null {
    if (!this.options().enabled) return null
    const [command = '', ...rest] = input.argv
    const red = redactArgs(input.argv)
    const record: HistoryRecord = {
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      command: command === '' ? '(interactive)' : redactText(command),
      argv: red.args,
      argvRedacted: red.redacted,
      module: input.module,
      operation: input.operation,
      os: input.os,
      arch: input.arch,
      docCliVersion: input.docCliVersion,
      durationMs,
      exitCode,
      previewed: state.previewed,
      confirmed: state.confirmed,
      summary: state.summary.map(redactText),
    }
    void rest
    if (error) record.error = redactText(error).slice(0, 500)
    const file = this.read()
    file.records.push(record)
    this.write(file)
    return record
  }

  list(limit = 50): HistoryRecord[] {
    return this.read().records.slice(-limit).reverse()
  }

  all(): HistoryRecord[] {
    return this.read().records
  }

  search(query: string, limit = 50): HistoryRecord[] {
    const q = query.toLowerCase()
    return this.read()
      .records.filter(
        (r) =>
          r.argv.join(' ').toLowerCase().includes(q) ||
          r.module.includes(q) ||
          r.operation.includes(q),
      )
      .slice(-limit)
      .reverse()
  }

  get(id: string): HistoryRecord {
    const rec = this.read().records.find((r) => r.id === id || r.id.startsWith(id))
    if (!rec) throw new DocError(`No history record with id ${id}`, ExitCode.Usage)
    return rec
  }

  exportTo(file: string): number {
    const records = this.read().records
    writeFileAtomic(
      file,
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2) + '\n',
      0o600,
    )
    return records.length
  }

  clear(): number {
    const n = this.read().records.length
    this.write({ version: 1, records: [] })
    return n
  }

  audit(entry: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    const rec: AuditRecord = {
      id: crypto.randomUUID().slice(0, 8),
      timestamp: new Date().toISOString(),
      ...entry,
      steps: entry.steps.map(redactText),
    }
    fs.mkdirSync(this.auditFile.replace(/[\\/][^\\/]*$/, ''), { recursive: true })
    fs.appendFileSync(this.auditFile, JSON.stringify(rec) + '\n', { mode: 0o600 })
  }

  readAudit(limit = 50): AuditRecord[] {
    if (!fs.existsSync(this.auditFile)) return []
    const lines = fs.readFileSync(this.auditFile, 'utf8').split('\n').filter(Boolean)
    const out: AuditRecord[] = []
    for (const line of lines.slice(-limit)) {
      try {
        out.push(JSON.parse(line) as AuditRecord)
      } catch {
        continue
      }
    }
    return out.reverse()
  }
}
