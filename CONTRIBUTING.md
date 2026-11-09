# Contributing

Thank you for helping. Please read `docs/DEVELOPMENT.md` first.

## Workflow

1. Open an issue that describes the problem or idea before large changes.
2. Create a branch and keep the change focused.
3. Add tests. Platform logic must be testable without the real platform.
4. Run `pnpm verify` and fix every failure.
5. Update `docs/` and `CHANGELOG.md` when behavior changes. Run `pnpm docs:commands` if commands changed.
6. Open a pull request and fill in the template.

## Rules for changes that touch the system

1. Build an `OperationPlan` and go through `runPlan`. Never run an impactful command directly from a command handler.
2. Validate every input and pass arguments as arrays.
3. Never add automatic deletion, silent elevation, or hidden network traffic.
4. Never mark a platform route as supported until it has been run on that platform.

## Style

No em dashes or en dashes in text. No purple, glow, or dashboard styling in terminal output. Status must never depend on color alone.
