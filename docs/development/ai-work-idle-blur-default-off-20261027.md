# AI Work 空闲虚化默认关闭合同（2026-10-27）

<a id="lfaa-ai-work-idle-blur-default-off-20261027"></a>

## 用户目标与范围

- 用户希望设置中心“外观 → 小鱼智能体空闲虚化”默认关闭。截图显示当前页面开关为开启，但这不授权或要求改写该账户已保存的偏好。
- 运行入口：`/settings?section=appearance`；设置/验证/持久化 Owner 为 `packages/settings/settings`，共享账户默认值由 `packages/util/values` 提供，AI Work Client 仅消费已保存的设置。
- 设置配置：`appearance.advanced.aiWorkOutputFocusBlurEnabled` 当前为布尔开关；本任务将新账户和缺少该字段的旧设置默认改为 `false`。用户明确保存的 `true` 或 `false` 必须保留；不改空闲时长、模糊强度、计时行为、其他 Appearance 设置或真实账户数据。

## 验收条件

### B1：缺省值与兼容读取

- 共享设置默认值和服务端 schema 默认值都为关闭；旧账户字段缺失时由 Settings Owner 补为关闭。
- 定向回归覆盖缺省关闭、显式保存 `true` 后读取仍开启、显式保存 `false` 后读取仍关闭；其余外观偏好和旧 px 强度迁移不变。
- 运行相关设置持久化回归、受影响包构建/类型检查、Web 构建和差异检查。

### B2：Web 实页

- 使用当前源码和隔离数据启动正式 Web 服务，在 ChatGPT 内置浏览器检查设置中心外观页开关默认未选中；不登录或修改真实用户账户，不声称检查未覆盖的设备或响应式范围。
- 记录实际路由、视口、交互、截图证据与未测范围。若正式构建/服务或浏览器工具受阻，写明具体原因并保持实页验收未通过。

## 实施与验证记录

- 开始时工作区已有其他未提交修改；只触碰本合同、索引和本任务直接相关的默认值、回归与设置事实，不清理或覆盖其他变更。
- B1 实施：`DEFAULT_APPEARANCE_ADVANCED_SETTINGS` 和 Appearance Joi Schema 的 `aiWorkOutputFocusBlurEnabled` 缺省值均改为 `false`。Settings Service 已按共享默认值补齐缺失字段，无需增加第二份 fallback；有效布尔值继续原样读取。账户设置回归覆盖字段缺失时 Schema/存储回读关闭、用户明确保存 `true` 后回读仍开启、以及后续明确保存 `false`。
- B1 验证：`apps/cli/tests/file-storage.test.mjs` 的本任务定向用例 1/1 通过；`pnpm --filter lfaa-util-values build`、`pnpm --filter lfaa-settings build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web` 和 `git diff --check` 通过。Web 资源输出位于根 `dist/apps/web/`。
- 当前工作区的全文件辅助回归未全通过，但失败与本变更无关：`file-storage.test.mjs` 另外一个迁移用例仍断言数据库版本 70，当前源码实际版本为 71（因此全文件结果 7/8）；`client-ai-work-idle-blur.test.mjs` 的旧 DOM/CSS 锚点断言与当前样式结构不符（结果 2/3）。没有为这两个相邻问题修改其他实现或旧断言。
- Host 类型检查和正式 Control Plane 构建均被现有源码错误阻断：`packages/knowledge/knowledge-library/src/index.ts` 对 `HomePaths.skills` 的 3 处类型错误，以及 `packages/video/bilibili-video/src/index.ts` 对可空 `subtitle`/`item`/`dash` 的 4 处类型错误。`node scripts/runtime-build-state.mjs web` 返回 `["host"]`，即 Web 构建已更新、Host 仍过期。
- B2 未完成：由于当前 Host 构建失败，未启动或重启 Web 服务，也未在 ChatGPT 内置浏览器实测设置页开关；没有触碰环境中现有账户设置。浏览器截图、实际视口与交互证据缺失，不能将 Web 实页验收记为通过。
