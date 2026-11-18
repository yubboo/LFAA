# DEV-000028｜四包架构解耦（主题/布局/分区/项目）+ 新建分区完整链路 + 「最近」仅保留聊天会话

- 任务编号：000028
- 开始时间：2026-11-17 22:05:00 +08:00
- 完成时间：2026-11-17 22:28:00 +08:00
- 类型：refactor + feat + fix
- 状态：完成（Cordis 单元测试 9/9、`typecheck`、`build` 与内置浏览器桌面/移动端实测通过）
- 审批级别及批准证据：A1；负责人明确要求“灵活运用 packages 包结构，不要把全部功能都塞到一个包里面”，并要求“分区里面还有一个新建分区”与“最近是专门放聊天会话的，不放项目”
- 关联 Issue/PR/Commit：无

## 架构拆解与核心变更

1. **提取独立主题包 `@lfaa/ui-theme`（`packages/ui/theme/`）**：
   - 将原散落在 `packages/ui/layout/client/` 的外观类型定义、主题预设与自定义强调色/背景色设置整体抽离为独立 Cordis 插件包（`src/index.ts` 提供领域类型与 `THEME_PRESETS`，`client/appearance-store.ts` 同步 CSS 变量并持久化状态，`client/index.tsx` 通过 `themeClientPlugin` 向 `workbench` 注册 `appearance` 视图并在卸载时清理）。
2. **新增独立自定义分区包 `@lfaa/sections`（`packages/workspace/sections/`）**：
   - Host 层（`src/index.ts`、`src/types.ts`、`src/http-handler.ts`）通过 Cordis `sectionsPlugin` 提供自定义分区 CRUD、重名校验、`~/.lfaa/sections.json` 持久化、`/api/workspace/sections*` REST 接口与 `onSectionRemoved` 删除事件。
   - Client 层（`client/section-store.ts`、`client/components/SectionDialog.*`、`client/components/SectionRowActions.*`、`client/index.tsx`）通过 `sectionsClientPlugin` 向 `workbench` 注册 `WorkbenchSectionProvider`，支持在 `置顶` 与 `项目` 之间渲染可折叠自定义分区、空分区拖放提示“将聊天、页面或项目拖放到这里”、重命名/删除分区弹窗与新建聊天入口。
3. **将项目专属 UI 归位至 `@lfaa/workspace`（`packages/workspace/workspace/`）**：
   - 将原放在 `packages/ui/layout/` 内的 `ProjectHoverCard.*`、`ProjectActionMenu.*` 与悬浮/右键菜单状态管理迁回 `packages/workspace/workspace/client/`（`project-menu-store.ts`、`components/ProjectRowActions.*`、`components/ProjectOverlays.tsx`）。
   - Host 与 Client 同步新增项目 `sectionId` 归属字段、`PATCH` 分区指派（`assignSection`）、`clearSection` 清理机制（监听 `onSectionRemoved` / `"workspace/section-removed"`），并在项目 `···` → `分区 >` 子菜单中列出全部自定义分区（带 `aria-checked` 选中态）与 `新建分区...`。
4. **瘦身 `@lfaa/ui-layout`（`packages/ui/layout/`）并修复「最近」语义**：
   - 保持 `@lfaa/ui-layout` 专注四栏可折叠 Shell 与通用渲染槽位：在 `src/index.ts` 扩充 `WorkbenchSectionProvider` 与泛化项目行/浮层插槽，`SidebarSectionList.*` 增加 HTML5 拖拽归档（`text/lfaa-project-id`）与自定义分区渲染态，`NavigationGroups.tsx`（300 行）、`NavigationSidebar.tsx`（263 行）与 `WorkbenchShell.tsx`（306 行）不再内置项目浮层或外观逻辑。
   - 修复 `WorkbenchShell.tsx`：点击切换项目或导航视图时不再写入 `recents`，`最近` 栏严格保留用于聊天会话，当前未接入聊天服务时展示“暂无聊天会话（聊天服务尚未接入）。”（`client/locales.ts`）。
