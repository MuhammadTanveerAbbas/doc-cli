import type { AppDirs } from './paths.js'
import type { ConfigService } from './config.js'
import type { Logger } from './logger.js'
import type { Output } from '../ui/output.js'
import type { Prompter } from '../ui/prompts.js'
import type { PlatformInfo } from '../platform/detect.js'
import type { ProcessRunner } from '../services/processRunner.js'
import type { HistoryService, OpState } from '../services/historyService.js'

export interface GlobalOptions {
  json: boolean
  quiet: boolean
  verbose: boolean
  color: boolean | undefined
  nonInteractive: boolean
  yes: boolean
  dryRun: boolean
  allowElevation: boolean
}

export interface AppContext {
  version: string
  opts: GlobalOptions
  dirs: AppDirs
  config: ConfigService
  logger: Logger
  out: Output
  prompter: Prompter
  platform: PlatformInfo
  runner: ProcessRunner
  history: HistoryService
  env: NodeJS.ProcessEnv
  state: OpState
  interactive: boolean
  fetch: typeof fetch
}

export const defaultGlobalOptions: GlobalOptions = {
  json: false,
  quiet: false,
  verbose: false,
  color: undefined,
  nonInteractive: false,
  yes: false,
  dryRun: false,
  allowElevation: false,
}
