# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #19 一键准备与依赖检测

- 用户版本：v0.0.33
- 状态：delivered
- 最新变更：#19.8
- 日期：2026-09-18
- 修复全新 Windows 机器安装 node-pty 时被 pnpm 严格构建策略阻止的问题。
- 精确批准 `node-pty@1.1.0`，不放宽其他依赖。
- Setup 菜单 1 增加 node-pty 运行时校验。

## #21 Web 工作台 UI

- 最新变更：#21.7
- 真实终端仍使用 xterm.js + node-pty。
- UI 实机验证继续进行。

详细记录：

`docs/changelog/v0.0.33.md`
