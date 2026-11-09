import type { AppContext } from '../core/context.js'
import { declined } from '../core/errors.js'
import type { AuditRecord } from './historyService.js'

export type Risk = 'low' | 'medium' | 'high'
export type OperationKind =
  | 'install'
  | 'upgrade'
  | 'remove'
  | 'cleanup'
  | 'config'
  | 'update'
  | 'backup'
  | 'restore'
  | 'download'
  | 'plugin'
  | 'project'
  | 'other'

export interface PlanStep {
  description: string
  executable?: string
  args?: string[]
  elevated?: boolean
  paths?: string[]
  reversible?: boolean
}

export interface OperationPlan {
  title: string
  kind: OperationKind
  risk: Risk
  steps: PlanStep[]
  notes?: string[]
}

export type PlanDecision = 'approved' | 'preview' | 'declined'

export function formatCommand(step: PlanStep): string {
  if (!step.executable) return ''
  const quote = (a: string) => (/[\s"']/.test(a) ? JSON.stringify(a) : a)
  return [step.executable, ...(step.args ?? []).map(quote)].join(' ')
}

export function planNeedsElevation(plan: OperationPlan): boolean {
  return plan.steps.some((s) => s.elevated)
}

function confirmationRequired(ctx: AppContext, kind: OperationKind): boolean {
  const sec = ctx.config.load().security
  switch (kind) {
    case 'install':
    case 'upgrade':
      return sec.confirmInstalls
    case 'remove':
      return sec.confirmRemovals
    case 'cleanup':
      return sec.confirmCleanup
    default:
      return true
  }
}

export function renderPlan(ctx: AppContext, plan: OperationPlan): void {
  const out = ctx.out
  out.heading(`Plan: ${plan.title}`)
  out.kv([
    ['Risk', plan.risk],
    ['Administrator rights', planNeedsElevation(plan) ? 'required for some steps' : 'not required'],
  ])
  plan.steps.forEach((step, i) => {
    out.line(`  ${i + 1}. ${step.description}${step.elevated ? ' (elevated)' : ''}`)
    const cmd = formatCommand(step)
    if (cmd) out.line(out.style.muted(`     Command: ${cmd}`))
    for (const p of step.paths ?? []) out.line(out.style.muted(`     Path: ${p}`))
    if (step.reversible === false) out.line(out.style.warn('     This step cannot be undone.'))
  })
  for (const n of plan.notes ?? []) out.line(out.style.muted(`  Note: ${n}`))
}

export async function decidePlan(ctx: AppContext, plan: OperationPlan): Promise<PlanDecision> {
  renderPlan(ctx, plan)
  if (ctx.opts.dryRun) {
    ctx.state.previewed = true
    ctx.out.line('\nPreview only. Nothing was changed.')
    return 'preview'
  }
  const elevated = planNeedsElevation(plan)
  const needConfirm = confirmationRequired(ctx, plan.kind) || elevated
  if (!ctx.interactive) {
    if (!ctx.opts.yes) {
      throw declined(
        'This operation needs confirmation and no terminal is available.',
        'Review the plan with --dry-run, then repeat with --yes to approve it.',
      )
    }
    if (elevated && !ctx.opts.allowElevation) {
      throw declined(
        'This operation needs administrator rights.',
        'Repeat with --yes --allow-elevation to approve elevated steps explicitly.',
      )
    }
    ctx.state.confirmed = true
    return 'approved'
  }
  if (ctx.opts.yes && !elevated) {
    ctx.state.confirmed = true
    return 'approved'
  }
  if (needConfirm) {
    const message = elevated
      ? 'This plan includes steps that need administrator rights. Continue?'
      : 'Run this plan?'
    const ok = await ctx.prompter.confirm(message, false)
    if (!ok) return 'declined'
  }
  ctx.state.confirmed = true
  return 'approved'
}

export interface PlanOutcome<T> {
  decision: PlanDecision
  result?: T
}

export async function runPlan<T>(
  ctx: AppContext,
  plan: OperationPlan,
  execute: () => Promise<T>,
  auditOperation: string = plan.kind,
): Promise<PlanOutcome<T>> {
  const decision = await decidePlan(ctx, plan)
  const base = {
    operation: auditOperation,
    title: plan.title,
    steps: plan.steps.map((s) => formatCommand(s) || s.description),
    risk: plan.risk,
  }
  const log = (result: AuditRecord['result'], detail?: string) =>
    ctx.history.audit({ ...base, result, ...(detail ? { detail } : {}) })
  if (decision === 'preview') {
    log('preview')
    return { decision }
  }
  if (decision === 'declined') {
    ctx.out.line('Cancelled. Nothing was changed.')
    ctx.state.summary.push('declined by user')
    log('declined')
    return { decision }
  }
  try {
    const result = await execute()
    log('success')
    ctx.state.summary.push(plan.title)
    return { decision, result }
  } catch (err) {
    log('failure', err instanceof Error ? err.message : String(err))
    throw err
  }
}
