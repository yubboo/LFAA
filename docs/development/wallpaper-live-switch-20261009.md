# LFAA-WALLPAPER-ENGINE-LIVE-SELECTION-20261009

## 目标与运行入口

用户在 DSH Wallpaper Engine 插件中点选新场景或视频壁纸后，当前 Web 页面立即切换；无需刷新。目标入口为 `pnpm lfaa web` 启动的 LFAA Workbench 与固定来源 DSH Wallpaper Engine Client。

## Owner 与设置

- DSH Client 持有当前页面的壁纸播放与 `body[data-we-wallpaper]` 运行时标记。
- `packages/boot/plugin-manager` 持有固定上游 Client 的兼容改写、快照校验与 Runtime revision；上游原始源码保持只读。
- Workbench 首帧继续读取账户 `appearance.wallpaperEngine.enabled/projectId` 来确定已保存壁纸的画布 Owner，避免刷新时先闪出另一张 LFAA 背景。
- LFAA 自有表面继续读取已有 `appearance.overlay`、`appearance.blur`、`appearance.advanced.translucentSidebar`、主题和字体令牌；插件私有媒体外观继续由插件 Profile 持有。
- 不新增、重置或复制设置，不改壁纸选择持久化、插件 Host 原始源码或 Daemon 数据；Client 只允许在固定来源适配层修正已核实的渲染就绪判断。

## 范围与验收

- Workbench 首帧设置判断保持不变；插件运行时标记出现后，设置页、导航/卡片、侧栏和左右工作台 Pane 立即使用现有 LFAA 壁纸表面规则。
- 切换到 Edge 视频时，新视频的镜像画布完成首帧绘制后立即放行新层并退场旧层；首帧前继续保留旧画面，未画出画面的空画布不能被当成就绪。
- 插件未显示壁纸时，不因 `body[data-we-wallpaper]` 缺失而改变原背景行为。
- 增加直接回归，防止插件运行时标记与 LFAA 表面样式脱节，也验证 Edge 视频层只在 `canvas.dataset.weDrawn === "1"` 后就绪。
- 运行对应回归、Plugin Manager/Layout 包构建与 Web 构建；只使用根 `dist/`。区分代码/构建证据和真实浏览器切换、帧时间证据。

## 实施记录

- `workbench.css` 的现有壁纸表面选择器增加 `body[data-we-wallpaper]` 实时条件，与账户设置首帧条件共用相同外观令牌。
- 未新增设置项或 CSS 自定义属性；保留 `appearance.overlay`、`appearance.blur`、`appearance.advanced.translucentSidebar`、主题/字体映射。
- `node --import tsx --import ./register-package-loader.mjs --test tests/wallpaper-canvas-ownership.test.mjs`：4/4 通过。
- `pnpm --filter lfaa-client-ui-layout run build` 与 `pnpm --filter lfaa-web run build` 通过；生成资源位于根 `dist/packages/`、`dist/apps/web/`。Vite 提示已有 501 KiB C++ 语法块超过 500 KiB 门槛，本次未改拆包。
- 当前 `127.0.0.1:3000/api/health`、`/`、主 JS 和 `render-_aAXFdz_.css` 均返回 HTTP 200；HTTP CSS 内容含新的运行时 Owner 规则。
- 浏览器当前没有可复用的登录态标签页，Edge 连接器返回 `nodeRepl.fetch request failed`；真实页面点选切换和帧时间未验。

## Edge 视频切换缺陷补充（2026-10-09）

- 红框现象与上游固定提交 `0e9171817530272685f42b66e007a0831e2035c9` 的 Edge 视频专属分支一致：Edge 将视频绘制到 `canvas.we-media--canvas`，首帧绘制时设置 `canvas.dataset.weDrawn = "1"` 并通知切层闸门；但闸门只要发现这类 canvas 就无条件返回未就绪。回调因此永远不能放行新视频层，屏幕继续显示旧壁纸。Scene 使用 iframe/静态媒体，不经过这个条件，所以场景切换正常。
- 修复限定在 LFAA 固定来源 Client 适配层：以严格锚点把无条件拒绝改为检查既有首帧标记，并将 Runtime 升至 `adapter-8`，让下次启动创建新的受控运行副本；不编辑或覆盖上游快照。
- 设置仍使用 `appearance.wallpaperEngine.enabled/projectId`、`appearance.overlay`、`appearance.blur`、`appearance.advanced.translucentSidebar`、主题/字体及插件 Profile 的视频偏好；本补充不新增设置或改数据格式。
- Runtime 转换回归覆盖空 canvas 保持旧画面、`weDrawn === "1"` 后才放行、非 canvas 分支行为不变，并验证首帧标记必须仍与 `noteLayerContent(canvas)` 绘制回调配对；任一上游锚点变化均 fail closed。`node --import tsx --import ./register-package-loader.mjs --test --test-name-pattern="verified official DSH v1 revisions|LFAA Harness activates the adapted Host" tests/dsh-wallpaper-engine-runtime.test.mjs`：2/2 通过。
- 完整 `dsh-wallpaper-engine-runtime.test.mjs` 运行结果为 2 项通过、1 项失败：独立的 DSH Locale 偏好通知断言期望 `en-US` 变更事件，实际未收到事件；该测试单独运行同样失败，本轮没有改动 Locale Owner。
- `pnpm --filter lfaa-plugin-manager run build`、`pnpm run build:control-plane` 与 `pnpm --filter lfaa-web run build` 通过，产物位于根 `dist/`；Web 构建仍提示 `cpp` 语法块约 501 KiB 超过 500 KiB 门槛。相关源码、测试和文档的 `git diff --check` 通过。
- 真实 Edge 登录页点选和帧时间仍未实测；当前 Edge 连接器没有可访问标签页。没有重启运行中的 Web 服务；下次正常重启会按 `adapter-8` 创建新受控运行副本并应用修复。
