# LFAA UI

## 目录

`packages/ui`

LFAA **所有可复用图形界面的唯一主目录**。Web / Desktop 图形宿主复用这里的 UI，不在各 App 复制第二套业务页面。

## 固定分层

```text
packages/ui/src/
├─ ui-overlay/       共享浮层生命周期：outside dismiss / Escape / 后续 focus/portal
├─ ui-controls/      可复用交互控件：离散 Slider、后续 Menu/Tooltip 等
├─ ui-effects/       声明式特效 + Effect Registry，可按 owner 卸载
├─ ui-extension/     UI 插件贡献契约/Registry（effect/slot/renderer/panel/action）
├─ layout/           可复用布局
├─ workbench/        工作台几何、Resize、Snap
└─ features/         可复用业务 Feature UI
```

新增“共享 UI 基础/交互/特效/扩展”时统一放在 `ui-xxx/`，不要在 `packages/` 顶层新增 `effects` / `overlay` / `motion` 等第二套 UI 域，也不要在 App Shell 内复制实现。既有 `layout/workbench/features` 目录保持不变。

## 复用与插件化边界

- `ui-overlay` / `ui-controls` 属于 UI Kernel/SDK 基础能力：稳定、不可作为用户插件卸载。
- `ui-effects` / `ui-extension` 提供 Registry seam；具体 Effect Pack / Renderer / Panel 等可以由 Plugin/App Pack 安装、启用、禁用和卸载。
- Feature 通过 Registry/公共组件消费贡献，不直接深链或 import 可卸载插件。
- 插件卸载使用 owner-scoped cleanup + generation；正在运行的旧 generation 不被强制破坏。
- 普通插件不得 `document.querySelector()` 后修改 LFAA DOM。未来自定义可执行 UI Renderer 必须经过受控 UI Extension Host。

## 不负责

- Config / Account / Auth / Provider 业务真值；
- Provider 外部 API 请求；
- Secret 保存 / Credential Store；
- 模型推理 Runtime；
- 第三方可执行代码的安全沙箱。

UI 通过 Props / Controller / ViewModel 接收业务能力。

## 公共子入口

- `@lfaa/ui`
- `@lfaa/ui/workbench`
- `@lfaa/ui/ui-overlay`
- `@lfaa/ui/ui-controls`
- `@lfaa/ui/ui-effects`
- `@lfaa/ui/ui-extension`
