# Developer starter kit

`doc-cli setup developer` helps you choose and install common developer tools.

## How the wizard works

1. It detects your operating system, architecture, and package managers.
2. It detects installed tools and their versions by running their version commands.
3. You pick a profile or choose tools one by one. Installed tools are marked.
4. It resolves dependencies and order. For example Node.js comes before pnpm when npm is missing.
5. It shows the complete plan with exact commands, administrator needs, and manual steps.
6. After approval it installs one tool at a time, then verifies each result.
7. It reports successes and failures. Failed tools can be retried by running the same command again, because finished tools are skipped.
8. It saves your selection as the profile `last`. Export it with `doc-cli setup export team.json` and reuse it with `doc-cli setup import team.json`.

## Profiles

1. `web`: Git, Node.js, npm, pnpm, VS Code, Firefox, curl, jq.
2. `python`: Git, Python 3, pip, uv, VS Code, Firefox.
3. `fullstack`: Git, Node.js, pnpm, Python 3, uv, VS Code, Firefox, Docker, Insomnia.
4. `minimal`: Git, VS Code, Firefox, and Node.js or Python of your choice (pass `--tool node` without a terminal).

Profiles are starting points. You can change every selection.

## Examples

```bash
doc-cli setup
doc-cli setup --profile web --dry-run
doc-cli setup --profile python --tool docker
doc-cli setup list
doc-cli setup profile show fullstack
```

## Package distinctions

1. npm comes with Node.js, so DOC CLI does not install it separately. pip comes with Python on most systems, but Debian and Ubuntu package it separately.
2. webpack is normally a project dependency. By default DOC CLI recommends adding it per project with `pnpm add -D webpack webpack-cli`. A global install happens only with `--allow-global-webpack`.
3. VS Code, Cursor, Firefox, and Docker may use vendor downloads. DOC CLI prints the official page as a manual step and never accepts a license for you.
4. Docker Desktop and Docker Engine are different products. The plan names which one a route installs.

## Honest status of install routes

The catalog lists package identifiers per package manager. They are written from vendor and package manager naming, and they have not been verified on every platform. The wizard says so in the plan. Before you rely on a route in a team, run it with `--dry-run`, then on a test machine, and report problems. A route becomes "tested" only after that is done and recorded in the changelog.