5. **宿主装配与架构文档更新**：
   - 更新 `apps/web/package.json`、`apps/web/src/server.ts`（串联 `sectionsPlugin`、`workspacePlugin`、`onSectionRemoved` 联动与双 API 路由处理器）、`apps/web/src/main.tsx`（装配 `workbenchPlugin`、`themeClientPlugin`、`sectionsClientPlugin`、`workspaceClientPlugin`）、根 `package.json`（`typecheck` 覆盖全部 6 个子项目）及 `packages/README.zh.md`、`docs/architecture/overview.md`。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增包与文件 | `packages/ui/theme/package.json`、`packages/ui/theme/tsconfig.json`、`packages/ui/theme/README.md`、`packages/ui/theme/README.zh.md`、`packages/ui/theme/README.i18n.yaml`、`packages/ui/theme/src/index.ts`、`packages/ui/theme/client/css-modules.d.ts`、`packages/ui/theme/client/locales.ts`、`packages/ui/theme/client/appearance-store.ts`、`packages/ui/theme/client/index.tsx`、`packages/ui/theme/tests/theme-lifecycle.test.ts` | 建立 `@lfaa/ui-theme` 独立主题包、Cordis Client 插件与生命周期单元测试 |
| 迁移并修改文件 | `packages/ui/theme/client/components/AccentSelect.{tsx,module.css}`、`packages/ui/theme/client/components/AppearanceAdvanced.{tsx,module.css}`、`packages/ui/theme/client/components/AppearanceSettings.{tsx,module.css}` | 从 `packages/ui/layout/client/components/` 迁入 `@lfaa/ui-theme` 并接入 `AppearanceStore` |
| 新增包与文件 | `packages/workspace/sections/package.json`、`packages/workspace/sections/tsconfig.json`、`packages/workspace/sections/README.md`、`packages/workspace/sections/README.zh.md`、`packages/workspace/sections/README.i18n.yaml`、`packages/workspace/sections/src/types.ts`、`packages/workspace/sections/src/index.ts`、`packages/workspace/sections/src/http-handler.ts`、`packages/workspace/sections/client/css-modules.d.ts`、`packages/workspace/sections/client/locales.ts`、`packages/workspace/sections/client/section-store.ts`、`packages/workspace/sections/client/index.tsx`、`packages/workspace/sections/client/components/SectionDialog.{tsx,module.css}`、`packages/workspace/sections/client/components/SectionRowActions.{tsx,module.css}`、`packages/workspace/sections/tests/sections-lifecycle.test.ts` | 建立 `@lfaa/sections` 独立自定义分区包（Host 持久化与 HTTP API + Client 弹窗/行操作/Cordis Provider + 生命周期单测） |
| 新增文件 | `packages/workspace/workspace/client/project-menu-store.ts`、`packages/workspace/workspace/client/components/ProjectRowActions.{tsx,module.css}`、`packages/workspace/workspace/client/components/ProjectOverlays.tsx` | 为 `@lfaa/workspace` 补充项目行尾动作、浮层容器与菜单状态 Store |
| 迁移并修改文件 | `packages/workspace/workspace/client/components/ProjectHoverCard.{tsx,module.css}`、`packages/workspace/workspace/client/components/ProjectActionMenu.{tsx,module.css}` | 从 `packages/ui/layout/client/components/` 迁回 `@lfaa/workspace`，支持分区子菜单与“新建分区...”入口 |
| 修改文件 | `packages/workspace/workspace/src/types.ts`、`packages/workspace/workspace/src/index.ts`、`packages/workspace/workspace/src/http-handler.ts`、`packages/workspace/workspace/client/locales.ts`、`packages/workspace/workspace/client/local-project-store.ts`、`packages/workspace/workspace/client/index.tsx`、`packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 支持项目 `sectionId` 读写、分区删除联动清理、Cordis 事件监听与泛化槽位注入 |
| 删除文件 | `packages/ui/layout/client/useAppearance.ts`、`packages/ui/layout/client/appearance-types.ts`、`packages/ui/layout/client/components/{AccentSelect,AppearanceAdvanced,AppearanceSettings,ProjectHoverCard,ProjectActionMenu}.{tsx,module.css}`、`packages/ui/layout/client/useProjectMenus.ts` | 从 `packages/ui/layout/` 移除已拆出至 `@lfaa/ui-theme` 与 `@lfaa/workspace` 的主题、项目浮层与菜单文件（注：若部分旧文件路径在上轮拆分中已移动或删除，以迁移后 `layout` 仅保留 Shell 文件为准） |
| 修改文件 | `packages/ui/layout/src/index.ts`、`packages/ui/layout/client/workbench-service.ts`、`packages/ui/layout/client/locales.ts`、`packages/ui/layout/client/components/SidebarSectionList.{tsx,module.css}`、`packages/ui/layout/client/components/NavigationGroups.tsx`、`packages/ui/layout/client/components/NavigationSidebar.tsx`、`packages/ui/layout/client/components/WorkbenchShell.tsx` | 增加 `WorkbenchSectionProvider` 与拖放槽位、移除项目与主题耦合代码，并阻止项目点击进入「最近」列表 |
| 修改文件 | `package.json`、`apps/web/package.json`、`apps/web/src/server.ts`、`apps/web/src/main.tsx`、`packages/README.zh.md`、`docs/architecture/overview.md` | 更新 workspace 依赖装配、`typecheck` 脚本与包职责说明文档 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CMpol07Z.css`、`apps/web/dist/assets/index-HG3cHt5t.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000028-20261117-2228-package-split-sections-and-recent-chats.md` | 记录四包拆分、自定义分区与「最近」语义修复详情及验证结果 |
| 新增文件 | `docs/updata-log/000028-20261117-2228-package-split-sections-and-recent-chats.md` | 记录对用户可见的自定义分区功能、「最近」纯会话语义修正与外观/项目体验保持 |

