# #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.9
- **状态：** active
- **关键词：** Web、三栏、侧栏、常驻按钮、Workbench Chrome、终端、PTY、xterm、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

## 当前结论

框架级开合入口必须与可收起栏位内容解耦：

```text
桌面端
→ 原生标题栏 / App Chrome 放常驻 Shell Actions

Web 端
→ 页面自身提供全宽 Workbench Chrome
→ 左侧常驻左栏按钮
→ 右侧常驻终端 / 右栏按钮
```

因此不再采用“侧栏 hover 才显示开合按钮”或“收起后靠屏幕边缘 hover 热点恢复”的方案。

侧栏分隔条继续只负责：

```text
拖拽调宽
→ 到最小阈值吸附收起
→ Pointer Up 后禁止反向拖开
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

### #21.9 Web 常驻工作台 Chrome

根据桌面端参考重新定义壳层按钮归属：

1. 左栏 / 终端 / 右栏按钮属于 Workbench Shell，不属于侧栏内容；
2. Web 页面新增独立、全宽的 `WebWorkbenchChrome`；
3. 左栏按钮固定在顶栏最左侧，展开 / 收起都保持同一位置；
4. 终端和右栏按钮固定在顶栏右侧，并始终可见；
5. 左栏内部删除 hover 收起按钮；
6. 右栏内部删除 hover 终端 / 收起按钮；
7. 删除左 / 右屏幕边缘 hover 重新展开入口；
8. 删除底部 hover 终端重新展开入口；
9. 右栏中的“终端”工具项与快捷键继续作为额外入口；
10. 窄屏只隐藏分享等次要操作，三枚框架级按钮继续保留；
11. #21.8 的拖拽吸附、迟滞和吸附后禁止 separator 反向拖开规则不变。

### #21.8 三向吸附与显式重新展开

统一左、右、底部三向 Dock 的交互：

```text
展开状态：分隔条可拖拽
→ 拖到最小阈值：吸附收起
→ 已收起：分隔条不允许反向拖拽展开
→ 重新展开：点击对应左 / 右 / 底部显式入口
```

底部终端新增与侧栏一致的吸附迟滞，避免临界点抖动。v0.0.38 起重新展开入口统一由常驻 Workbench Chrome 承载。

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

- Web Workbench Chrome 独立于左 / 中 / 右栏并横跨页面全宽；
- 左栏 / 终端 / 右栏三枚框架级按钮常驻，不再依赖 hover 显隐；
- 侧栏内部不存在重复的框架级开合按钮；
- 收起状态不存在左右边缘 / 底部 hover 恢复入口；
- 分隔条仍不存在点击按钮，吸附后仍禁止反向拖开；
- 底部面板仍位于三栏 Grid 第二行并跨中间 + 右栏；
- Vite terminal bridge 继续使用真实 `node-pty`；
- Vite 仍绑定 `127.0.0.1`；
- Governance / Import / Development Log / Docs Structure Check 通过。

真实视觉位置与 PTY 交互仍需用户 Windows 浏览器环境执行 `LFAA-Setup.bat → 2` 实机验证。

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
| #21.7 | delivered | `active/0021-Web工作台UI.md` |
| #21.8 | delivered | `active/0021-Web工作台UI.md` |
| #21.9 | active | `active/0021-Web工作台UI.md` |
