import { describe, expect, it } from 'vitest'
import { redactArgs, redactEnv, redactText } from '../../src/utils/redact.js'

describe('redaction', () => {
  it('hides secret flag values', () => {
    expect(redactArgs(['ai', 'configure', '--token', 'abc123']).args).toEqual([
      'ai',
      'configure',
      '--token',
      '[REDACTED]',
    ])
    expect(redactArgs(['x', '--api-key=hunter2']).args).toEqual(['x', '--api-key=[REDACTED]'])
  })
  it('hides secret assignments and known token shapes', () => {
    expect(redactArgs(['MY_SECRET=abc']).args).toEqual(['MY_SECRET=[REDACTED]'])
    expect(redactText('token ghp_abcdefghijklmnopqrstuvwxyz0123')).toContain('[REDACTED]')
    expect(redactText('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def')
  })
  it('flags that something was redacted', () => {
    expect(redactArgs(['--password', 'x']).redacted).toBe(true)
    expect(redactArgs(['system', 'info']).redacted).toBe(false)
  })
  it('hides secret environment values', () => {
    const env = redactEnv({ HOME: '/home/a', GITHUB_TOKEN: 'abc', AWS_SECRET_ACCESS_KEY: 'zzz' })
    expect(env['HOME']).toBe('/home/a')
    expect(env['GITHUB_TOKEN']).toBe('[REDACTED]')
    expect(env['AWS_SECRET_ACCESS_KEY']).toBe('[REDACTED]')
  })
})
