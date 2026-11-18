# DEV-000031｜实现刷新/重开页面零闪烁无感恢复（首绘前主题直出 + SWR 缓存秒开 + 插件就绪挂载）

- 任务编号：000031
- 开始时间：2026-11-17 22:58:26 +08:00
- 完成时间：2026-11-17 23:07:10 +08:00
- 类型：perf + feat
- 状态：完成（Cordis 单元测试 14/14、`typecheck`、`build` 与内置浏览器首帧直出及静默刷新实测通过）
- 审批级别及批准证据：A0；负责人明确选择“刷新/重开页面零闪烁恢复（先瞬间还原主题色、项目与分区缓存，后台静默校对最新数据，不闪白屏或空白列表）”
- 关联 Issue/PR/Commit：无

## 问题根因与优化措施

1. **首绘白屏/色偏消除（`apps/web/index.html`，74 行）**：
   - 原入口内联脚本仅恢复 `dataset.theme`，CSS 变量 `--user-bg` / `--user-fg` / `--color-accent` 与 `data-resolved-theme` / `data-preset` / `data-glass` 需待 JS 包加载执行 `themeClientPlugin` 后才写入。
   - 现改为在 `<head>` 内联脚本中直接解析 `lfaa:appearance-mode` 与 `lfaa:appearance-config`，首屏绘制前即写入全部主题 `data-*` 属性、CSS 变量、根背景/前景色及 `<meta name="theme-color">`，彻底消除刷新瞬间的浅色/默认值闪烁。
2. **首帧空插件空隙消除（`packages/ui/layout/client/index.tsx` 37 行、`apps/web/src/main.tsx` 35 行）**：
   - 原 `main.tsx` 在注册 `workbenchPlugin` 时立即同步渲染 React，而以 `inject: ["workbench"]` 挂载的 `themeClientPlugin`、`sectionsClientPlugin`、`workspaceClientPlugin` 在微任务之后才注册视图与 Provider。
   - 现为 `WorkbenchPluginConfig` 新增可选 `ready?: Promise<unknown>`；`main.tsx` 通过 `Promise.allSettled([theme, sections, workspace])` 等待业务插件全部注册完毕并同步加载缓存后再首次渲染 React，避免出现未挂载 Provider 或“该功能尚未接入”中间帧。
3. **SWR 缓存秒开与后台静默校对**：
   - **`LocalProjectStore`（`packages/workspace/workspace/client/local-project-store.ts`，220 行）**：构造时同步从 `lfaa:cache-projects` 还原项目列表快照并置 `loaded`；`refreshProjects()` 在后台静默比对 `/api/workspace/projects` 序列化结果，数据一致时不触发无效 `emit()` 重绘，发生外部增删时才平滑更新并写入缓存。
   - **`SectionStore`（`packages/workspace/sections/client/section-store.ts`，158 行）**：构造时同步从 `lfaa:cache-sections` 还原自定义分区列表；`refreshSections()` 与增删改操作统一经 `commitSections()` 更新缓存并在数据一致时跳过重绘。
   - **`ProjectWorkspace`（`packages/workspace/workspace/client/components/ProjectWorkspace.tsx`，226 行）**：新增 `lfaa:cache-project-inspections` 有界目录快照缓存（最多保留 12 项 `{projectId}::{rootPath}`）；打开或刷新项目页面时直接从缓存渲染目录树且不显示“正在读取项目目录...”，后台静默完成 `/inspect` 校对后仅在目录变更时更新。

## 实际修改的文件与文件夹

项目根目录：`E:\lfaa`

