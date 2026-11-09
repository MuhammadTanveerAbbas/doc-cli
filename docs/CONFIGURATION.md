# Configuration

DOC CLI reads one validated JSON file. Find its location with `doc-cli system paths`. Invalid files produce a clear error with the key and the problem. Secrets are never stored in this file.

## Locations

1. Linux: `~/.config/doc-cli/config.json` (or `XDG_CONFIG_HOME`).
2. macOS: `~/Library/Application Support/DocCli/config/config.json`.
3. Windows: `%APPDATA%\DocCli\config\config.json`.
4. Override everything with the `DOC_CLI_HOME` environment variable. This is useful for tests and portable setups.

## Commands

```bash
doc-cli config show
doc-cli config get ui.theme
doc-cli config set history.retentionDays 30
doc-cli config reset
```

Values are parsed as JSON when possible, so `true`, `30`, and `null` work as expected, and plain words work as strings.

## Reference

```json
{
  "ui": { "theme": "dark", "color": true, "animations": true, "compact": false, "ascii": false },
  "updates": {
    "checkOnStartup": true,
    "autoInstall": false,
    "channel": "stable",
    "repository": "",
    "checkIntervalHours": 24
  },
  "history": { "enabled": true, "retentionDays": 90 },
  "performance": { "automaticCleanup": false, "scanLargeFiles": false },
  "ai": { "enabled": false, "provider": null, "model": null, "apiKeyEnv": null, "endpoint": null },
  "security": { "confirmInstalls": true, "confirmRemovals": true, "confirmCleanup": true }
}
```

1. `ui.theme`: `dark`, `light`, or `mono`. `mono` disables color.
2. `ui.compact`: use the one line banner.
3. `ui.ascii`: use the plain block banner instead of the outline font.
4. `updates.repository`: the `owner/name` of the GitHub repository that publishes DOC CLI releases. It is empty by default, so update checks report that no source is configured until you set it.
5. `updates.autoInstall`: reserved for a future release. Setting it to true does not install anything silently in 0.1.0.
6. `history.enabled` and `history.retentionDays`: control the local history. Old records are pruned on startup of the shell.
7. `performance.automaticCleanup`: can only be `false`. DOC CLI does not clean anything automatically.
8. `ai.*`: filled in by `doc-cli ai configure`. `apiKeyEnv` is the name of an environment variable, never the key itself.
9. `security.confirm*`: turning these off removes the approval question for installs, removals, or cleanups. Operations that need administrator rights always ask, and `--yes` never approves elevation on its own.

## Environment variables

1. `NO_COLOR`: disables color.
2. `FORCE_COLOR`: forces color on when output is redirected.
3. `TERM=dumb`: disables color and interactive features.
4. `DOC_CLI_HOME`: moves all DOC CLI folders under one directory.
