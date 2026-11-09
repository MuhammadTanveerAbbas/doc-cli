import path from 'node:path'
import type { CommandDef } from '../../cli/types.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan, type OperationPlan } from '../../services/permissionService.js'
import { loadManagers } from '../packages/service.js'
import { catalog, findTool, profiles, type Profile } from './catalog.js'
import { planSetup, resolveToolIds, type SetupPlan } from './planner.js'
import {
  detectAll,
  detectTool,
  listSavedProfiles,
  readProfileFile,
  saveProfile,
} from './service.js'

const M = 'developer-setup'

interface SetupOptions {
  profile?: string
  tools?: string[]
  allowGlobalWebpack?: boolean
  fromFile?: string
}

function pickProfile(id: string): Profile {
  const p = profiles.find((x) => x.id === id)
  if (!p)
    throw new DocError(
      `Unknown profile: ${id}`,
      ExitCode.Usage,
      `Known profiles: ${profiles.map((x) => x.id).join(', ')}`,
    )
  return p
}

async function chooseTools(
  ctx: AppContext,
  opts: SetupOptions,
  installed: Record<string, { installed: boolean; version?: string }>,
): Promise<string[]> {
  if (opts.fromFile) return readProfileFile(opts.fromFile).tools
  const extra = opts.tools ?? []
  if (opts.profile) {
    const p = pickProfile(opts.profile)
    let chosen = [...p.tools, ...extra]
    if (p.requireOneOf && !p.requireOneOf.some((t) => chosen.includes(t))) {
      if (!ctx.interactive)
        throw new DocError(
          `Profile ${p.id} needs one of: ${p.requireOneOf.join(', ')}`,
          ExitCode.Usage,
          'Add one with --tool <id>.',
        )
      const pick = await ctx.prompter.select(
        'Choose a runtime for this profile',
        p.requireOneOf.map((t) => ({ name: findTool(t)?.name ?? t, value: t })),
      )
      chosen = [...chosen, pick]
    }
    if (!ctx.interactive) return chosen
    return interactivePick(ctx, chosen, installed)
  }
  if (extra.length) return extra
  if (!ctx.interactive)
    throw new DocError(
      'Choose tools with --profile <id> or --tool <id>.',
      ExitCode.Usage,
      'Run "doc-cli setup list" to see choices.',
    )
  const choice = await ctx.prompter.select<string>(
    'Start from a profile or choose tools yourself',
    [
      ...profiles.map((p) => ({ name: `${p.name}: ${p.description}`, value: p.id })),
      { name: 'Custom: pick every tool myself', value: 'custom' },
    ],
  )
  if (choice === 'custom') return interactivePick(ctx, [], installed)
  return interactivePick(ctx, pickProfile(choice).tools, installed)
}

async function interactivePick(
  ctx: AppContext,
  preselected: string[],
  installed: Record<string, { installed: boolean; version?: string }>,
): Promise<string[]> {
  const picks = await ctx.prompter.checkbox<string>(
    'Select tools (space toggles, enter confirms)',
    catalog.map((t) => {
      const s = installed[t.id]
      const mark = s?.installed ? ` [installed${s.version ? ' ' + s.version : ''}]` : ''
      return {
        name: `${t.category}: ${t.name}${mark}`,
        value: t.id,
        checked: preselected.includes(t.id),
      }
    }),
  )
  return picks
}

function showPlan(ctx: AppContext, plan: SetupPlan): void {
  const o = ctx.out
  if (plan.alreadyInstalled.length) {
    o.heading('Already installed (left unchanged)')
    for (const a of plan.alreadyInstalled)
      o.status('skip', `${findTool(a.tool)?.name ?? a.tool}${a.version ? ' ' + a.version : ''}`)
  }
  if (plan.manual.length) {
    o.heading('Manual steps (DOC CLI will not run these)')
    for (const m of plan.manual)
      o.line(`  ${findTool(m.tool)?.name ?? m.tool}: ${m.instructions}\n     ${m.url}`)
  }
  if (plan.unavailable.length) {
    o.heading('No install route found')
    for (const u of plan.unavailable)
      o.status('warn', `${findTool(u.tool)?.name ?? u.tool}: ${u.reason}`)
  }
  for (const n of plan.notes) o.line(o.style.muted(`  Note: ${n}`))
  if (plan.items.length) {
    o.line(
      o.style.warn(
        '  Install routes are marked untested until verified on each platform. Review each command.',
      ),
    )
  }
}

