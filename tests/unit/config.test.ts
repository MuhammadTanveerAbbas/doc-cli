import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ConfigService, defaultConfig, parseConfig, setByPath } from '../../src/core/config.js'
import { DocError } from '../../src/core/errors.js'
import { resolveAppDirs } from '../../src/core/paths.js'
import { tmpDir } from '../helpers.js'

describe('configuration', () => {
  it('provides safe defaults', () => {
    const c = defaultConfig()
    expect(c.updates.autoInstall).toBe(false)
    expect(c.ai.enabled).toBe(false)
    expect(c.performance.automaticCleanup).toBe(false)
    expect(c.history.retentionDays).toBe(90)
  })
  it('sets values by dotted key and validates', () => {
    const c = setByPath(defaultConfig(), 'history.retentionDays', '30')
    expect(c.history.retentionDays).toBe(30)
    expect(() => setByPath(defaultConfig(), 'history.retentionDays', '"many"')).toThrow(DocError)
    expect(() => setByPath(defaultConfig(), 'nope.key', '1')).toThrow(DocError)
  })
  it('never allows automatic cleanup', () => {
    expect(() => setByPath(defaultConfig(), 'performance.automaticCleanup', 'true')).toThrow(
      DocError,
    )
  })
  it('rejects invalid files with a clear error', () => {
    expect(() => parseConfig({ ui: { theme: 'neon' } })).toThrow(/ui.theme/)
  })
  it('persists and resets', () => {
    const dir = tmpDir()
    const svc = new ConfigService(path.join(dir, 'c.json'))
    svc.set('ui.compact', 'true')
    expect(new ConfigService(path.join(dir, 'c.json')).get('ui.compact')).toBe(true)
    svc.reset()
    expect(svc.get('ui.compact')).toBe(false)
  })
  it('reports unreadable JSON', () => {
    const dir = tmpDir()
    const file = path.join(dir, 'c.json')
    fs.writeFileSync(file, '{ nope')
    expect(() => new ConfigService(file).load()).toThrow(/not valid JSON/)
  })
  it('resolves platform directories', () => {
    const l = resolveAppDirs({ env: {}, platform: 'linux', home: '/h' })
    expect(l.config).toBe(path.join('/h', '.config', 'doc-cli'))
    const w = resolveAppDirs({
      env: { APPDATA: 'C:\\A', LOCALAPPDATA: 'C:\\L' },
      platform: 'win32',
      home: 'C:\\U',
    })
    expect(w.data.includes('DocCli')).toBe(true)
    const m = resolveAppDirs({ env: {}, platform: 'darwin', home: '/Users/a' })
    expect(m.config.includes('Application Support')).toBe(true)
    expect(resolveAppDirs({ env: { DOC_CLI_HOME: '/x' }, platform: 'linux' }).data).toBe(
      path.join('/x', 'data'),
    )
  })
})
