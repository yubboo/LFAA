# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell / ui-workbench`

## 当前任务目标

以 v0.0.48 为历史基线，调整 Composer 垂直落点。输入框不应贴近窗口底边；底部间距必须变量化并按 Desktop / Compact / Mobile 响应，不允许通过散落的固定 `margin-bottom` 或 absolute 定位硬抬。

## 当前实现要求

### 1. 单一底部间距变量

```text
--agent-composer-bottom-gap
→ .agent-composer-wrap
→ max(variable, safe-area-inset-bottom)
```

### 2. 响应式取值

- Desktop 使用 `clamp()` + `vh`，适度抬高 Composer；
- Compact 减小留白，避免短窗口浪费高度；
- Mobile 保留较小固定 rem，并尊重 safe area；
- 不新增第二套 Composer bottom 数值来源。

### 3. 保持现有行为

- Hover / Click 左栏宽度统一不回退；
- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

## 允许修改

- `packages/app-shell/src/agent-workbench.css`；
- `scripts/ui-contract-check.mjs`；
- 当前 UI 文档、测试、Plan / Progress / Development Log / Changelog / Release / Version。

## 验收条件

- Desktop 输入框下方留白明显比 v0.0.48 更舒适；
- Compact / Mobile 不因固定大间距浪费高度；
- safe-area 仍然生效；
- 不用 absolute / transform 假移动 Composer；
- UI contract 能阻止固定底部 padding 回归；
- 基础设施和 PTY 不变。

## 当前状态

`active / pending-windows-visual-test`
