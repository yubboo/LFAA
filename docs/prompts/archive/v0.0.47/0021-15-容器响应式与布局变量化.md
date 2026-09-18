# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell / ui-workbench`

## 当前任务目标

以 v0.0.46 为历史基线，修正固定侧栏宽度与固定 viewport 断点导致的小窗口布局崩溃。布局必须更接近 ChatGPT / Codex 的“主区优先 + 侧栏按空间自动 Dock/Overlay”行为，并把几何配置集中为可维护变量和计算公式。

## 当前实现要求

### 1. 单一布局变量源

禁止在 `AgentWorkbench.tsx` 继续出现：

```text
LEFT_LIMITS
RIGHT_LIMITS
BOTTOM_LIMITS
```

统一使用：

```text
packages/ui/src/workbench/workbench-layout.config.ts
```

其中必须集中维护：

- ratio；
- floor；
- ceiling；
- center 保护；
- separator；
- snap hysteresis。

### 2. 容器响应式

不以 `window.innerWidth < 某固定值` 决定工作台模式。

必须：

```text
agent-workbench-stage
→ ResizeObserver
→ resolveWorkbenchLayoutMetrics(rect.width, rect.height)
→ Desktop / Compact / Mobile
```

### 3. 当前几何目标

当前动态安全范围：

```text
左栏 min 约 196~232
右栏 min 约 228~288
Bottom min 约 136~176
```

实际值必须由容器计算，不能直接作为业务固定宽度使用。

### 4. 模式语义

```text
Desktop：容器真正放得下 left + center + right 才双 Dock
Compact：左 Dock + 右 Overlay
Mobile：左右 Overlay + 主区全宽
```

右 Overlay 不能再把主区挤小；Overlay 宽度必须通过 CSS 变量 + `clamp()` / 百分比计算。

### 5. 三向吸附

左 / 右 / Bottom 继续统一：

```text
正常 Resize
→ 到动态 min
→ snap preview 收到 0
→ Pointer 仍按住可反向越过 hysteresis 恢复
→ Pointer Up 仍 snapped 才正式 collapsed
```

正式 collapsed 后 separator 不能拖开，只能通过：

```text
Ctrl+B
Ctrl+J
Ctrl+Alt+B
```

或 Header 对应按钮恢复。

### 6. 动画

- 普通 resize：transition:none，跟手；
- snap preview：短磁吸过渡；
- 正式按钮开合：ease-out；
- 不允许以 min 以下尺寸继续渲染残缺侧栏。

## 允许修改

- App Shell / UI Workbench 当前实现；
- 布局 config / types / exports；
- UI contract；
- UI Standard / Test / Code Map / README；
- Prompt / Plan / Progress / Development Log / Changelog / Release / Version。

## 禁止修改

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY 协议 / node-pty bridge；
- Agent Runtime / Permission / Config / Rust Native 边界。

## 验收条件

- 950px 左右窗口不再同时被大左栏 + 大右栏挤压；
- 1024px 左右在容器允许时可维持合理双 Dock；
- 760~950px 右栏变 Overlay，中央主区不变窄；
- <680px 左右栏都 Overlay；
- 侧栏最小宽度明显小于 v0.0.46 的 280 / 360，但仍足够阅读；
- 历史持久化宽度会随容器重新 clamp；
- CSS 尺寸由变量 / rem / clamp / calc 维护；
- 三向吸附行为不回退；
- Windows 脚本与 PTY 不变；
- 所有当前事实源同步更新。

## 当前状态

`active / pending-windows-visual-test`
