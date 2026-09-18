# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与项目资源根收敛

- 用户版本：v0.0.17
- 状态：delivered
- 日期：2026-09-18
- Setup 菜单 1 升级为“一键准备”。
- 缺少 Rust/Cargo 时可通过 winget 尝试安装 Rustup。
- pnpm/Cargo 已下载依赖继续复用，不重复做无意义下载。
- 删除根 `/skills`、`/plugins` 占位目录。
- `.lfaa/` 成为项目级 Skill/Expert/Plugin/Extension/MCP 唯一事实源。
- 固定 File Watcher + Registry Generation 热插拔设计。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.17.md`
