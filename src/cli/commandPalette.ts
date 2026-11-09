import type { Choice } from '../ui/prompts.js'
import type { Prompter } from '../ui/prompts.js'
import { commandName, usageOf, type CommandDef } from './types.js'

export function paletteChoices(
  defs: CommandDef[],
  term: string | undefined,
): Array<Choice<CommandDef>> {
  const q = (term ?? '').trim().toLowerCase()
  return defs
    .filter((d) => !q || `${commandName(d)} ${d.summary} ${d.category}`.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || commandName(a).localeCompare(commandName(b)),
    )
    .map((d) => ({
      name: `${d.category}: ${commandName(d)}`,
      value: d,
      description: `${d.summary}\n${usageOf(d)}`,
    }))
}

export async function pickCommand(
  prompter: Prompter,
  defs: CommandDef[],
): Promise<CommandDef | null> {
  try {
    return await prompter.search('Command palette (type to filter, Ctrl+C closes)', (term) =>
      paletteChoices(defs, term),
    )
  } catch {
    return null
  }
}

export async function collectArgs(prompter: Prompter, def: CommandDef): Promise<string[]> {
  const out: string[] = [...def.path]
  for (const a of def.args ?? []) {
    if (a.required === false) continue
    const value = await prompter.input(
      `${a.name}${a.variadic ? ' (separate words with spaces)' : ''}`,
    )
    if (!value.trim()) break
    out.push(...(a.variadic ? value.trim().split(/\s+/) : [value.trim()]))
  }
  return out
}

export function completer(defs: CommandDef[]): (line: string) => [string[], string] {
  const names = defs.map(commandName)
  return (line) => {
    const prefix = line.trimStart()
    const hits = names.filter((n) => n.startsWith(prefix))
    return [hits.length ? hits : names, prefix]
  }
}
