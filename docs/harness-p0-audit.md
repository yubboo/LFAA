# DSH 能力参考与 LFAA P0 取舍审计

核对基线：DeepSeek Harness 提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。本文把“包目录有源码”“LFAA 有相似能力”“能力已按 LFAA 插件装配”“行为和真实运行验收通过”分开记录。清单状态只统计目录源码/装配登记，不能作为能力等价证据。

## 范围与结论

`docs/开发计划.md` 的 P0 索引包含 61 个上游包目录；它是能力盘点来源，不等于 LFAA 的逐包实施清单。当前目录计数（42 个有实现/装配源码、19 个占位）仅说明源码情况，不说明 LFAA 有此需求或能力已完成。按用户最新澄清，为每项确定 LFAA 场景与取舍，只实现适合 LFAA 的差距。**LFAA 场景筛选后的 P0 已完成**；DSH 专属格式、无消费者的 Remote/插件扩展与 P2 执行提供方按下文理由暂缓，不计为 P0 缺口。

可借鉴 DSH 的安全、性能、生命周期和维护方法；能力本身必须经过 LFAA 场景筛选。保留 LFAA 既有产品能力、交互和差异化，不为包名对应而重构。DSH 页面、React 组件、布局、样式和纯展示界面不复刻；LFAA 现有账户、设置、Session、Daemon 与业务服务继续是唯一事实 Owner。

## 逐包能力映射

