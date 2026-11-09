import type { CommandDef } from '../../cli/types.js'
import { formatCommand, runPlan, type OperationPlan } from '../../services/permissionService.js'
import { stepFromSpec, type PackageManagerAdapter } from '../../adapters/packageManagers/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { loadManagers, selectManager } from './service.js'

const M = 'packages'
const managerOpt = {
  flags: '--manager <id>',
  description: 'package manager to use (for example npm, apt, brew, winget)',
}

async function adapterFor(
  ctx: Parameters<CommandDef['run']>[0],
  opts: Record<string, unknown>,
): Promise<PackageManagerAdapter> {
  const detected = await loadManagers(ctx)
  return selectManager(detected, ctx.platform.id, opts['manager'] as string | undefined)
}

export const packageCommands: CommandDef[] = [
  {
    path: ['packages', 'managers'],
    summary: 'List package managers and whether they are installed',
    category: 'Packages',
    module: M,
    async run(ctx) {
      const detected = await loadManagers(ctx)
      const data = detected.map((d) => ({
        id: d.adapter.id,
        label: d.adapter.label,
        scope: d.adapter.scope,
        available: d.available,
        version: d.version,
        capabilities: d.adapter.capabilities,
      }))
      ctx.out.emit(data, (o, v) => {
        o.heading('Package managers')
        o.table(
          ['Manager', 'Scope', 'Status', 'Version', 'Operations'],
          v.map((m) => [
            m.id,
            m.scope,
            m.available ? 'installed' : 'not found',
            m.version ?? '',
            Object.entries(m.capabilities)
              .filter(([, on]) => on)
              .map(([k]) => k)
              .join(' '),
          ]),
        )
      })
    },
  },
  {
    path: ['packages', 'search'],
    summary: 'Search for packages',
    category: 'Packages',
    module: M,
    args: [{ name: 'query', required: true }],
    options: [managerOpt],
    async run(ctx, { args, opts }) {
      const adapter = await adapterFor(ctx, opts)
      const results = await adapter.search(args[0] ?? '')
      ctx.out.emit({ manager: adapter.id, results }, (o) => {
        o.heading(`Search results from ${adapter.label}`)
        o.table(
          ['Package', 'Version', 'Description'],
          results.slice(0, 40).map((r) => [r.id, r.version ?? '', r.description ?? '']),
        )
      })
    },
  },
  {
    path: ['packages', 'list'],
    summary: 'List installed packages',
    category: 'Packages',
    module: M,
    options: [managerOpt],
    async run(ctx, { opts }) {
      const adapter = await adapterFor(ctx, opts)
      const list = await adapter.listInstalled()
      ctx.out.emit({ manager: adapter.id, packages: list }, (o) => {
        o.heading(`${list.length} packages installed with ${adapter.label}`)
        o.table(
          ['Package', 'Version'],
          list.map((p) => [p.id, p.version]),
        )
      })
    },
  },
  {
    path: ['packages', 'outdated'],
    summary: 'List packages with newer versions available',
    category: 'Packages',
    module: M,
    options: [managerOpt],
    async run(ctx, { opts }) {
      const adapter = await adapterFor(ctx, opts)
      const list = await adapter.getUpdates()
      ctx.out.emit({ manager: adapter.id, updates: list }, (o) => {
        o.heading(`${list.length} updates available from ${adapter.label}`)
        o.table(
          ['Package', 'Installed', 'Latest'],
          list.map((p) => [p.id, p.current, p.latest]),
        )
      })
    },
  },
  {
    path: ['packages', 'info'],
    summary: 'Show details for a package',
    category: 'Packages',
    module: M,
    args: [{ name: 'package', required: true }],
    options: [managerOpt],
    async run(ctx, { args, opts }) {
      const adapter = await adapterFor(ctx, opts)
      const text = await adapter.info(args[0] ?? '')
      ctx.out.emit({ manager: adapter.id, info: text }, (o) => o.essential(text))
    },
  },
  {
    path: ['packages', 'install'],
    summary: 'Install a package after showing a plan',
    category: 'Packages',
    module: M,
    mutating: true,
    args: [{ name: 'package', required: true }],
    options: [
      managerOpt,
      { flags: '--cask', description: 'Homebrew cask (graphical application)' },
    ],
    async run(ctx, { args, opts }) {
      const adapter = await adapterFor(ctx, opts)
      const req = { id: args[0] ?? '', cask: Boolean(opts['cask']) }
      let already = false
      if (adapter.capabilities.list) {
        try {
          already = (await adapter.listInstalled()).some(
            (p) => p.id.toLowerCase() === req.id.toLowerCase(),
          )
        } catch {
          already = false
        }
      }
      if (already) {
        ctx.out.emit({ installed: true, id: req.id }, (o) =>
          o.status(
            'skip',
            `${req.id} is already installed with ${adapter.label}. Use "packages upgrade ${req.id}" to update it.`,
          ),
        )
        return
      }
      const spec = adapter.planInstall(req)
      const plan: OperationPlan = {
        title: `Install ${req.id} with ${adapter.label}`,
        kind: 'install',
        risk: spec.elevated ? 'high' : 'medium',
        steps: [stepFromSpec(`Install ${req.id}`, spec)],
      }
      const outcome = await runPlan(ctx, plan, () =>
        adapter.install(req, { dryRun: false, interactive: ctx.interactive }),
      )
      report(ctx, outcome.result, outcome.decision)
    },
  },
  {
    path: ['packages', 'upgrade'],
    summary: 'Upgrade one package, or all for managers that support it',
    category: 'Packages',
    module: M,
    mutating: true,
    args: [{ name: 'package', required: false }],
    options: [managerOpt],
    async run(ctx, { args, opts }) {
      const adapter = await adapterFor(ctx, opts)
      const req = args[0] ? { id: args[0] } : undefined
      const spec = adapter.planUpgrade(req)
      const plan: OperationPlan = {
        title: `Upgrade ${req?.id ?? 'all packages'} with ${adapter.label}`,
        kind: 'upgrade',
        risk: req ? 'medium' : 'high',
        steps: [stepFromSpec(`Upgrade ${req?.id ?? 'everything the manager controls'}`, spec)],
      }
      const outcome = await runPlan(ctx, plan, () =>
        adapter.upgrade(req, { dryRun: false, interactive: ctx.interactive }),
      )
      report(ctx, outcome.result, outcome.decision)
    },
  },
  {
    path: ['packages', 'remove'],
    summary: 'Remove a package after showing a plan',
    category: 'Packages',
    module: M,
    mutating: true,
    args: [{ name: 'package', required: true }],
    options: [
      managerOpt,
      { flags: '--cask', description: 'Homebrew cask (graphical application)' },
    ],
    async run(ctx, { args, opts }) {
      const adapter = await adapterFor(ctx, opts)
      const req = { id: args[0] ?? '', cask: Boolean(opts['cask']) }
      const spec = adapter.planRemove(req)
      const plan: OperationPlan = {
        title: `Remove ${req.id} with ${adapter.label}`,
        kind: 'remove',
        risk: 'high',
        steps: [{ ...stepFromSpec(`Remove ${req.id}`, spec), reversible: false }],
      }
      const outcome = await runPlan(ctx, plan, () =>
        adapter.remove(req, { dryRun: false, interactive: ctx.interactive }),
      )
      report(ctx, outcome.result, outcome.decision)
    },
  },
]

function report(
  ctx: Parameters<CommandDef['run']>[0],
  result:
    | {
        ok: boolean
        exitCode: number | null
        output: string
        step: Parameters<typeof formatCommand>[0]
      }
    | undefined,
  decision: string,
): void {
  if (decision !== 'approved' || !result) return
  if (ctx.out.json) {
    ctx.out.data({ ok: result.ok, exitCode: result.exitCode, command: formatCommand(result.step) })
  } else if (result.ok) {
    ctx.out.status('ok', 'Finished. Open a new terminal if the command is not found yet.')
  } else {
    ctx.out.status('fail', `Command exited with code ${result.exitCode ?? 'none'}`)
    if (result.output) ctx.out.line(result.output.slice(-1500))
  }
  if (!result.ok) throw new DocError('The package operation failed.', ExitCode.General)
}
