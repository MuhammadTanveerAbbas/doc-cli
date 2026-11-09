import fs from 'node:fs'
import path from 'node:path'
import { execa } from 'execa'
import { DocError, ExitCode } from '../core/errors.js'

export interface SafeProcessOptions {
  timeoutMs?: number
  cwd?: string
  env?: Record<string, string>
  input?: string
  maxOutputBytes?: number
  signal?: AbortSignal
}

export interface ProcessResult {
  executable: string
  args: string[]
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  durationMs: number
  notFound: boolean
  ok: boolean
}

export interface ProcessRunner {
  run(executable: string, args: string[], options?: SafeProcessOptions): Promise<ProcessResult>
  which(executable: string): Promise<string | null>
}

export const DEFAULT_ALLOWLIST: ReadonlySet<string> = new Set([
  'node',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'pip',
  'pip3',
  'python',
  'python3',
  'py',
  'uv',
  'git',
  'apt',
  'apt-get',
  'apt-cache',
  'dpkg-query',
  'dnf',
  'rpm',
  'pacman',
  'zypper',
  'brew',
  'winget',
  'choco',
  'scoop',
  'sudo',
  'docker',
  'code',
  'cursor',
  'firefox',
  'curl',
  'jq',
  'rg',
  'sqlite3',
  'psql',
  '7z',
  '7zz',
  'webpack',
  'powershell',
  'pwsh',
  'ps',
  'tasklist',
  'systemctl',
  'gh',
  'go',
  'cargo',
  'rustc',
  'java',
  'ruby',
  'php',
  'dotnet',
  'deno',
])

const SAFE_CMD_ARG = /^[A-Za-z0-9_@/.:=+,\\~ ]*$/

export function baseName(executable: string): string {
  const b = path.basename(executable).toLowerCase()
  return b.replace(/\.(exe|cmd|bat|com)$/i, '')
}

export async function findExecutable(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string | null> {
  if (name.includes('/') || name.includes('\\')) {
    return fs.existsSync(name) ? name : null
  }
  const sep = platform === 'win32' ? ';' : ':'
  const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  const dirs = (env[pathKey] ?? '').split(sep).filter(Boolean)
  const exts =
    platform === 'win32'
      ? ['', ...(env['PATHEXT'] ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.toLowerCase())]
      : ['']
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext)
      try {
        const st = fs.statSync(candidate)
        if (!st.isFile()) continue
        if (platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK)
        return candidate
      } catch {
        continue
      }
    }
  }
  return null
}

export class ExecaProcessRunner implements ProcessRunner {
  constructor(
    private readonly allowlist: ReadonlySet<string> | null = DEFAULT_ALLOWLIST,
    private readonly baseEnv: NodeJS.ProcessEnv = process.env,
  ) {}

  which(executable: string): Promise<string | null> {
    return findExecutable(executable, this.baseEnv)
  }

  async run(
    executable: string,
    args: string[],
    options: SafeProcessOptions = {},
  ): Promise<ProcessResult> {
    if (this.allowlist && !this.allowlist.has(baseName(executable))) {
      throw new DocError(
        `Executable is not on the allowlist: ${executable}`,
        ExitCode.Unsupported,
        'DOC CLI only runs executables it knows about.',
      )
    }
    for (const a of args) {
      if (a.includes('\0')) throw new DocError('Argument contains a null byte', ExitCode.Usage)
    }
    const started = Date.now()
    const resolved = await findExecutable(executable, this.baseEnv)
    if (!resolved) {
      return {
        executable,
        args,
        exitCode: null,
        stdout: '',
        stderr: `${executable}: command not found`,
        timedOut: false,
        durationMs: Date.now() - started,
        notFound: true,
        ok: false,
      }
    }
    let file = resolved
    let finalArgs = args
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
      for (const a of args) {
        if (!SAFE_CMD_ARG.test(a)) {
          throw new DocError(
            `Argument is not safe to pass to a batch script: ${JSON.stringify(a)}`,
            ExitCode.Usage,
          )
        }
      }
      const comspec = this.baseEnv['ComSpec'] ?? 'cmd.exe'
      file = comspec
      finalArgs = [
        '/d',
        '/s',
        '/c',
        [`"${resolved}"`, ...args.map((a) => (a.includes(' ') ? `"${a}"` : a))].join(' '),
      ]
    }
    const r = await execa(file, finalArgs, {
      reject: false,
      shell: false,
      timeout: options.timeoutMs ?? 120_000,
      maxBuffer: options.maxOutputBytes ?? 5 * 1024 * 1024,
      windowsHide: true,
      stdin: options.input !== undefined ? 'pipe' : 'ignore',
      ...(options.input !== undefined ? { input: options.input } : {}),
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
      ...(options.signal ? { cancelSignal: options.signal } : {}),
    })
    const exitCode = typeof r.exitCode === 'number' ? r.exitCode : null
    const notFound = (r as { code?: string }).code === 'ENOENT'
    return {
      executable,
      args,
      exitCode,
      stdout: typeof r.stdout === 'string' ? r.stdout : '',
      stderr: typeof r.stderr === 'string' ? r.stderr : '',
      timedOut: Boolean((r as { timedOut?: boolean }).timedOut),
      durationMs: Date.now() - started,
      notFound,
      ok: exitCode === 0 && !r.failed,
    }
  }
}

export function fakeResult(
  partial: Partial<ProcessResult> & { executable: string },
): ProcessResult {
  return {
    args: [],
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
    durationMs: 1,
    notFound: false,
    ok: (partial.exitCode ?? 0) === 0,
    ...partial,
  }
}
