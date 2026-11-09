import type { DetectedManager } from '../../adapters/packageManagers/registry.js'
import { stepFromSpec, type CommandSpec } from '../../adapters/packageManagers/types.js'
import type { PlatformInfo } from '../../platform/detect.js'
import type { PlanStep } from '../../services/permissionService.js'
import { catalog, findTool, type ToolEntry } from './catalog.js'

export interface DetectedTool {
  installed: boolean
  version?: string
  detectable: boolean
}

export interface PlanItem {
  tool: string
  name: string
  manager: string
  packageId: string
  spec: CommandSpec
  step: PlanStep
  note?: string
  addedAs?: string
}

export interface SetupPlan {
  items: PlanItem[]
  alreadyInstalled: Array<{ tool: string; version?: string }>
  manual: Array<{ tool: string; url: string; instructions: string }>
  unavailable: Array<{ tool: string; reason: string }>
  notes: string[]
}

export interface PlanInput {
  selected: string[]
  detected: Record<string, DetectedTool>
  managers: DetectedManager[]
  platform: PlatformInfo
  allowGlobalProjectTools?: boolean
}

export function resolveToolIds(ids: string[]): string[] {
  const unknown = ids.filter((i) => !findTool(i))
  if (unknown.length) throw new Error(`Unknown tool id: ${unknown.join(', ')}`)
  return catalog.map((t) => t.id).filter((id) => ids.includes(id))
}

export function planSetup(input: PlanInput): SetupPlan {
  const plan: SetupPlan = {
    items: [],
    alreadyInstalled: [],
    manual: [],
    unavailable: [],
    notes: [],
  }
  const available = new Map(input.managers.filter((m) => m.available).map((m) => [m.adapter.id, m]))
  const wanted = new Set(input.selected)
  const plannedTools = new Set<string>()

  for (const id of resolveToolIds(input.selected)) {
    const tool = findTool(id) as ToolEntry
    const state = input.detected[id]
    if (state?.installed) {
      plan.alreadyInstalled.push({ tool: id, ...(state.version ? { version: state.version } : {}) })
      continue
    }
    if (tool.bundledWith) {
      const parent = tool.bundledWith
      const parentState = input.detected[parent]
      if (!parentState?.installed && !wanted.has(parent)) wanted.add(parent)
      const hasRoute = tool.routes.some((r) => r.kind === 'package' && available.has(r.manager))
      if (!hasRoute) {
        plan.notes.push(
          `${tool.name} comes with ${findTool(parent)?.name ?? parent}, so it needs no separate install.`,
        )
        continue
      }
    }
    if (tool.projectLocalOnly && !input.allowGlobalProjectTools) {
      plan.notes.push(
        `${tool.name}: ${tool.notes ?? 'add it per project instead of installing globally.'}`,
      )
      continue
    }
    plannedTools.add(id)
  }

  for (const dep of wanted) {
    if (!input.selected.includes(dep) && !input.detected[dep]?.installed) plannedTools.add(dep)
  }

  const ordered = catalog.map((t) => t.id).filter((id) => plannedTools.has(id))
  const willInstall = new Set(ordered)
  for (const id of ordered) {
    const tool = findTool(id) as ToolEntry
    let chosen = false
    for (const route of tool.routes) {
      if (route.kind === 'manual') {
        if (route.platforms.includes(input.platform.id)) {
          plan.manual.push({ tool: id, url: route.url, instructions: route.instructions })
          chosen = true
          break
        }
        continue
      }
      const known = input.managers.find((m) => m.adapter.id === route.manager)
      const viaNode = route.manager === 'npm' && willInstall.has('node')
      const mgr = available.get(route.manager) ?? (viaNode ? known : undefined)
      if (!mgr || !mgr.adapter.capabilities.install) continue
      const spec = mgr.adapter.planInstall({ id: route.id, ...(route.cask ? { cask: true } : {}) })
      plan.items.push({
        tool: id,
        name: tool.name,
        manager: route.manager,
        packageId: route.id,
        spec,
        step: stepFromSpec(`Install ${tool.name} (${route.id}) with ${mgr.adapter.label}`, spec),
        ...(route.note ? { note: route.note } : {}),
        ...(!input.selected.includes(id) ? { addedAs: 'dependency' } : {}),
      })
      chosen = true
      break
    }
    if (!chosen) {
      plan.unavailable.push({
        tool: id,
        reason: `No tested install route for ${input.platform.id} with the package managers found on this system.`,
      })
    }
  }
  return plan
}
