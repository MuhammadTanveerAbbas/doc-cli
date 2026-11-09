import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DocError, ExitCode } from '../core/errors.js'

export interface DirSizeResult {
  bytes: number
  files: number
  truncated: boolean
  errors: number
}

export interface DirSizeOptions {
  maxFiles?: number
  deadlineMs?: number
}

export function dirSize(root: string, options: DirSizeOptions = {}): DirSizeResult {
  const maxFiles = options.maxFiles ?? 200_000
  const deadline = Date.now() + (options.deadlineMs ?? 8000)
  const result: DirSizeResult = { bytes: 0, files: 0, truncated: false, errors: 0 }
  const stack: string[] = [root]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      result.errors++
      continue
    }
    for (const e of entries) {
      if (result.files >= maxFiles || Date.now() > deadline) {
        result.truncated = true
        return result
      }
      const full = path.join(dir, e.name)
      if (e.isSymbolicLink()) continue
      if (e.isDirectory()) {
        stack.push(full)
      } else if (e.isFile()) {
        try {
          result.bytes += fs.statSync(full).size
          result.files++
        } catch {
          result.errors++
        }
      }
    }
  }
  return result
}

export interface SizedEntry {
  path: string
  bytes: number
  truncated: boolean
}

export function topLevelSizes(root: string, limit = 15): SizedEntry[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    throw new DocError(`Cannot read directory: ${root}`, ExitCode.Environment)
  }
  const sized: SizedEntry[] = []
  for (const e of entries) {
    if (e.isSymbolicLink()) continue
    const full = path.join(root, e.name)
    if (e.isDirectory()) {
      const r = dirSize(full, { maxFiles: 50_000, deadlineMs: 3000 })
      sized.push({ path: full, bytes: r.bytes, truncated: r.truncated })
    } else if (e.isFile()) {
      try {
        sized.push({ path: full, bytes: fs.statSync(full).size, truncated: false })
      } catch {
        continue
      }
    }
  }
  return sized.sort((a, b) => b.bytes - a.bytes).slice(0, limit)
}

export function isInside(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function safeJoin(base: string, relative: string): string {
  const target = path.resolve(base, relative)
  if (!isInside(base, target)) {
    throw new DocError(`Path escapes the target directory: ${relative}`, ExitCode.Verification)
  }
  return target
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(file)
    stream.on('data', (c) => hash.update(c))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export function sha256Buffer(buf: Uint8Array | string): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

export function pathExistsSync(p: string): boolean {
  try {
    fs.accessSync(p)
    return true
  } catch {
    return false
  }
}