| DSH 包 | DSH 能力参考 | LFAA 决定、唯一 Owner 与当前映射/差距 |
|---|---|---|
| `api/account-controller` | 账户状态及账户相关调用 | `packages/api/account-controller`、`packages/identity/auth`；用户自身信息已由 `auth/me` Typert Remote 承载，认证账户仍归 Identity Owner；DSH Platform 登录没有对应 Provider，见 credentials 项。 |
| `api/gateway` | 统一 HTTP 入口、路由及协议边界 | `packages/api/gateway`、`packages/host/webserver`；Control Plane Gateway 已挂载登录保护的 Typert 一元调用路由；业务方法必须再通过自身授权器，其他 REST/Socket 接口未迁移。 |
| `api/remotes` | Remote 描述、校验、服务端执行与客户端代理 | `packages/api/remotes/src/route-contracts.ts` 继续由 Joi 校验 REST 与认证相关合同，并提供 Typert 外层请求形状。账户读取已通过生成合同的一元 Typert Remote；Agent 对话仍由现有 Session Controller SSE 与 `client/connection` 流解码器负责。当前没有需要 Typert 双向流的 LFAA 消费者，其他 REST/Socket 不为统一协议而迁移。 |
| `api/session-controller` | Session、Run、流事件和交互答案 API | `packages/api/session-controller`、`packages/core/agent-loop/src/runs.ts`；认证答案与 Agent Run 回答者已接通，Session Controller 持有答案和运行状态。现有 SSE 承载模型输出；CLI/桌面没有额外问题回答通道消费者，不另建通道。Profile 与 Carrier 回归通过。 |
| `api/settings-controller` | 设置读取、校验和保存 API | `packages/api/settings-controller`、`packages/settings/settings`；仍由设置中心持有。P0 复用现有 Provider、权限与一般设置，凭据密文复用设置存储和既有密钥，没有新增配置。 |
| `api/workspace-controller` | 工作区项目和节点上下文 API | `packages/api/workspace-controller`、`packages/workspace/workspace`；项目/节点关系由现有 Owner 校验；`workspace-projects`、Session 项目上下文及账户隔离回归通过。 |
| `boot/app-boot` | 按 Profile/Bundle/补丁建立 Cordis 插件图并关闭资源 | `packages/boot/app-boot/src/index.ts`、`plugin-runtime.ts`；启动失败会列出未就绪插件、Cordis 状态及失败原因。真实 Web Profile 回归覆盖启动失败回滚、可选插件启用失败回滚及独立进程停用状态恢复；生命周期故障注入回归覆盖 Loader 停用更新失败后的原状态回滚，以及手动重载启动失败后的可见 FAILED 状态和显式停用/启用恢复。 |
| `boot/cmdline` | App 自有命令行参数、帮助与退出行为 | 入口由 `apps/cli/bin/lfaa.mjs` 提供，固定暴露 Web/Daemon 等 LFAA 启动命令。当前没有插件向 Agent/CLI 贡献独立命令的 LFAA 场景；不为 DSH 的扩展点另建 CLI Owner。 |
| `boot/hmr` | 服务端开发时模块热更新生命周期 | `packages/boot/hmr` 管理服务端开发图；Vite 自己管理浏览器源码更新，Profile 图同步由插件 Carrier 承载。`dsh-profile`、`dsh-carrier` 与认证同步回归通过，分别验证三段生命周期。 |
| `bundle/base` | 基础产品能力的有序插件组合 | `packages/bundle/base/cordis.patch.yml`；已装配存储、设置、权限、Core 与工具等第一方插件，本轮将提问工具列入基础组合。 |
| `bundle/web-app` | Web 产品入口插件组合 | `packages/bundle/web-app`；已存在 Web 组合；须与 Profile 一起验实际装配、禁用策略和失败回滚。 |
| `client/web` | Web 端运行入口与非界面启动绑定 | `packages/client/web`、`packages/client/web/src/main.tsx`；复用现有 Web 入口，页面本身不作为 DSH 对标目标。 |
| `client/modules` | 客户端模块/扩展贡献点与生命周期 | `packages/client/modules`；现有图同步、模块注册和 Cordis 贡献负责客户端扩展；认证切换/登出竞态与可重试状态由 `dsh-client-module-auth` 回归覆盖，Profile/Carrier 回归验证了模块图装载。 |
| `client/connection` | API、流事件、轮询、连接恢复 | `packages/client/connection`；Typert `auth/me` 为新 Host 首选。兼容升级中的旧 Host：只在该 Remote 明确返回 `404 not_found` 时读取仍受 Identity 认证保护的旧 `/auth/me`；其他错误不降级。定向回归覆盖两种 Host。其他 API 仍沿用现有调用，须继续验重叠请求、取消和断连恢复。 |
| `client/store` | 客户端缓存、恢复状态和数据适配 | `packages/client/store`；已有浏览器持久化和快照缓存；须按账户/App/Session 验证隔离、上限和过期恢复。 |
| `client/hmr` | Web 插件图同步与开发包刷新 | Web Profile 继续以兼容插件装配 `@deepseek-ai/dsh-client-hmr`；认证事件通道 `/plugins/events` 由 `packages/host/webserver/src/dsh-carrier.ts` 的 LFAA Host Owner 提供，Profile/Carrier 回归覆盖图声明和路由。Vite 的开发模块更新仍由 Vite 管理；当前没有理由复制或维护第二套浏览器 HMR。 |
| `client/locale` | 语言偏好、回退规则及插件翻译字典运行时 | `packages/client/ui-workspace/src/dsh-locale-runtime.ts` 提供字典登记、订阅和语言回退，并读取 Settings Owner 的 `general.language`。运行时沿用现有客户端包，不复制界面、不移动既有 Owner；没有第二消费者要求拆包。 |
| `core/scope` | App、账户及子 Agent 的工具可见范围过滤 | `packages/core/scope`；已有统一 App/工具范围过滤；它不替代执行时授权。 |
| `core/session` | Session 事件模型、追加、恢复和模型历史 | `packages/core/session/src/kernel.ts`、`sessions.ts`；复用 LFAA 事件内核与现有账户隔离，继续受 `LFAA-SESSION-KERNEL-01` 约束。 |
| `core/agent` | Agent 生命周期及扩展挂载 | `packages/core/agent` 通过 Cordis 插件生命周期提供 Agent 扩展注册；插件管理、Agent Runtime、Profile 启停与失败回滚回归通过。 |
| `core/agent-default-model` | 解析运行模型与 Provider 能力 | `packages/core/agent-default-model` 是必需插件：从设置中心读账户/模型元数据，经 `lfaaCredentials` 引用按当前用户读取密钥；不缓存账户或密钥。 |
| `core/agent-loop` | 模型决策循环、工具执行、审批与真实结果回传 | `packages/core/agent-loop`；已有 LFAA Run 执行器；本轮移除内嵌 ask-user 分支，改由已登记工具插件调用 Run 问题通道。 |
| `host/webserver` | HTTP/SSE/WebSocket 承载及请求生命周期 | `packages/host/webserver` 是唯一 HTTP/SSE/Socket 与静态资源 Owner；`http-delivery`、Carrier、认证 Remote、隔离 Profile 与隔离 Host 构建回归通过。 |
| `host/frontend-static` | 安全静态文件服务、路径拒绝和 SPA 回退 | 当前能力由 `packages/host/webserver/src/http-delivery.ts` 的 `serveFrontend()` 承担，`server.ts` 只从根 `dist/apps/web` 提供静态产物；`apps/cli/tests/http-delivery.test.mjs` 覆盖缓存、资源 404 与路由回退。目录清单仍是占位，因为 Owner 合并在 WebServer，不另建重复包。 |
| `sandbox/sandbox` | 统一沙箱提供方接口、执行结果核验与失败关闭 | `packages/sandbox/sandbox`；目前只定义提供方合同和结果校验，不提供 OS 隔离执行器。 |
| `sandbox/sandbox-policy` | 按模式、目标主机、工作区和会话形成逐调用策略 | P0 只定义显式目标/平台/绝对路径及执行结果拒绝策略合同，并由 `p0-runtime-contracts` 验证。现有 Shell 权限仍归 `permission-presets`；OS 沙箱执行提供方尚未接入，按 P2 规划，不把策略接口描述成已启用的隔离能力。 |
| `subprocess/subprocess` | 受管进程/伪终端的跨平台执行合同 | `packages/subprocess/subprocess`；现有接口要求显式 argv、环境、cwd、输出上限与目标；没有本机或 Daemon 提供方。 |
| `session/session-format` | Session 格式规划、无损值检查、编解码分派 | LFAA 由 `packages/core/session/src/kernel.ts` 校验自有事件载荷；唯一 JSONL Owner 使用信封 `format: 1`，旧 SQLite 会话由同一 Session Owner 幂等导入。未知信封版本会拒绝启动，不静默丢弃。当前没有 DSH 格式数据导入消费者，因此不增加 DSH 格式规划器。 |
| `session/session-format-v0-to-v1` | 已发布 V0 记录读取及 V1 身份转换 | DSH 专属历史格式转换：当前 LFAA 数据不是 DSH V0，且没有兼容导入入口；标记不适用，不作为 P0 缺口。 |
| `session/session-format-v1-to-v2` | V1 到 V2 记录和 Assistant 流迁移 | DSH 专属历史格式转换：当前没有 DSH V1 数据或导入消费者；标记不适用。LFAA 自有格式升级须由未来实际版本变化触发并沿唯一 Session Owner 增量迁移。 |
| `session/session-format-v2-to-v3` | V2 到 V3 的引用、系统头和规范信封迁移 | DSH 专属历史格式转换：当前没有 DSH V2 数据或导入消费者；标记不适用。 |
| `session/session-format-v3-to-v4` | V3 到 V4 工具结果、来源与引用映射迁移 | DSH 专属历史格式转换：当前没有 DSH V3 数据或导入消费者；标记不适用。 |
| `session/session-format-catalog` | 构建期汇总格式编解码器和相邻迁移 | 当前 LFAA 只有一个 JSONL 信封版本；拒绝未知版本，且 SQLite 历史迁移已由 `session-persistence-jsonl`/`storage-domain` 负责。第二个 LFAA 信封版本出现前不增加目录抽象。 |
| `session/session-persistence` | Session 持久化接口与恢复合同 | 唯一 `lfaa-session-persistence-jsonl` Owner 已提供写入、回放、校验、原子替换和失败后拒绝继续提交。当前没有第二种 LFAA 后端；不添加只转发至 JSONL 的平行接口。 |
| `session/session-persistence-jsonl` | 有序、校验和及持久化 Session 事件日志 | `packages/session/session-persistence-jsonl/src/persistence.ts`；每笔提交写入连续序号和 SHA-256 链并 `fsync`。`file-storage.test.mjs` 覆盖跨进程重启、未完成尾行恢复、缺行/篡改拒绝及刷盘失败回滚；Session Kernel 持久化回归覆盖未决工具 `unconfirmed` 恢复，不自动重放。 |
| `session/session-checkpoint-policy` | 模型请求/工具副作用前后的耐久检查点策略 | 已由 LFAA Agent Loop、Session Owner 与 JSONL 持久化链实现等价且更严格的同步屏障：模型网络请求前先记录请求 Header/Context；顶层工具正文运行前先记录 `tool/call`；每次提交在返回前追加 JSONL 并 `fsync`；失败会使会话仓库进入拒绝后续提交状态。无需再建平行检查点策略包；崩溃未完成工具结果恢复为 `unconfirmed`，不自动重放。 |
| `session/session-projection` | 从日志构造并登记 Session 投影 | `packages/core/session` 是唯一投影 Owner，继续向现有 API/UI 提供消息投影；当前没有外部插件投影消费者。开放通用注册会扩大 Session 扩展与历史访问面，故不引入第二个投影 Owner。 |
| `session/session-projection-cache` | 持久投影检查点及冷启动加速 | Session Store 已按 LRU 限制最多 32 个实时对象，SQLite 保存授权/列表查询所需索引；没有大规模会话冷启动测量证明持久检查点必要，先不增加双重权威快照。 |
| `credentials/authorization` | 注册人机协作的凭据获取流程，连接授权方法、提示/通知、取消与凭据提交确认 | 新增 `packages/credentials/credential-flows` 第一方插件，按活动 Cordis 插件身份创建和归属流程，支持账户/引用隔离、单引用单次尝试、通知/提示回调、取消/卸载清理，并要求本次尝试确实提交记录后才算成功。现有 `packages/credentials/authorization` 是登录 Cookie 与角色校验中间件，不承担此职责。DeepSeek Platform OAuth 暂缓，不作为 P0 必需项。 |
| `credentials/credentials` | 凭据引用解析/说明以及按插件组织的持久记录写入、更新、移除和来源描述 | `packages/credentials/credentials` 提供绑定活动插件身份的读取/写入注册、消费者白名单和变更事件；记录由 `packages/settings/settings` 以 AES-256-GCM 加密到唯一配置存储，关联数据绑定账户、插件所有者和记录 ID，继续复用 Settings 密钥文件。AI 账户密钥仍由 Settings 唯一持有；Platform 来源只有在明确的 LFAA 场景成立后才考虑。 |
| `credentials/credentials-local` | 本机文件凭据后端与环境层级 | 无 DSH 对应文件凭据后端；LFAA 当前秘密数据 Owner 为设置中心，不能另加平行普通文件明文存储。 |
| `credentials/deepseek-account` | DeepSeek Platform 账户登录与模型凭据解析、账户资料/余额/赠金/设备状态 | **暂缓，不是 LFAA P0 默认需求。** Provider API 账户与密钥已有 `packages/settings/settings` 唯一 Owner；只有明确的 LFAA 用户场景证明 Platform OAuth 是必要 Provider 方式后再立插件合同，不能建第二套 AI 账户或秘密存储。 |
| `credentials/deepseek-account-platform` | Platform PKCE、回调、请求来源约束、账户接口和令牌失效处理 | **暂缓，不是 LFAA P0 默认需求。** DSH 的安全实现方法可供未来参考；本轮不因目录或上游功能而接入 Platform 登录、赠金或设备账户。 |
| `identity/anonymous-user-id` | Harness Home 范围内的匿名关联 ID | LFAA 使用认证账户 ID 和本机节点身份；不生成匿名身份，防止与真实账户形成第二套身份 Owner；若仅作遥测需另有明确数据目的与授权。 |
| `identity/auth` | 用户认证和服务端会话身份 | `packages/identity/auth` 保持用户 Cookie、会话和登录唯一 Owner；认证 Remote/旧 Host 兼容、远程节点连接身份及账户隔离回归通过。 |
| `interaction/commands` | 插件贡献可直接作用于 Agent 的命令注册服务 | LFAA 由模型依据目标选择已登记 Tools/Skills；没有独立的 `/command` Agent 命令消费者。客户端命令 UI 是界面能力，不以 DSH 包存在为由另建执行目录。 |
| `interaction/permission-presets` | 权限模式、范围授权和风险决策 | `packages/interaction/permission-presets/src/permissions.ts` 继续持有账户/App/Session 绑定的授权决定；工具级风险、审批结果提交与等待通知隔离回归通过。 |
| `interaction/tool-ask-user` | Agent 工具通过问题通道向用户澄清 | `packages/interaction/tool-ask-user` 作为基础第一方工具插件由 `lfaaTools` 注册；Agent Run 提供问题通道时使用，Run/Session Controller 仍拥有等待和答案；插件卸载和问题服务回归通过。 |
| `interaction/user-approval` | 与通道无关的一次性审批请求/答案协议 | `packages/interaction/user-approval` 以账户与审批 ID 提供限时等待通知；Session Controller 仅在 `permission-presets` 提交后唤醒，Agent Loop 重读权威状态。取消、超时、卸载有回归；当前 LFAA 只有认证 HTTP 决定通道，其他通道没有消费者，不扩建答复适配器。 |
| `interaction/user-questions` | 工具/权限插件、Agent Run 与本地回答器共用的问题服务 | 新增 `packages/interaction/user-questions` 插件：回答者按优先级稳定排序、按账户/App/Run 匹配并可撤销；`agent-run` 适配器复用现有 Run 等待和 Session Controller 答案 Owner，取消与卸载清理有回归。CLI/桌面尚无独立提问通道消费者，按需再注册适配器；不为占位通道宣称已接入。 |
| `settings/settings` | 设置声明、默认值、服务端校验、持久化和映射 | `packages/settings/settings`；继续是唯一设置 Owner；本轮没有新增设置。 |
| `storage/storage` | 通过统一存储 Hub 挂载命名后端与数据形式 | 新增 `packages/storage/storage`：`lfaaStorageHub` 只维护具名后端和数据形式注册；JSON 与 SQLite 适配器作为独立插件接入，Hub 不执行 IO、不持有账户/设置/Session 数据。隔离回归覆盖重复项、精确撤销和卸载。 |
| `storage/storage-domain` | 领域配置与数据迁移语义 | `packages/storage/storage-domain`；已有设置/领域配置 Owner；须复核迁移版本、失败恢复和数据所有权。 |
| `storage/storage-json` | JSON 持久化后端 | `packages/storage/storage-json/src/hub-backend.ts` 将既有原子 JSON 文件实现接入 Hub，支持单文档/逐记录 KV、版本拒绝、记录备份和数据根隔离；直接回归通过。 |
| `storage/storage-sqlite` | SQLite 持久化后端 | `packages/storage/storage-sqlite/src/hub-backend.ts` 复用唯一控制端数据库连接；版本 40 事务迁移创建具名单元、KV 记录和全局值表，以专用表隔离通用记录；不更改设置、账户和 Session 的 Owner，Session 事件仍以 JSONL 为准。隔离回归覆盖首次迁移和持久化。 |
| `typert/generator` | 从 TypeScript 生成可分发类型模型和 Remote 工件 | 工程期 `packages/typert/generator` 从封闭的 TypeScript 源合同生成账户 `auth/me` 描述符及输入/输出 JSON Schema；Host 和 Client 实际消费，生成器不进入产品运行树。现阶段仅一个 Remote 需要该路径；没有消费者要求迁移其他 API 或自动扫描全部包。 |
| `typert/loader` | 插件加载时贡献反射元数据与 Schema | `packages/typert/loader/src/index.ts` 按 Cordis Fiber 登记/撤销 Remote，账户插件显式贡献方法。当前无自动扫描包工件的消费者，不为生成便利扩大启动装配面。 |
| `typert/protocol` | Remote 描述符、编解码器、Provider 和共享协议 | `packages/typert/protocol/src/index.ts` 定义一元方法、逐方法授权器、调用上下文、稳定错误和总量 4 MiB 有界 JSON；账户 Remote 使用生成 Schema。Agent 双向输出继续由现有 SSE 负责，无需 Typert 双向流消费者。 |
| `typert/registry` | 运行期存储/查找反射、Schema 与 Remote 描述符 | `packages/typert/registry/src/index.ts` 提供 Cordis 登记、查询、本地调用、输入输出校验、逐方法授权和 Fiber 卸载撤销；`api/gateway` 通过认证路由调用它，当前只迁移账户自身读取这一方法。 |
| `workspace/data-directory` | 每个 Harness Home 的数据目录解析与约束 | `packages/workspace/data-directory` 继续持有 `LFAA_HOME`/数据路径规则；固定/可移动磁盘默认值、显式路径和失败关闭边界由 `data-directory.test` 覆盖。凭据、Session 等 Owner 仍在数据目录内各自管理。 |
| `workspace/workspace` | 工作区项目、节点路径和目标解析 | `packages/workspace/workspace` 继续持有项目、节点路径、App/账户关系及受管 Worktree 元数据；`workspace-projects`、Session 绑定和 Daemon 连接隔离回归通过。 |

