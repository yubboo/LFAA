# LFAA 火山方舟 Agent Plan / Coding Plan 接入

<a id="lfaa-volcengine-plan-integration-20261026"></a>

## 用户目标与当前问题

- 用户要把火山方舟 Agent Plan 与 Coding Plan 正确接入 LFAA，修复在普通“豆包 / 火山方舟”配置中使用套餐密钥时目录请求被拒的问题。
- 现有普通 Provider 使用火山方舟按量 API 的 `/api/v3/models` 与 `/api/v3/chat/completions`；Plan 有独立 API 地址、密钥种类和模型范围，不能复用普通 Provider 的目录/凭据合同。
- 当前 Agent Plan 设置表单首次加载目录时必须允许尚未选择模型；服务端 `modelId` 字段虽可省略，但一旦发送就必须非空。
- 当前 `ai_accounts.user_id = null` 是系统级共享模型范围，适用于管理员配置的普通 API 账户；个人套餐必须按 LFAA 登录使用人隔离，不能让不同登录账户共用一个席位密钥。

## 入口、Owner 与配置

- 运行入口：设置中心「AI 与模型」与 `/work`；真实推理由 Control Plane 的 Agent Loop 发起。
- Provider 请求与流解析唯一 Owner：`packages/llm/llm`；协议元数据和方舟默认能力归 `packages/llm/llm-pi-ai`；账户、模型目录、加密凭据、校验和作用域解析归 `packages/settings/settings`。
- 认证路由归 `packages/api/settings-controller`；UI 与调用封装归 `packages/client/ui-settings`、`packages/client/connection`；结构化持久化复用 `packages/storage/storage-domain` 的 `ai_accounts`，不新增第二套模型或凭据表。
- 普通 OpenAI/DeepSeek/火山方舟按量 API 仍为管理员系统级 Provider；Agent Plan/Coding Plan 账户归当前登录用户本人。Plan 密钥继续由现有 Credentials Owner 在 Control Plane 加密保存，浏览器不持久化或接收回读密钥。
- 套餐走用户显式发起的 AI Work 交互请求；Control Plane 在既有 Agent Loop 内使用当前用户自己的 Plan 凭据，不把 Plan 密钥公开成可供其他客户端调用的转发 API。认证、模型权限、请求预算、取消、工具授权和 Session 继续使用既有 Owner。不得跨用户回退到其他用户的 Plan 账户。
- 相关设置沿用现有 AI 与模型账户管理、`aiRuntime` 请求/输出/上下文偏好、`permissions.mode` 与既有 Appearance。购买订阅、套餐用量/账单 API、CLI 安装和第三方应用配置不在本轮自动执行。

## 实施范围与边界

- 作为独立 Provider 类型接入 Agent Plan 与 Coding Plan，不把 Plan Key 当普通 `doubao` Key，也不访问错误的按量 `/api/v3` 地址。
- 按官方兼容协议分别使用 Agent Plan `https://ark.cn-beijing.volces.com/api/plan/v3`（OpenAI 兼容）与 `https://ark.cn-beijing.volces.com/api/plan`（Anthropic 兼容）；Coding Plan 分别使用 `https://ark.cn-beijing.volces.com/api/coding/v3` 与 `https://ark.cn-beijing.volces.com/api/coding`。LFAA 当前 LLM 请求基于 OpenAI Chat Completions；本轮只登记并调用已核实兼容的协议，不宣称未实现的 Responses/Anthropic 运行时。
- Agent/Coding Plan 专属 API Key 没有公开 `/models` 目录接口；Agent Plan 公共模型清单 API 使用另外的 AccessKey HMAC 管理凭据，且该清单不是用户订阅档位授权结果。当前设置页加载带版本日期/官方 URL 的受来源能力目录，用户选择自己的套餐档位，文本模型保存前仍执行一次真实专属地址请求。目录快照不伪装成用户账号的实时权限查询；最终模型是否已对个人席位开放仍由真实请求判定。
- Agent Plan 与 Coding Plan 的套餐密钥严格区分；普通方舟 API 目录刷新、模型测试与按量端点行为保持原样。
- 个人计划账户只对该账户所属用户可读/测试/激活/改密钥/删除；系统账户的管理员写权限不放宽。模型 API 不允许客户端指定其他用户的 `accountId`，服务端再次核对账户所有者。
- 不把订阅账户、使用权限、密钥或额度通过公共 API、其他用户或后台任务共享；不购买/续费套餐、不安装 CLI、不修改用户其他工具配置。
- Coding Plan 官方说明其额度适用于支持的 AI 编程工具，普通 API 调用不抵扣套餐；LFAA 按 AI Work 编程 Agent 和官方专属 Chat Completions 地址接入，但火山文档没有单独列出 LFAA。控制台是否将 LFAA 请求归入 Coding Plan 额度必须用用户自己的订阅实测，不能由本地代码保证；设置页在测试前展示此边界。
- 不复制 Provider 协议和账户业务规则到 Controller、UI 或 App 装配；更新所有受影响包 README、设置 API/类型和架构事实。

