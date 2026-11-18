# Dev Log 000041 — 对齐参考图深色与浅色主题标准配色

- **时间**：2026-11-18 00:42:23 +08:00
- **任务编号**：000041
- **关联升级**：根据用户提供的深色与浅色两张参考截图，精准采样并校准工作区明暗主题、液态玻璃分层色彩变量及首屏防闪烁配置。

## 变更文件清单

- **新增**：
  - `packages/ui/layout/client/components/ShellTheme.module.css`（112 行）：拆分并集中定义工作区明暗两套参考色板变量（浅色模式：中心 `#FFFFFF`、左一栏 `#ECF5F9` 基调与纯白激活胶囊、左二与右侧栏 `#F5FAFC` 基调、文本 `#171717`；深色模式：中心 `#181818` 纯中性炭黑、左一栏 `#1C2123` 基调、左二与右侧栏 `#191A1B` 基调、浮起表面 `#242425`、文本 `#F3F3F3`），移除此前偏蓝绿/紫灰的 `--ambient-glow` 径向光晕。
- **修改**：
  - `packages/ui/layout/client/components/WorkbenchShell.module.css`（299 行）：抽离颜色变量后保持结构聚焦，`.workspaceBar` 改用 `--color-topbar` 与中央画布融为一体。
  - `packages/ui/layout/client/components/WorkbenchShell.tsx`（395 行）：接入 `ShellTheme.module.css`。
  - `packages/ui/layout/client/components/NavigationRail.module.css`（259 行）：新增 `--color-rail-active` 与 `--rail-active-shadow`，使浅色模式下左一激活图标呈现纯白柔和胶囊、深色模式呈现低对比微亮胶囊。
  - `packages/ui/theme/src/index.ts`（235 行）：更新 `THEME_PRESETS.liquidGlass` 与 `classic` 的 `light`（`#FFFFFF` / `#171717`）和 `dark`（`#181818` / `#F3F3F3`）标准底色与前景色。
  - `packages/ui/theme/client/appearance-store.ts`（230 行）：新增 `migrateLegacyDefaults`，在读取 `lfaa:appearance-config-v1` 时自动把旧版未修改默认色值（`#EEF2EE`/`#1E221F`/`#121519`/`#F2F4F2`）平滑迁移至新参考色，同时完整保留用户手动挑选的自定义配色。
  - `packages/ui/theme/tests/theme-lifecycle.test.ts`（90 行）：补充 `THEME_PRESETS` 新配色断言与 `AppearanceStore` 旧默认色迁移 / 自定义色保留单元测试。
  - `apps/web/index.html`（82 行）：修复首屏脚本优先读取 `lfaa:appearance-config-v1`，并对齐新版明暗底色与旧版默认色兜底映射。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/ui/layout/tests/persistence-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts` — 7/7 通过（0 失败，0 跳过）。
2. **类型检查**：`pnpm run typecheck` — 全部 6 个工程通过。
3. **生产构建**：`pnpm run build` — `@lfaa/app-web` 构建成功（`built in 1.02s`）。
4. **真机 Playwright 浏览器双模式验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - **深色模式**：切换为 `深色模式` 后，`html[data-resolved-theme="dark"]`、`--user-bg: #181818`、`--user-fg: #F3F3F3`，左一栏为 `#1C2123` 基调、左二与右侧栏为 `#191A1B` 基调、中央工作区为纯净无偏色 `#181818`；控制台错误数 0。
   - **浅色模式 + 刷新持久化**：切换为 `浅色模式` 并执行 `page.reload()` 后保持不变，`html[data-resolved-theme="light"]`、`--user-bg: #FFFFFF`、`--user-fg: #171717`，左一栏为 `#ECF5F9` 基调配合纯白激活按钮、左二与右侧栏为 `#F5FAFC` 基调、中央工作区为纯白 `#FFFFFF`；控制台错误数 0。
   - 当前后台 `pnpm lfaa web`（`task-2069`）已重启并运行最新构建。
