# #17 pnpm-only 一致性修复

## 主模块

`project-foundation`

## 问题

项目已经固定 pnpm，但根 `package.json` 的 test 脚本和 `DEVELOPMENT.md` 仍残留 npm 命令，Setup 环境页也继续展示 npm，容易让后续开发者或 AI 误认为 npm 可用。

## 修复

- 根 test 改为 `pnpm run governance:check`；
- DEVELOPMENT 命令统一为 pnpm；
- Setup 不再展示 npm；
- 新增 `preinstall` pnpm-only 门禁；
- Governance 检查根 scripts 不得调用 npm/npx/yarn/bun；
- AGENTS/README/QUALITY_GATES 明确 pnpm-only。

## 状态

`delivered in v0.0.15`
