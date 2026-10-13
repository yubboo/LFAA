# LFAA-WALLPAPER-REQUEST-LOG-NOISE-20261009

## 目标与运行入口

`pnpm lfaa web` 启动后的 DSH Wallpaper Engine 会持续提交成功诊断与设置保存请求；资源探测产生预期 404 时也被控制端统一记为 `warn`。目标是让默认终端突出启动、真实故障和用户可采取行动的信息，调试档仍保留请求明细。

## Owner 与设置

- `packages/host/webserver` 的 HTTP 请求中间件和 `requestLogLevel()` 是终端请求日志级别 Owner。
- 固定来源插件由 `packages/boot/plugin-manager` 的 `DshWallpaperEngineRuntime` 建立受控 Host/Client 运行副本；已知正常资源未命中由该适配器在响应上标记，不扩展任意插件的日志合同。
- `appearance.wallpaperEngine` 与 DSH Profile 设置继续由现有 Settings/Plugin Owner 持有；本任务不读写或新增设置，不改变请求/持久化频率、媒体服务边界、认证或数据路径。

## 范围与验收

- `POST /wallpaper-engine/client-diag` 与 `PUT /wallpaper-engine/settings` 的 2xx 完成日志降为 `debug`；其他写请求保持现有级别。
- 只有插件明确标记的 `404 no-frame`、`404 no-scene-audio`、以及 `.pkg` 壁纸缺少可选 sibling `scene.json` 才降为 `debug`。未知 token、普通缺失资源与其他 4xx 仍为 `warn`；所有 5xx 仍为 `error`。
- 现有错误响应正文、状态码、认证、资源路径围栏及 DSH 媒体请求次数不变；不捕获正文、不添加请求重试、定时器或订阅。
- 定向回归覆盖正常请求、三类预期 miss、未知 token 和 4xx/5xx 保持可见；构建 Host、Plugin Manager、Control Plane/Web 相关入口，产物只写根 `dist/`。
- 不重启当前运行中的 Web/Daemon；重启前不声称当前终端已载入新级别。没有可访问登录浏览器时，真实终端/Wallpaper Engine 行为标记为待验。

## 实施记录

- `requestLogLevel()` 将成功的 `POST /wallpaper-engine/client-diag` 和 `PUT /wallpaper-engine/settings` 记为 `debug`。HTTP 响应结束日志只读取 Express `response.locals.lfaaExpectedMiss`，并且仅对带标记的 GET/HEAD 壁纸帧、音轨、文件路由 404 降级；未标记的未知 token、其他 4xx 与 5xx 级别不变。
- Plugin Manager 运行适配器升为 revision 9：受控复制 `scene-frame.js`，严格校验其 `no-frame` 分支；只标记 HEAD 空帧及自动档空帧，不标记未知 token 或用户 pin 的自定义画面 422。Host 只标记无音轨响应，以及 `.pkg` 同目录确实不存在的可选 `scene.json`；路径围栏、响应状态/正文和请求行为不变。
- 配置：无设置中心配置新增或修改；现有 `appearance.wallpaperEngine` 与 Profile 偏好保持由原 Owner 管理。
- 验证：HTTP 日志/交付回归 6/6；Wallpaper Runtime 的适配和 Carrier 生命周期定向回归 2/2；Host WebServer、Plugin Manager、Control Plane、Web 构建通过，均输出到仓库根 `dist/`。Wallpaper Runtime 整文件另有既存 Locale 通知断言失败（实际 `[]`、预期 `['en-US']`），与本次日志分级无关。Web 构建仍提示 cpp chunk 约 501.3 kB。
- 运行验收：没有重启当前 Web/Daemon，也未在登录浏览器操作；当前终端仍使用旧日志分级，下一次正常重启后才能观察效果。已记录的一条 `client-diag` 请求耗时 4.547 秒，日志降噪不修复该请求延迟，需单独做真实性能排查。
