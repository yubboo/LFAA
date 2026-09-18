# LFAA 工作台 UI 规范

## 1. 当前 Web 总体结构

Web 没有桌面应用的原生标题栏，因此页面自己保留一条轻量顶栏；但左右栏 / 终端的 Shell 控制按钮不再挤在顶栏中，而是固定在**中间主工作区左右上角**。

```text
┌──────────────────────── Web 页面顶栏 ────────────────────────┐
│ Web 工作台                                        …    分享   │
├────────左侧栏────────┬─┬────────中间工作区────────┬─┬────右侧栏────┤
│                      │ │ [左栏]        [终端][右栏] │ │              │
│                      │ │                           │ │              │
│                      │ │                           │ │              │
│                      │ ├───────────────────────────┴─┴──────────────┤
│                      │ │                真实终端                    │
└──────────────────────┴─┴───────────────────────────────────────────┘
```

关键：

- 顶栏只负责 `Web 工作台` 标题、更多、分享等页面级操作；
- 左栏按钮位于中间主区左上角；
- 终端和右栏按钮位于中间主区右上角；
- 左侧栏全高仅指顶栏以下的工作区高度；
- Terminal Dock 从左侧栏右边开始；
- Terminal Dock 横跨中间 + 右侧；
- 右侧栏位于 Terminal Dock 上方。

## 2. 左栏 Hover 预览与正式开合

左栏按钮同时承担两种不同语义：

### 2.1 Hover / Focus：临时预览

仅当左栏已经正式收起时：

```text
鼠标移入左上角左栏按钮
→ 临时浮层淡入左栏内容
→ 鼠标可以从按钮移动到浮层继续浏览
→ 离开按钮和浮层后短延迟淡出
```

Hover 预览：

- 不修改 `leftCollapsed` 持久状态；
- 不改变 Grid 左栏宽度；
- 不允许创建第二份左栏业务状态；
- 只是对同一份左栏内容做临时浮层展示。

### 2.2 Click / Ctrl+B：正式开合

```text
点击左栏按钮
或 Ctrl+B
→ 改变 leftCollapsed
→ 正式展开 / 收起 Grid 左栏
```

因此：

```text
Hover = 看一眼
Click / Shortcut = 改变布局
```

## 3. 右侧与终端控制

右侧按钮保持显式控制，不增加 Hover 自动展开：

```text
Ctrl+J
→ 切换底部终端

Ctrl+Alt+B
→ 切换右侧栏
```

对应按钮必须保留 `title` / aria 提示，让鼠标停留时能看到快捷键。

## 4. 视觉语言

参考 ChatGPT / Codex 类生产力工具：

- 黑 / 白 / 中性灰；
- 细边框；
- 低对比背景层级；
- 克制圆角；
- 浅色 / 深色；
- 不使用水墨 / 宣纸 / 装饰性纹理。

## 5. 侧栏尺寸

```text
左栏 默认 288px / min 240 / max 640
右栏 默认 360px / min 300 / max 760
中央区目标最小宽度约 520px
```

动态最大值必须考虑另一侧栏与中央最小宽度。

## 6. 侧栏拖拽与吸附

```text
Pointer Move
→ requestAnimationFrame
→ max 到 min 正常跟随
→ 到 min 立即自动吸附 0
→ 不等待 Pointer Up
```

同一次拖拽中的吸附迟滞：

```text
min + 24px
```

一旦 Pointer Up 完成吸附收起：

- 禁止从分隔条反向拖拽展开；
- 左栏必须通过左上角按钮点击 / `Ctrl+B` 正式展开；
- 右栏必须通过右上角按钮 / `Ctrl+Alt+B` 展开；
- 终端必须通过右上角终端按钮 / `Ctrl+J` 或右栏终端入口展开；
- 分隔条只负责展开状态下的缩放与吸附。

## 7. 代码与盒子归属

```text
packages/app-shell/src/AgentWorkbench.tsx
→ 哪些区域存在、按钮放哪里、Shell 状态怎么切换

packages/app-shell/src/agent-workbench.css
→ 区域内容长什么样、Hover 浮层怎么淡入淡出

packages/ui/src/workbench/ResizableWorkbench.tsx
→ 左右/底部几何尺寸、拖拽、吸附算法

packages/ui/src/workbench/workbench.css
→ Grid、separator、collapsed/snap 几何样式

apps/web/src/LocalTerminal.tsx
→ xterm 浏览器端

apps/web/vite.config.ts
→ node-pty 服务端开发桥
```

详细人类导航：`docs/项目结构与代码地图.md`。

## 8. 真实 Terminal Dock

Terminal Dock 必须是可交互终端，不是日志卡片。

Web 本地开发实现：

```text
xterm.js
+ FitAddon
+ node-pty
```

行为：

- 位于最底部；
- 可拖动顶部边界改变高度；
- 向下拖到最小阈值后吸附收起；
- 收起后不能从底边反向拖出；
- 页面 / Vite 关闭时回收 PTY。

## 9. 安全

Web PTY 仅开发模式：

- Vite 绑定 `127.0.0.1`；
- PTY cwd 为项目根；
- 不自动提升权限；
- 不提供 Agent 自动执行通道；
- 正式 Agent Terminal 必须走 Tool Runtime → Policy → Permission → Rust PTY Broker。

## 10. 响应式

- `>1120px` 标准三栏 + 底部 Terminal Dock；
- `<=1120px` 右栏浮层；
- `<=820px` 左右栏浮层，Terminal Dock 作为底部层；
- 中间主区左右上角 Shell 控件继续保留；
- 窄屏可以隐藏“分享”等次要操作；
- 禁止整页水平滚动。
