# LFAA 更新日志

> 根目录只保留当前索引和最近版本。
> 历史详细记录放入 `docs/changelog/`。

## #11 Git Clone 后一键更新源码

- 产品：Little Fish AI Agent
- 简称：LFAA
- 用户版本：v0.0.10
- 状态：delivered
- 日期：2026-09-18

### 完成

- 新增 `LFAA-Update.bat`。
- 新增 `scripts/windows/lfaa-update.ps1`。
- Git Clone 以后无需重新克隆即可一键检查/拉取最新源码。
- 更新前检测本地未提交修改。
- Fetch 后比较本地领先/落后状态。
- 远程更新文件按新增/修改/删除/重命名彩色列举。
- 只允许安全的 `git pull --ff-only`。
- 本地/远程分叉时停止，不自动改写历史。
- 更新后校验 HEAD 与远程一致。
- 更新日志进入 `docs/logs/source-update/`。
- 成功后明确提示可以关闭终端。
- 当前主业务模块仍为 `config-system`。

完整记录：

`docs/changelog/v0.0.10.md`

## #10 移除 Commit 二次确认

历史版本：

`docs/changelog/v0.0.9.md`
