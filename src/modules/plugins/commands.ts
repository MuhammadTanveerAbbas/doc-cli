import fs from 'node:fs'
import path from 'node:path'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan } from '../../services/permissionService.js'
import { ExecaProcessRunner } from '../../services/processRunner.js'
import { safeJoin } from '../../services/filesystemService.js'
import {
  checkCompatible,
  copyDir,
  pluginDir,
  readManifest,
  readState,
  writeState,
} from './service.js'

const M = 'plugins'
const cat = 'AI and Plugins' as const

export const pluginCommands: CommandDef[] = [
  {
    path: ['plugin', 'list'],
    summary: 'List installed plugins',
    category: cat,
    module: M,
    async run(ctx) {
      const state = readState(ctx.dirs.plugins)
      const rows = Object.entries(state).map(([name, s]) => ({ name, ...s }))
      ctx.out.emit(rows, (o, v) =>
        o.table(
          ['Plugin', 'Version', 'Enabled', 'Source'],
          v.map((r) => [r.name, r.version, r.enabled ? 'yes' : 'no', r.source]),
        ),
      )
    },
  },
  {
    path: ['plugin', 'search'],
    summary: 'Search for plugins (no registry is configured in this release)',
    category: cat,
    module: M,
    args: [{ name: 'query', required: true }],
    async run(ctx) {
      ctx.out.emit({ results: [], note: 'No plugin registry exists yet.' }, (o) =>
        o.status(
          'skip',
          'No plugin registry is configured. Install from a local folder with "doc-cli plugin install <folder>".',
        ),
      )
    },
  },
  {
    path: ['plugin', 'install'],
    summary: 'Install a plugin from a local folder you trust',
    category: cat,
    module: M,
    mutating: true,
    args: [{ name: 'folder', required: true }],
    async run(ctx, { args }) {
      const src = path.resolve(args[0] ?? '')
      const manifest = readManifest(src)
      checkCompatible(manifest, ctx.version)
      const state = readState(ctx.dirs.plugins)
      if (state[manifest.name])
        throw new DocError(
          `Plugin ${manifest.name} is already installed.`,
          ExitCode.Usage,
          'Remove it first.',
        )
      ctx.out.heading(`Plugin ${manifest.name} ${manifest.version} by ${manifest.publisher}`)
      ctx.out.kv([
        ['Permissions requested', manifest.permissions.join(', ') || 'none'],
        ['Commands', manifest.commands.map((c) => c.name).join(', ')],
        ['Source', src],
      ])
      ctx.out.line(
        ctx.out.style.warn(
          '  Plugins run as normal programs with your user rights. DOC CLI does not sandbox them.',
        ),
      )
      const outcome = await runPlan(
        ctx,
        {
          title: `Install plugin ${manifest.name}`,
          kind: 'plugin',
          risk: manifest.permissions.length ? 'high' : 'medium',
          steps: [
            {
              description: `Copy the plugin into DOC CLI's plugin folder`,
              paths: [pluginDir(ctx.dirs.plugins, manifest.name)],
              reversible: true,
            },
          ],
        },
        async () => {
          copyDir(src, pluginDir(ctx.dirs.plugins, manifest.name))
          state[manifest.name] = {
            enabled: true,
            installedAt: new Date().toISOString(),
            source: src,
            version: manifest.version,
          }
          writeState(ctx.dirs.plugins, state)
        },
      )
      if (outcome.decision === 'approved') ctx.out.status('ok', `Installed ${manifest.name}.`)
    },
  },
  {
    path: ['plugin', 'enable'],
    summary: 'Enable an installed plugin',
    category: cat,
    module: M,
    mutating: true,
    args: [{ name: 'name', required: true }],
    async run(ctx, { args }) {
      const state = readState(ctx.dirs.plugins)
      const s = state[args[0] ?? '']
      if (!s) throw new DocError('No such plugin', ExitCode.Usage)
      s.enabled = true
      writeState(ctx.dirs.plugins, state)
      ctx.out.status('ok', `Enabled ${args[0]}.`)
    },
  },
  {
    path: ['plugin', 'disable'],
    summary: 'Disable an installed plugin',
    category: cat,
    module: M,
    mutating: true,
    args: [{ name: 'name', required: true }],
    async run(ctx, { args }) {
      const state = readState(ctx.dirs.plugins)
      const s = state[args[0] ?? '']
      if (!s) throw new DocError('No such plugin', ExitCode.Usage)
      s.enabled = false
      writeState(ctx.dirs.plugins, state)
      ctx.out.status('ok', `Disabled ${args[0]}.`)
    },
  },
  {
    path: ['plugin', 'remove'],
    summary: 'Remove an installed plugin',
    category: cat,
    module: M,
    mutating: true,
    args: [{ name: 'name', required: true }],
    async run(ctx, { args }) {
      const name = args[0] ?? ''
      const state = readState(ctx.dirs.plugins)
      if (!state[name]) throw new DocError('No such plugin', ExitCode.Usage)
      const dir = pluginDir(ctx.dirs.plugins, name)
      const outcome = await runPlan(
        ctx,
        {
          title: `Remove plugin ${name}`,
          kind: 'remove',
          risk: 'low',
          steps: [
            {
              description: 'Delete the plugin folder and its registration',
              paths: [dir],
              reversible: false,
            },
          ],
        },
        async () => {
          fs.rmSync(dir, { recursive: true, force: true })
          delete state[name]
          writeState(ctx.dirs.plugins, state)
        },
      )
      if (outcome.decision === 'approved') ctx.out.status('ok', `Removed ${name}.`)
    },
  },
  {
    path: ['plugin', 'run'],
    summary: 'Run a command provided by an enabled plugin',
    category: cat,
    module: M,
    mutating: true,
    args: [
      { name: 'name', required: true },
      { name: 'command', required: true },
      { name: 'extra', required: false, variadic: true },
    ],
    async run(ctx, { args }) {
      const [name = '', command = '', ...extra] = args
      const state = readState(ctx.dirs.plugins)
      if (!state[name]?.enabled)
        throw new DocError(`Plugin ${name} is not installed or not enabled.`, ExitCode.Usage)
      const dir = pluginDir(ctx.dirs.plugins, name)
      const manifest = readManifest(dir)
      const cmd = manifest.commands.find((c) => c.name === command)
      if (!cmd) throw new DocError(`Plugin ${name} has no command ${command}.`, ExitCode.Usage)
      const entry = safeJoin(dir, cmd.entry)
      const finalArgs = [...cmd.args, ...extra]
      const outcome = await runPlan(
        ctx,
        {
          title: `Run plugin command ${name} ${command}`,
          kind: 'plugin',
          risk: 'high',
          steps: [
            {
              description: `Run the plugin program (permissions declared: ${manifest.permissions.join(', ') || 'none'})`,
              executable: entry,
              args: finalArgs,
            },
          ],
        },
        async () => {
          const runner = new ExecaProcessRunner(null)
          const env: Record<string, string> = {}
          for (const k of ['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP']) {
            const v = ctx.env[k]
            if (v) env[k] = v
          }
          return runner.run(entry, finalArgs, { cwd: dir, env, timeoutMs: 120_000 })
        },
      )
      const r = outcome.result
      if (r) {
        ctx.out.emit({ exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr }, (o) => {
          if (r.stdout) o.essential(r.stdout)
          if (r.stderr) o.warn(r.stderr)
        })
        if (!r.ok) throw new DocError(`Plugin command exited with code ${r.exitCode ?? 'none'}`)
      }
    },
  },
]
