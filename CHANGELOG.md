# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

## #12 Windows 脚本菜单化与强制拉取

- 产品：Little Fish AI Agent
- 简称：LFAA
- 用户版本：v0.0.11
- 状态：delivered
- 日期：2026-09-18

### 完成

- `LFAA-Update.bat` 改为数字菜单。
- 新增安全拉取、强制拉取、仅检查更新、退出。
- 强制拉取自动创建备份分支和 stash 后再对齐远程。
- `LFAA-GitHub.bat` 改为数字菜单。
- Git 推送脚本增加查看状态和修改 origin。
- `LFAA-Sync.bat` 改为数字菜单。
- 同步脚本增加仅预览和查看配置。
- 三个脚本双击后不再直接执行写操作。
- 退出和每种完成状态均明确提示可关闭终端。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.11.md`
