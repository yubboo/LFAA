# Dev Log 000049 — 菜单 6 拉取前显示远程 commit 信息并支持 [Y/n] 确认

- **时间**：2026-11-18 08:31:18 +08:00
- **任务编号**：000049
- **任务目标**：优化 `lfaa.bat` 菜单项 `6`（从 GitHub 拉取最新源码），在应用更新前展示远程 `origin/main` 最新 `commit` 信息（提交说明、短哈希与提交时间），并提供 `[Y/n]`（直接回车默认 `y`）确认交互。

## 变更文件清单

- `e:\lfaa\scripts\lfaa.ps1`：在 `Pull-FromGitHub` 获取 `origin/main` 后提取最新提交说明（`git -c i18n.logOutputEncoding=utf-8 log -1 --pretty=%s origin/main`）、短哈希与提交时间；已是最新时也会显示远程最新提交信息；有可拉取更新时先输出 `你正在拉取远程仓库最新源码：<remoteDesc>`，并提示 `是否确认拉取？[Y/n]（直接回车默认 y，输入 n 取消）`（回车或 `y`/`yes` 继续，其余输入取消）。
- `e:\lfaa\scripts\README.md`：更新选项 `6` 的交互确认说明。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **安全检查复测**：`Test-PushSafety -Scope "tracked"` 返回 `TRACKED_SAFETY_CHECK=True`。
3. **说明**：本轮仅修改 CLI 菜单脚本与说明文档，未涉及 Web UI 改动，未运行内置浏览器，也未代执行 `git pull`。
