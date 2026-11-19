# 000155｜内置浏览器 HiDPI 清晰度、深浅主题配色同步、CDP Screencast 实时流与极速交互路径

2026-11-19 17:58 +08:00

- **高分屏画质锐化与深浅配色同步（[browser-service.ts](file:///e:/lfaa/packages/core/browser/src/browser-service.ts)、[browser-client.ts](file:///e:/lfaa/packages/core/browser/client/browser-client.ts)）**：
  - 读取宿主浏览器 `window.devicePixelRatio`（限幅 `[1, 2.5]`）传入 Playwright `deviceScaleFactor`，并同步 LFAA 当前主题（`data-resolved-theme`）到 Playwright `colorScheme`（`dark` / `light`）与 `emulateMedia`。
  - 修复高分屏下的点击坐标映射，统一按 CSS `viewport` 尺寸换算（不误用多倍 `naturalWidth`）。
- **CDP Screencast SSE 实时图像推流（[screencast-manager.ts](file:///e:/lfaa/packages/core/browser/src/screencast-manager.ts)、[http-handler.ts](file:///e:/lfaa/packages/core/browser/src/http-handler.ts)）**：
  - 新增 `GET /api/browser/stream`，通过 Playwright `CDPSession` 启用 `Page.startScreencast` 持续推送 JPEG 帧流，取代原先 `2200ms` 定时整页轮询，无页面浏览订阅时自动停止并释放 `CDPSession`。
- **人工操作极速路径（[RightBrowserPane.tsx](file:///e:/lfaa/packages/core/browser/client/RightBrowserPane.tsx)）**：
  - 人手点击、滚轮与按键输入启用 `fast` 模式，跳过 `extractPageStructure` 全页 DOM 遍历与多余阻塞等待，滚轮前端防抖由 `120ms` 缩短至 `32ms`，显著降低操作卡顿感。
