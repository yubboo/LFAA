# @lfaa/ui — UI Kit / Design System / Shared Interaction Engine

`packages/client/ui` **不是 LFAA 所有产品页面的目录**。它提供跨产品模块复用的界面积木和交互算法；具体 Chat/Work 工作模式归 `@lfaa/workspace`；Shell、Left/Right、Composer、RuntimeControl、Settings 等产品外壳归 `@lfaa/app-shell`。

TS/TSX 在 UI Kit 中是合理的：Button/Slider/Canvas 等组件需要 DOM、ARIA、Pointer/Keyboard、Props、Canvas renderer 等行为；这里允许的是**通用 UI 行为**，不允许 Provider/Session/业务状态。

## 当前分层

```text
packages/client/ui/src/
├─ ui-overlay/       outside-dismiss / Escape / Layer
├─ ui-controls/      Slider 等通用交互控件
├─ ui-effects/       Canvas Effect / Effect Registry
├─ ui-extension/     UI contribution contract / registry
├─ ui-motion/        展开/收起等共享 Motion
├─ ui-resize/        阻尼/resize primitive
├─ layout/           通用布局
├─ workbench/        通用工作台几何 / Resize / Snap
└─ features/         InfiniteCanvas Renderer/Interaction 与固定归属的 AI 配置图形面板
```

每个 Primitive 可拥有自己的 TS/TSX 与局部样式。CSS 只描述该 Primitive 的视觉；几何、Pointer、Canvas、ARIA 等需要可测试逻辑时由 TS 持有。

## 不负责

- Chat/Work Workspace 工作模式；Shell/Left/Right/Composer/RuntimeControl/Settings 等 LFAA 产品页面；
- Config / Account / Auth / Provider 业务真值；
- Agent Session / Run 真值；
- Provider 外部 API 请求；
- Secret/Credential；
- Host/Vite/Node/Rust 平台桥。

## 公共子入口

- `@lfaa/ui`
- `@lfaa/ui/workbench`
- `@lfaa/ui/ui-overlay`
- `@lfaa/ui/ui-controls`
- `@lfaa/ui/ui-effects`
- `@lfaa/ui/ui-extension`
