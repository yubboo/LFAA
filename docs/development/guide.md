# Contributor workflow

[简体中文](guide.zh.md) · [Documentation](../README.md)

## Before editing

Read repository [AGENTS](../../AGENTS.md), [development rules](../../开发规范.md), [system architecture](../系统总体架构.md), [current plan](../开发计划.md), and the target package README. Check the existing worktree, then reuse or register a contract in [PROMPTS](../PROMPTS.md). Confirm the runtime entry, Owner, settings, data/permission scope, and acceptance criteria from source.

## Change and verify

- Make only the changes needed for the goal; use the [package rules](package-responsibilities.md) to confirm boundaries.
- Choose relevant regressions, type checks, builds, and workspace gates. Do not run unrelated tests or builds by default.
- After changing package entries, dependencies, or type mappings, run `pnpm run sync:workspace`, inspect its diff, then run `pnpm run check:workspace`.
- Web/UI changes also require the current source service and ChatGPT in-app browser to check the real route and relevant viewports.
- Write all build output to the repository root `dist/`. Preserve user data, backups, old installers, and required upstream placeholders.

## Record completion

Update the same contract with changed files and responsibilities, checks actually run, results, failures, and untested areas. A successful build does not prove browser, Provider, Daemon, desktop, or device acceptance.
