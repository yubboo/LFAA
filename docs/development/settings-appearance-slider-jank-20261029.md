# LFAA-SETTINGS-APPEARANCE-SLIDER-JANK-20261029

<a id="lfaa-settings-appearance-slider-jank-20261029"></a>

## 用户目标与复现信息

- 用户报告设置中心“外观”页的滑块拖动明显卡顿，附件展示“空闲多久后虚化”和“回复虚化与淡出强度”两项；截图当前值为 1 分钟和 100%。这两个值只作现象证据，本任务不更改用户偏好。
- 已知步骤：打开设置中心外观页，在“小鱼智能体 空闲虚化”组拖动任一滑块。具体浏览器版本、设备刷新率、录屏、性能 trace 尚未提供。
- 当前运行环境：Windows，当前 checkout 为 `E:\lfaa1\lfaa`。用户已同意恢复兼容 Web 服务，并同意仅本机临时性能采集；测试必须使用隔离数据，不得改动真实设置。

## Owner 与设置范围

- 入口/UI Owner：`packages/client/ui-settings/src/SettingsPage.tsx` 的 Appearance 组，运行路由为 `/settings?section=appearance`；滑块样式由本包 `SettingsPage.css` 维护。
- 设置持久化/校验 Owner：`packages/settings/settings` 的认证 Settings API；当前滑块经 `updateAppearanceAdvanced → updateSettings` 更新本地设置状态，再通过 Appearance 自动保存。自动保存定时为 300ms，保存请求由同一 category 的 `persistLatestSettings` 串行复用。
- 相关配置：`appearance.advanced.aiWorkOutputFocusBlurEnabled`（默认 `false`）；`aiWorkOutputFocusBlurIdleSeconds`（默认 60 秒、允许 60–3600 秒且以分钟为步进）；`aiWorkOutputFocusBlurPercent`（默认 33，允许 0–100）。数据库服务校验与前端映射分别由 `packages/settings/settings` 和 `SettingsPage.tsx` 持有。本任务不改变这些值、默认值、持久化或实时预览语义。
- 响应 UI 使用 Appearance 共享主题、字号、对比度和减少动态效果令牌；除非反馈环证明确需调整，不扩展到其他设置。

## 调查边界与可观察验收

- 使用本机隔离数据搭建 Control Plane `3001` 与 Vite `5173`，默认 `admin` 测试账户；真实账户未参与性能拖动。经用户明确同意后，临时帧采集只存在于 `SettingsPage.tsx` 的本机测试过程，完成测量后已完整移除。
- 帧反馈环在每次拖动时统计 `onChange` 更新数、requestAnimationFrame 间隔、React 提交时长及 autosave 触发数；它不使用截图估算帧率。
- 当前既有 `client-ai-work-idle-blur.test.mjs` 验证计时器状态与设置接线。本轮补充它对局部拖动状态和 `onChangeComplete` 提交时机的源码回归断言。
- 修复后在内置浏览器 `/settings?section=appearance` 检查正式 Web 的页面、目标开关和当前值；真实账户只读，不拖动滑块。实际拖动和刷新持久化在隔离账户完成。
- 不允许绕过认证、触碰/降级真实数据库、隐藏 Settings Owner 校验或用静态稿/构建结果声称卡顿已消失。

## 定位结论与修复

- 基线每次拖动 8 次输入更新。空闲时长滑块记录 104 帧，帧间隔 p95 29.1 ms、最大 41.6 ms，8 帧超过 16 ms；强度滑块记录 105 帧，p95 33.3 ms、最大 41.7 ms，8 帧超过 16 ms。React 设置状态提交 p95 分别为 11.1 ms 和 13.5 ms。两种拖动都只触发 1 次 autosave，故障不是每个 pointer move 都发保存请求。
- 根因是每个 Slider `onChange` 都调用 `updateAppearanceAdvanced`，逐步更新整份 Settings 页面及其父层设置回调；虽然保存请求被 300 ms 自动保存合并，拖动期间的 React 更新仍然重复执行。
- `packages/client/ui-settings/src/SettingsPage.tsx` 新增 memo 化的 `AppearanceFocusBlurSliders`，拖动中的值仅更新该子组件本地状态，`onChangeComplete` 后才调用原有设置更新链。props 改变时同步本地显示。设置键、范围、步进、描述、开关禁用状态及拖动结束后的自动保存均保持原合同。
- 同一隔离页面修复后，两种滑块各拖动 8 次：空闲时长 101 帧、p95 4.3 ms、最大 45.8 ms，仅 1 帧超过 16 ms；强度 95 帧、p95 4.3 ms、最大 41.6 ms，仅 1 帧超过 16 ms。每种拖动均仅 1 次设置提交和 autosave。单个偶发最大帧仍高于 16 ms，因此结果说明常态更新显著下降，不代表每帧均达 60 fps。
- 隔离账户在拖动结束后重载，空闲时长 58 分钟与强度 33% 均成功保留。临时帧采集代码已删除；`rg` 未发现 probe 标识残留。

## 回归、构建与正式页面验收

- `pnpm --filter @yubboo/lfaa test -- tests/client-ai-work-idle-blur.test.mjs`：3/3 通过。用例校验拖动 local state、`onChangeComplete` 提交、既有空闲计时行为和虚化样式。首次运行发现该测试中两条旧 CSS/DOM 断言已落后于当前聊天样式，按现有导航轨道结构和仅 opacity 过渡语义更新断言后通过；未改动 AI Work 样式。
- `pnpm --filter lfaa-web run build` 成功；正式菜单再次执行 `build:control-plane` 与 `build:web`，Web Vite 构建成功，产物位于根 `dist/apps/web/`，菜单调用 `pnpm lfaa web` 启动。`node scripts/runtime-build-state.mjs web` 返回 `[]`；新的 3000 端口服务健康检查 HTTP 200、`persistence=ready`。
- ChatGPT 内置浏览器正式路由 `http://127.0.0.1:3000/settings?section=appearance`，截图视口 1280×720。页面可滚动到虚化区域，开关为开启，值为 1 分钟和 100%；仅查看，未改变真实偏好。截图由本轮 CUA 实页观察返回。
- 性能交互视口为隔离 Web/Vite 页面 1280×720；以上数值来自其临时 requestAnimationFrame 采集。正式页面未拖动真实滑块，以免改写用户偏好。内置浏览器当前 CUA 接口未提供可设置窄视口的能力，因此未完成独立手机宽度验收；源码/构建检查不替代此项。
- 为恢复服务所需的 SQLite 兼容守卫从 75 对齐到已有的 v76 迁移；新增隔离数据库回归及包 README 说明。v76 定向回归通过。完整 `database-migrations.test.mjs` 的 8 项中 6 项通过，2 个旧 v61/v72 夹具后续迁移在 v74 缺少账户或 Agent Git 结构而失败，不依赖本轮守卫；未改动或降级真实数据库。

## 隔离临时数据清理记录

- 临时测试数据位于 `C:\Users\yu\AppData\Local\Temp\lfaa-slider-jank-20261029-95e03ed034c543678e7786588e5831d4`，与仓库数据和真实用户设置隔离；测试 Control Plane 与 Vite 已停止，端口 3001、5173 已核实无监听。
- 清理该明确临时目录及其中单个临时文件的操作均被执行环境的自动审查策略拒绝。没有尝试绕过拒绝；目录因此仍保留，交付时披露路径以便后续清理。
