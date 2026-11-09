# Command reference

This file is generated from the command registry by `pnpm docs:commands`. Every command listed here is implemented in this release. Run `doc-cli help <command>` for the same details in your terminal.

## Global options

These work with every command.

```text
--json              machine readable JSON output
--quiet             reduce output
--verbose           print diagnostics
--no-color          disable color output (NO_COLOR is also honored)
--non-interactive   never prompt, fail instead of asking
--yes               approve confirmations (not administrator elevation)
--dry-run           show the plan and change nothing
--allow-elevation   with --yes, approve steps that need administrator rights
```

## Exit codes

1. `0` success.
2. `1` general failure.
3. `2` usage error, such as an unknown command or invalid argument.
4. `3` the operation is not supported on this system.
5. `4` the operation needed approval and did not get it.
6. `5` verification failed, such as a checksum mismatch.
7. `6` network failure.
8. `7` the environment is not ready, for example an unsupported Node.js version.

## General

### version

Print the DOC CLI version.

```bash
doc-cli version
```

### status

Show DOC CLI status and key settings.

```bash
doc-cli status
```

### doctor

Check that this system can run DOC CLI features.

```bash
doc-cli doctor
```

Options:

```text
--network                 also test network access
```

### help

Show commands, or usage for one command.

```bash
doc-cli help [command...]
```

### completion

Print a shell completion script (bash, zsh, fish, powershell).

```bash
doc-cli completion <shell>
```

## System

### system info

Show a short overview of this computer.

```bash
doc-cli system info
```

### system hardware

Show CPU, memory, and disk details.

```bash
doc-cli system hardware
```

### system os

Show operating system details.

```bash
doc-cli system os
```

### system environment

Show environment variables with secret values hidden.

```bash
doc-cli system environment
```

### system processes

Show the busiest processes (read only).

```bash
doc-cli system processes
```

Options:

```text
--limit <n>               number of processes to list
--sort <field>            sort by cpu or mem
```

### system paths

Show PATH entries and DOC CLI storage locations.

```bash
doc-cli system paths
```

## Packages

### packages managers

List package managers and whether they are installed.

```bash
doc-cli packages managers
```

### packages search

Search for packages.

```bash
doc-cli packages search <query>
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
```

### packages list

List installed packages.

```bash
doc-cli packages list
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
```

### packages outdated

List packages with newer versions available.

```bash
doc-cli packages outdated
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
```

### packages info

Show details for a package.

```bash
doc-cli packages info <package>
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
```

### packages install

Install a package after showing a plan.

```bash
doc-cli packages install <package>
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
--cask                    Homebrew cask (graphical application)
```

This command can change your system. It shows a plan first and asks for approval.

### packages upgrade

Upgrade one package, or all for managers that support it.

```bash
doc-cli packages upgrade [package]
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
```

This command can change your system. It shows a plan first and asks for approval.

### packages remove

Remove a package after showing a plan.

```bash
doc-cli packages remove <package>
```

Options:

```text
--manager <id>            package manager to use (for example npm, apt, brew, winget)
--cask                    Homebrew cask (graphical application)
```

This command can change your system. It shows a plan first and asks for approval.

## Developer Setup

### setup

Developer starter kit wizard.

```bash
doc-cli setup
```

Options:

```text
--profile <id>            start from a profile (web, python, fullstack, minimal)
--tool <id...>            add specific tools
--allow-global-webpack    allow a global webpack install
```

This command can change your system. It shows a plan first and asks for approval.

### setup developer

Choose and install developer tools with a plan.

```bash
doc-cli setup developer
```

Options:

```text
--profile <id>            start from a profile (web, python, fullstack, minimal)
--tool <id...>            add specific tools
--allow-global-webpack    allow a global webpack install
```

This command can change your system. It shows a plan first and asks for approval.

### setup list

List starter kit tools and what is installed.

```bash
doc-cli setup list
```

### setup profile list

