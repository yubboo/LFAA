# 计划模式界面

`lfaa-client-ui-plan` 只呈现聊天输入区的计划模式状态横幅，并把退出/批准动作交回当前聊天协调层。

- 稳定入口：`src/index.ts`；当前由 `packages/client/ui-chat` 静态引用，不独立注册 Cordis 服务、路由、Profile 或 Bundle 能力。
- 视图：`PlanModeBanner.tsx` 消费只读 `active/busy/canApprove` 状态和两个动作回调；专属外观由 `plan-mode.css` 管理。Wallpaper Engine 的聊天表面融合由 `ui-chat` 外围样式适配。
- 权威数据与行为：当前 Session 的计划模式状态由 `core/session` 持久化；模式切换、发送批准文本由 `ui-chat` 调用既有 API；模型计划工具与只读/执行限制由 `core/agent-loop` 校验。
- 设置/权限：不新增设置、存储或审批路径。计划讨论中的只读限制由 Agent Loop 执行，不依赖 UI 禁用状态。
- 运行状态：源码实现并作为聊天静态依赖消费；本批通过包构建、Client 类型检查及工作区 Gate；窄短视口、桌面宿主及真实 Run 行为未因本包单独验收。
