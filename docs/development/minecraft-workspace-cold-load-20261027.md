# Minecraft 管理页首次加载与重复进入体验

<a id="lfaa-minecraft-workspace-cold-load-20261027"></a>

## 用户问题与目标

- 用户在 `/games/minecraft` 看到“正在读取 Minecraft 主机与实例状态…”长时间占满页面；每次进入都像重新加载。
- 主机、实例、任务等真实数据应先于可选的 Mojang/核心来源目录出现；普通管理和环境查看只读取 LFAA 自身数据。同一已登录账户在单页应用内再次进入时先显示最近成功快照，外部目录只在进入部署选择流程时按需读取，成功后在本会话按账户复用。
- 核心目录、版本/构建元数据只用于部署选择，目录查询不等于下载；服务器和运行环境文件只允许在用户明确提交对应部署/安装操作后由目标节点下载。已安装环境由现有 RuntimeManager/Daemon 状态复用。
- 共享运行环境页以当前账户内存快照立即恢复上次真实设备/环境结果，再读取本机 RuntimeManager 状态更新；缓存只改善首屏，不替代安装前实际探测和 Daemon 校验。

## Owner、入口、设置、数据与权限

- 入口：Web/Desktop `/games/minecraft` → `ApplicationWorkspace` → `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` → 认证 API `/minecraft/overview` 与其余 Minecraft 读取路由。
- `/minecraft/overview`、节点与实例汇总归 `packages/games/minecraft`，HTTP 认证适配归 `packages/api/minecraft-controller`；官方版本目录归同一 Minecraft 领域包的 Mojang catalog Owner；按账户复用首屏快照归 `packages/client/ui-minecraft` 与共享 Snapshot Cache。
- 继续使用已认证账户、Daemon 节点与 Minecraft 领域数据；缓存只在进程内按 `userId + role` 隔离，不新增持久化、不跨账户/角色复用。角色字段脱敏、服务端认证/授权和操作校验均不变。
- 设置：不新增或修改设置；实例默认值仍由现有 `minecraftRuntime.*` 管理，外观仍沿用 Appearance 设置映射。

## 允许范围与验收

- 允许：把 Overview 所需的本机汇总读取与 Mojang catalog 解耦；普通管理页不加载外部目录；部署核心目录和已读取的核心构建目录按账户保存在当前进程内，重新进入时复用，用户仍可手动刷新；共享运行环境页按账户复用上次真实的本机/节点环境快照并后台核对；真实二进制下载仍由显式部署/环境安装提交触发；在目录尚未加载时不显示虚构的最新版本；补充对应 API/客户端类型、README 与长期回归。
- 禁止：伪造版本号或节点/实例状态、将快照改成跨账户或持久缓存、绕过认证或权限、修改用户设置、触发 Minecraft/Daemon 实例操作。
- 验收：冷目录条件下 `GET /minecraft/overview` 不触发外部 HTTPS 请求且快速返回；普通 Minecraft 总览不请求 release/core/build 目录；核心目录仅在部署选择页读取且当前账户复用成功结果，用户手动刷新可请求新目录；运行环境页面以当前账户缓存首屏且后台读取本机状态；实际服务器/环境下载仍需显式部署/安装提交；已有 Minecraft UI 快照首屏呈现后由本机串行 poller 与 Socket 对账；相关 API/Client 回归、受影响包/Host/Web 构建、ChatGPT 内置浏览器 `/games/minecraft` 和 `/games/environments` 再次离开/进入检查。
- 性能证据区分服务端请求/调用数、内置浏览器实际首屏与交互、未测帧时间；浏览器验收不得操作设置、安装/启停服务或 Minecraft 实例。

## 追加性能优化批次（2026-10-27）