## 可观察验收条件

- 普通火山方舟 Provider 仍使用按量 `/api/v3`，其现有行为和管理员系统账户不变；Agent Plan/Coding Plan 使用自己的 Provider ID、套餐端点和按官方范围验证的模型。
- 两个不同登录用户分别添加套餐账户后，读取、激活、替换、刷新、删除和实际模型路由都仅命中各自账户；用户不能通过伪造 ID 使用其他账户的密钥。没有个人套餐配置时仍使用系统级活动模型。
- API Key 仅由服务端加密保存并由 Settings/Credentials 解密给 LLM Owner；不进入 HTTP 响应、日志、浏览器持久化或错误正文。
- Provider 探测、目录刷新、当前模型测试和 `/work` 请求使用相符的 Plan 地址与模型；认证失败、模型无权、限额、超时均按真实错误展示，不静默改走普通 API 或其他模型。
- Plan 目录只显示已知官方支持型号和对应能力类型；套餐账户主模型选择器只显示文本模型，AI Work 路由不会把图像、视频、语音或向量型号作为聊天模型。真实文本请求仍使用 Agent Plan `/api/plan/v3/chat/completions` 或 Coding Plan `/api/coding/v3/chat/completions`；失败时不转到普通 `/api/v3` 或其他账户。Agent Plan Seedream 生图与 Seedance 视频分别使用 `/api/plan/v3/images/generations`、`/api/plan/v3/contents/generations/tasks`，复用 AI Runtime 既有模型选择，AI 漫剧与系统级无限画布共用设置和 LLM 协议 Owner。视频目录仅显示 Large/Max 档位能力。Coding Plan 的 embedding 与 Agent Plan 语音/向量目前只进官方目录，后续需分别接入既有知识检索/语音功能 Owner后才能声称功能已可用。
- 设置 UI 明确分开“系统普通 API”和“我的 Agent/Coding Plan”，在桌面、窄分栏和短屏下操作可达，外观继续使用现有设置主题和响应式令牌。
- 实际套餐 Key 未提供时只报告源码/构建/API 合同证据，不声称真实计划额度扣减、套餐模型目录或 Agent Plan/Coding Plan Provider 已实测。

## 验收批次

1. Settings/Provider Owner：已增加 Plan Provider、专属端点、官方能力目录与档位选择、个人账户作用域；保留现有 system-scope 管理语义和一次性真实文本请求验证凭证。
2. Settings API/Client：已加入 Plan 用户所有权路由校验、本人席位管理 UI、按真实任务类型筛选模型、官方目录更新时间/来源展示与 Coding Plan 官方额度说明。
3. LLM/Canvas/AI Video：AI Work 使用已测试的个人 Plan 文本账户；Agent Plan 生图与视频接口已连接系统级无限画布和 AI 漫剧的既有用户选择入口，并在 Owner 中校验模型 taskType/tier。
4. 文档与交付：`tsconfig.host.json`、`tsconfig.client.json` 类型检查及 Host 包、Web、Control Plane 构建均通过；内置浏览器到 `/settings?section=ai` 的访问未能显示页面，不能记为实页通过；没有使用真实 Plan Key 发起 Provider 端请求。

