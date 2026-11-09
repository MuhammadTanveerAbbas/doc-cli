import { describe, expect, it } from 'vitest'
import { DocError, ExitCode } from '../../src/core/errors.js'
import { decidePlan, runPlan, type OperationPlan } from '../../src/services/permissionService.js'
import { makeCtx } from '../helpers.js'

const plan = (elevated = false): OperationPlan => ({
  title: 'Install thing',
  kind: 'install',
  risk: 'medium',
  steps: [{ description: 'do it', executable: 'npm', args: ['i'], elevated }],
})

describe('permission policy', () => {
  it('previews with dry run and changes nothing', async () => {
    const { ctx } = makeCtx({ dryRun: true })
    let ran = false
    const r = await runPlan(ctx, plan(), async () => (ran = true))
    expect(r.decision).toBe('preview')
    expect(ran).toBe(false)
    expect(ctx.state.previewed).toBe(true)
  })
  it('refuses to proceed without a terminal or --yes', async () => {
    const { ctx } = makeCtx()
    await expect(decidePlan(ctx, plan())).rejects.toMatchObject({ exitCode: ExitCode.Declined })
  })
  it('allows --yes for normal steps but not elevation by itself', async () => {
    const a = makeCtx({ yes: true })
    expect(await decidePlan(a.ctx, plan())).toBe('approved')
    const b = makeCtx({ yes: true })
    await expect(decidePlan(b.ctx, plan(true))).rejects.toBeInstanceOf(DocError)
    const c = makeCtx({ yes: true, allowElevation: true })
    expect(await decidePlan(c.ctx, plan(true))).toBe('approved')
  })
  it('asks interactively and honors a no', async () => {
    const t = makeCtx({}, { interactive: true })
    t.prompter.answers = [false]
    let ran = false
    const r = await runPlan(t.ctx, plan(), async () => (ran = true))
    expect(r.decision).toBe('declined')
    expect(ran).toBe(false)
    expect(t.prompter.asked).toHaveLength(1)
  })
  it('always asks for elevated plans even with --yes in a terminal', async () => {
    const t = makeCtx({ yes: true }, { interactive: true })
    t.prompter.answers = [true]
    expect(await decidePlan(t.ctx, plan(true))).toBe('approved')
    expect(t.prompter.asked).toHaveLength(1)
  })
  it('writes an audit record for approved and declined work', async () => {
    const t = makeCtx({ yes: true })
    await runPlan(t.ctx, plan(), async () => 1)
    const audit = t.ctx.history.readAudit()
    expect(audit[0]?.result).toBe('success')
    expect(audit[0]?.title).toBe('Install thing')
  })
})
