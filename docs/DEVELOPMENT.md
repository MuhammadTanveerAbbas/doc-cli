# Development

## Requirements

1. Node.js 22.13 or newer (the current LTS line is recommended).
2. pnpm 12 (`corepack enable` then `corepack prepare pnpm@12.18.0 --activate`, or `npm install -g pnpm`).

## Setup

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs typecheck, lint, format check, style check, tests, build, and a smoke test.

## Scripts

1. `pnpm dev -- <args>` runs the CLI from source with tsx.
2. `pnpm build` bundles to `dist/` with tsup.
3. `pnpm test` runs Vitest. `pnpm test:unit` and `pnpm test:integration` run subsets.
4. `pnpm lint`, `pnpm format`, `pnpm format:check`, `pnpm typecheck`.
5. `pnpm check:style` enforces the project writing and color rules (no em or en dashes, no purple or glow wording in source).
6. `pnpm docs:commands` regenerates `docs/COMMANDS.md` from the registry.

## Testing rules

1. Tests never uninstall software, touch your real environment, or clean real folders. Subprocesses use `FakeRunner` and every test uses a temporary `DOC_CLI_HOME`.
2. Platform specific logic takes its inputs as parameters (platform, environment, file contents) so every platform can be tested from any machine.
3. The CI matrix runs the suite on Ubuntu, Windows, and macOS.

## Adding a feature

1. Implement it as a service plus a `CommandDef`.
2. Validate all input and build an `OperationPlan` for anything that changes the system.
3. Add unit tests and, for command behavior, an integration test through `parseArgv`.
4. Run `pnpm docs:commands` and update the README and changelog.

## Writing and visual rules

1. No em dashes or en dashes in any user facing text.
2. No purple, no glow, no neon, no web dashboard styling.
3. Never rely on color alone. Status lines use text labels such as `[OK]` and `[FAIL]`.
