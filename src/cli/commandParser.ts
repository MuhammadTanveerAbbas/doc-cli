import { Command, CommanderError } from 'commander'
import type { GlobalOptions } from '../core/context.js'
import { ExitCode } from '../core/errors.js'
import { VERSION } from '../core/version.js'
import { executeCommand, type RunEnv } from './commandRunner.js'
import type { CommandDef } from './types.js'

export function globalsFrom(opts: Record<string, unknown>): Partial<GlobalOptions> {
  return {
    json: Boolean(opts['json']),
    quiet: Boolean(opts['quiet']),
    verbose: Boolean(opts['verbose']),
    color: opts['color'] === false ? false : undefined,
    nonInteractive: Boolean(opts['nonInteractive']),
    yes: Boolean(opts['yes']),
    dryRun: Boolean(opts['dryRun']),
    allowElevation: Boolean(opts['allowElevation']),
  }
}

export function buildProgram(
  defs: CommandDef[],
  env: RunEnv,
  setExit: (code: number) => void,
): Command {
  const program = new Command()
  program
    .name('doc-cli')
    .description('Cross platform developer and system maintenance assistant')
    .version(VERSION, '-V, --version', 'print the DOC CLI version')
    .option('--json', 'machine readable JSON output')
    .option('--quiet', 'reduce output')
    .option('--verbose', 'print diagnostics')
    .option('--no-color', 'disable color output')
    .option('--non-interactive', 'never prompt, fail instead of asking')
    .option('--yes', 'approve confirmations (not administrator elevation)')
    .option('--dry-run', 'show the plan and change nothing')
    .option('--allow-elevation', 'allow steps that need administrator rights, with --yes')
    .showHelpAfterError('(run "doc-cli help" for usage)')
    .configureOutput({
      writeErr: (s) => void process.stderr.write(s),
      writeOut: (s) => void process.stdout.write(s),
    })
    .exitOverride()

  const groups = new Map<string, Command>()
  const groupFor = (path: string[]): Command => {
    let parent = program
    const walked: string[] = []
    for (const part of path) {
      walked.push(part)
      const key = walked.join(' ')
      let node = groups.get(key)
      if (!node) {
        node = parent.command(part).description(`${part} commands`)
        node.exitOverride()
        groups.set(key, node)
      }
      parent = node
    }
    return parent
  }

  const hasChildren = (def: CommandDef) =>
    defs.some(
      (o) =>
        o !== def && o.path.length > def.path.length && def.path.every((p, i) => o.path[i] === p),
    )

  for (const def of defs) {
    const parentPath = def.path.slice(0, -1)
    const parent = parentPath.length ? groupFor(parentPath) : program
    const leafName = def.path[def.path.length - 1] as string
    let cmd = groups.get(def.path.join(' '))
    if (cmd) {
      cmd.description(def.summary)
    } else {
      cmd = parent.command(leafName).description(def.summary)
      cmd.exitOverride()
      if (hasChildren(def)) groups.set(def.path.join(' '), cmd)
    }
    for (const a of def.args ?? []) {
      const name = a.variadic ? `${a.name}...` : a.name
      cmd.argument(a.required === false ? `[${name}]` : `<${name}>`, a.description ?? '')
    }
    for (const o of def.options ?? []) {
      if (o.default !== undefined) cmd.option(o.flags, o.description, o.default as string)
      else cmd.option(o.flags, o.description)
    }
    cmd.action(async (...actionArgs: unknown[]) => {
      const command = actionArgs[actionArgs.length - 1] as Command
      const positional: string[] = []
      ;(def.args ?? []).forEach((a, i) => {
        const v = actionArgs[i]
        if (Array.isArray(v)) positional.push(...(v as string[]))
        else if (typeof v === 'string') positional.push(v)
        void a
      })
      const merged = { ...program.opts(), ...command.opts() } as Record<string, unknown>
      const code = await executeCommand(
        def,
        { args: positional, opts: command.opts() },
        globalsFrom(merged),
        env,
      )
      setExit(code)
    })
  }
  return program
}

export async function parseArgv(
  defs: CommandDef[],
  argv: string[],
  env: Omit<RunEnv, 'rawArgv'>,
): Promise<number> {
  let exit: number = ExitCode.Ok
  const program = buildProgram(defs, { ...env, rawArgv: argv }, (c) => (exit = c))
  try {
    await program.parseAsync(argv, { from: 'user' })
  } catch (err) {
    if (err instanceof CommanderError) {
      if (
        err.code === 'commander.helpDisplayed' ||
        err.code === 'commander.version' ||
        err.code === 'commander.help'
      )
        return ExitCode.Ok
      return ExitCode.Usage
    }
    throw err
  }
  return exit
}
