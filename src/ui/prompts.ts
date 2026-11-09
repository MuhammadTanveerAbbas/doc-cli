export interface Choice<T> {
  name: string
  value: T
  description?: string
  disabled?: boolean | string
  checked?: boolean
}

export interface Prompter {
  confirm(message: string, defaultValue?: boolean): Promise<boolean>
  select<T>(message: string, choices: Array<Choice<T>>): Promise<T>
  checkbox<T>(message: string, choices: Array<Choice<T>>): Promise<T[]>
  input(message: string, defaultValue?: string): Promise<string>
  search<T>(message: string, source: (term: string | undefined) => Array<Choice<T>>): Promise<T>
}

export function createPrompter(): Prompter {
  return {
    async confirm(message, defaultValue = false) {
      const { confirm } = await import('@inquirer/prompts')
      return confirm({ message, default: defaultValue })
    },
    async select(message, choices) {
      const { select } = await import('@inquirer/prompts')
      return select({ message, choices })
    },
    async checkbox(message, choices) {
      const { checkbox } = await import('@inquirer/prompts')
      return checkbox({ message, choices, pageSize: 18 })
    },
    async input(message, defaultValue) {
      const { input } = await import('@inquirer/prompts')
      return input(defaultValue === undefined ? { message } : { message, default: defaultValue })
    },
    async search(message, source) {
      const { search } = await import('@inquirer/prompts')
      return search({ message, source: (term) => source(term), pageSize: 12 })
    },
  }
}

export class NonInteractivePrompter implements Prompter {
  confirm(): Promise<boolean> {
    return Promise.resolve(false)
  }
  select<T>(): Promise<T> {
    return Promise.reject(new Error('Interactive input is not available in this mode'))
  }
  checkbox<T>(): Promise<T[]> {
    return Promise.reject(new Error('Interactive input is not available in this mode'))
  }
  input(): Promise<string> {
    return Promise.reject(new Error('Interactive input is not available in this mode'))
  }
  search<T>(): Promise<T> {
    return Promise.reject(new Error('Interactive input is not available in this mode'))
  }
}
