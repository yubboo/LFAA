# LFAA 工作台 UI 规范

## 1. 当前 Web 总体结构

当前工作台采用 Header + 三区域 + Bottom Dock。框架级按钮必须属于 Header，不允许漂在正文层。

### Desktop（>= 1240px）

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

右栏收起时，终端 / 右栏按钮回到 Center Header 右侧。

### Compact（760px ~ 1239px）

```text
┌────左栏 Dock────┬──────────────────主区──────────────────┐
│                 │ [左栏] 标题       [终端][右栏]        │
│                 ├────────────────────────────────────────┤
│                 │ 主内容                                 │
│                 │                          ┌─右栏 Drawer─┐│
│                 │                          │ 工具与资源   ││
│                 │                          └─────────────┘│
└─────────────────┴────────────────────────────────────────┘
```

规则：

- 右栏变覆盖式 Drawer，不参与挤压主区宽度；
- Drawer 从 48px Header 下方开始；
- Shell Actions 始终留在 Center Header，因此关闭入口永远可见；
- 进入 Compact 时只自动收起右栏一次；用户可在同一断点内手动重新打开。

### Mobile（< 760px）

```text
┌────────────────────主区全宽────────────────────┐
│ [左栏] 标题                  [终端][右栏]       │
├─────────────────────────────────────────────────┤
│ 主内容                                          │
│                                                 │
│ 左 Drawer / 右 Drawer 从 Header 下方覆盖式出现 │
└─────────────────────────────────────────────────┘
```

规则：

- 左右栏不再占固定列；
- 默认收起左右栏和底部终端；
- Header 核心入口永远保留；
- 更多 / 分享等次要按钮可隐藏；
- 移动端不依赖 Hover 作为唯一操作方式；
- 页面不得产生整页横向滚动。

## 2. 左栏 Hover 预览与正式开合

Desktop / Compact 下，左栏正式收起后：

```text
Hover / Focus 左栏按钮
→ 左栏预览浮层淡入
→ 不改变 leftCollapsed
→ 离开后短延迟淡出
```

正式布局只由：

```text
Click / Ctrl+B
```

改变。

Mobile 不依赖 Hover Preview；用户通过显式按钮打开 Drawer。

## 3. Shell Header 控制

快捷键：

```text
Ctrl+B       左栏
Ctrl+J       底部终端
Ctrl+Alt+B   右栏
```

三个框架按钮必须：

- 保留 `aria-label`；
- 只使用一套 `.agent-shell-tooltip`；
- 禁止同时使用原生 `title`；
- Tooltip 必须 `pointer-events:none`；
- 左侧按钮 Tooltip 使用 start 对齐；
- 右侧按钮 Tooltip 使用 end 对齐，防止贴边裁切。

## 4. Header 层级规则

```text
CenterWorkspace
├─ 48px Header
├─ Conversation
└─ Composer

RightSidebar（仅 Desktop）
├─ 48px Shell Header
└─ Right Body

RightSidebar（Compact / Mobile）
└─ Right Body
```

Compact / Mobile 的右栏从 Center Header 下方出现，因此不能再重复渲染 Right Shell Header。

## 5. Desktop 尺寸

```text
左栏 默认 300px / min 280 / max 640
右栏 默认 400px / min 360 / max 760
中央区目标最小宽度约 520px
底部 默认 280px / min 180 / max 560
```

Compact / Mobile 的 Drawer 宽度由响应式规则限制，不允许 `88vw` 这类几乎覆盖全屏的旧方案。

## 6. 三向拖拽与吸附收起

左栏、右栏、底部终端使用同一交互语义。**min 是展开态可用布局的硬下限，不允许面板在 min 以下继续作为展开布局存在。**

### 6.1 Pointer 按住期间

```text
正常尺寸
→ 跟手拖拽
→ 到达 min
→ 立即进入 snap capture
→ 收起预览吸到 0
```

此时用户**不松手**可以反向拖动：

```text
snap capture
→ 反向拖动
→ 达到 min + hysteresis
→ 退出 snap capture
→ 面板恢复到至少 min
→ 可继续向外拉伸
```

因此不会再出现“右栏仍然展开，但窄到文字和快捷键被截断”的中间状态。

### 6.2 Pointer Up

只有 Pointer Up 时仍在 snap capture，才真正提交 collapsed。

如果已经反向拖过迟滞区，则本次拖拽保持展开，最终尺寸至少为 min。

### 6.3 Pointer Up 之后

正式 collapsed 后：

- separator 禁止反向拖开展开；
- 左栏必须通过 Header / `Ctrl+B`；
- 右栏必须通过 Header / `Ctrl+Alt+B`；
- 终端必须通过 Header / `Ctrl+J` 或右栏终端入口。

## 7. 动画与性能

拖拽阶段：

- `pointermove` 使用 `requestAnimationFrame` 合并；
- 直接更新 CSS 变量；
- `.lfaa-is-resizing` 时禁止 Workbench transition；
- 不允许 CSS transition 追逐 Pointer，避免“卡一下”的黏滞感。

提交展开 / 收起阶段：

- 普通拖拽不使用 Grid transition；
- 从 min 进入 snap preview 时允许约 150ms 的短磁吸过渡；
- 正式按钮展开 / 收起继续使用约 220~280ms ease-out；
- 不允许以 min 以下的尺寸继续渲染展开内容。

## 8. 代码与盒子归属

```text
packages/app-shell/src/AgentWorkbench.tsx
→ Shell 状态、LayoutMode、Header 按钮归属、Hover Preview、快捷键

packages/app-shell/src/agent-workbench.css
→ Header / Tooltip / 左右栏内容 / Drawer 内容视觉 / Composer / Terminal 外壳

packages/ui/src/workbench/ResizableWorkbench.tsx
→ 几何尺寸、Pointer Capture、min 吸附收起状态机、尺寸持久化

packages/ui/src/workbench/workbench.css
→ Grid、separator、Dock/Drawer 几何、collapsed 动画、响应式布局

apps/web/src/LocalTerminal.tsx + apps/web/vite.config.ts
→ xterm + node-pty 本地开发终端
```

详细导航：`docs/项目结构与代码地图.md`。

## 9. 真实 Terminal Dock

真实终端仍使用：

```text
xterm.js + FitAddon + node-pty
```

安全边界不变：

- Vite 绑定 `127.0.0.1`；
- cwd 为项目根；
- 不自动提升权限；
- 不提供 Agent 自动执行通道。

## 10. 响应式验收尺寸

至少验证：

```text
1600x900   Desktop
1280x800   Desktop / 浏览器缩放后仍不能崩
1024x768   Compact
820x900    Compact
759x900    Mobile 边界
640x800    Mobile
390x844    Mobile
```

每个尺寸都必须检查：Header、Composer、左右入口、右 Drawer、Terminal Dock、无横向滚动。
