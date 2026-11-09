import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { allCommands, completionScript } from '../../src/cli/commandRegistry.js'
import { paletteChoices } from '../../src/cli/commandPalette.js'
import { DocError } from '../../src/core/errors.js'
import {
  createBackup,
  listBackups,
  loadBackup,
  restoreBackup,
} from '../../src/modules/backup/service.js'
import { downloadFile } from '../../src/modules/downloads/service.js'
import { validateActionPlan } from '../../src/modules/ai/service.js'
import { buildRecommendations } from '../../src/modules/performance/service.js'
import { inspectProject } from '../../src/modules/projects/service.js'
import { ManifestSchema, readManifest } from '../../src/modules/plugins/service.js'
import { dirSize, safeJoin, sha256Buffer } from '../../src/services/filesystemService.js'
import { tokenize } from '../../src/utils/formatting.js'
import { validateHttpsUrl, validatePackageId } from '../../src/utils/validation.js'
import { tmpDir } from '../helpers.js'

describe('backup', () => {
  it('creates, lists and restores with verification and no overwrite', async () => {
    const src = tmpDir('src')
    fs.mkdirSync(path.join(src, 'sub'))
    fs.mkdirSync(path.join(src, 'node_modules'))
    fs.writeFileSync(path.join(src, 'a.txt'), 'alpha')
    fs.writeFileSync(path.join(src, 'sub', 'b.txt'), 'beta')
    fs.writeFileSync(path.join(src, 'node_modules', 'skip.js'), 'x')
    const store = tmpDir('store')
    const m = await createBackup(src, store)
    expect(m.files.map((f) => f.rel).sort()).toEqual(['a.txt', 'sub/b.txt'])
    expect(listBackups(store)).toHaveLength(1)
    const target = tmpDir('restore')
    expect(await restoreBackup(store, loadBackup(store, m.id), target, false)).toBe(2)
    expect(fs.readFileSync(path.join(target, 'sub', 'b.txt'), 'utf8')).toBe('beta')
    await expect(restoreBackup(store, m, target, false)).rejects.toThrow(/Refusing to overwrite/)
  })
  it('detects corrupted backup files', async () => {
    const src = tmpDir('src')
    fs.writeFileSync(path.join(src, 'a.txt'), 'alpha')
    const store = tmpDir('store')
    const m = await createBackup(src, store)
    fs.writeFileSync(path.join(store, m.id, 'files', 'a.txt'), 'tampered')
    await expect(restoreBackup(store, m, tmpDir('r'), false)).rejects.toThrow(/corrupted/)
  })
  it('rejects bad backup ids', () => {
    expect(() => loadBackup(tmpDir(), '../etc')).toThrow(DocError)
  })
})

describe('downloads', () => {
  const body = new TextEncoder().encode('payload')
  const mockFetch = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch
  it('saves and verifies a checksum', async () => {
    const dir = tmpDir()
    const rec = await downloadFile(
      mockFetch,
      new URL('https://example.com/a/file.bin'),
      dir,
      sha256Buffer('payload'),
    )
    expect(rec.verified).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'file.bin'), 'utf8')).toBe('payload')
  })
  it('deletes the file when the checksum does not match', async () => {
    const dir = tmpDir()
    await expect(
      downloadFile(mockFetch, new URL('https://example.com/file.bin'), dir, 'c'.repeat(64)),
    ).rejects.toThrow(/Checksum mismatch/)
    expect(fs.existsSync(path.join(dir, 'file.bin'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'file.bin.part'))).toBe(false)
  })
  it('only accepts https URLs', () => {
    expect(() => validateHttpsUrl('http://example.com')).toThrow(DocError)
    expect(() => validateHttpsUrl('ftp://example.com')).toThrow(DocError)
    expect(validateHttpsUrl('https://example.com/x').hostname).toBe('example.com')
  })
})

describe('filesystem safety', () => {
  it('blocks path traversal', () => {
    expect(() => safeJoin('/base', '../etc/passwd')).toThrow(DocError)
    expect(safeJoin('/base', 'a/b')).toBe(path.resolve('/base/a/b'))
  })
  it('measures directories without following symlinks', () => {
    const d = tmpDir()
    fs.writeFileSync(path.join(d, 'a'), '12345')
    expect(dirSize(d).bytes).toBe(5)
  })
  it('validates package ids', () => {
    expect(validatePackageId('@scope/pkg')).toBe('@scope/pkg')
    expect(() => validatePackageId('a;b')).toThrow(DocError)
  })
  it('tokenizes quoted input', () => {
    expect(tokenize('packages search "left pad" --manager npm')).toEqual([
      'packages',
      'search',
      'left pad',
      '--manager',
      'npm',
    ])
  })
})

