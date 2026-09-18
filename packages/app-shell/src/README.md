# app-shell/src 代码导航

```text
AgentWorkbench.tsx
→ 工作台 Shell 总装配
→ 左栏 / 中间 / 右栏 / 底部终端
→ Shell 状态、快捷键、左栏 Hover 预览
→ Desktop / Compact / Mobile LayoutMode
→ 决定 Shell Actions 在 Center Header 还是 Right Header

agent-workbench.css
→ 上述各内容盒子的视觉样式
→ Header / Tooltip / Drawer 内容 / Composer / Terminal 外壳
→ 不管 separator 的拖拽数学

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

`AgentWorkbench.tsx` 负责 Shell 状态、按钮归属和容器测量。

真正的比例 / floor / ceiling / min / max / snap hysteresis 在：

`packages/ui/src/workbench/workbench-layout.config.ts`

真正的 Pointer / Resize / Snap 在：

`packages/ui/src/workbench/ResizableWorkbench.tsx`
