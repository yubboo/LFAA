# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.17 Composer 底部安全间距

- 用户版本：v0.0.49
- 状态：pending-windows-visual-test
- 日期：2026-09-18
- 以 v0.0.48 为历史基线，不覆盖旧包。
- 输入框底部留白由固定 `.5rem` 改为单一变量 `--agent-composer-bottom-gap`。
- Desktop 使用 `clamp(1rem, 2.4vh, 1.75rem)`，让全屏输入框适度上移；Compact 与 Mobile 使用更紧凑值。
- Composer Wrap 使用 `max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))`，兼容设备安全区。
- 不使用 absolute / transform 假移动输入框，保持正常 Grid 文档流。
- UI contract 新增 Composer bottom-gap 单一变量防回归检查。
- #21.16 归档；当前 Active 为 #21.17。
- 三向吸附、响应式模式、Hover/Click 左栏宽度、PTY、Sync / GitHub / Setup / Update 均不改。

详细记录：

`docs/changelog/v0.0.49.md`
