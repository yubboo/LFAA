# DEV-000018｜为“更多”菜单中的“项目”补充图钉固定能力

- 任务编号：000018
- 开始时间：2026-11-17 20:25:27 +08:00
- 完成时间：2026-11-17 20:26:40 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 与内置浏览器固定/取消固定实测均已通过）
- 审批级别及批准证据：A0；负责人截图圈出“更多”菜单中“项目”行缺失右侧图钉按钮
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：允许用户在“更多”菜单中通过图钉按钮将“项目”固定到左一图标菜单栏及取消固定，行为与其他应用入口保持一致。
- 不在范围：改变默认固定列表（仍默认固定 `站点`）。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/usePinnedApps.ts` | 将 `"projects"` 加入 `PINNABLE_VIEWS` 白名单，允许本地持久化保存 |
| 修改文件 | `packages/ui/layout/client/components/AppMenu.tsx` | 移除 `action.view !== "projects"` 判断，为“项目”行展示图钉固定/取消固定按钮 |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.tsx` | 移除 `action.view !== "projects"` 过滤，支持在左一图标栏渲染已固定的“项目”图标 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-DJXGMsP2.css`、`apps/web/dist/assets/index-D13yve8j.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000018-20261117-2026-enable-pin-projects-in-more-menu.md` | 记录修复文件、验证与图钉交互实测结果 |
| 新增文件 | `docs/updata-log/000018-20261117-2026-enable-pin-projects-in-more-menu.md` | 记录“项目”入口支持固定到左一图标栏的修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，耗时 `834ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | HTTP 200，0 条控制台/页面错误；打开“更多”菜单可见“固定到图标栏: 项目”图钉按钮，点击后左一栏立即出现“项目”图标（`aria-pressed="true"`），再次点击“从图标栏取消固定: 项目”后从左一栏移除（`aria-pressed="false"`） |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复本轮修改的 3 个源文件与 `apps/web/dist/` 后重新执行 `pnpm run build`，并删除本轮两份日志。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：“更多”菜单中“项目”已可固定/取消固定到左一图标栏，已新增同编号 `updata-log`。
