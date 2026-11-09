import { ConfigService } from './config.js'
import { defaultGlobalOptions, type AppContext, type GlobalOptions } from './context.js'
import { createLogger } from './logger.js'
import { resolveAppDirs } from './paths.js'
import { detectPlatform } from '../platform/detect.js'
import { ExecaProcessRunner } from '../services/processRunner.js'
import { HistoryService, newOpState } from '../services/historyService.js'
import { createStyler, shouldUseColor } from '../ui/colors.js'
import { Output } from '../ui/output.js'
import { createPrompter, NonInteractivePrompter } from '../ui/prompts.js'
import { terminalWidth } from '../ui/tables.js'
import { VERSION } from './version.js'

export interface BootstrapOverrides {
  env?: NodeJS.ProcessEnv
  runner?: AppContext['runner']
  prompter?: AppContext['prompter']
  platform?: AppContext['platform']
  interactive?: boolean
  stdout?: (s: string) => void
  stderr?: (s: string) => void
  fetch?: typeof fetch
  width?: number
}

export function createContext(
  partial: Partial<GlobalOptions> = {},
  overrides: BootstrapOverrides = {},
): AppContext {
  const opts: GlobalOptions = { ...defaultGlobalOptions, ...partial }
  const env = overrides.env ?? process.env
  const dirs = resolveAppDirs({ env })
  const config = new ConfigService(dirs.configFile)
  const cfg = config.load()
  const isTTY = Boolean(process.stdout.isTTY)
  const interactive =
    overrides.interactive ??
    (Boolean(process.stdin.isTTY) &&
      isTTY &&
      !opts.nonInteractive &&
      !opts.json &&
      env['TERM'] !== 'dumb')
  const color = shouldUseColor({
    colorOption: opts.color,
    configColor: cfg.ui.color,
    theme: cfg.ui.theme,
    env,
    isTTY,
  })
  const styler = createStyler(color, cfg.ui.theme === 'light')
  const out = new Output({
    json: opts.json,
    quiet: opts.quiet,
    verbose: opts.verbose,
    styler,
    width: overrides.width ?? terminalWidth(),
    ...(overrides.stdout ? { stdout: overrides.stdout } : {}),
    ...(overrides.stderr ? { stderr: overrides.stderr } : {}),
  })
  const logger = createLogger(opts.verbose ? 'debug' : 'warn', (l) =>
    (overrides.stderr ?? ((s: string) => void process.stderr.write(s)))(l),
  )
  const history = new HistoryService(dirs.historyFile, dirs.auditFile, () => config.load().history)
  return {
    version: VERSION,
    opts,
    dirs,
    config,
    logger,
    out,
    prompter: overrides.prompter ?? (interactive ? createPrompter() : new NonInteractivePrompter()),
    platform: overrides.platform ?? detectPlatform({ env }),
    runner: overrides.runner ?? new ExecaProcessRunner(),
    history,
    env,
    state: newOpState(),
    interactive,
    fetch: overrides.fetch ?? globalThis.fetch,
  }
}
