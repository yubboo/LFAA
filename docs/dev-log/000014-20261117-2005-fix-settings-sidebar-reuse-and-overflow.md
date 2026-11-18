# DEV-000014｜优化设置中心左二复用菜单并消除横向滚动条

- 任务编号：000014
- 开始时间：2026-11-17 20:03:42 +08:00
- 完成时间：2026-11-17 20:05:40 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 及 `1440×900` / `1024×768` 内置浏览器复验均已通过）
- 审批级别及批准证据：A0；负责人反馈设置中心左二菜单栏（复用）存在底部横向滚动条、重复搜索入口与文字挤压问题
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 消除左二设置菜单栏底部的横向滚动条，确保四栏全部滚动容器均无横向溢出（`overflow-x: hidden` + `grid-template-columns: minmax(0, 1fr)` + `min-width: 0`）。
  - 精简复用的左二菜单栏在设置态下的头部与条目呈现：隐藏顶栏重复的搜索图标（保留设置搜索框与 `Ctrl+K` 快捷键），移除每行挤占空间的“暂未接入”标签改用提示及点击后的真实未接入页说明，让“迷你界面和智能伙伴”“使用情况和计费”等长名称完整展示。
- 不在范围：改动四栏 Cordis 契约或新建独立设置布局骨架。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/SettingsMenu.tsx` | 移除每行重复的“暂未接入”右侧徽标，改为 `title` 提示并在点击后由主工作区展示未接入状态 |
| 修改文件 | `packages/ui/layout/client/components/SettingsMenu.module.css` | 补充 `min-width: 0`、`grid-template-columns: minmax(0, 1fr)` 与 `overflow-x: hidden`，统一使用 `em` 字号并清理冗余 `.badge` |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.tsx` | 设置中心模式下顶栏隐藏重复搜索按钮，保留 `← 设置` 返回入口与移动/平板抽屉关闭按钮 |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 为 `.groups` 增加 `grid-template-columns: minmax(0, 1fr)`、`min-width: 0` 与 `overflow-x: hidden` |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | `.workspace` 改为 `overflow-y: auto; overflow-x: hidden;` |
| 修改文件 | `packages/ui/layout/client/components/ContextPanel.module.css` | `.body` 增加 `grid-template-columns: minmax(0, 1fr)`、`min-width: 0` 与 `overflow-x: hidden` |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CnABnD4J.css`、`apps/web/dist/assets/index-D38roen9.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000014-20261117-2005-fix-settings-sidebar-reuse-and-overflow.md` | 记录本轮修复文件、验证与浏览器实测结果 |
| 新增文件 | `docs/updata-log/000014-20261117-2005-fix-settings-sidebar-reuse-and-overflow.md` | 记录消除设置侧栏横向滚动条与重复图标优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6611 个模块，耗时 `836ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`） | 通过 | HTTP 200，0 条控制台/页面错误：<br>- **桌面 `1440×900`**：左二设置顶栏仅保留 `← 设置`（`headerSearchBtns = 0`），搜索框位于侧栏体内；全部按钮严密贴合在左二栏内（`overflowBtns = []`），“迷你界面和智能伙伴”“使用情况和计费”均单行完整显示且无横向滚动条；点击“应用快照”正常展示未接入页、点“外观”正常返回。<br>- **窄桌面 `1024×768`**：四栏并排下 `section-navigation`、`workspace`、`context-panel` 均无任何横向溢出与横向滚动条 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复本轮修改的 6 个源文件与 `apps/web/dist/` 后重新执行 `pnpm run build`，并删除本轮两份日志。
- 遗留问题：无已知阻塞问题。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：消除了设置中心左二栏横向滚动条、重复搜索图标与文字截断，已新增同编号 `updata-log`。
