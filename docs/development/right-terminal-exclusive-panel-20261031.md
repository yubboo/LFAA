# LFAA-RIGHT-TERMINAL-EXCLUSIVE-PANEL-20261031

## 目标

当设置中心“常规”的终端位置为“右侧”且终端打开时，让共享终端管理器独占整个右侧菜单栏：不同时显示应用/节点信息、右栏工具栏、账户栏等右栏内容。用户关闭终端后，原右栏按原有选择和状态恢复。终端会话由 `TerminalManagerProvider` 唯一持有，右侧模式只改变显示位置，不创建第二个 Shell 或 PTY。

## Owner 与调用链

- 装配与右栏内容：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（`ApplicationWorkspace`）
- 终端模式切换：`packages/client/ui-workspace/src/TaskTerminal.tsx` → `InteractiveTerminal.tsx`
- Shell、PTY、标签和共享挂载位置：`packages/client/ui-sidebar-terminal/src/TerminalManagerProvider.tsx`
- 终端外观：`packages/client/ui-sidebar-terminal/src/TerminalManager.css`；右栏外框：`packages/client/ui-workspace/src/css/right-menu.css`
- 公开包说明：`packages/client/ui-sidebar-terminal/README.md`

## 设置、数据与权限

沿用设置中心 `general.terminalPosition`（`right` 时使用右栏；其他位置行为保持现有逻辑）、`general.integratedShell`（新建终端所用的 Windows PowerShell/CMD 等用户选择）及 `general.showBottomPanelControl`（入口可见性）。不新增设置、不写入或重置偏好。会话及输入继续使用 Terminal Manager 和现有 Permission Owner、节点/API 校验；右侧接管不得绕过会话授权。

## 验收条件

1. 右侧模式打开后，终端管理器填满右侧栏可用宽高，右栏不再渲染原有上下文、应用内容、工具栏或账户页脚；终端工具栏、会话标签、输入、输出、任务输出切换及关闭入口仍可用。
2. 右侧显示复用唯一 Terminal Manager；打开、关闭或路由内切换不重连、不清理当前 Shell/PTY 会话。
3. 关闭后恢复原先的右栏区段/内容；开终端期间不改写右栏当前选区。
4. 底部终端和 Minecraft 实例内嵌控制台维持既有展示和行为。
5. 常用桌面、窄分栏与短屏下均无横向溢出；终端工具栏和关闭入口可达，终端主体自行占据剩余空间。

## 边界与验证记录

- 不改现有终端 Shell、PTY 协议、进程生命周期、终端外观偏好或会话权限；不制造样例数据。
- 当前状态：合同已登记，待实现；随后记录实际改动文件、类型/构建、内置浏览器视口和交互结果。自动化测试未获用户要求时不新增或执行。
