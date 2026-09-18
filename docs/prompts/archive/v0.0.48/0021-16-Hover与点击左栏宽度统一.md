# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell / ui-workbench`

## 当前任务目标

以 v0.0.47 为历史基线，修复左栏 Hover Preview 与点击正式展开宽度不一致的问题。两种展示必须共享同一个实际左栏宽度事实源，不能再分别用 CSS clamp 和 ResizableWorkbench 内部 width 两套值。

## 当前实现要求

### 1. 单一宽度事实源

```text
ResizableWorkbench.leftWidth
→ onLeftWidthChange(width)
→ AgentWorkbench.leftPaneWidth
→ --agent-left-preview-width
→ Hover Preview
```

正式 Dock 和 Hover Preview 必须使用同一个 width。

### 2. 默认与用户调整后都一致

- 初次打开：Preview = 当前响应式 `left.initial`；
- 用户拖过左栏后：Preview = 用户最后真实左栏宽度；
- 容器缩小时：Preview 跟随重新 clamp 后的真实宽度；
- collapsed 状态 Hover 不得维护第二套 `clamp()` 宽度。

### 3. 保持现有行为

- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

## 允许修改

- `AgentWorkbench.tsx`；
- `agent-workbench.css`；
- `ResizableWorkbench.tsx`；
- `workbench-layout.types.ts`；
- UI contract；
- 当前 UI 文档、测试、代码地图、Plan / Progress / Development Log / Changelog / Release / Version。

## 验收条件

- Hover Preview 与点击展开后的左栏宽度视觉一致；
- 用户手动 resize 后再次 collapsed，Hover Preview 仍与下一次 click 展开宽度一致；
- CSS 不再存在独立 `--agent-left-preview-width: clamp(...)`；
- UI contract 能阻止第二套 Preview 宽度回归；
- 基础设施和 PTY 不变。

## 当前状态

`active / pending-windows-visual-test`
