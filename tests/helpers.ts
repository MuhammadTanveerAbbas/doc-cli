import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createContext } from '../src/core/bootstrap.js'
import type { AppContext, GlobalOptions } from '../src/core/context.js'
import { detectPlatform, type PlatformInfo } from '../src/platform/detect.js'
import {
  fakeResult,
  type ProcessResult,
  type ProcessRunner,
} from '../src/services/processRunner.js'
import type { Prompter } from '../src/ui/prompts.js'

export function tmpDir(prefix = 'doccli'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}_`))
}

export type Handler = (exe: string, args: string[]) => Partial<ProcessResult> | undefined

export class FakeRunner implements ProcessRunner {
  calls: Array<{ exe: string; args: string[] }> = []
  present = new Set<string>()
  constructor(private readonly handler: Handler = () => undefined) {}
  async which(exe: string): Promise<string | null> {
    return this.present.has(exe) ? `/usr/bin/${exe}` : null
  }
  async run(exe: string, args: string[]): Promise<ProcessResult> {
    this.calls.push({ exe, args })
    if (!this.present.has(exe) && exe !== 'sudo') {
      return fakeResult({
        executable: exe,
        args,
        exitCode: null,
        notFound: true,
        ok: false,
        stderr: 'not found',
      })
    }
    const custom = this.handler(exe, args)
    return fakeResult({ executable: exe, args, ...(custom ?? {}) })
  }
}

export class FakePrompter implements Prompter {
  answers: boolean[] = []
  asked: string[] = []
  async confirm(message: string): Promise<boolean> {
    this.asked.push(message)
    return this.answers.length ? (this.answers.shift() as boolean) : false
  }
  async select<T>(): Promise<T> {
    throw new Error('not used')
  }
  async checkbox<T>(): Promise<T[]> {
    throw new Error('not used')
  }
  async input(): Promise<string> {
    return ''
  }
  async search<T>(): Promise<T> {
    throw new Error('not used')
  }
}

export interface TestCtx {
  ctx: AppContext
  out: string[]
  err: string[]
  home: string
  runner: FakeRunner
  prompter: FakePrompter
}

export function linuxPlatform(overrides: Partial<PlatformInfo> = {}): PlatformInfo {
  return {
    ...detectPlatform({
      platform: 'linux',
      arch: 'x64',
      env: { SHELL: '/bin/bash' },
      osReleaseText: 'ID=ubuntu\nPRETTY_NAME="Ubuntu 24.04"\nVERSION_ID="24.04"',
      release: '6.8.0',
      uid: 1000,
      home: '/home/test',
    }),
    ...overrides,
  }
}

export function makeCtx(
  opts: Partial<GlobalOptions> = {},
  extra: {
    interactive?: boolean
    handler?: Handler
    platform?: PlatformInfo
    present?: string[]
    fetch?: typeof fetch
  } = {},
): TestCtx {
  const home = tmpDir()
  const out: string[] = []
  const err: string[] = []
  const runner = new FakeRunner(extra.handler)
  for (const p of extra.present ?? []) runner.present.add(p)
  const prompter = new FakePrompter()
  const ctx = createContext(
    { nonInteractive: !extra.interactive, ...opts },
    {
      env: { DOC_CLI_HOME: home, PATH: process.env['PATH'] ?? '', NO_COLOR: '1' },
      runner,
      prompter,
      interactive: extra.interactive ?? false,
      platform: extra.platform ?? linuxPlatform(),
      stdout: (s) => out.push(s),
      stderr: (s) => err.push(s),
      width: 100,
      ...(extra.fetch ? { fetch: extra.fetch } : {}),
    },
  )
  return { ctx, out, err, home, runner, prompter }
}
