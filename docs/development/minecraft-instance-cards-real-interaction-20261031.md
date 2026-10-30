# Minecraft 实例列表摘要卡片真实交互

<a id="lfaa-minecraft-instance-cards-real-interaction-20261031"></a>

## 用户目标与可观察结果

- 修复 Minecraft 实例列表顶部“全部实例、运行中、已停止、需核对”四张卡片看似可操作、实际不能点击的问题。
- 四张卡片用真实按钮语义，点击后筛选同一份控制端实例数据；选中状态与列表中的状态下拉同步。
- “需核对”统计和筛选只合并真实 `error` 与 `unknown` 实例；搜索继续与状态筛选共同生效。零结果时可通过现有清除入口恢复全部列表。
- 键盘可聚焦/触发，鼠标焦点、触屏点击和窄容器下均可辨认、可达；卡片只改变本页筛选，不发起节点操作。

## 入口、Owner 与数据

- 源码导航目标为 `/apps/minecraft/normal/instances`；当前正式 Web 在内置浏览器中的实际列表路由为 `/games/minecraft/instances`。
- 唯一界面 Owner 是 `packages/client/ui-minecraft`：`src/MinecraftWorkspace.tsx` 持有本地筛选状态并呈现按钮/列表，`src/MinecraftWorkspace.css` 唯一维护样式。
- 实例事实来自现有认证 `loadMinecraftInstances` 调用和 Minecraft 实例 Owner；摘要计数、状态和列表继续从同一个 `instances` 快照派生。本次不新建 API、缓存、请求或数据副本。
- 现有 `instanceStateFilter` 是本地 React 状态，默认 `all`；将新增的 `needs-review` 仅作为本地派生筛选值，不落库、不跨页面保留。

## 设置、权限与边界

- 不新增设置项或持久化字段，不修改用户偏好。继续使用 Settings/Workbench 映射的 `--settings-accent`、`--color-brand`、文本/边框/表面令牌与 Minecraft 表面透明度。
- 设置盘点：`general.cardMotionEffect` 默认 `fluid`、按账户持久化并由共享 UI Theme 消费；`appearance.theme` 默认 `system`，`accentColor` 默认 `#3457d5`，`backgrounds.minecraft` 默认 `none`，`updateSurfaceOpacity` 默认 `92`，`advanced.interfaceFontSize` 默认 `14`，`advanced.reducedMotion` 默认 `system`。本次选中/焦点使用现有令牌，不新增动效或动画循环；页面已有列表动效仍服从常规卡片动效、减少动态效果及系统偏好。
- 卡片点击只更新本地筛选状态，不调用控制端/Daemon，不触发启动、停止、归档、文件读写或权限请求。实例管理按钮仍由原 `ui-minecraft` 与认证 API/Permission Owner 按角色、节点和实例状态校验。
- 不改变账户可见范围、真实节点状态含义或 `error`/`unknown` 原始实例状态。

## 实施批次与验收

### 批次 1：摘要卡片接入真实筛选

- 使用原生 `<button>`、`aria-pressed` 和清晰的选中/hover/focus-visible 状态；保留摘要卡片的现有布局与数据密度。
- `all`、`running`、`stopped`、`needs-review` 均可点击，筛选下拉包含同一组“需核对”语义；搜索与筛选组合，清除入口重置搜索和状态。
- 定向回归覆盖筛选归类、按钮语义/同步状态、焦点样式与窄容器布局；运行 Client 类型检查、Minecraft UI 包构建和正式 Web 构建。
- 在 ChatGPT 内置浏览器实测正式 Web 实际路由 `/games/minecraft/instances`。验证卡片点击、选中状态、下拉同步、键盘操作和零结果恢复；不执行实例写操作。记录视口和截图证据及未覆盖边界。

## 性能、安全与未测范围

- 列表筛选继续通过现有 `useMemo` 基于内存快照计算；卡片点击不增加网络请求、订阅、计时器、观察器或无界数据。
- 保留服务端认证、授权和参数校验；本次仅增加只读 Client 交互。静态、构建和浏览器证据分开报告。
- 不新增连续动画，不做帧时间采样；若未采样真实帧时间，在交付记录为未测。

## 实施与验收记录

- 状态：完成。
- 实现：四张摘要卡片改为原生按钮，真实筛选 `instances` 快照；选中状态和列表下拉使用同一状态；“需核对”只匹配 `error`/`unknown`；筛选无结果时仍展示工具栏与清除入口。
- 自动检查：卡片定向回归 3/3、Minecraft UI 包构建、Client 类型检查与根 `dist/` Web 构建通过；菜单修复后的正式 Web 构建已重建成功。Impeccable detector 返回 `[]`；差异空白检查通过。
- 正式服务：在 `/api/health` 确认为健康后，将正式 Web 重建并重启到 `http://127.0.0.1:3000`，使用真实 admin 会话验收。
- 内置浏览器：实际路由 `/games/minecraft/instances`，视口 1280×720、390×844 与 320×640。文档宽度均等于视口宽度；320×640 的应用内容区为 272×581，纵向内容高度 940px，可滚动到实例操作。390px 下四张卡为两列，320px 下页面滚动时卡片与实例详情保持可读。
- 实际交互：点击“已停止”保留真实 `1.21.1` 实例；点击“需核对”显示零结果与“清除筛选条件”；清除恢复全部列表。键盘 Space 可激活“运行中”筛选。筛选下拉同步仍由原代码合同与定向回归覆盖；本次没有在实页输入搜索。
- 未测：真实帧时间及真实手机硬件；不以浏览器尺寸检查代替设备验收。
- 设置与数据边界：使用既有 `general.cardMotionEffect` 与 Appearance 令牌；没有新增配置或改动账户偏好、持久化数据。实页只操作筛选，没有启动、停止、删除或写入实例。
