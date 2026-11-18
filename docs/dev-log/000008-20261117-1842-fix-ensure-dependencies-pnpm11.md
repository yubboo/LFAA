# DEV-000008｜修复依赖增量安装对 pnpm 11 的参数兼容与 Node 24 警告

- 任务编号：000008
- 开始时间：2026-11-17 18:39:11 +08:00
- 完成时间：2026-11-17 18:42:48 +08:00
- 类型：fix
- 状态：完成（脚本参数与警告修复并验证；当前工作区 `node_modules` 重建需用户通过菜单 1 交互确认）
- 审批级别及批准证据：A0；用户反馈 `lfaa.bat` 选项 2 报错并请求排查处理
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：定位并修复 `lfaa.bat` 菜单 `2` 调用 `scripts/ensure-dependencies.mjs` 时触发的 `[ERROR] Unknown option: 'confirmModulesPurge'` 错误与 Node.js v24 `DEP0190` 警告。
- 不在范围：自动清空或重建 `node_modules`、绕过 pnpm 非 TTY 保护、改动 `pnpm-lock.yaml` 或各包源码。

## 实际修改的文件与文件夹

项目根目录：`G:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `scripts/ensure-dependencies.mjs` | 移除 pnpm 11 不支持的 `--confirmModulesPurge=true` CLI 参数及无效环境变量，改为 `CI: "false"` 并保持无 TTY；Windows 下改用 `cmd.exe /d /s /c pnpm.cmd install` 消除 `DEP0190` 警告；补充文件头注释与失败后执行菜单 `1` 的提示 |
| 新增文件 | `docs/dev-log/000008-20261117-1842-fix-ensure-dependencies-pnpm11.md` | 记录根因分析、变更清单与验证结果 |
| 新增文件 | `docs/updata-log/000008-20261117-1842-fix-ensure-dependencies-pnpm11.md` | 记录开发者可见的 `lfaa.bat` 选项 2 报错修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `node --check scripts/ensure-dependencies.mjs` | 通过 | 退出码 `0`；语法检查通过 |
| `node scripts/ensure-dependencies.mjs --check-only` | 通过（按预期返回状态 `2`） | 正确识别 `apps/web` 与 `pnpm-lock.yaml` 不一致，未修改磁盘 |
| `node scripts/ensure-dependencies.mjs` | 按设计安全中止（退出码 `1`） | 不再报 `Unknown option: 'confirmModulesPurge'` 与 `DEP0190`；因当前 `node_modules/.modules.yaml` 记录旧目录 `F:\lfaa\node_modules\.pnpm` 与 `F:\.pnpm-store\v11`，pnpm 11.17.0 要求重建 `node_modules` 并在无 TTY 下抛出 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 安全中止，随后输出运行菜单 `1` 的引导 |
| `pnpm install --dry-run` | 通过（修改前只读检查） | 确认待同步变更：`apps/web` 新增 `@lfaa/workspace workspace:*`，新增工作区包 `packages/workspace/workspace` |
| `pnpm run typecheck` / `pnpm run build` / `lfaa.bat` 交互菜单启动 Web | 未运行 | 当前仓库尚未通过菜单 `1`（`pnpm install`）同步 `@lfaa/workspace` 与更新 `node_modules` 路径 |

## 风险、回滚与遗留问题

- 风险：本轮仅修复 `scripts/ensure-dependencies.mjs`，未静默删除或重建 `node_modules`；在当前工作区目录（`G:\lfaa`）与原安装记录（`F:\lfaa`）不一致且 `pnpm-lock.yaml` 尚未包含 `@lfaa/workspace` 前，菜单 `2` 的非交互增量安装会按安全策略中止。
- 回滚办法：将 `scripts/ensure-dependencies.mjs` 恢复至修改前内容，并删除本轮新增的两份日志文件。
- 遗留问题：需用户在终端运行 `lfaa.bat` 选择 `1. 安装依赖（pnpm install）`（或直接执行 `pnpm install`）交互确认同步依赖与 `node_modules` 后，再选择 `2. 启动 Web（pnpm lfaa web）`。
- Git 状态及提交：`G:\lfaa` 不是 Git 仓库；无法运行 `git diff`，已人工核对变更路径；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：修复了菜单 `2` 启动前依赖检查的命令参数错误和警告，并完善失败引导，已新增同编号 `updata-log`。
