# DEV-000010｜修复三栏顶栏水平对齐与设置中心左二菜单联动

- 任务编号：000010
- 开始时间：2026-11-17 19:25:16 +08:00（同步 `E:\lfaa\pnpm-lock.yaml` 起点）
- 完成时间：2026-11-17 19:38:20 +08:00
- 类型：fix
- 状态：完成（`typecheck`、`build` 与内置浏览器实测验收均已通过）
- 审批级别及批准证据：A0；用户明确指示在 `E:\lfaa` 工作、通过内置浏览器验收，并反馈“三栏顶栏未对齐”与“进入外观设置时左二菜单未切换为设置菜单”两项 Bug
- 关联 Issue/PR/Commit：无

## 本轮目标与非目标

- 目标：
  - 在 `E:\lfaa` 离线同步根目录 `pnpm-lock.yaml`，使 `ensure-dependencies.mjs --check-only`、类型检查与构建就绪。
  - 修复四栏骨架中左二菜单栏、中间主工作区与右侧上下文栏的顶栏高度与底部分隔线未对齐成一条水平线的问题。
  - 修复进入设置中心（`外观` 等设置视图）时左二菜单栏未切换为设置菜单的问题，提供“设置中心”导航与返回工作区入口。
- 不在范围：新增后端设置保存服务、修改 `G:\lfaa` 备份目录、重构业务插件包。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `pnpm-lock.yaml` | 离线同步 `apps/web` 的 `@lfaa/workspace` 依赖及 `packages/workspace/workspace` 工作区条目 |
| 修改文件 | `packages/ui/layout/client/navigation.ts` | 新增 `settingsGeneral`、`personalProfile` 视图类型与 `isSettingsView` 判断函数 |
| 修改文件 | `packages/ui/layout/client/locales.ts` | 新增设置中心、返回工作区、通用设置及外观描述的中英文文案 |
| 修改文件 | `packages/ui/layout/client/components/NavigationIcon.tsx` | 补充 `IconArrowLeft`（`arrowLeft`）与 `IconPalette`（`palette`）图标映射 |
| 新增文件 | `packages/ui/layout/client/components/SettingsMenu.tsx` | 实现设置中心左二菜单栏列表（外观、通用、个人资料，未接入项明确标注“暂未接入”） |
| 新增文件 | `packages/ui/layout/client/components/SettingsMenu.module.css` | 设置中心左二菜单样式，使用 Shell 统一主题变量 |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.tsx` | 247 行（≤ 250）；根据 `isSettingsView(activeView)` 在工作区导航与设置中心菜单间切换，并在搜索目标中加入“外观” |
| 修改文件 | `packages/ui/layout/client/components/NavigationSidebar.module.css` | 266 行（单组件布局样式，≤ 400；拆分为多文件会割裂同一侧栏的网格与弹层定位）；改为 `grid-template-rows: var(--topbar-height, 3.5rem) minmax(0, 1fr)` 并增加底部分隔线，使其与中、右顶栏严格对齐 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.tsx` | 在 `viewLabel` 中补充 `settingsGeneral` 与 `personalProfile` 标题映射 |
| 修改文件 | `packages/ui/layout/client/components/WorkbenchShell.module.css` | 261 行（单 Shell 布局与主题变量样式，≤ 400）；新增 `--topbar-height: 3.5rem`，将 `.workspaceBar` 高度固定为 `var(--topbar-height)` |
| 修改文件 | `packages/ui/layout/client/components/ContextPanel.module.css` | 将右侧栏 `.panel` 顶行及 `.header` 高度统一绑定 `var(--topbar-height, 3.5rem)` |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-DFI0ncS9.css`、`apps/web/dist/assets/index-C4El1ujd.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000010-20261117-1938-fix-topbar-alignment-and-settings-sidebar.md` | 记录本轮修复文件清单、构建与内置浏览器实测验收结果 |
| 新增文件 | `docs/updata-log/000010-20261117-1938-fix-topbar-alignment-and-settings-sidebar.md` | 记录顶栏对齐与设置中心左二菜单联动的用户可见修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm install --offline --no-optimistic-repeat-install` | 通过 | 耗时 `776ms`，完成 `E:\lfaa\pnpm-lock.yaml` 同步 |
| `node scripts/ensure-dependencies.mjs --check-only` | 通过 | 输出“依赖已安装且与工作区一致，跳过安装。”（退出码 `0`） |
| `pnpm run typecheck` | 通过 | `apps/cli`、`apps/web`、`@lfaa/ui-layout`、`@lfaa/workspace` 全部通过 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6604 个模块，耗时 `806ms` |
| `pnpm lfaa web` + 内置浏览器验收（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | HTTP 200，0 条控制台/页面错误；工作区与设置视图下左二、中间、右侧三栏顶栏 `boundingBox()` 均为 `top: 0`、`bottom: 55.9976`、`height: 55.9976`；点击用户菜单“设置”后左二栏切换为设置菜单并高亮“外观”，点击“通用”展示“暂未接入”状态，主题切换（浅色/深色/跟随系统）与返回工作区正常；左二与右侧面板收起/展开正常；`Ctrl+K` 搜索与新建/打开本地项目（同步更新中间工作区与右侧项目详情面板）正常 |

## 风险、回滚与遗留问题

- 风险：无新增安全或数据迁移风险；“通用”“个人资料”设置项仍为未接入占位页，明确提示未接入状态。
- 回滚办法：恢复本轮修改的 `packages/ui/layout/client/` 文件与 `pnpm-lock.yaml`，删除新增的 `SettingsMenu.tsx`、`SettingsMenu.module.css` 及本轮两份日志后重新执行 `pnpm run build`。
- 遗留问题：在 `1440×900` 且左右栏同时展开时，外观页“跟随系统”主题卡片标题在窄卡片下会自动换行（`跟随\n系统`），可后续按需微调卡片宽度或文案。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：修复了顶栏水平对齐与设置中心左二菜单切换，已新增同编号 `updata-log`。
