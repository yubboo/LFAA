# Minecraft 总览节点整机资源监控

<a id="lfaa-minecraft-overview-node-resource-telemetry-20261031"></a>

## 用户目标与可观察结果

- 在 `/games/minecraft/overview` 当前服务器概览卡片下方、摘要卡片上方的空白区域加入 CPU、内存、磁盘和网络实时采样卡，参考用户提供的四项指标图。
- 统计范围是当前总览服务器卡片对应运行节点的整台主机。总览优先选择真实运行中的实例，否则选择既有默认实例；显示采样节点名称，让用户知道指标所属主机。
- 只显示目标 Daemon 从系统实际采集并经 Control Plane 收到的数据。CPU、内存和磁盘显示真实占用率；网络显示实际接收/发送速率。小图/趋势线只使用有限的真实历史样本，网络不显示没有带宽分母的伪进度。
- 首次采样、字段不可用、数据请求失败、节点离线及数据过期均在对应区域明确表达；保留最后一次成功快照时标注其时间，绝不填入截图示例或推测值。

## 入口、Owner、数据与权限

- 目标运行入口与布局 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 的 Minecraft 总览页；相邻几何由 `MinecraftWorkspace.css` 维护。
- 采样 Owner：目标节点 Host Daemon。CPU 由系统累计 CPU 时间相邻采样求差，内存由系统总量/可用量计算，磁盘为该节点所有本地固定卷容量与可用量之和，网络取当前 IPv4 默认路由网卡的系统累计收发字节相邻采样求差。Daemon 不发送本机绝对数据目录、卷名或网卡名称。
- 传输链：Daemon 通过现有本机身份认证的 `/daemon/heartbeat` 上报；`api/remotes` Joi 合同验证；`host/daemon/local-daemon.ts` 按 node ID 有界保留最近样本；Minecraft Controller 提供登录用户的 `no-store` 只读节点快照；Client Connection 只透传已验证响应，UI 不推断数值。
- 缓存只存在 Control Plane 进程内，不写业务数据库；每节点最多保留 30 条、每条最多覆盖 5 分钟，并限制缓存节点数。节点心跳失效沿用现有 20 秒状态约束，历史数据按真实 `observedAt` 标记过期。
- 客户端只在总览页可见时按串行 10 秒节奏读取当前卡片节点；路由/节点变化、隐藏页面和卸载时中止在途请求并清理 timer/listener。不会与服务器生命周期、终端/TPS订阅互相启动或覆盖。
- 保留现有统一登录授权、Daemon 身份和严格参数合同；不新增权限模式、设置偏好、持久化数据、实例操作或测试专用旁路。

## 设置、性能与响应式边界

- 设置中心盘点：资源采样周期为内部刷新策略，不增加用户控制项；沿用现有 Appearance/常规设置的主题、颜色、字体、字号、对比度、壁纸、遮罩、模糊与减少动态效果映射，不重置用户偏好。
- 当前产品样式与用户提供的四卡参考共同决定表现：三项占用率使用真实百分比和真实样本趋势，网络展示收发速率及真实趋势；避免装饰性动画和无来源的图表数据。
- Host 采样最长每 10 秒一次；同一 Daemon 最多一个系统采样任务，单项不可用不阻断其它指标或现有心跳。Client 与服务端均限量，页面隐藏停止只读读取；所有计时器、在途请求和可见性监听都可撤销。
- 新卡片在桌面同排、窄容器/平板按容器宽度重排、窄手机单列；适配窄分栏和短屏，不能让整页横向溢出，也不能压缩原总览摘要与节点/实例区。

## UI Skill 与实际验收

- 本轮已遵循 `lfaa-code-change`、用户选择的 `lfaa-owner-navigation`、`lfaa-validation`，并读取 Taste、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI 六项必需 UI 技能；另检查 UI Pro Max 无障碍/触控/性能及 React 生命周期规则。
- 运行入口为正式 Web `/games/minecraft/overview`。Control Plane/Harness 与 Web 由仓库正式启动菜单按当前源码重建；`scripts/runtime-build-state.mjs web` 返回 `[]`，之后通过当前 checkout 的 `pnpm lfaa web` 启动，IAB 页面正常连接本机 Daemon。
- IAB 桌面 1280×720 实页显示当前节点 `WIN-20250328BHE` 的 CPU、内存、磁盘、收发速率，状态为“实时采样”。09:53 的实测快照为 CPU 6.8%、内存 89.2%（14.1/15.8 GB）、固定卷 76.8%（733/953.9 GB）、接收 54.1 KB/s、发送 580.5 KB/s；采样时间前进，CPU/网络读数改变，趋势历史从 3 条增长到 13 条。所有值来自节点实时数据。
- IAB 窄分栏 760×900 实页中，指标卡改为两列，百分比保持单行；页面可纵向滚动。IAB 手机 390×844 的资源容器宽 294px、两列；短屏 320×568 的资源容器宽 224px、单列，主内容区可纵向滚动，两个视口的 document 宽度都未超过 viewport。
- 390px 和 320px 截图中，当前打开的共享右侧上下文栏覆盖了 Minecraft 主画布；本任务没有切换或保存侧栏偏好。手机视口的组件布局与滚动由浏览器 DOM/实测宽度确认，右侧栏覆盖行为属于共享工作台布局，保留为未改动边界。
- 设置盘点沿用现有 Appearance/常规设置映射；没有新增设置或改变偏好。检查已执行 `pnpm run typecheck`、正式 Harness/Control Plane/Web 构建、运行树指纹、`git diff --check` 和 Impeccable detector；没有运行自动化测试。当前所选实例为停止状态，运行中的 Minecraft 实例及实体手机未覆盖。

## 实施与验收记录

- 状态：完成。样本采集、认证与校验、节点内存历史、总览串行刷新，以及正式 IAB 页面验收均已完成；未启动/停止 Minecraft 实例，也未改变用户设置。
