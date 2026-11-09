# Performance and system health

The performance module measures, explains, and recommends. It does not promise speed gains and does not change settings.

## What it measures

1. CPU load, memory use, uptime, and disk usage per mounted volume.
2. Developer tool versions for Node.js, pnpm, Python, Git, and Docker.
3. Package manager caches (npm, pnpm, pip, Yarn) with locations and sizes, plus the temporary folder size for review.
4. PATH entries that point to missing folders.
5. Startup items: desktop autostart entries on Linux, user launch agents on macOS, and startup commands on Windows.

Metrics a platform cannot provide are shown as unsupported. Report values always come from real measurements.

## Commands

```bash
doc-cli performance check
doc-cli performance report
doc-cli performance recommendations
doc-cli performance startup
doc-cli performance disk --path ~/projects
doc-cli performance cache inspect
doc-cli performance cache clean --preview
doc-cli performance cache clean
```

`performance disk` needs `--path` because DOC CLI only scans folders you name. Scans have file count and time limits and tell you when a result is a lower bound.

## Cleanup rules

1. Cleanup defaults to a plan. Use `--preview` or `--dry-run` to see it without running anything.
2. The real cleanup uses each tool's own command, for example `npm cache clean --force` and `pnpm store prune`.
3. You approve the exact paths and commands. Sizes before and after are printed.
4. DOC CLI never deletes user files, clears browser data, stops processes, or disables services and startup items.
5. Clearing a cache does not always make things faster. Caches speed up later installs, so cleaning mainly frees disk space.
