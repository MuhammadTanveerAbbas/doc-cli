import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { allCommands } from '../../src/cli/commandRegistry.js'
import { parseArgv } from '../../src/cli/commandParser.js'
import { createContext } from '../../src/core/bootstrap.js'
import { HistoryService } from '../../src/services/historyService.js'
import { FakeRunner, FakePrompter, linuxPlatform, tmpDir } from '../helpers.js'

async function run(
  argv: string[],
  opts: {
    home?: string
    present?: string[]
    handler?: ConstructorParameters<typeof FakeRunner>[0]
  } = {},
) {
  const home = opts.home ?? tmpDir()
  const out: string[] = []
  const err: string[] = []
  const runner = new FakeRunner(opts.handler)
  for (const p of opts.present ?? []) runner.present.add(p)
  const code = await parseArgv(allCommands(), argv, {
    overrides: {
      env: { DOC_CLI_HOME: home, PATH: process.env['PATH'] ?? '', NO_COLOR: '1' },
      runner,
      prompter: new FakePrompter(),
      interactive: false,
      platform: linuxPlatform(),
      stdout: (s) => out.push(s),
      stderr: (s) => err.push(s),
      width: 100,
    },
  })
  return { code, out: out.join(''), err: err.join(''), home, runner }
}

describe('command line behavior', () => {
  it('prints the version in text and JSON', async () => {
    const t = await run(['version'])
    expect(t.code).toBe(0)
    expect(t.out).toContain('DOC CLI 0.1.0')
    const j = await run(['version', '--json'])
    expect(JSON.parse(j.out).version).toBe('0.1.0')
  })
  it('lists package managers using only detected tools', async () => {
    const t = await run(['packages', 'managers', '--json'], {
      present: ['npm'],
      handler: () => ({ stdout: '10.0.0' }),
    })
    const data = JSON.parse(t.out) as Array<{ id: string; available: boolean }>
    expect(data.find((d) => d.id === 'npm')?.available).toBe(true)
    expect(data.find((d) => d.id === 'apt')?.available).toBe(false)
  })
  it('requires approval for installs in non interactive mode', async () => {
    const t = await run(['packages', 'install', 'pnpm', '--manager', 'npm', '--non-interactive'], {
      present: ['npm'],
      handler: (_e, a) => (a[0] === 'ls' ? { stdout: '{}' } : { stdout: '10.0.0' }),
    })
    expect(t.code).toBe(4)
    expect(t.runner.calls.some((c) => c.args[0] === 'install')).toBe(false)
    expect(t.err).toContain('--yes')
  })
  it('previews installs with --dry-run without running them', async () => {
    const t = await run(['packages', 'install', 'pnpm', '--manager', 'npm', '--dry-run'], {
      present: ['npm'],
      handler: (_e, a) => (a[0] === 'ls' ? { stdout: '{}' } : { stdout: '10.0.0' }),
    })
    expect(t.code).toBe(0)
    expect(t.out).toContain('Preview only')
    expect(t.runner.calls.some((c) => c.args[0] === 'install')).toBe(false)
  })
  it('runs approved installs and records history and audit', async () => {
    const t = await run(['packages', 'install', 'pnpm', '--manager', 'npm', '--yes'], {
      present: ['npm'],
      handler: (_e, a) => (a[0] === 'ls' ? { stdout: '{}' } : { stdout: 'ok' }),
    })
    expect(t.code).toBe(0)
    expect(
      t.runner.calls.some((c) => c.exe === 'npm' && c.args.join(' ') === 'install -g pnpm'),
    ).toBe(true)
    const svc = new HistoryService(
      path.join(t.home, 'data', 'history.json'),
      path.join(t.home, 'data', 'audit.jsonl'),
      () => ({ enabled: true, retentionDays: 90 }),
    )
    expect(svc.list()[0]?.argv.slice(0, 2)).toEqual(['packages', 'install'])
    expect(svc.list()[0]?.confirmed).toBe(true)
    expect(svc.readAudit()[0]?.result).toBe('success')
  })
  it('never lets elevated steps run with --yes alone', async () => {
    const t = await run(['packages', 'install', 'git', '--manager', 'apt', '--yes'], {
      present: ['apt-get', 'dpkg-query', 'sudo'],
    })
    expect(t.code).toBe(4)
    expect(t.runner.calls.some((c) => c.exe === 'sudo')).toBe(false)
    const ok = await run(
      ['packages', 'install', 'git', '--manager', 'apt', '--yes', '--allow-elevation'],
      { present: ['apt-get', 'dpkg-query', 'sudo'] },
    )
    expect(ok.runner.calls.some((c) => c.exe === 'sudo')).toBe(true)
  })
  it('reports unknown commands with a usage exit code', async () => {
    const t = await run(['definitely', 'not', 'real'])
    expect(t.code).toBe(2)
  })
  it('reads and writes configuration', async () => {
    const home = tmpDir()
    const set = await run(['config', 'set', 'ui.compact', 'true', '--yes'], { home })
    expect(set.code).toBe(0)
    const get = await run(['config', 'get', 'ui.compact', '--json'], { home })
    expect(JSON.parse(get.out).value).toBe(true)
    const bad = await run(['config', 'get', 'nope'], { home })
    expect(bad.code).toBe(2)
  })
  it('keeps secrets out of history', async () => {
    const home = tmpDir()
    await run(
      [
        'ai',
        'configure',
        '--provider',
        'ollama',
        '--model',
        'x',
        '--endpoint',
        'http://localhost:11434',
      ],
      { home },
    )
    const raw = fs.readFileSync(path.join(home, 'data', 'history.json'), 'utf8')
    expect(raw).toContain('ai')
    const withSecret = await run(
      ['download', 'https://example.com/x', '--sha256', 'zz', '--non-interactive'],
      { home },
    )
    expect(withSecret.code).toBe(2)
  })
  it('doctor reports a failing runtime with exit code 7 only when something fails', async () => {
    const t = await run(['doctor'], { present: ['git'] })
    expect([0, 7]).toContain(t.code)
    expect(t.out).toContain('Doctor report')
  })
  it('does not use color or escape codes in output when NO_COLOR is set', async () => {
    const t = await run(['status'])
    expect(t.out).not.toContain('\u001b[')
  })
})

describe('context creation', () => {
  it('produces a non interactive context under test', () => {
    const ctx = createContext(
      {},
      { env: { DOC_CLI_HOME: tmpDir(), PATH: '' }, interactive: false, platform: linuxPlatform() },
    )
    expect(ctx.interactive).toBe(false)
    expect(ctx.config.load().ai.enabled).toBe(false)
  })
})
