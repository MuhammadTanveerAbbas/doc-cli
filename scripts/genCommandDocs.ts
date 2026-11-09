import fs from 'node:fs'
import path from 'node:path'
import { allCommands } from '../src/cli/commandRegistry.js'
import { commandName, usageOf, type Category } from '../src/cli/types.js'

const order: Category[] = [
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

const lines: string[] = [
  '# Command reference',
  '',
  'This file is generated from the command registry by `pnpm docs:commands`. Every command listed here is implemented in this release. Run `doc-cli help <command>` for the same details in your terminal.',
  '',
  '## Global options',
  '',
  'These work with every command.',
  '',
  '```text',
  '--json              machine readable JSON output',
  '--quiet             reduce output',
  '--verbose           print diagnostics',
  '--no-color          disable color output (NO_COLOR is also honored)',
  '--non-interactive   never prompt, fail instead of asking',
  '--yes               approve confirmations (not administrator elevation)',
  '--dry-run           show the plan and change nothing',
  '--allow-elevation   with --yes, approve steps that need administrator rights',
  '```',
  '',
  '## Exit codes',
  '',
  '1. `0` success.',
  '2. `1` general failure.',
  '3. `2` usage error, such as an unknown command or invalid argument.',
  '4. `3` the operation is not supported on this system.',
  '5. `4` the operation needed approval and did not get it.',
  '6. `5` verification failed, such as a checksum mismatch.',
  '7. `6` network failure.',
  '8. `7` the environment is not ready, for example an unsupported Node.js version.',
  '',
]

for (const cat of order) {
  const group = allCommands().filter((d) => d.category === cat)
  if (!group.length) continue
  lines.push(`## ${cat}`, '')
  for (const d of group) {
    lines.push(`### ${commandName(d)}`, '', d.summary + '.', '', '```bash', usageOf(d), '```', '')
    if (d.options?.length) {
      lines.push('Options:', '', '```text')
      for (const o of d.options) lines.push(`${o.flags.padEnd(26)}${o.description}`)
      lines.push('```', '')
    }
    if (d.mutating)
      lines.push(
        'This command can change your system. It shows a plan first and asks for approval.',
        '',
      )
  }
}

fs.writeFileSync(
  path.resolve(import.meta.dirname, '..', 'docs', 'COMMANDS.md'),
  lines.join('\n') + '\n',
)
console.log(`Wrote docs/COMMANDS.md with ${allCommands().length} commands`)
