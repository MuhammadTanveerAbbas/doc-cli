import fs from 'node:fs'
import path from 'node:path'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { runPlan, type OperationPlan } from '../../services/permissionService.js'
import { safeJoin } from '../../services/filesystemService.js'
import { validateSlug } from '../../utils/validation.js'
import { dirSize } from '../../services/filesystemService.js'
import { formatBytes } from '../../utils/formatting.js'
import { TEMPLATES, inspectProject } from './service.js'

const M = 'projects'

export const projectCommands: CommandDef[] = [
  {
    path: ['project', 'inspect'],
    summary: 'Describe the project in a folder',
    category: 'Projects and Git',
    module: M,
    options: [
      { flags: '--path <dir>', description: 'project folder', default: '.' },
      { flags: '--scan-deps', description: 'measure node_modules size (slow on large projects)' },
    ],
    async run(ctx, { opts }) {
      const root = path.resolve(String(opts['path'] ?? '.'))
      if (!fs.existsSync(root)) throw new DocError(`Folder not found: ${root}`, ExitCode.Usage)
      const info = inspectProject(root)
      let depsBytes: number | null = null
      if (opts['scanDeps'] && fs.existsSync(path.join(root, 'node_modules')))
        depsBytes = dirSize(path.join(root, 'node_modules')).bytes
      ctx.out.emit({ ...info, nodeModulesBytes: depsBytes }, (o) => {
        o.heading('Project')
        o.kv([
          ['Folder', info.root],
          ['Name', info.name ?? 'unknown'],
          ['Type', info.kinds.join(', ') || 'not recognized'],
          ['Package manager', info.packageManager ?? 'unknown'],
          ['Git repository', info.hasGit ? 'yes' : 'no'],
          ['Scripts', info.scripts.join(', ') || 'none'],
          ...(depsBytes !== null
            ? [['node_modules', formatBytes(depsBytes)] as [string, string]]
            : []),
        ])
      })
    },
  },
  {
    path: ['project', 'create'],
    summary: 'Create a small starter project from a template',
    category: 'Projects and Git',
    module: M,
    mutating: true,
    args: [{ name: 'name', required: true }],
    options: [
      { flags: '--template <t>', description: 'node or python', default: 'node' },
      { flags: '--dir <dir>', description: 'parent folder', default: '.' },
    ],
    async run(ctx, { args, opts }) {
      const name = validateSlug(args[0] ?? '')
      const tpl = TEMPLATES[String(opts['template'] ?? 'node')]
      if (!tpl) throw new DocError('Template must be node or python.', ExitCode.Usage)
      const root = path.resolve(String(opts['dir'] ?? '.'), name)
      if (fs.existsSync(root))
        throw new DocError(`${root} already exists. Nothing was changed.`, ExitCode.Usage)
      const plan: OperationPlan = {
        title: `Create project ${name}`,
        kind: 'project',
        risk: 'low',
        steps: Object.keys(tpl).map((f) => ({
          description: `Write ${f}`,
          paths: [path.join(root, f)],
        })),
      }
      const outcome = await runPlan(ctx, plan, async () => {
        for (const [file, content] of Object.entries(tpl)) {
          const target = safeJoin(root, file)
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.writeFileSync(target, content.replaceAll('__NAME__', name))
        }
        return root
      })
      if (outcome.decision === 'approved') ctx.out.status('ok', `Created ${root}`)
    },
  },
  {
    path: ['project', 'init'],
    summary: 'Initialize Git in the current folder with a basic .gitignore',
    category: 'Projects and Git',
    module: M,
    mutating: true,
    options: [{ flags: '--path <dir>', description: 'project folder', default: '.' }],
    async run(ctx, { opts }) {
      const root = path.resolve(String(opts['path'] ?? '.'))
      if (fs.existsSync(path.join(root, '.git'))) {
        ctx.out.emit({ initialized: false }, (o) =>
          o.status('skip', 'This folder is already a Git repository.'),
        )
        return
      }
      const ignore = path.join(root, '.gitignore')
      const plan: OperationPlan = {
        title: `Initialize Git in ${root}`,
        kind: 'project',
        risk: 'low',
        steps: [
          { description: 'Run git init', executable: 'git', args: ['init'], paths: [root] },
          ...(fs.existsSync(ignore)
            ? []
            : [{ description: 'Write a basic .gitignore', paths: [ignore] }]),
        ],
      }
      await runPlan(ctx, plan, async () => {
        const r = await ctx.runner.run('git', ['init'], { cwd: root, timeoutMs: 20_000 })
        if (r.notFound) throw new DocError('Git is not installed.', ExitCode.Environment)
        if (!r.ok) throw new DocError(`git init failed: ${r.stderr}`)
        if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, 'node_modules\n.env\n.DS_Store\n')
      })
    },
  },
]