- 用户追加目标：把页面已加载数据用于短期复用，消除 Minecraft 首次 Socket 连接与初始 REST 快照的重复整批读取；关键主机/实例状态可先呈现，不等待 Java、部署和任务等辅助数据；减少日志与活动任务的固定频率请求，并核实普通 Web 入口的首屏依赖能否在 LFAA 当前 DSH 模块合同内安全拆分。
- Owner 与边界：Minecraft 数据与实时变化仍归 `packages/games/minecraft` / `packages/api/minecraft-controller`；Client 快照、状态读取、任务轮询归 `packages/client/ui-minecraft`、`ui-layout` 与共享 `connection/read-poller`；浏览器启动图依赖归 `client/modules` / `client/web`，不编辑其他 checkout 或 `node_modules` 中的上游源码。
- 缓存与一致性：按已登录 `userId + role` 隔离；最近成功快照只作短期展示与请求去重，过期、Socket 重连、实时变化、显式操作完成或用户重试仍触发权威读取；写入/安装仍由现有领域 API 和 Permission Owner 校验，缓存不能批准动作或伪造成功。
- 目标运行入口：Web/Desktop 共用 Client；Web 实际路由 `/games/minecraft`、`/games/environments`。沿用当前用户设置和外观配置，不增加或修改设置中心项。
- 验收目标：冷进入只执行一轮首屏六路快照；缓存新鲜的回访不立即重复整轮读取，Socket 在线事件仍能及时刷新；关键 UI 不等待辅助数据；活动日志/任务轮询减少请求且隐藏页面可暂停并在恢复时对账；首屏依赖只在确认不破坏 DSH Client Runtime、认证后扩展槽和现有安全合同的情况下调整。记录静态请求工作量、实际浏览器网络/交互与帧时间边界。
- 用户可见批次：B1 调整 Minecraft 快照复用、首屏分阶段显示、Socket 初次连接去重和 REST 对账间隔；B2 调整活动日志与任务状态轮询；B3 若现有 DSH API 允许，在不改上游副本的前提下推迟或拆分不必要的初始代码，否则保留并记录阻碍。每批直接回归/构建后须按开发规范尝试内置浏览器实页验收，再开始依赖批次。

## 实施记录

