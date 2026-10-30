<a id="lfaa-minecraft-core-catalog-load-recovery-20261030"></a>

# LFAA Minecraft 核心目录加载可恢复（2026-10-30）

## 用户目标与复现

- 用户报告：Minecraft 手动部署页持续显示“正在读取核心分类 / 核心目录”，无法继续选择核心。
- 入口：Minecraft 工作区 → 管理 → 部署（`/games/minecraft/deployment`），新建服务端向导第 1 步。
- 当前截图与源码对应同一症状；本轮尚未在 ChatGPT 内置浏览器内复现到业务页，浏览器显示本机地址连接拒绝。

## 排查证据与假设

1. 最可能：`MinecraftDeploymentPanel` 仅在 `loadMinecraftCores()` Promise 的 `finally` 中结束加载；控制面请求没有默认截止时间，因此未完成的请求会让 UI 永久处于读取状态。源码中组件 AbortController 目前只在卸载或刷新时取消。
2. 次可能：控制面或网络传输挂起。`core-sources.ts` 的上游请求有 20 秒超时；当前没有同一已登录浏览器会话下的核心目录响应/服务日志证据，不能据此断言上游故障。
3. 本地验收工具边界：Windows PowerShell 对 `http://127.0.0.1:3000/api/health` 返回 200；ChatGPT 内置浏览器访问同一回环地址显示 `ERR_CONNECTION_REFUSED`。这证明两种运行环境的本机网络可达性不同，不证明产品控制面故障。

## Owner、运行链路与数据边界

- 前端页面与加载/错误/重试状态 Owner：`packages/client/ui-minecraft` 中的 `MinecraftDeploymentPanel`。
- 请求与认证 Owner：`packages/client/connection` 中 `loadMinecraftCores`/`request`，继续使用现有 Cookie 会话和 AbortSignal。
- 核心目录、上游来源、版本与来源错误 Owner：`packages/games/minecraft/src/core-sources.ts`；不复制目录规则，不改变来源或核心内容。
- 运行入口：桌面或 Web 的 Minecraft 手动部署路由；请求继续进入已认证 Control Plane。该读取不创建实例、不接受 EULA、不触发 Daemon 操作。
- 设置中心清点：读取已有 `minecraftRuntime.minecraftDefaultCore` 作为部署草稿初始选择，外观继续消费 Appearance 的主题/颜色/字体/字号/背景与遮罩映射。设置中心没有“核心目录 API 请求截止时间”偏好；不新增或重置设置，也不复用服务端下载/安装超时设置。
- 权限与数据：无权限模式变化、无持久化写入；保留原请求认证、错误映射、用户草稿和目录缓存行为。

## 允许范围与实现合同

- 只在部署 UI 加入有界目录读取等待与可恢复错误状态；超时后取消该次只读请求、结束加载并复用现有刷新按钮重试。
- 卸载或账户切换时仍须清理计时器并取消请求；不允许重复订阅、请求重叠、后台轮询或超时后陈旧响应覆盖状态。
- 保留现有成功、部分来源错误、全来源失败展示，不伪造目录结果或成功状态。
- 不修改共享 API 超时合同、Control Plane、Daemon、Minecraft 来源适配器、设置中心、许可接受或部署执行流程；除非后续证据推翻当前假设并要求直接修复其 Owner。

## 验收

- 源码检查：确认读取期限必然结束 UI 加载；超时能中止请求并显示本地可恢复错误；手动刷新发起新请求；卸载/用户切换清理计时器并忽略已取消请求。
- 直接相关构建：Minecraft UI 包与 Web 构建，输出只写入仓库根 `dist/`。不运行未由用户要求的自动化测试。
- 实页：使用本轮构建对应源码的正式 Web 服务访问实际部署路由；确认正常目录成功/错误重试状态不阻塞页面其他区域。覆盖桌面与窄分栏/短屏；不提交部署、不接受 EULA、不更改设置或实例。
- 若内置浏览器仍无法访问本机服务，先记录本地服务状态与浏览器错误，区分项目故障和工具网络边界；不得把构建或静态截图记作实页通过。
- 性能、安全、可维护性：仅一条有界只读请求；请求取消和计时器释放完整；使用既有认证、设置和错误 Owner。记录未实测项，不声称构建等于帧时间或完整设备验收。

## 实施与验证记录

- `MinecraftDeploymentPanel` 现在为目录请求设置 25 秒 UI 截止时间；超时时取消现有只读请求，将本地错误交给现有目录告警，并由 `finally` 结束加载、恢复刷新按钮。上游源请求已有 20 秒界限，额外 5 秒留给控制面响应。卸载/依赖切换时清除计时器并取消请求；主动超时会显示错误，普通卸载取消仍不更新状态。
- 设置清点结论：未新增或更改设置。继续消费 `minecraftRuntime.minecraftDefaultCore`、外观主题/颜色/字体/字号/背景及遮罩令牌；没有目录请求截止时间设置，不复用下载/安装超时。
- 构建与静态检查：`pnpm --filter lfaa-client-ui-minecraft run build` 通过（输出到仓库根 `dist/packages`）；`pnpm --filter lfaa-web run build` 通过，含 `tsc --noEmit -p tsconfig.client.json` 和 Vite 生产构建（输出到根 `dist/apps/web`）；`git diff --check` 通过；Impeccable 检查目标文件返回空问题列表。未运行自动化测试。
- 本机服务只读证据：Web/Control Plane 进程仍在 `127.0.0.1:3000`，`/api/health` 返回 HTTP 200（74 ms）。构建指纹核查为 `runtime-build-state web -> ["host"]`，Web UI 产物已更新而 Control Plane 产物仍与当前源码不一致。
- ChatGPT 内置浏览器实页尝试：实际路由 `http://127.0.0.1:3000/games/minecraft/deployment`，视口 `978×925`。页面只显示“LFAA Web 或控制端构建文件在服务运行期间已更新……请停止并重新启动 LFAA Web”，尚未进入部署 UI，因此本批未验收目录成功/超时重试行为，也未覆盖桌面常用宽度、窄分栏或短屏。
- 未重启 Web：当前 Web PID 30196 管理本地 Daemon 子进程 PID 54968；`packages/host/daemon/src/supervisor.mjs` 的关闭路径会向其发送 `lfaa-shutdown`，Daemon 会走受管关闭流程。此操作可能停止由节点托管的实例/当前任务，故本轮没有为界面验收执行该动作。检查时本机未发现 `java.exe`、`javaw.exe` 或 `bedrock_server.exe`，但这不足以排除远端节点或其他受管任务状态。
- 未新增请求重试循环、定时轮询、样式变量或存储写入；未改变认证、Permission Owner、Minecraft 部署与 EULA 流程。运行进程尚未加载新 UI，需要安全重启后才可确认真实浏览器行为；构建成功不代表该验收已通过。
- 变更文件职责：`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`（目录等待截止时间、取消与可恢复错误）；本文件（诊断、所有者、设置、验收与实页限制）；`docs/PROMPTS.md`（任务索引）。未改 API、核心来源或 Daemon。
