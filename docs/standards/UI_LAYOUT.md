# LFAA 工作台 UI 规范

## 1. 当前原则：主区优先，不用固定断点硬挤三栏

v0.0.47 起，Workbench 不再以 `window.innerWidth < 1240 / 760` 决定布局，也不再把左栏 / 右栏写死成 280 / 360px。

响应式事实源：

```text
agent-workbench-stage 实际尺寸
→ ResizeObserver
→ resolveWorkbenchLayoutMetrics(width, height)
→ 计算 pane limits / center protection / snap hysteresis
→ 选择 Desktop / Compact / Mobile
```

这样浏览器小窗、桌面宿主、未来 Electron 内容区、DevTools 占宽都以“真正可用内容宽度”为准。

## 2. 单一几何配置源

文件：

```text
packages/ui/src/workbench/workbench-layout.config.ts
```

统一定义：

```text
left.min / initial / max
right.min / initial / max
bottom.min / initial / max
center.comfortable
separator
snapHysteresis
mobileGuard
```

每个尺寸规则由：

```text
ratio + floor + ceiling
```

组成。

解释：

- `ratio`：随容器变化；
- `floor`：防止过窄；
- `ceiling`：防止过宽；
- 最终 Pointer 几何使用 CSS px，因为 `clientX/clientY/getBoundingClientRect()` 本身就是 CSS px；
- 业务层禁止再复制一套固定侧栏宽度。

## 3. 当前参考尺寸

这只是公式输出示例，不是固定断点：

| 容器宽度 | Mode | 左栏 initial | 右栏 initial | 中央区保护 |
|---:|---|---:|---:|---:|
| 1600 | Desktop | ~288 | ~360 | ~720 |
| 1280 | Desktop | ~243 | ~307 | ~640 |
| 1100 | Desktop | ~216 | ~264 | ~550 |
| 1024 | Desktop | ~216 | ~252 | ~512 |
| 950 | Compact | ~216 | Overlay | ~475 |
| 820 | Compact | ~216 | Overlay | ~440 |
| 680 | Compact | ~216 | Overlay | ~422 |
| <680 左右 | Mobile | Overlay | Overlay | 主区全宽 |

当前动态 min 大致：

```text
左栏：196 ~ 232
右栏：228 ~ 288
Bottom：136 ~ 176（跟容器高度变化）
```

以后调整应修改布局 Token / 比例，不应在多个组件里逐个改 px。

## 4. 三种布局模式

### Desktop：双 Dock

只有容器实际能容纳：

```text
left.initial + center.comfortable + right.initial + separators
```

才进入 Desktop。

```text
┌────左 Dock────┬────────────Center────────────┬──右 Dock──┐
│ 导航 / 项目    │ Header / Conversation        │ Tools     │
│               │ Composer                     │ Resources │
│               ├───────────────────────────────┴───────────┤
│               │                 Bottom Terminal            │
└───────────────┴─────────────────────────────────────────────┘
```

### Compact：单 Dock + Overlay

容器放不下双 Dock，但仍能放下左栏 + 可用 Center：

```text
┌──左 Dock──┬──────────────────Center──────────────────┐
│           │ Header                                  │
│           │ Conversation             ┌─Right Overlay┐│
│           │ Composer                 │ Tools         ││
│           │                          └───────────────┘│
└───────────┴───────────────────────────────────────────┘
```

规则：

- 右栏不参与 Center 宽度计算；
- 右栏 Overlay 从 Header 下方出现；
- 终端 / 右栏关闭入口始终留在 Center Header；
- Overlay 使用 `clamp()` + 百分比，不得使用近乎全屏的固定 vw。

### Mobile：双 Overlay

容器连左 Dock + Center 都无法舒适容纳时：

```text
┌──────────────────Center 全宽──────────────────┐
│ Header                                        │
│ Conversation                                  │
│ Composer                                      │
│ 左 / 右 Overlay 由按钮显式打开               │
└───────────────────────────────────────────────┘
```

规则：

- 左右 separator 隐藏；
- 左右栏都不参与 Center 宽度；
- 默认进入时收起左右栏与 Bottom；
- 核心 Shell Actions 必须保留；
- 触摸设备不能依赖 Hover 作为唯一入口；
- 禁止整页横向滚动。

## 5. Header 层级

```text
CenterWorkspace
├─ var(--agent-shell-header-h)
├─ Conversation
└─ Composer

RightSidebar / Desktop
├─ var(--agent-shell-header-h)
└─ Right Body

RightSidebar / Compact / Mobile
└─ Right Body
```

