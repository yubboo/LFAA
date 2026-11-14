# 消息反馈界面

`lfaa-client-ui-message-feedback` 是消息评价控件和受控反馈对话框的 UI Owner。它只展示正/负反馈入口、已提交状态、原因选项和补充说明表单，并通过 props 把用户操作交回聊天协调层。

- 稳定入口：`src/index.ts`；当前消费者为 `packages/client/ui-chat`，从聊天动态模块加载时随 `ui-chat` workspace dependency 一同打包，不单独注册 Cordis 服务、路由或 Profile/Bundle 能力。
- 展示组件：`src/MessageFeedbackControls.tsx` 呈现消息级按钮/已反馈状态；`src/MessageFeedbackDialog.tsx` 呈现受控对话框；`src/feedback-reasons.ts` 管理界面理由选项；`src/message-feedback.css` 只持有反馈控件样式。
- 类型边界：`src/message-feedback-types.ts` 从 Connection 的消息反馈合同派生反馈评级，定义 UI props。组件不读取会话、不调用认证 API、不保存记录，也不拥有审批授权。
- 业务 Owner：聊天当前 Session、忙碌/错误状态及 `submitAiMessageFeedback` 调用由 `ui-chat` 协调；认证 REST 归 `client/connection`，反馈记录和 Session 事务归 `core/session`。
- 设置：无专属设置；复用聊天现有主题令牌，不新增持久化或权限。
- 运行状态：源码实现并由 `ui-chat` 作为静态组件依赖消费；本批通过包构建、Client 类型检查和工作区 Gate，具体运行/桌面和产品行为未因本包新增而单独验收。
