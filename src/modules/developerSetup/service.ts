import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { writeFileAtomic } from '../../core/config.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { catalog, type ToolEntry } from './catalog.js'
import type { DetectedTool } from './planner.js'

export function parseVersion(text: string): string | undefined {
  const m = /(\d+\.\d+(?:\.\d+)?(?:[.\-+][0-9A-Za-z.]+)?)/.exec(text)
  return m ? m[1] : undefined
}

export async function detectTool(ctx: AppContext, tool: ToolEntry): Promise<DetectedTool> {
  if (tool.probes.length === 0) return { installed: false, detectable: false }
  for (const probe of tool.probes) {
    const r = await ctx.runner.run(probe.executable, probe.args, { timeoutMs: 10_000 })
    if (r.notFound) continue
    if (r.ok || (probe.args.length === 0 && r.exitCode !== null)) {
      const version = parseVersion(`${r.stdout}\n${r.stderr}`.split('\n')[0] ?? '')
      return { installed: true, detectable: true, ...(version ? { version } : {}) }
    }
  }
  return { installed: false, detectable: true }
}

export async function detectAll(
  ctx: AppContext,
  ids?: string[],
): Promise<Record<string, DetectedTool>> {
  const tools = ids ? catalog.filter((t) => ids.includes(t.id)) : catalog
  const entries = await Promise.all(
    tools.map(async (t) => [t.id, await detectTool(ctx, t)] as const),
  )
  return Object.fromEntries(entries)
}

export const SavedProfileSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  tools: z.array(z.string()).min(1),
  createdAt: z.string().optional(),
})
export type SavedProfile = z.infer<typeof SavedProfileSchema>

export function saveProfile(dir: string, name: string, tools: string[]): string {
  const file = path.join(dir, `${name}.json`)
  const data: SavedProfile = { version: 1, name, tools, createdAt: new Date().toISOString() }
  writeFileAtomic(file, JSON.stringify(data, null, 2) + '\n', 0o600)
  return file
}

export function readProfileFile(file: string): SavedProfile {
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new DocError(`Cannot read profile file: ${(err as Error).message}`, ExitCode.Usage)
  }
  const parsed = SavedProfileSchema.safeParse(raw)
  if (!parsed.success) throw new DocError('Profile file has an invalid format', ExitCode.Usage)
  const unknown = parsed.data.tools.filter((t) => !catalog.some((c) => c.id === t))
  if (unknown.length)
    throw new DocError(`Profile names unknown tools: ${unknown.join(', ')}`, ExitCode.Usage)
  return parsed.data
}

export function listSavedProfiles(dir: string): SavedProfile[] {
  if (!fs.existsSync(dir)) return []
  const out: SavedProfile[] = []
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    try {
      out.push(readProfileFile(path.join(dir, f)))
    } catch {
      continue
    }
  }
  return out
}
