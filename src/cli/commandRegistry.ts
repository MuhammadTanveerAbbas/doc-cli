import { aiCommands } from '../modules/ai/commands.js'
import { backupCommands } from '../modules/backup/commands.js'
import { downloadCommands } from '../modules/downloads/commands.js'
import { setupCommands } from '../modules/developerSetup/commands.js'
import { configCommands } from '../modules/general/configCommands.js'
import { generalCommands } from '../modules/general/commands.js'
import { gitCommands } from '../modules/git/commands.js'
import { historyCommands } from '../modules/history/commands.js'
import { networkCommands } from '../modules/network/commands.js'
import { packageCommands } from '../modules/packages/commands.js'
import { performanceCommands } from '../modules/performance/commands.js'
import { pluginCommands } from '../modules/plugins/commands.js'
import { projectCommands } from '../modules/projects/commands.js'
import { runtimeCommands, toolsCommands } from '../modules/runtime/commands.js'
import { securityCommands } from '../modules/security/commands.js'
import { systemCommands } from '../modules/system/commands.js'
import { updaterCommands } from '../modules/updater/commands.js'
import { DocError, ExitCode } from '../core/errors.js'
import { commandName, usageOf, type Category, type CommandDef } from './types.js'

const CATEGORY_ORDER: Category[] = [
  'General',
  'System',
  'Packages',
  'Developer Setup',
  'Runtimes and Tools',
  'Performance',
  'History',
  'Projects and Git',
  'Network and Security',
  'Backup and Downloads',
  'AI and Plugins',
  'Updates',
  'Settings',
]

const helpCommand: CommandDef = {
  path: ['help'],
  summary: 'Show commands, or usage for one command',
  category: 'General',
  module: 'general',
  args: [{ name: 'command', required: false, variadic: true }],
  async run(ctx, { args }) {
    const defs = allCommands()
    if (args.length > 0) {
      const wanted = args.join(' ')
      const hits = defs.filter(
        (d) => commandName(d) === wanted || commandName(d).startsWith(wanted + ' '),
      )
      if (hits.length === 0) throw new DocError(`No command named "${wanted}"`, ExitCode.Usage)
      ctx.out.emit(
        hits.map((d) => ({ command: commandName(d), usage: usageOf(d), summary: d.summary })),
        (o) => {
          for (const d of hits) {
            o.line(`${usageOf(d)}\n    ${d.summary}`)
            for (const opt of d.options ?? []) o.line(`    ${opt.flags}  ${opt.description}`)
          }
        },
      )
      return
    }
    ctx.out.emit(
      defs.map((d) => ({ command: commandName(d), category: d.category, summary: d.summary })),
      (o) => {
        o.line(
          'Usage: doc-cli [global options] <command>   (no command opens the interactive shell)',
        )
        for (const cat of CATEGORY_ORDER) {
          const group = defs.filter((d) => d.category === cat)
          if (!group.length) continue
          o.heading(cat)
          for (const d of group) o.line(`  ${commandName(d).padEnd(30)} ${d.summary}`)
        }
        o.line(
          '\nGlobal options: --json --quiet --verbose --no-color --non-interactive --yes --dry-run --allow-elevation',
        )
        o.line('Type / in the interactive shell to open the command palette.')
      },
    )
  },
}

export function completionScript(shell: string, defs: CommandDef[]): string {
  const top = [...new Set(defs.map((d) => d.path[0] ?? ''))].sort()
  const subs = (t: string) =>
    [
      ...new Set(defs.filter((d) => d.path[0] === t && d.path[1]).map((d) => d.path[1] as string)),
    ].sort()
  if (shell === 'bash') {
    const cases = top
      .map((t) => `    ${t}) COMPREPLY=( $(compgen -W "${subs(t).join(' ')}" -- "$cur") ) ;;`)
      .join('\n')
    return `_doc_cli() {\n  local cur="\${COMP_WORDS[COMP_CWORD]}"\n  if [ "$COMP_CWORD" -eq 1 ]\n  then\n    COMPREPLY=( $(compgen -W "${top.join(' ')}" -- "$cur") )\n    return\n  fi\n  case "\${COMP_WORDS[1]}" in\n${cases}\n  esac\n}\ncomplete -F _doc_cli doc-cli\n`
  }
  if (shell === 'zsh') {
    const cases = top
      .map(
        (t) =>
          `    ${t}) _values 'subcommand' ${subs(t)
            .map((s) => `'${s}'`)
            .join(' ')} ;;`,
      )
      .join('\n')
    return `#compdef doc-cli\n_doc_cli() {\n  if (( CURRENT == 2 ))\n  then\n    _values 'command' ${top.map((t) => `'${t}'`).join(' ')}\n  else\n    case "$words[2]" in\n${cases}\n    esac\n  fi\n}\n_doc_cli "$@"\n`
  }
  if (shell === 'fish') {
    const lines = top.map((t) => `complete -c doc-cli -n '__fish_use_subcommand' -a '${t}'`)
    for (const t of top)
      for (const s of subs(t))
        lines.push(`complete -c doc-cli -n '__fish_seen_subcommand_from ${t}' -a '${s}'`)
    return lines.join('\n') + '\n'
  }
  if (shell === 'powershell') {
    const map = top
      .map(
        (t) =>
          `  '${t}' = @(${subs(t)
            .map((s) => `'${s}'`)
            .join(', ')})`,
      )
      .join('\n')
    return `$docCliTree = @{\n${map}\n}\nRegister-ArgumentCompleter -Native -CommandName doc-cli -ScriptBlock {\n  param($wordToComplete, $commandAst, $cursorPosition)\n  $words = $commandAst.CommandElements | ForEach-Object { $_.ToString() }\n  if ($words.Count -le 2) { $docCliTree.Keys | Where-Object { $_ -like "$wordToComplete*" } | Sort-Object }\n  else { $docCliTree[$words[1]] | Where-Object { $_ -like "$wordToComplete*" } }\n}\n`
  }
  throw new DocError('Shell must be bash, zsh, fish, or powershell.', ExitCode.Usage)
}

const completionCommand: CommandDef = {
  path: ['completion'],
  summary: 'Print a shell completion script (bash, zsh, fish, powershell)',
  category: 'General',
  module: 'general',
  args: [{ name: 'shell', required: true }],
  async run(ctx, { args }) {
    const script = completionScript(args[0] ?? '', allCommands())
    ctx.out.emit({ shell: args[0], script }, (o) => o.essential(script.trimEnd()))
  },
}

let cached: CommandDef[] | null = null

export function allCommands(): CommandDef[] {
  if (cached) return cached
  cached = [
    ...generalCommands,
    helpCommand,
    completionCommand,
    ...systemCommands,
    ...packageCommands,
    ...setupCommands,
    ...runtimeCommands,
    ...toolsCommands,
    ...performanceCommands,
    ...historyCommands,
    ...projectCommands,
    ...gitCommands,
    ...networkCommands,
    ...downloadCommands,
    ...backupCommands,
    ...securityCommands,
    ...aiCommands,
    ...pluginCommands,
    ...updaterCommands,
    ...configCommands,
  ]
  return cached
}
