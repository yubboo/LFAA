# LFAA Client Connection

此包提供已认证控制端 API 和 AI Work SSE 消费协议，不持有模型、Session 或权限业务规则。

`UserPreferences.guidedEntryCompleted` 与最近 App/模式选择共用认证 `/preferences` 读写合同；Connection 只传递账户级偏好，不另存向导状态或工作区内容。

`AiWorkbenchView` 只传递当前可见工作区状态，包括 `project-file` 右侧文件页签。Canvas/Workflow 引用含当前 App、真实 Owner ID、标题及 `updatedAt`，只随新 Agent Run 请求发送；不持久化到 Session，也不授予工具或操作权限。`readWorkspaceProjectTextFile`、`loadWorkspaceGitStatus` 和 `loadWorkspaceGitFileDiff` 保持认证项目/节点边界，UI 不访问本机文件系统；项目文件读取、Git 状态和单文件差异均透传活动 `sourceId`，并支持 AbortSignal 取消过期读取。`loadWorkflowRuns` 支持 AbortSignal，供隐藏或卸载的画布面板撤销状态读取。

`createReadPoller()` 串行运行只读对账、合并在途刷新，并在页面隐藏时暂停、恢复可见时立即刷新。调用方可用 `initialDelayMs` 复用短期快照，并传入动态间隔函数；下一轮间隔在当前读取结束后重新计算。停止时撤销计时器和事件监听，不管理后台业务任务。

Minecraft 首屏、实例日志/任务详情、Agent 节点任务列表与详情读取，以及 SteamCMD 任务详情均接受可选 `AbortSignal`；UI 在身份切换、切换详情、离开页面或卸载时撤销对应的只读 HTTP 请求。

Minecraft 实例配置 Client 提供 `readMinecraftServerProperties()` 只读任务请求、`MinecraftServerPropertiesFileSnapshot` 脱敏快照和 `saveMinecraftServerFileProperties()`。保存传递来自快照的已变更键值，敏感项只传用户新输入或明确清除标记；此处不读取本机实例文件、不补默认值，也不做领域校验。

`loadAiOffice()` 通过认证 `/ai/office` 读取员工元数据和当前账户的 Agent Run 摘要，可传 AbortSignal 供 UI 隐藏/卸载时取消；不缓存状态快照。

AI 模型目录由 `/settings/ai/accounts` 按当前登录返回系统级普通 Provider 配置和当前用户自己的火山方舟 Agent Plan/Coding Plan 席位。个人席位使用 Plan 专用端点与手填 Model Name；新建时先真实测试模型，再提交短时一次性验证凭证。凭据替换只发送新 secret；响应不包含密钥，system/user scope 与权限判断归服务端 Owner。

`selectAiAccountModel()` 调用 Settings Owner 的账户模型选择路由；它只传账户 ID 和模型 ID，不传目录元数据或凭据。控制端在真实 Provider 目录与显式模型测试通过后，原子保存所选目录模型及其活动账户。

会话类 401 由账户 `auth/me` Remote 复核后才通知 UI 退出；成功的密码/通行密钥登录会使之前请求的迟到响应失效。服务端拒绝无效 Cookie 时不发送清 Cookie 响应，避免旧请求晚到覆盖新登录；显式注销仍由账户 Controller 清理 Cookie。

`project-version.ts` 导出由 Web 构建注入的当前产品版本、发布日期、官方版本清单地址和对应发布说明。构建只接受与所有产品包版本匹配的仓库根 `update.json`，Workbench 的版本公告不在运行时重复请求版本说明。

插件清单、搜索和来源检查读取可接收 `AbortSignal`；切换页面或放弃检查时可取消未完成读取。手动安装通过同源认证的 NDJSON 写入流读取 Plugin Manager Owner 的阶段与最终结果；流解析失败、缺少结果和服务端错误都会作为错误返回，不会推断安装成功。安装请求绑定检查时的来源类型、位置、固定摘要与本次 NPM registry；本包不保存 registry 设置或凭据。插件启用、停用与卸载继续调用受认证的 Permission Owner 管理 API，不创建 AI Work 会话。

DSH 来源检查的 `requirements.bundlePatch` 与上游声明保持一致：一个 patch 路径为字符串，多个按序路径为数组；Client 透传类型不折叠多文件顺序。它是静态清单元数据，不表示插件已启用。

`file-manager-location.ts` 将设置中心已保存的本机目录映射到 data 或本机卷来源，通过账户限定的路由历史把浏览目标交给文件页；不把路径当成权限、不在 URL 放入绝对路径，也不读取磁盘。文件页消费目标后移除临时历史字段，后续目录恢复继续使用原有账户缓存。