## 初始实施记录

- 官方资料已核对：Agent Plan 与 Coding Plan 有不同专属 Base URL、密钥与支持范围；官方示例分别展示 OpenAI-compatible 工具、Pi 和 DeepSeek Harness 配置。Coding Plan FAQ 明确普通 API 调用不抵扣套餐，且额度适用范围由火山方舟支持的编程工具决定。
- 已修改的关键行为：普通 `doubao` Provider 保持按量 API；Agent Plan/Coding Plan 作为新 Provider 使用专属 Chat Completions URL。Plan Key 由 Settings Owner 加密保存在 `ai_accounts` 的用户范围，Controller 对账户所有权再次校验；登录用户可以在设置中心添加自己的席位、真实测试后保存和启用，Agent Loop 通过 Credentials Owner 按同一 userId 读取。个人 Plan 活动账户优先于系统活动模型；无个人 Plan 时用系统活动模型。
- 目录与多模态实现进展：Plan 官方公开清单整理在 `packages/settings/settings/src/ark-plan-model-catalog.ts`，当前修订为 2026-10-26。个人档位保存于 `ai_accounts.options_json.planTier`；文图视频模型按 taskType 分组。Seedream 与 Seedance 已经使用 Agent Plan 专属端点，并复用 AI Runtime 中图片/视频账户设置，让无限画布 `canvas-generation` 和 AI 漫剧 `ai-video` 一致取用户席位。语音和向量目录目前只声明能力，不代表设置入口/调用链已完成。
- 用户强调模型选择必须可切换，不应把功能锁定到某个型号。本轮的聊天模型选择来自账户目录中的全部文本模型；图片/视频分别由 `imageGenerationAccountId/imageGenerationModelId`、`videoGenerationAccountId/videoGenerationModelId` 选择账户与该能力目录中的型号。Seedance 仅按官方 tier 元数据过滤 Large/Max 可用型号；AI 漫剧和无限画布调用同一个 LLM Provider 协议 Owner，没有把单个模型 ID 写成固定调用目标。
- 配置/设置复核：本轮沿用 `aiRuntime.requestTimeoutSeconds` 与现有图片/视频账户、模型、时长、比例、分辨率、音频和水印设置；新增仅为套餐账户 `options_json.planTier`，不改变 `permissions.mode` 或其他偏好。模型配置的改动仍归设置中心持久化和 Credentials Owner。
- 验证记录（2026-10-26）：`pnpm exec tsc --noEmit -p tsconfig.host.json` 与 `pnpm exec tsc --noEmit -p tsconfig.client.json` 通过；`pnpm run build:harness` 构建 218 个能力包，`pnpm run build:web` 和 `pnpm run build:control-plane` 均通过，输出位于根 `dist/`。内置浏览器尝试访问实际路由 `http://127.0.0.1:5173/settings?section=ai` 后仅呈黑屏且 AX 树为空；当前 3000 端口的 Control Plane 进程持续监听但 `/api/health` 在 3 秒内无响应，因此未能取得登录后设置页或窄屏截图，没有把页面验收记为通过，也没有结束未知服务进程。未运行测试套件，未使用密钥请求真实模型，未验证套餐计量。
- 套餐密钥仍保存在 Control Plane 的加密 Settings Owner 中，这是服务端 Agent Loop 响应用户请求时所需的凭据位置；安全边界由 userId 所有权校验和每用户独立账户构成。浏览器不接收密钥。这不是“全用户共用一把系统密钥”。
- 尚未提供真实 Plan Key，未发起真实 Plan 请求或用量查询；Coding Plan 对 LFAA 的套餐额度识别仍须由火山控制台实测。之前 Control Plane/内置浏览器受服务连接故障阻断的记录须在本轮验收处更新，不能把源码或构建结果记为实页通过。

