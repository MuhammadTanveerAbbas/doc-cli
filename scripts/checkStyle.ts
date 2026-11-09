import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage'])
const textExt = new Set(['.ts', '.js', '.json', '.md', '.yml', '.yaml', '.sh', '.ps1', '.txt'])
const problems: string[] = []

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(e.name)) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full))
    else if (textExt.has(path.extname(e.name)) || e.name === 'LICENSE') out.push(full)
  }
  return out
}

const emDash = String.fromCharCode(0x2014)
const enDash = String.fromCharCode(0x2013)
const banned = [/purple/i, /violet/i, /magenta/i, /\bglow/i, /\bneon\b/i]

for (const file of walk(root)) {
  const rel = path.relative(root, file)
  if (rel === 'pnpm-lock.yaml' || rel.startsWith(path.join('scripts', 'checkStyle'))) continue
  const text = fs.readFileSync(file, 'utf8')
  if (text.includes(emDash) || text.includes(enDash))
    problems.push(`${rel}: contains an em dash or en dash`)
  if (rel.endsWith('.md') && !rel.startsWith('.github')) {
    const prose = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]*`/g, '')
      .replace(/https?:\/\/\S+/g, '')
    prose.split('\n').forEach((line, i) => {
      if (/\w-\w/.test(line) || line.includes(';') || /^\s*[-*]\s/.test(line)) {
        problems.push(
          `${rel}: prose line ${i + 1} has a hyphen, semicolon, or bullet: ${line.trim().slice(0, 70)}`,
        )
      }
    })
  }
  const inTests = !rel.startsWith('src')
  if (!inTests) {
    for (const re of banned)
      if (re.test(text)) problems.push(`${rel}: contains banned style word ${re}`)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log('Style check passed')
