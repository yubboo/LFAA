# LFAA 桌面端原生 WebContentsView 内置浏览器方案

- 状态：已实施
- 日期：2026-11-24
- 涉及范围：`apps/desktop`、`packages/client/ui-browser`、`scripts/lfaa.ps1`、`lfaa.bat`

## 1. 目标

在 LFAA Electron 桌面端（`apps/desktop`）为右侧内置浏览器接入 Electron 原生 `WebContentsView`（纯净 Chromium GPU 硬件合成渲染），消除 Web 版经由 Playwright Edge → JPEG → Base64 → SSE → Canvas 带来的 30fps 延迟、压缩发虚与 `Microsoft Edge` 错误页标志，同时完善 `lfaa.bat`（`scripts/lfaa.ps1` 菜单 3）实现一键自动补构建并启动桌面端。

## 2. 技术设计

1. **Electron 主进程原生视图管理（`apps/desktop/src/embedded-browser.ts`）**：
   - 在 `mainWindow.contentView` 下按需挂载 `WebContentsView`（`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`）。
   - 提供 IPC 通道：`lfaa:browser:sync`（同步 `visible / bounds / url`）、`lfaa:browser:nav`（前进/后退/刷新）、`lfaa:browser:navigate`（校验 `http/https` 后原生导航）。
   - 监听 `did-navigate`、`did-navigate-in-page`、`page-title-updated`，主动向渲染进程推送最新地址、标题与历史栈状态。
2. **安全 Preload 桥（`apps/desktop/src/preload.ts`）**：
   - 通过 `contextBridge.exposeInMainWorld("__LFAA_DESKTOP_BROWSER__", ...)` 仅暴露最小必要 API，不破坏 `contextIsolation` 与 `sandbox`。
   - `apps/desktop/tsdown.config.ts` 增加 `preload`（CJS 格式，供 Electron `sandbox: true` 加载）构建入口。
3. **前端无缝对接（`packages/client/ui-browser`）**：
   - 新增轻量桥接模块 `client/api/desktop-browser-bridge.ts`，检测 `window.__LFAA_DESKTOP_BROWSER__`。
   - 桌面端常规浏览/预览态下直接同步视口 `getBoundingClientRect()` 给原生 `WebContentsView`（支持铺满与设备工具栏缩放框）；当 Agent 正在自动操控浏览器（需展示 CDP 光标与四点思考胶囊）或出现弹窗/下拉菜单覆盖时自动退让隐藏原生视图，避免 OS 级视图遮挡菜单或设置中心。
4. **`lfaa.bat` / `scripts/lfaa.ps1` 菜单 3 一键构建并启动桌面端**：
   - 菜单 3 自动检查依赖与桌面产物（`apps/desktop/dist/main.js`、`apps/desktop/dist/preload.cjs`、`apps/desktop-host/lib/index.js`、`apps/web/dist/index.html`），缺失时自动执行构建，释放 5173 后直接启动桌面端。
