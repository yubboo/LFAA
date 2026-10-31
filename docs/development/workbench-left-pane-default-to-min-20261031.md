# 左二工作台侧栏默认宽度对齐最小宽

<a id="lfaa-workbench-left-pane-default-to-min-20261031"></a>

## 用户目标与验收

- 左二工作台侧栏在首次打开、没有用户自定义尺寸时，默认宽度等于当前容器计算出的 `left.min`。
- 旧版持久化宽度若精确等于旧默认宽度，迁移到新默认；其他手动拖拽宽度继续保留并按当前边界夹取。
- 设置中心和应用工作台继续共享唯一左栏宽度偏好；窄屏、手机和独立右栏布局按当前容器指标运行。

## Owner、设置与范围

- 左右栏尺寸与共享持久化由 `packages/client/ui-dockkit/src/workbench-layout.config.ts`、`workbench-preferences.ts` 持有。
- `ApplicationWorkspace`、`SettingsPage` 和其他 Workbench 宿主继续读取同一 Owner，不复制默认值或读写业务设置。
- 不新增设置中心控制项或 CSS 变量。默认来源是布局令牌；用户拖拽后的值保留在既有浏览器本地偏好中。Appearance 设置继续控制外观。

## 分批记录

### 批次 1：默认宽度与旧偏好迁移

- 实施：Dockkit 将左栏 `initial` 与 `min` 绑定到同一布局规则。偏好版本升到 v4；只有精确匹配旧 v3 默认值的记录迁移到新最小宽，其他自定义宽度按当前边界夹取后保留。Settings、Plugin Manager 与应用工作台继续共用该 Owner。
- 回归：新偏好用例覆盖多个容器宽度下 `initial === min`、1856px 容器的旧默认 297px 迁移到 278px，以及手动 320px 保留；加上 Workbench 几何回归，定向结果 3/3 通过。扩展响应式套件合计 31 项中 27 项通过、4 项 CSS 断言失败，涉及当前其他并行改动中的 AI Work/移动标题/窄屏中心标题样式，未改这些样式。`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过。`git diff --check` 仅报告无关的 `packages/games/minecraft/src/core-sources.ts` 第 121、123 行尾随空格。
- 构建与运行：ui-dockkit、ui-workspace、ui-settings、ui-sidebar-files、ui-plugin-manager 包构建及 `pnpm run build:web` 通过（3951 modules）。正式 Web 菜单重启完成，构建指纹检查为空；`/api/health` 返回 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器：`/work` 在 1280×720 实页中左栏 splitter 为 200px，浮卡宽 200px，二者对齐；760×560 与 480×640 时左栏按响应式规则收起，浮卡仍为 200px 且完整留在视口内。用户截图对应的 `/games/minecraft/instances` 在默认 878×849 实页展开二级菜单后，左栏 splitter 为 200px，浮卡视觉宽度与之相同。临时视口已恢复。
- 用户自定义宽度：逻辑回归确认 320px 手动宽度跨升级保留；旧默认只在精确匹配时迁移。
- 设置、性能、权限与未测范围：没有新增设置中心项，也没有改变外观、权限或用户选择；继续使用 Workbench 本地宽度偏好。没有新增订阅、请求、观察器或计时器；尺寸仍由既有 ResizeObserver 测量，本次未做帧时间测量。宽屏 1856px 的迁移与几何由自动回归覆盖，内置浏览器实页未调整到该尺寸，以免测试操作写入用户栏宽偏好。
