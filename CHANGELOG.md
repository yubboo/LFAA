# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.12 Shell Tooltip 单一提示源

- 用户版本：v0.0.44
- 状态：pending-test
- 日期：2026-09-18
- 以 v0.0.43 为历史基线，不覆盖旧包。
- 修复左栏、底部终端、右侧栏三个 Shell Header 按钮出现双层 Tooltip 的问题。
- 根因是同一按钮同时存在浏览器原生 `title` 和自定义 `.agent-shell-tooltip`；v0.0.44 删除 Shell Header 按钮的 `title`，只保留一套自定义 Tooltip。
- `aria-label` 与 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 快捷键提示继续保留。
- `.agent-shell-tooltip` 继续使用 `pointer-events:none`，提示层不会抢鼠标 Hover / Click。
- 新增 `scripts/ui-contract-check.mjs` 并接入 `governance:check`，防止双 Tooltip 回归。
- v0.0.43 的 Header 联动、左栏 Hover Preview、三向吸附、真实 PTY 不回退。
- Sync / GitHub / Setup / Update Windows 脚本业务逻辑不修改。

详细记录：

`docs/changelog/v0.0.44.md`
