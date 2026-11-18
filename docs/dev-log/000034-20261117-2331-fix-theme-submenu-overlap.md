# DEV-000034｜修复主题快捷切换浮层遮挡用户菜单与半透明透字问题

- 任务编号：000034
- 开始时间：2026-11-17 23:27:02 +08:00
- 完成时间：2026-11-17 23:31:10 +08:00
- 类型：fix
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与桌面 `1440×900` / `1280×680` / 移动 `390×844` 浏览器实测通过）
- 审批级别及批准证据：A0；负责人截图指出在用户菜单内点击“深色模式”后，主题子菜单压盖在用户菜单行与触发按钮上方并存在背景“暂未接入”文字透字问题
- 关联 Issue/PR/Commit：无

## 问题根因定位

1. **子菜单下拉定位与父菜单重叠**：`ThemeModeQuickSwitch` 先前固定向下弹出（`rect.right - menuWidth`, `rect.bottom + 6`），导致子菜单直接落在 `#lfaa-user-menu` 上半部分，“显示智能伙伴 / 邀请好友 / 暂未接入”被部分压盖；当视口高度偏矮时还会向上夹紧反盖触发胶囊按钮本身。
2. **高透明度表面导致底层文字透字**：`ThemeModeQuickSwitch.module.css` 使用半透明 `--glass-popover-bg`，叠在 `#lfaa-user-menu` 或工作区文字之上时底层文本清晰透出，造成视觉杂乱。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.tsx` | 当 `#lfaa-user-menu` 右侧空间充足时改为向右侧（`panelRect.right + 8`, `rect.top - 6`）侧向级联展开，彻底避开用户菜单内容与触发胶囊；窄屏移动端回退正下方（`rect.bottom + 8`）展开（145 行） |
| 修改文件 | `packages/ui/theme/client/components/ThemeModeQuickSwitch.module.css` | 将 `.menu` 底色调整为 `color-mix(in srgb, var(--user-bg, #181b1f) 94%, var(--user-fg, #ffffff) 6%)` 搭配磨砂模糊，保留液态玻璃质感同时彻底阻断底层文字透出（123 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-wdgX7vwZ.css`、`apps/web/dist/assets/index-yjJKBXZf.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000034-20261117-2331-fix-theme-submenu-overlap.md` | 记录子菜单遮挡与透字根因定位、修复及实测验证 |
| 新增文件 | `docs/updata-log/000034-20261117-2331-fix-theme-submenu-overlap.md` | 记录主题子菜单侧向弹出不遮挡及防透字优化 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 812.2016`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6637 个模块，输出 `dist/assets/index-wdgX7vwZ.css`（74.70 kB）与 `dist/assets/index-yjJKBXZf.js`（405.74 kB），耗时 `943ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900` / `1280×680` / `390×844`） | 通过 | 0 条控制台/页面错误；`1440×900` 下 `#lfaa-user-menu` 右边缘 `409.58px`，主题子菜单左边缘 `417.57px`（间距 `7.99px`，完全分离无遮挡，表面不透字）；`390×844` 移动端下子菜单在胶囊正下方 `7.99px` 处展开，实底磨砂遮挡下层文字且深/浅色来回切换无溢出 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：恢复 `ThemeModeQuickSwitch.{tsx,module.css}` 先前定位与底色规则并重新构建即可。
- 遗留问题：前一轮提交的 `@lfaa/chat`（真实聊天会话、项目下会话列表与 `N 次聊天` 实时统计）A1 实施计划待负责人确认两个细节后启动。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：主题模式子菜单现侧向独立展开且彻底消除文字透字，已同步新增同编号 `updata-log`。