export interface SetupResult {
  installed: string[]
  failed: Array<{ tool: string; reason: string }>
  manual: SetupPlan['manual']
  unavailable: SetupPlan['unavailable']
  alreadyInstalled: SetupPlan['alreadyInstalled']
}

export async function runSetup(ctx: AppContext, opts: SetupOptions): Promise<SetupResult> {
  const managers = await loadManagers(ctx)
  const detected = await detectAll(ctx)
  const selected = resolveToolIds(await chooseTools(ctx, opts, detected))
  if (selected.length === 0) throw new DocError('No tools selected.', ExitCode.Usage)
  const plan = planSetup({
    selected,
    detected,
    managers,
    platform: ctx.platform,
    ...(opts.allowGlobalWebpack ? { allowGlobalProjectTools: true } : {}),
  })
  showPlan(ctx, plan)
  const result: SetupResult = {
    installed: [],
    failed: [],
    manual: plan.manual,
    unavailable: plan.unavailable,
    alreadyInstalled: plan.alreadyInstalled,
  }
  if (plan.items.length === 0) {
    ctx.out.emit(result, (o) => o.status('ok', 'Nothing to install.'))
    return result
  }
  const op: OperationPlan = {
    title: `Install ${plan.items.length} developer tool(s)`,
    kind: 'install',
    risk: plan.items.some((i) => i.spec.elevated) ? 'high' : 'medium',
    steps: plan.items.map((i) => ({
      ...i.step,
      description: `${i.step.description}${i.note ? ` (${i.note})` : ''}`,
    })),
  }
  const outcome = await runPlan(ctx, op, async () => {
    for (const item of plan.items) {
      ctx.out.line(`Installing ${item.name}...`)
      const r = await ctx.runner.run(item.spec.executable, item.spec.args, {
        timeoutMs: 15 * 60_000,
      })
      if (!r.ok) {
        result.failed.push({
          tool: item.tool,
          reason: (r.stderr || r.stdout).trim().slice(-300) || `exit code ${r.exitCode}`,
        })
        ctx.out.status('fail', `${item.name} failed`)
        continue
      }
      const tool = findTool(item.tool)
      const check = tool ? await detectTool(ctx, tool) : { installed: false, detectable: false }
      if (check.installed || !check.detectable) {
        result.installed.push(item.tool)
        ctx.out.status(
          'ok',
          `${item.name} installed${check.detectable ? ` (${check.version ?? 'version unknown'})` : ', not verifiable by command'}`,
        )
      } else {
        result.installed.push(item.tool)
        ctx.out.status(
          'warn',
          `${item.name} installed but not found on PATH yet. Open a new terminal.`,
        )
      }
    }
    return result
  })
  if (outcome.decision === 'approved') {
    saveProfile(ctx.dirs.profiles, 'last', selected)
    ctx.out.line(
      `\nSaved this selection as profile "last". Export it with "doc-cli setup export <file>".`,
    )
    if (result.failed.length) {
      ctx.out.line(
        'Some installs failed. Fix the cause and run the same command again, finished tools are skipped.',
      )
    }
  }
  if (ctx.out.json) ctx.out.data(result)
  if (result.failed.length)
    throw new DocError(`${result.failed.length} install(s) failed.`, ExitCode.General)
  return result
}

const setupOptions = [
  {
    flags: '--profile <id>',
    description: 'start from a profile (web, python, fullstack, minimal)',
  },
  { flags: '--tool <id...>', description: 'add specific tools' },
  { flags: '--allow-global-webpack', description: 'allow a global webpack install' },
]

function fromOpts(opts: Record<string, unknown>): SetupOptions {
  const out: SetupOptions = {}
  if (typeof opts['profile'] === 'string') out.profile = opts['profile']
  if (Array.isArray(opts['tool'])) out.tools = opts['tool'] as string[]
  else if (typeof opts['tool'] === 'string') out.tools = [opts['tool']]
  if (opts['allowGlobalWebpack']) out.allowGlobalWebpack = true
  return out
}

