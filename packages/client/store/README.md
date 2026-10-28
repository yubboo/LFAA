# Client Store

Web/Desktop 共用的轻量浏览器状态持久化包，提供账户隔离的聊天草稿、侧栏置顶会话 ID、AI Work 侧栏开合偏好、滚动位置及有界快照缓存。它只保存 UI 状态，不替代 Session、Settings、Workspace 或权限 Owner。

侧栏置顶由 `src/ai-session-pins.ts` 保存到当前浏览器的本地存储，按账户 ID 隔离，最多保留 200 个会话 ID；它不会修改服务端会话数据。聊天草稿由 `src/ai-work-drafts.ts` 按账户和 App 隔离。置顶、项目、最近分区的开合、每项目折叠状态与分页数量由 `src/ai-work-sidebar.ts` 按账户和 App 隔离，最多保留 400 个分组偏好及每组 200 条显示量；均不写入服务端会话或项目数据。AI Work 按账户、App 和会话保存消息区滚动位置及“跟随最新消息”状态；恢复时按当前内容高度重新贴底，避免旧像素位置把原本在底部的会话恢复到中间。持久化异常按共享 helper 的规则降级，不阻断交互。

构建输出位于仓库根 `dist/packages/client/store/`。
