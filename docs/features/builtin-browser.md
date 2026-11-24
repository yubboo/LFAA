# 内置浏览器双引擎与高清低延迟交互方案

状态：**已实施**。本方案解决内置浏览器（`@lfaa/browser` + `@lfaa/client-ui-browser`）存在的滚动穿透乱跑、截图感卡顿、HiDPI 失效发糊与白雾遮罩感问题。

## 1. 现状根因

1. **滚动穿透与队列堆积**：
   - 前端视口使用被动 React `onWheel`，未拦截默认滚动且容器存在 `overflow: auto`、缺少 `overscroll-behavior: none`，滚动到达页面顶部/底部后穿透至外层容器或触发越界回弹。
   - 远端滚轮未传递鼠标坐标 `(x, y)`，且每 32ms 并发发出 `POST /api/browser/action`，后端每次串行执行 `page.title()` 并回传整张 Base64 截图，导致滚轮积压、停手后画面仍在乱滚。
2. **每帧全树重渲染与交互缺失**：
   - CDP 帧流通过 React `setSnap` 更新整个 `RightBrowserPane` 并向 `<img src="data:image/jpeg;base64,...">` 写入大字符串；`snap.viewport` 每帧新建对象引用导致 `ResizeObserver` 与 `MutationObserver` 每帧销毁重建并同步回流；聚焦地址栏会重连 SSE。
   - 缺失 `mousemove`/拖拽/修饰键快捷键，指针写死 `cursor: pointer`。
3. **1× 缩放发糊与白雾遮罩**：
   - `applyAppearance` 设置 `Emulation.setDeviceMetricsOverride` 后立刻 `cdp.detach()`，导致 Chromium 重置 DPR，高分屏下仅输出 1× CSS 像素有损 JPEG 并被浏览器拉伸放大（1.5×–2.08×），文字和深色底显著发灰发糊。
   - 右栏 `ContextPanel` 的 `--glass-sheen` 白色斜向高光与浅色模式下 `.viewportStage` 纯白留白叠加出「白雾遮罩」感。

## 2. 双引擎架构设计

### 2.1 引擎一：原生直连模式（Native `<iframe>`）

- **适用场景**：本地开发服务（`localhost` / `127.0.0.1`）及未设置 `X-Frame-Options: DENY/SAMEORIGIN` 或 `CSP frame-ancestors` 限制的网页（自动避开与宿主同源的递归自嵌套）。
- **收益**：100% 浏览器原生 60/120fps 渲染、发丝级矢量清晰度、原生滚动与触控板惯性、完整选字/悬停/右键/快捷键，零截图感、零白雾。
- **响应头自动判定**：后端在主文档响应中解析 `x-frame-options` 与 `content-security-policy` 的 `frame-ancestors`，写入快照字段 `embeddable: boolean`，并在 SSE 帧元数据中同步。

### 2.2 引擎二：高清低延迟 CDP 协同模式

- **适用场景**：拦截 iframe 的公网站点、与宿主同源页面、小鱼 Agent 主动执行浏览器工具需要实时查看操作轨迹，或用户手动切换至「协同视图」。
- **渲染与画质**：
  - 常驻 `CDPSession` 维持 `Emulation.setDeviceMetricsOverride`（真实 `deviceScaleFactor`）与 `Page.startScreencast`，杜绝 `detach()` 重置 DPR。
  - 操作停止 160ms 后自动通过常驻 CDP 补推一帧无损 PNG 清晰定格帧，彻底消除 JPEG 4:2:0 色度抽样导致的文字发虚与深色泛灰。
  - 前端改用 `<canvas>` + `createImageBitmap` 零闪烁双缓冲绘制，完全绕过 React 每帧 `setState`；仅当 URL、标题、前进/后退或计数变化时更新工具栏状态。
- **滚动与键鼠**：
  - 新增超轻量 `POST /api/browser/input` 通道（直接复用常驻 `CDPSession` 派发 `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` / `Input.insertText`，返回 `204 No Content`，0 字节响应体，不触发截图与结构提取）。
  - 视口挂载原生非被动 `wheel` 监听（`{ passive: false }`）彻底 `preventDefault()` + `stopPropagation()`，配合 `overflow: hidden` 与 `overscroll-behavior: none`；单帧 rAF 增量合并 + 单在途背压队列，携带真实指针 `(x, y)`，到顶/到底立刻刹停。
  - 受控页面通过 `context.addInitScript` 注入根元素 `overscroll-behavior: none`，防止无头浏览器内部橡皮筋回弹或横向误触发历史返回。
  - 补齐 `pointerdown` / `pointermove`（节流 hover 与拖拽选字）/ `pointerup`、右键与 `Ctrl/Meta` 组合快捷键（复制、粘贴、全选、撤销）。

### 2.3 自动切换与手动控制

- 工具栏提供一键模式切换按钮（「原生直连」/「协同视图」），默认按「自动」策略运行：
  - 页面 `embeddable === true` 且非同源递归、且 Agent 未在最近一次操作中驱动页面时，优先使用「原生直连」；
  - 页面拒绝嵌入（`embeddable === false`）或 Agent 刚执行浏览器操作（`lastActor === "agent"`）时，自动展示「协同视图」以保证可见与实时同步；
  - 用户点击模式按钮后，本标签页按用户显式偏好锁定，直到再次手动切换。

### 2.4 视觉纯净度

- 右侧工作台模式（`ContextPanel.module.css` 的 `.panelWorkbench`）取消 `--glass-sheen` 与 `backdrop-filter`，避免任何半透明白雾叠加在浏览器与代码预览之上。
- `.viewportStage` 在桌面/手机预设下采用中性画布底与克制的设备框，去除刺眼纯白边与聚焦边框干扰。

## 3. 契约变更

- `@lfaa/browser/contract`：
  - `BrowserSessionSnapshot` 与 `BrowserStreamFramePayload` 新增可选字段：`embeddable?: boolean`、`lastActor?: "user" | "agent"`。
  - 新增 `BrowserInputPayload` 类型，供 `POST /api/browser/input` 轻量输入通道复用。

## 4. 验收标准

1. 在本地开发页（如 `http://127.0.0.1:5174/`）默认进入原生直连，60fps 滚动、文字清晰、滚到顶/底无穿透无乱跑。
2. 切到协同视图（或访问禁止 iframe 嵌入页面）时：Canvas 清晰度匹配物理 DPR（无 1× 放大模糊与白雾）、滚轮到顶/底不穿透且停手即停、支持悬停/拖拽选字/快捷键、每帧不再重建 Observer。
3. 浅色与深色双主题下均无白色遮罩感，控制栏按钮清晰，控制台 0 新增报错，单测与全部门禁通过。
