# 用户澄清问题界面

`lfaa-client-ui-user-questions` 呈现 Agent 提出的澄清问题、选项、答案输入和已记录结果；问题与答案的运行状态由现有聊天/Session Owner 持有。

- 稳定入口：`src/index.ts`；当前由 `packages/client/ui-chat` 的时间线与待处理交互视图静态引用，不单独注册路由、Profile、Bundle 或运行时能力。
- 视图：`UserQuestionPrompt` 呈现待回答问题和受控答案输入；`UserQuestionActivityRecord` 呈现历史回答/跳过结果。问题专属选项和回复布局样式归 `user-question.css`，聊天组合层持有容器宽度及回复位置。
- 数据与行为：问题来自 Connection/Session 活动记录；提交和跳过只交给 `ui-chat` 既有回调，由 Agent Loop/Session 处理答案和运行状态。
- 设置/权限：不新增设置、持久化、授权或执行路径。
- 运行状态：源码实现并随 `ui-chat` 静态加载；本批直接构建、Client 类型检查和工作区 Gate 结果见全包整理合同。实页交互与桌面宿主尚未重新验收。
