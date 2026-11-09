import { createContext, type BootstrapOverrides } from '../core/bootstrap.js'
import type { AppContext, GlobalOptions } from '../core/context.js'
import { DocError, ExitCode, errorMessage } from '../core/errors.js'
import { newOpState } from '../services/historyService.js'
import { commandName, type CommandDef, type CommandInput } from './types.js'

export interface RunEnv {
  rawArgv: string[]
  overrides?: BootstrapOverrides
  contextFactory?: (opts: Partial<GlobalOptions>) => AppContext
}

export async function executeCommand(
  def: CommandDef,
  input: CommandInput,
  globals: Partial<GlobalOptions>,
  env: RunEnv,
): Promise<number> {
  let ctx: AppContext
  try {
    ctx = env.contextFactory ? env.contextFactory(globals) : createContext(globals, env.overrides)
  } catch (err) {
    process.stderr.write(`[FAIL] ${errorMessage(err)}\n`)
    if (err instanceof DocError && err.hint) process.stderr.write(`Hint: ${err.hint}\n`)
    return err instanceof DocError ? err.exitCode : ExitCode.General
  }
  ctx.state = newOpState()
  const started = Date.now()
  let exitCode: number = ExitCode.Ok
  let errText: string | undefined
  try {
    const result = await def.run(ctx, input)
    if (typeof result === 'number') exitCode = result
  } catch (err) {
    errText = errorMessage(err)
    if (err instanceof DocError) {
      exitCode = err.exitCode
      if (ctx.out.json) {
        ctx.out.data({
          error: { message: err.message, exitCode: err.exitCode, hint: err.hint ?? null },
        })
      } else {
        ctx.out.error(err.message)
        if (err.hint) ctx.out.hint(err.hint)
      }
    } else {
      exitCode = ExitCode.General
      if (ctx.out.json) ctx.out.data({ error: { message: errText, exitCode } })
      else ctx.out.error(`Unexpected error: ${errText}`)
      if (ctx.opts.verbose && err instanceof Error && err.stack) ctx.out.debug(err.stack)
    }
  }
  try {
    ctx.history.record(
      {
        argv: env.rawArgv,
        module: def.module,
        operation: commandName(def),
        os: ctx.platform.id,
        arch: ctx.platform.arch,
        docCliVersion: ctx.version,
      },
      ctx.state,
      exitCode,
      Date.now() - started,
      errText,
    )
  } catch (err) {
    ctx.logger.warn(`Could not write history: ${errorMessage(err)}`)
  }
  return exitCode
}
