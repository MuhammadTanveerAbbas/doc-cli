import type { PlanStep } from '../../services/permissionService.js'
import type { ProcessResult } from '../../services/processRunner.js'

export interface PackageSearchResult {
  id: string
  name: string
  version?: string
  description?: string
  source: string
}

export interface InstalledPackage {
  id: string
  version: string
  source: string
}

export interface PackageUpdate {
  id: string
  current: string
  latest: string
  source: string
}

export interface PackageRequest {
  id: string
  cask?: boolean
}

export interface OperationOptions {
  dryRun: boolean
  interactive: boolean
  signal?: AbortSignal
}

export interface CommandSpec {
  executable: string
  args: string[]
  elevated: boolean
}

export interface OperationResult {
  ok: boolean
  exitCode: number | null
  output: string
  step: PlanStep
}

export type ManagerScope = 'system' | 'language'

export interface PackageManagerAdapter {
  id: string
  label: string
  scope: ManagerScope
  platforms: Array<'linux' | 'windows' | 'macos'>
  capabilities: {
    search: boolean
    list: boolean
    outdated: boolean
    info: boolean
    install: boolean
    upgrade: boolean
    remove: boolean
  }
  isAvailable(): Promise<boolean>
  version(): Promise<string | null>
  search(query: string): Promise<PackageSearchResult[]>
  listInstalled(): Promise<InstalledPackage[]>
  getUpdates(): Promise<PackageUpdate[]>
  info(id: string): Promise<string>
  planInstall(req: PackageRequest): CommandSpec
  planUpgrade(req?: PackageRequest): CommandSpec
  planRemove(req: PackageRequest): CommandSpec
  install(req: PackageRequest, options: OperationOptions): Promise<OperationResult>
  upgrade(req: PackageRequest | undefined, options: OperationOptions): Promise<OperationResult>
  remove(req: PackageRequest, options: OperationOptions): Promise<OperationResult>
}

export function stepFromSpec(description: string, spec: CommandSpec): PlanStep {
  return {
    description,
    executable: spec.executable,
    args: spec.args,
    elevated: spec.elevated,
  }
}

export function summarizeResult(r: ProcessResult, max = 4000): string {
  const text = [r.stdout, r.stderr].filter(Boolean).join('\n').trim()
  return text.length > max ? text.slice(-max) : text
}
