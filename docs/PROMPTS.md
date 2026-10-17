# LFAA 提示词与任务合同

本文件登记当前任务的目标、验收条件和修改边界。新任务应从任务索引选择与本轮目标匹配的合同；已完成任务下的合同、实现记录和验证结果是该任务完成时的历史证据，不自动成为当前能力或当前规则。跨任务的当前规则以根 `AGENTS.md`、`开发规范.md` 为准；能力现状以 `docs/系统总体架构.md`、`docs/开发计划.md` 和当前实现为准。任务合同优先于旧阶段草案；实际代码与架构文档需保持一致。

历史合同分档保存在 `archive/contracts/`，保留原始实施证据，索引可按编号定位。跨模块新任务必须先登记在本文件，完成后按分类归档；未实测状态不得改写为已验收。

<a id="01-插件化架构-20261017"></a>

## 任务索引

| 编号 | 任务 | 状态 | 合同 |
|---|---|---|---|
| 01-缺口修复-20261008 | 缺口修复 | 见合同 | [本轮合同](#lfaa-remaining-gap-repair-20261008收敛四项明确的代码缺口) |
| 02-全仓审查整改-20261008 | 全仓审查整改 | 见合同 | [本轮合同](#lfaa-workspace-audit-repair-20261008全仓审查风险修复与文档治理) |
| 03-MCP出站与会话分页-20261008 | MCP出站与会话分页 | 见合同 | [本轮合同](#lfaa-mcp-egress-session-paging-repair-20261008mcp-出站隔离与-session-分页单次异步校验) |
| 04-本机MCP电脑操作-20261008 | 本机MCP电脑操作 | 见合同 | [本轮合同](#lfaa-agent-stdio-computer-use-20261008模型驱动-agent-本机-mcp-与-computer-use-执行链) |
| 05-Agent通用能力-20261009 | 对照指定 DSH 包补全通用能力发现、启用审批、实时工具目录、模型协议、Skill/MCP 资源、会话查询、SDK 调用链及对话工作流自动化入口 | 聊天工作流入口、Workflow Owner 和 Minecraft Agent 节点闭环已接入；定向回归、Host 类型检查、工具包构建和工作区检查通过；真实 Provider、Daemon 与浏览器流程待验 | [当前合同](#lfaa-general-agent-capabilities-20261009) |
| 06-流式光标闪烁-20261009 | 移除 AI Work 主聊天流式回复末尾的光标 | 源码已移除；Web 产物已重建，当前服务可读到无光标样式的新哈希 CSS | [历史实施合同](#lfaa-ai-work-stream-caret-flicker-20261009) |
| 07-流式输出修复-20261009 | 修复 Web 产物残留光标、Agent 重复派发失败工具，并对齐本轮 5 项失败回归 | 已完成：279 项测试通过、1 项跳过；Web/Control Plane 构建、类型和工作区检查通过；真实 Provider/浏览器渲染待验 | [本轮合同](#lfaa-ai-work-stream-repair-20261009) |
| 08-Agent文件操作-20261009 | 补齐模型驱动 Agent 在所有 App 中的通用文件查询/读取、新建、更新/修复和删除闭环 | 已实现（Daemon 与完整隔离 Harness、跨 App 工具登记、类型检查、根构建、工作区检查通过；真实节点文件操作待验） | [本轮合同](#lfaa-agent-file-crud-20261009) |
| 09-回复流程交接-20261009 | 防止本地推理前置阶段阻断 Provider 首次请求，并让准备/运行失败可诊断 | 已实现（Harness Skill 按需调用、准备错误留痕、SSE 流式回归、类型检查、根构建与工作区检查通过；真实 Provider/浏览器待验） | [本轮合同](#lfaa-agent-reply-handoff-20261009) |
| 10-回复送达修复-20261009 | 修复输出 token/旧请求预算/旧 Daemon schema 组合导致 Agent 只思考或失败、没有最终答复 | 源码、回归与构建通过；当前服务未重启，真实 Provider/浏览器待验 | [本轮合同](#lfaa-agent-response-delivery-20261009) |
| 11-本机程序启动-20261009 | 为 Windows 本机电脑能力增加用户明确提供 `.exe` 绝对路径的受控启动入口 | 已实现（路径/安全边界回归与当前根构建通过；真实桌面启动待验） | [当前合同](#lfaa-local-executable-path-launch-20261009) |
| 12-本机应用识别-20261009 | 让模型按自然语言理解应用目标、发现已登记和便携应用，并让“替我审批”按同范围两次批准自动记忆 | 已实现（定向回归、v46→v48 迁移、类型检查和根构建通过；真实 Provider/桌面待验） | [当前合同](#lfaa-local-app-intent-discovery-20261009) |
| 13-本机电脑操作-20261009 | 补全 AI Work 本机电脑任务链与 Windows 应用发现回退 | 已实现（类型检查、根构建、工作区检查通过；真实 Provider/桌面交互待验） | [当前合同](#lfaa-local-computer-agent-20261009) |
| 14-Web电脑操控-20261009 | 将现有 Windows CUA 适配器接入仅回环的本机 Web Profile，拒绝远程 Web 暴露 | 实施中 | [当前合同](#lfaa-local-web-computer-use-20261009) |
| 15-Daemon日志降噪-20261009 | 将后台会话复核和 EasyTier 安装空轮询从终端 info 降到 debug | 类型检查、根构建、Web 指纹与差异检查通过；重启后真实终端待验 | [当前合同](#lfaa-quiet-daemon-poll-logs-20261009) |
| 16-壁纸实时切换-20261009 | 修复工作台遮挡并让 DSH 场景/视频点选后无需刷新实时切换 | Edge 视频画布首帧切层回归和 Cordis 生命周期 2/2 通过；Plugin Manager、Control Plane、Web 构建通过；整文件另有 1 项 DSH Locale 通知断言失败；真实 Edge 点选/帧时间未验，须重启载入 adapter-8 | [当前合同](#lfaa-wallpaper-engine-live-selection-20261009) |
| 17-壁纸请求日志-20261009 | 精确分级 DSH Wallpaper Engine 成功请求和预期资源未命中，保留真实请求故障日志 | HTTP 回归 6/6、Runtime 适配/Carrier 定向回归 2/2；Host WebServer、Plugin Manager、Control Plane、Web 构建通过。整文件仍有既存 Locale 断言失败；真实服务重启与浏览器验收待做，client-diag 4.547 秒延迟另行排查 | [当前合同](#lfaa-wallpaper-request-log-noise-20261009) |
| 18-Web启动预检-20261009 | Web启动预检 | 见合同 | [本轮合同](#lfaa-web-menu-startup-ps51-20261009修复-windows-工作台-web-启动预检) |
| 19-写作本地存储-20261010 | 将 Writing 作品内容迁移到按账户隔离的本机 Markdown 文件，并保留 SQLite 关系/状态元数据 | 已实现；本地文件/迁移、提案、角色、目录、分析、DeepWrite 定向回归 6/6，Writing 包构建通过；浏览器/Provider/桌面/运行中服务未验 | [本轮合同](#lfaa-writing-local-files-20261010) |
| 20-漫剧画布-20261010 | 漫剧画布 | 见合同 | [本轮合同](#lfaa-ai-video-canvas-mvp-20261010) |
| 21-漫剧项目文件-20261010 | 将 AI 漫剧画布改为每项目本机文件夹并安全迁移旧聚合 JSON | 已实现；Owner/API 回归 2/2、Owner/Controller 构建和 CLI 类型检查通过；`check:workspace` 被 Writing 未声明内部依赖阻断；浏览器写入、服务加载、Desktop、Provider、素材/白模和帧时间未验 | [本轮合同](#lfaa-ai-video-local-project-files-20261010) |
| 22-工具调用效率-20261010 | 减少本机应用启动的模型往返与重复/宽范围搜索，不加 Token 硬封顶 | 本轮提示合同回归 1/1、Agent Loop/computer-use/Control Plane/Web 构建、类型检查、180 包工作区检查和差异检查通过；Agent Runtime/computer-use 集成测试受 Writing 本地文件表初始化错误阻断；Provider/桌面未测 | [本轮合同](#lfaa-ai-work-tool-efficiency-20261010) |
| 23-Provider额度提示-20261010 | Provider额度提示 | 见合同 | [本轮合同](#lfaa-provider-402-quota-error-20261010) |
| 24-运行过程可见-20261010 | 显示整轮处理时长，并让 AI Work 回复过程在运行时可见、完成后可折叠查看 | 已实现；Agent/耗时/聊天回归 35/35，Agent 与聊天包、Control Plane、Web 构建、类型及 178 包工作区检查通过；浏览器/Provider/帧时间/服务加载未测 | [本轮合同](#lfaa-ai-work-process-disclosure-20261010) |
| 25-回复布局-20261010 | 修正 AI Work 回复排版：时长栏与下方分隔线、正文、当前动作行及默认收起的活动轨迹 | 本轮 UI 定向回归 36/36、聊天包/Web/Control Plane 构建、客户端/Host 类型检查、180 包工作区检查与差异检查通过；真实浏览器/帧时间、Provider/运行中服务未测 | [本轮合同](#lfaa-ai-work-reply-layout-20261010) |
| 26-文件改动审阅-20261010 | 在 AI Work 工作轨迹展示模型真实文件 CRUD 结果，并跳转到内置 Git 差异与编辑器审阅 | 已实现；定向回归 40/40、类型检查、178 包工作区检查、受影响包/Control Plane/Web 构建及差异检查通过；浏览器/Provider/Daemon/帧时间/服务加载未测 | [本轮合同](#lfaa-ai-work-file-change-review-20261010) |
| 27-断线恢复限制-20261010 | SSE 断流后恢复跟随同一 Run，并为 Agent 请求/工具循环设置有限预算及成功写操作防重 | 已实现；Agent 1/1、Client 25/25，受影响包/入口构建、类型检查、178 包工作区检查与差异检查通过；真实 Provider/浏览器未测 | [本轮合同](#lfaa-ai-run-reconnect-loop-bounds-20261010) |
| 28-运行暂停继续-20261010 | 让 AI Work 当前 Run 可在安全检查点暂停并继续，不终止服务、不重放已派发工具 | 已实现；定向回归、类型检查、受影响包/Control Plane/Web 构建、178 包工作区检查与差异检查通过；真实 Provider、浏览器/桌面和进程重启恢复未测 | [本轮合同](#lfaa-ai-run-pause-resume-20261010) |
| 29-模型与节点边界-20261010 | 保持 Provider 模型为决策核心；本机应用不得误走节点 Shell，通用工作区不暴露游戏 Daemon Shell | 进行中 | [本轮合同](#lfaa-agent-model-daemon-boundary-20261010) |
| 30-对话内澄清-20261010 | 将澄清问题与回答内嵌到发起问题的助手消息，并保持为工具往返上下文 | 已实现；本次折叠记录调整后 Client 定向回归 23/23、聊天包/Web 构建、类型检查、178 包工作区检查与差异检查通过；真实 Provider/浏览器交互未测 | [本轮合同](#lfaa-ai-work-clarification-inline-20261010) |
| 31-流式渲染稳定-20261010 | 消除 AI Work 中央聊天增量 Markdown 重解析导致的流式闪烁与抖动 | 已实现；相关回归 22/22、聊天包/Web 构建、客户端/Host 类型检查、178 包工作区检查和产物光标核对通过；真实 Provider 帧时间未测 | [本轮合同](#lfaa-ai-work-stream-render-stability-20261010) |
| 32-流式连接修复-20261010 | 修复 AI Work 的 SSE 将请求体正常完成误判为回复连接关闭，造成流式回复丢失 | 源码与 Express/SSE 回归通过；API/Control Plane 构建、类型、工作区及差异检查通过；当前服务未重启，真实 Provider/浏览器待验 | [本轮合同](#lfaa-ai-work-sse-request-close-20261010) |
| 33-漫剧核心能力-20261011 | 以 LFAA 原生 Owner 分阶段接入 Nomi 核心创作能力；覆盖本机创作资料、aivideo Agent 工具、图片/视频生成、媒体库/时间线/导出及白模/取景器 | 阶段 A–E 源码接入；本轮修复接口限制缺失导致的渲染崩溃并通过构建/Gate；运行服务重启受本机执行策略阻止，AI 漫剧实时可用性仍未验 | [本轮合同](#lfaa-ai-video-nomi-core-parity-20261011) |
| 34-漫剧图片生成-20261011 | 接入 OpenAI Images 与豆包 Seedream 真实图像生成，并将图片保存到漫剧项目本地 assets | 已接入；8 个直接相关包构建、Web/Control Plane 构建、客户端/Host 类型检查、180 包工作区 Gate 与差异检查通过；真实 Provider、运行服务、浏览器/桌面未验 | [本轮合同](#lfaa-ai-video-image-generation-20261011) |
| 35-工作区响应布局-20261011 | 修复 Compact/Mobile 右栏 Dock、拖动/Overlay 回退和底部终端布局 | 已完成（回归 6/6、DockKit/Web 构建、类型与 180 包检查通过；320/390/530/754/850px 实际网页及拖拽验收通过；未测真触屏和帧时间） | [合同](#lfaa-ui-workbench-responsive-panels-20261011) |
| 36-空闲渐隐效果-20261011 | 让 AI Work 空闲回复强度 100% 完全淡出，并平滑虚化/恢复，同时遵循减少动态效果 | 已实现；源码 Vite 页 100%/1 分钟浏览器验收、定向回归 3/3、ui-chat/ui-layout/ui-settings 构建、类型、180 包工作区 Gate 和差异检查通过；3000 当前 Web 产物未更新，帧时间未测 | [本轮合同](#lfaa-ai-work-idle-fade-transition-20261011) |
| 37-会话分支来源-20261011 | 会话分支来源 | 见合同 | [本轮合同](#lfaa-ai-work-session-branch-lineage-20261011) |
| 38-分支对话记忆-20261011 | 从已完成回答创建空白新聊天，并继承有界的模型生成对话记忆；修正来源条与居中弹窗 | 源码回归 15/15、六个受影响包及 Control Plane/Web 构建、TypeScript、180 包工作区检查通过；窄屏浏览器来源条位置/居中弹窗通过；重启命令被执行策略拒绝，新后端与真实 Provider 分支语义未验 | [本轮合同](#lfaa-ai-work-session-branch-memory-20261011) |
| 39-响应式应用导航-20261011 | 响应式下二级导航推动中间区并为聊天内容保留左右间距 | 已完成（回归 2/2、DockKit/工作区/Web 构建、工作区 Gate 通过；约 750px 浏览器目视确认；488/460px 边界仅回归验证） | [合同](#lfaa-ui-responsive-app-nav-20261011) |
| 40-左栏拖动边界-20261011 | 响应式左导航沿用大屏的分隔条位置和拖动行为，并按中间栏宽度收紧窄屏留白 | 已修正（定向回归 4/4、DockKit/Web 构建、180 包检查及 320/390/530/626/753/754px 浏览器开合和三栏边界验收通过；未测真触屏和帧时间） | [合同](#lfaa-ui-responsive-left-resize-handle-20261011) |
| 41-输入框响应宽度-20261011 | 修复三栏响应式下 AI Work 提问输入框超出中间聊天列 | 已修复（定向回归 1/1、ui-chat/Web 构建、类型检查、180 包工作区检查及 755/530/390/320px 浏览器边界验证通过；未测真触屏和帧时间） | [合同](#lfaa-ai-work-composer-responsive-width-20261011) |
| 42-回复过程时间线-20261011 | 回复过程时间线 | 见合同 | [本轮合同](#lfaa-ai-work-response-timeline-20261011) |
| 43-DSH工具可用性-20261011 | DSH工具可用性 | 见合同 | [本轮合同](#lfaa-agent-dsh-usability-20261011) |
| 44-Agent响应速度-20261011 | Agent响应速度 | 见合同 | [本轮合同](#lfaa-agent-response-latency-20261011) |
| 45-Agent游戏存储-20261013 | Agent游戏存储 | 见合同 | [本轮合同](#lfaa-agent-minecraft-storage-repair-20261013) |
| 46-项目存储位置-20261013 | 接通游戏、日志、写作、漫剧的默认/自定义存储路径，并让统一文件管理发现本机全部磁盘 | 本轮实施中；覆盖范围与验收见新合同 | [当前合同](#lfaa-project-storage-locations-20261013) |
| 47-项目存储设置-20261013 | 将 Writing 项目 Markdown 路径与统一本机数据根目录设置接入“项目与存储” | 已实现；目录/迁移与 Writing 回归 3/3、设置/Writing 包构建、Web 类型检查/构建通过；真实浏览器、移动/短屏与服务重载未验 | [本轮合同](#lfaa-project-storage-settings-20261013) |
| 48-系统文件服务-20261013 | 系统文件库独立于游戏 Daemon，应用 Owner 挂载账户资源，节点目录作为可选来源 | 已完成两参考仓库源码对照及目标修订；统一服务迁移与功能验收尚未完成 | [当前合同](#lfaa-system-file-service-20261013) |
| 49-文件管理基础-20261013 | 将节点文件管理补成有预览/编辑区分、回收站、移动和批量操作的安全工作台 | 首版基础功能已实现并通过 11 项回归和登录态浏览器验收；短屏/移动端与帧时间未测；Office 高保真、杀毒、对象存储等列明能力尚未接入 | [当前合同](#lfaa-file-manager-foundation-20261013) |
| 50-文件管理响应-20261013 | 降低文件管理目录任务的等待，并在刷新时显示匹配的已有目录快照 | 实现和 Web 构建通过；登录态浏览器读取/刷新通过；短视口实际滚动未测 | [当前合同](#lfaa-file-manager-latency-20261013) |
| 51-文件夹大小显示-20261013 | 修正文件夹大小缺失与通用文件类型显示英文，并保持列表读取轻量 | 大小/文件类型定向回归 14/14；收到用户对首轮左对齐观感的反馈后，补充表头/单元格显式对齐和操作组左起布局，重新构建并在登录浏览器确认；本轮客户端/Host 类型检查、Web 构建和差异检查通过。远程第二节点、大目录性能、窄视口与帧时间未测 | [当前合同](#lfaa-file-manager-directory-size-20261013) |
| 52-文件列宽调整-20261013 | 复用共享 Pointer 拉伸方法，让文件表格可拖动列分隔线调整相邻列宽 | 源码完成；浏览器复测受阻 | [当前合同](#lfaa-file-manager-column-resize-20261013) |
| 53-节点交互终端-20261013 | 节点交互终端 | 见合同 | [本轮合同](#lfaa-node-interactive-terminal-20261013) |
| 54-浅色中性主题-20261013 | 浅色中性主题 | 见合同 | [本轮合同](#lfaa-appearance-light-neutral-20261013) |
| 55-桌面更新入口-20261013 | 桌面更新入口 | 见合同 | [本轮合同](#lfaa-desktop-update-hover-appearance-latest-01更新入口外观提示交互与最新版本恢复) |
| 56-桌面更新下载-20261013 | 桌面更新下载 | 见合同 | [本轮合同](#lfaa-desktop-update-download-flow-01统一更新网络栈展示下载进度并完成安装重启) |
| 57-共享小鱼智能体-20261014 | 全 App 共用小鱼智能体、可选能力关联与真实模型/浏览器统一验收 | 58/58 与文件 59/59；四类核心实机就绪/安全停止，浏览器共享入口/项目/设置/短屏通过；独立环境新超级管理员创建/登录通过，原项目权限保持 | [合同](#lfaa-xiaoyu-shared-agent-20261014) |
| 58-受管文件资源-20261014 | 文件管理资源导航、游戏实例目录与扩展插件存储保护 | 实施中 | [合同](#lfaa-managed-file-resources-20261014) |
| 59-包职责与按需能力-20261014 | 全部包逐目录职责及 Prompt/Skill/Expert/Tool 按需接入修复 | 368/368 职责、36/36 回归、类型/21 包/正式入口构建及 Gate 通过；现场 Provider/设备未验，服务未重载 | [合同](#lfaa-package-owner-lazy-capabilities-20261014) |
| 60-包职责规范-20261014 | 优化全仓包职责提示词并固化长期规范 | 文档完成；59/59 包组覆盖、链接、工作区及差异检查通过；包代码全仓审计/迁移未执行 | [合同](#lfaa-package-responsibilities-standard-20261014) |
| 61-任务卡片选择-20261014 | 任务卡片点击选择、高亮与紧凑布局 | 无圆圈、无鼠标焦点红框；刷新恢复选择；UI/Web 构建、回归和浏览器验收通过；窄屏侧栏会压缩主内容区；未删除真实任务 | [合同](#lfaa-minecraft-task-card-selection-20261014) |
| 62-任务详情与清理-20261014 | 查看任务执行详情与错误证据，并支持单项/批量删除终态记录 | 实现及规定回归/构建通过；浏览器详情已验，未删除真实记录 | [合同](#lfaa-minecraft-task-details-cleanup-20261014) |
| 63-任务状态反馈-20261014 | 修复实例删除后强制跳转，并让任务菜单显示真实状态、进度与结果 | 已修复（回归 4/4、Minecraft UI/Web 构建、183 包检查及登录态浏览器真实任务记录核验通过；未触发真实删除、窄屏设备和帧时间未测） | [合同](#lfaa-minecraft-task-feedback-20261014) |
| 64-输入光标修复-20261014 | 修复 AI Work 提问框插入光标被 Wallpaper Engine 白色全局样式遮蔽 | 已修复（定向回归 2/2、ui-chat/Web 构建、183 包检查及 `/tasks` 实际浏览器颜色核验通过；未测触屏和帧时间） | [合同](#lfaa-ai-work-composer-caret-20261014) |
| 65-Agent执行验收-20261014 | Agent执行验收 | 见合同 | [本轮合同](#lfaa-agent-execution-validation-20261014) |
| 66-运行环境修复-20261014 | 运行环境修复 | 见合同 | [本轮合同](#lfaa-runtime-manual-repair-20261014) |
| 67-游戏库运行-20261014 | 游戏库运行 | 见合同 | [本轮合同](#lfaa-game-library-runtime-20261014) |
| 68-输入命令与引用-20261015 | 小鱼输入框支持 `/` 命令菜单与 `@` 应用/能力关联 | 聊天包/Web 构建、类型检查、实页桌面及窄分栏检查通过；短屏和自动化测试未运行 | [本轮合同](#lfaa-ai-work-composer-slash-mention-20261015) |
| 69-会话栏分类-20261015 | 小鱼智能体左侧会话栏按草稿、置顶、项目、最近归类 | 实现完成；内置浏览器验收受阻 | [本轮合同](#lfaa-ui-sidebar-categories-20261015) |
| 70-聊天首页-20261015 | 聊天首页 | 见合同 | [本轮合同](#lfaa-chat-home-20261015) |
| 71-存储位置选择-20261015 | 存储位置选择 | 见合同 | [本轮合同](#lfaa-settings-storage-selection-20261015) |
| 72-固定工具栏-20261015 | 固定工具栏 | 见合同 | [本轮合同](#lfaa-settings-persistent-toolbar-20261015) |
| 73-数据目录布局-20261015 | 修复项目与存储中控制端数据根卡片的对齐与响应式布局 | UI/Web 构建通过；内置浏览器桌面与窄容器实页通过；自动化测试、帧时间未测 | [合同](#lfaa-settings-data-directory-layout-20261015) |
| 74-会话读取性能-20261015 | 会话读取性能 | 见合同 | [本轮合同](#lfaa-settings-session-read-performance-20261015) |
| 75-会话历史性能-20261015 | 小鱼智能体历史列表、消息首屏与会话切换读取性能 | 修复与登录浏览器复验完成；冷启动约 53 秒、长日志帧时间待测 | [合同](#lfaa-xiaoyu-session-history-performance-20261015) |
| 76-任务卡片动效-20261015 | 让任务卡片出现与悬停反馈更流畅自然 | CSS 入场/悬停动效、Minecraft UI/Web 构建及内置浏览器桌面/窄容器验收通过；未测帧时间及真机 | [合同](#lfaa-minecraft-task-card-motion-20261015) |
| 77-设置卡片动效-20261015 | 在常规设置中统一选择并控制可注册卡片的动画效果 | 源码回归、类型、包/Web/Control Plane 构建与工作区 Gate 通过；内置浏览器 UI/卡片布局通过，自动保存被旧运行服务拒绝，需新服务加载后复验 | [合同](#lfaa-settings-card-motion-20261015) |
| 78-设置弹窗动效-20261015 | 将弹窗动效与卡片动效统一纳入常规设置及共享主题维护 | 源码回归、类型、五包/Web/Control Plane 构建及工作区 Gate 通过；内置浏览器验证桌面 Modal 入退场与静态效果；旧运行服务拒绝新字段保存，窄屏与帧时间未测 | [合同](#lfaa-settings-dialog-motion-20261015) |
| 79-工作区固定卡片-20261016 | 将插件工作区标题标签和目录提示卡片移至最外层容器 | 已被统一标签任务取代 | [历史合同](#lfaa-plugin-workspace-sticky-cards-20261016) |
| 80-插件扩展界面-20261016 | 插件扩展界面 | 见合同 | [本轮合同](#lfaa-plugin-extension-workspace-ui-20261016) |
| 81-能力目录布局-20261016 | 重排能力目录真实条目的分组卡片布局并保留筛选/搜索 | 已完成；5/5、UI/Web 构建、193 包 Gate、diff 检查及 1440×900/760×520/390×640 内置浏览器验收通过；真实设备、桌面 WebView、帧时间未测 | [当前合同](#lfaa-plugin-capability-catalog-layout-20261016) |
| 82-工作区圆角-20261016 | 为插件工作区内容外框增加一致圆角并正确裁切滚动区域 | 已完成；Settings UI/Web 构建、193 包 Gate、diff 检查与 1355×925/760×520 内置浏览器验收通过；实体设备、桌面 WebView、帧时间未测 | [当前合同](#lfaa-plugin-workspace-corner-radius-20261016) |
| 83-壁纸分区生命周期-20261016 | 让壁纸引擎插件分区跟随真实 Profile 安装清单显隐 | 已完成；记录身份回归 3/3、Client/Web 构建与 193 包 Gate 通过；内置浏览器 1355×924 证实空 Profile 隐藏，已安装时显示与实际卸载回读未测 | [本轮合同](#lfaa-plugin-wallpaper-tab-lifecycle-20261016) |
| 84-插件市场界面-20261016 | 按用户参考图优化插件工作区与真实 Profile 插件管理列表 | 已完成；Web 构建、193 包 Gate 和 1440×900/760×520/390×640 内置浏览器验收通过；非空插件筛选样本、帧时间、真机与桌面 WebView 未测 | [本轮合同](#lfaa-plugin-ui-marketplace-20261016) |
| 85-Web启动对齐-20261016 | 对齐 DSH 源码 CLI 入口形态，并让每次完整 Web 启动安全结束同数据目录下可确认的旧 LFAA Web 后重新启动 | 已实现（Pester 3/3、PowerShell 5.1 预检、CLI typecheck/帮助、check:workspace 193 包和差异检查通过；真实 Web 重启未验） | [当前合同](#lfaa-cli-dsh-web-startup-alignment-20261016) |
| 86-插件安装来源-20261016 | 接入 DSH 插件管理器三类来源、独立管理页和通过现有 Permission Owner 执行的安装/启停/卸载入口 | 来源、独立管理页和手动启停直调已完成；隔离 Runtime 回归通过；窄/短视口与真实插件点击未验 | [本轮合同](#lfaa-plugin-install-sources-20261016) |
| 87-壁纸外观接入-20261016 | 壁纸外观接入 | 见合同 | [本轮合同](#lfaa-wallpaper-engine-appearance-owner-bridge-20261016) |
| 88-Ekko能力整合-20261016 | Ekko能力整合 | 见合同 | [本轮合同](#lfaa-ekko-capability-fusion-core-20261016) |
| 89-应用面板模板-20261016 | 应用面板模板 | 见合同 | [本轮合同](#lfaa-application-panels-templates-20261016) |
| 90-插件管理与会话布局-20261016 | 插件管理与会话布局 | 见合同 | [本轮合同](#lfaa-plugin-lifecycle-session-responsive-20261016) |
| 91-插件化架构-20261017 | 插件化架构 | 见合同 | [本轮合同](#01-插件化架构-20261017) |
| 92-插件扩展与外观-20261017 | 插件扩展与外观 | 见合同 | [本轮合同](#lfaa-plugin-extension-appearance-floaters-20261017) |
| 93-插件安装流程-20261017 | 修复三类插件来源自动识别，增加居中添加/安装详情弹窗及单次 registry 选择 | 实施中 | [本轮合同](#lfaa-plugin-install-modal-registry-progress-20261017) |
| 94-插件导航整合-20261017 | 合并插件工作区导航并移除重复的标题与分类筛选卡 | 已完成 | [当前合同](#lfaa-plugin-manager-unified-tabs-20261017) |
| 95-登录转场与刷新-20261017 | 登录转场与刷新 | 见合同 | [本轮合同](#lfaa-auth-transition-refresh-stability-20261017) |
| 96-可迁移启动路径-20261017 | 可迁移启动路径 | 见合同 | [本轮合同](#lfaa-relocatable-workspace-launch-20261017) |
| 97-默认账号与登录-20261017 | 默认账号与登录 | 见合同 | [本轮合同](#02-默认账号与登录-20261017) |
| 98-输入框窄栏响应式-20261017 | 参考紧凑“更多”菜单，把关联应用和能力选择从常驻底栏移入纵向操作菜单，适配窄聊天列 | 定向回归、客户端类型检查及 Web 构建通过；内置浏览器目视未验 | [本轮合同](#98-输入框窄栏响应式-20261017) |
| LFAA-AI-VIDEO-CANVAS-MVP-20261010 | 接入 AI 漫剧应用的真实账户隔离分镜画布首版，不伪装视频生成或执行工作流 | 已实现并修复入口回退；入口/Owner/API 回归 4/4、Web 构建、工作区 Gate 和登录浏览器入口/画布首屏/空列表读取通过；浏览器写入、帧时间、Desktop、Provider、白模导入未验 | [本轮合同](development/ai-video-canvas-mvp-20261010.md) |
| LFAA-AGENT-STDIO-COMPUTER-USE-20261008 | 在现有模型驱动 Agent/MCP Owner 中接入受设置与权限约束的本机 stdio MCP，并将 Computer-Use MCP 图片和说明送入当前模型请求 | 实现与定向回归完成；真实 Provider/桌面验收待做 | [当前合同](#lfaa-agent-stdio-computer-use-20261008) |
| LFAA-MCP-EGRESS-SESSION-PAGING-REPAIR-20261008 | 为远程 MCP 连接增加出站地址约束，并将 JSONL 消息分页改为单次异步完整链校验 | 已修复；MCP 2/2、Session 分页/冷缓存 1/1、Web Profile API 1/1、Host 类型检查、workspace Gate 和 4 个直接包构建通过 | [当前合同](#lfaa-mcp-egress-session-paging-repair-20261008) |
| LFAA-REMAINING-GAP-REPAIR-20261008 | 修复 Tauri 兼容壳安全停机、Session 分页、MCP 会话复用和 Web 大块；分开记录运行验收边界 | 源码、定向回归、类型检查及隔离构建通过；仍有约 501 kB 懒加载 C++ 语法块告警。真实桌面/游戏/浏览器帧时间/远端 CI 未验收 | [当前合同](#lfaa-remaining-gap-repair-20261008) |
| LFAA-WORKSPACE-AUDIT-REPAIR-20261008 | 核验 GLM 审查、修复运行风险与权威重复、整理中英文分类文档和自动门禁 | 整改与本地验证完成；实机退出/升级、长日志等缺口明确保留 | [当前合同](#lfaa-workspace-audit-repair-20261008) |
| LFAA-DESKTOP-UPDATE-DOWNLOAD-FLOW-01 | 修复 Electron 更新清单代理超时；增加真实下载进度、取消与完成后“重启并安装”闭环；将唯一发行文件输出到版本目录 | 进行中 | [当前合同](#lfaa-desktop-update-download-flow-01) |
| LFAA-DESKTOP-UPDATE-HOVER-APPEARANCE-LATEST-01 | 完善桌面更新入口的悬浮日志卡片、点击提示、外观设置映射、瞬时检查失败恢复，并验证旧版直达最新稳定版 | 进行中 | [当前合同](#lfaa-desktop-update-hover-appearance-latest-01) |
| LFAA-DESKTOP-UPDATE-CHECK-UI-UNBLOCK-01 | 修复桌面端更新检查在新版提示等待用户操作期间持续转圈的问题，让检查先明确返回发现版本，再独立等待下载选择 | 已实现（38 项定向回归、Windows x64 构建、包内版本/界面与更新清单对账通过；安装器未签名；弹窗交互和真实升级未验，未发布） | [合同](archive/contracts/09.md#lfaa-desktop-update-check-ui-unblock-01) |
| LFAA-DESKTOP-UPDATE-RELEASE-01 | 将 Windows Electron 更新能力接入 0.1.2，并发布可供 0.1.1 检测的更新 | 已发布（构建、线上清单与安装包核对通过；0.1.1 实机升级未验） | [合同](archive/contracts/06.md#lfaa-desktop-update-release-01) |
| LFAA-UI-PLUGIN-WORKSPACE-01 | 将设置中心的插件配置重排为分区工作台，分离总览、能力目录、知识库、第三方插件、MCP 与运行诊断，并复用现有设置 Owner | 已实现（UI 包构建、客户端类型检查和差异检查通过；Web 构建指纹检测到并行源码变更而未登记，浏览器目视未验） | [合同](archive/contracts/08.md#lfaa-ui-plugin-workspace-01) |
| LFAA-CLI-WEB-LOCK-RECOVERY-01 | Web 菜单启动时识别当前数据目录的存活 LFAA Web 写锁持有者，结束该 CLI 进程后再启动 | 已实现（PowerShell 语法、数据目录解析、差异检查通过；真实 PID 终止与 Web 重启未运行） | [合同](archive/contracts/06.md#lfaa-cli-web-lock-recovery-01) |
| LFAA-WEB-MENU-STARTUP-PS51-20261009 | 修复 Windows PowerShell 5.1 下完整 Web 启动预检的 Node 参数引号丢失，并明确完整 Web、独立 Daemon 与 Vite 模式的前置条件 | 已修复；PowerShell 5.1 回归 1/1，控制端/Web 构建和隔离目录下实际菜单启动通过；健康与页面 HTTP 200 | [当前合同](#lfaa-web-menu-startup-ps51-20261009) |
| LFAA-DESKTOP-ELECTRON-AUTO-UPDATE-01 | 为 Electron 桌面端增加 LFAA 更新清单，并接入自动检查、下载与受控安装 | 代码已接入；清单回归和静态检查通过；Electron NSIS 构建被现有 Host TypeScript 错误阻断；真实 Release 下载、签名和安装升级未验 | [合同](archive/contracts/06.md#lfaa-desktop-electron-auto-update-01) |
| LFAA-DESKTOP-UPDATE-CONSENT-CHECK-01 | 为当前可运行的 Windows Electron 桌面端增加新版本推送、用户选择下载及设置页手动检查 | Windows Electron 源码、定向回归及隔离前端构建通过；真实 Release/桌面安装及 Android、Tauri 未验 | [合同](archive/contracts/07.md#lfaa-desktop-update-consent-check-01) |
| LFAA-DESKTOP-UPDATE-PROMPT-UI-01 | 将 Electron 更新提示从有系统音效的原生消息框改为 LFAA 工作台内的静音、主题适配更新弹窗 | 源码、24 项更新回归、客户端类型检查、UI 包与 Web 构建通过；桌面候选包与实际视觉未验，Host 构建指纹过期 | [合同](archive/contracts/09.md#lfaa-desktop-update-prompt-ui-01) |
| LFAA-DESKTOP-UPDATE-DEFER-SUPPRESSION-01 | 用户暂不更新后，本次进程不再因自动或手动检查重复提示同一版本；重启后恢复提示 | 已修复；Electron 更新回归 24/24、语法与差异检查通过；打包桌面端未验 | [合同](archive/contracts/09.md#lfaa-desktop-update-defer-suppression-01) |
| LFAA-DESKTOP-UPDATE-PACKAGE-REBUILD-01 | 重建包含工作台静音更新提示及进程内暂缓逻辑的 Windows Electron 安装候选，并核验随包运行树 | Windows x64 NSIS 候选构建、包内更新代码核验及 CUA Driver 导入验收通过；实际安装/启动目视未验 | [合同](archive/contracts/09.md#lfaa-desktop-update-package-rebuild-01) |
| LFAA-APP-VERSION-REBASE-01 | 按用户指定的 `0.0.1 → 0.0.2` 更新链重建 Windows Electron `0.0.2` 候选，保留运行中 Web 正式构建目录 | 已实现；版本/更新回归 7/7、24/24，安装器回归 3/3，Windows x64 候选包与随包运行树验收通过；真实安装/启动视觉及外部发布未验 | [合同](archive/contracts/09.md#lfaa-app-version-rebase-01) |
| LFAA-DESKTOP-UPDATE-RELEASE-003 | 修复桌面更新 404 错误泄露原始 HTTP 响应信息，并将 LFAA 0.0.3 安装包及更新清单发布至 GitHub Release | Windows x64 安装包已构建并本地验收；GitHub 推送与 Release 待执行；真实应用自动升级待验 | [合同](archive/contracts/09.md#lfaa-desktop-update-release-003) |
| LFAA-DESKTOP-UPDATE-EXPERIENCE-004 | 将 LFAA 桌面更新体验完善为顶部更新入口、版本说明卡片、跳过指定版本及用户 opt-in 的自动下载安装，并构建 `LFAA-0.0.4.exe` | 本地代码、回归、Windows x64 NSIS 包和版本交付目录已验收；真实安装、桌面视觉和升级未验；未上传或发布 | [合同](archive/contracts/09.md#lfaa-desktop-update-experience-004) |
| LFAA-DESKTOP-ELECTRON-BUILD-MENU-01 | 将工作台菜单 3 与 `pnpm run build:win` 接入 Windows Electron 安装包构建；保留 `0.0.4` 已生成事实，之后每次新包递增版本并同步更新日志、产品元数据与更新清单 | 构建入口、版本登记与回归完成；现有 `0.0.4` 安装器匹配核验通过；未生成新包 | [合同](archive/contracts/09.md#lfaa-desktop-electron-build-menu-01) |
| LFAA-GIT-PUSH-CREDENTIAL-PATH-GUARD-01 | 修复正常推送前历史路径扫描将第一方 `packages/credentials` 目录树节点误判为敏感数据，同时保留其他敏感路径、内容和大对象阻断 | Pester 2/2、完整历史安全门禁通过；正常快进推送至 GitHub main；远端 `update.json` 与 `latest.yml` 均为 0.0.4；应用内手动检测待用户复验 | [合同](archive/contracts/09.md#lfaa-git-push-credential-path-guard-01) |
| LFAA-WEB-VERSION-UPDATE-CHECK-01 | 在 Web 设置页显示构建版本，并手动检查官方更新清单、展示更新说明和发布页 | Web 构建、定向回归、TypeScript 与登录态浏览器验收通过；桌面下载安装不属于 Web 验收 | [合同](archive/contracts/09.md#lfaa-web-version-update-check-01) |
| LFAA-DESKTOP-ELECTRON-STARTUP-INSTALLER-01 | 修复桌面安装包缺少 CUA Driver 导致启动失败，并补齐 LFAA 安装图标、强制确认、安装详情和桌面快捷方式 | 源码、Windows x64 安装包及随包插件导入验收通过；实际安装交互与快捷方式目视待用户安装确认 | [合同](archive/contracts/08.md#lfaa-desktop-electron-startup-installer-01) |
| LFAA-DESKTOP-ELECTRON-LICENSE-ENCODING-01 | 修复 Windows NSIS 安装须知中文乱码并重建独立候选安装包 | 源码与构建资源编码核验、Windows x64 NSIS 构建及随包运行树验收通过；安装器界面未安装/目视，候选未签名 | [合同](archive/contracts/08.md#lfaa-desktop-electron-license-encoding-01) |
| LFAA-DESKTOP-ELECTRON-INSTALL-PROGRESS-01 | 修复 NSIS 安装文件复制期间详情区为空，显示实际写入文件，同时保留总进度与静默安装行为 | 已实现；安装器定向回归、Windows x64 NSIS 构建与随包运行树检查通过；实际安装器界面未打开 | [合同](archive/contracts/08.md#lfaa-desktop-electron-install-progress-01) |
| LFAA-DESKTOP-DAEMON-INTEGRATION-CLARITY-01 | 将本机 Daemon 明确为桌面安装包内置、随桌面自动启动的独立节点进程，并把沙箱宿主构建命令和启动菜单说明改为真实职责 | 已完成（命令与构建链静态核对、JSON/PowerShell 解析和差异检查通过；未重建安装包或运行远程节点） | [合同](archive/contracts/08.md#lfaa-desktop-daemon-integration-clarity-01) |
| LFAA-DESKTOP-ELECTRON-INSTALL-SMOOTHNESS-01 | 减少 Windows NSIS 安装中文件状态行闪烁，保留稳定的安装目标提示，核实目标目录为用户选择的安装目录，并按 `LFAA-版本号` 命名下一安装包 | 稳定提示已接入；定向回归 3/3、Windows x64 NSIS 重建与随包检查通过；安装器 UI 目视未验 | [合同](archive/contracts/09.md#lfaa-desktop-electron-install-smoothness-01) |
| LFAA-HARNESS-PRODUCT-DIRECTION-01 | 明确 LFAA-Harness 自有产品、插件化、多平台目标与纯净发行边界，并检查当前项目偏差 | 开发规范/架构/打包指导已对齐，根 workspace 清单与锁文件入口已修复；桌面默认入口仍待迁移，安装包归档与异盘验收未做 | [合同](archive/contracts/07.md#lfaa-harness-product-direction-01) |
| LFAA-AI-INSTRUCTION-CONSISTENCY-01 | 审查 AI 规则与当前能力描述，消除 Agent 委派、Minecraft 核心支持和运行数据事实中的过期冲突 | 规则/提示词/项目说明已对齐；`git diff --check` 和 Minecraft 包构建器通过；pnpm 包装命令因依赖目录清理需交互确认而中止，未绕过 | [合同](archive/contracts/06.md#lfaa-ai-instruction-consistency-01) |
| LFAA-REPO-AI-GUIDES-01 | 参考 DeepWrite 的 AI 助手目录组织、Git 提交和桌面打包流程，为 LFAA 建立一致的仓库指导入口并整理根目录文档位置 | 仅文档、模板与目录变更；不改产品运行代码、设置或构建链；定向路径/差异检查，workspace-preflight 若缺失如实记录 | [合同](archive/contracts/06.md#lfaa-repo-ai-guides-01) |
| LFAA-UI-AI-WORK-REFRESH-STABILITY-01 | 修复 AI Work 刷新时回到底部按钮、输入提示和模型选择器的状态闪烁与横移 | 代码、定向回归、Web 构建和登录态源码预览通过；3000 运行服务未重启，避免停止正在运行的 Minecraft 实例 | [合同](archive/contracts/06.md#lfaa-ui-ai-work-refresh-stability-01) |
| LFAA-UI-AI-MODEL-CARD-01 | 优化 AI Work 模型悬浮卡片与模型专属思考参数，并与设置中心的 AI 账户配置保持同一数据源 | 实现、5/5 定向回归、相关包/控制端/Web 构建通过；登录态浮卡交互待浏览器连接恢复后验收 | [合同](archive/contracts/06.md#lfaa-ui-ai-model-card-01) |
| LFAA-UI-AI-WORK-OUTPUT-FOCUS-01 | 在外观设置中增加 AI Work 回复区悬停聚焦虚化、同步刻度轨道与滚动条；按截图调整红框命中并保持输入框清晰 | 两块红框并集命中已实现；聊天包构建、差异检查与 5173 登录态页面交互核验通过；连续物理鼠标与帧时间未测 | [合同](archive/contracts/06.md#lfaa-ui-ai-work-output-focus-01) |
| LFAA-UI-AI-WORK-IDLE-BLUR-01 | 将 AI Work 回复区从指针进出虚化改为用户活动空闲计时虚化，并在外观设置中配置启用、空闲时长与虚化强度 | 空闲设置保存阻断已修复：Appearance API Schema 与 Settings Owner 的 Wallpaper Engine ID 格式对齐；定向回归、控制端构建及登录态保存/刷新通过；虚化计时与帧时间本轮未复测 | [合同](archive/contracts/08.md#lfaa-ui-ai-work-idle-blur-01) |
| LFAA-SETTINGS-APPEARANCE-WALLPAPER-ID-01 | 修复账户外观设置保存被 Wallpaper Engine 项目 ID 校验错误拒绝的问题，保持 Settings Owner 已支持的项目 ID 格式 | 已完成：真实账户数字项目 ID 导致整份外观提交被错误 Schema 拒绝；修正格式约束，定向回归、控制端构建、登录态保存/刷新和健康检查通过 | [合同](archive/contracts/08.md#lfaa-settings-appearance-wallpaper-id-01) |
| LFAA-AI-AUTONOMOUS-TOOLS-01 | 将 AI Work 的 Shell 默认绑定到所选项目、收敛活动轨迹中的原始协议数据、让最终回复自然语言转述工具结果、展示可折叠的真实工作轨迹，并按设置中心显式 App 范围发现真实 MCP 工具 | 回复规则与活动轨迹定向回归、AI Work/Agent Loop 包及 Web 构建通过；真实 Provider/浏览器验收待完成 | [合同](archive/contracts/06.md#lfaa-ai-autonomous-tools-01) |
| LFAA-AI-CONTEXT-REUSE-01 | 优化 AI Work 新任务上下文，避免重复提交历史已完成轮次的内部工具协议 | 定向回归、Agent Loop/Session 与控制端构建、控制端类型检查通过；真实 Provider 用量待验 | [合同](archive/contracts/06.md#lfaa-ai-context-reuse-01) |
| LFAA-AI-MEMORY-01 | 在设置中心接入账户隔离的 AI Work 对话记忆、工具聊天控制、后续个性化读取与删除 | 已实现；定向回归与 Web/包构建通过；控制端类型构建受现有错误阻断，Provider/浏览器未验 | [合同](archive/contracts/07.md#lfaa-ai-memory-01) |
| LFAA-AI-MEMORY-01-R1 | 加固 AI Work 个性化记忆：输入敏感内容过滤、不把记忆正文写入 Session 模型快照、删除时清理旧快照、回答先结束再异步整理，并在设置中心查看/编辑记忆 | 已实现；记忆定向回归 14/14、9 个受影响包构建及 `git diff --check` 通过；Web/Host 构建受缺失的 account-controller 生成 `.js` 模块阻断，Provider/浏览器未验 | [合同](archive/contracts/07.md#lfaa-ai-memory-01-r1) |
| LFAA-UI-AI-WORK-MESSAGE-ACTIONS-01 | 为 AI Work 提问与完整回答增加复制，为回答加入可持久化反馈，并按指定回答的历史前缀创建独立会话分支（支持当前工作空间与符合条件的 AI Worktree） | 本轮代码完成；定向回归和直接包构建通过；Web 构建被既有 SettingsPage 类型错误阻断，登录态交互未通过空白页面验收 | [合同](archive/contracts/07.md#lfaa-ui-ai-work-message-actions-01) |
| LFAA-UI-AI-WORK-EDIT-MESSAGE-01 | 在 AI Work 中编辑已发送的问题；活动回复先停止并等待结束，再从问题之前的 Session 上下文创建分支并提交修改后的问题 | 已实现；定向回归与相关包构建通过；Web 构建受既有 SettingsPage 未使用变量 TS6133 阻断；登录态交互未验 | [合同](archive/contracts/08.md#lfaa-ui-ai-work-edit-message-01) |
| LFAA-LOCAL-GIT-WORKTREES-01 | 为 AI Work 接入账户隔离的本地 Git 状态、隔离 Worktree、真实变更摘要和可确认恢复 | 实现、构建和本地回归通过；目标 Daemon/浏览器验收待完成 | [合同](archive/contracts/06.md#lfaa-local-git-worktrees-01) |
| LFAA-UI-GIT-CHANGE-EDITOR-01 | 把 AI Work 右侧 Git 变更摘要扩展为可联动的变更审查和安全文本编辑器，支持文件列表、差异视图、编辑保存及截图中的浏览操作 | 实现完成（浏览器验收未验证） | [合同](archive/contracts/08.md#lfaa-ui-git-change-editor-01) |
| LFAA-UI-AI-WORK-SIDE-CHAT-01 | 在 AI Work 右侧工具栏增加独立侧边聊天，支持 `/side` 与可配置快捷键；从当前 Session 已记录上下文创建无工具分支，在主任务运行期间提问且不打断主任务 | 实现完成；95 个包构建、Web 构建及 13 项相关回归通过；登录态页面验收待做 | [合同](archive/contracts/08.md#lfaa-ui-ai-work-side-chat-01) |
| LFAA-UI-AI-WORK-SETTINGS-COMPAT-01 | 修复 AI Work 因缺少侧聊快捷键兼容回退及 `AiWorkSideChat` 未注册导致的整页 React 崩溃，复用设置中心默认值并补齐真实 Client 模块装配 | 已修复；目标包/Web 构建、设置兼容回归和登录态四类 AI Work 页面验收通过；运行中控制端侧聊接口返回未找到 | [合同](archive/contracts/08.md#lfaa-ui-ai-work-settings-compat-01) |
| LFAA-CLIENT-WORKSPACE-RENDER-RECOVERY-01 | 排查 Minecraft/Connectivity 登录后共享工作区渲染失败，兼容旧版快捷键设置缺项并让错误边界显示安全摘要 | 兼容修复、4/4 定向回归、客户端类型检查和 Web 构建通过；当前登录态工作区尚未验收，具体根因需用错误摘要复核 | [合同](archive/contracts/08.md#lfaa-client-workspace-render-recovery-01) |
| LFAA-AI-PLAN-MODE-01 | 为 AI Work 增加可持续讨论并经用户批准后执行的计划模式；支持 `/plan`、自然语言意图判断和批准后恢复任务工具 | 已实现；15/15 定向回归、控制端/Web 构建及差异检查通过；真实 Provider、登录态浏览器与 Daemon 验收未运行 | [合同](archive/contracts/08.md#lfaa-ai-plan-mode-01) |
| LFAA-AGENT-WORKFLOW-CANVAS-01 | 为 Minecraft 增加可保存、可执行的无限画布 Agent 工作流；图节点复用 Agent Loop 与 Minecraft 工具，任务状态可追踪 | 画布与定义持久化的浏览器验收通过；真实 Provider/Daemon 工作流执行待验 | [合同](archive/contracts/08.md#lfaa-agent-workflow-canvas-01) |
| LFAA-WORKFLOW-CANVAS-DATAFLOW-01 | 将工作流拆为跨 App 的通用核心、可撤销节点/引擎适配器和共享编辑器；Minecraft 作为首个 App 适配器 | 核心与首个适配器已实现；类型检查、迁移回归、Control Plane/Web 构建及隔离浏览器创建/连线/保存/运行/刷新恢复通过；真实 Minecraft Agent/Provider/Daemon 未验；旁支 Agent API 回归的记忆生成断言失败 | [合同](archive/contracts/08.md#lfaa-workflow-canvas-dataflow-01) |
| LFAA-LOCAL-STORAGE-SQLITE-01 | 审查本地数据目录与混合存储，将高频结构化配置改为 SQLite 按记录事务存储，同时保留 JSONL 会话事件与文件型大资源 | 实现、定向回归、类型检查与隔离构建完成；浏览器验收因 5173 未监听且现有服务仍运行旧版而受阻；未改动两个数据根 | [合同](archive/contracts/08.md#lfaa-local-storage-sqlite-01) |
| LFAA-PROJECT-STATUS-CONFLICTS-01 | 修复项目状态审查发现的界面与路线文档冲突 | 已完成（Web 构建与应用中心浏览器核验通过；Provider/Daemon 端到端未运行） | [合同](archive/contracts/05.md#lfaa-project-status-conflicts-01) |
| LFAA-ROADMAP-ALIGNMENT-01 | 对齐 Harness 当前主线与既有 P0–P7 应用阶段口径 | 已完成（文档对齐；端到端实机验收未运行） | [合同](archive/contracts/05.md#lfaa-roadmap-alignment-01) |
| LFAA-WORKSPACE-AUDIT-02 | 全仓入口、架构残留、备份、日志与交互性能审计修复 | 修复与回归通过；物理清理受阻、逐帧验收待完成 | [当前合同](archive/audits/workspace-audit.md) |
| LFAA-PERFORMANCE-SAFETY-MAINTAINABILITY-01 | 全模块性能与重复逻辑整治，落实性能、安全、可维护性硬规则 | 共享链路优化通过；后续全仓回归 83 通过、1 跳过，登录交互走查完成，桌面与逐帧实测待验 | [合同与检查记录](development/performance.zh.md) |
| LFAA-MINECRAFT-DEPLOYMENT-02 | 多核心目录与传统面板自动开服闭环 | 代码/回归完成；16 类实机通过，SpongeNeo 与浏览器验收受阻 | [计划、合同与开发记录](archive/audits/minecraft-deployment-plan.md) |
| LFAA-UI-MINECRAFT-DEPLOYMENT-01 | 重排 Minecraft 部署整页的信息层级、配置流程与部署记录，并适配工作区宽度 | 已完成（Web 构建、宽窄屏浏览器布局与核心菜单交互通过） | [合同](archive/contracts/05.md#lfaa-ui-minecraft-deployment-01) |
| LFAA-MINECRAFT-PLAYER-CONNECTIVITY-01 | 在开服部署之外建立独立的 LFAA 世界联机中心，呈现内置穿透、自备穿透和房间域名三种路线，并支持外部服务地址手动交接 | 历史范围，已由 LFAA-GAME-CONNECTIVITY-APP-01 扩展为跨游戏 Connectivity App | [合同](archive/contracts/08.md#lfaa-minecraft-player-connectivity-01) |
| LFAA-GAME-CONNECTIVITY-APP-01 | 建立独立、跨游戏复用的联机服务 App，隔离游戏部署与联网；提供官方 Provider 适配、自备服务交接和 LFAA 自有房间域名 Relay，支持 TCP/UDP 与真实路由状态 | 当前阶段：管理员可经认证节点任务安装并校验官方 EasyTier Windows x64 运行包；后续按阶段接入真实实例与协作功能 | [合同](archive/contracts/08.md#lfaa-game-connectivity-app-01) |
| LFAA-UI-MINECRAFT-CORE-LIBRARY-01 | 将部署页核心选择区改为分类导航与核心/版本卡片式操作面板，默认自动匹配下载工件 | Web 构建通过；浏览器可视验收受 CDP 超时阻塞 | [合同](archive/contracts/05.md#lfaa-ui-minecraft-core-library-01) |
| LFAA-UI-MINECRAFT-ONBOARDING-01 | 将部署改为分步引导，并让实例列表更便于查找和执行常用操作 | UI 实现与 Web 构建完成；浏览器交互待验 | [合同](archive/contracts/05.md#lfaa-ui-minecraft-onboarding-01) |
| LFAA-EXECUTION-CONTROL-01 | 统一手动/模型开服、本机原生执行与远程节点控制 | 控制链已实现并通过真实节点命令验收；游戏、远程 HTTPS、前端及图形驱动仍待验/接入 | [当前合同](subsystems/execution-control.zh.md) |
| LFAA-COMPUTER-USE-LOCAL-01 | 将 CUA Driver 本机电脑操控接入 LFAA-Harness Windows 桌面 Profile，支持账户关闭开关、截图视觉反馈及经现有权限合同的有限鼠标键盘操作 | 源码接入、隔离回归、Control Plane/Web 构建通过；真实 Windows 桌面、Provider 与打包桌面验收待完成 | [合同](archive/contracts/07.md#lfaa-computer-use-local-01) |
| LFAA-COMPUTER-USE-SETTINGS-UI-RECOVERY-01 | 修复进入“设置中心 > 电脑操控”导致设置页崩溃的问题，并保证导航只显示/编辑 Agent 能力开关，不探测或执行桌面动作 | 已修复（设置回归、UI 包构建、Web 构建通过；登录态页面/真实桌面未验） | [合同](archive/contracts/07.md#lfaa-computer-use-settings-ui-recovery-01) |
| LFAA-COMPUTER-USE-LOCAL-GAMES-20261008 | 在 Windows 桌面 Profile 中发现本机开始菜单应用与 Steam 已安装游戏；按 LFAA 当前进程内的启动请求历史推荐，由模型解析自然语言游戏名并在用户选择后经现有权限合同启动 | 源码、隔离回归、Control Plane/Web 构建与 workspace Gate 通过；真实 Windows 启动、Provider 和桌面交互待验 | [合同](archive/contracts/10.md#lfaa-computer-use-local-games-20261008) |
| LFAA-HARNESS-CLEANUP-01 | 固定大模型驱动核心、硬编码与新旧代码规则，清理迁移残留并整理节点入口 | 原任务规则与清理快照见 harness-cleanup.md；当时的 Agent 状态已由后续可执行顺序子 Agent 实现更新，当前能力/待办见系统架构、开发计划和 harness-agent-delivery.md | [合同](archive/contracts/04.md#lfaa-harness-cleanup-01) |
| LFAA-HARNESS-DSH-PACKAGES-01 | 按 DSH 实际包树重构并迁移现有项目，保留全部同名目录占位 | 源码迁移与构建完成；隔离运行通过；5 项既有测试失败及未验项目详见交付记录 | [合同](archive/contracts/04.md#lfaa-harness-dsh-packages-01) |
| LFAA-HARNESS-DSH-CAPABILITY-PARITY-01 | 将 DSH 非界面能力纳入 LFAA 优先级路线，并按 LFAA 唯一责任归属适配和优化 | 路线登记完成；LFAA 场景筛选后的 P0 已完成；P1–P4 仍按路线待实施，不宣称 DSH 全量能力已复刻 | [合同](archive/contracts/07.md#lfaa-harness-dsh-capability-parity-01) |
| LFAA-HARNESS-DSH-P0-01 | 完成基于 LFAA 场景筛选的 DSH 参考 P0 能力 | 已完成（仅 LFAA 场景筛选范围）；审计 61 个上游包作为参考清单，不要求逐包复刻；凭据/交互插件、Storage Hub/JSON/SQLite、Typert 真实账户 Remote、Session 耐久性及插件生命周期已有实现/回归；DSH 专属格式、无消费者的 Typert 双向流与 P2 执行提供方明确暂缓；90 项回归、95 个能力包构建、Host/Web 隔离构建和当前未登录页面验收通过；用户 Edge 登录态、Provider/Daemon/桌面/OS 沙箱未验 | [合同](archive/contracts/07.md#lfaa-harness-dsh-p0-01) |
| LFAA-HARNESS-DSH-CORE-01 | 将 DSH `packages/core` 的核心职责适配到 LFAA-Harness，复用现有会话、设置、权限与执行 Owner，并记录 MIT 来源 | 核心适配与 8 个直接包构建完成；Host/Client 类型检查通过；测试与真实运行验收未做；PTC 隔离执行未接入 | [合同](archive/contracts/07.md#lfaa-harness-dsh-core-01) |
| LFAA-HARNESS-PLUGIN-CORE-01 | 建设模型驱动的通用能力发现、理解、按应用接入、真实验证与调用闭环，覆盖 Plugins、Skills、Prompts、Tools、MCP 与 Minecraft 插件/模组 | 进行中（Wallpaper Engine 上游 Host/Client UI 与右侧栏适配已接入；官方兼容 revision 检查/替换已实现；真实浏览器、媒体和跨桌面验收未完成） | [合同](archive/contracts/05.md#lfaa-harness-plugin-core-01) |
| LFAA-SESSION-KERNEL-01 | 依据 DSH `core/session` 建立 LFAA 自有事件溯源 Session 内核，复用现有会话、认证、持久化与工作台 Owner | 内核及 Agent Loop 接线完成；Session/JSONL 9 项、File Storage 6 项、Agent Runtime 1 项分项回归通过；3 个直接包构建、Host 类型检查和 Control Plane 构建通过；workspace-preflight 不存在；Provider/浏览器/桌面/Daemon 未验 | [合同](archive/contracts/07.md#lfaa-session-kernel-01) |
| LFAA-WALLPAPER-ENGINE-FULL-DSH-01 | 按固定 DSH 上游源码完整接入 Wallpaper Engine 可移植功能，在 LFAA 对应 Settings、Workbench 和 Harness Profile Owner 落地 | 官方插件已在 LFAA Web Profile 启用；原生 Settings 与右侧工作台面板通过浏览器验收；当前 Client 报告所选壁纸“播放中”，但 AI Work 主面板仍黑底 | [合同](archive/contracts/06.md#lfaa-wallpaper-engine-full-dsh-01) |
| LFAA-WALLPAPER-ENGINE-UI-COMPLETE-01 | 保留上游壁纸插件原生界面与能力，接入 LFAA 右侧图标入口/展开行为，并让插件 UI 继承 LFAA 外观设置 | Settings 原生分区、壁纸选择器、右侧图标/抽屉及外观与播放页通过真实 Web Profile 验收；播放器报告“播放中”，工作区背景可见性待修复/复验 | [合同](archive/contracts/06.md#lfaa-wallpaper-engine-ui-complete-01) |
| LFAA-WALLPAPER-ENGINE-END-TO-END-01 | 修复 Wallpaper Engine 从 Profile Host 到浏览器 Client、插件 API 和原生 UI 的端到端请求链，确保安装启用后完整上游功能可用 | 首次载入、根画布与 Scene 实时渲染已在当前 3000 登录浏览器验收；实时 Scene 帧策略见 LIVE-SCENE-01；桌面打包及硬件逐帧测量未验 | [合同](archive/contracts/07.md#lfaa-wallpaper-engine-end-to-end-01) |
| LFAA-DSH-SLOT-EMPTY-STATE-01 | 为 DSH 设置区与右侧插件面板补齐通用空插槽反馈和插件状态入口，避免插件内容缺失时整页空白 | 已实现（DSH Slot fallback 定向回归及相关 Client/Web 构建通过；浏览器插件运行态未验） | [合同](archive/contracts/06.md#lfaa-dsh-slot-empty-state-01) |
| LFAA-WALLPAPER-ENGINE-UPSTREAM-UPDATES-01 | 让固定官方仓库的兼容上游版本通过提交级来源核验后复用 DSH 适配，不因正常上游发版改写 LFAA UI 或逐次硬编码版本/提交 | Runtime 快照校验、官方同源停用态版本替换和定向回归通过；真实新版本未验 | [合同](archive/contracts/06.md#lfaa-wallpaper-engine-upstream-updates-01) |
| LFAA-WALLPAPER-ENGINE-COMPOSITING-01 | 修复 LFAA 根画布与 AI Work 面板遮挡插件壁纸层的问题，并让主面板读取设置中心现有透明度和模糊映射 | CSS 修复后在真实 Web 页面确认壁纸层可见，AI Work 面板计算样式读取当前设置中心令牌；未验动态 Scene 播放 | [合同](archive/contracts/07.md#lfaa-wallpaper-engine-compositing-01) |
| LFAA-WALLPAPER-ENGINE-APPEARANCE-BOOT-01 | 修复 Wallpaper Engine 首次进入需刷新及窄屏闪屏，保持 LFAA/插件各自外观 Owner | 首个深层路由冷加载不需二刷；1600/938/640 视口和 640px 常规↔AI Work 切换中实时壁纸保持可见；GPU 帧时间/物理闪屏未测 | [合同](archive/contracts/08.md#lfaa-wallpaper-engine-appearance-boot-01) |
| LFAA-WALLPAPER-ENGINE-LIVE-SCENE-01 | 保留官方 Wallpaper Engine Scene 大型媒体包的实时传输能力，并在 LFAA 固定来源适配器中限制媒体服务边界 | 适配器关闭独立媒体监听，只对 scene-live/index.html 设 SAMEORIGIN；Scene 在 3000 同源 iframe 达到 first-frame-ok/live-ready，诊断报 30 FPS；定向回归与控制端构建通过 | [合同](archive/contracts/07.md#lfaa-wallpaper-engine-live-scene-01) |
| LFAA-PLUGIN-INSTALL-ACTIVATE-01 | 让对话中的插件安装按 DSH 默认行为完成兼容运行时启用与 Owner 回读核验，失败时返回真实未就绪状态 | 安装激活和跨重启恢复已实现；定向回归 15/15、Plugin Manager/Capability Install 包构建、Control Plane 构建通过；真实 Provider/登录浏览器验收未完成 | [合同](archive/contracts/07.md#lfaa-plugin-install-activate-01) |
| LFAA-AI-NATURAL-LANGUAGE-PLUGIN-INSTALL-01 | 让内置 AI Work 能从一句话和直接 GitHub 插件地址自主调用 LFAA 生命周期 Owner；同源已安装插件只启用并回读，不重复安装或更新 | 工具自主规划与 Owner 清单回读已实现；定向回归、包构建和 Host 类型检查通过；真实 Provider/登录浏览器验收待做 | [合同](archive/contracts/07.md#lfaa-ai-natural-language-plugin-install-01) |
| LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01 | 让 AI Work 回复完成通知在工作台聚焦时也播放设置中心选定的提示音 | 已修复（前端构建和目标差异检查通过；浏览器/桌面播放待验） | [合同](archive/contracts/04.md#lfaa-settings-notification-completion-sound-01) |
| LFAA-AUTH-PASSKEY-01 | 为 LFAA 登录增加可选通行密钥并提供安全管理 | 代码已接入（前端构建受既有 SteamCMD 类型错误阻塞，实机待验） | [合同](archive/contracts/03.md#lfaa-auth-passkey-01) |
| LFAA-MINECRAFT-APPCONTAINER-ENV-01 | 修复 Minecraft AppContainer 启动因 Windows 子进程环境块错误返回 Win32 203 | 代码修正完成（Sandbox Host 构建通过；实例启动待实机复验） | [合同](archive/contracts/03.md#lfaa-minecraft-appcontainer-env-01) |
| LFAA-PORTABLE-DATA-ISOLATION-01 | 曾将可移动盘数据隔离到各电脑本机 | 历史实现已被更新后的数据归属规则取代：固定盘使用用户级目录，可移动盘数据跟随项目目录 | [合同](archive/contracts/04.md#lfaa-portable-data-isolation-01) |
| LFAA-FILE-MANAGER-RECOVERY-01 | 修正文件管理的离线节点状态、空目录误报与节点恢复控制 | 实现完成（前端构建通过；浏览器和 Daemon 验收待做） | [合同](archive/contracts/03.md#lfaa-file-manager-recovery-01) |
| LFAA-FILE-MANAGER-HOME-01 | 修正文件管理左侧房子按钮误返回来源子页面，改为来源 App/模式首页 | 实现和 Web 构建通过；浏览器点击验收受 Edge 连接故障阻塞 | [合同](archive/contracts/03.md#lfaa-file-manager-home-01) |
| LFAA-UI-WORKMODE-HOME-01 | 工作区房子按钮返回当前应用与所选工作模式首页，应用中心入口保持原路由 | 已修正（路由静态核对；构建未运行） | [合同](archive/contracts/01.md#lfaa-ui-workmode-home-01) |
| LFAA-UI-RECENT-SESSIONS-NAV-01 | 将左一“最近会话”接入现有跨 App AI Work 会话查询与打开流程 | 实现完成（前端构建与差异检查通过；登录态交互待验） | [合同](archive/contracts/04.md#lfaa-ui-recent-sessions-nav-01) |
| LFAA-UI-APP-CENTER-NAV-01 | 左一提供应用中心直达入口；应用切换统一从应用中心进行，左二只保留当前应用导航 | 实现完成（前端构建与差异检查通过；浏览器目视待验） | [合同](archive/contracts/04.md#lfaa-ui-app-center-nav-01) |
| LFAA-UI-APP-CONTEXT-01 | 切换应用时保留各自 AI Work 会话与未发送草稿，并明确当前应用 | 实现完成（交互未验收） | [合同](archive/contracts/02.md#lfaa-ui-app-context-01) |
| LFAA-AI-WORKSPACE-PROJECTS-01 | 在 AI Work 中按真实主机目录管理项目，并将会话与项目文件范围关联 | 定向回归、全仓构建、v38 迁移与 API 路由核实通过；登录态 UI 待验 | [合同](archive/contracts/05.md#lfaa-ai-workspace-projects-01) |
| LFAA-UI-APP-CENTER-ENTRY-01 | 将应用中心设为进入与切换 App 能力的唯一交互入口，拦截无应用中心来源的 App 深链，并让跨 App 会话/快捷入口先回到应用中心 | 已实现（Web 构建、差异检查与登录态浏览器入口核验通过） | [合同](archive/contracts/07.md#lfaa-ui-app-center-entry-01) |
| LFAA-UI-SETTINGS-RESPONSIVE-01 | 按设置正文实际宽度完善设置中心响应式排版 | 已修复（Web 构建、分屏/宽屏/窄屏浏览器目视及横向溢出检查通过） | [合同](archive/contracts/05.md#lfaa-ui-settings-responsive-01) |
| LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01 | 模式切换时保留用户主动设置的应用侧栏收起状态 | 已修复（前端构建通过；浏览器交互待验） | [合同](archive/contracts/02.md#lfaa-ui-workbench-chrome-persistence-01) |
| LFAA-UI-AI-PROVIDER-LOADING-01 | AI Work 加载 Provider 时不短暂误报未配置 | 已修复（Vite 构建通过；完整构建受 TypeScript 错误阻塞；浏览器交互待验） | [合同](archive/contracts/03.md#lfaa-ui-ai-provider-loading-01) |
| LFAA-UI-MODULE-NOTIFICATIONS-01 | 优化应用侧栏顶栏的左右布局，并提供真实 AI Work 完成通知卡片 | 已完成（构建通过；浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-ui-module-notifications-01) |
| LFAA-UI-SETUP-REMINDER-PERFORMANCE-01 | 修复首次配置提醒弹窗打开卡顿，避免全屏实时模糊和工作台整树重渲染 | 复查中（用户反馈仍卡；运行版本未核实） | [合同](archive/contracts/03.md#lfaa-ui-setup-reminder-performance-01) |
| LFAA-PERFORMANCE-ROOT-CAUSE-01 | 定位并修复设置中心与整个项目普遍卡顿 | 调查中（待运行时性能证据；此前误判的遮罩样式已恢复） | [合同](archive/contracts/04.md#lfaa-performance-root-cause-01) |
| LFAA-SETTINGS-MINECRAFT-OWNER-01 | 将 Minecraft 运行配置从 AI Runtime 分类和存储中拆分 | 实现、构建与回归通过；运行时未重启 | [合同](archive/contracts/05.md#lfaa-settings-minecraft-owner-01) |
| LFAA-STEAMCMD-CONFIG-INSTALL-01 | 分离 SteamCMD 专项配置与应用存储，并让在线安装可独立选择目标节点 | 合同已登记，待实现 | [合同](archive/contracts/04.md#lfaa-steamcmd-config-install-01) |
| LFAA-APP-SETTINGS-SCOPE-01 | 共用账户偏好与三种 App 的业务配置分域，并让现有 App 配置范围互不串改 | 已实现（前端构建通过；浏览器范围切换待验） | [合同](archive/contracts/04.md#lfaa-app-settings-scope-01) |
| LFAA-UI-WRITING-SIDEBAR-01 | 将写作常规模式的作品与章节导航移入应用侧栏空白区，移除编辑页常驻导航列 | 已实现（前端 TypeScript/Vite 构建通过；浏览器目视待验） | [合同](archive/contracts/04.md#lfaa-ui-writing-sidebar-01) |
| LFAA-UI-WRITING-NO-TERMINAL-01 | 写作 App 隐藏不使用的共享节点任务输出面板，不影响其他 App 的终端入口与状态 | 已实现（Web 构建与差异检查通过；浏览器目视受 Edge 连接器故障阻塞） | [合同](archive/contracts/05.md#lfaa-ui-writing-no-terminal-01) |
| LFAA-WRITING-VOLUME-GROUPING-01 | 在现有写作作品目录内增加卷分组，保留章节数据并支持在指定卷中新建章节 | 实现完成（v27 迁移专项通过；浏览器交互待验） | [合同](archive/contracts/04.md#lfaa-writing-volume-grouping-01) |
| LFAA-WRITING-AGENT-PLACEMENT-01 | 让写作 Agent 按自然语言目标将内容精确写入当前作品大纲或章节正文，并经逐项审批与业务服务持久化 | 已接入（前后端构建通过；Provider 工具调用和浏览器交互待验） | [合同](archive/contracts/04.md#lfaa-writing-agent-placement-01) |
| LFAA-DEEPWRITE-WRITING-SKILLS-01 | 参考 DeepWrite 方法，增强写作 Agent 的按需 Skills、自然语言目标提示与唯一锚点编辑工具 | 实现完成（server 类型检查/构建和差异检查通过；Provider 交互待验） | [合同](archive/contracts/04.md#lfaa-deepwrite-writing-skills-01) |
| LFAA-WRITING-PROMPT-LIBRARY-01 | 整理外部 14 份网文提示词，优化后加入写作工作区并按需供模型读取 | 已接入（相关包构建、Host 类型检查和差异检查通过；模型交互待验） | [合同](archive/contracts/04.md#lfaa-writing-prompt-library-01) |
| LFAA-DEEPWRITE-WRITING-INTEGRATION-01 | 按 LFAA 既有 Owner 分阶段接入 DeepWrite 的作品资料、审阅式 Agent 写作、专职流程与分析能力 | P1–P5 已实现；定向回归 5/5、客户端类型检查与 Web 构建通过；折叠侧栏重新进入验收通过；真实 ZIP 文件交互、Provider 与 DeepWrite 客户端互操作待实测 | [合同](archive/contracts/04.md#lfaa-deepwrite-writing-integration-01) |
| LFAA-APP-SANDBOX-01 | 将应用作为安全范围、模式作为应用内交互方式，并为当前 Minecraft Daemon 接入 fail-closed Windows OS 沙盒 | 实现代码已接入（Windows 实机验收待做） | [合同](archive/contracts/01.md#lfaa-app-sandbox-01) |
| LFAA-UI-WORKBENCH-DEFAULTS-01 | 稍微收窄工作台左右栏默认展开宽度，并让右侧工具栏默认收起 | 已完成（前端构建通过；浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-ui-workbench-defaults-01) |
| LFAA-UI-WORKBENCH-SNAP-01 | 修复工作台左右栏吸附收起/展开残影、拖尾及过程中的横向滚动条 | 已修复（Vite 构建通过；TypeScript 检查被其他文件错误阻塞；浏览器实拖待验） | [合同](archive/contracts/01.md#lfaa-ui-workbench-snap-01) |
| LFAA-UI-WORKBENCH-SNAP-02 | 修复按住鼠标从吸附收起反向拉出时侧栏展开突跳、手感卡顿 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | [合同](archive/contracts/03.md#lfaa-ui-workbench-snap-02) |
| LFAA-UI-WORKBENCH-SNAP-03 | 统一设置和应用工作区左右侧栏及底部终端的拉伸、吸附收起与反向展开动效 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | [合同](archive/contracts/03.md#lfaa-ui-workbench-snap-03) |
| LFAA-UI-SIDEBAR-GLASS-STABILITY-01 | 修复左侧栏悬停预览和拉伸期间透明度/背景模糊突变 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器悬停与实拖待验） | [合同](archive/contracts/03.md#lfaa-ui-sidebar-glass-stability-01) |
| LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01 | 修复左侧栏收起预览 hover 移出时末尾突隐 | 移出动效已调优（Web 构建、差异检查通过；浏览器 hover 待实测） | [合同](archive/contracts/03.md#lfaa-ui-left-preview-hover-stability-01) |
| LFAA-UI-WORKBENCH-SWAP-CONTROL-01 | 让交换按钮仅在鼠标移入右侧拉伸位置时显示，移出后隐藏 | 已修复（前端构建通过；浏览器交互待验） | [合同](archive/contracts/01.md#lfaa-ui-workbench-swap-control-01) |
| LFAA-SETTINGS-GLOBAL-NAV-01 | 将应用工作区左侧全局导航轨复用到设置中心，统一两处导航外壳 | 已完成（TypeScript/Vite 构建通过；浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-settings-global-nav-01) |
| LFAA-SETTINGS-RETURN-CONTEXT-01 | 设置中心全局导航房子和侧栏返回均回到进入设置前的路由 | 已修复（TypeScript/Vite 构建通过；浏览器交互待验） | [合同](archive/contracts/01.md#lfaa-settings-return-context-01) |
| LFAA-UI-COMPOSER-PANE-SWAP-01 | 按 Codex 对话输入框的交互层级优化 AI Work 输入区，并允许桌面工作台交换中间区与右侧工具资源栏 | 已完成（前端构建通过；浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-ui-composer-pane-swap-01) |
| LFAA-KNOWLEDGE-LIBRARY-01 | 增加账户隔离的 Markdown 知识/Skill/Prompt/专家资料库，支持低 token 按需检索、上传、对话沉淀和受控本地项目链接，并复用 MCP 搜索 | 已实现（定向回归 2/2、Host/Client 类型检查、11 个相关包构建通过；登录界面、Provider 与实时 MCP 待验） | [合同](archive/contracts/07.md#lfaa-knowledge-library-01) |
| LFAA-UI-AI-PERMISSION-POPOVER-01 | 将 AI Work 权限模式菜单收敛为紧凑弹层，展示 LFAA 现有三种权限模式 | 已按反馈修订（前端构建与差异检查通过；浏览器目视待验）；执行语义以 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准 | [合同](archive/contracts/01.md#lfaa-ui-ai-permission-popover-01) |
| LFAA-SETTINGS-APPEARANCE-DEFAULTS-01 | 对齐外观设置默认值与工作区 CSS 兜底值，保留各组件独立外观 | 已完成（前端与 server 构建通过；背景路由映射静态核对；浏览器目视待验） | [合同](archive/contracts/03.md#lfaa-settings-appearance-defaults-01) |
| LFAA-UI-CENTER-SCROLLBAR-HIDE-01 | 隐藏应用工作区中间内容区的滚动条，同时保留原有滚动能力 | 已修复（前端构建通过；浏览器目视与滚动交互待验） | [合同](archive/contracts/03.md#lfaa-ui-center-scrollbar-hide-01) |
| LFAA-UI-SCROLLBAR-APPEARANCE-01 | 统一全站可见滚动条视觉并跟随外观设置主题、强调色与对比度 | 已实现（Web 构建与差异检查通过；浏览器目视待验） | [合同](archive/contracts/05.md#lfaa-ui-scrollbar-appearance-01) |
| LFAA-UI-AI-SCROLL-FOLLOW-01 | 修复 AI Work 流式回复跟随丢失并保留主动上滚，消除回到底部时的瞬间跳动 | 续修实现、定向回归与 Web 构建通过；真实浏览器滚动待测 | [合同](archive/contracts/05.md#lfaa-ui-ai-scroll-follow-01) |
| LFAA-UI-AI-STREAM-CARET-COMPACT-01 | 修复 AI Work 流式光标错位并收紧回复活动状态与交互卡之间的留白 | 聊天包与 Web 构建、12 项滚动回归、CSS 解析及差异检查通过；浏览器目视待验 | [合同](archive/contracts/06.md#lfaa-ui-ai-stream-caret-compact-01) |
| LFAA-UI-AI-CONVERSATION-ANCHOR-SPACING-01 | 让 AI Work 会话导航随提问数量动态增长并等距排列，支持整轨跟随、卡片暂停、平滑阶梯反馈和真实锚点跳转 | 19 项定向回归、聊天包和完整 Web 构建通过；登录态浏览器目视待验 | [合同](archive/contracts/01.md#lfaa-ui-ai-conversation-anchor-spacing-01) |
| LFAA-UI-AI-CONVERSATION-ANCHOR-INTERACTION-02 | 修复 AI Work 对话锚点卡片停留、单项强调色、手形光标、可点击命中区和横杠粗细一致性 | 实现与定向验证通过；IAB 登录态悬停样式核对通过；物理鼠标帧时间未测 | [合同](archive/contracts/01.md#lfaa-ui-ai-conversation-anchor-interaction-02) |
| LFAA-UI-AI-STOP-BUTTON-ACCENT-01 | 将 AI Work 运行中的停止按钮改为设置强调色圆钮与方形停止图标 | 已实现（聊天包/Web 构建、CSS 解析和目标差异检查通过；登录态浏览器配色目视待验） | [合同](archive/contracts/06.md#lfaa-ui-ai-stop-button-accent-01) |
| LFAA-UI-MODE-TOGGLE-RESPONSIVE-01 | 响应式中间工作区将常规 / AI Work 模式切换栏居中 | 已实现（Web 构建及本地浏览器目视通过；窄视口实测待做） | [合同](archive/contracts/05.md#lfaa-ui-mode-toggle-responsive-01) |
| LFAA-UI-AI-APPROVAL-QUICK-ACTIONS-01 | 在 AI Work 审批提醒中直接批准本次操作或拒绝，免去先打开会话的步骤 | 已实现；交互入口由 `LFAA-UI-AI-INTERACTION-DOCK-01` 收敛并替代 | [合同](archive/contracts/05.md#lfaa-ui-ai-approval-quick-actions-01) |
| LFAA-UI-AI-INTERACTION-DOCK-01 | 将审批与模型澄清统一为输入框上方的单一交互栏 | 已实现（Web 构建通过；控制端构建受无关工作区包类型错误阻塞；真实 Provider 浏览器交互待验） | [合同](archive/contracts/05.md#lfaa-ui-ai-interaction-dock-01) |
| LFAA-UI-AI-RUN-REFRESH-01 | 修复 AI Work 刷新恢复时误报重新处理，并显示持久化的真实等待时长 | 已修复（定向回归 4/4、客户端性能回归 13/13、聊天包与 Web 构建通过；登录态刷新待实测） | [合同](archive/contracts/06.md#lfaa-ui-ai-run-refresh-01) |
| LFAA-UI-AI-ANCHOR-PREVIEW-01 | 收紧 AI Work 对话锚点纵向间距与鼠标悬浮预览卡宽度 | 已修复（定向回归 12 项、完整 Web 构建、登录态页面间距目视核验通过） | [合同](archive/contracts/05.md#lfaa-ui-ai-anchor-preview-01) |
| LFAA-UI-AI-DRAFT-PERSISTENCE-01 | 审查刷新后的主要工作状态，并让 AI Work 未发送草稿可恢复 | 草稿恢复已实现（2 项定向回归、Web 构建通过；登录态浏览器刷新待验）；文件编辑草稿与部署向导草稿列为后续专项审查 | [合同](archive/contracts/05.md#lfaa-ui-ai-draft-persistence-01) |
| LFAA-UI-CLIENT-PERSISTENCE-CORE-01 | 建立可复用的浏览器端持久化与防抖恢复能力 | 共享层实现、5 项定向回归与 Web 构建通过；登录态刷新待验 | [合同](archive/contracts/05.md#lfaa-ui-client-persistence-core-01) |
| LFAA-UI-CENTER-RESIZE-REFLOW-01 | 中间列缩窄时让 Minecraft 卡片按实际可用宽度排版，减少内容跳动 | 已完成（Vite 构建通过；完整构建被无关 TypeScript 错误阻塞；浏览器拖拽待验） | [合同](archive/contracts/03.md#lfaa-ui-center-resize-reflow-01) |
| LFAA-UI-WORKBENCH-RESPONSIVE-02 | 优化 AI Work 窄屏左右栏联动、右栏拖拽和中心区最小宽度 | 实现完成，构建/定向回归通过；窄 Dock 和拖拽已在 5173 实测 | [合同](archive/contracts/07.md#lfaa-ui-workbench-responsive-02) |
| LFAA-UI-WORKBENCH-REFLOW-STABILITY-01 | 修复左右菜单和底部终端开合时中间内容闪动、跳动 | 实现完成（静态核对；构建与浏览器目视待验） | [合同](archive/contracts/03.md#lfaa-ui-workbench-reflow-stability-01) |
| LFAA-P4-MINECRAFT-MVP-01 | 按用户优先级先完成 Minecraft 管理 MVP，并为后续应用保留统一工作台与 AI Runtime 边界 | 进行中 | [合同](archive/contracts/01.md#lfaa-p4-minecraft-mvp-01) |
| LFAA-MINECRAFT-CONTROL-CENTER-01 | 将 Minecraft 总览整理为真实状态监控卡片中心，并补齐控制节点页面与分类菜单 | 实现完成（前端构建、Manager 健康与 Daemon 心跳通过；浏览器目视验收待做） | [合同](archive/contracts/03.md#lfaa-minecraft-control-center-01) |
| LFAA-MINECRAFT-TASK-RECOVERY-01 | 修复 SQLite 迁移测试版本断言，并为 Minecraft Daemon 任务加入心跳租约和中断恢复 | 已完成（测试与完整构建通过；真实 Minecraft 未验） | [合同](archive/contracts/01.md#lfaa-minecraft-task-recovery-01) |
| LFAA-P1-01-05 | 完成依赖与持久化、server 基础、应用中心、前后端健康状态闭环、账户登录与权限基础 | 进行中 | [合同](archive/contracts/02.md#lfaa-p1-01-05) |
| LFAA-P1-01-07 | 提供根目录并行开发启动命令和 Windows 单窗口一键启动入口 | 已完成 | [合同](archive/contracts/02.md#lfaa-p1-01-07) |
| LFAA-DEV-STARTUP-RESILIENCE-01 | 避免旧服务占端口时误启新实例，并让 Daemon 等待控制端就绪 | 实现完成（代码静态检查；Windows 启动实测待验） | [合同](archive/contracts/02.md#lfaa-dev-startup-resilience-01) |
| LFAA-UI-MODULE-CANVAS-01 | 让所有应用模式的中间工作区铺满可用区域，并让 AI Work 中间区只显示对话 | 已完成（浏览器目视待验） | [合同](archive/contracts/02.md#lfaa-ui-module-canvas-01) |
| LFAA-UI-WRITING-AI-CENTER-01 | 让写作 AI Work 空状态沿用共享中间聊天区样式，并完整说明外观设置影响范围 | 实现完成（前端构建与差异检查通过；登录后浏览器目视待验） | [合同](archive/contracts/04.md#lfaa-ui-writing-ai-center-01) |
| LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01 | 移除 AI Work 消息画布重复的整面遮罩和模糊，让中间区透出工作台统一壁纸 | 实现完成（前端构建与静态映射核对通过；登录后目视待验） | [合同](archive/contracts/04.md#lfaa-ui-ai-work-canvas-background-01) |
| LFAA-UI-HOME-RESPONSIVE-01 | 收紧应用中心桌面留白并适配矮窗口 | 已完成（浏览器目视待验） | [合同](archive/contracts/02.md#lfaa-ui-home-responsive-01) |
| LFAA-UI-APP-CENTER-POLISH-01 | 优化应用中心主次层级、入口卡片和重复状态信息 | 已完成（Web 构建、差异检查及 3/2/1 列登录态目视通过） | [合同](archive/contracts/05.md#lfaa-ui-app-center-polish-01) |
| LFAA-UI-APP-CENTER-POLISH-02 | 优化应用中心标题、专业应用卡片层级、状态可读性与模式按钮触达 | 已实现（Web 构建、差异检查通过；浏览器目视受本机服务状态限制） | [合同](archive/contracts/07.md#lfaa-ui-app-center-polish-02) |
| LFAA-SETTINGS-AI-GROUP-SPACING-01 | 修正 AI 账户区与推理参数标题的间距 | 已完成（浏览器目视待验） | [合同](archive/contracts/02.md#lfaa-settings-ai-group-spacing-01) |
| LFAA-UI-PERF-SETTINGS-01 | 修复设置中心主题闪烁与重复加载，并优化按需读取 | 已完成 | [合同](archive/contracts/02.md#lfaa-ui-perf-settings-01) |
| LFAA-UI-PERF-SETTINGS-02 | 降低设置中心长分类滚动时的布局与绘制负担 | 已完成（登录后滚动帧采样待实测） | [合同](archive/contracts/02.md#lfaa-ui-perf-settings-02) |
| LFAA-UI-SETTINGS-PRELOAD-01 | 预热设置页代码，减少首次进入时的等待与闪动 | 已完成（浏览器冷启动目视待验） | [合同](archive/contracts/02.md#lfaa-ui-settings-preload-01) |
| LFAA-UI-REFRESH-PERSISTENCE-01 | 修复刷新期间的登录闪现并记住设置分类与滚动位置 | 已完成（浏览器刷新实测待验） | [合同](archive/contracts/02.md#lfaa-ui-refresh-persistence-01) |
| LFAA-UI-SESSION-RESTORE-STARTUP-01 | 缩短已登录页面刷新的工作台恢复链路，避免额外串行读取初始化状态 | 已修复（定向回归 3/3、Web 类型检查与构建通过；登录态刷新耗时待实测） | [合同](archive/contracts/06.md#lfaa-ui-session-restore-startup-01) |
| LFAA-UI-SETTINGS-REFRESH-PRELOAD-01 | 直达刷新设置中心时并行预热工作台与设置页代码，消除串行加载回退 | 已修复（定向回归 4/4、Web 类型检查与构建通过；登录态刷新目视与网络瀑布待验） | [合同](archive/contracts/06.md#lfaa-ui-settings-refresh-preload-01) |
| LFAA-UI-SCROLL-RESTORATION-SHARED-01 | 统一恢复设置与各功能页面的滚动位置 | 实现完成（构建通过；浏览器刷新验收待验） | [合同](archive/contracts/03.md#lfaa-ui-scroll-restoration-shared-01) |
| LFAA-SETTINGS-AUTOSAVE-01 | 让设置中心所有已接入的账户设置自动持久化 | 修复完成（外观字段白名单已对齐；前后端构建通过；登录后刷新实测待验） | [合同](archive/contracts/03.md#lfaa-settings-autosave-01) |
| LFAA-SETTINGS-BACKGROUND-RENDER-01 | 修复设置中心所选背景被内部工作台与侧栏底色遮挡 | 已修复（前端构建通过；浏览器目视待验） | [合同](archive/contracts/03.md#lfaa-settings-background-render-01) |
| LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01 | 统一设置中心、应用常规与 AI Work 的背景绘制及遮罩透明度 | 实现完成（前端构建通过；浏览器目视待验） | [合同](archive/contracts/03.md#lfaa-workspace-background-unification-01) |
| LFAA-SETTINGS-NOTIFICATIONS-01 | 将设置中心通知接入真实 AI Work 完成事件与浏览器通知 | 已完成 | [合同](archive/contracts/02.md#lfaa-settings-notifications-01) |
| LFAA-SETTINGS-TYPOGRAPHY-01 | 统一设置中心字号层级并显露外观字号控制 | 已完成（浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-settings-typography-01) |
| LFAA-SETTINGS-LAYOUT-UNIFICATION-01 | 统一设置中心全部分类的布局、尺寸与间距 | 已完成（浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-settings-layout-unification-01) |
| LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01 | 对齐设置侧栏顶部的返回与收起按钮 | 已完成（Vite 构建通过；类型检查受其他文件错误阻塞，浏览器目视待验） | [合同](archive/contracts/01.md#lfaa-settings-sidebar-header-alignment-01) |
| LFAA-FRONTEND-CSS-SHARED-01 | 建立清晰的前端公共 CSS 入口并分离共享样式 | 已完成 | [合同](archive/contracts/02.md#lfaa-frontend-css-shared-01) |
| LFAA-AI-ARCH-01 | 建立 AI 插件宿主的最小后端基础并验证 Cordis | 已完成 | [合同](archive/contracts/02.md#lfaa-ai-arch-01) |
| LFAA-AI-RUNTIME-01 | 完成 AI Work Runtime 并按业务归属接入设置中心 | 进行中 | [合同](archive/contracts/02.md#lfaa-ai-runtime-01) |
| LFAA-AI-PERMISSIONS-01 | 将 AI 工具权限接入三种模式、可记忆授权和独立审批控制 | 已完成 | [合同](archive/contracts/02.md#lfaa-ai-permissions-01) |
| LFAA-AI-PERMISSION-MODE-EXECUTION-02 | 落实三种项目权限模式、Daemon 主机命令执行，并修复权限弹层外观 | 实现完成（Server、前端、Daemon 构建与差异检查通过；浏览器及真实 Daemon 验收待运行环境） | [合同](archive/contracts/01.md#lfaa-ai-permission-mode-execution-02) |
| LFAA-AI-PERMISSIONS-DB-01 | 修复 AI 审批与记忆授权表的版本 8 数据库迁移兼容 | 已完成 | [合同](archive/contracts/02.md#lfaa-ai-permissions-db-01) |
| LFAA-SERVER-POLL-LOG-01 | 降低健康与会话轮询成功日志的终端噪声 | 已完成 | [合同](archive/contracts/02.md#lfaa-server-poll-log-01) |
| LFAA-SETTINGS-PERMISSION-CLARITY-01 | 按 LFAA 当时的实际能力完善常规页访问边界说明与权限页策略说明 | 历史任务已完成；权限语义已由 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 更新 | [合同](archive/contracts/02.md#lfaa-settings-permission-clarity-01) |
| LFAA-OBS-SERVER-LOGS-01 | 观察开发终端中的偏好、AI 查询与认证日志；确认是否需要单独修复 | 待开始 | [合同](archive/contracts/01.md#lfaa-obs-server-logs-01) |
| LFAA-GITHUB-FORCE-PUSH-01 | 从根目录菜单一键提交纯净源码并安全推送或强制推送到指定 GitHub main | 已完成（语法与静态分支核对通过；GitHub 推送未运行） | [合同](archive/contracts/01.md#lfaa-github-force-push-01) |
| LFAA-REALTIME-SOCKET-01 | 为 Minecraft 现有任务、日志与状态接入经会话认证的 Socket.IO 实时推送 | 已完成（代码与自动验证） | [合同](archive/contracts/03.md#lfaa-realtime-socket-01) |
| LFAA-SETTINGS-CENTER-CLEANUP-01 | 依据设置中心审查结论整理导航、重复入口与尚未生效的设置项 | 本轮仅归档；整改待开始（排在架构升级后） | [合同](archive/contracts/04.md#lfaa-settings-center-cleanup-01) |
| LFAA-DOMAIN-PROMPT-INTEGRATION-01 | 将 Minecraft 与小说领域提示词按 LFAA 真实能力接入 AI Work | 已接入（五个目标包构建、差异检查通过；Host TypeScript 有并行源码错误；Provider/实机待验） | [合同](archive/contracts/04.md#lfaa-domain-prompt-integration-01) |

<a id="lfaa-web-menu-startup-ps51-20261009"></a>

<a id="lfaa-remaining-gap-repair-20261008收敛四项明确的代码缺口"></a>

## 01-缺口修复-20261008

### 目标、入口与 Owner

- 用户要求继续修复上一轮明确列出的 Tauri 旧关闭路径、Session 列表分页、MCP 连接复用和 Web 大块告警。
- Tauri 仅是兼容外壳，Node app-boot 仍拥有 Control Plane/Daemon 的退出生命周期；不得在跨平台兼容壳内以 `Child::kill` 冒充正常卸载。
- Session JSONL 保持事件/消息唯一权威、账户 SQLite 仅存列表索引；分页/API/UI 仍由现有 Session Owner 与调用组件承接。
- MCP 连接只由 MCP Tools Owner 管理；空闲连接只在相同账户/App/服务完整配置内复用，租约关闭后不可继续调用，配置变化或停用在下一次权威发现时使旧连接失效。
- Web 入口与首屏使用当前已有 DSH module lazy-loader；不改变应用功能、外观设置或插件 Owner，仅以实际构建 chunk 证据做拆分。

### 设置、数据与验收边界

- 不新增设置，不改变账户/App 权限、`plugins.mcpServers`/App 过滤、会话分页排序/归属、桌面数据路径或外观偏好。
- 允许新增窄型单元/组件回归，执行客户端/Host 类型检查、Tauri Rust 检查、MCP/Session 定向回归和根 dist 隔离 Web 构建；不得重启在用服务、安装/升级实际桌面包、启动/停止真实游戏实例、远程 dispatch CI、提交或发布。
- 静态/替身回归不等于 Tauri 桌面退出验收、MCP 真实供应商往返、真实浏览器 frame-time 或远端 CI。

### 实施记录

- Tauri 兼容路径由 app-boot 接受精确 `lfaa-shutdown` stdin 行，和 IPC/SIGTERM 共用同一个幂等 Fiber dispose；Tauri 逐个请求并等待 Daemon/Control Plane 退出，超时或非零结果不强杀进程、拒绝关闭并恢复窗口状态。`configure-tauri-output.mjs` 可修复指向旧根目录且已断开的 `gen` junction，只删除断开的链接本身并重新指向当前根 `dist`。
- Session JSONL 增加 1–100 条游标页，仍以既有 Session Owner 检查账户归属；页面和侧聊均可向前加载并保留视口。每页两次同步扫描并校验完整哈希链，内存受 64 KiB 读缓冲、单个事件行和页大小限制；CPU 工作仍随完整日志增长，未实现索引、压缩或沉降。
- MCP Tools Owner 为服务会话增加账户/App/完整配置指纹隔离池：最大 32 条、空闲 30 秒回收；Agent Run 与安装适配器传入账户上下文，设置快照变化/停用会在下一次发现时撤销旧租约。回归验证同配置复用且账户/App/名称变化均不复用。
- Web 基于构建证据拆出 `simple-icons`、KaTeX、ReactDOM、语法核心/基础语法、Markdown、DSH 原语及 C++ 宏/正则块；entry chunk 由约 1363 kB 降到 19.2 kB。隔离构建中 C++ grammar 约 501.3 kB（gzip 33.5 kB），仍略超 Vite 500 kB 告警线；未调高阈值或声称该懒加载块不存在。entry chunk 变小不等于首屏总传输下降；没有运行浏览器帧时间测量。
- 无新增设置项。Client/Host 类型检查、Session 冷缓存/分页与 MCP 工具、安装适配器、Agent Runtime 定向回归、Tauri Windows MSVC 目标开发与 Release `cargo check` 和 Web 根 `dist/.tmp` 隔离构建完成。未重启在用服务、未安装/升级桌面包、未停真实游戏、未触发远端 CI、未提交或发布。


<a id="lfaa-workspace-audit-repair-20261008"></a>

<a id="lfaa-workspace-audit-repair-20261008全仓审查风险修复与文档治理"></a>

## 02-全仓审查整改-20261008

### 目标、Owner 与设置

- 核对用户提供的 GLM 审查，按当前源码区分真实缺陷、已声明限制、历史事实和错误判断；参考用户指定的 H:/deepseek-harness 文档分类与语言配对，只修改当前 LFAA1。
- 入口：Web/CLI 的现有控制端与 Windows Daemon、Electron 主进程。任务认证/租约归 Jobs/API，实例进程归 Daemon；Session JSONL 仍为权威，SQLite 仅为索引；设置归 Settings，客户端消费共享纯数据合同。
- 沿用 aiRuntime.commandTimeoutSeconds（默认 0）及 Minecraft 的就绪/停止/安装/下载超时、权限模式、Provider/MCP App 范围和全部外观偏好。不得改变用户值或将未接入 App 项目能力开放。文档及工程门禁不新增账户设置。

### 允许与禁止边界

- 允许修复已证实的节点任务阻塞、停机生命周期、会话读取工作量、设置默认/校验重复、App 范围清单重复，以及直接相关长期回归。
- 允许维护根构建/类型映射/工作区盘点/版本与文档检查、最小 CI、菜单危险入口、受影响包 README 和事实文档。文档按专题、用户指南、审查记录和历史合同分类，中英文入口说明同步，保留权威版本日志和历史证据。
- 允许删除明确与产品无关的 CAD 附件及已实现包中的无用 .gitkeep；用户要求的上游空目录仍保留。真实数据、凭据、正式备份、旧发行安装包、依赖目录不清理；不重写 Git 历史。
- 禁止回退既有桌面更新等工作树改动；不另建身份/权限/Session/执行器；不为使检查通过删断言或造状态。只允许对账已使用的依赖声明、修复有证据的不兼容依赖和维护者安全补丁，不新增无关库；不重启在用服务、不提交/推送/发布/升级安装，不改对外版本。

### 验收

- 当前客户端/Host 类型检查、直接相关长期回归、工作区/版本/依赖/路径/文档检查、受影响职责构建与差异检查。
- 保留 baseline 工作树清单，最终逐文件记录职责与变更，GLM 结论逐项给出证据和处理结果。
- 性能证据区分查询/调度工作量与真实浏览器/桌面帧时间；不得以替身测试声称真实 Minecraft、Provider、桌面退出/升级或所有平台已验收。
- workspace-preflight 如不存在，明确记录；实现新的工程检查使用真实名称，不冒充旧 Gate。

### 实施记录

- 逐项核验 GLM，拆开真实缺陷、合同边界与历史事实。修复 Shell/运维互相阻塞、IPC 安全退出及受管进程失败确认、Session 正文缓存和列表 Kernel 恢复、设置权威重复/写入缺口、背景反向依赖、Windows 凭据目录 ACL、workspace 入口/依赖与测试隔离；兼容旧快捷键值而不放宽非法新值。
- 生产审计发现 KaTeX 低危已知告警，按维护者修复版 0.18.2 同步直接/间接依赖；既有 React 插件升级 4.3.4 以支持 Vite 5，未升级 Vite 主版本或产品发行版本。使用官方 registry 核验，未改变永久 registry 设置。
- 新增工作区 Gate、类型映射生成和 Linux/Windows CI；CI YAML 本地结构检查通过，远端 CI 未运行。移除 main 强推菜单。保留 apps/packages/native/scripts 等职责骨架，未照搬 DSH 业务目录。
- 文档按 user/subsystems/development/reference/i18n/archive 分类，新增中英文入口与专题配对；171 份旧合同分九档保留 ID/锚点/索引，原计划完整归档。权威架构、规范、版本日志和当前合同保持原路径。删除无关 CAD 与 16 个空标记，保留上游占位、备份、旧安装包和所有真实用户数据。
- 本地：33 个 CLI 文件 114 项通过；最终停机组 7 项（4 项重复）和 MCP 协议 1 项通过；Electron 当前全部 52 项、工程/安全 6 项通过。Client/Host 类型检查、Host 暂存/Web 隔离构建、工作区 Gate、peer 检查、菜单/入口语法与差异检查通过。生产依赖审计 439 条目零已知告警，未运行全量开发依赖审计。
- 性能已验证工作量边界：两个执行槽、领取不重叠；正文缓存 8 会话/32 MiB；列表 200 个且不恢复 Kernel；快捷键不随无关设置重挂。Web 仍有大块告警；浏览器帧时间、实际 Electron/游戏/Provider、多平台包和线上更新未验收。Tauri 兼容停机、长运维任务、单会话同步扫描/分页/压缩、MCP 池化及大文件拆分记录在当前计划，不宣称全仓零问题。
- workspace-preflight 当前不存在，未运行；未重启在用服务、未安装或发布候选、未提交。一次性整改脚本交付前清理，保留基线/审查证据及长期回归。完整逐项结果与设置说明见 [本轮审查](development/workspace-audit-20261008.zh.md)，逐文件绝对路径与职责见 [变更清单](development/workspace-audit-files-20261008.md)。


<a id="lfaa-mcp-egress-session-paging-repair-20261008"></a>

<a id="lfaa-mcp-egress-session-paging-repair-20261008mcp-出站隔离与-session-分页单次异步校验"></a>

## 03-MCP出站与会话分页-20261008

### 目标、入口与 Owner

- 修复代码审查确认的两个问题：远程多账户控制端可被账户配置诱导访问私网 MCP 地址；超长 JSONL 会话分页每页同步扫描并校验完整日志两次。
- MCP 运行入口是 `packages/core/agent-loop` 与 `packages/boot/capability-mcp`；地址/传输与会话租约唯一由 `packages/core/tools` 的 MCP Tools Owner 管理；部署模式读取 `packages/util/launch-environment`。
- Session API 入口是 `packages/api/session-controller`；会话归属、游标和消息页投影属于 `packages/core/session`；JSONL 哈希链和扫描属于 `packages/session/session-persistence-jsonl`。不得建立平行 Session 或网络执行器。

### 设置、数据与验收边界

- 沿用 `plugins.enabled`、`plugins.mcpServers`、MCP `applicationIds`、`permissions.mode` 与 `aiRuntime.requestTimeoutSeconds`；不增加账户设置、不扩大 MCP 工具授权。本机桌面、loopback 开发与受限本机 CLI 场景仍须连接本机 MCP；生产远程控制端默认只允许公网可路由地址，DNS 解析结果须校验并绑定实际连接以防重绑定。
- MCP 仍禁止 URL 凭据、查询/片段及 HTTP 重定向；不得将用户配置变成跨账户网络权限。拒绝非公网地址时返回普通诊断，不泄露内部响应内容或地址解析细节。
- Session 单页改为一次异步流式扫描；仍校验完整 SHA-256 链，返回排序、反馈、游标及账户隔离语义不变；分页额外读取工作集为 64 KiB 缓冲、单条当前事件和至多 101 个候选消息，不读取整份正文到内存，不跳过完整性校验。仓库启动期间的事务去重索引仍按历史事务数增长；本修复不宣称解决该索引成本。
- 允许更新当前任务合同、架构事实、Owner README 和 MCP/Session 长期回归。禁止改账户偏好、真实设置、Provider/Daemon 行为；不连接真实 MCP，不重启服务、不修改真实数据、不提交或发布。

### 验收

- 覆盖 loopback/私有/链路本地/IPv4 映射 IPv6、DNS 混合解析与重绑定固定、全局 IPv4/IPv6、重定向拒绝和本机 MCP 保持可用；本地夹具不连接真实用户服务。
- 覆盖单次扫描下的多页顺序、边界游标、反馈、账户隔离、日志破损拒绝，以及异步流关闭/错误处理；运行 MCP 与 Session 定向回归、Client/Host 类型检查、直接相关构建、workspace Gate 与差异检查。
- 性能证据：页面请求创建一条有文件大小上界的异步流并遍历完整 SHA-256 链一次；候选集上限为 `limit + 1`（最多 101），额外读取缓冲为 64 KiB。隔离 130 条消息/2 个事件的合成日志为 32,866 字节，`limit=50` 时读取流 1 次、扫描 32,866 字节并返回 50 条；真实长日志耗时/内存曲线未测，仓库既有事务索引也未计入分页额外工作集。远端多账户部署与浏览器/桌面验收必须明确标记未验收。

### 实施记录

- 已实施。`config.ts` 将桌面、本机 CLI 回环和开发/测试回环与远程生产模式分开；MCP 每次请求校验全部 DNS 地址并将 HTTP(S) socket 绑定到已校验结果，HTTP 重定向仍拒绝。`readMessagePage()` 改为异步单遍流式校验，使用二分定位维护至多 101 条排序候选，避免逐事件重复排序；API 等待该读取完成后再返回。
- 验证：`pnpm --dir apps/cli typecheck` 通过；`mcp-tools.test.mjs` 2/2、`session-cache.test.mjs` 1/1、`harness-agent-api.test.mjs` 1/1 通过。完整装配测试新增认证分页断言，并将记忆回读改为等待有上限的异步持久化；用量断言改走 Session Owner API，不再查询已退役的 SQLite `ai_usage` 表。`check:workspace`、受影响包构建及最终差异检查记录于本轮审查。
- 尚未验收：长会话真实耗时/内存和日志大小基准、远程多账户生产部署、用户 MCP 服务、浏览器/桌面交互；每页仍为 O(整份日志)，仓库恢复的事务索引仍按历史事务增长。

<a id="lfaa-agent-stdio-computer-use-20261008"></a>

<a id="lfaa-agent-stdio-computer-use-20261008模型驱动-agent-本机-mcp-与-computer-use-执行链"></a>

## 04-本机MCP电脑操作-20261008

### 目标、入口与 Owner

- 目标是沿用 AI Work 的模型工具循环，让模型根据自然语言目标发现并选择已登记 MCP 能力，真实调用本机 stdio MCP，把真实工具结果（含图像）交回模型后继续判断；Computer-Use MCP 是通用 Agent 能力的首个端到端适配场景。不得以关键词分支或固定游戏流程替代模型决策。
- 运行入口为 `packages/core/agent-loop`；MCP 传输、工具发现、会话生命周期与结果规范由 `packages/core/tools` 持有；账户 MCP 配置由 `packages/settings/settings` 与 `packages/util/values` 持有；设置 UI 由 `packages/client/ui-settings` 展示既有 Settings Owner 配置。
- 复用 `plugins.enabled`、服务 `enabled`、MCP `applicationIds`、`permissions.mode`、`aiRuntime.requestTimeoutSeconds` 与 `computerControl.enabled`；默认不启用插件、MCP 服务和本机电脑操控。Computer-Use 类型服务必须受电脑操控开关约束。本机 stdio 只能在本机桌面或本机 CLI 控制端启动，不得由远程生产 Web 控制端代替用户电脑启动进程。

### 修改边界与安全合同

- 允许修改以上 Owner 的类型、验证、传输、Agent 上下文与设置映射，以及对应 MCP/Agent 定向回归、能力包说明、当前架构和开发计划。允许配置用户明确指定的可执行文件及参数；进程必须以 `shell:false` 启动，参数有界，环境变量采用本机桌面必需项白名单；不接受 Shell 命令字符串或模型生成的进程配置。
- MCP `initialize.instructions` 与工具说明属于不可信能力资料，只可帮助理解工具，不可扩大用户本轮目标、授权范围或权限。外部声明的只读 annotation 不构成授权；MCP 调用继续按 `permissions.mode` 走现有高风险权限合同。Computer-Use MCP 额外检查当前账户 `computerControl.enabled` 及单一 App 范围。
- 只在当前 Provider 请求内发送合法、受大小限制的 MCP 图片；旧图、工具记录与 Session 模型历史均不得保存图片字节。无重试已派发调用；超时或断线时不得报告任务成功。子进程必须有界处理 stdout/stderr、响应、超时和退出，在用户 Run/租约结束后回收。
- 禁止改身份、Provider、会话、Daemon、系统权限模型、任意 Shell 工具、远程 Computer-Use、OAuth/密钥托管及真实用户应用状态；不安装/运行真实外部桌面控制程序，不重启服务，不提交或发布。

### 验收

- 以本地 stdio MCP 协议夹具覆盖握手、发现、图片/文字回传、超限/无效帧、初始化失败、取消/超时、子进程关闭、App/账户隔离、电脑操控开关、设置变更撤销及模型会话图片脱敏；保留现有 HTTP MCP、Agent 与游戏工具回归。
- 运行 MCP/Agent/Settings 直接回归、相关包构建、客户端与 Host 类型检查、Control Plane/Web 入口构建、workspace Gate、`git diff --check`。不连接真实 Provider，不触发真实桌面动作。
- 静态和夹具通过不代表真实 `open-computer-use`、真实屏幕/操作、Provider 视觉理解、浏览器、远程服务或打包桌面已验收；如本机未安装上游可执行文件，明确记录这一验收边界。

### 实施记录

- 已实施；开始实现前已盘点 MCP 配置默认值（全局默认关闭、服务器列表空）、持久化/校验与设置 UI，以及现有 `computerControl.enabled`、`permissions.mode` 权限边界。Agent Loop 仍由模型按工具合同和用户目标选择工具；本机 stdio 经 MCP Tools Owner 启动，initialize.instructions 作为不可信资料输入，文本/图像结果回到同一工具循环的下一次 Provider 请求。
- 权限与资源边界：stdio 只在本机桌面、本机 CLI 或 loopback 开发控制端可启动，使用 `shell:false`、至多 32 个且每个至多 1024 字符的参数、环境变量白名单、1 MiB 请求与 8 MiB 响应帧上限；进程按账户/App/配置隔离并在最后一份 Agent Run 租约释放时关闭。Computer-Use MCP 还要求账户电脑操控开关开启；所有 MCP 工具沿用 `permissions.mode` 高风险权限合同。图片仅作为本轮输入，图像字节会从模型历史与工具轨迹中移除。
- 验证：`pnpm --dir apps/cli typecheck`、客户端/Host `tsc --noEmit`、`mcp-tools.test.mjs` 3/3、`agent-runtime.test.mjs` 1/1、`settings-contract.test.mjs` 1/1、`capability-mcp.test.mjs` 1/1、`computer-use.test.mjs` 1/1、`pnpm run build:harness`（103 包）、`pnpm run build:control-plane`、`pnpm run build:web` 与 `pnpm run check:workspace` 均通过；Web 构建有既有大 chunk 提示。
- 尚未验收：上游 `open-computer-use` 可执行程序未安装，未连接真实 MCP、真实 Provider、Windows 桌面/屏幕或打包桌面；合成模型/协议夹具证明 LFAA 内部决策、调用、结果回传与进程回收，不代表真实视觉理解或真实游戏启动。
# LFAA-HARNESS-RUNTIME-INTEGRATION-20261009：完整运行链路修复

2026-10-09 用户补充：统一三种权限模式，删除领域提示词与工具中的额外强制人工确认；EULA、写作修改应用和生命周期/控制台选择均遵循同一 Permission Owner。保留真实执行、账户归属、参数和一致性合同。

用户要求以当前 DSH 源码为参考修复完整 Harness，核对两份豆姐交付记录；文件数量不作为能力验收。入口为 Web/desktop Profile → Agent Run → 原生工具目录 → 权限 → 实际 Owner/Daemon → 结果回传。保留当前未提交工作，不修改 DSH、真实账户/凭据/运行数据，不发布或提交。

Owner：app-boot/bundle 负责可加载装配与诊断；agent-loop 负责唯一运行、预算、取消及继承；skill/skill 与 tool-skill 负责真实目录和按需正文；subagent 复用该 Run 的委派合同；schedule 负责真实会话交付与历史；compaction 复用当前模型和请求预算；文件工具须遵守实际运行主机、项目与权限边界。设置沿用 plugins.enabled、permissions.mode、general.taskFolder/integratedShell、computerControl.enabled、aiRuntime 的模型/请求/输出/工具/委派/超时设置；缺少的 Skill 根和上下文管理配置先补齐共享默认、校验、持久化和设置 UI，保留用户偏好。

验收：真实隔离 Web Profile 启动；模型请求能发现并加载已登记 Skill；同 Run 工具更新/撤销；子任务继承项目/工具允许集/数量深度/拒绝状态与取消；调度成功必须有会话 Run 回执，无消费者不得假成功；压缩进入实际请求且计预算、不拆工具对、不损坏持久历史；本机/远端执行边界一致；长期集成回归、类型检查、构建及 workspace Gate。合成 Provider 与执行器证据须标注，真实 Provider/桌面/远端未运行不得宣称通过。逐文件、设置、真实验证与未覆盖范围见 [本轮运行链修复报告](development/harness-runtime-integration-20261009.md) 与 [逐文件清单](development/harness-runtime-integration-files-20261009.md)。

<a id="lfaa-plugin-lifecycle-session-responsive-20261016"></a>

<a id="lfaa-general-agent-capabilities-20261009"></a>

## 05-Agent通用能力-20261009

目标、Owner、设置、范围与验收见 [本轮合同](development/general-agent-capabilities-20261009.md)。用户要求整体补全指定 DSH 包对应的实际通用调用链；不按目录占位数量声明完成。本轮纠偏还补齐 `tool-workflow` 的真实聊天入口，让 Agent 能调用现有 Workflow Owner 完成发现、保存、运行和结果回传。

<a id="lfaa-ai-work-stream-caret-flicker-20261009"></a>

<a id="lfaa-ai-work-stream-caret-flicker-20261009"></a>

## 06-流式光标闪烁-20261009

历史修复已移除 `packages/client/ui-chat` 源码中的流式回复光标；本轮截图证明 Web 产品产物仍包含旧样式。本次补齐正式 Web 构建并检查实际产物，同时处理 Agent 对同一失败/结果未知工具的重复派发风险。范围和验收见[本轮合同](development/agent-stream-loop-repair-20261009.md)。

<a id="lfaa-ai-work-stream-repair-20261009"></a>

<a id="lfaa-ai-work-stream-repair-20261009"></a>

## 07-流式输出修复-20261009

修复 Web 产物仍显示已删除的流式光标；核验并保持 AI Work 的 Provider delta → Agent Run → SSE → React 实时更新；Agent 不得在同一运行中重新派发先前已失败或结果未知的同一工具与参数；修正本轮真实验证暴露的 5 项回归。项目级目标、Owner、设置、范围和验收见[本轮合同](development/agent-stream-loop-repair-20261009.md)。

<a id="lfaa-ai-work-sse-request-close-20261010"></a>

<a id="lfaa-agent-file-crud-20261009"></a>

## 08-Agent文件操作-20261009

让所有 App 中的模型驱动 Agent 能使用真实通用文件工具完成查询/读取、新建、更新/修复和删除。文件工具由目标节点 Daemon 的通用文件任务执行器运行；范围、设置、执行链和验收见[本轮合同](development/agent-file-crud-20261009.md)。

<a id="lfaa-agent-reply-handoff-20261009"></a>

<a id="lfaa-agent-reply-handoff-20261009"></a>

## 09-回复流程交接-20261009

修复 Agent 首次 Provider 请求前的本地准备阶段阻断：Skill 目录改为模型按需发现；推理前异常写入可见运行轨迹；回归核实最终回复与 SSE 流。详细运行证据、范围、Owner 与验收见[本轮合同](development/agent-reply-handoff-20261009.md)。

<a id="lfaa-agent-response-delivery-20261009"></a>

<a id="lfaa-agent-response-delivery-20261009"></a>

## 10-回复送达修复-20261009

修复本机 17:02 实际 Agent Run 没有最终答复的问题：将模型长度截断从相同参数的自动重试中区分出来，在请求预算耗尽或无可见输出时保存明确终态说明；输出上限默认跟随当前模型目录能力，目录未提供时遵循 Provider 默认，只有用户设置正数时才追加自己的上限；迁移旧默认请求/工具预算；迁移旧 Daemon 任务表中拒绝 `timeout_seconds=0` 的 SQLite 约束。Owner、设置、数据库和验收见[本轮合同](development/agent-response-delivery-20261009.md)。

<a id="lfaa-local-executable-path-launch-20261009"></a>

<a id="lfaa-local-executable-path-launch-20261009"></a>

## 11-本机程序启动-20261009

当用户直接提供本机 Windows `.exe` 绝对路径时，允许现有本机电脑能力按该精确路径直接启动，避免开始菜单/浏览器焦点搜索；复用 `computerControl.enabled` 与 `permissions.mode`，不接受启动参数，经 `shell:false` 启动并要求观察核验。范围、Owner 与验收见 [合同](development/local-executable-path-launch-20261009.md)。

<a id="lfaa-local-app-intent-discovery-20261009"></a>

<a id="lfaa-local-app-intent-discovery-20261009"></a>

## 12-本机应用识别-20261009

补齐通用本机应用的自然语言理解与便携应用发现，不要求用户提供绝对路径；模型结合名称、类别、简称和常见别名调用通用搜索，再启动唯一明确的真实候选。`请求审批`逐项等待；`替我审批`对相同账户/App/工具版本/风险/目标范围的明确批准累计两次后自动记忆，也支持首次主动记忆；`完全访问`在当前目标范围内直接执行。对照 DSH 仅借鉴模型选择通用工具、执行器回传真实结果和权限 Owner 的职责划分，不把 DSH 的目录白名单或 CUA 适配器误当成通用桌面搜索器。范围、Owner、性能上限与验收见 [合同](development/local-app-intent-discovery-20261009.md)。

<a id="lfaa-local-computer-agent-20261009"></a>

<a id="lfaa-local-computer-agent-20261009"></a>

## 13-本机电脑操作-20261009

目标、Owner、模式边界、验收与性能限制见 [本机电脑任务合同](development/local-computer-activity-20261009.md)。用户明确要求实现类似本机电脑 Agent 的真实能力：观察屏幕、按目标找应用、执行有界鼠标/键盘动作并观察核验；本机应用目录是该能力的一部分，不能把只读 MCP 搜索当作完整实现。

<a id="lfaa-local-web-computer-use-20261009"></a>

<a id="lfaa-local-web-computer-use-20261009"></a>

## 14-Web电脑操控-20261009

修复本机 Windows `web` Profile 没有装配现有 CUA 适配器的缺口。只允许 CLI 本机模式且 Control Plane 绑定 IPv4/IPv6/localhost loopback 时，从 Web Profile 注册；非回环/远程生产/非 Windows 保持无电脑操控。沿用账户 computerControl.enabled 与 permissions.mode。验收 Web Profile 9 工具登记、远程/公网绑定拒绝、开关与审批回归、正式隔离 Web 启动/健康/工具目录和构建/类型/工作区检查。禁用测试或远程环境不得触碰真实桌面或用户数据。

<a id="lfaa-quiet-daemon-poll-logs-20261009"></a>

<a id="lfaa-quiet-daemon-poll-logs-20261009"></a>

## 15-Daemon日志降噪-20261009

目标：将本机 Daemon 每 5 秒成功查询 EasyTier 安装队列的空轮询，以及前端每 15 秒只读核对会话的请求降为 `debug`，避免完整 Web 启动终端持续输出 `info` 请求行；HTTP 4xx/5xx 仍按现有规则输出 `warn`/`error`。Owner 是 `packages/host/webserver/src/http-delivery.ts` 的请求日志分级，入口为 `pnpm lfaa web` 自动托管的本机 Daemon 与 Web Client；不改变轮询频率、不新增设置、不触碰任务数据或权限。验收以日志分类源码、包/根构建通过为静态与构建证据；真实终端需重启后确认后台轮询不再刷屏，任务执行及错误仍可见。

<a id="lfaa-wallpaper-engine-live-selection-20261009"></a>

<a id="lfaa-wallpaper-engine-live-selection-20261009"></a>

## 16-壁纸实时切换-20261009

修复 DSH Wallpaper Engine 首次选壁纸时 LFAA 表面遮挡，以及 Edge 切换视频时新视频无法接替旧画面的问题；场景、视频点选后均应无需刷新实时切换。范围、Owner、设置盘点与验收见 [本轮合同](development/wallpaper-live-switch-20261009.md)。

<a id="lfaa-wallpaper-request-log-noise-20261009"></a>

<a id="lfaa-wallpaper-request-log-noise-20261009"></a>

## 17-壁纸请求日志-20261009

修复本机 `pnpm lfaa web` 终端被 DSH Wallpaper Engine 正常诊断/设置请求刷屏、把无缓存帧/无独立音轨/缺少可选 `scene.json` 的预期探测误记成警告的问题。真实未知 token、其他 4xx 和 5xx 必须继续显示为 warn/error。范围、Owner、设置与验收见 [本轮日志合同](development/wallpaper-request-log-noise-20261009.md)。

<a id="lfaa-web-menu-startup-ps51-20261009修复-windows-工作台-web-启动预检"></a>

## 18-Web启动预检-20261009

### 用户目标与运行入口

- 修复 Windows 工作台主菜单 2 → 启动子菜单 1/回车的 Web 启动失败；保留完整 Web、独立 Daemon 和 Vite 前端各自的真实职责。
- 运行入口：`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → 源码/构建指纹预检 → 数据目录/写锁预检 → `pnpm lfaa web`。

### Owner、配置与范围

- 数据目录解析继续归 `packages/util/home-paths`，部署环境校验归 `packages/util/launch-environment`；菜单不得复制一套解析或放宽 Daemon 的生产数据目录要求。
- 设置中心配置：不涉及。仅沿用现有 `.env`/进程环境的 `LFAA_DATA_DIR` 及其优先级。
- 允许修改工作台 Web 预检和子菜单说明、对应 Windows PowerShell 回归、CLI/启动文档和本合同。
- 禁止修改用户数据、认证授权、Daemon 对绝对持久化数据目录的要求、现有设置或无关菜单功能；不停止真实服务、Daemon 或 Minecraft 实例作验收。

### 验收条件

- Windows PowerShell 5.1 实际运行数据目录预检时，Node ESM 源码保留引号，成功调用权威 `home-paths` resolver。
- 子菜单明确提示：1/回车启动完整 Web；2 是要求绝对 `LFAA_DATA_DIR` 的独立 Daemon；4 只启动 Vite 且依赖已经运行的控制端。
- 直接相关的 PowerShell 回归、控制端/Web 构建指纹和隔离数据目录下的 Web 健康检查有本轮实测证据；不使用真实运行数据或托管本机 Daemon。

### 实施与验证记录

- `scripts/install-dependencies.ps1` 在把 ESM 源码传给 Windows PowerShell 5.1 下的 Node `--eval` 前转义内嵌双引号；该版本 PowerShell 原先会剥除引号，使 `import { existsSync } from node:fs` 触发 `[eval1]` 语法错误并中断 Web 启动。子菜单说明现区分完整 Web、要求绝对 `LFAA_DATA_DIR` 的独立 Daemon 与必须依赖已启动控制端的 Vite。
- 设置中心配置：不涉及。Web 预检仍复用 `.env`/进程环境与 `home-paths` 数据目录解析；独立 Daemon 的生产绝对路径要求未放宽。
- 验证：Windows PowerShell 5.1 Pester 定向回归 1/1、`install-dependencies.ps1` AST 解析和 `git diff --check` 通过；`pnpm run build:control-plane` 通过；Vite Web 构建处理 2228 个模块，`runtime-build-state.mjs web` 返回 `[]`。在隔离数据目录下实际运行 `lfaa.bat` → 2 → 1，Web 页面与 `/api/health` 均 HTTP 200；单独 `pnpm lfaa web --no-local-daemon` 的未认证会话 API 返回 401。完整菜单托管的隔离本机 Daemon 收到有序关闭请求，之后端口和项目进程均释放。
- 清理边界：仅本轮隔离冒烟启动的 `%TEMP%\lfaa-startup-smoke-2cd11cb4bcaf4b718dc1f43cc44dbbcf` 数据目录仍保留。清理它的递归删除操作被自动审查拦截；未换用其他删除方式。真实用户数据、真实 Provider、浏览器交互与帧时间未测。

<a id="lfaa-desktop-update-hover-appearance-latest-01"></a>

<a id="lfaa-writing-local-files-20261010"></a>

## 19-写作本地存储-20261010

将 Writing 作品正文迁移到本机受账户隔离的 Markdown 文件；SQLite 继续保存账户归属、作品/卷/章节/资料/Skills 元数据、工作区位置和待审 AI 提案。现有内容必须先写入文件并回读校验，再清空 SQLite 中相应正文并原子记录迁移完成；迁移可安全重试。入口与 Owner 仍为 Writing 服务及认证 Controller/Agent Tools，文件路径从当前数据根和已认证用户、数据库中的 UUID 推导，不接受客户端路径。使用现有数据根、原子文件写入与私有目录权限，不新增设置项。`writing_book_skills.instructions` 的既有非空约束要求数据库保留固定标记 `lfaa-local-file-v1`，Skill 正文只保存在本地文件。禁止改 AI Work 工作区项目、账户/身份/权限/凭据、Session、游戏数据、待审提案正文及无关未提交工作；不提交、不发布、不重启服务。验收覆盖大纲、章节、章节/大纲修订、资料正文与作品 Skills 的文件读写及迁移；SQLite 关系和所有权校验、提案审阅/冲突处理、DeepWrite 导入导出语义保持；迁移中断不清空 SQLite 原文，文件损坏不静默回退到旧正文。运行本地文件迁移回归及现有 Writing 定向回归和包构建，报告未实测的浏览器/Provider/运行服务行为。

<a id="lfaa-ai-video-canvas-mvp-20261010"></a>

<a id="lfaa-ai-video-canvas-mvp-20261010"></a>

## 20-漫剧画布-20261010

AI 漫剧分镜画布已接入；修复了应用入口历史状态白名单遗漏 `aivideo` 导致工作区被退回应用中心的问题。最新入口/Owner/API 定向回归 4/4、Web 构建与工作区 Gate 通过，登录浏览器已打开分镜首屏并验证账户空列表读取。保存的真实账户浏览器操作、视频 Provider、ComfyUI 执行器、白模导入、时间线、桌面和帧时间仍未验收。详情见[本轮合同](development/ai-video-canvas-mvp-20261010.md)。

<a id="lfaa-ai-video-local-project-files-20261010"></a>

<a id="lfaa-ai-video-local-project-files-20261010"></a>

## 21-漫剧项目文件-20261010

把 AI 漫剧每张分镜画布从账户级聚合 JSON 改为本机独立项目文件夹，路径由当前 `LFAA_DATA_DIR`、账户哈希和数据库外的已验证项目 UUID 推导，项目 JSON 保存完整可编辑画布。未来素材使用项目内相对路径，本轮不接入媒体/白模/生成文件。沿用 `packages/video/ai-video` 唯一 Owner、认证 API、原子写入、私有目录保护和账户权限；不新增设置或项目服务，不修改 Writing 正在进行的未提交文件。旧 `storyboards.json` 必须先拆分、回读验证全部项目后再原子改名保留；任何迁移错误都保留原文并失败关闭。允许修改 AI Video Owner、直接回归、Owner README、系统架构/开发计划、首版合同及本合同/索引。验收覆盖旧文件可重试迁移、账户隔离、单项目增删改、过期冲突、目录/文件链接拒绝和有界读取；运行定向回归、受影响构建、CLI 类型检查、工作区 Gate 与差异检查。真实浏览器写入、桌面、Provider、素材/白模、帧时间和服务重载未验时如实说明。详情见[本轮合同](development/ai-video-local-project-files-20261010.md)。

<a id="lfaa-ai-work-tool-efficiency-20261010"></a>

<a id="lfaa-ai-work-tool-efficiency-20261010"></a>

## 22-工具调用效率-20261010

缩短 AI Work 的明确本机应用启动路径并减少重复 Provider 往返：模型在调用工具前先向用户给出一句简短、真实的下一步说明，不展示隐藏推理。用户直接指定应用名时，模型先用当前 Run 的真实桌面观察确认目标是否已经打开；已确认打开时立即完成，不再重复搜索或启动。未打开时，允许模型一次调用受保护的本机启动工具 `query` 完成有界发现与启动，不先调用搜索工具。Owner 仅启动唯一高置信匹配，歧义时返回安全候选且不启动。已登记目录已有匹配时不再扫描便携磁盘目录；模型提示和工具说明不得互相矛盾，不得重复搜索、重复启动或使用无界 Shell/文件递归兜底。入口为 AI Work `/tasks` 与本机 Windows `web`/`desktop` Profile；Owner 为 `packages/core/agent-loop`（模型决策/统一权限）与 `packages/computer-use/computer-use`（发现/启动/结果）。沿用 `computerControl.enabled`、`permissions.mode`、`aiRuntime.maxModelRequests`、`aiRuntime.maxToolCalls`、`aiRuntime.contextWindowTokens`；不新增 Token 硬封顶、不改变 Provider 或权限策略。

允许修改 `packages/core/agent-loop` 内本机应用提示、`computer-use` Tool 合同与 Owner、对应回归、包 README、`docs/系统总体架构.md`、`docs/开发计划.md`、本合同及索引。禁止关键词业务路由、任意路径/命令/参数启动、歧义候选自动选择、节点 Shell 搜索控制端电脑、改 Provider 选择或既有设置、触碰无关未提交工作、重启运行服务或操作真实游戏。验收：当前真实屏幕已确认目标应用打开时不重复启动并结束本轮；尚未打开时名称/缩写唯一高置信匹配可由一次模型 Tool 调用解析并发起启动，随后以一次真实观察核验；多候选/低置信/无结果时不启动且结果不泄露路径；既有 ID 启动与三种权限合同保持；模型提示与 Tool 合同一致，且不对同一目标重复查询、启动或递归扫盘。运行本机应用定向回归、Agent Loop/computer-use 受影响包构建、CLI 类型检查、工作区 Gate 与差异检查；真实 Provider、桌面窗口、平均 Token 节省与帧时间未测时明确说明。

本轮追补：修正 Agent 提示与 `computer_use_launch_local_app` 工具合同冲突。处理明确的应用打开请求时，模型先给一句可见的简短进度说明，再按本机电脑操控规则观察；已确认打开则直接结束，未打开才使用一次 `query` 查找并请求启动，随后观察一次，不再重复搜索/启动。模型决策与统一权限执行方式不变。提示合同回归 1/1 通过；Agent Loop、computer-use 包、Control Plane 构建通过；CLI 类型检查、180 包工作区检查和差异检查通过。Agent Runtime 与 computer-use 集成测试运行到 Writing 本地文件表结构未初始化错误，未完成后续集成验证。真实 Provider 与桌面应用交互未测。

<a id="lfaa-provider-402-quota-error-20261010"></a>

<a id="lfaa-provider-402-quota-error-20261010"></a>

## 23-Provider额度提示-20261010

修复 AI Work 收到 Provider HTTP 402 时只显示笼统账户设置错误的问题。目标提示应明确说明当前 Provider 计费账户余额或可用额度不足，并给出充值或检查套餐/额度的下一步。运行入口为 `/tasks`；Provider 错误映射 Owner 为 `packages/llm/llm`，Agent Loop 与 AI Work 沿现有错误消息链展示。本轮沿用当前模型账户、凭据和 `aiRuntime.requestRetries`，不新增或调整设置；402 保持终态错误，不自动重试。错误响应正文仍不得发送到客户端或日志。

允许修改 Provider HTTP 状态映射、对应长期回归及本合同；禁止改 Provider 选择、账户/密钥/权限、错误正文处理或重试策略。验收：隔离的合成 HTTP 402 响应显示清楚的余额/额度提示，且不泄漏响应正文；现有其它状态映射保持不变。运行该回归、LLM 包构建、CLI TypeScript 检查与 `git diff --check`。真实 Provider、浏览器和运行中服务加载未测时明确说明。

实施记录：HTTP 402 现在返回余额/可用额度不足及充值/检查套餐提示，仍为不可恢复错误；响应正文仍在状态分支前取消，不读取或向客户端转发。合成 Provider 回归 2/2、`pnpm --filter lfaa-llm run build`、`pnpm --dir apps/cli typecheck`、`pnpm run check:workspace` 均通过。`workspace-preflight` 在当前仓库不存在。静态确认此次映射不增加请求、订阅或错误正文解析；真实 Provider、浏览器呈现、帧时间与运行中服务加载未测。

<a id="lfaa-ai-work-process-disclosure-20261010"></a>

<a id="lfaa-ai-work-process-disclosure-20261010"></a>

## 24-运行过程可见-20261010

调整 AI Work 中央回复的工作过程呈现：在助手回复前展示整轮真实处理时长；运行期间展开真实活动步骤，结束后默认收起并允许用户展开查看已有工具/命令活动记录。最终答案仍作为普通助手回复可见，不重复合成消息；不展示隐藏推理或原始工具结果。Shell 工具记录只在既有活动说明中加入有界、常见凭据样式脱敏的命令预览，不改变执行结果、权限或执行位置。以助手消息创建时间和持久化活动时间计算整轮耗时，活动行继续显示各步骤的真实耗时。入口为 `/tasks`；渲染 Owner 为 `packages/client/ui-chat`，Agent Loop 只生成 Shell 命令活动预览，Session 沿用现有消息/活动存储与账户隔离。本轮不改 Provider 决策、SSE、Daemon 或权限逻辑。沿用现有主题、字体、字号、强调色、遮罩/模糊和减少动态效果设置，不新增设置。允许修改聊天组件、耗时摘要、聊天样式、`packages/core/agent-loop/src/execute-turn.ts`、`apps/cli/tests/ai-work-activity-duration.test.mjs`、`apps/cli/tests/client-performance.test.mjs`、`apps/cli/tests/agent-runtime.test.mjs`、必要的架构说明、任务索引及本合同；保留工作树中已有改动。验收：进行中摘要按整轮计时且活动步骤可见；完整回复以“已处理”显示实际总时长，轨迹默认收起、可展开查看回复和真实操作记录；Shell 命令预览有长度上限并对常见凭据格式脱敏；不重新引入光标或隐藏推理；运行 Agent/活动耗时/聊天呈现定向回归、聊天包构建、TypeScript/入口构建和差异检查。真实 Provider/浏览器视觉、帧时间与运行中服务加载未测时明确说明。

<a id="lfaa-ai-work-reply-layout-20261010"></a>

<a id="lfaa-ai-work-reply-layout-20261010"></a>

## 25-回复布局-20261010

按用户确认的 AI Work 回复排版修正过程披露：助手回复顶部显示持续变化的整轮时长，运行中为“已处理 xx”，完成后为“用时 xx”；时长行下方以细横线分隔，再显示普通助手正文。Provider 尚未返回首个可见正文 token 或真实活动时，正文下方仍显示“正在思考”；不得用隐藏推理或虚构的工作正文填充等待区。收到正文后原样稳定流式显示；收到真实活动后，当前动作摘要才按真实活动变化。完整活动轨迹可通过箭头展开；活动列表不得出现在正文之前；运行期间和完成后默认都收起，完成回调确保自动收起；轨迹展开后每条活动都可独立展开/收起其详情；最终答复保持可见。沿用 Session 持久化活动、既有主题令牌及减少动态效果，不改活动数据、权限、工具执行位置、滚动、流式文本/无光标行为或设置中心配置。

入口为 `/tasks`；Owner 为 `packages/client/ui-chat` 的 `AiWorkChat`、活动摘要与样式。允许修改上述 UI、直接相关 CLI 回归及本合同/索引；保留工作树已有改动。验收：处理中显示“已处理”，完成显示“用时”；横线位于时长行下方且正文紧随其后；首个可见正文或真实活动到达前持续显示“正在思考”，不以空白点动画替代状态文案，不伪造正文；正文流式节点无光标且稳定；当前动作位于正文下方并反映当前真实活动；完整轨迹只在用户展开后显示且完成时折叠，轨迹中每条活动详情默认收起并可独立开合；回答正文、澄清卡片、文件差异入口保持可用。沿用现有主题、字体、字号、强调色、遮罩/模糊与减少动态效果设置，不新增设置。运行活动耗时与聊天呈现定向回归、聊天包构建、必要类型/入口检查、工作区 Gate 和差异检查；真实浏览器交互/帧时间、Provider 与运行中服务加载未测时明确说明。

<a id="lfaa-ai-work-file-change-review-20261010"></a>

<a id="lfaa-ai-work-file-change-review-20261010"></a>

## 26-文件改动审阅-20261010

将模型通过现有项目文件 Tools 实际成功读取、创建、修改或删除的文件，记录在同一助手消息的 AI Work 活动步骤中；展开后可看到操作类型和规范化项目相对路径。绑定已登记 Workspace/Minecraft 项目的变更记录可以点击打开内置 Git 变更审阅器，在现有 Git 基线下查看真实差异标记并按现有 SHA-256 编辑保存流程使用内置编辑器；读取记录只显示路径。未绑定项目时仍展示真实路径，但不提供无认证的路径跳转。不得持久化或显示文件正文、replace 的旧/新内容、原始 Tool 参数/输出或隐藏推理；未成功、结果未知或无实际变化的操作不得标为已修改。

入口为 AI Work `/tasks`；Daemon `project-files-v1` 只补充已校验路径的项目相对表示；Agent Loop 从成功工具结果产生有界活动元数据；Session 保持现有 JSONL 活动存储和读取校验；`AiWorkChat` 显示并转发用户点击；`ApplicationWorkspace` 只允许同一账户当前 App 已登记项目进入现有 Git Owner 与 `GitChangeReview`。子目录项目需将项目相对路径映射到 Git 返回的仓库相对路径。本功能显示当前 Git 基线的真实差异，不声称 Git 能将差异逐行归因到某个模型调用；AI Worktree 按其现有快照基线隔离。沿用 `permissions.mode` 与 Appearance 现有主题、字体、强调色、模糊及减少动态效果设置，不新增设置。

允许修改：项目文件结果相对路径、Agent 活动类型与生成、Session/Client API 活动字段和校验、AI Work 活动展示、工作区到既有 Git 审阅器的适配、直接相关回归、Agent/Client/架构说明及本合同。禁止新增文件执行器、Git/Diff/编辑器实现、权限策略、会话/数据库存储、任意路径浏览或文件内容活动快照；禁止执行 Git 写命令、提交、恢复、重启服务或覆盖其他工作树改动。

验收：CRUD 结果只在真实成功且发生变更时显示，`create_tree` 的路径数有界；Session/SSE 恢复保留结构化记录且拒绝不安全路径/字段；活动不泄露文件内容；绑定项目中的文件记录能映射到 Git 状态中的同一文件并打开现有行级差异/编辑器，非 Git/无差异时展示真实错误；在测试覆盖项目子目录路径映射、创建/修改/删除、错误/无变化、文件树上限和无内容泄露。运行直接相关 Agent/Daemon/Client 回归、受影响包构建、类型检查、工作区 Gate 和 `git diff --check`。真实 Provider、浏览器点击与视觉体验、服务加载未测时明确说明。

<a id="lfaa-ai-run-reconnect-loop-bounds-20261010"></a>

<a id="lfaa-ai-run-reconnect-loop-bounds-20261010"></a>

## 27-断线恢复限制-20261010

修复 AI Work SSE 在 `done` 前断开后不再跟随同一 Run 的问题；为每轮模型请求与工具调用落实有限的 AI Runtime 预算上限；阻止同一 Run 重复派发已成功完成的相同写入/危险工具。设置 Owner、范围、兼容语义及验收见[本轮合同](development/ai-run-reconnect-loop-bounds-20261010.md)。

<a id="lfaa-ai-run-pause-resume-20261010"></a>

<a id="lfaa-ai-run-pause-resume-20261010"></a>

## 28-运行暂停继续-20261010

让 AI Work 当前 Run 可暂停并继续同一 Run，同时保留独立的显式停止入口。Agent Loop 在 Provider 响应、已派发工具或待审批交互到达安全检查点时挂起原执行栈；继续时恢复原 Run，不新建用户轮次、不重放已经派发的工具。暂停等待期间如原子操作仍在执行，UI 明确显示“正在暂停”；真正暂停后显示“已暂停”。目标、Owner、设置、修改范围及验收见[本轮合同](development/ai-run-pause-resume-20261010.md)。

<a id="lfaa-agent-model-daemon-boundary-20261010"></a>

<a id="lfaa-agent-model-daemon-boundary-20261010"></a>

## 29-模型与节点边界-20261010

纠正 Agent 与 Daemon 的职责边界：Provider 返回的模型决定下一步并选择本轮已提供的 Tool；Agent Loop 只负责请求、统一权限、派发所选 Tool、记录并回传真实结果，不用关键词流程替代模型。Daemon 是目标节点运行时，不是 Agent、模型决策者或通用控制层；游戏节点命令仅通过模型选中的 Minecraft/SteamCMD 节点工具派发。本轮本机 PCL2 等应用由 computer-use Owner 搜索、启动和观察，禁止退回节点 Shell/文件工具搜索本机程序；通用工作区不向模型暴露 Daemon Shell 命令，本机 Profile 单独提供 `local_execute_command`。本轮不改变已登记项目文件工具的现有项目目标解析合同。

入口为 AI Work `/tasks` 与当前 Harness Profile。Owner：`packages/core/agent-loop` 管模型请求/Tool 往返/准确活动记录；`packages/computer-use/computer-use` 管本机桌面；`packages/shell/tool-shell` 区分本机命令和游戏目标节点 Shell；Minecraft/SteamCMD 领域工具管理游戏节点副作用。沿用 `permissions.mode`、`computerControl.enabled`、`general.taskFolder`、`general.integratedShell`、`aiRuntime.commandTimeoutSeconds` 和既有外观设置，不新增或重置设置。

范围允许修正 Agent 指引和游戏节点 Shell 工具可见范围、保留本机 Shell Owner、修正活动名称/结果描述、同步必要包 README/架构事实/长期回归。禁止改 Provider 选择策略、降低权限校验、把业务流程写成关键词路由、重启用户服务或操作真实游戏、清理本轮无关工作树改动。

验收：模型工具往返仍为“模型请求 Tool → 对应 Owner 执行 → 真实结果回给模型”；PCL2/本机应用任务不得调用节点 Shell/文件工具；通用工作区不向模型暴露 `host_execute_command`，Minecraft/SteamCMD 仍提供模型选择的目标节点 Shell；本机 Profile 保留 `local_execute_command`；所有活动准确区分本机 Tool 与节点任务。项目文件工具的既有目标解析合同不在本轮修改范围。运行相关 Agent、Shell、computer-use、游戏节点回归、受影响包构建、入口类型检查、工作区 Gate 和差异检查。真实 Provider、本机桌面与实际 Daemon 节点未执行时明确列为未验。

<a id="lfaa-ai-work-clarification-inline-20261010"></a>

<a id="lfaa-ai-work-clarification-inline-20261010"></a>

## 30-对话内澄清-20261010

修复 AI Work 澄清问题被显示为普通用户气泡、并在后续上下文中被改写成用户消息的问题。待回答的问题卡嵌在提出问题的助手回复内；回答后折叠为该助手回复中的可点击澄清记录，展开可查看原问题和用户答案，不再显示独立的用户气泡或重复输出。当前 Run 仍通过原有 `lfaa_ask_user` 工具结果继续，不创建额外用户消息。后续会话历史保留有效的 assistant tool-call/tool-result 配对，不把澄清答案合成为 `role:user`。滚动仅影响视口位置，不改变消息内容或顺序；本轮不改滚动算法。入口为 `/tasks`；Owner 为 `AiWorkChat`、Agent Loop 和 Session。沿用 `general.questionNotifications`（仅控制通知）、既有外观/主题令牌和权限设置，不新增设置。验收：Agent/Session 回归确认澄清答案无 `user/message` 记录、工具协议上下文完整；UI 回归确认待回答卡在助手消息内、已回答记录默认折叠且可展开看到问题和答案，且没有全局提问栏或用户气泡；相关包、Web 构建、类型检查、工作区及差异检查通过。真实 Provider 浏览器交互未测。详见[本轮合同](development/ai-work-clarification-inline-20261010.md)。

<a id="lfaa-ai-work-stream-render-stability-20261010"></a>

<a id="lfaa-ai-work-stream-render-stability-20261010"></a>

## 31-流式渲染稳定-20261010

修复 AI Work 中央聊天在模型回复流式期间的闪烁、抖动和局部闪屏。当前 `AiWorkChat` 每个合并帧都把累计正文重新交给 `AiMarkdown` 解析并生成 Markdown 节点；流中未闭合的 Markdown 语法还可能改变当前块结构。目标是在生成期稳定显示增量文本，只在回复离开 `streaming` 状态后渲染 Markdown，保留自动滚动、最终 Markdown 格式和无光标要求。范围限于 Client UI Chat 渲染、其样式、直接回归与本包说明；不修改 Agent、Provider、SSE 或权限逻辑。沿用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds`、`aiWorkOutputFocusBlurPercent`、`appearance.advanced.reducedMotion` 及既有主题/字体令牌，不新增或覆盖设置。验收：回归覆盖 streaming/complete 两种渲染模式、聊天包、Web 构建、类型检查、工作区检查和差异检查均通过；真实 Provider 下的浏览器流式帧时间与 50ms 长任务未测。详见[本轮合同](development/ai-work-stream-render-stability-20261010.md)。

<a id="lfaa-general-agent-capabilities-20261009"></a>

<a id="lfaa-ai-work-sse-request-close-20261010"></a>

## 32-流式连接修复-20261010

修复 POST 请求体正常读取完毕触发 `IncomingMessage.close` 后，SSE 助手误判回复连接已关闭、导致聊天只能刷新后读到最终消息的问题。目标、Owner、修改边界与回归验收见[本轮合同](development/ai-work-sse-request-close-20261010.md)。

<a id="lfaa-agent-file-crud-20261009"></a>

<a id="lfaa-ai-video-nomi-core-parity-20261011"></a>

## 33-漫剧核心能力-20261011

目标：将本机 `H:\Nomi` 已观察到的 AI 视频工作室核心体验，用 LFAA 自有代码和 Owner 分阶段接入 `aivideo`。Nomi 只作为行为参考；不复制其 AGPL-3.0-only 源码、设计资产或数据格式。全量目标含本地项目/创作文档、剧本与分镜、角色/场景参考、连线生成画布、按镜头图像/视频模型、媒体管理、时间线/预览/剪辑/导出、模型接入发现与认证、模型驱动 Agent 工具编排，以及 3D 导演台/手机取景器。阶段顺序为：A 项目创作资料与角色/场景档案；B1 模型驱动的剧本/分镜工具闭环；B2 角色/场景参考图片的本机素材闭环；C Provider 参考图输入、视频生成与模型能力合同；D 媒体库、时间线、预览、剪辑和导出；E 3D 导演台与取景器；每阶段分别完成 Owner 合同与验收，不把目标清单说成已接入。

| Nomi 核心能力 | LFAA 当前证据 | 接入阶段 |
|---|---|---|
| 本地项目、剧本与分镜创作 | 已有账户隔离本机项目 JSON、分镜画布与静帧图片 | A：扩展剧本和角色/场景档案 |
| 角色/场景参考与跨镜头一致性 | 角色/场景本机参考图已作为 OpenAI Images Edit、Ark Seedream 和 Ark Seedance 的输入 | C：源码已接通，真实账户请求未验 |
| 连线画布与按镜头生成 | 创作镜头连线、OpenAI/火山方舟静帧生成与 Ark Seedance 异步视频任务均已接入 | C：项目任务保存、状态查询/排队取消、MP4 本机持久化；真实 Provider 未验 |
| 模型发现、认证、Agent 编排 | 共享 Settings/Credentials/LLM/Agent Loop；AI Video 工具现含项目、图像和视频任务入口 | B/C：沿现有 Owner 接入；真实模型决策与运行未验 |
| 媒体库、时间线、预览、剪辑、导出 | 已接入项目媒体浏览/导入/删除、视频/音频/字幕时间线、预览和回写项目的浏览器原生导出；浏览器实际编码兼容性待验 | D：源码已接入，运行时编解码/音画同步待验 |
| 3D 导演台与手机取景器 | 已接入 LFAA 自有 Canvas 透视白模场景/相机编辑，以及用户主动开启的设备取景与镜头图保存 | E：源码已接入，真实设备权限/交互待验 |

本表描述的是源码盘点与分阶段状态。阶段 A–E 源码已接入；18 个直接相关包、Web/Control Plane 构建、类型检查、181 包工作区 Gate 与差异检查通过。真实 Provider、浏览器编解码/音画同步、设备权限、桌面呈现和运行服务加载另行验收。实现复用 LFAA 已有文件存储、Agent、模型、权限和工作流 Owner，没有另起平行架构。

现有事实：`packages/video/ai-video` 是账户隔离本机项目和创作画布 Owner，`packages/api/ai-video-controller` 是认证 API，`packages/client/ui-workspace` 是 Web/Desktop 共用 `aivideo` 工作区；已有镜头、连线与 OpenAI/火山方舟静帧素材。通用 Workflow 定义/运行归 `packages/workflow/workflow`，但目前没有 AI Video 节点适配器；通用 Agent Loop、Tools、Permission、LLM Provider 和 Settings/Credentials 均由各自现有 Owner 管理。首阶段扩展 AI Video 项目：把剧本文本及角色/场景描述纳入同一账户隔离 `project.json`，画布页面提供可编辑、显式保存和回读的创作资料页，同时保留旧项目缺字段的读取兼容；镜头可关联角色/场景档案，用户显式出图时将这些文字描述组合进提示词。首阶段不宣称文本大模型生成、参考图生成、视频生成、模型发现/认证、时间线、导出或 3D 导演台已接入。

设置盘点：复用 `aiRuntime.imageGenerationAccountId` / `imageGenerationModelId` 及已登记的 `lfaa-ai-video` Credentials 消费者（本阶段不发起模型请求）；工作区继续继承 `appearance.theme`、`accentColor`、字体/字号、背景/遮罩/模糊与减少动态效果映射。项目存储继续使用当前 `LFAA_DATA_DIR` 路径合同和服务端账户隔离；不新增设置、不更改默认值/持久化/既有偏好。

入口与 Owner：Web/Desktop `aivideo` 普通工作区 → `AiVideoCanvasWorkspace` → 认证 Client Connection → AI Video Controller → `lfaa-video-ai-video` → 当前账户项目文件夹。项目标题、剧本、角色/场景档案、分镜、坐标、连线和素材引用均由 AI Video Owner 校验、原子写入并回读；UI 不使用浏览器存储作为权威数据。并发保存仍用 `expectedUpdatedAt`；不放宽路径围栏、容量限制、认证或账户隔离。

阶段 A、B1 与 B2 已完成源码。B2 在 AI Video Owner 的项目 `assets/` 中保存角色/场景参考图，提供认证上传、读取、替换和删除；项目格式 v3 读取兼容旧版本，Controller 限制请求体，Client Connection 与工作区提供选图、预览和移除。引用素材继续受账户/项目围栏、原子文件写入、更新时间并发检查、现有总容量/文件数上限保护；单张上传限 3 MiB 并复用 Settings 既有尺寸解析规则，没有新增设置项。参考图仅保存在项目中，尚未发给 Provider。官方接口核查发现 OpenAI Videos API 和 Sora 2 已于 2026-09-24 下线；OpenAI Images 编辑端点仍支持多图参考，火山方舟 Seedream 支持 Base64 参考图，Ark Seedance 使用异步任务端点生成视频。

阶段 C 源码已接入：静帧镜头生成随角色/场景参考图调用 OpenAI Images Edit 或 Ark Seedream image 输入；视频生成仅接入 Ark Seedance 官方异步任务（创建、查询、取消排队任务和视频本机持久化），不实现已下线的 OpenAI 视频 API。设置中心新增独立火山方舟视频账户/模型、时长/比例/清晰度/音频/水印项，默认不覆盖已有图像账户或其他偏好。AI Video Owner 将服务商任务 ID、真实状态、MP4 素材保存在项目文件；本机服务在应用运行期间继续轮询，页面打开时也可恢复同步；服务商临时 URL 不作为本机成果。阶段 C 允许修改 Settings 类型/默认值/归一化/schema/Settings UI 与 README、LLM Provider Owner、AI Video Owner/Controller/Client Connection/共享工作区/AI Video Tools 与对应 docs；不改其他应用，不复制 Nomi 源码/资产，不引入 ComfyUI 替代服务，不接受任意 Provider URL，不在浏览器暴露密钥或项目绝对路径，不伪造完成状态，不重启服务、不提交或发布。模型目录未标注视频能力时，服务端仍只按用户所选模型发起实际请求并返回真实 Provider 结果/错误，不从模型 ID 猜测或静默替换模型。

首阶段验收：旧版项目读回时缺失的剧本/角色/场景初始化为空且不丢镜头/连线/图片；剧本文本、角色/场景名称与描述经服务端长度/数量校验，保存后重新读取仍一致；无效数据、越界 ID、并发过期更新失败关闭；账户目录和现有本机项目路径边界不变。交付时运行直接相关包构建、Web/Control Plane 构建、类型与工作区/文档 Gate、差异检查；不发送计费 Provider 请求、不重启服务，也不把构建等同真实浏览器/桌面验收。按当前上级开发约束，本轮不新增或运行测试。

本轮阶段 A 实施记录：AI Video Owner 将 `script`、角色/场景档案、镜头关系 ID 纳入本机项目 JSON；认证 Controller 与 Client Connection 校验/传递字段；工作区加入剧本、参考档案和分镜页，可把参考描述用于用户选择图片模型的镜头提示词；设置项不变。直接相关 3 个包构建、Web/Control Plane 构建、客户端/Host 类型检查、180 包 `check:workspace` 与 `git diff --check` 通过；未运行测试、未调用真实 Provider、未重启服务，当前 Web/Desktop 页面和保存回读未做浏览器验收。

本轮阶段 B1 实施记录：新增 `packages/video/tool-ai-video` 六个核心管理工具，仅对 `aivideo` 可见且不依赖可选插件开关，支持项目摘要列表、分页读取、创建、字段更新、明确删除和通过既有 Owner 生成镜头图；Agent Loop 按统一 Permission Owner 处理写入及潜在计费的图像生成。图像 Provider 接收 Agent AbortSignal，取消时撤销监听并避免登记图片。Web App bundle 已装配该包；直接相关 LLM、AI Video、工具包、Web App bundle、Web 与 Control Plane 构建及客户端/Host 类型检查通过；`check:workspace` 的 181 包 Gate 和 `git diff --check` 通过，路径映射和包目录清单由仓库同步器生成。未运行测试、未调用计费 Provider、未重启服务，真实模型决策、运行中服务加载与浏览器/桌面未验。

阶段 B1 验收：Agent Loop 在 `aivideo` 真实注册并可见所增领域工具，其他 App 不可见；工具参数严格校验、读返回有界，写入只经 AI Video Owner，图片生成只经现有图像 Owner，写操作遵循统一 Permission Owner。运行相关包、Web/Control Plane 构建、类型与工作区 Gate、差异检查；不新增/运行测试，不调用计费 Provider，不重启服务，不宣称浏览器/当前运行服务验收。

本轮阶段 B2 实施记录：项目格式升级为 v3 并兼容 v1/v2；角色/场景参考图认证上传、读取、替换和删除都经 AI Video Owner；严格校验 Base64、PNG/JPEG/WebP 文件头、3 MiB 大小、8192 边长和 2000 万像素，写入使用项目私有目录、原子素材文件与 `updatedAt` 并发合同，项目引用写入回读后才清理旧文件。通用画布更新保留并验证素材引用，删除档案或图片会清理旧文件。工作区可以上传、预览、替换和移除本机参考图，并明确显示 Provider 目前未收到图片。Settings 只导出并复用原有纯尺寸校验 helper；配置值、默认值与用户偏好不变。`lfaa-settings`、`lfaa-video-ai-video`、`lfaa-api-ai-video-controller`、`lfaa-client-connection`、`lfaa-client-ui-workspace`、`lfaa-web-app` 6 个包构建，Web 与 Control Plane 构建、客户端/Host 类型检查、181 包工作区 Gate 和 `git diff --check` 通过；未运行测试、未调用 Provider、未重启服务，浏览器/桌面未验。

阶段 B2 验收：v1/v2 项目读回不丢内容且新增字段默认为空；参考图 MIME、真实文件头、大小与尺寸校验；素材只能绑定当前账户/项目中存在的角色或场景；覆盖/删除后旧文件清理，越界、超限及并发过期更新失败关闭；新图片先安全写入并验证，再原子更新项目引用，失败清理新文件且保留旧引用。运行直接相关包、Web/Control Plane 构建、类型、工作区 Gate 和差异检查；不新增/运行测试、不调用 Provider、不重启服务。未接入 Provider 参考图输入时仍明确说明模型未收到参考图片。

本轮阶段 C 实施记录：设置中心提供火山方舟视频账户/模型目录与异步视频参数；OpenAI Images Edit、Ark Seedream 和 Ark Seedance 请求接收本机角色/场景参考图。项目格式 v4 向后读取 v1/v2/v3；服务端先在项目清单登记提交中任务，再保存真实 Provider task ID/status，运行期后台和打开页面时查询任务，排队任务可向 Ark 发送取消。完成 MP4 先验证 URL 主机、响应格式、大小和文件头，再写项目 `assets/` 并读回项目引用；任务状态、结果和老版本均保留在账户隔离项目。Agent Loop 新增生成视频、查询/保存成片和取消排队任务三个受统一 Permission Owner 管辖的 `aivideo` Tools。视频任务账户并发上限 2，单视频上限 128 MiB，账户媒体资产上限 2 GiB。阶段 C 与 D/E 所需的支持包构建、Web/Control Plane 构建、客户端/Host 类型检查、181 包 `check:workspace` 与 `git diff --check` 已通过；不代表真实 Provider、桌面、浏览器或运行服务已验。

源码完整目标包含真实模型驱动闭环与统一 Permission Owner、参考图/多模态素材、真实视频 Provider 执行、白模/媒体导入与生命周期、时间线预览和导出一致性、3D/手机取景器。A–E 已接入源码；现场 Provider、实际编码和音画同步、设备权限、桌面/运行服务与长期操作性能仍要分别验收，不能用构建结果代替。

### 阶段 D：媒体库、时间线、预览与导出

入口为 Web/Desktop 共用 `AiVideoCanvasWorkspace`；媒体与项目文件的唯一 Owner 仍是 `packages/video/ai-video`，认证上传/读取/删除与导出登记由 `packages/api/ai-video-controller` 承接，Client Connection 只传递媒体二进制与项目数据。项目格式升级需兼容 v1–v5，并将媒体元数据、剪辑轨道/裁剪区间和导出结果引用保存在项目 `project.json`；素材二进制只放项目 `assets/`，使用当前账户项目围栏、原子写入、并发更新时间和容量边界。媒体库支持项目已生成图/视频及用户导入的图片、视频、音频；删除操作只能移除已无角色/场景/镜头/时间线引用的素材。时间线提供视频、音频、字幕轨道，支持顺序/起点/入点/时长编辑、项目保存回读、真实媒体预览和本地渲染；导出格式按运行环境真实支持的 MediaRecorder 类型选择，保存为项目导出素材并提供下载，不宣称浏览器不支持的 MP4 编码。导出有明确时长/容量上限，渲染与文件传输不能造成无界内存或主线程长任务。

不新增设置项：沿用项目本机文件路径、既有媒体配额、工作区外观与减少动态效果；导出宽高从用户选定的媒体/项目比例推导，容器格式通过浏览器 MediaRecorder 能力检测决定。允许改 AI Video Owner/API/Client Connection/共享工作区、直接相关 README/架构与计划、本合同与索引；不得复制 Nomi 代码或数据格式，不接受任意路径/MIME/媒体 URL，不越过认证或账户隔离，不把服务商临时 URL作为素材，不重启服务、不提交或发布。验收要求受影响包构建、Web/Control Plane 构建、类型检查、工作区 Gate、差异检查；不新增或运行测试，不调用计费 Provider。真实浏览器的编解码支持、音画同步、手机设备、帧时间及运行服务加载另列为未验。

### 阶段 E：3D 白模导演台与手机取景

继续复用同一项目 Owner 和账户项目文件；将白模演员/场景块、相机位置/朝向/焦距、取景比例保存到项目 JSON，按当前格式迁移兼容。导演台使用 LFAA 自有轻量 3D 几何与相机投影实现，不加载 Nomi 的代码/资产；可摆放/移动/缩放白模、绕场观察、控制相机视角并预览构图；手机取景器通过用户主动点击启动的浏览器相机权限显示实时设备画面，拍摄帧写入该项目素材库并可作为镜头参考。相机 MediaStream 必须在停止、切页、项目切换和卸载时停止全部轨道；不请求时不访问设备。无摄像头、非安全上下文或权限拒绝时如实提示，不伪装可用。沿用既有外观设置，无新增设置；导演台对窄容器/短屏响应式布局。允许改 AI Video Owner/API/共享工作区、直接相关 README/架构与计划、本合同与索引；不改 Permission Owner、身份/凭据、其他应用、服务部署或系统摄像头设置，不复制 Nomi 代码/资产，不重启服务、不提交或发布。验收要求阶段 D 以及受影响包构建、Web/Control Plane 构建、类型检查、工作区 Gate、差异检查；不新增或运行测试。浏览器 3D 交互、真实移动设备相机/权限、帧时间与服务加载未测时明确列出。

阶段 D/E 源码实施记录：项目格式 v6 兼容 v1–v5；媒体 Owner 保存真实导入/生成/导出素材元数据，认证二进制上传和 Range 读取按账户/项目授权并有容量及并发界限；UI 有媒体库、可编辑时间线、同步播放头预览与项目导出回写。共享工作区新增 LFAA 自有 Canvas 透视白模/相机工作台和主动设备取景；延迟到达的相机授权流会被关闭，拍摄图片存入项目镜头。媒体音轨在暂停/拖动播放头时重新定位；图片导入在浏览器先按 Owner 提供的 16 MiB 上限校验。设置沿用主题、字体/字号、强调色、遮罩/模糊和减少动态效果配置，没有新增配置。源码核对发现 AI Work 的 `aivideo` 系统提示和应用卡片仍声称生成后端未接入；本轮同步修正文案，使模型只依据实际登记的项目/图像/视频工具执行，并明确时间线和白模由工作区提供、未暴露为 Agent Tools。`lfaa-video-ai-video`、`lfaa-api-ai-video-controller`、`lfaa-client-connection`、`lfaa-client-ui-workspace`、`lfaa-util-values`、`lfaa-storage-sqlite`、`lfaa-settings`、`lfaa-llm`、`lfaa-video-tool-ai-video`、`lfaa-web-app`、`lfaa-app-boot`、`lfaa-client-ui-settings`、`lfaa-client-ui-renderer`、`lfaa-system-prompt`、`lfaa-client-ui-layout`、`lfaa-tools`、`lfaa-client-ui-chat`、`lfaa-client-ui-sidebar` 18 个包构建，Web/Control Plane 构建、客户端/Host 类型检查、181 包工作区 Gate 和 `git diff --check` 均通过。未运行测试、未调用真实 Provider、未重启服务。真实浏览器媒体编码、音画同步、设备权限、桌面呈现、当前运行服务和帧时间仍未验。

2026-10-12 运行问题修复与复测：已定位到浏览器在读取 `limits.scriptCharacters` 时崩溃。Client Connection 现在校验项目列表和全部限制值；服务合同缺失时返回可读的 `ai_video_contract_mismatch` 错误，工作区保持项目创建入口禁用。相关包、Web/Control Plane 构建、客户端/Host 类型检查、181 包工作区 Gate 和差异检查通过。登录中的 `/apps/aivideo/normal` 重新加载后可见 AI 漫剧页面、明确的接口不兼容提示和禁用的新建按钮，没有客户端渲染错误；项目读写因此仍不可用。当前 Web PID 39448 仍以 `--no-local-daemon` 运行，用户已授权重启，但本机执行策略拒绝结束该进程，控制端未重新加载。未调用 Provider、未改设置或项目数据。

<a id="lfaa-ui-workbench-responsive-panels-20261011"></a>

<a id="lfaa-ai-video-image-generation-20261011"></a>

<a id="lfaa-ai-video-image-generation-20261011"></a>

## 34-漫剧图片生成-20261011

为 AI 漫剧分镜接入真实大模型图片生成，首批支持设置中心已保存的 OpenAI 与豆包/火山方舟账户。调用服务商官方 Images API；模型 ID 从该账户保存的模型目录中选择，服务端验证账户属于当前用户、服务商在允许范围且模型在目录内，密钥通过 Credentials Owner 按明确消费者读取，不进入浏览器、URL 或日志。图像由 LLM Provider Owner 请求，AI Video Owner 将验证后的 PNG/JPEG/WebP 二进制写入对应项目 `assets/` 并在 `project.json` 保存相对素材标识；只有用户点击镜头卡片“生成图片”时才发起请求。完整范围、Owner、配置盘点、错误边界与验收见[本轮合同](development/ai-video-image-generation-20261011.md)。

允许修改设置共享合同/校验/UI 中与图像账户和模型选择直接相关的代码、Settings 凭据消费者登记、LLM 图像 Provider 适配、AI Video 项目素材 Owner/API/画布 UI、对应 README 与架构/计划事实、此任务合同及索引。不得使用 ComfyUI、静态或演示图片代替模型结果；不得把 API Key 暴露到客户端；不得接受任意 Provider URL/路径；不得改变现有账户偏好、复用或删除用户数据、改 Writing、增加第二权限体系、提交、发布或重启运行服务。

验收：账户设置可选择 OpenAI/豆包已保存账户及其模型目录模型 ID；后端只接受两个 Provider 的固定官方图像端点，要求认证和当前用户账户归属，按图像 API 返回结果解析有界 base64 并映射可识别图像格式；图片原子保存到账户隔离项目 assets，失败或并发冲突不留下可见假结果；重新读取画布仍可显示图片，旧素材按替换/删除路径清理；页面显示真实生成状态与服务商错误。运行受影响包构建、CLI 类型检查、工作区 Gate 与差异检查；由于本轮不执行真实计费 Provider 请求，不把 API 可用性、模型权限、额度或浏览器/桌面/运行服务加载说成已验收。

本轮实施与验证：Settings/Credentials 保存账户与密钥，LLM Owner 调用 OpenAI Images 或火山方舟 Images API，AI Video Owner 校验账户/模型目录并把经签名检查的图片原子保存到每项目 `assets/`；认证路由和画布生成/重生成按钮已接通。单图上限 16 MiB、账户图片文件总量上限 256 MiB、文件扫描上限 2048 项；提交项目清单后清理失败不会误报保存失败，遗留文件仍计入容量。8 个直接相关包构建、Web/Control Plane 构建、客户端与 Host TypeScript、180 包工作区 Gate、`git diff --check` 均通过；本轮按要求未运行测试，也未发送计费 Provider 请求或重启运行服务，真实模型权限/出图、当前运行服务加载和浏览器/桌面交互未验。

<a id="lfaa-ui-workbench-responsive-panels-20261011"></a>

## 35-工作区响应布局-20261011

目标：修复 `/tasks` Compact/Mobile 工作台右侧上下文栏未复用大屏 Dock/分隔条、打开时顶部留白且不能拉伸的问题，同时保留真正放不下时的窄屏回退，并修复底部终端展开后中间内容重复预留高度。入口为 Web `/tasks`；列宽预算、Dock/Overlay 切换、底部行与拖动状态由 `packages/client/ui-dockkit` 的 `ResizableWorkbench` 唯一持有；上下文栏内部标题/关闭按钮由 `packages/client/ui-workspace` 持有。

设置盘点：沿用 `general.navigationLayout`、既有 ChromeState 工作区栏位开合/尺寸记忆和现有外观令牌；不新增设置、不改默认值/持久化/用户偏好。应用 Compact/Mobile 右 Dock 在右栏与至少 220px 中间区及共享分隔条可共存时启用，并复用大屏 Grid/拉伸 Owner；空间不足时回退到共享的可拉伸 Overlay，面板顶边贴齐工作台且不覆盖左导航，保存的右栏宽度继续有效。Mobile Dock 已为终端建立独立 Grid 行时，中间区不再内嵌重复的终端底部留白；仍使用绝对 Overlay 终端时保留原内容避让。

允许修改 DockKit 布局计算、共享响应式样式、上下文栏标题样式、直接回归、DockKit README、架构事实与本合同/索引；禁止改设置数据合同、重置用户偏好、改终端执行/内容、影响通用 Settings Surface 或 Desktop 双 Dock、覆盖/清理无关工作树修改、重启服务、提交或发布。

验收：覆盖 320/390/530/754/850px 及左导航展开/收起、右栏开合、终端开合组合。530px 右栏可进入 Dock，推动中心区且共用分隔条可拖动；更窄无法同时保留 220px 中间区和右栏下限时才使用 Overlay，Overlay 顶边无空白且共用拖动入口可用。右上关闭按钮可见且可操作；Mobile Grid 终端行打开时中心区无重复底部 padding、输入区不被顶起并且终端位于其专属行，Overlay 终端模式原有避让保持；无横向溢出。运行直接响应式回归、DockKit/Web 构建、类型与 workspace Gate、差异检查，并通过当前网页或本地源码页检查实际 DOM 边界与交互；帧时间及真触屏设备未测时明确注明。

前一版把窄屏右栏强制铺成 Overlay，且隐藏了共享分隔条；用户反馈其行为与大屏不一致。本轮修正：在至少 220px 中间区和右栏/分隔预算都可满足时进入共享 Dock；Overlay 只用于空间确实不足的情况，并沿用相同尺寸状态、拖拽 Owner 和工作台顶边。

本轮实施：修正响应式右栏 Dock 阈值和动态宽度预算，使 530px 工作区能保留至少 220px 中间区并进入与大屏相同的 Grid Dock；左栏展开时以其实际宽度和两根分隔条重新计算空间。可并排时使用同一条右侧分隔条拖动并推动中间区；空间不足时才回退现有 Overlay，沿用记忆宽度和拖动 Owner，面板从工作台顶边开始且不覆盖左导航。移除了 Overlay 状态下与 Dock 重复的顶部留白及隐藏拖动条规则。补齐小屏独立终端 Grid 行的中间区底部留白计算，未改终端 Owner。

本轮验证：响应式定向回归 6/6 通过；DockKit 构建、客户端/Host 类型检查、Web 构建、`check:workspace`（180 包）及 `git diff --check` 通过。构建 Web 有 Vite 大 chunk 提示。当前 `/tasks` 网页实测：530px 右栏进入 Dock，分隔条实拖宽度 245→233→245px；390px 与 320px 回退 Overlay，顶边无空白、拖动条仍可见，页面横向滚动宽度分别为 390/320px；754px（浏览器实际 `innerWidth` 755px）左栏和右栏同时 Dock 时左栏 200px、中间区约 244px、右栏 245px，均未重叠；打开底部终端后使用独立 Grid 行且中心区无重复底边留白；850px 检查无横向溢出，右栏继续 Dock。已恢复浏览器默认尺寸 755×960，`/tasks` 与右栏保持打开、左栏收起、终端关闭。设置沿用 `general.navigationLayout`、现有栏位开合/宽度记忆及外观令牌，未新增或修改用户设置；未重启 Control Plane/Daemon，未测真触屏设备和帧时间。

<a id="lfaa-ai-work-idle-fade-transition-20261011"></a>

<a id="lfaa-ai-work-idle-fade-transition-20261011"></a>

## 36-空闲渐隐效果-20261011

目标：修正 AI Work 回复空闲虚化的强度语义和生硬切换。入口为 `/tasks`；计时与空闲状态归 `packages/client/ui-chat`，强度 CSS 变量由共享 Workbench 映射，设置持久化仍归 Settings Owner。复用 `appearance.advanced.aiWorkOutputFocusBlurEnabled`、`aiWorkOutputFocusBlurIdleSeconds`、`aiWorkOutputFocusBlurPercent` 和 `reducedMotion`；不新增设置、不改默认值、持久化与计时。0% 保持清晰；强度逐步增加现有 0–8px 模糊并降低回复不透明度；100% 在空闲后将回复完全淡出，活动后平滑恢复。空闲与恢复均用有限 CSS transition；遵循“减少动态效果”开关和系统偏好，不增加逐帧 JS 动画或额外订阅。

允许修改 AI Work 空闲虚化样式、Workbench 强度映射、设置中心说明、Client README、架构事实、直接回归及本合同/索引；禁止修改设置数据合同与默认值、空闲活动事件/计时器、Provider/Session/权限、其他外观层，覆盖或清理工作树既有修改，或重启运行中服务。验收：0% 不模糊且不淡出；100% 空闲后回复视觉上完全透明；活动后回复清晰可见；中间值同时反映模糊与淡出；两方向均平滑过渡，减少动态效果启用时立即切换；隐藏页面暂停计时、卸载清理保持原样。运行空闲虚化直接回归、聊天包构建、必要类型/工作区 Gate 与差异检查；使用当前运行的 `/tasks` 做可用的浏览器视觉验收，不能从未加载的新源码声称通过，帧时间未实测时明确注明。

本轮实施与验收：复用原账户设置，将百分比映射为 0–8px 模糊及 `1 - percent / 100` 不透明度；回复区、刻度、滚动条和相关控件的 `filter`/`opacity` 使用 240ms CSS 过渡，沿用减少动态效果的即时切换规则，计时器与 Settings Owner 未变。通过 Vite 源码页 `127.0.0.1:5173/tasks` 连接当前 Control Plane `127.0.0.1:3000` 验收：真实设置读回为 1 分钟、100%；静置满 1 分钟后回复完全淡出并透出壁纸，输入框仍清晰；点击聊天空白处触发活动后回复恢复清晰。空闲虚化回归 3/3，ui-chat/ui-layout/ui-settings 包构建、客户端/Host TypeScript 检查、`check:workspace`（180 包）与 `git diff --check` 通过；为通过文档 Gate，同时补齐同文件既有响应式任务缺少的索引锚点。仓库未定义 `workspace-preflight` 脚本。`runtime-build-state.mjs web` 返回 `['host','web']`，因此没有重启 Control Plane 或构建覆盖当前 3000 的 Web 产物；验收使用的是源码 Vite 页。未测大型历史消息列表帧时间/50ms 长任务，也未单独读取操作系统减少动态效果状态。

<a id="lfaa-ai-work-session-branch-lineage-20261011"></a>

<a id="lfaa-ai-work-session-branch-lineage-20261011"></a>

## 37-会话分支来源-20261011

目标：在 `/tasks` 等 AI Work 入口中，普通消息分支刷新或重新打开后仍能看出它从哪个会话延续，并能回到仍可用的父会话；分支中的继承消息也可继续分支或编辑。现有 Session JSONL `session/end-seed` 是父会话与精确上下文边界的唯一权威；Session Owner 派生来源，JSONL 分页扫描顺带投影，Session Controller 沿认证路由返回，`ui-chat` 展示及导航。原会话不改写，分支继续使用已复制的精确事件前缀和独立 Session。

配置盘点：没有与来源关系对应的设置中心项，不新增设置。界面沿用现有主题、字体、颜色与无动态偏好。允许修改 Session Owner、Session JSONL 分页读取、认证 Session Controller、连接 API、AI Work 聊天展示、这些包的直接说明和本合同，以及对应长期回归；禁止新建记忆存储/会话 Owner、重写历史日志、读取其他账户会话、重复扫描日志、扩大工具权限、覆盖既有改动、重启服务、提交或发布。

验收：普通消息分支在创建后及重载后均能从真实日志显示父会话标题；父会话未归档且仍在当前应用会话列表时可返回父会话，归档/缺失时显示来源但不尝试越权打开。继承消息的展示 ID 能在服务端解析回原事件，嵌套分支和编辑分支都按该消息精确截断。非分支会话无来源标记。来源从消息分页已有的完整单遍日志扫描派生，不增加每条会话的额外扫描；账户隔离和分支正文上下文保持现状。创建分支选项弹窗须在当前 `.workbench-shell` 可视区域居中；宽度随所属容器缩小且不超出可用区域，窄栏与短屏内容可滚动、操作可达，不以聊天滚动位置作为定位基准。浮层布局用 CSS Grid/Flex，不用 `inline-block`。运行 Session JSONL/分页、客户端请求及弹窗响应式直接回归、受影响包及入口构建、类型检查、工作区与差异检查；未加载到真实浏览器/设备时如实标注 UI 尚未验收。

实施记录：消息分页首屏在既有 JSONL 扫描中读取最新 `session/end-seed`，Session Owner 按账户/App 核验父会话并返回其标题与归档状态；来源缺失或越界只返回不可用提示。派生消息在私有 JSONL 投影中保存原事件 ID/Run ID 关联，使继承回复可再分支、继承问题可编辑；这些关联不进入公开消息投影。聊天页刷新后展示固定来源条，父会话仍开放时可点击返回并恢复其项目。下一轮从子会话的继承消息行构造 `turn.history`，Agent Loop 以它初始化实际请求上下文；账户级长期记忆仍由 `personalization.memoryEnabled` 等现有设置与记忆 Owner 提供，不会复制成分支私有记忆。原会话与工具授权不变。新界面只使用现有外观令牌。

本轮补充：创建分支选项弹窗继续挂载在当前 `.workbench-shell`。为避免 Ant Design `centered` 内部使用 `inline-block`，改为对浮层容器使用 CSS Grid 居中；弹窗宽度采用 `min(560px, 100%)`，并受容器宽高约束，短屏内容可滚动。没有改动聊天滚动位置、主题或设置映射。

验证记录：`session-kernel-persistence.test.mjs` 9/9 通过（含日志重载、嵌套分支/编辑对原消息精确映射、正确父会话、账户隔离、普通会话无来源及归档来源）；`client-requests.test.mjs` 7/7 通过（来源随首屏消息响应返回，仅 1 个请求）。`pnpm run typecheck` 与 `pnpm run check:workspace`（180 包）通过，`git diff --check` 通过；`lfaa-session-persistence-jsonl`、`lfaa-session`、`lfaa-client-connection`、`lfaa-api-session-controller`、`lfaa-client-ui-chat` 五个能力包构建通过，产物位于根 `dist/packages/`。`workspace-preflight` 不存在。端口 3000 仍有服务，因此没有运行可能覆盖正在服务目录的 Web/Control Plane 入口构建，也没有重启服务；真实浏览器布局/点击、帧时间与桌面未验。

本轮验证：`session-kernel-persistence.test.mjs` 9/9（新增断言确认分支的下一轮 `turn.history` 同时含继承的问题、回答和分支新输入）；`client-requests.test.mjs` 7/7、客户端响应式回归 4/4（分支弹窗与工作台布局）、`pnpm --filter lfaa-client-ui-chat run build`、`pnpm run typecheck`、`pnpm run check:workspace`（180 包）及 `git diff --check` 均通过。本地工作台真实浏览器 1280×720 视口确认弹窗相对当前视口居中；窄设备真实浏览器/短屏与桌面未验，帧时间未测。`node scripts/runtime-build-state.mjs web` 返回 `["host"]`，当前 Host 输出落后于源码，实际页面缺少分支来源标记；保留运行中的 3000 服务，未构建 Web/Control Plane 入口、未重启服务。

响应式补充验证：`client-branch-modal-responsive.test.mjs` 与 `client-workbench-responsive.test.mjs` 4/4 通过，锁定 Grid 居中、容器自适应限宽、短屏滚动及既有 Compact/Mobile 布局；`lfaa-client-ui-chat` 构建、类型检查、180 包工作区检查及 `git diff --check` 通过。当前 `127.0.0.1:3000` 服务保持运行，未重建 Web/Control Plane 入口或重载页面；真实浏览器/物理设备显示和帧时间未测。

本轮复验：Session JSONL、客户端请求、分支弹窗与工作台响应式回归共 21/21 通过；Session JSONL、Session、Session Controller、Client Connection、UI Chat 五个包构建通过；`pnpm run typecheck`、`pnpm run check:workspace`（180 包）及 `git diff --check` 通过。当前本地浏览器中的弹窗在 1270×713、390×845、320×568、568×320、768×1024 五种视口均实测相对 `.workbench-shell` 居中且未越界，创建/取消操作可见；测试后恢复默认视口。`runtime-build-state.mjs web` 仍返回 `["host"]`，依任务合同保留运行中的 3000 服务，未构建或重载 Control Plane；因此父会话来源条在当前 Host 上的创建后/刷新行为仍未验收。未测物理设备、触屏与帧时间；仓库没有 `workspace-preflight` 脚本。

用户随后明确授权覆盖本合同中的“禁止重启服务”限制。本轮只重建 Control Plane 到根 `dist/apps/control-plane/`，`runtime-build-state.mjs web` 随后返回 `[]`；仅重启原 `127.0.0.1:3000` 的 LFAA Web 进程，并保持 `--no-local-daemon`，未重启 Daemon。端口健康检查 HTTP 200。重启后在真实浏览器重新打开已有分支，来源条显示“接续自 你好，请简单回复一句。”，此前完整消息前缀可见；从来源按钮可返回父会话。分支弹窗重启后复验仍相对工作台内容区居中，创建/取消按钮可见；多视口响应式尺寸沿用上段五组真实浏览器实测。没有发送新的 Provider 请求，因此未验收新输入后的真实模型回答差异；分支区别由独立会话与继承前缀保证，空分支在发送下一条新消息前显示相同历史是预期行为。未测物理设备、触屏与帧时间。

<a id="lfaa-ai-work-session-branch-memory-20261011"></a>

<a id="lfaa-ai-work-session-branch-memory-20261011"></a>

## 38-分支对话记忆-20261011

目标：修正普通消息分支的上下文语义。`/tasks` 与受管 Worktree 分支从已完成回答创建一个独立新聊天；Agent Loop 使用当前已配置 Provider 生成有界的结构化对话记忆，Session Owner 只保存该记忆、来源关系及源会话计划状态，不复制父会话的可见问答/工具历史。后续每轮都从 JSONL 中的分支记忆事件恢复模型上下文；父会话保持不变。此合同取代普通回答分支的“复制精确事件前缀”行为；编辑问题仍须按问题前截断，侧边聊天仍须读取真实快照，不改变两者语义。

Owner：Agent Loop 拥有模型摘要调用、无工具约束、Provider 失败和用量；Session Owner 从已完成回答推导父事件边界、按同账户/App 校验、创建只含压缩记忆的新 Session，并从唯一 JSONL 日志投影下一轮模型上下文与来源；Session Controller/Workspace Controller 拥有认证、限流和项目/Worktree 校验；ui-chat 拥有来源条位置和分支创建状态。来源内容是不可信数据，只能摘要，不执行其中的指令；摘要请求不得派发工具、写入账户长期记忆或暴露隐藏推理/凭据。失败或取消时不得留下空白或不完整分支。分支创建须使用真实 Provider；不能静默退化为复制全部历史或固定文案。

设置盘点：复用当前模型账户、`aiRuntime.contextWindowTokens`、`aiRuntime.maxOutputTokens`、`aiRuntime.speed`、`aiRuntime.requestTimeoutSeconds` 与 `permissions.mode`；分支摘要有独立的产品有界输出，不修改用户偏好。`aiRuntime.autoCompaction` 继续只控制普通 Run 的自动压缩，不能关闭显式分支记忆；`personalization.memoryEnabled` 仍只控制账户长期记忆，分支记忆不进入该 Owner。界面沿用现有外观设置令牌；不新增设置、第三方运行依赖、账户记忆或权限 Owner；Workspace Controller 声明对现有 `lfaa-agent-loop` 包的直接 workspace 依赖以复用摘要 Owner。

允许修改 Session 事件类型/投影、Agent Loop 分支摘要与模型用量归属、两条分支 API、AI Work 来源条布局、对应直接回归和包说明/架构事实。来源条显示在聊天历史底部、输入区上方；分支弹窗继续相对当前 `.workbench-shell` 居中。所有布局须覆盖桌面、平板、手机及窄分栏/短屏，使用 Grid/Flex，不用 `inline-block`。禁止改动 DSH 仓库、编辑分支/侧边聊天语义、复制原始父事件进普通记忆分支、重复 Session Owner、跨账户读取、工具回放、秘密持久化、无边界模型调用、静默降级或覆盖无关工作树改动。用户已明确授权本轮构建 Control Plane/Web 并重启 `127.0.0.1:3000` LFAA Web 以做运行态验收；保持 `--no-local-daemon`，不重启 Daemon。

验收：普通分支 JSONL 中不含源用户/助手/工具事件，只包含有限摘要与准确来源；模型摘要调用使用认证账户当前 Provider/模型，不提供工具 schema，汇总用量可查询；任一分支后续轮次（含刷新/重启恢复）均将摘要作为普通上下文资料带入模型请求，且新问答仍独立可见；嵌套分支会把前代摘要与当前分支问答重新压缩；摘要/Provider 失败不创建分支。`session/end-seed` 的精确复制分支计数不能被摘要分支污染；侧聊和编辑回归不变。来源条位于最后一条消息之后、Composer 之前，可返回父会话；多个响应式容器尺寸不越界，短屏滚动和操作可达。运行 Agent Loop 摘要/取消/失败/无工具与用量回归、Session JSONL 持久化/继承边界/嵌套分支回归、两路 Controller/API 接线回归、分支来源布局响应式回归、相关包构建、类型/工作区/差异检查；明确标注真实 Provider、浏览器、重启与设备是否实测。构建产物只写仓库根 `dist/`。

本轮实施与验收：已将普通回答分支改为独立空白 Session，只持久化 Provider 生成的有界记忆、准确来源和必要计划状态；每轮从分支事件重建模型上下文，嵌套分支重压已有记忆与分支本地对话。摘要错误/取消不创建子会话；摘要调用无工具 schema，模型用量归入分支。来源条移到历史底部、Composer 上方，弹窗用 Grid 相对 `.workbench-shell` 居中并约束容器宽高；沿用已有 AI Runtime、长期记忆与外观配置，没有新增设置。没有改动 `H:\deepseek-harness`。

源码验收：分支记忆、Session 持久化和弹窗响应式定向回归 15/15 通过；`pnpm run typecheck`、`pnpm run check:workspace`（180 包）、`git diff --check` 通过；六个受影响包构建及 `pnpm run build:control-plane`、`pnpm run build:web` 通过，入口产物写入根 `dist/`。浏览器窄工作区约 530×965 实测来源条位于旧分支历史底部/输入框上方，弹窗相对工作台居中且取消入口可用；该会话是此前创建的整段历史分支，因此这只验收布局，不代表新记忆分支已在线创建。`127.0.0.1:3000` 当前仍由 PID 39448 的旧 Host 进程提供（`lfaa.mjs web --no-local-daemon`，HTTP 200）。虽已获用户授权重建和重启，停止/启动命令仍被执行策略拒绝，故新 Control Plane 尚未载入，刷新后端与新记忆分支端到端行为未验收。真实 Provider 未调用；本轮没有把用户现有对话发送给 Provider。真实 Provider、物理设备、触屏及帧时间仍未验收。

<a id="lfaa-ui-responsive-app-nav-20261011"></a>

<a id="lfaa-ui-responsive-app-nav-20261011"></a>

## 39-响应式应用导航-20261011

目标：修复应用工作区响应式布局中二级导航覆盖聊天中间区、聊天内容贴近左右边缘的问题。运行入口为 `/tasks` 等 `ApplicationWorkspace` 页面；几何唯一 Owner 为 `packages/client/ui-dockkit/src/ResizableWorkbench.tsx` 与 `workbench-layout.config.ts`，应用工作区负责启用响应式左 Dock，组件样式分别归 `ui-dockkit` 与 `ui-workspace`。移动布局中，若工作台容器宽度足以同时保留侧栏最小宽度和中心区最小宽度，展开二级导航后必须占据真实 Grid 列并推动中心区；更窄时沿用 Overlay，避免中心区不可用。AI Work 在响应式宽度下增加聊天整体左右内边距，消息与输入控件不贴边。

沿用 `settings.general.navigationLayout` 和工作台现有记忆的栏位开合/宽度；不改写用户偏好或设置中心。外观继续继承主题、字体字号、强调色、背景遮罩/模糊与减少动态效果。允许修改 DockKit 响应式尺寸计算、应用工作区调用、对应 CSS、`client-workbench-responsive` 定向回归、相关包说明、系统架构事实和本合同；禁止新增设置/依赖、改变 Settings 等其它 Surface 的 Overlay 行为、引入第二套导航状态、覆盖已有工作树改动或重启运行服务。

验收：约 750px 工作台容器展开二级导航后，侧栏处于 Grid 左列、中间区的左边界相应右移，二者不重叠；约 488px 的 Mobile 工作台在纯布局回归中确认可保留至少 260px 中心列；低于左 Dock 条件时纯布局回归确认使用 Overlay；聊天整体左右保留可见间距，输入区与消息均不溢出；Settings 通用 Surface 的既有响应式回归保持通过。运行直接布局回归、受影响包与 Web 构建、类型/工作区/差异检查；真实浏览器在当前约 750px 窄窗口检查导航开合，未测帧时间或其他物理宽度时明确标注。

实施记录：`ResizableWorkbench` 仅在应用工作区启用 `responsiveLeftDock`；响应式左栏阈值由统一布局配置按“中心最小宽度 + 左栏最小宽度 + 分隔列”计算。可并排时 Mobile 网格让二级导航占据左列并推动中心，空间不足仍用 Overlay；右 Dock 的阈值会给左 Dock 和中心预留最小空间。应用 AI Work 在窄容器下对聊天整体增加自适应左右内边距。沿用现有 `general.navigationLayout`、外观设置和已保存 Dock 状态，无新设置、CSS 变量或权限变化。

验证记录：`node --import tsx --import ./register-package-loader.mjs --test tests/client-workbench-responsive.test.mjs`（CLI 目录）2/2 通过，覆盖 750px/488px Dock 可用与 460px/非应用 Surface Overlay 边界；`pnpm --filter lfaa-client-ui-dockkit run build`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`（含客户端 TypeScript 检查）、`pnpm run check:workspace`（180 包）、`node scripts/runtime-build-state.mjs web`（空差异）和 `git diff --check` 通过。`/tasks` 当前实际网页重新加载后，在约 750px 窄窗口展开导航；侧栏宽 200px 位于独立左列，聊天中心明显右移且未被覆盖，消息和输入两侧留出间隔。未重启 Control Plane，网页刷新已加载新构建。未做帧时间测量或 488/460px 真实浏览器尺寸验收。

<a id="lfaa-ui-responsive-left-resize-handle-20261011"></a>

<a id="lfaa-ui-responsive-left-resize-handle-20261011"></a>

## 40-左栏拖动边界-20261011

目标：修正 `/tasks` 等应用工作区在 Mobile 左 Dock 下错误的左侧栏宽度把手位置，并修正窄屏横向留白仍按整个浏览器窗口计算、相对中间栏显得过大的问题。必须与大屏一致地排列“二级导航、标准分隔条、中间区”，复用 1px 分隔轨道、扩展热区及原有拖动 Owner；向右拖动/按向右键加宽二级导航，向左缩窄。聊天外层与消息列的左右留白须按中心容器实际宽度收缩，不得继续按占用宽度已被侧栏扣除前的 viewport 计算。触屏无 hover 时只常显同一标准分隔线，不增加新的把手轨道或反向交互。桌面和通用 Surface 保持原样。

沿用 `settings.general.navigationLayout`、现有栏位宽度记忆和外观设置，不新增设置。允许修改 DockKit 的响应式 Grid 列顺序、共享分隔轨道预算、定向回归、相关包说明、架构事实及本合同；禁止改变非应用 Surface 或桌面布局、引入第二套导航状态、覆盖已有改动或重启运行服务。

验收：Mobile 左 Dock 中二级导航在左、标准分隔条紧随其后、中间区再向右；Pointer/键盘向右增加左栏宽度、向左减少；触屏可见同一标准分隔线；低于 Dock 阈值仍使用 Overlay，桌面及 Settings 不变。聊天外层与消息列在窄中心容器中使用容器宽度渐进收窄留白；至少验证 626px 当前布局及一个更窄设备宽度，确认消息/输入未贴边、两侧间距未累计成大空档。运行定向回归、DockKit/Web 构建、工作区与差异检查，并在当前网页验证位置和拖动；未测帧时间时明确说明。

实施记录：更正先前误将把手放到二级导航左侧的实现。Mobile 左 Dock 现在沿用桌面列顺序与同一标准 1px 分隔轨道/热区，向右拖动和 ArrowRight 增宽；只有触屏无 hover 时常显该标准线。窄于中心区、侧栏和标准分隔条预算的容器继续 Overlay。随后按 626px 实际布局发现中心栏约 361px，但聊天外层和消息列各用 `vw` 计算左右留白，文本累计缩进约 25px；本次把这两层改为依据中心区容器宽度逐步收紧，不改变分隔条、拖动、导航或 Overlay。只由应用工作区启用，沿用设置中心 `general.navigationLayout`、现有栏宽记忆和外观配置。

验证记录：`node --import tsx --import ./register-package-loader.mjs --test tests/client-workbench-responsive.test.mjs`（CLI 目录）3/3 通过；DockKit 构建、Web 构建（含 Client TypeScript 检查）、`check:workspace`（180 包）和 `git diff --check` 通过。当前 `/tasks` 标签页在 626px Mobile 容器展开导航后，实测二级导航 x=64、宽 200px；标准分隔条 x=264、宽约 1px；中间区从 x=265 起，顺序和大屏相同。Pointer 向右拖动后栏宽为 213px；按两次 ArrowLeft 回到 200px，导航保持展开。最新间距回归使用构建后的网页，在 626/530/525px 左 Dock 布局下中心宽度约 361/265/260px、外层与消息列的两层间距分别约 4.5/4/4px，累计约 9/8/8px；在 390/320px Overlay 布局下累计约 8.6/8px；五种宽度均未出现页面横向溢出。`runtime-build-state.mjs web` 返回 `["host"]`，Web 构建指纹已更新，当前仅 Control Plane 指纹落后；本次为纯客户端样式修复，未构建或重启控制端。触屏常显由 `(hover: none)` 规则实现，本次浏览器为鼠标环境，未在真触屏设备验收；未测帧时间。设置中心没有新增或修改配置，未重启服务。

本轮补充目标：用户截图复现 320px/390px Mobile Overlay 展开二级导航时，半透明导航下仍透出聊天正文，造成文字叠读；530px/626px Dock 必须继续推动中心区，保持独立列。验收还需在 320px、390px、530px、626px 检查导航及右侧上下文栏的开合组合：窄屏 Overlay 打开时被遮挡的中心内容不可继续显示/交互；Dock 状态左右列不得重叠；右侧 Overlay 打开后须完整位于工作台视口内。随后用户指出最小屏与中屏仍有重叠/裁切，本轮继续覆盖 753/754px 三栏切换边界：三栏同时展开时左、中心、右均不得低于各自最小宽度；Compact/Mobile 下右栏可临时收窄但不写回右栏记忆宽度，空间不足时按现有响应式规则切换 Overlay。允许修改 DockKit 样式和响应式宽度预算、定向回归、对应包说明/架构事实及合同记录；不改设置、不重启运行服务。此前只验收左 Dock/Overlay 的截图不足以证明右侧和三栏预算正确，须按本补充重新验收。

本轮实现与验收：修正 Compact/Mobile 三栏同时展开时的动态 max 预算，使左栏不会被保存的右栏宽度压到最小值以下；布局仅临时收窄右栏，Desktop 原预算不变。Overlay 打开时隐藏被盖住的中心内容，导航与上下文栏互斥；Dock 状态保留“导航、1px 分隔条、中间区、分隔条、右栏”顺序。实际 `/tasks` 浏览器按 320/390/530/626/753/754px 检查两类面板的开合，页面横向滚动宽度均未超出视口；320/390px 左右 Overlay 各自展开后另一栏关闭；530/626/753px 左导航 Dock 展开后中心分别为 265/361/488px，右侧 Overlay 展开后左 Dock 收起且完整贴合右边界；设置 754px 时浏览器 `innerWidth` 为 755px、工作台宽约 691px，三栏同开实测左 200px、中心 260px、右 229px，均达到各自最小宽度。

定向回归 `client-workbench-responsive.test.mjs` 4/4 通过，覆盖 753/754px 三栏切换；DockKit 构建、Web 构建（含 Client TypeScript 检查）、`check:workspace`（180 包）和 `git diff --check` 通过。刷新当前 `/tasks` 后再验收 754px 三栏坐标；未重启 Control Plane，`runtime-build-state.mjs web` 仍报告 Host 指纹过期（`["host"]`），本次只改客户端布局。未做触屏设备和帧时间验收。设置沿用 `general.navigationLayout`、当前栏位状态及外观/透明度配置，没有新增或修改设置项；本次未专门读取或写入用户设置数据。

<a id="lfaa-ai-work-composer-responsive-width-20261011"></a>

<a id="lfaa-ai-work-composer-responsive-width-20261011"></a>

## 41-输入框响应宽度-20261011

目标：修复 `/tasks` 三栏响应式布局中 AI Work 提问输入框超出中间聊天栏、伸入右侧栏的问题。运行入口为 Web `/tasks`，组件与样式 Owner 为 `packages/client/ui-chat`；外侧栏宽度和开合仍由 DockKit 管理，不在此重复实现。提问框内部 Grid 列必须受聊天容器宽度约束，TextArea 只能填满该列，不能由隐式网格的内容最小宽度撑开。

设置：沿用现有主题、壁纸/遮罩、模糊、字体字号、对比度和减少动态效果映射；本布局问题不需要新的设置项。允许修改 AI Work 提问框样式、直接回归、ui-chat README 与本合同；禁止改 DockKit 三栏尺寸、用户保存的栏宽/偏好、聊天行为、其他 Surface、增加依赖或重启服务。

验收：工作台 755px 视口且左右栏展开、中间区约 260px 时，TextArea 与提问框均不超出提问框右边界，回复/右栏无覆盖；530px 及更窄布局仍无横向溢出。运行直接样式回归、ui-chat 构建、Web 构建、类型检查、check:workspace 和差异检查；使用当前 `/tasks` 浏览器在窄三栏及更窄尺寸核对 DOM 边界。未测触屏设备和帧时间时明确记录；不以构建结果代替浏览器实测。

实施记录：已在 `.ai-work-chat__composer` 上设置 `min-width: 0` 与单列 `minmax(0, 1fr)`，并限制内部 `.ant-input` 为 `width: 100%; min-width: 0`。根因是中间栏收窄时，提问框的隐式 Grid 轨道仍按 TextArea 的内容最小宽度扩张，造成输入框越过中间栏、伸入右侧栏；修复只约束输入框自身，不改外侧栏布局或用户保存的宽度。设置沿用当前主题、字体、遮罩和模糊令牌，没有新增或修改设置项。

验证：`client-ai-work-composer-responsive.test.mjs` 1/1 通过；ui-chat 包构建、Web 构建（Vite 2245 modules）、类型检查、`check:workspace`（180 包）与 `git diff --check` 通过。构建后刷新当前 `/tasks` 并读取实际 DOM 边界：755px 三栏展开时中心约 260px，提问框与 TextArea 均留在提问框边界内，TextArea 右边缘距右栏约 24px；530px、390px、320px 下提问框与页面均无横向溢出。浏览器已恢复 530×960 默认尺寸，左右附加面板保持收起。`runtime-build-state.mjs web` 返回 `["host"]`，表明 Host 指纹过期；本次仅改 Client 样式，因此未构建或重启 Host/控制端。未在真触屏设备验收，也未测帧时间。

<a id="lfaa-ai-work-response-timeline-20261011"></a>

<a id="lfaa-ai-work-response-timeline-20261011"></a>

## 42-回复过程时间线-20261011

目标：按用户七张截图改造 `/tasks` AI Work 回复结构。运行中总计时“已处理”不可展开，真实阶段正文与可折叠工具组按顺序交错；问题/审批沿统一 Owner 等待并在原位置保留问题及回答；文件变更复用真实 Git 差异入口。结束后“用时”默认折叠完整过程，分隔线下只显示最终答案；按实际时长显示时分秒。模型继续读取设置中心当前账户、模型和 reasoning_mode，不限制厂商能力、不硬编码业务步骤，不展示隐藏推理、原始工具参数/结果。

Owner：Agent Loop 记录每次可见模型正文的范围和活动落点；System Prompt 仅约定真实、简短的阶段沟通，不决定业务步骤；Session JSONL/内核持久化并投影安全展示字段；Connection SSE 保留分段顺序和已有帧合并；ui-chat 展示过程及复用原提问/审批/文件审阅。允许修改以上直接实现、回归、对应 README、架构/计划/本合同；禁止第二套会话、权限、存储、模型路由、虚构工具记录、改写历史用户数据、覆盖无关改动、提交或发布。旧记录缺少分段时保留原正文，不推测拆分。当前运行服务不自动重启；需要加载 Host 改动时另行说明具体进程影响。

实施记录：正文仍为一份 content，parts 只保存稳定 ID、连续范围及阶段/最终类型（最多 256 段）；活动首次发布时固定落点。delta/presentation、Run 原子快照、Session JSONL/分页/分支共用同一投影协议。ui-chat 将阶段正文、可折叠工具组和问题/审批卡片按落点排列，完成后原生 details 默认折叠过程、分隔线下独立显示最终答案，复制仅取最终答案；旧消息不猜测拆分。工具组名称来自真实活动元数据，文件变更继续复用现有项目 Git 差异入口。模型仅增加简短、真实的阶段沟通指引，业务决策、模型/思考力度和 Permission Owner 不变。样式只使用原主题/设置令牌，流式文本与稳定 Markdown 分开复用，时间线只在消息数据变化时重算，不新增计时器、订阅、依赖或动画。

源码验证：66 项唯一的定向回归通过，覆盖 Agent/Session JSONL、跨进程/分页/分支恢复、真实 Permission 决定记录、SSR 默认折叠、阶段/工具/交互顺序、SSE 帧边界/断线/撤销、暂停继续和既有界面性能约束。CLI 下运行 `node --import tsx --import ./register-package-loader.mjs --test` 对应 agent-response-latency、agent-runtime、session-kernel-persistence、ai-work-response-timeline、client-performance、ai-work-activity-duration、ai-work-sse-lifecycle、ai-run-pause-resume；Permission 新断言最终定向重跑 4/4 通过。5 个受影响包、Web/Control Plane 构建，Client/Host 类型检查、check:workspace（180 包）、git diff --check 与 `runtime-build-state.mjs web`（空差异）通过。当前不存在 workspace-preflight，未运行。回归中 Provider 使用隔离替身，不代表现场模型或帧时间测量。

加载授权：用户本轮明确回复“允许重启，继续网页验收”。核实原 PID 37348 后仅重启该控制端，仍使用 `H:/LFAA1/data` 和 `web --no-local-daemon`，新 PID 30932 于本地 2026-10-11 15:29 就绪。没有停止或重启 Daemon，没有修改账户偏好。网页实际验收另记，不以构建或替身通过代替。

现场验收与收尾：已登录 `/tasks` 沿用当前 deepseek-flash 和完全权限，通过真实 Provider 完成两条只读 PowerShell：等待 2 秒后读时间、独立进展说明、读版本、最终总结，网页整轮显示 7 秒。提问用例实际弹出两个选项并等待，选择“读取时间”后继续同一 Run，原问题与答案留在过程落点；整轮 38 秒包含操作员等待，不作为模型延迟样本。复制按钮现场核实只复制最终总结，不包含过程或问题。收尾补齐 web.search/web.fetch 的实际查询/去身份及查询串的 URL 预览和文件组中的可见路径；新增一项网页隐私回归后最终 67/67 通过。沿本轮授权加载收尾构建，PID 31256 于本地 15:39 就绪，Daemon 不变。真实 web_fetch 读取用户已引用的 DeepSeek 官方页面，整轮 3 秒完成，活动可展开查看实际地址。重启及刷新后，7 秒/38 秒记录、分段顺序和原用户答案恢复，过程默认折叠，最终答案独立显示。最终受影响包、Web/Control Plane 构建，Host/Client 类型、180 包工作区和差异检查通过，Web 构建指纹空差异。

性能证据与边界：定向回归验证 1000 个同帧片段合并为一次更新、跨段先冲刷，旧请求/帧撤销及稳定正文复用；现场完成态与运行态按实际数据展示。未测浏览器帧时间、桌面安装版、其他厂商真实模型、网页搜索 Provider 的真实查询，以及实际项目文件 Git 差异点击；对应展示/Owner 保留及安全边界由回归覆盖，不能冒充现场通过。原历史没有范围时只保留旧正文，不重写。截图和最终回归日志保存在根 `dist/.tmp/ai-work-response-timeline/`（completed.png、expanded.png、question.png 和 regression.log），作为验收证据保留，不进入产品装配。

设置：沿用 Settings Owner 的账户模型、aiRuntime.showContextUsage、各执行预算及 general.permissionNotifications/questionNotifications；外观沿用共享主题/强调色/文字颜色/字体字号/对比度/壁纸/遮罩/透明/模糊和 reducedMotion 映射，不新增用户开关或重置偏好。布局按截图采用紧凑正文与图标折叠行，不引入营销页布局、额外动画依赖或图片资产。验收：多轮正文不粘连，正文→工具→正文与澄清恢复顺序一致；流式合并不跨正文段，刷新/重连不丢分段；最终答案与过程分离且默认折叠；失败/停止保留真实部分结果；真实文件审阅与权限保持；运行直接回归、受影响包/Web/Control Plane 构建、类型检查、工作区与差异检查，并区分浏览器/Provider/桌面/帧时间证据。

本次体验修正：生成中的当前正文只显示在最终回复所在区域；只有 Provider 已确认属于阶段说明的正文才进入过程时间线，避免同一最终回答从过程区移到结果区造成“输出两遍”的观感。流式期间只格式化已闭合的行内 Markdown（如 `**加粗**`），不提前重排标题、列表、代码块等块结构。验收：流式与完成态同一正文不同时出现在两个区域；已闭合加粗不露出星号；工具往返时阶段正文仍按原落点进入过程；SSE 帧合并/撤销和现有格式化保持原有边界。

<a id="lfaa-agent-dsh-usability-20261011"></a>

<a id="lfaa-agent-dsh-usability-20261011"></a>

## 43-DSH工具可用性-20261011

目标：按用户指定的 `H:/deepseek-harness`（只读参考，HEAD `639ed015397290b3745d163aafe02ffee4aa3f84`）修复智能体实际可用性。对照 DSH 的 assistant-stream、llm-pi-ai/replay/context 与 subprocess 生命周期，并核查 DeepSeek 官方思考/工具协议。入口为 `/tasks` → Agent Loop → 唯一 LLM Provider；Settings/凭据、Session JSONL、Permission、Shell 保持原 Owner。沿用模型账户/模型目录/reasoning_mode、aiRuntime 的输出/超时/重试/上下文/请求与工具预算、general.taskFolder/integratedShell、computerControl.enabled、plugins 与 permissions.mode；不新增或重置设置，不静默换模型。

允许修改 LLM completion、Agent Loop、Session 私有模型协议/历史投影、Shell 进程生命周期及直接相关长期回归、包 README、架构/计划和本合同。保留 Provider 返回的同模型 reasoning_content 以供工具续接及后续轮次；私有协议不得进入消息/SSE/导出/查询工具或普通日志。修复半截流被当完整成功及 HTTP 400 误归因；用有界真实进程复现并修复退出/管道等待与输出落点问题。对比中的暂缓能力不得冒充已接入，不另建 Runtime、Session、权限或模型控制面；不改 DSH，不覆盖无关改动，不提交、不发布、不重启现有服务。

验收：思考→工具→真实结果→模型完成至少两次请求正确续接；跨轮/模型切换/恢复不串 Provider 私有协议，不向 UI 泄露隐藏推理；截断流和错误终态不派发半截工具；Shell EOF/中文/取消/进程退出与有界输出回归。运行直接相关回归、受影响包/Control Plane 构建、Host 类型检查、check:workspace、差异检查；仅在现有凭据/环境可用时做小规模真实 Provider 验收，不把替身或构建作为真实模型/桌面体验证据。workspace-preflight 缺失及未实测项如实记录。

实施记录：保留真实 `reasoning_content` 并绑定账户/Provider/模型来源，沿既有 Session JSONL 保存、跨轮与进程恢复，仅在对应 Provider 请求中续接；公开消息、SSE、事件查询、导出和普通请求快照不包含私有文本。上下文估算计入续接文本。SSE 必须有 DONE 或完成终态，半截正文/工具不当成功、不自动重放；错误帧和错误终态拒绝，400 不再谎报工具不受支持。游戏提示与已有 query/ID 合同一致。Shell 单个超大 chunk 与累计尾部按 UTF-8 字节有界，读游标越过丢弃边界时如实标明 lossy；本机 Windows 的继承管道复现没有出现等待后代退出，故未凭假设修改退出/管道生命周期。computer-use 集成夹具改用正式迁移后再装配业务，不再手工拼接旧 schema，未修改产品迁移或降低断言。

验证记录：本轮 61 项唯一的定向回归通过（35 项 Agent/思考/Shell/Session/computer-use，14 项 computer-use/通用能力/LLM 含 1 项重复，另 13 项 Agent Runtime/活动耗时）。运行命令为 CLI 下 `node --import tsx --import ./register-package-loader.mjs --test` 对应测试文件；4 个受影响能力包 build、`pnpm run build:control-plane`、`pnpm run build:web`、`pnpm --dir apps/cli typecheck`、`pnpm run check:workspace`（180 包）及本次差异检查通过。当前不存在 workspace-preflight，未运行该命令。最终 `node scripts/runtime-build-state.mjs web` 对账必须为空，不能以只检查 Host 的 desktop 指纹替代 Web 对账。

真实模型证据：在现有账户凭据仅内存解密、设置不变的条件下，当前 DeepSeek Flash/high 已通过源码隔离 Agent→Permission→真实 PowerShell→Session：问候 1 次请求/0 工具，1484ms 完成、1241ms 首正文；读时间 2 次请求/1 次真实命令，2275ms 完成、1866ms 首正文，返回退出码 0 与实际时间。隔离用例仅开放该只读命令工具，不代表完整工具池表现。额外直接 Provider 对照中，没有 replay 的旧式工具续接仍被当前端点接受，不能把协议缺口断言为本次全部延迟根因或保证出现 400；本轮小样本不支持普遍提速比例。DSH 后台 jobs/持久终端未接入，其他模型协议和桌面操作/帧时间未运行。

运行服务验收追补：用户明确回复“允许重启控制端，继续验收”，据此仅停止已核实的端口 3000 控制端 PID 36316，以相同 `H:/LFAA1/data` 和 `web --no-local-daemon` 启动修复构建，PID 37348 于本地 2026-10-11 14:34 就绪；未停止或重启既有 Daemon。登录网页 `/tasks` 显示当前 deepseek-flash/完全权限（未修改偏好），问候显示用时 1 秒，真实只读 `Get-Date -Format o` 显示用时 3 秒、输出 `2026-10-11T14:35:37.0928338+08:00`。展开轨迹确认 2 次模型请求与 1 次本机命令全部完成，无残留推理活动；最新 Web 构建刷新后两条回复及耗时恢复。仅通过正常认证页面创建这两条验收消息，不改写原会话文件或设置。截图位于根 `dist/.tmp/agent-dsh-usability-acceptance/browser-acceptance.jpg`，为验收证据而保留。

<a id="lfaa-agent-response-latency-20261011"></a>

<a id="lfaa-agent-response-latency-20261011"></a>

## 44-Agent响应速度-20261011

目标：修复 `/tasks` 智能体简单任务耗时过长、失败后无效尝试和推理活动不结束的问题。只读检查当前 checkout 的既有 Session 发现：问候约 2–3 秒完成；本机应用操作存在多次模型往返，本机命令曾等待 180 秒，超时/非零退出却记录为 complete，中文输出出现乱码；正文开始后仍残留 running 推理活动。以上是现场历史证据，不代表本轮修复已实测。Owner 为 Agent Loop、System Prompt、Shell/PowerShell 和 Shell Tool；模型/凭据归 Settings、Session 归 JSONL、授权归 Permission Owner。沿用模型账户的 reasoning_mode、aiRuntime 的 speed/maxOutputTokens/requestTimeoutSeconds/requestRetries/retryDelaySeconds/maxModelRequests/maxToolCalls/commandTimeoutSeconds，以及 general.taskFolder、已有 Shell 选择和 permissions.mode；不更改默认值或用户偏好，不新增设置。

允许修改上述 Owner 的直接实现、包 README、定向长期回归、架构说明与本合同。修复命令 UTF-8 输出、stdin/取消生命周期、真实执行状态与防重判定、Provider 活动转换及任务规模相称的模型指引；不得硬编码业务流程、关键词路由、降级模型、限制已授权通用工具、绕过认证审批或改写真实运行数据。保留无关未提交改动，不提交、不发布、不重启服务。验收：简单回答一次 Provider 请求且不派发工具；推理→正文→结束/失败无残留活动且时长不被重复结束归零；非零退出/超时/未知结果不作为成功写入并阻止相同失败调用重放；中文命令输出可读，无 stdin 时收到 EOF，已取消信号不启动进程，完成撤销监听器；运行隔离回归、受影响包及 Control Plane 构建、Host 类型检查、check:workspace 和本次差异检查。workspace-preflight 若不存在如实记录；真实 Provider/浏览器/桌面交互和运行服务加载未验时单独说明。

实施记录：已修复 Provider 活动转换与重复结束耗时归零、本机命令真实执行状态、Windows PowerShell UTF-8、无 stdin 的 EOF、预取消拒绝启动与完成撤销监听器；增加目标规模与有界查询指引，模型选择和用户思考力度不变。隔离 Shell 回归修复前 3/4 失败（EOF 等满 500ms、中文乱码、预取消仍启动），修复后 4/4 通过；EOF 用例一次观测从 523ms/超时降至约 48ms/正常结束，仅是合成进程测量，不代表真实模型提速。新增 Agent 回归 4/4 通过，覆盖简单回复单次请求、流失败、四类命令失败/未知与防重，以及成功路径。既有模型思考/LLM/活动耗时/通用能力回归 22/22 通过。既有 Agent Runtime 回归先被测试引导顺序阻塞：在完成正式存储迁移前导入 Writing 工具；调整隔离夹具初始化顺序并对齐实际 schema v51 后 4/4 通过，未修改迁移实现或放宽校验。5 个受影响包构建、Control Plane 构建、Host 类型检查、180 包工作区检查通过。未运行真实 Provider、浏览器/桌面操作、帧时间或运行服务重载；当前仓库不存在 workspace-preflight。原有真实会话和已保存设置未修改。

收尾：本轮共 34 项定向回归通过，最终 Control Plane 构建指纹与源码一致。成功测试的隔离数据已由夹具清理；两次引导失败留下的 `dist/.tmp/lfaa-agent-response-latency-4fZ5qD/` 与 `dist/.tmp/lfaa-agent-response-latency-X9nvwF/` 经路径核对后，递归及逐文件清理均被自动审批拒绝（仅返回 blocked by policy），因此未删除；其中均为本轮合成测试数据，不属于产品运行数据或发行物。

<a id="lfaa-writing-local-files-20261010"></a>

<a id="lfaa-agent-minecraft-storage-repair-20261013"></a>

## 45-Agent游戏存储-20261013

修复提示词：依据用户提供的 Paper 1.12.2 开服失败轨迹，核查自然语言目标→当前 Provider→Skill/工具发现→统一权限→Minecraft 领域服务→目标 Daemon→真实结果→最终交付。读取本机 DSH 相关源码作只读参考，定位导致反复查询、手工安装 Java/核心、补写元数据和重复工具中断的真实原因。模型继续自主理解与选择工具，领域工具负责一次任务内的依赖准备、验证、安装与启动；不得用关键词路由替代模型，不得把请求受理或进程创建报告为开服成功。按真实来源修复下载及 Java 合同，让失败恢复有依据且不重放未知副作用。核查设置中心“项目与存储”、项目上下文与统一文件管理的盘符和目录联动，修复已证实断点。

入口与 Owner：AI Work/Agent Loop、Core Tools、Minecraft service/core-sources/deployment-service、Daemon provisioner/Java/项目文件、Settings 与统一文件服务；每项业务规则保留唯一 Owner。配置使用现有 Provider 与 aiRuntime 请求/输出/工具预算、general.taskFolder/integratedShell、permissions.mode 三模式、minecraftRuntime 默认核心/内存/端口/执行方式与各超时、节点/全局存储位置及适用外观令牌；不得重置用户设置。

允许：以上调用链源码、直接回归、受影响包说明和事实文档。保留已存在的 database.ts、logger.ts、pnpm-lock.yaml 改动；不修改 DSH，不读取凭据正文，不改真实用户/实例数据，不提交、发布或擅自重启服务。模型决定恢复行动，通用已授权 Shell 仍可使用；安全修复保留认证、实时权限、账户/节点隔离、路径/链接检查和运行实例保护。

验收：重复调用返回可供模型纠正的真实反馈而不重复副作用；确认失败与未知结果分别处理；核心与 Java 自动下载使用受验证来源/摘要及目标节点配置目录；部署成功具备真实日志/监听证据。配置存储位置与文件来源一致，列出真实可用盘符且不递归扫盘。运行直接相关长期回归、类型、职责包/入口构建、check:workspace 与差异检查；workspace-preflight 若不存在明确记录。性能给出工具/请求工作量、输出边界与已测耗时；真实 Provider、浏览器、Daemon/Minecraft、桌面和帧时间分别记录，未运行不得宣称通过。

用户追加资料：已读取 `H:/mc/skill/SKILL.md`、Paper 下载脚本及相关核心/版本/排障参考。利用其选型、环境准备、配置、诊断与交付思路，在 Minecraft 能力包内编写适配版 Skill；不执行原脚本、不照搬固定路径/当前版本断言/强制先问规则。Skill 的实际发现、加载、随包资源和卸载撤销需经当前 Registry 与正式 Profile 装配核查。实现及逐文件交付记录见[修复报告](development/agent-minecraft-storage-repair-20261013.md)。

2026-10-13 实机验收续接：用户要求“验收”，并明确同意仅为本次隔离验收接受 Minecraft EULA 与 Paper 许可。允许使用随机回环控制端端口、独立临时数据、测试实例和空闲游戏端口执行真实 Java/Paper 1.12.2 下载、就绪、监听及安全停服，结束清理本次测试数据；不操作或重启已有实例/服务。真实模型验证使用当前已保存 Provider/模型且不回显秘密，不改变真实账户设置；工具/模型请求与耗时、用量据实际轨迹记录。发现的直接执行链缺陷在当前 Owner 内修复并重验，禁止通过预装 Java、手工写实例元数据或改假结果让验收通过。

2026-10-13 浏览器验收纠正：用户明确要求在当前 LFAA 浏览器 AI Work 发送一句话开服，使用现有 Java 与真实 Provider；隔离脚本不作为此项验收。实际复现旧实例转义损坏的 JSON、节点命令 Shell 不透明、实例工具缺少真实目录、新 Paper 下载分支绕过既有推荐 Java 规则导致重复下载 Java 8。允许在 Minecraft/Core Tools/Shell/Daemon 原 Owner 内精准修复这些证据对应问题并新增直接回归；不手工改真实实例元数据来冒充 Agent 自动恢复。可停止并重启本轮自行启动且无运行游戏的验收 Web/Daemon 加载修复，保留其他既有服务、用户配置与实例数据。停止 Agent 目前仅停止等待，不取消已排入 Minecraft Owner 的任务，须如实披露并在当前验收运行中停止自建执行器的下载。

<a id="lfaa-project-storage-locations-20261013"></a>

<a id="lfaa-project-storage-locations-20261013"></a>

## 46-项目存储位置-20261013

目标：让设置中心“项目与存储”统一管理 SteamCMD 游戏目录、Minecraft 实例根目录、控制端日志、Writing 作品和 AI 漫剧项目的默认存储位置。默认位置保留现有 `LFAA_DATA_DIR` 下的数据布局；管理员可选择或输入本机任意可用盘符/目录。设置保存不要求 Daemon 在线；游戏目录仍由实际目标主机执行，绝对路径按该主机解释，节点覆盖继续优先于全局默认。修改默认目录只影响新建内容，不自动搬迁既有游戏实例、作品或画布；Owner 必须继续读写已有位置。

文件管理目标：在统一文件服务内增加本机磁盘来源，枚举可用本机卷而不递归扫描卷；保留现有 `data` 与游戏节点来源，并能从磁盘浏览已配置的存储目录。全部文件访问继续由 Permission Owner 的实时权限模式、认证、账户边界、路径校验和游戏运行实例保护约束。此次合同明确取代 `LFAA-SYSTEM-FILE-SERVICE-20261013` 中“仅开放当前 data、禁止枚举宿主磁盘”的早期安全范围；这不扩大到未授权账户/远端主机，也不改变游戏任务执行 Owner。

配置盘点：沿用 `permissions.mode`、现有主题和外观令牌，以及 SteamCMD/Minecraft 默认值、节点覆盖和统一 `LFAA_DATA_DIR`；新增日志/Writing/AI 漫剧目录设置时必须补齐类型、默认值、持久化、服务端路径校验和 Settings UI 映射。不重置现有偏好。自定义目录仅在本机盘符/目录有效并可访问时保存；文件管理中所有磁盘操作仍要求实时超级管理员身份与 `full_access`。不让普通账户获得主机绝对路径。

允许修改 Settings Owner/API/UI、SteamCMD/Minecraft 存储路径验证及目标主机路径解析、Writing/AI 漫剧/日志各自真实存储 Owner、统一文件服务本机卷适配器与 UI、直接回归和必要文档；保留工作树中所有既有修改。不得清理用户数据、自动搬迁既有业务文件、绕过权限或将普通磁盘读取排入 Daemon 文件任务。界面遵循全部适用外观设置，并适配桌面、平板、手机和嵌入式窄视口。

验收：无 Daemon 时可读取、编辑和保存全局存储默认值；默认值对应现有 `data/games/steamcmd`、`data/games/minecraft`、`data/logs` 及现有 Writing/AI 漫剧 Owner 布局；有效本机自定义目录保存后对应 Owner 使用该目录创建新内容，旧内容仍可回读；文件管理列出本机全部可用磁盘卷、可进入卷内目录，并保留现有 data/节点来源；账号权限、路径穿越、链接/重解析点、系统受保护目录、运行中游戏目录和窄屏边界保持。运行直接相关验证并分别报告源码/构建、真实浏览器及未实测桌面/设备证据。

<a id="lfaa-project-storage-settings-20261013"></a>

<a id="lfaa-project-storage-settings-20261013"></a>

## 47-项目存储设置-20261013

目标：在设置中心“项目与存储”把 Writing 项目文件展示和可配置位置接到真实本机存储。Writing 正文 Owner 是 `packages/document/writing`；路径由当前 `config.dataDirectory`、认证账户哈希和作品 UUID 推导，保存为本机 Markdown。路径设置只沿用现有 Data Directory Owner 的统一数据根目录选择/迁移，不新增 Writing 专属根目录、不接受客户端任意路径、不依赖 Daemon。

设置盘点：沿用当前 `LFAA_DATA_DIR` 与 Data Directory Owner。Windows 新配置默认当前系统账户 `.lfaa/data`；用户明确选择位置时规范到所选父目录的 `data` 子目录。设置 API 提交迁移计划，完整启动器/桌面外壳停机复制并回读核验后更新生效位置；不重置现有偏好或搬动真实数据做测试。前端只显示管理员可见的当前位置和待生效迁移位置。

范围：Settings UI 展示实际 Writing Markdown 目录模板、SQLite 元数据分工和迁移状态，并将统一本机数据根目录设置与作品路径相邻呈现；保留 Steam/Minecraft 节点目录既有 Owner。适配已有外观设置和窄视口布局，不增加外观/存储配置，不读取 Daemon 状态来判定 Writing 可用性，不改变 Writing 文件读写/账户权限。

验收：Writing 路径来源与 `local-files.ts` 一致；目录选择使用现有验证、计划、取消和停机迁移流程；管理员可看到实际/待生效路径，普通账户不收到主机绝对路径；项目页说明不再声称 Writing 未接入；Web 设置包构建与数据目录、Writing 定向回归通过。浏览器真实交互和响应式设备验收与源码/构建验证分别报告。

实施记录（2026-10-13）：Settings“项目与存储”改为显示由 Writing Owner 推导的本机 Markdown 目录模板、当前生效位置和待迁移位置；统一数据根目录的选择、计划、取消及重启迁移控件与作品路径相邻，仍复用 Data Directory Owner。纠正存储子系统文档中把 Writing 正文归到 SQLite 的过时说明。数据目录和 Writing 定向回归 3/3，ui-settings 与 Writing 包构建通过，Web 类型检查和构建通过。真实浏览器、移动/短屏及运行服务重载未验；当前浏览器自动化库存无可用标签，不据此声称界面实测。

<a id="lfaa-system-file-service-20261013"></a>

<a id="lfaa-system-file-service-20261013"></a>

## 48-系统文件服务-20261013

2026-10-13 最新安全修订（优先于本节早期磁盘方案）：文件页面、文件 API 和对应 AI 工具必须同时满足实时超级管理员身份与 `permissions.mode=full_access`。统一文件服务只开放当前权威 `config.dataDirectory` 内允许访问的文件；禁止枚举或开放宿主磁盘、项目源码及其他外部目录。业务 Owner 私有路径继续保护，游戏目录保留运行实例写入保护。默认 Windows 数据根固定为当前系统账户 `.lfaa/data`，不随项目盘符或可移动盘自动改变；用户显式选择位置时归一为该位置的 `data` 子目录，允许项目根的唯一 `data` 子目录。设置与迁移只用已有 Data Directory Owner，成功核验后才切换生效，不重置现有配置、不搬迁真实用户数据作为测试。初始化提示跳转设置中心“项目与存储”。本修订撤回磁盘全开放目标；AI 通用 Shell/项目工具的原有权限合同不在文件管理 API 中冒充后台人工权限。

目标：按用户最新确认，将 `/files` 迁移为类似 Windows 资源管理器的统一文件目录。本机真实磁盘、应用 Owner 资源和游戏服务器目录在同一个命名空间内，页面与 AI 使用同一操作服务；不是要求用户安装“远程扩展”或先选节点。本机文件访问不创建或依赖 Daemon 节点；远程节点状态只影响该机器目录。统一根以真实本机磁盘及已登记业务目录组成，不递归扫描磁盘。完整源码对照见[源码对照与方案](development/file-manager-reference-20261013.md)。该合同取代旧文件管理合同中“全局入口必须依赖在线节点”的目标约定。

入口与 Owner：Web/Electron 共用 `packages/client/ui-sidebar-files`；协议归 Files API，统一操作归文件领域服务，本机执行归所属 Server/Host，应用数据及索引归原业务 Owner，远程游戏目录归游戏 Daemon。Permission Owner 继续管理权限模式，认证、账户隔离和参数校验由服务端落实。

配置：沿用 `permissions.mode` 和 `appearance` 的主题、颜色、字体/字号、对比度、壁纸、遮罩/半透明、模糊与减少动态效果。不建立第二套权限、不重置偏好；新增可调策略先接 Settings Owner。用户此前确认暂不接杀毒，本机磁盘首版范围已由最新“独立系统文件库＋可选节点来源”决定扩展。

允许精准修改文件服务、本机/业务/远程适配器、Files API/Client、共享文件界面、必要装配、直接回归及事实文档。禁止开放控制端整个数据根、绕过业务 Owner 改写结构化数据、清理既有工作树或把只读聚合登记为完整文件管理。本机普通读取直接响应，耗时文件工作进入独立有界任务，文件字节不经 Base64 任务数据库传输。

验收：无节点/节点离线/节点发现失败时账户文件仍可用；本机查询不写节点任务、不轮询节点结果；账户、路径/链接/敏感资源、并发和游戏运行目录边界保持；应用写入后回读一致；上传下载流、取消清理、分页、目录滚动、列拖拽和预览/编辑分离有实测。性能分别记录请求数/耗时、列表规模、浏览器交互与帧时间；未接入功能与未实测环境单列。

2026-10-13 进度：已固定并阅读 MCSManager 与 GSManager 的文件接口、执行器及前端状态源码，确认二者分别采用 Daemon 直接 RPC 与 Server 本机文件 API。LFAA 当前仍使用节点排队/结果轮询；统一服务迁移尚未实现。未集成的只读挂载草稿已撤销，真实数据和已有 UI 改动保留。

本轮前段 UI 验收：`FileManagerPage.tsx/css` 区分节点读取失败与成功读取后的无节点状态，失败提供就地重试，不再把“服务器内部错误”同时解释成没有节点。文件包/Web 构建、客户端/Host 类型检查和差异检查通过；登录浏览器实际显示独立错误卡与重试入口。因为当前节点接口持续失败，主文件列表、最终列拖拽热区、窄短容器与帧时间不能据此登记为通过。参考源码临时副本的递归清理两次被自动审批以 `blocked by policy` 拦截，暂留根 `dist/.tmp/file-manager-reference/`，不参与产品装配。

<a id="lfaa-file-manager-foundation-20261013"></a>

<a id="lfaa-file-manager-foundation-20261013"></a>

## 49-文件管理基础-20261013

目标：把通用文件管理从单层 CRUD 表格补成安全、可浏览、可预览和可批量操作的节点本机文件工作台。唯一运行入口为 Web/Electron 共用 `packages/client/ui-sidebar-files`；Control Plane 只认证、授权并排队，文件路径校验、预览读取及写入由目标 Daemon 持有。仍只开放目标节点 `LFAA_DATA_DIR` 中未保护的数据；不接管应用私有文件，不让控制端直接读节点磁盘。用户已确认首版只用节点本机磁盘、暂不接病毒扫描。

配置盘点：复用 `permissions.mode` 与管理员认证/节点隔离；界面继承设置中心 `appearance` 的主题、颜色、字体、字号、壁纸、遮罩、模糊和减少动态效果。当前没有文件操作设置 Owner；此基础阶段沿用 Daemon 的有界固定安全上限，不新增组件级配置或重置偏好。后续若开放用户可调配额、白名单、上传大小或备份周期，先由 Settings Owner 接入控件、默认值、校验、持久化和共享映射。

本阶段验收范围：目录导航、排序/筛选、可撤销的读取快照、图片/PDF/文本/Markdown 只读预览与独立文本编辑、移动、拖放、批量选择/移动/删除/下载、回收站恢复/彻底删除、后缀白名单/容量边界/摘要校验、导入/导出与按账户可查文件操作日志。保留路径穿越、链接/硬链接、受保护目录、同名覆盖及运行中 Minecraft 路径防护；拒绝危险脚本和可执行文件上传。日志不得保存正文、密钥或上传字节。

分阶段边界：首版病毒扫描、对象存储均不接入（用户已确认）；Office 高保真预览、内容索引、版本历史/差异回滚、标签备注、分享链接、可配置用户/目录配额、分块断点续传、并发协作锁、定时/异地备份和独立限流能力，只有真实 Owner/运行链路与对应回归完成后才能登记为可用。不得在 UI 放仅外观按钮或伪造成功结果。

禁止清理既有工作树改动、绕过认证/授权或扩张数据范围；允许修改文件管理 UI、文件操作 API/队列、目标 Daemon、相关数据库迁移、定向回归和当前事实文档。验收覆盖安全边界和失败恢复，运行包构建与真实登录浏览器基本操作；性能说明列表规模、操作请求数/耗时和浏览器测量边界。短视口滚动、窄容器与外观映射须回归，未实测项目单列。

实施与验收记录（2026-10-13）：Web/Electron 文件工作台接入惰性目录树、名称/类型/大小/时间排序与类型/大小/日期筛选、独立预览/编辑、图片/PDF/UTF-8 文本/Markdown 与 Office 文本提取、拖放/批量选择/移动/回收站/多文件 TAR 下载（仅文件）、上传摘要校验与白名单、导入/导出和按账户检索审计；删除可恢复，文本并发写入使用 SHA-256 拒绝覆盖。目标节点 Daemon 是唯一文件系统 Owner，Control Plane 只负责认证、节点校验和有界排队。真实浏览器先发现当前 Control Plane 仍是旧进程，停机前核验数据库没有活动任务且本机没有 Java 游戏进程，再只重启本机 Web/本机 Daemon；远程 Daemon 未重启。登录态浏览器读目录根 9 项、games 2 项、minecraft 3 项、mc 15 项；同目录刷新期间原 9 项列表保留，15 项目录可实际滚动，目录树可惰性展开，批量工具栏可见。在线预览 `eula.txt` 成功，含疑似令牌的 `server.properties` 被节点策略拒绝预览。先前点选无扩展名 `.gitignore` 得到“不支持安全在线预览”，符合允许类型边界。API 与基础安全回归 11/11；受影响 Daemon、文件队列、Workspace Files API 包、Control Plane 构建，Web 构建、类型与工作区检查通过。真实浏览器仅在 1170×900 视口检查了布局/滚动；移动设备/短屏、帧时间和网络请求计数未测。Office 只提取文本；批量下载暂不递归包含目录；病毒扫描、对象存储、版本/标签/分享、可配置配额、断点续传、协作锁、定时/异地备份与内容索引仍未接入。

<a id="lfaa-file-manager-latency-20261013"></a>

<a id="lfaa-file-manager-latency-20261013"></a>

## 50-文件管理响应-20261013

目标：降低文件管理每次打开/切换目录时的等待，并在刷新期间保留匹配当前节点和路径的已有列表。它是共享系统入口，不是各应用的数据 Owner；应用继续经各自业务 Owner 管理私有数据。当前通用管理员文件工作台只开放目标节点 `LFAA_DATA_DIR` 中未受保护的路径。运行入口为 Web/Electron 共用 `packages/client/ui-sidebar-files`；目录读取由 `packages/api/workspace-files` 排队，Control Plane 认证/节点校验由 Workspace Controller 负责，目标节点本机文件读取与数据根、符号链接/硬链接校验归 Daemon `performNodeFileOperation/listManagedFiles`，通用任务槽由 `task-lanes.mjs` 协调。

配置盘点：界面继续继承设置中心已有的外观主题、字体、强调色、对比度、壁纸/遮罩/模糊与减少动态效果映射；管理员鉴权和文件保护规则不改，任务轮询节拍不是用户偏好配置，本任务不增加设置项，也不改变权限模式或现有用户设置。

允许修改文件管理 UI、Daemon 文件任务调度/列表读取与本合同/开发计划；禁止绕过认证控制器或节点 Bearer 校验、让 Control Plane 直接读取 Daemon 磁盘、放宽数据目录/符号链接/硬链接/运行中 Minecraft 校验、扩张到应用私有数据 Owner、缓存跨账户或跨节点数据、清理既有改动、提交或发布。

验收：文件任务领取不再被 5 秒心跳周期拖延；领取与维护任务共享既有单维护槽且避免并发 claim；完成检测只串行查询且短任务不固定等待 500ms；重复进入同节点/目录/查询时显示匹配的最近快照，后台刷新失败时不把旧快照伪装成新结果，其他目录仍显示读取状态；文件列表仍保留保护目录、链接与硬链接筛选、500 项边界和排序；组件卸载/请求过期不会覆盖新节点/目录状态。独立 `/files` 路由必须加载整屏模块工作区布局，页身占满可用高度、列表区域在短视口内可滚动、页脚留在底部；同目录刷新保留旧列表并明确显示同步态。执行直接构建、相关回归和登录态浏览器的真实目录读取/刷新验收；性能报告注明目录规模、领取节拍和实测等待，帧时间未测须明示。

<a id="lfaa-file-manager-directory-size-20261013"></a>

<a id="lfaa-file-manager-directory-size-20261013"></a>

## 51-文件夹大小显示-20261013

目标：修正文件列表将文件夹大小显示为横杠、无扩展名文件类型泄漏英文 `file` 的问题，并让类型、大小、修改时间和操作列的表头及内容统一左对齐。目录大小按需由用户发起，不在目录列表/刷新时递归读取；计算结果在当前列表显示，任何文件写入、移动、回收站变更后清除页面内的目录大小结果。无扩展名普通文件显示“文件”，真实扩展名仍显示扩展名，类型筛选不出现 `.file`/`.folder`。

运行入口为 Web/Electron 共用 `packages/client/ui-sidebar-files`。文件任务与认证/管理员权限归 Workspace Files Controller，队列和审计归 `packages/fs/fs`，任务持久化约束归 Storage SQLite，真实路径遍历和字节求和由目标 Daemon 在 `LFAA_DATA_DIR` 执行。新任务要求目标节点报告 `node-filesystem-directory-size-v1`，旧节点不得收到未知操作。

配置盘点：复用管理员认证、节点身份与现有文件保护规则；界面继续读取设置中心 `appearance` 共享主题/壁纸/遮罩/模糊/字体/字号/强调色映射。本任务不新增设置项、不改变 `permissions.mode` 和用户偏好。

允许修改文件列表呈现、文件任务合同/API/队列、节点 Daemon、SQLite 版本迁移、直接回归、Daemon 包说明、本合同及系统架构事实。禁止列表自动递归扫描、控制端直读节点磁盘、跨节点/账户复用大小结果、跟随符号链接或硬链接、扫描内部保护目录、返回不完整结果冒充准确大小，或清理既有工作树改动。

验收：目录大小扫描只在显式点击后执行，以有界异步遍历计算；最多检查 20,000 个目录项、最大 64 层，越界则清楚失败、不展示部分合计；链接、硬链接和特殊文件继续跳过，且显示被跳过计数；路径、管理员、节点能力与 Bearer 校验沿现有 Owner。API 与 SQLite 迁移回归验证新操作和旧节点拒绝；Daemon 回归验证嵌套文件真实字节总和及无扩展名文件类型。执行直接测试、相关包/Control Plane/Web 构建、客户端/Host 类型检查、工作区与差异检查；登录浏览器验证“文件”标签、类型筛选、按需计算显示和四列左对齐，并确认打开/刷新列表不触发大小任务。未实际使用第二台远程 Daemon、桌面安装版或帧时间测试须单列。

实施与验收记录（2026-10-13）：大小计算通过独立只读节点任务按需执行，普通打开和刷新仍只读取当前目录列表；20,000 项、64 层上限防止无界遍历，跳过符号链接、硬链接、特殊项和受保护数据。真实登录浏览器根目录显示 9 项，点击 `logs` 的“计算”后显示 `0 B`；无扩展名 `.gitignore` 显示“文件”，类型筛选仅有“全部类型 / 文件夹 / 文件”。Daemon/API/迁移定向回归 14/14、8 个受影响包构建、Control Plane/Web 构建、客户端与 Host 类型检查、181 包工作区检查及差异检查通过。本机正式 Web/Daemon 已经项目菜单重启并完成真实计算；未连接第二台远程 Daemon，未验桌面安装版、20,000 项大目录耗时或帧时间。目录枚举本身仍不扫描子树；本轮浏览器只对 `logs` 发起一次按需计算。

对齐修正记录（2026-10-13）：首轮左对齐样式收到用户反馈，实际观感仍未达到要求。补充为类型、大小、操作列分别给表头和数据单元格添加显式对齐类，并用强制左对齐规则覆盖表格样式；操作按钮组改为占满单元格并从左边缘开始排布。重新构建后在登录态 `/files` 页面目视检查，表头“类型/大小/操作”与对应行内容均从各自列的同一左边缘开始；Web 构建、客户端/Host 类型检查及差异检查通过。窄视口专项与帧时间未单独测量；本次样式不新增断点、固定宽度或主题变量。

<a id="lfaa-file-manager-column-resize-20261013"></a>

<a id="lfaa-file-manager-column-resize-20261013"></a>

## 52-文件列宽调整-20261013

目标：让文件列表可像 Windows 资源管理器一样拖动列分隔线调整相邻列宽，表头和全部行同步重排；实现复用的指针拉伸方法，后续 Client 表格可直接调用。入口为 Web/Electron 共用 `packages/client/ui-sidebar-files`；共享 Pointer 捕获、逐帧合并和生命周期归 `packages/client/ui-dockkit/src/ui-resize`，文件列宽状态及相邻列约束归 FileManagerPage。

配置盘点：尺寸是当前页面的临时视图状态，不新增持久化设置；文件页面继续继承设置中心 `appearance` 的主题色、字体、字号、对比度、壁纸/遮罩/模糊与减少动态效果映射，不改变 `permissions.mode`、文件权限或用户偏好。

允许修改共享拉伸工具、文件列表表格/样式、DockKit 包说明、系统架构事实与本合同。禁止复制第二套 Pointer 生命周期、影响 `ResizableWorkbench` 的既有窗格拖动/吸附行为、改变文件业务/API、覆盖用户已有文件、将视口宽度写死、增加额外设置或遗留未清理的 Pointer/RAF/窗口监听器。

验收：名称/类型、类型/大小、大小/修改时间、修改时间/操作的分隔线可拖动；每次只调整边界两侧列并遵守可用最小/最大宽度；拖动时表头与所有行同列更新，排序点击不被手柄拦截，键盘方向键可调整列宽；释放、取消、窗口失焦、隐藏页面和卸载均完成清理，取消恢复拖动前尺寸。窄容器可横向滚动且拖动目标仍可达，不压坏操作列；指针移动按动画帧合并，交互不触发文件读取或重渲染文件数据。运行 DockKit/文件管理/Web 构建、客户端/Host 类型检查和差异检查，并在登录浏览器实际拖动所有边界、检查窄屏/窄分栏和表格滚动；帧时间未测须明确说明。

实施记录（2026-10-13）：新增共享 `usePointerResize`，统一 Pointer 捕获、按动画帧合并、失焦/隐藏/取消/卸载清理；文件表格只提供相邻列约束和布局回调。宽屏按表格容器自适应名称列，手动调整后保留当前视图尺寸，窄宽由表格横向滚动承载。Web、DockKit、文件管理包构建，客户端/Host 类型检查和差异检查通过。登录浏览器曾验证方向键调整名称/类型列分别为 459→467、120→112，并实际拖动名称边界到 497、类型列到最小值 82，表头与数据行同步移动；随后为让把手对准排序表头真实边界，将热区右移至分隔线并重新构建。此后浏览器中的文件管理和 Minecraft 总览均开始返回“服务器内部错误”，目录读取失败，故最终热区位置、其余三处分隔线和窄视口尚未复测；已恢复原 Minecraft 页面，未执行文件或游戏操作。未测帧时间。

<a id="lfaa-node-interactive-terminal-20261013"></a>

<a id="lfaa-node-interactive-terminal-20261013"></a>

## 53-节点交互终端-20261013

目标：响应用户确认“本机和远程 Daemon 都支持完整交互式终端”，将共享工作区的终端接到真实 PTY，保留节点任务输出；恢复当前文件管理入口并核查 Minecraft 完善程度。入口为 Web/Electron 共用 ApplicationWorkspace；PTY 唯一实现归 subprocess-local，进程归目标 Daemon，认证中继及账户隔离归 terminal-controller，审批复用 Permission Owner，审批关联会话由 Session Owner 创建，节点身份复用现有 Bearer/TLS 校验，不在控制端执行远程命令。

配置盘点：general.integratedShell 默认 system、taskFolder 默认空（目标节点数据根）、terminalPosition 默认 bottom、showBottomPanelControl 默认 true；appearance 的主题、代码字体/字号（默认 12）、强调色、对比度、壁纸、遮罩、模糊、减少动态效果沿用共享映射；permissions.mode 默认 ask，复用请求审批/替我审批/完全访问，不新增策略或重置偏好。终端会话批准范围明确包含所选节点、起始目录、Shell 及该会话中的交互命令；退出或权限模式变化后重新申请，不将批准扩散到其它节点或账户。

允许修改终端协议/运行时/API/Daemon/客户端及必要依赖、原有异步输出队列缺陷、会话审批入口和直接测试/事实文档。禁止改动 Minecraft 业务、真实游戏数据、账户偏好或无关既有改动；不提交/发布。当前浏览器显示运行实例 0/1、活动任务 0，后续重载前仍复查，可能影响运行实例时先确认。

验收：真实输入、持续/中文输出、ANSI、尺寸调整、Ctrl+C、退出、关闭及断线清理；本机/远程使用同一认证中继，远程仍要求 HTTPS；账户/节点/连接代际隔离、统一权限三模式、参数与容量边界；队列与回放有界，卸载撤销流/观察器/计时器，慢客户端失败关闭。运行直接回归、包与 Web/Control Plane 构建、类型/工作区/差异检查；真实浏览器覆盖桌面和窄短容器，真实第二台远程主机、桌面安装版和帧时间未测须明示。文件管理验证真实目录及文本读取，不向运行树注入测试假数据。

实施记录：subprocess-local 使用官方 node-pty/ConPTY，原生启动与缩放移入不继承开发加载器的 Worker；线程输出带确认与暂停/恢复，消费队列和中继回放分别限容。修复 AsyncChunkQueue 等待中首块丢失；集成 Shell 解析沿用唯一 terminal-bash Owner，模型终端与节点终端共用它。Daemon 经现有节点 Bearer/TLS 长连接执行，控制端不代跑远程 Shell；审批、记忆和撤销复用 Permission Owner。工作区使用 xterm、串行输入/缩放、可见性控制节点查询、卸载关闭；触屏提供发送 Ctrl+C 的中断按钮。透明视口及 ANSI 高亮色跟随账户主题，未写死账户、目录、节点或执行结果。

实际验证（2026-10-13）：`apps/cli` 下 `node --import tsx --import ./register-package-loader.mjs --test tests/interactive-terminal.test.mjs tests/terminal-api.test.mjs tests/harness-runtime-wiring.test.mjs` 10/10 通过；随后增加真实慢消费者超容量退出回归，单跑 interactive-terminal 6/6 通过，因此三组共 11 项已通过。覆盖真实 TTY/中文/ANSI/Ctrl+C、原生 Console 尺寸、取消和 PID 清理、输出容量、HTTP/SSE 输入回传、跨账户拒绝、审批只消费一次、两次记忆、权限变更/记忆撤销、远程身份/TLS 校验及断线退出。远程 TLS 回归验证认证 Owner 的 secure 请求合同，未使用第二台真实远程机器。

相关 10 个能力包（subprocess-local、terminal-bash、terminal、tool-terminal、session、api/remotes、terminal-controller、host/daemon、client/connection、ui-workspace）、Web 和 Control Plane 构建通过，产物均位于根 dist。最后修改涉及的包另行重构建；client/host TypeScript、181 包工作区检查通过。仓库不存在 workspace-preflight/qualityGate 命令，未冒充执行。补跑 file-manager-api/file-storage/project-files 共 12 项，10 通过、2 失败：文件 API 夹具缺少 Writing 本地文件迁移初始化；旧迁移回归断言 schema 50，而当前为 51；本轮未修改其夹具或数据迁移实现，也未把该组报为全通过。

登录本机浏览器实际验收：正常 Web 入口带起本机 Daemon；真实中文命令和连续输出、中断后同一会话继续、实际尺寸从桌面 172×20 改到短屏 82×6、正常退出码 0 均已观察。768×600、320×568、640×360 容器的终端控件可达，页面 scrollWidth 等于 clientWidth；窄屏换行，短屏可滚动。文件管理读出数据根的 9 项及既有 .gitignore 文本，没有修改真实文件。证据位于 `dist/qa/terminal-20261013/`。正式 Web/Daemon 重载前复查运行实例 0/1、活动任务 0，没有停止游戏实例。Minecraft 本轮仅盘点，部署/启停/日志/配置/备份已有实现，实时 CPU/内存采集尚未接入；玩家联机、多核心兼容、第二台远程节点、Electron 安装版、其他操作系统与浏览器帧时间未验收。

主题配置现场验收：在设置中心保存深色，再返回真实终端，计算样式显示深灰背景 rgb(38,38,38)、浅字 rgb(229,229,229)、xterm 视口透明；随后恢复原有浅色并观察“设置已保存到当前账户”。浅色终端正文 rgb(23,23,23)，视口保持透明，ANSI 高亮读取主题语义色；未改动其他外观偏好。深浅截图均保存在上述证据目录。

最后补验：3840×1440 超宽浏览器页面无横向溢出，真实终端读取 500×6 并正常退出；UI 将自动尺寸约束到协议上限，避免超宽窗口创建/缩放失败。颜色无变化的拉伸帧不重复设置 xterm 主题；此为源码工作量检查，未进行帧时间测量。UI 包与 Web 再次构建通过并刷新加载；浏览器视口已恢复。深浅主题切换后再次刷新确认浅色已持久化，任务输出切换入口保留真实历史结果。

<a id="lfaa-appearance-light-neutral-20261013"></a>

<a id="lfaa-appearance-light-neutral-20261013"></a>

## 54-浅色中性主题-20261013

目标：修复设置中心浅色主题偏灰蓝的背景与文字，使无壁纸时使用白色画布、黑灰文字，并确保浅深切换后共享组件、原生控件和设置主题预览一致。入口为 Web/Electron 共用 Workbench；颜色令牌归 ui-theme，主题解析和 Ant Design 映射归 ui-layout，设置控件归 ui-settings；账户设置仍由 Settings Owner 校验并隔离持久化。

沿用 `appearance.theme`（默认 system）、`accentColor`（默认 #3457d5）、`sidebarColor`（默认 auto）、各位置 backgrounds、overlay（37）、blur（14）、advanced 的 separateModes（false）、modeStyles、fonts、interfaceFontSize（14）、codeFontSize（12）、contrast（60）、translucentSidebar（false）和 reducedMotion（system），不新增配置、不重置已有偏好。壁纸与用户自定义侧栏继续按已保存设置显示。允许修改共享主题、工作台颜色映射、外观预览和直接回归/事实文档；禁止触碰权限、账户数据、其它业务与无关既有改动。

验收：浅色无壁纸的白底与黑灰文字、深色中性灰底与浅字、反复切换与刷新一致；强调色、字体/字号、对比度、侧栏、壁纸遮罩和模糊保留控制；代表性桌面/窄屏/短屏无横向越界。运行直接主题/设置/响应式回归、受影响包及 Web 构建、工作区和差异检查；真实浏览器登录与设置保存需现有账户，不能伪造认证。静态确认不增加请求/监听/计时器，帧时间和物理设备未测则单列。

实施记录：实际浏览器复现原浅色画布 `rgb(237,241,247)`、正文 `rgb(38,50,71)`。共享浅色令牌改为纯白画布与中性黑灰文字，并显式应用到 light 工作区；保留深色覆盖，浅色边框继续读取对比度，原生控件显式使用 light。Workbench 的 Ant Design 文字/边框和纯白壁纸遮罩同步，Settings 的主题预览及自动侧栏颜色同步。不增加请求、监听、计时器或数据集合；只修改颜色映射，不改变认证授权和账户持久化。

验证记录：CLI 目录执行 `node --import tsx --import ./register-package-loader.mjs --test tests/client-appearance-theme-bootstrap.test.mjs tests/settings-contract.test.mjs tests/client-workbench-responsive.test.mjs tests/wallpaper-canvas-ownership.test.mjs`，15/15 通过；`pnpm --filter lfaa-client-ui-theme run build`、`pnpm --filter lfaa-client-ui-layout run build`、`pnpm --filter lfaa-client-ui-settings run build`、`pnpm run build:web`（含客户端类型检查）通过，产物只写根 dist。`pnpm run check:workspace`（181 包）、`git diff --check`、`node scripts/runtime-build-state.mjs web`（空差异）通过；当前无 workspace-preflight/独立 quality Gate 命令。使用正式 CLI Web 入口 `node apps/cli/bin/lfaa.mjs web --no-local-daemon` 启动本机 3000 页面，由用户登录现有账户；未启动本机 Daemon。网页刷新加载新构建后，浅色实测背景 `rgb(255,255,255)`、正文 `rgb(23,23,23)`，深色实测背景 `rgb(24,24,24)`、正文 `rgb(229,229,229)`，system 与当前浅色操作系统一致。切回浅色后点击立即保存出现“保存成功”，刷新保持浅色；既有粉色强调色 #d64d8f、界面/代码字号 14/12、遮罩 11%、模糊 6px、对比度映射 7.333% 均保留。真实浏览器覆盖 1280×800、768×1024、390×844、320×568、568×320，页面与正文横向无溢出；短屏滚动到底部可见保存操作，结束已恢复默认视口。截图保存于 `dist/qa/appearance-light-20261013/light-theme.jpg`。未测帧时间、Electron 和物理设备；当前已启用的 Wallpaper Engine 项目效果未在本轮重新配置或逐项验收。

<a id="lfaa-ai-video-nomi-core-parity-20261011"></a>

<a id="lfaa-desktop-update-hover-appearance-latest-01更新入口外观提示交互与最新版本恢复"></a>

## 55-桌面更新入口-20261013

### 用户目标与运行入口

- Windows Electron 顶栏“更新”入口悬浮显示版本日志卡片；点击入口直接触发当前最新稳定版更新提示。界面清晰度、强调色和状态须随设置中心外观偏好改变。
- 当前线上 `update.json` 与 GitHub Release `latest.yml` 均报告 LFAA 0.0.5；客户端日志确认 0.0.4 曾读到 0.0.5，也记录检查失败，但旧日志只存通用信息，不能确认每次瞬时失败的底层原因。
- 更新决策/网络 Owner 为 `apps/desktop-electron/src/update-flow.mjs` 和 `apps/desktop-electron/src/main.mjs`；唯一最新稳定版来源是仓库 `main/update.json` 与 Release `/latest/download/latest.yml` 的一致版本，不逐个补装中间版本。
- 顶栏、更新卡片和更新对话框由 `packages/client/ui-layout/src/Workbench.tsx` 与 `workbench.css` 提供；外观数据由现有账户设置 API、`lfaa-settings` 持久化与 Workbench 共享外观令牌提供。

### 设置、数据/权限 Owner 与验收条件

- 复用 `appearance.theme`、当前主题的 `accentColor`、界面/内容字体与字号、`contrast`、`blur` 和 `reducedMotion`。为更新卡片与确认弹窗加入账户级 `appearance.updateSurfaceOpacity`，默认 92%，由设置中心外观页控制 70–100%；通过设置服务原有账户设置写入/读取 Owner 保存，旧账户缺字段时补默认值且不覆盖其他外观偏好。
- 悬浮卡片使用鼠标悬停显示，键盘焦点可访问；点击“更新”关闭卡片并调用原 `checkForUpdates` IPC，显示当前 latest 更新提示，不增加第二套更新 Owner 或旁路下载接口。
- 检查更新对超时、网络断开/重置、HTTP 408/425/429/5xx 最多重试一次；清单错误、HTTP 4xx（除 408/425/429）与版本不匹配不重试。UI 错误文案给出可操作分类；日志只记录阶段、HTTP 状态或安全错误代码，不记录响应头、Cookie、Token、签名 URL 或原始 HTTP 响应。
- 加入 `0.0.4` 客户端直接获取并下载 `0.0.6` 当前 latest 的回归，确认不会先处理 `0.0.5`；同时检查瞬时失败一次后成功、持续失败给出分类、非暂时性错误不重试、Release 与清单版本不一致仍阻止下载。
- 外观控件默认/边界/旧账户读取通过服务端验证和客户端类型检查；设置预览改变后卡片及弹窗同步改变透明度和强调色，并保留主题、字体/字号、壁纸遮罩、模糊、对比度与减少动态效果映射。`git diff --check` 通过。
- 若生成新的 Windows x64 Electron 安装包，必须使用正式 `build:win` 版本准备流程消耗唯一新版本 `LFAA 0.0.6`，包名为 `LFAA-0.0.6.exe`，根 `dist/apps/desktop-electron/LFAA-0.0.6/` 交付目录内核对安装器、`latest.yml`、包内版本及哈希。构建不包含推送、Release 创建或上传。
- 不重启现有桌面、Control Plane/Daemon 或端口 3000；不安装候选。若没有隔离安装环境，明确标记真实桌面弹窗交互、0.0.4→0.0.6 安装升级和帧时间测量未验。

### 允许修改

- `packages/client/ui-layout/src/Workbench.tsx`、`workbench.css`：悬浮日志卡片、点击更新流程、外观令牌与提示框对比度。
- `packages/client/connection/src/api.ts`、`packages/client/ui-settings-general/src/default-settings.ts`、`packages/settings/settings/src/service.ts`、`packages/client/ui-settings/src/SettingsPage.tsx`：账户外观不透明度字段的类型、默认值、读取/校验、持久化 UI 控件与实时预览。
- `apps/desktop-electron/src/update-flow.mjs`、`main.mjs`、`tests/update-flow.test.mjs`：暂时故障重试、安全诊断及 latest 版本直达回归；保持清单校验、Release 对账和下载授权不变。
- `packages/client/README.md`、`docs/系统总体架构.md`、`docs/updata-log.md`、本合同与唯一更新流程维护的产品版本投影。
- 构建与临时输出仅写根目录 `dist/apps/desktop-electron/`、`dist/.tmp/desktop-electron/` 及构建入口拥有的根 `dist/apps` 目标。

### 禁止修改

- 不改变更新源、stable 渠道、版本比较、用户下载确认/跳过语义、自动更新默认值、最低支持版本和账户权限；不逐级安装历史版本。
- 不将更新卡片或弹窗移出 `.workbench-shell` 外观上下文；不绕过设置 Owner 或写死当前强调色/透明度覆盖用户设置。
- 不提交、推送、创建 Tag/Release、上传或签名；不重启/安装候选，不改动正式运行中的 `dist/apps/web/`、用户数据或其他活动任务。

### 实施与验收记录

- `packages/client/ui-layout/src/Workbench.tsx` 顶栏更新卡片改为悬浮/键盘聚焦展示，点击调用现有检查 IPC；确认弹窗按钮、标签及入口使用主题强调色。卡片与弹窗读共享外观令牌，`appearance.updateSurfaceOpacity` 由设置中心外观页实时调整（默认 92%、范围 70–100%），设置服务接受旧账户缺字段并返回默认值，不更改其他账户偏好。
- `apps/desktop-electron/src/update-flow.mjs` 对超时、连接中断/重置及 HTTP 408/425/429/5xx 在版本清单和 Release feed 各最多重试一次；404、其他 HTTP 4xx 和清单/Release 版本不一致不重试。UI 按状态给出可操作分类；`main.mjs` 的日志追加检查/下载阶段、请求步骤及安全错误类别，不保存原始异常、头信息或令牌。旧客户端 `0.0.4` 直接检查/下载清单指定的 `0.0.6` 回归通过，不经过 `0.0.5`。
- `pnpm --filter lfaa-desktop-electron run test:update-manifest` 通过，41/41；`node --check` 对 `main.mjs`、`update-flow.mjs` 通过；客户端 TypeScript 检查、隔离 Electron Web 生产构建、Control Plane、Windows Sandbox Host、Electron NSIS 构建及随包 CUA Driver 导入/注册验证通过；`git diff --check` 通过。构建报告既存超过 500 KiB 的前端 chunk 提示。
- 正式构建消耗版本 `LFAA 0.0.6`，安装器为 `dist/apps/desktop-electron/LFAA-0.0.6.exe`；用户交付目录 `dist/apps/desktop-electron/LFAA-0.0.6/` 含同名安装器、`.blockmap` 和 `latest.yml`。安装器 158,467,866 字节；副本 SHA-256 `F97B64045B28C18FF467E1A6CF6F1A511111DC8407C5CF7C0F953482EED92572`，根输出与交付副本一致；`latest.yml` 声明的版本、大小及 SHA-512 与安装器匹配。Authenticode 为 `NotSigned`。
- 在线核查时 GitHub `main/update.json` 与 latest Release 是 `0.0.5`。本轮 `.06` 元数据和安装器只在本地工作树/`dist`，没有提交、推送或上传；用户发布 `0.0.6` 前，线上客户端仍以 `.05` 为最新。未安装候选或重启现有桌面/Control Plane/Daemon，当前本机 `/api/health` 返回 HTTP 200。悬浮/点击、设置实时外观预览、真实线上 `.04→.06` 安装升级及桌面帧时间未做交互验收；直达最新通过真实更新 Owner 的定向模拟回归验证。历史失败只留通用提示，无法反推旧请求底层原因；本轮修复短暂失败的自动恢复并保证后续错误可诊断。


<a id="lfaa-desktop-update-download-flow-01"></a>

<a id="lfaa-desktop-update-download-flow-01统一更新网络栈展示下载进度并完成安装重启"></a>

## 56-桌面更新下载-20261013

### 用户目标与运行入口

- Windows Electron 桌面端当前版本 `0.0.6` 手动检查偶发显示连接更新服务超时；截图显示下载更新缺少持续进度反馈。目标流程为发现版本并确认下载、显示动画和真实下载字节/比例、下载完成后显示“已准备就绪”，用户选择“稍后”或“重启并安装”，后者复用关闭本机服务后由 electron-updater 启动 NSIS 安装器的现有流程。
- 检查截图无法单独证明超时根因。代码现状是 Electron 主进程以 Node `fetch` 读取 `update.json`，而 electron-updater 使用 Electron 网络栈；Electron 官方文档说明 Node `fetch` 不使用 Chromium 网络栈及其系统代理/PAC 支持。应统一到 `net.fetch`，再由现有更新流判断清单版本；若当前版本已不低于清单版本，直接返回 `up-to-date`，不读取 Release 安装 feed。
- 更新决策、网络校验、下载及安装 Owner 仍唯一属于 `apps/desktop-electron/src/main.mjs` 与 `update-flow.mjs`；UI 由共享 Workbench 和窄化 preload IPC 消费。下载取消使用 electron-updater 公开的 `CancellationToken`。
- 官方 GitHub `main/update.json` 在本合同登记时返回 `0.0.5`；用户截图客户端为 `0.0.6`。清单可访问时本机 `0.0.6` 应显示已是最新。桌面候选包为 `0.0.7`；其本地构建不代表 `.07` 已上传或线上发布。

### 设置、数据/权限 Owner 与验收条件

- 下载进度面板沿用设置中心的 `appearance.theme`、强调色、界面/内容字体与字号、`contrast`、`blur`、`reducedMotion` 和 `appearance.updateSurfaceOpacity`；无新设置项。减少动态效果启用时停用非必要持续动画，进度仍以静态数值刷新。
- IPC 只向当前受信任主窗口公布版本、阶段、已下载/总字节、百分比和速度；窗口重挂载可读取一次当前状态。取消仅取消当前下载并释放唯一更新 Owner 状态，不触发安装，不显示网络失败。
- 手动点击下载后保留现有下载同意；下载结束展示准备就绪对话框，只有点击重启安装才调用现有关闭服务及安装流程；“稍后”保留已下载包，之后可安装。设置中心显式开启的自动下载并安装继续沿用本机偏好，不改变默认关闭值。
- 定向回归覆盖：Node fetch 被替换为 Electron net.fetch 的请求注入与 HTTPS/同源路径校验；当前版本等于/高于 manifest 时不请求 Release feed；真正新版本仍要求 feed 版本匹配；下载阶段事件、取消释放状态、下载完成转为 ready、稍后及手动确认安装决策；重复事件、非有限进度/字节和窗口重挂载不生成虚假状态。
- 进度组件显示初始准备动画、真实百分比/字节/速度及取消入口；ready 对话框显示版本并提供“稍后”“重启并安装”。Electron/Client 类型检查、更新回归、隔离 Web 构建、桌面包验证及 `git diff --check` 通过；明确区分未实测代理系统、实际桌面进度动画、下载取消和真实 NSIS 升级。
- Windows 包继续使用唯一版本准备流程生成 `LFAA 0.0.7`。electron-builder 暂存到 `dist/.tmp/desktop-electron/LFAA-0.0.7/`；最终用户交付只把安装器、blockmap、`latest.yml` 放入 `dist/apps/desktop-electron/LFAA-0.0.7/`，校验哈希/大小/版本后删除本轮精确暂存目录。不得再次在 `dist/apps/desktop-electron/` 根层留下同一套发行文件。安装包不签名、不安装、不上传、不推送、不发布。
- 不停止或重启当前桌面、Control Plane、Daemon 或端口 3000；不覆盖正式 Web 输出，不删除旧版本 `.04`–`.06` 产物与用户数据。

### 允许修改

- `apps/desktop-electron/src/main.mjs`、`src/preload.cjs`：统一系统代理可用的 Electron 网络请求、更新进度状态、可信 IPC、CancellationToken 生命周期与既有安全关闭/安装接线。
- `apps/desktop-electron/src/update-flow.mjs`、`src/update-manifest.mjs` 和对应 `tests/`：验证 manifest-first 最新版本判断、错误/取消边界、事件数值与版本防护。
- `apps/desktop-electron/package.json` 与 `pnpm-lock.yaml`：为下载取消 API 声明已锁定的 `builder-util-runtime` 直接依赖，设置隔离暂存目录。
- `packages/client/connection/src/api.ts`、`packages/client/ui-layout/src/Workbench.tsx`、`workbench.css`：增加 typed progress IPC、共享外观适配的进度/ready UI 与 reduced-motion 行为。
- `scripts/desktop-package-version.mjs` 和相关测试、Electron 发行暂存脚本及其定向测试：以版本为单位校验 staging/final 路径，最终交付只保留版本目录中的三个发行文件。
- `docs/系统总体架构.md`、`docs/updata-log.md`、`update.json`、`apps/cli/package.json`、`apps/web/package.json`、本合同：记录实际更新闭环、最新版本、版本投影与验证证据。
- 构建暂存只位于根 `dist/.tmp/desktop-electron/LFAA-0.0.7/`，最终发行只位于根 `dist/apps/desktop-electron/LFAA-0.0.7/`。

### 禁止修改

- 不改变 GitHub stable 更新源、HTTPS/版本/manifest/feed 校验、最低支持版本、跳过偏好、自动下载默认关闭、服务关闭安全条件和发布授权边界。
- 不把当前版本高于远端清单的情形误报为清单已核验到同一版本；不因首个清单请求失败而继续猜测最新版本或跳过版本/Release 校验。
- 不新增旁路下载/安装 Owner、系统原生提示框、假进度、硬编码网络状态或安装成功状态。
- 不在根 `dist/apps/desktop-electron/` 重复留下发行包，不覆盖/清理旧版本目录。
- 不安装候选、不重启在用桌面或服务、不提交/推送/创建 Release/Tag/上传。

### 实施与验收记录

- 待实施。


<a id="lfaa-remaining-gap-repair-20261008"></a>

<a id="lfaa-xiaoyu-shared-agent-20261014"></a>

## 57-共享小鱼智能体-20261014

用户目标：AI Work 正式更名“小鱼智能体”，统一所有 App 的工作入口/会话/项目，导航改成应用/工作，领域由配置的大模型按需选择 Skill/Prompt/Tools/专家/子 Agent；补齐非强制关联并通过内置浏览器验收，同时核查 Minecraft 原版/插件服/模组服实际能力。

详细提示词：[小鱼共享工作入口](development/xiaoyu-agent.zh.md)。入口 `/work`，App 常规入口保持；旧工作路由兼容归一。Owner：ui-renderer/ui-layout/ui-workspace/ui-chat 负责共享消费；Session JSONL 保存原历史与关联引用，workspace 保存真实项目登记；Agent Loop/Provider/注册表/Permission 和领域/Daemon 执行器唯一。项目 App 标签改为来源参考，账户/节点校验不能放宽。

允许：相关共享导航/聊天/设置/项目/会话/API/Agent 上下文、合同/类型、长期回归、README/依赖/装配、架构/计划/提示词；为本次验收启动自有隔离服务。禁止：第二套运行系统、关键词路由、自动正文注入、静默换模型、修改其他 checkout、删除真实数据、修改或停服既有实例、重启既有服务、提交/发布与无关重构。保留开始时已有脏工作树。

设置：复用 general 模式/入口/目录/Shell/导航、Provider/主子 Agent 模型/思考力度、aiRuntime 各预算/提示/通知、plugins 开关/目录/扩展/MCP、computerControl 与统一三模式权限、Appearance 全部适用令牌。可选关联只存 ID 引用，默认空；不另建配置权威。

验收：应用只进入常规，工作单一入口；旧会话完整可续、项目可用且账户/节点隔离；关联可空/撤销、不强制加载；模型能自主发现并加载真实领域能力；权限、分支、取消和未知副作用防重保留。直接回归、类型、受影响包/正式入口构建、工作区/差异/指纹，内置浏览器实测共享流程与窄短容器，Provider/实际开服/桌面/帧时间单独报告。不存在的 workspace-preflight 不冒充已执行。

用户再次澄清：已有配置自行读取；验收要求模型自主发现、加载、执行、依据失败证据修正并最终交付，不反问配置中已有信息。已只读核对真实活动 Provider 与节点，已运行真实 DeepSeek 能力发现；发现心跳漏登新增文件能力，允许对齐该相关合同并回归。为验证开服，可由模型在现有权限模式下选择版本/节点/端口创建本轮独立验收实例、验证并安全停止；不改变既有实例、偏好或模型，保留真实结果和失败边界，不以测试名义绕过权限。

2026-10-15 继续验收：用户授权创建全新超级管理员，随后明确选择“仅在独立验收环境创建，不改变现有账号权限”。以显式独立数据根 C:/Users/yu/.lfaa/xiaoyu-acceptance/data、独立本机端口启动同一正式 Web（不启动 Daemon），通过原 /auth/setup 初始化与正常登录验收；这是本次验收自定义位置，不改变产品默认/推荐根。原项目账号、角色、Provider、权限和游戏保持。唯一超级管理员约束不放宽、不转交。验收中发现单节点读取未执行列表的心跳过期判定，允许在 Daemon Owner 统一该判定并补回归，不改变超时或权限。浏览器使用正式 Web 资源与正常登录，不制造测试产品路由或认证旁路。

状态：共享入口 58/58、文件/存储统一复验 59/59；真实 DeepSeek 自主发现/加载能力，实际部署、就绪并安全停止 Vanilla、Paper、Fabric、Forge 四个独立实例。内置浏览器完成正常登录、应用/工作入口、真实项目登记、能力引用、默认首页持久化、单一存储根显示和 390/560/768 宽度与短屏滚动检查；文件操作对新账号正确执行身份/权限限制。原项目的新普通管理员保持原角色；用户选择的独立环境超级管理员已通过正常首次初始化创建，内置浏览器登录显示 super_admin，原项目所有账号权限未变。完整逐文件与验收边界见 [统一交付记录](development/xiaoyu-agent-20261015.md)。第三方模组/插件、桌面/设备/帧时间与新账号真实模型调用未实测。

<a id="lfaa-xiaoyu-session-history-performance-20261015"></a>

<a id="lfaa-managed-file-resources-20261014"></a>

## 58-受管文件资源-20261014

用户要求：先交付文件管理开发提示词，再落实重构；默认围绕 data、游戏、备份、环境、日志、缓存、临时文件和 DSH 第三方扩展插件管理。游戏目录优先；Windows 式基本操作保留，资源分类与物理目录分开。此合同取代旧合同中首页混合展示全部磁盘的要求；保留显式本机磁盘来源及设置页位置跳转。

开发提示词：[受管文件资源](development/file-resources.zh.md)。入口 `/files`；文件操作唯一实现 `fs/fs`，游戏路径/状态由 Minecraft Owner 与目标 Daemon 持有，插件安装/版本/兼容/启停/卸载由 Plugin Manager 持有，Settings 提供实际目录与外观，Identity/Permission 保持原执行边界。本轮不把普通文件上传当插件安装，不新增 Agent 或权限实现。

允许：相关 Files UI/Connection/合同、文件服务、workspace-files API、节点文件执行与能力声明、长期定向回归、README、架构/计划/本合同。必要的游戏目录映射只读原领域元数据；不复制领域持久化。禁止：搬迁/删除真实数据、批量清空缓存、改变用户设置、加载任意不兼容 DSH 代码、修改 DSH、服务重启、提交/发布和无关重构；保留当前工作树所有已有改动。

设置：LFAA_DATA_DIR 与原数据根选择/迁移合同；日志/运行环境/缓存/临时目录从总根派生，旧 project_storage_locations 只作历史回读；Minecraft 节点 instanceDirectory 与实例 storageDirectory 保留真实存量位置；既有 permissions.mode、plugins.enabled、Appearance 主题/颜色/字体/字号/透明度/模糊/壁纸/对比度/减少动态效果。资源类别是固定合同，路径实时从 Owner 获取，不新增偏好副本。

验收：首页不枚举磁盘、不将虚拟来源混进真实目录；实际设置目录可进入；实例显示真实节点/状态且只能进入该实例，绝对自定义目录不指向控制端默认盘；运行/未知状态、实例根/标记和插件安装清单不能被普通文件操作破坏，替代路径亦执行保护。列表/搜索流式有界、取消可收尾、不重复递归计大小；UI分类导航、权限/旧请求清理、列操作和容器窄屏可用。运行直接文件/API/节点/客户端回归、类型、受影响包和正式 Web/Control Plane/Daemon 构建、check:workspace、差异与指纹核对；真实浏览器、节点、设备、Provider、帧时间证据分别报告。

用户补充（优先于本合同早期分区自定义描述）：首次未配置使用系统账户 `.lfaa/data`；项目根 `data` 是设置中心显式点击的推荐位置，不是自动的可移动盘默认值。用户数据的日志、备份、游戏、环境、缓存、临时文件与插件私有运行数据均从一个 data 根派生；插件包与受控运行适配副本独立保存在 `LFAA_HOME/plugins`，不随数据迁移；不得为数据分类再提供相互独立的存储根设置。已有自定义总根保持优先；旧分区路径仅用于存量数据回读，不自动搬迁或删除。允许补充修改 Data Directory/Settings/Runtime Owner、Settings UI、共享路径布局、对应合同/类型/回归/README，仍禁止操作真实数据或重启用户服务。

状态：已实现资源工作台、真实游戏目录作用域与单一数据根设置；59/59 项定向回归、Client/Host 类型及工作区检查通过。完整逐文件交付、构建与运行验收边界见 [交付记录](development/file-resources-20261014.md)。真实用户数据未搬迁，既有服务未重启。

<a id="lfaa-package-owner-lazy-capabilities-20261014"></a>

<a id="lfaa-package-owner-lazy-capabilities-20261014"></a>

## 59-包职责与按需能力-20261014

用户要求：逐一标注 packages 内全部目录职责，并实际修复 Skill、Prompt、Expert、Tool 放置和 App 绑定；模型按目标发现、加载、调用，不再只交付包组规范。上一轮文档交付保留为历史，不能作为本轮实现结果。开始时已有 Minecraft/Agent/UI 源码和测试改动，本轮保留。

现状证据：system-prompt 根据 applicationId 直接调用 minecraftSystemInstruction/writingSystemInstruction；preset/builtin-catalog 持有领域专家正文；AiExtensionRegistry.getInstructions 自动返回全部匹配正文；core/tools/business-tools 集中持有 Minecraft/SteamCMD/Writing 工具和领域内容读取；skill 注册表及 Minecraft bundled Provider 已实现，但 Provider 装配和资源仍归 Minecraft App 服务包（本轮补查纠正先前未接入判断）。目录数量以实际生成清单复核，不能把 59 包组替代逐目录职责。

允许：增强原生成清单与 Gate 的逐目录职责标注，登记当前/目标职责及证据；将内置 Prompt/Expert/Skill 和领域工具迁到适合的真实能力包，接入现有 AiExtensions/Skill/Tools 注册表及 Bundle；修复模型上下文自动正文、App 专属能力发现与按需工具目录；同步包清单、锁文件、类型映射、README、架构及直接回归。禁止新增第二套 Agent/Session/权限/注册表、伪实现全部占位能力、修改其他 checkout、搬迁真实数据、重启/部署/提交/发布。既有稳定 ID/工具名和领域服务合同保持；旧路径兼容必须有原因与删除条件，能同步迁移时去除旧副本。

入口与 Owner：正式 Web/CLI/桌面共用 Control Plane Agent Loop → 已登记目录/加载/委派/领域 Tool → 原领域服务 → Jobs/真实节点。Boot/Bundle 仅装配；Agent 扩展、Skill 和 Tools 使用现有注册表，Prompt/Expert 正文由各专责内容包持有。跨 App 的能力目录与账户/作品/项目/节点数据权限分开；Writing 修改仍绑定当前真实作品，不能为共享能力猜测作品。专家实际委派复用原子 Agent 执行和预算。

设置：沿用 plugins.enabled、plugins.skillDirectories、Provider/模型、aiRuntime 的输出/上下文/请求/工具/委派预算、permissions.mode 三模式、computerControl.enabled、general.taskFolder/Shell、minecraftRuntime 及存储/节点覆盖；无新增 UI/外观控制，保留所有用户偏好。正文不随每轮目录注入，工具按模型选择进入本 Run，动态刷新重验卸载/设置/权限与子 Agent 范围；取消及未知副作用不重放。

验收：全目录职责覆盖和不可用状态准确；回归先复现 Minecraft 总控/专家自动注入，再验证跨 App 元数据发现、正文按需加载、领域工具按需装入下一请求、真实同一服务调用、错误上下文拒绝、范围/卸载/取消防扩权；运行直接回归、Client/Host 类型、受影响包/正式入口构建、sync/check:workspace 与差异检查。静态/合成、实际 Provider/浏览器/Daemon/桌面及帧时间分别报告；不为真实运行验收擅自重启或操作既有实例。所有本轮文件绝对路径/职责及验证清单写入交付报告。

实施与验收：原 359 目录经新增 9 个职责能力包成为 368 目录，192 个 workspace 包、176 个不可执行占位，全部逐项标注专属职责和静态证据，并接入原工作区覆盖 Gate。迁移 Minecraft/Writing Prompt、领域/作品专家、原 Minecraft bundled Skill Provider、三组领域工具及 Runtime 工具；去除 App 总控/专家自动注入，模型通过原注册表按需发现/读取/选择，明确专家经原子 Run 执行。跨界面 writing_get_context 只绑定当前账户已选目标，初始 Writing 请求只读元数据。通用项目/Skill/节点 Shell 不再按 App 新设白名单，节点与本机执行仍严格分开。工具名、领域方法 ID 与核心旧 Prompt/Skill ID 保留；旧聚合 Tool 标签退出，不冒充执行器。

最终 12 个直接回归文件合计 36/36、Client/Host typecheck、21 个能力/组合包串行构建、正式 Control Plane/Web 构建（2260 modules）、sync/check:workspace（192 包）和 git diff --check 通过；按最终指纹对账。合成请求中初始系统消息 5231 字节，4276 字节 Minecraft 正文仅在加载后进入结果；完整 Minecraft 合同从 0 项变为选择的 1 项，部署合同未选择始终未提供。完整 Profile 验证包括真实专家子 Run、继承空工具范围、权限、Skill、工作流、取消和卸载，模型为合成 Provider，不是现场验收。115 个本轮文件的绝对路径、职责与迁移源/目标见 `docs/development/package-owner-lazy-capabilities-20261014.md`；开始时其他任务改动保留。一次性迁移代码/无用中间内容已清理，证据仅留根 dist/.tmp；没有重启、提交或发布。现场 Provider、浏览器、实际节点/游戏、桌面/设备与帧时间未运行，外部插件旧内部源码路径兼容未验。不存在的 workspace-preflight 未运行，不冒充其他 Gate。

<a id="lfaa-package-responsibilities-standard-20261014"></a>

<a id="lfaa-package-responsibilities-standard-20261014"></a>

## 60-包职责规范-20261014

目标：优化用户提供的 `packages职责归属提示词.md`，将全仓包职责、依赖、内容归属与应用装配约束固化为后续开发必须遵守的规范。附件是待优化材料，本轮不自动执行其全仓代码修复指令。当前仓库由运行环境解析为 H:\LFAA1；保留开始时已有源码、测试及文档改动。

允许：修改用户明确指定的提示词文件；新增 `docs/development/package-responsibilities.zh.md` 及英文导读；在 AGENTS、开发规范、系统总体架构、本合同及任务索引加入规范入口。禁止：批量重构、包迁移、新建运行时/注册表/权限系统、修改源码或依赖、操作运行数据、重启、提交、发布、修改其他 checkout。

边界：登记全量目录覆盖方法及所有现存包组的职责约束；现状依据当前包清单、基线、相关 README 与装配入口，未逐包审查的实现不能表述为符合规范。包目录清单继续由原脚本生成，各包 README 持有自身职责合同，不建立第二份手工包计数权威。设置中心不涉及变更；后续功能任务仍需逐项盘点适用设置及唯一权限 Owner。

验收：核对包组覆盖、规范/提示词的一致性、相对链接、任务索引、全量与增量审查范围、应用壳平台例外、依赖与运行时隔离、Prompt/Skill 按需加载、生命周期、真实能力状态及交付条件；运行 check:workspace 与差异空白检查。纯文档任务不运行产品构建或运行验收，不声称已完成全部包代码审计或迁移。

实施与验收：已重写用户指定提示词，新增中文规范及英文导读，接入 AGENTS/开发规范/架构入口。规范表覆盖当前 59/59 一级包组，对应生成清单 359 个目录；逐包合同由各包 README 维护，不复制手工计数权威。六份仓库文档 228 条相对链接、合同/索引及外部提示词回读与关键约束检查通过；`pnpm run check:workspace`（183 包）和 `git diff --check` 通过。没有修改产品源码、依赖、设置或装配；原工作树改动保留。旧 `docs/DEVELOPMENT.md`、`ARCHITECTURE.md`、`PROJECT_PLAN.md` 不存在，已按当前中文基线定位，未声称读取。`workspace-preflight` 未运行（根 scripts 未登记该命令）；产品测试/构建、Provider/浏览器/Daemon/桌面/设备及帧时间未运行，纯文档任务不适用运行性能对比。全仓包代码审计与迁移未执行。

<a id="lfaa-minecraft-task-card-selection-20261014"></a>

<a id="lfaa-minecraft-task-card-selection-20261014"></a>

## 61-任务卡片选择-20261014

目标：优化 `/apps/minecraft/normal/tasks` 的任务卡片批量选择。终态任务的卡片主体可点击并支持键盘操作，选中后整卡使用危险色浅底和单一边框；卡片任何状态均不显示右下角圆圈或勾选标记，未选卡片点击后也不应因鼠标焦点出现红色外框。键盘焦点继续可见且与选中边框不叠加。任务信息按一致的纵向节奏紧凑排列；查看详情固定在卡片左下方，终态删除固定在右下方，同一网格行内操作按钮底边对齐；活动任务的取消按钮与详情按钮同属左侧操作组。显式的查看详情、单项删除和取消任务按钮仍保留各自行为，不触发卡片选择。非终态卡片仍可点击主体打开详情，但不可被选择删除。

Owner 与边界：UI Owner 是 Minecraft `TaskList`；批量选择 ID 通过共享浏览器持久化层按用户隔离并在刷新后保留，仅保存 ID，在任务快照更新时剔除已不存在或不再是终态的任务。沿用现有“最多 200 条任务快照”、管理员 `hasAdminAccess` 与服务端 admin 授权、终态删除事务。只允许改 Minecraft UI、其长期回归、包说明与本合同/索引；不改 API/删除合同、不触碰真实任务记录，不增加设置或依赖，保留工作树既有改动。

设置与布局：沿用共享主题/危险色/字体字号令牌和设置中心 `appearance.advanced.interfaceFontSize`；按容器宽度使用 Grid/Flex，检查窄视口、键盘焦点及减少动态效果偏好，不新建 CSS 自定义变量。

验收：回归验证可删除卡片语义、卡片选中状态、刷新后恢复选择、刷新后过滤失效/非终态任务、活动任务打开详情、操作按钮隔离、焦点样式和响应式布局。构建 UI 与 Web，运行工作区检查和差异检查；在任务菜单真实浏览器检查选中/未选中均无圆圈、鼠标点击未选卡无红色焦点外框、刷新后选择计数及卡片状态恢复、键盘焦点仍清晰、详情在左下且删除在右下，同一行卡片操作底边对齐、窄视口操作可见且无横向溢出；不执行删除。构建证据、浏览器证据、未实测设备和帧时间分别记录。

实施与验收：每个任务卡片主体使用无障碍按钮覆盖可点击信息区；管理员可对成功/失败终态任务点卡片切换选择，选中卡片仅呈危险色浅底和单一边框。已移除所有状态下的右下角圈/勾标记，并移除导致鼠标点击后未选卡仍出现危险色外框的 `:focus-within`；未选卡键盘焦点使用共享 `--color-focus-ring`，已选卡由选中边框反馈。卡片信息改为紧凑纵向节奏，移除消息最小高度，操作按钮紧随正文。非终态卡片点主体打开详情；独立详情、删除和取消按钮不触发卡片选择。管理员选择的任务 ID 经共享浏览器持久化层按用户写入本地存储，刷新后恢复；任务快照更新时自动移除已不存在或非终态 ID。`minecraft-task-workspace.test.mjs` 8/8、`pnpm typecheck`、Minecraft UI 构建、Web 构建（2260 modules）、`check:workspace`（183 包）和 `git diff --check` 通过。真实浏览器在 51 条任务记录（37 完成、14 失败、0 排队/执行）上复验：未选卡无红色鼠标焦点框/圆圈，选中计数 0→1 后刷新仍为 1 且选中卡状态恢复，取消后计数回到 0；详情等独立按钮未受影响，未执行删除。390×844、560×900、768×1024 下此前确认任务卡片按容器单列且页面无横向溢出；窄屏展开侧栏压缩主内容区，手机/平板真机和帧时间未实测。

2026-10-15 用户补充布局：保留卡片内容紧凑节奏，将操作区推至卡片底部；详情按钮靠左，终态删除按钮靠右，同一网格行内按钮底边对齐；活动任务的取消按钮跟随详情按钮位于左侧。设置沿用共享外观令牌，无新增配置。需按当前浏览器和窄容器检查实际对齐、换行与可达性，不执行删除。

补充实施与验证：TaskList 的操作区使用纵向自动留白贴到卡片底部；详情与取消按钮归左侧组，终态删除单独归右侧组，窄卡片换行时删除组仍由自动左边距靠右。工作量只增加静态布局，不增加订阅、请求或计时器；未测帧时间。设置沿用外观主题/颜色及 `appearance.advanced.interfaceFontSize`（默认 14），无新增设置。`minecraft-task-workspace.test.mjs` 8/8、Minecraft UI 包构建、Web 构建（2260 modules）、Client/Host 类型检查、`check:workspace`（192 包）及 `git diff --check` 通过。浏览器在任务页 59 条现存记录上目视核对：同一行按钮与卡片底边对齐、详情靠左、删除靠右；未点击详情或删除。窄视口本轮未做真实浏览器尺寸模拟，回归检查了任务网格和操作组的自动换行；手机/平板设备及帧时间未测。没有触碰任务记录。

<a id="lfaa-minecraft-task-card-motion-20261015"></a>

<a id="lfaa-minecraft-task-details-cleanup-20261014"></a>

## 62-任务详情与清理-20261014

目标：在 Minecraft“任务”菜单中提供单条任务详情，展示真实提交参数、任务时间线、节点返回结果和关联日志；失败时突出任务最终回报及节点原始错误/标准错误输出，明确没有更精确节点证据时不伪称定位。另提供单条删除和多选批量删除。入口为 `/apps/minecraft/normal/tasks`；展示归 `packages/client/ui-minecraft`，API 归 Minecraft Controller，共享任务与日志持久化归 Jobs/Minecraft 服务。

范围：仅允许删除已完成或失败的终态任务记录；失败中包含结果未确认等异常终态。排队/执行中任务不可删除；批量接口事务化，任一记录缺失或非终态时整批拒绝，最多 200 条。删除同时清除所选任务关联的节点日志，不删除 Minecraft 实例、部署、备份目录或其他任务日志。查看沿用认证任务列表的可见性；写入沿用管理员权限 Owner，不新增第二套权限或设置。

设置与性能：沿用设置中心外观主题/颜色/字体字号及现有管理员角色；无新增设置、持久化偏好或依赖。列表和批量操作复用当前有界 200 条任务快照，详情按需单次读取，节点日志响应上限 1000 条并报告截断，详情内容在窄视口内可滚动。

验收：隔离数据库覆盖成功/失败任务删除、活跃任务拒绝、混合批次原子拒绝、日志关联删除及实例/部署保留；UI 回归覆盖详情诊断、终态选择、单项/批量入口和响应式布局。运行直接回归、Minecraft Jobs/API/UI 与 Web 构建、工作区检查及差异检查；在当前浏览器查看真实任务详情但不删除任何现有用户任务。源码/构建证据与浏览器数据展示分别记录，未实测的设备/帧时间明确注明。

实施与验收：任务详情按需读取原提交参数、起止时间、结构化结果和关联节点日志；失败回报与第一条异常日志用于展示已保存的诊断证据，证据不足时明确说明。管理员可单项或多选删除已完成/失败（含结果未确认异常）记录；事务接口对缺失或活动任务整批拒绝，并仅清除所选任务及其关联日志。任务工作区、隔离数据库详情/删除与租约回归三个定向测试文件合计 12/12 通过（其中数据库测试 4/4）；`pnpm typecheck`、Jobs/Minecraft Service/Controller/UI 构建、Web 构建（2260 modules）、Control Plane 构建、`check:workspace`（183 包）和 `git diff --check` 通过。浏览器真实列表显示 52 条记录（37 完成、15 失败、0 排队/执行）；成功查看真实完成任务详情与失败任务原始回报“fetch failed”及其唯一关联 system 日志“任务失败：fetch failed”。现有失败记录没有更细的底层原因，界面未虚构诊断；未删除真实任务。重启本机 Web/控制端以载入新接口前确认无活动任务且四个 Minecraft 实例均已停止。隔离宽视口完成浏览器检查；窄视口由响应式样式和断言覆盖，真实手机/平板及帧时间未测。

<a id="lfaa-minecraft-task-feedback-20261014"></a>

<a id="lfaa-minecraft-task-feedback-20261014"></a>

## 63-任务状态反馈-20261014

目标：实例删除提交任务后留在 Minecraft 实例页；Minecraft“任务”菜单展示真实排队、执行、成功和失败记录，包含进度及节点回报，不出现仅有标题的空内容区。运行入口为 `/apps/minecraft/normal/instances` 与 `/apps/minecraft/normal/tasks`；UI Owner 为 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`，任务快照由现有 Minecraft API/Socket/轮询读取。

设置：沿用设置中心外观主题、颜色、字体与字号及 Minecraft Runtime 执行配置；不新增设置、持久化、权限策略或依赖。保留实例归档权限、确认和目标节点执行合同。允许修改 Minecraft 工作区、直接回归、包说明、本合同与索引；保留本工作树既有改动，不触发任何真实实例的删除/启停，不提交或发布。

验收：删除确认回调不导航到任务页；任务页可见真实任务列表、状态计数、执行进度、节点消息与归档结果；无任务时提供明确空状态，读取失败继续显示真实错误。运行直接回归、Minecraft UI 包与 Web 构建、工作区检查及差异检查；在本机浏览器核对两个路由和桌面布局，窄容器由响应式 CSS 与定向断言核对并注明未实测。未触发真实删除，因此只对删除提交后的导航以回归和代码路径验证，不宣称实际归档任务验收成功。

实施与验收：删除回调显式关闭通用“跳到任务页”行为，提交成功后在当前实例页提示可查看进度；任务页新增真实快照状态计数和任务记录，条目显示实例名、运行进度、失败消息及节点已确认的删除归档结果。`minecraft-task-workspace.test.mjs` 4/4、Minecraft UI 包构建、Web 构建（2260 modules）、`check:workspace`（183 包）和 `git diff --check` 通过。登录态浏览器先实测任务菜单只有标题、无内容；构建后同一路由显示控制端真实返回的 51 条记录（36 已完成、15 失败、0 排队/执行），其中删除记录展示归档和备份名。未触发真实删除；实际删除后的路由保持由定向回归锁定，运行中进度和窄屏实体设备未单独触发/测量，未采集帧时间。

<a id="lfaa-ai-work-composer-caret-20261014"></a>

<a id="lfaa-ai-work-composer-caret-20261014"></a>

## 64-输入光标修复-20261014

目标：修复 AI Work 提问框获得焦点后插入光标与浅色输入文字/表面融为一体的问题。运行入口为 Web `/tasks` 及各应用 AI Work 路由；组件与样式 Owner 为 `packages/client/ui-chat`。不自动聚焦，用户点击后应看到跟随当前输入文字颜色的插入光标；助手流式正文保持现有无光标呈现。

实测基线：当前浅色主题下点击提问框后 `document.activeElement` 确认是输入框，但计算样式为白色插入光标、深色文字。运行时 Wallpaper Engine 注入了 `body textarea, body input, ... { caret-color: var(--we-caret-color) !important; }`，局部普通声明会被覆盖；页面打开时焦点在 WebArea，符合现有不抢焦点行为。

设置：沿用 Appearance 主题与 `color-text-heading` 文字令牌，无新增设置、持久化、权限或依赖。允许修改 AI Work 提问框样式、其直接回归、ui-chat README、本合同与索引；禁止改自动聚焦/键盘行为、全局光标规则、其他聊天 Surface、已存在的工作树改动、提交或发布。

验收：获得焦点时插入光标颜色跟随当前输入文字颜色，在当前浅色/壁纸页面可见；页面打开不抢焦点，暗色主题通过共享颜色令牌保持一致。运行直接样式回归、ui-chat 与 Web 构建、工作区 Gate 和差异检查，并在当前浏览器验证活动状态及计算样式。帧时间和物理触屏设备未测时注明。

实施与验收：`AiWorkChat` 提问框局部以 `caret-color: currentColor !important` 覆盖 Wallpaper Engine 的白色全局 `!important` 声明，输入框文字色和主题映射保持不变。`client-ai-work-composer-responsive.test.mjs` 2/2、ui-chat 包构建、Web 构建（2260 modules，客户端 TypeScript 检查随构建通过）、`check:workspace`（183 包）、`git diff --check` 均通过；最终 Web 构建指纹为 `[]`。新登录态浏览器页 `/tasks` 初始焦点仍在页面，点击输入框后焦点落在 TextArea，计算插入光标与文字均为 `rgb(10, 10, 10)`，同时 Wallpaper Engine 全局值仍为 `#ffffff`；实际加载资源为 `ai-work-chat-alktZ3Ct.css`。截图保存在 `dist/.tmp/ai-work-composer-caret-20261014/composer-caret-browser.png`。未测物理触屏、暗色主题实机和帧时间；暗色适配依赖输入文字当前共享颜色值。

<a id="lfaa-agent-execution-validation-20261014"></a>

## 65-Agent执行验收-20261014

用户要求依据附件工程审查和截图，先审计并精准修复实际调用链，再在浏览器验证构建修复、Minecraft 部署、网络搜索、软件启动、失败续修和停止；包数和提示词长度不作为能力证据。附件指令与当前请求区分，沿用当前仓库 Owner、配置和授权。当前 checkout 为 H:\LFAA1，工作分支 codex/agent-execution-validation-20261014；初始工作树干净，不提交、发布或操作既有游戏实例。

已复现证据：Session fa025f19-ad6c-461f-a65f-8a2c0306fe38 的公开工具轨迹显示用户选择 Folia 1.21.11，provision 在元数据解析阶段连接失败，尚未进入实例/任务事务，却由通用异常路径标为 unconfirmed；模型核查无部署、网络恢复和用户重试意图后仍被防重终止。失败轮次未写入汇总 usage，取消任务状态也须保持未知副作用边界。

允许修改 Agent Loop/Tools、Minecraft 部署准备结果、对应长期回归及事实文档；Provider、Shell、Web、Skill、MCP、Subagent 装配先审计，有证据再改。区分 Owner 确认未开始、实际失败和未知结果；只允许明确可恢复的未开始操作在新检查证据后重试，保留已成功/未知副作用防重、实时权限与原预算。不以全部 ApiError 推断没有副作用。停止后不继续派发，已排入领域任务单独核对。

沿用 Provider/模型与思考设置、aiRuntime 请求/工具/输出/重试/超时预算、permissions.mode、general 任务目录/Shell、minecraftRuntime 默认值与时限、插件/MCP/电脑操控开关和存储位置；不读取或打印凭据正文、不重置设置。真实模型验证使用用户当前已配置账户，有限次数，记录实际 usage；没有价格不能虚构金额。涉及已有服务重启或游戏影响先核对具体范围。

验收顺序：新增有意义的失败复现回归 → 最小修复 → 定向测试、Host/Client 类型、相关包/入口构建、check:workspace 与差异检查 → ChatGPT 浏览器/电脑操作入口实际任务验收。真实 Provider、浏览器、Daemon 与外部服务分别记结果；工具缺失和登录限制明确列出，不把合成测试当实际成功。能力矩阵、逐文件职责、六类任务和四项长期指标的统计边界记录在 docs/development/agent-execution-validation-20261014.md。

2026-10-14 本轮续验：开始时已有以上恢复/用量改动及四个回归文件，均保留并重新验证，不以合同中的“初始干净”描述本轮工作树。补查目标节点 Shell 将任务头与 result 分开返回时的未知副作用判定；允许补齐同一结果 Owner 与长期回归，不能将外层 unknown 当成功。浏览器项目/提交返回 500，核查四个实例均 stopped、无活动节点任务或 Java 进程后重启控制端加载当前正式构建；恢复设置/项目/任务读取。该恢复不能证明旧进程 500 根因已定位。隔离项目和截图/运行证据只写根 dist/.tmp，测试材料不进入产品。六类任务限定本次命名目标；既有游戏和用户文件保留。

实机发现补充：Paper 1.16.5 已就绪并正常停服，但预检承诺 Java 11、实际按核心 Owner 使用 Java 16。部署服务已有 javaRuntimeId 校验/传递，AI 工具 Schema 却未暴露该参数；模型可见目录也没有工件/Java 要求查询。允许补齐这一协议适配与只读证据工具，复用 resolveMinecraftCoreArtifact 和原部署服务，不复制核心/Java 规则、不改变默认配置；用户指定环境不匹配时须未开始并明确失败。先回归复现，再浏览器验证模型识别冲突、传入真实环境 ID；不把首次开服结果算作完整指定环境验收。

轨迹对账发现：参数解析失败已有 tool/result，却没有对应 tool/call；执行器抛 AbortError 时也可能只留下调用。允许补齐原 Session 协议配对，未派发记 false、已派发取消记未知；不为补记录执行或重放工具。该问题用独立回归复现并核对拒绝/取消后不再派发。

实施与验收：恢复/失败用量旧改动已保留并验证，新增外层 unknown、Java 参数/只读要求和拒绝/取消协议配对修复。39 项不同的直接回归在本轮通过；最终修改后的 Agent/MCP 10/10、完整装配 1/1、认证 API 1/1、Client/Host 类型、三个受影响包/Control Plane/Web 正式构建、check:workspace 和差异检查通过，Web 仍有既有大块提示。API 与重建并行曾造成编译入口暂缺，构建后串行重跑通过；新增断言先复现失败，再修复，不改写旧记录。正式构建指纹无过期项。浏览器十轮真实 deepseek-flash：代码修复/续修、搜索、记事本、停止通过；Paper 1.16.5 真实就绪并正常停服，但首次 Java 11 承诺未满足（实际 16），修复后模型只读识别冲突、不部署；未再跑有效指定 Java 的第二次完整开服。六类严格样本 5/6，不泛化长期成功率；已知 1200588/26330 tokens，不是完整费用账单。证据、设置和逐文件职责见本轮报告。故障项目临时代码已清理，截图/公开快照与服务占用日志保留；原四个实例未动，新测试实例保留 stopped，未提交/发布。

<a id="lfaa-runtime-manual-repair-20261014"></a>

## 66-运行环境修复-20261014

用户本轮要求：使用其账号浏览器验收 Minecraft 1.16.5 手动完整开服，修复阻断流程；增加实例删除；整理当前 checkout 的 data/environments/java 为 Java/Java<主版本>-windows-x64；核验官方 Java/核心下载；统一环境分类卡片（Java、SteamCMD、Visual C++、DirectX）及 Minecraft 往返导航，纠正 Java 需求与实际安装状态混淆。附带历史聊天和截图只作为问题证据，当前用户请求及仓库权限规则优先。凭据不写入源码、合同、日志。

入口/Owner：共享 Client→认证 Minecraft/Runtime Controller→Minecraft、RuntimeManager、Jobs→共享执行器/Daemon；存储和外观继续归 Settings，权限继续唯一三模式。允许修改上述直接实现、长期回归和事实文档，保留全部既有改动。不提交/发布。用户明确授权整理当前环境目录，先验证真实版本、引用和无运行占用再改名；其他真实数据/备份保留。实例删除拒绝运行/活动任务；已停止/失败可请求归档，未知状态交由节点核验路径和进程。完整目录移入备份归档，或节点明确确认目录已不存在后，才移除登记；不以删数据库代替文件操作。

配置：沿用 permissions.mode、minecraftRuntime 的核心/内存/端口/执行方式/下载/就绪/停服时限，项目存储 runtimeDirectory/downloadCacheDirectory/temporaryDirectory、节点覆盖和 SteamCMD 安装设置；外观继承主题/强调色/字体/字号/对比度/壁纸/遮罩/模糊/减少动态效果。不重置偏好。下载只用核实的官方来源、HTTPS、摘要或 Windows 厂商签名，不关闭 TLS。

验收：直接回归、类型检查、正式构建与 workspace Gate；真实浏览器登录、1.16.5 新建下载到就绪/监听/停服、删除本次验收实例、环境检测/下载/草稿和实例往返、窄容器布局及外观设置。逐项记录通过/失败/未测；公网和客户端登录不能从本机端口推断。

<a id="lfaa-game-library-runtime-20261014"></a>

<a id="lfaa-game-library-runtime-20261014"></a>

## 67-游戏库运行-20261014

来源：用户明确要求按 `D:/系统/下载/writing-block.md` 开发、浏览器验收、发现问题修复后重验。该材料要求整合游戏库入口、运行环境 Owner、手动/AI 工具共用、智能开服与有界恢复。EULA 文中冲突已向用户澄清，用户选择“沿用项目三种权限：完全访问可直接接受 EULA，其他模式走统一审批”；本合同据此保持唯一 Permission Owner，不增加法律协议旁路。材料中的角色、示例版本/路径/工具名称不是当前能力事实；不强制委派简单任务，不创建第二套 Agent/Session/Identity。

入口与范围：应用中心→游戏库三卡片（运行环境/Minecraft/SteamCMD），保留原业务 App ID、既有路由、账户配置、记录与进程；游戏库只整合入口与共享资源视图。RuntimeManager 在 `packages/games/runtime-manager` 持有环境规则、解析、设备隔离和任务控制；共享执行模块供控制端本机适配器与 Daemon 使用，节点仍仅执行真实授权任务。Minecraft/SteamCMD 各保留领域规则，手动页和 AI Tools 复用同一环境服务。允许修改这些 Owner、Settings/存储迁移/API/装配/Client 路由与组件、任务取消恢复、Skill/提示词、直接回归、包说明与当前架构事实；保留全部已有脏改动，不提交/发布、不修改 DSH、不搬迁或清理真实数据。

设置盘点：沿用 Provider/模型/推理、aiRuntime 的请求/工具/委派/下载预算、general 的默认模式/终端/目录、permissions.mode 三模式、minecraftRuntime 核心/内存/端口/执行方式/超时、SteamCMD 设置、数据根与节点存储覆盖。运行环境、下载缓存、临时目录缺少独立设置时先接入 Settings 权威类型/默认/校验/持久化/UI，再由执行模块读取；远端路径使用目标节点语义，本机绝对路径不得误用于远端。保留旧环境位置供发现/引用，不自动搬迁。游戏库界面继承现有主题、强调色、字体/字号、对比度、壁纸/遮罩/模糊与减少动态效果；按用户指定的三卡片 Grid 布局实现，不为设计技能增加外部素材、随机版式或 GSAP 依赖。

实施顺序：①审计与差距登记；②游戏库入口；③运行环境服务/共享执行/设置/本机与节点适配；④手动缺失提示与草稿返回；⑤工具和领域 Skill/子 Agent 已有委派合同；⑥取消/检查点恢复和下载去重；⑦直接回归/类型/正式构建/Gate；⑧登录真实浏览器走入口、环境发现/复用、AI Work 一句话部署，失败后修复重验。运行中服务器/服务先观察；需要影响已有实例的重启时在具体影响确定后取得授权，不以构建代替加载验证。

验收：三卡片真实路由和响应式/主题生效；旧记录与配置保留；Java 通过可执行文件实际检测、多版本/设备隔离/选择/删除依赖校验；本机环境管理不依赖 Daemon 在线；下载官方来源/摘要/缓存/超时/取消/进度与安装后验证；手动与 AI 使用同一服务，缺环境不丢草稿；任务真实状态与安全取消/有界恢复；三种权限保持；已有 EULA 记录可复用，新接受动作有用户/目标/时间及真实结果。Linux 与其他核心仅按已接入执行器和实测证据报告，未支持/未实测不得伪装完成。浏览器最终记录真实模型、耗时、用量、工具次数、就绪/监听及未验证公网；性能、源码/构建、浏览器、远端/跨平台与帧时间证据分开。逐阶段结果与逐文件职责登记于 `docs/development/game-library-runtime-20261014.md`。

<a id="lfaa-agent-minecraft-storage-repair-20261013"></a>

<a id="lfaa-ai-work-composer-slash-mention-20261015"></a>

## 68-输入命令与引用-20261015

目标：让小鱼智能体消息输入框通过 `/` 快速选择已存在的聊天命令，通过 `@` 搜索并关联当前目录真实可用的应用、Skill、提示词和专家能力；键盘、指针、窄分栏和短屏交互均可达。

Owner：共享聊天输入及菜单归 `packages/client/ui-chat`；应用/能力目录由工作区现有 `ApplicationWorkspace` 消费并传入；会话关联仍由现有 `setAiSessionAssociations` 与 `AgentAssociations` 合同保存，模型仍按用户目标决定是否读取关联能力。计划模式、侧边聊天、模型选择分别复用当前聊天逻辑与控件。

设置盘点：复用 `general.sendShortcut` 保持 Enter 发送偏好，计划模式仍使用现有会话合同；外观沿用设置中心主题、强调色、字体/字号、表面、对比度、模糊和减少动态效果令牌；权限继续使用 `permissions.mode`。不新增设置、目录请求、持久化或权限规则。

允许：在聊天输入 Owner 增加按 `/` 与 `@` 触发的筛选菜单、键盘导航和关联/命令入口；更新 ui-chat README、相关长期回归与本合同结果。禁止：复制能力目录或领域规则、为建议项伪造能力/成功状态、让 `@` 绕过 Session/应用授权、修改 Provider/Daemon/账户权限、触碰无关工作树或真实数据、重启既有服务、提交或发布。

验收：`/` 菜单只显示当前已实现的命令；选择 `/plan`、`/side` 复用现有解析，`/model` 打开现有模型选择器；`@` 菜单按实际应用和能力目录筛选，选中项通过原关联 Owner 保存并呈现为输入引用。方向键、Enter、Tab、Escape 和鼠标可操作，选项可滚动，视口变窄/变短时不遮挡关键输入控件；新菜单使用共享外观令牌。运行直接相关的源码/包与 Web 构建验证；按项目要求在内置浏览器检查真实 `/work` 页面桌面与窄/短视口，记录路由、尺寸、截图及未测范围。不得声称未执行的回归、帧时间或设备验收。

实施：`AiWorkChat.tsx` 在输入框开头识别 `/`，提供现有 `/plan`、`/plan off`、`/side` 命令入口及复用当前模型选择器的 `/model`；识别单词边界后的 `@`，从现有应用 ID 和工作区传入的真实能力目录筛选。应用/Skill/提示词/专家选中后以现有 Session 关联合同保存，并插入 `@名称`；新会话仅更新待发送的本地关联，未创建会话或写入服务端。能力匹配目录按 prop 变化缓存，结果至多渲染 60 项；输入期间没有网络请求、轮询或额外订阅。键盘选择会恢复输入焦点和光标，Enter/Tab 选中、方向键移动、Escape 关闭。菜单与输入框等宽、命令行显示图标和横排名称/说明；只在菜单打开时短暂监听窗口/视觉视口变化并观察输入框尺寸，以聊天画布顶部为边界计算可用高度，清理时撤销监听并断开观察器。

设置与安全：复用 `general.sendShortcut` 保持原发送按键，外观使用现有主题/强调色/字体字号/表面令牌；不新增 CSS 自定义属性、设置或数据源。关联应用/能力沿用原应用目录、Session API 和服务端校验，不授予执行权限，不改变 `permissions.mode`。

验证：最终源码下 `pnpm --filter lfaa-client-ui-chat build`、`pnpm --filter lfaa-web build`、`pnpm exec tsc --noEmit -p tsconfig.client.json` 与 `git diff --check` 均通过。正式 Web 构建处理 2261 个模块并写入根 `dist/apps/web/`；保留既有单个 500 KB 以上 chunk 提示。未运行自动化测试。

内置浏览器：在正式构建后的 `http://127.0.0.1:3000/work`、1280×720 复验。初看发现菜单限宽且长 `@` 列表被聊天画布顶部裁切；修正后 `/` 面板与输入框等宽，图标、命令名与说明横向排列，`@` 长列表从聊天画布顶部完整显示并在约 690px 窄分栏内滚动，无横向溢出。键盘方向键加 Enter 将 `/plan off` 补入草稿；`@` 搜索及能力选择在之前的空白会话验收中通过，未发送消息或向现有会话写入。已将输入恢复为测试前草稿、关闭窄分栏，并关闭临时浏览器标签。未测短屏/手机、主题切换、真实 Provider、帧时间和真机；截图留在本轮内置浏览器验收输出中，未导出文件。

<a id="lfaa-ui-sidebar-categories-20261015"></a>

<a id="lfaa-ui-sidebar-categories-20261015"></a>

## 69-会话栏分类-20261015

目标：将小鱼智能体左侧会话栏按“草稿、置顶、项目、最近”分区展示。未发送草稿继续读取现有 Client 草稿；置顶会话可星标/取消星标，项目会话按已登记项目分组，无项目且未置顶的会话归入最近。

Owner：布局与交互归 `packages/client/ui-workspace`；按账户隔离的本机置顶会话 ID 偏好归 `packages/client/store`；草稿继续归既有 Workbench/草稿持久化，项目与会话正文及归档继续归现有 Workspace/Session Owner。

设置盘点：不新增设置中心配置。沿用 Appearance 的主题、颜色、字体、字号、对比度、表面透明度、模糊与减少动态效果令牌；置顶只保存有界会话 ID 列表到现有浏览器 Client 持久化层，不改变服务端会话或权限。

允许：左侧会话分类、星标操作、客户端持久化 helper、直接回归、相关包 README、本合同和交付记录。禁止：修改会话服务端数据模型/API、改变账户/项目隔离、迁移草稿或真实会话内容、重置设置、改动其他入口、重启运行服务、提交或发布。

验收：草稿有内容时可从“草稿”返回小鱼工作区；星标会话进入置顶，取消后按原项目/最近归类；项目会话保留现有项目上下文与新建入口；分类顺序固定，空分类不产生误导操作。无新增请求、订阅或轮询，置顶状态按账户隔离且最多保存 200 个 ID。运行置顶 helper 回归、UI Workspace 构建、正式 Web 构建、适用 workspace Gate 与差异检查；内置浏览器实测 `/work` 桌面及窄/短视口并记录截图、路由、尺寸、主题和未测边界。

实施记录：`ApplicationSidebar` 按草稿、置顶、项目、最近展示会话；项目分类使用现有项目目录与会话 `projectId`，项目登记已移除时仍保留会话并显示其原项目名。草稿入口读取现有 AI Work 草稿是否为空，点击返回 `/work` 继续编辑，没有复制草稿数据或逐键新增订阅。每条会话使用星标置顶/取消；取消后依据原项目 ID 回到项目组，否则回到最近。置顶 ID 通过 `packages/client/store` 的 helper 存入账户隔离的浏览器持久化，去重并限制为 200 条；未修改 Session API、会话正文、项目数据或权限。会话列表仍来自原 Workspace/Session Owner，没有额外请求、轮询或订阅；星标操作受当前聊天忙碌状态禁用。

设置与外观：未新增设置中心配置。分类标题、会话操作沿用工作台现有 Appearance 共享主题/强调色/表面/文字令牌，没有新增 CSS 自定义属性；置顶仅为本地导航偏好，不影响跨设备同步。

验证：`apps/cli` 的 `client-persistence.test.mjs` 通过 6/6，包含账户隔离、去重、200 条上限和清空；`pnpm --filter lfaa-client-ui-workspace build` 与 `pnpm --filter lfaa-client-store build` 通过，`git diff --check` 通过。`apps/web` 目录直接 Vite 构建成功，2261 个模块输出到根 `dist/apps/web/`，该构建期间的 Web 指纹有效；当前 Host 指纹仍旧，`node scripts/runtime-build-state.mjs web` 报告 `host`。正式 `pnpm --filter lfaa-web build` 与 `pnpm run typecheck` 被工作树内其他文件的 TypeScript 错误阻断：`ui-layout/Workbench.tsx` 有未使用的 `Alert`、`opening`、`currentRouteApp`、`onOpen`，`ui-sidebar-files/FileManagerPage.tsx` 缺失 `applications`、`onOpenApplication`；本次变更文件无对应诊断。`pnpm run check:workspace` 被既有的 `ui-sidebar` 缺少 `lfaa-util-values` 声明和包目录 JSON 清单过期阻断；未扩展修改去处理这些无关问题。

实页检查：已登录 Edge 的实际 `/work` 页面在 2560×1223 显示“置顶 0 / 最近 54”；临时置顶一条会话后为“置顶 1 / 最近 53”，取消后恢复“置顶 0 / 最近 54”，原会话归类复原。左栏 splitter 检查结束时为 280，保持原始宽度。该用户当前没有带草稿的会话或项目关联会话，因此本次实页未出现草稿/项目分类。截图由外部 Edge 的浏览器能力捕获，没有保存成本地文件。ChatGPT 内置浏览器在同一路由停留于登录页，无法进入实际功能；因此项目要求的内置浏览器目视验收未完成，外部浏览器仅作补充证据。窄/短视口、手机、主题切换、帧时间与设备验收未测。

<a id="lfaa-chat-home-20261015"></a>

<a id="lfaa-chat-home-20261015"></a>

## 70-聊天首页-20261015

目标：撤下独立应用中心页面，将登录后首页和根地址 `/` 统一落到 `/work` 小鱼智能体对话区；保留专业应用访问，将现有入口改为左侧紧凑“应用”菜单。

Owner：根路由兼容和应用入口校验归 `packages/client/ui-renderer`；工作台页面组合归 `packages/client/ui-layout`；工作区导航和紧凑应用菜单归 `packages/client/ui-workspace`、`packages/client/ui-sidebar`；默认首页显示与背景映射归 `packages/client/ui-settings`、`packages/client/ui-layout`；账户设置默认值、兼容读取和持久化继续归 `packages/util/values`、`packages/settings/settings`。

设置盘点：不新增设置项。General 原 `defaultMode/defaultStandaloneChat` 字段仅保留账户兼容读写，新默认值对应 `/work`，既有账户值不被覆盖且这些字段不再驱动路由。原 Appearance `backgrounds.appCenter` 持久化键继续映射小鱼智能体工作区及既有关联工作区，在设置中心改显示为“小鱼智能体工作区”，不迁移或重置已保存图片。服务状态开关继续控制工作区顶栏和左侧导航状态点；`openHome` 快捷键返回 `/work`。现有认证、偏好保存、App 路由入口标记和三种权限模式不变。

允许：相关 Client 路由、工作台、紧凑应用选择、设置映射、直接回归、包 README、架构/计划和本合同。禁止：删改 App 领域能力、变更认证/授权/数据 Owner、重置用户背景或账户偏好、操作真实数据、重启既有服务、覆盖无关工作树修改、提交或发布。

验收：登录、刷新、根地址、历史回退及旧根入口显示 `/work`；专业 App 可经紧凑菜单打开并继续走现有偏好保存与路由标记；独立应用中心卡片页、旧顶部“应用/工作”切换和相关入口文案撤下；设置中心明确显示小鱼智能体为固定首页，原背景选择继续作用于新首页且其他账户偏好不被重置。运行路由/设置/菜单直接回归、Client/Host 类型检查、相关包与正式 Web 构建、存在的 workspace Gate 和差异检查；内置浏览器检查桌面及窄/短视口，记录路由、尺寸和未测边界，不以构建代替实页验收。

实施记录：已移除应用中心卡片页和工作区顶部模式切换；根地址、登录默认入口进入 `/work`。左侧“应用”菜单保留游戏库、SteamCMD、Minecraft、联机服务、写作空间和 AI 漫剧入口。设置中心固定首页说明、服务状态开关与原 `appCenter` 背景映射保持同步。路由/设置定向测试、Client/Host 类型检查、8 个直接相关包构建、正式 Web 构建及 workspace Gate 通过；ChatGPT 内置浏览器在 `http://localhost:31247/` 及 `/work` 目视验收，桌面 1307×682，窄分栏下中间区约 624px；设置开关可隐藏/恢复顶栏与导航状态，背景选择显示旧 `appCenter` 值。临时服务已停止。隔离测试数据位于 `dist/.tmp/chat-home-browser-check-data`；自动审核拒绝了递归和逐文件清理命令，因此该临时目录仍保留。性能侧未增加定时任务、轮询或 API 请求，菜单外点/Escape 事件在关闭与卸载时撤销；帧时间、手机和更短屏幕未测。详细证据见 [首页迁移交付记录](development/chat-home-20261015.md)。

<a id="lfaa-settings-storage-selection-20261015"></a>

<a id="lfaa-settings-storage-selection-20261015"></a>

## 71-存储位置选择-20261015

目标：修复项目与存储的默认、推荐、自定义位置选择与布局，并让用户可选择系统复制、手动复制后识别、ZIP 备份导入。入口 `/settings?section=workspace`；数据根选择置顶，当前生效与待迁移位置分开，三种迁移方式均先校验再显式保存，分类目录紧凑展示。取代旧布局合同仅改 CSS 的边界；自定义根不自动覆盖，但用户显式选择推荐并保存时允许安排迁移。

Owner：Client UI 负责草稿及布局，workspace/data-directory 负责权威路径、迁移方式、归档识别与计划，原 Settings API 保留认证和超级管理员写入限制；实际复制/导入仍由完整启动器在服务停止后执行并核验。`LFAA_HOME` 唯一承载插件安装和受控运行适配文件，`LFAA_DATA_DIR` 唯一承载可迁移用户数据；改数据根不搬插件安装。手动复制目标须与源数据清单匹配，归档导入须拒绝路径穿越、链接、重名覆盖和非空目标。设置复用 `LFAA_DATA_DIR`、原迁移标记和外观主题/颜色/字体字号/对比度/透明度/壁纸模糊/减少动态效果映射，不新增偏好或第二套路径持久化。

允许：相关 UI、数据根 Owner、直接回归、包 README、本合同与架构事实。禁止：变更真实数据根、实际迁移用户数据、重启既有服务、修改无关工作树、提交或发布。验收：三种位置均可明确选择并保存；自定义到推荐不再被错误阻止；三种迁移策略各自正确识别目标且禁止覆盖；ZIP 安全展开后清单与 SQLite 检查通过才切换；当前与待迁移状态不混淆；只读及非超级管理员不能提交；取消恢复当前位置，输入与保存串行；窄容器/短屏无横向溢出。运行直接回归、受影响包/正式 Web 与 Control Plane 构建、类型、workspace Gate、差异检查；内置浏览器检查实际页面桌面及窄/短屏，记录主题/设置效果、截图及未测边界。不在真实用户环境点击迁移保存。

实施：存储位置置顶为三张互斥选择卡，默认、推荐、自定义均通过显式保存提交；切换模式保留自定义草稿，空草稿禁用提交，保存/取消期间禁用编辑。当前生效与待迁移/失败信息分开，角色及启动配置锁定统一只读。分类位置改为双列紧凑清单，容器 760px 以下选项单列、560px 以下分类单列。推荐 Owner 移除错误的自定义根禁用；保留历史非 data 根时不再追加 data。原非空目标、路径重叠、任务占用与认证授权保护不变。源码没有增加请求、轮询、订阅或计时器；选择只更新草稿，未测帧时间。

配置核对：数据根/默认/推荐/待迁移/可编辑状态继续来自 Data Directory Owner 与原启动配置/迁移标记；外观默认 theme=system、accentColor=#3457d5、字体=system、界面字号14/代码字号12、contrast=60、overlay=37、blur=14、reducedMotion=system、设置壁纸 lakeside-pagoda-morning，沿原 Settings 账户持久化和 Workbench 共享令牌映射读取已有用户值。未新增设置、变量或重置用户偏好；浏览入口仍遵守原 permissions.mode 与角色合同。

验证：先用新增行为断言复现自定义切推荐被拒绝，再修复；`node --import tsx --import ./register-package-loader.mjs --test tests/data-directory-settings.test.mjs tests/data-directory.test.mjs tests/file-resources.test.mjs`（apps/cli）20/20，通过默认/推荐/自定义、历史非 data 根、非空目标不破坏原计划、启动配置只读、安全复制及原文件/API回归。`pnpm run typecheck`、ui-settings/data-directory 两包构建、正式 `pnpm --filter lfaa-web build`（2260 modules）、`pnpm run build:control-plane`、`pnpm run check:workspace`（192包）、本次文件差异空白检查通过；`node scripts/runtime-build-state.mjs web` 返回 []，正式产物与源码指纹匹配。首次控制端构建因期间更新包 README 被指纹检查拒绝，最终稳定源码重建通过，未绕过检查。不存在的 workspace-preflight 未运行。

内置浏览器：`http://127.0.0.1:3000/settings?section=workspace` 加载最新正式 Web，1440×900 三列，768×600 窄分栏改单列，390×560 手机短屏自定义输入/保存可滚动到达、分类清单单列；文档和存储卡片无横向溢出。默认→自定义→推荐→自定义可切换，空输入禁用保存、长中文路径草稿保留。实页核对现有粉色强调色（rgb214/77/143）、Consolas代码字体、浅色主题与壁纸；截图位于根 dist/.tmp/settings-storage-20261015/desktop.jpg、narrow.jpg、phone-short.jpg、phone-folders.jpg。测试草稿/视口/导航已恢复，未提交真实迁移。未实测深色主题/更换字号及壁纸、真机、帧时间、桌面目录选择器、待迁移/失败UI和真实用户迁移；迁移逻辑用隔离目录回归。没有重启既有服务，因此后端两处修复仍需现有控制端下次正常重启加载，不能将构建通过写成已加载新后端。

<a id="lfaa-settings-persistent-toolbar-20261015"></a>

<a id="lfaa-settings-persistent-toolbar-20261015"></a>

## 72-固定工具栏-20261015

目标：为 `/settings` 增加常驻顶部操作栏。分类导航展开时，右侧正文分成顶部操作栏和可滚动展示区；收起时在操作栏左侧保留“设置菜单”入口。操作栏提供返回工作区/导航折叠、自动保存提示、当前设置分类恢复默认与立即保存。

Owner：共享 Client 设置界面归 `packages/client/ui-settings`；用户设置类型、默认值、服务端校验与持久化沿用 `util/values`、Settings Owner 和现有设置 API。工作区数据目录等独立业务配置仍由各自 Owner 保存。

设置盘点：复用现有 `UserSettings` 分类、`DEFAULT_USER_SETTINGS`、300ms 自动保存与 `saveSettings` 接口；不新增设置项、默认值、持久化或外观令牌。顶部提示消费现有主题、字体、字号、表面、边框、模糊及减少动态效果适配。

允许：在设置页调整侧栏标题栏/右侧常驻工具栏布局；将既有按分类操作移入顶部；“恢复默认”只重置当前 `settingsCategoryForSection` 支持的用户设置分类，“立即保存”等待当前分类和已排队的用户设置分类保存完成；更新本合同实施与验收记录。

禁止：把独立存储/账户/节点/插件等 Owner 的草稿合并进通用设置保存；全局清空用户偏好；改动认证、权限、业务配置语义、其他工作区变更或真实数据；重启/影响运行中服务、提交或发布。

验收：展开时左侧分类导航与右侧内容盒保持并列，顶部操作栏常驻且内容区独立滚动；收起时顶部“设置菜单”入口可重新展开。返回、收起/展开、自动保存、当前分类恢复默认与立即保存均按原 Owner 执行。核对桌面和窄分栏/短屏视口，操作可达、无溢出并服从现有外观设置；运行 UI Settings 与正式 Web 直接构建，分别记录源码/构建和内置浏览器实页证据，不声称未执行的测试、帧时间或设备验收。

实施与验收：`SettingsPage` 将返回/导航收起入口与自动保存提示、恢复默认、立即保存操作集中到右侧盒子的常驻顶栏；菜单收起时顶栏改显示“设置菜单”入口。原分类底部重复操作移除，顶栏复用当前分类的 `settingsCategoryForSection`、共享 `DEFAULT_USER_SETTINGS` 和原 `saveSettings`/自动保存请求去重；语音分类仍只恢复语音两项。没有添加设置项或改动数据目录等 Owner。

验证：`pnpm --filter lfaa-client-ui-settings build`、`pnpm --filter lfaa-web build`（2260 modules）和 `pnpm run check:workspace`（192 个包）通过；`git diff --check` 通过。ChatGPT/Codex 内置浏览器在 `http://127.0.0.1:3000/settings?section=workspace`、1303×681 实页检查展开/收起状态；收起时菜单入口可见，展开时返回与关闭入口、右侧操作均常驻。将侧栏临时调整为 435px（正文约 700px）后，顶栏按钮可见、存储卡片文本可换行且无横向溢出；随后恢复到 200px。该分类没有可由通用设置 Owner 重置的偏好，因此“恢复默认”保持禁用；没有点击保存，也没有触发存储路径写入。UI Settings 构建产物位于根 `dist/packages/`，Web 产物位于根 `dist/apps/web/`。未运行自动化测试，未测 50ms 长任务/帧时间、其他设备尺寸、桌面 WebView 或 Provider；未重启运行中服务。

<a id="lfaa-settings-data-directory-layout-20261015"></a>

<a id="lfaa-settings-data-directory-layout-20261015"></a>

## 73-数据目录布局-20261015

目标：修复 `/settings?section=workspace` 中“控制端本机存储位置”卡片的说明与长控制列垂直错位、控制列偏窄问题；保留原路径说明、角色权限、推荐/确认/迁移交互与数据语义。

Owner：界面归 `packages/client/ui-settings`；统一数据根的默认/推荐路径、迁移状态和持久化归 `packages/workspace/data-directory`，由现有认证 API 提供，设置页面只消费 `dataDirectorySettings`。

设置盘点：沿用 `LFAA_DATA_DIR` 权威运行配置及原迁移标记；首次默认系统账户 `.lfaa/data`，项目或桌面安装目录下的 `data` 是显式推荐位置，当前目录/待迁移目录/是否可编辑均来自 Data Directory Owner。外观沿用设置中心的共享主题、颜色、字体、字号、表面与对比度令牌。本轮不新增或修改设置项、默认值、持久化、服务端校验或外观令牌。

允许：仅调整该卡片的 JSX 包裹标记和局部 CSS；更新本合同的实施/验收记录。

禁止：修改数据目录选择/迁移语义、API、权限、真实数据或用户偏好；重启或影响现有服务；覆盖或清理开始前已有工作树改动、触碰其他 checkout、提交或发布。

验收：桌面宽度下说明与控制列顶部对齐、控制区有足够宽度且长路径可换行；容器变窄时卡片改为单列且不横向溢出，路径查看及原有操作可达。运行 ui-settings 直接构建，并在内置浏览器打开实际设置页，以桌面和窄容器/短屏视口目视核验；构建与实页验收分别记录，不声称未执行的测试或帧时间测量。

实施记录：只为统一数据根操作容器添加局部样式标记；桌面行从垂直居中改为顶部对齐，控制列拓宽；宽度收窄到设置容器 760px 以下时改为单列。路径内容可换行，原有按钮、权限判断、当前/默认/推荐及待迁移状态保持原 Owner 数据。

验证：`pnpm --filter lfaa-client-ui-settings build` 与 `pnpm --filter lfaa-web build` 均通过。内置浏览器在 `http://127.0.0.1:3000/settings?section=workspace` 实页检查：1280×720 常用桌面视口下两列顶部对齐；同为 1280×720，将设置正文收窄到约 708px 后卡片单列显示，长说明和路径可换行，按钮均可见且无横向溢出；检查后将侧栏宽度恢复为 200px。未触发保存/推荐/迁移操作，未运行自动化测试，未测帧时间；未重启运行中服务。

<a id="lfaa-settings-session-read-performance-20261015"></a>

<a id="lfaa-settings-session-read-performance-20261015"></a>

## 74-会话读取性能-20261015

目标：修复设置中心分区读取长时间显示“正在读取设置”并连带阻塞小鱼工作台会话列表/消息加载的问题。入口为 `/settings` 的懒加载分区、`GET /ai/usage`、`GET /ai/sessions` 和首屏消息页。已确认的热点：使用情况页调用 `getAiUsageSummary()`，其同步执行 `sessionRecords.all("ai_usage")`；该方法逐个恢复所有 JSONL 会话，再反复扫描全局记录表。它既随历史会话/用量行数增长，又会占住 Host 事件循环，使同一 Host 的会话请求排队。用户反馈会话仍慢后，继续发现关联投影超过 512 项淘汰后，最多 200 条列表记录会逐条回读完整会话日志。设置页其余分区按进入时各自读取，必须逐一核对并保持认证、账户范围和现有设置合同。

唯一 Owner：设置分类与渲染归 `ui-settings`，HTTP 请求归 `session-controller`/`client-connection`，会话用量汇总归 `core/session`，重放时维护轻量持久投影归 `session-persistence-jsonl`。不另建统计服务或数据源。

设置：不新增或修改设置中心控制项。Provider、模型、权限模式、外观及存储偏好全部沿用原 Owner、默认值、持久化和前端映射；本次读取优化不改变偏好、数据归属或权限。

允许：在已完整校验 JSONL 重放和受控提交期间，以账户及 Provider/模型为粒度维护与历史用量记录数无关的汇总；在 Session Owner 原接口上读取汇总；把设置页中确有顺序依赖的独立只读请求并行化；将有界关联引用投影附着到现有会话头，避免投影缺失退化成逐会话全日志扫描；补直接性能回归、相关包 README 和本合同记录。保持消息首屏缓存、版本校验、账户/App 隔离及取消合同。

禁止：省略历史数据或改变汇总字段语义、缓存逐条用量/消息正文、降低哈希链验证、增加第二会话存储/设置、重启或影响用户现有服务、修改真实用户数据、修改其他 checkout、提交或发布、触碰无关脏工作树内容。

验收：用量 API 不调用逐会话 `all()`/加载每条历史用量，结果与记录数、Token null 语义和 Provider/模型分组一致；正常 Host 事件循环不再被打开用量页的全历史扫描占用；设置区分读路径经检查，独立读可并行且有界的区分原样保留。会话列表对最多 200 条标题读取已验证头及引用投影；即使超过旧 512 项缓存规模，关联查询也不得恢复完整会话日志；首屏与更早页的完整 SHA-256 链校验、账户/App 隔离保持。运行 Session Persistence、Core Session、Session Controller、Client Connection、UI Settings 的直接验证、类型和直接包构建、存在的工作区 Gate 与差异检查。合成验证、源码/构建证据不冒充真实浏览器等待时间或帧时间实测；不重启当前运行实例。

实施记录：使用情况页从逐会话全历史恢复改为 JSONL 重放/受控提交期间增量维护用户/Provider/模型汇总，保留请求数、Token 可空语义及按最近时间排列的分组；`/ai/usage` 读取此投影。设置“项目与存储”区的健康、SteamCMD、Minecraft、统一数据根和历史存储读取并行启动。工作台继续按账户统一显示跨 App 历史会话，以账户为范围缓存列表；离开工作模式或切换账户时取消旧请求，完成回复后刷新同一共享列表。未增加或修改设置项。

补充实施：会话关联投影改为附着在仓库已有的轻量会话头上，头更新时迁移投影，重放及受控事件提交时同步维护；不再因 LRU 淘汰而对列表会话逐条扫描 JSONL，也不缓存消息正文。事务先完整校验；仅首次建档且会话头在事件之后时调整为先应用会话头，兼容现有日志格式，其余事务保持原顺序。

验证记录：合成 16 个会话/4,000 条用量行后重放，精确得到 4 个 Provider/模型组；汇总函数实测 0.020 ms，调用时 `sessionRecords.all()` 未被调用且会话热缓存统计没有变化（这是合成函数测量，不是 HTTP/浏览器时间）。Session Kernel/分页测试 10/10、用量性能回归 1/1、文件存储回归 8/8、Client Connection 请求回归 9/9、会话/设置 Client 定向回归 2/2 通过。Client/Host 类型检查、`check:workspace`（192 包）、Session JSONL/Core Session/Session Controller/Connection/UI Settings/UI Workspace/UI Chat 包构建及 Web/Control Plane 正式构建通过。完整 Web 集成测试在旧项目存储写入断言处收到退役 HTTP 410（该测试仍期待 200），因此未运行到其用量 API 断言。未重启当前实例；真实浏览器等待时间与帧时间未测。

补充验证：Session Kernel/分页/取消整组回归 10/10 通过；新用例构造 200 条实际 SQLite 列表候选并把关联头压力推过旧 512 项上限，列表结果 200/200 正确，完整 `readSession()` 计数为 0。4,000 条用量行/4 组投影回归 1/1，通过，汇总函数本次测得 0.036 ms（合成函数测量，不代表 HTTP/浏览器等待时间）。Client 请求回归 9/9、设置分区/会话取消回归 2/2、设置合同回归 1/1 通过；Client/Host 类型检查、Session JSONL/Core Session、Web（2260 模块）和 Control Plane 构建、192 包 `check:workspace` 与 `git diff --check` 通过。Web 构建先暴露设置页的重复分类声明及已不再调用的旧保存函数，清理后正式构建通过。会话列表回归保持跨 App 共享，不用筛掉其他 App 历史来规避性能问题。未重启当前实例；真实浏览器等待与帧时间仍未测。

运行态追补（2026-10-15）：在 `http://127.0.0.1:3000/work`（Edge 2552×1226）刷新复现首屏会话数为 0、会话列表和模型状态持续显示读取中；等待期间工作区其他面板已可见。之后同一路由加载出 53 条共享会话、原选中会话正文和可用输入框，确认是长时间未完成而非稳定空数据。再打开 `http://127.0.0.1:3000/settings?section=usage`，正文持续显示“正在读取设置…”，返回 `/work` 后又复现 0 条/读取中；源码中该分区读取 `/ai/usage`，但本轮没有浏览器网络瀑布、长任务或帧时间采样，故不能单凭画面认定该请求就是唯一阻塞点。3000 端口由 PID 17368 的 `node apps/cli/bin/lfaa.mjs web` 提供，进程创建于 07:59；Session Owner 源文件随后在 08:30/08:49 更新，Control Plane 与 Web 产物在 09:01 构建，`node scripts/runtime-build-state.mjs web` 返回 `[]` 只证明磁盘构建指纹一致。CLI 从编译后的 `dist/apps/control-plane/.../app-boot` 启动且没有热替换后端模块，因此当前内存中的控制端仍是构建前版本；源码修复和新构建没有进入该进程。PID 17368 托管的本机 Daemon 子进程为 PID 3968；当前没有 `java.exe`/`javaw.exe` 进程。任务禁止重启或影响现有服务，本轮遵守；须由用户明确授权重启后才能用同一路由复测最新后端。该实页记录不宣称性能修复已在线生效。

用户授权后的运行态复测（2026-10-15）：确认 3000 端口仍由目标 Web PID 17368 提供后，向其隔离控制台发送正常 Ctrl+C，Web 与托管 Daemon（PID 3968）均退出；按仓库公开入口 `pnpm lfaa web` 启动，09:11:07 创建 Web PID 5740，09:11:38 输出“LFAA Web 已就绪”并启动新 Daemon PID 25168，启动本身约 31 秒。运行指纹复查仍为 `[]`，证明启动时磁盘构建状态与源码一致。用户现有 Edge 标签恢复到工作台后，使用 CUA 真实浏览器完整刷新并等到 53 条会话、已选消息、模型和输入框就绪，耗时 1,193 ms；导航到 `/settings?section=usage` 并等到真实 252 次汇总数据显示，耗时 775 ms；随后完整刷新使用情况页，摘要显示且不再出现“正在读取设置”，耗时 898 ms。以上是当前登录浏览器的实页端到端观察值（页面已热缓存），不代表冷启动耗时或帧时间；另一次同标签路由导航早期 AX 快照为空，后续截图/AX 快照确认页面已完整显示。故旧进程未加载后端修复是此前长时间转圈的重要原因之一；现在在线实例已换成最新构建且两页通过实页复测，不能据此断言首次冷启动已优化，也没有采集 Network 瀑布、主线程长任务或帧时间。本次只重启 Web 与其托管 Daemon，没有改动设置偏好或用户数据。

设置中心全区复核与 Minecraft 目录解耦（2026-10-15）：`SettingsPage` 有 10 个进入时按需读取数据的分区；从真实调用链确认 Minecraft 分区为填默认核心下拉框等待 `GET /minecraft/cores`，该路由同步等待 `listMinecraftCores()` 对 FastMirror、Mohist Youer、PaperMC 三个外网来源执行 `Promise.allSettled`；每次来源请求具有 20 秒超时预算。因此仅为展示偏好就可能等待慢速/不可达的目录。新增认证后的 `GET /minecraft/core-names`，直接返回 `games/minecraft/src/core-sources.ts` 唯一登记的核心名；设置页改为读取该轻量合同，实时核心版本和构建接口仍按原来源校验，不改变账户默认值、数据、权限或部署行为。另 9 个数据分区在 Edge 热会话导航实测均在 0.42–0.60 秒内显示；修复后的 Minecraft 配置页实测 1,333 ms、使用情况页 1,023 ms，均无设置读取提示；工作台实测 1,486 ms 显示 53 条会话、已选正文、模型和可用输入框。后两次实页耗时从页面导航起到可访问内容就绪，非冷启动/帧时间。新增 API 回归 1/1：未认证为 401，认证响应与领域核心名登记相同，外网请求 0。Client/Host 类型检查、API Controller/Connection/UI Settings 直接构建、Web（2260 模块）、Control Plane 构建，`sync:workspace` 和 `check:workspace` 通过。第二次授权重启后 Web PID 22776 / Daemon PID 24488 已运行；启动时间约 53 秒，与路由读取分开记录。未采集浏览器 Network 瀑布、长任务及帧时间；未修改任何现有设置。

<a id="lfaa-xiaoyu-shared-agent-20261014"></a>

<a id="lfaa-xiaoyu-session-history-performance-20261015"></a>

## 75-会话历史性能-20261015

目标：让小鱼智能体打开历史会话和首屏消息时不因会话数量/日志大小产生长时间等待，并避免切换会话后遗留扫描占用磁盘。入口为 `/work` 共用工作台、`GET /ai/sessions` 与 `GET /ai/sessions/:sessionId/messages`。唯一业务 Owner 是 `lfaa-session`；JSONL 事务/校验/有界缓存归 `lfaa-session-persistence-jsonl`；认证与请求取消边界归 Session Controller/Client Connection；聊天加载生命周期归 `lfaa-client-ui-chat`。

设置：不新增设置；会话读取沿用现有账户/App 所有权与外观设置，不改变 Provider、权限或用户偏好。

允许：在已验证的 JSONL 重放与本进程受控提交上维护有界、可失效的会话列表/首屏轻量投影；对投影缺失、磁盘版本变化或向前翻页继续走原完整 SHA-256 链校验；将浏览器取消信号传至服务端异步扫描；消除 `busy` 状态变化引发的相同首屏请求。更新直接相关回归、包 README、架构事实与本合同。

禁止：降低认证、账户/App 隔离、参数校验或日志完整性；缓存模型私有历史、跨账户状态或无界会话正文；新增第二会话数据源/设置/服务；修改真实会话内容、覆盖无关工作树改动、停止/重启运行中服务、提交或发布。

验收：会话列表不逐条恢复完整 Session Kernel；已验证且文件版本未变化时，首屏从最多 100 条/16 MiB 全局预算的最近消息投影返回，反馈与分支来源保持原合同；缓存未命中/磁盘变化/更早页继续完整链校验；旧请求取消可终止服务端扫描；用户切换会话不会由 `busy` 翻转再次发起首屏请求。运行 Session JSONL/列表/分页/取消与 Client 请求直接回归、受影响包构建、Client/Host 类型检查、存在的工作区 Gate、差异检查。真实浏览器等待时间和帧时间单独记录，不能以源码/构建通过冒充丝滑实测。

实施记录：JSONL 已验证重放及受控事务维护最近 100 条展示字段投影，最多 128 会话/16 MiB；首屏在文件指纹匹配时读取投影，日志版本变化、投影缺失和更早页仍完整核验 SHA-256 链。会话列表复用有界轻量计划投影；关联引用附着于现有轻量会话头，在完整重放/受控事务中更新，读取不因缓存淘汰逐条恢复 Session Kernel 或扫描完整日志。会话切换取消客户端请求，Controller 将断连传给扫描 AbortSignal；聊天按账户/App/会话去重完成的首屏加载，busy 翻转不重复读取。未新增设置，账户/App/认证与数据权限边界不变。

验证记录：Session JSONL/列表/分页/回退/取消回归 10/10 通过；Client 请求回归 8/8 通过；新增聊天加载生命周期回归 1/1 通过。`pnpm run typecheck`（Client/Host）、JSONL/Core Session/Session Controller/Client Connection/UI Chat 五个包构建、`pnpm run check:workspace`（192 包）及本次文件 `git diff --check` 通过。`client-performance.test.mjs` 全套 27/28：唯一失败为原有流式正文断言仍匹配旧 `<span>`，当前未改动的 `AiWorkResponse.tsx` 已使用 `AiStreamingMarkdown`；本次新增加载回归通过。合成回归证明首屏零全日志页扫描、较早页一次完整扫描。

运行中复验补充：源码/构建修复后，已按用户授权重启 Web 与其托管 Daemon，使 3000 端口不再继续提供旧进程中的旧代码。第二个根因位于 Minecraft 设置：默认核心选择器只需要已登记核心名称，却等待 FastMirror、Mohist Youer、PaperMC 三个在线目录全部结束；单源超时 20 秒会拖住整块设置加载。改为通过认证的轻量 `GET /minecraft/core-names` 返回领域 Owner 的静态名称列表，不改变实时版本目录、部署校验或偏好。隔离 API 回归验证未认证 401、已认证名称列表正确且外部 HTTPS 请求数为 0。

重启后登录态 Edge 实测：`/work` 1,486 ms 显示 53 个会话、选中消息、模型和输入框；用量设置 1,023 ms 显示 252 次调用；Minecraft 设置 1,333 ms 显示已保存的 Paper 默认值；均未出现对应的加载提示。其余有独立数据读取的设置区在热浏览器实测范围约 423–775 ms。此处是页面内容就绪时间，不是逐帧/FPS 测量；真实长日志 JS 堆与帧时间仍未测。CLI/Web 冷启动仍约 53 秒，是另一个尚未解决的启动耗时，不应与页面读取耗时混为一谈。

<a id="lfaa-managed-file-resources-20261014"></a>

<a id="lfaa-minecraft-task-card-motion-20261015"></a>

## 76-任务卡片动效-20261015

用户目标：让 Minecraft 任务记录卡片的出现和鼠标悬停反馈更连贯自然，减轻当前界面的生硬感。入口为 `/apps/minecraft/normal/tasks`；唯一 UI Owner 为 `packages/client/ui-minecraft` 的 `TaskList` 与其样式。

允许：只调整任务卡片视觉动效、对应包 README、本合同与索引；保留卡片选择/焦点语义及详情左下、删除右下布局，不改变任务数据、API、排序、删除合同或交互授权，不新增依赖、计时器、观察器、JS 动画循环或 CSS 自定义属性。保留当前工作树所有既有改动。

设置：沿用共享 Appearance 主题和颜色令牌、`appearance.advanced.reducedMotion` 的 system/on/off 设置及工作台的减少动态效果映射；不新建动画偏好、不改变已保存的用户设置。

验收：实际任务页在 ChatGPT 内置浏览器核验卡片初次出现、悬停反馈与已有操作/选择状态；覆盖常用桌面和相关窄容器，核对无错位、遮挡或横向溢出；确认只让有限首屏卡片错开进入，并遵循减少动态效果设置。运行 Minecraft UI 与正式 Web 构建；不点击详情/删除或修改真实任务。真实浏览器、视口、动效边界及未实测项目分别记录，帧时间未测不得宣称已验证。

实施与验收：卡片使用 CSS transition 做短促上浮、主题边框和柔和阴影反馈；仅前 6 张卡片以 24ms 间隔淡入上浮，避免大量历史记录同时运动。悬停只在支持 hover 的设备生效，沿用全局 `appearance.advanced.reducedMotion` 映射、现有主题/颜色令牌；不改变卡片选择/焦点、详情左下和删除右下布局。Minecraft UI 与 Web 构建通过，`git diff --check` 通过；未增加或运行测试。ChatGPT 内置浏览器在 1280×720 页面视口检查任务卡片与悬停反馈；另在 684×680 的内置浏览器窄容器（右侧工具栏展开）检查单列卡片、左右操作按钮及可见性，未见错位或横向溢出。查看/删除均未点击，任务选择数保持为 0，未改动真实任务。减少动态效果设置的实际切换本轮未做，手机/平板设备和帧时间未测。

<a id="lfaa-settings-card-motion-20261015"></a>

<a id="lfaa-settings-card-motion-20261015"></a>

## 77-设置卡片动效-20261015

用户目标：在设置中心“常规”中提供统一的卡片动效选择，默认选择柔和流体效果，并提供多种效果供账户自行选择；后续普通卡片通过共享标记接入，不在各业务页面重复实现动效，特殊卡片可以单独覆盖。

Owner：`util/values` 持有 general 设置类型、效果选项合同与默认值；`settings/settings` 持有 general 分类的兼容读取、服务端校验和账户 JSON 持久化；`client/ui-settings` 呈现选择器；`client/ui-layout/Workbench` 将已保存效果映射到工作台根节点；`client/ui-theme/common.css` 持有唯一共享卡片动效实现；`ui-layout` 应用卡片与 `ui-minecraft` 任务卡片作为首批注册消费方。HTTP 设置路由继续使用既有 Settings Owner，不另增 API 或数据库表。

允许：新增 `general.cardMotionEffect`（`fluid`、`fade`、`lift`、`none`，默认 `fluid`），完善读取旧账户缺字段的默认值、Strict 校验和设置中心即时预览/自动保存/恢复默认；加入共享卡片与列表标记并注册首批应用卡片和 Minecraft 任务卡片；补充相关回归、包 README 与必要架构事实。本次效果采用 CSS transform/opacity/transition，不新增 JS 动画循环、依赖或 CSS 自定义属性。

设置：`general.cardMotionEffect` 存在 `user_settings` 的 `general` 分类中并按账户隔离；复用既有 `appearance.advanced.reducedMotion`（默认 system）作为更高优先级的无障碍约束，开启减少动态效果时压缩/停用卡片动效，不更改任何用户外观偏好。四种选择的标签和默认项来自共享设置合同；CSS 只负责把稳定效果 ID 映射到视觉实现。

验收：旧 general 记录缺少新字段时读为 `fluid` 且保留其他偏好；合法效果可由认证 Settings Owner 保存，未知值被拒绝；设置页选项使用可访问的单选语义并显示效果预览；切换效果即时更新工作台根映射与已注册卡片，刷新仍保留账户选择；默认/替代/静态三类效果及减少动态效果优先级在实际页面生效。覆盖桌面、窄容器和短屏，核对选项换行/可达、卡片无溢出且交互不受影响。运行直接设置合同回归、Settings/Client/Web 构建及 `git diff --check`；使用 ChatGPT 内置浏览器检查设置页与实际卡片，记录路由及视口；不修改真实业务记录，未测帧时间须明确列出。

实施记录：General 设置类型、默认项与稳定效果 ID 归共享合同；Settings Owner 兼容旧账户缺字段、保留旧客户端其他常规设置提交，并对显式未知值执行 Strict 拒绝。常规页展示四种预览，以单选语义和方向键切换，通过原自动保存持久化。Workbench 只映射账户选择；`ui-theme/common.css` 持有入场、悬停、静态和减少动态效果规则，应用中心与 Minecraft 任务卡片通过共享标记注册，卡片业务样式不重复定义动画。当前进入直接回归、构建及内置浏览器验收。

验证记录：`settings-contract.test.mjs` 1/1 通过（四个 ID、默认值、旧存储缺字段、旧客户端省略字段、非法值拒绝、账户隔离及重启持久化）；Client/Host `pnpm typecheck` 通过。`util-values`、Settings、`ui-theme`、`ui-settings`、`ui-layout`、Minecraft UI 六包构建，正式 Web（2260 modules）与 Control Plane 构建通过；`pnpm run sync:workspace` 后 `pnpm run check:workspace`（192 包）及 `git diff --check` 通过，产物均在根 `dist/`。

ChatGPT 内置浏览器实际打开 `/settings?section=general`（1280×720）：四种卡片动效预览和单选组可见，默认“柔和流体”可选；方向键由“柔和流体”切至“渐隐淡入”再恢复，工作台导航与卡片选择器在约 950px 设置内容容器内两列排布。实际任务页 `/apps/minecraft/normal/tasks` 显示最近 59 条记录、排队 0、执行 0；任务卡片详情在左、删除在右且没有横向溢出。未点详情/删除、未改真实任务。浏览器当前连接的是已运行的旧 Control Plane；它返回的 General 缺少新字段，自动保存本次被拒绝并显示“提交内容格式不正确”，所以浏览器未验证新服务的保存后刷新和实际效果切换；没有重启既有 LFAA/Daemon 进程。新 Settings Owner 的读取/兼容/持久化由上述隔离回归通过。≤620px 真机窄屏、减少动态效果在真实卡片上的切换、逐帧/帧时间和桌面设备未测。

<a id="lfaa-settings-dialog-motion-20261015"></a>

<a id="lfaa-settings-dialog-motion-20261015"></a>

## 78-设置弹窗动效-20261015

目标：将弹窗动效纳入设置中心“常规”的统一“界面动效”区，与卡片效果放在同一维护位置；卡片和弹窗分别选择效果，默认均为柔和流体，可单独改为渐隐淡入、轻盈上浮或静态。入口为共享 Web/Desktop 工作台中的 Ant Design Modal 与确认弹窗；浏览器原生 `window.confirm` 不属于可定制的产品弹窗。

Owner：`util/values` 持有共享效果 ID/说明、General 类型和默认值；`settings/settings` 持有账户设置兼容读取、Strict 校验及 `user_settings.general` 持久化；`client/ui-settings` 展示同一组效果选项；`client/ui-layout/Workbench` 将当前账户弹窗选择与减少动态效果偏好映射至 body（Ant Design Portal 所在层）；`client/ui-theme/common.css` 集中持有卡片与弹窗动画实现。复用原设置 API/分类，不新增存储表、端点或 UI 动画依赖。

允许：新增 `general.dialogMotionEffect`（复用 `fluid`、`fade`、`lift`、`none`，默认 `fluid`）；常规设置将原“卡片动画效果”整理为“界面动效”，卡片与弹窗分别呈现可访问的单选选项及适配目标的静态预览；旧账户或旧客户端缺少该字段时采用默认/保留已存选择。共享主题内以可撤销工作台映射驱动全局 Ant Design modal/confirm portal 动效，采用对称的 transform/opacity 入退场，不修改业务弹窗逻辑、确认行为、遮罩交互或真实数据；减少动态效果设置和系统偏好优先，不新增 CSS 自定义属性、JS 计时器、观察器、动画循环或依赖。补充 Settings 合同回归、受影响 README 与架构事实，保留所有既有工作树变更。

设置：使用账户常规 `general.dialogMotionEffect` 单独控制弹窗，卡片继续由 `general.cardMotionEffect` 控制，两者在设置页共用效果选项合同但保留独立选择；共同遵循现有 `appearance.advanced.reducedMotion`（system/on/off）和操作系统偏好。除非确有必要，不重置既有卡片/外观设置。

验收：旧 general 记录读出默认 `fluid`；旧客户端只提交其他 general 项时保留账户已选的卡片与弹窗效果；合法值可由 Settings Owner 保存、未知值被拒绝，并按账户隔离/重启恢复。设置选择在当前工作台即时驱动弹窗效果；覆盖默认、其他效果、静态与减少动态效果；在 ChatGPT 内置浏览器实开 `/settings?section=general` 和无副作用的设置页 Modal，检查常用桌面视口及本次变更相关的窄分栏/短屏可达性、设置预览与弹窗入退场，无横向溢出。运行直接 settings 回归、Client/Host 类型、Settings/UI Theme/UI Settings/UI Layout/Web 构建、适用工作区 Gate 和 `git diff --check`；说明实页保存是否受运行中旧服务影响。不开启可能改变用户数据的业务确认弹窗，不重启正在管理实例的服务；帧时间及真机未测时如实列出。

实施与验收：设置中心“常规 > 界面动效”以同一共享效果目录呈现卡片与弹窗两组独立选择；共享设置 Owner 负责默认、兼容读取、校验和账户持久化，Workbench 把弹窗选择及减少动态效果偏好映射至 body，主题样式集中维护 Ant Design Modal/confirm Portal 入退场。`settings-contract.test.mjs` 1/1 通过，覆盖两种效果各自和同时缺席的旧客户端提交、默认回退、合法/非法值、账户隔离及重启恢复；Client/Host 类型、util-values/Settings/UI Theme/UI Settings/UI Layout 五包构建、Web 与 Control Plane 构建、`check:workspace`（192 包）和 `git diff --check` 通过。ChatGPT 内置浏览器在 1280×720 实开 `/settings?section=general`，动效组完整可见，8 个选项两列排列；文档宽度与视口同为 1280px，无横向溢出。无副作用的许可证 Modal 实测 `fluid` 入场/退出、`lift` 入场及 `none` 静态（`animation: none`），并确认重载恢复默认值且关闭弹窗。已运行的旧 Control Plane 拒绝新字段自动保存，因此浏览器无法验证新服务的保存后刷新；未重启正在运行的服务。真实窄屏/短屏、系统减少动态效果实际开启、设备验收及帧时间未测。

<a id="lfaa-minecraft-task-details-cleanup-20261014"></a>

<a id="lfaa-plugin-workspace-sticky-cards-20261016"></a>

## 79-工作区固定卡片-20261016

状态：已由 [统一标签任务](#lfaa-plugin-manager-unified-tabs-20261017) 取代；此前圆角卡片方案不再作为当前目标（2026-10-17）。

目标：按用户截图，将插件工作区标题/分区标签与能力目录提示/标题做成两个圆角卡片；两张卡片放在 `/plugin-manager` 最外层插件分区容器中，位于独立设置内容盒子之外，目录/分区正文留在下面的内层内容盒子滚动。

入口与 Owner：实际入口 `/plugin-manager`；`packages/client/ui-plugin-manager` 装配独立设置工作区，`packages/client/ui-settings/src/SettingsPage.tsx` 与对应 CSS 持有工作区内容及样式；滚动继续归现有 `settingsContentScroll`。

设置盘点：不新增或修改任何设置；两张卡继续消费 Appearance 已有表面、圆角、模糊、颜色、字体/字号及减少动态效果令牌。

允许：修改 `PluginManagerPage` 的外层布局插槽、`SettingsPage` 的标题卡 Portal/滚动结构、对应样式、插件管理 UI 直接回归与本合同/任务索引；首卡包含工作区标题、说明、分区标签，第二卡只在能力目录分区包含 Owner 状态提示与“能力目录”标题。两卡必须挂到插件管理外层的卡片容器之外，成为外层分区与内容盒子的兄弟区域；内层工作区内容盒子只负责目录/分区正文滚动并继续复用 `settingsContentScroll`。禁止在内盒子里吸顶或覆盖滚动内容。窄/短视口要保持筛选、搜索和正文可见、可滚动。

禁止：改变能力目录数据、筛选/搜索语义、设置值/保存、其他工作区分区的业务行为、导航或滚动 Owner；不加请求、订阅、定时器或新配置；不重启服务、不覆盖工作树已有改动、不提交或发布。

验收：在内置浏览器 `/plugin-manager` 的能力目录中滚动到多类条目后确认两张卡占位固定、正文不会滚到卡片下方；筛选及搜索仍可用。检查常用桌面与窄/短视口，无横向溢出、卡片遮挡正文或键盘操作；运行插件 UI 相关回归、Settings UI/Web 构建、`check:workspace` 与 `git diff --check`。记录真实视口及未测帧时间/设备边界，不触发设置保存或 Runtime 操作。

<a id="lfaa-plugin-extension-workspace-ui-20261016"></a>

<a id="lfaa-plugin-extension-workspace-ui-20261016"></a>

## 80-插件扩展界面-20261016

状态：已完成（2026-10-16）。

目标：重新设计 `/plugin-manager` 的“扩展 / 运行时”内页，使其成为铺满工作区、层级清晰、密度均衡的插件管理界面；重点修复总览卡片错列、窄内容列与旧式设置行堆叠。能力目录、资料库、MCP、运行诊断保持同一套清晰的工作区排版。

Owner：页面及交互归 `packages/client/ui-settings` 中的 `SettingsPage`；账户 AI 扩展与 MCP 配置继续归现有 Settings Owner；能力/提示词清单、Cordis Runtime 与 Hooks 继续从当前运行时 Owner 读取。Profile 安装及生命周期不在本页复制实现，继续归 `packages/client/ui-plugin-manager` 与 Plugin Manager Owner。

设置盘点：沿用 `settings.plugins.enabled`、`settings.plugins.skillDirectories`、`settings.plugins.mcpServers` 与 `settings.computerControl.enabled` 的既有默认值、账户保存和权限语义；能力目录、运行数、Hooks 与宿主健康继续使用已加载的真实 Owner 数据。外观遵循已保存 Appearance 的主题、强调色、字体/字号、对比度、壁纸遮罩/透明度、模糊及减少动态效果令牌。不新增设置、默认值、持久化或 CSS 自定义属性。

允许：仅调整 `packages/client/ui-settings/src/SettingsPage.tsx`、对应 CSS、直接相关长期回归、`packages/client/ui-settings/README.md` 与本合同/任务索引；为工作区统一容器、页头、标签、概况、策略/目录卡片及其他分区提升视觉层级和响应式布局。保留全部现有数据来源、设置更新/失焦保存、MCP 配置操作、诊断和权限合同。

禁止：加入假插件、市场推荐、下载/使用量、虚构在线状态或假 Runtime 结果；改变设置默认值、保存时机、API、权限、插件生命周期或任何 Owner；重置用户偏好、触发真实 MCP/Runtime/Skill 配置写入、重启已有服务、提交或发布；覆盖工作树既有改动。

验收：桌面及窄/短视口中页头、标签和内容列对齐，三张概况卡均衡展示，配置操作清晰可达且无横向溢出；5 个分区保持可用并只显示真实数据；对比当前源码核实零新增请求/订阅/计时器，未测帧时间须明确报告。运行插件 UI 定向回归、Client 类型检查、UI Settings 与正式 Web 构建、`check:workspace`、`git diff --check`；在 ChatGPT 内置浏览器的实际 `/plugin-manager` 页面逐轮目视验收桌面及一处窄分栏/短屏视口，记录路由、尺寸、设置效果、截图证据及未覆盖边界，不点击会保存设置或改变 Runtime 的控件。

实施与逐轮验收：内页改为完整容器宽度；总览按真实登记能力、MCP 配置和 Cordis 运行快照显示三张均衡卡片，并将扩展开关、本机 Skill 目录改为独立设置卡。能力目录、资料库、MCP 和运行诊断共享改进后的标题/标签和容器布局；MCP 无配置时显示真实空状态和原添加入口。保留五个标签、现有更新/失焦保存行为、MCP 与 Runtime 动作及权限。资料库工具区在窄容器改为可达的单列按钮。未增加产品数据请求、订阅、计时器、观察器或 CSS 自定义属性；未改变任何用户设置，也未点击保存、添加 MCP 或 Runtime 操作。

设置与外观：继续使用 `settings.plugins.enabled`、`settings.plugins.skillDirectories`、`settings.plugins.mcpServers`、`settings.computerControl.enabled` 和真实 Owner 状态。界面消费原 Appearance 主题/强调色、字体与字号、表面透明度/模糊、文字/状态颜色令牌；减少动态效果偏好不受覆盖，未新增或重置设置。

验证：插件管理 UI 定向回归 4/4；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-settings build`、`pnpm run build:web`（2266 个模块）、`pnpm run check:workspace`（193 个包）与 `git diff --check` 均通过，构建产物写入根 `dist/`。`node scripts/runtime-build-state.mjs web` 仅返回 `host`；本轮未改 Host，也未重启现有服务。浏览器检查无帧时间/长任务测量。

内置浏览器：实际路由 `/plugin-manager`。默认视口 1355×925；临时复验桌面 1440×900、窄分栏/短屏 760×520 和手机 390×640，完成后恢复默认视口。三张卡在 760 宽度保持同一行且各宽约 195px；该视口文档宽 760、滚动区宽 640，未横向溢出。390 宽度文档宽 390、滚动区宽 308，资料库操作按钮各宽 282px，垂直滚动和操作可达；标签栏只在自身范围内横向滑动。五个分区均实际打开检查；能力目录 53 项、MCP 0 项、资料库 0 项和 Runtime 141/141 均为页面真实数据。现有暗色表面、壁纸、强调色正常显示。没有触发资料库写入、MCP 添加、设置保存或 Runtime 启停；实体手机、平板、桌面 WebView、主题/字号切换、真实服务重启和帧时间未测。截图在本轮内置浏览器验收画面中留存。

<a id="lfaa-plugin-capability-catalog-layout-20261016"></a>

<a id="lfaa-plugin-capability-catalog-layout-20261016"></a>

## 81-能力目录布局-20261016

状态：已完成（2026-10-16）。

目标：重点重排 `/plugin-manager` →「扩展 / 运行时」→「能力目录」中的真实能力条目。目录作为首要内容置于安装状态等次级区块之前；现有 53 项按 Agent、领域专家、提示词、技能等真实类别分组，改为清晰、可比较、适配工作区宽度的卡片网格；名称、完整说明、版本和来源均保留。

Owner：继续由 `packages/client/ui-settings/src/SettingsPage.tsx` 展示已加载的真实能力目录；不改变能力注册、安装路由、插件 Profile、MCP 或领域 Runtime Owner。

设置盘点：不新增或修改设置；继续消费已保存 Appearance 的主题、强调色、字体/字号、文字和表面令牌、壁纸遮罩/透明度、模糊及减少动态效果偏好。

允许：仅修改 SettingsPage 目录结构/样式、插件管理 UI 直接回归，以及本合同和任务索引。保留类型筛选、搜索、结果数、分类说明和所有真实能力字段；安装路由支持状态采用紧凑信息卡并后置。使用容器宽度响应式布局：宽屏三列、中等工作区两列、窄屏单列。

禁止：伪造/省略能力数据、截断必要说明、改变分类和排序事实、添加安装/启停动作或新设置；不写入账户设置、不重启服务、不提交或发布，并保留工作树内已有修改。

验收：确认 53 项仍来自当前真实目录；打开目录首先看到能力卡片；筛选与搜索可用；宽屏、窄分栏、手机宽度中卡片对齐、说明和来源可读、无页面横向溢出；次级路由状态卡清晰且不抢占目录首屏。运行插件 UI 定向回归、Client 类型检查、UI Settings/Web 构建、`check:workspace` 与 `git diff --check`；在内置浏览器 `/plugin-manager` 的能力目录实际检查桌面、窄分栏和手机视口。截图、视口尺寸、未测范围记录在本合同。

实施与验证（2026-10-16）：能力目录主清单前置；真实能力条目改为分类卡片，显示标题、完整说明、版本和来源；安装路由状态改为信息卡并后置。目录只渲染一份，保留真实分类、筛选、搜索与结果数。内置浏览器实际路由 `/plugin-manager`：默认视口 1355×925，另检查 1440×900、760×520、390×640；网格分别为 3/2/1 列，页面文档宽度与视口一致，无横向溢出；短屏主内容可垂直滚动。提示词筛选为 36/53，搜索“配置差异与验收”为 1/53，已恢复“全部 53/53”。桌面与平板卡片截图、手机滚动到能力卡片后截图均在本轮内置浏览器实页验收中检查。插件 UI 定向回归 5/5、UI Settings 构建、Web 构建（含 Client TypeScript 检查）、`check:workspace` 与 `git diff --check` 通过。未修改或保存任何设置；真实设备、桌面 WebView、帧时间/长任务未测；未重启服务、提交或发布。

<a id="lfaa-plugin-workspace-corner-radius-20261016"></a>

<a id="lfaa-plugin-workspace-corner-radius-20261016"></a>

## 82-工作区圆角-20261016

状态：已完成（2026-10-16）。

目标：按用户截图红框所示，为 `/plugin-manager`「扩展 / 运行时」的工作区内容外框增加统一圆角；圆角应包住内层滚动内容并处理顶部滚动条角，不改变卡片、目录或标签布局。

Owner：插件外壳继续由 `packages/client/ui-plugin-manager` 装配；共享设置面板样式由 `packages/client/ui-settings/src/SettingsPage.css` 持有。只调整独立插件工作区容器的外框样式。

设置盘点：不新增或修改设置；继续用既有 Appearance 表面样式和 `--settings-panel-radius` 圆角令牌。

允许：仅修改独立插件工作区外框 CSS 与本合同/任务索引。保留滚动、响应式布局、背景与内容。

禁止：改变能力目录条目及其布局、用户设置、导航/滚动 Owner、其他页面样式或任何运行中服务；不清理工作树既有改动。

验收：在内置浏览器 `/plugin-manager` 实页查看标注的左上/右上外框与滚动条角；检查默认桌面和窄视口无内容裁切或横向溢出；恢复默认视口。运行 Settings UI 构建、`check:workspace` 和 `git diff --check`；未测的设备及帧时间单独记录。

实施与验证（2026-10-16）：`.settings-page--plugin-standalone` 使用已有 `--settings-panel-radius`（14px），保持 `overflow: hidden`，使内层滚动区和滚动条顶角被圆角外框裁切。Settings UI 构建、正式 Web 构建（2266 个模块）、`check:workspace`（193 个包）和 `git diff --check` 通过；未重启服务。内置浏览器实际路由 `/plugin-manager`：默认视口 1355×925 与窄视口 760×520 均目视确认左上、右上为圆角，窄视口无横向溢出；完成后恢复默认视口。未新增/修改设置；实体设备、桌面 WebView 和帧时间未测。

<a id="lfaa-plugin-wallpaper-tab-lifecycle-20261016"></a>

<a id="lfaa-plugin-wallpaper-tab-lifecycle-20261016"></a>

## 83-壁纸分区生命周期-20261016

用户补充：`/plugin-manager` 中的“壁纸引擎”分区必须跟随当前 Profile 的真实 Plugin Manager 清单；对应 Wallpaper Engine 插件卸载后，标签和设置面板都不再显示。不能用设置偏好或固定页面标签冒充插件安装状态。

入口与 Owner：Web/Desktop 共用 Client 页面 `packages/client/ui-plugin-manager` 消费 `loadManagedPlugins()` 返回的 Profile 安装记录；Profile 清单及插件身份继续归 `packages/boot/plugin-manager` 和 `DshWallpaperEngineRuntime`。UI 仅以当前真实清单中可由该 Runtime 接受的 Wallpaper Engine 记录控制分区显隐；安装/卸载、Runtime 和 Profile 数据都不改。

设置盘点：本次仅读取已加载的 Profile 插件清单，不涉及设置中心配置，不新增或修改任何设置、默认值、持久化或用户偏好。

允许：修改 `PluginManagerPage.tsx`、该包的纯可测试可见性判断、README、插件管理直接回归以及本合同/任务索引。壁纸标签与面板同条件渲染；清单读到无匹配记录时隐藏，成功卸载后通过现有清单刷新消失；只接受当前 Wallpaper Engine Runtime 支持的稳定记录 ID、包名和 DSH v1 兼容记录。

禁止：调用真实卸载、安装、启停或改写 Profile/设置；修改 Plugin Manager Runtime/API/权限合同；重启现有服务、提交或发布、改动无关脏工作树。

验收：回归覆盖清单为空、真实 GitHub/NPM 记录和相似但不匹配记录；Client 类型检查、插件管理包与 Web 构建、`check:workspace`、`git diff --check` 通过。用当前真实页面核实当前 Profile 无壁纸插件时标签与面板均缺席；如无真实已安装样本，不伪造 Profile 数据，也不声称已实测卸载后的真实服务回读。

实施与验证（2026-10-16）：新增纯判断函数，只识别 Wallpaper Engine Runtime 所用的两个稳定记录 ID、包名和 `dsh-v1` 类型；“壁纸引擎”标签、面板及页头说明都由 Profile 清单同一结果控制。清单回读不再包含该记录时，选中分区也会退回 Profile 插件。没有改动安装/卸载、Runtime、API、权限或设置配置。

插件管理回归 3/3；`pnpm exec tsc --noEmit -p tsconfig.client.json`、插件管理包构建、`pnpm run build:web`（2266 modules）、`pnpm run check:workspace`（193 包）和 `git diff --check` 通过，产物写入根 `dist/`。在 ChatGPT 内置浏览器 `/plugin-manager`（1355×924）实页确认当前 Profile web 清单为 0 时只显示 Profile 插件与 AI 扩展/运行时两个标签，壁纸标签和面板均不存在，页头说明不再提壁纸引擎。回归覆盖两个 Runtime 记录 ID、空清单和近似身份拒绝。未实际卸载或构造已安装 Profile 样本，因此真实卸载回读及已安装时标签显示未在本次浏览器实测；未改动任何设置。

<a id="lfaa-plugin-ui-marketplace-20261016"></a>

<a id="lfaa-plugin-ui-marketplace-20261016"></a>

## 84-插件市场界面-20261016

目标：优化 `/plugin-manager` 插件工作区，使 Profile 插件清单、搜索、状态筛选和添加入口形成清晰、紧凑、可响应的管理界面，视觉参考用户提供的插件/技能目录截图。当前没有真实公共插件目录服务，不展示推荐插件、使用人数或虚构插件条目；空状态引导使用现有来源检查流程。

运行入口与 Owner：Web/Desktop 共用 Client 的 `apps/web` → `packages/client/ui-layout` → `packages/client/ui-plugin-manager`。UI 只负责插件清单展示、搜索/筛选与入口交互；来源解析、安装、启停和卸载继续归 `packages/boot/plugin-manager`、`packages/api/plugin-controller` 及 Permission Owner。AI 扩展与壁纸引擎表单/未加载回退归 `packages/client/ui-settings`。

设置盘点：继续消费 `permissions.mode` 的说明，以及外观设置的主题/强调色、窗口表面透明度、背景/壁纸、字体字号和减少动态效果共享映射；不新增或改写设置默认值、持久化和用户偏好。颜色、表面与排版沿用现有共享令牌。

允许：修改 `packages/client/ui-plugin-manager/src/PluginManagerPage.tsx`、对应 CSS、该包 README，以及 `packages/client/ui-settings/src/SettingsPage.tsx` 和对应 CSS、本合同与任务索引。新增仅基于真实插件清单的搜索和状态筛选；将现有来源表单由“添加插件”入口展开；重排实际清单和空状态；空清单时展示 GitHub/NPM/Host 三个现有来源入口卡，点击后预选来源并展开现有检查表单；改进插件卡片与 DSH Client 缺失提示的密度、对齐和响应式布局；让壁纸引擎状态按钮切回 Profile 插件清单。禁止：增加假目录/假数据/下载人数或新的插件能力；修改任何安装、权限、Runtime、设置 Owner、API 或 Profile 数据；改动 DSH/第三方仓库；重启现有服务、提交或发布。

验收：桌面、平板/窄分栏、手机/短屏下操作入口可见、滚动可用且无横向溢出；搜索和筛选只影响当前真实清单并能组合使用；来源入口卡只展开各自真实来源类型；三种来源仍由同一检查/安装逻辑处理；Profile 清单未安装时显示真实状态及添加入口；DSH Client 内容缺失时显示紧凑、可读且真实的不可用状态，按钮回到 Profile 插件清单；其他设置分区与权限行为保持现状。逐轮在 ChatGPT 内置浏览器检查真实 `/plugin-manager` 页面，再按截图修正；运行插件管理定向回归、Client 类型检查、受影响包/Web 构建、`check:workspace` 和 `git diff --check`。验收不触发真实插件安装、启停、卸载或设置写入；未测帧时间、真机、桌面 WebView 的范围需单独说明。

实施与逐轮验收记录（2026-10-16）：Profile 插件区改为真实清单优先，加入名称/描述/来源搜索、按真实状态筛选、收起式来源检查表单及 GitHub/NPM/Host 三个来源入口卡。来源卡只选择现有来源类型并展开同一表单，不提供假推荐条目。空清单显示 Profile 实际状态。壁纸引擎分区沿用 Settings Owner；DSH Client 设置页缺失时显示紧凑状态卡，“查看 Profile 插件”会切回 Profile 标签。沿用 Appearance 共享令牌、窗口表面透明度和减少动态效果；未增加设置，也没有改用户偏好。

直接回归 2/2；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-plugin-manager build`、`pnpm --filter lfaa-client-ui-settings build`、`pnpm run build:web`、`pnpm run check:workspace`（193 包）及 `git diff --check` 均通过，构建产物在根 `dist/`。在内置浏览器实际路由 `/plugin-manager` 逐轮验收：1440×900 桌面、760×520 窄分栏、390×640 手机短屏；清单与三类来源入口无横向溢出，窄屏可纵向滚动。390×640 首轮发现壁纸状态卡文案挤压，调整媒体规则顺序后复验通过；点击“NPM 包”来源卡只展开 NPM 表单，点击壁纸状态卡按钮回到 Profile 清单。当前 Profile web 实际插件数为 0，因此没有可用于实测非空清单搜索/状态筛选的真实样本；未触发插件来源请求、安装、启停、卸载或设置保存。帧时间、真机、桌面 WebView 和真实 DSH Client 设置内容未测；壁纸分区仍如实显示 Client 设置页未加载。

<a id="lfaa-cli-dsh-web-startup-alignment-20261016"></a>

<a id="lfaa-cli-dsh-web-startup-alignment-20261016"></a>

## 85-Web启动对齐-20261016

目标：让 LFAA 仓库内 `pnpm lfaa web` 采用与 DSH `pnpm dsh web` 一致的 TypeScript 源码 CLI 入口形态，并保留 LFAA 完整 Web 的构建产物、环境加载、数据目录迁移和本机 Daemon 监督行为；菜单启动与直接 CLI 启动均检查当前数据目录写锁，只结束身份可确认的 LFAA Web 进程，再启动新 Web。无法确认锁持有者时继续拒绝启动。

运行入口：DSH 只读参考为 `pnpm dsh web` → `node --import tsx/esm apps/cli/src/bin.ts web`。LFAA 目标入口为 `pnpm lfaa web` → `node --import tsx/esm --import ./apps/cli/register-package-loader.mjs apps/cli/src/bin.ts web` → Windows 数据锁预检 → 共享 LFAA CLI 运行器；菜单先核对/构建 Web 与控制端，再通过同一 CLI 入口启动。既有开发进程 `src/index.ts --profile web` 需在过渡期可识别。

Owner 与配置：CLI 启动逻辑归 `apps/cli`，配置写锁继续归 `packages/storage/storage-json` 的 `FileLease` 与 `packages/storage/storage-domain`；菜单只协调同一 LFAA 数据目录下可确认的 Web 进程。复用现有 `.env`/进程环境解析出的 `LFAA_DATA_DIR`，不涉及设置中心。

允许：增加 LFAA TypeScript 源码 CLI 转发入口并调整根 `lfaa` 脚本；新增源码 CLI 调用的 Windows Web 锁预检脚本，对已发布 CLI、DSH 风格 LFAA 源码 CLI 与既有开发 Web 入口精确识别；增加隔离的 PowerShell 回归；更新 CLI README、本合同与任务索引。

禁止：修改 `FileLease` 锁协议、数据目录、用户数据、Daemon/桌面生命周期或其他菜单模式；不按端口单独识别或结束进程；不结束 DSH/其他无法确认的 Node 进程或整个进程树；不重启当前真实 Web/Daemon/Minecraft 服务作验收。

验收：`pnpm lfaa web` 从 `apps/cli/src/bin.ts` 进入且保留现有 LFAA 启动器行为；菜单和直接源码 CLI 启动都经过该入口并运行同一锁预检；打包 CLI 与源码 Web 进程均可被锁预检识别，DSH `apps/cli/src/bin.ts web`（无 LFAA 包解析器）和其他 Node/Profile 均不匹配。结束前仍复核锁 PID/identity、进程命令行和创建时间，锁变化时中止。Pester 回归、PowerShell AST、CLI 帮助启动、CLI typecheck 与 `git diff --check` 通过；不终止本机当前真实 PID。

实施与验证记录：根 `pnpm lfaa <组合>` 现在从 `apps/cli/src/bin.ts` 进入，再转交源码与 npm 共用的 CLI 运行器。Windows Web 源码入口先调用 `scripts/lfaa-web-startup-preflight.ps1`；菜单也经同一 CLI 路径启动。预检复用权威数据目录解析，二次核对锁 PID/identity、完整命令行和进程创建时间后，只结束匹配的 LFAA Web PID；无法确认的锁持有者继续阻止启动。未改存储锁协议、运行数据、设置或 DSH 源码。

最终验证：Windows PowerShell Pester 回归 3/3；PowerShell 5.1 在隔离的无锁目录执行预检通过，相关脚本 AST 无错误；`pnpm run lfaa web --help`、`pnpm --filter @yubboo/lfaa typecheck`、`pnpm run check:workspace`（193 包）和 `git diff --check` 通过。没有启动或终止当前真实 Web/Daemon/Minecraft 进程，因此实际旧 Web 结束与重启尚未现场验收。

<a id="lfaa-plugin-install-sources-20261016"></a>

<a id="lfaa-plugin-install-sources-20261016"></a>

## 86-插件安装来源-20261016

目标：参考 DSH 插件管理器的三类来源输入（包名/版本、GitHub 仓库、本机 Host 绝对路径或本地归档），扩展 LFAA 插件检查与安装凭证，让用户可从通用插件管理区检查真实来源与 Runtime 兼容性。保留现有 `capability_*` 检查、安装、列表、启停和移除闭环；来源安装后不得自动执行依赖脚本或导入未受支持的 Host/Client 代码。

Owner：来源解析、不可变版本/内容摘要、Profile 清单、安装事务、Runtime 状态、启停和移除均归 `packages/boot/plugin-manager`；跨类型工具与一次性检查凭证归 `packages/boot/capability-installs`；认证、用户授权与传输归 `packages/api/plugin-controller`、Permission Owner，Client 调用归 `packages/client/connection`，管理界面归 `packages/client/ui-plugin-manager`，全局入口与路由归 `ui-sidebar`/`ui-layout`。启停按钮通过受保护 API 直接调用同一 Plugin Manager 生命周期 Owner，由 Permission Owner 将该次明确点击作为单次用户授权；自然语言启停仍交给 Agent Core Tools 按当前 `permissions.mode` 审批和执行。安装与卸载按钮继续交给小鱼 Agent。不得新增第二个权限 Owner。

设置盘点：安装按当前 LFAA Profile 保存到独立 `LFAA_HOME/plugins`；插件用户私有运行数据按原 Owner 保存到 `LFAA_DATA_DIR/plugins/runtime-data`。管理员角色、`permissions.mode` 及现有账户/App 范围继续生效。`plugins.enabled` 只控制账户 AI 扩展，不改变 Profile 插件安装或 Runtime 状态。本轮不新增设置、不修改偏好默认值；UI 沿用所有适用 Appearance 共享令牌。

允许：Plugin Manager 来源解析、兼容的清单读取迁移、API/Client 检查合同、独立插件工作区三种来源输入与实际状态展示、安装/卸载通过 Agent Tool 流程提交；启停按钮经 Permission Owner 对用户本次明确点击授权后直接调用生命周期 API；全局导航入口；原设置中心 AI 扩展、Skill 目录、能力目录、资料库、MCP 配置、Cordis Runtime 启停/重建诊断及 DSH 壁纸引擎 Slot 原生设置整体迁入该工作区，设置中心不再显示插件、MCP 或壁纸引擎插件分类。相关表单继续复用原 `ui-settings` 配置 Owner。拒绝：复制 DSH Bundle Runtime、未经适配在 LFAA 控制端加载第三方 Host/Client、绕过管理员/Permission Owner 或安全归档检查、将本机客户端路径误当 Host 路径、覆盖运行数据、重启已有服务、提交或发布。

验收：三种来源分别在安装前固定 Git commit、精确 NPM 版本及完整性摘要、或 Host 本地文件内容摘要；检查/安装凭证绑定用户、类型、App、来源与摘要，过期/内容变化时拒绝安装。目录和归档路径、文件类型、压缩展开、数量与字节上限均校验；安装原子提交且失败不留半成品。实际兼容 Runtime 才可启停，停用/移除完整等待清理；自然语言 Agent 工具回读真实安装与运行状态，手动启停按钮不创建 AI Work 请求并由 Permission Owner 授权后回读同一 Owner 状态。管理页须位于全局最左导航，主工作区独立展开；列表展示真实状态并提供启用/停用/卸载，来源页支持 NPM、GitHub、Host 绝对路径；所有写入仍经过 Permission Owner 与 Plugin Manager Owner。Settings Center 不再包含第三方插件管理入口。UI 在真实 Web 页面检查桌面与窄/短容器；报告直接回归、受影响构建、类型、工作区与浏览器结果及未验边界。

实现与验收记录：Plugin Manager 已支持 GitHub 固定提交、官方 NPM 精确版本与 SHA-512 SRI、LFAA Host 绝对目录/归档 SHA-256 快照；本地输入不读取浏览器设备文件。所有来源共用安全归档解析、大小/文件数限制、凭证重验和原子安装。Inventory v4 保存来源类型并迁移 v1-v3；现有 Capability 工具继续持有检查、安装、列表、启用、停用和移除，统一按当前 `permissions.mode` 执行。只有已适配 Wallpaper Engine Runtime 可以实际启停；未接入的 DSH Bundle 保持隔离。没有新增设置，也没有触发真实插件安装、启停、卸载或设置保存。

最终验证：插件管理 UI、Plugin Manager 与 Capability 安装定向回归 19/19；`pnpm run typecheck`、工作区同步/检查（193 包）、`pnpm run build:web` 和 `git diff --check` 均通过。第一次浏览器实页发现 ui-plugin-manager Client Module 未登记，已在 `client/web` 包显式依赖并装配，重建后 `/plugin-manager` 正常渲染。构建产物位于根 `dist/`；当前 Web 构建 SettingsPage chunk 312.57 kB（gzip 76.06 kB）。测试验证三类来源校验、启停/卸载目标合同及凭证重验；没有真实插件安装/启停/卸载、外部运行时/设备或帧时间测量。

内置浏览器：实际路由 `/plugin-manager`；桌面 1440×900 和窄短屏 390×640。桌面主区域占满视口，插件清单显示真实 Runtime 的 enabled 状态及停用/卸载入口，三种来源输入可见；AI 扩展/MCP 与壁纸引擎插件分区可通过工作区标签打开。两视口文档宽度分别为 1440 和 390，无横向溢出。返回 `/settings?section=general` 实测侧栏不再显示插件、MCP 或壁纸引擎插件分类。未测实体手机/平板、真实安装与生命周期执行及浏览器帧时间。

<a id="lfaa-wallpaper-engine-appearance-owner-bridge-20261016"></a>

<a id="lfaa-wallpaper-engine-appearance-owner-bridge-20261016"></a>

## 87-壁纸外观接入-20261016

目标：把已适配的 DSH Wallpaper Engine 外观扩展点接到 LFAA 对应工作台表面。用户选择并运行插件壁纸时，插件 Profile 中的配色、玻璃颜色/保真度/透明度、模糊、边框及各表面独立配置是对应区域的唯一外观 Owner；插件 Runtime 不可用/停用或未运行壁纸时，对应区域回到 LFAA 账户 Appearance 偏好。主题仍通过 `ctx.theme.setTheme` 保存到 `appearance.theme`；字体角色继续通过 `ctx.theme.overrideTokens` 与既有受限映射生效。插件值不复制写入 LFAA 设置。

Owner：DSH `ctx.theme` 兼容合同归 `packages/client/ui-theme`，工作台插件运行态及账户 Appearance fallback 归 `packages/client/ui-layout`，具体聊天表面归 `packages/client/ui-chat`；Profile 外观值仍由 Wallpaper Engine Plugin Manager/runtime-data 与插件自身设置 Owner 持有。LFAA 使用 DSH Client 在 `body` 上公布的 `--we-*` 运行时值与 `data-we-*` 门控作兼容输入，不改第三方插件源码，不复制 DSH Runtime 或设置持久化。

设置盘点：插件活动时映射 `--we-accent`、`--we-glass-alpha`、`--we-blur`、`--we-surface-tint-*`、`--we-readability-*`、`--we-border-alpha`，并尊重 `data-we-glass-window`、`data-we-glass-chat`、`data-we-left-sidebar`、`data-we-sidebar-glass`、`data-we-glass-floaters` 与相应逐面变量；LFAA 的 `appearance.accentColor/sidebarColor/overlay/blur` 等只作为 Runtime 停用后的 fallback，主题、字体/字号、对比度、减少动态效果及无插件对应项继续由既有 LFAA 设置控制。不增加配置、默认值、持久化或额外请求。

允许：WorkBench 主题/表面值映射、插件门控覆盖、相关长期回归、包 README 与系统架构合同。禁止：改动用户 Profile 插件数据、同步复制插件配置到账户设置、重置用户偏好、重启服务或运行实例、修改上游 DSH/第三方插件仓库。样式只在实际壁纸 Owner 生效，并由已有插件 body token 即时更新；插件停用清理后立即回落账户值，不增加观察器、轮询、请求或无界状态。

验收：内置浏览器 `/work` 在桌面和窄/短视口确认实际计算样式与插件当前颜色、透明度、模糊、边框一致；插件每个表面开关关闭时 LFAA 对应表面不再保留该插件的玻璃效果；卸载/停用插件后清理 `--we-*`/`data-we-*` 并恢复 LFAA 原外观，刷新首帧没有 LFAA 值闪现后再切换插件值。直接相关回归、类型、包/Web 构建与 `git diff --check` 分别报告；实际停用 Profile 插件、播放媒体、真机与帧时间未测时不得宣称通过。

手动启停交互修正（2026-10-16）：插件卡片的“启用/停用”按钮改为调用认证后的 `/plugins/:pluginId/lifecycle`，服务端由 Permission Owner 校验本次显式点击和 App/插件/来源版本范围，再调用 Plugin Manager 同一生命周期 Owner；不创建 AI Work 请求或聊天消息。用户在聊天中用自然语言启停时仍由 Agent Core Tools 按当前权限模式执行；安装与卸载继续走小鱼 Agent。定向回归验证真实隔离 Runtime Adapter 的启动/停止和状态回读、未调用 Agent、管理员/认证/App/来源版本边界及错误状态。20/20 定向测试、`pnpm run typecheck`、`pnpm run sync:workspace`、`pnpm run check:workspace`、`pnpm run build:web`、`pnpm run build:control-plane` 与 `git diff --check` 通过，构建产物均在根 `dist/`。内置浏览器 `/plugin-manager` 桌面 1771×1244 实页显示新的“按钮直接执行、聊天仍由 Agent 处理”说明；没有点击真实 Profile 的壁纸插件按钮以保持用户状态不变。当前 CUA 无视口尺寸控制能力，未能实测窄/短视口；也未测帧时间、真实外部插件和桌面/Daemon 运行态。

停用后外观回退修复（2026-10-16）：此前修复了插件停止后 LFAA 账户背景恢复，但只核查了画布 Owner 与部分 Slot/theme 生命周期，没有完成插件各项外观设置到 LFAA 自有组件的扩展点对账。当前补充的 Appearance Owner Bridge 才将 DSH Profile 的 `--we-*` 令牌和 `data-we-*` 逐面开关映射到 LFAA 共享主题、设置面、聊天和侧栏；停用/未运行时撤销此映射并回到账户 Appearance，用户偏好不清空、不覆盖。

验收：壁纸画布归属/生命周期定向回归 5/5；DSH Runtime Adapter 生成与 Host 启停定向用例 2/2；`pnpm exec tsc --noEmit -p tsconfig.client.json`、ui-layout 包构建、`pnpm run build:web`、`git diff --check` 通过，产物写入仓库根 `dist/`。完整 `dsh-wallpaper-engine-runtime.test.mjs` 为 2/3：另 1 项原有主题/语言通知断言期望 `en-US`、实际收到空数组，失败点在本次触及范围外的 locale 通知；未改该行为。ChatGPT 内置浏览器 `/work`（1771×1244）实页可见账户已选的“雨后草原”背景和 DSH 工作区；本次没有再点真实插件启停按钮改变 Profile。真实停用瞬间切换、窄短视口与帧时间未测。

DSH 外观值对齐补正（2026-10-16）：继续对照只读安装版插件的实际样式规则，LFAA 聊天直接读取插件生成的 `--we-chat-glass-fill`；设置面、左右侧栏和浮层按 DSH 逐面 Alpha/混色权重及 `blur + saturate + brightness + contrast` 配方接入。深色右侧栏使用 DSH 面板的 65% 玻璃色权重；插件定义的色彩、左栏/侧栏/窗口/浮层门控仍各自独立。Profile 外观值仍只通过运行时 CSS 令牌读取，不改插件/Profile 设置，不增加请求或状态订阅。

本次验收：定向回归 7/7、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-theme`/`ui-layout`/`ui-chat` 包构建、`pnpm run build:web` 与 `git diff --check` 通过，Web 产物位于根 `dist/apps/web/`。ChatGPT 内置浏览器 `/work` 桌面 1771×1244、窄分栏 760×520、窄屏 390×640 与 `/settings?section=appearance` 桌面实页均已检查；工作区计算样式跟随 Profile 当前 `#F1717F` 强调色、0.2125 玻璃 Alpha、23px 模糊及聊天玻璃填充，窄视口无横向溢出。用户 Profile 插件未实际停用/启用以避免改动运行状态；停用后的真实瞬时回退、刷新首帧闪烁、播放媒体与帧时间仍未测。

<a id="lfaa-ekko-capability-fusion-core-20261016"></a>

<a id="lfaa-ekko-capability-fusion-core-20261016"></a>

## 88-Ekko能力整合-20261016

目标：按用户明确的商用、自主实现方向对账 Ekko Studio 全部产品能力并声明参考来源，逐项融合进 LFAA。先验证原有文件/Shell/Git/项目与独立 Agent 能力，再补齐前台等待、后台子任务、结果回收与持久化，作为编程协作核心第一项。后续独立 Coding Agent 调度及工作台、多运行时聊天/群聊/工作流、工作树协作、成果 Skills、自定义模板逐项验收；不得以路线文档宣称全部融合完成。

Owner：原 Agent Loop 持有主/子 Run 与预算/范围，Subagent Manager 持有驱动与活动任务，tool-subagent/control 持有委派和查询工具，Session Owner 持有任务来源/结果记录；项目/Git、Shell、文件、模型、记忆、Skills、权限复用原 Owner。禁止建立第二套运行时、Session、身份或权限。参考清单和来源声明见本轮融合文档；不复制 BSL 受限源码、UI 或提示词到商用产品，第三方 Skills 逐文件核验许可后再单独接入。

设置盘点：沿用 Provider 激活模型、aiRuntime.subagentAccountId（空继承主模型）、maxSubagents（默认 4，上限 16）、maxDelegationDepth（默认 2）、模型/工具/请求/上下文/命令预算，plugins.enabled/skillDirectories、general.followupBehavior/taskFolder/integratedShell，permissions.mode；UI 验收沿用全部适用 Appearance 和暂停/继续控制。不新增权限模式、模型降级或用户偏好重置。前台/后台是本次委派参数，预算仍来自设置中心。

允许：直接相关核心/子 Agent/Session/工具/API 合同与长期回归，受影响包依赖/README，融合清单/声明和架构计划。现有工作树和 ekko-studio（包含既有 docs/openapi.json 修改）保留；上游只读。真实验收使用用户指定账户登录，凭据仅作会话内登录，不写入文件、日志、测试夹具或提交。真实项目验收使用新建的隔离任务目录，不覆盖用户工作或运行实例；不提交、不发布，不重启会影响游戏实例的进程。

验收：后台委派及时返回真实任务标识，父 Run 正常结束后子任务继续；前台等待终态；查询/等待回收真实答案并按账户/来源隔离，取消、失败和重启中断不伪装成功。数量/深度/工具/模型/计划限制不能因后台执行绕过；暂停/停止及卸载撤销监听器和执行资格。记录真实编程任务的读取、修改、执行、差异、测试与修复证据；直接回归、相关构建、Client/Host 类型、workspace Gate 和差异检查分别报告。涉及 UI 再按内置浏览器要求验收桌面与窄短屏；真实 Provider、节点、外部 CLI、手机/桌面及帧时间分别标明。

实页发现并纳入同一核心范围：确认非零退出的测试命令在源码修复后被防重拦截。Shell Owner 使用原 retryAfterRecovery 合同，仅允许新的成功写入之后由模型再次选择确认失败的命令；未知结果仍不重放，认证、审批、预算和成功副作用防重保持。补充真实 Shell 失败→修复→重验以及超时→修复→拒绝重放的长期回归。

第一项实施：已接通 in-process 前台/后台、结果查询/等待、原 Session 持久化、账户/来源和取消/中断边界；直接新回归最终 3/3，其余 Loop/Session/Harness 17 项通过，类型、相关包/Control Plane/Web 构建、192 包 workspace 检查和差异检查通过。指定账户已保存 DeepSeek 模型在实际受管 Worktree 完成项目读取、2/6 复现、后台只读审阅、仅一文件修复、6/6 验证及结果回收；维护者独立测试和 diff 相符。仅重载本轮启动且无活动任务的服务，保留验收会话/项目/工作树和原草稿。全范围迁移仍继续按优先级登记，独立 Coding 主运行时/工作台等未宣称完成。逐文件、设置、真实验收及未测范围见 [第一项交付记录](development/ekko-fusion-core-20261016.md)。

<a id="lfaa-application-panels-templates-20261016"></a>

<a id="lfaa-application-panels-templates-20261016"></a>

## 89-应用面板模板-20261016

目标：应用作为系统内的传统操作与成果管理面板；理解目标、编程、委派与对话统一由 `/work` 智能体工作区承担。用户确认未来自定义模板同时覆盖成果（文档、代码项目等）和应用面板。本轮清理当前面板中的旧 App 专属 AI Work 展示，记录模板目标与尚未实现的范围；不把产品方向确认写成模板引擎已交付。

Owner：应用/工作区域组合归 `client/ui-workspace`；作品信息归 `client/ui-writing`，业务数据仍归 Writing 等原领域服务；能力目录请求归 `client/connection`。Agent Loop、Session、权限、项目与文件继续使用原 Owner，不另建 App 级 Agent 或模板执行器。模板架构及后续验收见 [应用面板与模板目标](development/application-panels-templates.zh.md)。

设置盘点：不新增配置。保留 `general.navigationLayout/showServiceStatus/showBottomPanelControl/terminalPosition`、现有快捷键、`plugins.enabled/skillDirectories` 与写作已保存偏好；外观复用主题、颜色、字体/字号、对比度、壁纸、遮罩透明度、模糊和减少动态效果映射；操作继续受 `permissions.mode` 及原账户/项目/节点合同约束。

允许：清理应用外壳中的 Agent 专属展示与无用请求，将写作侧栏收敛为作品信息；维护相关 README、架构/计划和本合同，执行直接回归、构建、差异及 workspace 检查。禁止：删改用户数据、覆盖无关工作树、移除领域工具/服务、建立第二套权限/Session、向产品加入假模板/示例成果、重启既有服务、提交或发布。本轮不实现模板 CRUD、动态面板运行时或生成发布。

验收：普通应用不显示主/子 Agent 配置、会话模型、App 专属 AI Work 切换与 Agent 能力资源目录；写作保留当前作品/章节、保存说明和现有编辑器；共享工作保留能力发现、聊天、侧聊、Git 与原工具。与面板无关的能力目录不请求，离开消费目录的区域时取消请求。直接回归、受影响包/Web 构建、类型与 workspace Gate 分别报告；内置浏览器检查真实工作/应用页面桌面与相关窄/短容器，记录路由、视口、截图及未验范围。模板两种目标、实例与模板分离、真实服务绑定、自定义与版本要求标为后续目标。

实施与验证：普通面板移除 Agent 能力目录及未接入的审查/浏览器占位；目录仅在共享工作读取，退出取消请求，默认并发读取合并保留。写作信息和原作品 Skill 管理从旧 ai-work UI 迁入 normal 模块，移除 App 专属会话/模型与模式切换；服务端作品角色和数据不变。请求回归 10/10、共享入口/会话回归 4/4、Client/Host 类型、Connection/Writing/Workspace 包构建、正式 Web 构建、workspace Gate 和差异检查通过；Web 指纹检查返回空过期列表。内置浏览器在隔离账户检查 `/work`、`/apps/writing/normal`、`/apps/connectivity/normal`，覆盖 1300×720 桌面与 760×520 窄短屏，作品新建、保存和刷新恢复通过。真实 Provider、多 Agent 模板生成、远程节点、桌面/手机和帧时间未测。逐文件路径、性能边界、截图及清理记录见 [交付记录](development/application-panels-20261016.md)。

<a id="lfaa-ai-work-composer-slash-mention-20261015"></a>

<a id="lfaa-plugin-lifecycle-session-responsive-20261016"></a>

## 90-插件管理与会话布局-20261016

目标：严格对照 H:/ai/deepseek-harness 源码的 npm、Git/GitHub、本地绝对路径三种安装方式，逐项验收最新 Wallpaper Engine 的检查、下载、安装、启停和完整卸载；修复会话/最近列表的三点菜单（Web）及桌面右键菜单；修复 760×520 窄短容器的工作区遮挡。

Owner 与范围：Plugin Manager 负责来源、安全展开、清单、运行副本和插件数据清理；API/Connection/UI 复用此 Owner 和 Permission Owner，实现明确点击的真实安装/卸载，智能体继续调用原能力工具。Session/Workspace 原 Owner 持有会话操作；共享 Client 列表菜单与 ResizableWorkbench 持有交互/几何，不增加第二套会话/权限/Runtime。允许修改上述直接相关实现、消费者、README、长期回归与事实文档；保留既有脏工作，上游只读。不提交/发布、不操作真实游戏、不清理无关数据。

设置盘点：沿用 permissions.mode、plugins.enabled（AI 扩展开关，与 Profile 生命周期分开）、general.navigationLayout/showServiceStatus/showBottomPanelControl/terminalPosition、shortcuts、现有布局持久化；appearance 的主题/颜色/字体/字号/对比度/壁纸/遮罩/模糊/减少动态效果经共享令牌继承；壁纸选择沿用 appearance.wallpaperEngine。默认值、校验及持久化归 Settings，不重置偏好。安装、启停、卸载显式动作经统一权限 Owner，保持管理员/来源版本/账户验证。

验收：实时对照官方 npm latest 与 GitHub 默认分支，不读取本项目旧快照冒充远端下载；分别实装启用并检查 Host/Client，卸载后核对源码、适配副本、插件私有数据和清单，保留 LFAA 外观设置及用户 Steam 内容。直接相关回归、类型、构建、workspace Gate 与差异检查；内置浏览器实页桌面、760×520 及窄屏，三点菜单可达，桌面右键与未测设备明确区分。记录失败及修复过程，不以来源 ID/相同提交/登记成功替代功能证据。当前未发现运行中的 3000/3001 服务，可启动本轮服务用于验收；既有服务不得擅自重启。

补充范围：Git API/归档传输不可用时使用官方 Git 传输解析当前引用；运行依赖交由 pnpm 解析，移除重复的手写依赖解析器；本地兼容包按内容摘要检查后进入同一生命周期。允许增加本包受限包管理进程辅助；临时检出只在根 dist/.tmp，完成清理，不读取其他项目旧安装替代远端来源。

<a id="lfaa-auth-transition-refresh-stability-20261017"></a>

<a id="01-插件化架构-20261017"></a>

## 91-插件化架构-20261017

状态：已核对 DSH 源码及用户 `.dsh` 安装目录；扩展核心实现已覆盖 Provider Service、必需行实现替换、Plugin Manager 9 类 Slot 与共享 Appearance 修正。通用主题包和外部插件 Runtime 的能力边界、以及实页验收仍未完成；全量目标保持进行中（2026-10-17）。

目标：按用户要求全面对照 `E:\lfaa1\deepseek-harness` 的 Harness 插件方法，把 LFAA 的产品能力做成可组合、可替换、可撤销、可诊断的插件/能力包。覆盖 Profile/Bundle 装配、Cordis 服务与事件 seam、LLM Provider 和工具/Skill/Prompt/Expert、Client Slots、主题与外观、插件管理器、应用/节点能力及其配置与生命周期；不以“模块已登记”代替真实实现。建立逐项 DSH → LFAA → 缺口/适配 → 消费方证据矩阵，先补可复用的核心注册合同，再逐批迁移实际存在硬编码且影响用户替换的 Owner。

DSH 只读参考：`E:\lfaa1\deepseek-harness`；用户安装实例只读参考：`C:\Users\Administrator\.dsh`。逐项源码/安装状态记录见 `docs/development/dsh-lfaa-extension-audit-20261017.md`。依据 DSH 根/包级合同、Profile 清单与 Patch、Plugin Manager 安装事务、Cordis Service/Consumer、Fiber 清理、Provider Adapter、Theme Token 与 Plugin Manager Slot 实现。DSH 的方法包括：有序 Profile/Bundle 与多层 Patch 替换完整配置；包间通过 Service Definition/Provider/Consumer 和类型化事件 seam 协作；Cordis 注册、监听和资源由插件 Fiber 清理；模型适配器按 Provider ID 注册且重复冲突失败；Theme 以有限 Token 合同叠加并可撤销；UI 只消费已声明的类型化 Slot；扩展合同由真实 Owner 实现，而非复制 Host 业务规则。

入口与 Owner：运行组合和 Cordis Loader 归 `packages/boot/app-boot`；外部来源、快照、清单、启停和卸载归 `packages/boot/plugin-manager` 与统一 Permission Owner；模型账户、密钥、设置与连接元数据归 `packages/settings/settings`/Credentials，模型协议执行归 `packages/llm/llm`；AI 能力目录归 `packages/core/agent`；前端全局令牌与主题归 `packages/client/ui-theme` 和 Workbench，组件消费归 Client 包；槽位声明唯一归 `packages/client/ui-renderer`，贡献消费归所属页面包。新增/替换能力必须沿此调用链登记，不允许隐藏第二份 Provider、Theme、设置或权限事实。

当前源码基线：LFAA 已有 Profile→Bundle Patch→Profile Patch→Host Patch/显式 Patch 的有序装配、Cordis `ctx.effect` 生命周期、AI 扩展/Hook/Skill/Tool 登记、多个领域 Provider Registry、全局 3 类 DSH Client Slot。本轮已补齐 Plugin Manager 9 类 Slot 的声明/注册/真实消费；必需插件 ID 可换实现但不能禁用；Provider 目录与 LLM 请求统一为 Fiber 可撤销的注册服务，主回答、摘要、分支记忆与回复后记忆使用同一 Adapter Owner；根 Ant Design Token 与 AI Work 光标改读共享外观令牌；新账户背景遮罩默认提高到 65%，不改写旧账户显式保存值。仍有实际差距：通用主题包注册/选择及服务端持久化尚未实现；任意外部第三方插件没有可安全替换的通用隔离 Host API/Runtime；官方 Wallpaper Engine 仍是固定来源专用适配；其它页面类型由各自 LFAA Owner 提供，不能因管理器 Slot 存在就声称通用运行时全部插件化。完整矩阵与 `.dsh` 安装核查见上述审计文件。

设置盘点：模型使用现有 AI Provider 账户、模型目录、推理力度、`aiRuntime` 请求预算和超时；凭据继续由 Credentials/Settings 加密持有。外观使用 `appearance.theme`、强调色/分模式颜色、侧栏色、壁纸、遮罩（新账户默认 65%，不覆盖旧账户值）、模糊、透明度、字体/字号、对比度、减少动态效果、指针和动效偏好；通用主题包控制若需用户选择，必须先接入设置中心、校验与保存、共享 Token 和主题回退，保留所有现有偏好。存储分别归 LFAA `LFAA_HOME`（插件安装与受控运行适配文件，默认 `%USERPROFILE%\\.lfaa`）和 `LFAA_DATA_DIR`（用户数据，默认 `LFAA_HOME/data`）。数据位置可自定义并支持系统复制、用户手动复制后检查切换、ZIP 备份导入三种迁移方式；安装包与插件包不因更改数据位置而迁移，运行期用户私有数据仍随数据根迁移。DSH `DSH_HOME` 与 LFAA 两个 Owner 不合并同名目录。LFAA 单改数据根不代表 DSH_HOME 已迁移；若目标包括独立 DSH Home，须补齐 DSH 启动变量和双根复制/回滚验收。插件安装/启用/卸载继续沿现有管理员、认证与 Permission Owner，不新建权限模式或旁路。

允许：修订 Profile Patch 必需包替换规则但保留必需服务装配校验；把 LLM 调用统一改为注入的 Service；建立真实可注册/可撤销的 Provider/Theme 扩展合同和真实消费者；为数据型自定义模型/主题接入必要设置、持久化、服务端校验与 UI；修复 Ant Design 与共享 Appearance Token 的硬编码映射；增加 Plugin Manager 实际有消费者的扩展出口、合同文档和长期回归；更新各 Owner README、架构、开发计划和本合同。每批列出运行入口、Owner、Settings、验收条件，立即跑定向回归/类型/包构建并逐轮检查实际 UI。

禁止：修改 DSH 仓库；执行、安装、启停或更新第三方插件；把任意第三方代码加载进控制端/Client 主 Realm，或在未建立可撤销隔离 Runtime/受控 Host API 前放开现有隔离边界；绕开账户身份、数据归属、密钥隔离、参数校验和统一 Permission Owner；增加无法独立替换或没有实际消费者的空插槽；改用户偏好、运行数据、现有服务状态；未实测不得报告通过。

验收：差距矩阵覆盖上述每个 DSH 架构层并以源码 Owner/Consumer 为证；Provider 选择与 completion 均由可撤销 Adapter Registry 服务唯一驱动，模型账户、探测、测试、推理路径一致；主题令牌只能按受限类型合同贡献、可即时选用并在卸载时回退，所有 Client/Ant Design 表面消费 Appearance Owner；Profile 必需能力可替换实现且启动组合校验仍确保服务存在；外部插件能力如未由 Runtime/Host API 真正接通，显示隔离/不可用真实状态。所有改动运行直接相关长期回归、受影响包/入口构建、类型与 `check:workspace`、`git diff --check`；Web 界面在 ChatGPT 内置浏览器检查实际路由及桌面/窄短视口，记录截图和未验边界。完整合同与差距矩阵归档前不得标为全量完成。

实施与验收（2026-10-17）：DSH 源码和 `.dsh` Profile/lock/patch 结构已只读核对；对照矩阵覆盖安装组合、覆盖顺序、事务回滚、Fiber 生命周期、模型、主题、管理器 Slot 与 LFAA 所有管理页。Provider 注册、请求 Adapter、必需插件实现替换、9 类 Slot、外观映射与遮罩默认有代码和定向回归。本轮合并类型/构建/内置浏览器验收结果后再追加实际路由、视口、运行与剩余边界；在全部缺口和实际页面检查完成前保持进行中。

<a id="lfaa-plugin-extension-appearance-floaters-20261017"></a>

<a id="lfaa-plugin-extension-appearance-floaters-20261017"></a>

## 92-插件扩展与外观-20261017

状态：实现前审查已完成；分批实现与实页验收进行中（2026-10-17）。

目标：对照用户指定的 DSH Client Plugin Manager Slot 合同，逐项找出 LFAA `/plugin-manager` 缺失且可安全承接的扩展面，并实现有真实消费者的 LFAA 插槽；修复插件设置和设置中心的 Appearance 令牌冲突，确保 Wallpaper Engine 的插入光标颜色控制与 LFAA 编辑输入框共存；修复插件/设置工作区及项目自定义悬浮面板过度透明的根因，沿用同一 Appearance 与 DSH 浮层偏好并保持正文可读。用户新增的“边开发边验收”规则必须加入根 `AGENTS.md` 和 `开发规范.md`，并按批次执行。

入口与 Owner：`packages/client/ui-renderer/src/render.tsx` 是当前 DSH Client 根插槽唯一声明 Owner（当前只有 `settings.section`、`sidebar.right.pane.tab`、`shell.overlay`）。LFAA Profile 插件管理入口为 `/plugin-manager`，列表、安装 Modal 与插件详情归 `packages/client/ui-plugin-manager`；安装清单/应用范围/启停/卸载继续唯一归 `packages/boot/plugin-manager` 和现有 API/Permission Owner。DSH Wallpaper Engine 仅由固定、核验、受限的 `dsh-v1` Runtime 加载；不得为填补 UI 插槽缺口而在主 Client Realm 执行任意 NPM/GitHub 插件代码。设置中心 Appearance 类型/默认/校验/账户持久化归 `packages/util/values` 与 `packages/settings/settings`；前端主题映射归 `packages/client/ui-theme` 与 `packages/client/ui-layout/Workbench`；Wallpaper Engine 的 DSH `--we-*` 写入及宿主设置保留原 Runtime Owner。

DSH 只读对照基线：`E:\lfaa1\deepseek-harness\packages\client\ui-plugin-manager\src\client\slot-contract.ts` 声明 `plugins.add.actions`、`plugins.tab`、`plugins.bundle.activation`、`plugins.item`、`plugins.bundle.config`、`plugins.row.config`、`plugins.detail.actions`、`plugins.detail.badge`、`plugins.detail.section` 共 9 个 Plugin Manager 插槽；tab 与 official-item 的 ID/标签/排序由 DSH slot ledger 读取。LFAA 当前根注册 3 个 DSH UI 插槽，在 Plugin Manager 内尚无上述扩展出口。对照必须逐项记录“DSH 语义 / LFAA 当前 Owner / LFAA 安全适配 / 实际消费者或未支持原因”，不可把名称相同、空 Outlet 或无消费者代码记作能力已补齐。LFAA 适配不得复制 DSH Bundle/Row Runtime、Plugin Manager 数据或 DSH ConfigForm 持久化；对无法无损适配的 config form 能力须明示 LFAA 自有表单 Owner 合同。

设置盘点：继续使用账户 `appearance.theme`、`accentColor`/分模式强调色、`sidebarColor`、`overlay`、`blur`、`advanced.interfaceFontSize`、字体角色、`advanced.contrast`、`advanced.reducedMotion`、`advanced.pointerCursor`、`backgrounds` 与 `wallpaperEngine.enabled/projectId`；插件原生 `--we-caret-color`、`--we-glass-alpha`、`--we-floaters-alpha`、`--we-blur`、`--we-floaters-blur` 等只在固定 Wallpaper Engine 活跃时由其当前 Profile 设置驱动，不复制到账户 Appearance。保留 `appearance.updateSurfaceOpacity` 的既有 92% 默认值与 70–100 范围及其原用途。不得重置用户设置，不新增配置项，除非逐项审计证明现有 Appearance/Plugin Owner 无法承载目标可读性且补全设置中心全链路并经回归。

允许：修改上述 UI Renderer/Modules/UI Plugin Manager/Settings/Theme/Layout/Chat 的直接实现及长期回归，相关包 README、根 `AGENTS.md`、`开发规范.md`、`docs/PROMPTS.md` 和准确反映源码现状的架构/样式事实。按批次实现：A) 插槽合同/metadata 读取/真实 Plugin Manager 出口和详情消费；B) Settings/Wallpaper Engine 的主题令牌与插入光标级联；C) 自定义导航 Popover、Ant Design Portal 和同类真实浮层的表面透明度/模糊映射。每批先运行其定向验证，再在 ChatGPT 内置浏览器实际运行页面验收，记录证据后进入下一批。

禁止：修改 `E:\lfaa1\deepseek-harness`；执行、安装、启停、更新或卸载任何第三方插件；把 DSH Bundle、Row、ConfigForm、设置存储或业务数据复制到 LFAA；绕过管理员、认证、Permission Owner、文件完整性/隔离；增加空壳扩展点或假插件/假回馈；覆盖用户设置、改写运行数据、重启正在运行的服务、提交或发布；未实测不得登记通过。

验收：9 个 DSH Slot 分别完成源码合同及 LFAA 映射审计；已实现的 LFAA slots 从 DSH root 注册到 `/plugin-manager` 的真实 UI 形成可注册、可查元数据、可渲染、可撤销的完整链，metadata label/order/key/filter 正确，无重复订阅；如存在不可兼容项，UI 显示准确边界并报告未支持语义。Appearance 在设置中心/插件壁纸设置/聊天输入/工具浮层中消费已有 Owner，插入光标能实际采用 `--we-caret-color` 且普通主题回退可读，改变设置即时生效、卸载/停用后回退；浮层原因由计算样式与令牌链证明，Popover/Modal/Select/Dropdown 及项目内自定义悬浮卡片均达到清晰可读默认表面，且现有用户透明度/模糊仍按其各自配置生效。按批运行直接回归、类型检查、构建、`check:workspace` 与差异检查；每批在 ChatGPT 内置浏览器检查实际 `/plugin-manager`、`/settings?section=appearance` 及关联工作区的常用桌面和本次相关窄/短视口，记录截图/视口/控件反馈/未测项。不得触发真实设置保存、插件生命周期、MCP 或业务写入。

实现与验收：待记录。

<a id="lfaa-plugin-install-modal-registry-progress-20261017"></a>

<a id="lfaa-plugin-install-modal-registry-progress-20261017"></a>

## 93-插件安装流程-20261017

状态：实现与验收进行中（2026-10-17）。

目标：修复 `/plugin-manager` 插件添加入口必须手动选择来源导致 NPM 包名被按 GitHub 拒绝的问题；用单一输入自动识别 NPM 包/版本、GitHub HTTPS 仓库与 LFAA Host 本地绝对路径/归档，并将添加流程改为居中弹窗。弹窗提供真实来源检查、NPM 官方/中国大陆镜像/自定义 registry 选择、安装示例与常驻安全提醒；安装时展示 Plugin Manager Owner 实际执行阶段、固定版本/摘要、文件写入与清单登记结果及可展开详情。“立即启用”是独立且基于真实 Runtime 检查的动作，不把安装显示为已启动，也不显示伪造的 pnpm 命令或进度。

入口与 Owner：`apps/web` 或 Desktop 共用 Client `/plugin-manager` → `packages/client/ui-plugin-manager`；来源识别与输入状态由该 Client 包处理，API 与受保护的流式安装结果由 `packages/api/plugin-controller`/`packages/client/connection` 传递，解析、NPM integrity、GitHub/local 安全快照、原子安装与 Runtime 状态继续唯一归 `packages/boot/plugin-manager`，用户明确安装操作继续经管理员校验和 Permission Owner。只读参考 `H:\ai\deepseek-harness` 的插件管理器三类来源输入、registry 选择和安装任务展示；不复制 DSH Profile/pnpm/Bundle Runtime 实现。

设置盘点：现有 `plugins.enabled` 仅控制账户 AI 扩展，`permissions.mode` 与管理员身份继续控制能力工具及当前权限策略；没有持久化的 NPM registry 设置。官方/npmmirror/自定义 HTTP(S) 地址作为单次安装参数传入检查和安装，不保存为设置或写入 `.npmrc`、Profile 配置与日志；带认证信息的源不支持；沿用 Appearance 主题、表面、圆角、字体/字号、对比度与减少动态效果映射。

允许：修改插件页输入识别、居中响应式安装弹窗与实际进度显示；修改 `packages/boot/plugin-manager` 对单次 NPM registry 的来源解析、metadata/tarball integrity 及其定向回归；修改插件 API/Connection 传输所需的 registry、固定来源及进度事件合同；更新插件管理器、API、Connection 与 Client UI README、直接相关长期回归、本合同及任务索引。安装阶段只能由 Plugin Manager 回报已发生的解析、核验、暂存、原子登记、启用和失败结果；registry URL 不可从安装检查切换到另一个未核验 URL。

禁止：修改 `H:\ai\deepseek-harness`；复制 DSH 的 pnpm/Bundles/插件宿主或其实现代码；浏览器直接访问本机路径或执行安装脚本；绕过管理员/Permission Owner、放宽 archive/path/SSRF/依赖脚本限制、把 NPM 包成功下载说成 Runtime 已兼容；持久化自定义 registry 凭据或写入用户 npm 配置；运行真实第三方插件安装/启停/卸载，重启现有服务，覆盖其他脏工作、提交或发布。

验收：NPM 未作用域与 scoped 包名/版本、GitHub HTTPS URL、本地 Host 绝对目录及 `.tgz/.tar.gz` 可由同一输入正确识别；无效输入在当前字段给出可操作错误。NPM 默认走明确显示的大陆镜像，用户可切至官方或输入自定义 HTTP(S) registry；检查与安装使用同一 registry 与固定版本/摘要，SHA-512 和归档安全校验继续生效。添加弹窗居中、长内容可滚动、ESC/关闭/加载态行为安全、引导示例与安全提醒可见；安装详情来自 Owner 的真实阶段/结果，安装后显式启用动作按实际 Runtime 状态决定可用与结果，失败不伪报成功。运行来源解析/registry/安装/API/UI 定向回归、Client 类型检查、相关包与正式 Web 构建、`check:workspace`、`git diff --check`；在 ChatGPT 内置浏览器 `/plugin-manager` 实页逐轮检查桌面与窄/短视口，记录路由、视口、源状态与未测设备/帧时间。不得触发真实插件写入或服务重启。

<a id="lfaa-plugin-manager-unified-tabs-20261017"></a>

<a id="lfaa-plugin-manager-unified-tabs-20261017"></a>

## 94-插件导航整合-20261017

状态：已完成实现及浏览器验收（2026-10-17）。

目标：重构 `/plugin-manager` 为一排统一主导航：全部、插件、应用、工具、技能、提示词、MCP 连接、我的知识库、运行诊断、领域专家；移除重复的扩展工作台标题/内层标签卡、能力目录提示/标题卡及目录分类胶囊筛选。搜索和真实结果数继续可用。

Owner：`packages/client/ui-plugin-manager` 装配 Profile 插件清单及统一导航；`packages/client/ui-settings` 继续持有 AI 扩展目录、应用概况、知识库、MCP 和运行诊断的真实数据与设置 Owner。统一导航只切换已存在页面/类别，不复制能力数据或执行逻辑。

设置盘点：沿用 `settings.plugins.enabled`、`settings.plugins.skillDirectories`、`settings.plugins.mcpServers`、`settings.computerControl.enabled` 与 Appearance 已有主题、强调色、字体/字号、对比度、壁纸遮罩/透明度、模糊及减少动态效果映射；不新增设置、默认值或持久化。

允许：修改 `PluginManagerPage.tsx/.css`、`SettingsPage.tsx/.css`、插件管理 UI 直接回归、`packages/client/ui-plugin-manager/README.md`（仅当导航说明需同步）及本合同/任务索引。映射为：全部→全类别目录，插件→Profile 插件清单，应用→现有扩展总览，工具/技能/提示词/领域专家→对应真实目录类别，MCP 连接/我的知识库/运行诊断→现有 Owner 页面。壁纸引擎标签仍只在真实 Profile 安装记录匹配时出现。

禁止：改变 Profile 插件生命周期、能力数据/来源、设置更新与权限语义、知识库/MCP/诊断业务行为；增加请求、轮询、订阅、设置或假数据；重启已有服务、覆盖工作树其他改动、提交或发布。

验收：在 ChatGPT 内置浏览器 `/plugin-manager` 检查默认全类别、每个导航项映射、搜索/清除、Profile 插件和条件壁纸标签；桌面与窄/短视口无横向溢出、遮挡或不可达内容，导航自身可横向滚动且键盘可操作。运行插件管理定向回归、Settings UI 构建、Web 构建、`check:workspace` 与 `git diff --check`；记录实页路由、视口与截图证据，不触发写入、Runtime 操作或服务重启。

结果：插件页改为单排主导航，按现有 Owner 直达全部目录、Profile 插件、应用总览、工具、技能、提示词、MCP、知识库、诊断与领域专家；移除了旧工作台标题/内层标签卡、目录提示与标题卡、重复分类胶囊。Wallpaper Engine 标签继续跟随真实 Profile 安装清单显隐。插件管理 UI 回归 5/5、Settings UI 构建、Client TypeScript 检查、Web 构建、193 包 `check:workspace` 与 `git diff --check` 均通过。ChatGPT 内置浏览器 `/plugin-manager` 实页验收：默认 1355×925；窄短 760×520；手机 390×640。十项主导航、各类真实页面映射、目录搜索/清除及空 Profile 隐藏条件壁纸标签通过；390×640 下文档宽度仍为 390px，标签行可横向滚动，末端“领域专家”可选中并完整进入视口，键盘 ArrowRight 可从“全部”切到“插件”，内容卡片收为单列。未测真实设备、桌面 WebView 与帧时间；未重启现有服务、未执行安装/卸载/运行时写入。

<a id="lfaa-plugin-workspace-sticky-cards-20261016"></a>

<a id="lfaa-auth-transition-refresh-stability-20261017"></a>

## 95-登录转场与刷新-20261017

### 目标、Owner 与设置

- 修复错误登录时表单/提交反馈闪动；实现登录成功后整屏一镜进入工作台，并允许 DSH Client 插件替换动画；消除浏览器刷新时纯白首帧及滚动条边缘闪线。
- Renderer 负责认证阶段及唯一 View Transition；AuthView 负责稳定反馈位和动画 slot Outlet；Client Modules 拥有 DSH root slot 合同；Settings 负责动画选择持久化与旧字段兼容；ui-theme/Workbench 负责首帧画布提示。插件安装/卸载继续由既有 DSH 插件生命周期 Owner 持有。
- 使用已有 `appearance.advanced.reducedMotion`（`system|on|off`）；新增 `appearance.advanced.authTransitionPluginId`，默认 `builtin`，候选来自当前装配的 `auth.transition`。设置只保存稳定 contributor ID，不保存凭据。旧账户缺字段时只补默认值并保留其他外观偏好。

### 逐批实施与验收

1. 认证失败反馈：复用 48px 固定反馈位、请求并发门闸和登录按钮当前主题令牌。先复现错误密码，再确认登录卡片、表单和按钮坐标/样式及服务端失败响应；失败不触发动画。
2. 一镜到底与可替换 slot：成功认证后保留 AuthView，直到设置、Workbench 代码及需要的 DSH Client 图就绪；以 `auth.transition` root list slot 提供当前动画选择；Reduced Motion 生效。单元回归覆盖旧设置迁移、可用/缺失插件回退和 Slot Owner 不包含凭据。按 `docs/development/auth-transition-plugins.zh.md` 记录插件合同。
3. 刷新首帧：同步初始化浅/深中性画布，并只为相同路由读取经过白名单校验的内置公开背景缓存。以刷新首帧图与根/正文背景采样确认无默认纯白，再检查窄屏滚动边缘。

### 实测基线

- 2026-10-17 隔离 Edge，`http://127.0.0.1:3001/files`，1440×1000：错误密码提示前后认证卡片坐标范围为 X=0px、Y=0px、宽=0px、高=0px；首个请求与手动重试均为 HTTP 401，未触发 429。捕获到提交按钮从 `rgb(0,0,0)` 跳到主题蓝 `rgb(52,87,213)`，定位为 busy disabled CSS 错用工作台强调色覆盖当前 Ant Design 登录按钮主题，修复后需重复采样。
- 同一隔离路由在首次加载 20ms 截图为整页纯白，500ms 已绘制登录页及背景；纯白发生在应用 CSS/React 首帧之前。不得通过降低壁纸透明度或模糊掩盖。
- ChatGPT 内置浏览器控制器启动失败：Windows 返回 `failed to start Node runtime: 目录名称无效 (os error 267)`。外部隔离 Edge 不算内置浏览器实页验收；内置浏览器须作为明确未验边界说明。

### 禁止与验收边界

- 不使用或修改真实账户/密码，不触碰已在用的 3000 端口；错误密码与成功登录只在本轮隔离合成账户运行目录验收。不得使用浏览器拦截伪造认证成功。
- 运行认证反馈和设置迁移长期回归、Client/Host 类型检查、隔离 Web 根 `dist/.tmp` 构建；记录真实 browser route、viewport、刷新/交互、截图和未验设备。构建/静态检查不得冒充浏览器或 WebView 验收。
- 验收 Motion=on 时没有 View Transition；Motion=off/system 按有效偏好播放；真实浏览器中至少核对默认插件与自定义插件插槽选择。无法运行的模式需明确保留未验状态，不推定通过。

### 实施记录

- 待实施与复测。

<a id="lfaa-relocatable-workspace-launch-20261017"></a>

<a id="lfaa-relocatable-workspace-launch-20261017"></a>

## 96-可迁移启动路径-20261017

目标：仓库移到任意盘符或父目录后，菜单与 CLI 均从入口文件/脚本位置推导当前源码根；相对 `LFAA_DATA_DIR` 仍按该根解析，显式数据目录和 `LFAA_HOME` 继续按原合同生效。定位并区分宿主应用保存的旧项目目录与 LFAA 自身启动故障。

Owner：`apps/cli/bin/lfaa.mjs` 持有 CLI 包根解析，`scripts/project-menu.mjs` 与 `scripts/install-dependencies.ps1` 持有菜单入口根解析，`packages/util/home-paths` 持有数据根解析。Codex 桌面保存的 Local Project 路径由宿主应用管理，不属于 LFAA 仓库配置或可调用的 LFAA API。

设置盘点：无需新增设置。继续读取 `LFAA_HOME`、`LFAA_DATA_DIR` 和 `.env` 权威配置；不保存/植入具体安装盘符，不扫描或自动合并其他项目的数据目录。

验收：从仓库外的系统临时目录用当前 CLI 入口执行 `--help`，确认解析项目包不依赖调用者 cwd；检查启动源码没有用户机器绝对项目路径。另核对 Codex Local Project 登记与磁盘真实路径；若宿主登记仍指向已移除目录，应明确标为宿主配置问题，不能声称 LFAA 源码修复了它。验证当前 Web 端口占用与路径登记属于独立状态，禁止结束用户现有进程。

实测记录（2026-10-17）：H:\\LFAA1 不存在，E:\\lfaa1\\lfaa 存在；Codex `list_projects` 仍返回 Local Project `LFAA1` 路径 H:\\LFAA1。调用 CUA Node 辅助运行时在执行任何页面操作前报 `目录名称无效 (os error 267)`。源码 CLI 入口由 `import.meta.url` 计算根；实际从系统临时目录执行 `node <当前仓库>/apps/cli/bin/lfaa.mjs --help` 返回 LFAA 帮助，新增专门长期回归并通过。菜单从系统临时目录启动、输入退出后显示解析到的真实根 `E:\\lfaa1\\lfaa` 并正常退出。产品源码中未发现硬编码的 H/E 项目绝对路径。修复 Codex 实页验收需在 Codex 桌面将 Local Project 重新绑定到当前文件夹；本轮可用工具无项目路径编辑操作。`3000` 已被存活服务占用（健康检查 HTTP 200），启动失败中的 EADDRINUSE 与旧路径错误彼此独立；未终止服务。

<a id="02-默认账号与登录-20261017"></a>

<a id="02-默认账号与登录-20261017"></a>

## 97-默认账号与登录-20261017

目标：首次启动自动创建默认超级管理员 `admin / 123456`；不提供注册/手动初始化表单；登录页按用户参考图改为简洁居中卡片并明确显示默认凭据；首次登录后可选择立即前往账户安全设置修改用户名或密码，也可跳过。设置中心可控制该安全提醒。

Owner 与边界：`storage-sqlite` 负责向后兼容迁移并保存“默认凭据待提醒”标记；`identity/auth` 在账户数为零时执行唯一一次默认管理员初始化、身份校验、修改用户名/密码及提醒确认；`account-controller` 提供已认证的个人资料更新与确认接口；`util/values`、`settings/settings`、`api/settings-controller` 持有首次默认账户提醒配置的默认、校验、持久化和 API 合同；Client Connection、Renderer、AuthView 与 Settings 分别消费登录/提示/表单。

设置盘点：沿用 `appearance.backgrounds.login`、主题、字体/字号、对比度、减少动态效果、`appearance.advanced.authTransitionPluginId` 和 `general.dialogMotionEffect`；新增 `general.defaultAdminCredentialReminderEnabled`（默认开启），在设置中心“通知”模块提供开关。已有设置按字段补默认，不重置壁纸/主题或其他偏好。登录卡片中心布局采用共享外观令牌，并保持响应式。

安全合同：只在没有任何用户的数据库首次初始化时创建一次默认账户；存在任意账户后绝不种入、重置或覆盖账户。密码使用现有 scrypt 哈希；默认密码只作为用户明确要求的首次安装指引显示，不能作为设置/API 回显字段或进入日志。改名/改密均重新验证当前密码，沿用唯一账户、强密码、唯一用户名、会话撤销及速率限制；数据库迁移只新增带默认值字段，保留已有数据。去除公开注册/首次建号入口。

逐批验收：A. 隔离 SQLite 验证空库得到 admin、123456 与单个超级管理员，非空旧库不变，重复调用幂等；B. 登录 UI 桌面/窄屏实页、坏密码反馈稳定和默认凭据提示；C. 提醒设置读写/旧值兼容，首次登录只提醒带待确认标记的默认账户，跳过或改名/改密后不再提示；D. 账户安全设置实际改名与改密并验证旧凭据失败、新凭据成功、当前会话保留；运行 auth/settings/迁移定向回归、类型检查、相关构建与 `git diff --check`。ChatGPT 内置浏览器实页验收需记录路由、视口和结果；宿主项目登记指向旧路径时明确记录限制，不用外部浏览器冒充。

实施记录：待实施与验收。

<a id="98-输入框窄栏响应式-20261017"></a>

## 98-输入框窄栏响应式-20261017

目标：参考用户提供的紧凑“更多”操作菜单，把关联应用和 Skill/提示词/专家选择收进纵向菜单，避免两个长选择器挤压输入框底栏。请求审批、模型、语音和发送继续常驻且可达；选择器继续使用原有关联合同。

Owner 与边界：`packages/client/ui-chat` 持有聊天输入区结构和样式；工作台只提供真实可用宽度。沿用 Session 关联与 Permission Owner，不改权限语义、关联语义、数据写入或模型行为。

设置盘点：不新增设置项；继续使用设置中心已有主题、字体、字号、外观和减少动态效果令牌，不覆盖用户偏好。

验收：运行 `client-ai-work-composer-responsive.test.mjs`、ui-chat 构建、Web 类型检查与构建、`git diff --check`；ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/work`，在常用桌面视口及窄中间列检查紧凑底栏、纵向菜单、选择交互、横向溢出和操作可达性。记录实际视口与无法覆盖范围，不以源码或构建检查代替实页验收。

实施记录（2026-10-17）：最初尝试在窄栏里压缩和换行两个常驻选择器；收到“更多”菜单参考图后，改为底栏保留附件、权限、更多、模型、语音和发送，两个关联入口放入纵向菜单，再分别进入原多选器。定向回归 5/5、ui-chat 构建、客户端类型检查、Web 生产构建及 `git diff --check` 通过；ChatGPT 内置浏览器控制器启动失败（`目录名称无效 (os error 267)`），所以实际页面与桌面/窄视口目视验收未完成；帧时间未测。新增仅两个本地 React 状态，无请求、订阅、计时器或观察器；未新增设置，沿用主题令牌与 Session 关联合同。
