import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan, type OperationPlan } from '../../services/permissionService.js'
import { formatBytes } from '../../utils/formatting.js'
import { validateHttpsUrl } from '../../utils/validation.js'
import { downloadFile, fileNameFromUrl, readManifest } from './service.js'

export const downloadCommands: CommandDef[] = [
  {
    path: ['download'],
    summary: 'Download an https file, optionally verifying a SHA 256 checksum',
    category: 'Backup and Downloads',
    module: 'downloads',
    mutating: true,
    args: [{ name: 'url', required: true }],
    options: [{ flags: '--sha256 <hash>', description: 'expected SHA 256 checksum' }],
    async run(ctx, { args, opts }) {
      const url = validateHttpsUrl(args[0] ?? '')
      const expected = typeof opts['sha256'] === 'string' ? opts['sha256'] : undefined
      if (expected && !/^[a-fA-F0-9]{64}$/.test(expected))
        throw new DocError('--sha256 must be 64 hexadecimal characters', ExitCode.Usage)
      const plan: OperationPlan = {
        title: `Download ${url.hostname}${url.pathname}`,
        kind: 'download',
        risk: 'low',
        steps: [
          {
            description: expected
              ? 'Download and verify the checksum'
              : 'Download (no checksum given, integrity is not verified)',
            paths: [`${ctx.dirs.downloads}/${fileNameFromUrl(url)}`],
          },
        ],
        notes: expected ? [] : ['Provide --sha256 whenever the publisher lists a checksum.'],
      }
      const outcome = await runPlan(ctx, plan, () =>
        downloadFile(ctx.fetch, url, ctx.dirs.downloads, expected),
      )
      if (outcome.result) {
        const r = outcome.result
        ctx.out.emit(r, (o) => {
          o.status('ok', `Saved ${r.file} (${formatBytes(r.bytes)})`)
          o.kv([
            ['SHA 256', r.sha256],
            ['Checksum verified', r.verified ? 'yes' : 'no, none provided'],
          ])
        })
      }
    },
  },
  {
    path: ['downloads', 'list'],
    summary: 'List files downloaded by DOC CLI',
    category: 'Backup and Downloads',
    module: 'downloads',
    async run(ctx) {
      const rows = readManifest(ctx.dirs.downloads)
      ctx.out.emit(rows, (o, v) =>
        o.table(
          ['When', 'Size', 'Verified', 'File'],
          v.map((r) => [
            r.at.slice(0, 19),
            formatBytes(r.bytes),
            r.verified ? 'yes' : 'no',
            r.file,
          ]),
        ),
      )
    },
  },
]
