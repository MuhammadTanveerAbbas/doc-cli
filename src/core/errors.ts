export const ExitCode = {
  Ok: 0,
  General: 1,
  Usage: 2,
  Unsupported: 3,
  Declined: 4,
  Verification: 5,
  Network: 6,
  Environment: 7,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

export class DocError extends Error {
  readonly exitCode: number
  readonly hint?: string

  constructor(message: string, exitCode: number = ExitCode.General, hint?: string) {
    super(message)
    this.name = 'DocError'
    this.exitCode = exitCode
    if (hint !== undefined) this.hint = hint
  }
}

export function unsupported(message: string, hint?: string): DocError {
  return new DocError(message, ExitCode.Unsupported, hint)
}

export function declined(message: string, hint?: string): DocError {
  return new DocError(message, ExitCode.Declined, hint)
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
