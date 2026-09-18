# LFAA 工作台 UI 规范

## 1. 当前 Web 总体结构

当前 Web 工作台不再使用“全宽独立 Web 顶栏 + 正文悬浮按钮”方案。框架级控制必须进入各自区域的顶部 Header，并与右栏展开/收起联动。

```text
┌────────左侧栏────────┬──────────────中间工作区──────────────┬────右侧栏────┐
│ LFAA / 导航 / 项目    │ [左栏] Web 工作台        … 分享      │ [终端][右栏] │
│                      ├───────────────────────────────────────┼──────────────┤
│                      │             中间正文                  │ 工具与资源    │
│                      │                                       │              │
│                      ├───────────────────────────────────────┴──────────────┤
│                      │                   真实终端                            │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

当右栏收起时：

```text
┌────────左侧栏────────┬────────────────────────中间工作区────────────────────┐
│                      │ [左栏] Web 工作台      … 分享 [终端][右栏]           │
```

关键：

- 左栏按钮属于中间 Header 左侧，不允许 absolute 漂在正文层；
- `Web 工作台` 标题、更多、分享属于中间 Header；
- 右栏展开时，终端和右栏按钮属于右栏 Header；
- 右栏收起时，同一组终端/右栏按钮回到中间 Header 右侧；
- 中间 Header 与右栏 Header 高度一致，形成连续顶部工具栏；
- Terminal Dock 继续位于中间 + 右栏区域底部。

## 2. 左栏 Hover 预览与正式开合

### 2.1 Hover / Focus：临时预览

仅当左栏正式收起时：

```text
鼠标移入中间 Header 左栏按钮
→ 左栏预览浮层淡入
→ 鼠标可移动到预览浮层继续浏览
→ 离开按钮和浮层后短延迟淡出
```

Hover 预览不得修改 `leftCollapsed`。

### 2.2 Click / Ctrl+B：正式开合

```text
点击左栏按钮 / Ctrl+B
→ 改变 leftCollapsed
→ 正式展开 / 收起 Grid 左栏
```

## 3. 右侧与终端控制

右侧保持显式控制，不做 Hover 自动展开：

```text
Ctrl+J       → 切换底部终端
Ctrl+Alt+B   → 切换右侧栏
```

按钮必须提供快捷键提示。三个 Shell Header 按钮只允许使用一套自定义黑色 Tooltip；禁止同时使用原生 `title`，避免浏览器原生提示与自定义提示叠成两层。`aria-label` 保留无障碍语义，`.agent-shell-tooltip` 必须 `pointer-events:none`，不能抢鼠标事件。

## 4. Header 层级规则

Header 属于正常文档流，不能覆盖正文：

```text
CenterWorkspace
├─ 48px Header
├─ Conversation
└─ Composer

RightSidebar
├─ 48px Shell Header
└─ Right Body
```

禁止把 Shell Actions 再实现为 `position:absolute` 的正文悬浮层。

## 5. 侧栏尺寸

```text
左栏 默认 288px / min 240 / max 640
右栏 默认 360px / min 300 / max 760
中央区目标最小宽度约 520px
```

## 6. 侧栏拖拽与吸附

```text
Pointer Move
→ requestAnimationFrame
→ 到 min 自动吸附 0
→ 同一拖拽反向拉回使用 24px hysteresis
```

Pointer Up 完成吸附后：

- separator 禁止反向拖开展开；
- 左栏通过 Header 按钮 / `Ctrl+B` 展开；
- 右栏通过 Header 按钮 / `Ctrl+Alt+B` 展开；
- 终端通过 Header 按钮 / `Ctrl+J` 或右栏终端入口展开。

## 7. 代码与盒子归属

```text
packages/app-shell/src/AgentWorkbench.tsx
→ 区域结构、Header 按钮归属、Shell 状态、Hover Preview、快捷键

packages/app-shell/src/agent-workbench.css
→ Header / Tooltip / 左右栏正文 / Preview / Composer / Terminal 视觉

packages/ui/src/workbench/ResizableWorkbench.tsx
→ 左右/底部几何尺寸、拖拽、吸附算法

packages/ui/src/workbench/workbench.css
→ Grid、separator、collapsed/snap 几何样式

apps/web/src/LocalTerminal.tsx + apps/web/vite.config.ts
→ xterm + node-pty 本地开发终端
```

详细导航：`docs/项目结构与代码地图.md`。

## 8. 真实 Terminal Dock

真实终端仍使用：

```text
xterm.js + FitAddon + node-pty
```

位于工作区底部，可拖动高度、向下吸附收起，收起后不能从底边反向拖出。

## 9. 安全

Web PTY 仅开发模式：

- Vite 绑定 `127.0.0.1`；
- cwd 为项目根；
- 不自动提升权限；
- 不提供 Agent 自动执行通道。

## 10. 响应式

- `>1120px` 标准三栏；
- `<=1120px` 右栏浮层；
- `<=820px` 左右栏浮层；
- Header 控件语义保持不变；
- 可隐藏分享等次要操作，但不能隐藏左栏 / 终端 / 右栏入口。
