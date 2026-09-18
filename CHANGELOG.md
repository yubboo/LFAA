# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #21 Web 工作台 UI

- 用户版本：v0.0.32
- 状态：pending-test
- 最新变更：#21.7
- 日期：2026-09-18
- 修正侧栏 Hover 控件位置：控件属于左右侧栏本身。
- 中间顶部移除错误的侧栏 Hover 控制。
- Terminal Dock 移到整个主工作区最底部。
- 删除假终端日志。
- 接入 xterm.js + node-pty 真实本地 PTY。
- Windows 默认 PowerShell，cwd 为 LFAA 项目根。
- 真实 Agent Shell 仍保留 Rust PTY Broker 安全边界。

详细记录：

`docs/changelog/v0.0.32.md`
