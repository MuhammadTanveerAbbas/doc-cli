import path from 'node:path'
import { parseArgv } from '../../cli/commandParser.js'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { allCommands } from '../../cli/commandRegistry.js'
import { REDACTED } from '../../utils/redact.js'

const M = 'history'

export const historyCommands: CommandDef[] = [
  {
    path: ['history'],
    summary: 'Show recent commands',
    category: 'History',
    module: M,
    options: [{ flags: '--limit <n>', description: 'records to show', default: '20' }],
    async run(ctx, { opts }) {
      const limit = Math.min(
        Math.max(Number.parseInt(String(opts['limit'] ?? '20'), 10) || 20, 1),
        500,
      )
      const rows = ctx.history.list(limit)
      ctx.out.emit(rows, (o, v) => {
        o.heading('Command history')
        o.table(
          ['Id', 'When', 'Exit', 'Command'],
          v.map((r) => [
            r.id,
            r.timestamp.slice(0, 19).replace('T', ' '),
            String(r.exitCode),
            r.argv.join(' ') || '(interactive)',
          ]),
        )
      })
    },
  },
  {
    path: ['history', 'search'],
    summary: 'Search history',
    category: 'History',
    module: M,
    args: [{ name: 'query', required: true }],
    async run(ctx, { args }) {
      const rows = ctx.history.search(args[0] ?? '')
      ctx.out.emit(rows, (o, v) =>
        o.table(
          ['Id', 'When', 'Exit', 'Command'],
          v.map((r) => [
            r.id,
            r.timestamp.slice(0, 19).replace('T', ' '),
            String(r.exitCode),
            r.argv.join(' '),
          ]),
        ),
      )
    },
  },
  {
    path: ['history', 'show'],
    summary: 'Show one history record',
    category: 'History',
    module: M,
    args: [{ name: 'id', required: true }],
    async run(ctx, { args }) {
      const r = ctx.history.get(args[0] ?? '')
      ctx.out.emit(r, (o, v) => {
        o.heading(`Record ${v.id}`)
        o.kv([
          ['Command', v.argv.join(' ')],
          ['Time', v.timestamp],
          ['Duration', `${v.durationMs} ms`],
          ['Exit code', String(v.exitCode)],
          ['Previewed', v.previewed ? 'yes' : 'no'],
          ['Confirmed', v.confirmed ? 'yes' : 'no'],
          ['Platform', `${v.os} ${v.arch}`],
          ['Version', v.docCliVersion],
          ['Summary', v.summary.join('; ') || 'none'],
          ['Error', v.error ?? 'none'],
        ])
      })
    },
  },
  {
    path: ['history', 'replay'],
    summary: 'Run a past command again after confirmation',
    category: 'History',
    module: M,
    mutating: true,
    args: [{ name: 'id', required: true }],
    async run(ctx, { args }) {
      const r = ctx.history.get(args[0] ?? '')
      if (r.argvRedacted || r.argv.includes(REDACTED))
        throw new DocError(
          'This record contains hidden secret values and cannot be replayed.',
          ExitCode.Unsupported,
        )
      if (r.argv[0] === 'history' && r.argv[1] === 'replay')
        throw new DocError('Replaying a replay is not allowed.', ExitCode.Usage)
      ctx.out.line(`Original command: doc-cli ${r.argv.join(' ')}`)
      ctx.out.line(
        'The system may have changed since then. The command will plan and ask again before changing anything.',
      )
      if (!ctx.interactive && !ctx.opts.yes)
        throw new DocError(
          'Replay needs confirmation.',
          ExitCode.Declined,
          'Repeat with --yes, the command itself still asks for its own approvals.',
        )
      if (ctx.interactive && !(await ctx.prompter.confirm('Replay this command?', false))) {
        ctx.out.line('Cancelled.')
        return
      }
      ctx.state.confirmed = true
      const flags = ctx.opts.nonInteractive ? ['--non-interactive'] : []
      const code = await parseArgv(allCommands(), [...r.argv, ...flags], {})
      return code
    },
  },
  {
    path: ['history', 'export'],
    summary: 'Write history to a JSON file',
    category: 'History',
    module: M,
    args: [{ name: 'file', required: true }],
    async run(ctx, { args }) {
      const file = path.resolve(args[0] ?? '')
      const n = ctx.history.exportTo(file)
      ctx.out.emit({ file, records: n }, (o) => o.status('ok', `Exported ${n} records to ${file}`))
    },
  },
  {
    path: ['history', 'clear'],
    summary: 'Delete all history records',
    category: 'History',
    module: M,
    mutating: true,
    async run(ctx) {
      if (!ctx.opts.yes) {
        if (!ctx.interactive)
          throw new DocError(
            'Clearing history needs confirmation.',
            ExitCode.Declined,
            'Repeat with --yes.',
          )
        if (
          !(await ctx.prompter.confirm('Delete all history records? This cannot be undone.', false))
        ) {
          ctx.out.line('Cancelled.')
          return
        }
      }
      const n = ctx.history.clear()
      ctx.out.emit({ cleared: n }, (o) => o.status('ok', `Removed ${n} records.`))
    },
  },
]
