# 真实终端 + 右侧/底部双位置方案

- 状态：D1–D5 已按推荐方案批准；S1（Host PTY）+ S2（右侧终端）已实施并实测（DEV-000598），S3（底部面板 + 位置切换）待做
- 日期：2026-11-26（Asia/Shanghai）
- 提出人：负责人（参考 VS Code 集成终端：右栏展示与底部面板两种形态，可切换，默认右侧）
- 涉及包：`packages/host/terminal`（新增）、`packages/client/ui-terminal`（新增）、`packages/ui/layout`、`packages/client/ui-chat`、`packages/host/web-server`、`packages/bundle/web`

## 1. 现状与差距

| 项 | 现在 | 差距 |
|---|---|---|
| 「终端」入口 | 右栏工作台里的「终端与后台任务」标签 | 它其实是**后台任务执行器**（`packages/core/jobs` 的 `BackgroundJobManager`）：一次性 `spawn` 一条命令、只回读 stdout/stderr，没有 stdin、没有 TTY |
| 交互 | 输入一条命令 + 点「运行」，输出是只读日志 | 不能 `cd`、不能交互、没有提示符、光标/颜色/TUI 全都不支持 |
| 形态 | 只能待在右栏 | 没有底部面板，也没有位置切换 |

结论：要「真实终端」，必须补一层 **PTY + 双向流**，再把「右栏 / 底部」做成两种展示位置；现有 jobs 面板保留并改名为「后台任务」，两者并列而不是互相冒充。

## 2. 调研与参考

- 本轮 `web_fetch` 取不到外部页面（DSH fetch 端点 404），所以下面列的是**候选依赖的官方地址**，尚未在线核对版本与许可；实施前逐项核对（版本、许可、Windows 预编译、维护活跃度）并把结果补进本条。
  - `node-pty`（微软，VS Code 集成终端底层）：https://github.com/microsoft/node-pty —— Windows 上用 ConPTY，提供真 PTY、窗口尺寸与 ANSI。
  - `@xterm/xterm` + `@xterm/addon-fit`（终端模拟器前端）：https://github.com/xtermjs/xterm.js —— ANSI/光标/TUI 渲染、`fit` 负责随容器尺寸算行列。
  - `ws`（Node WebSocket 服务端）：https://github.com/websockets/ws —— 双向低延迟传输；备选是「SSE 出 + POST 入」（见 D2）。
- 仓库内可复用的既有实现（已读代码确认）：
  - `packages/core/jobs/src/job-manager.ts`：进程树终止（Windows `taskkill /T /F`）、有界输出缓冲、`formatCommandOutput` 的中文编码处理（GBK/UTF-8）——终端输出解码直接沿用它。
  - `packages/core/browser/src/http-handler.ts`、`packages/core/agent/src/http-handler.ts`：SSE 推送与 `/api` 路由注册方式。
  - `packages/host/web-server/src/static-server.ts`：`node:http` 的 `createServer` 就在这儿，WS 的 `upgrade` 钩子挂这里；`@lfaa/api-gateway` 的 `checkApiAuth` 负责一次性令牌校验。
  - `packages/ui/layout`：四栏栅格、`CollapsePane`、面板拖宽（`useSidebarResize`/`SidebarResizeHandle`）、偏好读写（`ui-preferences.ts`）——底部面板的拖高与折叠直接复用同一套手法。
- 结论：PTY/终端模拟器属于「轮子已经非常成熟」的领域，不自研 PTY，也不自研 ANSI 渲染；布局与传输按本仓库既有模式适配。

## 3. 方案

### 3.1 架构

```
浏览器（ui-terminal，xterm.js）
   │  WS /api/terminal?sessionId=…&token=…（或 SSE+POST，见 D2）
   ▼
Host（host/terminal）
   ├─ TerminalSessionManager：按 sessionId 维护 PTY 进程、窗口尺寸、订阅者
   ├─ node-pty：shell 白名单（powershell / pwsh / cmd / bash）、cwd = 项目根或会话工作树
   └─ 生命周期：会话关闭 / 插件卸载 / Host 退出都要 kill 进程树（复用 taskkill 逻辑）
```

