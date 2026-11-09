import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { writeFileAtomic } from '../../core/config.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { compareSemver } from '../../core/version.js'
import { safeJoin } from '../../services/filesystemService.js'

export const PermissionEnum = z.enum(['filesystem.read', 'filesystem.write', 'network', 'process'])

export const ManifestSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9][a-z0-9_]{1,40}$/, 'use lowercase letters, digits and underscores'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  publisher: z.string().min(1).max(80),
  description: z.string().max(300).default(''),
  compatibility: z.object({ minDocCliVersion: z.string().regex(/^\d+\.\d+\.\d+$/) }),
  permissions: z.array(PermissionEnum).default([]),
  commands: z
    .array(
      z.object({
        name: z.string().regex(/^[a-z0-9_]{1,40}$/),
        description: z.string().max(200).default(''),
        entry: z.string().min(1).max(200),
        args: z.array(z.string().max(200)).max(20).default([]),
      }),
    )
    .min(1)
    .max(20),
})
export type PluginManifest = z.infer<typeof ManifestSchema>

export interface PluginState {
  [name: string]: { enabled: boolean; installedAt: string; source: string; version: string }
}

export function readManifest(dir: string): PluginManifest {
  const file = path.join(dir, 'plugin.json')
  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new DocError(`No readable plugin.json in ${dir}`, ExitCode.Usage)
  }
  const parsed = ManifestSchema.safeParse(raw)
  if (!parsed.success) {
    throw new DocError(
      `Invalid plugin manifest: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      ExitCode.Verification,
    )
  }
  for (const c of parsed.data.commands) {
    safeJoin(dir, c.entry)
  }
  return parsed.data
}

export function checkCompatible(m: PluginManifest, docCliVersion: string): void {
  if (compareSemver(docCliVersion, m.compatibility.minDocCliVersion) < 0) {
    throw new DocError(
      `Plugin needs DOC CLI ${m.compatibility.minDocCliVersion} or newer.`,
      ExitCode.Unsupported,
    )
  }
}

export function readState(pluginsDir: string): PluginState {
  try {
    return JSON.parse(fs.readFileSync(path.join(pluginsDir, 'state.json'), 'utf8')) as PluginState
  } catch {
    return {}
  }
}

export function writeState(pluginsDir: string, state: PluginState): void {
  writeFileAtomic(path.join(pluginsDir, 'state.json'), JSON.stringify(state, null, 2) + '\n')
}

export function pluginDir(pluginsDir: string, name: string): string {
  return path.join(pluginsDir, 'installed', name)
}

export function copyDir(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true })
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.isSymbolicLink()) continue
    const src = path.join(from, e.name)
    const dest = path.join(to, e.name)
    if (e.isDirectory()) copyDir(src, dest)
    else if (e.isFile()) fs.copyFileSync(src, dest)
  }
}
