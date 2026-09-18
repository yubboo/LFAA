# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.22
- 状态：delivered
- 最新变更：#19.1
- 日期：2026-09-18
- Setup 一键准备增加 Node / pnpm 真实版本和路径检测。
- 增加 workspace 与 Node 依赖声明统计。
- 当前没有第三方 Node 依赖时明确说明 node_modules 很小是正常。
- Cargo 缺失且 winget 不存在时，改用 Rust 官方 rustup-init 回退安装。
- Rustup 执行前必须通过 Rust 官方 SHA-256 校验。
- Rust 安装仍失败时显示“部分完成”，不再假绿。
- 当前主业务模块仍为 `config-system`。

详细记录：

`docs/changelog/v0.0.22.md`
