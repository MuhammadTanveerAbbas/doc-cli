import { describe, expect, it } from 'vitest'
import { HistoryService, newOpState } from '../../src/services/historyService.js'
import { tmpDir } from '../helpers.js'
import path from 'node:path'
import fs from 'node:fs'

const input = (argv: string[]) => ({
  argv,
  module: 'm',
  operation: 'op',
  os: 'linux',
  arch: 'x64',
  docCliVersion: '0.1.0',
})

function service(opts = { enabled: true, retentionDays: 90 }) {
  const dir = tmpDir()
  return {
    svc: new HistoryService(path.join(dir, 'h.json'), path.join(dir, 'a.jsonl'), () => opts),
    dir,
  }
}

describe('history', () => {
  it('records, searches and shows commands', () => {
    const { svc } = service()
    const rec = svc.record(input(['packages', 'install', 'git']), newOpState(), 0, 12)
    expect(rec?.id).toHaveLength(8)
    expect(svc.search('install')).toHaveLength(1)
    expect(svc.get(rec!.id).argv).toEqual(['packages', 'install', 'git'])
  })
  it('redacts secrets before storing', () => {
    const { svc, dir } = service()
    const rec = svc.record(
      input(['ai', 'configure', '--token', 'supersecretvalue']),
      newOpState(),
      0,
      1,
    )
    expect(rec?.argvRedacted).toBe(true)
    expect(fs.readFileSync(path.join(dir, 'h.json'), 'utf8')).not.toContain('supersecretvalue')
  })
  it('stores nothing when disabled', () => {
    const { svc } = service({ enabled: false, retentionDays: 90 })
    expect(svc.record(input(['version']), newOpState(), 0, 1)).toBeNull()
    expect(svc.list()).toHaveLength(0)
  })
  it('prunes by retention', () => {
    const { svc } = service({ enabled: true, retentionDays: 1 })
    svc.record(input(['a']), newOpState(), 0, 1)
    expect(svc.prune(Date.now() + 3 * 86_400_000)).toBe(1)
    expect(svc.list()).toHaveLength(0)
  })
  it('exports and clears', () => {
    const { svc, dir } = service()
    svc.record(input(['a']), newOpState(), 0, 1)
    const file = path.join(dir, 'out.json')
    expect(svc.exportTo(file)).toBe(1)
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).records).toHaveLength(1)
    expect(svc.clear()).toBe(1)
    expect(svc.list()).toHaveLength(0)
  })
  it('survives a corrupted file', () => {
    const { svc, dir } = service()
    fs.writeFileSync(path.join(dir, 'h.json'), '{broken')
    expect(svc.list()).toEqual([])
    svc.record(input(['a']), newOpState(), 0, 1)
    expect(svc.list()).toHaveLength(1)
  })
})
