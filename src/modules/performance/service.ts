import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { AppContext } from '../../core/context.js'
import { dirSize } from '../../services/filesystemService.js'
import { detectAll } from '../developerSetup/service.js'
import { collectHardware, inspectPath, type HardwareInfo } from '../system/service.js'
import { formatBytes } from '../../utils/formatting.js'

export interface CacheInfo {
  id: string
  label: string
  path: string | null
  bytes: number | null
  truncated: boolean
  cleanCommand: { executable: string; args: string[] } | null
}

interface CacheProbe {
  id: string
  label: string
  locate: { executable: string; args: string[] }
  clean: { executable: string; args: string[] }
}

const probes: CacheProbe[] = [
  {
    id: 'npm',
    label: 'npm cache',
    locate: { executable: 'npm', args: ['config', 'get', 'cache'] },
    clean: { executable: 'npm', args: ['cache', 'clean', '--force'] },
  },
  {
    id: 'pnpm',
    label: 'pnpm store',
    locate: { executable: 'pnpm', args: ['store', 'path'] },
    clean: { executable: 'pnpm', args: ['store', 'prune'] },
  },
  {
    id: 'pip',
    label: 'pip cache',
    locate: { executable: 'pip', args: ['cache', 'dir'] },
    clean: { executable: 'pip', args: ['cache', 'purge'] },
  },
  {
    id: 'yarn',
    label: 'Yarn cache',
    locate: { executable: 'yarn', args: ['cache', 'dir'] },
    clean: { executable: 'yarn', args: ['cache', 'clean'] },
  },
]

export async function inspectCaches(ctx: AppContext): Promise<CacheInfo[]> {
  const out: CacheInfo[] = []
  for (const p of probes) {
    const r = await ctx.runner.run(p.locate.executable, p.locate.args, { timeoutMs: 20_000 })
    if (r.notFound) continue
    const dir = r.ok ? (r.stdout.trim().split(/\r?\n/).pop() ?? '').trim() : ''
    if (!dir || !path.isAbsolute(dir) || !fs.existsSync(dir)) {
      out.push({
        id: p.id,
        label: p.label,
        path: dir || null,
        bytes: null,
        truncated: false,
        cleanCommand: p.clean,
      })
      continue
    }
    const size = dirSize(dir)
    out.push({
      id: p.id,
      label: p.label,
      path: dir,
      bytes: size.bytes,
      truncated: size.truncated,
      cleanCommand: p.clean,
    })
  }
  const tmp = os.tmpdir()
  const t = dirSize(tmp, { maxFiles: 50_000, deadlineMs: 3000 })
  out.push({
    id: 'temp',
    label: 'Temporary directory (review only)',
    path: tmp,
    bytes: t.bytes,
    truncated: t.truncated,
    cleanCommand: null,
  })
  return out
}

export interface Recommendation {
  id: string
  severity: 'info' | 'warn'
  text: string
}

export interface ReportInput {
  hw: HardwareInfo
  caches: CacheInfo[]
  missingPath: number
  outdatedTools: string[]
}

export function buildRecommendations(i: ReportInput): Recommendation[] {
  const rec: Recommendation[] = []
  const worstDisk = [...i.hw.disks].sort((a, b) => b.usedPercent - a.usedPercent)[0]
  if (worstDisk && worstDisk.usedPercent >= 90)
    rec.push({
      id: 'disk.critical',
      severity: 'warn',
      text: `Disk ${worstDisk.mount} is ${worstDisk.usedPercent}% full. Free space before installing more tools.`,
    })
  else if (worstDisk && worstDisk.usedPercent >= 80)
    rec.push({
      id: 'disk.high',
      severity: 'info',
      text: `Disk ${worstDisk.mount} is ${worstDisk.usedPercent}% full. Review large files and caches.`,
    })
  if (i.hw.memory.usedPercent >= 90)
    rec.push({
      id: 'mem.high',
      severity: 'warn',
      text: `Memory use is ${i.hw.memory.usedPercent}%. Consider closing heavy applications yourself, DOC CLI will not do it for you.`,
    })
  for (const c of i.caches) {
    if (c.cleanCommand && c.bytes !== null && c.bytes > 1024 ** 3)
      rec.push({
        id: `cache.${c.id}`,
        severity: 'info',
        text: `${c.label} uses ${formatBytes(c.bytes)}. Clean it with "doc-cli performance cache clean --preview" first. Caches can make later installs faster.`,
      })
  }
  if (i.missingPath > 0)
    rec.push({
      id: 'path.missing',
      severity: 'info',
      text: `${i.missingPath} PATH entries point to missing folders. Review them with "doc-cli system paths".`,
    })
  if ((i.hw.load.currentPercent ?? 0) >= 90)
    rec.push({
      id: 'cpu.high',
      severity: 'info',
      text: 'CPU load is very high right now. Use "doc-cli system processes" to see what is busy.',
    })
  if (rec.length === 0)
    rec.push({
      id: 'none',
      severity: 'info',
      text: 'No issues found by the checks DOC CLI can run.',
    })
  return rec
}

export async function startupItems(
  ctx: AppContext,
): Promise<{ supported: boolean; items: string[]; note: string }> {
  const home = ctx.platform.homedir
  const list = (dir: string): string[] => {
    try {
      return fs.readdirSync(dir).map((f) => path.join(dir, f))
    } catch {
      return []
    }
  }
  if (ctx.platform.id === 'linux') {
    return {
      supported: true,
      items: list(path.join(home, '.config', 'autostart')),
      note: 'Lists desktop autostart entries for your user. Systemd services are not listed.',
    }
  }
  if (ctx.platform.id === 'macos') {
    return {
      supported: true,
      items: list(path.join(home, 'Library', 'LaunchAgents')),
      note: 'Lists user launch agents. Login items are not listed.',
    }
  }
  const r = await ctx.runner.run(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_StartupCommand | ForEach-Object { $_.Name + " | " + $_.Command }',
    ],
    { timeoutMs: 20_000 },
  )
  if (!r.ok)
    return { supported: false, items: [], note: 'PowerShell could not list startup commands.' }
  return {
    supported: true,
    items: r.stdout.split(/\r?\n/).filter(Boolean),
    note: 'Listed with Win32_StartupCommand. Services and scheduled tasks are not included.',
  }
}

export async function collectReport(ctx: AppContext) {
  const [hw, tools, caches] = await Promise.all([
    collectHardware(),
    detectAll(ctx, ['node', 'pnpm', 'python', 'git', 'docker']),
    inspectCaches(ctx),
  ])
  const missingPath = inspectPath(ctx.env).filter((e) => !e.exists).length
  const recommendations = buildRecommendations({ hw, caches, missingPath, outdatedTools: [] })
  return {
    measuredAt: new Date().toISOString(),
    hardware: hw,
    tools,
    caches,
    missingPath,
    recommendations,
  }
}
