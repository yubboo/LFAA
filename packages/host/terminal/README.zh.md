---
description: 宿主真实终端服务（node-pty 会话、窗口尺寸、生命周期与 WebSocket 协议）
kind: package
---

# @lfaa/terminal

宿主侧的真实终端服务：每个聊天会话一个 PTY，用 `node-pty`（Windows 走 ConPTY 预编译）起进程，通过 `/api/terminal` 的 WebSocket 与浏览器双向通信。

## 职责

- 持有 PTY 进程：shell 白名单、`cwd` 限定在项目根内、有界回放缓冲。
- 经 `ws` 推送输出、接收输入与窗口尺寸；断线不杀进程，刷新页面后重连可接着用。
- 关标签、切会话、插件卸载时回收进程。

## 不在职责内

- 渲染（见 `@lfaa/client-ui-terminal`）与右栏/底部面板布局（见 `@lfaa/ui-layout`）。
- 一次性命令执行（那是 `@lfaa/jobs`）。

## 接口

- `TerminalService`：`open / write / resize / subscribe / kill / disposeAll`。
- `createTerminalUpgradeHandler({ getService, token, resolveCwd })`：返回 `server.on("upgrade")` 处理函数；非终端路径返回 `false`，让 Vite HMR 等其它升级处理器继续工作。