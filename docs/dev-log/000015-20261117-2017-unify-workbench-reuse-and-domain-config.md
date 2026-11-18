# DEV-000015｜统一四栏/三栏域配置复用与左二通用列表原语重构

- 任务编号：000015
- 开始时间：2026-11-17 20:13:15 +08:00
- 完成时间：2026-11-17 20:17:05 +08:00
- 类型：refactor
- 状态：完成（`typecheck`、`build` 及桌面端/手机端内置浏览器复验均已通过）
- 审批级别及批准证据：A0/A1（负责人明确批准“先给方案、再按统一配置驱动与左一/左二/中间三栏复用重构写代码”）
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 将四栏工作区与三栏设置中心统一纳入同一套 Shell 域配置（`WorkbenchDomainConfig`）：工作区声明 `columns: 4`，设置中心声明 `columns: 3` 并自动隐藏右侧上下文栏与顶栏右侧切换按钮，直接复用左一图标栏、左二菜单栏与中间工作区，无需第二套三栏布局。
  - 提取统一、数据驱动的左二菜单原语 `SidebarSectionList`（含单一 CSS Modules 样式表 `SidebarSectionList.module.css`），消除 `SettingsMenu` 与 `NavigationGroups` 的重复分组/列表/空态样式及分散硬编码映射。
  - 进入设置中心时在左一图标栏高亮用户头像入口，且支持随时通过左一或返回按钮切回四栏工作区。
- 不在范围：新增业务插件包或修改跨包 Cordis 契约。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/ui/layout/client/workbench-domains.ts` | 集中定义 `WorkbenchDomainConfig`（`columns: 3 \| 4`、`sidebarHeader`、`sidebarAriaLabel`）、`resolveWorkbenchDomain`、`buildNavigationTargets` 与 `resolveViewLabel` |
| 新增文件 | `packages/ui/layout/client/components/SidebarSectionList.tsx` | 抽出左二栏统一菜单列表组件（支持内联搜索、顶部插槽、可折叠/静态分组、工具栏插槽、空态及底部提示） |
| 新增文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 统一左二栏分组、按钮、高亮与零横向溢出样式 |
| 修改文件 | `packages/ui/layout/client/components/SettingsMenu.tsx` | 重构为将 `SETTINGS_CATALOG` 映射至 `SidebarSectionList` 的轻量适配器 |
| 删除文件 | `packages/ui/layout/client/components/SettingsMenu.module.css` | 移除已被 `SidebarSectionList.module.css` 取代的重复样式文件 |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 重构为将“新聊天”与置顶/项目/最近分组映射至 `SidebarSectionList` 的轻量适配器 |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 仅保留工作区独有的 `.newChat` 与项目排序/创建工具样式，清除重复分组列表样式 |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.tsx` | 228 行（≤ 250）；通过 `domain` 配置驱动顶栏形态与搜索目标，移除分散硬编码分支 |
| 修改文件 | `packages/ui/layout/client/components/UserMenu.tsx` | 新增 `active` 属性支持在设置中心下保持左一用户头像按钮激活态 |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.tsx` | 透传 `activeDomain` 驱动设置中心下左下角用户入口激活态 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 271 行（≤ 400）；依据 `domain.columns` 统一控制 `data-columns`、`showRightPanel` 与右侧折叠按钮显示，实现三栏设置中心与四栏工作区无痛复用 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BM5MgbZw.css`、`apps/web/dist/assets/index-DVu4PwL5.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000015-20261117-2017-unify-workbench-reuse-and-domain-config.md` | 记录重构文件清单、删除冗余文件及双端实测结果 |
| 新增文件 | `docs/updata-log/000015-20261117-2017-unify-workbench-reuse-and-domain-config.md` | 记录设置中心三栏复用模式与左一激活提示 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，耗时 `846ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`） | 通过 | HTTP 200，0 条控制台/页面错误：<br>- **桌面 `1440×900`**：工作区 `data-columns="4"`（左一 `69.59px`、左二 `273.59px`、中间 `837.62px`、右侧 `259.19px`）；进入设置后切为 `data-columns="3"` 与 `data-right-open="false"`，右侧栏与右上角折叠按钮均隐藏（`count = 0`），左一与左二保持完全一致宽度（`69.59px`、`273.59px`），中间工作区扩满剩余 `1096.81px`，左下角用户头像保持激活态；点“返回工作区”立即恢复 `data-columns="4"`。<br>- **手机 `390×844`**：设置中心 `data-columns="3"`，全页 `390px` 零横向溢出，左二抽屉复用 `SidebarSectionList` 正常展示 |

## 风险、回滚与遗留问题

- 风险：无；保留了全部现有四栏 Cordis 服务契约与用户设置数据。
- 回滚办法：恢复本轮修改的文件及 `SettingsMenu.module.css`、移除新增 3 个文件与本轮两份日志后重新执行 `pnpm run build`。
- 遗留问题：无已知阻塞问题。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：设置中心进入后自动隐藏右侧冗余栏以三栏形态呈现（扩大中间工作区空间）并高亮左一用户入口，已新增同编号 `updata-log`。