## 本轮 API 失败排查与修复

- 设置中心实际路由为 `/settings?section=ai`。火山 Agent Plan 的专属 Base URL 为 `https://ark.cn-beijing.volces.com/api/plan/v3`；普通方舟按量 API 的 `/api/v3` 不能替代它。Coding Plan 又是独立凭据与地址 `/api/coding/v3`，Agent Plan Key 不能当作 Coding Plan Key。
- 用户在 Agent Plan 表单中输入密钥后，界面没有保存套餐账户，目录仍为 0。Control Plane 日志显示首次 `POST /api/settings/ai/probe` 返回 400 `invalid_request`；请求在 1–3ms 内被 Joi 合同校验拒绝，未进入 LLM/Provider 探测。表单的 `runProbe()` 在当前模型为空时仍提交 `modelId: ""`，而 `route-contracts.ts` 对可选的 `modelId` 配置了 `.min(1)`，因此 Provider 根本没有收到这次请求。
- 修复后，仅在手工指定模型且 `modelId.trim()` 非空时发送 `modelId`；初次目录探测省略该字段，让 Agent Plan 的本地官方能力目录分支正常执行。普通模型目录请求仍可省略 `modelId`。增加定向回归，锁定此请求合同。
- Plan 的目录分支使用随 LFAA 版本维护的官方候选目录，不执行远程 `/models` 请求，也不能证明这把 Key 或套餐席位可调用每个型号。设置页提示已改为“套餐目录候选模型”，真实鉴权仍需用户选择后执行“测试模型”；只有测试成功才可保存。
- 本轮不把用户聊天中暴露的 API Key 写入配置或日志；它未保存。刷新页面会丢掉未保存的密钥。出于凭据保护，后续应由用户先轮换该 Key，再直接输入本机设置页；不由助手代填，也不代发真实模型请求。
- 官方文档确认 Agent Plan 的 OpenAI 兼容地址是 `/api/plan/v3` 并需使用专属 API Key；Coding Plan 文档明确其套餐额度仅适用于支持的 Coding 工具，普通 API 调用不抵扣套餐。LFAA 本轮未发起真实 Provider 请求，因此不能声称用户这把 Key 已通过鉴权、套餐计量已生效或 LFAA 已获火山官方列名支持。
- 本轮实际验证（2026-10-27）：`pnpm exec node --test apps/cli/tests/ark-plan-provider-catalog-request.test.mjs` 1/1 通过；最终改动后 `pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-settings run build`、`pnpm run build:web` 和 `git diff --check` 通过，Web 输出在根 `dist/apps/web/`。原 Control Plane 健康检查 200，但旧服务因构建指纹保护将文档路由返回 503；核对 3000 端口属于本任务启动的服务且没有运行中的 Java/Minecraft 或 SteamCMD 后，重启该 LFAA Web 与本机 Daemon。新进程健康检查 200，`/settings?section=ai` HTTP 200。内置浏览器两次 CUA 读取/选择均在 300 秒后工具超时；因此无法确认实际刷新后的视觉内容或交互，也没有窄视口验收，不能据此判定页面体验通过。
- 本次改动仅读取既有 AI Provider 配置（Provider、密钥、选项和当前模型）；不新增或更改设置项、默认值或用户偏好。首次目录加载仍只发出原有一次请求，不增加轮询/订阅；补充 trim 和空值判断，无模型选择时省略可选字段。
- 未从浏览器表单读取或保存聊天中给出的密钥，未调用真实套餐模型、未计量额度。真实 Agent Plan/Coding Plan 账号鉴权、Agent Plan 套餐计量、Coding Plan 对 LFAA 的计量资格、窄屏 UI 与语音/向量调用功能仍未验。聊天中已暴露的凭据建议用户轮换后在本机页面重新输入。
