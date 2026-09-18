# LFAA 工作台 UI 规范

## 1. 总体结构

### Web

Web 没有桌面应用的原生标题栏，因此必须由页面自身提供一条全宽 Workbench Chrome：

```text
┌──────────────────── Web Workbench Chrome ────────────────────┐
│ [左栏]  Web 工作台                         [终端] [右栏] … 分享 │
├────────左侧栏────────┬─┬────────中间工作区────────┬─┬────右侧栏────┤
│                      │ │                           │ │              │
│                      │ │                           │ │              │
│                      │ │                           │ │              │
│                      │ ├───────────────────────────┴─┴──────────────┤
│                      │ │                真实终端                    │
└──────────────────────┴─┴───────────────────────────────────────────┘
```

关键：

- Workbench Chrome 横跨整个 Web 页面，不属于左栏、中间区或右栏中的任何一个；
- 左栏开合按钮常驻 Chrome 最左侧；
- 终端、右栏开合按钮常驻 Chrome 右侧；
- 左侧栏全高仅指 Chrome 以下的工作区高度；
- Terminal Dock 只从左侧栏右边开始；
- Terminal Dock 横跨中间 + 右侧；
- 右侧栏位于 Terminal Dock 上方。

### Desktop

桌面端可把同一组 Workbench Shell Actions 映射到原生窗口标题栏 / App Chrome，不需要在内容区再复制一条 Web 顶栏。

## 2. 视觉语言

参考 ChatGPT / Codex 类生产力工具：

- 黑 / 白 / 中性灰；
- 细边框；
- 低对比背景层级；
- 克制圆角；
- 浅色 / 深色；
- 不使用水墨 / 宣纸 / 装饰性纹理。

## 3. 侧栏尺寸

```text
左栏 默认 288px / min 240 / max 640
右栏 默认 360px / min 300 / max 760
中央区目标最小宽度约 520px
```

动态最大值必须考虑另一侧栏与中央最小宽度。

## 4. 侧栏拖拽与吸附

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
- 必须点击常驻 Workbench Chrome 中对应按钮重新展开（快捷键仍可作为显式命令）；
- 分隔条只负责展开状态下的缩放与吸附，不承担重新展开。

## 5. 常驻 Workbench Shell 控制

框架级按钮必须与栏位内容解耦。

### Web

- 左栏按钮：Chrome 最左侧，始终可见；
- 终端按钮：Chrome 右侧，始终可见；
- 右栏按钮：Chrome 右侧，始终可见；
- 左 / 右栏展开或收起时，按钮位置不得跟着栏位移动；
- 不允许用 `opacity: 0` + hover 作为主要入口；
- 不允许把重新展开依赖于屏幕边缘 hover 热点；
- 侧栏内部不得重复放相同的壳层开合按钮。

### Desktop

- 同一组 Shell Actions 可由原生标题栏承载；
- 内容区不重复创建 Web Chrome；
- 原生标题栏入口同样必须常驻。

## 6. 真实 Terminal Dock

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
- 收起后不能从底边反向拖出，必须点击 Workbench Chrome 的终端按钮或右栏“终端”功能入口；
- 终端关闭后 PTY 会话可以在组件存活期间保留；
- 页面 / Vite 关闭时回收 PTY。

## 7. 安全

Web PTY 仅开发模式：

- Vite 绑定 `127.0.0.1`；
- PTY cwd 为项目根；
- 不自动提升权限；
- 不提供 Agent 自动执行通道；
- 正式 Agent Terminal 必须走 Tool Runtime → Policy → Permission → Rust PTY Broker。

## 8. 响应式

- `>1120px` 标准三栏 + 底部 Terminal Dock；
- `<=1120px` 右栏浮层；
- `<=820px` 左右栏浮层，Terminal Dock 作为底部层；
- Web Chrome 始终保留左栏 / 终端 / 右栏三个框架级按钮；
- 窄屏可以隐藏“分享”“更多”等次要操作；
- 禁止整页水平滚动。
