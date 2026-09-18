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

### 框架级常驻控制

左栏 / 终端 / 右栏开合属于 Workbench Shell，不属于侧栏内容。

桌面端：

```text
原生标题栏 / App Chrome
→ 左栏 / 终端 / 右栏常驻按钮
```

Web 端没有原生应用菜单栏，因此必须由页面自身提供全宽顶栏：

```text
┌──────────────── Web Workbench Chrome ────────────────┐
│ [左栏] Web 工作台                    [终端] [右栏] … │
└──────────────────────────────────────────────────────┘
```

要求：

- 左栏按钮固定在 Web 顶栏最左侧；
- 终端 / 右栏按钮固定在 Web 顶栏右侧；
- 按钮始终可见，禁止 hover 才出现；
- 左 / 右栏展开与收起时，框架级按钮位置不能跳动；
- 左右侧栏内部禁止重复放相同的壳层开合按钮；
- 收起状态禁止依赖屏幕边缘 hover 热点重新展开；
- 快捷键可作为额外显式命令，但不能代替可见按钮。

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
- UI / Security / Testing 文档

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

- 侧栏宽度 / 收起：UI 本地状态；
- 终端显隐 / 高度：UI 本地状态；
- Web 顶栏 Shell Actions：UI 本地状态；
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
- 顶栏按钮不使用 hover 显隐动画，只保留普通 hover 反馈；
- Terminal resize 使用 `ResizeObserver` + xterm FitAddon；
- UI 主线程不执行阻塞系统调用。

## 验收条件

- Web 顶栏横跨整个工作台宽度，不属于任意可收起栏位；
- 左栏开合按钮常驻左上角；
- 终端 / 右栏开合按钮常驻右上角；
- 三枚壳层按钮不需要鼠标移入才出现；
- 左右侧栏内部无重复 hover 开合按钮；
- 分隔条点击冲突消失；
- 左右侧栏拖拽 / 吸附丝滑；
- 吸附完成后不能从 separator 反向拖开；
- 底部 Terminal Dock 可拉高 / 拉低 / 吸附收起；
- Web Terminal 可以真正输入 PowerShell 命令并看到输出；
- `.lfaa` 热插拔继续可用；
- 文档日志同步。

## 当前状态

`active / pending-test`
