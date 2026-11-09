import { DocError, ExitCode } from '../core/errors.js'

const PACKAGE_ID = /^@?[A-Za-z0-9][A-Za-z0-9@._+:/\x2d]{0,127}$/

export function validatePackageId(id: string): string {
  if (!PACKAGE_ID.test(id) || id.includes('..')) {
    throw new DocError(
      `Invalid package identifier: ${JSON.stringify(id)}`,
      ExitCode.Usage,
      'Package identifiers may use letters, digits, and the characters @ . _ + : / and the hyphen',
    )
  }
  return id
}

export function validateSearchQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed || trimmed.length > 100 || hasControlChars(trimmed)) {
    throw new DocError('Invalid search query', ExitCode.Usage)
  }
  if (trimmed.startsWith('-')) {
    throw new DocError('Search queries may not start with a dash character', ExitCode.Usage)
  }
  return trimmed
}

export function validateHttpsUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new DocError(`Invalid URL: ${raw}`, ExitCode.Usage)
  }
  if (url.protocol !== 'https:') {
    throw new DocError('Only https URLs are allowed', ExitCode.Usage)
  }
  return url
}

export function validateSlug(name: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._\x2d]{0,63}$/.test(name)) {
    throw new DocError(`Invalid name: ${JSON.stringify(name)}`, ExitCode.Usage)
  }
  return name
}

function hasControlChars(text: string): boolean {
  for (const ch of text) {
    if (ch.charCodeAt(0) < 32) return true
  }
  return false
}
