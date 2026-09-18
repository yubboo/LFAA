# LFAA v0.0.47 Release

本版本以 v0.0.46 为历史基线，重点修复小窗口响应式与固定侧栏尺寸问题，并把 Workbench 几何改成单一变量/公式驱动。

## 交付内容

- 新增 `workbench-layout.config.ts` 作为几何单一事实源；
- 左 / 右 / Bottom 使用 ratio + floor + ceiling 计算 limits；
- 当前参考 min：左约 196~232、右约 228~288、Bottom 约 136~176；
- 使用 ResizeObserver 监听 Workbench Stage 实际尺寸；
- 删除固定 1240 / 760 viewport 响应式；
- Desktop：仅容器实际放得下三栏时双 Dock；
- Compact：左 Dock + 右 Overlay；
- Mobile：主区全宽 + 双 Overlay；
- 右 Overlay 使用 CSS 变量 + clamp / 百分比；
- 历史持久化 pane width 在小容器中重新 clamp；
- 三向 min 吸附收起与 Pointer 反向恢复行为保持；
- UI contract 增加容器响应式与变量化布局防回归。

## 未修改

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge / node-pty；
- Agent Runtime / Tool Runtime / Permission / Config / Rust Native 边界。

## 发布前门禁

- governance / imports / dev-log / docs / comments；
- Windows PowerShell BOM；
- release consistency；
- UI contract；
- TS / TSX syntax；
- ZIP 根目录 / 中文路径 / Round-trip Hash。

真实视觉状态：`pending-windows-visual-test`。