List built in and saved profiles.

```bash
doc-cli setup profile list
```

### setup profile show

Show the tools in a profile.

```bash
doc-cli setup profile show <name>
```

### setup export

Write the last selection to a profile file.

```bash
doc-cli setup export <file>
```

Options:

```text
--profile <id>            export a built in or saved profile instead of "last"
```

### setup import

Plan an install from a profile file.

```bash
doc-cli setup import <file>
```

This command can change your system. It shows a plan first and asks for approval.

## Runtimes and Tools

### runtime list

List known language runtimes.

```bash
doc-cli runtime list
```

### runtime detect

Detect installed runtimes and their versions.

```bash
doc-cli runtime detect
```

### runtime info

Show details for one runtime or tool.

```bash
doc-cli runtime info <name>
```

### tools list

List every tool in the starter kit catalog.

```bash
doc-cli tools list
```

### tools search

Search the starter kit catalog.

```bash
doc-cli tools search <query>
```

### tools check

Check which catalog tools are installed.

```bash
doc-cli tools check
```

## Performance

### performance check

Quick health check with measured values.

```bash
doc-cli performance check
```

### performance report

Full performance and developer environment report.

```bash
doc-cli performance report
```

### performance recommendations

Safe suggestions based on current measurements.

```bash
doc-cli performance recommendations
```

### performance startup

List optional startup items for your review.

```bash
doc-cli performance startup
```

### performance disk

Show the largest items inside a folder you choose.

```bash
doc-cli performance disk
```

Options:

```text
--path <dir>              folder to scan (required)
--limit <n>               items to show
```

### performance cache inspect

Show package manager cache locations and sizes.

```bash
doc-cli performance cache inspect
```

### performance cache clean

Clean package caches using each tool's own command.

```bash
doc-cli performance cache clean
```

Options:

```text
--preview                 show the plan only
--only <ids>              comma separated cache ids (npm,pnpm,pip,yarn)
```

This command can change your system. It shows a plan first and asks for approval.

## History

### history

Show recent commands.

```bash
doc-cli history
```

Options:

```text
--limit <n>               records to show
```

### history search

Search history.

```bash
doc-cli history search <query>
```

### history show

Show one history record.

```bash
doc-cli history show <id>
```

### history replay

Run a past command again after confirmation.

```bash
doc-cli history replay <id>
```

This command can change your system. It shows a plan first and asks for approval.

### history export

Write history to a JSON file.

```bash
doc-cli history export <file>
```

### history clear

Delete all history records.

```bash
doc-cli history clear
```

This command can change your system. It shows a plan first and asks for approval.

## Projects and Git

### project inspect

Describe the project in a folder.

```bash
doc-cli project inspect
```

Options:

```text
--path <dir>              project folder
--scan-deps               measure node_modules size (slow on large projects)
```

### project create

Create a small starter project from a template.

```bash
doc-cli project create <name>
```

Options:

```text
--template <t>            node or python
--dir <dir>               parent folder
```

This command can change your system. It shows a plan first and asks for approval.

### project init

Initialize Git in the current folder with a basic .gitignore.

```bash
doc-cli project init
```

Options:

```text
--path <dir>              project folder
```

This command can change your system. It shows a plan first and asks for approval.

### git status

Show branch and working tree status (read only).

```bash
doc-cli git status
```

### git branches

List local branches.

```bash
doc-cli git branches
```

### git log

Show recent commits.

```bash
doc-cli git log
```

Options:

```text
--limit <n>               commits to show
```

## Network and Security

### network check

Test name lookup and HTTPS access to common developer hosts.

```bash
doc-cli network check
```

### network dns

Resolve a host name.

```bash
doc-cli network dns [host]
```

### security check

Quick local security settings check.

```bash
doc-cli security check
```

### security audit

Deeper local audit (PATH permissions, secret looking variable names).

```bash
doc-cli security audit
```

## Backup and Downloads

