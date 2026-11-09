import fs from 'node:fs'
import type { CommandDef } from '../../cli/types.js'
import type { AppContext } from '../../core/context.js'
import { ExitCode } from '../../core/errors.js'
import { nodeSupported } from '../../core/version.js'
import { isSecretName } from '../../utils/redact.js'
import { inspectPath } from '../system/service.js'

interface Finding {
  id: string
  level: 'ok' | 'warn' | 'fail'
  text: string
}

export function runSecurityChecks(ctx: AppContext, deep: boolean): Finding[] {
  const f: Finding[] = []
  const cfg = ctx.config.load()
  f.push({
    id: 'node',
    level: nodeSupported(ctx.platform.nodeVersion) ? 'ok' : 'fail',
    text: `Node.js ${ctx.platform.nodeVersion}`,
  })
  f.push({
    id: 'root',
    level: ctx.platform.isRoot ? 'warn' : 'ok',
    text: ctx.platform.isRoot ? 'Running with administrator rights' : 'Running as a normal user',
  })
  const sec = cfg.security
  f.push({
    id: 'confirm',
    level: sec.confirmInstalls && sec.confirmRemovals && sec.confirmCleanup ? 'ok' : 'warn',
    text:
      sec.confirmInstalls && sec.confirmRemovals && sec.confirmCleanup
        ? 'All confirmations are enabled'
        : 'Some confirmations are disabled in configuration',
  })
  f.push({
    id: 'ai',
    level: cfg.ai.enabled ? 'warn' : 'ok',
    text: cfg.ai.enabled
      ? `AI assistant is enabled (${cfg.ai.provider ?? 'no provider'}). Prompts you approve are sent to that provider.`
      : 'AI assistant is off',
  })
  f.push({
    id: 'autoinstall',
    level: cfg.updates.autoInstall ? 'warn' : 'ok',
    text: cfg.updates.autoInstall
      ? 'Automatic update installation is on'
      : 'Automatic update installation is off',
  })
  if (ctx.platform.id !== 'windows') {
    for (const file of [ctx.dirs.configFile, ctx.dirs.historyFile]) {
      try {
        const mode = fs.statSync(file).mode & 0o077
        f.push({
          id: 'perm',
          level: mode === 0 ? 'ok' : 'warn',
          text: `${file} ${mode === 0 ? 'is private' : 'is readable by other users'}`,
        })
      } catch {
        continue
      }
    }
  }
  const bad = inspectPath(ctx.env).filter((e) => !e.exists)
  f.push({
    id: 'path',
    level: bad.length ? 'warn' : 'ok',
    text: bad.length ? `${bad.length} PATH entries do not exist` : 'PATH entries all exist',
  })
  if (deep) {
    if (ctx.platform.id !== 'windows') {
      for (const e of inspectPath(ctx.env).filter((x) => x.exists)) {
        try {
          if (fs.statSync(e.path).mode & 0o002)
            f.push({
              id: 'pathw',
              level: 'warn',
              text: `PATH folder is writable by everyone: ${e.path}`,
            })
        } catch {
          continue
        }
      }
    }
    const names = Object.keys(ctx.env).filter(isSecretName)
    f.push({
      id: 'env',
      level: names.length ? 'warn' : 'ok',
      text: names.length
        ? `${names.length} environment variables look like secrets (names only): ${names.slice(0, 8).join(', ')}`
        : 'No secret looking environment variable names',
    })
  }
  return f
}

function render(ctx: AppContext, findings: Finding[]): number {
  ctx.out.emit(findings, (o, v) => {
    o.heading('Security review')
    for (const x of v) o.status(x.level, x.text)
  })
  return findings.some((x) => x.level === 'fail') ? ExitCode.Environment : ExitCode.Ok
}

export const securityCommands: CommandDef[] = [
  {
    path: ['security', 'check'],
    summary: 'Quick local security settings check',
    category: 'Network and Security',
    module: 'security',
    async run(ctx) {
      return render(ctx, runSecurityChecks(ctx, false))
    },
  },
  {
    path: ['security', 'audit'],
    summary: 'Deeper local audit (PATH permissions, secret looking variable names)',
    category: 'Network and Security',
    module: 'security',
    async run(ctx) {
      return render(ctx, runSecurityChecks(ctx, true))
    },
  },
]
