# ui/workbench 代码导航

```text
workbench-layout.config.ts
→ Workbench 几何的单一变量源
→ ratio / floor / ceiling
→ 根据容器宽高计算 left/right/bottom limits
→ 计算 center protection / snap hysteresis
→ 自动决定 Desktop / Compact / Mobile

ResizableWorkbench.tsx
→ 三栏 + Bottom Dock 几何状态
→ Pointer Capture / Resize
→ 动态最大宽度
→ 历史持久化宽度随容器重新 clamp
→ 左 / 右 / Bottom 到动态 min 吸附收起
→ Pointer 按住时可从 snap capture 反向拖回 min
→ Pointer Up 后提交 collapsed/open 受控接口

workbench.css
→ Desktop 五列两行 Grid
→ Compact 左 Dock + 右 Overlay
→ Mobile 双 Overlay
→ CSS 变量 / clamp() / calc()
→ separator / collapsed / snap preview 动画
→ 拖拽期间关闭 transition，保证 Pointer 跟手

workbench-layout.types.ts
→ 公开 Props / Limits / LayoutMode 类型
```

## 为什么还会看到 CSS px

PointerEvent 的 `clientX/clientY` 和 `getBoundingClientRect()` 本身返回 CSS px，因此拖拽计算最终必须落到 CSS px。

区别是 v0.0.47 不再把 `280 / 360` 当成业务固定答案，而是：

```text
容器宽高 × ratio
→ floor / ceiling
→ 当前 min / initial / max
```

当前参考动态范围：

```text
左 min：196~232
右 min：228~288
Bottom min：136~176
```

## 吸附状态机

```text
正常拖拽
→ 到达当前动态 min
→ snap capture / 收起预览吸到 0
→ 不松手反向拉到 min + hysteresis
→ 恢复到 min 并继续拉伸
→ Pointer Up 时若仍 snapped 才真正收起
```

正式收起后 separator 不负责重新展开；必须由 App Shell 的显式按钮或快捷键打开。

这里是**纯 Layout**，不知道左栏里是什么业务内容，也不决定 Header 按钮放在哪里。

App Shell 内容与状态：

`packages/app-shell/src/AgentWorkbench.tsx`