- 输出解码沿用 `formatCommandOutput` 的编码探测，避免 PowerShell 中文乱码。
- 安全：只监听本机 + 令牌校验；shell 与 cwd 都走白名单/归一化，不接受前端传任意命令或环境变量；单会话最多 N 个终端（默认 4）。

### 3.2 两种展示位置

| 位置 | 形态 | 说明 |
|---|---|---|
| 右侧（默认） | 右栏工作台里的「终端」标签页 | 与现在的 jobs 标签并列，复用 `RightWorkbenchPane` 的舞台与标签栏 |
| 底部 | 横跨「中间 + 右侧」两列的底部面板 | 不压左一/左二；顶栏是标签条（终端 / 后台任务），右侧有「×」收起与拖高 |

- 切换入口：终端标题栏右侧一枚「移到下方 / 移到右栏」按钮＋设置中心「终端 → 展示位置」；两者读写同一偏好 `lfaa:terminal-placement`（默认 `right`）。
- 两种排版（聊天区在左 / 预览区在左）下，底部面板都在同一位置：`grid-row: 2`，跨第 3、4 列；高度偏好 `lfaa:bottom-panel-height`（默认 260px，范围 160–560），折叠状态 `lfaa:bottom-panel-open`。
- 底部面板的标签集合固定为「终端 / 后台任务」，切换标签不销毁 PTY（面板收起时才让出可视区，进程保留在 Host）。

### 3.3 协议（草案）

| 方向 | 消息 |
|---|---|
| C→S | `{ t: "open", sessionId, cwd, cols, rows }` / `{ t: "data", data }` / `{ t: "resize", cols, rows }` / `{ t: "kill" }` |
| S→C | `{ t: "ready", title }` / `{ t: "data", data }` / `{ t: "exit", code }` / `{ t: "error", message }` |

- 二进制分帧优先传纯文本帧，粘贴大段内容时按 8KB 切片；Host 侧做背压（队列上限后丢弃并提示，不阻塞 PTY）。

### 3.4 分步实施

1. **S1 Host PTY（已完成，DEV-000598）**：新增 `packages/host/terminal`（会话管理 + WS 路由 + 协议 + 单测：spawn 一个 `echo` 与 `cd` 往返、resize、kill 后无残留进程）。
2. **S2 右侧终端（已完成，DEV-000598）**：新增 `packages/client/ui-terminal`（xterm 渲染、输入、resize、复制/粘贴、清屏、结束会话）；右栏新增「终端」标签，现有「终端与后台任务」改名为「后台任务」。
3. **S3 底部面板（待做）**：`packages/ui/layout` 增加底部区域（拖高、收起、偏好），两种排版都适配；接入同一终端组件；加位置切换按钮与设置行。
4. **S4 收尾**：字号/字体设置、Shell 选择、多终端标签（可放 v2）、浅色/深色主题适配、`verify:web` 覆盖。

## 4. 需要负责人确认的决定

- **D1 PTY 依赖**：用 `node-pty`（真 PTY，Windows ConPTY，需原生模块；桌面端打包要 rebuild）还是先用「无 TTY 的 `spawn` + xterm」（不加原生依赖，但 `PSReadLine`、颜色、vim 之类 TUI 会退化）？推荐 `node-pty`。
- **D2 传输**：新增 `ws` 依赖走 WebSocket（延迟最低、按键即发）还是沿用「SSE 出 + POST 入」（不加依赖，按键需批量上报）？推荐 `ws`。
- **D3 底部面板范围**：横跨「中间 + 右侧」两列（推荐，和 VS Code 一致，不压左侧导航）还是只覆盖中间列？
- **D4 现有面板**：把「终端与后台任务」改名为「后台任务」，与新的「终端」并列，可以吗？
- **D5 终端数量**：v1 先单终端（一个 PTY，两处位置共享同一会话），多标签放 S4/下一轮，可以吗？

