import {
  createAdapters,
  detectManagers,
  pickSystemManager,
  type DetectedManager,
} from '../../adapters/packageManagers/registry.js'
import type { PackageManagerAdapter } from '../../adapters/packageManagers/types.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'

export async function loadManagers(ctx: AppContext): Promise<DetectedManager[]> {
  return detectManagers(createAdapters(ctx.runner, ctx.platform))
}

export function selectManager(
  detected: DetectedManager[],
  platformId: string,
  requested?: string,
): PackageManagerAdapter {
  if (requested) {
    const hit = detected.find((d) => d.adapter.id === requested)
    if (!hit)
      throw new DocError(
        `Unknown package manager for this platform: ${requested}`,
        ExitCode.Usage,
        `Known: ${detected.map((d) => d.adapter.id).join(', ')}`,
      )
    if (!hit.available)
      throw new DocError(`${requested} is not installed on this system.`, ExitCode.Environment)
    return hit.adapter
  }
  const sys = pickSystemManager(detected, platformId)
  if (sys) return sys.adapter
  const lang = detected.find((d) => d.available)
  if (lang) return lang.adapter
  throw new DocError(
    'No supported package manager was found.',
    ExitCode.Environment,
    'Run "doc-cli packages managers" to see what was checked.',
  )
}
