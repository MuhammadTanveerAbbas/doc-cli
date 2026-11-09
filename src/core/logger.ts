import { redactText } from '../utils/redact.js'

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug'
const order: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 }

export interface Logger {
  error(msg: string): void
  warn(msg: string): void
  info(msg: string): void
  debug(msg: string): void
}

export function createLogger(level: LogLevel, write: (line: string) => void): Logger {
  const emit = (l: LogLevel, msg: string) => {
    if (order[l] <= order[level]) write(`[${l}] ${redactText(msg)}\n`)
  }
  return {
    error: (m) => emit('error', m),
    warn: (m) => emit('warn', m),
    info: (m) => emit('info', m),
    debug: (m) => emit('debug', m),
  }
}