`startSystemFileDownload()` 通过同源认证下载路由触发浏览器原生 attachment 流，供领域 Owner 交付大媒体文件；流式文件不先进入 Client Blob 内存，账户、项目和素材校验仍在服务端 Owner 执行。

AI 漫剧项目列表会在交给工作区前校验服务端返回的项目列表与全部资源限制；缺少或包含无效限制值时以 `ai_video_contract_mismatch` 报错，避免旧版控制端响应进入新版 UI。

Browser Dock Client API 使用认证 `/browser/dock/*` 路由。导航前只查询本机隔离 Edge/Chrome 的真实可用性；提交地址时再启动同一账户与 LFAA Session 的无窗口页面，不打开外部浏览器。页面快照只返回标题、地址、标签、加载状态、修订号和视口尺寸，不为 Dock 拉取正文或截图；`streamBrowserDockFrames()` 通过带认证 Cookie 的 SSE 读取 Browser Owner 由 CDP 主动推送的合成器帧事件，使用 AbortSignal 在页面隐藏、切换或卸载时断开。帧流直接显示当前 Browser Owner Page 并启用同页输入，不调用 `getDisplayMedia`、不启动系统标签选择器、不传输用户桌面画面。

AI 回复使用一份 `content` 和可选 `parts` 正文范围；`delta` 携带分段 ID/起点，`presentation` 同步阶段及最终答案范围。客户端把同一消息、同一分段的真实文本优先合并到空格或中英文标点边界，并在下一帧交付；没有自然边界时最多等待 72ms，待处理文本达到 2048 个 UTF-16 字符时立即冲刷。非正文事件、消息/分段切换会先交付尾段。`appendAiTextDelta` 更新同一消息投影；活动的 `contentOffset`、问题、实际审批答案以及受校验的浏览器工具 ID/Provider ID 只用于展示和工作区联动。工具活动类型同时承载安全的函数用途合同与最多 8 个按序执行阶段；Connection 仅透传 Session/Agent Loop 的公开字段，不推断工具或权限状态。重新订阅的原子快照恢复当前正文、范围与活动，旧服务没有范围时保持兼容。

订阅继续沿用原取消信号；结束时冲刷文本，取消/卸载时撤销帧和短计时器并丢弃已失效订阅尾段，不另建连接或存储，也不传输 Provider 隐藏推理。协议回归见 `apps/cli/tests/ai-work-response-timeline.test.mjs`、`apps/cli/tests/ai-work-sse-lifecycle.test.mjs` 与 `apps/cli/tests/client-performance.test.mjs`。

`loadAiMessages()` 接收可选 AbortSignal，并将它传给已认证请求，使聊天切换后可取消过期的首屏读取。

AI Work 消息分页除单条 `AiMessage.usage` 外，还返回该会话累计的 Provider/模型用量、每模型缓存计数覆盖请求数与最近请求上下文快照。SSE 的 `usage-progress`、`usage` 与 `context-usage` 随真实模型响应更新；`cacheReadTokens: null` 表示 Provider 缓存读数不完整，不能转成零或推算命中率。上下文快照标记容量来自模型目录、设置中心兜底或未知；分项是本次 Provider 可见消息和工具定义的估算值，响应到达后 prompt 总量使用 Provider 实际字段。

`loadAiSessions()` 支持显式 App 筛选并接收可选 AbortSignal；小鱼共享工作区按当前账户读取跨 App 会话列表，在离开工作模式或切换账户时取消过期请求。

Browser Panel 的 provider、snapshot、revision、页面修订等待、navigate、视口调整、坐标点击、用户文字/按键/滚轮动作与 close 请求只调用认证的 `/browser/dock/*` API；这些请求由当前认证用户在浏览器 Dock 明确发起，不要求开启 Agent Browser Use。Agent 使用的 `/browser/sessions/*` API 检查 Agent Browser Use 主开关；内置 LFAA Provider 随 Host 自动可用，只有个人 Tabbit 仍检查显式连接及电脑操控。两类请求进入同一个 Browser Owner 与 `(account, LFAA Session, provider)` 页面上下文；Client 不缓存页面数据或保存登录态。Provider 能力由当前 Host 实际返回。

`loadAiExtensions()` 支持可选 AbortSignal；插件工作区与设置中心技能 Tab 共用其扩展清单，后者只筛选 `kind=skill`，不复制 Skill 数据目录。Skill 项的 `skillId` 是指向 Skill Registry 的稳定规范名称，设置页停用仍提交给原账户设置 Owner。共享工作区退出或账户切换时取消自身目录请求，其他调用方的默认并发读取仍使用原请求合并合同。普通应用面板不为展示 Agent 资源而读取此目录。

Minecraft 默认核心设置通过 `loadMinecraftCoreNames()` 读取认证后的本地核心名称合同；实时版本和构建仍使用 `loadMinecraftCores()`，避免展示偏好等待外部来源。