## 行数与规范自检

- 抽样及全量检查 `packages/ui/layout`、`packages/ui/theme`、`packages/workspace/sections`、`packages/workspace/workspace` 全部源码：
  - `*.tsx` 最大行数 `373`（`ProjectDialog.tsx`，低于 400 行阈值；其中 250~400 行含 `NavigationGroups.tsx` 300、`NavigationSidebar.tsx` 263、`WorkbenchShell.tsx` 306、`EditProjectDialog.tsx` 299、`ProjectActionMenu.tsx` 258、`ProjectDialog.tsx` 373、`AppearanceSettings.tsx` 291）。
  - `*.module.css` 最大行数 `394`（`WorkbenchShell.module.css`，低于 400 行阈值）。
  - `*.ts` 最大行数 `359`（`packages/ui/layout/client/locales.ts`，低于 500 行阈值）。
  - 注：`packages/ui/layout/package.json` 的静态 `description` 字段仍沿用旧描述文本，未在终测后再做文本改动以免引入未测变更，留待后续需要时随包文档一并调整。

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm install --offline` | 通过 | `Scope: all 7 workspace projects`，完成新建内部 workspace 包软链装配 |
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts` | 通过 | 9/9 用例通过（`tests 9, pass 9, fail 0, duration_ms 770.0647`），覆盖主题预设/插件清理、分区 CRUD/重名拦截/删除回调/Client 清理、工作区路径校验/Win32 资源管理器/四栏折叠与卸载清理 |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`packages/ui/layout`、`packages/ui/theme`、`packages/workspace/sections`、`packages/workspace/workspace` 共 6 个项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6632 个模块，输出 `dist/index.html`（1.02 kB）、`dist/assets/index-CMpol07Z.css`（70.01 kB）、`dist/assets/index-HG3cHt5t.js`（394.60 kB），耗时 `859ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，桌面 `1440×900` + 移动 `390×844`） | 通过 | `0` 条控制台/页面错误；验证了「最近」保持空聊天态（点击 `app`/`app1` 后仍显示 `暂无聊天会话（聊天服务尚未接入）。`）、从项目 `···` → `分区 >` → `新建分区...` 创建并重命名分区、将项目指派进分区（`PATCH` 200 且菜单项出现 `aria-checked="true"`）、删除测试分区触发级联回收项目回「项目」组（`DELETE` 200，`~/.lfaa/sections.json` 恢复为 `[]`）、`@lfaa/ui-theme` 外观设置与 `390×844` 移动端抽屉适配，并查验终态截图 `final_step_59.png` |
| HTML5 拖拽项目进自定义分区交互（`text/lfaa-project-id`） | 代码实现、未单测鼠标拖拽 | 已在 `SidebarSectionList.tsx` 实现 `onDragStart`/`onDragOver`/`onDrop` 并接入 `onAssignProjectSection`，本轮浏览器自动验收优先通过 `···` → `分区 >` 菜单完成全链路指派验证 |

## 风险、回滚与遗留问题

- 风险：低。Host/Client 隔离严格，所有插件均有 `ctx.on("dispose", ...)` 清理。
- 回滚办法：恢复 `apps/web` 对单一包的装配引用，按目录还原 `packages/ui/layout/` 即可。
- 遗留问题：聊天服务尚未接入前，自定义分区“在分区内新建聊天”会切换至工作区并提示聊天服务待接入；后续接入 `@lfaa/chat` 插件时可直接复用 `WorkbenchSectionProvider` 与 `recents` 槽位；HTML5 鼠标拖拽归档可在真实桌面端顺带手测。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：有新增“新建分区”功能、分区管理与“最近仅放聊天会话”修复，已同步新增同编号 `updata-log`。
