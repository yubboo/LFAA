# DEV-000021｜实现项目行悬停操作（`···` / 新聊天）、悬浮详情卡、项目置顶与“编辑项目”弹窗

- 任务编号：000021
- 开始时间：2026-11-17 21:27:13 +08:00
- 完成时间：2026-11-17 21:44:00 +08:00
- 类型：feat
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与桌面/移动双端内置浏览器实测通过）
- 审批级别及批准证据：A1；负责人附 3 张设计参考图明确要求新增项目行悬停 `···`（悬浮信息卡含项目名、右侧置顶、`0 次聊天`、源文件夹与“编辑项目”入口）、行尾“在该项目里开新聊天”按钮，以及“编辑项目”弹窗
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  1. 在左二导航栏项目行（同时兼容 `置顶` 与 `项目` 分组）支持鼠标移入/聚焦显示右侧 `···`（查看项目信息）与 `✎`（在该项目里开新聊天）操作按钮，触控端默认可见。
  2. 悬停或点击 `···` 后通过 `createPortal` 在左二外侧约 `8px` 处弹出液态玻璃悬浮项目信息卡，展示项目名、右侧图钉置顶开关、真实聊天计数（当前为 `0 次聊天`）、全部源文件夹（目录短名 + 完整路径）及“编辑项目”入口；置顶后项目自动显示于左二 `置顶` 分组。
  3. 点击项目行 `✎` 定位到对应项目并展示清晰诚实的项目内新聊天就绪提示（不伪造聊天消息或虚增计数）。
  4. 实现整页居中“编辑项目”弹窗：支持修改项目名、列出/移除/继续添加多个本机源文件夹（同样支持 Windows 资源管理器与隔离桌面内联路径绑定）、左下角红色按钮“移除本地项目”以及右下角“取消 / 保存”，并在 Host 持久化 `rootPaths` 与 `pinned` 状态。
