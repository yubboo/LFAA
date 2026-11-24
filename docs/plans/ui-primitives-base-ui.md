# @lfaa/ui-primitives 接入 Base UI 无头组件底座方案

- 状态：已实施
- 日期：2026-11-24
- 涉及包：`@lfaa/ui-primitives`、`@lfaa/client-ui-browser`（首批接入示范）

## 1. 选型背景

- 保持与 LFAA / DSH 一致的轻量化 **React 19 + CSS Modules + `@lfaa/ui-theme` 双主题变量** 路线，不引入 Tailwind 与重型有样式组件库，避免样式体系割裂。
- 在 `@lfaa/ui-primitives` 底层引入 **`@base-ui/react`**（无头交互原语），统一接管菜单防溢出定位、键盘导航、焦点管理、无障碍属性与动效过渡，业务包继续仅从 `@lfaa/ui-primitives/client` 消费。

## 2. 首批封装组件（`packages/ui/primitives/client/base/`）

1. **`DropdownMenu`**：基于 `@base-ui/react/menu`（支持普通项、勾选框项、分隔线、自动视口防溢出翻转、键盘上下选择与 Esc 恢复焦点）。
2. **`UiSwitch`**：基于 `@base-ui/react/switch`（顺滑触感开关，全消费 `--color-accent` / `--color-line`）。
3. **`UiSelect`**：基于 `@base-ui/react/select`（键盘可选、防溢出浮层下拉，替代简陋原生 `<select>`）。
4. **`UiTabs`**：基于 `@base-ui/react/tabs`（带平滑高亮态与完整键盘方向键切换）。
5. **`UiTooltip`**：基于 `@base-ui/react/tooltip`（悬停防抖与自动避障定位）。

## 3. 首批真实落地验证

- 将 [BrowserToolbar.tsx](../../packages/client/ui-browser/client/panes/BrowserToolbar.tsx) 的 `...` 更多选项菜单迁移到 `@lfaa/ui-primitives/client` 的 `DropdownMenu`，消除手写 `mousedown`/`Escape` 关闭与绝对定位溢出风险。
- 补充 [base-primitives.test.tsx](../../packages/ui/primitives/tests/base-primitives.test.tsx) 覆盖 SSR/渲染与公开导出，全量通过门禁与 `pnpm verify:web`。
