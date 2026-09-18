# LFAA 更新日志

> 根目录只保留当前索引和最近版本；旧版本详细记录保存在 `docs/changelog/` 与 `docs/releases/`。

## #21.11 Web 工作台 Header 联动与按钮归属修正

- 用户版本：v0.0.43
- 状态：pending-test
- 日期：2026-09-18
- 以 v0.0.42 为历史基线，不覆盖旧包。
- 修正 #21.10 的 UI 定位模型：左/右 Shell Actions 不再 absolute 漂在正文区域，而是进入中间 / 右栏顶部 Header。
- 中间 Header 左侧承载左栏按钮与 `Web 工作台` 标题，右侧承载更多 / 分享。
- 右栏展开时，终端 / 右栏按钮位于右栏 Header；右栏收起时，同一组按钮自动回到中间 Header 右侧。
- 保留左栏 Hover Preview、`Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`、三向吸附、真实 PTY 与 `.lfaa` 资源桥。
- 新增自定义黑色快捷键 Tooltip，同时保留原生 `title` 降级提示。
- Sync / GitHub / Setup / Update Windows 脚本不修改，继续保留 v0.0.42 的 UTF-8 BOM 保护。

详细记录：

`docs/changelog/v0.0.43.md`
