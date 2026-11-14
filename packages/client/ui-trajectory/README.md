# AI 执行轨迹界面

`lfaa-client-ui-trajectory` 展示模型公开的执行活动、真实状态和按服务端边界切分的回复正文；不读取或呈现隐藏推理。

- `src/response-timeline.ts` 只把 Connection/Session 已提供的消息片段与活动落点组合成可显示块，不按标点或关键词推断轨迹。
- `src/AiExecutionTrajectory.tsx` 负责轨迹块、工具组、状态提示及交互内容插槽的布局；活动详情和问题/审批由 `ui-chat` 传入现有 Owner 视图。
- `src/activity-duration.ts` 从服务端活动时间计算状态摘要；`src/activity-clock.ts` 仅在耗时订阅存在时启动共享秒级计时器，并在最后一个消费者卸载后清理。
- 样式保留既有工作台 Appearance 令牌和类名，集中在 `src/trajectory.css`。没有增加设置、存储、请求、运行权限或 Cordis 服务。
- 当前由 `packages/client/ui-chat` 静态依赖。聊天仍拥有 Session/Run 请求、AI Markdown、反馈/审批/澄清回调、文件变更摘要和回复组合。

状态：源码已归位并接入聊天静态模块；构建、Client 类型/Gate 与桌面实页范围记录在全包整理合同中。