- 不在范围：接入真实 AI 对话运行时、生成假会话列表或伪造远端同步。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/src/index.ts` | 在 `WorkbenchProjectItem` 增加 `rootPaths`、`pinned`、`chatCount`，在 `WorkbenchProjectProvider` 增加可选 `renderEditDialog` 与 `togglePinProject` 契约 |
| 修改文件 | `packages/workspace/workspace/src/types.ts` | 在 `WorkspaceProjectSummary` 补充 `rootPaths`、`pinned`、`chatCount`，新增 `UpdateProjectInput` |
| 修改文件 | `packages/workspace/workspace/src/index.ts` | 支持向后兼容读取/保存多源文件夹 `rootPaths` 与 `pinned`，新增 `WorkspaceService.updateProject`（`308` 行：>300 阈值自检：服务类单责聚焦项目管理 CRUD，均低于 500 拆分上限）及 `inspectProject(id, rootPath?)` 指定目录检视 |
| 修改文件 | `packages/workspace/workspace/src/http-handler.ts` | 新增 `PATCH /api/workspace/projects/:id` 路由，并支持 `/inspect?path=...` 多目录切换查看 |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 新增 `updateProject`、`togglePinProject` 及多目录 `inspectProject` 查询支持 |
| 修改文件 | `packages/workspace/workspace/client/locales.ts` | 补充“编辑项目”、“保存”、“移除本地项目”、“添加文件夹”等中英词条 |
| 新增文件 | `packages/workspace/workspace/client/components/EditProjectDialog.tsx` | 实现“编辑项目”整页居中弹窗（支持改名、多文件夹增删与左下角安全移除项目；`295` 行，>250 阈值自检：表单、路径校验与操作按钮紧耦合且 <400 上限） |
| 新增文件 | `packages/workspace/workspace/client/components/EditProjectDialog.module.css` | 编写编辑项目弹窗液态玻璃与多源文件夹卡片样式（`309` 行，>250 阈值自检：独立弹窗单文件内聚且 <400 上限） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.tsx` | 当项目绑定多个 `rootPaths` 时在主工作区提供可切换目录页签 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.module.css` | 新增多目录切换页签 `.folderTabs` 样式 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectContextPanel.tsx` | 在右侧上下文面板展示全部已绑定的工作目录路径 |
| 修改文件 | `packages/workspace/workspace/client/index.tsx` | 向 `registerProjectProvider` 接入 `renderEditDialog` 与 `togglePinProject` |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 补充悬浮卡、置顶、项目内新聊天与编辑入口的中英词条（`335` 行：>300 阈值自检：全量 UI 中英字典映射表） |
| 新增文件 | `packages/ui/layout/client/components/ProjectHoverCard.tsx` | 实现 `···` 触发的 Portal 悬浮项目信息卡片，包含置顶开关、聊天数、源文件夹清单与“编辑项目”入口，并在窄屏自动对齐防溢出 |
| 新增文件 | `packages/ui/layout/client/components/ProjectHoverCard.module.css` | 编写悬浮项目信息卡片液态玻璃样式 |
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.tsx` | 为 `SidebarItemConfig` 增加 `actions`、`actionsVisible` 与 `data-sidebar-item`，支持项目行右侧动作区 |
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 实现 `.itemRow` / `.rowActions` 悬停及键盘焦点显隐与触屏端常驻支持（`279` 行，>250 阈值自检：列表原语样式内聚且 <400 上限） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 将 `pinned` 项目渲染到 `置顶` 分组、未置顶项目保留在 `项目` 分组，接入 `···`（外沿 `section-navigation` 右边界对齐 + `220ms` 移动防抖）与 `✎` 行尾按钮及编辑弹窗挂载（`346` 行，>250 阈值自检：统一协调三组、弹窗与悬浮锚点状态且 <400 上限） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 新增 `.rowActionBtn` 行尾动作按钮样式 |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.tsx` | 透传 `renderEditDialog`、`onTogglePinProject`、`onNewChatInProject`、`onProjectUpdated`、`onProjectRemoved`（`256` 行，>250 阈值自检：主导航框骨架透传属性且 <400 上限） |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 接入 `startNewChatInProject`、编辑后更新/移除近期记录同步，并在项目工作区展示项目内新聊天就绪提示（`304` 行，>250 阈值自检：四栏/三栏总装骨架组件且 <400 上限） |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | 新增 `.projectViewHost` 与 `.projectNotice` 样式（`394` 行，>250 阈值自检：主体骨架与主题变量定义文件，低于 400 上限） |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 新增 `updateProject`（改名、置顶、多目录与空目录报错校验）、多目录 `inspectProject` 及 `renderEditDialog` / `togglePinProject` 注册验证用例 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BJjUnFj3.css`、`apps/web/dist/assets/index-CmQT807l.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000021-20261117-2143-project-hover-card-and-edit-dialog.md` | 记录新增功能、超 250/300 行文件自检与双端实测结果 |
| 新增文件 | `docs/updata-log/000021-20261117-2143-project-hover-card-and-edit-dialog.md` | 记录用户可见的左二项目悬停信息卡、置顶与编辑项目弹窗能力 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例全过（含 `updateProject` 改名/置顶/多 `rootPaths` 持久化与校验、`inspectProject` 多目录切换及 `renderEditDialog`/`togglePinProject` 生命周期） |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6617 个模块，输出 `dist/assets/index-BJjUnFj3.css`（`63.77 kB`）与 `dist/assets/index-CmQT807l.js`（`368.16 kB`），耗时 `850ms` |
| 内置浏览器全链路实测（`http://127.0.0.1:5173/`，`1440×900` & `390×844`） | 通过 | HTTP 200，0 条控制台/页面错误；创建临时 `G:\app` 测试项目验证悬停显示 `···` 与 `✎`，移入卡片无闪烁并显示项目名、置顶、`0 次聊天`、`G:\app` 与“编辑项目”；实测置顶移入 `置顶` 与取消置顶回归 `项目`（`PATCH` 200）；实测点 `✎` 展示项目内新聊天就绪提示；实测“编辑项目”整页居中改名保存与移动端 `390×844` 无横向溢出，并通过“移除本地项目”清理临时测试项（保留用户既有 `app1`/`app` 项目完好）；最终对齐复测确认桌面端悬浮卡紧贴左二栏右缘外侧 `7.99px`（`sidebarRight=343.19`, `card.x=351.18`）且截图视觉验收通过 |

## 风险、回滚与遗留问题

- 风险：无；用户磁盘既有 `app1` 与 `app`（`G:\app`）及索引均完整保留未受测试数据干扰。
- 回滚办法：删除新增的 `ProjectHoverCard.*` 与 `EditProjectDialog.*`、还原其余修改文件并重新执行 `pnpm run build` 与重启 `pnpm lfaa web`，删除本轮 `000021` 两份日志。
- 遗留问题：悬浮信息卡中 `0 次聊天` 当前随对话运行时暂未接入保持真实值 `0`，后续聊天存储接入后可直接由 Host `WorkspaceProjectSummary.chatCount` 自动同步真实会话计数。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：新增左二项目行悬停操作、悬浮信息卡、项目置顶与“编辑项目”弹窗，已同步新增同编号 `updata-log`。
