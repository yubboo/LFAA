# DEV-000039｜为「最近」分组补充悬停显现的聊天排序与快捷新聊天图标（同步抽离 GroupHeaderTools）

- 任务编号：000039
- 开始时间：2026-11-18 00:17:32 +08:00
- 完成时间：2026-11-18 00:26:00 +08:00
- 类型：feat + refactor
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与内置浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传「最近」分组标题右侧两枚按钮截图，要求补充“最近，少了这两个功能”
- 关联 Issue/PR/Commit：无

## 变更详情

1. **抽离共享分组工具栏 `GroupHeaderTools`（`packages/ui/layout/client/components/GroupHeaderTools.tsx`，73 行）**：
   - 将原 `NavigationGroups.tsx` 中的分组标题右侧工具栏提炼为共用无重复组件，服务「项目」与「最近」两个内置分组（顺带将 `NavigationGroups.tsx` 保持在 367 行内）。
   - 将 `NavigationGroups.module.css`（170 行）中的 `.projectTools` 统一命名为 `.groupTools`，保持默认隐藏（`opacity: 0; pointer-events: none`）、仅当鼠标移入标题行、菜单展开（`data-tools-open="true"`）、键盘焦点或纯触屏粗指针环境时显现。
2. **补充「最近」分组聊天排序与快捷新聊天**：
   - 在 `packages/ui/layout/client/ui-preferences.ts`（152 行）提炼共用 `readSortModePref`，新增 `RECENT_SORT_STORAGE_KEY`（`lfaa:recent-sort`）及 `readRecentSortPref` / `writeRecentSortPref` 持久化记忆。
   - 在 `NavigationGroups.tsx`（367 行）与 `locales.ts`（361 行）中为 `recent` 分组接入 `recentTools`：左侧图标提供 **聊天排序** 下拉菜单（按创建时间排序 / 按名称排序，实时排序 `sortedRecents` 并持久化）；右侧图标为 **新聊天**（`newChat` 图标，触发 `onNewChat`），按 `Escape` 可退回对应触发按钮焦点。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/ui/layout/client/components/GroupHeaderTools.tsx` | 共享分组标题栏右侧排序菜单与动作按钮组件（73 行） |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 新增 `filterRecent` 中英文案（361 行） |
| 修改文件 | `packages/ui/layout/client/ui-preferences.ts` | 提炼 `readSortModePref`，新增 `lfaa:recent-sort` 读写记忆（152 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 将 `.projectTools` 统一为 `.groupTools` 供项目与最近共用悬停显隐规则（170 行） |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 接入 `GroupHeaderTools` 为「最近」分组提供排序与快捷新聊天入口，并按 `recentSort` 排序（367 行） |
| 修改文件 | `packages/ui/layout/tests/persistence-lifecycle.test.ts` | 补充 `readRecentSortPref` / `writeRecentSortPref` 单元测试（107 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CrngANPb.css`、`apps/web/dist/assets/index-ZH5-oLlX.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000039-20261118-0026-recent-group-hover-tools.md` | 记录「最近」分组工具栏实现、组件抽离与浏览器实测结果 |
| 新增文件 | `docs/updata-log/000039-20261118-0026-recent-group-hover-tools.md` | 记录「最近」分组新增悬停显示的聊天排序与快捷新聊天按钮 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 806.8106`），含 `recentSort` 读写持久化校验 |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6639 个模块，输出 `dist/assets/index-CrngANPb.css`（74.82 kB）与 `dist/assets/index-ZH5-oLlX.js`（408.43 kB），耗时 `851ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；未悬停时「最近」行右侧「聊天排序」与「新聊天」隐藏；移入「最近」整行后两按钮显现；点击「聊天排序」切换“按名称排序”并 `page.reload()` 后保持 `aria-checked="true"`（随后恢复默认“按创建时间排序”）；点击行内「新聊天」入口正常响应，移出鼠标后按钮重新隐藏 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：删除 `GroupHeaderTools.tsx`，移除 `recentTools` 与 `recentSort` 并重新构建即可。
- 遗留问题：此前提交的 `@lfaa/chat`（真实聊天会话、项目下会话列表与卡片 `N 次聊天` 实时统计）A1 计划待负责人确认细节后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：「最近」分组行新增悬停显现的聊天排序与新聊天图标，已同步新增同编号 `updata-log`。
