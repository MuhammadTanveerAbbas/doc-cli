import type { CommandDef } from '../../cli/types.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'

async function git(ctx: AppContext, args: string[]): Promise<string> {
  const r = await ctx.runner.run('git', args, { timeoutMs: 30_000 })
  if (r.notFound)
    throw new DocError(
      'Git is not installed.',
      ExitCode.Environment,
      'Run "doc-cli setup --tool git".',
    )
  if (!r.ok)
    throw new DocError(`git ${args[0]} failed: ${(r.stderr || r.stdout).trim().slice(0, 300)}`)
  return r.stdout
}

export const gitCommands: CommandDef[] = [
  {
    path: ['git', 'status'],
    summary: 'Show branch and working tree status (read only)',
    category: 'Projects and Git',
    module: 'git',
    async run(ctx) {
      const out = await git(ctx, ['status', '--porcelain=v1', '--branch'])
      const lines = out.split(/\r?\n/).filter(Boolean)
      const branch = (lines[0] ?? '').replace(/^## /, '')
      const changes = lines.slice(1)
      ctx.out.emit({ branch, changes }, (o) => {
        o.heading('Git status')
        o.kv([
          ['Branch', branch],
          ['Changed files', String(changes.length)],
        ])
        for (const c of changes.slice(0, 50)) o.line(`  ${c}`)
      })
    },
  },
  {
    path: ['git', 'branches'],
    summary: 'List local branches',
    category: 'Projects and Git',
    module: 'git',
    async run(ctx) {
      const out = await git(ctx, [
        'branch',
        '--format=%(HEAD)|%(refname:short)|%(objectname:short)|%(subject)',
      ])
      const rows = out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const [head, name, sha, ...subject] = l.split('|')
          return {
            current: head === '*',
            name: name ?? '',
            sha: sha ?? '',
            subject: subject.join('|'),
          }
        })
      ctx.out.emit(rows, (o, v) =>
        o.table(
          ['', 'Branch', 'Commit', 'Subject'],
          v.map((b) => [b.current ? '*' : '', b.name, b.sha, b.subject]),
        ),
      )
    },
  },
  {
    path: ['git', 'log'],
    summary: 'Show recent commits',
    category: 'Projects and Git',
    module: 'git',
    options: [{ flags: '--limit <n>', description: 'commits to show', default: '10' }],
    async run(ctx, { opts }) {
      const n = Math.min(Math.max(Number.parseInt(String(opts['limit'] ?? '10'), 10) || 10, 1), 200)
      const out = await git(ctx, ['log', `-n${n}`, '--format=%h|%an|%ad|%s', '--date=short'])
      const rows = out
        .split(/\r?\n/)
        .filter(Boolean)
        .map((l) => {
          const [sha, author, date, ...s] = l.split('|')
          return { sha: sha ?? '', author: author ?? '', date: date ?? '', subject: s.join('|') }
        })
      ctx.out.emit(rows, (o, v) =>
        o.table(
          ['Commit', 'Date', 'Author', 'Subject'],
          v.map((c) => [c.sha, c.date, c.author, c.subject]),
        ),
      )
    },
  },
]
