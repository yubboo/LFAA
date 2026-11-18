# DEV-000009｜优化启动器依赖复用本地缓存与选项 1 报错处理

- 任务编号：000009
- 开始时间：2026-11-17 19:07:14 +08:00
- 完成时间：2026-11-17 19:14:30 +08:00
- 类型：fix
- 状态：完成（脚本已修改并完成语法/离线预演验证；`G:\lfaa` 实际全量链接受可移动盘小文件 I/O 速度限制待用户确认环境后执行）
- 审批级别及批准证据：A0；用户要求优化 `lfaa.bat` 选项 `2` 复用已下载依赖、不重复下载，并反馈选项 `1` 退出码 `-1` 问题
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 让选项 `2`（`ensure-dependencies.mjs`）兼容仓库目录/盘符迁移，有差异时优先 `--offline` 复用本地 store 缓存，仅当本地缺少新依赖时才回退 `--prefer-offline` 仅下载缺失包。
  - 修复选项 `1`（`lfaa.ps1`）`Invoke-Pnpm` 在 `$ErrorActionPreference = "Stop"` 下对外部命令 stderr 与退出码的处理，改为 `--prefer-offline` 复用缓存，并在安装前清理残留 `*_tmp_*` 目录、针对 `-1` 退出码输出原因说明。
- 不在范围：更改 `@tabler/icons-react` 等包依赖选型，或在未获确认下于慢速可移动盘 `G:\` 长时间重装上万个小文件。

## 实际修改的文件与文件夹

项目根目录：`G:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `scripts/ensure-dependencies.mjs` | 保持 294 行（≤ 300）；支持跨盘符相对路径匹配 `.pnpm-workspace-state-v1.json`；安装前清理 `.pnpm` 下 `*_tmp_*` 残留；改为先执行 `pnpm install --offline`，仅在本地缺少缓存包且非无 TTY 中止时回退 `pnpm install --prefer-offline` |
| 修改文件 | `scripts/lfaa.ps1` | 保留 UTF-8 BOM；`Invoke-Pnpm` 临时切为 `Continue` 并兜底 `$LASTEXITCODE`；选项 `1` 清理残留 `*_tmp_*` 后使用 `pnpm install --prefer-offline` 并补充 `-1` 退出码说明 |
| 修改文件 | `scripts/README.md` | 同步说明选项 `1` 与选项 `2` 的本地缓存复用策略 |
| 新增文件 | `docs/dev-log/000009-20261117-1914-optimize-launcher-cache.md` | 记录本轮变更、实测瓶颈与验证记录 |
| 新增文件 | `docs/updata-log/000009-20261117-1914-optimize-launcher-cache.md` | 记录启动菜单缓存复用优化与选项 `1` 修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `(Get-Content scripts/ensure-dependencies.mjs).Count` | 通过 | 294 行（符合 ≤ 300 行上限） |
| `node --check scripts/ensure-dependencies.mjs` | 通过 | 退出码 `0` |
| `node scripts/ensure-dependencies.mjs --check-only` | 按预期返回 `2` | 正确检出 `. 缺少依赖链接 @types/node` |
| Windows PowerShell 5.1 `Parser::ParseFile` 解析 `scripts/lfaa.ps1` + BOM 检查 | 通过 | BOM 为 `239 187 191`（UTF-8 BOM）；`PS51_PARSE_ERRORS: 0` |
| `pnpm install --offline --dry-run` | 通过 | 耗时 `863ms`，确认 `G:\.pnpm-store\v11` 已包含全部 90 个解析项与新增工作区包 |
| 真实完整 `pnpm install` 与 `pnpm lfaa web` 启动 | 未完成（前次被可移动盘 I/O 阻塞中断） | 实测 `G:` 为 `Removable` 盘，50 次 hardlink 耗时 `2118 ms`；当前 `G:\lfaa\node_modules` 为中断半成品 |

## 风险、回滚与遗留问题

- 风险：`G:\lfaa\node_modules` 当前仍因前次 `task-90` 中断处于不完整状态（缺少 `@tabler/icons-react`、`@tabler/icons` 的 `package.json` 及部分顶层链接），需完成一次依赖安装后 `pnpm lfaa web` 才能运行。
- 回滚办法：将 `scripts/ensure-dependencies.mjs`、`scripts/lfaa.ps1`、`scripts/README.md` 恢复至本轮前内容并删除本轮新增两份日志。
- 遗留问题：若继续在可移动盘 `G:\` 执行首次完整安装，导入 `@tabler/icons-react` 与 `@tabler/icons`（上万个小文件）预计仍需较长时间；迁移到 `D:\` 或 `E:\` 等 `Fixed` 本地磁盘可显著缩短耗时。
- Git 状态及提交：`G:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：优化了菜单 `1` 与 `2` 的离线缓存复用与报错提示，已新增同编号 `updata-log`。
