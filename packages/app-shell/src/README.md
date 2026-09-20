# app-shell/src 代码导航

```text
AgentWorkbench.tsx
→ Composition Root：Shell 状态 / Host / Snapshot / 区域装配

workbench/
├─ left/LeftSidebarRegion.tsx
│  └─ ProfileBar.tsx
├─ center/CenterWorkspaceRegion.tsx
│  ├─ CenterHeader.tsx
│  ├─ ConversationRegion.tsx
│  └─ ComposerRegion.tsx
│     └─ RuntimeControl.tsx
├─ right/RightSidebarRegion.tsx
├─ terminal/BottomTerminalRegion.tsx
├─ shell/ShellHeaderButton.tsx + RightShellActions.tsx
└─ contracts.ts

agent-workbench.css
→ 当前工作台视觉合同；#21.22 结构重构期间保持不变

WorkbenchIcon.tsx
→ 工作台 SVG 图标库

workbench.types.ts
→ App Shell 对宿主暴露的数据类型

index.ts
→ @lfaa/app-shell 公共导出
```

## 当前响应式

`AgentWorkbench.tsx` 不再自己维护 1240 / 760 断点，也不再保存固定侧栏 Limits。

当前链路：

```text
.agent-workbench-stage
→ ResizeObserver
→ @lfaa/ui resolveWorkbenchLayoutMetrics(width, height)
→ Desktop / Compact / Mobile
```

模式语义：

```text
Desktop  = 容器实际能容纳左 + 中 + 右 → 双 Dock
Compact  = 左 Dock + 右 Overlay
Mobile   = 中间主区全宽 + 左右 Overlay
```

`AgentWorkbench.tsx` 只负责 Shell 跨区域状态、按钮归属和容器测量；区域内部 UI 进入 `workbench/*`。

真正的比例 / floor / ceiling / min / max / snap hysteresis 在：

`packages/ui/src/workbench/workbench-layout.config.ts`

真正的 Pointer / Resize / Snap 在：

`packages/ui/src/workbench/ResizableWorkbench.tsx`

## 左栏 Hover 宽度

v0.0.48 起 Hover Preview 不再自己计算宽度，而是接收 `ResizableWorkbench` 当前真实 `leftWidth`，通过 `--agent-left-preview-width` 渲染；点击正式展开使用同一个值。
