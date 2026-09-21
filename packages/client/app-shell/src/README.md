# app-shell/src 代码导航（v0.0.98）

`@lfaa/app-shell` 是 **LFAA 产品入口 / Shell / Chrome / Composition 层**。它使用 `@lfaa/ui` 的通用 UI Kit，并装配 `@lfaa/workspace` 的 Chat/Work 工作模式；不再重复拥有 Workspace Session、Chat Timeline 或 Work Canvas 产品状态。

## 总结构

```text
product-surface.css               # Login / First Run / Smart Home 共用视觉与 Motion token
identity/                          # Identity Gate 的 Client 表现层
app-hub/                           # Smart Home（公开名 LfaaAppHub 暂保兼容）
AgentWorkbench.tsx                 # Workbench Composition Root，只连接 Controller 与公共模块
agent-workbench.css                # 仅 reset / 最小全局基础
workbench/
├─ shell/                          # 外壳 / Theme / Overlay / Shortcut
├─ left/                           # 左侧栏
├─ center/
│  ├─ header/                      # Center Chrome
│  └─ composer/                    # 输入区 / Runtime Control
├─ right/
├─ terminal/
├─ settings/
└─ shared/                         # 只限 Workbench 内真实复用的小 Primitive

@lfaa/workspace                    # 通过公共 API 装配
├─ chat/                           # Chat Mode
├─ work/                           # Work Mode / Canvas View
└─ shared/                         # 共用 Workspace Session
```

## 模块内部职责

按需使用 `view / logic / styles / contracts / index.ts`；不需要的层不创建空目录。兄弟模块不得深链内部文件，跨边界只通过公共入口和 typed Props/Callback/Controller contract。

## Workspace 边界

Center 只做 `Header → Workspace(Chat/Work) → Composer` 装配。Chat/Work Surface 和共用 Agent Session 属于 `@lfaa/workspace`；Composer/RuntimeControl 属于 App Shell。Work 的节点布局持久化属于 Workspace Work 子模块，高频 InfiniteCanvas Pointer/Zoom/Drag 算法仍属于 `@lfaa/ui`。

## 响应式 / Resize

工作台通用布局几何、Pointer/Resize/Snap 仍在 `@lfaa/ui/workbench`。App Shell 只组合，不复制算法。
