import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { DocError, ExitCode } from './errors.js'

export const ConfigSchema = z.object({
  ui: z
    .object({
      theme: z.enum(['dark', 'light', 'mono']).default('dark'),
      color: z.boolean().default(true),
      animations: z.boolean().default(true),
      compact: z.boolean().default(false),
      ascii: z.boolean().default(false),
    })
    .prefault({}),
  updates: z
    .object({
      checkOnStartup: z.boolean().default(true),
      autoInstall: z.boolean().default(false),
      channel: z.enum(['stable', 'beta', 'nightly']).default('stable'),
      repository: z.string().default(''),
      checkIntervalHours: z.number().int().min(1).max(720).default(24),
    })
    .prefault({}),
  history: z
    .object({
      enabled: z.boolean().default(true),
      retentionDays: z.number().int().min(1).max(3650).default(90),
    })
    .prefault({}),
  performance: z
    .object({
      automaticCleanup: z.literal(false).default(false),
      scanLargeFiles: z.boolean().default(false),
    })
    .prefault({}),
  ai: z
    .object({
      enabled: z.boolean().default(false),
      provider: z.enum(['openai', 'anthropic', 'gemini', 'ollama']).nullable().default(null),
      model: z.string().nullable().default(null),
      apiKeyEnv: z.string().nullable().default(null),
      endpoint: z.string().nullable().default(null),
    })
    .prefault({}),
  security: z
    .object({
      confirmInstalls: z.boolean().default(true),
      confirmRemovals: z.boolean().default(true),
      confirmCleanup: z.boolean().default(true),
    })
    .prefault({}),
})

export type Config = z.infer<typeof ConfigSchema>

export function defaultConfig(): Config {
  return ConfigSchema.parse({})
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')
}

export function parseConfig(raw: unknown): Config {
  const result = ConfigSchema.safeParse(raw)
  if (!result.success) {
    throw new DocError(
      `Invalid configuration:\n${formatZodIssues(result.error)}`,
      ExitCode.Environment,
      'Fix the value with "doc-cli config set <key> <value>" or run "doc-cli config reset".',
    )
  }
  return result.data
}

export function getByPath(obj: unknown, key: string): unknown {
  let cur: unknown = obj
  for (const part of key.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in (cur as Record<string, unknown>))) {
      throw new DocError(`Unknown configuration key: ${key}`, ExitCode.Usage)
    }
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function coerce(value: string): unknown {
  if (value === 'null') return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export function setByPath(obj: Config, key: string, value: string): Config {
  const clone = structuredClone(obj) as Record<string, unknown>
  const parts = key.split('.')
  const last = parts.pop()
  if (!last) throw new DocError('Configuration key is empty', ExitCode.Usage)
  let cur: Record<string, unknown> = clone
  for (const part of parts) {
    const next = cur[part]
    if (next === null || typeof next !== 'object') {
      throw new DocError(`Unknown configuration key: ${key}`, ExitCode.Usage)
    }
    cur = next as Record<string, unknown>
  }
  if (!(last in cur)) throw new DocError(`Unknown configuration key: ${key}`, ExitCode.Usage)
  cur[last] = coerce(value)
  return parseConfig(clone)
}

export function writeFileAtomic(file: string, content: string, mode = 0o600): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, content, { mode })
  fs.renameSync(tmp, file)
}

export class ConfigService {
  private cached: Config | null = null

  constructor(private readonly file: string) {}

  load(): Config {
    if (this.cached) return this.cached
    if (!fs.existsSync(this.file)) {
      this.cached = defaultConfig()
      return this.cached
    }
    let raw: unknown
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch (err) {
      throw new DocError(
        `Configuration file is not valid JSON: ${this.file}`,
        ExitCode.Environment,
        `Fix the file by hand or run "doc-cli config reset". (${(err as Error).message})`,
      )
    }
    this.cached = parseConfig(raw)
    return this.cached
  }

  save(cfg: Config): void {
    writeFileAtomic(this.file, JSON.stringify(cfg, null, 2) + '\n')
    this.cached = cfg
  }

  get(key: string): unknown {
    return getByPath(this.load(), key)
  }

  set(key: string, value: string): Config {
    const next = setByPath(this.load(), key, value)
    this.save(next)
    return next
  }

  reset(): Config {
    const cfg = defaultConfig()
    this.save(cfg)
    return cfg
  }

  get path(): string {
    return this.file
  }
}
