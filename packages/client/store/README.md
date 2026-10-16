# Client Store

Web/Desktop 共用的轻量浏览器状态持久化包，提供账户隔离的聊天草稿、侧栏置顶会话 ID、滚动位置及有界快照缓存。它只保存 UI 状态，不替代 Session、Settings、Workspace 或权限 Owner。

侧栏置顶由 `src/ai-session-pins.ts` 保存到当前浏览器的本地存储，按账户 ID 隔离，最多保留 200 个会话 ID；它不会修改服务端会话数据。聊天草稿继续由 `src/ai-work-drafts.ts` 按账户和 App 隔离。持久化异常按共享 helper 的规则降级，不阻断交互。

构建输出位于仓库根 `dist/packages/client/store/`。
