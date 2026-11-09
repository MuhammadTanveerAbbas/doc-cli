import os from 'node:os'
import type { CommandDef } from '../../cli/types.js'
import { ExitCode } from '../../core/errors.js'
import { platformLabel } from '../../platform/detect.js'
import { runDoctor } from './doctor.js'
import { readUpdateCache } from '../updater/service.js'

const M = 'general'

export const generalCommands: CommandDef[] = [
  {
    path: ['version'],
    summary: 'Print the DOC CLI version',
    category: 'General',
    module: M,
    async run(ctx) {
      const data = {
        version: ctx.version,
        node: ctx.platform.nodeVersion,
        platform: ctx.platform.id,
        arch: ctx.platform.arch,
      }
      ctx.out.emit(data, (o) =>
        o.essential(
          `DOC CLI ${ctx.version} (Node.js ${ctx.platform.nodeVersion}, ${platformLabel(ctx.platform)})`,
        ),
      )
    },
  },
  {
    path: ['status'],
    summary: 'Show DOC CLI status and key settings',
    category: 'General',
    module: M,
    async run(ctx) {
      const cfg = ctx.config.load()
      const cache = readUpdateCache(ctx.dirs.updates)
      const data = {
        version: ctx.version,
        platform: platformLabel(ctx.platform),
        host: os.hostname(),
        configFile: ctx.config.path,
        history: cfg.history.enabled ? `on, ${cfg.history.retentionDays} days` : 'off',
        ai: cfg.ai.enabled ? `on (${cfg.ai.provider ?? 'no provider'})` : 'off',
        updateChannel: cfg.updates.channel,
        lastUpdateCheck: cache?.checkedAt ?? 'never',
        latestKnownVersion: cache?.latest ?? 'unknown',
      }
      ctx.out.emit(data, (o, v) => {
        o.heading('DOC CLI status')
        o.kv([
          ['Version', v.version],
          ['Platform', v.platform],
          ['Configuration', v.configFile],
          ['History', v.history],
          ['AI assistant', v.ai],
          ['Update channel', v.updateChannel],
          ['Last update check', v.lastUpdateCheck],
          ['Latest known version', v.latestKnownVersion],
        ])
      })
    },
  },
  {
    path: ['doctor'],
    summary: 'Check that this system can run DOC CLI features',
    category: 'General',
    module: M,
    options: [{ flags: '--network', description: 'also test network access' }],
    async run(ctx, { opts }) {
      const checks = await runDoctor(ctx, Boolean(opts['network']))
      ctx.out.emit(checks, (o, v) => {
        o.heading('Doctor report')
        for (const c of v) o.status(c.level, `${c.name}: ${c.detail}`)
      })
      return checks.some((c) => c.level === 'fail') ? ExitCode.Environment : ExitCode.Ok
    },
  },
]
