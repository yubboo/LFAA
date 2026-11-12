# LFAA-BROWSER-NEWTAB-RECENT-SITES-72H-20261112

## 用户目标

新标签页右侧“最近”仅展示过去连续 72 小时内实际访问过的网站。超过 72 小时的记录从这个列表隐藏；当没有符合条件的记录时，整个“最近”区域隐藏，与用户提供的第二张图一致。

## Owner、设置与数据边界

- 新标签页展示和过滤由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 持有。
- 访问记录的读取、按账户保存和清理由 Browser Owner 持有；不改记录 API、持久化格式或已有历史数据。
- 沿用设置中心 `browserUse.recordRecentSites` 的账户配置及原有加载/记录行为。不开启记录时不显示区域；不新增或改写设置与用户偏好。
- 显示筛选不影响 Agent 历史访问权限，也不构成记录清理或权限变化。

## 实现与性能约束

- 以当前时间向前滚动 72 小时为可见窗口；无法解析或晚于当前时间的时间戳不显示。
- 最早记录到期时最多安排一个定时器并在重设/卸载时清理，不增加轮询、请求或持久化写入。
- 设置关闭或当前账户没有可见记录时不渲染“最近”盒子；推荐区和其余新标签页内容保持原样。

## 验收条件

1. 72 小时内记录可见，达到或超过 72 小时的记录隐藏；无效和未来时间戳不展示。
2. 页面保持打开时，过期到点会更新显示；最后一条记录过期后整个区域消失。
3. 切换账户、页面状态更新和卸载时无跨账户展示、重叠计时或遗留定时器。
4. 现有 Browser Owner 历史记录及设置中心记录开关保持原值和原行为。
5. 运行定向回归、相关类型/构建检查，并通过 ChatGPT 内置浏览器在 `/work` 的桌面和窄/短视口验收；如环境阻碍实页验收，记录具体阻碍和未测范围。

## 批次与验收记录

### 批次 1：新标签页最近网站的 72 小时显示窗口

- 实施：新增纯筛选函数，保留 Browser Owner 返回顺序，只显示有效且年龄在 `[0, 72 小时)` 内的记录，并返回最早到期时刻。新标签页按当前账户和 `browserUse.recordRecentSites` 求可见列表；用单个定时器在最早到期后刷新，effect 清理旧计时器。列表为空或记录开关关闭时不渲染整个区域。
- 修改文件：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`packages/client/ui-workspace/src/browser-recent-sites-window.ts`、`packages/client/ui-workspace/README.md`、`apps/cli/tests/client-workspace-browser-recent-window.test.mjs`、`apps/cli/tests/client-workspace-right-launcher-layout.test.mjs`、`docs/PROMPTS.md`、本合同。
- 设置与数据：只读取既有 `browserUse.recordRecentSites`；无设置默认值、持久化、UI 偏好、历史数据或权限变化。没有新增请求、订阅或轮询。计时器在效果重跑及组件卸载时清理。
- 定向回归：`pnpm exec node --test apps/cli/tests/client-workspace-browser-recent-window.test.mjs apps/cli/tests/client-workspace-right-launcher-layout.test.mjs`，7/7 通过；覆盖 72 小时边界、无效/未来时间戳、最近到期计算、空列表隐藏、现有新标签页区块与导航合同。
- 静态检查与构建：`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`（3952 个模块）、`git diff --check`、Impeccable detector（两个 UI 源文件 `[]`）通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。产物只写入仓库根 `dist/`。
- 运行状态：源码在首次重启后又被共享工作区任务修改；重新构建后通过正式菜单安全重启完整 Web 与其托管的本机 Daemon。健康检查返回 `status=ok`、`persistence=ready`，构建产物均在根 `dist/`。随后共享 CSS 更新曾使指纹暂时报告 `web`；共享构建继续后，最终复查 `node scripts/runtime-build-state.mjs web` 返回 `[]`，健康检查仍为 `status=ok`、`persistence=ready`。并行改动已保留。
- ChatGPT 内置浏览器实页：访问 `http://127.0.0.1:3000/work`。桌面 1440×900 与窄/短屏 390×560 均打开右侧“新标签页”实际验收；“工具”及“推荐”保持显示，整个“最近”区域不在可访问树或页面截图中。最终 Web 页面健康，设置中心只读确认 `browserUse.recordRecentSites` 当前为启用，未修改设置；无符合条件的真实记录可供验收正向列表，未为验证而创建访问记录或改动历史数据。
- 验收边界：当前实际数据证明了空列表隐藏和布局表现；72 小时内记录显示、记录到期时定时隐藏及账户切换效果由纯筛选/布局回归覆盖，未通过真实用户数据现场制造记录验证。未测物理设备和帧时间。性能检查确认实现只维护一个到期定时器，设置变化/卸载会清理，不增加请求、订阅、轮询或持久化增长。
