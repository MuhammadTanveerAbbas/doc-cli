import type { CommandDef } from '../../cli/types.js'
import { formatBytes, formatUptime } from '../../utils/formatting.js'
import {
  appPaths,
  collectEnvironment,
  collectHardware,
  collectOs,
  collectProcesses,
  inspectPath,
} from './service.js'

const M = 'system'

export const systemCommands: CommandDef[] = [
  {
    path: ['system', 'info'],
    summary: 'Show a short overview of this computer',
    category: 'System',
    module: M,
    async run(ctx) {
      const [hw] = await Promise.all([collectHardware()])
      const os = collectOs(ctx)
      ctx.out.emit({ os, hardware: hw }, (o) => {
        o.heading('System')
        o.kv([
          ['Operating system', `${os.distro} (${os.platform})`],
          ['Architecture', os.arch],
          ['Hostname', os.hostname],
          ['Shell', os.shell],
          ['CPU', `${hw.cpu.model} (${hw.cpu.cores} threads)`],
          ['Memory', `${formatBytes(hw.memory.totalBytes)} total, ${hw.memory.usedPercent}% used`],
          ['Uptime', formatUptime(hw.uptimeSeconds)],
          ['Node.js', os.nodeVersion],
        ])
        for (const u of hw.unsupported) o.status('skip', `${u}: not available on this system`)
      })
    },
  },
  {
    path: ['system', 'hardware'],
    summary: 'Show CPU, memory, and disk details',
    category: 'System',
    module: M,
    async run(ctx) {
      const hw = await collectHardware()
      ctx.out.emit(hw, (o, v) => {
        o.heading('CPU')
        o.kv([
          ['Model', v.cpu.model],
          ['Threads', String(v.cpu.cores)],
          [
            'Physical cores',
            v.cpu.physicalCores === null ? 'unsupported' : String(v.cpu.physicalCores),
          ],
          [
            'Load now',
            v.load.currentPercent === null ? 'unsupported' : `${v.load.currentPercent}%`,
          ],
        ])
        o.heading('Memory')
        o.kv([
          ['Total', formatBytes(v.memory.totalBytes)],
          ['Available', formatBytes(v.memory.availableBytes)],
          ['Used', `${v.memory.usedPercent}%`],
        ])
        o.heading('Disks')
        o.table(
          ['Mount', 'Type', 'Size', 'Free', 'Used'],
          v.disks.map((d) => [
            d.mount,
            d.fs,
            formatBytes(d.totalBytes),
            formatBytes(d.availableBytes),
            `${d.usedPercent}%`,
          ]),
        )
      })
    },
  },
  {
    path: ['system', 'os'],
    summary: 'Show operating system details',
    category: 'System',
    module: M,
    async run(ctx) {
      const info = collectOs(ctx)
      ctx.out.emit(info, (o, v) => {
        o.heading('Operating system')
        o.kv([
          ['Family', v.platform],
          ['Name', v.distro],
          ['Release', v.release],
          ['Kernel', v.kernel],
          ['Architecture', v.arch],
          ['Running as administrator', v.isRoot ? 'yes' : 'no'],
          ['Windows Subsystem for Linux', v.isWsl ? 'yes' : 'no'],
        ])
      })
    },
  },
  {
    path: ['system', 'environment'],
    summary: 'Show environment variables with secret values hidden',
    category: 'System',
    module: M,
    async run(ctx) {
      const env = collectEnvironment(ctx)
      ctx.out.emit(env, (o, v) => {
        o.heading('Environment (secret values hidden)')
        o.table(
          ['Name', 'Value'],
          Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, val]) => [k, val]),
        )
      })
    },
  },
  {
    path: ['system', 'processes'],
    summary: 'Show the busiest processes (read only)',
    category: 'System',
    module: M,
    options: [
      { flags: '--limit <n>', description: 'number of processes to list', default: '10' },
      { flags: '--sort <field>', description: 'sort by cpu or mem', default: 'cpu' },
    ],
    async run(ctx, { opts }) {
      const limit = Math.min(
        Math.max(Number.parseInt(String(opts['limit'] ?? '10'), 10) || 10, 1),
        100,
      )
      const sort = opts['sort'] === 'mem' ? 'mem' : 'cpu'
      const rows = await collectProcesses(limit, sort)
      ctx.out.emit(rows, (o, v) => {
        o.heading(`Top ${v.length} processes by ${sort}`)
        o.table(
          ['PID', 'Name', 'CPU %', 'Memory %'],
          v.map((p) => [String(p.pid), p.name, String(p.cpuPercent), String(p.memPercent)]),
        )
        o.line(o.style.muted('DOC CLI never stops processes for you.'))
      })
    },
  },
  {
    path: ['system', 'paths'],
    summary: 'Show PATH entries and DOC CLI storage locations',
    category: 'System',
    module: M,
    async run(ctx) {
      const entries = inspectPath(ctx.env)
      const app = appPaths(ctx)
      ctx.out.emit({ path: entries, app }, (o) => {
        o.heading('PATH entries')
        o.table(
          ['Status', 'Entry'],
          entries.map((e) => [!e.exists ? 'missing' : e.duplicate ? 'duplicate' : 'ok', e.path]),
        )
        o.heading('DOC CLI locations')
        o.kv(Object.entries(app))
      })
    },
  },
]
