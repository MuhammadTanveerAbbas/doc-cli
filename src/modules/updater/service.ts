import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { writeFileAtomic } from '../../core/config.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { compareSemver } from '../../core/version.js'
import { sha256File } from '../../services/filesystemService.js'

export const PACKAGE_NAME = 'doc-cli-assistant'

export type InstallMethod = 'npm' | 'pnpm' | 'standalone' | 'source'

export interface UpdateCache {
  checkedAt: string
  latest: string
  channel: string
  url?: string
}

export function readUpdateCache(dir: string): UpdateCache | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'check.json'), 'utf8')) as UpdateCache
  } catch {
    return null
  }
}

export function writeUpdateCache(dir: string, cache: UpdateCache): void {
  writeFileAtomic(path.join(dir, 'check.json'), JSON.stringify(cache, null, 2) + '\n', 0o600)
}

export function cacheIsFresh(cache: UpdateCache | null, hours: number, now = Date.now()): boolean {
  if (!cache) return false
  return now - Date.parse(cache.checkedAt) < hours * 3_600_000
}

export function detectInstallMethod(scriptPath: string, execPath: string): InstallMethod {
  const norm = scriptPath.replace(/\\/g, '/').toLowerCase()
  const exec = path
    .basename(execPath)
    .toLowerCase()
    .replace(/\.exe$/, '')
  if (exec !== 'node' && exec !== 'nodejs' && exec !== 'bun') return 'standalone'
  if (norm.includes('/pnpm/') || norm.includes('/.pnpm/') || norm.includes('/pnpm-global/'))
    return 'pnpm'
  if (norm.includes('/node_modules/')) return 'npm'
  return 'source'
}

export const ReleaseSchema = z.object({
  tag_name: z.string(),
  prerelease: z.boolean().default(false),
  draft: z.boolean().default(false),
  html_url: z.string().optional(),
  body: z.string().nullish(),
  assets: z
    .array(
      z.object({ name: z.string(), browser_download_url: z.string(), size: z.number().optional() }),
    )
    .default([]),
})

export type Release = z.infer<typeof ReleaseSchema>

export function releaseVersion(r: Release): string {
  return r.tag_name.replace(/^v/, '')
}

export function selectRelease(releases: Release[], channel: string): Release | null {
  const live = releases.filter((r) => !r.draft)
  const matches = live.filter((r) => {
    const v = releaseVersion(r)
    if (channel === 'stable') return !r.prerelease && !v.includes('-')
    if (channel === 'beta') return r.prerelease && /beta/i.test(v)
    return r.prerelease && /nightly/i.test(v)
  })
  if (matches.length === 0) return null
  return matches.reduce((best, r) =>
    compareSemver(releaseVersion(r), releaseVersion(best)) > 0 ? r : best,
  )
}

export function repoFromConfig(repository: string): string | null {
  const repo = repository.trim()
  if (!/^[A-Za-z0-9_.\x2d]+\/[A-Za-z0-9_.\x2d]+$/.test(repo)) return null
  if (repo.toUpperCase().startsWith('OWNER/')) return null
  return repo
}

export interface UpdateCheckResult {
  configured: boolean
  channel: string
  current: string
  latest: string | null
  updateAvailable: boolean
  release: Release | null
  note?: string
}

export async function checkForUpdate(
  ctx: AppContext,
  timeoutMs = 8000,
): Promise<UpdateCheckResult> {
  const cfg = ctx.config.load().updates
  const base = { channel: cfg.channel, current: ctx.version }
  const repo = repoFromConfig(cfg.repository)
  if (!repo) {
    return {
      ...base,
      configured: false,
      latest: null,
      updateAvailable: false,
      release: null,
      note: 'No update source is configured. Set one with: doc-cli config set updates.repository owner/name',
    }
  }
  let res: Response
  try {
    res = await ctx.fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `doc-cli/${ctx.version}` },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw new DocError(
      `Could not reach the release server: ${(err as Error).message}`,
      ExitCode.Network,
    )
  }
  if (!res.ok) throw new DocError(`Release server answered ${res.status}`, ExitCode.Network)
  const parsed = z.array(ReleaseSchema).safeParse(await res.json())
  if (!parsed.success)
    throw new DocError('Release metadata has an unexpected format', ExitCode.Verification)
  const release = selectRelease(parsed.data, cfg.channel)
  if (!release) {
    return {
      ...base,
      configured: true,
      latest: null,
      updateAvailable: false,
      release: null,
      note: `No ${cfg.channel} release has been published.`,
    }
  }
  const latest = releaseVersion(release)
  const result: UpdateCheckResult = {
    ...base,
    configured: true,
    latest,
    updateAvailable: compareSemver(latest, ctx.version) > 0,
    release,
  }
  writeUpdateCache(ctx.dirs.updates, {
    checkedAt: new Date().toISOString(),
    latest,
    channel: cfg.channel,
    ...(release.html_url ? { url: release.html_url } : {}),
  })
  return result
}

export function standaloneAssetName(platform: string, arch: string): string {
  const ext = platform === 'windows' ? '.exe' : ''
  return `doc-cli-${platform}-${arch}${ext}`
}

export function parseChecksums(text: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = /^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line.trim())
    if (m) map.set((m[2] ?? '').trim(), (m[1] ?? '').toLowerCase())
  }
  return map
}

export async function verifyChecksum(file: string, expected: string): Promise<void> {
  const actual = await sha256File(file)
  if (actual !== expected.toLowerCase()) {
    throw new DocError(
      'Checksum verification failed. The downloaded file was rejected.',
      ExitCode.Verification,
      `Expected ${expected} but computed ${actual}.`,
    )
  }
}

export async function replaceExecutable(
  target: string,
  staged: string,
  verify: (file: string) => Promise<boolean>,
): Promise<{ backup: string }> {
  const backup = `${target}.previous`
  if (fs.existsSync(backup)) fs.rmSync(backup, { force: true })
  fs.renameSync(target, backup)
  try {
    fs.renameSync(staged, target)
    if (process.platform !== 'win32') fs.chmodSync(target, 0o755)
    const ok = await verify(target)
    if (!ok) throw new Error('verification failed')
  } catch (err) {
    fs.rmSync(target, { force: true })
    fs.renameSync(backup, target)
    throw new DocError(
      'The new executable did not pass verification. The previous version was restored.',
      ExitCode.Verification,
      (err as Error).message,
    )
  }
  return { backup }
}

export interface UpdateHistoryEntry {
  at: string
  from: string
  to: string
  method: string
  result: 'success' | 'failed' | 'rolled_back'
}

export function readUpdateHistory(dir: string): UpdateHistoryEntry[] {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dir, 'history.json'), 'utf8'),
    ) as UpdateHistoryEntry[]
  } catch {
    return []
  }
}

export function appendUpdateHistory(dir: string, entry: UpdateHistoryEntry): void {
  const all = readUpdateHistory(dir)
  all.push(entry)
  writeFileAtomic(path.join(dir, 'history.json'), JSON.stringify(all, null, 2) + '\n', 0o600)
}
