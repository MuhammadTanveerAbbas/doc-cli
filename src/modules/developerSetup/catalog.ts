import type { PlatformId } from '../../platform/detect.js'

export type Route =
  | { kind: 'package'; manager: string; id: string; cask?: boolean; note?: string }
  | { kind: 'manual'; platforms: PlatformId[]; url: string; instructions: string }

export interface DetectProbe {
  executable: string
  args: string[]
}

export interface ToolEntry {
  id: string
  name: string
  category: string
  description: string
  probes: DetectProbe[]
  bundledWith?: string
  projectLocalOnly?: boolean
  routes: Route[]
  notes?: string
}

const v = ['--version']

export const catalog: ToolEntry[] = [
  {
    id: 'node',
    name: 'Node.js LTS',
    category: 'JavaScript',
    description: 'JavaScript runtime',
    probes: [{ executable: 'node', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'OpenJS.NodeJS.LTS' },
      {
        kind: 'package',
        manager: 'brew',
        id: 'node',
        note: 'Homebrew tracks the current release, not necessarily LTS',
      },
      {
        kind: 'package',
        manager: 'apt',
        id: 'nodejs',
        note: 'distribution version may be older than the current LTS',
      },
      {
        kind: 'package',
        manager: 'dnf',
        id: 'nodejs',
        note: 'distribution version may differ from the current LTS',
      },
      { kind: 'package', manager: 'pacman', id: 'nodejs', note: 'Arch ships the current release' },
      {
        kind: 'manual',
        platforms: ['linux', 'macos', 'windows'],
        url: 'https://nodejs.org/en/download',
        instructions: 'Download the LTS installer from nodejs.org',
      },
    ],
  },
  {
    id: 'npm',
    name: 'npm',
    category: 'JavaScript',
    description: 'Node package manager, installed with Node.js',
    probes: [{ executable: 'npm', args: v }],
    bundledWith: 'node',
    routes: [],
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    category: 'JavaScript',
    description: 'Fast package manager',
    probes: [{ executable: 'pnpm', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'pnpm.pnpm' },
      { kind: 'package', manager: 'brew', id: 'pnpm' },
      { kind: 'package', manager: 'npm', id: 'pnpm' },
      {
        kind: 'manual',
        platforms: ['linux', 'macos', 'windows'],
        url: 'https://pnpm.io/installation',
        instructions: 'Follow the official pnpm installation guide',
      },
    ],
  },
  {
    id: 'yarn',
    name: 'Yarn',
    category: 'JavaScript',
    description: 'JavaScript package manager',
    probes: [{ executable: 'yarn', args: v }],
    routes: [
      { kind: 'package', manager: 'brew', id: 'yarn' },
      {
        kind: 'package',
        manager: 'npm',
        id: 'yarn',
        note: 'installs Yarn Classic 1.x, newer Yarn versions are enabled per project with Corepack',
      },
    ],
  },
  {
    id: 'bun',
    name: 'Bun',
    category: 'JavaScript',
    description: 'JavaScript runtime and toolkit',
    probes: [{ executable: 'bun', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Oven-sh.Bun' },
      { kind: 'package', manager: 'brew', id: 'oven-sh/bun/bun' },
      { kind: 'package', manager: 'npm', id: 'bun' },
      {
        kind: 'manual',
        platforms: ['linux', 'macos', 'windows'],
        url: 'https://bun.sh/docs/installation',
        instructions: 'Follow the official Bun installation guide',
      },
    ],
  },
  {
    id: 'webpack',
    name: 'webpack and webpack CLI',
    category: 'Build tools',
    description: 'Web application bundling (normally a project dependency)',
    probes: [{ executable: 'webpack', args: v }],
    projectLocalOnly: true,
    routes: [{ kind: 'package', manager: 'npm', id: 'webpack-cli' }],
    notes:
      'Recommended: add per project with "pnpm add -D webpack webpack-cli". A global install is optional and only used when you pass --allow-global-webpack.',
  },
  {
    id: 'python',
    name: 'Python 3',
    category: 'Python',
    description: 'Python runtime',
    probes: [
      { executable: 'python3', args: v },
      { executable: 'python', args: v },
      { executable: 'py', args: ['-3', '--version'] },
    ],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Python.Python.3.13' },
      { kind: 'package', manager: 'brew', id: 'python' },
      { kind: 'package', manager: 'apt', id: 'python3' },
      { kind: 'package', manager: 'dnf', id: 'python3' },
      { kind: 'package', manager: 'pacman', id: 'python' },
    ],
  },
  {
    id: 'pip',
    name: 'pip',
    category: 'Python',
    description: 'Python package installer, normally bundled with Python',
    probes: [
      { executable: 'pip', args: v },
      { executable: 'pip3', args: v },
    ],
    bundledWith: 'python',
    routes: [
      {
        kind: 'package',
        manager: 'apt',
        id: 'python3-pip',
        note: 'Debian and Ubuntu package pip separately',
      },
    ],
  },
  {
    id: 'uv',
    name: 'uv',
    category: 'Python',
    description: 'Python package and project manager',
    probes: [{ executable: 'uv', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'astral-sh.uv' },
      { kind: 'package', manager: 'brew', id: 'uv' },
      { kind: 'package', manager: 'pacman', id: 'uv' },
      {
        kind: 'manual',
        platforms: ['linux', 'macos', 'windows'],
        url: 'https://docs.astral.sh/uv/getting-started/installation/',
        instructions: 'Follow the official uv installation guide',
      },
    ],
  },
  {
    id: 'git',
    name: 'Git',
    category: 'Version control',
    description: 'Source control',
    probes: [{ executable: 'git', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Git.Git' },
      { kind: 'package', manager: 'brew', id: 'git' },
      { kind: 'package', manager: 'apt', id: 'git' },
      { kind: 'package', manager: 'dnf', id: 'git' },
      { kind: 'package', manager: 'pacman', id: 'git' },
    ],
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    category: 'Editors',
    description: 'Code editor',
    probes: [{ executable: 'code', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Microsoft.VisualStudioCode' },
      { kind: 'package', manager: 'brew', id: 'visual-studio-code', cask: true },
      {
        kind: 'manual',
        platforms: ['linux'],
        url: 'https://code.visualstudio.com/docs/setup/linux',
        instructions: 'Use the vendor repository or package from the official page',
      },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'Editors',
    description: 'AI assisted code editor',
    probes: [{ executable: 'cursor', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Anysphere.Cursor' },
      { kind: 'package', manager: 'brew', id: 'cursor', cask: true },
      {
        kind: 'manual',
        platforms: ['linux', 'macos', 'windows'],
        url: 'https://cursor.com',
        instructions: 'Download from the official Cursor site and accept its terms yourself',
      },
    ],
  },
  {
    id: 'firefox',
    name: 'Firefox',
    category: 'Browsers',
    description: 'Web browser',
    probes: [{ executable: 'firefox', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Mozilla.Firefox' },
      { kind: 'package', manager: 'brew', id: 'firefox', cask: true },
      {
        kind: 'package',
        manager: 'apt',
        id: 'firefox',
        note: 'on Ubuntu this may install a Snap package',
      },
      { kind: 'package', manager: 'dnf', id: 'firefox' },
      { kind: 'package', manager: 'pacman', id: 'firefox' },
    ],
    notes: 'Detection works only when firefox is on PATH.',
  },
  {
    id: 'docker',
    name: 'Docker Desktop or Docker Engine',
    category: 'Containers',
    description: 'Container tooling',
    probes: [{ executable: 'docker', args: v }],
    routes: [
      {
        kind: 'package',
        manager: 'winget',
        id: 'Docker.DockerDesktop',
        note: 'Docker Desktop, has its own license terms',
      },
      {
        kind: 'package',
        manager: 'brew',
        id: 'docker',
        cask: true,
        note: 'Docker Desktop, has its own license terms',
      },
      { kind: 'package', manager: 'pacman', id: 'docker', note: 'Docker Engine' },
      {
        kind: 'manual',
        platforms: ['linux'],
        url: 'https://docs.docker.com/engine/install/',
        instructions: 'Docker Engine: follow the official guide for your distribution',
      },
    ],
  },
  {
    id: 'insomnia',
    name: 'Insomnia',
    category: 'API tools',
    description: 'API testing client (optional)',
    probes: [],
    routes: [
      { kind: 'package', manager: 'winget', id: 'Insomnia.Insomnia' },
      { kind: 'package', manager: 'brew', id: 'insomnia', cask: true },
      {
        kind: 'manual',
        platforms: ['linux'],
        url: 'https://insomnia.rest/download',
        instructions: 'Download from the official site',
      },
    ],
    notes: 'Detection is not available because the app has no command line probe.',
  },
  {
    id: 'psql',
    name: 'PostgreSQL client tools',
    category: 'Database',
    description: 'Database development',
    probes: [{ executable: 'psql', args: v }],
    routes: [
      {
        kind: 'package',
        manager: 'brew',
        id: 'libpq',
        note: 'keg only, add it to PATH as Homebrew explains',
      },
      { kind: 'package', manager: 'apt', id: 'postgresql-client' },
      { kind: 'package', manager: 'dnf', id: 'postgresql' },
      {
        kind: 'package',
        manager: 'pacman',
        id: 'postgresql-libs',
        note: 'check that psql is included on your Arch version',
      },
      {
        kind: 'manual',
        platforms: ['windows'],
        url: 'https://www.postgresql.org/download/windows/',
        instructions: 'Use the official installer and select only command line tools',
      },
    ],
  },
  {
    id: 'sqlite',
    name: 'SQLite tools',
    category: 'Database',
    description: 'Lightweight database tools',
    probes: [{ executable: 'sqlite3', args: v }],
    routes: [
      { kind: 'package', manager: 'brew', id: 'sqlite' },
      { kind: 'package', manager: 'apt', id: 'sqlite3' },
      { kind: 'package', manager: 'dnf', id: 'sqlite' },
      { kind: 'package', manager: 'pacman', id: 'sqlite' },
      {
        kind: 'manual',
        platforms: ['windows'],
        url: 'https://www.sqlite.org/download.html',
        instructions: 'Download the command line tools bundle',
      },
    ],
  },
  {
    id: '7zip',
    name: '7-Zip or platform archive tools',
    category: 'Utilities',
    description: 'Archive management',
    probes: [
      { executable: '7z', args: [] },
      { executable: '7zz', args: [] },
    ],
    routes: [
      { kind: 'package', manager: 'winget', id: '7zip.7zip' },
      { kind: 'package', manager: 'apt', id: 'p7zip-full' },
      { kind: 'package', manager: 'dnf', id: 'p7zip' },
      { kind: 'package', manager: 'pacman', id: 'p7zip' },
      { kind: 'package', manager: 'brew', id: 'sevenzip' },
    ],
  },
  {
    id: 'curl',
    name: 'curl',
    category: 'Utilities',
    description: 'HTTP client',
    probes: [{ executable: 'curl', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'cURL.cURL' },
      { kind: 'package', manager: 'brew', id: 'curl' },
      { kind: 'package', manager: 'apt', id: 'curl' },
      { kind: 'package', manager: 'dnf', id: 'curl' },
      { kind: 'package', manager: 'pacman', id: 'curl' },
    ],
  },
  {
    id: 'jq',
    name: 'jq',
    category: 'Utilities',
    description: 'JSON processing',
    probes: [{ executable: 'jq', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'jqlang.jq' },
      { kind: 'package', manager: 'brew', id: 'jq' },
      { kind: 'package', manager: 'apt', id: 'jq' },
      { kind: 'package', manager: 'dnf', id: 'jq' },
      { kind: 'package', manager: 'pacman', id: 'jq' },
    ],
  },
  {
    id: 'ripgrep',
    name: 'ripgrep',
    category: 'Utilities',
    description: 'Fast text search',
    probes: [{ executable: 'rg', args: v }],
    routes: [
      { kind: 'package', manager: 'winget', id: 'BurntSushi.ripgrep.MSVC' },
      { kind: 'package', manager: 'brew', id: 'ripgrep' },
      { kind: 'package', manager: 'apt', id: 'ripgrep' },
      { kind: 'package', manager: 'dnf', id: 'ripgrep' },
      { kind: 'package', manager: 'pacman', id: 'ripgrep' },
    ],
  },
]

export function findTool(id: string): ToolEntry | undefined {
  return catalog.find((t) => t.id === id)
}

export interface Profile {
  id: string
  name: string
  tools: string[]
  requireOneOf?: string[]
  description: string
}

export const profiles: Profile[] = [
  {
    id: 'web',
    name: 'Web Developer',
    tools: ['git', 'node', 'npm', 'pnpm', 'vscode', 'firefox', 'curl', 'jq'],
    description:
      'Git, Node.js, pnpm, VS Code, Firefox, curl, jq. Swap VS Code for Cursor if you prefer.',
  },
  {
    id: 'python',
    name: 'Python Developer',
    tools: ['git', 'python', 'pip', 'uv', 'vscode', 'firefox'],
    description: 'Git, Python 3, pip, uv, VS Code, Firefox.',
  },
  {
    id: 'fullstack',
    name: 'Full Stack Developer',
    tools: ['git', 'node', 'pnpm', 'python', 'uv', 'vscode', 'firefox', 'docker', 'insomnia'],
    description: 'Web and Python tools plus the Docker and API client options.',
  },
  {
    id: 'minimal',
    name: 'Minimal Developer',
    tools: ['git', 'vscode', 'firefox'],
    requireOneOf: ['node', 'python'],
    description: 'Git, one editor, one browser, and Node.js or Python of your choice.',
  },
]
