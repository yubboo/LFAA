# DEV-000032｜在左一菜单栏底部新增主题模式快捷切换胶囊与三选一浮层（Cordis 插件槽位贡献）

- 任务编号：000032
- 开始时间：2026-11-17 23:10:17 +08:00
- 完成时间：2026-11-17 23:22:15 +08:00
- 类型：feat
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与桌面 `1440×900` / 移动 `390×844` 浏览器实测通过）
- 审批级别及批准证据：A0；负责人指定位置为“左一最左侧菜单栏底部（紧邻本地状态与头像图标上方）”，触发形态为“图标 + 当前模式文字胶囊按钮，点击弹出三选一浮层”
- 关联 Issue/PR/Commit：无

## 设计与跨包架构方案

1. **在 `@lfaa/ui-layout` 开放左一栏底部插件槽位契约**：
   - 在 `packages/ui/layout/src/index.ts`（89 行）新增 `WorkbenchRailFooterContribution`，并在 `workbench-service.ts`（205 行）新增 `registerRailFooter` 与快照字段 `railFooters`，支持按 `order` 排序与随插件释放清理。
   - 在 `WorkbenchShell.tsx`（323 行）和 `NavigationRail.tsx`（154 行）的 `.bottomGroup` 中、本地状态与头像按钮正上方渲染 `railFooters`。
2. **在 `@lfaa/ui-theme` 实现 `ThemeModeQuickSwitch` 并注册贡献**：
   - 新增 `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx`（140 行）与 `ThemeModeQuickSwitch.module.css`（153 行），并通过 `packages/ui/theme/client/index.tsx`（48 行）调用 `context.workbench.registerRailFooter` 注册、在 `dispose` 时注销。
   - 触发按钮采用液态玻璃胶囊样式：桌面与平板端在 69.6px 窄栏内以上下排布展示 `Icon` + 单行模式文字（`跟随系统` / `浅色模式` / `深色模式`）；541px–767px 横向底栏展示图标 + 文字横向胶囊；`<= 540px` 小屏手机底栏自动收敛为 `2.65rem` 图标圆角按钮并收紧 `NavigationRail.module.css`（262 行）横向内边距与间距，确保 `390px` 视口下全部 8 个按钮完整容纳无裁切。
   - 点击胶囊弹出带 Portal 的三选一浮层（`跟随系统` / `浅色模式` / `深色模式`，含选中态高亮与 `IconCheck`），支持点击外部与 `Escape` 关闭，切换即时调用 `store.setMode()` 并持久化。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx` | 左一底部主题模式切换胶囊触发器与“跟随系统 / 浅色模式 / 深色模式”弹出菜单（140 行） |
| 新增文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.module.css` | 胶囊按钮、三选一浮层及桌面/平板/窄屏底栏多端适配样式（153 行） |
| 修改文件 | `packages/ui/layout/src/index.ts` | 新增 `WorkbenchRailFooterContribution` 公共槽位契约（89 行） |
| 修改文件 | `packages/ui/layout/client/workbench-service.ts` | 新增 `registerRailFooter` 注册/销毁方法与 `railFooters` 快照列表（205 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.tsx` | 在 `.bottomGroup` 顶部接入渲染 `railFooters`（154 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.module.css` | `<= 480px` 手机端收紧底栏内边距与间距，为快捷主题按钮留足水平空间（262 行） |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 将 `railFooters` 透传给 `NavigationRail`（323 行） |
| 修改文件 | `packages/ui/theme/client/locales.ts` | 补充 `lightModeLabel`、`darkModeLabel`、`quickThemeSwitch` 中英文案（110 行） |
| 修改文件 | `packages/ui/theme/client/index.tsx` | 通过 `registerRailFooter` 注册 `RailThemeSwitcher` 并在卸载时清理（48 行） |
| 修改文件 | `packages/ui/theme/tests/theme-lifecycle.test.ts` | 补充断言校验 `theme-mode-switch` 随插件注册与卸载清理（41 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-B77hdmcI.css`、`apps/web/dist/assets/index-BWF3JkJF.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000032-20261117-2322-rail-theme-quick-switch.md` | 记录左一底部主题快捷切换插件实现、移动端窄屏修复与实测结果 |
| 新增文件 | `docs/updata-log/000032-20261117-2322-rail-theme-quick-switch.md` | 记录左一栏底部一键切换跟随系统/浅色/深色模式功能 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 821.9681`），含 `theme-mode-switch` 贡献注册与卸载清理验证 |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6637 个模块，输出 `dist/assets/index-B77hdmcI.css`（74.88 kB）与 `dist/assets/index-BWF3JkJF.js`（405.21 kB），耗时 `896ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，桌面 `1440×900` + 移动 `390×844`） | 通过 | 0 条控制台/页面错误；`1440×900` 下胶囊位于左一 `69.59px` 栏内状态/头像上方（`52×48.8px`，`深色模式`单行居中不换行），浮层清晰弹出于栏侧（`163.99×129.17px`），切换浅色/跟随系统/深色均即时生效且 `page.reload()` 后保持；首次实测发现 `390px` 移动端底栏右侧头像微弱裁边，收窄小屏为 `42.39px` 图标按钮并优化底栏间距后复测，8 个底栏按钮右边界 `384.41 <= 390` 无裁切、浮层完整上浮于底栏之上 |

## 风险、回滚与遗留问题

- 风险：无；遵循 Cordis `@lfaa/ui-theme` → `@lfaa/ui-layout` 插件插槽隔离契约。
- 回滚办法：移除 `ThemeModeQuickSwitch.{tsx,module.css}` 与 `registerRailFooter` 槽位调用并重新构建即可。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：左一栏底部新增“跟随系统 / 浅色模式 / 深色模式”快捷切换胶囊与浮层，已同步新增同编号 `updata-log`。
