import type { CommandDef } from '../../cli/types.js'

import { runPlan } from '../../services/permissionService.js'

export const configCommands: CommandDef[] = [
  {
    path: ['config', 'get'],
    summary: 'Read a configuration value (for example ui.theme)',
    category: 'Settings',
    module: 'config',
    args: [{ name: 'key', required: true }],
    async run(ctx, { args }) {
      const v = ctx.config.get(args[0] ?? '')
      ctx.out.emit({ key: args[0], value: v }, (o) =>
        o.essential(typeof v === 'string' ? v : JSON.stringify(v, null, 2)),
      )
    },
  },
  {
    path: ['config', 'set'],
    summary: 'Change a configuration value after confirmation',
    category: 'Settings',
    module: 'config',
    mutating: true,
    args: [
      { name: 'key', required: true },
      { name: 'value', required: true },
    ],
    async run(ctx, { args }) {
      const [key = '', value = ''] = args
      ctx.config.get(key)
      const outcome = await runPlan(
        ctx,
        {
          title: `Set ${key}`,
          kind: 'config',
          risk: 'low',
          steps: [{ description: `Set ${key} to ${value}`, paths: [ctx.config.path] }],
        },
        async () => ctx.config.set(key, value),
      )
      if (outcome.decision === 'approved')
        ctx.out.emit({ key, value }, (o) => o.status('ok', `${key} updated.`))
    },
  },
  {
    path: ['config', 'reset'],
    summary: 'Restore default configuration after confirmation',
    category: 'Settings',
    module: 'config',
    mutating: true,
    async run(ctx) {
      const outcome = await runPlan(
        ctx,
        {
          title: 'Reset configuration to defaults',
          kind: 'config',
          risk: 'medium',
          steps: [
            {
              description: 'Overwrite the configuration file with defaults',
              paths: [ctx.config.path],
              reversible: false,
            },
          ],
        },
        async () => ctx.config.reset(),
      )
      if (outcome.decision === 'approved') ctx.out.status('ok', 'Configuration reset.')
    },
  },
  {
    path: ['config', 'show'],
    summary: 'Print the full configuration',
    category: 'Settings',
    module: 'config',
    async run(ctx) {
      const cfg = ctx.config.load()
      ctx.out.emit(cfg, (o) => o.essential(JSON.stringify(cfg, null, 2)))
    },
  },
]
