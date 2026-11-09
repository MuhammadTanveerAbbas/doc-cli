import { parseArgv } from '../../cli/commandParser.js'
import { allCommands } from '../../cli/commandRegistry.js'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { EXPLAIN_SYSTEM, PLAN_SYSTEM, getProvider, preview, validateActionPlan } from './service.js'

const M = 'ai'
const cat = 'AI and Plugins' as const

async function consent(
  ctx: Parameters<CommandDef['run']>[0],
  text: string,
  provider: string,
): Promise<void> {
  ctx.out.heading(`This exact text will be sent to ${provider}`)
  ctx.out.line(text)
  if (!ctx.interactive) {
    if (!ctx.opts.yes)
      throw new DocError(
        'Sending data to an AI provider needs your approval.',
        ExitCode.Declined,
        'Repeat with --yes to approve this exact payload.',
      )
    return
  }
  if (!(await ctx.prompter.confirm('Send this text?', false)))
    throw new DocError('Cancelled, nothing was sent.', ExitCode.Declined)
}

export const aiCommands: CommandDef[] = [
  {
    path: ['ai', 'status'],
    summary: 'Show whether the optional AI assistant is enabled',
    category: cat,
    module: M,
    async run(ctx) {
      const ai = ctx.config.load().ai
      const keyOk = ai.apiKeyEnv ? Boolean(ctx.env[ai.apiKeyEnv]) : null
      ctx.out.emit({ ...ai, keyPresent: keyOk }, (o) => {
        o.heading('AI assistant')
        o.kv([
          ['Enabled', ai.enabled ? 'yes' : 'no'],
          ['Provider', ai.provider ?? 'none'],
          ['Model', ai.model ?? 'none'],
          [
            'API key variable',
            ai.apiKeyEnv ? `${ai.apiKeyEnv} (${keyOk ? 'set' : 'not set'})` : 'none',
          ],
        ])
        o.line(
          o.style.muted(
            'Nothing is sent to a provider unless you approve the exact text for each request.',
          ),
        )
      })
    },
  },
  {
    path: ['ai', 'configure'],
    summary: 'Choose a provider and opt in to the AI assistant',
    category: cat,
    module: M,
    mutating: true,
    options: [
      { flags: '--provider <id>', description: 'openai, anthropic, gemini, or ollama' },
      { flags: '--model <name>', description: 'model name from your provider' },
      { flags: '--key-env <name>', description: 'environment variable that holds your API key' },
      {
        flags: '--endpoint <url>',
        description: 'custom endpoint (Ollama or a compatible gateway)',
      },
    ],
    async run(ctx, { opts }) {
      let provider = opts['provider'] as string | undefined
      let model = opts['model'] as string | undefined
      let keyEnv = opts['keyEnv'] as string | undefined
      const endpoint = opts['endpoint'] as string | undefined
      if (!provider) {
        if (!ctx.interactive) throw new DocError('Pass --provider and --model.', ExitCode.Usage)
        provider = await ctx.prompter.select(
          'Provider',
          ['openai', 'anthropic', 'gemini', 'ollama'].map((p) => ({ name: p, value: p })),
        )
      }
      if (!['openai', 'anthropic', 'gemini', 'ollama'].includes(provider))
        throw new DocError('Unknown provider', ExitCode.Usage)
      if (!model) {
        if (!ctx.interactive)
          throw new DocError('Pass --model with a model name from your provider.', ExitCode.Usage)
        model = await ctx.prompter.input('Model name (see your provider documentation)')
      }
      if (provider !== 'ollama' && !keyEnv) {
        if (!ctx.interactive)
          throw new DocError(
            'Pass --key-env with the name of the variable that holds your key.',
            ExitCode.Usage,
          )
        keyEnv = await ctx.prompter.input(
          'Environment variable that holds your API key',
          provider === 'openai'
            ? 'OPENAI_API_KEY'
            : provider === 'anthropic'
              ? 'ANTHROPIC_API_KEY'
              : 'GEMINI_API_KEY',
        )
      }
      if (
        endpoint &&
        !endpoint.startsWith('https://') &&
        !endpoint.startsWith('http://localhost') &&
        !endpoint.startsWith('http://127.0.0.1')
      ) {
        throw new DocError('Endpoints must use https, or http on localhost.', ExitCode.Usage)
      }
      ctx.config.set('ai.provider', JSON.stringify(provider))
      ctx.config.set('ai.model', JSON.stringify(model))
      ctx.config.set('ai.apiKeyEnv', keyEnv ? JSON.stringify(keyEnv) : 'null')
      ctx.config.set('ai.endpoint', endpoint ? JSON.stringify(endpoint) : 'null')
      ctx.config.set('ai.enabled', 'true')
      ctx.out.emit({ provider, model }, (o) => {
        o.status('ok', `AI assistant enabled with ${provider}.`)
        o.line(
          'Your API key is read from the environment variable at request time. DOC CLI never stores the key.',
        )
      })
    },
  },
  {
    path: ['ai', 'disable'],
    summary: 'Turn the AI assistant off',
    category: cat,
    module: M,
    mutating: true,
    async run(ctx) {
      ctx.config.set('ai.enabled', 'false')
      ctx.out.emit({ enabled: false }, (o) => o.status('ok', 'AI assistant disabled.'))
    },
  },
  {
    path: ['ai', 'explain'],
    summary: 'Ask the provider to explain text you give (shown to you before sending)',
    category: cat,
    module: M,
    args: [{ name: 'text', required: true, variadic: true }],
    async run(ctx, { args }) {
      const provider = getProvider(ctx)
      const text = preview(args.join(' '))
      await consent(ctx, text, provider.id)
      const answer = await provider.complete(EXPLAIN_SYSTEM, text)
      ctx.out.emit({ answer }, (o) => o.essential(answer))
    },
  },
  {
    path: ['ai', 'plan'],
    summary: 'Turn a request into reviewed DOC CLI commands (never runs them silently)',
    category: cat,
    module: M,
    mutating: true,
    args: [{ name: 'request', required: true, variadic: true }],
    async run(ctx, { args }) {
      const provider = getProvider(ctx)
      const text = preview(args.join(' '))
      await consent(ctx, text, provider.id)
      const plan = validateActionPlan(await provider.complete(PLAN_SYSTEM, text))
      ctx.out.heading('Proposed plan')
      ctx.out.line(plan.summary)
      plan.actions.forEach((a, i) =>
        ctx.out.line(`  ${i + 1}. doc-cli ${a.argv.join(' ')}\n     Why: ${a.reason}`),
      )
      if (plan.actions.length === 0) return
      if (ctx.opts.dryRun) return
      if (!ctx.interactive)
        throw new DocError(
          'Running AI proposed commands needs an interactive terminal.',
          ExitCode.Declined,
        )
      if (
        !(await ctx.prompter.confirm(
          'Run these commands one by one? Each still shows its own plan and asks again.',
          false,
        ))
      )
        return
      for (const a of plan.actions) {
        ctx.out.line(`\nRunning: doc-cli ${a.argv.join(' ')}`)
        const code = await parseArgv(allCommands(), a.argv, {})
        if (code !== 0) throw new DocError(`Stopped, command exited with code ${code}.`, code)
      }
    },
  },
]