| 操作（新增/修改/删除/重命名） | 完整相对路径 | 目的及影响 |
|---|---|---|
| 修改文件 | `apps/web/index.html` | 首绘前内联同步恢复全套主题色、液态玻璃属性与强调色（74 行） |
| 修改文件 | `apps/web/src/main.tsx` | 等待 `theme` / `sections` / `workspace` 插件注入完成后再渲染 `WorkbenchShell`（35 行） |
| 修改文件 | `packages/ui/layout/client/index.tsx` | 为 `WorkbenchPluginConfig` 增加可选 `ready` 延迟首帧挂载支持（37 行） |
| 修改文件 | `packages/workspace/workspace/client/local-project-store.ts` | 新增 `lfaa:cache-projects` 同步还原与后台静默差异比对（220 行） |
| 修改文件 | `packages/workspace/workspace/client/components/ProjectWorkspace.tsx` | 新增 `lfaa:cache-project-inspections` 目录树缓存与无感后台校对（226 行） |
| 修改文件 | `packages/workspace/sections/client/section-store.ts` | 新增 `lfaa:cache-sections` 同步还原与后台静默差异比对（158 行） |
| 修改文件 | `packages/workspace/workspace/tests/cordis-lifecycle.test.ts` | 新增 `LocalProjectStore` 缓存秒开及一致数据免重绘回归用例（272 行） |
| 修改文件 | `packages/workspace/sections/tests/sections-lifecycle.test.ts` | 新增 `SectionStore` 缓存秒开及一致数据免重绘回归用例（117 行） |
| 刷新生成物 | `apps/web/dist/index.html`、`apps/web/dist/assets/index-CtlN_GGW.css`、`apps/web/dist/assets/index-C8Gi3E2O.js` | `pnpm run build` 重新生成生产构建产物 |
| 新增文件 | `docs/dev-log/000031-20261117-2307-zero-flash-silent-reload.md` | 记录零闪烁首绘与 SWR 缓存秒开改动及验证结果 |
| 新增文件 | `docs/updata-log/000031-20261117-2307-zero-flash-silent-reload.md` | 记录页面刷新零闪烁秒开与后台静默校对体验提升 |

## 验证记录

| 命令或操作 | 结果（通过/失败/未运行） | 备注/证据 |
|---|---|---|
| `pnpm exec tsx --test packages/workspace/workspace/tests/cordis-lifecycle.test.ts packages/workspace/sections/tests/sections-lifecycle.test.ts packages/ui/theme/tests/theme-lifecycle.test.ts packages/ui/layout/tests/persistence-lifecycle.test.ts` | 通过 | 14/14 用例通过（`tests 14, pass 14, fail 0, duration_ms 849.5532`），覆盖 `LocalProjectStore` 与 `SectionStore` 缓存首屏秒开与远端一致免重绘 |
| `pnpm run typecheck` | 通过 | 6 个子项目 0 错误（`TYPECHECK_EXIT=0`） |
| `pnpm run build` | 通过 | Vite v8.3.8 转换 6635 个模块，输出 `dist/index.html`（3.93 kB）、`dist/assets/index-CtlN_GGW.css`（72.36 kB）、`dist/assets/index-C8Gi3E2O.js`（401.42 kB），耗时 `872ms` |
| 内置浏览器零闪烁刷新实测（`http://127.0.0.1:5173/`，`1440×900`） | 通过 | 0 条控制台/页面错误、0 个失败请求；新建临时分区 `"swr-sec"` 与项目 `"swr-check"` 并停留在项目详情页，执行 `page.reload({ waitUntil: 'domcontentloaded' })` 后立即检测：<br>1. `<html>` 首帧已就位 `data-theme="dark"`、`data-resolved-theme="dark"`、`data-preset="liquidGlass"`、`data-glass="true"` 及 `--user-bg: #121519` / `--color-accent: #E66AA8`；<br>2. 侧栏直接呈现 `"swr-sec"` 与 `"swr-check"`，无 `"还没有项目。"` 闪烁；<br>3. 主区域直接渲染 `h1="swr-check"` 与目录状态卡，无 `"正在读取项目目录..."` 或 `"该功能尚未接入"` 闪烁；<br>4. 随后 `/api/workspace/projects`、`/sections` 与 `/inspect` 均 `200 OK` 静默完成。完成后已清理临时分区、项目与空目录 |

## 风险、回滚与遗留问题

- 风险：无；本地缓存与持久化配置均只存轻量化摘要且带长度/类型限制。
- 回滚办法：恢复 `index.html`、`main.tsx` 及两个 Store 与 `ProjectWorkspace.tsx` 缓存逻辑并重新构建即可。
- 遗留问题：无。
- Git 状态及提交：`E:\lfaa` 不是 Git 仓库；无提交。
- 本轮有无用户可见变化、是否新增 updata-log：刷新/重开页面全程零闪烁秒开且后台静默校验更新，已同步新增同编号 `updata-log`。
