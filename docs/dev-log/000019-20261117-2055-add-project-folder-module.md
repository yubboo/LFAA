# DEV-000019｜实现首个功能模块“添加项目与本地项目工作区”

- 任务编号：000019
- 开始时间：2026-11-17 20:32:00 +08:00
- 完成时间：2026-11-17 20:56:00 +08:00
- 类型：feat
- 状态：完成（Cordis 单元测试、`typecheck`、`build` 与桌面/移动双端内置浏览器实测通过）
- 审批级别及批准证据：A1；负责人明确要求新增首个“添加项目”功能模块（支持资源管理器选目录、未选目录时按名称自动创建在动态检测的系统“文档\lfaa”下，并弹出“信任此文件夹吗？”确认框后按项目目录工作，无项目时显示 `+ 创建新项目`）
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  1. 在 `@lfaa/workspace` 建立真正的 Host 侧 `WorkspaceService`（`getStorageMode() === "host-fs"`）与 `/api/workspace/*` RPC 接口，保持 Host 禁止导入 React/DOM/CSS、Client 禁止直接导入 Node 实现的隔离边界。
  2. 无项目时，左二“项目”分组直接显示可点击的 `+ 创建新项目` 入口；新建入口同时保留在分组标题 `+` 按钮。
  3. 重构“创建项目”弹窗为双标签源文件夹选择器（`本机` 支持调用 Windows 系统原生 `FolderBrowserDialog` 打开资源管理器选择文件夹，自动回填项目名称；`远程` 诚实提示暂未接入，不伪造远端数据）。
  4. 当用户仅输入项目名称（如 `app1`）而未选择源文件夹时，通过系统当前用户“文档”目录（如本机重定向后的 `D:\系统\文档`，禁止写死 `C:\Users\...\Documents`）解析生成 `<MyDocuments>\lfaa\<folderName>`，若已存在则自动递增 `app1 2`、`app1 3` 避让冲突。
  5. 创建前展示“信任此文件夹吗？”二次确认弹窗，明确列出即将授权的目标完整路径；确认“信任文件夹”后落盘创建/持久化到 `~/.lfaa/projects.json`，并在主工作区展示真实 `rootPath` 与实时目录内容、右侧上下文面板展示项目元数据与安全“从项目列表移除”操作（仅删列表记录，不删磁盘文件）。