## P0 关闭记录与明确暂缓

1. **协议与存储底座**：通用存储 Hub、JSON/SQLite KV 插件、Typert 一元 Remote 与工程期 TypeScript 生成器已登记并有真实消费者。Profile 启停/失败回滚、跨进程停用状态、Client 模块认证图、Carrier、静态资源服务均有隔离回归。Agent 对话保留 LFAA SSE；没有 Typert 双向流、全量 API 迁移或生成工件自动扫描的当前消费者。
2. **账户凭据与交互插件**：只读凭据引用、基于活动插件身份的授权 Flow、Settings 唯一加密凭据记录、Run 问题服务与审批通知插件均已接入；账户/App/Run 隔离、密文、失败关闭、取消/卸载和真实认证 Controller 路径都有定向回归。DeepSeek Platform OAuth、CLI/桌面提问通道和额外审批通道没有当前 LFAA 用户场景，不作为 P0 门槛。
3. **Session 耐久性**：既有 Agent Loop/`lfaa-session`/JSONL Owner 提供同步刷盘屏障、旧 SQLite 会话幂等导入、日志完整性校验、崩溃尾部恢复及未决副作用保护；隔离回归覆盖损坏拒绝、刷盘失败回滚、跨进程恢复和未决工具 `unconfirmed`。当前只有一个 LFAA 信封版本、一个持久化后端和一个投影 Owner，因此 DSH V0–V4 转换目录、通用持久化抽象、投影注册与持久缓存均没有当前消费者，不在 P0 新建。
4. **执行与客户端承载**：静态资源由 WebServer 唯一 Owner 提供并有缓存/路径回归；Client 模块、语言映射与 HMR 复用现有 LFAA/DSH 插件图组合。sandbox/subprocess 合同有输入和失败关闭回归，真实 OS 沙箱与本机/Daemon 进程提供方按 P2 处理，不在 P0 暗示已提供。
5. **组合验收**：在当前 Vite + Control Plane 的本地组合页面验证认证恢复兼容；隔离 Profile 与插件管理回归通过。登录态 Edge 浏览器、真实 Provider、OS 沙箱、Daemon 节点及桌面宿主未由本轮验收；未因这些边界重启服务或覆盖活动构建。

