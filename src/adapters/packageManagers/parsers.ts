import type { InstalledPackage, PackageSearchResult, PackageUpdate } from './types.js'

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function parseNpmList(text: string, source = 'npm'): InstalledPackage[] {
  const data = safeJson(text) as { dependencies?: Record<string, { version?: string }> } | null
  const deps = data?.dependencies ?? {}
  return Object.entries(deps).map(([id, v]) => ({ id, version: v.version ?? 'unknown', source }))
}

export function parsePnpmList(text: string, source = 'pnpm'): InstalledPackage[] {
  const data = safeJson(text)
  const arr = Array.isArray(data) ? data : data ? [data] : []
  const out: InstalledPackage[] = []
  for (const entry of arr as Array<{ dependencies?: Record<string, { version?: string }> }>) {
    for (const [id, v] of Object.entries(entry.dependencies ?? {})) {
      out.push({ id, version: v.version ?? 'unknown', source })
    }
  }
  return out
}

export function parseOutdatedJson(text: string, source: string): PackageUpdate[] {
  const data = safeJson(text) as Record<
    string,
    { current?: string; latest?: string; wanted?: string }
  > | null
  if (!data || typeof data !== 'object') return []
  return Object.entries(data).map(([id, v]) => ({
    id,
    current: v.current ?? 'unknown',
    latest: v.latest ?? v.wanted ?? 'unknown',
    source,
  }))
}

export function parseNpmSearch(text: string): PackageSearchResult[] {
  const data = safeJson(text)
  if (!Array.isArray(data)) return []
  return (data as Array<{ name?: string; version?: string; description?: string }>)
    .filter((d) => typeof d.name === 'string')
    .map((d) => {
      const r: PackageSearchResult = { id: d.name as string, name: d.name as string, source: 'npm' }
      if (d.version) r.version = d.version
      if (d.description) r.description = d.description
      return r
    })
}

export function parsePipList(text: string): InstalledPackage[] {
  const data = safeJson(text)
  if (!Array.isArray(data)) return []
  return (data as Array<{ name?: string; version?: string }>)
    .filter((d) => d.name)
    .map((d) => ({ id: d.name as string, version: d.version ?? 'unknown', source: 'pip' }))
}

export function parsePipOutdated(text: string): PackageUpdate[] {
  const data = safeJson(text)
  if (!Array.isArray(data)) return []
  return (data as Array<{ name?: string; version?: string; latest_version?: string }>)
    .filter((d) => d.name)
    .map((d) => ({
      id: d.name as string,
      current: d.version ?? 'unknown',
      latest: d.latest_version ?? 'unknown',
      source: 'pip',
    }))
}

export function parseUvToolList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9._]+(?:[A-Za-z0-9._]*)) v?(\d[^\s]*)$/.exec(line.trim())
    if (m) out.push({ id: m[1] ?? '', version: m[2] ?? '', source: 'uv' })
  }
  return out
}

export function parseBunList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /(@?[A-Za-z0-9._/]+)@(\d[^\s]*)\s*$/.exec(line.trim())
    if (m) out.push({ id: m[1] ?? '', version: m[2] ?? '', source: 'bun' })
  }
  return out
}

export function parseDpkgList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const [id, version] = line.split('\t')
    if (id && version) out.push({ id, version, source: 'apt' })
  }
  return out
}

export function parseAptUpgradable(text: string): PackageUpdate[] {
  const out: PackageUpdate[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^([^/\s]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from: ([^\]]+)\]/.exec(line)
    if (m) out.push({ id: m[1] ?? '', latest: m[2] ?? '', current: m[3] ?? '', source: 'apt' })
  }
  return out
}

export function parseAptSearch(text: string): PackageSearchResult[] {
  const out: PackageSearchResult[] = []
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(' - ')
    if (idx > 0) {
      const id = line.slice(0, idx)
      out.push({ id, name: id, description: line.slice(idx + 3), source: 'apt' })
    }
  }
  return out
}

export function parseRpmList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const [id, version] = line.split('\t')
    if (id && version) out.push({ id, version, source: 'dnf' })
  }
  return out
}

export function parseDnfCheckUpdate(text: string): PackageUpdate[] {
  const out: PackageUpdate[] = []
  for (const line of text.split(/\r?\n/)) {
    const m =
      /^([A-Za-z0-9._+]+)\.(x86_64|aarch64|noarch|i686|armv7hl|ppc64le|s390x)\s+(\S+)\s+\S+/.exec(
        line,
      )
    if (m) out.push({ id: m[1] ?? '', current: 'installed', latest: m[3] ?? '', source: 'dnf' })
  }
  return out
}

export function parseDnfSearch(text: string): PackageSearchResult[] {
  const out: PackageSearchResult[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z0-9._+]+)\.\S+\s*:\s*(.*)$/.exec(line)
    if (m) out.push({ id: m[1] ?? '', name: m[1] ?? '', description: m[2] ?? '', source: 'dnf' })
  }
  return out
}

export function parsePacmanList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const [id, version] = line.trim().split(/\s+/)
    if (id && version) out.push({ id, version, source: 'pacman' })
  }
  return out
}

export function parsePacmanUpdates(text: string): PackageUpdate[] {
  const out: PackageUpdate[] = []
  for (const line of text.split(/\r?\n/)) {
    const m = /^(\S+)\s+(\S+)\s+->\s+(\S+)/.exec(line.trim())
    if (m) out.push({ id: m[1] ?? '', current: m[2] ?? '', latest: m[3] ?? '', source: 'pacman' })
  }
  return out
}

export function parsePacmanSearch(text: string): PackageSearchResult[] {
  const out: PackageSearchResult[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:[^/\s]+)\/(\S+)\s+(\S+)/.exec(lines[i] ?? '')
    if (m) {
      out.push({
        id: m[1] ?? '',
        name: m[1] ?? '',
        version: m[2] ?? '',
        description: (lines[i + 1] ?? '').trim(),
        source: 'pacman',
      })
    }
  }
  return out
}

export function parseBrewList(text: string): InstalledPackage[] {
  const out: InstalledPackage[] = []
  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/)
    const id = parts[0]
    const version = parts[parts.length - 1]
    if (id && version && parts.length > 1) out.push({ id, version, source: 'brew' })
  }
  return out
}

export function parseBrewOutdated(text: string): PackageUpdate[] {
  const data = safeJson(text) as {
    formulae?: Array<{ name: string; installed_versions?: string[]; current_version?: string }>
    casks?: Array<{
      name: string
      installed_versions?: string[] | string
      current_version?: string
    }>
  } | null
  if (!data) return []
  const toUpdate = (x: {
    name: string
    installed_versions?: string[] | string
    current_version?: string
  }) => {
    const installed = Array.isArray(x.installed_versions)
      ? x.installed_versions.join(', ')
      : (x.installed_versions ?? 'unknown')
    return {
      id: x.name,
      current: installed,
      latest: x.current_version ?? 'unknown',
      source: 'brew',
    }
  }
  return [...(data.formulae ?? []).map(toUpdate), ...(data.casks ?? []).map(toUpdate)]
}

export function parseLines(text: string, source: string): PackageSearchResult[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(==>|Name\s|\s*$)/.test(l) && !/^=+$/.test(l))
    .map((l) => ({ id: l.split(/\s+/)[0] ?? l, name: l, source }))
}
