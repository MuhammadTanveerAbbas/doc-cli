import type { CommandDef } from '../../cli/types.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan, type OperationPlan } from '../../services/permissionService.js'
import { dirSize, topLevelSizes } from '../../services/filesystemService.js'
import { formatBytes, formatUptime } from '../../utils/formatting.js'
import { collectReport, inspectCaches, startupItems } from './service.js'
import path from 'node:path'

const M = 'performance'

function printReport(ctx: AppContext, r: Awaited<ReturnType<typeof collectReport>>): void {
  const o = ctx.out
  const hw = r.hardware
  o.heading('DOC CLI PERFORMANCE REPORT')
  o.line('System')
  o.kv([
    ['CPU load', hw.load.currentPercent === null ? 'unsupported' : `${hw.load.currentPercent}%`],
    ['Memory used', `${hw.memory.usedPercent}% of ${formatBytes(hw.memory.totalBytes)}`],
    ['Uptime', formatUptime(hw.uptimeSeconds)],
    ...hw.disks.map((d): [string, string] => [
      `Disk ${d.mount}`,
      `${d.usedPercent}% used, ${formatBytes(d.availableBytes)} free`,
    ]),
  ])
  o.line('\nDeveloper environment')
  o.kv(
    Object.entries(r.tools).map(([k, v]): [string, string] => [
      k,
      v.installed ? `installed ${v.version ?? ''}`.trim() : 'not installed',
    ]),
  )
  o.line('\nRecommendations')
  r.recommendations.forEach((x, i) => o.line(`  ${i + 1}. ${x.text}`))
}

