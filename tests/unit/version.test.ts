import { describe, expect, it } from 'vitest'
import { compareSemver, nodeSupported } from '../../src/core/version.js'

describe('versions', () => {
  it('compares semantic versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0)
    expect(compareSemver('1.10.0', '1.9.9')).toBe(1)
    expect(compareSemver('v0.1.0', '0.2.0')).toBe(-1)
    expect(compareSemver('1.0.0', '1.0.0-beta.1')).toBe(1)
    expect(compareSemver('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1)
  })
  it('checks the node minimum', () => {
    expect(nodeSupported('22.13.0')).toBe(true)
    expect(nodeSupported('20.11.0')).toBe(false)
    expect(nodeSupported('24.1.0')).toBe(true)
  })
})
