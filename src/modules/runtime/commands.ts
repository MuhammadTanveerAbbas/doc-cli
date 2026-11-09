import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { catalog, findTool } from '../developerSetup/catalog.js'
import { detectAll } from '../developerSetup/service.js'
import { validateSearchQuery } from '../../utils/validation.js'

const RUNTIMES = ['node', 'python', 'bun', 'git', 'docker']

export const runtimeCommands: CommandDef[] = [
  {
    path: ['runtime', 'list'],
    summary: 'List known language runtimes',
    category: 'Runtimes and Tools',
    module: 'runtime',
    async run(ctx) {
      const d = await detectAll(ctx, RUNTIMES)
      const rows = RUNTIMES.map((id) => ({
        id,
        name: findTool(id)?.name ?? id,
        installed: d[id]?.installed ?? false,
        version: d[id]?.version ?? null,
      }))
      ctx.out.emit(rows, (o, v) => {
        o.heading('Runtimes')
        o.table(
          ['Id', 'Name', 'Status'],
          v.map((r) => [
            r.id,
            r.name,
            r.installed ? `installed ${r.version ?? ''}`.trim() : 'not installed',
          ]),
        )
      })
    },
  },
  {
    path: ['runtime', 'detect'],
    summary: 'Detect installed runtimes and their versions',
    category: 'Runtimes and Tools',
    module: 'runtime',
    async run(ctx) {
      const d = await detectAll(ctx, ['node', 'python', 'bun', 'pip', 'uv'])
      ctx.out.emit(d, (o, v) => {
        o.heading('Detected runtimes')
        for (const [id, s] of Object.entries(v))
          o.status(
            s.installed ? 'ok' : 'skip',
            `${id}: ${s.installed ? (s.version ?? 'installed') : 'not found'}`,
          )
      })
    },
  },
  {
    path: ['runtime', 'info'],
    summary: 'Show details for one runtime or tool',
    category: 'Runtimes and Tools',
    module: 'runtime',
    args: [{ name: 'name', required: true }],
    async run(ctx, { args }) {
      const tool = findTool(args[0] ?? '')
      if (!tool)
        throw new DocError(`Unknown tool: ${args[0]}`, ExitCode.Usage, 'Run "doc-cli tools list".')
      const exe = tool.probes[0]?.executable
      const path = exe ? await ctx.runner.which(exe) : null
      const d = await detectAll(ctx, [tool.id])
      const info = {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        installed: d[tool.id]?.installed ?? false,
        version: d[tool.id]?.version ?? null,
        location: path,
      }
      ctx.out.emit(info, (o, v) => {
        o.heading(v.name)
        o.kv([
          ['Description', v.description],
          ['Installed', v.installed ? 'yes' : 'no'],
          ['Version', v.version ?? 'unknown'],
          ['Location', v.location ?? 'not found on PATH'],
        ])
      })
    },
  },
]

export const toolsCommands: CommandDef[] = [
  {
    path: ['tools', 'list'],
    summary: 'List every tool in the starter kit catalog',
    category: 'Runtimes and Tools',
    module: 'tools',
    async run(ctx) {
      ctx.out.emit(
        catalog.map((t) => ({ id: t.id, name: t.name, category: t.category })),
        (o, v) => {
          o.heading('Catalog')
          o.table(
            ['Id', 'Tool', 'Category'],
            v.map((t) => [t.id, t.name, t.category]),
          )
        },
      )
    },
  },
  {
    path: ['tools', 'search'],
    summary: 'Search the starter kit catalog',
    category: 'Runtimes and Tools',
    module: 'tools',
    args: [{ name: 'query', required: true }],
    async run(ctx, { args }) {
      const q = validateSearchQuery(args[0] ?? '').toLowerCase()
      const hits = catalog.filter((t) =>
        `${t.id} ${t.name} ${t.category} ${t.description}`.toLowerCase().includes(q),
      )
      ctx.out.emit(
        hits.map((t) => ({ id: t.id, name: t.name, category: t.category })),
        (o, v) =>
          o.table(
            ['Id', 'Tool', 'Category'],
            v.map((t) => [t.id, t.name, t.category]),
          ),
      )
    },
  },
  {
    path: ['tools', 'check'],
    summary: 'Check which catalog tools are installed',
    category: 'Runtimes and Tools',
    module: 'tools',
    async run(ctx) {
      const d = await detectAll(ctx)
      ctx.out.emit(d, (o, v) => {
        o.heading('Tool check')
        for (const t of catalog) {
          const s = v[t.id]
          o.status(
            !s?.detectable ? 'skip' : s.installed ? 'ok' : 'warn',
            `${t.name}: ${!s?.detectable ? 'cannot detect' : s.installed ? (s.version ?? 'installed') : 'not installed'}`,
          )
        }
      })
    },
  },
]