## 已完成的本轮改动及其边界

- `packages/sandbox/sandbox-policy`：新增显式目标、平台、绝对工作区路径和权限模式策略合同；不决定用户设置，也不授予执行权限。
- `packages/sandbox/sandbox`：新增执行结果拒绝校验；不宣称提供 Windows ACL、Linux 沙箱或 macOS 隔离。
- `packages/subprocess/subprocess`：新增显式 argv/cwd/env、输出上限和伪终端队列边界；没有本机或 Daemon 进程 Provider。
- `packages/interaction/tool-ask-user`：将关键澄清注册成基础第一方工具插件；Session/Run/API 仍是等待和答案唯一 Owner。
- `packages/credentials/credentials`：注册凭据引用来源；`packages/settings/settings` 只读适配仍由设置中心加密保存的 AI 账户；`packages/core/agent-default-model` 作为必需插件组合模型元数据与密钥。
- `packages/storage/storage`：新增纯注册 Hub；`storage-json`、`storage-sqlite` 提供单文档/逐记录后端。SQLite 仍复用现有控制端文件，JSON 继续使用 `LFAA_DATA_DIR/storages`，未增加设置或第二数据 Owner。
- `packages/typert/{protocol,registry,loader}` 与 `packages/api/gateway`：新增一元 Remote 描述、逐方法授权、有界 JSON、Cordis 注册与卸载撤销，并接入登录保护的 API Gateway 路由。账户插件将自身信息方法登记为 Remote，`packages/client/connection` 改为经现有同源会话调用；仍只有一个实际迁移方法，没有流协议。
- `packages/typert/generator`：新增工程期生成器，从账户控制器导出的封闭源合同生成双端共享方法描述和 JSON Schema；账户 Host 路由实际验证生成 Schema，Client Connection 使用生成端点描述。构建工作区将其排除在产品 Host 运行树之外。
- `packages/interaction/user-questions`：新增通道中立回答者注册服务，并将当前 Agent Run 作为首个适配器；按账户/App/Run 匹配、优先级顺序、取消和插件卸载回收均由长期回归覆盖。未新增持久化、设置、审批记录或 UI。
- `packages/credentials/credential-flows`、`packages/credentials/credentials`、`packages/settings/settings` 与 `packages/storage/storage-domain`：新增以活动插件身份绑定的凭据授权 Flow 和通用记录读写；密文复用 Settings 唯一配置存储与密钥，AES-GCM 关联数据绑定账户、插件及记录 ID。新增跨进程持久化、账户/插件隔离、篡改拒绝、单次提交确认、并发、取消和卸载回归；未新增提供方、API/UI 路由或设置。

