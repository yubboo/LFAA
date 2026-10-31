# Minecraft 总览实例入口收敛

<a id="lfaa-minecraft-overview-instance-entry-20261031"></a>

## 用户目标与可观察结果

- Minecraft 总览的当前实例卡只提供一个“实例概览”入口；不再在总览卡直接展示启动、停止/重启、终端、管理实例和打开实例文件等快捷按钮。
- 点击入口后进入这张卡所代表的同一实例的实例概览，使用现有 `getInstanceRoute(instanceId, "overview")`，不经过服务器列表或改选其他实例。
- 启停、终端和文件管理继续由实例内部的已有页面提供；当前总览没有实例时保持既有开服引导。

## 入口、Owner、设置与权限

- 唯一 UI Owner：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 的 Minecraft 总览实例卡；复用该包已公开/既有的导航回调及实例路由。
- 入口指向总览当前实例选择器所选实例 ID，权限与页面访问继续沿用现有 Minecraft 工作区，不新增服务端操作或权限绕行。
- 沿用 Ant Design 按钮与既有 Appearance 主题、颜色、字体、字号、对比度和共享布局令牌；不新增设置、不修改用户偏好。

## 实施与验收

- 修改前已核对入口 Owner、实例 ID 选择与现有 overview 路由；目标是只改总览卡的快捷操作区。
- 实施后运行 Minecraft UI 类型检查及正式 Web 构建/指纹，再用 ChatGPT 内置浏览器检查 `/games/minecraft` 的常用桌面与窄分栏；点击唯一入口并确认 URL/实例 ID 是对应卡片实例的 `/overview`。
- 不触发启动、停止、删除、文件管理或设置写入，不添加测试专用代码。

## 实施与验收记录

- 状态：完成。
- 实现：总览当前实例卡只保留“实例概览”主入口，使用所选实例 ID 调用既有 overview 路由；卡片不再提供启动、停止/重启、终端、实例文件或管理快捷操作。实例内部原有操作保持不变。
- 构建与源码检查：`pnpm run typecheck`、`pnpm run build:web`、目标文件 `git diff --check` 均通过；正式菜单完成 Web 重建并启动，`node scripts/runtime-build-state.mjs web` 返回 `[]`。Impeccable 机械检测 `src/MinecraftWorkspace.tsx` 返回 `[]`。未运行自动化测试。
- ChatGPT 内置浏览器：正式路由 `/games/minecraft`，桌面 1280×720 与窄分栏 760×900 可见唯一入口；点击后到 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/overview`，标题仍为卡片所示实例 `xiaoyu-e2e-paper1122-20261026`，确认实例 ID 一致。未触发实例操作。
- 手机/短屏边界：检查 390×844、320×568 时，打开的工作区右侧上下文栏占满可用宽度并遮住主画布，无法目视确认按钮布局；辅助功能树仍包含该入口。未收起/改写用户侧栏偏好。该限制属于当前工作区框架窄屏布局，未在本任务扩展范围内修改。
- 设置与性能：沿用 Appearance/Ant Design 现有外观令牌，无新增配置或偏好写入；只复用现有路由，无新增订阅、请求、计时器或动画。帧时间、触屏设备和屏幕阅读器未测。
