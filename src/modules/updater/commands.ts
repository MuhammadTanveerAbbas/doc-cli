import fs from 'node:fs'
import path from 'node:path'
import type { CommandDef } from '../../cli/types.js'
import { DocError, ExitCode, unsupported } from '../../core/errors.js'
import { runPlan, type OperationPlan } from '../../services/permissionService.js'
import {
  PACKAGE_NAME,
  appendUpdateHistory,
  checkForUpdate,
  detectInstallMethod,
  parseChecksums,
  readUpdateHistory,
  releaseVersion,
  replaceExecutable,
  standaloneAssetName,
  verifyChecksum,
} from './service.js'
import { validateHttpsUrl } from '../../utils/validation.js'

const M = 'updater'

export const updaterCommands: CommandDef[] = [
  {
    path: ['update', 'check'],
    summary: 'Check whether a newer DOC CLI release exists',
    category: 'Updates',
    module: M,
    async run(ctx) {
      const r = await checkForUpdate(ctx)
      ctx.out.emit(r, (o, v) => {
        o.heading('Update check')
        o.kv([
          ['Installed version', v.current],
          ['Channel', v.channel],
          ['Latest on channel', v.latest ?? 'unknown'],
          ['Update available', v.updateAvailable ? 'yes' : 'no'],
        ])
        if (v.note) o.line(v.note)
        if (v.updateAvailable) o.line('Run "doc-cli update" to install it.')
      })
    },
  },
  {
    path: ['update'],
    summary: 'Install the newest release after showing a plan',
    category: 'Updates',
    module: M,
    mutating: true,
    async run(ctx) {
      const check = await checkForUpdate(ctx)
      if (!check.configured)
        throw new DocError(check.note ?? 'No update source configured', ExitCode.Environment)
      if (!check.updateAvailable || !check.latest || !check.release) {
        ctx.out.emit(check, (o) =>
          o.status('ok', `DOC CLI ${ctx.version} is up to date on the ${check.channel} channel.`),
        )
        return
      }
      const method = detectInstallMethod(path.resolve(process.argv[1] ?? ''), process.execPath)
      const latest = check.latest
      if (method === 'source') {
        ctx.out.emit(check, (o) => {
          o.status('info', `Version ${latest} is available.`)
          o.line(
            'This copy runs from source. Update it with your Git workflow, then run pnpm install and pnpm build.',
          )
        })
        return
      }
      if (method === 'npm' || method === 'pnpm') {
        const args =
          method === 'npm'
            ? ['install', '-g', `${PACKAGE_NAME}@${latest}`]
            : ['add', '-g', `${PACKAGE_NAME}@${latest}`]
        const plan: OperationPlan = {
          title: `Update DOC CLI to ${latest} using ${method}`,
          kind: 'update',
          risk: 'medium',
          steps: [
            {
              description: `Install the new package version with ${method}`,
              executable: method,
              args,
            },
          ],
          notes: [
            'The package manager owns the installed files, DOC CLI will not overwrite them directly.',
          ],
        }
        const outcome = await runPlan(ctx, plan, async () => {
          const r = await ctx.runner.run(method, args, { timeoutMs: 5 * 60_000 })
          if (!r.ok) throw new DocError(`${method} failed: ${(r.stderr || r.stdout).slice(-400)}`)
          appendUpdateHistory(ctx.dirs.updates, {
            at: new Date().toISOString(),
            from: ctx.version,
            to: latest,
            method,
            result: 'success',
          })
          return true
        })
        if (outcome.decision === 'approved')
          ctx.out.status('ok', `Updated to ${latest}. Start a new terminal session to use it.`)
        return
      }
      const asset = standaloneAssetName(ctx.platform.id, ctx.platform.arch)
      const found = check.release.assets.find((a) => a.name === asset)
      const sums = check.release.assets.find((a) => a.name === 'SHA256SUMS')
      if (!found || !sums) {
        throw new DocError(
          `Release ${latest} has no verified standalone build for ${ctx.platform.id} ${ctx.platform.arch}.`,
          ExitCode.Unsupported,
        )
      }
      const target = process.execPath
      const plan: OperationPlan = {
        title: `Replace the standalone executable with version ${latest}`,
        kind: 'update',
        risk: 'medium',
        steps: [
          {
            description: `Download ${asset} and SHA256SUMS from the official release`,
            paths: [ctx.dirs.updates],
          },
          { description: 'Verify the SHA 256 checksum before replacing anything' },
          {
            description: 'Keep the current version as a backup, replace the executable, verify it',
            paths: [target],
            reversible: true,
          },
        ],
      }
      await runPlan(ctx, plan, async () => {
        validateHttpsUrl(found.browser_download_url)
        validateHttpsUrl(sums.browser_download_url)
        fs.mkdirSync(ctx.dirs.updates, { recursive: true })
        const staged = path.join(ctx.dirs.updates, `${asset}.staged`)
        const [binRes, sumRes] = await Promise.all([
          ctx.fetch(found.browser_download_url),
          ctx.fetch(sums.browser_download_url),
        ])
        if (!binRes.ok || !sumRes.ok) throw new DocError('Download failed', ExitCode.Network)
        fs.writeFileSync(staged, Buffer.from(await binRes.arrayBuffer()))
        const expected = parseChecksums(await sumRes.text()).get(asset)
        if (!expected)
          throw new DocError('SHA256SUMS has no entry for this build', ExitCode.Verification)
        try {
          await verifyChecksum(staged, expected)
        } catch (err) {
          fs.rmSync(staged, { force: true })
          throw err
        }
        await replaceExecutable(
          target,
          staged,
          async (file) => (await ctx.runner.run(file, ['version'], { timeoutMs: 15_000 })).ok,
        )
        appendUpdateHistory(ctx.dirs.updates, {
          at: new Date().toISOString(),
          from: ctx.version,
          to: latest,
          method,
          result: 'success',
        })
      })
    },
  },
  {
    path: ['update', 'channel'],
    summary: 'Show or set the update channel (stable, beta, nightly)',
    category: 'Updates',
    module: M,
    mutating: true,
    args: [{ name: 'channel', required: false }],
    async run(ctx, { args }) {
      const [channel] = args
      if (!channel) {
        const current = ctx.config.load().updates.channel
        ctx.out.emit({ channel: current }, (o) => o.line(`Update channel: ${current}`))
        return
      }
      if (!['stable', 'beta', 'nightly'].includes(channel)) {
        throw new DocError('Channel must be stable, beta, or nightly', ExitCode.Usage)
      }
      ctx.config.set('updates.channel', JSON.stringify(channel))
      ctx.out.emit({ channel }, (o) => {
        o.status('ok', `Update channel set to ${channel}.`)
        if (channel !== 'stable')
          o.line('Beta and nightly channels only work when the project publishes such releases.')
      })
    },
  },
  {
    path: ['update', 'history'],
    summary: 'Show past self updates',
    category: 'Updates',
    module: M,
    async run(ctx) {
      const rows = readUpdateHistory(ctx.dirs.updates)
      ctx.out.emit(rows, (o, v) => {
        o.heading('Update history')
        o.table(
          ['When', 'From', 'To', 'Method', 'Result'],
          v.map((r) => [r.at, r.from, r.to, r.method, r.result]),
        )
      })
    },
  },
  {
    path: ['update', 'rollback'],
    summary: 'Restore the previous standalone executable',
    category: 'Updates',
    module: M,
    mutating: true,
    async run(ctx) {
      const method = detectInstallMethod(path.resolve(process.argv[1] ?? ''), process.execPath)
      if (method !== 'standalone') {
        throw unsupported(
          `Rollback is only available for standalone installs. This install uses: ${method}.`,
          method === 'source'
            ? 'Use Git to return to an earlier commit.'
            : `Reinstall an older version with ${method}, for example ${PACKAGE_NAME}@<version>.`,
        )
      }
      const backup = `${process.execPath}.previous`
      if (!fs.existsSync(backup))
        throw new DocError('No previous version is stored.', ExitCode.Environment)
      const plan: OperationPlan = {
        title: 'Restore the previous DOC CLI executable',
        kind: 'update',
        risk: 'medium',
        steps: [
          {
            description: 'Swap the current executable with the stored backup',
            paths: [process.execPath, backup],
            reversible: true,
          },
        ],
      }
      await runPlan(ctx, plan, async () => {
        const current = process.execPath
        const tmp = `${current}.rollback`
        fs.renameSync(current, tmp)
        fs.renameSync(backup, current)
        fs.rmSync(tmp, { force: true })
        appendUpdateHistory(ctx.dirs.updates, {
          at: new Date().toISOString(),
          from: ctx.version,
          to: 'previous',
          method,
          result: 'rolled_back',
        })
      })
    },
  },
]

export { releaseVersion }
