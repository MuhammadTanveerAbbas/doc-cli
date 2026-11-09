import fs from 'node:fs'
import path from 'node:path'

export interface ProjectInfo {
  root: string
  kinds: string[]
  name: string | null
  packageManager: string | null
  scripts: string[]
  files: string[]
  hasGit: boolean
}

const MARKERS: Array<[string, string]> = [
  ['package.json', 'node'],
  ['pyproject.toml', 'python'],
  ['requirements.txt', 'python'],
  ['Cargo.toml', 'rust'],
  ['go.mod', 'go'],
  ['pom.xml', 'java'],
  ['build.gradle', 'java'],
  ['Dockerfile', 'docker'],
]

const LOCKS: Array<[string, string]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
  ['uv.lock', 'uv'],
]

export function inspectProject(root: string): ProjectInfo {
  const present = (f: string) => fs.existsSync(path.join(root, f))
  const kinds = [...new Set(MARKERS.filter(([f]) => present(f)).map(([, k]) => k))]
  const files = MARKERS.filter(([f]) => present(f)).map(([f]) => f)
  let name: string | null = null
  let scripts: string[] = []
  if (present('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
        name?: string
        scripts?: Record<string, string>
        packageManager?: string
      }
      name = pkg.name ?? null
      scripts = Object.keys(pkg.scripts ?? {})
      if (pkg.packageManager) {
        return {
          root,
          kinds,
          name,
          packageManager: pkg.packageManager.split('@')[0] ?? null,
          scripts,
          files,
          hasGit: present('.git'),
        }
      }
    } catch {
      name = null
    }
  }
  const lock = LOCKS.find(([f]) => present(f))
  return {
    root,
    kinds,
    name,
    packageManager: lock ? lock[1] : null,
    scripts,
    files,
    hasGit: present('.git'),
  }
}

export const TEMPLATES: Record<string, Record<string, string>> = {
  node: {
    'package.json':
      '{\n  "name": "__NAME__",\n  "version": "0.1.0",\n  "private": true,\n  "type": "module",\n  "scripts": {\n    "start": "node src/index.js"\n  }\n}\n',
    'src/index.js': "console.log('Hello from __NAME__')\n",
    '.gitignore': 'node_modules\n.env\n',
    'README.md': '# __NAME__\n\nA new Node.js project.\n',
  },
  python: {
    'pyproject.toml':
      '[project]\nname = "__NAME__"\nversion = "0.1.0"\nrequires-python = ">=3.10"\n',
    'src/main.py': "print('Hello from __NAME__')\n",
    '.gitignore': '__pycache__\n.venv\n.env\n',
    'README.md': '# __NAME__\n\nA new Python project.\n',
  },
}
