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

```text
>=1240px      Desktop：三栏 Dock
760~1239px    Compact：左栏 Dock + 右栏 Drawer
<760px        Mobile：主区全宽 + 左右 Drawer
```

`AgentWorkbench.tsx` 负责“什么时候进入哪种布局模式”和“按钮归属在哪里”。

真正的拖拽尺寸、Pointer Capture、min 吸附收起在：

`packages/ui/src/workbench/`