- 不在范围：远程 SSH/云工作区连接协议实现、AI 对话运行时或终端会话执行器。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/src/index.ts` | 在 `WorkbenchProjectItem` 中补充 `rootPath`、`locationType`、`trusted` 字段 |
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.tsx` | 为 `SidebarGroupConfig` 增加可选 `emptyAction`，支持无项目时在左二列表内渲染动作按钮 |
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 新增 `.emptyAction` 样式 |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 新增 `createNewProject` 并更新本地项目库描述文案（319 行：纯中英 UI 词典映射表，保持单文件内聚便于对照，未拆零碎词表） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 默认展开 `projects` 分组并在无项目时向 `SidebarSectionList` 传入 `+ 创建新项目` 空状态动作 |
| 新增文件 | `packages/workspace/workspace/src/types.ts` | 定义 Host/Client 共享的项目摘要、目录条目、默认路径解析与建项入参类型 |
| 新增文件 | `packages/workspace/workspace/src/system-paths.ts` | 通过 `[Environment]::GetFolderPath('MyDocuments')` 动态获取当前系统“文档”目录，实现目录名安全清洗、重名递增解析与 Windows `-STA` 原生资源管理器目录选择器 |
| 新增文件 | `packages/workspace/workspace/src/http-handler.ts` | 实现 `/api/workspace/projects`、`/resolve-path`、`/pick-folder`、`/inspect` 与 `DELETE` HTTP RPC 路由 |
| 修改文件 | `packages/workspace/workspace/src/index.ts` | 重写 `WorkspaceService`（`host-fs` 模式、`~/.lfaa/projects.json` 读写、`trusted === true` 强制校验、`inspectProject` 限制最多 200 条目）及可选配置版 `workspacePlugin` |
| 修改文件 | `packages/workspace/workspace/client/locales.ts` | 更新源文件夹选择、远程未接入提示、信任确认框、目录浏览与移除操作的中英词条 |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 切换为 `/api/workspace/*` RPC 客户端存储，补充 `readJsonSafe` 容错解析、无 DOM 环境判断与 `dispose()` 清理 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectDialog.tsx` | 实现经 `createPortal` 挂载的双步液态玻璃弹窗（创建表单 + “信任此文件夹吗？”确认框）（292 行，低于 400 行阈值：两步共享同一表单草稿与门户遮罩状态，单文件内聚更易维护） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectDialog.module.css` | 为双步弹窗、源文件夹卡片、路径高亮块与按钮区编写桌面/移动端样式（359 行，低于 400 行阈值：全部样式服务同一弹窗组件） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.tsx` | 展示项目真实 `rootPath`、刷新目录按钮、目录/文件数量与文件树列表，以及总览页路径显示 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.module.css` | 编写项目目录头、刷新操作与目录条目列表样式 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectContextPanel.tsx` | 在右侧上下文面板展示 `rootPath`、`~/.lfaa/projects.json` 提示与“从项目列表移除”按钮 |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectContextPanel.module.css` | 为路径回行显示与移除操作区增加样式 |
| 修改文件 | `packages/workspace/workspace/client/index.tsx` | 连接 `LocalProjectStore`、移除后导航回 `"workspace"` 与插件卸载 `store.dispose()` 清理 |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 注册 Node `.css` 测试桩，更新 `host-fs` 断言并补充 `os.tmpdir()` 下的默认路径解析、重名递增、信任校验、目录检查与移除回归测试 |
| 修改文件 | `apps/web/src/server.ts` | 在 `createServer` 内注册 Host `workspacePlugin` 并通过 Vite `configureServer` 前置中间件挂载 `/api/workspace/*`（确保早于 Vite SPA HTML 回退中间件执行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BGIs-jbu.css`、`apps/web/dist/assets/index-yFmG94oc.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000019-20261117-2055-add-project-folder-module.md` | 记录本轮实现、超 250/300 行文件自检结论与完整验证结果 |
| 新增文件 | `docs/updata-log/000019-20261117-2055-add-project-folder-module.md` | 记录用户可见的新增“添加项目与本地目录工作区”功能 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `powershell.exe` 验证 `[Environment]::GetFolderPath('MyDocuments')` | 通过 | 返回当前系统实际文档目录 `D:\系统\文档` |
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 4/4 用例全过：`WORKBENCH_REGIONS` 校验、`host-fs` 生命周期清理、`resolveDefaultProjectPath` 重名递增与 `trusted` 校验 + `inspectProject`/`removeProject`、`WorkbenchClientService` 与 `workspaceClientPlugin` 卸载清理 |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，输出 `dist/assets/index-BGIs-jbu.css` 与 `dist/assets/index-yFmG94oc.js`，耗时 `897ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900` 与 `390×844`） | 通过 | HTTP 200，0 条控制台/页面错误；无项目时左二显示 `+ 创建新项目`；打开“创建项目”后可切 `本机`/`远程`（`远程` 明确提示未接入，`本机` 显示 `添加` 按钮）；输入 `lfaa-verify-tmp` 提交 `POST /api/workspace/projects/resolve-path` 返回 `D:\系统\文档\lfaa\lfaa-verify-tmp` 并弹出“信任此文件夹吗？”；点击“信任文件夹”创建 `201` 并进入项目工作区、`inspect` `200`、右侧栏展示完整路径与“从项目列表移除”；`390×844` 移动端对话框宽 `358px`、项目工作区与路径块宽 `357.99px`，`0` 横向溢出；点击“从项目列表移除”后左二恢复 `+ 创建新项目`；事后已清理测试临时目录 `D:\系统\文档\lfaa\lfaa-verify-tmp` |
| Windows 原生资源管理器 `FolderBrowserDialog` UI 点击 | 未直接通过浏览器自动化交互 | 浏览器沙箱内未点击阻塞式原生 WinForms 系统弹窗；目录选择后端 API（`/api/workspace/pick-folder`）通过按钮可用性与单元测试中注入 `folderPicker` 桩覆盖 |

## 风险、回滚与遗留问题

- 风险：真实 WinForms `FolderBrowserDialog` 依赖本机桌面交互会话，当前仅在 Node 单元测试中以注入桩函数验证返回值消费链路，未在 Playwright 中模拟点击系统原生窗口。
- 回滚办法：恢复本轮修改的文件、删除新增的 `src/types.ts` / `src/system-paths.ts` / `src/http-handler.ts` 与两份 `000019` 日志、清理测试目录并重新执行 `pnpm run build`。
- 遗留问题：远程项目连接仍保持未接入状态；后续实现远程 SSH/Agent 工作区时可在 `SourceMode === "remote"` 下挂载真实远端浏览器视图。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：新增首个“添加项目与本地目录工作区”模块，已同步新增同编号 `updata-log`。
