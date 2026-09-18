# ui/workbench 代码导航

```text
ResizableWorkbench.tsx
→ 三栏 + 底部 Dock 的几何逻辑
→ Pointer Capture / Resize
→ 动态最大宽度
→ 左 / 右 / Bottom 三向 min 吸附收起
→ Pointer 按住时可从 snap capture 反向拖回 min
→ Pointer Up 后提交 collapsed/open 受控接口

workbench.css
→ Desktop 五列两行 Grid
→ separator
→ collapsed 提交动画
→ Compact 右 Drawer
→ Mobile 左右 Drawer
→ 拖拽期间关闭 transition，保证 Pointer 跟手

workbench-layout.types.ts
→ 公开 Props / Limits 类型
```

## 吸附状态机

```text
正常拖拽
→ 到达 min
→ 立即进入 snap capture / 收起预览
→ 展开态不允许小于 min
→ 不松手反向拉到 min + hysteresis
→ 恢复到至少 min 并继续拉伸
→ Pointer Up 时若仍 snapped 才真正收起
```

正式收起后 separator 不负责重新展开；必须由 App Shell 的显式按钮或快捷键打开。当前 min：左栏 280px、右栏 360px、Bottom 180px。

这里是**纯 Layout**，不知道左栏里是什么业务内容，也不决定 Header 按钮放在哪里。

左栏 / 中间 / 右栏内容与响应式状态归属在：

`packages/app-shell/src/AgentWorkbench.tsx`
