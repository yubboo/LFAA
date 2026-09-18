# #21 Web 工作台 UI

## 主模块

`project-foundation / app-shell`

## 当前任务目标

实现接近 ChatGPT / Codex 的顶部 Header 联动三栏工作台：框架按钮属于区域 Header，不能漂在正文层。

## 当前交互事实

### 顶部 Header

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

Center / Right Header 必须同高并形成连续顶部结构。

### 左栏

- Hover / Focus（仅正式收起时）：临时淡入左栏预览，不修改 `leftCollapsed`；
- Click / `Ctrl+B`：正式开合左栏；
- Preview 必须低于 Header 层级，不能挡住左栏按钮点击。

### 右栏与终端

- `Ctrl+J`：切换底部终端；
- `Ctrl+Alt+B`：切换右栏；
- 右栏不做 Hover 自动展开；
- 按钮提供可见 Tooltip + 原生 title 提示。

### 拖拽与真实终端

- 左右 separator 只负责拖拽/吸附；
- 吸附后禁止 separator 反向拖开；
- Terminal Dock 使用 xterm + node-pty，禁止模拟日志冒充终端。

## 允许修改

- `packages/app-shell`
- 必要时 `packages/ui`
- `apps/web`
- UI / Testing / Readability 文档

## 禁止修改

- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- 正式 Rust PTY Broker
- GitHub / Sync / Setup / Update 业务逻辑

## 验收条件

- 不存在 `agent-center-floats` / `agent-center-toggle` 旧正文悬浮实现；
- 中间 Header 是正常文档流第一行；
- 右栏展开时按钮位于右栏 Header；
- 右栏收起时按钮回到中间 Header；
- 左栏 Hover Preview 与点击开合语义分离；
- 快捷键与 Tooltip 一致；
- 三向吸附、PTY、资源桥不回退；
- 代码注释、UI Layout、Development Log、Changelog / Release 同步。

## 当前状态

`active / pending-test`
