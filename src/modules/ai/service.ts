import { z } from 'zod'
import { createProvider, type AiProvider } from '../../adapters/aiProviders/providers.js'
import { allCommands } from '../../cli/commandRegistry.js'
import type { AppContext } from '../../core/context.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { redactText } from '../../utils/redact.js'

export const ActionPlanSchema = z.object({
  summary: z.string().max(500),
  actions: z
    .array(
      z.object({ argv: z.array(z.string().max(200)).min(1).max(12), reason: z.string().max(300) }),
    )
    .max(8),
})
export type ActionPlan = z.infer<typeof ActionPlanSchema>

export function getProvider(ctx: AppContext): AiProvider {
  const ai = ctx.config.load().ai
  if (!ai.enabled || !ai.provider || !ai.model) {
    throw new DocError(
      'The AI assistant is not enabled.',
      ExitCode.Environment,
      'Run "doc-cli ai configure" to opt in.',
    )
  }
  let apiKey: string | undefined
  if (ai.provider !== 'ollama') {
    if (!ai.apiKeyEnv)
      throw new DocError(
        'No API key variable is configured.',
        ExitCode.Environment,
        'Run "doc-cli ai configure".',
      )
    apiKey = ctx.env[ai.apiKeyEnv]
    if (!apiKey)
      throw new DocError(
        `Environment variable ${ai.apiKeyEnv} is empty or missing.`,
        ExitCode.Environment,
      )
  }
  return createProvider(
    {
      provider: ai.provider,
      model: ai.model,
      ...(apiKey ? { apiKey } : {}),
      ...(ai.endpoint ? { endpoint: ai.endpoint } : {}),
    },
    ctx.fetch,
  )
}

export function validateActionPlan(raw: string): ActionPlan {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start)
    throw new DocError('The AI reply did not contain a plan.', ExitCode.Verification)
  let json: unknown
  try {
    json = JSON.parse(raw.slice(start, end + 1))
  } catch {
    throw new DocError('The AI reply was not valid JSON.', ExitCode.Verification)
  }
  const parsed = ActionPlanSchema.safeParse(json)
  if (!parsed.success)
    throw new DocError('The AI plan has an invalid structure.', ExitCode.Verification)
  const defs = allCommands()
  for (const a of parsed.data.actions) {
    const words = a.argv.filter((w) => !w.startsWith('-'))
    const def = defs
      .filter((d) => d.path.every((p, i) => words[i] === p))
      .sort((x, y) => y.path.length - x.path.length)[0]
    if (!def)
      throw new DocError(
        `The AI proposed an unknown command: ${a.argv.join(' ')}`,
        ExitCode.Verification,
      )
    if (
      def.category === 'AI and Plugins' ||
      def.path[0] === 'history' ||
      def.path[0] === 'config'
    ) {
      throw new DocError(
        `The AI may not propose this command: ${def.path.join(' ')}`,
        ExitCode.Verification,
      )
    }
    for (const w of a.argv) {
      if (/^--(yes|allow-elevation|non-interactive)$/.test(w))
        throw new DocError('The AI may not pre approve actions.', ExitCode.Verification)
    }
  }
  return parsed.data
}

export const PLAN_SYSTEM = [
  'You help users operate DOC CLI, a command line tool.',
  'Reply with JSON only, in this shape: {"summary": string, "actions": [{"argv": string[], "reason": string}]}.',
  'Each argv is the words after "doc-cli", for example ["packages","install","git"].',
  'Never include --yes, --allow-elevation, or shell commands. Propose at most 8 actions.',
].join(' ')

export const EXPLAIN_SYSTEM =
  'You explain command line output and errors to developers. Be concise and practical. Never ask for secrets.'

export function preview(text: string): string {
  return redactText(text)
}
