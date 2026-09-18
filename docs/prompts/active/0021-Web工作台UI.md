# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell`

## 当前任务目标

保持 #21.11 的 Header 联动布局，只修复 Shell Header 三个框架按钮的重复 Tooltip，并建立防回归门禁。

## 当前交互事实

### Header 布局

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

### Tooltip 单一来源

三个 Shell Header 按钮只允许：

```text
aria-label
+
.agent-shell-tooltip
```

禁止：

```text
title="..."
+
.agent-shell-tooltip
```

原因：浏览器原生 `title` 会在自定义 Tooltip 之后再次弹出第二层提示，造成重复黑框。

Tooltip 必须 `pointer-events:none`，不得抢鼠标 Hover / Click。

### 快捷键

- `Ctrl+B`：左栏正式开合；
- `Ctrl+J`：底部终端开合；
- `Ctrl+Alt+B`：右栏开合。

## 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- UI 契约门禁脚本
- UI / Testing / Development Log / Changelog / Release 文档

## 禁止修改

- `packages/ui` 拖拽吸附算法（本次无必要）
- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- GitHub / Sync / Setup / Update 业务逻辑
- PTY 业务逻辑

## 验收条件

- 左栏按钮 Hover 只出现一层提示；
- 终端按钮 Hover 只出现一层提示；
- 右栏按钮 Hover 只出现一层提示；
- Shell Header 按钮不存在 `title=`；
- 自定义 Tooltip 仍显示快捷键；
- Tooltip 不拦截鼠标事件；
- Header 联动、Hover Preview、三向吸附、PTY 不回退；
- `scripts/ui-contract-check.mjs` 进入治理门禁；
- Development Log / UI Layout / Test / Changelog / Release 同步。

## 当前状态

`active / pending-test`
