const SECRET_FLAGS = new Set([
  '--token',
  '--password',
  '--passwd',
  '--secret',
  '--api-key',
  '--apikey',
  '--key',
  '--auth',
  '--authorization',
  '--access-token',
  '--private-key',
  '--client-secret',
])

const SECRET_NAME = /(token|secret|password|passwd|apikey|api_key|private_key|credential|auth)/i

const TEXT_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/]+=*/gi,
  /\bsk_[A-Za-z0-9_]{16,}\b/g,
  /\bsk[_]?ant[A-Za-z0-9_]{12,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_]{30,}\b/g,
  /\bxox[abprs][A-Za-z0-9]{8,}\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
]

export const REDACTED = '[REDACTED]'

export interface RedactedArgs {
  args: string[]
  redacted: boolean
}

export function redactText(text: string): string {
  let out = text
  for (const re of TEXT_PATTERNS) out = out.replace(re, REDACTED)
  return out
}

export function redactArgs(args: readonly string[]): RedactedArgs {
  const out: string[] = []
  let redacted = false
  let hideNext = false
  for (const arg of args) {
    if (hideNext) {
      out.push(REDACTED)
      redacted = true
      hideNext = false
      continue
    }
    if (arg.startsWith('--') && arg.includes('=')) {
      const eq = arg.indexOf('=')
      const flag = arg.slice(0, eq).toLowerCase()
      if (SECRET_FLAGS.has(flag) || SECRET_NAME.test(flag)) {
        out.push(`${arg.slice(0, eq)}=${REDACTED}`)
        redacted = true
        continue
      }
    }
    if (arg.startsWith('--') && (SECRET_FLAGS.has(arg.toLowerCase()) || SECRET_NAME.test(arg))) {
      out.push(arg)
      hideNext = true
      continue
    }
    const assign = /^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/.exec(arg)
    if (assign && SECRET_NAME.test(assign[1] ?? '')) {
      out.push(`${assign[1]}=${REDACTED}`)
      redacted = true
      continue
    }
    const clean = redactText(arg)
    if (clean !== arg) redacted = true
    out.push(clean)
  }
  return { args: out, redacted }
}

export function isSecretName(name: string): boolean {
  return SECRET_NAME.test(name)
}

export function redactEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue
    out[k] = isSecretName(k) ? REDACTED : redactText(v)
  }
  return out
}
