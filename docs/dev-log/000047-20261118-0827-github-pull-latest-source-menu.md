# Dev Log 000047 — 在 lfaa.bat 菜单新增选项 6：一键拉取 GitHub 最新源码

- **时间**：2026-11-18 08:27:53 +08:00
- **任务编号**：000047
- **任务目标**：在 `lfaa.bat` 调用的 `scripts/lfaa.ps1` 中新增菜单项 `6`，支持从 `https://github.com/yubboo/LFAA.git`（`main` 分支）拉取最新源码更新本地工作区，免去重复 `git clone`。

## 变更文件清单

- `e:\lfaa\scripts\lfaa.ps1`：
  - 抽取共用辅助函数 `Initialize-GitOrigin`，供推送（`4`/`5`）与拉取（`6`）复用仓库初始化及 `origin` 地址绑定逻辑。
  - 新增 `Pull-FromGitHub` 与菜单项 `6`：执行 `git fetch origin main` 获取最新提交；若远程已是最新且本地干净则提示无需更新；若本地存在未提交改动，提供「1. 暂存后拉取并恢复（`git stash` + `pop`）」与「2. 放弃未提交改动并同步为远程最新源码（保留 `node_modules/` 与 `.env`）」或取消；若本地与远程历史存在分叉（如曾强制推送），提供 `git reset --hard origin/main` 对齐或 `git rebase origin/main` 变基选项；拉取后若检测到 `package.json`/`pnpm-lock.yaml` 或 `scripts/lfaa.ps1` 变更则给出对应操作提示。
- `e:\lfaa\scripts\README.md`：补充菜单项 `6` 的用途说明。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **Git 状态核对**：`git status -s` 仅包含预期修改 `scripts/lfaa.ps1`、`scripts/README.md` 及本轮日志。
3. **说明**：本轮仅改动维护脚本与文档，不涉及 Web UI 或前端交互，未运行内置浏览器，也未在本地代执行 `git pull` / `git commit` / `git push`。
