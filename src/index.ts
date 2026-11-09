import { allCommands } from './cli/commandRegistry.js'
import { parseArgv } from './cli/commandParser.js'
import { startShell } from './cli/interactiveShell.js'
import { paletteChoices } from './cli/commandPalette.js'
import { ExitCode } from './core/errors.js'
import { createPrompter } from './ui/prompts.js'
import { collectArgs } from './cli/commandPalette.js'

process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0)
  throw err
})

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const defs = allCommands()
  const interactive =
    Boolean(process.stdin.isTTY && process.stdout.isTTY) && process.env['TERM'] !== 'dumb'
  if (argv.length === 0) {
    if (interactive) return startShell(defs)
    return parseArgv(defs, ['help'], {})
  }
  if (argv.length === 1 && argv[0] === '/') {
    if (!interactive) {
      process.stderr.write('The command palette needs an interactive terminal.\n')
      return ExitCode.Usage
    }
    const prompter = createPrompter()
    try {
      const def = await prompter.search('Command palette (type to filter, Ctrl+C closes)', (t) =>
        paletteChoices(defs, t),
      )
      return parseArgv(defs, await collectArgs(prompter, def), {})
    } catch {
      return ExitCode.Ok
    }
  }
  return parseArgv(defs, argv, {})
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (err: unknown) => {
    process.stderr.write(`[FAIL] ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = ExitCode.General
  },
)
