# Minecraft 实例详情页返回服务器列表入口

<a id="lfaa-minecraft-instance-detail-return-to-server-list-20261031"></a>

## 用户目标与可观察结果

- 将实例概览页顶部重复的“控制端已连接”提示换为“返回服务器列表”按钮。
- 点击按钮直接返回 `/games/minecraft/instances`，与实例列表卡片/“管理”入口保持一致。
- 其他 Minecraft 页面原有连接状态、刷新、实例详情操作、路由和滚动不回归。

## Owner、设置与边界

- 唯一 UI Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`；样式归 `MinecraftWorkspace.css`。
- 使用既有 `onNavigate` 与 `/apps/minecraft/normal/instances` 导航合同；无需新 API、配置、存储或权限。
- 不新增或改变设置。实例概览继续遵循 Appearance 与常规卡片动效配置。
- 返回动作只导航，不改变实例、服务端、用户偏好或配置数据。

## 验收

- 定向回归、Client 类型检查、Minecraft UI 包与正式 Web 构建通过。
- ChatGPT 内置浏览器访问当前工作区正式 Web 的实例概览，确认按钮标签与目标路由；点击后显示“服务器列表”并恢复实例列表状态。
- 覆盖桌面和窄/短屏视口；原刷新入口、详情操作和其他页面的连接状态不变。

## 实施与验收记录

- 状态：完成。
- 修改文件：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（实例概览用返回列表按钮替代重复状态徽标，保留其他页面状态提示）；`packages/client/ui-minecraft/tests/instance-list-management-entry.test.mjs`（覆盖按钮路由与其他页面状态保留）；`packages/client/ui-minecraft/README.md`（记录入口行为）；`docs/PROMPTS.md`（任务索引）。
- 回归与构建：`pnpm --filter lfaa-client-ui-minecraft test` 14/14 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；Minecraft UI 包构建与 `pnpm run build:web` 通过；`git diff --check` 通过。Web 构建仍报告现有的大型分包提示。
- 正式 Web：按授权重启后，`http://127.0.0.1:3000/api/health` 返回 `status: ok`、持久层 `ready`，`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 实页路由与截图证据：ChatGPT 内置浏览器在 `/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/overview` 以 1440×900 和 390×640 打开。两种视口的无障碍树均出现可用的“返回服务器列表”按钮；390×640 截图中按钮位于标题下方且可见。分别点击后均到达 `/games/minecraft/instances`，列表标题及 2 个实例可见；列表原连接状态提示仍保留。截图由本轮内置浏览器验收捕获，未另写入仓库文件。
- 性能与边界：复用既有导航回调，没有新增订阅、请求、轮询、计时器或状态持有。未测真实手机/平板设备与帧时间；390×640 为内置浏览器窄屏视口。
- 设置：未新增或更改设置；没有单独样式，按钮沿用现有外观主题映射与全局无障碍焦点样式。
