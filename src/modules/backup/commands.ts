import fs from 'node:fs'
import path from 'node:path'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan } from '../../services/permissionService.js'
import { formatBytes } from '../../utils/formatting.js'
import { createBackup, listBackups, loadBackup, restoreBackup, scanSource } from './service.js'

const M = 'backup'

export const backupCommands: CommandDef[] = [
  {
    path: ['backup', 'create'],
    summary: 'Copy a folder into the DOC CLI backup store with checksums',
    category: 'Backup and Downloads',
    module: M,
    mutating: true,
    options: [{ flags: '--path <dir>', description: 'folder to back up (required)' }],
    async run(ctx, { opts }) {
      if (typeof opts['path'] !== 'string')
        throw new DocError('Choose a folder with --path <dir>.', ExitCode.Usage)
      const source = path.resolve(opts['path'])
      if (!fs.existsSync(source) || !fs.statSync(source).isDirectory())
        throw new DocError(`Not a folder: ${source}`, ExitCode.Usage)
      const files = scanSource(source)
      const bytes = files.reduce((n, f) => n + f.size, 0)
      const outcome = await runPlan(
        ctx,
        {
          title: `Back up ${source}`,
          kind: 'backup',
          risk: 'low',
          steps: [
            {
              description: `Copy ${files.length} files (${formatBytes(bytes)}) and record checksums`,
              paths: [ctx.dirs.backups],
            },
          ],
          notes: [
            'node_modules, .git, .venv, __pycache__ and dist folders are skipped. Symbolic links are skipped.',
          ],
        },
        () => createBackup(source, ctx.dirs.backups),
      )
      if (outcome.result) {
        const m = outcome.result
        ctx.out.emit({ id: m.id, files: m.files.length, bytes: m.totalBytes }, (o) =>
          o.status('ok', `Backup ${m.id} created with ${m.files.length} files.`),
        )
      }
    },
  },
  {
    path: ['backup', 'list'],
    summary: 'List stored backups',
    category: 'Backup and Downloads',
    module: M,
    async run(ctx) {
      const rows = listBackups(ctx.dirs.backups)
      ctx.out.emit(
        rows.map((r) => ({
          id: r.id,
          source: r.source,
          createdAt: r.createdAt,
          files: r.files.length,
          bytes: r.totalBytes,
        })),
        (o, v) =>
          o.table(
            ['Id', 'Created', 'Files', 'Size', 'Source'],
            v.map((b) => [
              b.id,
              b.createdAt.slice(0, 19),
              String(b.files),
              formatBytes(b.bytes),
              b.source,
            ]),
          ),
      )
    },
  },
  {
    path: ['backup', 'restore'],
    summary: 'Restore a backup into a folder you choose',
    category: 'Backup and Downloads',
    module: M,
    mutating: true,
    args: [{ name: 'id', required: true }],
    options: [
      { flags: '--to <dir>', description: 'target folder (required)' },
      { flags: '--overwrite', description: 'replace existing files' },
    ],
    async run(ctx, { args, opts }) {
      if (typeof opts['to'] !== 'string')
        throw new DocError('Choose a target folder with --to <dir>.', ExitCode.Usage)
      const target = path.resolve(opts['to'])
      const m = loadBackup(ctx.dirs.backups, args[0] ?? '')
      const overwrite = Boolean(opts['overwrite'])
      const outcome = await runPlan(
        ctx,
        {
          title: `Restore backup ${m.id}`,
          kind: 'restore',
          risk: overwrite ? 'high' : 'medium',
          steps: [
            {
              description: `Verify checksums, then copy ${m.files.length} files${overwrite ? ', replacing existing files' : ', refusing to replace existing files'}`,
              paths: [target],
              reversible: !overwrite,
            },
          ],
        },
        () => restoreBackup(ctx.dirs.backups, m, target, overwrite),
      )
      if (outcome.result !== undefined)
        ctx.out.emit({ restored: outcome.result, target }, (o) =>
          o.status('ok', `Restored ${outcome.result} files to ${target}`),
        )
    },
  },
]
