import { describe, expect, it } from 'vitest'
import {
  createAdapters,
  type DetectedManager,
} from '../../src/adapters/packageManagers/registry.js'
import { catalog, profiles } from '../../src/modules/developerSetup/catalog.js'
import { planSetup, resolveToolIds } from '../../src/modules/developerSetup/planner.js'
import { FakeRunner, linuxPlatform } from '../helpers.js'

function managers(available: string[]): DetectedManager[] {
  const adapters = createAdapters(new FakeRunner(), linuxPlatform())
  return adapters.map((adapter) => ({
    adapter,
    available: available.includes(adapter.id),
    version: null,
  }))
}

describe('developer setup planner', () => {
  it('has unique catalog ids and valid profiles', () => {
    const ids = catalog.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of profiles) for (const t of p.tools) expect(ids).toContain(t)
  })
  it('skips tools that are already installed', () => {
    const plan = planSetup({
      selected: ['git', 'curl'],
      detected: {
        git: { installed: true, version: '2.43', detectable: true },
        curl: { installed: false, detectable: true },
      },
      managers: managers(['apt']),
      platform: linuxPlatform(),
    })
    expect(plan.alreadyInstalled.map((a) => a.tool)).toEqual(['git'])
    expect(plan.items.map((i) => i.tool)).toEqual(['curl'])
    expect(plan.items[0]?.spec.elevated).toBe(true)
  })
  it('does not install npm or pip separately when bundled', () => {
    const plan = planSetup({
      selected: ['node', 'npm'],
      detected: {},
      managers: managers(['apt']),
      platform: linuxPlatform(),
    })
    expect(plan.items.map((i) => i.tool)).toEqual(['node'])
    expect(plan.notes.join(' ')).toContain('npm comes with')
  })
  it('keeps webpack project local unless explicitly allowed', () => {
    const detected = {
      node: { installed: true, version: '22', detectable: true },
      npm: { installed: true, version: '10', detectable: true },
    }
    const local = planSetup({
      selected: ['webpack'],
      detected,
      managers: managers(['npm', 'apt']),
      platform: linuxPlatform(),
    })
    expect(local.items).toHaveLength(0)
    expect(local.notes.join(' ')).toContain('webpack')
    const global = planSetup({
      selected: ['webpack'],
      detected,
      managers: managers(['npm', 'apt']),
      platform: linuxPlatform(),
      allowGlobalProjectTools: true,
    })
    expect(global.items[0]?.spec.args).toEqual(['install', '-g', 'webpack-cli'])
  })
  it('installs node before pnpm when npm is missing', () => {
    const plan = planSetup({
      selected: ['pnpm', 'node'],
      detected: {},
      managers: managers(['apt']),
      platform: linuxPlatform(),
    })
    const order = plan.items.map((i) => i.tool)
    expect(order.indexOf('node')).toBeLessThan(order.indexOf('pnpm'))
  })
  it('lists manual steps and unavailable tools honestly', () => {
    const plan = planSetup({
      selected: ['cursor', 'insomnia'],
      detected: {},
      managers: managers(['apt']),
      platform: linuxPlatform(),
    })
    expect(plan.manual.map((m) => m.tool)).toEqual(['cursor', 'insomnia'])
    expect(plan.items).toHaveLength(0)
  })
  it('reports tools with no route', () => {
    const plan = planSetup({
      selected: ['git'],
      detected: {},
      managers: managers([]),
      platform: linuxPlatform(),
    })
    expect(plan.unavailable.map((u) => u.tool)).toEqual(['git'])
  })
  it('rejects unknown tool ids', () => {
    expect(() => resolveToolIds(['nope'])).toThrow(/Unknown tool/)
  })
})
