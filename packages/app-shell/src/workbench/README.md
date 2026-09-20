# Workbench 父子边界（v0.0.97 / #21.26）

> Workbench 是产品外壳，不再把 Chat/Work 两种 Workspace Mode、Session、Canvas 产品状态全部堆在 App Shell 内。父目录表示领域，子目录表示职责；禁止为了模块化过度拆成大量平级 package。

```text
AgentWorkbench.tsx
└─ workbench/
   ├─ shell/       # Theme / Chrome / Resize assembly / Shortcut / Overlay
   ├─ left/        # 左侧栏
   ├─ center/      # Header + Workspace Mode View + Composer 的装配
   │  ├─ header/
   │  └─ composer/
   │     └─ runtime-control/
   ├─ right/
   ├─ terminal/
   ├─ settings/
   └─ shared/

@lfaa/workspace
├─ chat/           # Chat Mode / 线性消息视图
├─ work/           # Work Mode / Infinite Canvas 视图和布局状态
└─ shared/         # Chat/Work 共用 Agent Session Controller
```

## Owner 规则

- `AgentWorkbench.tsx` 只创建 Controller、连接公开 Props/Callback。
- `center/*` 只装配 Header、`@lfaa/workspace` 公共 Surface 与 Composer；不得深链 Workspace 内部。
- Workspace 的 `chat/work/shared` 只通过 `@lfaa/workspace` 公共入口向 App Shell 暴露。
- Composer/RuntimeControl 继续属于 App Shell；Chat/Work Run 与模式状态不复制到 Composer。
- `@lfaa/ui` 继续拥有 Slider / InfiniteCanvas / Effect / Resize / Motion 等通用算法。
- 父子/兄弟通信只允许 typed Props / Callback / public controller contract；禁止 DOM query、全局 mutable singleton、跨模块 class selector。

## CSS 规则

模块视觉使用自己的 `*.module.css`；`agent-workbench.css` 只允许 reset。动态拖拽、阻尼、Slider geometry、Canvas 粒子等算法继续由 TypeScript / `@lfaa/ui` Primitive 负责。

## 修改范围示例

- 改 Chat Mode → `packages/workspace/src/chat/**`。
- 改 Work Canvas 产品行为 → `packages/workspace/src/work/**`；若是通用 InfiniteCanvas Pointer 算法才进入 `@lfaa/ui`。
- 改输入框 / 模型推理卡 → `packages/app-shell/src/workbench/center/composer/**`。
- 改左/右栏或终端 → 对应 App Shell 模块。
