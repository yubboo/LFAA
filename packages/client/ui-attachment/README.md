# client/ui-attachment

本包负责 AI Work Composer 的附件选择控件、待发送附件预览列表和对应样式。

- 稳定入口：`src/index.ts`；当前由 `packages/client/ui-chat/src/AiWorkChat.tsx` 静态引用，不注册独立路由、Profile、Bundle 或运行时服务。
- `ComposerAttachmentControl` 呈现选取入口、忙碌/禁用状态及错误提示；文件类型/大小限制、读取与编码、上传请求仍由 `ui-chat` 和 Connection Owner 承担。
- `PendingAttachmentList` 只呈现聊天层传入的附件名称、预览地址和移除回调，不读取附件、会话或账户数据，也不写入 Session。
- 不新增设置、缓存、持久化、API、授权策略或用户数据；构建输出位于仓库根 `dist/packages/client/ui-attachment/`。
- 运行状态：源码实现并由 `ui-chat` 静态加载；包构建、类型与实页检查见全包整理合同 UI-B-4。
