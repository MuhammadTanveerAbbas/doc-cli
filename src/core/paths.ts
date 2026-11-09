import os from 'node:os'
import path from 'node:path'

export interface AppDirs {
  config: string
  data: string
  cache: string
  logs: string
  configFile: string
  historyFile: string
  auditFile: string
  backups: string
  downloads: string
  plugins: string
  profiles: string
  updates: string
}

export interface DirInputs {
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  home?: string
}

function build(config: string, data: string, cache: string, logs: string): AppDirs {
  return {
    config,
    data,
    cache,
    logs,
    configFile: path.join(config, 'config.json'),
    historyFile: path.join(data, 'history.json'),
    auditFile: path.join(data, 'audit.jsonl'),
    backups: path.join(data, 'backups'),
    downloads: path.join(data, 'downloads'),
    plugins: path.join(data, 'plugins'),
    profiles: path.join(config, 'profiles'),
    updates: path.join(data, 'updates'),
  }
}

export function resolveAppDirs(input: DirInputs = {}): AppDirs {
  const env = input.env ?? process.env
  const platform = input.platform ?? process.platform
  const home = input.home ?? os.homedir()
  const override = env['DOC_CLI_HOME']
  if (override) {
    return build(
      path.join(override, 'config'),
      path.join(override, 'data'),
      path.join(override, 'cache'),
      path.join(override, 'logs'),
    )
  }
  if (platform === 'win32') {
    const appData = env['APPDATA'] ?? path.join(home, 'AppData', 'Roaming')
    const local = env['LOCALAPPDATA'] ?? path.join(home, 'AppData', 'Local')
    return build(
      path.join(appData, 'DocCli', 'config'),
      path.join(local, 'DocCli', 'data'),
      path.join(local, 'DocCli', 'cache'),
      path.join(local, 'DocCli', 'logs'),
    )
  }
  if (platform === 'darwin') {
    const base = path.join(home, 'Library', 'Application Support', 'DocCli')
    return build(
      path.join(base, 'config'),
      path.join(base, 'data'),
      path.join(home, 'Library', 'Caches', 'DocCli'),
      path.join(home, 'Library', 'Logs', 'DocCli'),
    )
  }
  const xdgConfig = env['XDG_CONFIG_HOME'] ?? path.join(home, '.config')
  const xdgData = env['XDG_DATA_HOME'] ?? path.join(home, '.local', 'share')
  const xdgCache = env['XDG_CACHE_HOME'] ?? path.join(home, '.cache')
  const xdgState = env['XDG_STATE_HOME'] ?? path.join(home, '.local', 'state')
  return build(
    path.join(xdgConfig, 'doc-cli'),
    path.join(xdgData, 'doc-cli'),
    path.join(xdgCache, 'doc-cli'),
    path.join(xdgState, 'doc-cli', 'logs'),
  )
}
