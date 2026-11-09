import { describe, expect, it } from 'vitest'
import { DocError } from '../../src/core/errors.js'
import {
  detectPlatform,
  detectShell,
  mapPlatform,
  parseOsRelease,
} from '../../src/platform/detect.js'

describe('platform detection', () => {
  it('maps node platforms', () => {
    expect(mapPlatform('linux')).toBe('linux')
    expect(mapPlatform('win32')).toBe('windows')
    expect(mapPlatform('darwin')).toBe('macos')
    expect(() => mapPlatform('freebsd')).toThrow(DocError)
  })
  it('parses os release files', () => {
    const r = parseOsRelease(
      'ID=fedora\nID_LIKE="rhel centos"\nPRETTY_NAME="Fedora Linux 40"\nVERSION_ID=40',
    )
    expect(r.id).toBe('fedora')
    expect(r.idLike).toEqual(['rhel', 'centos'])
    expect(r.versionId).toBe('40')
  })
  it('detects shells', () => {
    expect(detectShell({ SHELL: '/usr/bin/zsh' }, 'linux')).toBe('zsh')
    expect(detectShell({ PSModulePath: 'x' }, 'windows')).toBe('powershell')
    expect(detectShell({ ComSpec: 'C:\\Windows\\System32\\cmd.exe' }, 'windows')).toBe('cmd')
  })
  it('detects root, WSL and architecture', () => {
    const p = detectPlatform({
      platform: 'linux',
      arch: 'arm64',
      env: { WSL_DISTRO_NAME: 'Ubuntu' },
      osReleaseText: 'ID=ubuntu',
      release: '5.15',
      uid: 0,
      home: '/root',
    })
    expect(p.isRoot).toBe(true)
    expect(p.isWsl).toBe(true)
    expect(p.arch).toBe('arm64')
    expect(p.distro).toBe('ubuntu')
  })
})
