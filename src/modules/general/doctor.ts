import fs from 'node:fs'
import { detectManagers, createAdapters } from '../../adapters/packageManagers/registry.js'
import type { AppContext } from '../../core/context.js'
import { MIN_NODE, nodeSupported } from '../../core/version.js'
import { inspectPath } from '../system/service.js'

export type CheckLevel = 'ok' | 'warn' | 'fail' | 'skip'

export interface DoctorCheck {
  name: string
  level: CheckLevel
  detail: string
}

function writable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

export async function runDoctor(ctx: AppContext, withNetwork: boolean): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = []
  const add = (name: string, level: CheckLevel, detail: string) =>
    checks.push({ name, level, detail })

  add(
    'Node.js runtime',
    nodeSupported(ctx.platform.nodeVersion) ? 'ok' : 'fail',
    `${ctx.platform.nodeVersion} (minimum ${MIN_NODE})`,
  )
  add(
    'Operating system',
    'ok',
    `${ctx.platform.distroName ?? ctx.platform.id} ${ctx.platform.arch}`,
  )

  try {
    ctx.config.load()
    add('Configuration', 'ok', ctx.config.path)
  } catch (err) {
    add('Configuration', 'fail', (err as Error).message.split('\n')[0] ?? 'invalid')
  }

  for (const [label, dir] of [
    ['Data directory', ctx.dirs.data],
    ['Config directory', ctx.dirs.config],
  ] as const) {
    add(label, writable(dir) ? 'ok' : 'fail', dir)
  }

  const detected = await detectManagers(createAdapters(ctx.runner, ctx.platform))
  const found = detected.filter((d) => d.available)
  add(
    'Package managers',
    found.length > 0 ? 'ok' : 'warn',
    found.length > 0 ? found.map((d) => d.adapter.id).join(', ') : 'none detected',
  )

  const git = await ctx.runner.which('git')
  add('Git', git ? 'ok' : 'warn', git ?? 'not found on PATH')

  const badPath = inspectPath(ctx.env).filter((e) => !e.exists)
  add(
    'PATH health',
    badPath.length === 0 ? 'ok' : 'warn',
    badPath.length === 0 ? 'all entries exist' : `${badPath.length} missing entries`,
  )

  if (ctx.platform.isRoot)
    add('Privileges', 'warn', 'running as administrator, prefer a normal user')

  if (withNetwork) {
    try {
      const res = await ctx.fetch('https://registry.npmjs.org/', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
      add('Network', res.ok ? 'ok' : 'warn', `registry.npmjs.org answered ${res.status}`)
    } catch (err) {
      add('Network', 'warn', `could not reach registry.npmjs.org (${(err as Error).message})`)
    }
  } else {
    add('Network', 'skip', 'skipped, use --network to test')
  }
  return checks
}
