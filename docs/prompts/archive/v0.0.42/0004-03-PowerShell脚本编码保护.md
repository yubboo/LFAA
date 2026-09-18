# #4.3 PowerShell 脚本编码保护

## 主模块

`project-foundation / workspace-sync`

## 任务目标

修复 v0.0.41 因 PowerShell 脚本 UTF-8 BOM 被移除导致的 Windows PowerShell 5.1 兼容性回归，并建立发布前自动编码门禁。

## 当前约束

- v0.0.41 不覆盖，作为历史缺陷版本保留；
- 修复进入 v0.0.42；
- Sync 业务算法不改，只恢复可执行编码契约；
- GitHub / Setup / Update 同类 `.ps1` 一并恢复 BOM；
- `.git` 稳定工作区规则不变；
- 发布 ZIP 不允许双层根目录。

## 验收

- `scripts/windows/*.ps1` 全部 UTF-8 with BOM；
- 编码门禁进入 governance；
- ZIP 解压后 BOM 仍存在；
- 同步目标逻辑仍与 v0.0.40/v0.0.41 一致。

## 状态

`delivered / v0.0.42`
