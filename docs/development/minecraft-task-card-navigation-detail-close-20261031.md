# Minecraft 总览任务卡片跳转与详情关闭点击恢复（2026-10-31）

<a id="lfaa-minecraft-task-card-navigation-detail-close-20261031"></a>

## 用户目标与可观察结果

- Minecraft 总览的“最近任务”区域中，点击任一任务卡片主体后打开任务列表 `/games/minecraft/tasks`；现有“查看全部”入口保持原行为，卡片内真实操作仍独立执行。
- 在任务列表打开并关闭“查看详情”后，任务页与工作区其他控件继续可点击；详情读取尚未完成时关闭，应取消这次只读请求。
- 不改变真实任务状态、任务筛选、批量选择与删除、取消操作、实例状态或任务详情内容。

## Owner、设置与边界

- 正式入口：Minecraft 总览 `/games/minecraft/overview`（兼容总览路径 `/games/minecraft`）与任务列表 `/games/minecraft/tasks`。
- 唯一界面 Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 中的总览 `TaskList` 调用、卡片交互与详情打开/关闭状态；页面弹层几何和指针命中由 `packages/client/ui-minecraft/src/MinecraftWorkspace.css` 管理。`onNavigate` 由现有工作区导航链提供并负责切换路由。
- 真实任务和详情继续由 Minecraft 任务快照及已有认证 `loadMinecraftTaskDetails` API 提供；详情关闭仅中止未完成的读取，不写入任务/实例数据。
- 设置盘点：本次不新增、不改写设置；继续消费主题/外观共享令牌及任务卡已有 `general.cardMotionEffect` / `appearance.advanced.reducedMotion` 映射。卡片跳转是业务导航，详情弹层收起是交互清理，不增加用户偏好。
- 数据和权限：只读浏览总览、任务与任务详情；不点击取消、删除、批量删除或 Minecraft 实例启停，不变更账号权限和用户偏好。保留现有任务读取认证与授权路径。

## 复现证据

- 正式 Web `/games/minecraft/tasks`（内置浏览器 1280×720）：打开任务详情并关闭后，`.minecraft-task-detail-modal-root` 仍是 `position:absolute; inset:0; z-index:1000; pointer-events:auto`；目标刷新按钮位置的 `document.elementFromPoint` 命中该透明根节点，任务状态筛选点击也没有改变列表。这解释了页面看似卡死的现象。
- 总览 `TaskList` 未传 `onOpenDetails` 或其他卡片动作；其整卡按钮因此只有空的可选回调，点击没有导航。

## 分批实现与验收

### 批次 A：总览任务卡片导航

- 给总览 `TaskList` 传入整卡导航回调，并同步屏幕阅读器操作名称；任务页保留其现有详情/选择交互和卡片内操作。
- 即时验证：Minecraft UI 包构建、Client 类型检查；正式 Web `/games/minecraft/overview` 桌面和窄分栏下点卡片后到达 `/games/minecraft/tasks`；以键盘焦点和 Enter 验证整卡按钮可达；任务页既有详情入口保持不变。
- 批次 A 结果：Minecraft UI 包构建、Client 类型检查、正式 Web 构建通过；Web 指纹为 `[]`。内置浏览器实测 `/games/minecraft/overview` 的 4 张最近任务卡，在 1280×720 与 1050×640 点击均进入 `/games/minecraft/tasks`；1050×640 文档宽度等于视口宽度，没有横向溢出。尚未做键盘 Enter 专项验收。
- 最终构建实页复核：正式入口 `/games/minecraft/overview`，IAB 879×849；点击最近任务卡主体后到达 `/games/minecraft/tasks`，实际显示 16 条记录；此前的一条已选任务保持为一条。键盘 Enter 专项仍未测。

### 批次 B：详情关闭后恢复页面点击

- 让关闭状态的详情弹层根节点不接收指针，打开状态的蒙层和对话框仍正常接收；关闭时中止未完成的详情读取。
- 即时验证：Minecraft UI 包构建、Client 类型检查；正式 Web `/games/minecraft/tasks` 打开并关闭详情后，用真实指针点击刷新/筛选控件并检查页面状态确实响应，同时确认任务详情打开、滚动与关闭路径正常。用宽视口与窄工作区检查遮挡和内容可达。
- 批次 B 结果：UI 包构建与 Client 类型检查通过。最新正式 Web 的 IAB `/games/minecraft/tasks`（879×849）打开真实任务详情并关闭后，弹层根节点计算样式为 `pointer-events:none`；随后用页面筛选按钮把列表由 16 条筛到 14 条，再清除筛选恢复 16 条，确认页面恢复点击。关闭详情后选中任务数仍为 1。未执行删除、取消或实例操作。

## 验证记录

- 状态：完成。
- 自动化测试：按本轮协作要求不新增、不运行自动化测试；源码检查、构建和真实内置浏览器交互结果分开记录。
- 设置：未新增或修改设置；页面继续沿用主题/外观共享令牌、`general.cardMotionEffect` 与 `appearance.advanced.reducedMotion`。
- 帧时间与实体手机设备：未实测；键盘 Enter 专项也未验收。
- 正式运行：Web 与 Control Plane 构建通过，重启后 Web/Host 运行指纹为 `[]`，`/api/health` 返回 200。重启前核对 2 个实例均停止、任务排队与执行均为 0；重启后 IAB 再次确认相同实例/任务状态。随后最终检查发现共享工作区有新的运行时源变化，当前指纹为 Web `["host","web"]`、Host `["host"]`，健康接口仍返回 200。没有再次构建/重启，以免覆盖并行工作或再次中断其他会话；当前页面验收基于刚才指纹一致的服务版本。停止服务时日志还显示终端与文件操作活动，终端会话是否自动重连未实测。
