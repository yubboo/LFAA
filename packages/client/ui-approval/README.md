# 审批界面

`lfaa-client-ui-approval` 呈现待审批请求和已记录的决定；审批授权与真实决定仍由原 Permission/Agent Loop Owner 执行。

- 稳定入口：`src/index.ts`；当前由 `packages/client/ui-chat` 的聊天消息与待处理交互视图静态引用，不单独注册路由、Profile、Bundle 或运行时审批能力。
- 视图：`ApprovalRequestCard` 显示当前等待用户处理的审批请求；`ApprovalActivityRecord` 显示时间线中已记录的决定及原活动详情。专属样式归 `approval.css`，输入区共用的交互卡片容器仍由 `ui-chat` 控制。
- 权限与数据：动作只派发给聊天既有回调，服务端 Permission Owner 仍校验审批；活动记录仍来自 Connection/Session Owner，本包不创建决策或持久化。
- 设置：不新增设置、缓存或授权模式。
- 运行状态：源码实现并随 `ui-chat` 静态加载；本批直接构建、Client 类型检查和工作区 Gate 结果见全包整理合同。实页交互与桌面宿主尚未重新验收。
