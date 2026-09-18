# ui/workbench 代码导航

```text
ResizableWorkbench.tsx
→ 三栏 + 底部 Dock 的几何逻辑
→ Pointer Resize
→ 动态最大宽度
→ 三向吸附
→ collapsed/open 受控接口

workbench.css
→ 五列两行 Grid
→ separator
→ collapsed / snap 动画
→ 响应式浮层

workbench-layout.types.ts
→ 公开 Props / Limits 类型
```

这里是**纯 Layout**，不知道左栏里是什么业务内容。

左栏 / 中间 / 右栏内容在：

`packages/app-shell/src/AgentWorkbench.tsx`
