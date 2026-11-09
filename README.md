# DOC CLI

DOC CLI is a cross platform command line assistant for developers. It inspects your system, manages packages through the tools you already have, sets up developer environments from a plan you approve, reports on performance, and keeps a local history of what it did.

It runs on Linux, macOS, and Windows with Node.js 22.13 or newer. It does not replace your package managers. It detects them, shows exactly what it will run, and asks before changing anything.

## Quick start

```bash
pnpm install
pnpm build
node bin/doccli.js            # opens the interactive shell in a terminal
node bin/doccli.js doctor
node bin/doccli.js system info
node bin/doccli.js setup --profile web --dry-run
```

After publishing or linking the package, the command is `doc-cli`. The npm package name is `doc-cli-assistant` because the name `doc-cli` is already taken on the npm registry (checked on 8 November 2026). The installed command is still `doc-cli`.

```bash
doc-cli                       # interactive shell, type / for the command palette
doc-cli help                  # all commands by category
doc-cli packages managers
doc-cli performance report
doc-cli history
```

## What you get

1. Interactive shell with a banner, tab completion, and a `/` command palette with live filtering.
2. System inspection: hardware, operating system, environment (secrets hidden), PATH health, processes.
3. Package management through adapters for npm, pnpm, Yarn (detection), Bun, pip, uv, APT, DNF, pacman, Homebrew, and winget.
4. Developer starter kit wizard with profiles, dependency ordering, manual step reporting, and profile export and import.
5. Performance checks, reports, cache inspection and cleanup using each tool's own command, startup item review.
6. Local history with redaction, search, export, replay, and a separate audit log of approved operations.
7. Project inspection and scaffolding, read only Git views, network checks, verified downloads, checksummed backups.
8. Self update with channel selection, checksum verification, and rollback for standalone installs.
9. Optional AI assistant and local folder plugins, both off by default.
10. Shell completion for bash, zsh, fish, and PowerShell.

See `docs/COMMANDS.md` for every command with its options.

## Safety model in one minute

1. Every change shows a plan with the exact commands first.
2. In a terminal you are asked. Without a terminal DOC CLI refuses unless you pass `--yes`.
3. Steps that need administrator rights are labeled. `--yes` alone never approves them. You also need `--allow-elevation`.
4. `--dry-run` shows the plan and changes nothing.
5. No shell strings, only executables with argument arrays, restricted to an allowlist.
6. Nothing is sent anywhere unless you opt in to the AI assistant, and then you see the exact text before each request.
7. No telemetry. The only network use is what you ask for, such as searches, downloads, update checks, and `network check`.

Details are in `docs/SECURITY.md`.

## Honest status of this release (0.1.0)

This section lists what has and has not been verified, so you know what to trust.

Verified in the build environment (Ubuntu 24.04, Node.js 22):

1. Type checking, linting, formatting, and 90 automated tests pass.
2. The CLI builds and runs. `system`, `doctor`, `packages managers`, `setup`, `performance`, `security`, `history`, and `update check` were run against the real machine.
3. Package manager command construction and output parsing are tested with mocked process output for npm, pnpm, pip, uv, APT, DNF, pacman, and Homebrew.

Not verified yet, and not claimed:

1. Windows and macOS runs. The code handles their paths, shells, and `winget`/`brew` commands, and the CI workflow runs the test suite on all three systems, but no one has run the real installs there. Treat Windows and macOS as unverified until your CI is green and you have tried it.
2. Real installs through APT, DNF, pacman, Homebrew, and winget. The catalog package identifiers are marked untested in the setup plan. Use `--dry-run` first.
3. Yarn operations. Yarn is detected only. Yarn's global behavior differs between Classic and modern versions, so install, list, and remove are intentionally not implemented.
4. winget output parsing. Search and list show raw lines. Installed versions are not parsed.
5. Standalone binaries. The updater code path (download, checksum, replace, verify, rollback) is unit tested, but this release does not build standalone executables. Releases need a pipeline that publishes `doc-cli-<os>-<arch>` files and a `SHA256SUMS` file.
6. Release signature checks and OS credential storage for AI keys. Both are planned and documented as not implemented.
7. The update source. `updates.repository` is empty until you set it to your own `owner/name`.
8. The Escape key to close the command palette. The palette closes with Ctrl+C because the prompt library does not expose Escape.
9. Package names in `package.json` (`repository` URL placeholder `OWNER`) must be replaced before publishing.

## Package manager support

1. npm: search, list, outdated, info, install, upgrade, remove.
2. pnpm: list, outdated, install, upgrade, remove.
3. Yarn: detection only.
4. Bun: list, install, upgrade, remove.
5. pip: list, outdated, info, install, upgrade, remove. On systems that block system wide pip (PEP 668), pip will refuse and DOC CLI reports that.
6. uv: list (tools), install, upgrade, remove.
7. APT: search, list, outdated, info, install, upgrade, remove (uses `sudo` when you are not root).
8. DNF: search, list, outdated, info, install, upgrade, remove.
9. pacman: search, list, outdated, info, install, upgrade (full system upgrade only), remove.
10. Homebrew: search, list, outdated, info, install, upgrade, remove, with `--cask`.
11. winget: search and list (raw), info, install, upgrade, remove.

## Documentation

1. `docs/COMMANDS.md`: command reference, generated.
2. `docs/CONFIGURATION.md`: configuration keys and locations.
3. `docs/DEVELOPER_STARTER_KIT.md`: the setup wizard and profiles.
4. `docs/PERFORMANCE.md`: what is measured and what cleanup does.
5. `docs/SECURITY.md`: safety model and known gaps.
6. `docs/PLUGINS.md`: plugin manifests and limits.
7. `docs/ARCHITECTURE.md`: layers and rules.
8. `docs/DEVELOPMENT.md`: building, testing, contributing code.
9. `docs/TROUBLESHOOTING.md`: common problems.

## License

MIT. See `LICENSE`.
