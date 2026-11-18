# DEV-000023｜实现项目“···”点击操作菜单并完善点击后抑制悬停卡片交互

- 任务编号：000023
- 开始时间：2026-11-17 21:43:53 +08:00
- 完成时间：2026-11-17 21:54:00 +08:00
- 类型：feat
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与桌面/移动双端内置浏览器状态机实测通过）
- 审批级别及批准证据：A1；负责人附设计截图明确要求点击项目行 `···` 弹出操作菜单悬浮卡片（置顶、编辑、分区、在资源管理器中打开、归档聊天禁用态、移除项目），且点击后 hover 不再显示信息卡片，直至鼠标移出后重新移入再显示
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  1. 建立精确的 Hover vs Click 状态机（抽离至 `useProjectMenus.ts`）：悬停 `···` 显示项目详情悬浮卡；点击 `···` 立即隐藏信息悬浮卡并在 `···` 下方弹出操作菜单，且设置 `suppressHoverId` 抑制滞留 hover（包含再次点击关闭菜单后指针仍在按钮上的情况），直到指针移开 `···` 后重新移入才恢复触发悬停信息卡。
  2. 实现 `ProjectActionMenu` 液态玻璃下拉菜单，包含：`置顶` / `取消置顶`、`编辑`、`分区 >`（子菜单支持切换 `置顶分组` / `项目分组`，并诚实标示 `自定义分区（暂未接入）` 为禁用态）、`在资源管理器中打开`、`归档聊天`（无对话时禁用态）与 `移除项目`。
  3. 在 Host `WorkspaceService` 与 HTTP RPC 接入 `openFolderInExplorer`（`POST /api/workspace/projects/:id/open-explorer`），在标准 Windows `Default` 桌面使用 `explorer.exe <rootPath>` 打开真实目录，在 Agent 沙箱隔离桌面返回明确不卡死的提示。
- 不在范围：接入聊天归档运行时、实现自定义分组后端存储。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/src/index.ts` | 在 `WorkbenchProjectProvider` 增加可选 `removeProject` 与 `openProjectInExplorer` 契约方法 |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 新增操作菜单、`分区` 子菜单、`在资源管理器中打开`、`归档聊天` 禁用态及 `移除项目` 中英词条 |
| 新增文件 | `packages/ui/layout/client/useProjectMenus.ts` | 抽离项目行 `···` Hover 信息卡片与 Click 操作菜单状态机（`95` 行），管理防抖及点击后抑制 hover 直至重新移入规则 |
| 新增文件 | `packages/ui/layout/client/components/ProjectActionMenu.tsx` | 实现点击 `···` 下方弹出的 Portal 操作菜单及右侧/自适应子菜单（`245` 行） |
| 新增文件 | `packages/ui/layout/client/components/ProjectActionMenu.module.css` | 编写操作菜单、子菜单及禁用项样式（`114` 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 接入 `useProjectMenus` 与 `ProjectActionMenu`，保持单文件简洁（`345` 行，低于 400 上限） |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.tsx` | 透传 `onOpenProjectInExplorer` 与 `onRemoveProject` |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 将 `projectProvider.openProjectInExplorer` 与 `removeProject` 传入 `NavigationSidebar` |
| 修改文件 | `packages/workspace/workspace/src/system-paths.ts` | 新增 `openFolderInExplorer`（`explorer.exe` 拉起项目目录并复用隔离桌面快速检测，`294` 行，低于 300 阈值） |
| 修改文件 | `packages/workspace/workspace/src/index.ts` | 新增 `WorkspaceService.openProjectFolderInExplorer(projectId)`（`339` 行，>300 自检：保持 Host 服务单责内聚且远低于 500 拆分上限） |
| 修改文件 | `packages/workspace/workspace/src/http-handler.ts` | 新增 `POST /api/workspace/projects/:id/open-explorer` HTTP 路由 |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 新增 `openProjectInExplorer(projectId)` RPC 调用 |
| 修改文件 | `packages/workspace/workspace/client/index.tsx` | 绑定 `removeProject`（删除后自动退出该项目页）与 `openProjectInExplorer` |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 增加 `openProjectInExplorer` 与 `removeProject` 服务贡献检查 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BpG9scTR.css`、`apps/web/dist/assets/index-BRjohAhA.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000023-20261117-2153-project-more-action-menu.md` | 记录操作菜单实现、交互状态机及验证结果 |
| 新增文件 | `docs/updata-log/000023-20261117-2153-project-more-action-menu.md` | 记录用户可见的 `···` 下拉菜单与悬停互斥改进 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例全过 |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6620 个模块，输出 `dist/assets/index-BpG9scTR.css`（`65.39 kB`）与 `dist/assets/index-BRjohAhA.js`（`375.94 kB`），耗时 `843ms` |
| 内置浏览器交互状态机与双端布局实测（`http://127.0.0.1:5173/`，`1440×900` & `390×844`） | 通过 | 0 条控制台/页面错误；移入 `app` 行 `···` 正常弹出 `ProjectHoverCard`；点击 `···` 后信息卡立即消失且下方弹出操作菜单（`moreBottom=284.56, menu.y=290.55`），完整展示 `置顶`、`编辑`、`分区 >`（子菜单含 `置顶分组`、`项目分组` 与禁用 `自定义分区（暂未接入）`）、`在资源管理器中打开`（点击触发 `POST /open-explorer` 200 并给出隔离桌面提示）、禁用 `归档聊天` 及 `移除项目`；再次点击 `···` 收起菜单且指针滞留按钮上 `hoverAfterToggleClose=false`，移出后再移入 `hoverAfterReenter=true`；`390×844` 下菜单宽 `237.99px`（`x+width=377.99 <= 390`）无溢出 |

## 风险、回滚与遗留问题

- 风险：无；既有项目 `app1` 与 `app` 完好保留。
- 回滚办法：删除 `useProjectMenus.ts` 与 `ProjectActionMenu.*`，还原修改文件并重新执行 `pnpm run build` 与重启 `pnpm lfaa web`，删除本轮 `000023` 两份日志。
- 遗留问题：“在资源管理器中打开”在本地终端直接运行 `pnpm lfaa web`（`WinSta0\Default`）时可直接呼出 Windows 资源管理器窗口；在后台 Agent 沙箱隔离桌面下受限于跨桌面安全边界仅显示清晰提示。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：新增 `···` 点击操作菜单及悬停互斥状态控制，已同步新增同编号 `updata-log`。
