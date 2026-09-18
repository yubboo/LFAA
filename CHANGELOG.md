# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.14 最小尺寸吸附收起语义修正

- 用户版本：v0.0.46
- 状态：pending-windows-visual-test
- 日期：2026-09-18
- 以 v0.0.45 为历史基线，不覆盖旧包。
- 修正 v0.0.45 的吸附语义：吸附目标是“收起”，不是“继续以 min 以下超窄宽度展开”。
- 左栏 / 右栏 / Bottom Terminal 展开态都设置可用最小尺寸；到 min 即进入 snap capture / 收起预览。
- Pointer 不松手时仍可反向拖过 `min + snapHysteresis`，恢复到至少 min 并继续拉伸。
- Pointer Up 时仍 snapped 才真正提交 collapsed；正式收起后 separator 继续禁止反向展开。
- 左栏 min 提升到 280px，右栏 min 提升到 360px，Bottom min 提升到 180px。
- Desktop / Compact 断点调整为 1240 / 760，以保证新最小宽度与中央区可用空间兼容。
- 删除 `elasticSize()` / `snapCommitThreshold()` 当前实现，禁止 min 以下展开态回归。
- 保留响应式 Drawer、Header、Tooltip、真实终端、Sync / GitHub / Setup / Update 现有行为。

详细记录：

`docs/changelog/v0.0.46.md`
