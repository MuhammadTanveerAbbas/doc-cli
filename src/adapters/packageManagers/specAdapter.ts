import { DocError, ExitCode, unsupported } from '../../core/errors.js'
import type { PlatformInfo } from '../../platform/detect.js'
import type { ProcessResult, ProcessRunner } from '../../services/processRunner.js'
import { validatePackageId, validateSearchQuery } from '../../utils/validation.js'
import {
  stepFromSpec,
  summarizeResult,
  type CommandSpec,
  type InstalledPackage,
  type ManagerScope,
  type OperationOptions,
  type OperationResult,
  type PackageManagerAdapter,
  type PackageRequest,
  type PackageSearchResult,
  type PackageUpdate,
} from './types.js'

export interface AdapterSpec {
  id: string
  label: string
  scope: ManagerScope
  platforms: Array<'linux' | 'windows' | 'macos'>
  executable: string
  elevated?: boolean
  versionArgs: string[]
  list?: { executable?: string; args: string[]; parse: (stdout: string) => InstalledPackage[] }
  outdated?: {
    executable?: string
    args: string[]
    okExitCodes?: number[]
    parse: (stdout: string) => PackageUpdate[]
  }
  search?: {
    executable?: string
    args: (q: string) => string[]
    parse: (stdout: string) => PackageSearchResult[]
  }
  info?: { executable?: string; args: (id: string) => string[] }
  install?: (req: PackageRequest) => string[]
  upgrade?: (req?: PackageRequest) => string[]
  remove?: (req: PackageRequest) => string[]
}

export class SpecAdapter implements PackageManagerAdapter {
  readonly id: string
  readonly label: string
  readonly scope: ManagerScope
  readonly platforms: Array<'linux' | 'windows' | 'macos'>
  readonly capabilities: PackageManagerAdapter['capabilities']

  constructor(
    private readonly spec: AdapterSpec,
    private readonly runner: ProcessRunner,
    private readonly platform: PlatformInfo,
  ) {
    this.id = spec.id
    this.label = spec.label
    this.scope = spec.scope
    this.platforms = spec.platforms
    this.capabilities = {
      search: Boolean(spec.search),
      list: Boolean(spec.list),
      outdated: Boolean(spec.outdated),
      info: Boolean(spec.info),
      install: Boolean(spec.install),
      upgrade: Boolean(spec.upgrade),
      remove: Boolean(spec.remove),
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.spec.platforms.includes(this.platform.id)) return false
    return (await this.runner.which(this.spec.executable)) !== null
  }

  async version(): Promise<string | null> {
    const r = await this.runner.run(this.spec.executable, this.spec.versionArgs, {
      timeoutMs: 15_000,
    })
    if (!r.ok) return null
    const first = r.stdout.split(/\r?\n/)[0]?.trim() ?? ''
    const m = /(\d+\.\d+(?:\.\d+)?(?:[.\-+][0-9A-Za-z.]+)?)/.exec(first)
    return m ? (m[1] ?? first) : first || null
  }

  private need<T>(value: T | undefined, op: string): T {
    if (value === undefined) {
      throw unsupported(
        `${this.label} adapter does not support ${op} yet.`,
        'See the package manager support list in the README.',
      )
    }
    return value
  }

  private wrap(args: string[], elevated: boolean): CommandSpec {
    if (elevated && this.platform.id !== 'windows' && !this.platform.isRoot) {
      return { executable: 'sudo', args: [this.spec.executable, ...args], elevated: true }
    }
    return { executable: this.spec.executable, args, elevated }
  }

  private async exec(args: string[], timeoutMs = 60_000, exe?: string): Promise<ProcessResult> {
    const file = exe ?? this.spec.executable
    const r = await this.runner.run(file, args, { timeoutMs })
    if (r.notFound) throw new DocError(`${file} is not installed`, ExitCode.Environment)
    return r
  }

  async search(query: string): Promise<PackageSearchResult[]> {
    const s = this.need(this.spec.search, 'search')
    const r = await this.exec(s.args(validateSearchQuery(query)), 60_000, s.executable)
    if (!r.ok) throw new DocError(`${this.label} search failed: ${summarizeResult(r, 300)}`)
    return s.parse(r.stdout)
  }

  async listInstalled(): Promise<InstalledPackage[]> {
    const s = this.need(this.spec.list, 'list')
    const exe = s.executable ?? this.spec.executable
    const r = await this.runner.run(exe, s.args, { timeoutMs: 60_000 })
    if (r.notFound) throw new DocError(`${exe} is not installed`, ExitCode.Environment)
    if (!r.ok) throw new DocError(`${this.label} list failed: ${summarizeResult(r, 300)}`)
    return s.parse(r.stdout)
  }

  async getUpdates(): Promise<PackageUpdate[]> {
    const s = this.need(this.spec.outdated, 'outdated')
    const r = await this.exec(s.args, 120_000, s.executable)
    const okCodes = s.okExitCodes ?? [0]
    if (r.exitCode === null || (!okCodes.includes(r.exitCode) && !r.stdout.trim())) {
      throw new DocError(`${this.label} outdated check failed: ${summarizeResult(r, 300)}`)
    }
    return s.parse(r.stdout)
  }

  async info(id: string): Promise<string> {
    const s = this.need(this.spec.info, 'info')
    const r = await this.exec(s.args(validatePackageId(id)), 60_000, s.executable)
    if (!r.ok) throw new DocError(`${this.label} info failed: ${summarizeResult(r, 300)}`)
    return r.stdout.trim()
  }

  planInstall(req: PackageRequest): CommandSpec {
    const fn = this.need(this.spec.install, 'install')
    return this.wrap(fn({ ...req, id: validatePackageId(req.id) }), this.spec.elevated ?? false)
  }

  planUpgrade(req?: PackageRequest): CommandSpec {
    const fn = this.need(this.spec.upgrade, 'upgrade')
    const checked = req ? { ...req, id: validatePackageId(req.id) } : undefined
    return this.wrap(fn(checked), this.spec.elevated ?? false)
  }

  planRemove(req: PackageRequest): CommandSpec {
    const fn = this.need(this.spec.remove, 'remove')
    return this.wrap(fn({ ...req, id: validatePackageId(req.id) }), this.spec.elevated ?? false)
  }

  private async run(
    description: string,
    spec: CommandSpec,
    options: OperationOptions,
  ): Promise<OperationResult> {
    const step = stepFromSpec(description, spec)
    if (options.dryRun) return { ok: true, exitCode: null, output: 'dry run', step }
    const r = await this.runner.run(spec.executable, spec.args, {
      timeoutMs: 15 * 60_000,
      ...(options.signal ? { signal: options.signal } : {}),
    })
    return { ok: r.ok, exitCode: r.exitCode, output: summarizeResult(r), step }
  }

  install(req: PackageRequest, options: OperationOptions): Promise<OperationResult> {
    return this.run(`Install ${req.id} with ${this.label}`, this.planInstall(req), options)
  }

  upgrade(req: PackageRequest | undefined, options: OperationOptions): Promise<OperationResult> {
    return this.run(
      `Upgrade ${req?.id ?? 'all packages'} with ${this.label}`,
      this.planUpgrade(req),
      options,
    )
  }

  remove(req: PackageRequest, options: OperationOptions): Promise<OperationResult> {
    return this.run(`Remove ${req.id} with ${this.label}`, this.planRemove(req), options)
  }
}