2026-10-04 验收：P0 直接回归 90/90 通过（57 项核心回归、27 项 Profile/承载回归、6 项数据目录回归）；95 个能力包构建通过；Control Plane 隔离构建、Client TypeScript 全量检查和 Web 隔离 Vite 构建通过，输出分别位于根 `dist/packages/`、`dist/.tmp/p0-control-plane/` 与 `dist/.tmp/p0-web/`。当前本机 Vite/旧 Host 组合的隔离浏览器显示正常登录表单，不再出现 Typert `404 not_found` 阻断；没有有效登录 Cookie 的浏览器仅验证了未登录页面，用户 Edge 已有登录态未验。Vite 有超过 500 kB 的前端分块警告，属于现有 UI bundle 体积记录，本 P0 未改 UI。`workspace-preflight` 脚本不存在，未运行。没有新增/修改设置中心配置，没有停止或重启运行服务，也没有覆盖 `dist/apps/web` 或 `dist/apps/control-plane`。

明确保留的范围：Typert 仅迁移账户 `auth/me`，其他 API 沿用各自 LFAA Controller；模型流继续使用 SSE。没有 DSH 历史数据导入消费者、第二 Session 后端、外部 Session 投影消费者或大规模冷启动性能证据，因此不新增 DSH 格式目录、通用投影/持久缓存。Platform OAuth、Agent `/command`、CLI/桌面问题/审批通道及真实 OS 沙箱/进程提供方均有明确的暂缓阶段或无当前消费者依据，不伪装为已实现。LFAA 场景筛选后的 P0 已关闭；这不表示 DSH 全部非界面能力或 P1–P4 已完成。
