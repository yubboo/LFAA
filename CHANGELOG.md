# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #17 pnpm-only 一致性修复

- 用户版本：v0.0.15
- 状态：delivered
- 日期：2026-09-18
- 根 `test` 脚本由 npm 改为 pnpm。
- DEVELOPMENT 当前命令统一为 pnpm。
- Setup 不再展示 npm，明确 pnpm-only。
- 新增 `preinstall` 包管理器门禁。
- Governance 禁止根 scripts 调用 npm/npx/yarn/bun。

## #16 项目治理、归属与项目级资源边界加固

- 用户版本：v0.0.15
- 状态：delivered
- 作者“二鱼”与 LFAA 官方命名空间门禁。
- `.lfaa/` 项目级资源边界。
- 安全、性能、质量门禁。
- `LFAA-Setup.bat` 开发环境与依赖菜单。
- 固定 pnpm 11.17.0 与 `pnpm-lock.yaml`。
- build/typecheck/test 未配置时明确失败。

完整记录：

`docs/changelog/v0.0.15.md`
