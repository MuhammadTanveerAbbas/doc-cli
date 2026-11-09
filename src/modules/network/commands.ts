import dns from 'node:dns/promises'
import type { CommandDef } from '../../cli/types.js'
import { validateSearchQuery } from '../../utils/validation.js'

const HOSTS = ['github.com', 'registry.npmjs.org', 'pypi.org']

export const networkCommands: CommandDef[] = [
  {
    path: ['network', 'check'],
    summary: 'Test name lookup and HTTPS access to common developer hosts',
    category: 'Network and Security',
    module: 'network',
    async run(ctx) {
      const rows = []
      for (const host of HOSTS) {
        const started = Date.now()
        let dnsOk: boolean
        let https: string
        try {
          await dns.lookup(host)
          dnsOk = true
        } catch {
          dnsOk = false
        }
        try {
          const res = await ctx.fetch(`https://${host}/`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(6000),
          })
          https = `HTTP ${res.status}`
        } catch (err) {
          https = `failed (${(err as Error).message})`
        }
        rows.push({ host, dns: dnsOk, https, ms: Date.now() - started })
      }
      ctx.out.emit(rows, (o, v) => {
        o.heading('Network check')
        for (const r of v)
          o.status(
            r.dns && r.https.startsWith('HTTP') ? 'ok' : 'warn',
            `${r.host}: DNS ${r.dns ? 'ok' : 'failed'}, HTTPS ${r.https}, ${r.ms} ms`,
          )
      })
    },
  },
  {
    path: ['network', 'dns'],
    summary: 'Resolve a host name',
    category: 'Network and Security',
    module: 'network',
    args: [{ name: 'host', required: false }],
    async run(ctx, { args }) {
      const host = validateSearchQuery(args[0] ?? 'github.com')
      const result: { host: string; a: string[]; aaaa: string[]; error?: string } = {
        host,
        a: [],
        aaaa: [],
      }
      try {
        result.a = await dns.resolve4(host)
      } catch (err) {
        result.error = (err as Error).message
      }
      try {
        result.aaaa = await dns.resolve6(host)
      } catch {
        // IPv6 may be absent
      }
      ctx.out.emit(result, (o, v) => {
        o.heading(`DNS for ${v.host}`)
        o.kv([
          ['IPv4', v.a.join(', ') || 'none'],
          ['IPv6', v.aaaa.join(', ') || 'none'],
          ...(v.error ? [['Error', v.error] as [string, string]] : []),
        ])
      })
    },
  },
]
