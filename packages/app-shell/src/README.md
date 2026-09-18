# app-shell/src 代码导航

```text
AgentWorkbench.tsx
→ 工作台 Shell 总装配
→ 左栏 / 中间 / 右栏 / 底部终端
→ Shell 状态、快捷键、左栏 Hover 预览

agent-workbench.css
→ 上述各内容盒子的视觉样式
→ 不管三栏拖拽几何

WorkbenchIcon.tsx
→ 工作台 SVG 图标库

workbench.types.ts
→ App Shell 对宿主暴露的数据类型

index.ts
→ @lfaa/app-shell 公共导出
```

布局拖拽和吸附不在这里，在：

`packages/ui/src/workbench/`
