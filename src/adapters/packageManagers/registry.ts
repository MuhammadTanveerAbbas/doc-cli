import type { PlatformInfo } from '../../platform/detect.js'
import type { ProcessRunner } from '../../services/processRunner.js'
import * as P from './parsers.js'
import { SpecAdapter, type AdapterSpec } from './specAdapter.js'
import type { PackageManagerAdapter } from './types.js'

export const adapterSpecs: AdapterSpec[] = [
  {
    id: 'npm',
    label: 'npm',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'npm',
    versionArgs: ['--version'],
    list: { args: ['ls', '-g', '--depth=0', '--json'], parse: (t) => P.parseNpmList(t) },
    outdated: {
      args: ['outdated', '-g', '--json'],
      okExitCodes: [0, 1],
      parse: (t) => P.parseOutdatedJson(t, 'npm'),
    },
    search: { args: (q) => ['search', '--json', q], parse: P.parseNpmSearch },
    info: { args: (id) => ['view', id] },
    install: (r) => ['install', '-g', r.id],
    upgrade: (r) => (r ? ['update', '-g', r.id] : ['update', '-g']),
    remove: (r) => ['uninstall', '-g', r.id],
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'pnpm',
    versionArgs: ['--version'],
    list: { args: ['ls', '-g', '--depth=0', '--json'], parse: (t) => P.parsePnpmList(t) },
    outdated: {
      args: ['outdated', '-g', '--format', 'json'],
      okExitCodes: [0, 1],
      parse: (t) => P.parseOutdatedJson(t, 'pnpm'),
    },
    install: (r) => ['add', '-g', r.id],
    upgrade: (r) => (r ? ['update', '-g', r.id] : ['update', '-g']),
    remove: (r) => ['remove', '-g', r.id],
  },
  {
    id: 'yarn',
    label: 'Yarn',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'yarn',
    versionArgs: ['--version'],
  },
  {
    id: 'bun',
    label: 'Bun',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'bun',
    versionArgs: ['--version'],
    list: { args: ['pm', 'ls', '-g'], parse: P.parseBunList },
    install: (r) => ['add', '-g', r.id],
    upgrade: (r) => (r ? ['update', '-g', r.id] : ['update', '-g']),
    remove: (r) => ['remove', '-g', r.id],
  },
  {
    id: 'pip',
    label: 'pip',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'pip',
    versionArgs: ['--version'],
    list: { args: ['list', '--format=json'], parse: P.parsePipList },
    outdated: { args: ['list', '--outdated', '--format=json'], parse: P.parsePipOutdated },
    info: { args: (id) => ['show', id] },
    install: (r) => ['install', r.id],
    upgrade: (r) => ['install', '--upgrade', ...(r ? [r.id] : [])],
    remove: (r) => ['uninstall', '-y', r.id],
  },
  {
    id: 'uv',
    label: 'uv',
    scope: 'language',
    platforms: ['linux', 'windows', 'macos'],
    executable: 'uv',
    versionArgs: ['--version'],
    list: { args: ['tool', 'list'], parse: P.parseUvToolList },
    install: (r) => ['tool', 'install', r.id],
    upgrade: (r) => (r ? ['tool', 'upgrade', r.id] : ['tool', 'upgrade', '--all']),
    remove: (r) => ['tool', 'uninstall', r.id],
  },
  {
    id: 'apt',
    label: 'APT',
    scope: 'system',
    platforms: ['linux'],
    executable: 'apt-get',
    elevated: true,
    versionArgs: ['--version'],
    list: {
      executable: 'dpkg-query',
      args: ['-W', '-f=${Package}\t${Version}\n'],
      parse: P.parseDpkgList,
    },
    outdated: { executable: 'apt', args: ['list', '--upgradable'], parse: P.parseAptUpgradable },
    search: { executable: 'apt-cache', args: (q) => ['search', q], parse: P.parseAptSearch },
    info: { executable: 'apt-cache', args: (id) => ['show', id] },
    install: (r) => ['install', '-y', r.id],
    upgrade: (r) => (r ? ['install', '--only-upgrade', '-y', r.id] : ['upgrade', '-y']),
    remove: (r) => ['remove', '-y', r.id],
  },
  {
    id: 'dnf',
    label: 'DNF',
    scope: 'system',
    platforms: ['linux'],
    executable: 'dnf',
    elevated: true,
    versionArgs: ['--version'],
    list: {
      executable: 'rpm',
      args: ['-qa', '--qf', '%{NAME}\t%{VERSION}-%{RELEASE}\n'],
      parse: P.parseRpmList,
    },
    outdated: { args: ['check-update', '-q'], okExitCodes: [0, 100], parse: P.parseDnfCheckUpdate },
    search: { args: (q) => ['search', q], parse: P.parseDnfSearch },
    info: { args: (id) => ['info', id] },
    install: (r) => ['install', '-y', r.id],
    upgrade: (r) => (r ? ['upgrade', '-y', r.id] : ['upgrade', '-y']),
    remove: (r) => ['remove', '-y', r.id],
  },
  {
    id: 'pacman',
    label: 'pacman',
    scope: 'system',
    platforms: ['linux'],
    executable: 'pacman',
    elevated: true,
    versionArgs: ['--version'],
    list: { args: ['-Q'], parse: P.parsePacmanList },
    outdated: { args: ['-Qu'], okExitCodes: [0, 1], parse: P.parsePacmanUpdates },
    search: { args: (q) => ['-Ss', q], parse: P.parsePacmanSearch },
    info: { args: (id) => ['-Si', id] },
    install: (r) => ['-S', '--noconfirm', '--needed', r.id],
    upgrade: () => ['-Syu', '--noconfirm'],
    remove: (r) => ['-R', '--noconfirm', r.id],
  },
  {
    id: 'brew',
    label: 'Homebrew',
    scope: 'system',
    platforms: ['macos', 'linux'],
    executable: 'brew',
    versionArgs: ['--version'],
    list: { args: ['list', '--versions'], parse: P.parseBrewList },
    outdated: { args: ['outdated', '--json=v2'], parse: P.parseBrewOutdated },
    search: { args: (q) => ['search', q], parse: (t) => P.parseLines(t, 'brew') },
    info: { args: (id) => ['info', id] },
    install: (r) => ['install', ...(r.cask ? ['--cask'] : []), r.id],
    upgrade: (r) => ['upgrade', ...(r?.cask ? ['--cask'] : []), ...(r ? [r.id] : [])],
    remove: (r) => ['uninstall', ...(r.cask ? ['--cask'] : []), r.id],
  },
  {
    id: 'winget',
    label: 'winget',
    scope: 'system',
    platforms: ['windows'],
    executable: 'winget',
    versionArgs: ['--version'],
    list: {
      args: ['list', '--accept-source-agreements'],
      parse: (t) =>
        P.parseLines(t, 'winget').map((r) => ({
          id: r.id,
          version: 'see winget list',
          source: 'winget',
        })),
    },
    search: {
      args: (q) => ['search', q, '--accept-source-agreements'],
      parse: (t) => P.parseLines(t, 'winget'),
    },
    info: { args: (id) => ['show', '--id', id, '--exact', '--accept-source-agreements'] },
    install: (r) => ['install', '--id', r.id, '--exact', '--accept-source-agreements'],
    upgrade: (r) => [
      'upgrade',
      ...(r ? ['--id', r.id, '--exact'] : ['--all']),
      '--accept-source-agreements',
    ],
    remove: (r) => ['uninstall', '--id', r.id, '--exact'],
  },
]

export function createAdapters(
  runner: ProcessRunner,
  platform: PlatformInfo,
): PackageManagerAdapter[] {
  return adapterSpecs
    .filter((s) => s.platforms.includes(platform.id))
    .map((s) => new SpecAdapter(s, runner, platform))
}

export interface DetectedManager {
  adapter: PackageManagerAdapter
  available: boolean
  version: string | null
}

export async function detectManagers(
  adapters: PackageManagerAdapter[],
): Promise<DetectedManager[]> {
  return Promise.all(
    adapters.map(async (adapter) => {
      const available = await adapter.isAvailable()
      const version = available ? await adapter.version() : null
      return { adapter, available, version }
    }),
  )
}

const SYSTEM_PRIORITY: Record<string, string[]> = {
  linux: ['apt', 'dnf', 'pacman', 'brew'],
  macos: ['brew'],
  windows: ['winget'],
}

export function pickSystemManager(
  detected: DetectedManager[],
  platformId: string,
): DetectedManager | null {
  const order = SYSTEM_PRIORITY[platformId] ?? []
  for (const id of order) {
    const hit = detected.find((d) => d.adapter.id === id && d.available)
    if (hit) return hit
  }
  return null
}