export const performanceCommands: CommandDef[] = [
  {
    path: ['performance', 'check'],
    summary: 'Quick health check with measured values',
    category: 'Performance',
    module: M,
    async run(ctx) {
      const r = await collectReport(ctx)
      ctx.out.emit(r, (o) => {
        o.heading('Performance check')
        o.kv([
          [
            'CPU load',
            r.hardware.load.currentPercent === null
              ? 'unsupported'
              : `${r.hardware.load.currentPercent}%`,
          ],
          ['Memory used', `${r.hardware.memory.usedPercent}%`],
          [
            'Fullest disk',
            r.hardware.disks.length
              ? `${[...r.hardware.disks].sort((a, b) => b.usedPercent - a.usedPercent)[0]?.usedPercent}%`
              : 'unsupported',
          ],
        ])
        for (const x of r.recommendations) o.status(x.severity === 'warn' ? 'warn' : 'info', x.text)
      })
    },
  },
  {
    path: ['performance', 'report'],
    summary: 'Full performance and developer environment report',
    category: 'Performance',
    module: M,
    async run(ctx) {
      const r = await collectReport(ctx)
      ctx.out.emit(r, () => printReport(ctx, r))
    },
  },
  {
    path: ['performance', 'recommendations'],
    summary: 'Safe suggestions based on current measurements',
    category: 'Performance',
    module: M,
    async run(ctx) {
      const r = await collectReport(ctx)
      ctx.out.emit(r.recommendations, (o, v) => {
        o.heading('Recommendations')
        v.forEach((x, i) => o.line(`  ${i + 1}. ${x.text}`))
        o.line(
          o.style.muted(
            '\nDOC CLI only suggests. It never deletes, stops, or disables anything on its own.',
          ),
        )
      })
    },
  },
  {
    path: ['performance', 'startup'],
    summary: 'List optional startup items for your review',
    category: 'Performance',
    module: M,
    async run(ctx) {
      const s = await startupItems(ctx)
      ctx.out.emit(s, (o, v) => {
        o.heading('Startup items')
        if (!v.supported) o.status('skip', v.note)
        else {
          for (const i of v.items) o.line(`  ${i}`)
          if (v.items.length === 0) o.line('  (none found)')
          o.line(o.style.muted(`\n${v.note}`))
        }
      })
    },
  },
  {
    path: ['performance', 'disk'],
    summary: 'Show the largest items inside a folder you choose',
    category: 'Performance',
    module: M,
    options: [
      { flags: '--path <dir>', description: 'folder to scan (required)' },
      { flags: '--limit <n>', description: 'items to show', default: '15' },
    ],
    async run(ctx, { opts }) {
      const p = opts['path']
      if (typeof p !== 'string')
        throw new DocError(
          'Choose a scan folder with --path <dir>.',
          ExitCode.Usage,
          'DOC CLI only scans folders you name.',
        )
      const root = path.resolve(p)
      const limit = Math.min(
        Math.max(Number.parseInt(String(opts['limit'] ?? '15'), 10) || 15, 1),
        100,
      )
      const total = dirSize(root, { deadlineMs: 5000 })
      const items = topLevelSizes(root, limit)
      ctx.out.emit({ root, total, items }, (o) => {
        o.heading(`Largest items in ${root}`)
        o.table(
          ['Size', 'Path'],
          items.map((i) => [formatBytes(i.bytes) + (i.truncated ? '+' : ''), i.path]),
        )
        o.line(
          `\nTotal measured: ${formatBytes(total.bytes)} in ${total.files} files${total.truncated ? ' (scan limit reached, values are lower bounds)' : ''}`,
        )
      })
    },
  },
  {
    path: ['performance', 'cache', 'inspect'],
    summary: 'Show package manager cache locations and sizes',
    category: 'Performance',
    module: M,
    async run(ctx) {
      const caches = await inspectCaches(ctx)
      ctx.out.emit(caches, (o, v) => {
        o.heading('Caches')
        o.table(
          ['Cache', 'Size', 'Path'],
          v.map((c) => [
            c.label,
            c.bytes === null ? 'unknown' : formatBytes(c.bytes) + (c.truncated ? '+' : ''),
            c.path ?? 'not found',
          ]),
        )
      })
    },
  },
  {
    path: ['performance', 'cache', 'clean'],
    summary: "Clean package caches using each tool's own command",
    category: 'Performance',
    module: M,
    mutating: true,
    options: [
      { flags: '--preview', description: 'show the plan only' },
      { flags: '--only <ids>', description: 'comma separated cache ids (npm,pnpm,pip,yarn)' },
    ],
    async run(ctx, { opts }) {
      if (opts['preview']) ctx.opts.dryRun = true
      const only =
        typeof opts['only'] === 'string' ? opts['only'].split(',').map((s) => s.trim()) : null
      const caches = (await inspectCaches(ctx)).filter(
        (c) => c.cleanCommand && (!only || only.includes(c.id)),
      )
      if (caches.length === 0) {
        ctx.out.emit([], (o) => o.status('skip', 'No cleanable caches found.'))
        return
      }
      const plan: OperationPlan = {
        title: 'Clean package caches',
        kind: 'cleanup',
        risk: 'medium',
        steps: caches.map((c) => ({
          description: `Clean ${c.label} (${c.bytes === null ? 'size unknown' : formatBytes(c.bytes)})`,
          executable: c.cleanCommand?.executable as string,
          args: c.cleanCommand?.args as string[],
          ...(c.path ? { paths: [c.path] } : {}),
          reversible: false,
        })),
        notes: [
          'Cleaning caches frees disk space but later installs may need to download packages again.',
        ],
      }
      const outcome = await runPlan(ctx, plan, async () => {
        const results: Array<{
          id: string
          ok: boolean
          beforeBytes: number | null
          afterBytes: number | null
        }> = []
        for (const c of caches) {
          const cmd = c.cleanCommand as { executable: string; args: string[] }
          const r = await ctx.runner.run(cmd.executable, cmd.args, { timeoutMs: 5 * 60_000 })
          const after = c.path ? dirSize(c.path).bytes : null
          results.push({ id: c.id, ok: r.ok, beforeBytes: c.bytes, afterBytes: after })
          ctx.out.status(
            r.ok ? 'ok' : 'fail',
            `${c.label}: ${formatBytes(c.bytes ?? 0)} before, ${after === null ? 'unknown' : formatBytes(after)} after`,
          )
        }
        return results
      })
      if (outcome.result && ctx.out.json) ctx.out.data(outcome.result)
    },
  },
]
