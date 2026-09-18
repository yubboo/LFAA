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
- 反向拖回使用迟滞避免抖动。

### 侧栏 Hover 控制

```text
鼠标进入左侧栏
→ 左侧栏自己的收起按钮淡入

鼠标进入右侧栏
→ 右侧栏自己的终端 / 收起按钮淡入
```

侧栏收起后，只允许在对应屏幕边缘保留重新展开热点。

禁止把左右栏控制按钮放在中间顶部区域冒充侧栏控件。

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
- Hover 控件淡入淡出；
- Terminal resize 使用 `ResizeObserver` + xterm FitAddon；
- UI 主线程不执行阻塞系统调用。

## 验收条件

- 左右侧栏 Hover 控件位置正确；
- 分隔条点击冲突消失；
- 左右侧栏拖拽 / 吸附丝滑；
- 底部 Terminal Dock 位置与 Codex 类工作区一致；
- Terminal Dock 可拉高 / 拉低；
- Web Terminal 可以真正输入 PowerShell 命令并看到输出；
- 终端不是模拟文本；
- `.lfaa` 热插拔继续可用；
- 文档日志同步。

## 当前状态

`active / pending-test`
