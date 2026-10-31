<a id="lfaa-minecraft-deployment-core-catalog-cache-20261031"></a>

# LFAA Minecraft 部署核心目录会话缓存（2026-10-31）

## 用户目标与现状

- 用户指出：每次进入 Minecraft 部署页都会重新读取核心目录，认为应在系统运行后首次成功读取，再复用结果；选择具体核心后再处理对应版本/构建和真实工件。
- 入口：Minecraft 工作区 → 管理 → 部署（`/games/minecraft/deployment`），新建服务器向导第 1 步。
- 源码证据：`MinecraftDeploymentPanel` 已用按 `userId` 的内存快照缓存展示最近目录，但挂载效果不论缓存是否命中都会调用 `loadMinecraftCores()`，加载态也始终从 `true` 起步。
- 冷进入时，认证后的 `/minecraft/cores` 由领域 Owner 并行读取 FastMirror、Mohist Youer 与 PaperMC 的核心/版本元数据。该过程不下载服务端 JAR；实际下载地址和摘要由服务端按选择的核心、版本、构建解析校验，节点只在已授权部署任务中下载所需文件。
- 缓存仅存在当前前端运行内存：同账户离开再进入时复用；完整刷新浏览器或重启 Web 后会重新冷加载。不会在启动系统时为未访问部署页的用户预加载目录。

## Owner、设置与权限边界

- 页面加载、错误反馈与选项状态 Owner：`packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`。
- 认证请求 Owner：`packages/client/connection` 的 `loadMinecraftCores`/`request`，不改变 API 合同。
- 核心来源、版本与工件校验 Owner：`packages/games/minecraft/src/core-sources.ts`，按已选核心调用其登记来源；不改来源登记、地址白名单、摘要或部署验证。
- 设置中心：草稿初始核心继续使用 `minecraftRuntime.minecraftDefaultCore`；外观继续使用 Appearance 共享映射。无目录缓存偏好设置，不新增、重置或修改设置。
- 数据和权限：目录缓存按 `userId` 存在既有有界客户端内存快照缓存中，登出由共享 Snapshot Cache 清理；不写数据库/浏览器持久存储，不影响账户权限。版本、构建、Java 要求与部署最终仍由认证后的 API/领域 Owner 重新校验。

## 实施边界

- 仅首次冷进入、无可用成功缓存，或用户显式点击“刷新核心目录”时读取完整目录。
- 当前运行内存中缓存至少包含一个可用核心的响应；空目录/全来源失败只显示错误并允许再次尝试，不记成成功快照。缓存命中时直接展示目录，不进入加载态。
- 用户选择核心与版本后，保留当前构建列表缓存和选择流程；真实服务端工件 URL/摘要仍在部署前校验，文件下载只由已提交且获准的节点任务执行。
- 选中核心/版本后的构建列表校验只访问该核心对应来源：PaperMC、Mohist Youer 或 FastMirror；禁止因单个选项的校验重新聚合无关来源。FastMirror 目前的版本清单 API 仍返回该来源登记目录，不能假定存在未核实的逐核心版本端点。
- 保留 25 秒读取截止、AbortController、刷新按钮与错误反馈；卸载时仍清理计时器并取消请求。无后台刷新、轮询、订阅、持久化或新增设置。
- 不修改 `MinecraftWorkspace` 的总体布局、公开 API、来源登记与地址合同、Control Plane/Daemon 装配、EULA、实例记录或用户设置。只调整核心目录 Owner 对“所选核心版本存在性”的来源读取粒度。

## 验收计划与结果

- 源码核对：有成功缓存时第二次进入不调用完整目录 API、不显示读取态；首次冷进入仍请求；空失败不入缓存；手动刷新仍执行新请求；用户切换按各自缓存键读取，卸载取消未完成请求。
- 构建：`pnpm --filter lfaa-games-minecraft run build`、`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm run build:control-plane`、`pnpm run build:web` 均通过；Web 构建包含 `tsc --noEmit -p tsconfig.client.json` 与 Vite 构建，产物分别写入根 `dist/packages/`、`dist/apps/control-plane/`、`dist/apps/web/`。正式启动前及最终 Web 重建后，`node scripts/runtime-build-state.mjs web` 和 `host` 均返回 `[]`；启动后健康接口为 `ok/ready`。最终 `git diff --check` 通过。未运行自动化测试。
- 内置浏览器：实际路由 `http://127.0.0.1:3000/games/minecraft/deployment`。确认 3000 端口空闲且构建指纹有效后，通过正式 `pnpm lfaa web` 入口启动当前版本。最终 Web 重建后原 tab 刷新遇到一次浏览器连接拒绝；本机健康接口仍为 `ok/ready`，新建 IAB tab 后从最终构建冷进入成功。`1280×720` 显示 5 类核心与 Paper 68 个版本；默认 Paper 的构建匹配因外部 `fill.papermc.io` 连接失败而显示可操作错误。选择 Fabric 后显示 530 个版本且构建匹配成功；经应用菜单去 `/games/minecraft/instances` 再返回后，目录和已匹配构建立即显示，无“读取中”。随后在补充目视期间，3000 端口停止监听且健康请求被拒绝；停止原因未确认，未再启停服务。前述最终构建指纹在停止前为 `[]`。
- 窄屏：`390×640` 关闭应用导航面板后，部署内容可见；文档与页面宽度均为 390px，部署布局宽 294px，无横向溢出。离开并返回部署页后仍显示 5 类核心和 68 个版本，无目录加载提示。临时视口已恢复为默认 `1280×720`。
- 性能证据：源码缓存命中分支在调用 `loadMinecraftCores` 前返回；所选核心版本校验不再聚合其他来源。真实页面离开/返回没有目录加载态，手动刷新可操作。IAB 未暴露可用的 Resource Timing 记录，因此未直接采 Network 瀑布/请求计数；帧时间、真实设备与在线上游耗时未测。
- 浏览器操作只读取目录、切换核心草稿并在部署/实例两个路由间导航；Fabric 测试后保留当前页的临时草稿，未提交部署、接受 EULA、安装环境或修改设置/实例数据。页面后续失去服务连接，未验证该停止后的运行状态。

## 变更文件

- `packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx`：成功快照命中时跳过重复目录请求；缓存按当前用户标记，避免账户切换时复用别人的 UI 状态；仅非空目录进入缓存；显式刷新仍请求上游。
- `packages/client/ui-minecraft/README.md`：记录部署页目录快照的运行期复用、冷加载和手动刷新行为。
- `packages/games/minecraft/src/core-sources.ts`、`packages/games/minecraft/README.md`：版本构建校验读取被选核心的对应来源，不重新聚合其他核心来源。
- `docs/PROMPTS.md`、本合同：登记目标、Owner、验收与实际结果。
