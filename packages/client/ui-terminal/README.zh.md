---
description: 浏览器端真实终端界面（xterm.js 渲染、WebSocket 输入输出、随主题与尺寸自适应）
kind: package
---

# @lfaa/client-ui-terminal

真实终端的浏览器侧：用 `xterm.js` 渲染 PTY 输出，把键盘输入与窗口尺寸经 WebSocket 送到宿主，配色跟随当前浅色/深色主题。

## 职责

- `TerminalPane`：把 xterm + fit 插件挂进右侧工作台标签（后续还有底部面板）；重挂载即重连，宿主里的 PTY 不随页面刷新消失。
- `connectTerminal`：带一次性令牌打开 `/api/terminal?sessionId=…`，发 `open / data / resize / kill`，收 `ready / data / exit / error`。
- 配色在挂载时从 `@lfaa/ui-theme` 语义变量读取，不写死颜色。

## 不在职责内

- PTY 进程管理与 shell 策略（见 `@lfaa/terminal`）。
- 面板位置与底部面板布局（见 `@lfaa/ui-layout`）。