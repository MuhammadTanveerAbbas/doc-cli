# Plugins

Plugins add commands that run as separate programs. They are optional and not part of the trusted core.

## Manifest

Each plugin folder contains `plugin.json`:

```json
{
  "name": "hello",
  "version": "1.0.0",
  "publisher": "Example Co",
  "description": "Says hello",
  "compatibility": { "minDocCliVersion": "0.1.0" },
  "permissions": ["filesystem.read"],
  "commands": [
    { "name": "greet", "description": "Print a greeting", "entry": "bin/greet.sh", "args": [] }
  ]
}
```

1. `name` uses lowercase letters, digits, and underscores.
2. `permissions` can include `filesystem.read`, `filesystem.write`, `network`, and `process`. They are shown before installation.
3. `entry` must stay inside the plugin folder. Paths that escape it are rejected.

## Commands

```bash
doc-cli plugin install ./my_plugin
doc-cli plugin list
doc-cli plugin run hello greet
doc-cli plugin disable hello
doc-cli plugin enable hello
doc-cli plugin remove hello
doc-cli plugin search something
```

`plugin search` reports that no plugin registry exists yet. Installation is from a local folder that you trust.

## Security

Plugins are third party code. DOC CLI runs a plugin command as a subprocess with a reduced environment (PATH, home, and temp variables only), a timeout, and your approval. This is not a sandbox. A plugin can do anything your user account can do, whatever its manifest says. Read the code before you install it.
