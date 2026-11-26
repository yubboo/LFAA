# 功能设计索引

按能力一篇，写清交互、Host/Client 契约、实施顺序与验收。状态以文档开头为准：**已实施** 的可以当现状读，**待评审 / 草案** 只代表方案。

## 会话与对话

- [助手回复过程](assistant-timeline.md)：正文流、活动分组、运行状态与历史回看。
- [会话形态：单聊 / 群聊 / Agents](agent-conversations.md)：左一三入口、调度与发言计划校验、群聊消息契约。**待评审**。
- [会话待处理提醒与通知中心](notifications.md)：待确认/待回答徽标、待处理接口、提示音与桌面通知。**已实施**。
- [左二栏会话分批展开](session-list-paging.md)：项目子会话与最近分组的分批展开契约。**已实施**。
- [会话项目绑定、输入区融合与操作记忆](project-session-binding.md)：工作/聊天模式项目入口融合、顶部与最近新会话绑定规则、刷新操作记忆。**实施中**。
- [对话轨迹](conversation-trace.md)：对话 / 轨迹两个页签的分工与数据来源。
- [聊天全文搜索](chat-search.md)：搜索范围、索引与结果定位。
- [会话模式与协作](session-mode-collaboration.md)：标准 / 深度协作等模式的契约与切换。

## Agent 与模型

- [Agent 会话工作区](agent-workspace.md)：项目绑定、生效目录与应用私有文件边界。
- [默认项目目录同步](project-folder-sync.md)：`<文档>/lfaa` 下新建/删除项目文件夹自动纳入或移出项目列表。**已实施**。
- [Agent 与模型解耦](agent-model-routing.md)：agent 实体、模型绑定与路由组。**待评审**。
- [Agent 记忆系统](agent-memory.md)
- [多 Agent 任务流水线](crew-tasks.md)：Task 契约、依赖顺序接力、交接验收与 run 级记忆。**C1–C4 已实施**。：结构化长期记忆、每轮模型提炼、BM25 召回与多 Agent 团队记忆。**P1–P2 已实施**。

## 右栏与工作台

- [右栏控制台、内置浏览器、后台任务与多 Agent 协作](right-panel-and-agents.md)：**已实施**。
- [内置浏览器双引擎与高清低延迟交互方案](builtin-browser.md)：原生直连 + 高清低延迟 CDP 协同视图、防滚动穿透与画质去雾。**已实施**。
- [Agent 自主操控右侧工作台与自测验收闭环方案](agent-workbench-autopilot.md)：全能跟随、多标签同步与「修改 → 浏览器实测/截图自检 → 循环修复 → 交付」闭环。**已实施**。
- [浏览器专属子智能体与性能根治方案](browser-subagent.md)：`mode="browser"` 隔离子智能体、思维链实时浏览器状态卡片、原生空闲后台防空跑与兜底零主线程解码。**已实施**。
- [IDE 化右侧工作台](right-workbench-ide.md)：Tab 栏、VS Code 只读代码、行内批注、全高浏览器。**已实施**。
- [变更审查](workbench-change-review.md)：工作台内的改动审阅流程。
- [Git 工作树会话隔离](worktree.md)：一个会话一个工作树的分支/目录契约、有效根解析与安全加固。**P0–P3b 已实施**。
- [键盘快捷键与右栏标签右键菜单](keyboard-shortcuts.md)：18 个真实动作的可改键注册表、设置中心快捷键页与标签关闭系列菜单。**已实施**。

## 内容与媒体

- [媒体生成](media-generation.md)：图像 / 视频 / 语音的生成链路与模型守卫。
- [资料库](library-media-hub.md)：资料库合并图像入口后的分类与素材接口。**已实施**。

## 平台与扩展

- [连接器（MCP + CLI）](connectors.md)：设置中心「集成 → 连接器」一页管理 MCP 服务器与声明式 CLI 工具；动作参数 schema、argv 执行、审批与超时边界。**P0 已实施**。
- [扩展中心](extensions.md)：技能与插件职责、公开契约、Cordis 生命周期。**草案**。
- [插件清单](plugin-inventory.md)：会话插件 ⊆ 全局插件、模式预设与扩充规划。
- [沙箱](sandbox.md)：模式语义、工具层强制边界。**当前不是进程级沙箱**。
- [本机接口鉴权](local-api-auth.md)：一次性令牌 + 同源校验。
- [桌面端](desktop.md)：Electron 壳、安装包与更新流程。

## 计划模式

- [Plan 模式](plan-mode.md)：交互、Host/Client 契约、实施顺序与验收。
- [任务清单](task-list.md)：`todo_write` / `todo_read` 现状与差距。调研结论，代码未开工。
