# Workbench 全域父子模块边界（v0.0.94 / #21.23）

> Workbench 采用与 DeepSeek Harness 相同方向的工程拆分原则：**TS/TSX 负责状态、行为和组合；每个 UI 模块拥有局部 CSS Module；通过 `index.ts` 暴露公共边界；共享算法只进入真正的 shared/UI primitive。** 本目录不允许再回到“一个大组件 + 一个全局大 CSS”的结构。

```text
AgentWorkbench.tsx                         # Composition Root：只装配 Controller + 大模块
└─ workbench/
   ├─ shell/                              # Theme / Chrome / Resize 装配 / 快捷键 / Overlay
   │  ├─ WorkbenchShell.tsx
   │  ├─ WorkbenchRoot.tsx
   │  ├─ WorkbenchOverlays.tsx
   │  ├─ useWorkbenchChromeController.ts
   │  ├─ useWorkbenchThemeController.ts
   │  ├─ useWorkbenchOverlayController.ts
   │  ├─ useWorkbenchShellShortcuts.ts
   │  └─ *.module.css + index.ts
   ├─ left/                               # 左侧栏大模块
   │  ├─ LeftSidebarRegion.tsx
   │  ├─ ProfileBar.tsx
   │  └─ *.module.css + index.ts
   ├─ center/                             # 中央父模块，只组合三个公开子模块
   │  ├─ CenterWorkspaceRegion.tsx
   │  ├─ header/                          # 顶栏
   │  ├─ conversation/                    # Chat Timeline / Work Canvas
   │  └─ composer/                        # 输入框父模块
   │     ├─ ComposerRegion.tsx
   │     ├─ AddCapabilityMenu.tsx
   │     ├─ PermissionControl.tsx
   │     └─ runtime-control/              # 模型 / reasoning / 强力推理
   │        ├─ RuntimeControl.tsx
   │        ├─ RuntimeModelPicker.tsx
   │        ├─ ReasoningControlRow.tsx
   │        ├─ useRuntimeControlController.ts
   │        └─ RuntimeControl.module.css + index.ts
   ├─ right/                              # 右侧资源栏
   ├─ terminal/                           # 底部终端
   ├─ settings/                           # Settings Surface + AI/Plugin Controller/ViewModel
   ├─ session/                            # Chat/Work Run 状态与 Runtime subscription
   └─ shared/                             # 仅 Workbench 内真正跨模块的小 Primitive
```

## Owner 规则

- `AgentWorkbench.tsx` **只能**创建 Controller、把公开 Props/Callback 接到模块，不允许重新实现区域 JSX、Provider ViewModel、Run subscription、Overlay DOM 或区域 CSS。
- `shell/*` 拥有 Theme、LayoutMode、Chrome、LeftPaneWidth、Hover Preview、Shell shortcuts 和 overlay 开合。
- `session/*` 拥有 `agentSurface`、permission profile、Chat projection、Work nodes 与 Agent Runtime event subscription/startRun。
- `settings/*` 拥有 AI/Plugin snapshot、Provider view model、Settings surface/section；其他模块只消费其显式公共结果。
- `left/*`、`right/*`、`terminal/*` 各自是大模块；不得读取兄弟模块私有状态。
- `center/*` 只做 Header / Conversation / Composer 的父级组合；三者互不深链 import。
- `composer/*` 拥有 draft/submitting/menu 协调；`runtime-control/*` 只拥有模型快切、reasoning preview/commit queue、boost 等内部状态。
- 父子/兄弟通信只允许 typed Props / Callback / public controller contract；禁止 DOM query、全局 mutable singleton、跨模块 class selector。

## CSS 规则

- UI 模块只使用自己的 `*.module.css`；禁止 `:global(.agent-xxx)` 逃逸。
- `packages/app-shell/src/agent-workbench.css` 只允许全局 reset，不允许 Left/Center/Composer/Runtime/Right/Terminal/Overlay 业务 selector。
- CSS Module 只负责本模块静态布局/字体/背景/边框/hover/focus；动态拖拽、阻尼、Slider geometry、Canvas 粒子继续由 TypeScript / `@lfaa/ui` Primitive 负责。
- 父模块不能通过 class selector 修改子模块内部，若需要变体必须通过显式 Prop / `data-*` contract。

## 修改范围示例

- 改左栏 → `left/**`；不碰 `center/right/terminal`。
- 改 Chat 消息 → `center/conversation/**`；不碰 Composer。
- 改输入框 → `center/composer/**`；不碰 Conversation。
- 改模型/推理卡 → `center/composer/runtime-control/**`；若必须改共享 Slider/Canvas，Prompt 必须显式声明进入 `@lfaa/ui` 对应 Primitive。
- 改终端 → `terminal/**`。
- 改全局面板 Resize/折叠 → `shell/**` + 明确的 `@lfaa/ui/workbench` Primitive，而不是各区域自行复制算法。

#21.23 是**等价模块迁移**：用户可见行为以 v0.0.93 为冻结基线；Reasoning Slider/粒子视觉问题不在本版本顺手修复。
