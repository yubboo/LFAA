# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #18 Setup 菜单缺少 Cargo 时错误终止修复

- 用户版本：v0.0.16
- 状态：delivered
- 日期：2026-09-18
- `LFAA-Setup.bat` 菜单 1 改为安装当前环境可用的全部依赖。
- pnpm 成功、Cargo 缺失时不再把整个流程判定为失败。
- 缺少 Cargo 时明确显示 Rust 依赖已跳过。
- 菜单 4 / 10 仍严格要求 Cargo。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.16.md`
