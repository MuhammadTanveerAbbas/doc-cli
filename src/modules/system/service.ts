import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import si from 'systeminformation'
import type { AppContext } from '../../core/context.js'
import { redactEnv } from '../../utils/redact.js'

export interface HardwareInfo {
  cpu: { model: string; cores: number; physicalCores: number | null; speedGHz: number | null }
  memory: { totalBytes: number; availableBytes: number; usedPercent: number }
  load: { currentPercent: number | null }
  disks: DiskInfo[]
  uptimeSeconds: number
  unsupported: string[]
}

export interface DiskInfo {
  mount: string
  fs: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usedPercent: number
}

async function safe<T>(
  label: string,
  unsupported: string[],
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn()
  } catch {
    unsupported.push(label)
    return null
  }
}

export async function collectHardware(): Promise<HardwareInfo> {
  const unsupported: string[] = []
  const cpus = os.cpus()
  const cpu = await safe('cpu details', unsupported, () => si.cpu())
  const mem = await safe('memory details', unsupported, () => si.mem())
  const load = await safe('cpu load', unsupported, () => si.currentLoad())
  const fsSize = await safe('disk usage', unsupported, () => si.fsSize())
  const totalBytes = mem?.total ?? os.totalmem()
  const availableBytes = mem?.available ?? os.freemem()
  const disks: DiskInfo[] = (fsSize ?? [])
    .filter((d) => d.size > 0)
    .map((d) => ({
      mount: d.mount,
      fs: d.fs,
      totalBytes: d.size,
      usedBytes: d.used,
      availableBytes: d.available,
      usedPercent: Math.round(d.use * 10) / 10,
    }))
  return {
    cpu: {
      model: cpu?.brand || cpus[0]?.model || 'unknown',
      cores: cpu?.cores ?? cpus.length,
      physicalCores: cpu?.physicalCores ?? null,
      speedGHz: cpu?.speed ?? null,
    },
    memory: {
      totalBytes,
      availableBytes,
      usedPercent: totalBytes
        ? Math.round(((totalBytes - availableBytes) / totalBytes) * 1000) / 10
        : 0,
    },
    load: { currentPercent: load ? Math.round(load.currentLoad * 10) / 10 : null },
    disks,
    uptimeSeconds: os.uptime(),
    unsupported,
  }
}

export interface OsDetails {
  platform: string
  distro: string
  release: string
  arch: string
  kernel: string
  hostname: string
  shell: string
  isWsl: boolean
  isRoot: boolean
  nodeVersion: string
}

export function collectOs(ctx: AppContext): OsDetails {
  const p = ctx.platform
  return {
    platform: p.id,
    distro:
      p.distroName ?? (p.id === 'macos' ? 'macOS' : p.id === 'windows' ? 'Windows' : 'unknown'),
    release: p.release,
    arch: p.arch,
    kernel: os.version(),
    hostname: os.hostname(),
    shell: p.shell,
    isWsl: p.isWsl,
    isRoot: p.isRoot,
    nodeVersion: p.nodeVersion,
  }
}

export interface PathEntry {
  path: string
  exists: boolean
  isDirectory: boolean
  duplicate: boolean
}

export function inspectPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
): PathEntry[] {
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH'
  const sep = platform === 'win32' ? ';' : ':'
  const seen = new Set<string>()
  return (env[key] ?? '')
    .split(sep)
    .filter(Boolean)
    .map((p) => {
      let exists: boolean
      let isDirectory = false
      try {
        const st = fs.statSync(p)
        exists = true
        isDirectory = st.isDirectory()
      } catch {
        exists = false
      }
      const norm = platform === 'win32' ? p.toLowerCase() : p
      const duplicate = seen.has(norm)
      seen.add(norm)
      return { path: p, exists, isDirectory, duplicate }
    })
}

export function collectEnvironment(ctx: AppContext): Record<string, string> {
  return redactEnv(ctx.env)
}

export interface ProcessRow {
  pid: number
  name: string
  cpuPercent: number
  memPercent: number
}

export async function collectProcesses(
  limit: number,
  sortBy: 'cpu' | 'mem',
): Promise<ProcessRow[]> {
  const data = await si.processes()
  return data.list
    .map((p) => ({
      pid: p.pid,
      name: p.name,
      cpuPercent: Math.round(p.cpu * 10) / 10,
      memPercent: Math.round(p.mem * 10) / 10,
    }))
    .sort((a, b) => (sortBy === 'cpu' ? b.cpuPercent - a.cpuPercent : b.memPercent - a.memPercent))
    .slice(0, limit)
}

export function appPaths(ctx: AppContext): Record<string, string> {
  return {
    config: ctx.dirs.config,
    data: ctx.dirs.data,
    cache: ctx.dirs.cache,
    logs: ctx.dirs.logs,
    configFile: ctx.dirs.configFile,
    historyFile: ctx.dirs.historyFile,
    auditFile: ctx.dirs.auditFile,
    backups: ctx.dirs.backups,
    downloads: ctx.dirs.downloads,
    plugins: ctx.dirs.plugins,
    home: ctx.platform.homedir,
    temp: os.tmpdir(),
    cwd: process.cwd(),
    executable: path.resolve(process.argv[1] ?? ''),
  }
}
