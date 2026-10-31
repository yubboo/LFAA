# 左一“更多功能”浮卡宽度与左二最小栏宽对齐

<a id="lfaa-global-feature-popover-alignment-20261031"></a>

## 用户目标与验收

- “更多功能”浮卡从左二栏起点对齐；宽度按所在页面 Workbench 最小宽减去滚动槽宽，不再使用固定 320px。
- 浮卡左边缘贴齐左二栏起点，避免保留旧的外侧间距后多压入中间区。
- 浮卡与左二栏之间为滚动条独立留出 12px，不能覆盖左二栏右侧滚动条；浮卡列表自身也保留 `scrollbar-gutter: stable`，内容滚动时为自己的滚动条预留槽位，不挤压文字和菜单项。
- 桌面、窄分栏和短屏下浮卡不产生水平溢出；菜单可搜索、可滚动、可关闭，左二栏的滚动区域仍可辨认。

## Owner、设置与范围

- 左一导航与浮卡由 `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx` 持有；使用浮卡的页面将已有 `layout.left.min`/`metrics.left.min` 传入，不另建侧栏宽度规则。
- 左二栏最小宽度继续由 `packages/client/ui-dockkit/src/workbench-layout.config.ts` 计算；不改动布局默认值或持久化的栏宽。
- 不新增设置或 CSS 变量；维持现有外观令牌、主题、`scrollbar-gutter: stable` 和用户 Workbench 尺寸偏好。

## 批次与验收记录

### 批次 1：共享浮卡尺寸与宿主布局衔接

- 实施：浮卡基准宽度由 `/files`、Minecraft/Steam 工作区、设置、插件管理传入各自的 `metrics.left.min` / `layout.left.min`；没有左二面板的 AI 员工办公室读取同一个 `WORKBENCH_LAYOUT_TOKENS.left.min.floor`。浮卡宽度先扣除 12px 左二滚动槽，左边缘仍与左二栏起点对齐；功能列表继续以稳定滚动槽留出浮卡自己的滚动条宽度。
- 定向回归：`apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`，3/3 通过。
- 类型检查：`pnpm exec tsc --noEmit -p tsconfig.client.json`，通过。
- 受影响包构建：`lfaa-client-ui-sidebar`、`lfaa-client-ui-workspace`，通过。
- Web 构建：`pnpm run build:web`，Vite 转换 3951 个模块并成功输出至根 `dist/apps/web/`；`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 正式启动：按已获授权运行 `pnpm lfaa web`；控制端健康检查为 `status=ok`、`persistence=ready`。
- 初次实页：`/files` 与 Minecraft 页面确认了浮卡起点和基准宽度，但截图暴露左二栏滚动条会被同宽浮卡挡住；该批验收遗漏了左二栏外侧的滚动槽。用户指出后按批次 2 修正，以下列出的旧宽度仅保留为问题发现记录。
- 外观与设置：未新增或修改设置项、CSS 变量或偏好；颜色、字体、对比度与动效沿用现有主题；不改栏宽持久化。
- 性能与权限：使用已有布局令牌，未增加请求、订阅、监听器、定时器或数据读写；未绕过访问校验。
- 未测范围/环境现象：未进行真实设备或帧时间测量。安全重启后 Minecraft 实例页出现“实时连接中断 / Failed to fetch”；控制端健康检查正常，点页面“重新连接”后仍未恢复。本次浮卡渲染与 `/files` 文件总览正常，该连接现象不影响浮卡尺寸验收，未在本任务中改动 Minecraft 数据链。
- 仓库差异检查：`git diff --check` 只报告其他并行 Minecraft 文件 `packages/games/minecraft/src/core-sources.ts` 第 121、123 行已有尾随空格；本任务未触碰该文件。

### 批次 2：在浮卡外侧为左二滚动条留槽

- 实施：`GlobalNavigationRail` 从左二最小宽减去 12px，再应用原有视口最大宽；浮卡左边缘仍对齐左二起点。左二实测滚动槽宽 10px，额外 2px 保证滚动条不压在浮卡边线上。浮卡内部列表仍保留自己的 `scrollbar-gutter: stable`。
- 定向回归：`apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`，3/3 通过，覆盖 12px 外侧留槽与原有内部滚动槽。
- 类型检查与构建：`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-sidebar` 构建、`pnpm run build:web`（3951 modules）通过；Web 指纹状态 `[]`。获准的 `pnpm lfaa web` 正式重启完成，`/api/health` 为 `status=ok`、`persistence=ready`。
- ChatGPT 内置浏览器：`http://127.0.0.1:3000/work`，879×849。DOM 几何实测左二区域 x=64..264、宽 200px；浮卡 x=64..252、宽 188px；右侧预留 12px，左二滚动槽 10px，滚动条在浮卡旁可见且不被覆盖。
- 窄屏回归：同一路由临时设为 390×640，左一轨宽 48px，浮卡 x=48、宽 188px、右边 x=236；文档 scrollWidth=390，无横向溢出。随后恢复浏览器默认 879×849，浮卡与左二区域仍分别为 188px/200px；更多功能菜单保持可见。
- 设置、外观、权限与性能：未新增或修改设置/CSS 变量/权限；沿用当前 Workbench 最小宽和外观令牌。没有增加请求、订阅、监听器或计时器；没有帧时间测量。
