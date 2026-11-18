# DEV-000033｜将外观模式快捷切换胶囊移动至左下角用户菜单头部右侧

- 任务编号：000033
- 开始时间：2026-11-17 23:22:38 +08:00
- 完成时间：2026-11-17 23:28:00 +08:00
- 类型：refactor + feat
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与桌面 `1440×900` / 移动 `390×844` 浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传带红色箭头截图要求将主题快捷切换按钮从左一栏底部移动至用户菜单（`LF 本地用户`）头部右侧空白区域
- 关联 Issue/PR/Commit：无

## 变更详情

1. **调整 `@lfaa/ui-layout` 插件槽位位置（`railFooters` → `accountActions`）**：
   - 将 `packages/ui/layout/src/index.ts`（89 行）与 `workbench-service.ts`（205 行）中的左一栏底部槽位替换为 `WorkbenchAccountActionContribution` / `registerAccountAction`。
   - 还原 `NavigationRail.tsx`（151 行）与 `NavigationRail.module.css`（254 行），恢复左一图标栏简洁布局，并由 `WorkbenchShell.tsx`（323 行）将 `accountActions` 透传给 `UserMenu.tsx`（113 行）。
   - 更新 `UserMenu.tsx` 与 `UserMenu.module.css`（213 行），在 `.account` 头部左侧保留 `LF 本地用户 / 本地工作区`，右侧通过 `.accountActions` 承载扩展快捷操作；同时在外部点击关闭守卫中豁免 `[data-theme-quick-menu]`，保证在浮层内点击模式选项时不误关外层用户菜单。
2. **调整 `@lfaa/ui-theme` 胶囊交互与三选一下拉浮层**：
   - 更新 `ThemeModeQuickSwitch.tsx`（139 行）与 `ThemeModeQuickSwitch.module.css`（123 行），改为全端一致的横向液态玻璃胶囊（图标 + `跟随系统` / `浅色模式` / `深色模式` + 下拉小箭头），点击后于按钮下方右对齐弹出三选一浮层，并采用捕获阶段 `Escape` 监听先收起子菜单而不误关用户菜单。
   - 更新 `packages/ui/theme/client/index.tsx`（48 行）与 `tests/theme-lifecycle.test.ts`（41 行）改用 `registerAccountAction` 注册与断言。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/src/index.ts` | 将 `WorkbenchRailFooterContribution` 替换为 `WorkbenchAccountActionContribution`（89 行） |
| 修改文件 | `packages/ui/layout/client/workbench-service.ts` | 将 `registerRailFooter` 替换为 `registerAccountAction` 并维护 `accountActions`（205 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.tsx` | 移除左一栏底部胶囊渲染，改为透传 `accountActions` 给 `UserMenu`（151 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.module.css` | 恢复左一栏移动端原间距样式（254 行） |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 透传 `accountActions` 给 `NavigationRail`（323 行） |
| 修改文件 | `packages/ui/layout/client/components/UserMenu.tsx` | 在 `.account` 头部右侧渲染 `accountActions`，并放行 `[data-theme-quick-menu]` 外部点击（113 行） |
| 修改文件 | `packages/ui/layout/client/components/UserMenu.module.css` | 新增 `.accountMeta` 与 `.accountActions` 右对齐布局（213 行） |
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx` | 调整为下拉定位、增加 `data-theme-quick-menu` 标记与分层 `Escape` 拦截（139 行） |
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.module.css` | 更新为横向胶囊（含小箭头）与三选一浮层统一样式（123 行） |
| 修改文件 | `packages/ui/theme/client/index.tsx` | 改用 `registerAccountAction` 注册快捷切换入口（48 行） |
| 修改文件 | `packages/ui/theme/tests/theme-lifecycle.test.ts` | 更新断言检验 `accountActions` 注册与注销（41 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-bCTlM3bs.css`、`apps/web/dist/assets/index-CKmNY9so.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000033-20261117-2328-move-theme-switch-to-user-menu.md` | 记录主题快捷切换移入用户菜单头部右侧的改动与实测结果 |
| 新增文件 | `docs/updata-log/000033-20261117-2328-move-theme-switch-to-user-menu.md` | 记录快捷主题切换位置移动与菜单交互体验 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 907.6392`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6637 个模块，输出 `dist/assets/index-bCTlM3bs.css`（74.68 kB）与 `dist/assets/index-CKmNY9so.js`（405.57 kB），耗时 `959ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，桌面 `1440×900` + 移动 `390×844`） | 通过 | 0 条控制台/页面错误；左一栏已恢复纯图标 + 状态/头像布局；打开 `#lfaa-user-menu` 后，右上角呈现 `111.73×32px` 横向胶囊，点击其正下方弹出三选一菜单，选择 `浅色模式` 时用户菜单保持开启并实时切浅色，按一次 `Escape` 仅关主题子菜单、再按一次 `Escape` 关闭用户菜单；`390×844` 移动端底栏（右边界 `382.01 <= 390`）与菜单胶囊（`361.24 <= 379.60`）均无裁切并成功切回 `深色模式` |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：切回左一栏底部槽位或恢复上一版 `NavigationRail` / `UserMenu` 即可。
- 遗留问题：前一轮提交的 **`@lfaa/chat`（真实聊天会话、项目下聊天列表与 `N 次聊天` 真实统计）A1 实施计划** 待负责人确认两个细节后启动。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：主题模式快捷切换已按指示移至用户菜单头部右上角，已同步新增同编号 `updata-log`。