Shell Actions 属于 Header，不允许 absolute 漂在正文上。

## 6. Shell 控制与 Tooltip

快捷键：

```text
Ctrl+B       左栏
Ctrl+J       Bottom Terminal
Ctrl+Alt+B   右栏
```

要求：

- 使用自定义 `.agent-shell-tooltip`；
- 禁止同一按钮再加原生 `title`；
- Tooltip `pointer-events:none`；
- 左侧按钮 start 对齐；
- 右侧按钮 end 对齐；
- Mobile 可隐藏 Tooltip，但按钮必须可点击并保留 `aria-label`。

## 7. 左栏 Hover Preview

Desktop / Compact 正式收起左栏后：

```text
Hover / Focus 左栏按钮
→ Preview 临时淡入
→ 不改变 leftCollapsed
→ 离开后短延迟淡出
```

正式开合仍由 Click / `Ctrl+B`。

Mobile 禁用 Hover Preview。

## 8. 三向 Resize 与“吸附收起”

左栏、右栏、Bottom 统一语义。

### Pointer 按住

```text
正常 Resize
→ 到当前动态 min
→ snap preview 吸到 0
```

如果仍然按住：

```text
snap preview
→ 反向拖动
→ 超过 min + snapHysteresis
→ 恢复到 min
→ 继续向外 Resize
```

### Pointer Up

只有松手时仍 snapped 才正式 collapsed。

正式 collapsed 后：

- separator 不能重新拖出；
- 必须用 Header 按钮 / 快捷键恢复。

## 9. 动画与拖拽手感

普通 Resize：

- `requestAnimationFrame` 合并 pointermove；
- 直接写 CSS 变量；
- `transition:none`；
- 不允许 transition 追逐鼠标。

进入 snap preview：

- 允许约 180ms 短磁吸；
- pane opacity / translate 与 Grid 同步；
- 不显示 min 以下残缺内容。

正式按钮开合：

- 使用约 240ms ease-out；
- 视觉过渡与布局过渡同步。

## 10. 持久化尺寸与小窗保护

localStorage 中保存的 pane width 不是绝对真值。

容器变小时必须：

```text
stored width
→ clamp(current min, current max)
→ clamp(dynamic max based on center protection)
```

Compact / Mobile Overlay 不应错误参与另一侧 Dock 的 dynamic max。

## 11. CSS 变量要求

App Shell 主要布局变量：

```text
--agent-shell-header-h
--agent-control-size
--agent-page-gutter
--agent-content-max
--agent-composer-max
--agent-left-preview-width
```

Workbench 主要布局变量：

```text
--lfaa-left-size
--lfaa-right-size
--lfaa-left-column
--lfaa-right-column
--lfaa-bottom-row
--lfaa-handle-width
--lfaa-overlay-left-width
--lfaa-overlay-right-width
--lfaa-mobile-pane-width
```

新增尺寸前先判断是否应该成为变量；不要在多处复制相同 px 常量。

## 12. 代码归属

```text
packages/ui/src/workbench/workbench-layout.config.ts
→ 响应式比例 / floor / ceiling / Mode 计算

packages/ui/src/workbench/ResizableWorkbench.tsx
→ Pointer / Resize / Snap / 几何状态 / 持久化宽度 clamp

packages/ui/src/workbench/workbench.css
→ Dock / Overlay / Grid / separator / snap 视觉

packages/app-shell/src/AgentWorkbench.tsx
→ Shell 状态 / ResizeObserver / Header 按钮归属 / Hover Preview

packages/app-shell/src/agent-workbench.css
→ Header / 内容 / Tooltip / Composer / 侧栏内容视觉
```

## 13. 实机响应式验收

至少验证工作台容器接近：

```text
1600x900
1280x800
1100x800
1024x768
950x800
820x900
760x900
680x800
640x800
390x844
```

每个尺寸检查：

- Center 是否仍可用；
- Mode 是否合理；
- 左右入口是否可见；
- Overlay 是否不会把主区挤窄；
- Composer 是否溢出；
- 三向 snap 是否保持；
- 无整页横向滚动。

## 11. Hover Preview 宽度单一事实源（v0.0.48）

左栏 Hover Preview 不允许维护独立宽度。必须使用正式 Dock 当前真实 `leftWidth`：`ResizableWorkbench → onLeftWidthChange → --agent-left-preview-width → Preview`。因此默认、用户 resize、响应式 clamp 后 Hover 与 Click 都必须一致。
