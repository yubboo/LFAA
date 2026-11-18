# DEV-000025｜将项目信息悬浮卡触发范围扩展至整个项目行底色区域

- 任务编号：000025
- 开始时间：2026-11-17 21:56:54 +08:00
- 完成时间：2026-11-17 21:59:00 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与内置浏览器整行悬停状态机实测通过）
- 审批级别及批准证据：A0；负责人反馈信息悬浮卡片应在鼠标移入整个底色项目行时即展示，而非仅限于移到 `···` 按钮上
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  1. 在 `SidebarSectionList.tsx` 为 `.itemRow` 增加可选 `onMouseEnter` / `onMouseLeave` 回调，将悬浮触发范围从行尾 `···` 按钮扩展到整行底色区域。
  2. 更新 `useProjectMenus.ts` 与 `NavigationGroups.tsx` 为 `onRowEnter` / `onRowLeave`：鼠标移入整行任意位置（图标、项目名、操作按钮）即展示右侧 `ProjectHoverCard`；点击 `···` 后隐藏信息卡并在离开整行之前持续抑制回显，只有鼠标完全移出该项目行后再重新移入才恢复触发。
- 不在范围：尚未批准的 A1 跨包重构（`@lfaa/ui-theme` 等）。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.tsx` | 为 `SidebarItemConfig` 增加整行 `onMouseEnter` / `onMouseLeave` 支持并绑定到 `.itemRow` |
| 修改文件 | `packages/ui/layout/client/useProjectMenus.ts` | 将 `onMoreEnter` / `onMoreLeave` 重命名为 `onRowEnter` / `onRowLeave`，按整行边界处理悬停显示与点击抑制状态 |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.tsx` | 将 `onRowEnter` / `onRowLeave` 绑定到整行配置项，移除 `···` 按钮上的独立悬停监听 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BpG9scTR.css`、`apps/web/dist/assets/index-BBpTSebs.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000025-20261117-2158-hover-card-on-entire-project-row.md` | 记录整行悬停触发调整与实测结果 |
| 新增文件 | `docs/updata-log/000025-20261117-2158-hover-card-on-entire-project-row.md` | 记录移入整行项目底色即显示悬浮卡片优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例通过 |
| `pnpm run typecheck` | 通过 | 4 个子项目 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6620 个模块，输出 `dist/assets/index-BpG9scTR.css` 与 `dist/assets/index-BBpTSebs.js`，耗时 `844ms` |
| 内置浏览器整行悬停状态机实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；直接移入 `app1` 左侧文字区域即弹出信息卡（`hoverOnRowLabel=true`）；点击 `···` 立即隐藏信息卡并弹出菜单；再次点击 `···` 关闭并移动鼠标到同行的 `app1` 文字区保持抑制不显示（`hoverSuppressedAcrossSameRow=false`）；移出 `app1` 整行后再重新移入立即重新显示（`hoverOnRowReenter=true`） |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：将悬停事件绑定恢复到 `···` 按钮并重新构建即可。
- 遗留问题：上轮提出的 A1 跨包拆包规划（`@lfaa/ui-theme` 等）待负责人确认后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：悬停项目整行即可触发悬浮信息卡片，已同步新增同编号 `updata-log`。
