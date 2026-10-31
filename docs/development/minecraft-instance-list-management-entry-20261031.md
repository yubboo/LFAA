# Minecraft 实例列表只保留管理入口

<a id="lfaa-minecraft-instance-list-management-entry-20261031"></a>

## 用户目标与可观察结果

- 实例列表卡片不再提供启动、安全停止等生命周期操作。
- 卡片主体与可见“管理”入口是两个独立、可单独点击的入口；两者都进入该实例的概览页。
- 启停、控制台、打开实例文件及归档删除都从实例内部进入；保留现有操作行为与真实结果反馈。
- 两个链接都支持键盘操作并显示各自焦点；悬停卡片主体不会让“管理”入口显示选中/悬停态。窄分栏、平板、手机和短屏中信息与入口保持可读、可达。

## 入口、Owner 与数据

- 列表入口：`/games/minecraft/instances`；实例详情：`/games/minecraft/instance/:id/overview`。
- UI 唯一 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`；其样式归 `MinecraftWorkspace.css`。
- 卡片数据继续使用当前认证账户的 Minecraft 实例快照。内部启停、控制台和文件导航继续使用现有 API、导航和稳定实例 ID 合同。
- 归档删除从实例概览提交，沿用 `deleteMinecraftInstance`、原确认提示、Daemon 归档任务及任务反馈；提交后回到实例列表。
- 不新增 API、业务规则、缓存、订阅、轮询或持久化，不改共享工作台、Minecraft Service 或 Daemon。

## 设置、权限与边界

- 不新增设置或偏好。沿用当前 Minecraft 工作区映射的 Appearance 主题、强调色、字体/字号、对比度、壁纸、遮罩、模糊和减少动态效果，以及 `general.cardMotionEffect`；不新增 CSS 自定义属性。
- 列表和实例状态仍来自真实 Minecraft 快照。卡片主体链接与“管理”链接只导航，不更改用户数据。
- 启停与配置权限继续由 `hasAdminAccess` 和现有节点/实例/能力条件控制。归档删除仍要求管理员权限、节点在线、允许的实例状态并明确确认；UI 条件不能替代服务端校验。
- 浏览器验收只导航、检查入口和打开后取消归档确认，不执行真实启动、停服、重启、删除或配置写入，不更改用户偏好。

## 实施批次与验收

### 批次 1：卡片成为实例管理入口

- 用覆盖卡片主体的语义链接与单独的“管理”语义链接提供两个独立入口，均指向同一实例概览；管理链接悬停只响应鼠标直接指向该链接。
- 从列表移除启动、安全停止及原管理弹窗；在实例概览保留原启停、重启、控制台、文件入口，并把归档删除确认移入该实例内部。
- 扩展 Minecraft UI 长期回归，覆盖直达路由、无列表启停按钮、概览内生命周期/删除入口、原归档保护条件和响应式焦点样式。
- 运行直接相关的 Minecraft UI 回归、Client 类型检查、Minecraft UI 包构建和正式 Web 构建；所有产物只写根 `dist/`。
- 在 ChatGPT 内置浏览器访问当前源码正式 Web 的实例列表，检查桌面、窄分栏和短屏下整卡与管理链接可独立点击/键盘进入、筛选及悬停目标；检查实例内部操作仍在并可访问，打开归档确认后取消。逐项记录实际路由、视口、交互、截图与未测边界。

## 性能、安全与未测范围

- 两个导航链接复用已读取实例快照，不新增请求、订阅、轮询、定时器、观察器或动画；无变化时不额外更新列表状态。
- 真实业务授权、数据隔离、节点校验和实例状态规则仍由 Minecraft API/Service/Daemon Owner 执行。
- 未采集帧时间或真实设备数据时明确标记未测；静态检查、构建和内置浏览器验收分别记录。

## 实施与验收记录

- 状态：已完成。
- 改动：实例列表卡片使用覆盖卡片主体的“打开实例”链接和独立的“管理”链接；两者并列且都进入同一实例概览。仅鼠标直接移到“管理”时该入口才显示悬停色，主体链接与“管理”各有自己的键盘焦点轮廓。列表移除启动/安全停止入口与管理弹窗；启停、重启、控制台、文件操作和归档删除留在详情，沿用既有 API、权限条件及任务反馈。
- 设置：未新增或改变设置。列表仍读取共享 Appearance 主题、颜色、字体/字号、对比度、壁纸、遮罩、模糊、减少动态效果和 `general.cardMotionEffect`；本轮没有更改用户偏好。
- 直接验证：`pnpm --filter lfaa-client-ui-minecraft test` 13/13 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm --filter lfaa-client-ui-minecraft run build` 与 `pnpm run build:web` 通过，产物位于根 `dist/`；`git diff --check` 通过；Impeccable 单次检测对 TSX/CSS 返回 `[]`。`node scripts/runtime-build-state.mjs web` 返回 `[]`，3000 正式 Web 重启后 `/api/health` 返回 HTTP 200。
- 仓库级门禁：`pnpm run check:workspace` 未通过，报告 6 项任务外问题：包目录 JSON 清单过期；历史 `left-preview-hover-flicker-20261025.md` 的桌面/窄屏截图链接不存在；`docs/PROMPTS.md` 中三条 2026-10-30 历史合同锚点不存在。本轮合同锚点未被报告为错误。
- 内置浏览器：使用 ChatGPT 内置浏览器和当前工作区正式 Web。`/games/minecraft/instances` 桌面 1440×900、窄短屏 820×520、手机 390×640 均显示两张实例卡；`scrollWidth` 分别为 1440、820、390，无横向溢出。辅助滚动可到达卡片，卡片按容器改为单列。
- 浏览器交互：同一实例的“打开实例”和“管理”各自作为独立链接显示；鼠标点击卡片主体、鼠标点击“管理”、键盘 Enter 操作两个链接，均实际进入 `/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/overview`。卡片主体悬停时 `surface.matches(':hover')` 为真、“管理”链接 `matches(':hover')` 为假，计算样式仍是中性边框/文字。详情中可见启停、控制台、文件和归档操作；打开归档确认后选择取消，实例仍在列表中。
- 截图与边界：本轮内置浏览器现场捕获了桌面列表、手机卡片、窄短屏卡片、悬停态与详情页截图；截图输出作为本轮验收的目视证据。页面日志只出现两条 00:15 的共享 `dsh-ui-primitives` `startsWith` TypeError，早于最终 Web 重启时间 00:19；本轮最终构建后的导航与交互没有新增日志。没有启动/停止/重启真实服务器，没有删除或写配置；没有测量真实设备帧时间。
- 变更文件：`docs/PROMPTS.md`（任务索引/验收状态）；`docs/development/minecraft-instance-list-management-entry-20261031.md`（目标、权限/设置边界与实测）；`packages/client/ui-minecraft/README.md`（入口行为）；`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（整卡与管理双链接及详情操作）；`packages/client/ui-minecraft/src/MinecraftWorkspace.css`（独立悬停/焦点和容器重排）；删除 `packages/client/ui-minecraft/tests/instance-action-menu.test.mjs`（过时的弹窗期望）；新增 `packages/client/ui-minecraft/tests/instance-list-management-entry.test.mjs`（双入口与悬停样式回归）。
