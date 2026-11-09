import { describe, expect, it } from 'vitest'
import {
  createAdapters,
  detectManagers,
  pickSystemManager,
} from '../../src/adapters/packageManagers/registry.js'
import * as P from '../../src/adapters/packageManagers/parsers.js'
import { DocError } from '../../src/core/errors.js'
import { FakeRunner, linuxPlatform } from '../helpers.js'

describe('package manager parsers', () => {
  it('parses npm output', () => {
    expect(P.parseNpmList('{"dependencies":{"pnpm":{"version":"9.0.0"}}}')).toEqual([
      { id: 'pnpm', version: '9.0.0', source: 'npm' },
    ])
    expect(
      P.parseOutdatedJson('{"a":{"current":"1.0.0","latest":"2.0.0"}}', 'npm')[0]?.latest,
    ).toBe('2.0.0')
    expect(P.parseNpmSearch('[{"name":"left","version":"1.0.0","description":"d"}]')[0]?.id).toBe(
      'left',
    )
    expect(P.parseNpmList('not json')).toEqual([])
  })
  it('parses apt, dnf, pacman and brew output', () => {
    expect(P.parseDpkgList('git\t1:2.43\ncurl\t8.5')).toHaveLength(2)
    expect(
      P.parseAptUpgradable('git/noble-updates 1:2.44 amd64 [upgradable from: 1:2.43]')[0],
    ).toMatchObject({ id: 'git', latest: '1:2.44', current: '1:2.43' })
    expect(P.parseAptSearch('ripgrep - fast search tool')[0]?.id).toBe('ripgrep')
    expect(P.parseDnfCheckUpdate('git.x86_64   2.45.0-1.fc40   updates')[0]?.id).toBe('git')
    expect(P.parsePacmanUpdates('git 2.43 -> 2.44')[0]?.latest).toBe('2.44')
    expect(P.parsePacmanSearch('extra/ripgrep 14.0-1\n    fast search')[0]).toMatchObject({
      id: 'ripgrep',
      description: 'fast search',
    })
    expect(
      P.parseBrewOutdated(
        '{"formulae":[{"name":"jq","installed_versions":["1.6"],"current_version":"1.7"}],"casks":[]}',
      )[0],
    ).toMatchObject({ id: 'jq', latest: '1.7' })
    expect(P.parseBrewList('jq 1.7\nnode 22.1 21.0')).toHaveLength(2)
  })
  it('parses pip and uv output', () => {
    expect(P.parsePipList('[{"name":"requests","version":"2.31"}]')[0]?.id).toBe('requests')
    expect(P.parsePipOutdated('[{"name":"x","version":"1","latest_version":"2"}]')[0]?.latest).toBe(
      '2',
    )
    expect(P.parseUvToolList('ruff v0.5.0\n- ruff')[0]).toMatchObject({
      id: 'ruff',
      version: '0.5.0',
    })
  })
})

describe('package manager adapters', () => {
  it('detects only managers that exist', async () => {
    const runner = new FakeRunner((exe) => (exe === 'npm' ? { stdout: '10.9.0\n' } : undefined))
    runner.present.add('npm')
    runner.present.add('apt-get')
    const detected = await detectManagers(createAdapters(runner, linuxPlatform()))
    const ids = detected.filter((d) => d.available).map((d) => d.adapter.id)
    expect(ids).toEqual(['npm', 'apt'])
    expect(detected.find((d) => d.adapter.id === 'npm')?.version).toBe('10.9.0')
    expect(pickSystemManager(detected, 'linux')?.adapter.id).toBe('apt')
  })
  it('does not offer windows or mac managers on linux', () => {
    const ids = createAdapters(new FakeRunner(), linuxPlatform()).map((a) => a.id)
    expect(ids).not.toContain('winget')
    expect(ids).toContain('apt')
  })
  it('builds elevated commands with sudo for non root users and marks them', () => {
    const apt = createAdapters(new FakeRunner(), linuxPlatform()).find((a) => a.id === 'apt')!
    const spec = apt.planInstall({ id: 'git' })
    expect(spec).toEqual({
      executable: 'sudo',
      args: ['apt-get', 'install', '-y', 'git'],
      elevated: true,
    })
    const rootApt = createAdapters(new FakeRunner(), linuxPlatform({ isRoot: true })).find(
      (a) => a.id === 'apt',
    )!
    expect(rootApt.planInstall({ id: 'git' }).executable).toBe('apt-get')
  })
  it('builds npm commands without a shell', () => {
    const npm = createAdapters(new FakeRunner(), linuxPlatform()).find((a) => a.id === 'npm')!
    expect(npm.planInstall({ id: 'pnpm' })).toEqual({
      executable: 'npm',
      args: ['install', '-g', 'pnpm'],
      elevated: false,
    })
    expect(npm.planRemove({ id: 'pnpm' }).args).toEqual(['uninstall', '-g', 'pnpm'])
    expect(npm.planUpgrade().args).toEqual(['update', '-g'])
  })
  it('rejects dangerous package identifiers', () => {
    const npm = createAdapters(new FakeRunner(), linuxPlatform()).find((a) => a.id === 'npm')!
    for (const bad of ['git; rm -rf /', '$(whoami)', '--flag', 'a b', '../x']) {
      expect(() => npm.planInstall({ id: bad })).toThrow(DocError)
    }
  })
  it('reports unsupported operations instead of faking them', () => {
    const yarn = createAdapters(new FakeRunner(), linuxPlatform()).find((a) => a.id === 'yarn')!
    expect(() => yarn.planInstall({ id: 'x' })).toThrow(/does not support install/)
  })
  it('does not run anything in dry run mode', async () => {
    const runner = new FakeRunner()
    runner.present.add('npm')
    const npm = createAdapters(runner, linuxPlatform()).find((a) => a.id === 'npm')!
    const r = await npm.install({ id: 'pnpm' }, { dryRun: true, interactive: false })
    expect(r.ok).toBe(true)
    expect(runner.calls).toHaveLength(0)
  })
})