export const setupCommands: CommandDef[] = [
  {
    path: ['setup'],
    summary: 'Developer starter kit wizard',
    category: 'Developer Setup',
    module: M,
    mutating: true,
    options: setupOptions,
    run: (ctx, { opts }) => runSetup(ctx, fromOpts(opts)).then(() => undefined),
  },
  {
    path: ['setup', 'developer'],
    summary: 'Choose and install developer tools with a plan',
    category: 'Developer Setup',
    module: M,
    mutating: true,
    options: setupOptions,
    run: (ctx, { opts }) => runSetup(ctx, fromOpts(opts)).then(() => undefined),
  },
  {
    path: ['setup', 'list'],
    summary: 'List starter kit tools and what is installed',
    category: 'Developer Setup',
    module: M,
    async run(ctx) {
      const detected = await detectAll(ctx)
      const rows = catalog.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        installed: detected[t.id]?.installed ?? false,
        version: detected[t.id]?.version ?? null,
        detectable: detected[t.id]?.detectable ?? false,
      }))
      ctx.out.emit(rows, (o, v) => {
        o.heading('Starter kit')
        o.table(
          ['Id', 'Tool', 'Category', 'Status'],
          v.map((r) => [
            r.id,
            r.name,
            r.category,
            !r.detectable
              ? 'cannot detect'
              : r.installed
                ? `installed ${r.version ?? ''}`.trim()
                : 'not installed',
          ]),
        )
      })
    },
  },
  {
    path: ['setup', 'profile', 'list'],
    summary: 'List built in and saved profiles',
    category: 'Developer Setup',
    module: M,
    async run(ctx) {
      const saved = listSavedProfiles(ctx.dirs.profiles)
      ctx.out.emit({ builtIn: profiles, saved }, (o) => {
        o.heading('Profiles')
        o.table(
          ['Id', 'Name', 'Kind'],
          [
            ...profiles.map((p) => [p.id, p.name, 'built in']),
            ...saved.map((s) => [s.name, s.name, 'saved']),
          ],
        )
      })
    },
  },
  {
    path: ['setup', 'profile', 'show'],
    summary: 'Show the tools in a profile',
    category: 'Developer Setup',
    module: M,
    args: [{ name: 'name', required: true }],
    async run(ctx, { args }) {
      const id = args[0] ?? ''
      const builtIn = profiles.find((p) => p.id === id)
      const saved = listSavedProfiles(ctx.dirs.profiles).find((s) => s.name === id)
      if (!builtIn && !saved) throw new DocError(`No profile named ${id}`, ExitCode.Usage)
      const tools = builtIn ? builtIn.tools : (saved?.tools ?? [])
      ctx.out.emit({ id, tools }, (o) => {
        o.heading(`Profile ${id}`)
        if (builtIn) o.line(builtIn.description)
        for (const t of tools) o.line(`  ${findTool(t)?.name ?? t}`)
      })
    },
  },
  {
    path: ['setup', 'export'],
    summary: 'Write the last selection to a profile file',
    category: 'Developer Setup',
    module: M,
    args: [{ name: 'file', required: true }],
    options: [
      {
        flags: '--profile <id>',
        description: 'export a built in or saved profile instead of "last"',
      },
    ],
    async run(ctx, { args, opts }) {
      const id = typeof opts['profile'] === 'string' ? opts['profile'] : 'last'
      const tools =
        profiles.find((p) => p.id === id)?.tools ??
        listSavedProfiles(ctx.dirs.profiles).find((s) => s.name === id)?.tools
      if (!tools)
        throw new DocError(
          `No profile named ${id}. Run a setup first or pass --profile.`,
          ExitCode.Usage,
        )
      const target = path.resolve(args[0] ?? '')
      const fs = await import('node:fs')
      fs.writeFileSync(
        target,
        JSON.stringify(
          { version: 1, name: id, tools, createdAt: new Date().toISOString() },
          null,
          2,
        ) + '\n',
      )
      ctx.out.emit({ file: target, tools }, (o) => o.status('ok', `Wrote ${target}`))
    },
  },
  {
    path: ['setup', 'import'],
    summary: 'Plan an install from a profile file',
    category: 'Developer Setup',
    module: M,
    mutating: true,
    args: [{ name: 'file', required: true }],
    async run(ctx, { args }) {
      await runSetup(ctx, { fromFile: path.resolve(args[0] ?? '') })
    },
  },
]
