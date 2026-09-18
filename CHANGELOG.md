# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.16 Hover / Click 左栏宽度统一

- 用户版本：v0.0.48
- 状态：pending-windows-visual-test
- 日期：2026-09-18
- 以 v0.0.47 为历史基线，不覆盖旧包。
- 修复左栏 Hover Preview 与点击正式展开宽度不一致。
- Preview 不再维护独立 CSS clamp 宽度；改为读取 ResizableWorkbench 当前真实 `leftWidth`。
- 新增 `onLeftWidthChange` 几何回调，App Shell 通过单一 CSS 变量 `--agent-left-preview-width` 投影真实宽度。
- 默认宽度、用户 resize 后宽度、容器重新 clamp 后宽度都会在 Hover / Click 间保持一致。
- UI contract 新增单一 Preview 宽度事实源防回归检查。
- #21.15 归档；当前 Active 为 #21.16。
- Sync / GitHub / Setup / Update、PTY、三向吸附和响应式模式算法均不改。

详细记录：

`docs/changelog/v0.0.48.md`
