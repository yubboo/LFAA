# Minecraft 管理工作区参考布局

<a id="lfaa-minecraft-admin-ui-reference-20261027"></a>

## 用户问题、目标与入口

- 用户希望 Minecraft 应用的总览、实例管理、监控和控制台按照本轮四张参考图进行布局与视觉调整，同时继续使用 LFAA 已实现的部署、实例、节点、任务、日志和控制台能力。
- 目标入口：Workbench 的 Minecraft 应用 → `/games/minecraft/overview`、`/games/minecraft/instances`、`/games/minecraft/nodes` 与 `/games/minecraft/instance/:id/logs`；相关实例配置、备份和部署仍留在现有路由。
- 共享界面唯一 Owner：`packages/client/ui-minecraft`；Workbench 应用导航和 Appearance 壁纸映射仍由 `packages/client/ui-workspace`、`packages/client/ui-layout` 负责。节点、实例、任务、日志与操作仍由 Minecraft API/领域服务及目标 Daemon 提供真实状态。
- 权限继续使用 `hasAdminAccess(role)` 和现有认证 API/Permission Owner。页面美化不能放宽只读角色限制、节点在线检查、实例状态前置条件或服务端校验。

## 设置、数据与范围

- 外观继续使用设置中心 `appearance.backgrounds.minecraft`（默认 `none`）、主题、强调色、界面/内容/代码字体、字号、对比度、区域遮罩透明度、玻璃模糊和 `appearance.advanced.reducedMotion`。Workbench 通过 `appearanceBackgroundSlotForRoute()` 映射当前工作区；不生成或新增背景图片，不修改账户偏好。
- 部署表单继续读取 `minecraftRuntime.minecraftDefaultCore`（默认 Paper）、`minecraftDefaultMemoryMb`（4096 MB）、`minecraftDefaultPort`（25565）、`minecraftBedrockDefaultPort`（19132）、`minecraftExecutionMode`（native）及现有等待时限。设置定义、持久化和校验仍由 Settings Owner 负责，本任务不新增配置。
- 已有读取事实：概览实例/节点/活动任务计数、Daemon 在线状态与能力、实例核心/版本/端口/内存配置、任务状态、最近任务、实例日志和实例控制台指令。不得把配置值称作实测资源用量。
- 现有接口没有 CPU、内存实际占用、磁盘 I/O、网络吞吐、TPS、在线玩家数或历史时间序列采样。本任务不补写采样服务或伪造图表/健康分数；监控视图以节点心跳、实例状态和任务事实为内容，并清楚标示尚未接入的性能采样。
- 允许：调整现有页面结构、样式和导航可见性；将已存在的启动/停止/重启/备份/日志/配置/部署操作放在更易发现的位置，并沿用当前操作函数、确认及权限约束。
- 禁止：写入示例服务器、玩家、事件或性能数值；增加本轮未实现的玩家、插件、告警和历史监控功能；触发真实 Minecraft/Daemon 操作；改变部署、数据、权限或设置 Owner。

## 分批实施与可观察验收

1. **总览与共用视觉框架：** 使用设置中心当前壁纸和主题令牌，展示真实服务器/实例上下文、现有四项摘要、节点状态、最近任务及可用快捷入口；空数据和读取失败继续使用明确状态。桌面与窄分栏/短屏下卡片有序重排、无横向溢出。
2. **实例管理：** 保留现有搜索、状态筛选、部署入口、真实状态卡片、启动/安全停止/删除确认和实例详情；沿参考图整理卡片层级、信息密度、选中实例详情导航与配置/备份入口。
3. **监控：** 以实际 Daemon 心跳、执行能力、节点最近上报、实例数和任务状态呈现工作状态；未接入 CPU/TPS 等采样处显示明确说明，不渲染看似实时的假折线或百分比。
4. **控制台：** 保留真实日志、Socket 更新、轮询对账、滚动恢复、命令输入/发送和权限/状态禁用；整理深色终端视觉、错误流提示及窄屏日志换行。浏览器验收只查看页面，不发送命令。

- 每批直接相关检查和当前源码工作区 Web 构建通过后，立即在 ChatGPT 内置浏览器打开实际 Minecraft 路由验收，再继续依赖该批次的工作。
- 逐页记录路由、桌面视口与窄分栏或短屏视口、遮挡/溢出/滚动/操作可达性、交互结果、截图路径和未测范围。至少检查外观设置对壁纸、主题/字号及减少动态效果的消费情况，不修改偏好。
- 运行现有 Minecraft UI 包构建、Client 类型检查、Web 构建及适用的直接回归；性能检查区分真实 API 数据、日志上限/轮询生命周期与未测帧时间。不得把源码构建当作实页通过。

