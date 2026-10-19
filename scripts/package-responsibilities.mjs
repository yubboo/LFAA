/**
 * 功能：逐目录的包职责注解，供唯一工作区清单生成器消费。
 * 作用：每个实际扫描目录都须有专属注解；注解不决定目录存在、装配或可执行状态。
 * 关联文件：check-workspace.mjs、docs/harness-packages.json/md、各包 README 与公开入口。
 */
// 每行左侧为包名，右侧为专属职责；所在分组只提供路径前缀，不替代单包注解。
const annotations = {
  acp: `acp:外部 Agent Client Protocol 互操作合同与接入适配`,
  api: `account-controller:账户认证、个人资料与身份 API，调用身份 Owner
ai-video-controller:账户 AI 视频项目与生成任务的认证 API
connectivity-controller:联机目标、连接配置与节点网络操作 API
gateway:共享认证 API Gateway 与 Controller 路由承载
job-controller:节点任务查询、派发与取消的协议适配
knowledge-controller:账户知识库和 Markdown 资料来源管理 API
minecraft-controller:Minecraft 核心、实例、部署、配置和任务 API
plugin-controller:插件清单、安装和生命周期管理 API
remotes:类型化远程调用的认证传输适配
session-controller:会话、消息、Agent Run、审批和流协议 API
settings-controller:设置读取、验证和保存的认证 API
steamcmd-controller:SteamCMD 节点工具安装与校验 API
terminal-controller:目标节点交互终端认证中继与事件通道
workflow-controller:账户工作流目录、定义与运行状态 API
workspace-controller:账户项目、受管 Worktree 与文件操作 API
workspace-files:Workspace 文件协议与请求适配
writing-controller:账户作品、章节、资料、提案与导入导出 API`,
  attachment: `attachment:附件描述、引用及模型输入装配合同
attachment-local:本机附件来源读取和资源适配`,
  boot: `app-boot:Cordis 启动、Profile 装配、配置和共享生命周期
capability-installs:通用能力安装计划、来源检查和结果回读协调
capability-mcp:MCP 安装来源与配置 Owner 的适配
capability-prompt:外部 Prompt 安装、固定版本/摘要检查及账户设置适配
capability-skill:项目 Skill 来源核验、Daemon 原子安装与发现回读
cmdline:命令行参数解析和启动选择适配
config-editor:Profile/启动配置编辑适配
hmr:开发插件与源码热重载生命周期
knowledge-library:知识资料目录和按需读取的工具装配适配
plugin-manager:第三方插件来源核验、安装、装载、资源和回滚管理`,
  "browser-use": `browser-use:浏览器观察和操作的驱动服务合同`,
  bundle: `acp-app:ACP 应用的能力组合补丁
base:共享 Control Plane 基础能力的有序组合
daemon-app:目标节点身份、执行与任务领取的组合
desktop-computer-use:桌面/本机 Web 电脑操控能力组合
headless:无 UI 运行入口的可选能力组合
sdk-app:SDK 服务应用的能力组合
sdk-minimal:SDK 最小运行能力组合
web-app:Web Host、认证 API 与客户端资源组合`,
  client: `connection:认证 REST/Remote、Socket/SSE、响应合同和客户端请求协调
file-upload:客户端文件上传协议与进度交互
hmr:客户端模块开发热更新
locale:客户端语言资源与语言设置映射
modules:客户端模块/Slots 的懒加载、装卸与作用域
product-analytics:客户端产品指标上报适配与隐私边界
resources:客户端共享资源读取、缓存与撤销
shortcuts:客户端快捷键服务和登记协议
store:客户端账户、路由及偏好投影状态
ui-agent-preset:Agent 预设的选择与展示界面
ui-approval:审批请求和真实决定的界面
ui-attachment:附件选择、预览与状态界面
ui-brand-official:产品品牌视觉组件
ui-chat:AI Work 输入、消息、公开轨迹、提问和结果界面
ui-commands:键盘命令匹配和交互派发
ui-connectivity:联机 App 工作台和网络任务界面
ui-conversation:会话对话容器与消息交互组件
ui-deliverables:真实交付物与产物展示界面
ui-directory-picker-browse:通过服务浏览目录的选择界面
ui-directory-picker-native:平台原生目录选择的客户端适配
ui-dockkit:共享容器尺寸、Dock/Overlay、拖拽和面板布局
ui-goal:目标状态和操作展示
ui-input-trigger:输入触发器与快捷交互组件
ui-jobs:后台任务及节点真实进度展示
ui-layout:全局导航、工作台布局和共享设置映射
ui-message-feedback:消息反馈交互组件
ui-minecraft:Minecraft 领域界面与真实状态展示
ui-model-selection:模型目录选择和能力参数展示
ui-open-in-app:平台应用打开动作的客户端入口
ui-permission-presets:权限预设选择界面，不实现授权策略
ui-plan:计划模式和计划结果展示
ui-plugin-manager:插件安装、停用和故障管理界面
ui-primitives:跨应用可复用的基础交互组件
ui-reference:上下文引用与来源展示
ui-renderer:React 根挂载、账户路由和 Slots 容器
ui-schedule:定时任务配置与实际状态界面
ui-session:会话选择、恢复和生命周期交互
ui-settings:设置中心页面组合与共享控件
ui-settings-account:账户及 Provider 凭据配置界面
ui-settings-agent-loop:Agent 循环预算设置界面
ui-settings-general:通用偏好、任务目录和交互设置界面
ui-settings-models:模型/思考档位的共享选项和设置映射
ui-settings-plugin-inventory:已登记插件清单设置界面
ui-settings-plugins:插件及扩展来源设置界面
ui-settings-session-log:会话记录设置界面
ui-settings-shell:Shell 运行偏好设置界面
ui-settings-subagent:子 Agent 模型、数量和委派设置界面
ui-settings-web-search:网页搜索 Provider 设置界面
ui-shortcuts:账户快捷键配置控件
ui-sidebar:共享侧栏及导航树组件
ui-sidebar-browser:浏览器侧栏内容展示
ui-sidebar-documentpreview:文档预览侧栏展示
ui-sidebar-files:统一文件列表、预览、编辑与回收站界面
ui-sidebar-right:共享右侧上下文栏展示
ui-sidebar-terminal:终端侧栏展示和会话交互
ui-skill:Skill 摘要和加载状态界面
ui-slots:插件 UI 插槽渲染协议和容器
ui-subagent:子 Agent 委派任务与结果展示
ui-theme:共享主题、外观令牌、基础及响应式样式
ui-tool:工具调用合同与真实状态展示
ui-trajectory:公开执行轨迹展示，不暴露隐藏推理
ui-user-questions:用户澄清问题与答案交互
ui-workflow:工作流定义和画布界面
ui-workflow-run:工作流运行状态与节点结果界面
ui-workspace:App 工作区、项目、Git 审阅与共享任务界面
ui-writing:写作作品、章节、资料和提案界面
web:共享浏览器应用启动入口与样式装配`,
  compaction: `command-compact:显式压缩命令适配
compaction:上下文压缩服务及引擎合同
compaction-basic:基础有界摘要压缩引擎
compaction-image-offload:上下文图像留存/卸载的压缩策略
compaction-tool-result-pruner:工具结果剪裁策略，不改权威事件`,
  "computer-use": `computer-use:本机桌面观察、输入、应用发现和真实启动适配`,
  context: `agent-instructions:Agent 工程指令发现与上下文引用
file-reference:文件引用合同及解析
file-reference-local:本机文件引用来源适配
session-reference:既有会话引用与上下文适配
time-context:时间和时区上下文提供
tmux-context:tmux 会话上下文来源适配`,
  core: `agent:AI 扩展元数据与按需指令登记，Agent 类型/投影合同
agent-default-model:当前账户及子 Agent 模型解析
agent-loop:模型回合、按需能力选择、授权往返、执行结果与停止协调
agent-tool-presentation:注册工具到模型函数协议的单一映射
conversation-memory:账户对话记忆提取、校验和持久化协调
scope:能力可见范围与 Cordis 作用域合同
session:账户会话事务、事件与 JSONL 恢复门面
system-prompt:核心指令/权限/上下文组合，不按 App 注入领域全文
tools:公共工具合同、参数校验、可撤销注册与 Run 工具发现`,
  credentials: `authorization:凭据访问授权合同
credential-flows:凭据获取/连接流程适配
credentials:受保护秘密存储与访问服务
credentials-local:本机凭据存储提供方
deepseek-account:DeepSeek 账户认证来源适配
deepseek-account-platform:DeepSeek 平台账户凭据适配`,
  deliverables: `tool-present:交付物呈现工具协议
workspace-changes:工作区真实修改及产物引用收集`,
  document: `office-to-pdf:Office 文档到 PDF 的真实转换适配
tool-writing:绑定当前账户作品的写作读取/提案工具合同
writing:作品、章节、资料、修订、提案事务与本机正文存储`,
  experimental: `agent-team:实验多 Agent 团队协作运行合同
agent-team-profile:实验团队 Profile 配置
api-speech-to-text:实验语音转写 API 适配
auto-review:实验自动审查能力，不新增权限旁路
browser-use-chrome-devtools-mcp:Chrome DevTools MCP 浏览器驱动适配
browser-use-playwright-mcp:Playwright MCP 浏览器驱动适配
browser-use-runtime:实验浏览器驱动运行承载
browser-use-stagehand-native:Stagehand 原生浏览器驱动适配
client-ui-agent-team:实验团队协作界面
client-ui-voice-input:实验语音输入界面
computer-use-cua-driver-mcp:CUA MCP 桌面驱动适配
computer-use-cua-driver-native:CUA 原生桌面驱动适配
inspector:实验运行时检查器
ptc-runtime-python:实验 Python 隔离执行提供方
schedule-bundle:实验定时任务能力组合
speech-to-text:实验语音识别服务合同
speech-to-text-sensevoice:SenseVoice 语音识别提供方
tool-agent-team:实验团队委派/控制工具
voice-input-bundle:实验语音输入能力组合
webworker-packer:实验 WebWorker 构建封装
webworker-runtime:实验 WebWorker 执行运行时`,
  extensions: `cordis-client-runner:客户端 Cordis 扩展运行适配
cordis-host-runner:Host Cordis 扩展运行适配
tool-cordis:Cordis 扩展操作工具
ui-cordis:Cordis 扩展状态和交互界面`,
  feedback: `command-feedback:显式反馈命令适配
message-feedback:消息反馈状态与记录服务`,
  fs: `fs:统一文件库、账户资源与文件任务合同
fs-local:本机项目文件访问提供方
fs-observation-policy:文件观察、刷新与缓存失效策略
fs-sandbox:隔离文件访问提供方
tool-fs:项目文件读写/删除工具适配
tool-fs-search:有界文件名/正文检索工具
tool-str-replace-editor:带基准校验的精准文本替换工具`,
  games: `minecraft:Minecraft 核心、实例、部署与生命周期领域服务
runtime-manager:设备运行环境发现、解析、安装与真实任务服务
steamcmd:SteamCMD 工具安装和校验领域服务
tool-minecraft:Minecraft 模型工具与原业务服务适配，合同按需选择
tool-runtime:运行环境模型工具与 RuntimeManager 适配
tool-steamcmd:SteamCMD 模型工具与原节点任务服务适配`,
  goal: `command-goal:显式目标控制命令
goal:目标状态及生命周期合同
goal-round-driver:目标驱动回合调度适配
tool-goal:目标创建/查询/控制工具`,
  guard: `repeat-tool-reminder:重复工具行动提醒，不替代领域防重
timeout-policy:执行超时策略合同`,
  hooks: `hook-protocol:模型请求前后钩子与可撤销事件协议
hooks-claude-code:Claude Code 生命周期钩子适配
hooks-codex:Codex 生命周期钩子适配`,
  host: `daemon:节点身份、心跳、任务领取、进程/文件执行与回报
directory-picker:Host 目录选择服务合同
directory-picker-auto:目录选择提供方自动适配
directory-picker-browse:服务端目录浏览选择适配
directory-picker-native:平台原生目录选择提供方
frontend-static:前端静态资源托管适配
open-in-app:平台应用打开能力提供方
plugin-inventory:Host 插件清单和能力检查
product-telemetry-otel:产品指标 OpenTelemetry 提供方
runtime-environment:Host 配置与运行位置服务合同
webserver:共享 HTTP/Socket 服务和静态资源承载`,
  identity: `anonymous-user-id:匿名用户标识来源适配
auth:账户身份、认证和账户隔离权威`,
  interaction: `commands:通用交互命令登记协议
permission-presets:三模式授权、审批记忆与执行范围权威
tool-ask-user:模型结构化澄清工具
user-approval:用户审批请求、通知及真实决定服务
user-questions:账户/Run 范围的问题等待和答案路由`,
  jobs: `jobs:真实任务队列、租约、结果、日志和取消服务
jobs-local:本机后台任务执行提供方
tool-jobs:后台任务查询/控制工具`,
  knowledge: `knowledge-library:账户知识、Prompt、Skill、专家资料及项目来源目录`,
  llm: `deepseek-llm-api-extensions:DeepSeek Provider 专属协议扩展
llm:模型请求、流、错误、能力和用量的实际 Provider Owner
llm-deepseek:DeepSeek 模型 Provider 适配
llm-deepseek-account:DeepSeek 账户方式的模型连接适配
llm-deepseek-api-key:DeepSeek API Key 方式的模型连接适配
llm-pi-ai:PI AI 模型协议桥接提供方
llm-retry:有界 Provider 重试策略，不重放工具副作用
plugin-package-inventory-deepseek:DeepSeek 插件包目录适配
token-meter:模型上下文/输出令牌估算合同`,
  lsp: `lsp:语言服务协议与服务合同
lsp-stdio:stdio 语言服务进程提供方
tool-lsp:代码导航和语言服务工具`,
  mcp: `mcp-client:MCP 连接池、发现、调用和账户/配置回收
mcp-resources:MCP 资源列表与按需读取适配`,
  network: `game-connectivity:游戏联机目标、连接配置及节点网络任务领域`,
  plan: `plan-mode:计划模式状态与执行范围合同`,
  preset: `agent-preset:主/子 Agent 预设元数据登记，不持有领域正文
agent-preset-registry:Agent 预设目录登记服务
domain-experts:领域与写作角色元数据、稳定 ID 及按需专家正文
persona:可选 Agent 人格配置与指引`,
  prompt: `minecraft:Minecraft 提示词正文 Owner、摘要及按需加载登记
prompt:复用 AiExtensions 的 Prompt/Expert 目录、正文加载及账户安装提示词工具
writing:写作任务提示词正文 Owner、摘要及按需加载登记`,
  "ptc-runtime": `ptc-runtime:Programmatic Tool Calling 隔离执行合同
ptc-runtime-node:Node.js PTC 执行提供方`,
  "runtime-diagnostics": `invariants:运行不变量和诊断证据检查`,
  sandbox: `sandbox:隔离执行服务与能力报告合同
sandbox-local:本机隔离执行提供方
sandbox-policy:隔离策略和真实能力校验
sandbox-windows-acl:Windows ACL 隔离执行提供方`,
  schedule: `schedule:账户定时触发、派发和真实执行回执`,
  sdk: `client:旧上游 SDK 客户端目录预留，不取代 sdk-client
protocol:旧上游 SDK 协议目录预留，不取代 sdk-protocol
sdk-client:认证 REST/SSE SDK 客户端
sdk-protocol:SDK 请求、结果、事件和错误合同
server:SDK 服务端承载适配`,
  session: `session-checkpoint-policy:会话检查点提交策略
session-format:会话事件和格式版本合同
session-format-catalog:会话格式/迁移目录
session-format-v0-to-v1:会话格式 v0 到 v1 迁移
session-format-v1-to-v2:会话格式 v1 到 v2 迁移
session-format-v2-to-v3:会话格式 v2 到 v3 迁移
session-format-v3-to-v4:会话格式 v3 到 v4 迁移
session-log-deepseek:DeepSeek 专属会话日志适配
session-persistence:会话持久化服务接口
session-persistence-jsonl:受保护 JSONL 事件、哈希链及恢复权威
session-projection:会话事件到读取投影的归约
session-projection-cache:派生会话投影缓存
session-stats:从权威事件派生会话统计
session-telemetry:会话公开指标及统计协议
session-telemetry-otel:会话 OpenTelemetry 提供方
session-title:会话标题策略服务
session-title-all-prompts-llm:全提示上下文的模型标题提供方
session-title-first-prompt-llm:首轮提示的模型标题提供方
session-title-llm:通用模型标题生成适配
session-turn-outline:会话回合大纲投影`,
  "session-query": `session-log-export:账户会话日志导出
session-query:当前会话查询服务合同
session-query-sqlite:可重建 SQLite 会话查询索引
tool-session-query:范围内会话查询工具，不扩大历史可见性`,
  settings: `settings:账户设置类型、默认值、校验、持久化和能力映射权威`,
  shell: `bash-local:本机 Bash Shell 提供方
bash-sandbox:隔离 Bash Shell 提供方
pwsh-local:本机 PowerShell 提供方
pwsh-sandbox:隔离 PowerShell 提供方
shell:Shell 服务、真实执行和取消合同
shell-env:Shell 环境变量过滤及运行环境映射
tool-bash:Bash 命令模型工具适配
tool-bash-persistent:持久 Bash 会话模型工具适配
tool-pwsh:PowerShell 命令模型工具适配
tool-pwsh-persistent:持久 PowerShell 会话模型工具适配
tool-shell:目标节点与本机 Shell 的模型工具合同`,
  skill: `minecraft:Minecraft bundled SKILL.md 资源及独立按需 Provider
skill:统一 Skill Provider 注册、摘要合并和按需正文加载
skill-badge:内置 badge 方法资源和 Provider
skill-filesystem:账户/项目目录 Skill 来源发现、缓存与加载
skill-office:Office 文档方法资源及按需 Provider
tool-skill:共享 Skill 发现/加载工具及旧写作调用名适配
tool-workspace-dependencies:工作区依赖发现与配置工具
writing:内置写作方法正文、摘要及共享 Skill Provider`,
  spill: `spill:大工具结果留存与受限读取合同
spill-local:本机大结果留存提供方
spill-policy:结果留存阈值、预算与清理策略`,
  ssh: `fs-ssh:SSH 目标文件访问适配
sandbox-ssh:SSH 目标隔离执行适配
ssh:SSH 连接与凭据/主机校验服务
subprocess-ssh:SSH 远端进程执行适配`,
  storage: `storage:存储 Hub、命名空间和后端登记
storage-domain:领域存储协调、配置事务及迁移
storage-json:受控 JSON 配置存储提供方
storage-sqlite:SQLite 连接、Schema、事务与持久化后端`,
  subagent: `subagent:委派任务状态、驱动登记与结果合同
subagent-acp:ACP 外部 Agent 驱动
subagent-claude-code:Claude Code 外部 Agent 驱动
subagent-codex:Codex 外部 Agent 驱动
subagent-dsh-sdk:DSH SDK 外部 Agent 驱动
subagent-fork-in-process:进程内分支子 Agent 驱动
subagent-in-process-driver:复用唯一 Agent Loop 的进程内驱动
subagent-spawn-in-process:进程内新建子 Agent 驱动
tool-subagent:模型委派工具和预算/范围适配
tool-subagent-control:子任务查询/取消工具`,
  subprocess: `subprocess:受控进程执行和交互合同
subprocess-local:本机进程/PTY 执行、取消与进程树提供方
win32-process:Windows 进程树与平台执行辅助`,
  telemetry: `logger:结构化日志与安全脱敏
otel:通用 OpenTelemetry 输出提供方`,
  terminal: `terminal:交互终端会话及事件合同
terminal-bash:Bash 交互终端适配
tool-terminal:模型终端会话工具与真实节点任务适配`,
  "test-support": `agent-loop-testkit:隔离 Agent 循环测试工具包
api:认证 API 隔离回归支持
client-runtime:客户端运行时隔离测试支持
llm-mock-server:隔离合成 Provider 服务
llm-replay:模型协议录制回放测试支持
loader-smoke:插件加载/卸载冒烟测试支持
remote-mock:远程协议替身测试支持
session-snapshot:会话快照测试支持`,
  todo: `tool-todo:待办目录和状态操作工具`,
  typert: `generator:工程期类型化 Remote 描述/Schema 生成
loader:类型化 Remote 插件贡献加载/卸载
protocol:Remote 方法、调用上下文、错误和 JSON 验证合同
registry:Remote 方法登记、授权校验与调用`,
  util: `atomic-write:通用原子文件提交辅助
brand:名义类型品牌辅助
chunked-list:分块列表数据结构
code-language:代码语言与扩展名纯映射
crypto:通用摘要/加密基础辅助
deque:双端队列数据结构
home-paths:LFAA Home/Profile 路径解析权威
http-proxy:HTTP 代理配置辅助
launch-environment:启动环境、数据根和进程配置解析
lazy-require:延迟模块加载辅助
native-command:原生命令参数和执行辅助
output-retention:有界输出保留辅助
package-manifest:包清单读取和验证辅助
time:时间值处理辅助
timeout:有界超时/中止辅助
values:跨运行时纯合同、枚举和共享设置定义
workspace-path:工作区相对路径处理辅助`,
  video: `ai-video:账户视频创作项目、媒体、Provider 任务和恢复领域服务
tool-ai-video:AI 视频领域工具与原项目/生成服务适配`,
  web: `tool-web:模型网页搜索/抓取工具合同
web:网页能力 Provider 登记和读取服务
web-fetch-http:受验证 HTTP 网页读取提供方
web-search-deepseek:DeepSeek 搜索提供方
web-search-exa:Exa 搜索提供方
web-search-perplexity:Perplexity 搜索提供方`,
  webhook: `webhook:外部事件验签、解析和触发合同
webhook-github:GitHub 事件来源适配`,
  workflow: `dag-engine:DAG 节点依赖调度、状态和取消
minecraft-adapter:Minecraft 领域工作流节点适配
tool-ralph:Ralph 迭代工作流工具适配
tool-workflow:模型工作流发现、保存、运行和跟踪工具
workflow:账户工作流定义、运行与节点结果服务
workflow-ptc:PTC 执行工作流节点适配`,
  workspace: `data-directory:配置数据目录与工作区资源协调
workspace:账户项目、受管工作区、Worktree 与 Session 项目绑定`
};

export const packageResponsibilities = Object.freeze(Object.fromEntries(Object.entries(annotations).flatMap(([group, lines]) => lines.split("\n").map(line => {
  const index = line.indexOf(":");
  if (index < 1 || !line.slice(index + 1)) throw new Error("逐包职责注解格式错误。");
  return [`packages/${group}/${line.slice(0, index)}`, line.slice(index + 1)];
}))));
