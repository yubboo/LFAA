# DEV-000020｜修复“本机 → 添加”资源管理器失效问题并新增目录路径直接绑定（实测 `G:\app`）

- 任务编号：000020
- 开始时间：2026-11-17 20:57:50 +08:00
- 完成时间：2026-11-17 21:15:30 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与桌面/移动双端内置浏览器实测 `G:\app` 全部通过）
- 审批级别及批准证据：A0/A1 延续批准；负责人截图圈出“本机 → 在此电脑上添加文件夹 → 添加”不可用，并明确要求排查原因与使用 `G:\app` 实测项目添加
- 关联 Issue/PR/Commit：无

## 问题根因定位

1. **PowerShell 5.1 下 `.UseDescriptionForTitle` 抛异常**：Windows PowerShell 5.1（.NET Framework 4.x）的 `System.Windows.Forms.FolderBrowserDialog` 不存在 `.UseDescriptionForTitle` 属性，执行时报错 `PropertyAssignmentException`。
2. **隐藏 `$owner` 坐标被置为 `(-32000, -32000)` 且缺少 `STARTF_USESHOWWINDOW` 处理**：旧脚本把未 `Show()` 的 `$owner` 放在 `(-32000, -32000)` 屏幕外并叠加 `windowsHide: true`，导致旧式树形框错位或被隐藏在屏幕外/窗口后。
3. **Agent 后台沙箱桌面隔离说明**：通过 `GetThreadDesktop` 检查发现 Agent 工具沙箱启动的后台开发服务运行在隔离桌面 `WinSta0\exebox-...`，其子进程无法向用户主桌面 `WinSta0\Default` 展示原生 Windows 窗口；此前调用 `pick-folder` 时会无提示阻塞直到超时。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/workspace/workspace/src/system-paths.ts` | 改用 Win32 COM `IFileOpenDialog`（`FOS_PICKFOLDERS`，现代 Windows 10/11 资源管理器弹窗）+ `CenterScreen` `TopMost` 透明 `$owner` + `ShowWindow`/`SetForegroundWindow` 与 Base64 `-EncodedCommand`；同时通过 `GetThreadDesktop` 快速识别非 `Default` 隔离桌面，避免挂起超时并返回清晰指引 |
| 修改文件 | `packages/workspace/workspace/src/index.ts` | 新增 `WorkspaceService.validateLocalFolder(folderPath)` 校验本机目录是否存在并返回规范化 `path` 与 `name` |
| 修改文件 | `packages/workspace/workspace/src/http-handler.ts` | 新增 `POST /api/workspace/validate-folder` HTTP RPC 路由 |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 新增 `validateLocalFolder(folderPath)` RPC 调用 |
| 修改文件 | `packages/workspace/workspace/client/locales.ts` | 新增内联路径输入占位与 `绑定` / `Use path` 中英文案 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectDialog.tsx` | 在 `本机` 源文件夹卡片内补充紧凑路径输入框与“绑定”按钮（亦支持直接点“创建项目”自动校验并填充名称），与“添加”按钮互补（361 行，低于 400 行阈值：表单、内联路径校验、弹窗 Portal 与信任确认步共享同一草稿与提交锁状态，保持单组件内聚） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectDialog.module.css` | 编写 `.manualPathRow` 与 `.manualPathInput` 样式（385 行，低于 400 行阈值：同一弹窗各区块样式内聚） |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 新增 `validateLocalFolder` 正常与报错用例，以及 `win32` 下 `buildFolderPickerPowerShell(..., true)` COM 编译初始化回归测试 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CfN2ZAtT.css`、`apps/web/dist/assets/index-CTSbP3XO.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000020-20261117-2115-fix-windows-folder-picker-and-path-binding.md` | 记录根因分析、文件改动与实测结果 |
| 新增文件 | `docs/updata-log/000020-20261117-2115-fix-windows-folder-picker-and-path-binding.md` | 记录“添加”按钮升级、隔离桌面快速提示与目录路径直接绑定能力 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| Node/PowerShell 实测复现与 `IFileOpenDialog` 窗体探测 | 通过 | 复现旧脚本 `UseDescriptionForTitle` `PropertyAssignmentException` 与隐藏挂起；随后在当前桌面会活测 `buildFolderPickerPowerShell("LFAA_TEST_PICKER", false)` 生成 `#32770` 对话框 `visible=True` 并成功响应关闭 |
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例通过（包含 `Windows 原生资源管理器 IFileOpenDialog COM 脚本可编译并完成初始化` 返回 `COM_READY` 与 `validateLocalFolder` 校验） |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，输出 `dist/assets/index-CfN2ZAtT.css`（`54.75 kB`）与 `dist/assets/index-CTSbP3XO.js`（`352.55 kB`），耗时 `826ms` |
| 内置浏览器端到端实测 `G:\app`（`http://127.0.0.1:5173/`，`1440×900` & `390×844`） | 通过 | HTTP 200，0 条控制台/页面错误；在 `本机` 点“添加”立即返回沙箱隔离桌面明确提示（无卡死）；输入 `G:\app` 点“绑定”触发 `POST /api/workspace/validate-folder` 返回 `200` `{"path":"G:\\app","name":"app"}` 并自动填充项目名 `app`；点“创建项目”整页居中弹出“信任此文件夹吗？”展示 `G:\app`（中心 `(719.99, 450.00)`）；点“信任文件夹”返回 `201`，主工作区显示 `G:\app` 与空目录就绪提示，“刷新目录”返回 `200`；`390×844` 下工作区与内联路径输入框弹窗均 `0` 横向溢出；点击“从项目列表移除”恢复空状态，`G:\app` 磁盘目录保持 0 文件修改 |
| 用户主桌面 `WinSta0\Default` 下手动点击 `添加` 呼出 `IFileOpenDialog` | 待用户在本地终端运行 `pnpm lfaa web` 后交互验证 | Agent 运行时处于 `WinSta0\exebox-...` 隔离桌面，无法跨桌面交互用户 `WinSta0\Default`；`IFileOpenDialog` COM 自身及独立窗口 `visible=True` 已在同会话内实测验证 |

## 风险、回滚与遗留问题

- 风险：无；`G:\app` 仅做只读 `stat`/`readdir` 检验与索引移除，未改动其磁盘内容。
- 回滚办法：还原上述修改文件，重新运行 `pnpm run build` 并重启 `pnpm lfaa web`，删除本轮 `000020` 两份日志。
- 遗留问题：若需要在浏览器内一键呼出可见的 Windows 资源管理器窗口选择文件夹，需在本地普通终端（`WinSta0\Default` 会话）运行 `pnpm lfaa web`；若在受限/沙箱浏览器预览中，可直接在弹窗的“或直接输入本机文件夹路径”输入框绑定任意目录（如 `G:\app`）。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：修复了点击“添加”卡顿/报错问题并新增本机文件夹路径直接绑定输入，已同步新增同编号 `updata-log`。
