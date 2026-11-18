# DEV-000027｜修复项目行操作按钮在桌面/触屏混合设备常驻显示的问题，改为移入整行才显现

- 任务编号：000027
- 开始时间：2026-11-17 22:01:41 +08:00
- 完成时间：2026-11-17 22:04:30 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 5/5、`typecheck`、`build` 与内置浏览器实测通过）
- 审批级别及批准证据：A0；负责人截图指出项目行 `···` 与 `✎` 按钮应仅在鼠标移入整个项目行时一同显现，不能在未悬停行常驻或点击选中后残留
- 关联 Issue/PR/Commit：无

## 问题根因定位

1. **Windows 混合输入环境触发 `@media (hover: none)`**：Windows 带触控支持或部分内置 WebView 环境下，单一 `(hover: none)` 媒体查询可能为真，导致 `.rowActions` 在所有项目行常驻 `opacity: 0.9`。
2. **`:focus-within` 导致点击后残留显示**：点击进入某项目后，主按钮保持鼠标点击焦点使 `.itemRow:focus-within` 生效，移走鼠标后行尾操作按钮仍然残留显示。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/layout/client/components/SidebarSectionList.module.css` | 将 `.itemRow:focus-within` 收窄为 `.itemRow:has(:focus-visible)`（仅键盘 Tab 焦点显露），并将 `@media (hover: none)` 收窄为 `@media (hover: none) and (pointer: coarse)`（仅纯触屏粗指针默认显现） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-DhHW3lDh.css`、`apps/web/dist/assets/index-B8gxNB3B.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000027-20261117-2204-hide-row-actions-until-hover.md` | 记录常驻显示与 `:focus-within` 问题定位、改动与验证结果 |
| 新增文件 | `docs/updata-log/000027-20261117-2204-hide-row-actions-until-hover.md` | 记录项目行尾操作按钮仅在悬停整行或展开卡片/菜单时显现的修复 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 通过 | 5/5 用例通过 |
| `pnpm run typecheck` | 通过 | 4 个子项目 0 错误 |
| `pnpm run build` | 通过 | Vite 8.3.8 转换 6620 个模块，输出 `dist/assets/index-DhHW3lDh.css` 与 `dist/assets/index-B8gxNB3B.js`，耗时 `832ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误；点击激活 `app` 后移开鼠标至空白处，两行 `···` 与 `✎` 全部隐藏（`app1MoreVisible=false`, `appMoreVisible=false`）；移入 `app1` 整行后仅 `app1` 显现 `···`/`✎` 并弹出悬浮卡，同时已选中的 `app` 行右侧无任何常驻图标 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复 `SidebarSectionList.module.css` 中的 `@media (hover: none)` 与 `:focus-within` 规则并重新构建即可。
- 遗留问题：上轮提出的 A1 跨包架构拆分规划（`@lfaa/ui-theme` 等）待负责人确认后实施。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：项目行尾 `···` 与新聊天图标现严格在鼠标移入整行（或键盘焦点/菜单开启）时才显现，已同步新增同编号 `updata-log`。
