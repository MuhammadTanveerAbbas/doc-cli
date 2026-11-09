# Troubleshooting

Start with `doc-cli doctor`. It checks the Node.js version, configuration, writable folders, package managers, Git, PATH health, and optionally the network with `--network`.

## Common problems

1. "DOC CLI needs Node.js 22.13 or newer": install a current LTS release from nodejs.org, then open a new terminal.
2. "Invalid configuration": the message names the key. Fix it with `doc-cli config set <key> <value>` or run `doc-cli config reset`.
3. A command is "not found" after an install: open a new terminal so PATH changes apply. DOC CLI never edits your shell profile.
4. "This operation needs confirmation and no terminal is available": run with `--dry-run` to review, then repeat with `--yes`. Add `--allow-elevation` if the plan has elevated steps.
5. npm global installs fail with permission errors: configure npm to use a user owned prefix instead of using `sudo npm`. DOC CLI does not elevate npm for you.
6. No package manager found: run `doc-cli packages managers` to see what was checked.
7. Colors look wrong: set `NO_COLOR=1` or use `--no-color`. In very old terminals set `ui.ascii` to true.
8. Update check says no source is configured: set `updates.repository` to the `owner/name` of the repository that publishes releases.
9. History shows nothing: check `doc-cli config get history.enabled`.
10. On Windows, winget may ask you to accept package terms. DOC CLI does not accept them for you, so run the printed command yourself once.

## Getting more detail

Add `--verbose` to see diagnostics. Add `--json` for structured output that you can attach to a bug report. Secrets are redacted in history and logs, but review any output before sharing it.
