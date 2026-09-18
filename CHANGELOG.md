# LFAA 更新日志

> 根目录只保留当前索引和最近版本。

## #4.3 / #20.4 PowerShell 编码保护与开发规范执行闭环

- 用户版本：v0.0.42
- 状态：delivered
- 日期：2026-09-18
- 以 v0.0.41 为历史基线，不覆盖旧包；本版本专门修复 v0.0.41 的 Windows PowerShell 编码回归。
- 恢复 `scripts/windows/lfaa-sync.ps1`、`lfaa-github.ps1`、`lfaa-setup.ps1`、`lfaa-update.ps1` 的 UTF-8 BOM，保持原业务逻辑不变。
- 新增 `scripts/windows-script-encoding-check.mjs`，发布前强制检查 `.ps1` BOM、严格 UTF-8 和 BAT → PowerShell 入口关系。
- 新增 `scripts/release-consistency-check.mjs`，以 `lfaa.release.json` 为唯一版本事实源，检查 package / crate / README / CHANGELOG / Release 新旧版本一致性。
- `DEVELOPMENT.md` / `AGENTS.md` 增加“按照开发规范开发”强制触发器：必须真实执行读取、Plan/Prompt、实现、Progress/Log、Standards、Changelog/Release、门禁、递增版本全过程。
- #20.3 进入 Archive，当前开发规范变更为 #20.4；#4 增加 #4.3 PowerShell 脚本编码保护历史记录。

详细记录：

`docs/changelog/v0.0.42.md`
