# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.13 响应式重构与弹性吸附

- 用户版本：v0.0.45
- 状态：pending-windows-visual-test
- 日期：2026-09-18
- 以 v0.0.44 为历史基线，不覆盖旧包。
- 新增 Desktop / Compact / Mobile 三档响应式：1180 / 760 两个断点。
- Compact 使用“左 Dock + 右 Drawer”；Mobile 使用“主区全宽 + 左右 Drawer”，核心 Header 控件始终可见。
- 移除旧版 `88vw` 右栏覆盖方案，右 Drawer 限制为不超过 420px / 56vw。
- Tooltip 增加 start / end 边缘对齐，解决左、右贴边裁切。
- 左栏、右栏、底部终端统一升级为弹性吸附：Pointer 按住时可进入吸附后反向拖回 min；Pointer Up 才真正提交收起。
- min 以下不再硬跳到 0，而是连续弹性压缩。
- 拖拽期间不再启用 CSS transition 追赶 Pointer，减少卡顿和“硬吸附”感觉。
- 正式展开 / 收起动画统一为更平滑的 ease-out。
- UI 静态契约门禁增加响应式、Drawer、弹性吸附检查。
- Sync / GitHub / Setup / Update 和 PTY bridge 业务逻辑不修改。

详细记录：

`docs/changelog/v0.0.45.md`
