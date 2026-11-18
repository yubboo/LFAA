# Dev Log 000045 — 新增内置浏览器实测验收规范并拆分 lfaa.bat 菜单 4/5 推送项

- **时间**：2026-11-18 08:20:37 +08:00
- **任务编号**：000045
- **任务目标**：
  1. 在项目开发规范中强制要求每次涉及前端 UI、布局、样式或交互的变更都必须使用 Agent 内置浏览器（`browser` 子代理）完成实测验收。
  2. 将 `lfaa.bat` 菜单拆分为：`4` 为一键普通推送（不带 `--force`），`5` 为一键强制推送（`git push --force`）。
  3. 对上一轮（`000044`）修复的侧边栏分割条点击误移位问题补齐内置浏览器真实点击/按住/微抖/拖拽与刷新持久化回归验收。

## 变更文件清单

- `e:\lfaa\AGENTS.md`：在 `§5`、`§6` 与 `§8` 补充并强化「内置浏览器实测验收（强制）」条款，明确未完成内置浏览器实测验收不得报告“已完成”。
- `e:\lfaa\docs\standards\AI-Agent-Development-Standards.md`：在 `§8.1`（UI 测试）与 `§13`（Agent 最终验收检查清单）同步写入内置浏览器实测验收要求。
- `e:\lfaa\scripts\lfaa.ps1`：将 `Push-ForceToGitHub` 重构为 `Push-ToGitHub -Force`，菜单项 `4` 改为一键推送到 `https://github.com/yubboo/LFAA.git`（`git push -u origin <当前分支>:main`），菜单项 `5` 为一键强制推送（`git push --force -u origin <当前分支>:main`），同步更新输入提示。
- `e:\lfaa\scripts\README.md`：更新菜单项 `4`（普通推送）与 `5`（强制推送）说明。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **Agent 内置浏览器实测验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 初始加载 HTTP `200`，控制台报错 `0`，左二栏 `273.59375px`、右侧栏 `259.19793701171875px`。
   - **单击 / 按住 / 1.5px 微抖防误触**：左右分割条单击、持续按住读取及 `1.5px` 微抖点击均保持宽度不变（`0px` 偏移），`data-dragging` 保持未激活、`document.body.style` 未被锁死 `col-resize`。
   - **拖拽与刷新持久化**：左二栏拖窄 `-40px` 平滑变为 `234px`，右侧栏拖宽 `-40px` 平滑变为 `299px`；刷新页面后两栏分别恢复为 `234px` 与 `299px`。
   - **自定义宽度按下回归（复现场景）**：在已持久化为 `234px`（左侧）和 `299px`（右侧）后，再次对分割条执行 `mousedown`（不移动并持续按住读数）与 `mouseup`，两栏在按住期间与松手后均稳定维持 `234px` 与 `299px`，未再出现跳回默认宽度或光标滞留。
   - 验收完成后已关闭临时测试服务（`task-122`），释放 `5173` 端口；未在本地实际执行 `git push`。
