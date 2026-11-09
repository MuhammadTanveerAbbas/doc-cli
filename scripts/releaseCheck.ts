import fs from 'node:fs'
import path from 'node:path'
import { VERSION } from '../src/core/version.js'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  version: string
}
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
const problems: string[] = []
if (pkg.version !== VERSION)
  problems.push(`package.json says ${pkg.version} but src/core/version.ts says ${VERSION}`)
if (!changelog.includes(`## ${pkg.version}`))
  problems.push(`CHANGELOG.md has no section for ${pkg.version}`)
if (fs.readFileSync(path.join(root, 'package.json'), 'utf8').includes('OWNER'))
  problems.push('package.json still contains the OWNER placeholder')
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('Release check passed')
