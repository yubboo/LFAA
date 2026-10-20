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
| 99-弹窗叠层与主题修复-20261017 | 修复提醒弹窗入场透字，并统一首次配置与账户安全提醒的弹窗、主题和提醒操作 | 批次 H/I/J 已完成；定向回归、类型、相关包/Web 构建及桌面/窄屏内置浏览器验收通过；workspace Gate 保留 10 项既有错误；仅实测当前深色主题 | [本轮合同](#lfaa-modal-stacking-theme-repair-20261017) |
| 100-登录动画完成门控-20261017 | 工作台内容等登录转场完整结束后再出现，并改善登录品牌到工作台的衔接 | 全屏仅淡出、小卡片轻移；定向回归/类型/Web 构建及内置浏览器桌面/窄屏登录验收通过；workspace Gate 仍有 10 项既有问题，帧时间/自定义插件未测 | [本轮合同](#lfaa-auth-transition-completion-gate-20261017) |
| 101-插件来源弹窗布局-20261017 | 修复插件来源检查卡片、固定来源长串和兼容告警横向溢出 | 定向回归 7/7、类型与插件包/Web 构建通过；内置浏览器桌面和窄短屏验收通过；workspace Gate 有 10 项既存错误 | [本轮合同](#lfaa-plugin-inspection-modal-layout-20261017) |
| 102-系统与内容存储分离-20261017 | 固定系统数据根，独立配置游戏、小说、漫剧内容根；切换不复制系统数据 | 实施中 | [当前合同](#lfaa-content-storage-separation-20261017) |
| 103-插件 Profile 安装位置-20261017 | 插件直接安装到 LFAA_HOME 的 Profile 根，不再使用旧全局 plugins 树；真实 DSH 示例保持不可运行 | 实施中 | [当前合同](#lfaa-plugin-profile-install-location-20261017) |
| 104-插件安装引导折叠-20261018 | 将添加插件弹窗的 npm 示例与完整安全说明收进可展开区，安装源与展开控制并列 | 代码已实现；UI 回归、类型及包/Web 构建通过；内置浏览器验收待完成；workspace Gate 有 10 项既有错误 | [当前合同](#lfaa-plugin-install-guide-disclosure-20261018) |
| 105-外观主题与首屏画布-20261018 | 修复浅色/深色/跟随系统未同步生效，以及刷新时壁纸画布闪黑；校准现有遮罩与模糊映射 | 源码回归与构建完成；内置浏览器确认当前“跟随系统”刷新后保持深色，三主题交互及首帧帧时间仍待验 | [当前合同](#lfaa-appearance-theme-canvas-first-paint-20261018) |
| 106-通知总开关与数据根核对-20261018 | 增加默认开启的弹出通知总开关，并核对隔离验收目录与产品数据根的区别 | 总开关关闭态恢复入口与类别暂停状态已修；定向回归、类型和 Web 构建通过；真实 admin 浏览器验收因默认 Home 不存在且 3000 端口为隔离服务而未运行；workspace Gate 有 10 项既存错误 | [当前合同](#lfaa-notification-master-switch-and-data-root-20261018) |
| 108-共享弹窗视觉收敛-20261018 | 统一对话框表面、间距、标题和按钮；压缩首次配置/安全提醒重复文案，完整沿用 Appearance | 实施中 | [当前合同](#lfaa-shared-dialog-visual-unification-20261018) |
| 109-AI Work与工作台渲染优化-20261019 | 减少设置页无意后台预载与 AI Work 秒级计时导致的整段历史消息重渲染 | 已实现；内置浏览器空闲资源核对通过；帧时间未测 | [实施记录](#lfaa-ai-work-timer-render-isolation-20261019) |
| 110-SteamCMD收拢与分类提醒偏好-20261019 | 将 SteamCMD 安装/存储设置并入“项目与存储”，移除其首次配置弹窗；按类别保存 AI、业务存储提醒偏好，安全提醒“稍后再说”只关闭本次 | 已实现；窄屏未验收 | [当前合同](#lfaa-steamcmd-workspace-and-category-reminders-20261019) |
| 111-LFAA全仓性能安全与可维护性优化-20261019 | 按用户给定的性能优化任务书审计全仓，以可复核基线驱动分批优化 | 第一轮基线、无语义数组分配削减、全量构建和核心回归完成；全仓后续热点审计仍进行中；全量回归与 workspace Gate 有既有失败 | [当前合同](#lfaa-whole-workspace-performance-security-maintainability-20261019) |
| 112-菜单源码更新同步本地main-20261019 | 修复菜单 8 只更新当前检出分支、遗漏本地 main 引用的问题，并让脏工作区可安全检查无更新状态 | 已实现；Windows 源码更新回归与差异检查通过；需重开菜单加载脚本 | [当前合同](#lfaa-menu-source-update-local-main-20261019) |
| 113-静态弹窗关闭与工作区门禁修复-20261019 | 修复静态弹窗离场卡住，并清除 GitHub 工作区检查中的失效目录声明和截图链接 | 修复与验证完成；临时验收目录清理被自动审批策略拒绝；未推送 | [当前合同](#lfaa-static-dialog-and-workspace-gate-repair-20261019) |
| 117-关键提醒导航与弹窗关闭修复-20261019 | 将内容存储提醒的路径选择移入设置中心，修复三类关键提醒进入设置时仍被遮罩的问题，并核验四种弹窗动效 | 实现完成；源码回归与真实页面验收记录见合同 | [本轮合同](#lfaa-key-reminder-navigation-and-dismissal-20261019) |
| 118-登录页外观设置同步-20261019 | 登录页外观、响应式布局与黑洞式全屏登录转场 | B1–B5 完成；登录成功转场已迭代为设置驱动的整页 WebGL 背景透镜与黑洞吸入；源码、构建及桌面/窄短屏内置浏览器验证通过；帧时间和 Desktop 未测 | [本轮合同](#lfaa-login-appearance-settings-20261019) |
| 119-DSH 插件来源安装修复-20261019 | 对齐 DSH 的 Git 来源与公开 registry 回退，修复 GitHub 插件未发布 NPM 构建产物时检查失败 | 已实现；插件管理器定向回归 20/20、包构建及差异检查通过；任意 DSH Runtime 仍不受支持 | [本轮合同](#lfaa-dsh-plugin-source-install-20261019) |
| 120-登录与工作台输入区响应式修复-20261019 | 修复登录状态悬停导致窄屏重排、工作台输入区显示异常并统一提醒按钮顺序 | `/work` 的 1077×900 实页“更多”按钮 hover 检查中，输入卡前后均为 489.8×152.3px，阴影、滤镜和位移均无；定向回归及 Web/控制端构建通过，帧时间未测 | [本轮合同](#lfaa-login-and-workbench-responsive-repair-20261019) |
| 121-配置提醒生命周期与窄屏引导修复-20261019 | 明确三类配置提醒的关闭条件与长期偏好位置，修复模型未配置引导在窄屏挤压和文案不清的问题 | 按用户澄清修正并完成；定向回归、类型、包/Web 构建和隔离实页验收通过 | [本轮合同](#lfaa-setup-reminder-lifecycle-and-narrow-workbench-20261019) |
| 122-模型目录刷新与容量错误隔离-20261019 | 分离已保存 Provider 账户的官方目录刷新和真实模型请求；显示官方版本标签且保留原始名称与调用 ID | 定向回归 7/7、Client 类型、受影响包/Web/Control Plane 构建及 193 包工作区检查通过；内置浏览器控制超时，未完成目视验收 | [本轮合同](#lfaa-ai-model-catalog-refresh-20261019) |
| 123-Web 启动自动补建修复-20261019 | 修复 Windows PowerShell 5.1 将运行树 JSON 数组嵌套解析，导致菜单未识别缺失 Control Plane 产物的问题 | 已修复；PS 5.1 回归 5/5、Control Plane/Web 构建与指纹复核通过；工作区清单 Gate 失败，旧 setup 路由断言阻断编译启动回归 | [本轮合同](#lfaa-web-startup-auto-rebuild-20261019) |
| 124-登录转场连续性修复-20261019 | 消除黑洞登录动画到工作台的末帧切换感，并让卡片运动首尾平滑 | 已实现；直接回归、类型检查、包/Web 构建与桌面/窄屏内置浏览器登录验收通过；未测帧时间 | [本轮合同](#lfaa-login-transition-continuity-20261019) |
| 125-设置中心账号页合并-20261019 | 将个人资料、安全和账号管理收拢到“账号”入口，以页内 Tab 分类 | B1/B2 完成；完整补验修复账号搜索命中组未展开；回归、Client/Host 类型、Settings/Web/Control Plane 构建、桌面/平板/手机视口及工作区 Gate 通过 | [本轮合同](#lfaa-ui-settings-account-tabs-20261019) |
| 126-首次登录提醒队列与通知开关修复-20261019 | 修复首次登录提醒队列及版本公告显示；保留提醒功能，仅使用通知总开关，不在设置中心增加分类提醒开关 | 已完成 | [本轮合同](#lfaa-first-login-reminder-queue-and-preferences-20261019) |
| 127-设置中心窄视口工具栏排版修复-20261019 | 修复设置页分栏容器变窄时保存操作孤立换行及通知说明卡过高的问题 | 直接回归 2/2、Client 类型、设置包/Web 构建、193 包 Gate 与桌面/分栏/窄屏验收通过；临时数据目录因策略限制未清理 | [本轮合同](#lfaa-settings-narrow-toolbar-layout-20261019) |
| 128-插件管理三栏工作区-20261019 | 插件管理页复用现有全局导航、二级侧栏菜单与 ResizableWorkbench，形成可拉伸的三栏布局 | 已实现；三栏、响应式布局、菜单切换、分隔条拖动与收起/恢复已验；内滚动未单独验 | [本轮合同](#lfaa-plugin-manager-three-column-workspace-20261019) |
| 129-插件管理页设置中心齿轮入口-20261020 | 在插件管理页工具栏增加齿轮入口，打开设置中心集成插件菜单 | 用户实页验收指出该路由显示扩展工作台、设置侧栏没有插件菜单；本轮按 #131 修正 | [本轮合同](#lfaa-plugin-manager-open-settings-20261020) |
| 130-应用工作区四栏导航整合-20261020 | 应用工作区复用现有全局导航、二级应用菜单、可拉伸工作区与右侧资源栏，形成四栏布局 | 已实现；定向回归、类型、包/Web 构建与工作区 Gate 通过；内置浏览器桌面及窄视口布局/路由验收通过 | [本轮合同](#lfaa-application-workspace-four-column-navigation-20261020) |
| 131-设置中心集成插件菜单统一-20261020 | 将插件管理齿轮接入设置中心“集成 → 插件”，用设置页标准行和真实开关呈现 Profile 插件 | 定向回归、类型/包/Web 构建、193 包 Gate 与内置浏览器桌面/窄屏验收通过；Profile 当前无已安装插件，实页无开关行可操作 | [本轮合同](#lfaa-settings-profile-plugins-integration-20261020) |
| 132-菜单源码更新远端跟踪引用-20261020 | 修复菜单 8 在远端 main 非快进改写后无法 fetch 最新提交的问题，同时保留本地分支快进与数据保护 | 已修复；隔离远端改写回归与工作区维护全量回归 13/13 通过，差异检查通过 | [本轮合同](#lfaa-menu-source-update-remote-tracking-20261020) |
| 133-设置中心集成分类标签-20261020 | 在设置中心插件页增加插件、应用、MCP、技能、市场分类标签，复用真实 Owner 与现有数据 | 已实现；定向回归 11/11、类型/包/控制端/Web 构建、193 包 Gate 与内置浏览器桌面/窄屏验收通过 | [本轮合同](#lfaa-settings-integration-category-tabs-20261020) |
| 134-Web启动每次重建最新源码-20261020 | 菜单 2 → 子菜单 1 每次启动都构建当前 Control Plane/Harness 与 Web，再核对构建指纹后启动 | 已实现；Windows PowerShell 5.1 AST 解析与差异检查通过；回归/完整构建未运行 | [本轮合同](#lfaa-web-startup-always-build-20261020) |
| 135-插件页标题与搜索栏布局修正-20261020 | 将标题操作按钮靠右，并让插件搜索框在分类工具栏中靠右对齐 | 已修正；定向回归、类型/包/Web 构建、193 包 Gate 与内置浏览器桌面/窄屏验收通过 | [本轮合同](#lfaa-settings-plugin-toolbar-alignment-20261020) |
| 136-插件设置窄屏响应式布局-20261020 | 修正窄屏下设置固定操作栏、插件标题按钮和分类搜索工具栏的换行与对齐 | 已修复；定向 UI 回归 14/14、Client 类型/设置包/Web 构建、193 包 Gate 和 Web 指纹通过；内置浏览器 320/390/760/1440 实页复验完成 | [本轮合同](#lfaa-settings-plugin-responsive-layout-20261020) |
| 137-设置中心集成分类与逐项开关-20261020 | 在同一设置中心切换插件、应用、MCP、技能与市场；已有能力按真实 Owner 显示开关并持久化 | 实施中 | [本轮合同](#lfaa-settings-integration-tabs-and-switches-20261020) |
| 138-外观自定义背景修复-20261020 | 将账户上传图片并入内置背景的同一选择网格，支持选用、应用和删除 | 隔离浏览器验证 PNG 上传入图库、选择保存；最终 Web 构建通过、指纹 `[]`，3000 健康/外观 GET HTTP 200 且提供新包。当前标签目视复验受内置浏览器地址策略阻断 | [本轮合同](#lfaa-appearance-custom-background-repair-20261020) |
| 139-工作台接入 npm 发布-20261020 | 在 Windows LFAA 工作台增加 npm CLI 发布入口，复用既有构建和发布 Owner，并在真正发布前检查登录、版本和用户确认 | 已实现；Windows 菜单取消回归、PowerShell 5.1 语法检查和差异检查通过；未构建或发布 npm 包 | [本轮合同](#lfaa-menu-npm-publish-20261020) |
| 140-设置中心应用入口复用四栏工作区-20261020 | 修复设置中心点击全局“应用”仍弹出旧浮层的问题，直接进入现有 `/work` 四栏工作区并复用同一份应用导航 | 已修复；回归 5/5、Client 类型、设置包/Web 构建、195 包 Gate 和内置浏览器桌面/窄短验收通过 | [本轮合同](#lfaa-settings-app-navigation-workspace-20261020) |
| 141-最近会话与工作区列表联动-20261020 | 让 `/work` 全局“最近会话”与左二会话侧栏使用同一份 LFAA 内部会话数据、加载状态和刷新 Owner | 数据联动已实现；其独立悬浮卡片由 142 移除 | [本轮合同](#lfaa-recent-sessions-workspace-sync-20261020) |
| 142-最近会话入口复用左侧会话 Dock-20261020 | 移除“最近会话”独立悬浮卡片，直接展开现有左二会话 Dock；其他页面统一进入工作区查看同一会话列表 | 已实现；UI 回归 9/9、Client 类型、ui-sidebar/ui-workspace/Web 构建、指纹与内置浏览器 `/work`、`/files→/work` 验收通过；workspace Gate 因包目录 JSON 清单过期未通过；窄屏设备未实测 | [本轮合同](#lfaa-recent-sessions-dock-navigation-20261020) |
| 144-工作区应用导航迁至右侧菜单-20261020 | 固定左一、左二、聊天工作区、右菜单顺序；两根分隔线只响应拖动，保持中心 300px 与左右 Dock 吸附 | 已移除换位功能并恢复固定顺序；吸附阈值、分隔线点击和吸附期间同一按压反向拖回仍在修复与实页复验；中心画布响应式留白和锚点贴边批次已实现并检查窄分栏 | [本轮合同](#lfaa-workspace-application-navigation-right-dock-20261020) |
| 145-开发手册可视化总入口-20261020 | 建立人和 AI 共用的开发知识入口，串联功能、实现方式、解决的问题与验收记录 | 手册与中英入口已完成；相对链接 52/52、差异检查通过；workspace Gate 唯一失败项为包目录 JSON 清单过期 | [本轮合同](#lfaa-developer-handbook-index-20261020) |
| 146-项目内可视化开发手册-20261020 | 在“设置中心 → 关于与更新”提供可视化 UI 手册，逐区说明工作台导航、左右侧栏、中间工作区、设置中心及其 Owner/实现/历史验收 | 源码、Client/设置包/Web 构建及内置浏览器桌面/短屏实页通过；workspace Gate 唯一失败项为包目录 JSON 清单过期 | [本轮合同](#lfaa-in-app-visual-developer-handbook-20261020) |
| 147-开发提示词与功能记录闭环-20261020 | 扩展项目内手册，给出可直接使用的功能修改提示词与详细记录模板，并要求后续功能/修复逐轮登记真实实现和验收证据 | 已完成；Client/设置包/Web 构建、内置浏览器 1280×720 与 390×640 验收通过；workspace Gate 仅有包目录 JSON 清单过期 | [本轮合同](#lfaa-feature-prompt-and-recording-workflow-20261020) |
| 148-Agent工作区上下文-20261020 | 将当前会话真实项目工作区显式传入模型上下文，区分项目目录与聊天记录存储位置，并让未绑定状态可被模型正确识别 | 已实现；Agent Loop 构建、Host 类型检查、差异检查通过；真实 Provider/Daemon 未测 | [本轮合同](#lfaa-agent-workspace-context-20261020) |
| 149-账号与业务数据目录归属修正-20261020 | 让 `.lfaa` 只承载账户/控制数据，`LFAA_DATA_DIR` 默认落在 `.lfaa/data`，并让“项目与存储”实际控制业务目录 | 实施中 | [本轮合同](#lfaa-account-and-business-data-roots-20261020) |
| 150-移动工作区标题栏空白-20261020 | 移除 Mobile AI Work 标题栏无内容的第二行，保持菜单遮罩起点与标题栏对齐 | 代码修复完成；服务重启与实页验收受阻 | [本轮合同](#lfaa-mobile-workbench-empty-header-row-20261020) |
| 151-工作台换位残留与重复响应式规则清理-20261020 | 清理固定栏序迁移后的过期换位说明、冗余移动栏覆盖和重复回归断言，不改变拖拽/吸附行为 | 已清理；定向回归 12/12、Client 类型、正式 Control Plane/Web 构建、内置浏览器 `/work` 桌面页通过；构建后有其他源码更新，当前全仓指纹为 `[host, web]` 过期；窄视口未测 | [本轮合同](#lfaa-workbench-layout-cleanup-20261020) |
| 152-REA逆向分析能力融合-20261020 | 将官方 REA 逆向分析 MCP 与证据优先工作流接入 LFAA Agent；兼容 207 项大工具目录，提供按需工具发现/调用和账户级可选连接预设 | 已实现；定向回归、类型、构建及内置浏览器桌面页通过；窄屏实页与真实 REA 运行未验 | [本轮合同](#lfaa-rea-agent-integration-20261020) |
| 153-DSH式默认与自选项目工作区-20261020 | 按 DSH 首次使用语义建立系统“文档”下的默认项目目录，并允许桌面通过资源管理器、Web 通过 Daemon 浏览器登记用户选定的单个真实文件夹 | 实现、构建与 `/work` 桌面/窄视口验收完成；Electron 原生对话框未实测 | [本轮合同](#lfaa-dsh-style-project-workspace-20261020) |
| LFAA-AI-VIDEO-CANVAS-MVP-20261010 | 接入 AI 漫剧应用的真实账户隔离分镜画布首版，不伪装视频生成或执行工作流 | 已实现并修复入口回退；入口/Owner/API 回归 4/4、Web 构建、工作区 Gate 和登录浏览器入口/画布首屏/空列表读取通过；浏览器写入、帧时间、Desktop、Provider、白模导入未验 | [本轮合同](development/ai-video-canvas-mvp-20261010.md) |
| LFAA-AGENT-STDIO-COMPUTER-USE-20261008 | 在现有模型驱动 Agent/MCP Owner 中接入受设置与权限约束的本机 stdio MCP，并将 Computer-Use MCP 图片和说明送入当前模型请求 | 实现与定向回归完成；真实 Provider/桌面验收待做 | [当前合同](#lfaa-agent-stdio-computer-use-20261008) |
| LFAA-MCP-EGRESS-SESSION-PAGING-REPAIR-20261008 | 为远程 MCP 连接增加出站地址约束，并将 JSONL 消息分页改为单次异步完整链校验 | 已修复；MCP 2/2、Session 分页/冷缓存 1/1、Web Profile API 1/1、Host 类型检查、workspace Gate 和 4 个直接包构建通过 | [当前合同](#lfaa-mcp-egress-session-paging-repair-20261008) |
| LFAA-REMAINING-GAP-REPAIR-20261008 | 修复 Tauri 兼容壳安全停机、Session 分页、MCP 会话复用和 Web 大块；分开记录运行验收边界 | 源码、定向回归、类型检查及隔离构建通过；仍有约 501 kB 懒加载 C++ 语法块告警。真实桌面/游戏/浏览器帧时间/远端 CI 未验收 | [当前合同](#lfaa-remaining-gap-repair-20261008) |
| LFAA-WORKSPACE-AUDIT-REPAIR-20261008 | 核验 GLM 审查、修复运行风险与权威重复、整理中英文分类文档和自动门禁 | 整改与本地验证完成；实机退出/升级、长日志等缺口明确保留 | [当前合同](#lfaa-workspace-audit-repair-20261008) |

<a id="lfaa-whole-workspace-performance-security-maintainability-20261019"></a>

## 111-LFAA全仓性能安全与可维护性优化-20261019

目标：按用户提供的《lfaa性能优化提示词.md》审计当前 `E:\lfaa1\lfaa` checkout，面向全仓检查性能、安全、重复/冲突逻辑及冗长热路径；先建立基线，再只实施有数据支持、可回归和可回滚的高收益优化。不是全量格式化或未经验证的架构重写。

基线：仓库根 `E:\lfaa1\lfaa`；分支 `main`；HEAD `2e687211772973a7fd13302ca6b6cffc34a66f0b`。开始时工作树包含 AI Work/Workbench 计时和预载改动及其他既有修改；这些差异均须保留，触及前对照源码并注明归属。Web 正式入口是仓库 `pnpm lfaa web`，当前 3000 监听进程为 PID 38312，命令行指向本 checkout 的 `apps/cli/src/bin.ts web --no-local-daemon`。Node `v24.16.0`、pnpm `11.17.0`。用户已授权在核验归属、确认没有需保护的活动 Run 后重启该 LFAA 服务并以现有 `admin` 会话验收；不得创建账号、管理员、临时测试路由或使用替代账户。

Owner 与边界：UI/SSE 为 `packages/client/connection` 与 `packages/client/ui-chat`；Agent 循环/上下文/工具派发为 `packages/core/agent-loop` 和各自 Context/Tool Owner；模型请求和 Token Meter 为 `packages/llm`；Session JSONL、投影与遥测为各 `packages/session/*` Owner；DAG 为 `packages/workflow/dag-engine`；应用入口由 `apps/*` 装配。用户身份、权限审批、取消、App/账户/节点隔离、Provider/模型选择、Settings Owner、Session 哈希链/fsync 提交语义和真实执行结果都不得被缓存或优化绕过。按当前代码确认实际所有权，不能把此导航列表当成实现事实。

允许：登记全仓包/目录审查覆盖表；测量 SSE→React、Agent 请求→工具→续接、Session commit→fsync、Context/Schema 请求准备四条路径，报告样本、规模、冷/热状态及 P50/P95；盘点现有缓存、帧合并、压缩、重试、Profiler/Telemetry、测试及构建分包；对由测量证实的问题按独立批次修改单一职责域，补长期回归、受影响 README/架构/合同；复核依赖和代码安全边界；通过只读核验后的正式 3000 服务重启及现有登录态内置浏览器验收。

禁止：修改或清理真实用户数据、凭据、游戏/项目数据、插件安装、正式备份或其他工作树；在热路径跳过模型推理、切换模型/思考参数、吞掉请求、绕过动态权限/审批、提前确认未持久化写入、重放未知写操作、并发未登记为安全的副作用；删除 fsync/哈希链/账户校验；新建第二套 Agent、工具、Session、缓存或权限 Owner；擅自升级技术栈/依赖或增加服务；改动无证据的问题、整仓格式化、清理既有差异；提交、推送、发布或部署。

分批验收：B0 记录只读环境与当前真实链路，并对四条基线使用同一条件的可复现测量；实时 Provider latency 与合成测量分列。B1 仅在 UI Profiler/帧数据指出热点后优化 React/SSE，守住正文顺序/断线续接/分页/滚动；B2 仅在请求准备数据指出重复开销后优化 Context/静态 Schema 复用，执行时仍读最新权限、插件、账户和目标状态；B3 仅在 fsync/事件循环数据证实阻塞时考虑 Session 改造，并保留耐久确认、顺序、重放、哈希与崩溃恢复，否则记录保持现状的理由；B4 仅对现有 DAG Owner 中有依赖/资源/风险证明安全的节点考虑可配置有界并发；B5 按正式 Web 产物和真实加载瀑布调整代码分包、预载或资源清理。每批先复核、实现、直接回归/类型/构建，再在当前运行页面可达时做实页验收。变更一经实测无收益或有正确性/安全退化即停止并回滚该批。

安全审计范围：逐目录盘点以 `docs/harness-packages.json` 与生成脚本为权威，区分占位/工程/产品包；安全扫描仅作线索，须沿 Controller→Owner→Daemon 实现校验认证、授权、路径/输入围栏、秘密脱敏、账户隔离和未知结果合同。任何未读目录或未扫描依赖均标明范围，不声称“全仓无漏洞”。所有产物写根 `dist/`，所有合成数据只用现有隔离测试设施。

验收与报告：沿当前主链记录 Owner 时序与状态（已装配/未装配/待实测）；提供四条路径的基线和相同环境的优化后比较、样本数与 P50/P95，无法获取的 React commit、Provider、CPU/内存或帧数据明确记未测，不推算提升率。运行直接回归、Client/Host TypeScript、受影响包和 Web 构建、`pnpm run check:workspace`、`git diff --check` 与可用安全审计；真实页面至少常用桌面与窄/短视口，记录 `/work`、交互与服务重启结果。回滚方法为仅撤销本合同新增差异，不触碰开始时既有脏文件。分批追加实施记录，最终列全仓覆盖与剩余项；若未完成所有可独立证明的批次，保持进行中并明确下一步，不把局部优化宣称为整个项目彻底完成。

第一轮基线与实施记录（2026-10-19）：`docs/harness-packages.json` 共登记 368 条包/目录（193 implemented、175 placeholder）；这是清单覆盖，不代表已逐个审计完成。沿性能 Owner 阅读既有基建后确认 UI 同帧合并、会话缓存边界、Agent 动态工具/权限重查、Session JSONL 哈希链与 fsync、DAG 输出上限和 Web 懒加载拆包已存在；没有在这些机制上重复造缓存或替代 Owner。一个可直接证明的冗余是 `evaluateContextPressure` 将 readonly messages 与可选 tools 分别浅拷贝后，`estimatePromptTokens` 又遍历两份全量数组；删除这两份临时数组传递，输入只读类型和估算语义不变。相同 Node 24.16 合成压力条件（1,000 条消息、约 523,890 字符、32 个工具 schema、每轮 50 次估算）基线 P50/P95 为 0.713/1.232 ms，修改后 0.689/1.591 ms。中位数仅低约 3.4%，尾延迟更高且运行波动，故只记录消除两次数组分配，不宣称稳定延迟提升或十倍加速；没有语义变化，因此保留这项低风险去冗余。

新增/修正的直接回归：设置页工作区读取当前由项目存储 Owner 一次加载，更新性能合同测试去掉过期的独立 `loadDataDirectorySettings()` 期待；修正 v44 workflow 迁移夹具，使它包含后续 v55/v56 迁移实际依赖的 Minecraft 任务表和索引，不改生产迁移。用量汇总性能回归改为 5 次预热、31 次采样并报 P50/P95；4,000 条合成历史用量、4 个 Provider/模型组热查询约为 P50 0.001 ms / P95 0.008 ms，接近计时器分辨率，只证明读取现有账户汇总且不重放 Session。隔离 Session JSONL 299 字节提交实测：首次 4.333 ms，31 次热提交 P50 4.037 ms / P95 4.735 ms；fsync 属于耐久性合同，未删减。既有 1,000 个同帧 SSE 片段合并为单次更新的工作量回归通过；没有 React Profiler，因此未得到 React commit 或浏览器帧时间。

直接验证（2026-10-19）：Client/Host TypeScript、`pnpm run build:control-plane`、`pnpm run build:web` 均通过；Web 构建转译 2,257 个模块并只写根 `dist/`，最大语言高亮块 501.30 KB（gzip 33.54 KB），工作区块 382.91 KB（gzip 100.95 KB），现有重资源已分块，尚无浏览器加载瀑布证据，未改拆包。核心回归命令 `node --import tsx --import ./register-package-loader.mjs --test tests/agent-response-latency.test.mjs tests/session-usage-summary-performance.test.mjs tests/client-performance.test.mjs tests/ai-work-sse-lifecycle.test.mjs tests/agent-runtime.test.mjs tests/workflow-core.test.mjs tests/execution-control.test.mjs`：59/59 通过。完整 CLI 回归 510 项中 491 通过、18 失败、1 跳过；失败涉及既有后台任务超时、AI 漫剧画布夹具、3 项 Portal/对话框旧样式断言、文件资源/权限/路径测试、完整 Web Profile 任务、Windows 沙盒构建产物、Remote Schema 合同和 Writing 迁移异常断言，均未通过放宽断言处理。`pnpm run check:workspace` 有 10 项既有错误：缺失职责路径、过期包清单、4 个历史截图和 2 条失效包链接；与本批无关。`git diff --check` 通过。

安全核查范围与限制：`pnpm audit --prod --audit-level=high --registry=https://registry.npmjs.org` 通过，npm 官方 registry 未发现已知漏洞；仓库默认镜像不提供 audit bulk 接口。对 `packages/`、`apps/` 做了 shell:true、危险 HTML 注入和动态 eval sink 模式扫描，未发现实际产品 sink；唯一文本命中是 Git 审查界面展示的用户可复制命令字符串。该模式扫描不等于完整源代码安全审计，Controller→Owner→Daemon 全调用链尚未逐目录验证；后续逐域审计仍需覆盖身份/权限/路径/秘密/账户隔离。

真实页面与重启验收（2026-10-19）：重启前核实端口为 `127.0.0.1:3000`，PID 38312 的可执行文件与命令行均属于当前 `E:\lfaa1\lfaa` Web CLI；ChatGPT 内置浏览器 1240×925 只读检查 `/settings?section=workspace` 与 `/work`，当前登录用户显示 admin，无活动 Run，Provider/模型只显示现有选择，未发送请求、保存偏好或写入业务数据。按用户授权停止该 PID 后，从同一 checkout 以原 Web CLI 命令重启，端口现由 PID 33104 持有；`http://127.0.0.1:3000/work` 返回 HTTP 200。重启后内置浏览器同一 1240×925 视口打开 `/work`，仍显示现有 admin 登录态、控制端已连接和同一 Provider/模型选择，空会话输入区可用，无错误/提醒弹窗，也没有发送模型请求；截图为本轮 CUA 验收结果。该次服务 stdout/stderr 文件时间戳未作为证据。常用桌面视口已检查；浏览器窄/短屏、帧时间/长任务、React Profiler、真实 Provider latency、CPU/内存曲线、Desktop/WebView 和所有 368 包逐目录安全审计未完成，本任务保持进行中。
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
| LFAA-RELEASE-ANNOUNCEMENT-DIALOG-01 | 新增独立的版本更新公告弹窗，按已安装版本首次展示，沿用官方发布说明并避开其他提醒弹窗 | 实现与验证记录见本文件当前任务合同；真实 Web 页面按桌面/窄短屏实测 | [合同](#lfaa-release-announcement-dialog-20261019) |
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

<a id="lfaa-rea-agent-integration-20261020"></a>

## 152-REA逆向分析能力融合-20261020

### 目标、入口与 Owner

- 将官方 `morluto/rea` 的本机 stdio MCP 逆向分析能力接入 LFAA Agent，使模型可依据用户目标发现、学习并调用 REA 工具，引用其 Evidence 结果并区分观察、推断、未知与限制。
- 上游现状核对：REA 当前 npm 发布版为 `rea-agents@6.7.0`；上一版 `6.5.0` 的公开 MCP 目录记录为 207 项。LFAA 当前 MCP Runtime 上限为 200 项，且将完整工具清单逐项放入模型请求。直接配置会被拒绝，放宽上限也会给模型请求带入过大的函数目录。本轮没有启动 6.7.0 包，故 207 项仅作为大目录测试规模，不宣称为 6.7.0 实测数量。
- 运行入口：AI Work `packages/core/agent-loop` → `packages/mcp/mcp-client` 连接当前账户/App MCP → 工具权限由既有 Permission Owner 执行；REA 本机进程只可由现有 stdio MCP Runtime 在本机控制端启动。
- 唯一 Owner：协议连接、工具目录、输入校验、租约与资源回收归 `lfaa-mcp-client`；REA 工作流内容归新增 `lfaa-skill-rea`，作为按需资料登记在现有 Skill/AI Extension Owner；账户 MCP 设置和设置页面仍归 Settings Owner 与 `ui-settings`。
- 设置盘点：复用 `plugins.enabled`（默认关闭，控制账户 MCP 连接）、`plugins.mcpServers`（默认空）、MCP 单一 `applicationIds`、`aiRuntime.requestTimeoutSeconds`、`permissions.mode`、Appearance 共享令牌及 `plugins.disabledSkillNames`（默认空，单项停用 Skill）。REA 是 bundled Skill，不因第三方扩展开关关闭而隐藏；用户可在设置中心单独停用。预设固定官方 npm 包 `rea-agents@6.7.0`；仅用户添加后在选定 App 启用，MCP 全局开关仍须开启，第一次实际连接时才由 `npx` 获取包。
- 权限/数据：REA 的 MCP 调用沿用统一 `permissions.mode`，工具注解不作为授权；本机 stdio、远程生产拒绝启动的现有边界保持。Skill 与 MCP 返回均是参考资料，不授予对目标软件、文件、进程、设备或网络操作的额外授权。不得安装/运行用户级 REA、修改真实账户配置、启动目标程序或分析真实样本。

### 允许、禁止与验收

- 批次一允许：`packages/mcp/mcp-client`、新增 `packages/skill/rea`、`packages/bundle/base`、`apps/cli/tests`、受影响包 README、`docs/PROMPTS.md` 与必要架构说明。大于阈值的 MCP 服务以有界目录查询/单工具 schema 按需读取/统一高风险实际调用替代逐项暴露；普通目录继续保持当前逐项直连行为。
- 批次二允许：当前 MCP 设置组件及其直接回归、包 README、同一任务合同；加入可选 Windows stdio 配置预设，复用现有字段和主题令牌，不改变 `plugins.enabled` 或任何账户偏好。bundled Skill 复用现有 `plugins.disabledSkillNames`。
- 禁止：复制 REA 源码或其 Skill 全文；接管 REA 的本机分析 Provider/Evidence 数据、添加平行 Agent/会话/授权/存储；自动安装/启用 REA、联网启动 MCP、分析任意本机目标、绕过认证/授权或依据注解降低风险；逐项写死过滤 REA 工具白名单；更新无关包、覆盖已有未提交修改、提交或发布。
- MCP 目录契约：对超过 64 项的大目录提供有界名称/描述页，详细 schema 按单项读取，代理调用前由缓存的原始 schema 验证参数并再次校验账户/App/配置/租约；实际工具调用仍为 dangerous 并携带真实工具名与参数审批摘要，错误/超时不重放；卸载/停用/取消回收连接与缓存。常规小目录的名称、合同、权限和结果行为保持兼容。
- Agent 契约：Bundled `reverse-engineer-anything` 只在模型选择后读取；引导 Agent 从真实可用工具目录选 REA 能力，执行前明确用户目标/授权，优先使用支持的证据与摘要工作流，报告来源、限制和未执行项。没有已登记 REA 服务时如实说明不可用，不自动触发安装。
- MCP 设置契约：设置中心预设按固定官方包版本、Windows `cmd.exe` stdio launcher、`workspace` 单 App 范围新建；预设新记录启用但仍受账户 `plugins.enabled` 总开关控制，可编辑/停用/移除，安装动作不改其他 App；用户可通过既有字段配置其他平台。展示首次 `npx` 启动会获取所选固定版本的说明，不更改实际偏好直到用户使用控件。
- 验收：协议夹具模拟 207 工具及分页、目录/查询/单项 schema、有效与无效调用、权限摘要、配置/账户/App 撤销、取消/租约回收、常规目录兼容；技能可按需发现/读取且可随 Bundle 装配；设置 UI 保留用户既有值，新增配置经 Settings 校验/持久化并被 AI Work Runtime 发现。运行直接回归、相关 Host/Client 类型检查、MCP/Skill/Bundle/UI 包构建、工作区差异检查及 `git diff --check`。
- UI 批次须完成后立即运行直接回归/类型/构建并从当前源码启动正式 Web，在 ChatGPT 内置浏览器检查设置页桌面与窄/短视口、添加/停用交互及截图；不能改真实用户设置。真实 npm MCP、REA provider、目标应用、Daemon、桌面包、实际浏览器帧时间未运行则列为未测。

### 实施与验收记录

- 批次一：`lfaa-mcp-client` 保留至多 64 项小目录的逐工具暴露；大目录改为 Search、单项 Schema、Dangerous Call 三个模型入口，目录上限 512 项、单 schema 64 KiB、总 schema 16 MiB，搜索最多 32 项/页。保存精确远端 schema，调用前校验参数、复查账户/App/配置/租约；常见 Draft 7 保持原 Ajv，出现 2020-12 schema 特征时采用 Ajv 2020；大目录仅在模型选中工具后编译对应校验器。207 项合成目录夹具从 207 个 Provider 工具定义降至 3 个（少 98.6%）；这是 LFAA 目录工作量证据，不代表真实 REA 或 Provider 延迟。新增 `lfaa-skill-rea` 作为按需 bundled Skill 并登记到 base Bundle，方法要求引用真实工具与 Evidence、标注观察/推断/未知/限制，不复制上游 Skill 正文或启动 REA。
- 批次二：设置中心 MCP 页添加固定 `rea-agents@6.7.0` Windows stdio 预设，限 `workspace` App；复用 `plugins.enabled`、`plugins.mcpServers`、`permissions.mode`、`plugins.disabledSkillNames` 和原主题令牌，不新增设置。预设可编辑、停用和移除，未触发实际 npx 下载或 MCP 启动。
- 回归：`mcp-tools.test.mjs` 5/5（含合成 207 工具、按需搜索/schema/call、2020 tuple 校验、错误参数不派发及开关撤销）；`package-owner-lazy-capabilities.test.mjs` 3/3（Skill Registry/Extension 同源和正文按需读取）；`plugin-manager-ui.test.mjs` 14/14。测试使用 `dist/.tmp` 隔离 Home/Data，不写入真实账户。最终核对发现 4 个任务临时目录仍在 `dist/.tmp`；对精确路径的 PowerShell 清理请求被本机执行策略拒绝，未声称清理完成。
- 检查与构建：`tsconfig.host.json`、`tsconfig.client.json` 类型检查通过；MCP Client、REA Skill、base Bundle、ui-settings 包构建通过；正式 Web 与 Control Plane 构建通过；workspace Gate 通过（196 包），`git diff --check` 通过。产物在根 `dist/`。
- 内置浏览器实页：从当前 checkout 使用临时 Home/Data 启动 `pnpm lfaa web --no-local-daemon`，地址 `http://127.0.0.1:3001/settings?section=plugins`。登录隔离临时账户后切到 MCP Tab，实际检查固定预设说明、Agent 总开关默认关闭、Windows stdio launcher、App 范围和参数表单；最终版本在桌面视口 1280×720 显示 REA 6.7.0，添加后显示 `cmd.exe`、固定 npm 参数及 `workspace` 范围。隔离账户中的 MCP 预设写入只在 `dist/.tmp`，未启动 REA；真实账户偏好未改。最终构建后，原 3000 端口 LFAA Web 按仓库启动预检重启并恢复，`/api/health` 返回 200。当前 CUA 内置浏览器没有视口覆盖能力，窄分栏/短屏实页未验；现有响应式断点与 MCP 布局直接回归通过。
- 未实测：真实 `rea-agents@6.7.0` npm MCP 启动与实际目录、真实模型 Provider 自主调用、目标文件/应用、Daemon/桌面、帧时间与窄/短屏实页。未改变真实用户偏好或安装 REA。

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

实施记录（2026-10-17，卡顿修复批次）：复核确认原默认路径在 `startViewTransition` 回调中 `flushSync` 挂载完整 Workbench，并捕获/动画完整登录页与工作台快照；这把较重的首屏 React 提交与全屏快照合成压在同一动画窗口，结合浏览器实测中的掉帧反馈，判定为卡顿来源。此为代码路径诊断，未采到原版本或修复版的 FPS/Long Task 数值。

修复：默认路径先让 Workbench 首屏挂载，期间通过 `visibility:hidden`、`aria-hidden` 和 `inert` 保持不可见/不可交互；Workbench 提交并经过两次 `requestAnimationFrame` 后，登录覆盖层运行 820ms 的 CSS `transform`/`opacity` 动画。末帧透明度保留 34%，避免淡成近黑画面；动画覆盖层不重复读取通行密钥状态。只在动画结束后揭开 Workbench 和提醒。自定义动画仍使用原 View Transition/SLOT 路径。

源码与构建：认证反馈/转场回归 5/5、`pnpm typecheck`、`pnpm build:web`、`git diff --check` 通过。`pnpm check:workspace` 仍失败于 11 项仓库级既存问题：两条职责注解指向缺失目录、包目录 JSON/Markdown 清单过期、四条归档截图链接缺失、一份中文开发文档缺少英文配对入口、两条文档链接指向缺失目录；与本批登录代码无关。

ChatGPT 内置浏览器：当前构建实际加载 `http://127.0.0.1:3000/work`。桌面 1355×925 与窄短屏 390×640 均通过退出/重新登录；动画期间可读到 `data-lfaa-auth-entry-animation="builtin"`、工作台隐藏门控、`aria-hidden=true` 与 `inert`，动画结束后这些门控清理并显示完整工作台。桌面文档滚动宽度 1345/1355；窄屏 380/390，均无横向溢出。首次配置提醒只在动画后出现；仅临时点“稍后再说”关闭当前弹窗，未写入任何偏好。截图在本轮内置浏览器中捕获。帧间隔/超过 50ms 主线程长任务未测（IAB 页面评估接口不暴露 Performance API）；自定义插件、Reduced Motion 开关、真实桌面 WebView 和低端设备未测。

<a id="98-输入框窄栏响应式-20261017"></a>

## 98-输入框窄栏响应式-20261017

目标：参考用户提供的紧凑“更多”操作菜单，把关联应用和 Skill/提示词/专家选择收进纵向菜单，避免两个长选择器挤压输入框底栏。请求审批、模型、语音和发送继续常驻且可达；选择器继续使用原有关联合同。

Owner 与边界：`packages/client/ui-chat` 持有聊天输入区结构和样式；工作台只提供真实可用宽度。沿用 Session 关联与 Permission Owner，不改权限语义、关联语义、数据写入或模型行为。

设置盘点：不新增设置项；继续使用设置中心已有主题、字体、字号、外观和减少动态效果令牌，不覆盖用户偏好。

验收：运行 `client-ai-work-composer-responsive.test.mjs`、ui-chat 构建、Web 类型检查与构建、`git diff --check`；ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/work`，在常用桌面视口及窄中间列检查紧凑底栏、纵向菜单、选择交互、横向溢出和操作可达性。记录实际视口与无法覆盖范围，不以源码或构建检查代替实页验收。

实施记录（2026-10-17）：最初尝试在窄栏里压缩和换行两个常驻选择器；收到“更多”菜单参考图后，改为底栏保留附件、权限、更多、模型、语音和发送，两个关联入口放入纵向菜单，再分别进入原多选器。定向回归 5/5、ui-chat 构建、客户端类型检查、Web 生产构建及 `git diff --check` 通过；ChatGPT 内置浏览器控制器启动失败（`目录名称无效 (os error 267)`），所以实际页面与桌面/窄视口目视验收未完成；帧时间未测。新增仅两个本地 React 状态，无请求、订阅、计时器或观察器；未新增设置，沿用主题令牌与 Session 关联合同。

<a id="lfaa-modal-stacking-theme-repair-20261017"></a>

## 99-弹窗叠层与主题修复-20261017

目标：首次登录时默认凭据提醒与首次配置提醒不得同时显示；凭据提醒使用工作台现有主题、字体、对比度和弹窗效果，保证标题/正文/按钮清晰，并适配窄屏和短屏。

Owner 与边界：`ui-renderer` 保留认证提醒的读取与确认状态；`ui-layout` 把凭据提醒状态及原有回调传给 `SetupReminder`，由该组件复用同一个 Modal 呈现两类提醒；`SetupReminder` 继续独立判断首次配置条件、设置开关和当日暂停。不得改认证、提醒写入、账户数据或其他弹窗语义。

设置盘点：不新增或写入设置。复用 `general.defaultAdminCredentialReminderEnabled`、`general.setupReminderEnabled`、`general.dialogMotionEffect`，以及 Appearance 的主题、强调色、字体/字号、对比度、壁纸表面透明度/模糊和减少动态效果映射。

验收批次：单批完成弹窗排队、主题表面/文字/按钮修复及窄屏布局；立即运行直接相关的客户端类型检查、ui-layout/Web 构建、`check:workspace` 和差异检查，再用 ChatGPT 内置浏览器打开按当前仓库启动器运行的源码 Web，在桌面与窄屏/短屏检查首次配置弹窗不与凭据提醒重叠、凭据提醒文字对比、按钮可达及切换后首次配置提醒按原配置出现。只进行认证和界面查看，不保存真实账户设置、不确认或永久关闭提醒；记录实际地址、视口、截图和帧时间未测项。

实施记录（2026-10-17）：`pnpm build:web`、`git diff --check` 通过；为 `ui-settings-general` 补齐其对 `ui-primitives` 的既有直接依赖并同步锁文件。`pnpm check:workspace` 中该依赖问题已消失，仍有 11 项与本弹窗无关的全仓问题：两条职责注解指向缺失目录、包目录 JSON/Markdown 清单过期、四个归档截图链接缺失、一个中文文档缺少英文配对入口、两条文档链接指向缺失目录。

ChatGPT 内置浏览器验收：使用当前源码构建和 `pnpm lfaa web --no-local-daemon`，实际地址 `http://127.0.0.1:3000/work`，当前数据目录 `E:\lfaa1\lfaa\data`。桌面视口 1355×925：默认凭据提醒单独显示，标题与正文清晰，按钮和壁纸下的半透明/模糊表面符合工作台主题；截图已在本轮内置浏览器输出。窄屏短屏 390×640：凭据弹窗宽约 356px、左右留白约 12px，按钮完整可达，无横向溢出；点“前往设置中心”后不保存设置，返回 `/work` 后首次配置提醒单独显示，窄屏弹窗约 364×476px、操作区完整可见，截图已在本轮内置浏览器输出。测试后刷新回凭据提醒并保留页面供查看。只读检查 `general.defaultAdminCredentialReminderEnabled`、`general.setupReminderEnabled`、`general.dialogMotionEffect` 和现有 Appearance 映射；未写入设置、未点击任何提醒关闭/延后按钮，未测帧时间及 Desktop。

追加验收批次：修复弹窗入场时先透出底层文字、之后才呈现完整模糊效果的问题。动效根因在共享 Ant Design 入场透明度，因此让所有弹窗面板在入场时保持最终不透明度，由 `general.dialogMotionEffect` 继续控制轻量位移/缩放，由 `appearance.advanced.reducedMotion` 控制减弱/静态行为；退场效果保持原样。凭据玻璃面板继续读取 Appearance 壁纸表面透明度和模糊映射；不写入或重置设置。添加共享 CSS 合同的直接回归；用 ChatGPT 内置浏览器观察默认凭据提醒初始帧到稳定态，并在桌面及窄屏/短屏核实面板、文字和按钮。不得改变提醒确认或账户数据。

实施记录（2026-10-17，弹窗透明度批次）：`ui-theme/common.css` 将 fluid/fade/lift 入场动画收敛为 transform-only，并在 Ant Design `zoom-enter`/`zoom-appear` 初始类阶段固定面板 `opacity:1`；遮罩淡入、退场动画、`general.dialogMotionEffect` 选项和 `appearance.advanced.reducedMotion` 优先级保留。凭据弹窗仍使用 `--settings-background-surface-opacity` 与 `--settings-glass-blur`，没有新增或写入设置。定向 CSS 回归 1/1、`pnpm typecheck`、`pnpm run build:web`、`git diff --check` 通过；产物 `dist/apps/web/assets/render-CE5fGKKH.css` 含稳定不透明入场规则及凭据表面令牌。`pnpm check:workspace` 仍失败于 10 项既有问题：两条职责注解指向缺失目录、包目录 JSON/Markdown 清单过期、4 个归档截图缺失、两条文档链接指向缺失目录。

ChatGPT 内置浏览器：实际路由 `http://127.0.0.1:3000/work`，桌面 1355×925 加载 `render-CE5fGKKH.css`；当前视图显示首次配置存储提醒而非默认凭据提醒，因此本轮无法目视凭据玻璃弹窗本身。共享规则在 CSSOM 确认为 `opacity: 1 !important`；首次配置弹窗在桌面和 390×640 窄短屏均完整显示标题、正文和按钮，稳定态未见底层文字穿透；浏览器最后恢复默认尺寸。只读读取账户设置映射为 `dialogMotionEffect=fluid`、`reducedMotion=system`、背景表面透明度 65%、模糊 14px；没有更改设置。凭据玻璃弹窗本身、帧时间未测。

实施记录（2026-10-17，共享弹窗批次）：`Workbench` 移除独立凭据 Modal，把凭据文案与原回调作为 `priorityPrompt` 交给现有 `SetupReminder`；首次配置和凭据提醒现在共用一个 Modal、标题区、内容卡片、主按钮、短屏滚动及外观样式。首次配置检查/当日暂停/关闭设置仍在 `SetupReminder`；凭据状态仍由 Renderer 管理，保留“前往设置中心”和“稍后再说”原行为。壁纸时共享面板读取 Appearance 的表面透明度和模糊令牌，没有新增或写入设置。

定向认证与提醒回归 6/6、`pnpm typecheck`、`pnpm run build:web`、`git diff --check` 通过。`pnpm check:workspace` 仍有 10 项既有清单/归档截图错误：两条职责注解缺失目录、JSON/Markdown 包清单过期、4 个历史截图不存在、2 条包目录链接失效。

ChatGPT 内置浏览器验收：从当前源码构建启动正式 Web，实际地址 `http://127.0.0.1:3000/work`。默认凭据提醒桌面视口 1240×925：单个 480×457 Modal，主按钮与“稍后再说”均可见；CSSOM 表面为 65% 透明度及 14px 模糊。窄屏短屏 390×640：Modal 356×449，左右各 12px，按钮在边界内，正文完整且无横向溢出。点击“前往设置中心”到 `/settings`，未保存设置；经设置页原返回入口回 `/work` 后首次配置提醒单独出现，390×640 下 Modal 356×497、主操作与三枚提醒按钮完整可达。随后恢复默认 1240×925 视口并留在 `/work`；桌面与窄屏截图见本批内置浏览器输出。设置未改写，未点击“稍后再说”或持久关闭提醒；未测帧时间及 Desktop。

追加验收批次：默认凭据提醒复用现有 `SetupReminder` 的同一 Modal、内容卡片、主操作按钮和响应式样式，移除 `Workbench` 中的重复 Modal/CSS；`ui-renderer` 仍持有凭据提醒状态，`ui-layout` 仅传递状态和原有回调。首次配置提醒的读取、关闭、当日暂停及全局关闭语义保持不变；凭据提醒保留“稍后再说”和打开安全设置行为，不增加或写入提醒设置。先运行相关回归、类型检查与 Web 构建，再在 ChatGPT 内置浏览器桌面及窄短屏检查两类提醒的布局、按钮和互斥状态；不通过点击关闭/延后动作改变真实账户提醒状态。

追加批次 G：改善账户安全提醒的重复弹窗体验。继续复用同一 `SetupReminder` Modal；增加“今日不再提醒”（按账户与本地日历日保存在浏览器，第二天自然恢复）、“不再提醒”（经 Settings Owner 保存 `general.defaultAdminCredentialReminderEnabled=false`）并保留“稍后再说”（现有 Account Owner 确认语义）及前往安全设置。关闭设置只在保存成功后生效，失败时保留弹窗并显示错误；当日暂停不确认/清除服务端凭据标记，也不影响首次配置提醒的暂停状态。允许修改 `ui-renderer/App.tsx`、`ui-layout/Workbench.tsx`、`ui-settings-general/SetupReminder.tsx`、其当日提醒状态 helper、相关直接回归、受影响包 README 与本合同/索引；不改 Account API/数据库凭据状态，不写真实账户偏好，不改首次配置提醒语义。读取和复用现有 `general.defaultAdminCredentialReminderEnabled`、`general.dialogMotionEffect` 与 Appearance 主题/字体/字号/对比度/玻璃模糊/透明度/减少动态效果映射；不新增设置。

验收批次 G：运行账户提醒/共享弹窗直接回归、客户端类型检查、正式 Web 构建和 `git diff --check`；检查 workspace Gate 并准确记录既有失败。自行确认正式 Web 当前源码指纹后，用 ChatGPT 内置浏览器访问 `/work`，在桌面及 390×640 窄短屏检查按钮换行、操作可达、无横向溢出和同一 Modal 外观。不得点击“今日不再提醒”或“不再提醒”写入真实浏览器/账户偏好；这些写入行为由隔离回归验证。记录页面、视口、交互、截图及帧时间、Desktop、真实账户持久化等未测边界。

实施与验收记录（2026-10-18，批次 G）：账户安全提醒继续复用唯一 `SetupReminder` Modal，新增“今日不再提醒”和“不再提醒”，保留“稍后再说”及“前往设置中心”。当日暂停按账户及本地日期写入独立浏览器键，第二天自动恢复；设置保存关闭继续使用 `general.defaultAdminCredentialReminderEnabled`，失败时保留提醒并显示错误。验收过程中补正暂停后的队列切换：安全提醒不再展示后，普通首次配置提醒能够使用自身标题、文案和操作，不沿用安全提醒内容。`node --import tsx --import ./register-package-loader.mjs --test tests/client-auth-feedback-layout.test.mjs` 7/7、`pnpm run typecheck`、`pnpm run build:web`、`git diff --check` 通过。Web 构建保留现有超过 500KB 的 C++ chunk 提示。`pnpm run check:workspace` 未通过，仍报 10 项既有问题：两条职责注解指向缺失目录、JSON/Markdown 包目录清单过期、4 张历史验收截图缺失、两条文档链接指向缺失包目录。

ChatGPT 内置浏览器验收：从当前源码构建启动隔离数据服务 `http://127.0.0.1:56444/work` 与 `http://127.0.0.1:56445/work`，未更改真实账户。最新构建在 1355×925 下显示 480×457 弹窗，三个操作横向完整且无页面溢出；390×640 下弹窗约 356×489，三个按钮全部可见、操作区换行且无水平溢出。点击“今日不再提醒”后，账户安全提醒消失并显示普通首次配置存储提醒；在另一隔离来源点击“不再提醒”后，进入 `/settings?section=notifications` 确认“默认账户安全提醒”状态为“已关闭”。截图已在本轮内置浏览器验收输出记录。帧时间、打包 Desktop、真实账户持久化未测；隔离账户保存结果仅证明 Settings Owner 保存链路。

追加批次 H：修复账户安全提醒“前往设置中心”没有进入安全分类的缺陷。沿用 `ui-renderer` 清除当前提醒状态，导航目标由 `ui-layout/Workbench` 指定为 `security`，`SettingsPage` 对挂载后的有效入口分类变化更新当前分类并同步地址；首次进入设置时仍使用相同 `security` 入口。不得调用“稍后再说”的 Account 确认，不得写入提醒开关或任何账户/认证数据。允许修改 `packages/client/ui-renderer/src/App.tsx`、`packages/client/ui-layout/src/Workbench.tsx`、`packages/client/ui-settings/src/SettingsPage.tsx`、提醒/路由直接回归、受影响包 README 与本合同/索引。

验收批次 H：直接回归检查 Workbench 将安全分类请求传到 SettingsPage，以及 SettingsPage 响应分类请求并同步 URL；运行客户端类型检查、受影响 UI 包/Web 构建和 `git diff --check`。ChatGPT 内置浏览器从已挂载的 `/settings?section=appearance` 点击提醒主按钮，确认安全分类可见且路由已更新；不得提交用户名/密码、保存提醒偏好或确认凭据状态。记录真实路由、视口及未测边界。

批次 H 根因（2026-10-18）：`App` 的 `onOpenCredentialSettings` 仅调用 `routeTo("/settings")`，丢失安全分类目标；并且 `SettingsPage.activeSection` 只在挂载时读取入口，因此已在设置页时即使入口分类变化也不会切换。现由 Workbench 为每次安全设置请求发出带序号的分类请求，已挂载的 SettingsPage 切到 `security` 并同步 URL；提醒由共享弹窗的路由动作关闭，没有调用“稍后再说”的账户确认。

实施与验收记录（2026-10-18，批次 H）：定向源码回归 8/8、客户端类型检查、Renderer/Layout/Settings 包构建、正式 Web 构建及 `git diff --check` 均通过。Web 构建保留既有 C++ chunk 超过 500KB 提示。内置浏览器在 `http://127.0.0.1:3000/settings?section=appearance`、1240×925 视口中点击“前往设置中心”；实际地址更新为 `/settings?section=security`，安全分类选中，安全页的登录用户名、密码修改、恢复密钥和通行密钥内容可见。截图确认提醒浮层已关闭。未提交用户名/密码，未保存提醒偏好或确认凭据状态。首次从工作区打开设置、`pnpm run check:workspace`、窄屏/短屏、帧时间、Desktop 和真实凭据修改流程未在批次 H 验收。

追加批次 I：账户安全高优先级提醒继续复用唯一 `SetupReminder` Modal，明确提供“更改”和“不更改”两种决定。“更改”进入安全分类，不自动修改用户名或密码；“不更改”保存已有 `general.defaultAdminCredentialReminderEnabled=false` 并保留当前凭据，之后不再弹出凭据提醒；继续保留“今日不再提醒”和“稍后再说”的既有独立语义。只优化该提醒的弹窗尺寸、标题居中和主操作层级，不影响普通首次配置弹窗。延续 `general.dialogMotionEffect`、`appearance.advanced.reducedMotion`、主题/强调色/字体字号/对比度和壁纸表面透明度/模糊的现有映射，不新增 CSS 自定义属性或设置。允许修改 `packages/client/ui-settings-general/src/SetupReminder.tsx`、`packages/client/ui-layout/src/workbench.css`、弹窗直接回归及本合同/索引。

验收批次 I：直接回归确认“更改”仅导航到安全分类，“不更改”只保存现有凭据提醒开关、不写用户名或密码，优先提醒专属样式不影响普通配置弹窗；运行客户端类型检查、ui-layout 构建、正式 Web 构建、`pnpm run check:workspace` 和 `git diff --check`。在 ChatGPT 内置浏览器 `/work` 以 1240×925 和 390×640 检查弹窗层级、选择按钮与辅助操作可读可达、无横向溢出；不点击会保存提醒偏好的“不更改”，不提交任何凭据。记录设置只读值及帧时间/桌面端未测项。

追加批次 J（用户扩展范围）：为所有 Ant Design Modal 与确认弹窗建立一致的表面、文字、尺寸和滚动基础，沿用各业务弹窗已有的专属内容布局；将 Workbench 已解析的主题、强调色、字体字号、对比度、壁纸表面透明度/模糊和背景存在状态同步到 `body` Portal，使其跟随外观设置，不再靠写死深色弹窗颜色。同步修订外观页说明。普通背景与 Wallpaper Engine 专属浮层继续由各自已存在的 Appearance/插件令牌控制。不得改变提醒语义、设置值、插件行为或业务弹窗内容。允许修改 `ui-layout/Workbench.tsx`、`ui-layout/workbench.css`、`ui-theme/common.css`、`ui-settings/SettingsPage.tsx`、相关包 README、弹窗直接回归及本合同/索引。

验收批次 J：用直接回归覆盖主题令牌同步、body Portal 浅/深主题、壁纸透明度/模糊读取、通用弹窗窄屏宽度/短屏滚动和局部业务样式可覆盖；运行客户端类型检查、相关包构建、正式 Web 构建、workspace Gate 与 `git diff --check`。在 ChatGPT 内置浏览器 `/work` 检查当前账户主题下凭据提醒；用浏览器视口能力覆盖 390×640 并恢复原尺寸，另检查当前主题 CSS/DOM 令牌到 Portal 的实际映射。不得切换或保存真实用户主题、提醒、账号或其他偏好；未实测的另一个主题/设备需如实列出。

实施与验收记录（2026-10-18）：批次 I 将“更改”接到安全设置分类，将“不更改”接到既有凭据提醒开关且不触碰账号字段，保留“今日不再提醒”和“稍后再说”的原有语义；批次 J 为通用 Ant Design Modal/确认框补齐统一表面、文字、滚动和响应式规则，Workbench 把已解析 Appearance 令牌同步到 body Portal，壁纸弹窗使用外观中的表面透明度/模糊，Wallpaper Engine 活跃时仍读取插件浮层令牌。设置值、账号和提醒操作均未提交。

直接回归 `apps/cli/tests/client-auth-feedback-layout.test.mjs` 通过 10/10；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-theme`/`lfaa-client-ui-layout`/`lfaa-client-ui-settings` 构建、`pnpm run build:web`、`git diff --check` 均通过。Web 构建仅报告既有 C++ chunk 501.30 kB 超出 500 kB 提示。`pnpm run check:workspace` 仍有 10 项既有错误：两个包 Owner 注释指向不存在目录、包 JSON/Markdown 清单陈旧、四张历史截图缺失及 `docs/harness-packages.md` 两个失效链接。

内置浏览器 `/work` 当前登录页以 1240×925 检查深色主题，body Portal 与 Workbench 均解析为深色，弹窗表面透明度 65%、模糊 14px，弹窗 640×528，页面无横向溢出；390×640 下弹窗 356×539、操作按钮纵向排列、文案与底部按钮可见、页面无横向溢出。实点“更改”后进入 `/settings?section=security`，安全页已显示且弹窗关闭；未填写或提交任何账号字段。视口已恢复 1240×925。未切换真实主题偏好，因此浅色/跟随系统仅由共享 Appearance 令牌和主题同步代码覆盖，未做浏览器实切验收；未测其他设备及帧时间。

<a id="lfaa-auth-transition-completion-gate-20261017"></a>

## 100-登录动画完成门控-20261017

目标：登录成功后，工作台页面、凭据提醒及首次配置提醒必须等当前登录转场完整结束后才显现；改善登录品牌到工作台的连续衔接。错误登录、恢复密码失败、会话恢复与减少动态效果的语义不变。

Owner 与边界：`ui-renderer` 持有认证转场状态、目标页面提交与完成信号；`ui-settings-account/AuthView` 继续持有 `auth.transition` Slot Outlet，且自定义动画贡献在 View Transition 完成前保持挂载；`ui-layout/Workbench` 仍持有工作台品牌和提醒显示，转场期间不得露出业务内容或弹窗。沿用 `docs/development/auth-transition-plugins.zh.md`。不改账户、会话、插件生命周期或提醒确认语义。

设置盘点：沿用 `appearance.advanced.reducedMotion`（`system|on|off`）和 `appearance.advanced.authTransitionPluginId`（默认 `builtin`，自定义 ID 来自已装配 `auth.transition`）；品牌、主题和背景沿用 Appearance 共享映射。不新增设置，不写入/重置偏好。

允许：仅修改 Renderer 转场阶段门控、AuthView 动画层、Workbench 首屏预热回调/转场期可见性与提醒显隐、登录转场样式及直接回归/插件合同。本地内置浏览器可退出后用当前已有账户重新登录；不确认/关闭默认凭据提醒，不操作其他账户数据。禁止：改变认证 API/会话或插件安装状态，触发其他设置写入，提交/发布或覆盖无关工作。

验收批次：默认动画不对完整页面启动 View Transition。登录覆盖层保持全屏背景，仅以约 820ms `opacity` 淡出；只有小面积登录卡片做 `translateY` 轻移，不缩放全屏背景。Workbench 在覆盖层后以 `visibility:hidden`/不可交互状态预热，动画完成后由同一次 React 更新卸载覆盖层并解除门控，避免内容提前露出或多一帧闪现。自定义动画继续使用现有 View Transition 插件合同。每批运行认证转场定向回归、客户端类型检查和正式 Web 构建；在当前 ChatGPT 内置浏览器 `http://127.0.0.1:3000/work` 退出/登录实测桌面视口与 390×640 窄短屏，确认内容与提醒始终隐藏到动画结束，页面随后完整可用、无溢出，并记录截图和帧时间/设备边界；若无法获得可靠帧时间数据，应标为未测，不以静态分析代替实测。当前仅验收已装配默认动画；若没有自定义插件或无法切换减少动态效果，不改变偏好并明确记为未测。不得把源码或构建结果冒充浏览器验收。

实施记录（2026-10-17）：内置动画已改为全屏透明度合成 + 登录卡片小范围位移，不再缩放整张壁纸；动画结束事件只请求 Renderer 切换到 idle，由同一 React 提交卸载覆盖层并解除工作台可见性门控。`node --import tsx --import ./register-package-loader.mjs --test tests/client-auth-feedback-layout.test.mjs` 5/5、`pnpm typecheck`、`pnpm run build:web` 与 `git diff --check` 通过。正式资产 `render-Cb3WJz2H.css` 的 HTTP 200 内容与 `dist/apps/web` 构建文件一致。ChatGPT 内置浏览器 `http://127.0.0.1:3000/work` 以 1355×925 和 390×640 完成退出/登录：认证阶段覆盖层存在时工作台门控为 true；动画结束后覆盖层和门控均清除，首次配置提醒随后显示；窄屏 `scrollWidth=380`、视口宽 390，无水平溢出。设置只读核对为 `authTransitionPluginId=builtin`、`reducedMotion=system` 且系统减少动态效果关闭；登录背景使用现有“林间桥影”偏好。窄屏测试只点“稍后再说”临时收起首次配置提醒，未保存提醒偏好。`pnpm check:workspace` 仍有 10 项：两条职责注解缺失目录、包目录 JSON/Markdown 清单过期、4 个归档截图缺失、两条包链接失效。帧时间、实体设备与自定义动画插件未测。

<a id="lfaa-plugin-inspection-modal-layout-20261017"></a>

## 101-插件来源弹窗布局-20261017

状态：已实现并完成实页验收（2026-10-17）。

目标：修复 `/plugin-manager` 添加插件弹窗内来源检查卡片右溢出、NPM 固定来源/摘要长串横向溢出，以及不兼容告警宽于卡片的问题；长内容应在卡片内换行，短屏仍由弹窗正文滚动承载。

入口与 Owner：Web/Desktop 共用 `/plugin-manager` 由 `packages/client/ui-plugin-manager` 持有；来源检查真实结果仍来自现有 API 和 `packages/boot/plugin-manager`，本批仅调整客户端展示结构与样式，不修改来源解析、检查或安装 Owner。

设置盘点：不新增设置，不写入账户偏好。继续沿用 Appearance 的主题、字体/字号、对比度、壁纸表面透明度与模糊、减少动态效果共享映射；registry 选择仍为单次检查参数，不持久化。

允许：修改 `packages/client/ui-plugin-manager/src/PluginManagerPage.tsx/.css`、`apps/cli/tests/plugin-manager-ui.test.mjs` 和本合同/任务索引；只有需要同步包内真实 UI 合同时才改对应 README。

禁止：修改插件来源/API/安装/Runtime/权限行为；点击“开始安装”“保存隔离副本”“立即启用”、停用或卸载；保存/重置任何用户设置；重启现有服务、提交或发布；覆盖登录动效等已有脏工作。

验收批次：单批修正 inspection 卡片的显式单列收缩、固定来源元数据专属样式及告警框内收缩，再运行 `plugin-manager-ui.test.mjs`、`pnpm typecheck`、ui-plugin-manager/Web 构建、`pnpm check:workspace` 与 `git diff --check`。在 ChatGPT 内置浏览器实际页面只读检查来源结果：桌面 1355×925、窄短 390×640，卡片标题/状态、固定来源长串、SHA、兼容告警均不超出边框，页面及弹窗无横向溢出、短屏滚动和关闭按钮可达。来源检查不得进入安装阶段；记录实际路由/视口/截图及未测设备、帧时间范围。

实施记录：`plugin-manager-ui.test.mjs` 新增卡片溢出回归；`PluginManagerPage.tsx` 为固定来源/摘要列表提供专属 class；CSS 为 Modal 内容与检查卡片声明 `minmax(0, 1fr)` 轨道、允许长串任意断行，并把告警框保持为 Ant Design 原有 flex 布局。此前 `.inspection > div:last-of-type` 因 Ant Alert 根节点也是 `div` 而命中告警框，已由专属元数据选择器移除歧义。没有增加设置或 CSS 自定义属性。

源码与构建：定向 UI 回归 7/7、`pnpm typecheck`、`pnpm --filter lfaa-client-ui-plugin-manager run build`、`pnpm run build:web`、`git diff --check` 通过；插件包产物位于根 `dist/packages/client/ui-plugin-manager/`。`pnpm run check:workspace` 未通过，报告 10 项全仓既存问题：两个职责注解指向缺失目录、JSON/Markdown 包目录清单过期、四张历史验收截图缺失、两条指向缺失包目录的文档链接。构建有既有大 chunk 提示。未运行 `workspace-preflight`（仓库未声明该脚本）。

ChatGPT 内置浏览器：当前源码工作区 Web 进程 PID 23680 监听 `127.0.0.1:3000`，页面 HTTP 200；构建后刷新原服务，无重启。`/plugin-manager` 以用户截图中的 `dsh-plugin-whale-pet` 执行只读来源检查，结果仍显示“安装后保持隔离”；仅检查了来源，Profile 清单仍为 0 项，未按“保存隔离副本”或其他生命周期按钮。桌面视口 1355×925：文档 `scrollWidth=1345`；检查卡片 `607/607px`，固定内容区 `577/577px`，告警 `577/577px`，均在边界内。窄短屏 390×640：文档 `380/390px`，Modal 宽约 352px；来源检查卡片 `255/255px`，告警 `223/223px`；弹窗正文 `scrollHeight=1169px`、`clientHeight=530px`，滚动到末端后隔离按钮可见，关闭按钮保持在可视区。截图见本批内置浏览器输出。未测实体设备、桌面 WebView 和帧时间。

<a id="lfaa-content-storage-separation-20261017"></a>

## 102-系统与内容存储分离-20261017

历史状态（2026-10-18）：本节中“业务内容默认与系统根相同”及“系统数据根迁移”的方案已被 107 合同废止。当前规则为系统数据根与业务 `data` 根独立，只有业务内容受管子树参与迁移；以本文件 107 合同为准。

目标：系统数据根保持当前 `LFAA_HOME/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`，并继续尊重部署显式设置的 `LFAA_DATA_DIR`）；账户、AI Provider/凭据、登录状态、设置、AI 对话与会话不随内容位置变化。新增独立业务内容根，只服务 Minecraft/Steam 游戏内容、小说 Writing 项目、AI 漫剧项目及媒体资产。推荐根根据当前仓库/安装根动态解析为其 `data` 子目录；自定义选择器返回用户所选完整目录，不附加第二个 `data`。内容根配置保存在系统数据 Owner 中，首次默认与系统数据根相同；更改内容根不迁移系统文件，嵌套重叠路径拒绝。

Owner 与边界：`settings/settings` 的项目存储 Owner 持有内容根解析、保存、历史回读候选及 Writing/漫剧目标；游戏域 Owner 继续持有每个游戏实例/节点的真实路径，Daemon 只执行登记的实例路径。`workspace/data-directory`、`LFAA_DATA_DIR` 与系统数据库路径保持原有解析；业务内容根首次默认指向系统根，保存业务选择不会更改系统根。既有作品、漫剧和实例不移动、不复制、不删除；切换后新内容写入所选内容根，旧内容由原路径记录/候选继续读取。工作流、知识库、账户资源、AI 配置、会话、凭据、日志、运行环境和下载缓存仍归原 System/Domain Owner，不能顺带迁移或写进内容根。插件安装、适配副本和插件私有运行数据归各自 Plugin Profile/Runtime Owner，位于 `<LFAA_HOME>/profiles/<Profile>/` 下；系统数据根迁移不复制、清理或接管旧 `plugins/` 子树。系统根与内容根可以配置为完全相同，但分别由各自 Owner 管理文件；不得共享同一文件。

设置盘点：复用 `project_storage_locations` 配置记录，但新增明确的内容根字段并由 Settings API 做管理员权限、绝对路径和目录安全校验；使用现有外观令牌，不新增主题偏好。推荐根随当前 `repositoryRoot` 推导，不写死盘符。桌面 Windows 使用现有 native folder picker；Web 明确显示当前运行环境不支持原生选择时保留可用路径输入，不伪装选择成功。选择目录不得静默搬运数据。

允许：修改项目存储 Owner、Minecraft/SteamCMD 新内容默认目录解析及 Daemon 已有路径合同、Writing/AI 漫剧内容根和 legacy 读取候选、Settings API/Client/设置中心/首次存储提醒、直接长期回归、受影响 README 与存储规范及本合同/索引。禁止：更改系统 `dataDirectory` 或账户/AI Provider/会话/设置数据库，自动复制/迁移/合并 C/E 盘或任一真实用户目录，删除/覆盖旧内容，重启或结束未知服务，修改 DSH，提交或发布，覆盖与本任务无关的已有脏工作。

验收批次：A) 内容根 Owner/API/设置 UI：合成路径验证推荐根随仓库根变化、自定义完整路径、首次内容根与系统根相同，推荐根动态变化，自定义路径原样保存；设置中心可读写内容选择，不访问真实内容。定向回归、受影响类型检查和 Web 构建后，在 ChatGPT 内置浏览器 `/settings?section=workspace` 验收桌面及窄短视口；确认“不更改”保存系统默认根、“系统推荐”保存动态推荐根、自定义原样保存，三者都不改系统路径。B) Writing/漫剧：以隔离账户和临时文件验证新建/保存进入内容根、旧路径项目仍能读且不复制，系统用户数据保持原位；每批测试/构建后立即验收实际业务路由。C) 游戏：合成节点/实例验证新建目录进入内容根，既有相对及自定义绝对实例仍指向原目录，系统凭据/环境/Daemon 根保持不变；运行游戏域/Daemon 定向回归并验收游戏入口。D) 插件归属：验证插件自己的存储配置由对应 Plugin/Runtime Owner 解释，不被系统或业务内容位置覆盖；没有插件专属配置的私有运行数据随 Profile 存放；系统 data 初始化和迁移不创建/复制旧 `plugins/runtime-data`。每批记录路由、视口、操作、截图、性能证据与未测边界；所有隔离数据与 C/E 真实数据分离，不对真实目录执行写入。

续接批次 E（2026-10-18）：系统默认数据根按当前 Home/显式部署配置解析（本机默认 `C:\Users\yu\.lfaa\data`），业务内容根只服务游戏、小说和漫剧，插件安装/默认私有数据只服务当前 Profile；核对实际启动配置和设置中心展示路径，不访问、搬动或删除真实目录内容。首次内容提醒仅在 Owner 返回 `configured=false` 时显示。“不更改”保存系统默认 data 根（本机默认 `C:\Users\yu\.lfaa\data`），“系统推荐”保存当前项目/安装根下的 `data`，自定义打开设置中心。设置中心保存默认、推荐或自定义位置后，同一 Owner 持久化选择，后续启动不再提示内容位置。保存失败显示错误并允许重试，不假装确认成功。此确认只影响业务内容根，不影响系统根、账户/AI/会话和插件 Profile；不得复制或迁移既有数据。使用隔离运行数据验证选择及重复启动抑制；Web 在 `/work` 与 `/settings?section=workspace` 只读验收桌面及窄短视口，不在真实用户目录点击会持久更改路径的操作。

追加验收记录（2026-10-18）：首次读取 `127.0.0.1:3000/api/project-storage-locations` 时，正在运行的旧 Web API 未返回 `contentDirectory`、`defaultContentDirectory`、`recommendedContentDirectory`，导致页面路径空白且推荐项状态错误。启动预检确认锁 PID 属于 LFAA Web 后，以当前源码工作区的标准 `pnpm lfaa web` 重启；最终 Web PID 10748，托管 Daemon PID 544。重启后只读 API 返回当前/默认内容根 `C:\Users\yu\.lfaa\data`、推荐根 `E:\lfaa1\lfaa\data`、`configured=false`；账户与模型仍在工作台显示，未写入或迁移任何数据。

ChatGPT 内置浏览器实页验收：`/settings?section=workspace` 桌面 1240×925 显示上述默认、推荐和系统数据根；默认 radio 已选中。自定义输入可接受临时草稿 `E:\lfaa1\custom-storage-probe`，保存按钮启用；未点保存，之后恢复默认选项。Web 不能调用 Windows 文件夹选择器，设置页已明确提示输入 LFAA 控制端可访问的绝对路径；桌面版选择器入口仍由原生桥接提供，本轮未测 Desktop。390×640 下存储卡片纵向排列，输入和说明无横向溢出（文档宽 380px），轻微滚动即可看见保存按钮。`/work` 窄屏首次弹窗显示“不更改”“系统推荐”“自定义位置”“稍后再说”，并分别展示 `C:\Users\yu\.lfaa\data` 与 `E:\lfaa1\lfaa\data`；仅点击“自定义位置”确认跳转到设置页，未触发存储写入。定向回归 43/43、`pnpm run typecheck`、`pnpm run build:web`、`git diff --check` 通过；全仓 `check:workspace` 此前仍有 10 项无关清单/归档链接错误，未因本次文案变更重跑。未测 Desktop、内容实际写入与帧时间。

续接批次 F（2026-10-18）：首次内容位置弹窗必须把“是否更改 data 位置”作为显式选择；默认仍是 `%USERPROFILE%\\.lfaa\\data`（本机 `C:\Users\yu\.lfaa\data`）。“不更改”确认并保存 Owner 返回的 `defaultContentDirectory`；“更改为系统推荐”保存 Owner 动态返回的 `recommendedContentDirectory`。两者都只设置业务内容根，不移动任何文件、不修改系统根，并在成功保存后停止再次提示；自定义仍跳转配置中心。设置 Owner、持久化与已有账户设置不改。允许修改首次提醒按钮文案、对应长期回归、Workbench 装配说明和本合同。验收：以隔离 Owner 回归覆盖默认/推荐的真实写入结果和 `configured` 状态；运行定向回归、`pnpm typecheck`、正式 Web 构建与差异检查；ChatGPT 内置浏览器 `/work` 桌面与窄短屏只读确认两个按钮、路径与自定义入口，不能在真实账户点击会持久改变位置的按钮。记录现存用户数据、桌面文件夹选择器和帧时间未测。

续接批次 F 实施与验收记录（2026-10-18）：按钮明确标为“不更改”和“更改为系统推荐”；两者分别向同一内容存储 Owner 提交默认与推荐路径，原有“自定义位置”仍打开配置中心。`client-setup-storage-reminder.test.mjs` 与 `file-resources.test.mjs` 共 13/13、`pnpm run typecheck`、`pnpm run build:web` 和 `git diff --check` 通过；`runtime-build-state.mjs web` 返回 `[]`，当前 Web PID 10748 服务 `/work`。ChatGPT 内置浏览器 `/work`：1240×925 桌面视口显示两按钮及 `C:\Users\yu\.lfaa\data` / `E:\lfaa1\lfaa\data`，页面宽 1230px；390×640 窄短视口弹窗宽约 356px，页面宽 380px，两个选择、自定义入口和稍后再说均可见/可达。点击“自定义位置”只导航到 `/settings?section=workspace`；选中自定义并输入隔离草稿 `E:\lfaa1\custom-storage-probe` 后，保存按钮启用，未点击保存。截图已在验收会话中记录。没有点击真实账户的保存动作；Owner 的默认/推荐/自定义路径保存及 `configured=true` 在隔离数据回归中验证，真实用户目录写入、桌面原生选择器和帧时间未测。Web 构建保留超过 500KB chunk 警告。`pnpm run check:workspace` 未通过，仍有 10 项仓库级问题：两条职责注解指向缺失目录、JSON/Markdown 包目录清单过期、四张历史验收截图缺失、两条文档链接指向缺失包目录；这些不属于本批改动。仓库未声明 `workspace-preflight` 脚本。

续接批次 G（2026-10-18）：复核“更改为系统推荐”指向已有文件的 `data` 目录时的拒绝问题。业务内容目录由 `settings/settings` Owner 保存，推荐位置已存在且非空时允许记录为后续内容根，不调用 `workspace/data-directory` 总根迁移，不复制、覆盖或删除任何文件；系统数据根保持原值，账户、AI、会话和插件 Profile 不变。逐段核对报错对应的实际调用链和当前 Web 构建指纹，区分旧系统迁移界面/服务与当前内容位置界面；若当前源码链路已正确，则修复造成旧界面仍可见的入口/构建/服务问题，不把空目录迁移限制加到内容 Owner。允许改动内容根 Owner 的直接回归、当前 data-layout 对旧 `plugins/` 不再创建的直接断言、确有根因的 UI/API/构建接线、相关 README 与本批记录；禁止真实目录写入或迁移、修改系统根和其他数据、重启或结束归属不明的服务、覆盖其他脏工作。验收：在隔离 Owner 中预置非空推荐目录和哨兵文件，保存后确认配置指向推荐目录、哨兵内容不变、系统 data 路径不变；同时确认系统 data 目录初始化不再创建旧 `plugins/`；运行直接回归、类型、正式 Web 构建和差异检查。按仓库启动当前源码 Web，在 ChatGPT 内置浏览器 `/settings?section=workspace` 以桌面及窄短视口确认只有内容位置选择、非空推荐目标可保存且无系统迁移空目录提示；记录源码版本、路由、视口、截图和未测边界，不在真实用户账户点击保存。

批次 G 实施与验收记录（2026-10-18）：沿调用链确认，截图中的“目标目录不是空目录”只由 `workspace/data-directory` 的系统总根复制迁移校验抛出；当前 `SettingsPage` 的内容位置保存调用 `settings/settings` 的 `saveProjectContentDirectory`，该 Owner 允许非空业务目录，不调用系统迁移。截图所示的“迁移方式”区块不在当前源码页面。初始内置浏览器 `:3000` 无法访问；Web 构建指纹检查先返回 `host`，重建 Control Plane 后为 `[]`。使用正式 `pnpm lfaa web --no-local-daemon` 启动隔离服务（临时 `LFAA_HOME`、系统 data 与安装根），在临时推荐根预置 `preserve-me.txt` 后，通过 ChatGPT 内置浏览器 `http://127.0.0.1:3000/settings?section=workspace`（1240×925）选择并保存“系统推荐”：页面显示成功提示，内容根更新到临时 `install/data`，系统 data 仍是临时 `system-data`；刷新后推荐项保持选中。磁盘回读确认哨兵原文不变、目标仍只有原文件。当前页面没有系统迁移选项或空目录报错。截图已在本轮内置浏览器画面中捕获；当前 CUA 没有视口尺寸覆盖能力，未完成窄短视口实页检查；未写真实用户目录/账户。`file-resources.test.mjs` 11/11，`data-directory-settings.test.mjs` 与 `data-directory-migration-modes.test.mjs` 共 10/10（普通系统复制仍拒绝非空目标），`pnpm run typecheck`、`pnpm run build:control-plane`、`pnpm run build:web`、`runtime-build-state.mjs web` (`[]`) 与 `git diff --check` 通过。Web 保留既有 C++ chunk 超 500 KB 警告。`pnpm run check:workspace` 未通过，报告 10 项既有问题：两条职责注解指向缺失目录、包目录 JSON/Markdown 清单过期、4 张归档验收截图缺失、两条文档链接指向缺失包。仓库未声明 `workspace-preflight` 脚本。

<a id="lfaa-plugin-profile-install-location-20261017"></a>

## 103-插件 Profile 安装位置-20261017

目标：把每个 LFAA Profile 的第三方插件源码与安装清单直接放到 `<LFAA_HOME>/profiles/<Profile>`；Windows 默认示例为 `%USERPROFILE%\\.lfaa\\profiles\\desktop`。插件受控 Runtime adapter 和该插件的私有运行数据也归当前 Profile/插件 Runtime Owner 管理，默认数据位置为 `<LFAA_HOME>/profiles/<Profile>/runtime-adapters/<plugin-id>/` 与 `<LFAA_HOME>/profiles/<Profile>/runtime-data/<plugin-id>/`。若插件本身提供了存储位置配置，必须由该插件 Runtime/配置 Owner 按其配置读写；LFAA 的系统数据或游戏/小说/漫剧内容位置不得覆盖插件设置。没有专属位置配置时才使用上述 Profile 默认位置。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 均不再创建、读取、复制或作为运行入口；已有旧目录保留原状。Web/Profile 名称按实际活动值解析，不写死 `desktop`。

参考与 Owner：只读参考 `E:\\lfaa1\\deepseek-harness` 与现存 `C:\\Users\\yu\\.dsh` 的 Profile 安装理念；不修改 DSH。LFAA `launch-environment` 持有 Home/Profile 根，`plugin-manager` 持有包、清单及 Runtime adapter 生命周期，App Boot 仍持有 Profile Cordis Patch，Windows Sandbox Host 只接受受管 Profile 插件目录。插件源码目录与 Profile Patch 同层，Plugin Manager 保留清单文件并拒绝与 Profile 控制文件冲突的插件 ID；UI 显示的安装基目录为 Profile 根。

设置盘点：不新增全局插件存储设置。沿用 `LFAA_HOME`、活动 `profileContext.name`、插件自身已存在的存储配置（如果有）、Appearance 映射、现有插件管理员权限和 `permissions.mode`。`LFAA_DATA_DIR` 与业务内容根都不决定插件私有数据位置。Wallpaper Engine 的 `DSH_WE_DATA_DIR`、`DSH_WE_CACHE_DIR`、`DSH_WE_UPLOAD_DIR` 和插件设置页保存的 cache/upload 路径属于插件配置，Runtime 必须尊重显式值；只有未设置整插件数据根时，才用 Profile 私有目录作为 `DSH_WE_DATA_DIR` 默认值。

允许：修改 launch-environment 插件安装路径合同、Plugin Manager Profile 根和 Runtime 私有数据路径、Windows AppContainer Host 路径校验、data 初始化/迁移对旧插件路径的忽略、文件资源旧路径保护、直接长期回归及相关 README/文件资源规范。本用户明确要求使用真实 `dsh-plugin-whale-pet` NPM 包作为示例，可在新的 LFAA Desktop Profile 中通过现有来源核验/安装 Owner 保存其固定真实快照；不启用、不执行 DSH Host/Client 代码，界面如实标记 `incompatible`。不得写入 `.dsh`。

禁止：创建、读取、复制或删除旧 `<LFAA_HOME>/plugins` 或 `<LFAA_DATA_DIR>/plugins` 内容；移动或删除现有旧目录文件；把插件包或插件私有运行数据放进系统 data 或业务内容根；把游戏/小说/漫剧内容放进插件 Profile；覆盖已有 Profile 文件或插件版本冲突；新增重复的全局插件目录设置；启用 DSH 插件；修改 DSH、真实业务内容、用户偏好；停止/重启现有服务、提交或发布、覆盖无关脏工作。

验收批次：A) 配置与 Owner：用合成 Home/Profile 验证 desktop/web 插件包与清单分别落在 `<home>/profiles/<profile>`、Runtime 私有数据落在对应 Profile；内容根/data 根不变；`ensureDataDirectories` 不再创建 `data/plugins`，系统数据复制/ZIP 导入不复制旧插件子树，旧目录文件保持原状且文件管理器不再将其列为插件位置。运行 Plugin Manager、数据布局/迁移、文件资源、AppContainer Rust 直接回归及受影响类型/构建，然后在 ChatGPT 内置浏览器 `/plugin-manager` 桌面与窄短视口只读检查安装路径文本、状态和无溢出。B) 真实示例：通过现有来源核验/安装 Owner 写入真实固定快照到指定 Desktop Profile；核对 inventory、来源版本/摘要与真实磁盘路径；保持 `incompatible`/disabled，不调用 enable、不导入/执行 DSH 代码；同时证明 SQLite、登录、AI Provider/Session 和游戏/小说/漫剧数据目录没有因安装被迁移/覆盖。每批测试、构建后立即实页验收；记录实际路由/视口、交互、截图与未测范围。若内置浏览器无法加载本批源码版本，明确标为未验收，不重启/替换现有监听进程。

<a id="lfaa-plugin-install-guide-disclosure-20261018"></a>

## 104-插件安装引导折叠-20261018

目标：调整 `/plugin-manager` 的“添加插件”弹窗。将 NPM 包名说明、填入示例按钮和完整来源安全提醒收进可展开/收起的“插件安装引导和示例”区域；NPM 安装源选择器与展开控制在同一行，来源选择功能继续可用。收起时保留精简信任提示；来源检查结果、错误、进度、安装动作及其他来源输入行为不变。

Owner 与边界：Web/Desktop 共用安装弹窗由 `packages/client/ui-plugin-manager` 持有；Plugin Manager、来源检查 API、安装与 Runtime Owner 保持不变。本批只改展示结构、样式、直接 UI 回归、该 UI README 和本合同/索引，不更改来源识别、registry 解析/持久化、检查请求或生命周期。

设置盘点：复用现有 Appearance 主题、字体/字号、对比度、壁纸/遮罩透明度与模糊、减少动态效果映射；不新增或写入设置。NPM registry 仍是单次检查选择，不持久化。

允许：修改 `packages/client/ui-plugin-manager/src/PluginManagerPage.tsx/.css`、`apps/cli/tests/plugin-manager-ui.test.mjs`、`packages/client/ui-plugin-manager/README.md` 和本合同/任务索引。细节区按钮须键盘可用并正确暴露 `aria-expanded`/`aria-controls`；窄弹窗与短屏保持可滚动、无横向溢出。

禁止：删除或改变填入示例、安装源选择、自定义 registry 输入/安全说明、来源检查告警/详情、错误/进度/安装能力；更改 Plugin Manager/API/Runtime/权限/数据 Owner；触发来源网络检查、安装、启用、停用或卸载；改动账户或 Appearance 偏好；修改其他已有任务文件、重启/结束未知服务、提交或发布。

验收批次：唯一 UI 批次先跑插件管理 UI 定向回归、客户端类型检查、插件 UI 包构建和正式 Web 构建；构建后从当前源码工作区按仓库正式入口启动服务，在 ChatGPT 内置浏览器 `/plugin-manager` 验收添加弹窗的收起/展开与 NPM registry 并列布局、示例填充可见性、警告文案、键盘/ARIA、弹窗滚动、桌面及可达的窄短视口边界。只打开弹窗与切换细节，不请求来源检查或安装。再运行 `pnpm run check:workspace` 和 `git diff --check`，准确记录全仓既有问题；记录截图、视口和帧时间/设备等未测范围。

实现与静态验证记录（2026-10-18）：`PluginManagerPage` 为安装引导增加独立展开状态；“插件安装引导和示例”按钮用 `aria-expanded`/`aria-controls` 控制示例卡与完整安全提醒，NPM registry 控件与按钮并列，收起时仍显示简短信任提示。示例填充、自定义 registry、来源检查结果、安装进度和安装动作保持原逻辑。无新增设置或 CSS 自定义属性。`node --import tsx --import ./register-package-loader.mjs --test tests/plugin-manager-ui.test.mjs` 8/8、`pnpm run typecheck`、`pnpm --filter lfaa-client-ui-plugin-manager run build`、`pnpm run build:web` 和 `git diff --check` 通过；Web 构建有现存 C++ chunk 超过 500KB 提示。`pnpm run check:workspace` 未通过，报 10 项全仓问题：两条职责注解指向缺失目录、包目录 JSON/Markdown 清单过期、4 张历史验收截图缺失、两条文档链接指向缺失包目录。`node scripts/runtime-build-state.mjs web` 返回 `[]`；隔离 Home/Data 的正式 Web 服务 PID 696 监听 127.0.0.1:3000，`/plugin-manager` HTTP 200。ChatGPT 内置浏览器安全策略拒绝本轮对该 URL 的代理导航，故未能观察实际渲染、视口/交互或截图；已请用户在内置浏览器直接打开该地址，等待完成剩余实页验收。隔离数据根为 `%TEMP%\lfaa-plugin-guide-ui-acceptance-20261018-085050`，未触碰用户账户/偏好、插件清单或业务数据。帧时间、窄短屏、Desktop/WebView 和实体设备未测。

<a id="lfaa-appearance-theme-canvas-first-paint-20261018"></a>

## 105-外观主题与首屏画布-20261018

目标：修复设置中心“浅色/深色/跟随系统”在即时渲染或刷新后未保持的问题，并消除刷新时先出现壁纸、随后画布闪黑的交接。使壁纸遮罩、透明度和模糊呈现协调、稳定。

Owner 与设置：`settings/settings` 持久化账户 `appearance.theme`；`ui-layout/Workbench` 解析主题与系统偏好并提供共享主题/背景令牌；`ui-theme` 负责首帧提示与通用主题样式；`ui-settings` 负责控件。只复用现有 `appearance.theme`、当前路由背景、`appearance.overlay`、`appearance.blur`、`appearance.advanced.reducedMotion` 与既有字体/颜色映射；不新增配置、不重置偏好。Wallpaper Engine 如持有画布，继续由插件配置和其 Runtime Owner 控制，不覆盖其独立壁纸/玻璃设置。

允许：先查明主题事件、账户设置读取/保存、系统主题变化监听、HTML 首帧脚本、Workbench 画布接管和壁纸遮罩/模糊的实际调用链；然后只修改以上 Owner 中已证实的根因、其直接长期回归和必要 README/本合同/索引。可以更新首帧同步与工作台背景层交接，调整现有配置映射，但不得用额外全屏滤镜/全树动画或逐帧 JavaScript 补偿。

禁止：改动用户当前主题、背景选择、遮罩/模糊及其他账户偏好；写死主题替代设置、改变默认值、复制背景资产、改变 Wallpaper Engine 专属配置/Owner；顺手修改登录转场、弹窗、存储、插件或无关脏工作；新增依赖；结束归属不明的服务、提交或发布。

验收批次：A) 用定向回归覆盖浅色→深色→跟随系统、系统 `prefers-color-scheme` 变化、设置保存/回读，以及刷新首帧缓存和权威账户设置不一致时的安全交接；随后类型检查、受影响 UI 包构建和正式 Web 构建。在 ChatGPT 内置浏览器 `/settings?section=appearance` 实际核对三种主题即时效果、刷新后首帧不先闪错主题/黑底；只读使用当前设置，不点击写入偏好。B) 核对壁纸背景所有权、遮罩不透明度与模糊令牌的组合：工作台背景连续可见、主题色随配置一致，模糊只作用于现有指定表面，不对整页/整棵树重复采样。浏览器覆盖常用桌面与窄分栏/短屏，记录真实视口、交互、截图、50ms 长任务/帧时间测量与尚未测的设备/Wallpaper Engine 范围。每批在继续前完成本批定向回归、类型、构建和实页验收；如果内置浏览器工具仍只返回连接错误页，保留该批未验状态并记录已核实的本机服务/控制工具差别。最后运行 `git diff --check` 与适用工作区 Gate，并把既有 Gate 失败与本任务结果分开记录。

实现与源码验证记录（2026-10-18）：确认设置页主题按钮立即更新 SettingsPage 与 Workbench 状态；`Workbench` 解析 `system` 并监听 `prefers-color-scheme`，设置保存仍走既有 `saveSettings("appearance", ...)`。首帧画布缓存此前只保存图片，未保存 `appearance.overlay`，所以 HTML 先画无罩壁纸，挂载后再切到带账户遮罩的画布；工作台默认 CSS 遮罩/表面透明度又写成 37%，与 `DEFAULT_USER_SETTINGS.appearance.overlay=65` 不一致。修复为画布缓存 v2 保存受校验的公开图片路径和 0–75 整数遮罩；HTML 首帧用已缓存主题及同一透明度合成遮罩，并让旧 v1 缓存失效。工作台默认遮罩回退校准到现有 65% 设置；玻璃模糊仍只使用原有 `appearance.blur=14` 表面令牌，没有增加全屏模糊或动态补偿。Wallpaper Engine 持有画布时仍不缓存 LFAA 背景。长期回归执行 `node --import tsx --import ./register-package-loader.mjs --test tests/client-appearance-theme-bootstrap.test.mjs`，7/7 通过，覆盖三种主题的首帧解析、system 深浅、缓存遮罩、路由与路径校验、旧缓存失效及存储清理；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-theme run build`、`pnpm run build:web`、`git diff --check` 均通过。Web 构建写入根 `dist/apps/web/`；仍有既有 500KB 大 chunk 警告。`pnpm run check:workspace` 未通过，共 10 项：两个职责注解指向缺失目录、JSON/Markdown 包目录清单过期、4 张历史验收截图缺失、两条包目录文档链接失效；这些路径与本任务改动文件无关。

浏览器验收状态（2026-10-18）：用户在 ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/settings?section=appearance` 后，只读查看并刷新。刷新前后外观控件均显示“跟随系统”选中（强调色 #3457d5、登录背景“林间桥影”也只读核对）；当前页面及刷新后可见的设置卡片均呈深色，刷新后截图未见先亮色再转黑或画布黑屏。CUA 在刷新后曾先读到“正在读取设置…”，随后截图中页面内容已恢复；截图同时被账户安全提醒浮层遮挡，未点击浮层按钮或写入任何偏好。截图视口 1240×925，已记录于本轮内置浏览器观察。由于本轮没有连续帧/性能采样能力，不能据静态截图断言过渡期间完全无闪烁，首帧逐帧行为、50ms 长任务/帧时间、三种主题的浏览器内即时切换，以及窄分栏/短屏、Wallpaper Engine、WebView/实体设备仍未验；主题解析和首帧组合由定向回归覆盖。为落实用户先前的重启要求，尝试按 PID 696 的已登记 Web 启动命令重启；本机执行策略在命令执行前拒绝该操作，进程未停止或重启。随后只读确认 PID 696 仍监听 127.0.0.1:3000。

<a id="lfaa-notification-master-switch-and-data-root-20261018"></a>

## 106-通知总开关与数据根核对-20261018

目标：通知设置增加默认开启的总开关；关闭后抑制所有自动弹出的工作台/系统通知（含安全、首次配置、AI 完成、错误、审批与澄清提醒），但保留会话内审批和澄清内容卡及消息状态。核实 Provider 未配置提示与隔离验收数据根的关系，避免把验收路径当成产品默认路径。

Owner 与设置：General Settings/Settings Owner 持有新增 `general.notificationPopupsEnabled` 的类型、默认值、校验和持久化；SetupReminder 持有首次配置与账户安全弹窗；Workbench 持有工作台通知中心/Toast；notification-runtime 与 AiWorkChat 持有 AI 工作通知副作用。复用并保留现有各类别通知开关、`general.setupReminderEnabled`、`general.defaultAdminCredentialReminderEnabled`、声音与浏览器授权语义；不重置用户偏好。Conversation/Approval Owner 继续持有会话内卡片。产品系统 data 默认按当前 USERPROFILE 的 `.lfaa/data` 解析，推荐业务内容根按实际运行项目/安装根动态生成 `<root>/data`；隔离验收目录仅用于隔离服务，不能作为产品默认、不能覆盖真实数据或 Provider 配置。

允许：为总开关增加 Settings 控件与中英文描述、GeneralSettings 默认/校验/向后兼容合并、通知副作用统一门控、直接回归及相关包 README/本合同记录；只读检查运行中的验收服务、真实系统默认路径和 admin Provider 元数据。保留当前 PID 696 服务和验收目录，不迁移/删除/复制/覆盖任何数据，不读出密钥。

禁止：改动 Provider 账户/秘密、系统数据根或用户保存的内容路径；以测试为由改变真实通知偏好；删除或重启未知/运行中服务；抑制会话内卡片、审批/澄清工作流；更改 Wallpaper Engine 或插件通知 Owner；提交、发布。

验收批次：A) General Settings 新默认值为 true；校验要求布尔；旧客户端缺失该字段保存其他 general 值时保留已存值；类别开关仍独立持久化。B) 关闭总开关时不产生自动 Toast/通知中心项目、浏览器系统通知或声音，工作台安全/首次配置弹窗不出现，AI 审批/澄清消息卡仍留在会话；开启后现有类别与静音设置继续有效。每批运行直接回归、类型检查、受影响包构建及正式 Web 构建后，在 ChatGPT 内置浏览器 `/settings?section=notifications`、`/work` 检查桌面及窄/短视口；不修改真实账户偏好。若运行中服务无法安全热更新，明确保持浏览器批次未验，不结束 PID 696，也不新增临时数据根。最后运行 `git diff --check` 和适用 workspace Gate，区分已有错误。

核查记录（2026-10-18）：内置浏览器 `127.0.0.1:3000` 由 PID 696 的 LFAA Web 服务提供，当前进程使用 `C:\Users\yu\AppData\Local\Temp\lfaa-plugin-guide-ui-acceptance-20261018-085050` 隔离验收 Home/Data；该目录仍在使用，因此保留。该隔离数据库没有 Provider，导致 `/work` 显示“尚未配置活动 Provider”；它不是产品默认路径。**事后只读核对更正：** `C:\Users\yu\.lfaa\data` 当前不存在；原有 `E:\lfaa1\lfaa\data` 存在，其 SQLite 中 admin 的 `ai_accounts` 记录为活动状态且具有 Provider、模型和加密凭据字段，另有 2 个登录会话；未读取秘密值。先前记录称 Provider 在 C 盘 `.lfaa\data` 的结论错误，不能作为实测证据。产品默认仍应动态解析为 `%USERPROFILE%\.lfaa\data`；业务内容推荐位置使用运行时 `desktopInstallDirectory || repositoryRoot` 动态解析，因此本 checkout 的显示值为 `E:\lfaa1\lfaa\data`，没有把该盘符写死。用户要求浏览器实页验收使用原有数据后，允许仅重启已确认归属的 PID 696 并以 E 盘原有 data 做只读页面验收；隔离 Temp 数据保留，不复制、覆盖或删除真实数据。

实现与验证记录（2026-10-18）：`general.notificationPopupsEnabled` 在 General Settings 缺省为 `true`，服务端校验为布尔值；旧客户端未提交该字段时保留已存值。总开关接入工作台通知/Toast、浏览器通知与声音、首次配置/账户安全/通行密钥提示；审批与澄清会话卡片保持由会话 Owner 渲染。设置默认、旧客户端兼容及类型校验回归通过；通知运行时关闭路径确认不触发回调、浏览器通知或提示音。直接回归命令：`node --import tsx --import ./register-package-loader.mjs --test tests/settings-contract.test.mjs`（1/1），`node --import tsx --import ./register-package-loader.mjs --test tests/client-auth-feedback-layout.test.mjs tests/client-setup-storage-reminder.test.mjs`（13/13），`node --import tsx --import ./register-package-loader.mjs --test tests/client-notification-runtime.test.mjs`（1/1）。`pnpm typecheck`、受影响的 8 个包构建和 `pnpm run build:web` 通过，产物位于根 `dist/apps/web`；`git diff --check` 待本次合同更新后复核。`pnpm run check:workspace` 本次未通过：10 项目录职责注解、过期清单及缺失历史截图/包链接错误，与本合同改动无关。

续接修复（2026-10-18）：用户反馈总开关关闭后类别仍显示“已开启”，容易误以为提醒功能已丢失。保留总开关关闭全部弹出/系统提醒与提示音、会话卡片继续显示的既定语义；关闭时增加“所有弹出提醒已暂停”说明和“恢复通知”按钮，类别状态标记“总开关已暂停”，不重置类别设置或账户偏好。回归 `client-auth-feedback-layout.test.mjs`（11/11）、`pnpm typecheck`、`pnpm run build:web` 均通过。当前 `%USERPROFILE%\.lfaa` 不存在；端口 3000 的 PID 696 是此前记录的隔离验收服务，因此按用户要求不使用该临时账户/数据、不创建管理员，也不更改通知偏好。真实 admin 浏览器目视验收未运行，待正常 Home 与既有 admin 账户可用后按 `/settings?section=notifications` 及窄/短视口验收。

内置浏览器（2026-10-18）：只读打开 `/settings?section=notifications`（1240×925），刷新后展示新总开关及更新后的描述，分类项仍可见；当前隔离验收设置里的总开关已保存为关闭，因此显示“已关闭”，未切换或保存任何设置。转到 `/work` 后，隔离库因没有 Provider 显示页内“尚未配置活动 Provider”横幅；没有安全/首次配置模态弹窗。此页面属于 PID 696 的隔离 Home，不能代表真实账户 Provider 状态。未验证开关开启态的浏览器交互、窄/短屏布局及会话卡片实页；开关默认与通知副作用由上述回归覆盖。未结束或重启 PID 696，未改变 Provider、通知偏好或数据目录。

续接验收纠正（2026-10-18）：此前“保留隔离验收根”的决定已被用户最新明确请求取代。停止确认属于该隔离运行的 PID 696 后，删除唯一指定的临时验收根 `C:\Users\yu\AppData\Local\Temp\lfaa-plugin-guide-ui-acceptance-20261018-085050`（仅含 `data` 与 `home`）；不触碰 `E:\lfaa1\lfaa\data` 或其他用户数据目录。后续实页验收只使用用户指定的既有 `admin / 123456`，不创建账户。

<a id="lfaa-content-storage-migration-20261018"></a>

## 107-业务内容 data 迁移与归档-20261018

目标：设置中心的业务内容位置更改要能把已有游戏、小说和 AI 漫剧内容带到新位置，并支持系统复制覆盖、手动复制后逐项核对、ZIP 导入识别与 ZIP 导出。迁移对象只包括业务内容根中各领域 Owner 管理的内容路径，不移动/复制/覆盖系统数据库、账户、AI Provider 凭据、会话、设置、环境、缓存、日志、插件 Profile 或远程节点目录。系统账户、Provider、会话和系统设置使用单一 LFAA Home（默认 `%USERPROFILE%\\.lfaa`），并各自在 Home 下的系统分类目录保存；业务内容默认使用 Home 下单独的 `data` 子目录（默认 `%USERPROFILE%\\.lfaa\\data`）。源目录始终保留；覆盖目标前保留可恢复备份；执行后比对路径、类型、文件大小与 SHA-256，核对失败不切换生效位置。

Owner 与路径：`packages/settings/settings/src/project-storage.ts` 持有业务内容根；游戏内容由 Minecraft/SteamCMD Owner 管理，小说路径为 `users/<账户哈希>/projects/writing/`，漫剧路径为 `users/<账户哈希>/projects/aivideo/`。迁移器只复制这四类受管子树（`games/`、各账户的 Writing 与 AI Video 项目树），不得照搬同级系统数据目录。系统账户路径与业务 `data` 分别使用各自解析 Owner，不得让内容存储设置改写系统数据根。设置 API 执行认证、管理员角色和 Permission Owner 的显式用户操作授权；UI 复用当前主题、字号、动效、响应式与既有路径选择设置，不增加或重置账户偏好。

允许修改：Settings 内容存储 Owner、系统数据与业务内容路径解析、设置 API/route contract、client connection、设置中心 UI、ZIP 读写辅助脚本、相关长期回归和受影响 README/总体架构/开发合同；系统数据使用本机 `%USERPROFILE%\\.lfaa` Home 本身，不创建 `system-data` 子目录；游戏/小说/漫剧业务默认内容根为 `%USERPROFILE%\\.lfaa\\data`，系统推荐位置按当前项目/安装根动态解析为 `<root>/data`，自定义路径按用户选择使用。删除开发者页的临时存储展示及独立临时启动入口。浏览器验收只使用用户指定的现有 `admin / 123456` 测试账号；不创建任何账号或超级管理员。自动化回归只操作合成业务文件，不读取、迁移或写入真实业务内容及系统数据。

禁止：对真实用户目录或 `E:\\lfaa1\\lfaa\\data` 执行复制、覆盖、导入、导出、迁移、清理或删除；迁移系统数据/插件/远端节点；输出凭据密钥；创建新账号/超级管理员；改写用户 Provider、主题或通知设置；启动独立临时 Web 服务；杀掉归属不明的进程，提交、发布。

验收批次：A) 内容清单只发现业务根内 `games/` 与 `users/<64 hex>/projects/{writing,aivideo}/`，文件和目录均列入，符号链接、特殊文件、相交源/目标和危险 ZIP 路径拒绝；Home 的数据库、用户、凭据、会话、环境、缓存、日志、Profiles 哨兵始终不进入备份或迁移；默认系统根 `%USERPROFILE%\\.lfaa` 是 LFAA Home，默认业务根 `%USERPROFILE%\\.lfaa\\data` 是其单独子目录，系统分类目录仍受保护，推荐根动态解析为当前项目/安装根的 `data`。B) 系统复制采用同卷暂存与目标快照备份，源保留；目标已有内容按源文件覆盖、目标独有内容保留；提交前对源条目做 SHA-256 回读核验，失败保持源生效且可恢复备份留存。C) 手动复制只在内容路径清单及文件 SHA-256 核对通过后切换；ZIP 支持 LFAA 内容备份清单、data 根/单层包装目录识别，只导入业务子树并核对校验和；导出压缩包只含业务路径和版本化内容清单。D) API 限管理员并通过 Permission Owner 显式操作授权；设置页切换路径后实际使用新根，源始终保留且有覆盖备份说明。用直接回归、类型检查和相关构建核对实现；内置浏览器用现有 `admin / 123456` 测试账号只读检查 `/settings?section=workspace`，不切换路径、不触发迁移或写入真实业务内容。不得创建账号/超级管理员或启动独立临时 Web 服务。最后跑 `git diff --check` 与适用 workspace Gate，准确记录既有失败。

续接批次 H（2026-10-18）：按 DSH Home 设计收敛存储设置。系统默认根是本机 `%USERPROFILE%\\.lfaa` 本身，由 Home/账户/插件各自 Owner 管理，不创建或呈现独立 `system-data` 管理层；系统账号、Provider、会话、设置和插件 Profile 不受业务内容位置选择影响。设置中心“项目与存储”只管理游戏、小说和漫剧业务 `data` 根及游戏 Owner 的节点/实例位置，不展示系统根、系统运行目录、控制端数据库目录或系统缓存，也不为这些展示额外读取系统目录 API。默认业务路径为 `<LFAA_HOME>/data`，系统推荐路径按当前项目/安装根解析为 `<root>/data`，自定义路径使用用户选择的完整目录。保留已有内容复制/覆盖、手动核对、ZIP 导入/导出能力和游戏节点真实位置；不新增测试模式、临时账号或超级管理员。新增 `apps/cli/tests/client-project-storage-scope.test.mjs` 防止系统目录管理展示回归。验收仅用现有 `admin / 123456` 在正式源码 Web 服务只读检查，不保存目录、不触发迁移；不得启动临时测试服务或写入真实数据。

实施与验证记录（2026-10-18）：“项目与存储”移除独立系统数据位置、系统运行目录和控制端数据组，并停止额外读取系统目录设置 API；页面保留业务 `data` 选择/迁移与 Minecraft/Steam 节点实际路径。Home 解析、启动入口和默认/推荐业务根沿用本合同前文实现。存储定向回归 24/24、页面范围回归 1/1、客户端/Host 类型检查、Web 构建和 `git diff --check` 通过；Web 构建仅有现存大 chunk 警告。`pnpm run check:workspace` 未通过，报告 10 项既有职责注解、包目录清单、历史截图和包链接问题，与本批改动无关。内置浏览器未验收：当前 `%USERPROFILE%\\.lfaa` 不存在，3000 端口仍由 PID 696 的既有隔离验收服务占用；未使用该临时数据登录，未在 LFAA Home 或浏览器账户中创建账户/超级管理员，未启动替代服务或写入目录。自动化回归使用仓库已有、会自动清理的隔离 SQLite 夹具。待现有 `.lfaa` Home 与指定测试账户可用后再验真实页面。

恢复默认与临时数据清理（2026-10-18）：用户要求删除 Temp 验收数据并恢复本机默认存储。确认 `resolveHomeDirectory` 默认解析为 `C:\Users\yu\.lfaa`，`resolveDataDirectory` 默认系统根为该 Home，`project-storage` 的无保存配置默认业务根为 `<LFAA_HOME>/data`；当前进程环境与仓库 `.env` 均无 `LFAA_HOME`/`LFAA_DATA_DIR` 覆盖。停止已核实监听 3000 的 LFAA Web PID 696，删除上述精确验收根，并创建空目录 `C:\Users\yu\.lfaa` 与 `C:\Users\yu\.lfaa\data`；未创建 `system-data`、账户或管理员。路径回归 `tests/data-directory.test.mjs` 与 `tests/data-directory-settings.test.mjs` 通过（11/11）。真实浏览器验收未运行：默认 Home 原先不存在且没有可供登录的既有 admin；为遵守禁止创建管理员的要求，没有重启服务。

<a id="lfaa-shared-dialog-visual-unification-20261018"></a>

## 108-共享弹窗视觉收敛-20261018

目标：把 Web/Desktop 共用 Client 的普通对话框收敛为一致、紧凑的表面和布局；首次配置与账户安全提醒改用单一标题和简洁内容结构。保留各弹窗原有交互、业务内容、确认顺序和响应式滚动；文件审查等全屏/宽型工作弹窗仍可保留内容所需尺寸。

Owner 与设置：共享外观由 `packages/client/ui-theme/src/common.css` 持有；Workbench 只提供主题令牌和对话框动效；业务包继续持有自己的表单与操作。复用 `appearance.theme`、强调色、界面/内容字体与字号、对比度、壁纸表面透明度/模糊、`appearance.advanced.reducedMotion` 及现有 `general.dialogMotionEffect`；不新增偏好，不改变已有选择。

允许：修改共享 Modal/确认框基础样式、首次配置/安全提醒组件及其必要样式、对应既有 UI 回归、`ui-theme`/`ui-layout` README、本合同和索引。仅统一通用边框、表面、标题/正文/操作区间距、关闭按钮、按钮和窄短屏约束；保留按内容定义的宽度/高度、全屏审查区、错误告警与表单内部布局。删除首次配置/安全提醒顶部重复的欢迎/类别介绍和重复大标题，使 Modal 标题承载唯一主标题。

禁止：改变提醒策略、总开关、账户安全“更改/不更改”和当日暂停操作、内容位置选择/持久化、Modal 打开/关闭/确认行为、权限与数据 Owner；改变 Appearance 或 General 用户偏好；引入新颜色/间距 CSS 变量、依赖、GSAP 或新的浮层系统；创建测试账户/超级管理员、改动真实数据、结束归属不明服务、提交或发布。

验收：定向 UI 回归覆盖提醒原有操作仍在、提醒单一标题、共享 Modal 主题/字号/壁纸/动效映射及窄短视口可滚动；运行相关类型检查和 `ui-theme`、`ui-layout`、Web 构建及 `git diff --check`。按当前源码工作区正式启动 Web，在 ChatGPT 内置浏览器 `/work` 检查提醒弹窗，以及一个普通表单/确认弹窗；检查桌面和窄/短视口的统一外框、滚动和按钮可达，不保存设置或触发内容/权限副作用。记录截图、路由、视口、源码/构建结果与浏览器工具限制；未完成实页检查不得记为通过。

<a id="lfaa-ai-work-timer-render-isolation-20261019"></a>

## 109-AI Work计时渲染优化-20261019

目标：减少工作台可避免的后台加载与 AI Work 运行时的秒级渲染工作量。设置页仅在直接进入设置路由或用户对设置导航表达加载意图时预热；AI Work 仍保留秒级整轮/步骤耗时显示，但时钟更新与 `AiWorkChat` 主组件及历史消息映射隔离。

Owner 与设置：`packages/client/ui-layout` 持有页面路由和设置页预热时机；`packages/client/ui-renderer` 保留直达设置路由的预热；`packages/client/ui-chat` 持有 AI Work 消息与活动的展示计时；消息状态和起止时间继续来自现有 Session/Agent API。无新增设置、持久化或依赖；继续沿用现有外观令牌。

允许：设置页仅由直达路由或设置导航的鼠标悬停/键盘聚焦预热，移除与用户意图无关的空闲定时预载；由 AI Work 生命周期启动/停止可撤销的共享外部时钟，只让耗时文本消费时钟，摘要标签/色调仍由消息和活动数据决定；补充路由预热及计时生命周期/渲染隔离回归。保留流式内容、活动状态、等待审批/澄清和消息排序语义。

禁止：更改 Provider/Agent/Session/权限逻辑、消息读取和持久化、用户设置；新增每条消息计时器或高频订阅、动态性能覆盖层、测试路由/假账户；重启或结束现有服务、操作真实数据、提交或发布。

验收：工作台打开且用户未操作设置导航时不主动下载设置页；鼠标悬停/键盘聚焦设置导航仍可预热，直接打开设置路由仍预热。忙碌期间只有共享时钟每秒更新；`AiWorkChat` 不再持有秒级计时状态，时长标签仍随秒更新，消息正文/工具组/历史行不订阅时钟；空闲时不启动时钟，取消/卸载时撤销计时器。构造 1,000 个无订阅历史行与 2 个耗时订阅者，验证一次滴答只通知 2 个订阅者；标明这是时钟工作量/结构回归，不是 React 浏览器帧时间。运行路由预热与 AI Work 计时定向回归、Client 类型、ui-layout/ui-chat/Web 构建及 `git diff --check`；在 ChatGPT 内置浏览器实际 `/work` 核对设置模块未因空闲预载、页面可交互和无回归；不触发 Provider、保存偏好或改变真实数据。帧时间、50ms 长任务和桌面/移动设备未测时明确说明，不宣称十倍或全应用无卡顿。

实施记录（2026-10-19）：`/work` 空闲预热移除后，内置浏览器 1240×925 的当前资源清单为 93 项（此前同路由记录 105 项），`modulepreload` 为 66 个（此前 78 个）；设置页和管理员页资源均未加载。页面可交互，未发送 Provider 请求或保存任何设置。设置页直达/导航预热回归、AI Work 计时呈现回归共 19/19 通过；共享计时器工作量回归 1/1 通过；Client 类型检查、`ui-layout`/`ui-chat` 包构建、Web 构建及差异空白检查通过。Web 构建仍报告多个大于 500 KiB 的代码块。`check:workspace` 因两处逐包职责路径、包目录清单、四个历史截图链接和两处目录链接共 10 项与本次无关的问题失败；仓库未提供 `workspace-preflight` 脚本。真实 Provider 运行中的计时显示、浏览器长任务/帧时间、桌面及移动设备未测，因此本记录不声称达到十倍或全应用无卡顿。

<a id="lfaa-steamcmd-workspace-and-category-reminders-20261019"></a>

## 110-SteamCMD收拢与分类提醒偏好-20261019

目标：把 SteamCMD 工具安装配置、Steam 游戏目录与安装/校验入口集中在“项目与存储”；保留 SteamCMD 领域 Owner 与节点数据根路径语义，不再为 SteamCMD 单独弹首次配置提醒。AI Provider 与业务内容存储提醒各自可按天暂停、永久关闭或稍后再说；账户安全提醒的“稍后再说”只关闭当前会话中的这次提醒，下次登录仍按账户状态显示。

Owner 与设置：设置页面由 `packages/client/ui-settings` 持有；SteamCMD 安装/游戏目录配置和任务继续经现有 SteamCMD API/Owner 保存、校验和派发，本机 Steam 游戏默认目录跟随当前业务内容根，远端节点使用自己的 `LFAA_DATA_DIR`；SteamCMD 工具目录独立使用节点 `LFAA_DATA_DIR` 下的 `lib/steamcmd`。General Settings Owner 持有 `general.aiProviderReminderEnabled`（新增，默认 true）和既有 `general.setupReminderEnabled`（保留为业务内容存储提醒）；旧账户缺少新字段时沿用旧 `setupReminderEnabled`，避免覆盖已保存的关闭偏好。每日暂停仅写当前账户浏览器本地、按提醒类别隔离的日期标记。`general.notificationPopupsEnabled` 仍是全局弹出通知总开关；`general.defaultAdminCredentialReminderEnabled` 继续控制安全提醒。Modal 外观和共享样式不在本任务修改范围。

允许：将 SteamCMD 配置范围、在线/手动安装模式、工具目录、安装目标/校验操作及 Steam 游戏目录节点选择与编辑放在“项目与存储”；从设置导航移除独立 SteamCMD 配置分类，旧 `section=configuration` 链接归一到 `section=workspace`。去掉首次配置提醒对 SteamCMD 状态的检查与弹窗项。首次配置弹窗按 AI Provider 与业务内容存储分别读取长期开关和当日暂停；“不再提醒”只关闭当前类别，“稍后再说”只关闭本次显示；保留内容根迁移和 SteamCMD Owner 边界。账户安全提醒稍后动作只清除当前 Renderer 内存状态，不调用凭据确认 API。更新直接回归、受影响 README、架构事实及本合同/索引。

禁止：更改 SteamCMD/游戏目录数据 Owner、把 SteamCMD 工具目录混入业务内容迁移、改动 `LFAA_HOME`/系统数据根、迁移真实数据、调用 Provider 或执行 SteamCMD 安装/校验任务、重置或写入真实 admin 偏好、修改弹窗视觉/布局、创建账户/超级管理员、测试路由/假数据、重启或结束未知服务、提交或发布。

验收：以直接回归覆盖 General Settings 新字段默认/旧值归一化/写入校验、SteamCMD 页面归并与旧分类路由兼容、SteamCMD/游戏目录仍走原 Owner、SteamCMD 不再触发弹窗、AI 与内容存储“今天/永久/稍后”按类别生效、账户安全“稍后”下次登录仍可提醒。运行受影响回归、Client 类型检查、`ui-settings`/`ui-settings-general`/Renderer/Web 构建、`git diff --check` 和适用 workspace Gate。按仓库要求在 ChatGPT 内置浏览器以现有 admin 账号只读检查 `/settings?section=workspace` 与 `/work` 的实际源码页面，不保存账户设置、不点提醒偏好、不触发内容迁移或 SteamCMD 任务；记录视口、交互与未测项目。帧时间、真实节点安装、Desktop 和真实账户持久化未测时明确说明。

实施与验证记录（2026-10-19）：SteamCMD 设置与入口已归并到“项目与存储”，SteamCMD 独立设置导航项和首配弹窗已移除；原 SteamCMD API/Owner 与本机业务内容根、远程节点 `LFAA_DATA_DIR` 路径语义保留。分类提醒使用独立长期偏好与按类别每日暂停标记；安全提醒“稍后再说”仅清除当前 Renderer 会话状态。内置浏览器使用当前已登录的 `admin` 会话只读检查 `/settings?section=workspace`（1240×925）与 `/work`：设置页展示当前业务目录 `C:\Users\yu\.lfaa\data` 和 SteamCMD 配置组；当前默认游戏路径显示为 `C:\Users\yu\.lfaa\data\games\steamcmd`；工作台没有 SteamCMD 首配弹窗；访问旧 `/settings?section=configuration` 自动归一到 workspace。未点击保存/提醒偏好、未修改真实设置、未执行 SteamCMD 任务或 Provider 请求。Web 服务由仓库 LFAA Web 命令的现有进程提供，未重启服务。视口缩放 API 不在当前内置浏览器能力内，窄/短屏及 Desktop 实机未验收；没有 Daemon 注册，因此安装/校验操作保持禁用。分类提醒/旧字段回归筛选 11/11 通过，`pnpm typecheck`、受影响包构建、`pnpm run build:web` 和 `git diff --check` 通过。完整直接回归有 1 项既有 Portal reduced-motion 选择器断言失败，与本任务无关且未改弹窗样式；`pnpm check:workspace` 仍有 10 项既有目录职责、清单及历史链接问题。构建输出仅到根 `dist/`，Web 构建另有现存大 chunk 警告。

<a id="lfaa-menu-source-update-local-main-20261019"></a>

## 112-菜单源码更新同步本地 main-20261019

目标：修复 Harness 菜单 8 在当前检出 Codex 分支时只更新该分支、却把本地 `main` 留在旧提交的问题。用户确认后，当前工作分支和本地目标分支均可安全快进到 `origin/main`；不能切换分支、覆盖本地独有提交、修改其他工作区或触碰用户数据。

Owner 与入口：`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → `scripts/update-project.ps1` 是 Windows 菜单唯一执行链；更新行为归 `scripts/update-project.ps1`。数据根仍由 `scripts/resolve-data-directory.mjs` 解析。无设置中心配置、数据迁移或产品运行时变更。

允许：只修改 `scripts/update-project.ps1`、`scripts/install-dependencies.ps1`、`apps/cli/tests/workspace-maintenance.test.mjs` 与本合同/索引。远端 fetch 后识别当前工作分支及本地 `$Branch` 引用；当前检出分支按现有快进合同更新；本地 `$Branch` 只有在未被其他工作区检出且确为远端祖先时才以原子 fast-forward 更新。两者均已同步时明确报告；本地目标分支领先、分叉、缺失或正在其他工作区使用时保留并给出原因。无更新时允许脏工作区完成只读状态检查并保留本地改动；确有工作区快进待应用时仍拒绝合并，提示先备份或提交，不要求推送。确认提示须说明将更新的引用，保持数据根保护。

禁止：切换 checkout、reset/clean/force push、重置或删除任何本地提交、修改其他 worktree 文件、自动创建本地分支、处理用户数据、安装依赖、构建桌面/应用、提交或发布。

验收：回归覆盖当前分支已是 `origin/main` 但本地 `main` 落后时，选项 8 仍提示并快进本地 `main` 引用，当前检出分支与工作文件不切换；工作区有本地改动但远端无新提交时允许检查成功并保留改动；若确有当前工作区更新则停止合并、已 fetch 远端记录且保留本地与远端内容。执行 `workspace-maintenance.test.mjs` 对应 Windows 更新用例及 `git diff --check`；按需核对 `HEAD`、`main`、`origin/main` 提交关系。无 UI、设置、构建或真实服务验收要求。

实施与验证记录（2026-10-19）：菜单 8 现在在当前分支已与远端一致时仍检查本地 `main`；仅当 `main` 未在其他 worktree 检出且是 `origin/main` 的祖先时，才在用户确认后用比较并交换的 `git update-ref` 安全快进。确认信息展示实际将移动的分支；本地分支领先、分叉、缺失或在其他 worktree 使用时予以保留并说明。菜单选项文字同步说明会更新当前分支和可安全快进的本地 `main`。后续修正为先 fetch 并判断是否存在待应用更新：脏工作区没有更新时成功结束并保留本地改动；确有快进时仍停止合并，提示备份或提交本地改动而不误导推送。`node --test apps/cli/tests/workspace-maintenance.test.mjs` 在 Windows 11/11 通过，`git diff --check` 通过。没有设置中心配置、UI、构建、后台服务或真实用户数据变更；额外检查只在用户启动菜单 8 时执行，不进入持续运行链路。当前已打开的菜单仍加载旧脚本，须按 0 退出并重新打开后使用修复。

<a id="lfaa-static-dialog-and-workspace-gate-repair-20261019"></a>

## 113-静态弹窗关闭与工作区门禁修复-20261019

目标：修复用户选择静态弹窗效果后，Ant Design Modal/Popconfirm 离场动画被 CSS 完全取消、rc-motion 收不到结束事件而长期保留弹窗/遮罩的问题；并修复 GitHub Actions `check:workspace` 对不存在的包目录声明与未入库截图引用的失败。Git 推送流程不在本轮范围。

Owner 与入口：设置由 `settings/settings` Owner 校验、持久化，`util/values` 提供 `general.dialogMotionEffect`（默认 `fluid`）选项；`ui-layout/Workbench` 映射到账户工作台 body，`ui-theme/common.css` 为 Ant Design Modal、遮罩与 Popconfirm 提供共享动效，`ui-settings-general/SetupReminder` 是用户截图中的实际弹窗。静态模式不得修改设置值或更改设置中心持久化。CI 入口为 `.github/workflows/check.yml` 的 `pnpm run check:workspace`，目录职责来自 `scripts/package-responsibilities.mjs`，生成清单为 `docs/harness-packages.json/.md`。

允许：修改 `packages/client/ui-theme/src/common.css`、对应 CSS 回归、受影响包 README、`scripts/package-responsibilities.mjs`、生成清单 `docs/harness-packages.json/.md`、`docs/development/application-panels-20261016.md`、`docs/development/ekko-fusion-core-20261016.md` 与本合同。恢复流体/淡入/上浮弹窗入场的不透明首帧，只变换位置/缩放；静态效果保持视觉不变，但保留有界 CSS 动画结束事件供 Modal/Popconfirm 正常完成生命周期；移除 Git 树中不存在的 `guard/authorization` 和 `sandbox/permission-presets` 目录声明及当前 checkout 对应的空占位目录，并重新生成目录清单；历史验收截图若只存在于忽略的根 `dist/` 且不在当前仓库，则移除失效 Markdown 链接并明确记录其本机、未入库状态，不生成伪造截图。

禁止：改动设置中心默认值、保存或清除真实用户偏好，改认证/授权/数据根，恢复不存在的占位包，修改 Git 推送/更新脚本，删除或重写无关工作树改动，提交或推送。实页验收仅可在 `dist/.tmp/dialog-motion-check-20261019/` 隔离账户保存静态动效设置，结束后停止该服务并清除该临时数据。

验收：直接 CSS 回归确认三种动态入场保持不透明并只变换位置/缩放，静态样式对 Modal 内容、遮罩及 Popconfirm 使用可完成的 64ms 无视觉变化动画；四种设置选项均沿同一映射工作。运行对应测试、`pnpm run sync:workspace`、`pnpm run check:workspace`、Web 构建和差异检查；启动当前 checkout 的正式 Web，在 ChatGPT 内置浏览器查看真实路由，确认设置映射为静态时弹窗可用关闭按钮/键盘退出且遮罩及时清除，并覆盖桌面与窄/短屏。记录实际路由、视口、交互和截图证据；不改变真实账户设置。帧时间若无法测量如实标记未测。CI 远端新运行不由本轮触发（禁止推送）。

实施与验证记录（2026-10-19）：静态模式原先将 `animation` 设为 `none`，rc-motion 等不到结束事件；第一轮 1ms 无变化动画在实页仍出现监听器错过事件，弹窗保持 `ant-zoom-leave-active`。现改为 64ms 无变化关键帧，确保结束事件可被入场/离场监听捕获；Fluid/Fade/Lift 入场恢复为只变换位置或缩放，并让玻璃弹窗从首帧保持不透明。Modal 内容与遮罩、Popconfirm 都继续消费统一设置令牌。目录职责移除 Git 树不存在的 `guard/authorization`、`sandbox/permission-presets`，本 checkout 对应的空占位目录已清理；同步清单现为 366 个两级目录、193 个 workspace 包、173 个占位目录。两篇历史验收文档里的四个 `dist/reports` 图片链接已删除，并说明截图只留在当时的本机忽略目录、没有入库。设置中心未改默认值；只在本轮临时隔离账户中通过“常规 → 弹窗动效”保存 `general.dialogMotionEffect=none`，原测试 `appearance.advanced.reducedMotion=system`，真实用户账户设置未动。

内置浏览器实页为 `http://127.0.0.1:31316/plugin-manager`。桌面 `1440×900`：首次配置存储弹窗保持静态，CSS 关键帧结束后 X 关闭在 2 秒内完成，Modal 随后 `display:none` 且遮罩数量为 0；Escape 关闭也通过。窄短屏 `390×640`：弹窗 `348×527`、左边距 16px、顶边距 56px，最后一个按钮底边 547px，X 可见、文档没有横向溢出；关闭后遮罩从 DOM 移除。桌面和窄屏截图在本轮内置浏览器验收输出中捕获；没有另存进源码仓库。帧时间未测。验收运行在 `dist/.tmp/dialog-motion-check-20261019/` 临时数据根；服务已停止且端口 31316 无监听。自动审批策略拒绝了清除此临时目录的递归删除，隔离数据仍留在该目录（仅 2 个直接子项）；真实 `data/` 和账户设置未动，需用户手动删除该临时验收目录。原有 3000 端口服务未重启。

验证：`node --import tsx --import ./register-package-loader.mjs --test apps/cli/tests/client-dialog-motion-opacity.test.mjs` 2/2 通过；`pnpm run sync:workspace` 与 `pnpm run check:workspace` 通过（193 个包）；`pnpm --filter lfaa-client-ui-theme build`、`pnpm run build:web`（2268 modules，产物在根 `dist/apps/web/`）、`pnpm run build:control-plane` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。Web 仍报告 `cpp` chunk 501.30 kB 的体积提示。差异空白检查最后复核。没有提交或推送，因此本轮没有触发新的 GitHub Actions 远端运行。

<a id="lfaa-notification-settings-runtime-build-mismatch-20261019"></a>

## 114-通知设置运行构建不一致保护-20261019

目标：修复通知总开关/“恢复通知”显示已开启但提交失败的问题。已知现场证据是 3000 端口控制端进程启动于 08:31，控制端和 Web 构建产物分别在 08:39、08:43 更新；`http-delivery.ts` 每次读取新 HTML，使仍在内存运行的旧 API 与新前端混用。设置 PUT 因旧版校验拒绝新前端的 General 字段并只显示通用格式错误。

Owner 与设置：`packages/host/webserver` 持有 Web/控制端进程内版本一致性与 HTTP 交付；`packages/client/ui-settings/SettingsPage.tsx` 持有账户设置乐观展示与保存反馈。通知继续由 Settings Owner 保存 `general.notificationPopupsEnabled` 及原有分类开关，默认值和持久化不变；浏览器通知权限仍为浏览器本地权限，不与账户开关联动。

允许：对运行中正式 Web 服务记录启动时 host/web 构建指纹；在 General 设置写入前检查已发布构建状态，若产物在启动后被替换，返回明确的“重启 Web 后重试”错误，避免误报保存成功；General 保存失败时恢复到最近一次服务端确认值；补充 HTTP/通知相关回归与本合同。更新受影响 README。

禁止：修改真实账户设置、默认值、认证/授权/数据根、通知类别偏好、浏览器权限或活动会话；重启/结束用户 3000 端口服务；提交、推送或改 Git 更新流程；改动不相关工作树文件。实页保存只允许使用已有隔离数据目录 `dist/.tmp/dialog-motion-check-20261019/`，并记录对该隔离账户的原值与恢复结果。

验收：回归验证从启动到请求期间构建相同可保存；host 构建被移除/替换、web 指纹或入口变化时，General PUT 不进入 Settings Owner 且返回可读重启提示。直接回归确认失败保存时通知总开关和暂停提示回到服务端确认状态，成功保存后缓存更新。运行定向回归、Client 类型、Web 与控制端构建、差异检查；启动当前 checkout 的正式 Web 于空闲 loopback 端口，在 ChatGPT 内置浏览器实际检查 `/settings?section=notifications`，隔离账户中验证暂停→恢复、错误消失、值持久化，并检查桌面和窄/短屏布局。保留真实 3000 服务及真实账户设置；报告帧时间/其他设备未测范围。

实施与验证记录（2026-10-19）：现场 Web 进程 PID 7784 于 08:31 启动；控制端与 Web 构建产物分别在 08:39、08:43 更新。旧进程的静态交付逻辑重新读取了新 `index.html`，因此浏览器加载新 Client 时仍由内存中的旧控制端 API 接收 General 写入，页面把服务端失败留在乐观开关状态。现由 Web Host 在启动时捕获 host/web `build-state.json` 指纹和 Web `index.html` 哈希；文档导航及 General Settings PUT 检查运行时身份，发现构建被替换即在进入 Settings Owner 前返回 503 重启提示。SettingsPage 对 General 保存错误恢复最近一次服务端确认的该类别值；成功保存后更新确认缓存。未新增设置，继续使用 `general.notificationPopupsEnabled` 与 General 整类设置持久化。

实际页面在正式 Web 测试实例 `http://127.0.0.1:31317/settings?section=notifications` 验收，使用现有隔离数据目录 `dist/.tmp/dialog-motion-check-20261019/` 的 admin 测试账号。桌面视口 `1440×900` 验证总开关初始开启、关闭后出现暂停说明、点击恢复后提示消失且分类偏好恢复；窄短视口 `390×640` 验证暂停提示与“恢复通知”操作可见可达、恢复后开关为开启。刷新后确认总开关仍开启、分类值保留，页面没有“提交内容格式不正确”。内置浏览器截图在本轮验收输出中捕获；没有保存到源码仓库。帧时间及真实用户账号未测试。隔离服务已停止；用户 3000 端口服务未重启，当前 PID 7784 仍需在后续重启 Web 后才能载入本修复。隔离数据仍位于上述既有临时目录。

验证：HTTP 交付回归 7/7、通知保存/回滚筛选 2/2、Host 与 Client TypeScript 检查、`pnpm run build:control-plane`、`pnpm run build:web`、`node scripts/runtime-build-state.mjs web`（返回 `[]`）及 `git diff --check` 通过。Web 构建 2268 个模块；现存 `cpp` 大 chunk 体积提示仍在。完整 `client-auth-feedback-layout` 文件 12 项通过，另 1 项既有 Portal reduced-motion 选择器断言失败；该断言属于先前共享动效样式变更，与本通知修复无关，本轮没有改它。构建产物仅写入仓库根 `dist/`。没有提交或推送。

<a id="lfaa-key-reminder-choice-layout-unification-20261019"></a>

## 115-关键配置提醒选择与响应式布局统一-20261019

目标：把默认凭据、AI Provider、业务内容存储三类关键提醒的决定区与辅助操作收敛成图三的清晰结构。长期“不再提醒”合并到对应的“不更改”主操作；弹窗底部只保留“今日不再提醒”和“稍后再说”。不同提醒继续保留各自真正的主操作和内容目录选项；工作区其他 Modal、系统通知与 Toast 样式不随本次调整。

Owner 与设置：共享弹窗及其文案/操作编排属于 `packages/client/ui-settings-general/SetupReminder`；默认凭据提醒状态仍由 Renderer/Account Owner 提供。长期提醒布尔值由 Settings Owner 持有：`general.defaultAdminCredentialReminderEnabled`、`general.aiProviderReminderEnabled`、`general.setupReminderEnabled`，三者默认均为 true；全局门控继续使用 `general.notificationPopupsEnabled`（默认 true）。当日暂停继续用按账户/类别隔离的浏览器本地日期标记；内容目录仍只经项目存储 Owner 的 `saveProjectContentDirectory` 写入。沿用 `general.dialogMotionEffect` 和现有 Appearance Portal 令牌，不新增设置或 CSS 自定义属性。

允许：调整 `packages/client/ui-settings-general/src/SetupReminder.tsx` 的操作、辅助说明和提示顺序，使三类提醒语义一致；“不更改”对当前提醒对应的长期开关设为 false，保存成功后才关闭；内容存储仍先由项目存储 Owner 保存当前默认目录，再关闭其提醒开关，任一写入失败均留在弹窗中显示错误。“今日不再提醒”只写当日标记，“稍后再说”只结束本次显示。仅调整 `packages/client/ui-layout/src/workbench.css` 中 `.setup-reminder-modal` 的内容区与窄屏排列，其他弹窗仍可单独维护样式。更新直接回归、`ui-settings-general`/`ui-layout` README 与本合同。

禁止：改任何默认值、设置 Owner 校验/持久化、Account 凭据和账户状态、内容目录推荐/迁移规则、全局通知或当日暂停语义；修改 `ui-theme/common.css` 等所有 Modal 的共享外观；改变其他业务弹窗；写入真实账户/浏览器偏好、创建测试账户、提交或推送。

验收批次：先运行提醒选择与布局回归、Client 类型检查、`lfaa-client-ui-settings-general`/`lfaa-client-ui-layout` 及 Web 构建、`git diff --check`；再用仓库正式 Web 和 ChatGPT 内置浏览器实际检查 `/work`，在隔离数据账号中分别验证凭据、AI、内容存储提醒的“ 不更改 ”保存目标与统一的两个底部操作。于桌面、平板宽度和 `390×640` 窄短屏确认按钮可达、文案换行、弹窗内滚动有效且无横向溢出；记录截图和未测项。关闭减少动态、主题或提醒之外的真实设置不得作为验收操作。

实施与验证记录（2026-10-19）：默认凭据、AI Provider 与内容存储提醒均在“不更改”主操作中保存各自长期提醒开关；内容存储先由项目存储 Owner 保存默认目录。三个弹窗底部统一为“今日不再提醒 / 稍后再说”，说明与按钮布局只作用于 `.setup-reminder-modal`。成功保存内容提醒后按原队列直接显示下一条 AI 提醒，不要求重载。直接回归筛选 6/6 通过，Client 类型检查、`ui-settings-general`/`ui-layout` 包构建、Web 构建、运行指纹检查及 `git diff --check` 通过。正式 Web 的隔离数据实例在内置浏览器 `/work` 验收：1240×925 默认凭据和 AI 弹窗显示统一结构；768×900 弹窗宽 480 px、各操作均在视口内；390×640 内容弹窗的长 Windows 路径和说明可换行，操作可达，无横向溢出；点击内容“不更改”后，隔离目录和提醒开关写入成功，页面立即切换到 AI 提醒。隔离账户中凭据“不更改”后进入内容提醒；AI“不更改”重复验收时设置保存成功，Modal 隐藏。此前一次 AI 点击在浏览器等待中超时，重新确认隔离开关并复测后关闭正常；未复现持续卡住。浏览器启动/登录期间记录到 2 条 `dsh-ui-primitives` 的 `event.key.startsWith` TypeError 和 1 条 `ApplicationWorkspace` 的 `toLocaleLowerCase` TypeError，提醒交互仍可用，未追踪这些非本次范围错误。未测真实设备帧时间、Desktop 实机和真实账户。截图证据为内置浏览器 `/work` 桌面、平板和 390×640 视口的本轮交互截图。两个验收服务已停止，用户现有 3000 端口服务未触碰。系统自动审批审查拒绝递归删除新建的隔离验收副本 `dist/.tmp/reminder-queue-check-20261019`；该临时副本仍留在该目录中。

<a id="lfaa-release-announcement-dialog-20261019"></a>

## 116-版本更新公告弹窗-20261019

### 目标、Owner 与配置

- 在共享工作台新增与关键设置提醒、桌面下载安装提示相互独立的版本更新公告弹窗，视觉参考用户提供的 DeepWrite 公告截图：品牌/标题、公告摘要卡、带序号的可滚动更新说明、单一确认按钮和关闭入口。
- `packages/client/ui-layout` 持有工作台弹窗、展示时机与局部样式；`apps/web/scripts/project-version.mjs` 与 `apps/web/vite.config.ts` 从仓库根 `update.json` 校验并编译当前产品版本、发布日期和更新说明；`packages/client/connection` 发布该构建元数据合同。
- 使用 Settings Owner 的 `general.notificationPopupsEnabled` 作为弹出总开关；确认版本仅按账户写入浏览器本地持久化，不新增设置中心控制项，不改远端账户数据、设置默认值或官方版本日志。

### 允许、禁止与验收

- 允许：新增独立公告组件/样式和直接回归；让首次配置/凭据/通行密钥提醒及桌面更新对话框先结束，再展示尚未确认的当前版本公告；公告只在非设置页面、全局通知开启且本账户尚未确认当前版本时出现。点击关闭或“我知道了”确认当前版本；之后每个新版本重新出现。
- 禁止：复用或改造 `.setup-reminder-modal` 与 `.lfaa-update-modal` 的视觉规则；复制截图里的 DeepWrite 文案、链接、联系方式或安装指引；创建虚构更新内容、远程请求/轮询、额外权限或强制确认；修改通知设置值、真实账户数据、业务数据、桌面自动更新行为，提交或推送。
- 响应式验收：桌面、平板、390×640 窄短屏下弹窗宽度受工作区限制，更新正文独立滚动，标题/关闭/确认按钮可达且无横向溢出；减少动态、主题/Appearance 共享令牌继续生效；不新增无注释 CSS 自定义属性。
- 验证：官方更新清单与包版本一致性及发布日期/说明回归；工作区直接 UI 回归、Client 类型、`ui-layout` 构建、Web 构建和运行指纹；从当前源码启动正式 Web，在 ChatGPT 内置浏览器验收实际路由、版本首次展示、确认后不重复、全局通知关闭时不显示及代表性视口。报告帧时间、桌面安装器和真实设备未测范围。

实施与验证记录（2026-10-19）：Web 构建从根 `update.json` 注入 `0.0.8`、发布日期 `2026-10-09` 和两条现有官方更新说明；不读取 DeepWrite 截图中的外部文案。弹窗拥有独立 `.release-announcement-modal` 样式，按账户/版本记录确认；确认后刷新不重复显示。Workbench 等设置提醒、通行密钥检查和 Electron 更新提示空闲后才显示；全局通知总开关关闭时源码回归覆盖不显示条件，实页未改动任何通知偏好。

验证：版本清单回归 8/8、公告持久化/门控/响应式直接回归 3/3、Client TypeScript、`ui-layout`/`ui-settings-general`/`ui-settings-account`/`connection` 包构建、`pnpm run build:web`、Web/Control Plane 运行构建状态核对（均返回 `[]`）及 `git diff --check` 通过。Web 构建 2269 个模块，保留现有 cpp 大 chunk 提示。当前 checkout 的正式 Web 在隔离目录 `dist/.tmp/release-announcement-validation-20261019/` 启动，内置浏览器于 `/work` 验收：1240×925 弹窗 840×501；768×900 弹窗宽 734；390×640 弹窗 360×479；390×420 弹窗 360×380，关闭与确认操作可见，正文可独立滚动且滚动后页脚不移动；四种视口均无页面横向溢出。点击“我知道了”并刷新后公告不再出现。隔离 Web 服务已停止，已有 3000 端口服务未触碰。真实账户、通知关闭时的实页行为、桌面安装器、真实设备帧时间未测试；构建/回归结果不代表这些项目通过。没有提交或推送。

<a id="lfaa-key-reminder-navigation-and-dismissal-20261019"></a>

## 117-关键提醒导航与弹窗关闭修复-20261019

### 目标、Owner 与设置

- 修复内容存储、AI Provider、默认登录凭据三类提醒的关闭和导航行为；解决内容目录写入留在遮罩内、队列切换像未关闭，以及设置路由上凭据提醒继续阻挡操作的问题。
- 提醒和路由导航由 `packages/client/ui-settings-general/src/SetupReminder.tsx` 负责；存储配置仍归项目存储 Owner，仅由设置中心“项目与存储”页面读取/修改。AI、凭据和全局通知继续读取既有 `general.aiProviderReminderEnabled`、`general.defaultAdminCredentialReminderEnabled`、`general.setupReminderEnabled`、`general.notificationPopupsEnabled`。
- 四种动效由 Appearance/General 既有 `general.dialogMotionEffect` 与共享 `ui-theme/common.css` 唯一控制。本任务只验证其关闭生命周期，不修改用户动效偏好，也不新增设置。

### 允许、禁止与验收

- 允许：把系统推荐和自定义路径操作合并为“去配置存储”并跳转到“项目与存储”；“不更改”只保留现目录并关闭当前类别长期提醒；设置页不挂载任何工作台提醒遮罩；更新相关直接回归、README 和本合同。
- 禁止：在弹窗内写入或迁移用户目录；改变“今日不再提醒/稍后再说”语义、数据目录 Owner、通知默认值、真实用户偏好、其它 Modal 视觉和四种动效配置；提交或推送。
- 验收：分别核对内容存储主操作不调用目录写入并导航设置、“不更改”保存类别提醒并收起、AI/凭据前往设置后 modal open 为 false；在四种动效下验证遮罩和页面交互恢复；运行提醒与 motion 回归、类型检查、相关包/Web 构建、运行指纹和 `git diff --check`。使用当前 checkout 正式 Web 与 ChatGPT 内置浏览器，记录真实路由、各代表视口、按钮结果、四种动效关闭结果与未测范围；不写入真实账户或偏好。

实施与验证记录（2026-10-19）：内容存储提醒已将系统推荐和自定义位置合并为“去配置存储”，不在遮罩内直接写入目录；成功进入 `/settings?section=workspace`，内置浏览器标题与选中分类均为“项目与存储”，截图确认遮罩已经消失。工作区“ 不更改 ”只保存隔离验收账户的 `general.setupReminderEnabled=false` 并留在 `/work`，未发生路由跳转；它关闭后，队列中的独立版本公告随即显示，因此当时仍能看到另一个弹窗。进入设置路由后提醒不再显示。验证视口为桌面 1231×886；本轮未能用内置浏览器调整平板/手机视口。当前 `dialogMotionEffect` 偏好未更改，动效源码回归覆盖静态动画结束事件与共享 Modal 规则，但四种效果未逐一实页操作。提醒/布局/motion 定向回归 20/20、Client 类型检查、`ui-settings-general`/`ui-layout` 构建、Web 构建、`node scripts/runtime-build-state.mjs web`（`[]`）及 `git diff --check` 通过。Web 构建为 2269 个模块，仍有 `cpp` 大 chunk 警告。实页使用独立 `dist/.tmp/reminder-navigation-validation-20261019/{home,data}`；未接触真实账户或业务数据，真实设备帧时间与 Desktop 未测；没有提交或推送。

<a id="lfaa-login-appearance-settings-20261019"></a>

## 118-登录页外观设置同步-20261019

### 目标、Owner 与配置

- 登录页在未认证状态下延续设置中心“外观”中已配置的登录背景与视觉偏好；保持当前居中表单设计和登录、通行密钥、密码恢复流程。
- `packages/settings` / Settings Owner 的账户 `appearance` 是设置唯一权威来源；Renderer 仅在认证后读取，Workbench 与设置页只在读取/保存成功后将白名单视觉字段按用户名缓存。AuthView 只在用户名匹配时使用该账号快照；不匹配时回到默认主题，内置登录背景继续遵循“当前设备”范围。
- 接入现有 `appearance.theme`、按主题选择的 `accentColor`、`backgrounds.login`、`overlay`、`advanced.interfaceFontSize`、`advanced.fonts`、`advanced.separateModes`、`advanced.modeStyles`、`advanced.contrast` 与 `advanced.reducedMotion`；减少动态效果同时控制登录页状态文字展开。继续使用现有默认值、服务端校验和账户持久化，不增加设置项。
- `appearance.blur` 只控制已登记的玻璃表面，当前不透明登录表单不属于该控制目标；`wallpaperEngine` 需要认证后的插件 Runtime，登录首屏不启动它。自定义上传背景仍按设置页现有限制，不缓存账户私有图片。

### 允许、禁止与验收

- 允许：在 `ui-theme` 的登录视觉缓存中按用户名验证/序列化上述白名单字段；在账户外观设置成功保存后更新缓存；AuthView 仅在登录表单用户名与缓存用户名一致时映射该账号的主题、强调色、字体、字号、背景遮罩与边界对比度。账号不匹配、缓存损坏或不可用时使用 `DEFAULT_USER_SETTINGS.appearance` 的产品默认值；内置登录背景继续作为当前设备的外观选择。
- 禁止：改变设置默认值或 Settings Owner、存储范围、认证/恢复流程、密码与通行密钥；缓存账户私有上传文件、插件项目或凭据；让登录页面启动 Wallpaper Engine；因验收修改真实账户外观设置，或提交、推送。
- 批次 B1：补齐设置读取/保存到登录页安全视觉快照的链路与长期回归，先运行定向回归、类型和相关包构建。
- 批次 B2：让 AuthView 使用该快照并沿用现有登录卡片，运行 UI 回归、类型、`ui-settings-account`/`ui-theme` 与 Web 构建，然后在正式 Web 的实际登录路由检查桌面及窄/短视口；使用当前隔离验收数据或只读缓存验证，不修改真实偏好。
- 批次 B3：按用户标注压紧品牌、标题说明、默认凭据到表单间的垂直留白，保留错误反馈固定占位和登录操作尺寸；完成定向回归、相关包/Web 构建，并在桌面及窄/短视口实页复核。
- 批次 B4：登录卡片底部使用共享 `ServiceStatus` 的真实在线、检查中和离线状态；默认收为状态圆点，悬停/键盘聚焦展开文案，右侧放密码恢复入口；只在恢复模式显示恢复说明。展开效果服从 `advanced.reducedMotion`，不新增配置。完成状态与恢复切换回归、相关包/Web 构建，并在桌面、窄屏与短屏验证无横向溢出、入口可达。
- 批次 B5：登录成功后的绿色 Alert 改为固定消息位中的黑洞环形等待状态；工作台预热后，暗幕和事件视界在整页展开，中央登录卡片先向中心收缩，再由卡片边界内的碎片与黑色颗粒向视界汇聚、渐次消失，随后显示工作台。碎片和颗粒不得飞向屏幕边缘。收紧消息位高度；认证、预热和转场结束 Owner 保持单一，沿用强调色及 `advanced.reducedMotion`，不新增配置。
- 实页记录路由、视口、登录背景、主题/强调色/字号效果、登录表单可用性、滚动/横溢、截图证据和未测范围；帧时间、真实账户和 Desktop 未测时如实标注。

实施与验证记录（2026-10-19）：B1/B2 已完成。登录页只消费 Settings Owner 已确认的 `appearance` 白名单缓存，按登录名隔离主题、强调色、字体/字号、遮罩、对比度和模式样式；内置背景继续按当前设备使用。没有修改设置默认值、真实偏好、认证或账户数据。定向回归 `node --import tsx --import ./register-package-loader.mjs --test tests/client-login-appearance-bootstrap.test.mjs tests/client-auth-feedback-layout.test.mjs`（`apps/cli`）15/15 通过；Client 类型检查、`lfaa-client-ui-theme`/`lfaa-client-ui-settings-account`/`lfaa-client-ui-settings`/`lfaa-client-ui-layout` 构建通过；Web 与 Control Plane 构建通过，产物均在根 `dist/`；`node scripts/runtime-build-state.mjs web` 与 `control-plane` 均返回 `[]`；`pnpm run check:workspace`（193 包）和 `git diff --check` 通过。Web 使用隔离 `dist/.tmp/reminder-navigation-validation-20261019/{home,data}`，内置浏览器实页路由 `http://127.0.0.1:31321/`：桌面视口 1440×900，卡片完整居中，实读主题 `dark`、强调色 `#3457d5`、内置森林背景与 65% 遮罩；窄/短视口 390×640，页面宽 380、卡片宽 352、无横向溢出，内容通过纵向滚动到达；滚动后的截图显示登录、找回入口和服务状态可达。桌面及窄屏截图已在本轮内置浏览器验收输出中留存，未另存仓库文件。未提交或推送；真实账户登录、Desktop/WebView 和帧时间未测，构建日志仍有现有 `cpp` 大块警告。

实施与验证记录（2026-10-19）：B3/B4 完成。品牌标记、品牌名、标题说明和默认凭据与表单间的垂直间距已收紧。登录卡片底部改为单行布局，左侧读取真实服务状态：在线绿色圆点及悬停/键盘聚焦展开“服务器正常”，检查中/离线映射为对应状态；右侧为“忘记密码？使用恢复密钥找回”。恢复模式才显示恢复说明。`ServiceStatus` 默认显示维持其他页面原状态文案；登录外观缓存新增现有 `appearance.advanced.reducedMotion` 白名单值，系统模式遵循操作系统偏好，不新增设置或改默认值。定向回归 17/17、Client TypeScript、`lfaa-client-ui-primitives`/`lfaa-client-ui-theme`/`lfaa-client-ui-settings-account` 构建、Web 构建 2269 模块及 `git diff --check` 通过；Web `cpp` 501.30 kB 既有 chunk 提示仍在。隔离 Web `http://127.0.0.1:31321/` 在 ChatGPT 内置浏览器验收：1440×900 桌面状态圆点默认折叠、悬停和键盘聚焦展开完整文案且不遮挡右侧入口；390×640 卡片宽 352、页面无横向溢出，登录及底部入口可见；320×520 页面无横向溢出，纵向滚动后恢复入口可达。点击恢复入口后进入恢复表单，再返回登录，验证说明仅在恢复模式显示；没有提交登录/恢复表单。截图证据留在本轮内置浏览器验收输出中，未保存到仓库。真实检查中/离线页面状态、真实账户登录、Desktop/WebView、真实设备帧时间未测；没有更改用户偏好、提交或推送。Web 隔离服务已停止，真实 3000 端口未触碰。

批次 B5 目标：用黑洞环形等待状态替换登录成功 Alert，并将成功后的整张登录页转场改为黑洞吸入效果；消息位缩至 30px，防止反馈覆盖用户名标签。动画只用合成友好的 CSS `transform`/`opacity`；Renderer 仍按转场核心动画结束事件解除工作台门控。

实施与验证记录（2026-10-19）：B5 完成。固定反馈位在登录期间显示紧凑黑洞等待状态；工作台预热后，1600ms 全屏转场让吸积环提前扩张并旋转 920°，登录卡片同步向中心收缩旋入，暗幕覆盖整页；成功结束后移除覆盖层并显示工作台，2s 兜底避免结束事件丢失时卡住。复用现有强调色、主题、登录背景、遮罩与 `appearance.advanced.reducedMotion`；减少动态效果为“开启”时由认证状态机直接跳过，不增加新设置、不改用户偏好。定向回归 17/17、Client TypeScript、`lfaa-client-ui-settings-account`/`lfaa-client-ui-renderer`/Web 构建通过，Web 2269 模块，`git diff --check` 通过。隔离 Web `http://127.0.0.1:31322/work` 内置浏览器实测：桌面 1440×900 中段截图可见整屏暗幕、蓝色吸积环绕转与卡片收缩；动画后遮罩移除、`/work` 工作台正常出现。窄短屏 320×520 登录卡片宽 287px、页面可纵向滚动、无横向溢出；滚动后登录按钮和恢复入口可达；窄屏转场覆盖 310×520 内容视口并正常结束。截图证据保留在本轮内置浏览器验收输出中，未写入仓库。动画仅用 `transform`/`opacity` 参与逐帧变化；真实帧时间、真实账户、Desktop/WebView 与真实设备未测。测试使用 `dist/.tmp/login-blackhole-validation-20261019/{home,data}` 隔离数据；未改账户设置、未提交或推送。

效果迭代记录（2026-10-19）：用户要求登录转场必须让所选背景随引力场变化，形成进入另一空间的整页效果。新增 `LoginTransitionScene` WebGL1 全屏着色器：以当前设置映射的登录壁纸作为纹理，根据视口比例透镜扭曲并向大型事件视界卷入；蓝紫吸积环、旋涡流线和少量轨道尘粒围绕中心运动；登录卡片继续从中心倾斜、收缩并吸入。颜色跟随现有强调色，遮罩透明度跟随现有外观设置；遵循主题及减少动态效果，不新增偏好或动画依赖。渲染上限 115 万像素/最长边 1500px，RAF 仅运行 2.2 秒并在卸载时取消帧、断开 ResizeObserver、释放纹理和缓冲区；以上为代码与工作量检查，未测设备帧时间。

该迭代定向回归 16/16、Client TypeScript、`lfaa-client-ui-settings-account` 和 Web 构建通过。隔离 Web `http://127.0.0.1:31322/work` 的 ChatGPT 内置浏览器实测桌面 1440×900 与窄短屏 320×520：两种视口均可见壁纸透镜汇入大型蓝紫色黑洞，卡片随之旋转吸入，动画结束后工作台正常显示；窄屏页面保持纵向滚动、表单内容可达。浏览器控制台另有 `ApplicationWorkspace` 的 `toLocaleLowerCase` 和 `dsh-ui-primitives` 的 `startsWith` 错误，本轮未定位这两处工作台错误；转场组件本身未报错。截图留在内置浏览器验收输出中，未保存到仓库。真实账户、Desktop/WebView、真实设备与动画帧时间未测；服务仅使用 `dist/.tmp/login-blackhole-validation-20261019/{home,data}` 隔离目录，未改真实偏好、未提交或推送。

<a id="lfaa-dsh-plugin-source-install-20261019"></a>

## 119-DSH 插件来源安装修复-20261019

### 目标、Owner 与边界

- 修复 `/plugin-manager` 检查 DSH GitHub bundle 时，源码声明了 Host/Client 构建入口但仓库未提交构建产物、且对应 NPM 版本不存在时，LFAA 因 NPM HTTP 404 丢弃已固定 GitHub 快照的问题；对齐 DSH 将 Git 来源与 registry 包名分开解析的约定。
- `packages/boot/plugin-manager` 是来源解析、固定快照和 Profile 安装唯一 Owner；`Plugin Controller`、Permission Owner 与页面继续沿用既有调用链。公开 NPM registry 回退只发生在官方 npmjs/npm mirror 两个公开地址之间；自定义 registry 不跨源回退，最终 metadata 与 tarball 必须来自同一个实际响应 registry，并把该 registry 随检查结果传到安装阶段。
- `.dsh` 检查只读读取插件管理 pnpm 日志与包清单，不读取或输出 `.credentials.yaml`、`secrets/`、环境密钥及用户内容。DSH 安装文档只作参考，不修改 `E:\lfaa1\deepseek-harness` 或 `C:\Users\Administrator\.dsh`。
- 安装的含义仍是将固定、校验过的包内容写入指定 Profile 清单。缺少 LFAA Runtime Adapter 的任意 DSH Host/Client 插件继续保持 `incompatible`，不得执行包脚本、导入任意代码或伪装为可运行；本任务不实现通用 DSH 宿主。

### 允许、禁止与验收

- 允许：GitHub 快照补齐已构建入口时，官方 NPM 明确返回 404 则保留原 GitHub 快照继续做合同检查；公开 registry 的包/版本 404 时按 DSH 顺序尝试另一公开 registry，并在检查/安装中固定最终实际来源；增加直接来源回归并更新包 README、本合同。
- 禁止：把 GitHub 来源改查包名相似的 NPM 包；在自定义或私有 registry 失败后泄漏包名到公开 registry；从不同 registry 混用 metadata 与 tarball；用 registry `latest` 替代不存在的指定版本；运行 GitHub/NPМ `prepare`、build 或其他生命周期脚本；启用没有 LFAA 专用适配器的 DSH 插件；访问/更改真实插件 Profile、用户数据、凭据或源 DSH 仓库。
- 验收：覆盖 GitHub 仓库缺少 `main`/`./client` 构建文件且 NPM 404 时仍返回 immutable GitHub 检查结果并可安全登记为不兼容；覆盖官方 npmjs 与 npmmirror 之间 404 回退、回退后检查和安装使用同一个 registry、私有 registry 不回退；保留现有 `gitHead`、SRI、仓库一致性检查；运行插件管理器直接回归、相关类型/包构建和差异检查。只使用合成响应与临时 Profile，不执行外部插件或写入用户数据；不做页面视觉改动，故不需要浏览器 UI 验收。

实施与验证记录（2026-10-19）：GitHub DSH bundle 对应官方 NPM 版本 404 时，检查与安装保留同一固定 GitHub commit 和源码摘要，照常写入隔离 Profile 清单；缺少 LFAA Host/Client 入口的状态仍为 `incompatible`。手动 NPM 来源在 npmjs 与 npmmirror 间遇到连接/超时、HTTP 404 或版本范围无匹配时按所选顺序回退，检查结果记录最终 registry，安装继续使用该 registry；自定义 registry 不回退。已验证 `apps/cli/tests/plugin-manager.test.mjs` 20/20、`pnpm --filter lfaa-plugin-manager build`、`git diff --check` 通过。只使用合成归档、mock fetch 和临时 Profile；未安装真实第三方包、未访问/修改真实用户 Profile、未运行来源脚本。官方 DSH 来源与 `.dsh` 目录的只读检查依照上文限制保护凭据、secrets、环境密钥和用户内容。运行时边界未改变；不会声称任意 DSH Host/Client 插件可执行。

<a id="lfaa-login-and-workbench-responsive-repair-20261019"></a>

## 120-登录与工作台输入区响应式修复-20261019

### 目标、Owner 与设置

- 修复登录页底部真实服务状态圆点 hover/focus 展开文案时改变 flex 尺寸、造成小视口布局抖动；状态行其余空间和右侧密码恢复入口保持稳定。
- 修复用户截图中 1440×900 `/work` 的 AI Work 输入框内容/边界显示异常；以实际容器 Grid/Flex 与可视区约束为准，不根据全局窗口假设。
- 修复用户补充的 1077×900 中屏悬停问题：鼠标扫过输入卡底部各操作区时，反馈与输入卡自然衔接并平滑，不因 hover 改变布局尺寸或位置；移除输入卡外沿暗影，并避免空闲虚化影响操作控件导致发虚/闪烁。
- 将“建议修改默认登录凭据”提醒顺序改成左侧“不更改”、右侧“更改”；AI 提醒改成左侧“不更改”、右侧“去配置模型”，保留原文字、保存与导航行为。
- Owner：登录账户 UI `packages/client/ui-settings-account` 与共享真实状态组件 `packages/client/ui-primitives`；工作台输入框归 `packages/client/ui-chat`；首次配置与凭据提醒均由 `packages/client/ui-settings-general/SetupReminder` 编排。
- 设置盘点：登录页继续读取已有 Appearance `appearance.advanced.reducedMotion`、主题/字体/字号/对比度与登录页安全外观快照；工作台输入区继续读取 Appearance 主题、强调色、字体/字号、对比度、壁纸玻璃表面和减少动态效果令牌。状态只读真实 `serverState`。不新增或修改设置默认值与持久化。

### 允许、禁止与验收

- 允许：仅调整登录服务状态展开样式、工作台输入布局及 1077×900 悬停反馈的直接 CSS/markup、凭据和 AI 提醒按钮顺序及直接回归；更新相关 README 与本合同。
- 禁止：改变登录认证/恢复行为、服务器健康状态采集、会话/设置/权限、聊天输入提交、真实偏好；不得重启未知或正在服务用户的进程，覆盖其他脏工作，提交或发布。
- 验收：新增稳定性回归，证明状态文本采用不参与布局尺寸计算的展开方式、键盘聚焦可读，窄屏不改变 support row 尺寸或遮挡恢复入口；工作台输入组件和操作条在宽 1440、1077×900 中屏、窄容器及短视口内无裁切/横向溢出，扫过加号/权限/更多/空白区/模型/语音/发送区域时外框与操作位置稳定，边框和按钮颜色平滑过渡，操作文字无暗影、空闲虚化与闪烁；输入框可聚焦、文字与所有操作可达；凭据和 AI 提醒左右顺序及原按钮行为保持。运行对应 Client 回归、受影响包/正式 Web 构建、差异检查；由当前源码服务在 ChatGPT 内置浏览器检查登录实际路由 320×520 和 `/work` 1440×900、1077×900（并检查窄分栏/短屏），只读验收，不写入设置、凭据、消息或 Provider 请求。记录截图、交互和未测范围。

### 本轮登录状态修复与验收（2026-10-19）

- 登录页实际路由 `/` 已由当前源码 Web 服务在 ChatGPT 内置浏览器检查。`320×520` 下悬停前后 support row 都为 `236.67×32px`、状态入口 `8×20px`、恢复入口 `191.33×32px`，位置不变；状态文案显示在状态行下方，距行底约 `4px`，未遮挡恢复入口，页面 `scrollWidth=310px`，无横向溢出。`1440×900` 下悬停前后行、圆点和恢复入口尺寸及位置也相同。页面截图在本轮内置浏览器验收中查看；未保存截图文件。
- 定向回归 `client-auth-feedback-layout.test.mjs` 状态行用例通过；Vite Web 生产资源构建与运行指纹检查通过，控制端构建及 `git diff --check` 通过。完整 `pnpm run build:web` 仍被 `packages/client/ui-settings/src/SettingsPage.tsx:2643` 的 `disabled` 类型错误阻断；该处为工作区已有改动且不属于本次 CSS 修复。
- 只复用并读取现有 Appearance 外观与减少动态效果配置，无新增设置或偏好写入。未验收 `/work`，因为本次浏览器没有已登录会话；任务 120 其余验收项继续保持实施中。

### 完整验收（2026-10-19）

- 三项直接回归 `client-ai-work-composer-responsive.test.mjs`、`client-setup-storage-reminder.test.mjs`、`client-auth-feedback-layout.test.mjs` 共 29/29 通过；`ui-chat`、`ui-settings-general`、`ui-settings-account`、`ui-primitives` 包构建及完整 `pnpm run build:web` 通过。Web 运行指纹 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。Vite 仍报告一个约 501 kB 的既有懒加载块体积提示。
- 当前源码 Web 服务在 ChatGPT 内置浏览器的 `/work` 实际路由检查：1440×900 下消息输入框为 `896.7×60px`，Composer 底部距视口底部约 `22.8px`，文档未横向溢出；320×520 下输入框为 `216.7×60px`、引导可换行、文档无横向溢出，凭据提醒及其按钮均在可视区域内。提醒按钮实页为左“不更改”、右“更改”；AI 缺失模型提示的“去配置模型”实际导航到 `/settings?section=ai`，凭据“更改”实际导航到 `/settings?section=security`。AI 提醒弹窗本轮被优先显示的凭据提醒遮挡，其按钮顺序和行为由 29 项直接回归覆盖；没有点击会保存偏好的“不更改”或“今日不再提醒”。截图在内置浏览器验收输出中查看，未保存为文件。
- 该浏览器仅使用本轮新建的 `dist/.tmp/full-acceptance-120-20261019/{home,data}` 隔离数据。隔离账号没有活动模型，Composer 按产品规则处于 disabled；因此可验收布局与可见控件，但输入聚焦和消息提交未测。未配置模型、修改设置/凭据、发送消息或调用 Provider。`/work` 控制台仍出现 `dsh-ui-primitives` 的 `startsWith` 与 `ApplicationWorkspace` 的 `toLocaleLowerCase` 两类既有 `TypeError`，本任务没有定位或修改其 Owner；它们不妨碍本次已检查的输入布局，但仍是工作台的独立运行问题。真实账户、真实设备和帧时间未测。验收服务已停止且 3000 端口无监听；隔离临时数据目录的清理命令被本机执行策略拦截，目前仍保留在该 `dist/.tmp` 子目录。

### 中屏输入区悬停反馈补充（2026-10-19）

- `.ai-work-chat__composer` 悬停时不再改变边框、阴影或滤镜；聚焦时只平滑过渡主题边框。操作、模型、语音和发送按钮平滑过渡颜色，不改变布局尺寸、不投影、不位移。AI 空闲虚化不覆盖输入上下文和操作区；卡片仍读取 Appearance 的表面透明度与 14px 玻璃模糊令牌，用户偏好未改。
- 只读取现有 Appearance 强调色、表面/边框、玻璃模糊和减少动态令牌；没有新增设置、改默认值或写入用户偏好。
- `client-ai-work-composer-responsive.test.mjs` 7/7 通过；`lfaa-client-ui-chat` 构建、完整 `pnpm run build:web`、Web 运行指纹检查（`[]`）和 `git diff --check` 通过。产物只写入仓库根 `dist/`。
- 当前源码服务 `http://127.0.0.1:3000/work` 在 1077×900 Edge 实页检查：将鼠标留在“更多”按钮后，输入卡前后 DOM 矩形均保持 `x=335.6, y=724.9, w=489.8, h=152.3px`；按钮 `filter`、`box-shadow`、`transform` 均为 `none`，`documentElement.scrollWidth=1067px`，没有横向溢出。该点击会同时聚焦输入区。输入卡仍按 Appearance 使用 14px 玻璃背景模糊；文字和操作区自身 `filter` 为 `none`。ChatGPT 内置浏览器新标签显示 LFAA 登录页，未输入凭据，因此本次实际交互检查使用已有登录态的 Edge 页面；纯移动鼠标的帧序列、帧时间和真实设备未测。截图在本轮浏览器检查中查看，未另存为文件；未发送消息或修改用户设置。

### 窄屏恢复入口文案补充验收（2026-10-19）

- 恢复入口由 `packages/client/ui-settings-account` 根据 support row 容器宽度切换文案：容器宽度不超过 280px 时显示“忘记密码？”，较宽时显示“忘记密码？使用恢复密钥找回”。两种视觉文案共用原有恢复模式切换操作；按钮始终保留完整无障碍名称。切换使用 140ms 淡入淡出，并服从现有 `appearance.advanced.reducedMotion` 设置及系统减少动态效果偏好。
- 当前源码服务在 ChatGPT 内置浏览器实际路由 `/`、端口 `3001` 验收。`320×520` 下 support row 为 `236.67×32px`，最终仅显示短文案，完整文案不会占布局宽度；视口变化后的中间帧同时观察到旧、新文案透明度交叉，随后完成平滑切换。`390×640` 下 support row 为 `306.67px`，保留完整文案；`1440×900` 下为 `362.67px`，也保留完整文案。三个视口均无横向溢出；页面截图在内置浏览器验收输出中查看，未另存为文件。没有提交表单或写入用户设置。
- `apps/cli/tests/client-auth-feedback-layout.test.mjs` 17/17 通过；`ui-settings-account` 包构建及完整 `pnpm run build:web` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。正式构建输出位于仓库根 `dist/`。本轮使用隔离数据 `dist/.tmp/recovery-link-acceptance-20261019/{home,data}`。端口 3000 被既有 PID 21588 占用且其工作目录无法确认，因此未触碰该进程，改用 3001 验收；本轮 3001 服务已经停止。隔离临时目录的递归清理命令被本机执行策略拦截，因此仍留在 `dist/.tmp/recovery-link-acceptance-20261019`；未尝试绕过策略。

### 登录支持行左右布局补充验收（2026-10-19）

- 按用户补充要求，登录支持行调整为左侧绿点与“服务器正常”始终同行，右侧为密码恢复入口；容器不超过 280px 时恢复入口仍切换成“忘记密码？”。窄屏隐藏的完整文案由入口自身裁切，避免绝对定位内容造成页面横向溢出；无障碍名称与恢复操作不变。
- 最终构建在 ChatGPT 内置浏览器实际路由 `/`、隔离服务端口 `3001` 检查：`320×520` 绿点/状态文案在左、短入口在右，未见横向滚动条；`390×640` 完整入口靠右，状态仍为一行；`1440×900` 桌面宽屏同样左右对齐。点击窄屏短入口进入恢复表单，点击“返回登录”后回到登录表单；未提交任何表单、未输入凭据或恢复密钥。截图在验收输出中查看，未保存为仓库文件。
- `client-auth-feedback-layout.test.mjs` 17/17、`ui-settings-account` 包构建、完整 `pnpm run build:web`、运行指纹检查 `[]` 与 `git diff --check` 通过。Vite 保留既有约 501KB cpp 分块提示。只读取现有 `appearance.advanced.reducedMotion` 与主题/强调色令牌，无新增或修改设置。3000 端口当时有既有监听 PID 29992，未触碰；3001 隔离服务已停止。隔离数据 `dist/.tmp/support-row-acceptance-final-20261019/{home,data}` 的清理命令被本机执行策略拦截，目录仍留在根 `dist/.tmp/` 下；未绕过策略。真实设备与帧时间未测。

<a id="lfaa-setup-reminder-lifecycle-and-narrow-workbench-20261019"></a>

## 121-配置提醒生命周期与窄屏引导修复-20261019

### 目标、Owner 与设置

- 修复登录凭据、模型、游戏/内容数据目录三类工作台提醒的生命周期：真实配置完成后停止；“不更改”由程序关闭对应内部标记；“去配置”只导航，返回时仍未完成则继续提醒；“今天不再提醒”按账户、类别和本地日期暂停；“稍后再说”五分钟后重新检查。
- 更新提示按账户与版本保存“我知道了”确认状态，确认后不再自动提醒；设置中心“关于与更新”始终提供本次版本公告供再次查看。
- 删除设置中心中这几类提醒的用户可见开关，包括通知页的长期/当日开关及“AI 与模型”里的 AI Provider 提醒开关；保留一般通知总开关，类别标记仅供程序内部管理。
- 修复 `/work` 未配置模型提示在窄容器内被右侧按钮挤成逐字换行；说明压缩为“尚未配置大模型”，操作明确跳转到“AI 与模型”。
- Owner：提醒编排 `packages/client/ui-settings-general/SetupReminder`；AI 活动账户由 Settings Owner 返回的 `AiAccount.active` 判定；业务目录由 Project Storage Owner 返回的 `configured` 判定；凭据完成由 Account Owner 返回的 `usernamePending/passwordPending` 判定；内部“不更改”标记由 Settings Owner 持久化；更新公告元数据由构建版本 Owner 提供；窄屏工作台引导由 `packages/client/ui-chat/AiWorkChat` 负责。
- 设置沿用 `general.notificationPopupsEnabled` 全局门控、`general.aiProviderReminderEnabled`、`general.setupReminderEnabled`、`general.defaultAdminCredentialReminderEnabled`、两类浏览器本地当日暂停标记、公告账户/版本确认记录及已有 Appearance/弹窗令牌；不新增字段、不改默认值。提醒类别开关不再呈现给用户。

### 允许、禁止与验收

- 允许：修正三类提醒按真实 Owner 状态重查与停止；隐藏所有对应类别的用户开关；补充五分钟稍后提醒、当天暂停和“我知道了”后在“关于与更新”重看公告；更新 `/work` 模型引导文案；补充直接回归与受影响包文档。
- 禁止：将“去配置”点击误记为完成；为判定模型可用而发起真实 Provider 请求；保存真实用户偏好、发送聊天请求、修改真实凭据或业务目录、重启未知服务、提交或推送。
- 验收：三类配置只在各自 Owner 确认完成后停止；“不更改”仅由程序记录内部关闭状态；“今天不再提醒”只暂停本地当天，“稍后再说”五分钟后重新检查；设置中心不出现凭据/模型/业务目录提醒及当日暂停开关，但一般通知总开关仍可用。公告“我知道了”后不自动出现，并能从“关于与更新”再次查看。普通模型引导在 `320×520` 窄视口可读且操作可达。
- 运行提醒/设置/公告/AI Work 直接回归、Client 类型检查、受影响包与正式 Web 构建、运行指纹和差异检查；使用隔离数据的当前源码 Web 与 ChatGPT 内置浏览器检查 `/work` 桌面及 `320×520` 窄屏，并检查 `/settings?section=ai`、`/settings?section=workspace`、`/settings?section=notifications` 和 `/settings?section=about`。不触碰真实用户偏好、Provider、账号凭据或业务目录；明确记录浏览器交互、截图与未测设备/帧时间。

实施与验证记录（2026-10-19）：AI Work 无活动模型提醒改为简短显示“尚未配置大模型”，下方“去配置模型”沿用 `onOpenSettings("ai")` 进入“AI 与模型”；移除导致窄容器拥挤的额外说明文字。长期开关分别位于“AI 与模型”和“项目与存储”，通知页保留按账户/类别/本地日期的当日暂停项；状态仍由 Settings Owner 的活动账户、项目存储 Owner 的 configured 结果和 Account Owner 的待处理字段决定。“稍后再说”只推迟当前类别五分钟后重新检查，不关闭长期提醒。设置继续使用既有 `general.notificationPopupsEnabled`、`general.aiProviderReminderEnabled`、`general.setupReminderEnabled`、`general.defaultAdminCredentialReminderEnabled` 和外观令牌，不新增或改默认值。

定向回归 `apps/cli/tests/client-ai-work-composer-responsive.test.mjs`、`client-setup-storage-reminder.test.mjs`、`client-auth-feedback-layout.test.mjs` 29/29 通过；`lfaa-client-ui-chat`、`lfaa-client-ui-settings-general`、`lfaa-client-ui-settings`、`lfaa-client-ui-layout` 构建通过；`pnpm run build:web` 通过，构建指纹 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。内置浏览器打开实际 `/work` 路由时，旧验收服务返回“LFAA 需要重新启动”。该服务 PID 19084 已核实为使用 `dist/.tmp/login-blackhole-validation-20261019/{home,data}` 的本仓库 Web；进程重启命令被执行策略拒绝，因此没有完成桌面/窄屏页面、设置导航实页或截图验收。未保存设置、发送聊天或调用 Provider；浏览器视口与帧时间未实测。

追加修正（用户反馈，2026-10-19）：登录页小于等于 520px 时，底部服务状态点与密码恢复入口改为靠左排列；恢复入口不收缩、不换行，状态说明仍在状态点下方展开。复用现有主题与字号，不新增设置；验收需在 `320×520` 实页确认入口单行、无横向溢出。

完整验收补充（2026-10-19）：账号界面进一步在 `260px` 以下使用现有 `--font-size-sm` 字号令牌，避免单行恢复入口撑宽卡片。提醒、AI Work、认证布局直接回归 29/29 通过，公告回归另 3/3 通过；`lfaa-client-ui-settings-account` 构建、包含 Client TypeScript 检查的 `pnpm run build:web`、`node scripts/runtime-build-state.mjs web`（`[]`）及 `git diff --check` 通过；Web 仍有既有 `cpp` 501.30 kB chunk 体积提示。实页使用当前源码服务 `http://127.0.0.1:31401` 与隔离数据根 `dist/.tmp/acceptance-clean-narrow-ai-20261019/{home,data}`。ChatGPT 内置浏览器：登录 `/work` 的 `320×520` 入口单行且页面宽 310px，无横向溢出；`240×520` 页面宽 231px，卡片不超视口、入口仍单行；`1440×900` 页面宽 1430px，恢复入口单行。点击恢复入口可打开找回密码表单，短屏滚动后“重置密码”和“返回登录”按钮均可达。工作台 `/work` 在 `320×520` 与 `1440×900` 均显示“尚未配置大模型”和“去配置模型”，无横向溢出；窄屏实点 CTA 到达 `/settings?section=ai`，标题“AI 与模型”。另只读查看 `/settings?section=workspace`、`/settings?section=notifications`、`/settings?section=about`：目标分类标题正确，通知页没有旧的模型/凭据/业务目录提醒开关，关于页在首次公告确认后仍显示完整公告。验收过程中只在隔离端口的浏览器存储确认了测试公告，并用“稍后再说”关闭隔离账户会话提醒；未改真实设置、Provider、凭据或业务目录，未发送消息或模型请求。截图在本轮内置浏览器输出中查看，未写入源码仓库。另观察到隔离服务在登录成功后后续 `/api/typert/auth/me` 返回 401 并重新显示登录页，导致会话无法长期保持；短时路由及布局验收已完成，该认证会话问题未在本次布局任务中修改。服务已停止，31401 无监听；清理临时数据的递归删除被工具策略拒绝，`dist/.tmp/acceptance-clean-narrow-ai-20261019` 仍保留。真实设备和帧时间未测。

用户澄清后的修复与验证（2026-10-19）：移除设置中心通知页的凭据、模型、业务目录长期提醒与“今天不再提醒”开关，并移除“AI 与模型”中的 AI Provider 提醒开关；类别状态只由代码内部管理。三类提醒在真实配置完成后停止；“不更改”写入既有内部标记；“去配置”只导航，返回后仍未完成则继续提示；“今天不再提醒”按账户和本地日期暂停；“稍后再说”五分钟后重新检查。版本公告确认后不再自动弹出，但可从“关于与更新”重新阅读。隔离实页逐项验证凭据当天暂停、存储/模型“去配置后仍提醒”、不更改关闭及公告确认/重看。实际添加 Provider、修改凭据或切换业务目录未执行，因此配置完成后的关闭由 Owner 状态回归覆盖，没有做真实配置写入。

定向回归 `client-setup-storage-reminder.test.mjs`、`client-auth-feedback-layout.test.mjs`、`client-release-announcement.test.mjs` 与 AI Work 响应式回归共 32/32 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、四个受影响 Client 包构建、`pnpm run build:web` 通过。运行指纹 `node scripts/runtime-build-state.mjs web` 返回 `[]`。Vite 仍有约 501 kB 的既有 chunk 警告。ChatGPT 内置浏览器使用隔离服务 `/work` 1440×900、320×520，以及 `/settings?section=notifications`、`?section=ai`、`?section=workspace` 窄屏和 `?section=about` 桌面视口；窄屏提醒弹窗操作可达且无横向溢出，相关设置页不再出现类别开关，公告页提供重看入口。隔离服务已停止；原 3000 服务未触碰，曾显示需重启提示，最终检查时 3000 无监听。真实设备、实际五分钟等待、真实配置写入与帧时间未测。清理隔离目录 `dist/.tmp/popup-reminder-acceptance-20261019` 的命令被本机执行策略拒绝，该目录仍保留。

<a id="lfaa-ai-model-catalog-refresh-20261019"></a>

## 122-模型目录刷新与容量错误隔离-20261019

### 目标、Owner 与设置

- 修复“重测模型”把官方模型目录读取与当前模型真实推理请求耦合的问题：模型容量临时耗尽时，仍应能同步 Provider 当前目录；目录更新不得自动切换用户选中的模型或思考设置。
- Owner：Provider 目录、凭据和账户持久化由 `packages/settings/settings` 持有；AI 与模型设置页由 `packages/client/ui-settings` 调用；显式推理请求继续由 `packages/llm/llm` 的真实 Provider Owner 完成。
- 设置盘点：复用已有 AI 账户 Provider ID、加密凭据引用、Provider 选项、模型 ID 与 `reasoning_mode`；模型目录仍来自 Provider 官方目录 API。设置页继续消费现有 Appearance 主题、字体、字号、对比度与减少动态效果令牌；不新增或修改设置默认值、持久化类型或权限。

### 允许、禁止与验收

- 允许：增加只刷新并持久化官方模型目录的已保存账户操作；保留单独的真实模型测试操作及明确用量提示；目录刷新无论推理模型是否容量可用都能完成；刷新期间严格保留当前账户的 `model_id` 与 `reasoning_mode`。更新设置包职责说明、本合同及长期回归。
- 禁止：静默换模型、重置用户思考设置、重试/回退到其他 Provider 或模型、读取/显示密钥、修改真实用户账户和偏好、超出用户后续明确授权范围的真实 Provider 请求、重启未知服务、提交或发布。
- 批次 B1：在隔离设置存储及合成 Provider 响应中复现目录刷新触发模型推理的缺陷；验证刷新只发起目录 GET 并更新目录、保持原选模型/思考值，模型真实请求仍只有显式测试/切换路径触发；目录移除旧选模型时保留该用户偏好并明确提示。运行 Settings 与设置 UI 直接回归、Client/Host 类型及受影响包构建。
- 批次 B2：设置页将“更新模型目录”和“测试当前模型”分开呈现，窄容器下操作仍可达；运行该批回归、Client/Host 类型、Settings 与正式 Web 构建，再以内置浏览器检查 `/settings?section=ai` 桌面与窄/短视口交互，使用隔离数据和合成 Provider，不写入真实偏好或调用真实 Provider。
- 交付记录源码/回归/构建、运行指纹、`git diff --check` 与工作区 Gate；实页记录路由、视口、实际操作、截图和未测范围。浏览器不可用时分别说明本机服务和控制工具的状态；真实 Provider、桌面与帧时间未测时明确标示。

### 实施与验证

- 已将已保存账户操作拆分为仅读取并保存官方目录的“更新目录”和单独发起真实推理的“重测模型”；目录更新保持 `model_id`、`reasoning_mode`，即使原型号已从目录移除也不自动切换。
- 设置页与 AI Work 选择器保留 Provider 返回的原始 `name` 与 `id`，并从官方更新日志补充当前版本徽标；版本不会拼进模型名称或请求 ID。DeepSeek 官方目录示例为 `deepseek-flash / DeepSeek-V4.1-Flash`、`deepseek-v4-pro / DeepSeek-V4-Pro`；官方更新日志确认 Flash 当前版本为 `DeepSeek-V4.1-Flash-1017`，API 仍以 `deepseek-flash` 调用（[官方模型列表](https://api-docs.deepseek.com/api/list-models/)、[官方更新日志](https://api-docs.deepseek.com/zh-cn/updates/)）。更新日志读取限 2 MB、5 秒并共享 5 分钟缓存；不可用时不影响目录刷新。隔离回归模拟官方更新页返回 1017，验证目录刷新不发推理请求、显式重测准确返回模拟容量错误，并验证版本标签经持久化后仍单独显示、名称与 ID 不变。Settings/Provider/模型能力定向回归 7/7 通过。
- `lfaa-settings`、`lfaa-api-settings-controller`、`lfaa-client-connection`、`lfaa-client-ui-settings-models`、`lfaa-client-ui-settings`、`lfaa-client-ui-chat` 包构建及 Web、Control Plane 正式构建通过；Client TypeScript、`check:workspace`（193 packages）和 `git diff --check` 通过。Web 构建保留既有 cpp 资源块超过 500 kB 的提示。
- 用户后续明确提供 API 并授权真实验证：只在临时进程环境中请求官方 `GET /models` 与一次最小 `POST /chat/completions`，两者均返回 HTTP 200；响应对应 `deepseek-flash / DeepSeek-V4.1-Flash` 与 `deepseek-v4-pro / DeepSeek-V4-Pro`。当前版本徽标另从官方更新日志读取，不依赖模型目录响应是否含版本字段。凭据未写入仓库、账户设置或文件，临时环境已清除；未保存/改动真实账户与偏好。
- Web 与 Control Plane 当前构建指纹均为空差异；隔离正式服务 `http://127.0.0.2:49687/settings?section=ai` 返回 HTTP 200。ChatGPT 内置浏览器状态确认该路由的标签标题为“LFAA 工作台”，但多次读取页面 AX 状态/截图均因 `cua_repl` 执行超时重置内核，无法确认设置页正文渲染或完成操作；因此桌面、窄/短视口、交互与帧时间未验收，未标为通过。隔离服务已停止；测试目录 `dist/.tmp/ai-model-catalog-acceptance-20261019-a` 因本机执行策略拒绝递归清理命令而保留。原 `127.0.0.1:3000` 用户服务未重启或改动。

<a id="lfaa-web-startup-auto-rebuild-20261019"></a>

## 123-Web 启动自动补建修复-20261019

### 目标、Owner 与设置

- 修复 Windows 工作台菜单 2 → 子菜单 1/回车时，Control Plane 关键构建入口缺失却继续运行 `pnpm lfaa web` 的问题；缺失或过期时先自动运行 `pnpm run build:control-plane`，之后再检查 Web 构建并启动。
- 已确认根因：`runtime-build-state.mjs web` 正确报告 `host` 与 `web` 构建过期；Windows PowerShell 5.1 的 `ConvertFrom-Json` 将顶层 JSON 数组作为单个嵌套数组对象返回，原来的 `-contains 'host'` 判断因而为假。PowerShell 7 的相同解析方式不会复现。
- Owner：正式构建状态由 `scripts/runtime-build-state.mjs` 判断；Windows 菜单预检与命令编排由 `scripts/install-dependencies.ps1` 持有。Web、Control Plane 与 Daemon 运行职责不变。
- 设置中心配置：不涉及。沿用当前源码、`dist/apps/control-plane` / `dist/apps/web` 关键输出、构建指纹和根目录 pnpm 工作区。

### 允许、禁止与验收

- 允许修改菜单启动预检、对应 Windows PowerShell 回归、本合同及必要 CLI 启动文档。
- 缺失或过期的 Control Plane 必须在 Web CLI 之前构建；需要时再构建 Web。构建失败或重建后仍有过期输出时停止启动并保留诊断信息。
- 禁止绕过构建、忽略关键输出、改写真实运行数据、停止未知服务/Daemon/实例、改变设置或扩展菜单其他模式。
- 使用 Windows PowerShell 5.1 与当前 PowerShell 回归 JSON 数组解析；核验构建命令次序、Control Plane/Web 指纹与关键产物；执行 `git diff --check`。本任务不是 UI 变更，不做浏览器视口验收；如运行完整 Web，仅允许使用隔离端口与隔离数据并关闭本机 Daemon。

### 实施与验证

- `ConvertFrom-StaleRuntimeBuildJson` 展开 Windows PowerShell 5.1 `ConvertFrom-Json` 返回的嵌套顶层数组，使缺失/过期的 `host` 与 `web` 状态能进入原有自动构建分支；依次构建控制端、Web 后重新核对运行树，仍缺失或过期时中止，不运行 CLI。
- Windows PowerShell 5.1 Pester 定向回归 `scripts/tests/install-dependencies-startup.Tests.ps1`：5/5 通过，覆盖 `host` 单项、`host` + `web`、空数组，以及构建/复核先于 CLI 的顺序。
- `pnpm run build:control-plane`、`pnpm run build:web` 均通过；Web 构建保留既有约 501 kB C++ chunk 提示。`node scripts/runtime-build-state.mjs web` 返回 `[]`，Control Plane 关键入口与 Web `index.html` 均存在；`git diff --check` 通过。
- `node --test scripts/tests/compiled-web-startup.test.mjs` 启动隔离 CLI 后健康接口和首页检查通过，但在既有 `POST /api/auth/setup` 断言处得到 404 而非 201，后续认证/设置断言未执行；本轮未改认证路由。`pnpm run check:workspace` 失败于 `docs/harness-packages.md` 包目录 Markdown 清单过期；该清单不在本轮改动范围。仓库要求的 `workspace-preflight` 脚本当前不存在。未运行完整菜单启动、未进行浏览器/设备验收；没有启动或修改用户 Web/Daemon 服务及用户数据。

<a id="lfaa-login-transition-continuity-20261019"></a>

## 124-登录转场连续性修复-20261019

### 目标、Owner 与设置

- 修复黑洞式登录转场结束时覆盖层与工作台同帧切换造成的顿挫，并让登录卡片吸入曲线起止速度平滑。
- Renderer 持有登录阶段、工作台预热与交互门控；`ui-settings-account` 持有登录覆盖层和内置视觉；认证、设置/会话与工作台业务 Owner 不变。
- 沿用 `appearance.advanced.reducedMotion`、`appearance.advanced.authTransitionPluginId`，以及现有主题、登录背景、强调色和遮罩映射；不新增设置、不修改或写入用户偏好。

### 允许、禁止与验收

- 允许：仅修改 Renderer 内置转场收尾阶段、登录覆盖层淡出与卡片缓动、对应直接回归及登录转场合同/包 README。
- 禁止：改变登录 API、身份/会话行为、插件生命周期、设置默认值或工作台提醒语义；不得操作真实账户偏好、重启/停止来源不明服务、覆盖已有脏工作、提交或发布。
- 验收：直接回归证明动画结束先进入重叠收尾、工作台在视觉淡出期间仍 inert/aria-hidden、覆盖层 transitionend 后再解除门控；卡片 easing 首尾减速；认证和减少动态效果路径不变。运行直接回归、Client 类型及所属包/Web 构建和 `git diff --check`；用当前源码服务在 ChatGPT 内置浏览器检查真实登录/登录成功转场的桌面和窄短屏，记录路由、视口、交互、截图和未测范围。实页使用隔离端口与隔离数据，不写真实账户或设置。

### 实施与验证

- `App.tsx` 增加内置转场收尾态：黑洞主动画结束、取消或 2250ms 兜底时先让预热 Workbench 在覆盖层后显现；`authTransitionPhase` 保持 `entering`，因此淡出期间 Workbench 仍保持 `inert`/`aria-hidden`。登录覆盖层执行 240ms `opacity` 淡出，根覆盖层收到 `transitionend` 后再解除门控；480ms 兜底覆盖减少动态效果或浏览器未派发结束事件的情况。卡片吸入曲线改为首尾减速的 `cubic-bezier(.42, 0, .58, 1)`。减少动态效果路径禁用淡出动画。
- `client-auth-feedback-layout.test.mjs` 定向回归 17/17 通过；Client `tsc --noEmit`、`ui-settings-account` 与 `ui-renderer` 包构建、`pnpm run build:web` 通过；Web 与 Control Plane `runtime-build-state.mjs` 均返回 `[]`，`git diff --check` 通过。Web 构建提示既有 C++ chunk 约 501 kB。`pnpm run check:workspace` 首次报告包目录 Markdown 清单过期；同步清单后再次检查通过（193 个包）。
- 当前 checkout 的源码 Web 服务使用隔离地址 `http://127.0.0.2:31324/`、隔离 Home/Data 与 `--no-local-daemon` 启动，首页 HTTP 200。ChatGPT 内置浏览器在 1440×900 查看登录页并提交隔离测试账户登录，成功进入 `/work`；另在 390×640 查看登录表单无横向溢出，并重新登录成功进入 `/work`。`/work` 窄屏截图中登录提醒弹窗完整位于视口内。截图在本轮内置浏览器中查看，未另存到仓库。默认视口已恢复为 1280×720；本轮 PID 26120 已按命令行核实后停止，31324 端口已释放；原 3000 端口服务未触碰。
- 已验收源码/构建及桌面、窄屏实际登录链路；没有录制或量测动画逐帧时间，因此“丝滑”依赖曲线与覆盖层收尾的实现及实页流程观察，不声称帧时间验收。未测试真实账户、桌面安装包、真机触屏与不同刷新率设备。未修改登录 API、认证信息或用户偏好；未提交或发布。

<a id="lfaa-ui-settings-account-tabs-20261019"></a>

## 125-设置中心账号页合并-20261019

### 目标、Owner 与设置

- 将“个人资料”“安全”“账户”三个设置入口合并为单一“账号”入口，并在页面内用“个人资料 / 安全 / 账号管理”三个 Tab 分类展示。
- 设置 UI Owner 为 `packages/client/ui-settings`；个人资料继续读取当前认证会话用户，邮箱/用户名/密码/恢复密钥/通行密钥继续经现有 Account Owner，账号管理继续由 `AdminUsersPage` 调用现有管理 API。
- 不新增、修改或持久化设置项。沿用当前 Appearance 共享主题与布局令牌；Tab 分类仅为界面导航状态。
- 兼容既有 `section=profile`、`section=security`、`section=account` 深链和外部安全设置入口，让它们进入账号页对应 Tab。

### 允许、禁止与验收

- 允许：修改设置页共享导航与账号页 Tab、直接相关样式、`ui-settings` 包职责说明、必要回归和本合同。
- 批次 B1：在三类现有页面加入同一组可键盘操作的页内 Tab，并共用“账号”页标题；逐一确认旧路由仍选中对应 Tab、内容及原 Owner 操作不变。运行直接回归、Client 类型和 `ui-settings` 构建，并用 ChatGPT 内置浏览器检查当前源码页面。
- 批次 B2：侧栏只保留“账号”一项，移除“个人资料/安全”独立项；将原“账户”入口命名为“账号”，三种旧分类状态均高亮同一入口，搜索仍可用个人资料/安全关键词找到账号页。重复运行直接回归、Client 类型、`ui-settings` 与 Web 构建，并在内置浏览器桌面和窄/短视口检查导航、Tab 切换、溢出和滚动。
- 浏览器验收使用隔离数据，不写入真实账户设置、凭据或用户管理记录；完整记录路由、视口、交互、截图及未测范围。执行 `git diff --check` 和适用工作区 Gate；不得把构建结果当作实页验收。
- 禁止：改变认证/API/Account Owner 或 `AdminUsersPage` 管理合同，修改账号数据、设置默认值/持久化、主题偏好，重启未知服务、提交或发布。

### 实施与验证

- 批次 B1 已在三类页面统一显示“账号”标题和“个人资料 / 安全 / 账号管理”键盘可操作 Tab；原账户资料、Account 安全表单与 AdminUsersPage 内容各自保留。旧 `section=profile/security/account` 状态仍可直达对应 Tab。
- `apps/cli/tests/client-settings-account-tabs.test.mjs` 1/1、`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-settings run build` 与 `pnpm run build:web` 通过；Web 运行指纹为 `[]`。
- 隔离 Web `http://127.0.0.1:31402/settings?section=profile` 的 ChatGPT 内置浏览器实测 755×647：个人资料页面、点选安全 Tab 后账户名/邮箱/密码/恢复密钥/通行密钥控件显示、点选账号管理 Tab 后 AdminUsersPage 显示隔离 super_admin 列表。B1 截图在验收输出中捕获；未输入或保存账号凭据、未执行新增/编辑/删除。
- 完整补验在侧栏分组原本折叠时发现“账号管理”别名虽过滤出账号项、分组却未自动展开；搜索框和候选过滤曾使用不同的匹配词。现由 `getSettingsSectionSearchText` 统一匹配与分组展开，并补充回归断言。重新实测“个人资料”“安全”“账号管理”“账户”均只显示一个可见的“账号”项，自动展开“个人”组；点击结果清空搜索并进入账号页。三种旧链接直接打开各自 Tab，实际按下 ArrowRight、Home、End 后选中项及 URL 正确同步。
- 最新 Client/Host 类型检查（`pnpm run typecheck`）、定向回归 2/2、`lfaa-client-ui-settings` 构建、Web 与 Control Plane 构建、`pnpm run check:workspace`（193 个包）和 `git diff --check` 均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。Web 构建仍提示 C++ 语法块约 501.3 kB，属于既有分块告警。
- ChatGPT 内置浏览器验收当前源码 Web 路由：桌面 1440×900、平板请求 768×1024（实际浏览器 `innerHeight=1025`）、手机 320×520。各视口均检查单一侧栏“账号”入口和三项 Tab；手机文档宽度 310px / 320px、标签栏 224px / 224px 无横向溢出，个人资料与安全内容能在 252px 宽正文中纵向滚动；账号管理正文滚动高度 756px、可视高度 379px，实际滚动到 376.9px。手机打开导航并选择“账号”后覆盖层收起、正文恢复；搜索命中组原先折叠时，四种别名均能展开并显示“账号”。截图已在验收输出中捕获。实页使用隔离数据；未修改凭据、设置偏好或用户记录。实际设备、帧时间未测；浏览器控制台日志能力不可用，未读取客户端日志。隔离服务停止后记录 PID 27564 的 3000 端口原服务未重启或停止。
- 本任务复用现有 Appearance 令牌；未新增设置项。隔离验收目录清理曾被自动审批策略拒绝，目录仍保留；共享工作树中的其他既有修改未触碰。

<a id="lfaa-first-login-reminder-queue-and-preferences-20261019"></a>

## 126-首次登录提醒队列与偏好修复-20261019

### 目标、Owner 与设置

- 修复全新隔离账户首次登录后只显示默认凭据提醒，后续 AI Provider、业务内容目录提醒及版本公告没有按顺序显示的问题。
- 队列顺序：默认凭据 → AI Provider → 业务内容 `data` 目录；所有待处理项结束或按用户偏好关闭后，Workbench 再显示未确认的当前版本公告。不再单独弹出“游戏安装位置”提醒；SteamCMD 默认安装路径继续沿用“项目与存储”的现有配置入口。
- Owner：凭据状态归 Account Owner、`ui-renderer` 读取；AI Provider 状态归 Settings/AI Account Owner；业务内容目录归 Project Storage Owner；队列/Modal 归 `ui-settings-general`；版本公告归 `ui-layout/Workbench`；偏好持久化归 Settings Owner，入口归 `ui-settings`。
- 设置盘点：复用 General 中的 `defaultAdminCredentialReminderEnabled`、`aiProviderReminderEnabled`、`setupReminderEnabled` 和全局 `notificationPopupsEnabled`。前三个类别状态由对应提醒弹窗的“不更改”操作保存到 Settings Owner；设置中心不展示首次登录提醒分类开关。公告只使用通知总开关，并按账户/版本在浏览器本地保存“我知道了”确认，不新增公告偏好设置。已有类别状态和当日暂停记录不重置。
- 业务内容 `data` 目录提醒统一指向“项目与存储”。不再为“游戏安装位置”增加单独的首次登录提示。版本公告只服从通知总开关和账户/版本确认记录；真实桌面更新器发出的可选下载/安装对话框及强制更新仍由更新器 Owner 管理。

### 允许、禁止与验收

- 允许：修复当前提醒队列的共享显示门控；确保 SteamCMD 游戏安装位置不进入首次登录提醒检查；设置中心只保留既有全局通知总开关，不增加首次登录分类开关；版本公告服从全局通知总开关和账户/版本确认记录；补充直接回归与相关 Owner README/合同。
- 队列动作须只影响当前类别：暂缓/今日暂停后继续下一项，五分钟后/次日该类别再重试；“去配置”只导航并在返回后按真实 Owner 状态复查；“不更改”只关闭对应类别长期偏好。默认优先级凭据在前，之后模型、业务内容目录。
- 禁止：读取/修改真实用户偏好、Provider 凭据或账户，调用真实 Provider、迁移业务数据、执行 SteamCMD 安装/校验，改变账户认证或更新器 mandatory 合同，重启/停止未知服务、覆盖已有并行修改、提交或发布。
- 批次 B1：修复队列推进和 AI/Project Storage Owner 检查/失败处理；直接回归覆盖凭据暂停后继续、逐项“今日不再提醒”、暂缓到期重现、配置未完成返回后继续、弹窗偏好关闭后不检查对应 Owner、公告等待队列完成，并确认 SteamCMD Owner 不被首次登录提醒读取。复核 Settings schema/default/归一化只使用既有提醒偏好与通知总开关，不新增安装目录提醒偏好。
- 批次 B2：通知设置不显示首次登录分类开关，既有总开关仍统一暂停/恢复提醒；弹窗“不更改”分类状态继续由 Settings Owner 保存，公告确认按账户/版本记录。运行 B1/B2 回归、Client/Host 类型、受影响包构建、正式 Web/Control Plane 构建、构建指纹、`git diff --check` 与适用 workspace Gate。
- ChatGPT 内置浏览器使用隔离 Home/Data 与隔离账户完整走首次登录队列：凭据、模型、业务内容目录、版本公告按序显示，SteamCMD 游戏安装位置不弹提醒；检查 `/settings?section=notifications` 中没有首次登录分类开关且总开关能够暂停/恢复弹窗，弹窗内的“不更改”只关闭对应类别，其余类别继续；改动设置只写隔离账户。检查 `/settings?section=notifications`、`/work` 桌面及 `320×520` 窄短屏；记录实际路由、视口、操作、截图及未测项。真实 Provider/安装任务/用户账户、桌面更新器/设备与帧时间不因实页验收而触发，单独标记未测。

### 实施与验收记录（2026-10-19）

- 按用户最新要求彻底移除独立“游戏安装位置”首次登录提醒及其队列检查/暂停类别；保留业务内容数据目录提醒。SteamCMD 相关配置仍由“项目与存储”现有入口管理。通知页没有首次登录分类开关，仅保留既有“通知总开关”。
- 内置浏览器隔离服务 `http://127.0.0.2:31328` 使用 `dist/.tmp/first-login-reminder-acceptance-20261019-b2/home` 与 `data`。`/work` 在 320×520 与 1246×925 实测队列均为默认凭据 → AI Provider → 业务内容数据目录 → LFAA 0.0.8 版本公告；业务目录弹窗文案/路径可见，页面没有 Steam/游戏安装位置提示。逐项点击“今日不再提醒”仅写隔离浏览器本地状态，随后公告接续显示。
- `/settings?section=notifications` 在桌面 1245×925 与窄短屏 320×520 验收：未显示首次登录类别开关；窄屏 document/body 宽 310px，小于 320px 视口，无横向溢出。通知总开关关闭后出现“所有弹出提醒已暂停”，点击“恢复通知”后开关重新为开启。仅隔离账户状态被切换，结束时已恢复开启。
- 截图在 ChatGPT 内置浏览器验收输出中捕获：凭据弹窗、业务数据目录桌面及窄屏弹窗、通知设置桌面与窄屏。截图未另存为仓库文件。
- 第二个独立隔离副本验证长期“不更改”：分别在凭据、AI Provider、业务内容目录弹窗点击“不更改”，每次都进入下一类别，三次 `/api/settings/general` 写入均返回 200，之后版本公告显示。服务重启后 `/work` 再载入正常且无 Modal；已关闭的三类提醒没有重现，AI 未配置仍保留工作台内联状态提示。所有偏好只写 B3 隔离副本。
- 定向回归 `client-setup-storage-reminder.test.mjs`、`settings-contract.test.mjs`、`client-release-announcement.test.mjs`、`client-auth-feedback-layout.test.mjs` 共 28/28 通过；`pnpm run typecheck`、Settings/General/UI Settings/Layout/Renderer 包构建、Control Plane/Web 构建、`pnpm run check:workspace`（193 个包）、`runtime-build-state.mjs web`（`[]`）及 `git diff --check` 均通过。Web 构建有既有 C++ chunk 501.3KB 体积提示。
- 未调用真实 AI Provider、SteamCMD 安装/校验或真实账户；未验收桌面更新器、实体设备和帧时间。隔离服务停止后，未触碰端口 3000 的既有服务。
- 最后复核时共享工作树新出现 UI Plugin Manager 与 Sidebar 源码/package 变更；当前 `pnpm run check:workspace` 因包目录 JSON/Markdown 清单过期失败，`runtime-build-state.mjs web` 当前返回 `['host','web']`。这两项在新增共享变更出现前均通过；没有覆盖或修正其他工作中的包清单/构建输出。该并行源码变更后的构建未运行，因此本文的构建与浏览器证据对应本任务源码当时的构建快照。

<a id="lfaa-settings-narrow-toolbar-layout-20261019"></a>

## 127-设置中心窄视口工具栏排版修复-20261019

### 目标、Owner 与设置

- 修复设置中心在窄分栏/嵌入视口中，工具栏状态标签占据过大的 flex 基准宽度，导致“立即保存”单独掉行；缩短通知页说明卡内容，避免提示在窄栏中过高。
- UI Owner 为 `packages/client/ui-settings` 的 `SettingsPage` 与其样式；外层全局导航和 `ResizableWorkbench` 的职责及宽度合同不变。
- 设置盘点：不新增或修改配置；沿用 `general.notificationPopupsEnabled` 与当前 Appearance 共享主题令牌。不写入设置或偏好。

### 允许、禁止与验收

- 允许：按 `settings-main` 容器宽度为工具栏状态标签、恢复默认和立即保存安排稳定的网格断点；精简通知页现有说明的等义文案；补充直接回归、`ui-settings` README 与本合同。
- 禁止：改变保存/恢复默认行为或顺序、设置值/默认值/持久化、其他设置页面布局、全局导航/ResizableWorkbench 布局、主题与用户偏好；不覆盖工作树中已有的并行修改，不操作端口 3000 的服务，不提交或发布。
- 直接回归覆盖窄容器断点、按钮同排/成组换行、通知说明仍准确，运行 Client 类型检查、`lfaa-client-ui-settings` 与 Web 构建、适用 workspace Gate 和 `git diff --check`。
- ChatGPT 内置浏览器对当前源码 `/settings?section=notifications` 检查桌面 `1440×900`、分栏 `410×736`、窄栏 `360×736` 与短屏 `320×520`；记录真实视口、工具栏/说明卡尺寸、横向溢出、纵向滚动和操作可达性。验收使用隔离 Home/Data/账户，不点击保存或恢复、不改变通知开关；同时目视查看“通知”页与一处其他设置页，确保只修复本次目标。

### 基线（2026-10-19）

- 当前源码隔离服务 `http://127.0.0.1:31422/settings?section=notifications`，隔离 Home/Data 位于根目录 `dist/.tmp/settings-responsive-acceptance-20261019/`。实际页面初次登录后以真实通知页路由验收，未修改设置值。
- `360×736`：页面无横向溢出；`.settings-main` 宽 302px，工具栏高 141px，操作行高 80px，“恢复默认”位于 y=52、“立即保存”位于 y=96，主要操作被孤立换行；通知说明卡高 229px。`410×736` 中操作均能位于同排，证明断点与内容宽度有关。
- 当前 Web 构建指纹检查为 `[]`；未触碰既有 `127.0.0.1:3000` 服务。本合同开始时源码尚未修改。

### 实施与验收记录（2026-10-19）

- `SettingsPage.css` 按 `settings-main` 容器宽度将窄栏工具栏改为网格；`380px` 以下自动保存说明独占一行，两项操作同排等宽显示。410px 分栏仍按容器规则稳定排列；桌面布局未变。通知页保留接入状态与含义，删去重复列举的外部事件，只说明小鱼智能体回复通知已接入、外部事件暂无连接器。
- `client-settings-responsive-toolbar.test.mjs` 定向回归 2/2 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-settings run build`、`pnpm run build:web`、`pnpm run check:workspace`（193 包）、`git diff --check` 均通过。Web 构建指纹为 `[]`。Web 输出只写到根 `dist/apps/web` 与包输出 `dist/packages`。
- ChatGPT 内置浏览器当前源码路由 `/settings?section=notifications`：桌面 `1440×900` 工具栏 58px、说明卡 97px；分栏 `410×736` 工具栏 119px、说明卡 141px；窄栏 `360×736` 工具栏从 141px 降至 119px、说明卡从 229px 降至 141px，`立即保存` 不再孤立换行。短屏 `320×520` 文档宽 310px、小于视口；正文容器可滚动至 `scrollTop=1295px`，通知“试听”按钮可见且可用。通知总开关保持开启，保存/恢复按钮仅检查可见和可用，没有点击或写入设置。
- 同一内置浏览器在 `360×736` 查看 `/settings?section=general`：页面宽 350px，小于视口；工具栏操作可见，正文按内部滚动。截图在内置浏览器验收输出中捕获，未写入源码仓库；临时视口已恢复为 `1280×720`。
- 样式/文案改动未新增订阅、请求、观察器或交互状态；未做帧时间测量。隔离 Web 服务 `31422` 已停止；原 `3000` 服务未操作。清理隔离数据目录 `E:\\lfaa1\\lfaa\\dist\\.tmp\\settings-responsive-acceptance-20261019` 的递归删除被命令策略拒绝，目录保留且仅含本次隔离验收数据。
- 最后复核时共享工作树新出现 UI Plugin Manager 与 Sidebar 源码/package 变更；当前 `pnpm run check:workspace` 因包目录 JSON/Markdown 清单过期失败，`runtime-build-state.mjs web` 当前返回 `['host','web']`。这两项在新增共享变更出现前均通过；没有覆盖或修正其他工作中的包清单/构建输出。该并行源码变更后的构建未运行，因此本文的构建与浏览器证据对应本任务源码当时的构建快照。

<a id="lfaa-plugin-manager-three-column-workspace-20261019"></a>

## 128-插件管理三栏工作区-20261019

### 目标、Owner 与设置

- 将 `/plugin-manager` 从“全局左导航轨 + 右侧内容区”调整为“全局导航轨 + 插件二级菜单 + 展示区”，按 ChatGPT 三栏模式组织；左侧菜单提供当前插件分类与已登记的插件扩展入口。
- 复用 `packages/client/ui-sidebar` 的 `GlobalNavigationRail` 与抽取后的共享 `SecondaryNavigation`，使用 `packages/client/ui-dockkit` 的 `ResizableWorkbench` 承担二级栏宽度、拖拽、吸附、收起和窄屏 Overlay；分类选择继续由 `PluginManagerPage` 单一 `workspaceTab/selectedPluginTab` 状态持有。
- 二级导航菜单抽取自 `packages/client/ui-settings/src/SettingsPage.tsx`，设置页继续消费同一菜单组件，保留原分组展开、滚动、键盘与当前项语义；插件分类映射继续复用 `ui-settings` 与各能力 Owner，不复制表单、数据或权限逻辑。
- 设置盘点：不新增设置或改偏好；沿用 Appearance 的主题、侧栏颜色、字体/字号、对比度、壁纸/遮罩/模糊和减少动态效果映射。二级侧栏宽度沿用 DockKit 已有共享宽度偏好；`general.navigationLayout` 继续只由应用工作区消费，本路由按用户要求保留三栏。
- 生命周期：不增加订阅、轮询或网络读取；现有插件清单读取、设置按需加载和取消逻辑不变。拖拽、观察器与事件清理由 DockKit 现有 Owner 负责。

### 允许、禁止与验收

- 允许：修改 `packages/client/ui-sidebar` 的共享二级导航组件/样式与导出；修改 `packages/client/ui-settings/src/SettingsPage.tsx/.css` 使设置侧栏继续复用抽取组件；修改 `packages/client/ui-plugin-manager/src/PluginManagerPage.tsx/.css` 及其 `package.json` 接入 DockKit；更新相关包 README、本架构事实、此合同/索引和 `apps/cli/tests/plugin-manager-ui.test.mjs`。
- 禁止：改变插件分类顺序/名称、动态插件入口、筛选/设置内容和现有 Owner；复制分类状态、服务、数据、权限或设置；新增用户偏好或 CSS 自定义属性；修改真实插件清单、启停/安装/卸载插件、改真实偏好；覆盖其他未提交工作；重启或结束无法确认归属的服务；提交或发布。
- 验收：定向 UI 回归证明两页共用同一二级菜单组件、全局导航仍由原组件持有、插件分类只有一个状态源且支持动态入口；运行 Client 类型检查、ui-sidebar/ui-settings/ui-plugin-manager 包构建、正式 Web 构建、适用 workspace Gate、构建指纹与 `git diff --check`。工作区包依赖变更时运行 `sync:workspace` 并审查生成差异。
- ChatGPT 内置浏览器对当前源码 `/plugin-manager` 检查桌面 `1440×900`、窄短 `390×640` 与 `320×520`；记录实际三列/Overlay 尺寸、菜单选择、拖动/收起交互、滚动与横向溢出，以及截图证据。实页只浏览，不触发插件检查、安装、启停、卸载或设置保存；明确区分构建、实页、桌面 WebView、实体设备和帧时间证据。

### 实施与验收记录（2026-10-19）

- `plugin-manager-ui.test.mjs` 定向回归 8/8 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-sidebar` / `lfaa-client-ui-settings` / `lfaa-client-ui-plugin-manager` 包构建、`pnpm run build:web`、`pnpm run sync:workspace`、`pnpm run check:workspace`（193 包）、`runtime-build-state.mjs web`（`[]`）和 `git diff --check` 均通过。正式 Web 输出写入根 `dist/apps/web` 与 `dist/packages`。
- ChatGPT 内置浏览器在当前源码 `/plugin-manager` 实测桌面 `1440×900`：全局导航轨宽 64px，二级菜单在 x=78px 起，DockKit 分隔条位于 x=270px，ARIA 当前宽度值为 206px；中央区域正常显示，文档无横向溢出。点击“插件”二级菜单后，当前项和中央分类内容同步切换。桌面截图在内置浏览器验收输出中捕获，未写入仓库。
- `390×640` 窄屏：全局导航轨宽 48px，主区宽 332px；二级菜单收至左侧 Overlay，宽约 279px，闭合时由 x=60px 的“展开插件导航”入口打开；无横向溢出。`320×520` 短屏：全局导航轨宽 48px，主区宽 262px，Overlay 宽约 240px，页面文档宽 310px、小于 320px 视口；浏览器截图显示公告弹窗占据内容区。
- Web 服务由仓库正式菜单启动，归属当前 checkout；`/` 与 `/plugin-manager` 均返回 HTTP 200，13 个入口资源全部存在，构建指纹 `[]`。加载延迟出现的版本公告遮挡了分隔条和收起入口，因此没有关闭公告（关闭会写入已读偏好），也没有完成拖拽/收起的实页交互、内部滚动覆盖；DockKit Owner 已接入，源码/包构建通过不等于这两项浏览器交互已验收。
- 未测 Electron/Tauri 桌面、实体设备、帧时间或实际插件操作。未新增设置或 CSS 自定义属性，未修改真实插件数据或设置偏好；沿用 Appearance 主题映射、GlobalNavigationRail 与 DockKit 已有共享宽度偏好。

### 后续补充验收（2026-10-20）

- 当前正式 Web `/plugin-manager` 的内置浏览器 `1246×925` 视口：DockKit 分隔条 ARIA 宽度从 `206px` 拖至 `256px`，再拖回 `206px`；分别点击“收起插件导航”和“展开插件导航”，最后恢复为展开状态。没有改变原宽度或栏开合偏好。
- 该补验确认了现有分隔条指针拖动与收起/恢复行为。插件目录内部滚动未专项测量；前述公告阻挡的旧轮次记录保留为历史事实。桌面 WebView、实体设备和帧时间未测。

<a id="lfaa-plugin-manager-open-settings-20261020"></a>

## 129-插件管理页设置中心齿轮入口-20261020

### 目标、Owner 与设置

- 在 `/plugin-manager` 插件目录工具栏图二红框位置增加齿轮按钮，外观参考图三；按钮打开 LFAA 自有设置中心现有 `plugins` 分区，入口沿用 SettingsPage 的主题和导航样式。
- 调用链：`PluginManagerPage` 持有图标按钮；`ui-layout/Workbench` 的 `openSettings("plugins")` 负责设置路由、更新设置分区请求并保存返回 `/plugin-manager` 的路径；`ui-settings/SettingsPage` 继续持有设置分区与能力内容 Owner。复用现有设置页，不复制插件清单、能力状态或开关。
- 设置盘点：不新增设置项或改变 `plugins.enabled`；进入分区时沿用 SettingsPage 既有行为，将“上次打开的设置分区”记为 `plugins`。该导航记忆不改变插件配置。共享 Appearance 外观由 Workbench/SettingsPage 继续提供。

### 允许、禁止与验收

- 允许：修改 `ui-plugin-manager/PluginManagerPage.tsx/.css`、`ui-layout/Workbench.tsx` 与 README、`ui-settings/SettingsPage.tsx` 的设置分区请求类型、相关包 README、`docs/系统总体架构.md`、本合同/索引和直接 UI 回归。
- 禁止：新建第二个插件设置页面、重做设置中心能力数据、增加假连接器/逐插件开关、改变 `plugins.enabled` 与 Settings Owner 存储、插件安装/启停/卸载或设置保存；保留工作树其他改动，不提交或发布。
- 直接回归确认齿轮位于工具栏红框位置且有可访问名称、调用 `openSettings("plugins")`，Workbench 将 `plugins` 路由请求传给 SettingsPage，并保留插件管理返回路由。运行 Client 类型检查、相关包构建、正式 Web 构建、适用 workspace Gate、Web 构建指纹和 `git diff --check`。
- ChatGPT 内置浏览器验收当前源码 `/plugin-manager` 桌面与窄短视口：确认齿轮位置、可见性与键盘/点击行为；点击后落到设置中心 `plugins` 分区并呈现现有真实内容；通过返回入口回到 `/plugin-manager`。不点设置开关、不保存、不操作插件；截图、尺寸、实际路由与任何阻塞条件记录在实施验收。

### 实施与验收记录（2026-10-20）

- `plugin-manager-ui.test.mjs` 定向回归 9/9、`pnpm exec tsc --noEmit -p tsconfig.client.json`、插件管理/设置/布局 Client 包构建、`pnpm run build:web`、`pnpm run check:workspace`（193 包）、`runtime-build-state.mjs web`（`[]`）和 `git diff --check` 均通过；产物写入根 `dist/packages` 与 `dist/apps/web`。
- 重新从当前源码工作区通过正式项目菜单启动 Web。启动预检识别并重启本 checkout 的 LFAA Web 锁持有进程，当前 `http://127.0.0.1:3000` 已加载最新 `/plugin-manager`。内置浏览器已看到真实插件页与“打开插件设置”齿轮按钮；延迟出现的版本提醒遮住了页面交互。为避免确认提醒改变账户偏好，没有关闭弹窗，因此齿轮跳转、目标分区、返回路径、窄视口与该批截图尚未验收。
- 按钮跳转会经过 SettingsPage 既有的分区导航记忆逻辑，选择后将 `plugins` 写入对应账户的本地上次访问分区；插件配置、连接器数据和插件生命周期不受影响。后续若执行点击验收，必须保留/恢复原分区值，不改变用户偏好。
- 桌面 WebView、设备或帧时间未测；未提交或发布。

### 实页结果与用户纠正（2026-10-20）

- 当前正式 Web `http://127.0.0.1:3000/plugin-manager`，内置浏览器桌面 `1440×900` 可见齿轮；点击实际进入 `/settings?section=plugins`，但显示的是“扩展工作台”总览及运行策略、本机 Skill 目录。该结果证明齿轮可导航，不代表目标菜单正确。用户随后指出设置中心没有“集成 → 插件”菜单、页面样式和开关与其他设置不一致；本合同目标未验收，由 #131 完成修正。
- 当时未点开关、保存或操作插件。插件页窄/短视口下的齿轮、键盘操作、桌面 WebView、实体设备与帧时间未测；未提交或发布。

<a id="lfaa-application-workspace-four-column-navigation-20261020"></a>

## 130-应用工作区四栏导航整合-20261020

### 目标、Owner 与设置

- `/work` 及应用工作区按截图组成四栏：最左全局导航轨、左二应用/会话二级导航、中间业务或小鱼智能体工作区、右侧工具与资源栏。应用清单进入左二栏，沿用原 `GlobalNavigationRail` 所消费的 `applicationNavigationItems` 和原路由/`onOpenApplication` 调用链；应用图标负责展开/收起现有左侧 Dock。
- Owner：`ui-workspace/ApplicationWorkspace` 组合页面；`ui-sidebar/GlobalNavigationRail` 持有通用全局导航；`ui-sidebar/SecondaryNavigation` 呈现左二应用列表；`ui-dockkit/ResizableWorkbench` 持有分栏、宽度、收起、拖拽和窄视口 Overlay/Dock；Workbench 继续注入应用清单与业务路由。中间应用功能和右侧资源由现有模块与扩展 Owner 管理。
- 设置盘点：复用 `general.navigationLayout`；Appearance 的主题、字体、颜色、字号、对比度、壁纸、遮罩、模糊及减少动态效果沿用共享令牌。左栏宽度继续读写 DockKit 的 `lfaa.workbench.left-width.v3` 兼容偏好；面板开合继续用 `lfaa.module-workbench.chrome.v2`，保留已有记录。仅首次默认使用三栏工作区布局时展开右栏，以呈现用户要求的第四个物理列；`left-two-column`、`right-tools`、`focus` 与移动/窄视口仍由现有设置和响应式规则决定。不增设置项，不重置用户记录。

### 允许、禁止与验收

- 允许：修改 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 与 `module-workbench.css`、`packages/client/ui-sidebar/src/GlobalNavigationRail.tsx`、`SecondaryNavigation.tsx/.css`、直接 UI 回归、相关包 README、`docs/系统总体架构.md` 和本合同/索引。
- 禁止：另建导航栏或分栏系统、复制应用数据/业务跳转、重做右侧资源 Owner、增加第五栏、增加导航/宽度设置或改变保存的用户开合/宽度偏好；保留现有脏工作区，不提交或发布。
- 直接回归确认应用清单只来自 Workbench 现有清单、全局应用图标在应用工作区切换现有左栏、列表项仍调用现有路由/应用打开回调、左二栏与既有会话/应用菜单共存、右侧仍由 ResizableWorkbench 管理，且既有共享二级菜单行为不变。运行 Client 类型、受影响包构建、正式 Web 构建、适用 workspace Gate、构建指纹与 `git diff --check`。
- ChatGPT 内置浏览器实际 `/work` 验收桌面 `1440×900` 与窄短分栏 `760×520`：记录四栏、应用图标展开/收起、菜单导航、桌面右栏与窄视口 Overlay/Dock、内滚动和横向溢出；截取可核实布局的画面。不得确认版本提醒或改写 Appearance、布局、应用数据等偏好；若提醒遮挡交互，保留弹窗并如实记录受阻项。桌面 WebView、实体设备与帧时间分开记录。

### 实施与验收记录（2026-10-20）

- 新增四栏直接回归 `client-app-workspace-four-column.test.mjs` 4/4；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-sidebar` 与 `lfaa-client-ui-workspace` 构建、`pnpm run build:web`、`pnpm run check:workspace`（193 包）和 `git diff --check` 通过，正式产物位于根 `dist/`。
- 正式菜单启动后的内置浏览器 `/work` 桌面 `1440×900` 实见全局导航、应用/会话二级菜单、中间工作区、右侧工具资源四栏。展开两侧后截屏核对；点击应用图标和左二栏 `Minecraft 管理` 实际打开 `/apps/minecraft/normal`，应用内容、二级导航与右栏仍由现有 Owner 提供。验收后恢复原先收起面板状态。
- `/work` 窄短容器 `760×520` 下，左二应用菜单按现有 DockKit Overlay 打开；选择 Minecraft 菜单后实际跳转到 `/apps/minecraft/normal`。右侧上下文栏在该窄宽度按既有响应式策略收起以保留工作区空间；退出后恢复原面板状态。该轮未改 Appearance、布局、宽度或应用数据偏好。
- 未测平板/手机实体设备、桌面 WebView、拖动分隔条帧时间与真实业务写入；未新增设置项或 CSS 自定义属性；未提交或发布。

<a id="lfaa-settings-profile-plugins-integration-20261020"></a>

## 131-设置中心集成插件菜单统一-20261020

### 目标、Owner 与设置

- 修正插件管理齿轮目标：`/plugin-manager` 的齿轮进入现有设置中心“集成 → 插件”，路由保持 `/settings?section=plugins`。普通设置页显示 Profile 已安装插件的标准设置行、说明、搜索和启停开关；风格复用设置中心的 SettingRow/SettingsSwitch、共享 Appearance 令牌及现有侧栏/工具栏。
- 保留 `SettingsPage` 的独立插件扩展工作区语义，避免把 AI 扩展 `plugins.enabled`、MCP 配置或 Cordis 模块管理混成 Profile 插件状态。标准设置页路由 `section=plugins` 映射到新的 Profile 插件设置视图；插件管理器内部的独立工作区继续使用原扩展能力视图。
- Profile 插件清单和启停仍由 Plugin Manager Owner 提供：Client 使用 `loadManagedPlugins` 读取当前 Profile，使用 `setManagedPluginEnabled` 携带插件固定来源提交及所选目标 App 请求变更；后端继续验证管理员身份、Permission Owner 授权和 Runtime 结果。多 App 插件在行内提供目标 App 选择。不可启用/不兼容项显示真实禁用状态，不构造模拟开关。
- 设置盘点：不新增设置项，不更改 `plugins.enabled`、用户启停状态、Profile 或外观偏好。显式启停按钮继续由 Permission Owner 校验管理员本次点击；只有自然语言操作使用 `permissions.mode`。页面消费 Appearance 主题/字体/颜色/字号/对比度/壁纸/遮罩/模糊/减少动态效果共享令牌；本轮不改这些设置。

### 允许、禁止与验收

- 允许：修改 `packages/client/ui-settings/src/SettingsPage.tsx/.css`，新增设置页内 Profile 插件列表视图组件，修改 `packages/client/ui-plugin-manager/README.md`、`packages/client/ui-settings/README.md`、`docs/系统总体架构.md`、本合同/索引及 `apps/cli/tests/plugin-manager-ui.test.mjs`。
- 禁止：另建设置中心、复制 Profile 插件或生命周期 Owner、改变插件安装/删除或审批合同、在验收时启停插件/保存设置/改真实用户偏好、改账户级 `plugins.enabled`、改变已有 `computerControl` 等分区偏好、覆盖其他未提交工作、重启来源不明服务、提交或发布。
- 直接回归验证 `plugins` 在普通设置侧栏“集成”组显示为“插件”、`/settings?section=plugins` 选中该菜单并显示 Profile 插件行、AI 扩展工作区仍只在独立插件工作区保留、列表开关读取真实 `ManagedPluginRecord.state` 且调用原认证生命周期 API、非管理员/不兼容项禁用、多个目标 App 可选、搜索和空/加载/错误状态可访问。
- 按仓库要求运行 Client 类型检查、直接 UI 回归、受影响 Client 包构建、正式 Web 构建、适用 workspace Gate、Web 指纹及 `git diff --check`；构建产物只写仓库根 `dist/`。
- ChatGPT 内置浏览器验收真实 `/plugin-manager` 与 `/settings?section=plugins`，检查桌面与相关窄/短视口；验证齿轮可达、插件菜单在“集成”下选中、普通设置行与搜索/滚动布局一致、目标 App 选择可用。只读取真实状态，不点开关，不安装/卸载，不保存偏好；进入前后恢复当前用户原路由和分区。截图和视口写入验收记录；桌面 WebView、设备和帧时间分别标明。

### 实施与验收记录

- `apps/cli/tests/plugin-manager-ui.test.mjs` 定向回归 10/10 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-settings` 构建、`pnpm run build:web`、`pnpm run check:workspace`（193 包）、`node scripts/runtime-build-state.mjs web`（`[]`）、`GET /settings?section=plugins`（HTTP 200）与 `git diff --check` 均通过。构建产物在仓库根 `dist/packages` 和 `dist/apps/web`；Web 保留既有 C++ chunk 大于 500 kB 的 Vite 提示。
- 从当前 checkout 通过 `pnpm lfaa web` 启动正式 Web；启动预检只停止了写锁中确认的 LFAA Web PID，构建完成后重新启动本轮服务。ChatGPT 内置浏览器桌面 `1440×900` 实际打开 `/plugin-manager`，分类中选择“插件”后点击齿轮，进入 `/settings?section=plugins`；设置中心侧栏“集成”下的“插件”处于选中态，显示标准设置内容区、搜索、刷新、插件管理入口和已安装清单。实际 Profile `web` 返回 0 个已安装插件，故正确显示空态；没有真实开关行，未触发插件变更。
- 同页窄短视口 `760×520` 的设置内容可纵向滚动，`documentElement.scrollWidth` 为 750，无横向溢出；另在 `/plugin-manager` 窄视口确认齿轮仍可见。桌面与窄视口截图已在本任务内置浏览器验收中捕获并核对。浏览器控制台无错误。
- 为恢复进入前的设置分类偏好，验收中临时选择“电脑操控”，随后按“返回工作区”确认回到 `/plugin-manager`；设置分类恢复为原来的 `computerControl`。未点开关、安装/卸载、保存设置或更改外观、Profile 与账户扩展状态。视口测试覆盖已重置为默认值。
- 真实插件开关行（因 Profile 空清单）、桌面 WebView、平板/手机设备、拖动帧时间和真实生命周期写入均未验；未提交或发布。

<a id="lfaa-menu-source-update-remote-tracking-20261020"></a>

## 132-菜单源码更新远端跟踪引用-20261020

### 目标、Owner 与边界

- 修复 Windows 菜单 8 更新源码时，远端 `main` 历史发生非快进改写后，`git fetch` 因显式 refspec 不允许更新 `origin/main` 而在读取最新提交前失败的问题。
- Owner 与调用链：`lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → `scripts/update-project.ps1`；更新规则仍唯一归 `update-project.ps1`。fetch 可刷新远端跟踪引用，本地当前分支和本地 `main` 仍遵循原快进/工作区保护，不自动 reset、clean、rebase 或删除提交。
- 设置中心配置：不涉及。数据 Owner 仍由 `scripts/resolve-data-directory.mjs` 解析，保留更新前后的数据根检查；无权限或运行时变更。

### 允许、禁止与验收

- 允许：修改 `scripts/update-project.ps1`、`apps/cli/tests/workspace-maintenance.test.mjs`、`apps/cli/README.md` 及本合同/索引。
- 禁止：改写用户远端 URL/认证配置、切换工作区、reset/clean/rebase/强制推送、覆盖本地分支提交、触碰运行数据、安装依赖、构建产品、提交或发布。
- 回归以隔离 bare Git 远端模拟 `main` 被非快进替换：菜单更新逻辑应成功取得最新远端跟踪引用；若当前本地历史无法安全快进，应明确停止并完整保留 `HEAD` 与工作区。既有快进更新、脏工作区保护和数据根保护继续通过。
- 运行 `workspace-maintenance.test.mjs` 对应 Windows 更新回归与 `git diff --check`。无 UI、设置中心、产品构建、服务、桌面、Provider 或真实用户数据验收要求。
- 外部核查：社交媒体与技术社区说明 Git 的常规 fetch refspec 使用 `+` 允许远端跟踪引用非快进更新；项目 GitHub Issues/Discussions/PR 未找到相关已知问题。Git 官方 [git-fetch 文档](https://git-scm.com/docs/git-fetch)确认前导 `+` 仅覆盖该 refspec 目标引用的快进限制；本修复将目标精确限定为 `refs/remotes/<remote>/<branch>`，不覆盖本地分支。

### 实施与验收记录

- `scripts/update-project.ps1` 将 fetch refspec 改为只允许目标远端跟踪引用非快进同步。隔离回归覆盖远端 `main` 被改写且本地仍可快进时成功应用最新源码，以及本地历史已分叉时刷新 `origin/main` 后安全停止并保留本地 `HEAD`、`refs/heads/main` 与工作区；原有快进、脏工作区和数据根保护行为未变。
- `node --test apps/cli/tests/workspace-maintenance.test.mjs`：13/13 通过；`git diff --check`：通过。未构建产品或启动服务；未触碰真实远端、本地用户数据或设置中心。菜单实机交互未测；当前本 checkout 的 GitHub `main` 与本地 `main` 同提交，因此没有新的源码可应用。

<a id="lfaa-settings-integration-category-tabs-20261020"></a>

## 133-设置中心集成分类标签-20261020

### 目标、Owner 与设置

- 在 `/settings?section=plugins` 的标题下方、搜索区域旁增加“插件、应用、MCP、技能、市场”五个横向分类标签，布局参考用户截图。“插件”保留当前 Profile 插件页；“应用”“MCP”“技能”定位到插件管理器中各自现有分类视图，不复制页面或数据 Owner；“市场”在当前设置页显示明确未接入状态并提供进入现有插件来源管理页的入口。
- 插件清单继续使用 Profile Plugin Manager API；应用、MCP 和技能目标复用 Plugin Manager 的 `applications`、`mcp`、`skills` 现有页面。LFAA 当前没有公共插件市场目录，不展示假条目、虚构数量或伪装为市场的安装来源表单。
- 设置盘点：不新增设置、不修改默认值或持久化；只读消费 `plugins.mcpServers` 和现有 Skill 目录返回。Appearance 主题、颜色、字体字号、表面、壁纸/遮罩、模糊和减少动态效果沿用设置页共享令牌；不写用户偏好。
- 运行入口为 `apps/web` → `packages/client/ui-layout` → `packages/client/ui-settings`。插件生命周期、账户连接配置、Skill 目录和应用路由分别保留原有 Owner；不新增 API、重复规则或第二套权限。

### 允许、禁止与验收

- 允许：修改 `packages/client/ui-settings/src/ManagedPluginsSettings.tsx`、`SettingsPage.tsx`、`SettingsPage.css`，`packages/client/ui-plugin-manager/src/PluginManagerPage.tsx`，更新两个受影响包 README、`apps/cli/tests/plugin-manager-ui.test.mjs`、由工作区 Gate 生成的 `docs/harness-packages.json` 与 `docs/harness-packages.md` 及本合同/索引。
- 禁止：新增或伪造市场目录/条目/数量；改插件安装、启停、卸载和权限；修改 MCP/Skill 配置或用户外观偏好；新增设置项、API 或执行 Owner；覆盖工作树其他改动、重启来源不明服务、提交或发布。
- 定向回归确认五个标签可用、应用/MCP/技能深链选中对应既有管理分类，Profile 插件权限和生命周期保持，市场诚实显示未接入。Client 类型检查、UI 定向回归、受影响包和正式 Web 构建、适用 workspace Gate、Web 构建指纹及 `git diff --check` 均按仓库规则执行，产物只写根 `dist/`。
- ChatGPT 内置浏览器实际打开 `/settings?section=plugins`，检查 `1440×900` 桌面与 `760×520` 窄短视口（并覆盖 `390×640` 手机宽度），记录五类导航、目标页选中状态、滚动、横向溢出和未接入市场状态截图。只读数据，不操作开关、MCP 写入、安装/卸载或设置保存；恢复验收前路由与视口。真实设备、桌面 WebView 和帧时间分别注明。

### 实施与验收记录

- `ManagedPluginsSettings` 增加五个分类按钮；插件保留真实 Profile 清单，应用/MCP/技能跳转到 Plugin Manager 既有分类，深链用 `view` 选中目标并随管理器导航同步地址。市场呈现“市场暂未接入”说明和已有插件管理入口，不展示虚构目录。只在插件分类读取 Profile 插件，市场页不额外请求清单。
- Appearance 继续使用设置页既有主题/表面/文字令牌，无新增 CSS 自定义变量、配置项或持久化。窄容器下分类栏、搜索与 Profile 计数改为纵向布局；市场卡片可在短屏滚动。
- `node --import tsx --import ./apps/cli/register-package-loader.mjs --test apps/cli/tests/plugin-manager-ui.test.mjs`：11/11 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`lfaa-client-ui-settings` 与 `lfaa-client-ui-plugin-manager` 构建、`pnpm run build:control-plane`、`pnpm run build:web` 均通过。`pnpm run check:workspace`：193 包通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。产物位于根 `dist/packages/`、`dist/apps/control-plane/`、`dist/apps/web/`。
- 从当前 checkout 执行 `pnpm lfaa web`，按数据写锁预检确认并重启已存在的 LFAA Web 进程。重启后 `/settings?section=plugins` 返回 HTTP 200，内置浏览器显示五个分类。逐个点击应用/MCP/技能均跳到 `/plugin-manager?view=applications|mcp|skills`，目标分类 `aria-current="page"`；插件仍显示当前 Profile `web` 的真实 0 项空态。市场显示未接入说明和插件管理入口。
- 内置浏览器实测 `1440×900`、`760×520`、`390×640`：三种视口的 `documentElement.scrollWidth` 分别为 1430、750、380，均不超过视口；窄屏插件搜索/计数纵向排列，分类与市场空态可见。最后恢复 `/settings?section=plugins`、“插件”分类和默认浏览器视口；只读取现有状态，未切换插件、修改 MCP/Skill、保存设置或改变外观偏好。真实设备、桌面 WebView、插件生命周期写入和帧时间未测。

<a id="lfaa-web-startup-always-build-20261020"></a>

## 134-Web 启动每次重建最新源码-20261020

### 目标、Owner 与设置

- 用户通过主菜单 2 → 启动子菜单 1 启动完整 Web 时，每次启动都按当前源码依次重新构建 Control Plane/Harness 与 Web，成功复核指纹和关键输出后才执行 `pnpm lfaa web`。
- Owner：`scripts/install-dependencies.ps1` 的 `Start-Harness` 持有菜单模式与命令编排；`scripts/build-harness.mjs`、Control Plane 与 Vite Web 各自持有构建实现；`scripts/runtime-build-state.mjs` 继续唯一负责指纹/关键产物核对。独立 Daemon 路径保持只在 host 构建缺失或过期时补建。
- 运行数据 Owner、Web 写锁保护与 Permission Owner 不变；设置中心配置不涉及。构建产物仅写仓库根 `dist/apps/control-plane`、`dist/apps/web` 与既有构建器负责的 `dist/packages/`。

### 允许、禁止与验收

- 允许：修改 `scripts/install-dependencies.ps1`、`apps/cli/README.md`、本合同及索引；依现有 PowerShell 启动回归补充直接覆盖。
- 禁止：变更菜单 8 更新逻辑、绕过源码指纹复核或写锁检查、重建到根 `dist/` 以外、修改用户数据/设置、无条件重建独立 Daemon、结束来源不明服务/进程、提交或发布。
- 验收目标：无论 Web 指纹当前还是过期，菜单 2 → 1 都先运行 `build:control-plane` 与 `build:web`，两者均成功且重查 `runtime-build-state.mjs web` 返回空结果后才启动；任一构建失败、源码在构建期间变化、关键产物缺失或指纹不一致时停止启动。Daemon 模式仅对账和补建 host。
- 按当前 Windows PowerShell 5.1 启动代码做语法/差异检查；构建命令顺序和启动守卫依据现有长期回归检查。菜单 2 → 1 实际构建会覆盖根 `dist/apps/control-plane` 与 `dist/apps/web`，执行前须核对无不应覆盖的运行数据；未启动产品服务或浏览器时如实注明。
- 外部核查：社交媒体未发现适用方案；技术社区有 Visual Studio/MSBuild 每次运行预构建的讨论，但不是 pnpm/PowerShell 方案，未直接照搬；项目 GitHub Issues/PR 搜索未发现相关问题。官方 [pnpm run 文档](https://pnpm.io/zh/cli/run/)说明 `pnpm run` 执行 package manifest 中定义的脚本；本实现复用已登记的 `build:control-plane` 与 `build:web`，串行执行并以仓库构建指纹作为启动门禁。

### 实施与验收记录

- `Start-Harness` 对完整 Web profile 增加每次启动强制构建标记，使 Control Plane/Harness、Web 构建均会执行；独立 Daemon 仍使用原 stale 指纹条件。每次 Web 构建后继续重查正式运行树，未通过校验则停止启动。
- 菜单提示与 `apps/cli/README.md` 说明了完整 Web 每次重建、Daemon 按需补建的差异。设置中心不涉及。
- 验证：Windows PowerShell 5.1 AST 语法解析与 `git diff --check` 通过。未运行 Pester 启动回归或 Control Plane/Web 构建；未启动服务、覆盖 `dist/` 运行产物或进行浏览器验收。

<a id="lfaa-settings-plugin-toolbar-alignment-20261020"></a>

## 135-插件页标题与搜索栏布局修正-20261020

### 目标、Owner 与设置

- 修正 `/settings?section=plugins` 两处布局：标题右侧“刷新”和“插件管理”按钮组在其可用操作区末端对齐；分类工具栏保留五个分类，将插件搜索框移至工具栏右端，Profile 项数状态排在搜索框之前。
- Owner：`packages/client/ui-settings/src/ManagedPluginsSettings.tsx` 持有该页面结构与分类工具栏；`packages/client/ui-settings/src/SettingsPage.css` 持有设置页响应式布局及 Appearance 令牌映射。
- 设置盘点：不新增或改变设置、默认值和持久化；沿用设置中心 Appearance 主题、表面、文字令牌及现有容器断点，不写入用户偏好。

### 允许、禁止与验收

- 允许：修改 `ManagedPluginsSettings.tsx`、`SettingsPage.css`、插件管理 UI 长期回归 `apps/cli/tests/plugin-manager-ui.test.mjs`、`packages/client/ui-settings/README.md` 及本合同/索引。
- 禁止：改变五类标签、插件清单/搜索语义、Profile 授权和生命周期、MCP/Skill 配置或外观偏好；新增设置、变量、请求或数据；覆盖其他工作树改动、提交或发布。
- 验收：定向 UI 回归确认标题按钮组与搜索列明确末端对齐，搜索栏不会被计数挤到工具栏中间；运行 Client 类型检查、设置包与正式 Web 构建、适用 workspace Gate、Web 构建指纹及 `git diff --check`，产物只写根 `dist/`。
- ChatGPT 内置浏览器在当前源码 `/settings?section=plugins` 检查桌面 `1440×900`、窄短 `760×520` 和手机 `390×640`；记录标题操作和搜索栏边界、横向溢出、截图及未测范围，最后恢复原始路由与视口。只读 Profile，不触发开关、安装/卸载、MCP 写入或设置保存；真实设备、桌面 WebView 和帧时间分别注明。
- 外部排查按用户要求的顺序完成：社交媒体讨论提供了 Flex 子项增长会吞掉剩余空间的通用线索，但没有 LFAA/Ant Design 的直接修复；技术社区的 [Stack Overflow 回答](https://stackoverflow.com/questions/63387287/how-to-align-center-text-or-div-item-with-ant-design-space-in-reactjs)指出 Ant Design Space 可通过 `justify-content` 对齐填满容器的子项；Ant Design [GitHub Space 讨论](https://github.com/ant-design/ant-design/discussions/42702)说明 Space 会给子项增加包装元素；官方 [Space 文档](https://5x.ant.design/components/space-cn/)和 [Flex 文档](https://5x.ant.design/components/flex-cn/)区分行内间距与块级布局。结合当前源码，通用 `.settings-content__heading > div` 规则同时让按钮 Space 扩展但未对齐其内容，是上方错位原因；工具栏将状态列放在输入框之后导致搜索框无法成为最右列。

### 实施与验收记录

- `ManagedPluginsSettings.tsx` 为标题操作组增加专用 class，并将 Profile 数量状态排在输入框前；`SettingsPage.css` 让操作组末端对齐，并把搜索框设为工具栏最右列，保留 `620px` 容器断点下的整行搜索。`packages/client/ui-settings/README.md` 同步记录布局。Appearance 共享令牌沿用；未新增变量、设置、请求、订阅或用户偏好写入。
- 外部排查按“社交媒体 → 技术社区 → 项目 GitHub → 官方文档”的顺序进行。社交媒体只找到通用 Flex 增长线索；社区答案确认 Ant Design Space 的填充容器需要设置 `justify-content`；Ant Design GitHub 讨论提醒 Space 会给子项增加包裹层；官方 Space/Flex 文档说明两者的布局职责。最终结合 LFAA 当前选择器确定根因并做最小样式修改，没有照搬不相关案例。
- 验证：`plugin-manager-ui.test.mjs` 12/12；Client `tsc --noEmit`、`lfaa-client-ui-settings` 构建、`build:web`、`check:workspace`（193 包）、Web 指纹 `[]`、`git diff --check` 均通过；构建输出位于根 `dist/`。正式 `pnpm lfaa web` 从当前 checkout 启动，`GET /settings?section=plugins` 返回 HTTP 200。
- ChatGPT 内置浏览器 `/settings?section=plugins` 实页：桌面 `1440×900` 时标题操作区右边界与标题容器同为 `x=1384`，搜索栏右边界与工具栏同为 `x=1384`；文档宽 `1430px`，未超出视口。窄短 `760×520` 的操作/搜索右边界均为 `x=720`，手机 `390×640` 均为 `x=356`；对应文档宽分别 `750px`、`380px`，无横向溢出。窄容器中分类、计数、搜索纵向排列，按钮仍可见。截图已在内置浏览器验收中捕获。页面只读，Profile 为 `web` 且显示真实 0 项；未操作插件或保存设置。
- 视口控制已执行 reset，浏览器当前报告默认 `390×640`；插件设置路由保持在验收页。真实设备、桌面 WebView 与帧时间未测；该纯布局修改没有新增运行时工作或订阅，未进行帧时间测量。

<a id="lfaa-settings-plugin-responsive-layout-20261020"></a>

## 136-插件设置窄屏响应式布局-20261020

### 目标、Owner 与设置

- 修复用户截图中窄分栏/手机宽度的设置中心布局：固定操作栏将“设置菜单”和自动保存状态放在同一行，恢复默认/立即保存放在下一行；插件页标题、刷新/插件管理按钮、分类、计数和搜索栏按窄容器自然排列，不挤压、错位或造成横向溢出。
- Owner：`packages/client/ui-settings/src/SettingsPage.tsx` 持有设置固定操作栏结构；`packages/client/ui-settings/src/ManagedPluginsSettings.tsx` 持有插件页内容结构；`packages/client/ui-settings/src/SettingsPage.css` 持有两处响应式布局与 Appearance 令牌映射。
- 设置盘点：不新增或修改任何设置、默认值与持久化；继续读取外观设置提供的主题、颜色、字体/字号、表面、透明度、模糊及减少动态效果共享令牌。仅调整 CSS 布局，不写用户偏好、插件开关或其他业务数据。

### 允许、禁止与验收

- 允许：修改上述三个设置页源码文件、`apps/cli/tests/plugin-manager-ui.test.mjs`、`packages/client/ui-settings/README.md` 与本合同/索引；由工作区 Gate 生成的根 `dist/` 产物及登记清单仅在直接构建要求下更新。
- 禁止：改变插件/应用/MCP/技能/市场分类语义、Profile 清单读取和授权、安装/启停/卸载行为、搜索规则、用户外观偏好；新增配置、主题常量、数据请求或订阅；覆盖本工作树其他变更、提交或发布。
- 分批验收：第一批调整设置固定操作栏，验证窄屏第一行菜单/保存状态、第二行两个可达按钮，并运行其直接回归/类型检查/设置包与 Web 构建后立即在内置浏览器复验；第二批调整插件页标题操作与分类搜索区，同样先做定向回归/构建，再验收真实页面。
- 在 ChatGPT 内置浏览器当前源码 `/settings?section=plugins` 检查桌面 `1440×900`、窄短 `760×520`、手机/窄分栏 `390×640` 和极窄 `320×568`；逐屏记录固定栏、标题动作、五类标签、计数/搜索、纵向滚动、关键操作可达、横向溢出与截图。只读 Profile；不切换插件、改 MCP/Skill 或保存设置。真实设备、桌面 WebView、帧时间未实测时单独说明。
- 外部排查遵循用户要求的顺序：社交媒体上只找到通用 Flex 换行经验；技术社区 Stack Overflow 的响应工具栏问答给出按可用宽度换行的通用结构；项目 GitHub 与 Ant Design GitHub 搜索没有发现与当前布局完全匹配的修复，找到的 Grid 负外边距溢出案例不适用于本页；MDN 官方 Flexbox 文档确认 flex 子项默认最小尺寸会阻止收缩，且应允许合适换行。上述资料没有可以直接应用且已验证的 LFAA 解法；本轮再基于真实截图、当前 DOM 与 CSS 断点做最小根因修正。

### 实施与验收记录

- 已复现：在内置浏览器把 `/settings?section=plugins` 设为 `390×640`，当前固定栏将菜单、自动保存状态与保存按钮拆成三排；插件页按钮在标题说明下方贴右，分类/计数/搜索行距和对齐不够清晰。该窄宽度页面横向无溢出，但首屏固定栏过高、页面操作分组松散，故仅检查 `scrollWidth` 不足以判定通过。
- 第一批调整 `SettingsPage.tsx` 固定栏结构，将自动保存状态从按钮组拆出。窄容器布局改为“菜单/返回入口 + 自动保存状态”首行、两项操作按钮次行。定向回归 13/13、Client 类型检查和 `lfaa-client-ui-settings` 构建通过；正式 Web 构建、指纹对账和 `pnpm lfaa web` 重启后，在 390×640 内置浏览器确认首行及两枚操作按钮完整显示。
- 第二批修改插件页窄容器规则：标题操作按钮左起；分类/计数/搜索逐行全宽排列并收紧上下间距；实际 320×568 检查发现“市场”会孤立换行，继续在内容容器 ≤340px 时减少分类按钮左右留白，复验五类标签同排可见。新增回归后定向测试 14/14，Client 类型检查、设置包构建、正式 Web 构建、`pnpm run check:workspace`（193 包）、Web 指纹 `[]`、`git diff --check` 全通过；构建产物仅写根 `dist/`，Vite 有超过 500 KB chunk 提示但构建成功。
- 由当前 checkout 执行 `pnpm lfaa web`，正式服务在 `http://127.0.0.1:3000` 就绪，`GET /settings?section=plugins` 返回 200。最终源码内置浏览器实页截图检查：`320×568` 五分类同排、搜索全宽、页面可纵向滚动；`390×640` 两行固定栏、标题操作与内容左起、分类/计数/搜索分行；`760×520` 两行固定栏且短屏内容可继续纵向滚动；`1440×900` 桌面标题按钮靠右、搜索仍在分类工具栏末端。截图中未见横向截断/溢出。验收只读 Profile（当前 0 插件、Profile web），未切换插件、修改 MCP/Skill 或保存任何设置。
- 设置盘点结论：不新增或更改设置；固定栏和分类工具继续读取现有 Appearance/共享间距令牌，无新增 CSS 变量。布局纯样式，不新增请求、订阅、事件或主线程任务；帧时间与真实设备/桌面 WebView 未测。

<a id="lfaa-settings-integration-tabs-and-switches-20261020"></a>

## 137-设置中心集成分类与逐项开关-20261020

### 目标、Owner 与设置

- 在 `/settings?section=plugins` 内直接切换“插件、应用、MCP、技能、市场”五类内容，不因选择分类跳到 `/plugin-manager`。按参考图用列表行和右侧开关展示每类真实条目；插件继续走 Profile Plugin Manager 生命周期 API，MCP 使用账户设置中的服务记录及 `enabled`，技能清单必须与左侧插件工作区使用同一 `/ai/extensions` 登记数据，条目以 `skillId` 关联 Skill Registry 并由账户逐 Skill 停用名单控制运行时模型目录/加载。市场当前没有公共目录，明确显示未接入。
- 应用 Tab 同时展示 LFAA 内置工作区入口开关与已接入的外部应用连接。内置入口直接来自 Workbench 唯一应用清单；`general.hiddenApplicationNavigationIds` 只控制全局导航显示，不授予或撤销应用权限。外部连接首批接入 GitHub，OAuth 使用 GitHub App Device Flow，连接仓库、Issue、PR 的只读数据；没有 Client ID 时显示真实未配置状态，不能伪造已连接或示例条目。公共市场目录仍未接入。
- Owner：`packages/client/ui-settings` 持有设置页类别与控件；Skill 清单由 `packages/core/agent` 的 AiExtensionRegistry 唯一登记并经 `/ai/extensions` 提供，插件工作区和设置中心消费同一清单；`skillId` 关联 `packages/skill/skill` 的 Registry 规范名称。Skill 运行时停用仍归 `packages/skill/skill`、`packages/skill/tool-skill`、Settings Controller。`lfaa-client-ui-sidebar` 提供 Workbench 唯一应用导航项；`general.hiddenApplicationNavigationIds` 经 `util/values` 默认、Settings Joi 校验与 Settings Service 归一化/持久化。GitHub OAuth/API 由 `packages/integrations/github` 持有并经 `packages/api/github-connection-controller` 暴露认证路由；账户令牌复用 `lfaa-credentials` 和 Settings Owner 的 AES-256-GCM 凭据存储。旧账户缺少新增字段时默认空列表，不重置已有设置。
- 设置盘点：复用现有 `plugins.enabled`、`plugins.mcpServers`、`plugins.skillDirectories`、`plugins.disabledSkillNames`、`permissions.mode` 和 Appearance 主题/字体/字号/颜色/表面/壁纸/模糊/减少动态效果令牌。仅新增 `general.hiddenApplicationNavigationIds`，默认 `[]`；GitHub App Client ID 与可选 Client Secret 是服务端部署配置，不存浏览器或用户 General。GitHub App 仅授予 Repository Metadata、Issues、Pull requests Read-only。权限模式不变；插件启停继续受管理员授权、固定来源提交与 Permission Owner 保护，MCP 工具调用继续按当前权限及所选 App 限定。

### 允许、禁止与验收

- 允许：修改 `ManagedPluginsSettings.tsx`、必要的 `SettingsPage.tsx`/CSS、Workbench 导航展示映射、General contracts/validation/normalization、Skill Registry 与目录/加载消费者、GitHub App OAuth Device Flow 与只读 API Owner/客户端、服务端环境配置、直接回归、受影响包 README/架构说明及本合同/索引。
- 禁止：为未接入的外部应用或公共市场造数据；把内置应用导航隐藏冒充权限撤销；把 GitHub 连接扩为写仓库、创建/修改/评论 Issue 或 PR；在浏览器、日志或 API 响应暴露 OAuth 密钥/令牌；更改插件安装/卸载语义或权限模式；借用单项 Skill 开关扩大文件访问范围；触发验收期间真实插件启停、MCP 写入、Skill 设置变更、GitHub 授权/撤权或清理用户数据；覆盖既有工作区改动、提交或发布。
- 第一批：将五类切换留在本页内；插件保留 Profile 清单；内置应用列表复用 Workbench 清单并持久化隐藏入口；外部应用先接 GitHub App OAuth Device Flow 和仓库、Issue、PR 只读清单；市场如实标注未接入；MCP 直接显示真实账户服务并复用现有保存链。运行相关 Owner 回归、Client/Host 类型、受影响包与正式 Web 构建/指纹，并在每批结束后于 ChatGPT 内置浏览器 `/settings?section=plugins` 检查桌面和窄/短容器。真实 GitHub 授权只有配置服务端 Client ID 后才能实测，不使用真实用户授权作为 UI 验收操作。
- 第二批：新增 `plugins.disabledSkillNames` 默认、旧设置读取兼容、服务端类型/范围校验和持久化；Skill 页使用已认证 `/ai/extensions` 中同一批 Skill 登记项，并通过稳定 `skillId` 关联 Skill Registry；切换停用后该 Skill 必须从 `/ai/skills` 目录和 `skill` Tool 的 list/load 路径同时不可用，重新启用后恢复；管理员/用户权限、扩展总开关、Skill 根路径与安全围栏保持不变。增加直接回归，运行 `pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm exec tsc --noEmit -p tsconfig.host.json`、Settings/Skill/API 包直接构建、Web 构建、`pnpm run check:workspace` 和 `git diff --check`；产物只写根 `dist/`。
- 浏览器验收在每批完成后立即进行；最终至少检查 `1440×900`、`760×520`、`390×640`、`320×568`，确认五类标签易于切换、各列表/空态没有横向溢出且短屏可滚动；不得触发真实应用开关、OAuth 授权/撤销或外部写操作。记录路由、视口、交互、截图与未测范围。真实 GitHub OAuth、设备/Desktop 与帧时间未测时明确说明。
- 性能边界：类别切换只按需读取所属清单；读取支持中止；不增加轮询、重叠请求或无界缓存；Skill disabled 名单有界且规范化，运行时目录和加载路径均执行同一关闭判断。新增 UI 使用现有容器断点和 Appearance 共享令牌，不用 `inline-block`，不新增 CSS 变量。

### 实施与验收记录

- `ManagedPluginsSettings` 将五个分类实现为当前设置页内的 React Tab 状态；选择分类不更改 URL，也不调用左侧插件导航。插件读取当前 Profile；MCP 复用 `McpConnectionsSettings` 与账户 `plugins.mcpServers`；技能清单直接从 `/ai/extensions` 筛选 `kind=skill`，与左侧插件工作区一致；内置应用读取 Workbench 同一导航清单，并通过 General 设置隐藏/显示菜单入口；GitHub 外部连接使用独立认证连接状态与真实授权只读数据；市场显示“暂未接入”。
- 技能开关通过新增账户 `plugins.disabledSkillNames` 保存；`util/values` 提供默认空列表，Settings Owner 校验并兼容旧账户记录。关闭的技能从目录、Tool list/load、写作 Skill 加载和工作区能力引用中排除；没有把 UI 开关当作运行时权限边界。
- 遇到旧页面仍按旧逻辑跳转后，按“社交媒体 → 技术社区 → 项目 GitHub → 官方文档”核查：X 公开搜索未找到 LFAA/Vite 相同问题，X 帮助中心只有通用缓存排查建议；技术社区的 [React 长期开页讨论](https://www.reddit.com/r/reactjs/comments/1x1zueh/users_kept_our_react_app_open_across_deploys_and/)说明已打开的标签页可能继续运行旧构建，但其部署方案不直接适用于当前仓库；项目 `yubboo/LFAA` 未找到匹配的 Issues/Discussions（GitHub 页面读取受限）；官方 [Vite 构建文档](https://vite.dev/guide/build)与 [MDN HTTP 缓存指南](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)说明 HTML 入口需要按当前构建重新验证。结合本地证据，旧页面读取的是构建前已装载的脚本：Web 指纹在包 README 更新后显示过期；重新构建、按正式入口重启并重载页面后，五个 Tab 均只更新本地状态，URL 不变。这些外部资料只作线索，当前根因由本地指纹与复验确认。
- `SettingsPage` 和插件管理工作区共同复用 MCP 配置组件，MCP 每项沿用现有 `enabled` 和自动保存；插件生命周期仍走原 Profile API 与 Permission Owner。Appearance 配置不变，没有新增 CSS 变量或修改用户主题偏好。
- 静态与构建回归：插件 UI、设置合同和 Harness 运行时回归合计 15/15 与 1/1 通过；Client、Host TypeScript 检查通过；8 个受影响包、Control Plane、Web 构建通过；`pnpm run check:workspace` 193 包通过；`git diff --check` 通过。补充 `pnpm run build:web` 后，`node scripts/runtime-build-state.mjs web` 返回 `[]`，所有产物在仓库根 `dist/`。
- 从当前 checkout 通过 `pnpm lfaa web` 重启正式服务；服务报告 `http://127.0.0.1:3000` 就绪，`/settings?section=plugins` 返回 HTTP 200。重载最新 Web 资源后，桌面和窄屏逐个点击五类 Tab，当前 URL 一直保持 `/settings?section=plugins`；MCP 未进入左侧独立插件工作区。默认“插件”分类、原 `1585×1244` 视口和展开的设置导航均已恢复。
- ChatGPT 内置浏览器实页：`1440×900` 文档宽 `1430px`；`760×520` 文档宽 `750px`，五类标签均能切换、搜索栏整行显示；`390×640` 文档宽 `380px`；`320×568` 文档宽 `310px`，技能页 9 个开关可见并可纵向滚动。各视口无横向溢出，短屏设置内容区保持纵向滚动。验收只读取真实列表并切换分类，未点开关、写入设置、启停插件/MCP 或保存外观偏好；对应界面截图在本轮内置浏览器验收中捕获。
- Profile `web` 当前 0 个已安装插件，账户当前 0 个 MCP 服务；系统没有外部应用连接目录或公共市场目录，因此这些分类如实显示空态，不编造开关项目。浏览器测得技能目录 9 项、9 项单项启用；账户扩展总开关仍为关闭，单项状态保留但总开关关闭时不加入运行时。
- 真实设备、桌面 WebView、用户配置持久化后的重新登录状态与帧时间未测；当前验收没有修改真实用户偏好。

### 用户澄清后的应用连接补充

- 用户进一步明确：“应用可以开关我们自己的内置应用，也可以链接外部应用”，首个外部应用指定 GitHub，范围为仓库、Issue、PR；授权方式选 OAuth / 服务授权连接。该澄清覆盖上文第一轮“应用仅空态”和“禁止 OAuth”的早期约定。
- 内置 App 开关只控制全局应用导航是否显示该项，使用新增 `general.hiddenApplicationNavigationIds`（默认 `[]`）保存；清单来自 Workbench 单一应用导航 Owner。外部 GitHub 由 Device Flow 连接，OAuth token 使用已有 Settings 凭据 Owner 加密存储；GitHub Repository Metadata、Issues、Pull requests 权限均为只读，仅列出用户可访问仓库和其 Issue/PR。
- GitHub 连接端点、状态与真实列表由 `lfaa-api-github-connection-controller` 和 `lfaa-github-integration` 提供。当前部署没有公开 GitHub App Client ID，因此浏览器仅能验证真实未配置状态、内置入口开关数据及布局，不能完成真实 GitHub OAuth/Provider 验收。正式启用需在控制端设置 `LFAA_GITHUB_APP_CLIENT_ID`（可选 `LFAA_GITHUB_APP_CLIENT_SECRET` 只供远端撤权），并在 GitHub App 后台开启 Device Flow 与上述只读权限；不得把凭据粘贴到对话或写进前端。
- GitHub 撤权参数排查按用户规定顺序完成：X 社交搜索没有找到与此接口参数直接相关的经验；技术社区 GitHub Community Discussion #206703 与 Stack Overflow 相关问答指出 revoke grant 需要提交当前 access token；`yubboo/LFAA` 的公开 Issues/PR 搜索没有匹配记录，GitHub API 页面读取受限；最后核对 GitHub 官方 [Delete an app authorization](https://docs.github.com/en/rest/apps/oauth-applications#delete-an-app-authorization) 文档，确认 `DELETE /applications/{client_id}/grant` 同时要求 Client ID/Secret Basic Auth 和 JSON body `access_token`。据此补齐撤权请求正文，并在定向回归中断言 token 仅发送到 GitHub 撤权接口，不出现在 API 响应。
- 最终补充实页检查：当前 checkout 的正式 Web 服务在 `http://127.0.0.1:3000`，ChatGPT 内置浏览器实际路由为 `/settings?section=plugins`，可见页面视口为 `1280×720`。依次切换五类 Tab 后 URL 未变；应用分类显示 6 个内置入口开关和真实 GitHub“尚未配置”提示，MCP 显示真实 0 服务，技能显示与插件工作区相同的 6 项，市场显示未接入；滚到 GitHub 区块可见说明在卡片内换行，当前视口无横向截断。验收仅读取和切换 Tab，没有点任何开关、保存设置或发起 OAuth。当前 CUA 内置浏览器控制接口没有显式视口尺寸覆写，本次没有重新量测 390/320 窄宽度；这些尺寸仅沿用前述 Tab/工具栏批次已记录的验收结果，不作为本次新增 GitHub 区块的窄屏证据。服务端未配置 GitHub App Client ID，因此真实 OAuth/仓库数据仍未实测。

### 同一 Skill 清单回归修复

- 用户复现：左侧插件工作区 `?view=skills` 显示 6 条 Skill 能力，设置中心“技能”标签却为 0，用户明确要求两个位置数据相同。追踪确认插件工作区来自 `/ai/extensions` 的 AiExtensionRegistry，设置中心误读 `/ai/skills` 的 SkillRegistry 运行目录；两个 Owner 数据集和过滤职责不同，因此不能以第二个接口作为页面清单。
- 修复：`AiExtensionManifest.skillId` 显式链接扩展展示项到 Skill Registry 的稳定名称；当前 `application-context`、`minecraft-server-setup` 和四项写作技能由各自 Skill Provider 登记该 ID。设置中心直接读取 `loadAiExtensions()` 并按 `kind=skill` 显示相同条目，以 `skillId` 读写既有 `plugins.disabledSkillNames`。模型目录和 Tool 仍由 SkillRegistry 与 Skill Tool Owner 执行开关；`/ai/skills` 保持运行时接口，不再是第二份设置清单。
- 外部排查按既定顺序完成：X 搜索没有 LFAA 匹配修复；技术社区结果仅提供单一数据源/状态提升的一般建议；项目 `yubboo/LFAA` 的 Issues/Discussions/PR 搜索没有找到此缺陷的既有修复；React 官方 [共享组件状态](https://react.dev/learn/sharing-state-between-components) 与[状态结构](https://react.dev/learn/choosing-the-state-structure)文档支持由唯一 Owner 持有共享事实、避免冗余重复数据。具体差异仍由本地两条真实 API 调用链确认，本次方案是按本地 Owner 关系作出的修复。
- 允许文件：AI Extension registry、三个 Skill Provider、客户端扩展类型、集成设置列表、相关直接回归、相关 Owner README 与本段合同。禁止创建新 Skill 清单、以展示名称推导 ID、改变 Skill 内容或用户已有开关设置。
- 验收：插件工作区与设置中心必须返回相同 6 条已登记 Skill（名称、描述、来源、版本）；设置开关提交明确的 `skillId`，已有运行时 list/load 单项停用回归继续通过；只读取真实偏好，不实际点击或保存开关。Web 实页按 `1440×900`、`390×640` 检查当前设置页，保留窄屏可纵向滚动且无横向溢出。真实 Provider/设备和帧时间未测。

<a id="lfaa-appearance-custom-background-repair-20261020"></a>

## 138-外观自定义背景修复-20261020

### 目标、Owner 与设置

- 修复设置中心“外观 > 背景图片”：账户上传图片与内置图片显示在同一选择网格，上传图片接在内置卡片之后，用户能辨认并从图片卡片直接删除；选择上传图片后，图片必须在所选目标工作区显示并在重新进入后保持。
- 当前复现步骤依据用户反馈与截图：Web 浏览器进入 `/settings?section=appearance`，选择“小鱼智能体工作区”目标，上传 PNG 后出现“PNG 图片头无效”，无法上传。用户最初还报告自定义图片不显示在列表、缺少删除入口及背景未生效。
- Owner：`packages/client/ui-settings` 管理背景选择/上传/删除 UI 与账户设置更新；`packages/client/connection` 提供已认证背景 API 调用；`packages/api/settings-controller` 校验账户归属并提供素材读写路由；`packages/settings/settings` 保存设置索引并管理图片文件；`packages/client/ui-layout` 消费设置并将图片映射到 `.workbench-shell`。按调用链核验，不复制设置或图片存储规则。
- 设置盘点：沿用 `appearance.backgrounds.{login,appCenter,steamcmd,minecraft,writing,settings}`；共享默认值位于 `util/values/src/settings-contract.ts`，Settings Owner 负责校验和账户持久化，Client 按当前目标槽位即时映射。背景遮罩 `appearance.overlay` 默认 65%、玻璃模糊 `appearance.blur` 默认 14px，均保持既有偏好；登录页仅接受内置背景。`appearance.wallpaperEngine.enabled/projectId` 与已装配 Profile Client 图共同决定 Wallpaper Engine 是否拥有画布；若其拥有画布，账户背景继续保存但不绘制，除非本轮证据表明这是用户误选目标导致的问题，否则不改变该 Owner 合同。

### 允许、禁止与验收

- 允许：基于证据增量修改 `packages/client/ui-settings/src/SettingsPage.tsx` 与必要的 `SettingsPage.css`、`packages/client/ui-layout/src/Workbench.tsx`/背景映射、`packages/settings/settings/src/service.ts` 唯一素材 Owner、直接长期回归及对应包 README。
- 禁止：重置或覆盖已有用户主题、背景、遮罩、模糊及 Wallpaper Engine 偏好；修改账户数据或真实图片；放宽账户认证/归属、媒体格式/大小/尺寸校验；覆盖当前工作区其他未提交改动；提交或发布。
- 分批：第一批恢复自定义图片在库/选择器中的可见识别并提供清楚、可达的删除操作，同时检查图片读取请求与认证返回；第二批修复并检查所选工作区的图片 URL、槽位、CSS 画布归属和即时更新/持久化。每批仅完成本批直接构建后再继续，不把受 Wallpaper Engine 管理的画布误报为账户背景生效。
- 验收：使用隔离数据运行文件签名回归，并覆盖 MIME 误标时按文件内容识别；运行 Host/Client 类型检查、Settings/UI/Control Plane/Web 构建及 `git diff --check`。从当前 checkout 启动正式 Web 服务，在 ChatGPT 内置浏览器 `/settings?section=appearance` 检查桌面 `1440×900` 与窄短 `760×520`，真实上传 PNG 和 MIME 误标 JPEG，检查图片与内置背景在同一网格、上传卡片位于内置卡片之后、删除入口、目标槽位、工作区画布应用和重新加载持久化，再删除隔离素材并确认工作区恢复纯色。验收数据和图片只在 `dist/.tmp` 的隔离数据服务内写入；若构建/服务被阻断，记录具体原因，不能标记实页通过。
- 外部排查顺序已完成：社交媒体没有 LFAA 对应现象；技术社区只有“声明格式与文件内容不一致”的一般讨论；项目 GitHub 未找到 LFAA 匹配的 Issue/PR；官方 [W3C PNG 结构规范](https://www.w3.org/TR/PNG-Structure.html)确认 PNG 固定签名及文件结构。社区资料没有可直接套用的修复，代码分析是由截图错误定位至 Settings Owner 的 `imageDimensions()`：`FileReader.readAsDataURL()` 把浏览器提供的 `File.type` 写入 Data URL，而服务端原来把该声明当实际格式。用 JPEG 内容伪标为 PNG 可复现同一错误。因此最小修复是在服务端根据实际文件签名确定支持的格式，仍保留认证、账户隔离及格式、大小、尺寸校验，不接受 PNG/JPEG/WebP 以外的内容。实际失败图片未附，不能推断用户文件一定属于误标情形；需以新的浏览器回归与隔离 Owner 回归验证修复。

### 实施与验收记录

- `packages/client/ui-settings/src/SettingsPage.tsx` 将账户上传图并入原内置背景卡片网格，排在内置选项之后；每张上传图卡片提供删除确认，不再单列“自定义背景库”。上传会先选中当前目标槽位、取消延迟自动保存并等待 Settings Owner 保存成功后才提示应用完成；保存失败时保留可见素材及错误，不会误报成功。删除沿用现有素材 API，先将所有引用槽位持久化为“无背景”，再删素材；登录页仍仅展示内置图。
- `packages/client/ui-settings/src/SettingsPage.css` 让卡片与删除按钮共享响应式网格单元，删除动作置于卡片右上角，并沿用现有主题色、边框、间距令牌；未新增设置或 CSS 自定义变量。图片缩略图继续使用 `loading="lazy"` 与异步解码，没有增加订阅、轮询或并发素材读取。
- `packages/client/ui-settings/README.md` 记录上传选择、槽位保存与删除顺序；设置配置盘点确认继续使用 `appearance.backgrounds.*`、`appearance.overlay`、`appearance.blur` 与现有 Wallpaper Engine 画布归属，无默认值或既有用户偏好变更。
- `packages/settings/settings/src/service.ts` 不再把 Data URL 中浏览器声明的 MIME 当作文件真实格式，按 PNG/JPEG/WebP 签名确定储存后缀、读取响应 MIME 与尺寸解析器；保持 3 MiB、8192 边长、2000 万像素限制及认证账户隔离。未知/无效图像签名仍拒绝保存。
- `apps/cli/tests/file-storage.test.mjs` 在隔离数据回归中用 JPEG 字节声明为 PNG，验证成功上传后按 `image/jpeg` 登记、从 JPEG 路径读取并可删除；并验证无效字节拒绝保存。`pnpm exec node --test apps/cli/tests/file-storage.test.mjs`：8/8 通过；`pnpm exec tsc --noEmit -p tsconfig.host.json` 通过；`pnpm --filter lfaa-settings run build` 通过。
- `packages/settings/settings/README.md` 记录 Settings Owner 按实际签名识别及原媒体安全上限；`packages/client/ui-settings/README.md` 记录素材库显示由服务器确认的 MIME。
- 合并网格后的 `pnpm --filter lfaa-client-ui-settings run build` 与 `pnpm --filter ./apps/web exec vite build` 通过，静态产物写在根 `dist/apps/web`；后者不运行 TypeScript 检查，完整 `pnpm run build:web` 仍在 `packages/client/ui-layout/src/Workbench.tsx:298` 因导航项含 `workspace` 超出 `ApplicationNavigationItem.id` 联合类型而失败，该文件是其他未提交改动。`pnpm run build:control-plane` 被现存 GitHub 集成错误阻断：缺少 `joi` 类型、未使用 `ownerId`、`readonly scopes` 与可变 `string[]` 不兼容。当前 `node scripts/runtime-build-state.mjs web` 返回 `["host"]`；未将该状态报告为 Host/Web 全构建通过。
- 3000 端口已有 LFAA Web 进程且身份指向 CLI Web 启动命令，本轮未停止或复用；从当前 checkout 以 `pnpm lfaa web --no-local-daemon` 启动临时隔离服务于 `http://127.0.0.1:3001`，设置 `LFAA_HOME`、`LFAA_DATA_DIR` 与 `NODE_ENV=development` 均只指向 `dist/.tmp/lfaa-appearance-upload-browser-20261020`，`GET /settings?section=appearance` 返回 200。使用正常登录接口进入临时管理员账户，未接触当前真实账户。
- 合并前的内置浏览器实测覆盖 `3001/settings?section=appearance`、`1440×900` 与 `760×520`，上传/应用/刷新/删除通过；它不验证当前单一网格顺序。合并后尝试在内置浏览器打开 Vite 开发页 `5173/settings?section=appearance`，页面只呈现空白，无法检查卡片顺序；正式 Host 因构建错误没有当前指纹，故没有将本批实页验收标为通过。
- 文件 `mislabeled-jpeg.png`（135,178 字节，内容实际 JPEG）经页面上传后显示在选择器及自定义背景库，服务端登记 `image/jpeg`；文件 `valid-png.png`（613,105 字节）显示 `image/png`。上传后 `settings?section=appearance` 目标为“小鱼智能体工作区”；导航至 `/work` 时 DOM 的 `data-background-image=true`、`data-wallpaper-engine-owner=false`，`--settings-background-image` 指向 `/api/settings/backgrounds/<id>`，截图中实际显示图片。PNG 上传后完整刷新 `/work`，同一账户设置重新加载并继续显示该背景。
- 在内置浏览器逐个确认删除自定义 JPEG/PNG；卡片和独立自定义库条目均消失。删除当前选择的 PNG 后，再进入 `/work` 检查 `data-background-image=false` 与 `--settings-background-image:none`，确认未残留壁纸引用。临时素材/账户只存在于隔离服务。此项是合并前记录；当前统一网格上的删除操作尚未实页复验。
- 性能/安全证据：客户端仍只有既有单次 FileReader + 一次认证上传请求 + 一次账户设置保存，没有新增订阅或轮询；服务端签名识别为常量工作量，解码与尺寸边界仍受 3 MiB/8192/2000 万像素上限保护。没有记录真实帧时间；真实手机/平板/Desktop WebView 未测。
- 实页上传、图片列表、应用、刷新恢复和删除均已在隔离临时管理员数据中验证；临时 Web 服务已停止，3001 端口无监听。执行策略阻止删除隔离目录内的文件，故其合成测试账户、数据库、日志和两张测试图片仍留在 `dist/.tmp/lfaa-appearance-upload-browser-20261020/`；未尝试绕过策略。当前账户的偏好和图片未改动。
- 先前对 `http://127.0.0.1:3000/settings?section=appearance` 的检查仅覆盖基础布局，没有上传或删除，因此不作为本缺陷的实页验收证据。以下补充为本轮通过 ChatGPT 内置浏览器完成的复验，不能替代用户当前 3000 实例的重启后验收。
- 本轮在隔离服务 `http://127.0.0.2:3001/settings?section=appearance` 使用合成 `valid-png.png` 验证。第一次运行中图片上传接口返回 201、图片已写入隔离素材并进入同一背景网格；随后的设置保存因当前服务指纹已过期返回 503，页面新增的背景操作错误提示显示了服务端原因。重启我启动的隔离服务后，选择图库中的该图片，`PUT /api/settings/appearance` 返回 200，设置页显示选中状态。切到真实 `/work` 路由后，DOM 为 `data-background-image=true`、`data-wallpaper-engine-owner=false`，计算后的画布背景 URL 指向该账户图片；内置浏览器截图中能看到壁纸实际绘制，重新加载 `/work` 后同一图片 URL 仍在，确认保存与刷新持久化。此过程分两次服务运行：首次上传保存被过期指纹保护阻断，重启后选中已上传图并成功应用；没有把两步混报为同一次请求。
- 最新隔离服务上，设置图库分别在 1440×900 和 760×520 视口显示所选“小鱼智能体工作区”、上传卡片及卡片内删除入口；窄屏 `documentElement.scrollWidth=750`、`clientWidth=760`，无横向溢出。截图已由内置浏览器采集；本轮未点击最终删除确认，删除路径仍由前述 Settings Owner 8/8 隔离回归覆盖。
- 3000 Web 初次只读检查时进程 PID 16952，`/api/health` 返回 200、`/settings?section=appearance` 返回构建兼容保护 503；未由本轮停止或重启。稍后再次观察时监听 PID 已变为 7724（启动时间 2026-10-20 10:28 本地时间），外观页返回 200 并能在 ChatGPT 内置浏览器打开，视口为 1280×720，目标是“小鱼智能体工作区”。当前页只读统计到 0 张自定义卡片、0 个删除按钮；截图显示内置图片网格正常，说明先前失败上传没有进入当前图库。本轮未在该账户上传、选择或删除文件，也未改变任何真实账户设置。隔离 Web 曾在运行期间被其他工作区 UI/README 源文件更新，指纹保护随后按设计拒绝设置页读取；基于最新源码重启隔离服务后完成视口检查。桌面 1440×900、窄短 760×520 实页证据仅来自隔离账户。
- 本轮测试用的合成 PNG 素材仍位于 `dist/.tmp/lfaa-appearance-upload-followup-20261020/` 隔离数据中，3001 隔离服务已停止；由于此前清理 `dist/.tmp` 受执行策略阻止，未绕过策略删除。该记录不属于真实账户图片。
- 2026-10-20 后续复核：当前真实浏览器只读 DOM 仍只有 15 张内置背景；浏览器标签加载的脚本是 `/assets/index-Bj0m7YVo.js`，而 3000 现行 HTTP 首页与刚完成的构建均指向 `/assets/index-D7-aPBZB.js`，说明标签页保留了旧前端。PID 2736 的 Web 进程于 10:39 启动，早于本轮 11:06 的 Control Plane 和 11:08 的 Web 构建；本轮没有重启 3000，因为该进程未带 `--no-local-daemon`，重启可能影响其托管的本机 Daemon/活动任务。当前账户未上传、选择或删除图片，设置未改。
- 当前源码指纹复核为 `[]`；`pnpm --filter lfaa-client-ui-settings run build`、`pnpm --filter lfaa-web run build` 和 `pnpm --filter @yubboo/lfaa run build` 均通过，`apps/cli/tests/file-storage.test.mjs` 8/8 通过。隔离账户在 ChatGPT 内置浏览器 `/settings?section=appearance`、1440×900 视口经文件选择上传有效 PNG 后，POST `/api/settings/backgrounds` 返回 201、PUT `/api/settings/appearance` 返回 200；上传卡片立即追加在内置图库末尾、呈选中状态，删除入口可见，缩略图 `complete=true`、`naturalWidth=800`、`naturalHeight=1429`。截图证据已由内置浏览器在本轮工具输出采集。
- 第一次隔离服务于操作期间 Web 构建文件发生更新，随后 `/work` 按保护合同返回 503，因此该次未把“工作区画布已显示图片”记为通过。随后以 `127.0.0.2:3001` 重启隔离服务并确认健康检查 200；由于内置浏览器对隔离登录输入控件持续超时，本轮未完成重启后的 `/work` 画布/刷新验收。由于初次隔离登录使用 `127.0.0.1:3001`，该主机的 `Path=/` HttpOnly 登录 Cookie 不区分端口，可能替换 3000 标签原 Cookie；若用户页面要求登录，需要用户重新登录。后续隔离页已改用 `127.0.0.2`，与 3000 Cookie 隔离。
- 2026-10-20 后续 Web 再构建：隔离服务启动曾恢复 `dist/.tmp/lfaa-appearance-custom-upload-verification-20261020` 中的陈旧写锁；该次没有保存图片或更改隔离账户设置。内置浏览器 URL 安全策略拒绝读取 `http://127.0.0.2:3001`，未改用其他地址绕过；我启动的 3001 服务已停止。
- 该次检查时源码指纹为 `["web"]`：11:19 后 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 与 `packages/client/ui-sidebar` 文件有更新。执行 `pnpm --filter lfaa-web run build`，TypeScript 检查和 Vite 构建通过，产物写入 `dist/apps/web`，之后 `node scripts/runtime-build-state.mjs web` 返回 `[]`，定向 `git diff --check` 通过。因构建输出更新时 3000 进程 PID 21836 仍在运行，`GET /` 返回构建保护 503；该进程命令未带 `--no-local-daemon`，本轮没有重启，避免未经确认影响它可能托管的本机 Daemon 或活动任务。当前登录会话和真实账户设置/图片未通过这次操作写入。
- 构建后的最终只读检查发现 3000 监听 PID 已由 21836 变为 29224（11:22:01）；变更原因无法从只读结果确认，未由本轮发起停止操作。该进程健康检查 HTTP 200、外观路由 HTTP 200，HTML 引用新入口 `/assets/index-Da99NlBX.js`，`runtime-build-state.mjs web` 返回 `[]`。没有在浏览器重载当前真实标签或读写真实账户；隔离地址策略拒绝后未尝试换地址继续，当前 3000 的视觉/上传回归仍待用户刷新页面或允许后续实页验收。
- 11:24:36 `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx` 在 Web 构建（`dist/apps/web/index.html` 为 11:21:40）后再次更新；最终 `runtime-build-state.mjs web` 返回 `["web"]`。3000 的健康与外观 GET 仍为 HTTP 200，但运行时指纹保护可能拒绝保存。本轮不重复构建或重启，以免与工作区中正在变化的其他 UI 修改竞跑，也未重启命令未带 `--no-local-daemon` 的 3000 服务。
- 用户确认没有需要保护的运行任务并明确授权重启后，执行第二次 `pnpm --filter lfaa-web run build`；TypeScript 检查和 Vite 构建通过。最终源码指纹为 `[]`，`git diff --check` 通过。3000 监听 PID 在构建后变为 13960（11:25:36），未从只读证据确认由谁触发；健康检查及外观路由均 HTTP 200，HTML 当前引用 `/assets/index-Da99NlBX.js`。没有通过浏览器进行上传、删除或刷新验收：内置浏览器已拒绝隔离服务地址，按策略没有换地址继续。真实账号未写入；旧的 `127.0.0.1:3001` 隔离登录可能影响同主机 Cookie，若 3000 页面提示登录需要重新登录。

<a id="lfaa-menu-npm-publish-20261020"></a>

## 139-工作台接入 npm 发布-20261020

### 目标、Owner 与配置

- 在 `lfaa.bat` 已打开的 Windows LFAA 工作台菜单中增加 npm 发布选项 `7`，发布现有公共 CLI 包。实现入口为 `lfaa.bat` → `scripts/project-menu.mjs` → `scripts/install-dependencies.ps1` → 根 `publish:cli` → `scripts/package-cli.mjs`；CLI 包名和版本由 `apps/cli/package.json` 唯一提供，构建与发布清单继续由现有脚本负责。
- 发布产物仅写入根 `dist/npm/lfaa/`；菜单按现有 Node/pnpm 版本检查运行发布命令。npm 登录身份由 npm CLI 配置提供，本轮不读取或写入凭据文件。
- 不涉及设置中心、用户业务数据、服务权限或运行配置。

### 允许、禁止与验收

- 允许：修改 `package.json`、`scripts/install-dependencies.ps1`、`apps/cli/tests/npm-publish-menu.test.mjs`、CLI/菜单中英文事实文档及本合同/索引。
- 禁止：更改产品/CLI 版本、编辑 npm 凭据或 registry 认证、提交、推送 GitHub、创建 Tag、实际执行 `npm publish`、触碰运行数据或覆盖工作树其他未提交改动。
- 菜单 `7` 显示当前 `apps/cli/package.json` 的包名与版本，确认发布目标后才检查 npm 官方 registry 登录状态和同版本是否已发布；已存在版本、登录失败或版本查询遇到非 404 网络错误时停止。版本未发布且用户确认后，复用根 `publish:cli` 执行构建和发布；取消时不得调用构建或发布命令，失败返回菜单并报告真实错误。
- 定向回归验证菜单取消不触发发布；运行 PowerShell 5.1 AST/语法检查及 `git diff --check`。不实际构建完整产品、不运行发布命令、不上传包；记录 registry 当前版本查询结果。

### 实施与验收记录

- `scripts/install-dependencies.ps1` 在菜单 7 展示 CLI 清单中的名称/版本，默认拒绝发布；用户确认后读取 npm 官方 registry 的登录状态与精确版本。已有版本或非 404 查询失败都会中止，未发布时调用现有 `publish:cli`，不复制构建或发布逻辑。
- 根 `package.json` 的 `publish:cli` 显式使用 `https://registry.npmjs.org/`；CLI 包名/版本仍由 `apps/cli/package.json` 提供，`scripts/package-cli.mjs` 继续将发布物写入根 `dist/npm/lfaa/`。没有改版本、凭据、设置中心配置或运行数据。
- 更新 `apps/cli/README.md`、`docs/user/cli.md`、`docs/user/cli.zh.md` 和 `docs/系统总体架构.md`，同步菜单编号与 npm 发布步骤；`lfaa.bat` 仍通过原工作台入口加载该菜单。
- `node --test apps/cli/tests/npm-publish-menu.test.mjs`：2/2 通过，覆盖菜单映射与取消后不调用 npm/pnpm。Windows PowerShell 5.1.22621.3958 AST 解析通过；`package.json` JSON 校验通过；`git diff --check` 通过。
- npm 只读查询 `npm view @yubboo/lfaa@0.0.8 version --json --registry=https://registry.npmjs.org/` 返回 E404，当前 registry 未返回该版本。没有检查 npm 登录身份、完整构建包、实际发布或验证在线安装；菜单发布流程尚未执行。

<a id="lfaa-settings-app-navigation-workspace-20261020"></a>

## 140-设置中心插件管理和文件管理应用入口复用四栏工作区-20261020

### 目标、Owner 与设置

- 修复设置中心、插件管理页和文件管理页全局导航轨的“应用”图标仍打开旧弹出列表的问题。点击后直接进入现有 `/work` 小鱼工作区，应用清单由四栏工作区的左二 `SecondaryNavigation` 呈现；选择应用仍沿用 Workbench 路由或 `onOpenApplication` Owner。
- Owner：`packages/client/ui-settings/SettingsPage.tsx`、`packages/client/ui-plugin-manager/PluginManagerPage.tsx` 与 `packages/client/ui-sidebar-files/FileManagerPage.tsx` 将独立页面入口接到 `/work`；`packages/client/ui-sidebar/GlobalNavigationRail.tsx` 保留统一入口；`packages/client/ui-layout/Workbench.tsx` 与 `packages/client/ui-workspace/ApplicationWorkspace.tsx` 继续装配四栏及同一应用清单。
- 设置盘点：不新增或改变设置默认值与持久化；沿用 `general.navigationLayout`、现有应用导航显隐和工作区 Dock 开合/宽度偏好，以及 Appearance 共享令牌。路由切换不另建应用数据或菜单状态。

### 允许、禁止与验收

- 允许：修改三个独立页面的全局导航接线、已有直接 UI 回归 `apps/cli/tests/client-app-workspace-four-column.test.mjs`、受影响包 README、`docs/系统总体架构.md` 及本合同记录。
- 禁止：另建应用清单、弹出层或布局系统；改变文件操作、应用权限、路由规则、用户面板偏好与真实业务数据；覆盖其他未提交修改、提交或发布。
- 回归确认设置页、插件管理页和文件管理页的“应用”图标均提供 `/work` 路由，不渲染旧应用弹层；四栏工作区仍只消费 Workbench 的统一清单，现有应用条目路由/打开回调与 DockKit 布局合同不变。运行相关回归、Client 类型检查、受影响包构建、正式 Web 构建、适用工作区 Gate、构建指纹与 `git diff --check`；产物只写根 `dist/`。
- 按要求依次排查社交媒体、技术社区、项目 GitHub、官方文档，并在合同记录结果与来源。ChatGPT 内置浏览器从设置中心、插件管理页和文件管理页点击“应用”分别实际验证直接进入 `/work`、没有旧弹层且能看到现有应用二级导航；覆盖桌面及代表性窄短视口，记录实测尺寸、点击结果和截图。保持主题/设置与应用偏好不变；未测设备、桌面 WebView 与帧时间须明确注明。

### 排查与实施记录

- 社交媒体搜索没有找到 LFAA 对应行为或可直接采用的修复；技术社区仅找到 React 路由菜单随当前 URL 切换页面的通用建议；项目 GitHub `yubboo/LFAA` Issues/Discussions/PR 搜索没有找到这处缺陷的已有修复；React Router 官方 [路由与页面映射](https://reactrouter.com/start/framework/routing)和[导航](https://reactrouter.com/start/framework/navigating)资料说明路由匹配决定页面呈现。最终根因以本地调用链为准：SettingsPage 未提供 Dock 回调，GlobalNavigationRail 因而走旧 popup 分支；新 `/work` 页面已由 Workbench 装配四栏和共享应用清单。
- `SettingsPage` 为全局导航“应用”按钮提供 `onToggleApplications`，调用既有 `onNavigate("/work")`；`GlobalNavigationRail` 因而不进入旧 popup 分支。WorkBench/ApplicationWorkspace 继续呈现唯一应用清单与左二 `SecondaryNavigation`，没有新增应用清单、设置或业务数据。
- 回归 `node --test apps/cli/tests/client-app-workspace-four-column.test.mjs`：5/5 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-settings build`、`pnpm run build:web`、`pnpm run check:workspace`（195 个包）、`node scripts/runtime-build-state.mjs web`（`[]`）及 `git diff --check` 均通过，产物位于仓库根 `dist/`。
- 正式 Web 由当前 checkout 执行 `pnpm lfaa web`，监听 `http://127.0.0.1:3000`。内置浏览器在 `/settings?section=plugins`、`1440×900` 点击“应用”后实际进入 `/work`；AX/截图均确认左二应用导航与工作区正常，没有旧弹层。临时展开右资源栏核对四栏，再恢复原收起状态。`760×520` 下应用导航和中心内容可见，根内容宽度 750px，无横向溢出；视口 override 已重置。最终保留 `/work` 作为用户可检查页面，没有保存设置或改变应用/面板偏好。
- 同模式问题继续定位到 `PluginManagerPage` 未传 `onToggleApplications`；共享轨因此在插件页回退旧弹层。X 搜索没有找到 LFAA 对应修复；技术社区只提供一般路由/状态建议；项目 GitHub 定向搜索没有找到 LFAA 的相关既有问题或修复；React Router 官方导航文档说明由路由入口驱动页面跳转。插件页现已将回调接到既有 `onNavigate("/work")`，没有增加菜单数据或布局。
- 新增插件页直接回归后，`node --test apps/cli/tests/client-app-workspace-four-column.test.mjs` 为 6/6；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-plugin-manager build`、`pnpm run build:web`、`pnpm run check:workspace`（195 个包）、`node scripts/runtime-build-state.mjs web`（`[]`）和 `git diff --check` 全部通过，构建产物仅写入根 `dist/`。
- ChatGPT 内置浏览器在当前正式 Web `/plugin-manager` 桌面页面点击“应用”后，真实地址变为 `/work`，左侧显示 Workbench 共用应用清单，没有旧弹层；截图已捕获。为重新加载新构建，先由正式 `pnpm lfaa web` 菜单重启已确认归属当前 checkout 的 PID 14316，再在页面刷新后验收。此轮没有改布局样式，未重复测窄屏插件页点击；既有 `/work` 窄短视口检查见前一条记录，手机、平板、桌面 WebView 和帧时间未测。
- 文件管理入口同样漏传 `onToggleApplications`。本次按 X、技术社区、项目 GitHub、React Router 官方文档顺序复查：未找到 LFAA 可直接复用的修复；社区只有一般的路由/回调讨论，官方文档明确支持在用户交互回调中导航。`FileManagerPage` 现将全局应用入口接至既有 `/work`，与设置和插件管理入口保持一致；文件资源、数据与首页返回合同不变。
- `node --test apps/cli/tests/client-app-workspace-four-column.test.mjs`：7/7 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-sidebar-files build`、`pnpm run build:web`、`pnpm run check:workspace`（195 个包）、`node scripts/runtime-build-state.mjs web`（`[]`）及 `git diff --check` 均通过；构建产物只写入根 `dist/`。
- 正式 Web 在当前 checkout 重启后，ChatGPT 内置浏览器从 `/files` 点击“应用”实际进入 `/work`；AX 与截图确认使用 Workbench 共用应用导航列表，没有旧弹出菜单。截图记录常规桌面视口；本次仅改导航回调，未改布局样式，未重复测窄屏文件页。手机/平板设备、桌面 WebView 和帧时间未测。
- 没有新增监听、轮询或服务请求链，路由进入工作区仍由现有 Owner 按需加载。真实手机/平板、桌面 WebView 和帧时间未测；没有提交或发布。

<a id="lfaa-recent-sessions-workspace-sync-20261020"></a>

## 141-最近会话与工作区列表联动-20261020

### 目标、Owner 与设置

- 修复 `/work` 左一“最近会话”弹层与左二工作区会话列表不同步的问题。两处只显示和打开 LFAA 内部、当前账户的 AI Work 会话；用户已明确不接入外层 Codex/ChatGPT 对话历史。
- Owner：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 持有当前账户 `aiSessions` 列表、读取状态与错误状态；`packages/client/ui-sidebar/src/GlobalNavigationRail.tsx` 呈现最近会话并调用刷新回调；`packages/client/connection/src/api.ts` 的 `loadAiSessions()` 与 Session Owner 继续提供权威数据。选择会话继续 dispatch 既有 `aiWorkSessionOpenEventName`，由 Workbench 按现有流程打开。
- 设置盘点：不新增或改变设置项、默认值及持久化；复用现有账户隔离缓存、认证 API 和工作区外观/导航令牌。

### 允许、禁止与验收

- 允许：修改 `GlobalNavigationRail.tsx`、`ApplicationWorkspace.tsx`、直接 UI 回归 `apps/cli/tests/client-app-workspace-four-column.test.mjs`、读取串行/清理生命周期回归 `apps/cli/tests/client-performance.test.mjs`、相关 Owner README、系统架构事实及本合同记录。
- 禁止：桥接 Codex/ChatGPT 外层会话；新增 Session API、数据库、客户端第二份权威存储、伪造会话/空数据；打开或读取会话正文；改变 Session 认证/权限、用户设置或实际会话数据；覆盖其他未提交修改、提交或发布。
- `/work` 工作区激活时，全局最近会话弹层与左二会话侧栏必须消费同一份 `aiSessions`、加载/错误状态；打开弹层时调用工作区 Owner 的刷新函数，返回的列表同时更新两处。选择弹层条目继续通过既有事件打开正确的 LFAA `appId/sessionId`。
- 只有一个在途列表读取；切换账户、离开 AI Work 或卸载时取消过期读取，旧请求不得覆盖新账户状态；工作区外的全局导航保留已有认证 API 按需读取与其生命周期。不得增加轮询。
- 运行直接回归、Client 类型检查、受影响包/Web 构建、适用工作区 Gate、运行指纹及 `git diff --check`；构建产物只能写入根 `dist/`。在 ChatGPT 内置浏览器的真实 `/work` 页面验证最近会话弹层显示和刷新与左二列表一致，打开条目仍留在 LFAA 并选择对应会话；记录视口、截图和未测设备/帧时间范围。验收不创建会话或修改真实用户数据。
- 本轮按已确认的 Bug 排查顺序记录外部调查：社交媒体、技术社区、LFAA GitHub、官方文档。外部资料没有直接修复当前 LFAA UI 状态分叉的问题，最终方案须以本地 Owner 调用链为依据。

### 排查与实施记录

- 社交媒体检索未找到与 LFAA 会话弹层状态同步相关的可复用修复；技术社区的通用讨论提示列表 API 响应与 UI 快照可能分叉，需检查真实列表 Owner；项目 GitHub `yubboo/LFAA` Issues/Discussions/PR 未发现本问题的直接修复。
- React 官方 [在 Effect 中同步](https://react.dev/learn/synchronizing-with-effects)说明读取请求需要处理响应竞态和清理；DeepSeek Harness 官方 [Session List 与事件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/session.md)及 [Web Client](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/web-client.md)文档将会话列表和客户端状态归到共享 Session/API 模型。本地根因为 `ApplicationWorkspace` 与 `GlobalNavigationRail` 各自持有列表：工作区侧栏消费 `aiSessions`，全局弹层独立调用同一个 API，所以两边没有共享即时刷新状态。
- `ApplicationWorkspace` 将账户 ID 与会话列表快照绑定，当前账户变化时只显示该账户缓存；`GlobalNavigationRail` 在 `/work` 收到同一个未归档列表、加载/错误状态和刷新回调。弹层保持最多显示最近 20 条，点击或重试调用同一串行刷新；聊天回写、新建和归档统一更新同一账户快照。已有 `aiWorkSessionOpenEventName` 未变，仍由 Workbench 按 `appId/sessionId` 打开；非工作区页面保留原有认证 API 按需读取。
- 没有新增订阅、定时轮询、API、持久化或设置；刷新合并同账户在途请求，离开 AI Work/切换账户/卸载会中止旧请求，并通过请求身份检查阻止旧结果覆盖新状态。外观、导航和权限沿用现有设置与 Owner。
- `node --test apps/cli/tests/client-app-workspace-four-column.test.mjs`：8/8；CLI 包加载器运行 `client-performance.test.mjs` 与 `client-requests.test.mjs`：40/40；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-sidebar build`、`pnpm --filter lfaa-client-ui-workspace build`、`pnpm run build:web`、`pnpm run check:workspace`（195 包）、`node scripts/runtime-build-state.mjs web`（`[]`）和 `git diff --check` 均通过。构建产物只写入根 `dist/`。
- 正式 Web 以 `pnpm lfaa web` 从当前 checkout 重启，`http://127.0.0.1:3000/api/health` 与 `/work` 返回 200，Web 构建指纹为 `[]`。ChatGPT 内置浏览器实页路由 `/work`、视口 `1585×1244`；弹出“最近会话”时显示 0 条，展开左二工作区侧栏核对也显示 `小鱼智能体 会话 0 / 还没有会话`，再次刷新弹层仍为同一空列表。截图已在内置浏览器验收过程中采集；检查后恢复侧栏收起，保留 `/work` 和最近会话弹层供用户查看。由于当前账户没有 LFAA 内部会话，没有伪造数据，也无法在实页点击某条会话；既有打开事件以直接回归确认。该轮仅调整数据状态接线，没有改 CSS；本轮未覆盖窄分栏、物理手机/平板、桌面 WebView 和帧时间。没有提交或发布。
- 后续修正：用户指出弹层形态未统一；2026-10-20 合同 142 移除这份重复浮层，改为展开唯一的左二 Dock。

<a id="lfaa-recent-sessions-dock-navigation-20261020"></a>

## 142-最近会话入口复用左侧会话 Dock-20261020

### 目标、Owner 与设置

- 修正左一“最近会话”仍打开悬浮卡片的问题。点击该入口应显示既有左二会话侧栏；会话只渲染一次、只由 `ApplicationSidebar` 呈现。
- `/work` 的 AI Work 状态由 `ApplicationWorkspace` 持有；会话列表、加载/错误状态和刷新继续使用同一个账户隔离 `aiSessions` 与 Session API。处于普通应用模式时先切到 AI Work，再展开 Dock。设置/文件/插件等独立页面通过既有全局导航进入 `/work`，不保留第二份悬浮会话列表。
- 桌面使用现有 Grid Dock；窄容器使用 `ResizableWorkbench` 的响应式侧栏模式。未改变 `general.navigationLayout`、Appearance 或 DockKit 已有开合/宽度偏好，不新增设置。

### 允许、禁止与验收

- 允许：修改 `GlobalNavigationRail.tsx/.css`、`ApplicationWorkspace.tsx`、直接 UI 回归、ui-sidebar/ui-workspace README、系统架构事实及本合同。
- 禁止：新增会话 API/缓存/持久化/路由或假会话；桥接外层 Codex/ChatGPT 历史；修改真实会话数据；覆盖其他未提交工作；提交或发布。
- 点击左一“最近会话”不渲染 `dialog/popover`，直接让 AI Work 左二 Dock 展开并刷新共享列表；条目仍由原侧栏选择处理。工作区外点击应通过现有入口进入 `/work`，不呈现第二套会话 UI。
- 运行直接 UI 回归、Client 类型检查、相关包与 Web 构建、适用工作区 Gate、运行指纹和 `git diff --check`。内置浏览器实页至少核对 `/work` 常用宽视口与窄分栏/短屏：点击“最近会话”后 Dock 到位且没有悬浮卡片，刷新仍使用同一列表，侧栏能滚动且主操作可达。没有真实会话时不创建伪数据；记录无法实点会话条目的原因。

### 排查与实施记录

- 遵循缺陷资料顺序检索：社交媒体只找到[通用 React Drawer 讨论](https://www.reddit.com/r/reactjs/comments/1lddntl/)，没有 LFAA 解决方案；技术社区的 Drawer/overlay 讨论与本问题不同；项目 GitHub `yubboo/LFAA` Issues/Discussions/PR 未找到此处入口布局的直接修复；React 官方 [`createPortal`](https://react.dev/reference/react-dom/createPortal) 说明浮层会脱离原组件位置渲染，Microsoft Fluent UI 的 [`InlineDrawer` 指南](https://github.com/microsoft/fluentui/blob/master/packages/react-components/react-drawer/stories/src/Drawer/DrawerBestPractices.md)将导航内容归为 inline drawer 场景。没有可直接复用的外部补丁。
- 本地源码确认根因：`GlobalNavigationRail` 将最近会话固定渲染为 `role="dialog"`、`module-navigation-rail__popover--recent`；上一轮只统一其数据来源，未改变这一交互。修复复用已有 Dock 与 `ApplicationSidebar` 会话数据/操作链，不新增状态副本。
- 实施与验收逐批追加记录；构建只写根目录 `dist/`。设置中心配置不变更。
- 验证：`node --test apps/cli/tests/client-app-workspace-four-column.test.mjs` 9/9；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-sidebar build`、`pnpm --filter lfaa-client-ui-workspace build`、`pnpm run build:web`、`node scripts/runtime-build-state.mjs web`（`[]`）、`git diff --check` 通过。`pnpm run check:workspace` 未通过，唯一报告为“包目录 JSON 清单过期”；包清单/包树在本轮前已有其他未提交改动，本轮没有重写它们。
- 正式 Web 在本轮最终构建后重启；`http://127.0.0.1:3000/api/health` 与 `/work` 返回 200。ChatGPT 内置浏览器最终路由 `/work`、视口 `1585×1244`：点击左一“最近会话”后左二 Dock 保持展开，DOM 中没有 `role=dialog[aria-label="最近会话"]`，同一会话栏仍显示 0 条及“还没有会话”。从 `/files` 点击“最近会话”也回到 `/work` 并显示同一侧栏。截图由内置浏览器在本轮采集并展示；没有保存为独立文件。账号无 LFAA 内部会话，因此没有真实条目可点；没有创建会话或写入用户数据。
- 本轮未改样式断点；窄分栏/手机/平板/桌面 WebView 未实测，窄布局由 `ApplicationWorkspace` 设为 DockKit 响应式左 Dock，并在非 Desktop 时收起右 Dock；真实帧时间未测。交互没有新增订阅/轮询，按钮复用现有会话刷新。

<a id="lfaa-recent-sessions-entry-intent-20261020"></a>

## 143-最近会话入口跨页面意图丢失-20261020

### 目标、Owner 与设置

- 修复全局导航“最近会话”在设置中心、文件管理和插件管理页退化成普通工作区入口的问题。跨页进入 `/work` 后应展开同一个 AI Work 左侧 Dock 并刷新已有会话列表；“工作·小鱼智能体”仍只进入工作区。
- Owner：`GlobalNavigationRail` 将“最近会话”作为明确回调合同；`Workbench` 持有跨页面的一次性打开请求并负责将其路由到 `/work`；`ApplicationWorkspace` 消费请求、展开 Dock、调用原有 `refreshAiSessions()`；会话数据仍归同一组件和认证 Session API。
- 设置盘点：不新增或修改配置；沿用 `general.navigationLayout`、现有 DockKit 开合/宽度偏好、Appearance 共享令牌与账户隔离会话状态。不得为导航请求持久化会话或重置用户面板偏好。

### 允许、禁止与验收

- 允许：调整 `GlobalNavigationRail`、Workbench 与三个全局导航页面之间的回调合同、`ApplicationWorkspace` 的一次性请求消费、直接导航回归、受影响包 README、系统架构事实及本合同。
- 禁止：第二份会话列表/API/缓存、伪会话、外层 Codex/ChatGPT 历史、真实会话数据写入、改变用户 Dock 偏好或权限；不覆盖其他未提交修改，不提交或发布。
- 从 `/settings`、`/files`、`/plugin-manager` 点击“最近会话”后均进入 `/work`、展开现有 Dock、显示同一会话列表；点击“工作·小鱼智能体”只进入 `/work`，不发送请求展开会话 Dock。当前 `/work` 内的最近会话入口仍同步展开并刷新，不渲染悬浮层；没有创建或发送会话内容。
- 运行直接 UI 回归、Client 类型检查、受影响包和 Web 构建、构建指纹、相关工作区 Gate 与 `git diff --check`；在 ChatGPT 内置浏览器实际核对上述三个来源路由与 `/work`。记录实测视口及未覆盖的设备/帧时间；构建只写根目录 `dist/`。

### 排查与实施记录

- 按规定顺序查询社交媒体、技术社区、项目 GitHub 和官方文档：社交媒体结果没有 LFAA 或同类按钮双入口的可验证修复；Stack Overflow 的路由激活/抽屉问题仅提供通用状态建议；对 `yubboo/LFAA` Issues/Discussions/PR 的定向搜索未找到本问题的既有处理；React 官方[组件间共享状态](https://react.dev/learn/sharing-state-between-components)强调协调状态由公共 Owner 驱动。外部资料未提供可直接套用的 LFAA 补丁。
- 本地实测和调用链确认：设置、文件与插件页面均未传 `onOpenRecentSessions`，`GlobalNavigationRail` 因此回退到 `onOpenWork`，两个按钮实际都会调用相同的 `/work` 跳转；只有已经在 `ApplicationWorkspace` 中时，最近会话才展开 Dock 并刷新。没有发现第二份会话数据。另发现运行中的 Web 指纹与新构建不一致，按官方 CLI 入口重启后再验收。
- 实现、验证与页面证据逐批补记；没有设置中心配置变更。

### 实施与验收结果

- `GlobalNavigationRail` 现在要求调用方提供独立 `onOpenRecentSessions`；设置、文件、插件页由 Workbench 的一次性请求 ID 导航到 `/work`，`ApplicationWorkspace` 展开原有 Dock、刷新现有列表并确认消费，请求不存储、不重放。“工作·小鱼智能体”仍只导航，不触发最近列表请求。会话数据仍是一份，没有新增 API、缓存、设置或订阅。
- 回归：`node --test apps/cli/tests/client-app-workspace-four-column.test.mjs` 9/9；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；ui-sidebar、ui-workspace、ui-layout、ui-settings、ui-sidebar-files、ui-plugin-manager 六个包构建通过；`pnpm run build:web` 通过，输出仅在根 `dist/`。构建提示有既有大于 500 kB 的 chunk；不影响构建完成。`node scripts/runtime-build-state.mjs web` 返回 `[]`，`git diff --check` 通过。`pnpm run check:workspace` 仍失败于“包目录 JSON 清单过期”；该 Gate 在先前工作中已出现，本轮没有改包 JSON 或重写清单。
- 正式 Web 经 LFAA CLI 入口重启；ChatGPT 内置浏览器在 1585×1244 实际验证 `/settings?section=plugins`、`/files`、`/plugin-manager` 分别点击“最近会话”后都到 `/work`。三次都显示同一账户的 1 条会话“你好”，该行仍是当前选择，左 Dock 展开，DOM 没有最近会话悬浮 dialog。最终留在 `/work`。没有创建/发送会话内容，也没有改 Dock/外观偏好。
- 本轮仅变导航回调与请求传递，没有改 CSS；窄屏、平板/手机、桌面 WebView 与帧时间未测。实页可见一条既有会话，因此回归覆盖同一列表和已选行，不新造数据。未作服务端会话读取/写入合同变更。

<a id="lfaa-workspace-application-navigation-right-dock-20261020"></a>

## 144-工作区应用导航迁至右侧菜单-20261020

### 目标、Owner 与设置

- 将 `/work` 四栏中的应用清单和当前应用子导航从左二栏迁至右侧菜单栏；右栏新增“应用”视图，与原工具/资源视图并列。左二栏保留小鱼智能体草稿、置顶、项目及最近会话管理。
- Owner：Workbench 继续提供过滤后的 `applicationNavigationItems` 和现有路由/App 打开回调；`ApplicationWorkspace` 负责右侧菜单视图、应用导航选择与布局；`ApplicationSidebar` 只负责会话/项目。应用和业务状态不复制。
- 设置盘点：沿用 `general.hiddenApplicationNavigationIds`、`general.navigationLayout`、现有 DockKit 左右面板开合/宽度偏好及 Appearance 共享令牌；不增加设置、不改变默认值或持久化格式。应用入口显隐仍不代表权限。
- 宽度目标：参照 ChatGPT 输入列，AI Work 中间区在所有布局模式下最窄为 300px，右栏最大宽度允许占用中心下限之外的可用宽度，以右侧分隔条拖动控制中心/右栏比例。左二栏为第二窄区域：只在 AI Work 的 `responsiveRightDock` 模式收紧 `left.max`（比例 0.26、下限 320px、上限 440px），保留现有 `left.min`、默认 `left.initial`、DockKit 宽度偏好与持久化格式；Settings、Plugin Manager 等通用 Surface 的左栏上限不变。输入框和消息工具栏依 AI Work 聊天容器宽度响应；最窄输入状态将项目、权限、更多、模型等次要文字操作折叠为图标，保留名称、提示和现有行为；宽度充足时保留完整文字。

### 允许、禁止与验收

- 允许：调整 `ApplicationWorkspace.tsx`、`packages/client/ui-chat/src/AiWorkChat.tsx`、`WorkspaceProjectPicker.tsx` 及对应样式、Workbench 与 GlobalNavigationRail 的必要属性、`packages/client/ui-dockkit/src/workbench-layout.config.ts`、直接工作区/布局回归、相关包 README、`docs/系统总体架构.md` 与本合同。
- 禁止：新增第二份应用清单、应用/会话业务数据、权限或设置；改变路由和真实业务操作；移除设置中心对内置应用导航开关的控制；修改外部页面应用入口、真实会话/项目数据或既有未提交工作；提交或发布。
- 左一“应用”入口打开右 Dock 的“应用”视图；右侧“工具与资源”入口返回原资源视图；右栏应用清单、Minecraft/联机应用子菜单及写作目录 Portal 均位于右 Dock。左二 DOM 不再呈现应用清单或应用子菜单，只保留会话与项目相关内容。
- 从应用清单选择游戏库、SteamCMD、Minecraft、LFAA 联机、写作空间和 AI 漫剧，沿用现有路由/打开回调；切换应用后右侧应用视图仍可用。最近会话继续展开左二，不触发右侧应用视图。
- AI Work 在桌面、紧凑和移动布局下均允许把中心区拖至 300px；继续拖动右分隔条时右菜单按剩余空间扩宽，中心不低于 300px。左二栏只收紧最大宽度，最小宽度和默认宽度不变；通用 Settings/Plugin Manager 左栏范围与布局断点不受影响。
- AI Work 聊天容器宽度不超过 380px 时，输入区项目关联、当前应用提示、权限、更多和模型选择转为紧凑图标控件并与语音/发送操作同排；控件保留可访问名称和悬浮提示。容器加宽后文字标签恢复；300px 中心下限下工具栏保持同排，文本框仍可输入和滚动。
- 新增本轮批次：在 `/work` 的 AI Work 中心画布与左二会话/项目栏、右侧工具/应用栏之间加入随实际中心容器宽度缩放的左右留白，中心 Dock 仍保持 300px 最小宽度；最窄布局仍须让输入框和滚动内容可用，Dock 的分隔条拖动与吸附行为不变。
- 运行目标 UI 回归、Client 类型检查、直接受影响包构建、正式 Web 构建、构建指纹、适用 workspace Gate 与 `git diff --check`；正式 Web 内置浏览器核对桌面、窄分栏及短屏，检查左右 Dock 交互、列表滚动、选中应用跳转和既有会话项目可达性。设置与真实业务数据保持不变；设备/帧时间如未测须注明。

### 中心画布与左右菜单留白批次（2026-10-20）

- 目标：AI Work 中间画布在所有屏幕尺寸和嵌入容器中都与左二会话/项目栏、右侧工具/应用栏拉开 12–24px 响应式间距，不再顶到两侧；左右 Dock 和 300px 中心最小宽度的几何规则不变。
- Owner：应用工作区中心画布与实际容器间距归 `packages/client/ui-workspace/src/module-workbench.css`；Dock 分隔、轨道预算与容器测量仍由 `ui-dockkit` 唯一持有，不新增布局状态。
- 设置：沿用 `general.navigationLayout`、左右 Dock 已保存宽度/开合状态，以及 Appearance 主题和共享外观令牌；间距是容器响应式版式，不增加设置项、不改变既有偏好。
- 允许：`packages/client/ui-workspace/src/module-workbench.css`、`packages/client/ui-workspace/README.md`、直接工作区 UI 回归及本合同；不改 DockKit 拖动/吸附算法、中心最小宽度、真实会话/应用数据或设置 Owner。
- 验收：间距按中心容器宽度计算，避免依赖窗口宽度；桌面、平板、手机和窄分栏均有清晰左右留白，300px 中心下限仍能输入与滚动；右 Dock 与左二 Dock 同时打开时不重叠/溢出，拖动宽度、折叠和恢复照旧。运行直接回归、Client 类型、Workspace/Web 构建、正式 Web 指纹与差异检查；内置浏览器记录实际 `/work` 视口和截图。帧时间、触屏与 Desktop WebView 未测时标明。

### 窄分栏下提问锚点贴合左二 Dock（2026-10-20）

- 用户问题：桌面大屏提问锚点刻度贴近左二菜单；加入中心画布左右留白后，窄列锚点跟随缩窄后的聊天容器一起向内偏移，与左二菜单脱开。
- 目标：聊天画布内容继续在左右留出 12–24px；提问锚点轨道按完整中心列左缘定位，在宽屏保持原位置，在窄分栏也贴近左二 Dock；消息滚动、锚点命中与预览卡仍可用。
- Owner：`ui-chat` 持有会话锚点和消息滚动；`ui-workspace` 持有 AI Work 中心列留白与列几何。本批不改 DockKit 或会话状态。
- 设置：沿用当前导航布局、Dock 宽度偏好和 Appearance 外观令牌；不新增、重置或写入设置。
- 允许：`packages/client/ui-chat/src/ai-work-chat.css`、`packages/client/ui-chat/README.md`、`packages/client/ui-workspace/src/module-workbench.css`、`packages/client/ui-workspace/README.md`、直接工作区回归及本合同。禁止：改变锚点排序/跳转语义、会话/消息数据、Dock 宽度和吸附规则、用户设置或无关未提交工作。
- 验收：中心宽度 300px 及更宽时，锚点刻度保持在完整中心列左缘内侧并贴近左二 Dock；消息正文、滚动视口和输入框继续保留左右留白，右侧 Dock 不重叠；桌面宽列外观不回退。运行直接回归、Client 类型、受影响包/Web 构建、正式 Web 指纹、`git diff --check`，并在 ChatGPT 内置浏览器记录 `/work` 桌面与窄分栏截图、实际列宽和锚点位置。设备与触屏未测须注明。

#### 实施与验收结果

- `.ai-work-chat` 外框铺满中心轨道，并以中心列宽度裁切背景表面 12–24px；消息舞台反向延伸回完整中心列承载原有锚点轨道，告警、消息滚动视口和输入框仍在内缩内容区。壁纸背景也明确使用内容盒裁切。刻度继续 `left: 0` 定位于消息舞台，因此相对中心列左缘稳定，不再随正文留白右移；锚点排序、跳转、预览和会话状态均未改。
- 设置：不新增或更改设置。仅沿用现有 `general.navigationLayout`、Dock 宽度/开合偏好和 Appearance 共享令牌。没有消息、会话或业务数据写入；验收只检查既有消息，不发送新内容；没有新增订阅、请求、计时器或数据增长。
- 定向回归 `node --test apps/cli/tests/client-app-workspace-four-column.test.mjs apps/cli/tests/client-workbench-responsive.test.mjs apps/cli/tests/client-ai-work-composer-responsive.test.mjs` 29/29 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`（2267 modules）、`node scripts/runtime-build-state.mjs web`（`[]`）和 `git diff --check` 通过。Web 构建保留既有 `cpp` 501.30 kB chunk 提示。`pnpm run check:workspace` 仍唯一失败于“包目录 JSON 清单过期”，本批未改清单。
- LFAA CLI 正式服务在 `http://127.0.0.1:3000` 重启，`/api/health` 返回 `ok`。内置浏览器实际路由 `/work`：宽屏 `1646×1244` 时中心列 1282px，锚点刻度位于中心列左缘内 8px、消息视口留白 24px；窄屏 `664×900` 时进入 mobile 布局、中心列正好 300px，刻度仍内 8px、消息视口左右各留 12px、输入框可见，右 Dock 288px 且没有页面横向溢出。截图已在本轮浏览器验收记录中捕获，未另存成文件。内置浏览器该账户当前左二 Dock 为收起状态；为避免改写其开合偏好，没有临时打开，故实页用几何核对中心边缘定位；用户提供的大屏图展示了左二展开时的参考位置。手机/平板真机、触屏、短屏、Desktop WebView 和帧时间未测。
- 窄列和宽列复验没有操作输入框、锚点或 Dock 控件；没有改写设置或会话历史。本轮只临时调整内置浏览器视口并已恢复默认，不改变工作区 Dock 偏好。

### 实施与验收结果

- 初次中心留白批次曾直接缩窄 `.ai-work-chat` 根，锚点因此跟随根向内偏移；该几何已由上方“窄分栏下提问锚点贴合左二 Dock”批次修正。当前根占满中心轨道，背景和内容内缩 12–24px，消息舞台仍覆盖完整中心列；Dock 宽度、300px 中心下限、拖动/吸附规则和会话内容布局不变。
- 设置盘点结果：仅沿用 `general.navigationLayout`、DockKit 已保存的左右栏开合/宽度偏好与 Appearance 共享令牌；本批未新增设置控件、类型、默认值、持久化或映射。
- 定向回归 `node --test apps/cli/tests/client-app-workspace-four-column.test.mjs apps/cli/tests/client-workbench-responsive.test.mjs apps/cli/tests/client-ai-work-composer-responsive.test.mjs`：29/29 通过，包含中心留白与锚点舞台几何断言。详细构建、指纹和 Gate 结果见上方锚点批次。
- 初次留白实现阶段的实际浏览器记录已在上方锚点批次后以最终布局复验更新；早期验证中发生的历史副作用继续如实保留于该阶段记录，本批没有再次操作会话或 Dock 偏好。

### 实施与验收结果

- 首次布局实现阶段使用 260px 中心下限；当时的布局回归、类型、DockKit/Workspace/Web 构建与内置浏览器操作记录，作为先前批次历史证据保留。当前产品规则以后续 300px 验收补记为准。AI Work 左栏 0.26 比例/320–440px 专属最大值与右栏剩余宽度预算仍只用于 `responsiveRightDock`；左栏 min/initial、持久化格式及 Settings/Plugin Manager 通用范围不变。
- 首次布局阶段定向回归 `node --test apps/cli/tests/client-workbench-responsive.test.mjs apps/cli/tests/client-app-workspace-four-column.test.mjs` 为 17/17；当时只覆盖 260px 中心值，属于历史记录，不能代替本次 300px 回归。其余首次阶段的类型、DockKit/Workspace/Web 构建与应用跳转记录保留为历史证据。
- 设置沿用 `general.hiddenApplicationNavigationIds`、`general.navigationLayout`、DockKit 左右栏开合/宽度偏好及 Appearance 共享令牌；无新增设置或持久化格式，无业务数据/API/权限更改。ResizeObserver 和释放逻辑保持原 Owner，无新增订阅、轮询、计时器或数据增长路径；本轮未测帧时间。

### 中心 300px 与窄输入工具栏验收补记

- 将 AI Work 的 `applicationCompactFloor` 调到 300px。AI Work 左二栏 min/initial 保持不动，左二 max 继续沿用前一批收紧规则；右栏使用动态剩余宽度预算，允许拖动后占据其余空间。通用 Settings/Plugin Manager 布局未改变。
- `.ai-work-chat` 按实际容器宽度启用 380px 紧凑断点：项目选择、当前应用、权限、更多和模型控件显示现有 `WorkbenchIcon`，隐藏文字/下拉箭头；`aria-label`、`title`、菜单、权限和模型操作保留。项目与应用标记保持可见，操作按钮同排并适配窄中心区，宽度恢复后文字标签自动显示。
- 定向回归 `node --test apps/cli/tests/client-workbench-responsive.test.mjs apps/cli/tests/client-app-workspace-four-column.test.mjs apps/cli/tests/client-ai-work-composer-responsive.test.mjs`：25/25 通过，包含 Desktop/Compact/Mobile 300px 中心指标、左二最小/初始宽度不变且最大宽度专属收紧、右栏预算高于左栏最大值，以及容器图标态和控件无障碍名称。`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；DockKit、ui-chat、Workspace 包构建和 `pnpm run build:web` 通过（2267 modules），产物写入根 `dist/`；保留现有 `cpp` 501.30 kB chunk 警告。重启后的 `node scripts/runtime-build-state.mjs web` 返回 `[]`，`/api/health` HTTP 200，`git diff --check` 通过。未运行全仓 workspace Gate；本批只更改既有包内容和对应文档。
- 正式 Web 由 `pnpm lfaa web` 在 `http://127.0.0.1:3000` 重启。ChatGPT 内置浏览器实际路由 `/work`，浏览器视口 `1715×1244`：保留左二宽度 256px、右栏原宽度 360px 时，桌面正文与完整文字操作正常。沿右侧分隔条向左拖动至右栏 1080px，中心列约 300px，左二保持不变；项目/应用、权限、更多、模型、语音、发送控件切换为图标并保持同排，文本框仍可见，右菜单正常滚动。检查后将右栏拖回并确认 DockKit 分隔条值恢复为 360px，布局顺序恢复，左二仍为 256px。窄列视口通过桌面内嵌工作区分栏实际验证；手机/平板设备、短屏、桌面 WebView 和帧时间未测。未发送消息、修改设置中心配置或业务数据。
- 本次只读用了现有 `general.hiddenApplicationNavigationIds`、`general.navigationLayout`、DockKit 左右栏开合/宽度偏好及 Appearance 共享令牌；未新增设置、修改持久化或重置用户偏好。无新增订阅、请求、计时器或运行时数据增长；本轮没有帧时间测量。

### 右侧 Dock 拖动卡顿修复批次

- 目标：修复右侧分隔条拖动时工作区卡顿，保持 AI Work 中间区 300px 下限、右栏按剩余空间扩宽，以及左二栏现有宽度范围和记忆值。
- Owner：DockKit `ResizableWorkbench` 继续拥有 Pointer 拖动、每帧 CSS 预览及结束/取消/失焦清理；ui-layout 拥有 Workbench 壁纸/外观表面映射。只在 AI Work 的右栏拖动期间，临时停止大面积工作区表面的 `backdrop-filter`，由已有 `data-dragging` 状态恢复，不添加每帧 React 状态或事件。
- 设置盘点：只消费既有 `appearance.backgrounds`、`appearance.wallpaperEngine`、Appearance 模糊/透明度、DSH 当前逐面壁纸令牌及 DockKit 面板宽度偏好；不新增设置、不改变默认值/持久化或用户偏好。背景色、透明度、几何和聊天内容保持不变。
- 数据与权限：无账户/业务数据、API、权限和运行数据变化。
- 允许：`packages/client/ui-layout/src/workbench.css`、对应 ui-layout README、直接 UI 回归及本合同/索引。禁止：改左侧宽度规则、调整拖动算法/设置存储、禁用非右栏拖动下的玻璃效果、清理其他脏工作树、提交或发布。
- 验收：回归确认滤镜仅在含 AI Work 的右栏拖动时关闭，左栏/底栏拖动不命中；Pointer 正常完成和取消后由现有 DockKit 生命周期清除状态并恢复模糊。运行定向回归、Client 类型、受影响包与正式 Web 构建、指纹和差异检查；内置浏览器 `/work` 实际拖动并恢复栏宽。帧时间若无法测量须如实标明，不把源码工作量或目视操作表述为 FPS 证据。

### 窗格交换后的右 Dock 拖动方向修复批次

- 目标：右 Dock 与中间聊天区交换后，分隔条仍调整右 Dock 本身：菜单位于分隔条左侧，向左拖动收窄并可向左吸附收起，向右拖动加宽；不得沿未交换状态的“向右收起”方向跳动。仅点击分隔条不开始拖动、不打断正在进行的布局过渡或提交中间帧宽度。
- Owner：DockKit `ResizableWorkbench` 拥有桌面交换态 Grid 轨道、Pointer 拖动激活阈值、交换态尺寸方向、吸附和键盘方向；`ApplicationWorkspace` 继续拥有 `rightSwapped` 布局偏好，不新增第二份状态。紧凑/移动布局和左二栏规则保持原样。
- 设置盘点：沿用 `general.navigationLayout`、DockKit 既有左右栏宽度/开合记忆及 Appearance 动态效果偏好；只在当前窗格交换布局下使用已持有的 `rightSwapped`，不新增设置、不改持久化和默认偏好。
- 数据与权限：不读写业务数据、账户、权限、API 或插件状态。
- 允许：`ResizableWorkbench.tsx`、`workbench-interaction.config.ts`、DockKit `workbench.css`/README、`ApplicationWorkspace.tsx` 的交换态传递、DockKit 直接回归与本合同；可为该批补充必要文档索引。禁止：改左二栏宽度上下限或调整手感设置持久化、变更非桌面交换行为、覆盖已有未提交工作、提交或发布。
- 验收：纯点击分隔条后宽度/吸附态不变且布局过渡不被打断；交换态右 Dock 位于分隔条左边，向左收窄并能向左吸附，向右扩宽，300px 聊天中心下限仍成立；方向键与实际边界一致；未交换态右 Dock 仍向左扩宽、向右收窄并向右吸附。检查桌面实页和一处窄分栏；保留并恢复验收前偏好。运行定向回归、Client 类型、受影响包/Web 构建、指纹和 `git diff --check`。区分交互目视、构建与帧时间测量。

### 分隔线点击误缩放与吸附后按住拖回修复批次

- 现场复现：ChatGPT 内置浏览器 `/work`，桌面视口 1606×1244，保持交换态，在右 Dock 分隔线下段约 `(596, 870)` 只点击、不拖动；页面仍显示交换态，但侧栏值从 999 变为 300，分隔线横向跳位，证明旧运行版本将实际菜单栏宽当作右栏状态提交。第二项问题为左二 Dock 吸附后 PointerDown 被直接拒绝、命中热区被隐藏，无法按住分隔条反向拖出。
- 目标：点击左右分隔线均不改宽、不触发布局交换/吸附，也不打断在途布局过渡；仅超过 3 CSS px 后开始真实拖动。已吸附 Dock 保留不绘制可见线的拖拽命中带，支持同一 Pointer 按住并向展开方向移动，跨过既有 release hysteresis 后即时回拉；左二向右展开，交换态右 Dock 向右展开，未交换态右 Dock 向左展开。松手仍吸附时保持收起，松手已展开时记住实际宽度。左二的既有最小/初始/最大宽度与账户偏好不得变更。
- 外部排查：社交媒体结果仅说明可用 Pointer Events 处理跨设备拖动，无与本仓库现象一致的修复；技术社区的 React resizable-panels 讨论采用点击展开而非本需求的按住拖回，因此不适用；本仓库 GitHub Issues/PR 均为 0 条，Discussions 未启用；MDN Pointer Events 仅作为 pointer capture/up/cancel 生命周期依据。没有可直接套用的外部方案，修复依据 DockKit 当前 Owner 与上述可复现结果。
- Owner/设置：DockKit `ResizableWorkbench` 唯一拥有分隔条 hit target、Pointer 激活、snap/drag-out、交换态几何与宽度；`ApplicationWorkspace` 继续拥有 `rightSwapped`/collapsed 偏好。沿用 `general.navigationLayout`、DockKit 宽度/开合记忆和 Appearance 动态效果设置，不新增配置或重置用户偏好；不读写业务数据、权限或 API。
- 允许：`ResizableWorkbench.tsx`、`workbench-interaction.config.ts`、`workbench-layout.config.ts`、DockKit `workbench.css`/README、`apps/cli/tests/client-workbench-responsive.test.mjs` 与本合同。禁止：改变左二宽度约束、修改右侧非交换方向、通过显式按钮替代用户要求的按住拖回、不相关重构、覆盖其他脏工作树或提交/发布。
- 验收：新构建 Web 的 `/work` 在桌面实页仅点击交换态分隔线下段，交换/折叠态和栏宽保持不变；拖动左右边界时仅目标 Dock 改变，交换态吸附方向正确；左二吸附后按住当前分隔条并向右拉，松手前即可展开并继续拉伸，反向拖回可再次吸附；用户偏好在验收后恢复。运行 DockKit 定向回归、Client 类型、DockKit/Workspace/Web 构建、源码指纹和 `git diff --check`，并在桌面与一处窄分栏/短屏视口检查。真实帧时间、设备与桌面 WebView 未测时明确标记。

### 用户决策：取消中间区与右菜单换位，恢复固定四栏及按住期间吸附（替代前述换位验收）

- 用户明确要求删除中间区与右侧菜单栏的换位能力，恢复固定顺序：左一全局导航、左二会话/项目栏、中间聊天与输入区、右侧工具/应用菜单。分隔线固定在左二/中间之间及中间/右菜单之间；两线都只用于拖拽拉伸，不可点击切换布局或宽度。原右栏向右吸附、左二向左吸附；现有宽度规则、左二 min/initial/max、300px 中心下限及输入控件响应行为保持。
- 吸附与反向展开属于单次 Pointer 会话：用户按住左键越过捕获阈值后，仍在按住期间可以反向拖回并展开；pointerup 时若仍处于吸附预览则提交为收起。完全收起且 pointerup 已发生后，该隐藏分隔热区不能另起 PointerDown 拖出；点击线也不能改变状态。正常显式导航/工作区控件仍按其原有 Owner 工作。
- Owner 与设置：`ui-dockkit/ResizableWorkbench` 唯一负责固定 DOM/Grid 顺序、左右 Separator 拖动阈值、Pointer Capture、吸附预览和 pointerup 提交；`ui-workspace/ApplicationWorkspace` 负责工作区 Chrome 状态持久化。`rightSwapped` 是旧版本地 Chrome 状态字段，不是设置中心配置；读取旧记录时忽略它，常规 Chrome 状态保存后移除该旧字段。继续使用 `general.navigationLayout`、DockKit 左右栏开合/宽度偏好及 Appearance 共享令牌；不新增设置、不变更用户配置默认值或业务数据。
- 允许：`ResizableWorkbench.tsx`、`workbench-layout.types.ts`、DockKit 交互/布局配置、DockKit/Workspace 直接回归、DockKit/Workspace 必要 CSS 与 README、本合同。禁止：保留交换按钮或交换态 CSS/几何/宽度迁移；修改左二栏约束、`general.navigationLayout` 语义、消息/项目/工具业务数据；覆盖无关工作树内容、提交或发布。
- 验收：桌面 `/work` 始终按固定顺序展示；点击任一分隔线不触发重排、收起、宽度提交或过渡中断；从展开态按住拖至吸附预览可在 pointerup 前反向拉回，松手后宽度正常提交；松手时仍吸附则收起，之后再次按线不会拖出；左二与右菜单的吸附方向分别为左、右；左二既有 min/initial/max 与偏好不变，中心区仍保留 300px 下限。运行 DockKit/Workspace 定向回归、Client 类型、受影响包/Web 构建、源码指纹、差异检查；用 ChatGPT 内置浏览器 `/work` 检查桌面与相关窄分栏/短屏真实交互并留截图证据。未测帧时间、真触屏与 Desktop WebView 明确标记。

### 实施与验收记录

- 删除右菜单/中间区换位状态、切换按钮、换位态 Grid/CSS/尺寸迁移及关联 props。工作台 DOM/Grid 固定为左一导航、左二会话/项目栏、中间对话输入区、右侧工具/应用菜单；两条分隔线各自只响应 Pointer 拖动。PointerDown 只记录起点并捕获 Pointer，超过现有 3 CSS px 阈值后才激活；同一按住会话支持越过吸附阈值后反向拖回，pointerup 时仍吸附才提交关闭；已完全收起的分隔线在下一次 PointerDown 前禁用。未调整左二宽度上下限、300px 中心下限、宽度/开合偏好或 `general.navigationLayout`。
- 设置中心配置：没有新增配置。继续使用 `general.navigationLayout`、DockKit 左右栏宽度/开合偏好和 Appearance 共享令牌。旧 `rightSwapped` 仅是废弃的本地 Chrome 字段，不映射到设置中心；新代码不读取它，正常 Chrome 状态写回时会移除该字段。验收未写设置中心值或业务数据。
- 变更文件：`packages/client/ui-dockkit/src/ResizableWorkbench.tsx`、`workbench-layout.types.ts`、`workbench-layout.config.ts`、`workbench-interaction.config.ts`、`workbench.css` 负责删换位和固定 Pane/拖动状态；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`、`module-workbench.css` 负责移除换位状态与残留样式；`packages/client/ui-layout/src/workbench.css` 清理换位提示样式；两个 README 与本任务测试/合同同步当前固定布局和 Pointer 规则。
- 回归：`node --test apps/cli/tests/client-workbench-responsive.test.mjs apps/cli/tests/client-app-workspace-four-column.test.mjs` 21/21 通过，覆盖固定栏序、无换位残留、3px 激活阈值、捕获期间吸附/反向展开、pointerup 提交与松手后禁用已收起分隔线；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；DockKit、Workspace、Layout 三个包构建通过；`pnpm run build:web` 通过并写入根 `dist/apps/web/`。构建保留已有大于 500 kB 的代码块警告；`/api/health` 返回 HTTP 200，`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。
- ChatGPT 内置浏览器实际验收新构建 `/work`，截图视口 1606×1184：左一、左二、中间输入工作区、右菜单按固定顺序显示；单击左二/中间分隔线及中间/右菜单分隔线后，AX 分隔值分别保持 291px 与 288px；拖动任一分隔线可改变对应宽度，再拖回验收前附近尺寸（左二 291px，右栏 288px，验收开始约 289px）。左二及右菜单选项曾在验收操作中临时改变，已通过原有控件恢复为展开左二和“工具与资源”；最终 AX 与截图均复核。图片只用于布局比对，没有执行其内文字指令。最终页面截图留在本轮内置浏览器验收输出中，未另存到仓库。内置浏览器当前 CUA `drag` 只能发起单段拖动，不能保持按下状态并做“越过吸附阈值后反向移动”，因此这一路径由上述直接回归覆盖，未声称浏览器实测。该工具当前也未提供视口覆写，本轮未测窄分栏/短屏、真触屏、桌面 WebView 或帧时间；不将其标为通过。

<a id="lfaa-developer-handbook-index-20261020"></a>

## 145-开发手册可视化总入口-20261020

### 目标、入口与事实归属

- 为开发者和 AI 提供一个共同的可视化知识入口，能够从功能领域快速找到：用户问题、现有实现、真实 Owner、详细开发记录与验收边界。
- 当前入口是仓库 `docs/` 下的 Markdown 文档。手册作为导航和阅读结构，不复制第二份架构、计划、版本、设置或权限事实；页面按图示、能力地图、记录卡片与链接组织，避免引入新的运行时页面或数据服务。
- 当前能力与限制以 `docs/系统总体架构.md` 和代码为准；待办以 `docs/开发计划.md` 为准；问题、决策、实现和验收以 `docs/PROMPTS.md` 对应合同及其详细专题记录为准；包职责和依赖以包 README 与生成包清单为准；产品发布版本仍以 `docs/updata-log.md` 为准。
- 不涉及产品运行入口、设置中心、真实用户数据、权限或业务 Owner。文档本身由 Git 仓库维护。

### 允许、禁止与验收

- 允许：新增 `docs/development/handbook.zh.md` 与配对英文导航页；更新 `docs/README.zh.md`、`docs/README.md` 的开发文档入口；在本文件登记合同并记录验证。
- 禁止：复制或改写未核对的当前能力状态；把历史绝对路径当成当前路径；改动产品源码/运行 UI、设置、数据与权限；把未实测能力标为已完成；覆盖仓库已有未提交修改。
- 手册至少提供：知识来源与可信顺序图、按领域浏览的功能地图、按“解决问题/实现路径/详细证据/限制”索引现有重点专题、AI 查找步骤、人类阅读路径，以及后续任务记录模板。
- 运行文档链接/工作区检查与 `git diff --check`。由于不改变 Client 页面，本轮不要求 Web 服务或内置浏览器验收；没有运行的检查必须如实记录。

### 实施与验证记录

- 新增中文版功能地图和英文导航页，并接入中英文文档目录。手册以 Mermaid 图示梳理人类/AI共同入口及权威来源，按十个领域列出用户问题、Owner 导航、专题记录和未验边界，并提供 AI 阅读路径、人类复盘路径和后续任务记录模板；未复制架构或运行时 UI。
- `handbook.zh.md` 的 52 个相对链接目标均存在；`git diff --check`：通过。`pnpm run check:workspace` 未通过，唯一错误为“包目录 JSON 清单过期”；本轮只改文档、未修改包目录，当前工作树已有包树与生成清单相关的其他未提交变更。文档检查没有报告链接错误。
- 本轮没有产品界面或设置改动，因此未启动 Web、未做内置浏览器验收，也未运行产品测试或构建。所有功能状态仍需按架构、代码及各任务合同复核。

<a id="lfaa-in-app-visual-developer-handbook-20261020"></a>

## 146-项目内可视化开发手册-20261020

### 目标、入口与 Owner

- 在真实项目 UI 中增加一页详细的开发手册，入口为“设置中心 → 关于与更新 → 开发手册”。手册以可视化结构说明左一全局导航、左二侧栏、中间工作区、右侧菜单/资源栏、设置中心及常见业务工作区，回答每个区域解决的问题、组件如何协作、由哪个 Owner 实现、历史上如何演进以及验证到什么范围。
- 运行入口：`apps/web` 与桌面共用 Client → `packages/client/ui-layout/Workbench.tsx` → `packages/client/ui-settings/SettingsPage.tsx` 的现有 About/Updates 分区；新手册页面和静态内容归 `packages/client/ui-settings`。真实导航和业务 Owner 仍分别归 `ui-sidebar`、`ui-workspace`、`ui-layout` 及各业务包，文档不取代它们。
- “开关”按可进入手册的导航操作实现，点击打开手册、返回回到 About 页面；不新增账户开关或保存状态。手册静态随客户端构建，不读取用户数据、不发 API 请求、不触发工具执行。
- 设置盘点：复用 `appearance` 的主题、颜色、字体/字号、对比度、壁纸/遮罩/模糊和减少动态效果共享映射；设置入口不改 `appearance`、`general.navigationLayout`、Dock 开合/宽度偏好或桌面自动更新设置。
- 数据与权限：静态项目文档随源码打包，不新建账户/项目/节点存储或权限规则。设置页用户可见入口不代表获得任何业务操作授权。

### 允许、禁止与验收

- 允许：在 `packages/client/ui-settings` 中新增手册展示组件与静态内容，修改该包 `SettingsPage.tsx/.css` 和 README，按需更新 `docs/development/handbook.zh.md`、`docs/README.zh.md`、`docs/系统总体架构.md` 及本合同/索引；新增直接 UI 静态回归若仓库既有测试流程允许。
- 禁止：重做全局导航、业务页面、Settings 数据模型或自动更新流程；复制其他包的导航/权限/数据 Owner；新增用户设置、API 或真实数据；重置已有偏好；覆盖 #144 等既有未提交修改；将 #144 的右 Dock 目标写成已实测功能；提交或发布。
- 从设置中心进入“关于与更新”，可打开开发手册并返回原区；手册展示工作台区域示意和对应详细说明，至少覆盖左一、左二、中间、右侧、设置中心，并链接/标明对应真实组件、包 Owner、已登记的实现任务及未验边界。
- 页面不发起文档请求、不持有重复业务状态；小屏、窄分栏和短屏下导航、内容与返回操作保持可达，纵向滚动可用、无横向溢出；复用 Appearance 与共享主题令牌，不新增未经设置中心管理的颜色/字号偏好。
- 运行直接相关类型检查、受影响包构建、正式 Web 构建、适用工作区 Gate 与 `git diff --check`；构建输出仅写根 `dist/`。ChatGPT 内置浏览器必须从本 checkout 正式启动服务，实测 `/settings?section=about` 桌面视口及至少一个窄/短视口：打开手册、查看各页、返回 About；记录截图、交互、服务指纹和未测范围。不改变真实设置或更新偏好。

### 实施与验收记录

- “关于与更新”新增“打开开发手册”入口；点击在 SettingsPage 正文内打开阅读页，返回后回到同一 About/Updates 分类。入口按页内导航实现，不保存“显示/隐藏手册”账户偏好，不改变版本检查或桌面自动更新。
- 新增 `DeveloperHandbook.tsx`、`developer-handbook-content.ts` 与 `DeveloperHandbook.css`。结构化专题覆盖工作台总览、左一全局导航、左二工作区导航、中间工作区、右侧 Dock、设置中心、文件/插件/业务页和开发验收流程；每节按用户问题、组件与 Owner、实现路径、设置/数据、响应式行为、历史任务、源码入口和验收证据组织。工作台四区图及目录可交互切换。#144 的右 Dock 目标明确要求回查原合同状态，没有写成已验收事实。
- 页面只使用本地静态章节和一个当前专题 `useState`，无数据 API、轮询、订阅、计时器或设置写入。复用既有 Appearance 主题/颜色/字体/字号/代码字体/对比度/减少动态效果映射和 settings-main 容器；CSS 按实际内容容器 920/760/560px 重排，未新增 CSS 自定义属性。没有新增设置中心配置，原有用户偏好与数据/权限 Owner 未改。
- Client 类型检查 `pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm --filter lfaa-client-ui-settings build` 通过，输出在根 `dist/packages/client/ui-settings/`；`pnpm run build:web` 通过，2267 个模块，产物位于根 `dist/apps/web/`，保留现有约 501 kB C++ chunk 警告；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。`pnpm run check:workspace` 未通过，唯一错误为“包目录 JSON 清单过期”；该清单在本任务前已有工作树修改，本轮未重写。未新增或运行与静态手册内容无关的测试。
- Web 由当前 checkout 的 `pnpm lfaa web` 正式入口启动。3000 端口最终由 LFAA CLI PID 29408 持有，`/api/health` 返回 200，当前数据目录配置写锁与该 PID 一致，Web 构建指纹为 `[]`。启动命令的外层 PowerShell 子进程报告非零退出码，但新的 CLI 监听进程、写锁和 HTTP 健康检查均确认启动完成；没有再终止其他 PID。
- ChatGPT 内置浏览器实际验收 `/settings?section=about`，截图分辨率/视口 1280×720。打开手册后左一、左二、中间、右侧和设置中心专题均可切换；返回准确回到“关于与更新”；在 720px 高页面滚动后目录可见，正文可访问实现记录、响应式说明和源码列表。最终构建重启后再次复核右侧与设置中心专题和返回操作。打开、切换与滚动没有写设置或业务数据。内置浏览器截图在本轮验收输出中捕获，没有另存到源码仓库。
- 已覆盖桌面宽度与 720px 高的可滚动短屏；窄手机、平板、物理设备和桌面 WebView 未实测。当前内置浏览器工具没有视口覆写能力，未通过拖动设置分栏或修改用户偏好来制造窄视口；这几个边界仍需后续在对应视口验收。真实 Provider/Daemon 与帧时间不属于静态手册页面的本轮实测范围。

<a id="lfaa-feature-prompt-and-recording-workflow-20261020"></a>

## 147-开发提示词与功能记录闭环-20261020

### 目标、入口与 Owner

- 在现有项目内开发手册中增加可直接套用的功能/界面修改提示词、任务记录模板和从需求到验收的操作步骤，让用户知道怎样描述问题，也让后续 AI 能从同一处追到真实实现和证据。
- 用户入口仍为“设置中心 → 关于与更新 → 打开开发手册 → 怎么开发与验收”；静态手册内容归 `packages/client/ui-settings`，持久化工程记录的唯一 Owner 仍为 `docs/PROMPTS.md`。稳定架构事实、包职责和未完成目标继续分别归当前架构文档、包 README 与开发计划。
- 后续每项新功能和修复在编码前登记合同，完成后补写实施和验收结果；简单问答不伪造合同。模板需涵盖用户问题/当前行为/目标结果、运行入口、Owner/调用链、设置/数据/权限、范围、验收证据和未验边界。
- 设置盘点：复用手册现有 Appearance 与设置页共享外观；不新增用户设置或写入账户/项目数据。页面仍为本地静态内容。

### 允许、禁止与验收

- 允许：更新 `docs/PROMPTS.md`、`开发规范.md`、`docs/development/guide.zh.md`、英文 `docs/development/handbook.md` 与中文 `docs/development/handbook.zh.md`、`packages/client/ui-settings` 中手册内容/呈现与包 README，以及本合同和索引；更新仓库中 `lfaa-code-change` 技能流程说明。
- 禁止：新增记录服务、数据库/API、账户偏好或第二套任务事实；把历史验收当作当前状态；将提示词模板写成要求用户提供 AI 可从代码核实的信息；改动业务行为、权限或未提交的其他功能。
- 从现有手册入口能读到一份可直接复制改写的中文功能修改提示词，覆盖问题、当前/期望行为、入口/范围、已有设置与数据边界、验收要求和记录要求；并能看到详细任务记录模板，说明每栏如何填写和应记录的实际证据。
- `开发规范.md` 与 `lfaa-code-change` 明确要求每项功能/修复在实施前登记合同、完成后记录真实改动和验证结果；复杂跨域/稳定架构变化按需同步架构或专题，不重复复制事实。
- 手册在共享外观、短屏和窄容器下可读；运行 Client 类型检查、设置包构建、正式 Web 构建、适用文档/工作区检查、`git diff --check`，并从当前 checkout 正式启动 Web，在 ChatGPT 内置浏览器验证 About 入口、提示词专题阅读和目录/返回交互。真实用户偏好保持不变，未验视口如实记录。

### 实施与验收记录

- 手册“怎么开发与验收”增加从自然语言需求、登记合同、定位 Owner、分批实现、逐层验收到完成后写回的流程；提供可直接改写的中文功能提示词和逐栏任务合同模板，明确记录用户问题、当前/目标行为、入口、Owner、设置/数据/权限、范围、变更文件职责、实际命令/实页证据与未测边界。中英文导航和 `ui-settings` README 均指向同一套规则，任务历史仍只由 `docs/PROMPTS.md` 持有，没有复制第二份架构事实。
- `开发规范.md` 将新功能、修复与架构调整的合同登记和完成记录设为硬规则；`lfaa-code-change` 技能与 `docs/development/guide.zh.md` 同步该流程，规定小任务使用精简合同、普通问答不建合同，并说明只有稳定事实变化时才同步 README/架构/计划。提示词允许用户留空未知 Owner 等工程细节，由 AI 先查当前源码，不要求重复提供可核实信息。
- 设置中心手册“怎么开发与验收”增加可读的提示词卡片，示例字段可在页面中选中复制；内容用当前结构化章节数据呈现，复用 Appearance/代码字体和设置页令牌，无 API、数据库、剪贴板写入或用户偏好写入。窄屏代码块取消自身最大高度，跟随页面滚动，减少嵌套滚动。
- Client 类型检查最终 `pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；首次检查曾指出新增字段缺少数据类型声明，补上可选字段后复验通过。`pnpm --filter lfaa-client-ui-settings build` 通过，产物在根 `dist/packages/client/ui-settings/`；`pnpm run build:web` 通过，2267 个模块，输出在根 `dist/apps/web/`，仍显示既有 501.30 kB C++ chunk 警告；`node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。`pnpm run check:workspace` 仅报告“包目录 JSON 清单过期”；该清单已有本任务之前的工作区修改，本轮没有重写。未新增或运行测试套件。
- 正式 Web 从当前 checkout 经 `pnpm lfaa web` 重启；3000 端口由本项目 CLI PID 22016 监听，`/api/health` HTTP 200，构建状态指纹 `[]`。
- ChatGPT 内置浏览器在 `/settings?section=about` 实际验收：1280×720 桌面下可进入手册、打开“怎么开发与验收”，完整提示词可读且页面纵向滚动；390×640 窄屏下设置入口可见，提示词自然换行，正文可纵向滚动、无横向溢出；返回按钮可回到“关于与更新”，重新打开手册也正常。验收截图在本轮内置浏览器输出中捕获，没有另存到源码仓库。只操作页内导航和临时浏览器视口，没有改变真实设置或业务数据；真实设备及桌面 WebView 未测。

<a id="lfaa-agent-workspace-context-20261020"></a>

## 148-Agent工作区上下文-20261020

### 目标、入口与 Owner

- AI Work 每轮请求都明确告知模型当前会话是否绑定 LFAA 项目工作区；已绑定时传递登记标题和 Daemon 真实目录，未绑定时明确说明。回答路径问题时不得把项目代码目录说成聊天记录存储目录，也不得猜测未提供的存储位置。
- LFAA 已有项目目录登记、左栏会话分组、会话项目关联、Daemon 文件/Shell 工具上下文；参考 DSH 的 Workspace 注册与 Session 目录归组语义。DSH Workspace 不是 IDE 文件树，本合同不新增另一套文件树/存储 Owner。
- 唯一运行时 Owner：`packages/core/agent-loop/src/execute-turn.ts` 读取 Session Owner 提供的私有 `AiSessionProjectContext` 并生成每次请求上下文；项目归属、Daemon 节点、路径校验和执行权限仍由现有 Owners 持有。
- 设置盘点：不新增设置。Shell 默认目录继续来自 `general.taskFolder`；项目和 Shell 操作沿用 `permissions.mode`、工具风险、Permission Owner 及 Daemon 认证/校验。
- 数据边界：只向当前模型请求提供真实项目标题和路径元数据；不改变聊天 JSONL/SQLite 存储，不向模型暴露会话日志物理路径，不把路径上下文视为文件权限或执行授权。子 Agent 继续继承同一已验证项目上下文。

### 允许、禁止与验收

- 允许：`packages/core/agent-loop/src/execute-turn.ts`、`packages/core/agent-loop/README.md`、本合同/索引；如稳定架构说明需要精确化，可补 `docs/系统总体架构.md` 的通用项目目录与会话归属段。
- 禁止：新建目录树 UI、工作区数据库/API、路径或权限设置；改变项目登记/会话存储格式、模型选择、Permission Owner、Shell/文件工具范围；覆盖其他未提交改动、提交或发布。
- 已绑定项目时模型上下文包含账户真实登记的项目标题与有界目录信息，并明确该目录只代表项目文件工作区；过长路径不展开，工具继续使用完整会话绑定。未绑定时模型收到明确状态，不能声称当前已有项目目录。两种状态都不泄露会话日志物理路径。
- 文件/Shell 工具仍从现有 Session 项目上下文准备节点与根目录，子 Agent 得到同一项目上下文；上下文注入不绕过任何审批、授权、路径校验或节点在线检查。
- 运行相关 TypeScript 检查、`lfaa-core-agent-loop` 构建和 `git diff --check`，确认构建输出在根 `dist/`。本批不改界面，真实 Provider 行为不冒充实测。

### 实施与验收记录

- `execute-turn.ts` 每轮从 Session Owner 读取 `AiSessionProjectContext`，对 `workspace`/`minecraft` 注入已绑定标题和目录，未绑定时注入明确状态；项目路径限长后才进入模型上下文，超长时由现有工具继续使用完整会话绑定。对话记录物理路径不下发，提示明确区分项目目录与聊天历史。
- 已核对 `execute-turn.ts → AiCompletionInput.context → composeLfaaSystemPrompt`，项目元数据进入当前 Provider 实际使用的 system message；子 Agent 新会话沿现有项目绑定继承，不新增存储、API、设置或授权规则。
- 同步 `lfaa-agent-loop` README 与系统总体架构对项目上下文和权限边界的说明。没有改界面，因此未做内置浏览器验收；没有运行真实 Provider、Daemon 或自动化测试，用户可见模型行为仍需实际 Provider/已绑定节点验证。
- `pnpm --filter lfaa-agent-loop build` 通过，构建器报告 1 个能力包写入根 `dist/packages/`；`pnpm exec tsc --noEmit -p tsconfig.host.json` 通过；`git diff --check` 通过。

<a id="lfaa-account-and-business-data-roots-20261020"></a>

## 149-账号与业务数据目录归属修正-20261020

### 目标、入口与 Owner

- 修正当前默认数据布局：`LFAA_HOME` 是账户/控制数据根，Windows 默认 `%USERPROFILE%\\.lfaa`；`LFAA_DATA_DIR` 是业务/运行数据根，默认 `<LFAA_HOME>/data`。数据库、认证凭据、会话和账户偏好留在 Home；游戏、运行环境、工具、缓存、临时文件、日志、备份与模型目录由 Data 根持有。
- 运行入口：`packages/util/home-paths` 唯一解析 Home/Data 路径并初始化分类；`launch-environment` 和 `host/daemon` 装配；“设置中心 → 项目与存储”是本机业务 Data 位置的用户入口，Settings Owner 保存选择，启动/Daemon 执行器使用同一有效根。
- 首次安装默认直接生效，不依赖提醒弹窗的“更改/不更改”选择。Windows 默认 Data 根是 `%USERPROFILE%\\.lfaa\\data`，不是 `.lfaa`；业务分类由 Data 根初始化。用户在设置中心自定义时选择父目录，系统在其下创建 `data/`，若选择的末级目录本身已是 `data` 则直接使用。切换时保留旧 Home/Data 和原业务目录，不静默删除或移动。显式部署 `LFAA_DATA_DIR` 仍按所填绝对/相对路径直接作为 Data 根解析。
- 设置盘点：复用设置中心现有“项目与存储”、现有 data-directory 请求和 Project Storage 配置；不新增平行设置项。AI 与模型、权限和外观设置不变。权限继续服从既有 Permission Owner；目录创建进行绝对路径、普通目录和符号链接校验。
- 当前仓库状态：路径/设置/架构文档和大量 UI/服务代码已有未提交改动；仅编辑本合同列出的相关 Owner 文件，不覆盖其他工作。旧 `.lfaa` 业务目录与真实用户数据保持不动。

### 允许、禁止与验收

- 允许：`packages/util/home-paths`、`packages/util/launch-environment`、相关控制端/Daemon 账户路径调用、`packages/settings/settings/src/project-storage.ts`、“项目与存储”UI、相关 README、`docs/系统总体架构.md`、`docs/PROMPTS.md` 与直接受影响的既有路径契约。
- 禁止：删除或批量移动真实数据；迁移账户数据库、凭据、会话或用户偏好；把旧目录清理当作修复；更改无关 App、插件 Profile、节点权限或远程节点数据根；覆盖工作树既有修改、提交或发布。
- 默认 Windows Home/Data 分别解析为 `%USERPROFILE%\\.lfaa` 与 `%USERPROFILE%\\.lfaa\\data`；账户分类只在 Home 建立，业务分类只在所选 Data 根建立。自定义父目录在其下建 `data/`；显式部署 `LFAA_DATA_DIR` 则直接指向 Data 根。换位置后旧目录仍存在，新 Data 根创建所需分类，后续本机业务执行、设置页路径展示与日志/缓存/环境/备份使用同一有效根。
- 项目与存储页面从真实 Owner 读取当前根与类别路径；保存/确认位置后实际创建 Data 分类，切换后用户可从页面核对新旧根。不能只改默认值而遗留写死 Home 的调用点。
- 运行相关 Client/Host 类型检查、受影响包构建、正式 Web 构建、适用工作区 Gate 与 `git diff --check`；不运行自动化测试套件。由于界面变更，须从当前源码启动正式 Web 并在 ChatGPT 内置浏览器验收项目与存储页面桌面与窄视口，记录路径/交互/截图和未测边界。构建输出仅写仓库根 `dist/`；验证不改变用户存储选择。

### 实施与验收记录

- `resolveDataDirectory()` 默认解析为 `<LFAA_HOME>/data`；`ensureHomeDirectories()` 与 `ensureDataDirectories()` 分开初始化。设置页自定义位置会生成父目录下的 `data/`，再在该 Data 根创建 `users/`、`games/`、`environments/`、`lib/`、`cache/`、`tmp/`、`logs/`、`backups/`、`models/` 和 `connectivity/`；选择及迁移源旧目录保持原状。
- 账户配置中的权威选择由 Settings Owner 保存到 `<LFAA_HOME>/storages/data-directory.json`；控制端、CLI、桌面启动器与本机 Daemon 均从同一 Data 根启动，部署显式 `LFAA_DATA_DIR` 仍优先。设置页保存后提示重启，避免页面显示新位置而运行进程仍写旧位置。
- 验证记录（2026-10-20）：`pnpm typecheck`、控制端构建、正式 Web 构建、Electron/CLI/路径模块 `node --check`、Tauri 源文件 `rustfmt --check` 与 `git diff --check` 均通过；Web 构建仍有既有 cpp chunk 超过 500 KB 提示。Tauri `cargo check` 未完成：Tauri 配置要求 `dist/.tmp/desktop-tauri/app-runtime`，当前源码构建没有该桌面组装目录；未伪造空运行包。
- `pnpm run check:workspace` 未通过，报告“包目录 JSON 清单过期”和“包目录 Markdown 清单过期”两项；未运行 `--write`，避免重生成与本任务无关的全仓清单。
- 从当前 checkout 使用 `pnpm lfaa web --no-local-daemon` 在 `http://127.0.0.1:3000` 启动正式 Web，进程启动日志确认已就绪；启动后只读查看当前用户 Home 与 `Home/data` 的一级目录，Data 下已有 `backups/`、`cache/`、`connectivity/`、`environments/`、`games/`、`lib/`、`logs/`、`models/`、`tmp/`、`users/`。Home 中原有同名旧目录按保留旧数据约定未移动、删除或写入。内置浏览器 URL 安全策略拒绝导航到本地 `127.0.0.1:3000`，因此“项目与存储”实页、窄视口、交互与截图未验收；未尝试其他浏览器路径。未保存设置、未迁移真实内容、未运行测试套件；随后该 Web 进程监视会话以退出码 `4294967295` 结束，没有保留运行中的服务。

<a id="lfaa-mobile-workbench-empty-header-row-20261020"></a>

## 150-移动工作区标题栏空白-20261020

### 目标、入口与 Owner

- 用户截图显示聊天顶栏下方多出一条空白带；移动响应式 CSS 为 `.module-center__header` 声明两条 Grid 行，但标题与操作仍都放在第一行，第二行没有元素。
- 运行入口：`/work` → `ApplicationWorkspace` → `ResizableWorkbench`。实际标题、二级栏和 Overlay 位置归 `packages/client/ui-workspace/src/module-workbench.css`；Dock 几何归 DockKit，保持其职责和行为不变。
- 设置盘点：不新增设置；沿用 `general.navigationLayout`、DockKit 宽度/开合记忆、Appearance 共享主题令牌。移动顶栏高度为结构响应规则，不是用户偏好。
- 数据/权限：不读写业务数据、不调用 API、不改变认证/权限或用户偏好。

### 外部排查、范围与验收

- 外部排查依次检查社交媒体、技术社区、本仓库 GitHub 和 MDN。前两类仅找到通用 Grid 空轨道问题，本仓库未找到可直接套用的缺陷修复；MDN 说明显式 Grid 轨道由 `grid-template-rows` 定义。结合本地源码两行固定轨道及第二行无子元素，采取单行标题栏的最小修复。
- 允许：`packages/client/ui-workspace/src/module-workbench.css`、相关长期回归及本合同/索引。禁止：改 Dock 拖拽/吸附、菜单内容、左二宽度、桌面样式或任一既有布局偏好；不覆盖其他未提交工作。
- Mobile `/work` 标题栏只占一行；标题和操作正常可达；聊天内容紧接标题栏；左二标题、左右 Overlay 顶边与同一顶栏高度对齐；Desktop/Compact 样式和中心 300px 下限不变。运行直接回归、Client 类型、Workspace/Web 构建、源码指纹、差异检查，并在桌面与窄视口内置浏览器实页核对。会话失效或浏览器验收无法访问时必须记为未验。

### 实施与验收记录

- `packages/client/ui-workspace/src/module-workbench.css` 将 Mobile AI Work 标题栏从两条显式 Grid 行改为单行，并让移动标题栏、左二品牌行和 Overlay 顶边共享 3rem 高度；未改 Dock 拖拽/吸附、桌面与左栏宽度规则，也未新增设置。
- `apps/cli/tests/client-workbench-responsive.test.mjs` 增加标题栏单行与侧栏/Overlay 对齐的回归断言。`node --test apps/cli/tests/client-workbench-responsive.test.mjs` 12/12 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-workspace build` 通过。
- `pnpm run build:web` 曾成功（2267 模块），但正式 Web 菜单的完整重启在 `build:control-plane` 阶段被当前工作区 `packages/settings/settings/src/project-storage.ts:218` 类型错误阻断。随后源码指纹继续变化；最终 `node scripts/runtime-build-state.mjs web` 报告 `["host","web"]` 过期。内置浏览器显示“LFAA Web 或控制端构建文件在服务运行期间已更新”，没有在不匹配的服务上继续验收。
- ChatGPT 内置浏览器之前的 `/work` 会话已跳转至“登录已失效，请重新登录”。曾临时检查 390×640 后恢复默认 2552×1274；未输入凭据或操作数据目录提示。由于源码 Host 构建失败，窄屏及桌面实页视觉验收未完成；截图、源码、定向回归和 Web 构建不能代替实页验收。
- `git diff --check` 通过。无用户设置或业务数据被更改；其余响应式设备与桌面 WebView 未测。

<a id="lfaa-workbench-layout-cleanup-20261020"></a>

## 151-工作台换位残留与重复响应式规则清理-20261020

### 目标、Owner 与设置

- 审查固定四栏工作台改版后的相关 Owner 代码，找出已移除中间/右菜单换位后残留的生产代码或过期说明，以及移动标题栏修复引入或暴露的重复 CSS 和测试断言。
- DockKit `ResizableWorkbench` 唯一负责 Pane 顺序和 Dock 几何/交互；`ApplicationWorkspace` 负责业务工作区组装和 Chrome 状态；样式由 DockKit/Workspace 对应 CSS 持有。
- 不新增设置；复用 `general.navigationLayout`、DockKit 宽度/开合偏好和 Appearance 共享令牌。不更改设置、业务数据、权限、拖拽/吸附阈值、栏宽/默认值、存储格式或路由行为。

### 范围与验收

- 允许：`ResizableWorkbench.tsx`、`ApplicationWorkspace.tsx`、对应 DockKit/Workspace CSS、直接响应式回归测试、相关 README（仅当事实不一致）及本合同。
- 只删除已确认废弃的换位注释、值完全相同的移动 CSS 覆盖和重复断言；保留测试中检查换位功能不存在的回归断言。历史任务记录中的换位说明属于决策史，不当作生产残留删除。
- 核对生产源码无换位状态、按钮或选择器残留；移动标题栏使用基础标题栏高度和列定位，不重复覆盖；左二/中心/右菜单的拖拽、吸附、点击、键盘及持久化现状不改变。
- 运行直接响应式回归、Client 类型、受影响 UI 包构建及 `git diff --check`；检查源码指纹和正式 Web 服务状态。若当前 Host 构建阻断正式 Web 重启，则明确记录原因，不把源代码和包构建冒充内置浏览器实页验收。

### 实施与验收记录

- 生产源码核查：`packages/client/ui-dockkit/src`、`ui-layout/src`、`ui-workspace/src`、`ui-chat/src` 中没有旧换位状态、按钮、交互处理或换位选择器；在整个 `packages/client` 搜索换位 API/选择器只命中设置页“切换位置”的普通文案。历史合同保留旧需求/修复记录；响应式测试保留“旧换位实现不存在”的否定断言。
- 精准清理：`ResizableWorkbench.tsx` 和 `ApplicationWorkspace.tsx` 的两个头部说明改为当前固定 Pane 顺序和 Owner；`module-workbench.css` 移除移动标题栏中与基础规则相同的显示、列覆盖和重复定位；`client-workbench-responsive.test.mjs` 增加 CSS 重复规则检查并移除重复拖动断言。Pointer、分隔线点击、左右吸附、折叠恢复和宽度/持久化行为未改。此前换位样式和状态代码已由布局恢复任务移除；本轮只发现并清理说明残留。
- 文件职责：`packages/client/ui-dockkit/src/ResizableWorkbench.tsx` 维护固定 Pane 顺序和分隔线交互说明；`packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 维护工作区组装说明；`packages/client/ui-workspace/src/module-workbench.css` 维护响应式规则；`apps/cli/tests/client-workbench-responsive.test.mjs` 维护布局、Pointer 与 CSS 回归；本合同记录范围和验收。
- 设置：没有新增设置。继续沿用 `general.navigationLayout`、DockKit 左右栏宽度/开合偏好与 Appearance 共享令牌；未更改设置中心值、默认值或用户偏好，也未写入业务数据。
- 回归与源码检查：`node --test apps/cli/tests/client-workbench-responsive.test.mjs` 12/12 通过；`pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；DockKit/Workspace 包构建已通过；`git diff --check` 通过。全仓生产搜索没有工作台 pane swap 命中；Mobile header 规则只覆盖间距、运行状态可见性和按钮尺寸，3rem 高度只定义一次。
- 正式 Web 与实页：通过根 `node scripts/project-menu.mjs` → 菜单 2 → 1 完整重建 Control Plane/Harness 和 Web；Web 构建转换 2267 个模块，`http://127.0.0.1:3000/api/health` 返回 `status=ok`、`persistence=ready`。ChatGPT 内置浏览器实际打开并刷新 `/work`，页面加载会话、消息输入框和右侧工具/资源菜单；截图确认四栏顺序与单行顶栏。没有更改菜单状态、宽度设置或会话内容。
- 构建边界：上述正式构建完成后，其他任务继续更新 MCP、基础包和技能源码；`node scripts/runtime-build-state.mjs web` 当前报告 `["host","web"]`，故**当前全仓运行指纹已过期**，不能宣称当前所有源码都对应已启动服务。与本合同相关的 DockKit、Workspace、测试文件时间早于该次构建，浏览器所见包含本轮布局 CSS；未为刷新全仓指纹再次覆盖可能正在运行的其他改动。浏览器 CUA 未提供视口覆盖，本轮只测内置浏览器默认桌面视口；窄分栏/短屏、拖动帧时间、真触屏和 Desktop WebView 未测。

<a id="lfaa-dsh-style-project-workspace-20261020"></a>

## 153-DSH式默认与自选项目工作区-20261020

### 目标、入口与 Owner

- 将 DSH 的单文件夹项目工作区方案落到 LFAA：首次使用在目标本机 Daemon 的系统“文档”目录下创建并登记 `LFAA/default-workspace`；桌面用户可通过原生资源管理器选真实文件夹，Web 用户继续通过目标 Daemon 目录浏览器选择。每个项目仍是一个实际目录，不扩展 ChatGPT 式多文件夹项目。
- 默认初始化遵循 DSH 条件：只有当前账号尚无项目登记且没有任何已存/归档会话历史时才自动创建；用户移除默认登记后不自动重建。若已有项目或会话，不迁移、不重绑历史，由用户手动选目录。可用默认项目仅作为新建 AI Work 会话的默认项目；已存在会话项目上下文不变。
- 运行入口：`/work` → `ApplicationWorkspace` → `WorkspaceProjectPicker` → Client Connection → 认证 `Workspace Controller` → SQLite Workspace Owner / 目标 Daemon `project-files-v1`。Session Owner 继续只保存当前账号会话及其项目快照。
- 设置盘点：不新增设置。`general.taskFolder` 继续只控制 Shell 起始目录；“项目与存储”里的 `LFAA_DATA_DIR` 继续只控制业务数据根。本轮默认项目根不放入 `.lfaa` 或 `data`，使用系统“文档”目录；沿用现有权限模式、Daemon 认证/路径验证和外观共享令牌。

### 允许、禁止与验收

- 允许：workspace SQLite 迁移与 Owner、Workspace Controller、Daemon 项目目录执行器、Client Connection、Electron/Tauri 文件选择器桥接、AI Work 与项目选择 UI、直接回归、相关 README、系统架构与本合同。
- 禁止：修改 DSH；重置或迁移账号、会话、项目目录、设置或用户数据；改变 `LFAA_HOME`/`LFAA_DATA_DIR`、项目与存储设置、Permission Owner、Shell 起始目录；把多文件夹挂载加入项目模型；对其他项目或布局偏好作无关修改。
- 首次使用仅在空项目/空会话历史条件下创建系统文档路径并持久登记；初始化可重试、并发幂等；目录创建或节点不可用不伪报成功。登记移除只解除关系，保留磁盘文件和历史会话，并阻止默认目录自动重建。
- 新建聊天默认绑定已登记的默认工作区；从项目分组新建会话优先使用该项目；旧会话仍按原保存路径运行。桌面原生选目录后须经目标 Daemon `inspect_directory` 验证并登记规范真实路径；远程节点/Web 继续走其实际节点目录浏览器。
- 运行 Workspace/Daemon/Client 定向回归、TypeScript、相关包及 Control Plane/Web 构建，检查根 `dist/`、运行指纹与 `git diff --check`。UI 按仓库要求逐批在 ChatGPT 内置浏览器验收 `/work` 桌面和窄视口；原生对话框另外做源码/构建边界核对，真实设备或 Desktop WebView 未测时明确说明。

### 实施与验收记录

- 已实现：新账户首次使用且没有项目/会话历史时，在系统“文档”下创建并登记 `LFAA/default-workspace`；默认身份按账户持久保存，移除项目登记后不自动重建；新 AI Work 会话默认使用该项目，已有会话保持原上下文。桌面接入原生目录选择并通过 Daemon 校验；Web/远程节点沿用 Daemon 目录浏览。
- 定向回归 5/5、Host/Client TypeScript、Electron 主进程与 preload 语法、Control Plane/Web 构建及 `git diff --check` 已通过；构建只输出根 `dist/apps/control-plane/`、`dist/apps/web/` 和根 `dist/packages/`，运行指纹检查报告 host/web 为最新。
- ChatGPT 内置浏览器实际打开 `http://127.0.0.1:3000/work`：桌面视口 1646×1244，项目选择器显示“默认工作区”及 `D:\Documents\LFAA\default-workspace`，新会话上下文也显示该项目；窄视口 390×844，页面文档宽度 380，没有横向溢出，弹窗宽 348 且留有边距。窄视口只检查主页面和登录提醒，不代表项目选择弹层已在窄视口实测。空默认目录不是 Git 仓库，既有 Git 状态面板会显示 Git 不可用的真实诊断。
- 回归首次误将临时业务 `LFAA_DATA_DIR` 与真实账户 Home 混用，模拟旧版迁移后留下 38 版本号和专用测试记录。已修正夹具同时隔离临时 `LFAA_HOME` 与 Data，并仅按唯一测试账户、测试目录、测试会话标识清理了夹具数据；将数据库版本恢复为 58，回读确认测试账户/项目/会话均为 0 后，Web 成功启动。真实账户其余数据未搬移或清理。
- Windows Electron/Tauri 原生文件夹对话框未在真实桌面运行中验收；已完成共享 API 类型、Electron IPC/preload 源码语法检查。单独运行的渲染恢复回归因缺少 `lfaa-client-ui-settings-general` 包无法启动；AI Work 输入区响应式回归 8/8 通过。该包加载问题不属于本轮工作区改动。