### download

Download an https file, optionally verifying a SHA 256 checksum.

```bash
doc-cli download <url>
```

Options:

```text
--sha256 <hash>           expected SHA 256 checksum
```

This command can change your system. It shows a plan first and asks for approval.

### downloads list

List files downloaded by DOC CLI.

```bash
doc-cli downloads list
```

### backup create

Copy a folder into the DOC CLI backup store with checksums.

```bash
doc-cli backup create
```

Options:

```text
--path <dir>              folder to back up (required)
```

This command can change your system. It shows a plan first and asks for approval.

### backup list

List stored backups.

```bash
doc-cli backup list
```

### backup restore

Restore a backup into a folder you choose.

```bash
doc-cli backup restore <id>
```

Options:

```text
--to <dir>                target folder (required)
--overwrite               replace existing files
```

This command can change your system. It shows a plan first and asks for approval.

## AI and Plugins

### ai status

Show whether the optional AI assistant is enabled.

```bash
doc-cli ai status
```

### ai configure

Choose a provider and opt in to the AI assistant.

```bash
doc-cli ai configure
```

Options:

```text
--provider <id>           openai, anthropic, gemini, or ollama
--model <name>            model name from your provider
--key-env <name>          environment variable that holds your API key
--endpoint <url>          custom endpoint (Ollama or a compatible gateway)
```

This command can change your system. It shows a plan first and asks for approval.

### ai disable

Turn the AI assistant off.

```bash
doc-cli ai disable
```

This command can change your system. It shows a plan first and asks for approval.

### ai explain

Ask the provider to explain text you give (shown to you before sending).

```bash
doc-cli ai explain <text...>
```

### ai plan

Turn a request into reviewed DOC CLI commands (never runs them silently).

```bash
doc-cli ai plan <request...>
```

This command can change your system. It shows a plan first and asks for approval.

### plugin list

List installed plugins.

```bash
doc-cli plugin list
```

### plugin search

Search for plugins (no registry is configured in this release).

```bash
doc-cli plugin search <query>
```

### plugin install

Install a plugin from a local folder you trust.

```bash
doc-cli plugin install <folder>
```

This command can change your system. It shows a plan first and asks for approval.

### plugin enable

Enable an installed plugin.

```bash
doc-cli plugin enable <name>
```

This command can change your system. It shows a plan first and asks for approval.

### plugin disable

Disable an installed plugin.

```bash
doc-cli plugin disable <name>
```

This command can change your system. It shows a plan first and asks for approval.

### plugin remove

Remove an installed plugin.

```bash
doc-cli plugin remove <name>
```

This command can change your system. It shows a plan first and asks for approval.

### plugin run

Run a command provided by an enabled plugin.

```bash
doc-cli plugin run <name> <command> [extra...]
```

This command can change your system. It shows a plan first and asks for approval.

## Updates

### update check

Check whether a newer DOC CLI release exists.

```bash
doc-cli update check
```

### update

Install the newest release after showing a plan.

```bash
doc-cli update
```

This command can change your system. It shows a plan first and asks for approval.

### update channel

Show or set the update channel (stable, beta, nightly).

```bash
doc-cli update channel [channel]
```

This command can change your system. It shows a plan first and asks for approval.

### update history

Show past self updates.

```bash
doc-cli update history
```

### update rollback

Restore the previous standalone executable.

```bash
doc-cli update rollback
```

This command can change your system. It shows a plan first and asks for approval.

## Settings

### config get

Read a configuration value (for example ui.theme).

```bash
doc-cli config get <key>
```

### config set

Change a configuration value after confirmation.

```bash
doc-cli config set <key> <value>
```

This command can change your system. It shows a plan first and asks for approval.

### config reset

Restore default configuration after confirmation.

```bash
doc-cli config reset
```

This command can change your system. It shows a plan first and asks for approval.

### config show

Print the full configuration.

```bash
doc-cli config show
```

