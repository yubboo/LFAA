# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell / ui-workbench`

## 当前任务目标

在 v0.0.44 的 Header / Tooltip 基线上，修复窄屏布局崩溃、Shell 控件在覆盖式侧栏中不可见、三向拖拽吸附过硬的问题，并把响应式与拖拽状态机升级为当前正式方案。

## 当前交互事实

### 1. 三档响应式

```text
Desktop >= 1180px
→ 左 / 中 / 右 Dock 布局
→ 右栏展开时 Shell Actions 位于 Right Header

Compact 760 ~ 1179px
→ 左栏保持 Dock
→ 右栏改为覆盖式 Drawer
→ Shell Actions 始终留在 Center Header，保证关闭入口可见

Mobile < 760px
→ 中间主区全宽
→ 左右栏都改为覆盖式 Drawer
→ 默认收起左右栏与底部终端
→ Header 中始终保留左栏 / 终端 / 右栏三个核心入口
```

### 2. Tooltip

- 左栏 Tooltip 从按钮左边界向右展开；
- 右侧两个 Tooltip 从按钮右边界向左展开；
- 禁止原生 `title` 与自定义 Tooltip 共存；
- Mobile 下不依赖 Hover Tooltip 作为必要入口。

### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ Pointer Capture
→ 正常跟手拖拽
→ min 以下进入弹性磁区
→ 靠近边缘才标记 snapped
→ 鼠标仍按住时可以反向拖回 min
→ 回到 min 即退出 snapped
→ 继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交收起。

Pointer Up 完成收起后，separator 禁止重新展开，只能通过显式按钮或快捷键重新打开。

### 4. 动画手感

- Pointer Move 阶段禁止 CSS transition 追赶鼠标；
- 吸附提交 / 按钮展开使用统一 ease-out；
- 不允许从 `min` 硬跳到 `0`；
- 展开/收起要平滑，但不能拖泥带水。

## 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- UI 契约门禁
- UI / Testing / Development Log / Plan / Progress / Changelog / Release 文档

## 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

## 验收条件

- Desktop / Compact / Mobile 三档结构明确；
- 小窗口不再出现右栏占 80%+ 宽度导致主区消失；
- 右栏覆盖模式下关闭按钮始终可见；
- Mobile 中间主区保持完整可用；
- 左 / 右 / 底部三向拖拽都支持“按住时吸附后反向拖回 min”；
- 松手确认收起后不能从 separator 反向展开；
- 拖拽过程中无 transition 追鼠标造成的卡顿；
- Tooltip 不被左右边缘裁切；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 保持；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

## 当前状态

`active / pending-windows-visual-test`
