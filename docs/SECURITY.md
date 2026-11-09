# Security model

DOC CLI changes software on your computer, so it is built to be predictable and conservative.

## Principles

1. No unrestricted shell. Subprocesses use an executable and an argument array. There is no string concatenation into shell commands.
2. Allowlisted executables. The process runner refuses names it does not know.
3. Validated input. Package identifiers, search queries, URLs, file names, and plugin names are validated before use.
4. Plans before changes. Installs, upgrades, removals, cleanups, backups, restores, downloads, plugin changes, configuration changes, and self updates all show a plan first.
5. Explicit approval. In a terminal DOC CLI asks. Without a terminal it refuses unless you pass `--yes`. Steps that need administrator rights also need `--allow-elevation`.
6. No silent elevation. When a step needs `sudo`, the plan says so and shows the exact command.
7. Verified downloads. Downloads accept https only, enforce a size limit, and compare SHA 256 checksums when you provide one. Self updates always verify the checksum before replacing anything.
8. Safe file handling. Backups and restores reject path traversal, skip symbolic links, and verify checksums. Restores refuse to overwrite files unless you pass `--overwrite`.
9. Secret protection. History, logs, and audit records redact secret flags, assignments, and common token shapes. Environment values whose names look secret are hidden.
10. Untrusted inputs. Package manager output, release metadata, plugin manifests, and AI replies are parsed and validated.

## Not covered in 0.1.0

1. Release signature verification. Updates verify a SHA 256 checksum from the same release. A separate signature check is planned but not implemented.
2. OS credential storage for AI keys. DOC CLI reads the key from an environment variable you name and never stores it.
3. Plugin sandboxing. Plugins run as normal programs with your rights, with a reduced environment. A plugin manifest lists requested permissions, but they are informational. Only install plugins you trust.
4. Standalone binary signing. No standalone binaries are produced yet.

## Reporting a vulnerability

Report security problems privately to the maintainers of the repository that publishes your copy of DOC CLI. Do not open a public issue for an unfixed vulnerability.