文件管理上传通过认证 `POST /files/upload` 发送 File 原始字节；远程下载与图片/PDF 预览使用 `downloadFileTransfer()` 读取账户绑定的一次性 Blob。任务 API 只暴露传输 ID 和文件元数据，不在 Client 类型中提供内联 Base64 上传字段。

2026-10-14：Files locations 与真实 entries 分开；总根设置增加 Owner 返回的默认/推荐/选择类型与显式推荐动作。移除独立项目/节点环境根的写入调用，保留统一派生位置读取。服务器未返回推荐合同不得猜测路径。

## 小鱼共享工作入口（2026-10-14）

提供可选关联、真实 Skill 摘要、来源、启用状态和原 Session/API 类型；`loadAiSkillDirectory()` 传递可选 AbortSignal，离开设置分类或工作区时可取消目录请求。新请求仅传引用，关联不启用能力或改权限。

构建只写仓库根 dist/packages/client/connection/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Profile 插件的 `inspectManagedPlugin()` 可将一次性 NPM registry 传给来源检查；`installManagedPlugin()` 消费 NDJSON 安装流，并在同源 API 请求中提交已检查的来源类型、位置、固定版本/摘要和 registry，向 UI 发出 Owner 的真实阶段及最终插件记录。`removeManagedPlugin()` 调用受认证的卸载 API。三者都不创建 AI 会话或在客户端执行安装规则；注册表不写入账户偏好或 `.npmrc`。

GitHub 连接 Client API 仅调用认证的 `/integrations/github/*` 路由，返回去除 token 的状态与规范化仓库、Issue、PR 字段；Device Flow 验证码仅在用户主动连接时显示。断开与列表读取均支持 AbortSignal，页面卸载或切换资源时取消当前请求，不在 Client 中持有 OAuth token 或设置第二个凭据存储。

Agent Git API 使用账户隔离的本机仓库 ID 与会话绑定 ID调用认证 Agent Git Controller；不发送绝对目录、Daemon `nodeId` 或任意 Git 命令。当前会话的项目目录由 Session/Workspace Owner 解析并自动关联；该只读登记不会创建 `.git`。Agent 首次获准创建或写入项目文件时，文件 Tool 会在同一权限结果内对非仓库目录执行一次 `git init`。Client 不持有或回读 Git 凭据；HTTPS 远端凭据通过用户显式填写交给 Credentials Owner 加密保存，并只把是否已配置的状态返回 Client。Git 状态、差异、暂存/取消暂存、提交、历史、分支、remote、fetch、快进 pull、push 和文件审阅均调用本机 Host 的固定操作合同；单文件差异支持 0–1000 行受限上下文和 AbortSignal；SSH 同步与 Pull Request 写 API 尚未接入。

浏览器最近网站 API `loadBrowserRecentSites`、`recordBrowserRecentSites`、`clearBrowserRecentSites` 只透传认证 Browser Controller 的账户范围合同；Client 不持有网站历史副本、不自行去重或持久化。

SteamCMD Client Connection 提供通用服务端列表、创建/配置、运行环境安装/校验/卸载、DST Master/Caves 集群登记和服务端安装/更新/启动/停止任务 API，类型只表达服务端领域结果；权限、参数校验和节点执行继续归服务端 Owner。SteamCMD 工具目录使用账户限定的 `setFileManagerLocation()` 导航提示，进入现有 File Manager 的同节点只读资源，不传物理路径、令牌或创建第二套文件接口。DST 配置文件仍通过相同导航 Owner 进入现有文件管理。调用使用现有认证请求和错误映射，不保存游戏配置副本。构建写根 `dist/packages/client/connection/`。

`loadUserSettingsSyncStatus()` 读取认证后的当前 Control Plane 账户设置元数据，不缓存跨账户或设置值；Electron `mini.open/close` 只透传桌面 Host 的 IPC 操作及真实回执。

`streamAiChat()` 可在新 Run 请求中传递严格受限的 `workspaceView` JSON；它不是消息字段，连接层只随本次初始 POST 发送，不在续接既有 Run 时重放。

账户资料连接 API 将 `.lfaa-snapshot` 文件作为受认证二进制请求上传/下载；预览类型区分 v1/v2 并展示会话检查点与附件统计，恢复结果返回附件导入/复用计数。Client 不在本地解包、保存迁移副本或自行改写会话数据。

`setMinecraftInstanceJvmConfiguration()` 只提交实例最大堆、初始堆和逐行 JVM 参数至 Minecraft Service；Connection 不做参数判定、持久化或 Java 环境安装。

外观预设连接 API 提供结构校验、原子应用与账户背景二进制读取；导入/导出沿用现有认证背景上传/删除 Owner，不在 Connection 缓存图片字节、保存预设副本或另建设置存储。
