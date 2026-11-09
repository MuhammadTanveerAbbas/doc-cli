import type { AppContext } from '../core/context.js'

export type Category =
  | 'General'
  | 'System'
  | 'Packages'
  | 'Developer Setup'
  | 'Runtimes and Tools'
  | 'Performance'
  | 'History'
  | 'Projects and Git'
  | 'Network and Security'
  | 'Backup and Downloads'
  | 'AI and Plugins'
  | 'Updates'
  | 'Settings'

export interface ArgDef {
  name: string
  description?: string
  required?: boolean
  variadic?: boolean
}

export interface OptionDef {
  flags: string
  description: string
  default?: string | boolean
}

export interface CommandInput {
  args: string[]
  opts: Record<string, unknown>
}

export interface CommandDef {
  path: string[]
  summary: string
  category: Category
  args?: ArgDef[]
  options?: OptionDef[]
  module: string
  mutating?: boolean
  run(ctx: AppContext, input: CommandInput): Promise<number | void>
}

export function commandName(def: CommandDef): string {
  return def.path.join(' ')
}

export function usageOf(def: CommandDef): string {
  const args = (def.args ?? [])
    .map((a) => {
      const n = a.variadic ? `${a.name}...` : a.name
      return a.required === false ? `[${n}]` : `<${n}>`
    })
    .join(' ')
  return `doc-cli ${def.path.join(' ')}${args ? ' ' + args : ''}`
}
