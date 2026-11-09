import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { writeFileAtomic } from '../../core/config.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { safeJoin, sha256File } from '../../services/filesystemService.js'

export interface BackupFile {
  rel: string
  size: number
  sha256: string
}

export interface BackupManifest {
  version: 1
  id: string
  source: string
  createdAt: string
  files: BackupFile[]
  totalBytes: number
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', '__pycache__', 'dist'])
export const MAX_FILES = 100_000
export const MAX_BYTES = 2 * 1024 ** 3

export function scanSource(root: string): Array<{ rel: string; size: number }> {
  const out: Array<{ rel: string; size: number }> = []
  let total = 0
  const walk = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink()) continue
      const rel = prefix ? `${prefix}/${e.name}` : e.name
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        walk(full, rel)
      } else if (e.isFile()) {
        const size = fs.statSync(full).size
        total += size
        if (out.length >= MAX_FILES || total > MAX_BYTES)
          throw new DocError(
            'Backup source is too large for DOC CLI backups (100000 files or 2 GB).',
            ExitCode.Unsupported,
          )
        out.push({ rel, size })
      }
    }
  }
  walk(root, '')
  return out
}

export async function createBackup(source: string, backupsDir: string): Promise<BackupManifest> {
  const files = scanSource(source)
  const id = `${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${crypto.randomUUID().slice(0, 6)}`
  const dest = path.join(backupsDir, id)
  const entries: BackupFile[] = []
  let total = 0
  for (const f of files) {
    const from = path.join(source, ...f.rel.split('/'))
    const to = path.join(dest, 'files', ...f.rel.split('/'))
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
    entries.push({ rel: f.rel, size: f.size, sha256: await sha256File(to) })
    total += f.size
  }
  const manifest: BackupManifest = {
    version: 1,
    id,
    source,
    createdAt: new Date().toISOString(),
    files: entries,
    totalBytes: total,
  }
  writeFileAtomic(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

export function listBackups(backupsDir: string): BackupManifest[] {
  if (!fs.existsSync(backupsDir)) return []
  const out: BackupManifest[] = []
  for (const d of fs.readdirSync(backupsDir)) {
    try {
      out.push(
        JSON.parse(
          fs.readFileSync(path.join(backupsDir, d, 'manifest.json'), 'utf8'),
        ) as BackupManifest,
      )
    } catch {
      continue
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function loadBackup(backupsDir: string, id: string): BackupManifest {
  if (!/^[A-Za-z0-9]+$/.test(id)) throw new DocError('Invalid backup id', ExitCode.Usage)
  const m = listBackups(backupsDir).find((b) => b.id === id)
  if (!m) throw new DocError(`No backup with id ${id}`, ExitCode.Usage)
  return m
}

export async function restoreBackup(
  backupsDir: string,
  manifest: BackupManifest,
  target: string,
  overwrite: boolean,
): Promise<number> {
  const base = path.join(backupsDir, manifest.id, 'files')
  for (const f of manifest.files) {
    const dest = safeJoin(target, f.rel)
    if (!overwrite && fs.existsSync(dest))
      throw new DocError(
        `Refusing to overwrite ${dest}`,
        ExitCode.Declined,
        'Restore into an empty folder or pass --overwrite.',
      )
    const src = safeJoin(base, f.rel)
    if ((await sha256File(src)) !== f.sha256)
      throw new DocError(`Backup file is corrupted: ${f.rel}`, ExitCode.Verification)
  }
  for (const f of manifest.files) {
    const dest = safeJoin(target, f.rel)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(safeJoin(base, f.rel), dest)
  }
  return manifest.files.length
}
