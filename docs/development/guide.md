# Contributor workflow

[简体中文](guide.zh.md) · [Documentation](../README.md)

Before editing, read [AGENTS](../../AGENTS.md), [development rules](../../开发规范.md), [architecture](../系统总体架构.md), [current plan](../开发计划.md), [task contracts](../PROMPTS.md) and the target package README. Register the runtime entry, settings, data and authorization owners, allowed scope and acceptance criteria first.

```sh
pnpm run check:workspace
pnpm run typecheck
```

The workspace check validates public entries, declared internal dependencies, dependency cycles, generated TypeScript paths and package inventory, current product versions, release numbering, build boundaries and active documentation links. After changing package metadata, run `pnpm run sync:workspace` and repeat the read-only check.

Run selected CLI regressions from `apps/cli`:

```sh
node --import tsx --import ./register-package-loader.mjs --test tests/*.test.mjs
```

Shared storage, Session and Settings changes require downstream coverage. Electron Node tests are in `apps/desktop-electron/tests`. Outputs belong in root `dist/`; `node scripts/build-harness.mjs host-staging` builds an isolated Host candidate.

The CI workflow checks workspace metadata, types and selected persistent regressions. A configured workflow is not evidence of a completed remote run. Builds do not establish browser, desktop, Provider or device acceptance. There is currently no `workspace-preflight` command.

Preserve user data, backups, previous installers and requested upstream placeholders. Do not restart active services, rewrite Git history or publish candidates as part of an ordinary repair.
