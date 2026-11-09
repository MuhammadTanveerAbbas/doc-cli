import readline from 'node:readline'
import { createContext } from '../core/bootstrap.js'
import { tokenize } from '../utils/formatting.js'
import { platformLabel } from '../platform/detect.js'
import { renderBanner } from '../ui/banner.js'
import { createPrompter } from '../ui/prompts.js'
import {
  checkForUpdate,
  cacheIsFresh,
  readUpdateCache,
  repoFromConfig,
} from '../modules/updater/service.js'
import { compareSemver } from '../core/version.js'
import { collectArgs, completer, pickCommand } from './commandPalette.js'
import { parseArgv } from './commandParser.js'
import type { CommandDef } from './types.js'

function readLine(prompt: string, defs: CommandDef[], history: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: completer(defs),
      history: [...history].reverse(),
      historySize: 200,
    })
    let answered = false
    rl.question(prompt, (a) => {
      answered = true
      rl.close()
      resolve(a)
    })
    rl.on('close', () => {
      if (!answered) resolve(null)
    })
  })
}

export async function startShell(defs: CommandDef[]): Promise<number> {
  const ctx = createContext({})
  const cfg = ctx.config.load()
  const cache = readUpdateCache(ctx.dirs.updates)
  const cachedNote =
    cache && compareSemver(cache.latest, ctx.version) > 0
      ? `Update available: ${cache.latest}. Run "update".`
      : undefined
  ctx.out.essential(
    renderBanner({
      version: ctx.version,
      platformLabel: platformLabel(ctx.platform),
      width: ctx.out.width,
      compact: cfg.ui.compact,
      ascii: cfg.ui.ascii || process.env['TERM'] === 'dumb',
      updateNote: cachedNote,
      styler: ctx.out.style,
    }),
  )
  ctx.out.essential(
    '\nCommon commands: system info, packages managers, setup, performance report, history, doctor, help',
  )
  ctx.out.essential('Type / for the command palette, help for all commands, exit to leave.\n')

  let pending: string | null = null
  if (
    cfg.updates.checkOnStartup &&
    repoFromConfig(cfg.updates.repository) &&
    !cacheIsFresh(cache, cfg.updates.checkIntervalHours)
  ) {
    checkForUpdate(ctx, 3000)
      .then((r) => {
        if (r.updateAvailable && r.latest) pending = `Update available: ${r.latest}. Run "update".`
      })
      .catch(() => undefined)
  }

  const history: string[] = []
  const prompter = createPrompter()
  for (;;) {
    if (pending) {
      ctx.out.essential(ctx.out.style.warn(pending))
      pending = null
    }
    const raw = await readLine('doc-cli> ', defs, history)
    if (raw === null) return 0
    const line = raw.trim()
    if (!line) continue
    history.push(line)
    if (['exit', 'quit', ':q'].includes(line)) return 0
    let argv: string[]
    if (line.startsWith('/')) {
      const term = line.slice(1).trim()
      const exact = term
        ? defs.find(
            (d) => d.path.join(' ') === term && !(d.args ?? []).some((a) => a.required !== false),
          )
        : undefined
      if (exact) argv = [...exact.path]
      else {
        const def = await pickCommand(prompter, defs)
        if (!def) continue
        try {
          argv = await collectArgs(prompter, def)
        } catch {
          continue
        }
      }
    } else {
      argv = tokenize(line)
      if (argv[0] === 'doc-cli') argv.shift()
    }
    try {
      await parseArgv(defs, argv, {})
    } catch (err) {
      process.stderr.write(`[FAIL] ${(err as Error).message}\n`)
    }
  }
}
