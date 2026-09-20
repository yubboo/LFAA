# app-shell/src 代码导航（v0.0.95）

`@lfaa/app-shell` 是 **LFAA 产品 UI / Feature 编排层**。它使用 `@lfaa/ui` 的通用 UI Kit，但 Left、Conversation、Composer、RuntimeControl、Settings 等产品语义只属于这里。

## 总结构

```text
AgentWorkbench.tsx                 # Composition Root，只连接 Controller 与公共模块
agent-workbench.css                # 仅 reset / 最小全局基础
workbench/
├─ shell/                          # 外壳 / Theme / Overlay / Shortcut
├─ left/                           # 左侧栏
├─ center/
│  ├─ header/
│  ├─ conversation/
│  │  └─ work-canvas/              # Work Surface 视觉布局 Owner
│  └─ composer/
│     └─ runtime-control/
├─ right/
├─ terminal/
├─ settings/
├─ session/                        # Agent Run / Chat / Work 业务会话
└─ shared/                         # 只限 Workbench 内真实复用的小 Primitive
```

## 模块内部职责

按需使用以下目录，不需要时不创建空层：

```text
<module>/
├─ view/       # TSX / DOM / 子 View 组合
├─ logic/      # Controller / Hook / 局部状态协调
├─ styles/     # 仅该模块 *.module.css
├─ contracts/  # Props / ViewModel / Port / 类型边界
└─ index.ts    # 唯一公共出口
```

兄弟模块不得深链内部文件；跨边界只通过 `index.ts` 与 typed Props/Callback/Controller contract。

## Work Canvas

`center/conversation/work-canvas` 是视觉布局唯一 Owner。它只保存 node `id→x/y` 与 viewport；Agent Session 不保存视觉坐标。高频 pan/zoom/drag 算法仍由 `@lfaa/ui` 的 `InfiniteCanvas` 拥有。

## 响应式 / Resize

工作台通用布局几何、Pointer/Resize/Snap 仍在 `@lfaa/ui/workbench`。App Shell 只组合，不复制算法。