describe('AI action plans', () => {
  it('accepts plans made only of real commands', () => {
    const p = validateActionPlan(
      'Here: {"summary":"s","actions":[{"argv":["packages","install","git"],"reason":"r"}]}',
    )
    expect(p.actions).toHaveLength(1)
  })
  it('rejects unknown, privileged or self approving actions', () => {
    const wrap = (argv: string[]) =>
      JSON.stringify({ summary: 's', actions: [{ argv, reason: 'r' }] })
    expect(() => validateActionPlan(wrap(['rm', '-rf', '/']))).toThrow(/unknown command/)
    expect(() => validateActionPlan(wrap(['packages', 'install', 'git', '--yes']))).toThrow(
      /pre approve/,
    )
    expect(() => validateActionPlan(wrap(['config', 'set', 'ai.enabled', 'true']))).toThrow(
      /may not propose/,
    )
    expect(() => validateActionPlan(wrap(['ai', 'disable']))).toThrow(/may not propose/)
    expect(() => validateActionPlan('no json here')).toThrow(DocError)
  })
})

describe('plugins', () => {
  const manifest = {
    name: 'hello',
    version: '1.0.0',
    publisher: 'Me',
    compatibility: { minDocCliVersion: '0.1.0' },
    permissions: ['filesystem.read'],
    commands: [{ name: 'run', entry: 'bin/run.sh' }],
  }
  it('validates manifests', () => {
    expect(ManifestSchema.safeParse(manifest).success).toBe(true)
    expect(ManifestSchema.safeParse({ ...manifest, permissions: ['root'] }).success).toBe(false)
    expect(ManifestSchema.safeParse({ ...manifest, name: 'Bad Name' }).success).toBe(false)
  })
  it('rejects entries that escape the plugin folder', () => {
    const d = tmpDir()
    fs.writeFileSync(
      path.join(d, 'plugin.json'),
      JSON.stringify({ ...manifest, commands: [{ name: 'x', entry: '../../evil' }] }),
    )
    expect(() => readManifest(d)).toThrow(DocError)
  })
})

describe('performance, projects and commands', () => {
  const hw = {
    cpu: { model: 'x', cores: 4, physicalCores: 2, speedGHz: 3 },
    memory: { totalBytes: 100, availableBytes: 5, usedPercent: 95 },
    load: { currentPercent: 10 },
    disks: [
      {
        mount: '/',
        fs: 'ext4',
        totalBytes: 100,
        usedBytes: 92,
        availableBytes: 8,
        usedPercent: 92,
      },
    ],
    uptimeSeconds: 1,
    unsupported: [],
  }
  it('builds recommendations from measurements only', () => {
    const rec = buildRecommendations({
      hw,
      caches: [
        {
          id: 'npm',
          label: 'npm cache',
          path: '/c',
          bytes: 3 * 1024 ** 3,
          truncated: false,
          cleanCommand: { executable: 'npm', args: [] },
        },
      ],
      missingPath: 2,
      outdatedTools: [],
    })
    const ids = rec.map((r) => r.id)
    expect(ids).toEqual(
      expect.arrayContaining(['disk.critical', 'mem.high', 'cache.npm', 'path.missing']),
    )
    expect(
      buildRecommendations({
        hw: { ...hw, memory: { ...hw.memory, usedPercent: 10 }, disks: [] },
        caches: [],
        missingPath: 0,
        outdatedTools: [],
      })[0]?.id,
    ).toBe('none')
  })
  it('inspects projects', () => {
    const d = tmpDir()
    fs.writeFileSync(
      path.join(d, 'package.json'),
      JSON.stringify({ name: 'demo', scripts: { build: 'x' } }),
    )
    fs.writeFileSync(path.join(d, 'pnpm-lock.yaml'), '')
    const info = inspectProject(d)
    expect(info).toMatchObject({
      name: 'demo',
      packageManager: 'pnpm',
      kinds: ['node'],
      scripts: ['build'],
    })
  })
  it('registers unique commands with no dash punctuation in summaries', () => {
    const defs = allCommands()
    const names = defs.map((d) => d.path.join(' '))
    expect(new Set(names).size).toBe(names.length)
    for (const d of defs) expect(d.summary).not.toMatch(/[\u2013\u2014]/)
  })
  it('filters the palette and generates completions', () => {
    const defs = allCommands()
    expect(
      paletteChoices(defs, 'perf').every((c) => /perf/i.test(c.name + (c.description ?? ''))),
    ).toBe(true)
    expect(paletteChoices(defs, undefined).length).toBe(defs.length)
    for (const sh of ['bash', 'zsh', 'fish', 'powershell'])
      expect(completionScript(sh, defs)).toContain('system')
    expect(() => completionScript('tcsh', defs)).toThrow(DocError)
  })
})
