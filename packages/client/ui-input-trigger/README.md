# client/ui-input-trigger

本包呈现 AI Work 输入框的 `/` 命令与 `@` 应用/能力关联菜单，以及菜单专属样式。`ComposerTriggerMenu` 只接收当前触发器、候选项、选中索引、关联投影和选择回调；它不读取会话、不解析输入、不处理键盘、不保存草稿，也不执行关联写入。

输入触发识别、候选过滤/禁用投影、键盘导航、插入位置、模型选择动作及关联 API 调用继续由 `lfaa-client-ui-chat` 协调。关联数据从 Connection/Session 返回，能力目录由其现有 Owner 提供；本包不新增路由、设置、存储、权限或 Cordis 服务。

消费者：`packages/client/ui-chat/src/AiWorkChat.tsx`。构建输出写入仓库根 `dist/packages/client/ui-input-trigger/`。
