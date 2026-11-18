# UPDATE-000009｜优化 `lfaa.bat` 依赖缓存复用并修复选项 1 报错提示

- 时间（含时区）：2026-11-17 19:14:30 +08:00
- 类型：优化
- 关联开发日志：`../dev-log/000009-20261117-1914-optimize-launcher-cache.md`

## 用户能看到的变化

- **`lfaa.bat` 选项 `2` 不再重复下载已缓存依赖**：
  - 支持识别项目目录或盘符迁移后的原安装记录，避免仅因路径变化触发全量重装。
  - 确实需要补装依赖时，先执行 `pnpm install --offline` 直接复用本地缓存（0 联网下载），仅当本地 store 确实缺少新依赖时才自动回退到 `pnpm install --prefer-offline` 仅下载缺失包。
- **`lfaa.bat` 选项 `1` 改为 `--prefer-offline` 并修复执行稳定性**：
  - 菜单 `1` 默认使用 `pnpm install --prefer-offline`，优先复用本地已下载包并只补齐缺失项。
  - 修复 PowerShell `$ErrorActionPreference = "Stop"` 下对外部命令退出码捕获的兼容性，并在安装前自动清理上次中断残留的 `*_tmp_*` 临时目录；遇到退出码 `-1` 时提示进程被中断或文件锁冲突。

## 影响范围与使用提示

- 影响 [scripts/lfaa.ps1](file:///g:/lfaa/scripts/lfaa.ps1) 与 [scripts/ensure-dependencies.mjs](file:///g:/lfaa/scripts/ensure-dependencies.mjs)。
- 当前若在可移动盘 `G:\` 完成首次安装仍需较长小文件写入时间；建议后续将项目置于本地固定磁盘（如 `D:\` 或 `E:\`）使用。

## 已知限制

- 当前 `G:\lfaa\node_modules` 仍为前次中断后的不完整状态，需先完成一次安装（菜单 `1` 或迁移到本地盘后执行）方可启动 Web。