- 根因：`getMinecraftOverview()` 原本调用 Mojang 版本目录；同一首屏又通过 `/minecraft/releases` 单独读取目录。目录缓存只在上游响应成功后写入，冷缓存并发时两个入口都会请求 Mojang，且 overview 被上游 20 秒超时直接卡住；MinecraftWorkspace 只有六项本机快照读取全部结束后才显示和缓存数据。
- 原第一批实现：`getMinecraftOverview()` 只读本地 Daemon 节点、实例与任务摘要；`/minecraft/releases` 仍是官方目录的独立真实 API。UI 原有 `SnapshotCache` 按 `userId` 复用最近完整快照，并由 8 秒串行 poller 后台对账。
- 第二批实现：总览移除 `/minecraft/releases` 请求，显示“按需获取”；部署面板以共享进程内 `SnapshotCache` 按账户复用核心目录与核心/版本构建目录，缓存缺失时才查询来源，手动刷新仍读取新核心目录；版本切换、离开部署页会中止未完成的目录请求；进入部署配置步骤后才解析核心 Java 要求并读取目标环境。实例/节点/Java 安装状态仍是本机认证 API/Daemon 的事实，实际服务器文件下载只由显式“自动部署并启动”提交触发。
- 第三批实现：共享运行环境页以同一 Snapshot Cache 按 `userId` 保存最近成功的真实 Runtime Overview；再次进入时立即显示该数据，随后继续通过认证后的 RuntimeManager 读取状态。RuntimeManager 仍对本机环境发现做 60 秒缓存，节点环境来自心跳/任务结果；安装器先扫描、复用既有运行时，只有显式安装任务才请求上游包元数据或下载。
- 设置与权限：未新增或修改设置。只沿用现有账户隔离快照；认证、成员脱敏、角色、Daemon 身份、实例操作权限和服务端校验未变。
- 直接回归：`pnpm --filter @yubboo/lfaa test -- tests/minecraft-overview-fast-path.test.mjs` 2/2 通过。隔离账户的认证 `GET /minecraft/overview` 冷目录读取实测 9 ms，外部 HTTPS 请求 0 次；静态合同回归确认同一 userId 快照仍被首屏读取、成功后写入并继续串行刷新。
- 第二批直接回归：同一命令仍 2/2 通过；冷目录 overview 实测 10 ms、外部 HTTPS 请求 0 次；静态合同还检查普通管理页不调用 Mojang、核心/构建结果按 userId 缓存，Java 要求在向导第 2 步后才读取，实际部署路径仍是显式 provision API。
- 第三批直接回归：`pnpm --filter @yubboo/lfaa test -- tests/minecraft-overview-fast-path.test.mjs tests/runtime-overview-cache.test.mjs` 共 3/3 通过。静态合同核对运行环境页按账户与角色恢复快照并保留后台真实状态请求。
- 相关包与 Client 验证：`pnpm --filter lfaa-games-minecraft build`、`pnpm --filter lfaa-api-minecraft-controller build`、`pnpm --filter lfaa-client-connection build`、`pnpm --filter lfaa-client-ui-minecraft build`、`pnpm --filter lfaa-client-ui-layout build`、`pnpm exec tsc --noEmit -p tsconfig.client.json` 和两轮 `pnpm run build:web` 均通过；Web 产物写在根 `dist/apps/web/`。最终 `git diff --check` 通过。
- Host 阻碍：`pnpm exec tsc --noEmit -p tsconfig.host.json` 与 `pnpm run build:control-plane` 被当前工作树已有的 `packages/browser-use/browser-use/src/accessibility-tree.ts:68` (`boolean | "mixed"`)、`session-manager.ts:1253` 和 `tabbit-provider.ts:396` 可选字段类型错误阻断；这些文件属于进入本任务前就存在的其他未提交改动，没有越界修复。`node scripts/runtime-build-state.mjs web` 返回 `["host"]`，端口 3000 无监听，因此按正式入口指纹规则没有用旧 Host 产物启动服务。
- 实页与边界：ChatGPT 内置浏览器 `/games/minecraft`、离开再进入、宽窄视口与截图未实测。Web 构建后 `node scripts/runtime-build-state.mjs web` 返回 `['host','web']`，本地 3000 端口无监听；正式 Host 构建仍被工作区既有 browser-use 类型错误阻断，因此不能声称加载动画已在真实页面消失。Electron/WebView、实际页面网络请求与帧时间未测。未触碰设置、插件、Minecraft 实例、Daemon 运行状态或真实业务数据。
- 文件职责：`packages/games/minecraft/src/service.ts`（overview 本地汇总）；`packages/api/minecraft-controller/README.md`（认证路由契约）；`packages/games/minecraft/README.md`（目录与本机概览 Owner 边界）；`packages/client/connection/src/api.ts`（overview nullable 类型及目录请求取消信号；文件原有其他未提交改动保留）；`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（快照首屏、本机概览与移除总览目录请求）；`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`（按账户复用目录、手动刷新与中止过期请求）；`packages/client/ui-minecraft/README.md`（快照与延迟目录的 UI 合同）；`packages/client/ui-layout/src/GameLibraryPage.tsx`（运行环境概览首屏快照）；`packages/client/ui-layout/README.md`（运行环境快照边界）；`apps/cli/tests/minecraft-overview-fast-path.test.mjs`（本机快速路径和按需/缓存回归）；`apps/cli/tests/runtime-overview-cache.test.mjs`（运行环境快照回归）；`docs/PROMPTS.md` 与本合同（索引及实施证据）。

## 后续性能优化实施记录（2026-10-27）

### B1：首屏状态与快照复用

- Minecraft 快照按 `userId + role` 隔离；组件身份变化时重挂载，避免复用其他身份的 React 状态。最近 30 秒内已完成的快照再次进入时先呈现本地真实结果，并延后 REST 对账到快照过期；缓存仍为内存短期预览，不延伸到磁盘或跨账户。
- 冷进入先并发读取 Overview、节点、实例三项关键状态。三项 settle 后立即解除整页加载门并通知工作区；随后才启动 Java、任务、部署三项辅助读取。原来六项都 settle 才显示的等待改为只等关键三项。完整快照只有六项全成功才更新缓存和新鲜度；失败不再冒充成功时间，首个 Socket 握手仍会触发必要重试/去重。首屏、日志和任务详情请求接受 `AbortSignal`，切换身份、实例/页面卸载时取消在途只读请求。
- 首次 Socket 连接不会重复创建一轮完整快照；后续 Socket 状态/任务变更与重连仍即时触发权威读取。Minecraft REST 对账在线 30 秒、断连 10 秒；日志在线以 Socket 推送为主并每 30 秒核对，断连后立即核对并每 5 秒兜底。运行环境页的账户/角色快照新鲜 30 秒内跳过重复读取，过期时由认证 RuntimeManager API 刷新。
- 设置中心未新增或修改配置；保留现有 Appearance 映射、Minecraft Runtime 默认值、认证/授权与安装前真实探测。

### B2：任务与日志读取频率

- Agent 终端任务列表有活动任务时每 3 秒、空闲时每 5 秒读取；详情只在任务选择变化、详情不存在或任务仍活动时读取，已完成任务不再每轮重复取详情。
- Runtime Manager 与 SteamCMD 活动任务对账从 1.5 秒调为 3 秒；离开页面会中止在途 SteamCMD 请求。页面隐藏时仍由共享 Read Poller 暂停，恢复可见/Socket 变化/用户操作仍按原路径即时核对。
- 按请求频率换算（不代表实测网络计数）：Minecraft 在线快照从每分钟 7.5 次变为 2 次，减少约 73%；控制台日志在线从每分钟 15 次兜底变为 2 次，减少约 87%；Runtime/SteamCMD 活动任务从每分钟 40 次变为 20 次；Agent 任务活动态从 30 次变为 20 次，空闲态从 30 次变为 12 次。Minecraft 断连兜底从 8 秒调整为 10 秒，但 Socket 断开仍即时拉一次。

### B3：首屏依赖审查与实测边界

- LFAA `client/modules` 把 DSH UI Primitives 根命名空间作为 `staticModules` 同步交给上游 `target.create()`；Web 当前入口静态 modulepreload 为 9 个 JS 资源，共 1,368,153 字节原始体积、391,815 字节按资源 gzip。当前包含 DSH UI Primitives、KaTeX、Markdown、Shiki 等静态入口依赖。
- 现有模块运行时合同要求创建 DSH Runtime 时提供同步的静态模块命名空间；LFAA 没有可延迟解析这些模块的公开合同。仅改 Vite 分块或改成启动时动态 import 不会去掉启动阶段依赖，删除命名空间则有破坏 DSH Profile、扩展槽和认证后模块的风险。本轮没有改上游或伪造缺失模块，因此静态启动包体未优化；后续要安全降低它，需要 DSH 提供可选/异步静态模块合同或调整公共 Runtime 启动协议。
- 本机隔离测试认证 `GET /minecraft/overview` 多次实测 7–12 ms，外部 HTTPS 请求 0 次。它只证明 API 本地快路径，不代表浏览器首屏时间。
- 本轮定向回归：`minecraft-overview-fast-path.test.mjs` 与 `runtime-overview-cache.test.mjs` 共 3/3；`client-performance.test.mjs` 中本轮 Read Poller 与终端两项选择性回归 2/2。全文件运行 36/37，唯一失败是现有 AI Work 文件活动回归仍期待 `onOpenProjectFileReview(change.projectId!, change.path)`，当前工作区源码已传入第三个 `sourceId` 参数；该断言及功能不属于本批次。
- `pnpm --filter lfaa-client-connection --filter lfaa-client-ui-minecraft --filter lfaa-client-ui-layout --filter lfaa-client-ui-workspace run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web` 和 `git diff --check` 通过。Web 构建写入根 `dist/apps/web/`。
- Host 类型检查和 `pnpm run build:control-plane` 仍被当前工作树中既有的 Browser Use 类型错误阻断：`packages/browser-use/browser-use/src/accessibility-tree.ts:68`、`session-manager.ts:1253`、`tabbit-provider.ts:396`。`node scripts/runtime-build-state.mjs web` 返回 `['host']`，3000/5173 均无监听；依正式指纹规则无法启动当前正式 Web/Host 组合。ChatGPT 内置浏览器 `/games/minecraft`、`/games/environments` 的页面/窄视口/重复进入、截图与真实网络及帧时间均未实测，本轮不记为通过。
- 文件职责（本次追加改动）：`packages/client/connection/src/api.ts`（Minecraft/任务/SteamCMD 只读 API 支持 AbortSignal）、`packages/client/connection/README.md`（读取取消合同）、`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（身份隔离、缓存新鲜度、关键/辅助请求分批、Socket 去重、日志对账与请求取消）、`packages/client/ui-workspace/src/TaskTerminal.tsx`（任务详情条件读取、任务轮询和请求取消）、`packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx`、`SteamcmdWorkspace.tsx`（SteamCMD 任务轮询和离开时取消）、`packages/client/ui-layout/README.md`、`packages/client/ui-minecraft/README.md`、`packages/client/ui-workspace/README.md`（缓存和轮询公开合同）、`apps/cli/tests/client-performance.test.mjs`、`apps/cli/tests/minecraft-overview-fast-path.test.mjs`（调度、缓存、请求取消和分批读取回归）、`docs/PROMPTS.md` 与本合同（索引、边界及证据）。
