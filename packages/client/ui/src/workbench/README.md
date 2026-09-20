# ui/workbench 代码导航

```text
workbench-layout.config.ts
→ Workbench 几何的单一变量源
→ ratio / floor / ceiling
→ 根据容器宽高计算 left/right/bottom limits
→ 计算 center protection / snap capture ratio / release hysteresis
→ 自动决定 Desktop / Compact / Mobile

ResizableWorkbench.tsx
→ 三栏 + Bottom Dock 几何状态
→ Pointer Capture / Resize
→ 动态最大宽度
→ 历史持久化宽度随容器重新 clamp
→ 左 / 右 / Bottom 到动态 min 吸附收起
→ min 后进入防误触区，达到 capture threshold 才吸附；Pointer 按住时仍可从 snap capture 反向拖回 min
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
→ min 只是正常可用下限；继续拖到 min × captureRatio 才 snap capture / 吸到 0
→ 未达到 capture threshold 松手恢复 min；已 capture 时不松手反向拉到 min + hysteresis
→ 恢复到 min 并继续拉伸
→ Pointer Up 时若仍 snapped 才真正收起
```

正式收起后 separator 不负责重新展开；必须由 App Shell 的显式按钮或快捷键打开。

这里是**纯 Layout**，不知道左栏里是什么业务内容，也不决定 Header 按钮放在哪里。

App Shell 内容与状态：

`packages/client/app-shell/src/AgentWorkbench.tsx`

## v0.0.48 左栏宽度回传

`ResizableWorkbench` 通过 `onLeftWidthChange` 把当前真实左栏宽度交给 App Shell。该回调用于保证 Hover Preview 和正式 Dock 共用一个几何事实源，不允许 Preview 再维护独立 clamp 宽度。

## 单侧 Surface 复用

`ResizableWorkbench` 的 `right` 为可选插槽。Settings 等“左导航 + 内容区”Surface 直接省略右栏，从而复用同一套左栏 resize / snap / hysteresis / snap-release / 键盘控制和持久化，不允许复制第二套侧栏算法。

### 交互参数统一配置

`workbench-interaction.config.ts` 是 Workbench 拖拽手感的唯一默认参数入口：

- `snap.captureRatio`：默认 `0.50`。侧栏到 `minWidth` 后视觉宽度保持不变，Pointer 继续向内超拖；只有虚拟尺寸到 `minWidth × 50%`（等价于再超拖半个 `minWidth`）才正式吸附；
- `snap.releaseHysteresis`：已吸附后反向拉出需要越过的迟滞距离；
- `snap.captureDurationMs / releaseDurationMs / settleDurationMs`：吸附、反向释放、普通归位动画；
- `keyboard.stepPx / fastStepPx`：键盘 Resize 步长。

工作台、Settings 与后续复用 Surface 默认读取同一套参数；需要特殊手感时通过 `ResizableWorkbench` props 覆盖，不允许复制算法或在事件函数中写魔法数字。
