# 左二栏会话分批展开（会话窗口）

- 状态：已实施（2026-11-22），负责人确认范围为「项目子会话 + 最近分组」，并确认全部展开后提供收起。
- 适用版本：LFAA Web / 桌面端共用的四栏 Shell。
- 关联实现：`packages/ui/layout/client/components/`。

## 背景与目标

随着项目内会话增多，展开项目后左二栏会被很长的会话列表撑满，难以继续浏览项目或最近聊天。目标是把会话列表按批展示：默认只显示 6 条，每次点击再多显示 6 条，直到全部显示；全部显示后提供收起入口，回到默认 6 条。

不改变项目本身的折叠语义，也不改变会话打开、归档、置顶、未读等行内行为。

## 交互规则

1. 项目行展开后，其未归档子会话超过 6 条时只渲染前 6 条，并在末尾追加整行控件「展开其余 N 个会话」。
2. `N = min(6, 剩余条数)`：每次点击只增加一批 6 条；剩余不足 6 条时按实际剩余数显示。例如共 14 条：`6 → 12（展开其余 2 个会话）→ 14（收起会话）`。
3. 全部显示后控件变为「收起会话」，点击清空该项目的展开批次，回到默认 6 条。
4. 折叠项目行时同时清空该项目的展开批次，下次展开重新从 6 条开始。
5. 「最近」分组使用同一套规则；不足 6 条时不显示控件。
6. 中英文文案由 `@lfaa/ui-layout` 的 `locales.ts` 提供；控件是普通 `button`，可用键盘激活。
7. 展开批次按项目行 id 记录，因此同一项目在「置顶」和「项目」两个分组中的副本互不影响；「最近」分组维护自己的窗口。

## 实现结构

- `client/components/session-list-paging.ts`
  - `SESSION_PAGE_SIZE = 6`
  - `resolveSessionWindow(total, shown)`：收敛已展开条数，给出可见条数、剩余条数与下一批数量。
  - `nextSessionWindow(total, shown)`：计算再展开一批后的条数。
  - `createSessionWindowControl(...)`：生成控件文案与点击行为；全部展开时切换为收起。
- `client/components/use-session-window.ts`
  - 持有项目行批次表与「最近」窗口状态。
  - 向 `NavigationGroups` 暴露 `projectVisibleCount`、`projectControl`、`resetProject`、`recentVisibleCount`、`recentControl`。
- `client/components/navigation-items.ts`
  - `ProjectItemDeps` 新增 `sessionVisibleCount` 与 `sessionListControl`；两者缺省时保持原来的全量渲染，兼容其他调用方。
  - `createSessionWindowItem(...)` 把控件转换为 `SidebarItemConfig`（`control: true`、项目内缩进、隐藏图标）。
- `client/components/navigation-groups-config.ts`
  - 「最近」分组的组装下沉到 `buildRecentGroup`，接收已计算好的可见条数与控件。
- `client/components/SidebarSectionList.tsx`
  - `SidebarItemConfig` 新增 `control`；控件行复用普通行结构，追加 `SidebarSectionList.controls.module.css` 的弱边框样式，并输出 `data-sidebar-control` 供验收选择。
- `client/locales.ts`
  - 新增 `expandSessions(count)` 与 `collapseSessions`。

## 明确不修改

- Host/API 契约、会话持久化与排序逻辑。
- 项目行、会话行的选择、悬停卡片、未读/待确认状态、行内操作。
- 「置顶」分组中独立置顶的会话行，以及自定义分区、项目的折叠偏好持久化。
- 四栏宽度与响应式规则。

## 风险与回滚

- 状态仅存在组件内存中，不写入 localStorage；刷新页面回到默认 6 条，符合“默认精简”的预期。
- 控件行加入了 `data-sidebar-control` 与 `aria-expanded`，不影响现有行选择器（现有逻辑按 `data-sidebar-item` 与行内动作区分）。
- 样式拆到 `SidebarSectionList.controls.module.css`，避免主列表 CSS 触达 400 行硬上限；颜色只消费主题变量。控件选择器使用 `button.moreButton` 提高权重，避免独立模块的样式被 `.item` 的透明边框覆盖。
- 回滚：删除 `session-list-paging.ts`、`use-session-window.ts`、`SidebarSectionList.controls.module.css` 与本轮测试，撤销 `navigation-items.ts` / `navigation-groups-config.ts` / `NavigationGroups.tsx` / `SidebarSectionList.tsx` 的对应接线与 `locales.ts` 文案即可，无数据迁移。

## 验收条件与结果

- 单元测试：`packages/ui/layout/tests/session-list-paging.test.ts` 6 项通过，覆盖窗口收敛、下一批数量、全部展开切换收起、项目行控件、最近分组控件与行缩进。
- 内置浏览器实测（真实 5173 + 无头 Edge）：
  - 项目 14 条会话：首屏 6 条 +「展开其余 6 个会话」；点击后 12 条 +「展开其余 2 个会话」；再次点击 14 条 +「收起会话」；点击收起回到 6 条。
  - 最近分组 11 条：首屏 6 条 +「展开其余 5 个会话」；展开后 11 条 +「收起会话」。
  - 深色与浅色主题下控件、文字与边框均正常，控制台无新增错误。
  - 截图：`%TEMP%\lfaa-pw\session-paging\11-project-6-dark.png` 至 `18-project-expanded-light.png`。
- 门禁：`pnpm test` 477 项通过；`pnpm lint` 429 文件 0 问题；`pnpm typecheck` 与 `pnpm build` 通过；`pnpm check` 仅剩另一会话并发修改的 `packages/core/chat/client/chat-store.ts`（508 行）超限，与本轮文件无关。

## 本轮文件

- 新增：`packages/ui/layout/client/components/session-list-paging.ts`
- 新增：`packages/ui/layout/client/components/use-session-window.ts`
- 新增：`packages/ui/layout/client/components/SidebarSectionList.controls.module.css`
- 新增：`packages/ui/layout/tests/session-list-paging.test.ts`
- 修改：`packages/ui/layout/client/components/navigation-items.ts`
- 修改：`packages/ui/layout/client/components/navigation-groups-config.ts`
- 修改：`packages/ui/layout/client/components/NavigationGroups.tsx`
- 修改：`packages/ui/layout/client/components/SidebarSectionList.tsx`
- 修改：`packages/ui/layout/client/locales.ts`
- 文档：`docs/features/session-list-paging.md`、`docs/architecture/README.md`