# DEV-000013｜统一跨设备字号比例与基准字号解耦

- 任务编号：000013
- 开始时间：2026-11-17 19:59:50 +08:00
- 完成时间：2026-11-17 20:02:30 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 及桌面端/手机端内置浏览器复验均已通过）
- 审批级别及批准证据：A0；负责人反馈相同 `14px` 设置下部分设备/侧栏字体偏大、比例不一致及旧标签页残留状态竖折截图
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 将 `:root` 保持为固定 `16px`（仅作 `rem` 布局几何单位），将 `--ui-font-size`（默认 `14px`）移至 `body`，并补充 `text-size-adjust: 100%` 防止移动端系统字号膨胀。
  - 消除 `NavigationGroups`（原 `1.15rem` / `1.1rem`）、`NavigationRail`、`AppMenu` 及主标题 `3vw` 流式字号导致的跨设备字体偏大与比例跳变，统一采用紧致 `em` 阶梯比例。
- 不在范围：更改四栏结构或业务插件契约。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `apps/web/src/app.css` | `:root` 固定 `16px` 并加 `text-size-adjust: 100%`，`body` 应用 `font-size: var(--ui-font-size, 14px); line-height: 1.5;` |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | `新聊天` 改为 `1em`（`14px`），`置顶/项目/最近` 与列表项改为 `0.93em`（`~13px`），提示文案 `0.86em`/`0.78em` |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.module.css` | `设置` 标题 `1em`、模式切换按钮 `1.07em`（全断点一致） |
| 修改文件 | `packages/ui/layout/client/components/NavigationRail.module.css` | 提示气泡 `0.86em`、弹出菜单项 `0.96em` |
| 修改文件 | `packages/ui/layout/client/components/AppMenu.module.css` | 应用列表项 `0.96em` |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | 顶栏 `0.93em`、状态 `0.92em`，主标题由 `clamp(1.7rem, 3vw, 2.5rem)` 改为固定比例 `2em`（`28px`） |
| 修改文件 | `packages/ui/layout/client/components/AppearanceSettings.module.css` | 标题/描述/行标签统一改用 `em` 阶梯（`1.55em` / `0.95em` / `0.96em` / `0.86em`） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.module.css` | 项目页标题改为 `1.85em`、副标签 `0.88em`，消除 `3vw` 跨屏波动 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-D3qZotIy.css`、`apps/web/dist/assets/index-DNa-lbu3.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000013-20261117-2002-fix-typography-scale-consistency.md` | 记录字号解耦分析、改动文件及像素实测对比 |
| 新增文件 | `docs/updata-log/000013-20261117-2002-fix-typography-scale-consistency.md` | 记录跨设备字号一致性修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6611 个模块，耗时 `819ms` |
| 内置浏览器跨设备字号实测（`http://127.0.0.1:5173/`） | 通过 | HTTP 200，0 条控制台/页面错误：<br>- **桌面 `1440×900`**：`:root` `16px`、`body` `14px`、`新聊天` 文本 `41.98×21.00px`（`14px`）、`置顶` 文本 `26.03×19.52px`（`13.02px`）、`h1` `33.61px` 高（`28px`）、顶栏 `56.00px`、`本地模式` 单绿点单行（`61.50×17.97px`）。<br>- **手机 `390×844`**：页面宽度 `390px` 无溢出，`h1` `33.61px` 高，`新聊天` `41.98×21.00px`、`置顶` `26.03×19.52px`，与桌面端像素级一致 |

## 风险、回滚与遗留问题

- 风险：无；`rem` 布局尺寸（顶栏高度、图标栏宽度）不再受用户界面字号滑块/数值改动影响。
- 回滚办法：恢复本轮修改的 8 个样式文件及 `apps/web/dist/` 后重新执行 `pnpm run build`，并删除本轮两份日志。
- 遗留问题：用户此前截图中的图一（`•• 本地模式` 竖折）对应更早缓存标签页，在 `DEV-000011` 中已由 `.statusDot` 修复并在本轮复验中确认正常，刷新标签页即可同步最新状态。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：修复了跨设备字号偏大与不一致问题，已新增同编号 `updata-log`。
