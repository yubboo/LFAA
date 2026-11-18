# DEV-000038｜将「项目」分组标题行右侧排序与新建图标改为鼠标移入后显现

- 任务编号：000038
- 开始时间：2026-11-18 00:14:49 +08:00
- 完成时间：2026-11-18 00:19:35 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与内置浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传截图框选「项目」标题行右侧筛选排序与 `+` 图标，要求“这个也是鼠标移入后才显示”
- 关联 Issue/PR/Commit：无

## 变更详情

1. **统一分组标题行悬停标记**：在 `packages/ui/layout/client/components/SidebarSectionList.tsx`（194 行）为 `.headingRow` 容器增加 `data-heading-row="true"`。
2. **展开排序菜单时保持可见**：在 `packages/ui/layout/client/components/NavigationGroups.tsx`（356 行）为 `.projectTools` 增加 `data-tools-open={filterOpen ? "true" : undefined}`。
3. **默认隐藏、悬停/菜单开启/键盘焦点/纯触屏显现**：在 `packages/ui/layout/client/components/NavigationGroups.module.css`（170 行）将 `.projectTools` 默认设为 `opacity: 0; pointer-events: none; transition: opacity 140ms ease;`，仅当 `[data-heading-row="true"]:hover`、`:has(:focus-visible)`、`data-tools-open="true"` 或纯粗指针触屏环境（`@media (hover: none) and (pointer: coarse)`）时显现并恢复交互。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.tsx` | 为 `.headingRow` 添加 `data-heading-row="true"` 钩子（194 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 为 `.projectTools` 添加 `data-tools-open` 状态标记（356 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 实现 `.projectTools` 默认隐藏及悬停/焦点/菜单开启/粗指针显现规则（170 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-Dkb8sjhv.css`、`apps/web/dist/assets/index-DoHi_KVk.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000038-20261118-0019-hover-reveal-project-group-tools.md` | 记录「项目」分组工具图标按需显隐改动及验证结果 |
| 新增文件 | `docs/updata-log/000038-20261118-0019-hover-reveal-project-group-tools.md` | 记录「项目」行右侧排序与新建图标改为移入显现优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 801.5085`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6638 个模块，输出 `dist/assets/index-Dkb8sjhv.css`（74.83 kB）与 `dist/assets/index-DoHi_KVk.js`（407.43 kB），耗时 `896ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；未悬停及点击收起后移开鼠标时 `项目排序` 与 `新建项目` 图标隐藏（`isVisible() === false`），鼠标移入「项目」标题行后两枚按钮显现（`isVisible() === true`），点开排序下拉移至菜单内时 `data-tools-open="true"` 保持显现，选定排序并移走鼠标后恢复隐藏 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：移除 `.projectTools` 显隐 CSS 规则并重新构建即可。
- 遗留问题：此前提交的 `@lfaa/chat`（真实聊天会话、项目下会话列表与卡片 `N 次聊天` 实时统计）A1 计划待负责人确认细节后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：「项目」分组行右侧排序与新建图标已改为仅悬停/展开菜单时显现，已同步新增同编号 `updata-log`。
