# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.24
- 状态：delivered
- 最新变更：#19.3
- 日期：2026-09-18
- `LFAA-Setup.bat` 成为 Web / Desktop / Build / Release 统一开发入口。
- 删除独立 `LFAA-Web.bat` 与 `lfaa-web.ps1`。
- 菜单 2 直接启动 Web / Vite。
- Desktop 启动与构建入口已预留，但未实现时明确失败。
- 构建发布只生成本地产物，不自动上传远程。
- #21 Web 工作台最新变更更新为 #21.1。
- 当前主业务模块仍为 `config-system`，Web UI 为前置验证壳。

详细记录：

`docs/changelog/v0.0.24.md`
