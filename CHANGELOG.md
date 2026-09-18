# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.29
- 状态：delivered
- 最新变更：#19.6
- 日期：2026-09-18
- 工具链和项目依赖规则正式简化。
- Node / pnpm / Git / Rust / Cargo 作为电脑基础工具，一次准备，多项目复用。
- node_modules / Cargo.lock / rust-toolchain.toml / target / .lfaa 跟项目走。
- Setup 不再让普通用户理解或选择安装层级。
- Rust 缺失时只走官方 rustup-init，不再优先尝试 WinGet。
- 已有 Rust/Cargo 无论安装在哪个盘都直接复用。
- #21 Web 工作台端口复用逻辑保持不变。

详细记录：

`docs/changelog/v0.0.29.md`
