# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell`

## 任务目标

实现可通过 Vite 本地启动、可供 Web / Desktop 复用的三栏工作台 UI，作为 Config UI、Agent UI 和 `.lfaa` 热插拔验证壳。

## 当前交互事实

### 三栏

- 左栏：导航 / 项目 / 会话；
- 中间：工作区 / 对话 / Composer；
- 右栏：工具 / 运行状态 / 项目资源；
- 左右分隔条只负责拖拽；
- 到达最小宽度立即自动吸附；
- 同一次拖拽反向拉回使用迟滞避免抖动；
- Pointer Up 完成吸附后，separator 禁止反向拖开。

### Web 页面顶栏

页面顶栏只保留：

```text
Web 工作台标题
更多
分享
```

Shell 开合按钮不再放在顶栏。

### 中间主区 Shell Actions

```text
中间主区左上角
→ 左栏按钮

中间主区右上角
→ 终端按钮
→ 右栏按钮
```

左栏按钮有两种不同交互：

```text
Hover / Focus（仅左栏已收起）
→ 临时淡入左栏内容预览
→ 不修改 leftCollapsed

Click / Ctrl+B
→ 正式改变 leftCollapsed
→ 展开 / 收起 Grid 左栏
```

右侧保持显式控制：

```text
Ctrl+J
→ 终端

Ctrl+Alt+B
→ 右栏
```

右栏禁止 Hover 自动展开。

### 真实终端

底部终端必须位于工作区最底部：

```text
左侧栏保持全高
中间 + 右侧区域底部
→ Terminal Dock
```

Web 本地开发终端：

```text
xterm.js
↓
Vite HMR custom events
↓
node-pty
↓
PowerShell / 系统 Shell
```

禁止模拟日志冒充终端。

## 允许修改

- `packages/ui`
- `packages/app-shell`
- `apps/web`
- Vite 开发桥接
- UI / Security / Testing / Readability 文档

## 禁止修改

- Agent Loop
- Tool Runtime
- Permission Engine
- 正式 Rust Broker / Rust PTY Broker
- Config Storage
- Secret Store
- Knowledge
- Plugin Runtime 正式实现

## 状态所有权

- 左右栏正式 collapsed 状态：`AgentWorkbench` Shell 状态；
- 左栏 Hover Preview：`AgentWorkbench` 临时 UI 状态；
- 侧栏宽度 / 底栏高度：`ResizableWorkbench` 几何状态；
- 终端显隐：`AgentWorkbench` Shell 状态；
- Web 终端 PTY 进程：Vite 本地开发桥接；
- 正式 Desktop / Agent PTY：未来 Rust Native Core；
- `.lfaa` 资源快照：Vite 只读开发桥接。

## 安全边界

开发终端属于人类直接交互，不属于 Agent Tool。

必须：

- 绑定 `127.0.0.1`；
- 默认 cwd 为项目根；
- 不自动提升权限；
- 不读取 / 注入 Secret；
- 页面 / Vite 关闭时回收 PTY；
- 不作为 Agent 绕过 Policy / Permission 的执行路径。

## 性能要求

- 侧栏拖拽使用 `requestAnimationFrame`；
- 吸附 150ms - 220ms；
- 左栏 Preview 使用 opacity / transform 淡入淡出，不改变 Grid；
- Terminal resize 使用 `ResizeObserver` + xterm FitAddon；
- UI 主线程不执行阻塞系统调用。

## 验收条件

- 页面顶栏只保留标题 / 更多 / 分享；
- 左栏按钮位于中间主区左上角；
- 终端 / 右栏按钮位于中间主区右上角；
- 左栏收起时 hover 可临时预览，离开后淡出；
- Hover Preview 不修改正式 collapsed 状态；
- 点击 / `Ctrl+B` 正式开合左栏；
- 右栏不做 Hover 自动展开；
- `Ctrl+J` 控制终端；
- `Ctrl+Alt+B` 控制右栏；
- 左右侧栏拖拽 / 吸附正常；
- 吸附完成后不能从 separator 反向拖开；
- 底部 Terminal Dock 可拉高 / 拉低 / 吸附收起；
- Web Terminal 可以真正输入 PowerShell 命令并看到输出；
- `.lfaa` 热插拔继续可用；
- 关键实现文件注释与 UI 文档同步。

## 当前状态

`active / pending-test`
