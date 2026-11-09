import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DocError } from '../../src/core/errors.js'
import {
  cacheIsFresh,
  detectInstallMethod,
  parseChecksums,
  replaceExecutable,
  repoFromConfig,
  selectRelease,
  standaloneAssetName,
  verifyChecksum,
  ReleaseSchema,
} from '../../src/modules/updater/service.js'
import { sha256Buffer } from '../../src/services/filesystemService.js'
import { tmpDir } from '../helpers.js'

const rel = (tag: string, prerelease = false) => ReleaseSchema.parse({ tag_name: tag, prerelease })

describe('self update logic', () => {
  it('detects the installation method', () => {
    expect(
      detectInstallMethod('/usr/lib/node_modules/doc-cli-assistant/dist/index.js', '/usr/bin/node'),
    ).toBe('npm')
    expect(
      detectInstallMethod(
        '/home/a/.local/share/pnpm/global/5/node_modules/x/dist/index.js',
        '/usr/bin/node',
      ),
    ).toBe('pnpm')
    expect(detectInstallMethod('/opt/doc-cli', '/opt/doc-cli')).toBe('standalone')
    expect(detectInstallMethod('/home/a/src/doc-cli/dist/index.js', '/usr/bin/node')).toBe('source')
  })
  it('selects releases by channel without downgrading', () => {
    const all = [
      rel('v0.1.0'),
      rel('v0.2.0'),
      rel('v0.3.0-beta.1', true),
      rel('v0.3.0-nightly.5', true),
    ]
    expect(selectRelease(all, 'stable')?.tag_name).toBe('v0.2.0')
    expect(selectRelease(all, 'beta')?.tag_name).toBe('v0.3.0-beta.1')
    expect(selectRelease(all, 'nightly')?.tag_name).toBe('v0.3.0-nightly.5')
    expect(selectRelease([], 'stable')).toBeNull()
  })
  it('treats placeholder repositories as not configured', () => {
    expect(repoFromConfig('')).toBeNull()
    expect(repoFromConfig('OWNER/doc-cli')).toBeNull()
    expect(repoFromConfig('acme/doc-cli')).toBe('acme/doc-cli')
    expect(repoFromConfig('bad repo')).toBeNull()
  })
  it('caches checks for the configured interval', () => {
    const c = {
      checkedAt: new Date(Date.now() - 3_600_000).toISOString(),
      latest: '1',
      channel: 'stable',
    }
    expect(cacheIsFresh(c, 24)).toBe(true)
    expect(cacheIsFresh(c, 0.5)).toBe(false)
    expect(cacheIsFresh(null, 24)).toBe(false)
  })
  it('names assets and parses checksum files', () => {
    expect(standaloneAssetName('windows', 'x64')).toBe('doc-cli-windows-x64.exe')
    expect(standaloneAssetName('linux', 'arm64')).toBe('doc-cli-linux-arm64')
    const h = 'a'.repeat(64)
    expect(parseChecksums(`${h}  doc-cli-linux-x64\n`).get('doc-cli-linux-x64')).toBe(h)
  })
  it('rejects a file with a wrong checksum', async () => {
    const dir = tmpDir()
    const f = path.join(dir, 'bin')
    fs.writeFileSync(f, 'hello')
    await expect(verifyChecksum(f, sha256Buffer('hello'))).resolves.toBeUndefined()
    await expect(verifyChecksum(f, 'b'.repeat(64))).rejects.toBeInstanceOf(DocError)
  })
  it('replaces the executable and keeps a backup', async () => {
    const dir = tmpDir()
    const target = path.join(dir, 'app')
    const staged = path.join(dir, 'app.staged')
    fs.writeFileSync(target, 'old')
    fs.writeFileSync(staged, 'new')
    const { backup } = await replaceExecutable(target, staged, async () => true)
    expect(fs.readFileSync(target, 'utf8')).toBe('new')
    expect(fs.readFileSync(backup, 'utf8')).toBe('old')
  })
  it('restores the previous version when verification fails', async () => {
    const dir = tmpDir()
    const target = path.join(dir, 'app')
    const staged = path.join(dir, 'app.staged')
    fs.writeFileSync(target, 'old')
    fs.writeFileSync(staged, 'broken')
    await expect(replaceExecutable(target, staged, async () => false)).rejects.toBeInstanceOf(
      DocError,
    )
    expect(fs.readFileSync(target, 'utf8')).toBe('old')
  })
})
