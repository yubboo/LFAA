# UPDATE-000008｜修复 `lfaa.bat` 选项 2 依赖增量安装报错

- 时间（含时区）：2026-11-17 18:42:48 +08:00
- 类型：修复
- 关联开发日志：`../dev-log/000008-20261117-1842-fix-ensure-dependencies-pnpm11.md`

## 用户能看到的变化

- 修复了选择 `lfaa.bat` 的 `2. 启动 Web（pnpm lfaa web）` 时因向 pnpm 11 传递无效参数 `--confirmModulesPurge=true` 导致的 `[ERROR] Unknown option: 'confirmModulesPurge'` 报错。
- 消除了 Node.js v24 下触发的 `[DEP0190] DeprecationWarning` 子进程调用警告。
- 当 pnpm 需要重建 `node_modules` 而自动流程按安全策略中止时，错误提示现在会明确引导先运行菜单 `1` 或手动执行 `pnpm install`。

## 影响范围与使用提示

- 影响 `scripts/ensure-dependencies.mjs` 的自动增量安装路径。
- 若当前项目目录从其它盘符迁移（例如 `node_modules/.modules.yaml` 仍记录 `F:\lfaa`）或新增了工作区包导致 pnpm 提示重建 `node_modules`，请先在 `lfaa.bat` 中选择 `1` 完成一次交互式 `pnpm install` 确认，之后选项 `2` 即可通过预检并正常启动 Web。

## 已知限制

- 菜单 `2` 的自动检查仍坚持不自动确认删除 `node_modules`，遇到需要清空重建的情况会安全退出并提示手动确认。
