# DEV-000035｜将外观设置全部 5 处原生 `<select>` 统一替换为液态玻璃 `ThemeSelect` 下拉组件

- 任务编号：000035
- 开始时间：2026-11-17 23:29:25 +08:00
- 完成时间：2026-11-17 23:36:30 +08:00
- 类型：refactor + fix
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与内置浏览器实测通过）
- 审批级别及批准证据：A0；负责人上传「字体」原生黑色 `<select>` 与 `AccentSelect` 液态玻璃菜单对比图，要求将下拉列表样式统一为图二风格
- 关联 Issue/PR/Commit：无

## 设计与实现详情

1. **抽离共享液态玻璃选择器 `ThemeSelect`（`packages/ui/theme/client/components/ThemeSelect.tsx`，120 行）**：
   - 直接复用 `AccentSelect.module.css`（115 行）中的圆角胶囊触发器、Portal 浮层定位（按选项条数动态估算高度并在近底部时自动上翻）、圆角选项选中态与右侧 `IconCheck` 对勾，零重复 CSS。
   - 同时将 `AccentSelect.module.css` `.menu` 底色调整为高实度磨砂 `color-mix(in srgb, var(--user-bg, #181b1f) 94%, var(--user-fg, #ffffff) 6%)`，避免弹层跨行展开时下方文字透出。
2. **全面替换外观与高级设置全部 5 处原生 `<select>`**：
   - `AppearanceSettings.tsx`（303 行）：将「主题预设（`preset`）」与「界面字体（`uiFont`）」替换为 `<ThemeSelect>`。
   - `AppearanceAdvanced.tsx`（236 行）：将「界面字体样式（`uiFontWeight`）」、「内容字体（`contentFont`）」与「代码字体（`codeFont`）」全部替换为 `<ThemeSelect>`。
   - 清理 `AppearanceSettings.module.css`（270 行）中不再使用的 `.selectControl` 样式，并用文本扫描确认全仓库 JSX 中不再残余原生 `<select>`。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 新增文件 | `packages/ui/theme/client/components/ThemeSelect.tsx` | 实现通用液态玻璃下拉选择器，复用 `AccentSelect.module.css` 与 Portal 浮层定位（120 行） |
| 修改文件 | `packages/ui/theme/client/components/AccentSelect.module.css` | 将 `.menu` 底色改为高实度磨砂混合色，阻止跨行展开时透出下层文案（115 行） |
| 修改文件 | `packages/ui/theme/client/components/AppearanceSettings.tsx` | 将「主题预设」与「字体」两处原生 `<select>` 替换为 `<ThemeSelect>`（303 行） |
| 修改文件 | `packages/ui/theme/client/components/AppearanceSettings.module.css` | 清理废弃的 `.selectControl` 类（270 行） |
| 修改文件 | `packages/ui/theme/client/components/AppearanceAdvanced.tsx` | 将「界面字体样式」「内容字体」「代码字体」三处原生 `<select>` 替换为 `<ThemeSelect>`（236 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-GsybTbJ6.css`、`apps/web/dist/assets/index-BV_7utf1.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000035-20261117-2336-unify-theme-select-dropdowns.md` | 记录全量原生 `<select>` 替换为 `ThemeSelect` 的改造与验证结果 |
| 新增文件 | `docs/updata-log/000035-20261117-2336-unify-theme-select-dropdowns.md` | 记录外观与高级设置全部下拉控件统一样式升级 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| 全仓 JSX 原生 `<select>` 扫描 | 通过 | 仅 `ThemeSelect.tsx` 首行注释提及 `<select>`，实际组件 DOM 中 0 个原生 `<select>` |
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 794.7575`） |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6638 个模块，输出 `dist/assets/index-GsybTbJ6.css`（74.45 kB）与 `dist/assets/index-BV_7utf1.js`（406.92 kB），耗时 `873ms` |
| 内置浏览器实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误、页面内 `document.querySelectorAll("select").length === 0`；逐一展开并切换、恢复「主题预设」「字体」「界面字体样式」「内容字体」「代码字体」全部 5 处 `role="listbox"` 浮层，全部呈圆角液态玻璃质感与对勾选中态且无透字/裁切 |

## 风险、回滚与遗留问题

- 风险：无。
- 回滚办法：删除 `ThemeSelect.tsx`，在 `AppearanceSettings.tsx` 与 `AppearanceAdvanced.tsx` 恢复 `<select>` 并重新构建即可。
- 遗留问题：此前提交的 `@lfaa/chat` A1 计划仍待负责人确认两个细节后启动。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：外观设置页全部下拉列表均已统一为圆角液态玻璃风格，已同步新增同编号 `updata-log`。
