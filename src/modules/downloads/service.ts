import fs from 'node:fs'
import path from 'node:path'
import { writeFileAtomic } from '../../core/config.js'
import { DocError, ExitCode } from '../../core/errors.js'
import { sha256File } from '../../services/filesystemService.js'

export interface DownloadRecord {
  file: string
  url: string
  bytes: number
  sha256: string
  verified: boolean
  at: string
}

export function manifestPath(dir: string): string {
  return path.join(dir, 'manifest.json')
}

export function readManifest(dir: string): DownloadRecord[] {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(dir), 'utf8')) as DownloadRecord[]
  } catch {
    return []
  }
}

export function fileNameFromUrl(url: URL): string {
  const base = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? 'download')
  const clean = base.replace(/[^A-Za-z0-9._]/g, '_').replace(/^\.+/, '')
  return clean || 'download'
}

export async function downloadFile(
  fetchFn: typeof fetch,
  url: URL,
  dir: string,
  expectedSha256: string | undefined,
  maxBytes = 2 * 1024 ** 3,
): Promise<DownloadRecord> {
  fs.mkdirSync(dir, { recursive: true })
  const res = await fetchFn(url, { redirect: 'follow', signal: AbortSignal.timeout(10 * 60_000) })
  if (!res.ok || !res.body)
    throw new DocError(`Download failed with status ${res.status}`, ExitCode.Network)
  if (new URL(res.url || url.href).protocol !== 'https:')
    throw new DocError('Redirected to a non https address, download refused', ExitCode.Verification)
  const name = fileNameFromUrl(url)
  const target = path.join(dir, name)
  const tmp = `${target}.part`
  const out = fs.createWriteStream(tmp, { mode: 0o600 })
  let bytes = 0
  try {
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      bytes += chunk.length
      if (bytes > maxBytes)
        throw new DocError('Download exceeds the size limit', ExitCode.Verification)
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r))
    }
    await new Promise<void>((resolve, reject) => {
      out.end((err?: Error | null) => (err ? reject(err) : resolve()))
    })
  } catch (err) {
    out.destroy()
    fs.rmSync(tmp, { force: true })
    throw err
  }
  const sha = await sha256File(tmp)
  if (expectedSha256 && sha !== expectedSha256.toLowerCase()) {
    fs.rmSync(tmp, { force: true })
    throw new DocError(
      'Checksum mismatch, the file was deleted.',
      ExitCode.Verification,
      `Expected ${expectedSha256}, got ${sha}.`,
    )
  }
  fs.renameSync(tmp, target)
  const rec: DownloadRecord = {
    file: target,
    url: url.href,
    bytes,
    sha256: sha,
    verified: Boolean(expectedSha256),
    at: new Date().toISOString(),
  }
  const all = readManifest(dir)
  all.push(rec)
  writeFileAtomic(manifestPath(dir), JSON.stringify(all, null, 2) + '\n')
  return rec
}
