import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DocError, ExitCode } from '../core/errors.js'

export type PlatformId = 'linux' | 'windows' | 'macos'

export interface PlatformInfo {
  id: PlatformId
  arch: string
  release: string
  distro?: string | undefined
  distroName?: string | undefined
  distroLike?: string[] | undefined
  distroVersion?: string | undefined
  isWsl: boolean
  isRoot: boolean
  shell: string
  homedir: string
  nodeVersion: string
}

export function mapPlatform(p: NodeJS.Platform): PlatformId {
  switch (p) {
    case 'linux':
      return 'linux'
    case 'win32':
      return 'windows'
    case 'darwin':
      return 'macos'
    default:
      throw new DocError(
        `Unsupported operating system: ${p}`,
        ExitCode.Unsupported,
        'DOC CLI supports Linux, Windows, and macOS.',
      )
  }
}

export interface OsRelease {
  id?: string
  name?: string
  versionId?: string
  idLike: string[]
}

export function parseOsRelease(text: string): OsRelease {
  const map = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim())
    if (!m) continue
    const raw = m[2] ?? ''
    map.set(m[1] ?? '', raw.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1'))
  }
  const result: OsRelease = { idLike: (map.get('ID_LIKE') ?? '').split(/\s+/).filter(Boolean) }
  const id = map.get('ID')
  const name = map.get('PRETTY_NAME') ?? map.get('NAME')
  const versionId = map.get('VERSION_ID')
  if (id) result.id = id
  if (name) result.name = name
  if (versionId) result.versionId = versionId
  return result
}

export function detectShell(env: NodeJS.ProcessEnv, platform: PlatformId): string {
  if (platform === 'windows') {
    if (env['PSModulePath'] && !env['PROMPT']) return 'powershell'
    const comspec = env['ComSpec'] ?? env['COMSPEC']
    if (comspec)
      return path.win32
        .basename(comspec)
        .replace(/\.exe$/i, '')
        .toLowerCase()
    return 'cmd'
  }
  const shell = env['SHELL']
  return shell ? path.posix.basename(shell) : 'unknown'
}

export interface DetectDeps {
  platform?: NodeJS.Platform
  arch?: string
  env?: NodeJS.ProcessEnv
  osReleaseText?: string | null
  release?: string
  uid?: number | undefined
  home?: string
  nodeVersion?: string
}

export function detectPlatform(deps: DetectDeps = {}): PlatformInfo {
  const id = mapPlatform(deps.platform ?? process.platform)
  const env = deps.env ?? process.env
  const release = deps.release ?? os.release()
  const info: PlatformInfo = {
    id,
    arch: deps.arch ?? process.arch,
    release,
    isWsl: false,
    isRoot: false,
    shell: detectShell(env, id),
    homedir: deps.home ?? os.homedir(),
    nodeVersion: deps.nodeVersion ?? process.versions.node,
  }
  const uid =
    deps.uid !== undefined
      ? deps.uid
      : typeof process.getuid === 'function'
        ? process.getuid()
        : undefined
  info.isRoot = uid === 0
  if (id === 'linux') {
    let text = deps.osReleaseText
    if (text === undefined) {
      try {
        text = fs.readFileSync('/etc/os-release', 'utf8')
      } catch {
        text = null
      }
    }
    if (text) {
      const parsed = parseOsRelease(text)
      info.distro = parsed.id
      info.distroName = parsed.name
      info.distroLike = parsed.idLike
      info.distroVersion = parsed.versionId
    }
    info.isWsl = /microsoft/i.test(release) || Boolean(env['WSL_DISTRO_NAME'])
  }
  return info
}

export function platformLabel(p: PlatformInfo): string {
  const name = p.id === 'linux' ? (p.distroName ?? 'Linux') : p.id === 'macos' ? 'macOS' : 'Windows'
  return `${name} ${p.arch}`
}