## 实施与验收记录

- **总览批次：** `MinecraftWorkspace.tsx` 增加基于真实实例数据的服务器头部、启停/控制台入口、节点与任务面板；继续使用现有四项管理摘要和 API。没有添加资源监控折线或示例状态。
- **实例批次：** 在 `/games/minecraft/instances` 增加真实实例总数、运行中、已停止和需核对摘要；保留原搜索、状态筛选、部署、管理、启停、删除确认及实例详情路由。
- **监控批次：** 在 `/games/minecraft/nodes` 增加真实在线/可部署节点、运行实例与活动任务摘要；节点卡片补充该节点的实例数与运行数，并明确 CPU、内存、磁盘、网络、TPS 和玩家数没有采样接口。
- **控制台批次：** 在 `/games/minecraft/instance/:id/logs` 保留原日志读取、Socket 通知、4 秒只读对账、滚动状态、命令权限与提交函数；重排成日志终端与实例信息/快捷输入侧栏。快捷输入只改写当前输入框，不会发送命令。错误流、窄列换行使用独立样式。
- `packages/client/ui-layout/src/Workbench.tsx` 的既有 Appearance 壁纸选项类型包含无图片文件的选项；为当前文件映射补充 `"file" in option` 守卫，保持原壁纸来源与选择逻辑，并恢复 Client/Web 类型检查。
- 四个视图继续继承 `appearance.backgrounds.minecraft` 映射和 Appearance 主题、强调色、字体/字号、对比度、壁纸表面透明度、模糊与减少动态效果；本轮未改设置值，也未生成图片。代码终端读取设置中心代码字体、代码字号和强调色。
- **静态/构建检查：** `pnpm --filter lfaa-client-ui-minecraft build` 通过；`pnpm --filter @yubboo/lfaa test -- tests/minecraft-overview-fast-path.test.mjs` 通过（2/2，认证后的本机概览 11 ms，外部 HTTPS 0 次）；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm run build:web` 通过，产物写入根 `dist/apps/web/`。Web 构建仍报告仓库原有大 chunk 提示。
- Web 重建后 `node scripts/runtime-build-state.mjs web` 返回 `["host"]`：Web 指纹新鲜，Control Plane 构建产物仍过期，不能作为正式菜单启动完成的证据。
- 一次 Web 重建期间其它包源码发生变化，构建指纹拒绝登记；待共享源码稳定后再次构建成功，Web 指纹检查恢复为仅 `host` 过期。
- **Host 限制：** 本轮 `pnpm run build:control-plane` 仍被其他未改文件的 TypeScript 错误阻断：`packages/browser-use/browser-use/src/accessibility-tree.ts:68` 的 `boolean | "mixed"` 赋值、`session-manager.ts:1253` 和 `tabbit-provider.ts:396` 的可选 `accessibilityTree` 类型，以及 `packages/settings/settings/src/service.ts:657` 未使用的 `directory`。这些文件不属于本任务，没有修改。
- **内置浏览器尝试：** 从当前源码在 ChatGPT 内置浏览器打开 `http://127.0.0.1:31000/games/minecraft/overview`，默认桌面截图为 1280×720；页面一直停在认证初始化（首次为 `main.loading-page[aria-busy=true]`，后续仅有空 `main`）。隔离控制面 `/api/health` 无响应/无法连接，故 React 工作台未挂载，不能检查 Minecraft 页面排版、设置映射、交互或截图。随后打开 `/games/minecraft/instances` 和 `/games/minecraft/nodes` 也只有空 `main`。内置浏览器没有可用的 viewport 控制能力，无法进行窄屏实页验收；控制台路由因隔离环境没有真实实例 ID 未打开。浏览器只读，无启停或命令写入。
- 本次浏览器截图只证明启动页为空，不能作为设计验收证据；没有可引用的功能页截图路径。四页的真实桌面/窄屏呈现、外观设置实效、控制台命令交互和浏览器帧时间仍待控制面可响应后补验。源码/构建结果不标记为实页通过。
- 本轮没有新增定时器或订阅；日志既有读取仍由可取消的 4 秒 poller 与 Socket 变更触发管理。未测浏览器帧时间，不以构建成功推断交互流畅度。
