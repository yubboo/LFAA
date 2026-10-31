# Minecraft 任务卡片状态与操作区合并（2026-10-31）

<a id="lfaa-minecraft-task-status-alignment-20261031"></a>

## 用户目标与可观察结果

- 每条 Minecraft 任务卡片的状态徽标与“查看详情 / 删除”共用卡片底部的一行：徽标靠左，两个操作靠右并排。
- 标题、核心/实例信息、结果说明与时间留在原有位置，避免状态徽标改变相邻内容布局。
- 桌面、窄分栏及手机宽度下不产生横向溢出；空间不足时保持脚注组可读，操作仍可达。

## Owner、设置与边界

- 页面路由：`/games/minecraft/tasks`；唯一 UI Owner 是 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 内的 `TaskList`，布局由同包 `MinecraftWorkspace.css` 负责。
- 状态值来自真实 Minecraft 任务快照；本轮只调整任务卡片结构与布局，不改状态解析、任务记录或操作权限。
- 不新增或修改设置；主题、字体与字号、颜色和语义状态色沿用 Appearance 共享令牌；卡片动效继续沿用现有 `general.cardMotionEffect` 与减少动态效果映射，不改用户偏好。
- 浏览器验收未触发查看详情、任务取消/删除或实例启停；任务选择最终恢复为 0 项。

## 验收条件

- 桌面和窄分栏中，短状态与“查看详情 / 删除”处于卡片底部同一行，徽标靠左，按钮靠右且互相并排。
- 手机宽度下，包括“异常 · 结果未确认”在内的状态徽标仍与操作按钮同排；卡片和文档无横向溢出。
- 正式 Web 在 ChatGPT 内置浏览器实际路由验收；运行 Minecraft UI 包构建、客户端类型检查、Web 构建、运行指纹和 `git diff --check`。
- 不运行自动化测试（除非用户要求），不改变任务数据或用户偏好。未做帧时间或实体设备测量时如实记录。

## 实施与验收记录

- 状态：完成。任务徽标与操作按钮放入独立 `.minecraft-task-footer`；标题和信息区保持独立。宽度不足时由脚注容器换行，手机窄容器适当减小卡片内边距，让长异常状态也能与两个按钮保持同排。
- 设置：未新增或修改设置；沿用 Appearance 主题、字体/字号、颜色及语义状态色共享令牌；沿用当前卡片动效配置。
- 构建与静态检查：`pnpm --filter lfaa-client-ui-minecraft run build`、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm run build:web`、Impeccable detector、`git diff --check` 均通过；未运行自动化测试。
- 正式实页：`http://127.0.0.1:3000/games/minecraft/tasks`。ChatGPT 内置浏览器检查 1440×900、1050×640 和 390×844。桌面/窄分栏状态徽标与详情/删除按钮的纵坐标一致；390px 视口下长异常标签与按钮同排；文档宽度等于视口宽度，无横向溢出；任务选择为 0 项。
- 重启安全核对：每次重启前只读核对 SQLite 中两台实例均为 `stopped`，排队与执行中的 Minecraft 任务均为 0；只重启本轮本地 Web 入口，没有触发 Minecraft 生命周期或任务操作。验收结束后正式 Web 保持运行。
- 未测：帧时间、实体设备与屏幕阅读器；未运行自动化测试。
