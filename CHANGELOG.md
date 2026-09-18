# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.15 容器响应式与布局变量化

- 用户版本：v0.0.47
- 状态：pending-windows-visual-test
- 日期：2026-09-18
- 以 v0.0.46 为历史基线，不覆盖旧包。
- 删除 App Shell 固定 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS`，新增统一 `workbench-layout.config.ts`。
- 侧栏 / Bottom 尺寸改为 `ratio + floor + ceiling` 动态计算；当前参考 min 大致为左 196~232、右 228~288、Bottom 136~176。
- 响应式从固定 `1240 / 760` viewport 断点改为 `ResizeObserver + 工作台容器实际尺寸`。
- Desktop 只有真正能容纳左 + 中 + 右时才双 Dock；Compact 为左 Dock + 右 Overlay；Mobile 为双 Overlay。
- 右 Overlay 改用 CSS 变量 + `clamp()` / 百分比，删除旧固定 Drawer 尺寸语义。
- 大屏保存的 pane width 在小窗口中会按当前 limits 与 center protection 重新 clamp，避免中央区被挤坏。
- 三向“到 min 吸附收起、Pointer 不松手反向解锁、Pointer Up 才提交 collapsed”保持不变。
- UI contract 新增容器响应式、变量化布局、旧固定断点/Drawer 防回归检查。
- Sync / GitHub / Setup / Update、PowerShell BOM、PTY bridge 均不改。

详细记录：

`docs/changelog/v0.0.47.md`
