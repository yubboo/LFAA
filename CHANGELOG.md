# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.35
- 状态：delivered
- 最新变更：#19.10
- 日期：2026-09-18
- 修复 Windows 新机器 Rust 首装时 `Get-WindowsRustupTarget` 缺失。
- 新增 AMD64 / ARM64 / x86 到 Rust 官方 MSVC target 的映射。
- 保留 Rust 官方 HTTPS 与 SHA-256 校验。
- Governance 新增 Windows Rustup target resolver 防回归门禁。
- #21 真实终端开发桥接继续保持 pending-test。

详细记录：

`docs/changelog/v0.0.35.md`
