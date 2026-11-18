# DEV-000037｜将主题快捷切换子菜单顶部改为与用户菜单外框上沿 0px 齐平对齐

- 任务编号：000037
- 开始时间：2026-11-17 23:41:58 +08:00
- 完成时间：2026-11-17 23:44:20 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与 `1440×900` / 动态 `1280×680` 浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传带红色顶线标注图要求“对齐”，即主题子菜单顶边与 `#lfaa-user-menu` 外框上沿齐平
- 关联 Issue/PR/Commit：无

## 变更详情

- 修改 `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx`（168 行）中的 `computeCoords`：桌面与平板侧向展开时，将 `minTop` 与目标 `top` 从胶囊 `rect.top` 改为直接对齐 `#lfaa-user-menu` 面板上沿 `panelRect.top`（`Math.max(12, panelRect.top)`），使其与外层用户菜单上边框保持 `0.00px` 齐平。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx` | 将侧向展开子菜单纵坐标基准切换为 `panelRect.top`，与用户菜单顶部外框齐平（168 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-GsybTbJ6.css`、`apps/web/dist/assets/index-DHDcvbmB.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000037-20261117-2344-flush-align-theme-menu-with-panel-top.md` | 记录子菜单顶边与用户菜单上沿齐平修正及实测结果 |
| 新增文件 | `docs/updata-log/000037-20261117-2344-flush-align-theme-menu-with-panel-top.md` | 记录主题子菜单顶边与用户菜单上沿 0px 齐平优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 850.186`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6638 个模块，输出 `dist/assets/index-GsybTbJ6.css`（74.45 kB）与 `dist/assets/index-DHDcvbmB.js`（407.37 kB），耗时 `872ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900` → 动态 `1280×680` → `1440×900`） | 通过 | 0 条控制台/页面错误；`1440×900` 下 `userMenu.top = 491.25px`、`submenu.top = 491.25px`（差值 `0.00px`），右侧间距 `7.99px`；动态缩放至 `1280×680` 时同步跟随保持 `271.24px / 271.23px`（差值 `0.01px`） |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：将 `panelRect.top` 切回 `rect.top` 并重新构建即可。
- 遗留问题：此前提交的 `@lfaa/chat` A1 计划待负责人确认细节后启动。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：主题子菜单顶边现与用户菜单顶边完全齐平，已同步新增同编号 `updata-log`。
