# DEV-000036｜修复主题快捷切换子菜单顶部突出对齐问题，实现实测高度夹紧与窗口缩放实时跟随

- 任务编号：000036
- 开始时间：2026-11-17 23:37:00 +08:00
- 完成时间：2026-11-17 23:41:25 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与 `1440×900` / `1280×680` 动态缩放浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传截图指出“搞（高）出来了一些”，要求主题子菜单顶部不得高出用户菜单上沿
- 关联 Issue/PR/Commit：无

## 问题根因与修复详情

1. **顶部不再高出父菜单**：此前 `rect.top - 6` 加上静态估算高度，在窗口高度/缩放变化或靠近顶部边界时容易高于预期位置。现将 `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx`（168 行）中子菜单 `top` 下限严格锁定在 `Math.max(12, panelRect.top + 4)`，默认与“深色模式”胶囊顶部 `rect.top` 0px 齐平，绝不高于 `#lfaa-user-menu` 顶部边界。
2. **实测尺寸修正与缩放/滚动同步**：引入 `useLayoutEffect` 对 `menuRef` 实际渲染宽高做二次精确测量重算，并挂载 `resize` / `scroll` 监听，保证展开状态下窗口高度变化时（如 `1440×900` → `1280×680`）子菜单始终紧跟胶囊顶部同步移动。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx` | 新增 `computeCoords`（锁定 `minTop >= panelRect.top + 4` 且默认对齐 `rect.top`）、`useLayoutEffect` 实测重算及 `resize`/`scroll` 同步监听（168 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-GsybTbJ6.css`、`apps/web/dist/assets/index-Clng7u_u.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000036-20261117-2341-align-theme-submenu-flush.md` | 记录主题子菜单顶部齐平对齐修复与动态缩放实测结果 |
| 新增文件 | `docs/updata-log/000036-20261117-2341-align-theme-submenu-flush.md` | 记录主题子菜单对齐稳定性优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 811.7414`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6638 个模块，输出 `dist/assets/index-GsybTbJ6.css`（74.45 kB）与 `dist/assets/index-Clng7u_u.js`（407.37 kB），耗时 `911ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900` → 动态 `1280×680` → `1440×900`） | 通过 | 0 条控制台/页面错误；`1440×900` 下 `submenu.top === capsule.top`（同为 `513.47px`，低于 `#lfaa-user-menu` 上沿 `22.22px`，右侧间距 `7.99px`）；保持打开直接缩放至 `1280×680` 时 `submenu.top` 实时跟随更新至 `293.46px` 仍与胶囊顶 `0.00px` 齐平 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：还原 `ThemeModeQuickSwitch.tsx` 的坐标计算回调并重新构建即可。
- 遗留问题：此前提交的 `@lfaa/chat`（真实聊天会话、项目下会话列表与卡片 `N 次聊天` 实时统计）A1 计划待负责人确认细节后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：主题子菜单顶部不再高出父菜单，且窗口缩放时保持齐平跟随，已同步新增同编号 `updata-log`。