## 5. 验收标准

- 右侧与底部两种形态都能跑真实命令：`cd`、`git status`、`pnpm ls --version`、Ctrl+C 中断、清屏、拖大窗口后行列自适应。
- 中文输出不乱码；ANSI 颜色正常；浅色/深色主题下可读。
- 位置、高度、折叠状态刷新后保持；切换位置时同一 PTY 不断线。
- 关闭标签/收起面板/切换会话后进程被回收（任务管理器无残留 `powershell.exe`）。
- `pnpm check`、`lint`、`typecheck`、`test`、`verify:web` 全绿；移动端（<1024px）回退「右侧」位置，底部面板不出现。

## 6. 风险

- **原生依赖**：`node-pty` 需要编译/预编译；Electron 桌面端要 `electron-rebuild`，否则打包后加载失败。回退路径：`spawn` 模式（协议不变，功能降级）。
- **进程泄漏**：PTY 不随页面关闭自动消失，必须有会话级回收（Host 侧定时清理 + 插件卸载钩子）。
- **安全**：终端等于本机 shell 权限；仅本机监听、令牌校验、shell 白名单、cwd 限项目根，不做远程访问。
- **体积**：xterm + 字体约几百 KB，按需动态加载，不进首屏。
- **窗口尺寸抖动**：底部拖高与右栏拖宽同时改时，xterm 的 `fit` 要做防抖，否则行列频繁重算。
## 7. 底部终端的位置约束（负责人 2026-11-26 确认）

- **底部终端始终跟着「预览区/工作台」那一列走**：预览区在哪一列，终端就贴在那一列的底部；预览区在左时也是它自己那条列的下方，不跨到聊天列。
- 因此底部面板**不能作为 Shell 栅格的第五个子项**（会多出一行、逼着各列跨行，猜错就露背景形成「洞」，负责人称「盒子污染」）。
- 正确结构：把底部面板渲染进「工作台/预览列」的容器内部（该容器纵向 flex：上面是工作台内容，下面是终端面板）；Shell 的四列栅格与行高完全不参与。
- 分割线与拖拽复用左右栏那套 `SidebarResizeHandle` + `useSidebarResize` 的反向实现，样式/热区/手感与其他面板一致；高度写入 `lfaa:bottom-panel-height`。
- 落地前先移除现在这套 `[data-bottom-open]` 栅格补丁（`nth-child` 跨行、`grid-column: 4`）与 Shell 级 `<ShellBottomDock>`。
## 8. 舞台容器拆分（下一步，负责人已同意；不做会话隔离）

- 目标：`packages/client/ui-chat/client/workbench/RightWorkbenchPane.tsx`（约 396 行）按职责拆成区域文件，减少与其他并发会话的写冲突。
- 拆分方案（保持单向依赖：pane/index 组装，区域文件不反向 import 入口）：
  1. `pane/pane-tab-props.ts`：`usePaneTabProps()`，产出 `<WorkbenchTopBar tabProps>` 的对象（标签选择/关闭/浏览器/审查/子智能体回调）。
  2. `pane/pane-action-props.ts`：`usePaneActionProps()`，产出 `actionProps`（顶栏动作、最大化/收起、扩展入口）。
  3. `pane/PaneAuxBody.tsx`：把 `renderAuxBody` 的 props 组装搬出（locale/store/sessionId/boundProjectId/…/workbench），pane 只传一个 `auxBodyProps` 对象。
  4. `pane/PaneStage.tsx`：主舞台 + 底部终端槽（`TerminalDockPane`）。
- 验收：`tsc` 无错、`pnpm check` 绿（每文件 ≤400 行）、内置浏览器实测：图标轨 14 项、终端标签可开可关、底部终端可拖可关、两标签并存时不回流。
- 注意：不改 `WorkbenchShell`、`WorkbenchTopBar` 的公开签名；`WorkbenchTopBar` 的 `tabProps/actionProps` 仍是对象字面量。