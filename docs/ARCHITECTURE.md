# Architecture

DOC CLI is a modular monolith written in TypeScript. It ships as one package with one entry point and keeps platform specific work behind adapters.

## Layers

1. CLI presentation: `src/ui` holds the banner, colors, tables, prompts, and the output writer. `src/cli` holds the command parser, the interactive shell, and the command palette.
2. Command layer: every command is a typed `CommandDef` object in a module folder. `src/cli/commandRegistry.ts` collects them. The same registry feeds the parser, the palette, shell completion, `help`, and the generated command reference, so they cannot drift apart.
3. Application services: functions in `src/modules/*/service.ts` implement use cases such as package selection, update checks, and performance reports. Commands call these and do not touch the system directly.
4. Policy and safety: `src/services/permissionService.ts` turns every impactful operation into an `OperationPlan`, shows it, applies the approval rules, and writes an audit record.
5. Domain modules: `src/modules/*` for system, packages, developer setup, runtimes, tools, performance, history, projects, Git, network, downloads, backup, security, AI, plugins, and updater.
6. Platform adapters: `src/platform` detects the operating system, distribution, architecture, shell, root status, and WSL. `src/adapters/packageManagers` holds one adapter definition per package manager. `src/adapters/aiProviders` holds the optional AI provider clients.
7. Infrastructure: `src/core` (configuration, paths, logging, errors, context) and `src/services` (process runner, filesystem helpers, history store).

## Rules the code follows

1. Commands never run system operations themselves. They call services.
2. All subprocesses go through `ProcessRunner`. It takes an executable and an argument array, never a shell string. It enforces an allowlist of executable names, a timeout, and an output size limit.
3. Windows batch scripts (`npm.cmd` and similar) are run through `cmd.exe` only when every argument matches a strict safe pattern.
4. External data is untrusted. Package metadata, plugin manifests, release metadata, and AI replies are parsed with Zod schemas before use.
5. Plugins and AI stay outside the trusted core. AI can only propose a plan made of real DOC CLI commands, and those commands apply their own approval rules.

## Data flow for a change

1. The parser matches a command and builds an `AppContext` (configuration, output, prompter, runner, history, platform).
2. The command validates input and builds an `OperationPlan`.
3. `runPlan` shows the plan, applies dry run, `--yes`, elevation, and configuration rules, and asks the user if needed.
4. On approval the executor runs the steps through the runner and verifies results.
5. The command runner records a history entry (redacted) and the permission service records an audit entry.

## Storage

1. Configuration: a validated JSON file in the standard configuration folder for the operating system.
2. History: a versioned JSON document with atomic writes and owner only file permissions, plus a separate JSON lines audit log. A SQLite store was considered, but a plain file avoids a native dependency on three platforms. The `HistoryService` interface hides the storage, so SQLite can replace it later.
3. Backups, downloads, plugins, and update staging each have their own folder under the data directory. Run `doc-cli system paths` to see them.

## Extending DOC CLI

To add a command, create a `CommandDef` in the right module and add it to `commandRegistry.ts`. To add a package manager, add an `AdapterSpec` in `registry.ts` with parsers in `parsers.ts`, then add unit tests with mocked process output. To add a tool to the starter kit, add a `ToolEntry` in `catalog.ts`.
