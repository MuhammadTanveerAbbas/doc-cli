#!/usr/bin/env node
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 13)) {
  process.stderr.write(
    `DOC CLI needs Node.js 22.13 or newer. Found ${process.versions.node}. Install a current LTS release from https://nodejs.org\n`,
  )
  process.exit(7)
}

const here = dirname(fileURLToPath(import.meta.url))
const entry = join(here, '..', 'dist', 'index.js')
await import(pathToFileURL(entry).href)
