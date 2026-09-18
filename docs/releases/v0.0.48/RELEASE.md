# LFAA v0.0.48 Release

本版本以 v0.0.47 为历史基线，只修复左栏 Hover Preview 与正式 Dock 宽度不统一的问题。

## 交付内容

- Hover / Click 共用 `ResizableWorkbench.leftWidth`；
- 新增 `onLeftWidthChange`；
- App Shell 通过 `--agent-left-preview-width` 传递实际宽度；
- 删除 Preview 独立 clamp 宽度；
- UI contract 增加单一宽度事实源防回归；
- #21.15 归档，#21.16 Active。

## 未修改

- 三向吸附 / reverse unlock / collapsed 规则；
- 容器响应式 Mode 计算；
- Sync / GitHub / Setup / Update；
- Windows PowerShell 编码；
- PTY bridge / node-pty。

真实视觉状态：`pending-windows-visual-test`。
