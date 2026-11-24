# 功能设计索引

按能力一篇，写清交互、Host/Client 契约、实施顺序与验收。状态以文档开头为准：**已实施** 的可以当现状读，**待评审 / 草案** 只代表方案。

## 会话与对话

- [助手回复过程](assistant-timeline.md)：正文流、活动分组、运行状态与历史回看。
- [会话形态：单聊 / 群聊 / Agents](agent-conversations.md)：左一三入口、调度与发言计划校验、群聊消息契约。**待评审**。
- [会话待处理提醒与通知中心](notifications.md)：待确认/待回答徽标、待处理接口、提示音与桌面通知。**已实施**。
- [左二栏会话分批展开](session-list-paging.md)：项目子会话与最近分组的分批展开契约。**已实施**。
- [对话轨迹](conversation-trace.md)：对话 / 轨迹两个页签的分工与数据来源。
- [聊天全文搜索](chat-search.md)：搜索范围、索引与结果定位。
- [会话模式与协作](session-mode-collaboration.md)：标准 / 深度协作等模式的契约与切换。

## Agent 与模型

- [Agent 会话工作区](agent-workspace.md)：项目绑定、生效目录与应用私有文件边界。
- [Agent 与模型解耦](agent-model-routing.md)：agent 实体、模型绑定与路由组。**待评审**。

## 右栏与工作台

- [右栏控制台、内置浏览器、后台任务与多 Agent 协作](right-panel-and-agents.md)：**已实施**。
- [IDE 化右侧工作台](right-workbench-ide.md)：Tab 栏、VS Code 只读代码、行内批注、全高浏览器。**已实施**。
- [变更审查](workbench-change-review.md)：工作台内的改动审阅流程。
- [Git 工作树会话隔离](worktree.md)：一个会话一个工作树的分支/目录契约、有效根解析与安全加固。**P0–P3b 已实施**。

## 内容与媒体

- [媒体生成](media-generation.md)：图像 / 视频 / 语音的生成链路与模型守卫。
- [资料库](library-media-hub.md)：资料库合并图像入口后的分类与素材接口。**已实施**。

## 平台与扩展

- [扩展中心](extensions.md)：技能与插件职责、公开契约、Cordis 生命周期。**草案**。
- [插件清单](plugin-inventory.md)：会话插件 ⊆ 全局插件、模式预设与扩充规划。
- [沙箱](sandbox.md)：模式语义、工具层强制边界。**当前不是进程级沙箱**。
- [本机接口鉴权](local-api-auth.md)：一次性令牌 + 同源校验。
- [桌面端](desktop.md)：Electron 壳、安装包与更新流程。

## 计划模式

- [Plan 模式](plan-mode.md)：交互、Host/Client 契约、实施顺序与验收。
- [任务清单](task-list.md)：`todo_write` / `todo_read` 现状与差距。调研结论，代码未开工。