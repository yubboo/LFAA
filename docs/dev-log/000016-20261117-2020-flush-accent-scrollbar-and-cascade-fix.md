# DEV-000016｜滚动条紧贴右缘与全站强调色联动修复

- 任务编号：000016
- 开始时间：2026-11-17 20:17:40 +08:00
- 完成时间：2026-11-17 20:20:05 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 及内置浏览器实测均已通过）
- 审批级别及批准证据：A0；负责人要求左二栏滚动条紧贴右侧分隔线，并让滚动条随外观“强调色”变色
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 消除 `NavigationSidebar` 外层 `.sidebarBody` 的左右内边距，将内边距移入列表与搜索框自身，使左二栏滚动条紧贴右分隔线。
  - 将全局滚动条（去除 Chromium 原生上下三角按钮，支持 `::-webkit-scrollbar-thumb` 与 Firefox `@supports not` 回退）与侧栏激活态接入 `--color-accent-rgb`，并移除 `.shell` 中遮蔽 `html` 内联 `--color-accent` 继承的硬编码声明，让切换任意强调色时滚动条、高亮项、模式卡片边框、开关与滑块同步变色。
- 不在范围：新增外部依赖或修改业务逻辑。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `apps/web/src/app.css` | 改用无上下三角的细滚动条（`6px`），滑块颜色绑定 `rgb(var(--color-accent-rgb) / 0.44)`（悬停 `0.76`），并为非 WebKit 引擎保留 `@supports not` 回退 |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.module.css` | 将 `.sidebarBody` 左右内边距置 `0`，使滚动容器直抵右分隔线 |
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 由 `.searchWrap` 与 `.groups` 承担 `0.85rem` 水平边距，`.itemActive` 边框与底色改用 `--color-accent-rgb` |
| 修改文件 | `packages/ui/layout/client/components/NavigationGroups.module.css` | 同步 `.newChat` 水平外边距（`0.85rem`）对齐列表项 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | 移除 `.shell` 上重复硬编码的 `--color-accent: #e66aa8`，解除对 `html` 注入的强调色 CSS 变量的遮蔽 |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-BYx2xIoe.css`、`apps/web/dist/assets/index-bD2x05Re.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000016-20261117-2020-flush-accent-scrollbar-and-cascade-fix.md` | 记录贴边滚动条、强调色级联修复与浏览器复验 |
| 新增文件 | `docs/updata-log/000016-20261117-2020-flush-accent-scrollbar-and-cascade-fix.md` | 记录滚动条贴边与随强调色变色更新 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6613 个模块，耗时 `843ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | HTTP 200，0 条控制台/页面错误：<br>- 左二栏 `[data-region="section-navigation"]` 右边界 `343.19px`，`.groups` 滚动区右边界 `342.42px`（仅隔 `0.77px` 边框，完全紧贴右侧）；<br>- 切换强调色 `粉色` → `蓝色` 后，滚动条滑块、`外观` 侧栏激活项、选中模式卡片边框与 `半透明侧边栏` 开关均同步变为 `#3B82F6`，切回 `粉色` 同步恢复 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复本轮修改的 5 个 CSS 文件与 `apps/web/dist/` 后重新执行 `pnpm run build`，并删除本轮两份日志。
- 遗留问题：无已知阻塞问题。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：左二滚动条紧贴右缘且全站滚动条与高亮控件跟随强调色同步变色，已新增同编号 `updata-log`。
