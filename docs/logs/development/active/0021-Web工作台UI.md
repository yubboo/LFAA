# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.7
- **状态：** active
- **关键词：** Web、三栏、侧栏、Hover、终端、PTY、xterm、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

本轮修正两个明确问题：

```text
侧栏 Hover 控件
→ 控制必须属于左 / 右侧栏自身
→ 不能放到中间工作区顶部

终端
→ 必须是最底部 Dock
→ 必须是真实 PTY
→ 禁止用模拟日志冒充终端
```

当前 Web 开发模式使用：

```text
xterm.js
↓
Vite HMR 本地通信
↓
node-pty
↓
PowerShell / 当前系统 Shell
```

Web 服务器仍只绑定：

```text
127.0.0.1
```

真实终端默认工作目录为项目根。

## 最新变更

### #21.7 侧栏 Hover 与真实终端

1. 移除中间顶部错误的左右栏 Hover 控件；
2. 左侧栏鼠标移入时，左侧栏自身的收起按钮淡入；
3. 右侧栏鼠标移入时，右侧栏自身的终端 / 收起按钮淡入；
4. 侧栏已收起时，仅在对应屏幕边缘保留淡入式重新展开热点；
5. 分隔条继续只负责拖拽，不承担点击按钮；
6. 底部终端移到真正的最底部，并横跨中间工作区 + 右侧区域；
7. 左侧栏保持全高，不被底部终端截断；
8. 底部终端支持拖拽顶部边界改变高度；
9. 删除模拟终端日志；
10. Web 开发模式接入 `@xterm/xterm + @xterm/addon-fit + node-pty`；
11. Windows 默认启动 `powershell.exe -NoLogo`；
12. 终端输入、输出、窗口 resize 通过 Vite 自定义 HMR 事件连接真实 PTY；
13. 页面关闭、会话 dispose 或 Vite 退出时回收 PTY；
14. 真实终端只属于本地 Web 开发桥接，不作为正式 Agent Tool Runtime。

## 安全边界

当前终端是：

```text
人类直接交互的本地开发终端
```

不是：

```text
Agent 自动执行命令的 Tool
```

因此：

- 不自动提升权限；
- 不把 Secret 注入模型；
- 不开放远程监听；
- 不作为未来 Agent 绕过 Policy / Permission / Rust Broker 的通道；
- Agent 自动调用终端时仍必须走正式 Tool Runtime → Policy → Permission → Rust PTY Broker。

## 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/workbench.css`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/workbench.types.ts`
- `packages/app-shell/src/WorkbenchIcon.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `apps/web/src/LocalTerminal.tsx`
- `apps/web/src/local-terminal.css`
- `apps/web/src/vite-custom-events.d.ts`
- `apps/web/src/App.tsx`
- `apps/web/vite.config.ts`
- `apps/web/package.json`
- UI / Security / Testing 文档

## 验证结果

已完成静态与治理验证：

- 分隔条不存在点击按钮；
- 侧栏 Hover 控件位于对应侧栏；
- 底部面板位于三栏 Grid 第二行并跨中间 + 右栏；
- 模拟终端内容已删除；
- Vite terminal bridge 使用真实 `node-pty`；
- xterm 输入 / 输出 / resize 事件已接线；
- Vite 仍绑定 `127.0.0.1`；
- Governance / Import / Development Log / Docs Structure Check 通过。

真实 PTY 仍需用户 Windows 环境执行菜单 1 安装新增依赖后进行实机验证。

## 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | superseded | `archive/0021-03-最小宽度自动吸附.md` |
| #21.4 | superseded | `archive/0021-04-Web端口复用.md` |
| #21.5 | superseded | `archive/0021-05-Web启动延迟修复.md` |
| #21.6 | superseded | `archive/0021-06-三栏交互与终端停靠.md` |
| #21.7 | active | `active/0021-Web工作台UI.md` |
